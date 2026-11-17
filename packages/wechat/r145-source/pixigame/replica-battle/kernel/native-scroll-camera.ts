import type { Point } from './model';

export interface NativeScrollCameraBounds {
  left: number; right: number; bottom: number; top: number;
}
export interface NativeScrollCameraOptions {
  /** Original IChapter.CameraCantMove > 0; ordinary Chapter returns zero. */
  cameraCantMove?: boolean;
  /** SetTargetPos and UpdateCameraBounds skip multiplayer battles. */
  multiPlayer?: boolean;
}

/** APK 1.1.6 ScrollCameraManager.Init / .ctor, not adjustable tuning values.
 * Sources and frame contract: research/moving-camera-logic-20261019.md. */
export const nativeScrollCameraConstants = Object.freeze({
  leftX: -131072 / 65536, rightX: 131072 / 65536,
  scaleOffset: 19661 / 65536, xOffset: 131072 / 65536,
  baseSpeed: 6553 / 65536, factor: 104857 / 65536,
  minimumStepDistanceSquared: 66 / 65536,
});

const ONE = 65536n;
const i64 = (value: bigint) => BigInt.asIntN(64, value);
const raw = (value: number): bigint => {
  const result = Math.trunc(value * 65536);
  if (!Number.isFinite(value) || !Number.isSafeInteger(result))
    throw new RangeError('Scroll camera requires finite, safely representable Q16 input');
  return BigInt(result);
};
const asNumber = (value: bigint) => Number(value) / 65536;
// Initial render camera sends each float32 edge through FromFloat_UNSAFE;
// CameraBounds.getWidth/getHeight then subtract those fixed-point edges.
const initialEdgeRaw = (value: number) => raw(Math.fround(value));
// MultiplyRawValues @ 0x834dc78. Camera operands stay in its signed-32 fast
// path; retain the saturating wide path as well instead of Number rounding.
const multiply = (a: bigint, b: bigint): bigint => {
  const result = (a * b) >> 16n;
  return result < -(1n << 63n) ? -(1n << 63n)
    : result > (1n << 63n) - 1n ? (1n << 63n) - 1n : result;
};
// FPVector3.Lerp / DistanceSquared use inline low-64-bit multiplication.
const vectorMultiply = (a: bigint, b: bigint): bigint => i64(a * b) >> 16n;

/** Start creates a camera entity at world zero with the initial camera width
 * and height. Only X can follow a hero; Z remains zero. The host must submit
 * the hero's accepted movement candidate during entity update, then update
 * this camera after ALL entity/late/OrbitTracker/BulletGroup updates, before
 * wave spawning. A false update must not move walls or emit a view event. */
export class NativeScrollCamera {
  private x = 0n;
  private targetX = 0n;
  private readonly halfWidth: bigint;
  private readonly halfHeight: bigint;
  private currentBounds: NativeScrollCameraBounds;
  private positionRevision = 0;

  constructor(bounds: NativeScrollCameraBounds,
    private readonly options: NativeScrollCameraOptions = {}) {
    const left = initialEdgeRaw(bounds.left), right = initialEdgeRaw(bounds.right);
    const bottom = initialEdgeRaw(bounds.bottom), top = initialEdgeRaw(bounds.top);
    this.halfWidth = (right - left) / 2n;
    this.halfHeight = (top - bottom) / 2n;
    this.currentBounds = { left: asNumber(left), right: asNumber(right),
      bottom: asNumber(bottom), top: asNumber(top) };
  }
  get position(): Readonly<Point> { return { x: asNumber(this.x), z: 0 }; }
  get target(): Readonly<Point> { return { x: asNumber(this.targetX), z: 0 }; }
  get bounds(): Readonly<NativeScrollCameraBounds> { return this.currentBounds; }
  get revision(): number { return this.positionRevision; }

  /** SetTargetPos @ 0x6a051ac. Called with MoveTowards's candidate, before the
   * hero writes its transform; no initial follow or follow-on-idle is added. */
  setTargetPosition(position: Point): void {
    if (this.options.multiPlayer || this.options.cameraCantMove) return;
    const x = multiply(raw(position.x), 19661n);
    this.targetX = x <= -131072n ? -131072n : x < 131072n ? x : 131072n;
  }

  /** scrollCamera @ 0x6a0535c; returns true only when native code would write
   * EntityData.Position and publish bounds / camera movement render events. */
  update(dt: number): boolean {
    if (this.options.cameraCantMove) return false;
    const difference = i64(this.targetX - this.x);
    const distance = difference < 0n ? -difference : difference;
    const smoothSpeed = multiply(multiply(104857n, distance), distance);
    const interpolation = multiply(smoothSpeed, raw(dt));
    const t = interpolation < 0n ? 0n : interpolation < ONE ? interpolation : ONE;
    const nextX = i64(this.x + vectorMultiply(difference, t));
    const moved = i64(nextX - this.x);
    // Strict < 66. No snap to target occurs when the next step is too small.
    if (vectorMultiply(moved, moved) < 66n) return false;
    this.x = nextX;
    this.positionRevision++;
    if (!this.options.multiPlayer) this.currentBounds = {
      left: asNumber(i64(this.x - this.halfWidth)),
      right: asNumber(i64(this.x + this.halfWidth)),
      bottom: asNumber(-this.halfHeight), top: asNumber(this.halfHeight),
    };
    return true;
  }
}
