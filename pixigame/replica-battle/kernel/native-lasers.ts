import type { Point, RecordData } from './model';

export interface NativeRotatingLaserState {
  relativeAngleDegrees: number;
  sweepAngleDegrees: number;
  travelledAngleDegrees: number;
  sweepSpeed: number;
  direction: number;
  parameters: RecordData;
}

const number = (parameters: RecordData, key: string): number => {
  const value = Number(parameters[key] ?? 0);
  if (!Number.isFinite(value)) throw new Error(`Invalid laser parameter ${key}`);
  return value;
};

/** LaserRotateByOwner.OnInit 0x6d663d8..0x6d664d4. Angles received from the
 * simulation are radians; native authored sweep parameters are degrees. */
export function createNativeRotatingLaser(
  parameters: RecordData, bulletAngle: number, ownerAngle: number,
): NativeRotatingLaserState {
  return {
    relativeAngleDegrees: (bulletAngle - ownerAngle) * 180 / Math.PI,
    sweepAngleDegrees: 0, travelledAngleDegrees: 0,
    sweepSpeed: number(parameters, 'SweepSpeed'),
    direction: number(parameters, 'SweepOriginDir') < 0 ? -1 : 1,
    parameters,
  };
}

/** TickHit -> UpdateStartPosition 0x6d682a4. Call every active simulation tick,
 * not only when a hit is due. Owner rotation is followed continuously. A mount
 * is the original ExtraBulletInfo local position, not a world-space offset.
 * This implements motion; damage/rebounds/ejection remain the caller's job. */
export function advanceNativeRotatingLaser(
  state: NativeRotatingLaserState, dt: number,
  owner: Point & { angle: number }, mount?: Point,
): { start: Point; angle: number } {
  const p = state.parameters;
  if (number(p, 'LaserType') === 1) {
    const acceleration = number(p, 'SweepAccelerateSpeed');
    if (acceleration !== 0) {
      state.sweepSpeed += acceleration * dt;
      const maximumSpeed = number(p, 'SweepMaxSpeed');
      if (maximumSpeed !== 0) state.sweepSpeed = Math.min(maximumSpeed, state.sweepSpeed);
    }
    const delta = state.sweepSpeed * dt;
    state.travelledAngleDegrees += delta;
    state.sweepAngleDegrees += delta * state.direction;
    const halfAngle = number(p, 'SweepAngle') / 2;
    if (state.sweepAngleDegrees >= halfAngle || state.sweepAngleDegrees <= -halfAngle) {
      // Native discards overshoot rather than reflecting the excess distance.
      state.sweepAngleDegrees = halfAngle * state.direction;
      state.direction *= -1;
    }
  }
  const local = mount || { x: 0, z: 0 };
  const sin = Math.sin(owner.angle), cos = Math.cos(owner.angle);
  return {
    start: { x: owner.x + local.x * cos + local.z * sin, z: owner.z - local.x * sin + local.z * cos },
    angle: owner.angle + (state.relativeAngleDegrees + state.sweepAngleDegrees) * Math.PI / 180,
  };
}

/** TickHit tail 0x6d69ef4..0x6d69f08. Preserve the shipped comparison: nonzero
 * SweepMaxAngle enables the limit, but the compared field is SweepMaxSpeed.
 * Invoke after the tick's damage/render pass, matching the original order. */
export function nativeRotatingLaserSweepFinished(state: NativeRotatingLaserState): boolean {
  return number(state.parameters, 'SweepMaxAngle') !== 0
    && state.travelledAngleDegrees >= number(state.parameters, 'SweepMaxSpeed');
}

/** FireHoldTime getter 0x6d65bec reads the parameter directly. Bullet Lifetime
 * is independent and must still be respected by the caller. */
export function nativeRotatingLaserFireHold(parameters: RecordData): number {
  return number(parameters, 'FireHoldTime');
}

export interface NativeLaserBounds { left: number; right: number; bottom: number; top: number }
export interface NativeLaserPoint extends Point { isLinkPoint: boolean; isHitPoint: boolean }
export interface NativeRandomLaserState {
  parameters: RecordData;
  phase: 'points' | 'delay' | 'firing';
  elapsed: number;
  points: NativeLaserPoint[];
  edgeOrder: number[];
}
export interface NativeRandomLaserUpdate {
  addedPointEffects: { point: Point; effectId: number }[];
  removePointEffects: boolean;
  beganFiring: boolean;
}

/** GetPreFiringDuration 0x6d641cc. OnInit extends the original BULLET lifetime
 * by this value; it does not replace that lifetime with FireHoldTime. */
export function nativeRandomLaserPreFireDuration(parameters: RecordData): number {
  return Math.max(0, (number(parameters, 'PointCount') - 1) * number(parameters, 'PointInterval'))
    + number(parameters, 'FireDelay');
}
export function nativeRandomLaserFireHold(parameters: RecordData): number {
  return nativeRandomLaserPreFireDuration(parameters) + number(parameters, 'FireHoldTime');
}
export function createNativeRandomLaser(parameters: RecordData): NativeRandomLaserState {
  return { parameters, phase: 'points', elapsed: 0, points: [], edgeOrder: [0, 1, 2, 3] };
}

/** GenerateEdgeRandomPos 0x6d64ff0: first four points visit a shuffled set of
 * edge STRIPS. Later points use the inset rectangle (despite the native method
 * name GetPointInEdgeRegion). No separation rejection or owner anchor exists. */
function nextRandomLaserPoint(state: NativeRandomLaserState, bounds: NativeLaserBounds, random: () => number): Point {
  const p = state.parameters;
  const range = (minimum: number, maximum: number) => minimum + random() * (maximum - minimum);
  if (number(p, 'RandomType') !== 1) return { x: range(bounds.left, bounds.right), z: range(bounds.bottom, bounds.top) };
  const dx = number(p, 'EdgeDistanceX'), dz = number(p, 'EdgeDistanceZ');
  const index = state.points.length;
  if (index >= 4) return { x: range(bounds.left + dx, bounds.right - dx), z: range(bounds.bottom + dz, bounds.top - dz) };
  if (index === 0) {
    // ShuffleEdgeOrder 0x6d65214: descending Fisher-Yates, three RNG calls.
    state.edgeOrder = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [state.edgeOrder[i], state.edgeOrder[j]] = [state.edgeOrder[j], state.edgeOrder[i]];
    }
  }
  // Jump table at ELF VA 0x1b820f6 = [0,43,58,73]. Its four handlers
  // sample left, right, top, bottom strips; each consumes x RNG before z RNG.
  switch (state.edgeOrder[index]) {
    case 0: return { x: range(bounds.left, bounds.left + dx), z: range(bounds.bottom, bounds.top) };
    case 1: return { x: range(bounds.right - dx, bounds.right), z: range(bounds.bottom, bounds.top) };
    case 2: return { x: range(bounds.left, bounds.right), z: range(bounds.top - dz, bounds.top) };
    default: return { x: range(bounds.left, bounds.right), z: range(bounds.bottom, bounds.bottom + dz) };
  }
}

/** OnTrajectoryUpdate 0x6d646f4 dispatches ONE phase per tick. The first point
 * appears immediately on the first update. Completing points resets elapsed,
 * and FireDelay starts on the following tick: excess time is not carried over.
 * GenerateNextPoint stores a single ordered polyline, with only internal
 * vertices marked link points and only the final vertex marked hit point. */
export function advanceNativeRandomLaser(
  state: NativeRandomLaserState, dt: number, bounds: NativeLaserBounds, random: () => number,
): NativeRandomLaserUpdate {
  const update: NativeRandomLaserUpdate = { addedPointEffects: [], removePointEffects: false, beganFiring: false };
  const p = state.parameters;
  if (state.phase === 'points') {
    const count = Math.trunc(number(p, 'PointCount'));
    const generate = () => {
      const index = state.points.length;
      const point = nextRandomLaserPoint(state, bounds, random);
      state.points.push({ ...point, isLinkPoint: index > 0 && index !== count - 1, isHitPoint: index === count - 1 });
      const effectId = number(p, 'PointEffectId');
      if (effectId > 0) update.addedPointEffects.push({ point, effectId });
    };
    if (!state.points.length) generate();
    state.elapsed += dt;
    const interval = number(p, 'PointInterval');
    while (state.points.length < count && state.elapsed >= interval) {
      state.elapsed -= interval;
      generate();
    }
    if (state.points.length >= count) { state.phase = 'delay'; state.elapsed = 0; }
  } else if (state.phase === 'delay') {
    state.elapsed += dt;
    if (state.elapsed >= number(p, 'FireDelay')) {
      state.phase = 'firing'; update.removePointEffects = true; update.beganFiring = true;
    }
  }
  return update;
}

/** CalLaserTracker / BuildFiringLaserTracker preserve fixed world-space points.
 * There is no segment from the owner to points[0]. All segments belong to ONE
 * bullet: caller must share hit cooldown/deduplication and remaining through
 * count across them, never spawn an independent damaging bullet per segment.
 * TickHit is suppressed entirely until firing phase (0x6d64a64..0x6d64a90). */
export function nativeRandomLaserSegments(state: NativeRandomLaserState): { start: Point; end: Point }[] {
  if (state.phase !== 'firing') return [];
  return state.points.slice(1).map((point, index) => ({ start: state.points[index], end: point }));
}
