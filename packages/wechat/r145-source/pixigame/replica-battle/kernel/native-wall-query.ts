import { nativeWallBroadphaseBuckets, nativeWallHitBucket,
  type NativeBroadphaseEntry, type NativeWallQueryScene } from './native-wall-broadphase';

/** Quantum Physics2D LineBoxLocalSpace, shipped RVA 0x83e5d98 / clone 0x83e7c0c.
 * This is a zero-rotation Box query, not a replacement for the Physics2D scene.
 * Host numbers are truncated onto Q16 on entry; an already-Q16 input is exact.
 */
export interface NativeWallPoint { x: number; z: number }
export interface NativeWallBox {
  id: string | number;
  center: NativeWallPoint;
  halfExtents: NativeWallPoint;
  layer: number;
  isTrigger?: boolean;
  bodyType?: 'static' | 'kinematic' | 'dynamic';
}
export interface NativeWallHit {
  box: NativeWallBox;
  distanceNormalized: number;
  point: NativeWallPoint;
  normal: NativeWallPoint;
  /** Set when different surfaces have the same native sort key. See query contract. */
  equalDistanceBoxIds?: Array<string | number>;
  enumeration?: 'array-fallback' | 'native-scene-snapshot' | 'scene-entry-reconstruction';
  /** False unless all original indices, entries and frame bounds are supplied. */
  equalDistanceOrderExact?: boolean;
}
const ONE = 65536n;
const MIN = -(1n << 63n);
const MAX = (1n << 63n) - 1n;
const i64 = (value: bigint) => BigInt.asIntN(64, value);
const raw = (value: number) => {
  if (!Number.isFinite(value) || !Number.isSafeInteger(Math.trunc(value * 65536))) {
    throw new RangeError('Wall query requires finite, safely representable Q16 input');
  }
  return BigInt(Math.trunc(value * 65536));
};
const value = (v: bigint) => Number(v) / 65536;
const mul = (a: bigint, b: bigint) => i64(a * b) >> 16n;
const div = (a: bigint, b: bigint) => i64(a << 16n) / b;

interface RawHit { hit: NativeWallHit; distanceSquared: bigint }

function boxHit(start: NativeWallPoint, end: NativeWallPoint, box: NativeWallBox,
  detailed: boolean): RawHit | undefined {
  const sx = raw(start.x), sz = raw(start.z);
  const cx = raw(box.center.x), cz = raw(box.center.z);
  const ex = raw(box.halfExtents.x), ez = raw(box.halfExtents.z);
  if (ex < 0n || ez < 0n) throw new RangeError('Wall box half extents must be nonnegative');
  const x = i64(sx - cx), z = i64(sz - cz);
  const dx = i64(raw(end.x) - sx), dz = i64(raw(end.z) - sz);
  const p = [-dx, dx, -dz, dz];
  const q = [i64(x + ex), i64(ex - x), i64(z + ez), i64(ez - z)];
  let enter = MIN, exit = MAX, face = -1;
  for (let index = 0; index < 4; index++) {
    if (p[index] === 0n) {
      if (q[index] < 0n) return;
      continue;
    }
    const t = div(q[index], p[index]);
    if (p[index] < 0n && t > enter) { enter = t; face = index; }
    else if (p[index] > 0n && t < exit) exit = t;
  }
  // Native unsigned compare against 1 also rejects negative entry distances.
  // Do not clamp entry to zero: rays starting inside a Box are rejected.
  if (enter < 0n || enter > ONE || enter > exit || face < 0) return;
  const px = i64(cx + i64(x + mul(enter, dx)));
  const pz = i64(cz + i64(z + mul(enter, dz)));
  const ddx = i64(sx - px), ddz = i64(sz - pz);
  return {
    hit: {
      box,
      distanceNormalized: value(enter),
      point: { x: value(px), z: value(pz) },
      normal: detailed
        ? { x: face === 0 ? -1 : face === 1 ? 1 : 0, z: face === 2 ? -1 : face === 3 ? 1 : 0 }
        : { x: 0, z: 0 },
    },
    distanceSquared: i64(mul(ddx, ddx) + mul(ddz, ddz)),
  };
}

/** Input Box order must match native broadphase enumeration for exact tie behavior.
 * The native hit collection uses this unstable, last-pivot quicksort (0x83e44ac).
 * Ordinary unique-nearest hits do not depend on enumeration order.
 */
function nativeSort(hits: RawHit[], low: number, high: number): void {
  if (low >= high) return;
  const pivot = hits[high].distanceSquared;
  let split = low;
  for (let index = low; index < high; index++) {
    if (hits[index].distanceSquared < pivot) {
      [hits[index], hits[split]] = [hits[split], hits[index]];
      split++;
    }
  }
  [hits[split], hits[high]] = [hits[high], hits[split]];
  nativeSort(hits, low, split - 1);
  nativeSort(hits, split + 1, high);
}

/** Finite XZ segment; no direction normalization, radius expansion or inside-hit fallback.
 * Supports the four zero-rotation wall boxes, layers and QueryOptions body/trigger bits.
 * Optional scene consumes native broadphase lists or rebuilds them from the
 * complete original entry set. Array-only calls retain their earlier fallback.
 * Unrelated Circle/Polygon narrow shapes are not fabricated.
 */
export function nativeWallLinecast(start: NativeWallPoint, end: NativeWallPoint,
  boxes: readonly NativeWallBox[], layerMask: number, options = 0x800f,
  scene?: NativeWallQueryScene): NativeWallHit | undefined {
  const hits: RawHit[] = [];
  const queryBox = (box: NativeWallBox, entry?: NativeBroadphaseEntry) => {
    const layer = entry?.layer ?? box.layer;
    if (!Number.isInteger(layer) || layer < 0 || layer > 31) {
      throw new RangeError('Wall query layer must be in 0..31');
    }
    const bodyType = entry?.bodyType ?? box.bodyType;
    const bodyFlag = bodyType === 'dynamic' ? 4 : bodyType === 'kinematic' ? 2 : 1;
    if (!(layerMask & (1 << layer)) || !(options & bodyFlag)
      || ((entry?.isTrigger ?? box.isTrigger) && !(options & 8))) return;
    const found = boxHit(start, end, box, Boolean(options & 0x8000));
    if (found) hits.push(found);
  };
  if (scene) {
    const byId = new Map(boxes.map(box => [box.id, box]));
    for (const bucket of nativeWallBroadphaseBuckets(start, end, scene)) {
      for (const entry of bucket.entries) {
        const bodyFlag = entry.bodyType === 'dynamic' ? 4 : entry.bodyType === 'kinematic' ? 2 : 1;
        // Filter after full-scene list construction/enumeration. Unrelated
        // layers still affect the prefix order and subdivision boundaries.
        if (!(layerMask & (1 << entry.layer)) || !(options & bodyFlag)
          || (entry.isTrigger && !(options & 8))) continue;
        const box = entry.boxId === undefined ? undefined : byId.get(entry.boxId);
        if (!box) throw new RangeError('Eligible native scene entry has no supported wall narrow shape');
        queryBox(box, entry);
      }
      // Scene2D firstHitOnly stops after the current bucket, never after the
      // first individual candidate. Earlier buckets can hold future-bucket hits.
      if (hits.some(found => nativeWallHitBucket(found.hit.point, scene) === bucket.index)) break;
    }
  } else {
    for (const box of boxes) queryBox(box);
  }
  nativeSort(hits, 0, hits.length - 1);
  const first = hits[0];
  if (!first) return;
  first.hit.enumeration = !scene ? 'array-fallback'
    : scene.buckets ? 'native-scene-snapshot' : 'scene-entry-reconstruction';
  first.hit.equalDistanceOrderExact = scene?.completeness === 'native-complete';
  const ties = hits.filter(item => item.distanceSquared === first.distanceSquared);
  if (ties.length > 1) first.hit.equalDistanceBoxIds = ties.map(item => item.hit.box.id);
  return first.hit;
}

export const nativeWallQueryFeatures = {
  zeroRotationBox: true,
  segmentEndpointsInclusive: true,
  insideBoxEntryRejected: true,
  q16BoxArithmetic: true,
  inputNumberAdapter: 'truncate-to-q16',
  nearestSort: 'q16-contact-distance-squared',
  exactTieRequiresNativeBroadphaseOrder: true,
  nativeSceneSnapshotSupported: true,
  fullSceneEntryReconstructionSupported: true,
  circlePolygonSupported: false,
} as const;
