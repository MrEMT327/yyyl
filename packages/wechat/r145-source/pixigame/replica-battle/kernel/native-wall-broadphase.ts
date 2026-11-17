/** Quantum Scene2D regular-query broadphase, from APK 1.1.6.
 * Inputs are scene entries, not layer-filtered query objects. Omitting an
 * unrelated entry can change a stabbing prefix and thus an equal-hit order.
 * See research/wall-corner-order-20261019.md for the native addresses.
 */
export interface NativeBroadphaseAabb {
  /** Signed int32 Q16, matching Entry2D.IntAABB. */
  minX: number; maxX: number; minZ: number; maxZ: number;
}
export interface NativeBroadphaseEntry {
  /** Quantum Entry.Index; never substitute a host entity UID. */
  index: number;
  aabb: NativeBroadphaseAabb;
  bodyType: 'static' | 'kinematic' | 'dynamic' | 'query';
  layer: number;
  isTrigger?: boolean;
  enabled?: boolean;
  /** Cached Entry2D bucket range, when consuming a native snapshot. */
  bucketStart?: number;
  bucketEnd?: number;
  /** Wall narrow-phase object associated with this entry, if any. */
  boxId?: string | number;
}
export interface NativeBroadphaseProfile {
  worldSizeRaw: number;
  bucketCount: number;
  subdivisions: number;
  bucketOnX: boolean;
  sortOnX: boolean;
}
export interface NativeStabbingSegment {
  /** Original shifted sorting coordinate, not a floating world position. */
  stabbingNumber: number;
  /** Original ActiveEntryList.Items order. */
  entryIndices: readonly number[];
  countUnsorted: number;
}
export interface NativeBroadphaseBucketSnapshot {
  index: number;
  statics: readonly NativeStabbingSegment[];
  dynamics: readonly NativeStabbingSegment[];
}
export interface NativeWallQueryScene {
  profile: NativeBroadphaseProfile;
  /** Includes entries outside the requested layer mask and queued queries. */
  entries: readonly NativeBroadphaseEntry[];
  /** Supply native lists when available; otherwise rebuild from all entries. */
  buckets?: readonly NativeBroadphaseBucketSnapshot[];
  /** Exact means native indices, all entries, and the queried frame's AABBs.
   * A four-wall projection must be declared partial even if its boxes are exact. */
  completeness: 'native-complete' | 'partial';
}
export interface NativeBroadphaseQueryBucket {
  index: number;
  entries: readonly NativeBroadphaseEntry[];
}
interface Point { x: number; z: number }
interface EndPoint { value: number; index: number; begin: boolean; entry: NativeBroadphaseEntry }
interface MutableSegment { stabbingNumber: number; entryIndices: number[]; countUnsorted: number }
const SHIFT = 0x3fffffff;
const USABLE_MIN = -0x3fffffff;
const USABLE_MAX = 0x3fffffff;
const raw = (n: number): number => {
  const result = Math.trunc(n * 65536);
  if (!Number.isSafeInteger(result) || result < -0x80000000 || result > 0x7fffffff) {
    throw new RangeError('Broadphase position must fit a signed int32 Q16 value');
  }
  return result;
};
const int32 = (n: number): number => {
  if (!Number.isInteger(n) || n < -0x80000000 || n > 0x7fffffff) {
    throw new RangeError('Broadphase AABB must contain signed int32 Q16 integers');
  }
  return n;
};
const axisMin = (a: NativeBroadphaseAabb, x: boolean) => x ? a.minX : a.minZ;
const axisMax = (a: NativeBroadphaseAabb, x: boolean) => x ? a.maxX : a.maxZ;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function profileSize(profile: NativeBroadphaseProfile): { size: number; offset: number } {
  if (!Number.isInteger(profile.worldSizeRaw) || profile.worldSizeRaw <= 0
    || !Number.isInteger(profile.bucketCount) || profile.bucketCount < 1
    || !Number.isInteger(profile.subdivisions) || profile.subdivisions < 1) {
    throw new RangeError('Invalid native broadphase map profile');
  }
  const size = Math.trunc(profile.worldSizeRaw / profile.bucketCount);
  if (size < 1) throw new RangeError('Native broadphase bucket size is zero');
  return { size, offset: Math.trunc(profile.worldSizeRaw / 2) };
}

function entryBucketRange(entry: NativeBroadphaseEntry, profile: NativeBroadphaseProfile): [number, number] {
  if (entry.bucketStart !== undefined && entry.bucketEnd !== undefined) return [entry.bucketStart, entry.bucketEnd];
  const { size, offset } = profileSize(profile);
  const first = Math.trunc((offset + axisMin(entry.aabb, profile.bucketOnX)) / size);
  const last = Math.trunc((offset + axisMax(entry.aabb, profile.bucketOnX)) / size);
  return [clamp(first, 0, profile.bucketCount - 1), clamp(last, 0, profile.bucketCount - 1)];
}

/** Six stable byte passes at 0x8431978: Index bytes 0/1, then Value bytes
 * 0/1/2/3. The upper Index flags are deliberately not a sorting key. */
function radixEndPoints(source: EndPoint[]): EndPoint[] {
  let from = source;
  for (const pass of [4, 5, 0, 1, 2, 3]) {
    const counts = new Uint32Array(256);
    const key = (point: EndPoint) => pass < 4
      ? (point.value >>> (pass * 8)) & 255
      : (point.index >>> ((pass - 4) * 8)) & 255;
    for (const point of from) counts[key(point)]++;
    let next = 0;
    for (let i = 0; i < 256; i++) { const count = counts[i]; counts[i] = next; next += count; }
    const to = new Array<EndPoint>(from.length);
    for (const point of from) to[counts[key(point)]++] = point;
    from = to;
  }
  return from;
}

function endPoints(entries: readonly NativeBroadphaseEntry[], profile: NativeBroadphaseProfile): EndPoint[] {
  const points: EndPoint[] = [];
  for (const entry of entries) {
    let max = clamp(axisMax(entry.aabb, profile.sortOnX), USABLE_MIN + 1, USABLE_MAX);
    const min = Math.min(Math.max(axisMin(entry.aabb, profile.sortOnX), USABLE_MIN), max - 1);
    max += SHIFT;
    let index = entry.index;
    if (entry.bodyType === 'query') index |= 0x08000000;
    else if (entry.bodyType === 'static') index |= 0x40000000;
    else if (entry.bodyType === 'kinematic') index |= 0x10000000;
    if (entry.isTrigger) index |= 0x20000000;
    points.push({ value: min + SHIFT, index: (index | 0x80000000) >>> 0, begin: true, entry });
    points.push({ value: max, index: index >>> 0, begin: false, entry });
  }
  return radixEndPoints(points);
}

/** ActiveEntryList.Remove swaps the last entry into the removed slot. */
function remove(active: number[], index: number): void {
  const at = active.indexOf(index);
  if (at < 0) throw new RangeError('Native broadphase endpoint ended an inactive entry');
  const last = active.pop()!;
  if (at < active.length) active[at] = last;
}

function buildSegments(entries: readonly NativeBroadphaseEntry[], profile: NativeBroadphaseProfile,
  statics: boolean): NativeStabbingSegment[] {
  const segments: MutableSegment[] = [{ stabbingNumber: 0, entryIndices: [], countUnsorted: 0 }];
  // Queries contribute bucket EndPointsCount / subdivisions, but do not enter
  // the Dynamic/Kinematic/KinematicTrigger list copied into a stabbing prefix.
  const entriesPerList = Math.trunc(entries.length / profile.subdivisions);
  const active: number[][] = statics ? [[], []] : [[], [], []];
  const category = (entry: NativeBroadphaseEntry) => statics ? (entry.isTrigger ? 1 : 0)
    : entry.bodyType === 'dynamic' ? 0 : entry.isTrigger ? 2 : 1;
  let processed = 0;
  for (const point of endPoints(entries, profile)) {
    const entry = point.entry;
    if (entry.bodyType === 'query') continue;
    const list = active[category(entry)];
    if (point.begin) {
      list.push(entry.index);
      segments[segments.length - 1].entryIndices.push(entry.index);
    } else {
      remove(list, entry.index);
      if (segments.length < profile.subdivisions && ++processed >= entriesPerList) {
        const prefix = active.flat();
        segments.push({ stabbingNumber: point.value, entryIndices: prefix, countUnsorted: prefix.length });
        processed = 0;
      }
    }
  }
  return segments;
}

/** Rebuild only from a complete frame entry set. The result preserves native
 * active-list mechanics; it cannot recreate omitted ECS indices or entities. */
export function buildNativeWallBroadphase(scene: NativeWallQueryScene): NativeBroadphaseBucketSnapshot[] {
  profileSize(scene.profile);
  validateEntries(scene.entries);
  for (const entry of scene.entries) {
    // Scene2D logs/asserts unsupported dynamic-trigger endpoint categories.
    // A supplied native bucket snapshot remains consumable without inventing
    // an alternative reconstruction for this unsupported builder category.
    if (entry.bodyType === 'dynamic' && entry.isTrigger) {
      throw new RangeError('Rebuilding native dynamic-trigger endpoints is unsupported');
    }
  }
  return Array.from({ length: scene.profile.bucketCount }, (_, index) => {
    const all = scene.entries.filter(entry => {
      const [min, max] = entryBucketRange(entry, scene.profile);
      return index >= min && index <= max;
    });
    return {
      index,
      statics: buildSegments(all.filter(entry => entry.bodyType === 'static'), scene.profile, true),
      dynamics: buildSegments(all.filter(entry => entry.bodyType !== 'static'), scene.profile, false),
    };
  });
}

function validateEntries(entries: readonly NativeBroadphaseEntry[]): void {
  const seen = new Set<number>();
  for (const entry of entries) {
    if (!Number.isInteger(entry.index) || entry.index < 0 || entry.index >= 0x08000000
      || (entry.bodyType !== 'query' && seen.has(entry.index))) {
      throw new RangeError('Scene entries require unique original Quantum Entry.Index values');
    }
    if (entry.bodyType !== 'query') seen.add(entry.index);
    const a = entry.aabb;
    for (const n of [a.minX, a.maxX, a.minZ, a.maxZ]) int32(n);
    if (a.minX > a.maxX || a.minZ > a.maxZ) throw new RangeError('Invalid native broadphase AABB');
    if (!Number.isInteger(entry.layer) || entry.layer < 0 || entry.layer > 31) {
      throw new RangeError('Native scene entry layer must be in 0..31');
    }
  }
}

function stab(segments: readonly NativeStabbingSegment[], point: number): number {
  let low = 0, high = segments.length;
  while (low < high) {
    const mid = Math.trunc((low + high) / 2);
    if (segments[mid].stabbingNumber <= point) low = mid + 1;
    else high = mid;
  }
  return low - 1;
}

/** Hit point bucket is deliberately not clamped. ResolveQuery tests it against
 * the current bucket to implement firstHitOnly; traversal bounds are clamped. */
export function nativeWallHitBucket(point: Point, scene: NativeWallQueryScene): number {
  const { size, offset } = profileSize(scene.profile);
  return Math.trunc((offset + raw(scene.profile.bucketOnX ? point.x : point.z)) / size);
}

/** Candidate order before layer/trigger/body filtering and narrow-phase work.
 * Repeated entries in later buckets are skipped by their original bucket range,
 * not by a new wall-ID deduplication policy. */
export function nativeWallBroadphaseBuckets(start: Point, end: Point,
  scene: NativeWallQueryScene): NativeBroadphaseQueryBucket[] {
  const { profile } = scene;
  profileSize(profile);
  validateEntries(scene.entries);
  const sx = raw(start.x), sz = raw(start.z), ex = raw(end.x), ez = raw(end.z);
  const query: NativeBroadphaseAabb = {
    minX: Math.min(sx, ex), maxX: Math.max(sx, ex),
    minZ: Math.min(sz, ez), maxZ: Math.max(sz, ez),
  };
  const sortMin = axisMin(query, profile.sortOnX), sortMax = axisMax(query, profile.sortOnX);
  const shifted = sortMin + SHIFT;
  if (shifted < 0) return [];
  const first = clamp(nativeWallHitBucket(start, scene), 0, profile.bucketCount - 1);
  const last = clamp(nativeWallHitBucket(end, scene), 0, profile.bucketCount - 1);
  const backwards = profile.bucketOnX ? sx >= ex : sz >= ez;
  const step = backwards ? -1 : 1;
  // Queued-query indices are a different namespace (endpoint bit 27). Queries
  // affect endpoint counts but are never entries in the returned stabbing lists.
  const byIndex = new Map(scene.entries.filter(entry => entry.bodyType !== 'query').map(entry => [entry.index, entry]));
  const buckets = scene.buckets ?? buildNativeWallBroadphase(scene);
  const byBucket = new Map(buckets.map(bucket => [bucket.index, bucket]));
  const result: NativeBroadphaseQueryBucket[] = [];
  for (let bucketIndex = first; ; bucketIndex += step) {
    const bucket = byBucket.get(bucketIndex);
    if (!bucket) throw new RangeError('Native broadphase snapshot is missing a traversed bucket');
    const found: NativeBroadphaseEntry[] = [];
    for (const segments of [bucket.statics, bucket.dynamics]) {
      const initial = stab(segments, shifted);
      if (initial < 0) continue;
      let finished = false;
      for (let s = initial; s < segments.length && !finished; s++) {
        const segment = segments[s];
        const begin = s === initial ? 0 : segment.countUnsorted;
        for (let i = begin; i < segment.entryIndices.length; i++) {
          const entry = byIndex.get(segment.entryIndices[i]);
          if (!entry) throw new RangeError('StabbingList references a missing scene entry');
          const aabb = entry.aabb;
          if (i >= segment.countUnsorted && axisMin(aabb, profile.sortOnX) > sortMax) {
            finished = true;
            break;
          }
          if (axisMax(aabb, profile.sortOnX) < sortMin) continue;
          if (entry.bodyType === 'query' || entry.enabled === false) continue;
          const [min, max] = entryBucketRange(entry, profile);
          if (bucketIndex !== first && bucketIndex !== (backwards ? max : min)) continue;
          // Original non-sorting-axis AABB overlap uses strict comparisons.
          if (axisMax(aabb, !profile.sortOnX) <= axisMin(query, !profile.sortOnX)
            || axisMin(aabb, !profile.sortOnX) >= axisMax(query, !profile.sortOnX)) continue;
          found.push(entry);
        }
      }
    }
    result.push({ index: bucketIndex, entries: found });
    if (bucketIndex === last) break;
  }
  return result;
}

/** Serialized MapDataS_1_1; source data and pathId are in the research JSON. */
export const nativeChapter9BroadphaseProfile: NativeBroadphaseProfile = {
  worldSizeRaw: 43 * 65536,
  bucketCount: 16,
  subdivisions: 8,
  bucketOnX: true,
  sortOnX: false,
};
