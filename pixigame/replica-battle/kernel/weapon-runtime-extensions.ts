/** Native trajectory primitives. Units are world units, seconds and degrees.
 * Percentage arguments are fractions (0.1 means +10%), already attribute-merged.
 * Evidence: research/weapon-missing-trajectory-native.txt and
 * research/weapon-extensions-native.txt. These helpers do not declare an entire
 * weapon family supported: its creation triggers and upgrade actions also matter.
 */
export interface NativeWeaponPoint { x: number; z: number }
export interface NativeWeaponSegment { from: NativeWeaponPoint; to: NativeWeaponPoint }

/** SectorSpread.OnInit 0x6d96e38: radius additions share one percentage bucket;
 * the passive AttackDistance% event bonus multiplies afterwards. Do not substitute
 * AllSkillRange% for that event without the passive-event mapping being resolved.
 */
export function nativeSectorRadius(options: {
  spreadRadius: number;
  shotgunRadius?: number;
  allShotgunRadius?: number;
  shotgunRadiusPercent?: number;
  allShotgunRadiusPercent?: number;
  nextFireRadiusBoost?: number;
  attackDistanceEventBonus?: number;
}): number {
  return (options.spreadRadius + (options.shotgunRadius ?? 0) + (options.allShotgunRadius ?? 0))
    * (1 + (options.shotgunRadiusPercent ?? 0) + (options.allShotgunRadiusPercent ?? 0) + (options.nextFireRadiusBoost ?? 0))
    * (1 + (options.attackDistanceEventBonus ?? 0));
}

/** One expanding sector is one bullet with multiple collision rays, not RayCount
 * independent damaging bullets. Feed accepted collisions to the normal bullet
 * hit pipeline and share that pipeline's per-target MinBulletHurtTime gate.
 * OnInit 0x6d97180 snapshots owner yaw; getBulletPos 0x6d97934 snapshots origin
 * and adds world +Z by one. Neither follows the owner after emission.
 */
export class NativeSectorSpreadRuntime {
  readonly origin: NativeWeaponPoint;
  readonly directions: readonly NativeWeaponPoint[];
  private elapsed = 0;

  constructor(options: {
    origin: NativeWeaponPoint;
    ownerYawDegrees: number;
    rayCount: number;
    spreadAngleDegrees: number;
    maxRadius: number;
    expansionTime: number;
  }) {
    this.origin = { x: options.origin.x, z: options.origin.z + 1 };
    this.maxRadius = options.maxRadius;
    this.expansionTime = options.expansionTime;
    // Native repairs invalid RayCount to one; a single ray keeps the -half-angle.
    const count = Math.max(1, Math.trunc(options.rayCount));
    const step = count > 1 ? options.spreadAngleDegrees / (count - 1) : 0;
    this.directions = Array.from({ length: count }, (_, index) => {
      const angle = (options.ownerYawDegrees - options.spreadAngleDegrees / 2 + step * index) * Math.PI / 180;
      return { x: Math.sin(angle), z: Math.cos(angle) };
    });
  }

  readonly maxRadius: number;
  readonly expansionTime: number;

  /** TickHit 0x6d97d80. Call once per simulation step, before querying all rays. */
  advance(deltaTime: number): readonly NativeWeaponSegment[] {
    this.elapsed += deltaTime;
    const fraction = this.expansionTime > 0 ? Math.min(1, this.elapsed / this.expansionTime) : 0;
    const length = this.maxRadius * fraction;
    return this.directions.map(direction => ({
      from: this.origin,
      to: { x: this.origin.x + direction.x * length, z: this.origin.z + direction.z * length },
    }));
  }
}

/** CharacterComponentSecondWeaponRotateBall2 is the active creation path in this
 * APK (CreateSecondWeaponAction 0x6b12604). Each BallSet holds ONE bullet; the old
 * RotateBall component's paired-arm layout must not be used. BallSet.Index is
 * persistent, not the current array position. Creation belongs to skill runtime.
 */
export interface NativeOrbitBallSet {
  index: number;
  bulletId: number;
}
export interface NativeOrbitPosition extends NativeWeaponPoint { bulletId: number }

/** CreateSecondWeaponAction.onAfterSecondWeaponCreated 0x6b125b0..6b12648.
 * Extra balls reuse the last configured weapon ID; they do not switch group.
 * Component storage/capacity checks belong to the caller, not this action plan.
 */
export function nativeOrbitCreationPlan(ballWeaponIds: readonly number[], rotateBallCount: number, actionExtraCount = 0): number[] {
  if (!ballWeaponIds.length) return [];
  const count = Math.max(0, ballWeaponIds.length + Math.trunc(rotateBallCount) + actionExtraCount);
  return Array.from({ length: count }, (_, index) => ballWeaponIds[Math.min(index, ballWeaponIds.length - 1)]);
}

export function nativeOrbitAngularSpeed(baseSpeed: number, rotateBallSpeedPercent: number, group: 0 | 1): number {
  // RotateBall2.OnRotateBallSpeedUpdate 0x6aeda50..6aedaa4.
  return baseSpeed * (1 + rotateBallSpeedPercent) * (group === 0 ? 1 : -1);
}

export function nativeOrbitRadius(group: 0 | 1, rotateBallRadius = 0): number {
  // Const.cctor fields 0x180 / 0x1b0 resolve to string literals 8.5 / 10.
  // RotateBall2.OnUpdate 0x6af1280 / 0x6af13c8 add RotateBallRadius.
  // Dynamic radius and the passive event bonus are applied separately below.
  return (group === 0 ? 8.5 : 10) + rotateBallRadius;
}

/** RotateBall2.UpdatePos 0x6aeb5ec and SynBall 0x6af0ea8: x=cos, z=sin.
 * The native splitAngle is 360 (ctor 0x6af280c), with one bullet in each BallSet.
 * Empty groups do not advance their phase, matching the count<1 early return.
 */
export function nativeOrbitStep(options: {
  owner: NativeWeaponPoint;
  angleDegrees: number;
  angularSpeed: number;
  deltaTime: number;
  radius: number;
  sets: readonly NativeOrbitBallSet[];
}): { angleDegrees: number; positions: NativeOrbitPosition[] } {
  const count = options.sets.length;
  if (!count) return { angleDegrees: options.angleDegrees, positions: [] };
  const angleDegrees = options.angleDegrees + options.angularSpeed * options.deltaTime;
  const interval = count > 1 ? 360 / count : 0;
  const positions: NativeOrbitPosition[] = [];
  for (const set of options.sets) {
    const angle = (angleDegrees + set.index * interval) * Math.PI / 180;
    positions.push({ bulletId: set.bulletId, x: options.owner.x + Math.cos(angle) * options.radius, z: options.owner.z + Math.sin(angle) * options.radius });
  }
  return { angleDegrees, positions };
}

export interface NativeOrbitRadiusState {
  direction: -1 | 0 | 1;
  offset: number;
  maxScale: number;
  minScale: number;
  expandDuration: number;
  contractDuration: number;
}

/** RotateBall2.CalcRotateBallRealRadius 0x6af1474. The native component shares
 * this state across groups and invokes it once for EACH nonempty group in order
 * 0,1; preserve that ordering instead of silently normalizing to one tick/frame.
 * The input event bonus is CalculatePassiveEventAttrEffectBonus("AttackDistance%").
 */
export function nativeOrbitRealRadius(fixedRadius: number, deltaTime: number, state: NativeOrbitRadiusState, attackDistanceEventBonus = 0): number {
  if (state.direction !== 0) {
    const range = fixedRadius * (state.maxScale - state.minScale);
    if (state.direction > 0) {
      state.offset += state.expandDuration ? range / state.expandDuration * deltaTime : 0;
      const maximum = fixedRadius * (state.maxScale - 1);
      if (state.offset >= maximum) { state.offset = maximum; state.direction = -1; }
    } else {
      state.offset -= state.contractDuration ? range / state.contractDuration * deltaTime : 0;
      const minimum = fixedRadius * (state.minScale - 1);
      if (state.offset <= minimum) { state.offset = minimum; state.direction = 1; }
    }
  }
  return (fixedRadius + state.offset) * (1 + attackDistanceEventBonus);
}

/** WeaponChargeModProcessor.FillLoadData 0x6dd3b04 writes HoldTime directly into
 * WeaponFireInfo.holdTime (+0). Use it as occupied pre-fire time; FireCD starts
 * after the firing phase. This is independent from ContinueMod's per-shot delays.
 */
export function nativeWeaponChargeHold(mod: { HoldTime?: number } | undefined, previousFireHold: number): number {
  return mod?.HoldTime === undefined ? previousFireHold : mod.HoldTime;
}

/** EntityCharacter.GetSwordLength 0x6be1c60..6be1edc. The AllSkillRange and
 * CurveSwordLength percentages are additive; the passive event is separate.
 */
export function nativeCurveSwordLength(allCurveSwordLength: number, allSkillRangePercent = 0, curveSwordLengthPercent = 0, attackDistanceEventBonus = 0): number {
  return allCurveSwordLength * (1 + allSkillRangePercent + curveSwordLengthPercent) * (1 + attackDistanceEventBonus);
}

/** ExplosionModProcessor.CreateSingleExplosion 0x6dc1d98..6dc2320. Do not fold
 * the global range bonus into BulletScale: native writes this resolved radius to
 * the generated explosion's load data and view scale. Flag 8192 alone admits the
 * MainWeaponExplosionMod_ExplodeRadius absolute addition.
 */
export function nativeExplosionRadius(options: {
  explodeRadius: number;
  bulletFlags?: number;
  mainWeaponExplosionRadius?: number;
  explodeRadiusPercent?: number;
  allMissileExplodeRadiusPercent?: number;
  allSkillRangePercent?: number;
  bulletTraitAreaScalePercent?: number;
}): number {
  const mainAddition = ((options.bulletFlags ?? 0) & 8192) ? (options.mainWeaponExplosionRadius ?? 0) : 0;
  return (options.explodeRadius + mainAddition)
    * (1 + (options.explodeRadiusPercent ?? 0) + (options.allMissileExplodeRadiusPercent ?? 0)
      + (options.allSkillRangePercent ?? 0) + (options.bulletTraitAreaScalePercent ?? 0));
}

/** AISecondWeaponMissile.CreateBulletsThisRound 0x68fcc4c..68fcd38:
 * (MissileCount + AllMissileCount) * (1 + AllMissileCountTimes) initial requests.
 * Each initial request adds a parallel sequence of AllMissileConsecutiveCount
 * further requests separated by raw FP 0x3333. MaxMissileCount is enforced by
 * CharacterComponentFlySword, not by this AI count formula. The boost pass sees
 * only successfully created initial bullets, never the later sequence bullets.
 */
export function nativeMissileCreationPlan(options: {
  missileCount: number;
  allMissileCount?: number;
  allMissileCountTimes?: number;
  allMissileConsecutiveCount?: number;
}): Array<{ index: number; repeat: number; delay: number; boostCandidate: boolean }> {
  const count = (Math.trunc(options.missileCount) + Math.trunc(options.allMissileCount ?? 0))
    * (1 + Math.trunc(options.allMissileCountTimes ?? 0));
  const consecutive = Math.trunc(options.allMissileConsecutiveCount ?? 0);
  const plan: Array<{ index: number; repeat: number; delay: number; boostCandidate: boolean }> = [];
  for (let index = 0; index < count; index++) {
    plan.push({ index, repeat: 0, delay: 0, boostCandidate: true });
    for (let repeat = 1; repeat <= consecutive; repeat++) {
      plan.push({ index, repeat, delay: repeat * (0x3333 / 65536), boostCandidate: false });
    }
  }
  return plan;
}
