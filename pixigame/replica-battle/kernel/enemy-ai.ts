import type { Point } from './model';

/** Offline translation of APK methods cited in research/enemy-ai-fidelity.md. */
export interface AttackLoopState { remaining: number; finished: boolean }
export function createAttackLoop(fireDelay = 0): AttackLoopState {
  return { remaining: fireDelay, finished: false };
}

/** AttackActionLoop: the first delay is NOT delay + interval. */
export function advanceAttackLoop(
  state: AttackLoopState, dt: number, interval: number,
  inAttacking: boolean, allowSendBullet: boolean, allowAttack = true,
  outMapSuccess = true,
): boolean {
  if (state.finished) return false;
  if (outMapSuccess && !allowSendBullet) { state.finished = true; return false; }
  state.remaining -= dt;
  if (state.remaining > 0 || inAttacking) return false;
  // A rejected allowAttack attempt still consumes this interval in the original.
  state.remaining = interval;
  return allowAttack;
}

/** EntityCharacter.AllowSendBullet + MapManager.IsBelowMapRange. */
export function canEnemySendBullet(z: number, noAttackArea: number, bottom: number, height: number): boolean {
  if (noAttackArea <= 0) return true;
  const area = Math.trunc(noAttackArea);
  const fraction = area === 1 ? 21845 / 65536 : area === 2 ? 0.5 : 0;
  return z > bottom + height * fraction;
}

export interface TwoPointMove { start: Point; end: Point; towardsEnd: boolean }
export function createTwoPointMove(position: Point, offset: Point): TwoPointMove {
  return { start: { ...position }, end: { x: position.x + offset.x, z: position.z + offset.z }, towardsEnd: true };
}

/** MoveTowards, followed by endpoint swap. Does not turn the aircraft. */
export function advanceTwoPointMove(position: Point, move: TwoPointMove, speed: number, dt: number): void {
  const target = move.towardsEnd ? move.end : move.start;
  const x = target.x - position.x, z = target.z - position.z;
  const distance = Math.hypot(x, z), step = Math.max(0, speed) * dt;
  if (distance <= step) {
    position.x = target.x; position.z = target.z;
    move.towardsEnd = !move.towardsEnd;
  } else if (distance > 0) {
    position.x += x / distance * step; position.z += z / distance * step;
  }
}

/** LeaveData.AttackTime is active only for LeaveType.ByTime (1). */
export function shouldLeave(leaveType: number, attackingTime: number, attackTime: number): boolean {
  return leaveType === 1 && attackingTime >= attackTime;
}

export const bossDefaults = Object.freeze({ weaponWeight: 10, weaponMoveType: 0, fireCooldown: 1 });

export interface CameraRect { left: number; right: number; bottom: number; top: number }

export interface NativeBornParameters { Duration?: number; Parallel?: number; RandomEdge?: number; EdgeType?: number }

/** BornData .ctor 0x68dcdc8 leaves fields zero; OnBorn compares integer switches to 1. */
export function nativeBornSettings(bornType: number, parameters: NativeBornParameters = {}) {
  return {
    duration: bornType === 1 ? Math.max(0, Number(parameters.Duration ?? 0)) : 0,
    parallel: parameters.Parallel === 1,
    randomEdge: parameters.RandomEdge === 1,
    // -1 means nearest only when explicitly configured. Missing EdgeType is left (0).
    edgeType: Number(parameters.EdgeType ?? 0),
  };
}

/** GetFlyInPos: 0=left, 1=right, 2=top. Never invent a fourth bottom entry. */
export function enemyEntryPoint(
  destination: Point, bounds: CameraRect, parallel: boolean, randomEdge: boolean,
  edgeType: number, random: () => number,
): Point {
  let edge = edgeType;
  if (randomEdge) edge = Math.min(2, Math.floor(random() * 3));
  else if (edge === -1) {
    const left = Math.abs(destination.x - bounds.left), right = Math.abs(bounds.right - destination.x);
    edge = right < left ? 1 : 0;
    if (Math.abs(bounds.top - destination.z) < Math.min(left, right)) edge = 2;
  }
  if (edge === 0) return { x: bounds.left, z: parallel ? destination.z : bounds.bottom + random() * (bounds.top - bounds.bottom) };
  if (edge === 1) return { x: bounds.right, z: parallel ? destination.z : bounds.bottom + random() * (bounds.top - bounds.bottom) };
  if (edge === 2) return { x: parallel ? destination.x : bounds.left + random() * (bounds.right - bounds.left), z: bounds.top };
  return { ...destination };
}

/** AIMoveToBottomAndAttack.InitAttackLoop 0x68f65f8–0x68f6660. */
export function bottomAttackTarget(position: Point, bounds: CameraRect, loopZ: number, offset: Point): Point {
  // loopZ is an explicit spawn argument; it is NOT the actor's collision radius.
  return { x: position.x + offset.x, z: bounds.bottom + loopZ + offset.z };
}

/** EntityCharacter.GetLoopMoveRestartPos 0x6bb269c: retain BirthPos.x, restart above top. */
export function enemyLoopRestartPoint(birthPosition: Point, bounds: CameraRect, shapeRadius: number, restartZOffset: number): Point {
  return { x: birthPosition.x, z: bounds.top + shapeRadius + restartZOffset };
}

/** MonsterMoveToPoint 0x69d8b20 detects arrival before stepping, without rotating. */
export function advanceMoveToPoint(position: Point, target: Point, speed: number, dt: number): boolean {
  if (position.x === target.x && position.z === target.z) return true;
  const dx = target.x - position.x, dz = target.z - position.z;
  const distance = Math.hypot(dx, dz), step = Math.max(0, speed) * dt;
  if (distance <= step) { position.x = target.x; position.z = target.z; }
  else if (distance > 0) { position.x += dx / distance * step; position.z += dz / distance * step; }
  return false;
}

/** GetRandomPosInTopMap samples full width then clamps; do not sample only the inset width. */
export function bossRandomTarget(
  position: Point, bounds: CameraRect, minZ: number, maxZ: number,
  shapeRadius2: number, moveType: number, random: () => number,
): Point {
  const radius = shapeRadius2, height = bounds.top - bounds.bottom;
  const rawX = bounds.left + random() * (bounds.right - bounds.left);
  const lowZ = bounds.bottom + height * minZ + radius;
  const highZ = bounds.bottom + height * maxZ - radius;
  const rawZ = lowZ + random() * (highZ - lowZ);
  const point = {
    x: Math.max(bounds.left + radius, Math.min(bounds.right - radius, rawX)),
    z: Math.max(bounds.bottom + radius, Math.min(bounds.top - radius, rawZ)),
  };
  if (moveType === 1) point.z = position.z;
  if (moveType === 2) point.x = position.x;
  return point;
}

/** Native random movement checks arrival before MoveTowards; retains heading by default. */
export function advanceBossMove(position: Point, target: Point, speed: number, dt: number, moveType = 0): void {
  if (moveType === 3) return;
  const dx = target.x - position.x, dz = target.z - position.z;
  const distance = Math.hypot(dx, dz), step = Math.max(0, speed) * dt;
  if (distance <= step) { position.x = target.x; position.z = target.z; }
  else if (distance > 0) { position.x += dx / distance * step; position.z += dz / distance * step; }
}

/** Boss attack choices use weights, not a cyclic weapon index. */
export function selectBossWeapon(weaponIds: number[], configuredWeights: number[] | undefined, random: number): number {
  const weights = weaponIds.map((_, i) => Math.max(0, configuredWeights?.[i] ?? bossDefaults.weaponWeight));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!total || !weaponIds.length) return 0;
  let remaining = Math.max(0, Math.min(1 - Number.EPSILON, random)) * total;
  for (let i = 0; i < weights.length; i++) {
    remaining -= weights[i];
    if (remaining < 0) return weaponIds[i];
  }
  return weaponIds[weaponIds.length - 1];
}
