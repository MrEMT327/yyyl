import type { NativeWeaponPoint } from './weapon-runtime-extensions';

type Point = NativeWeaponPoint;
export interface NativeDerivedWeaponFire {
  weaponId: number;
  origin: Point;
  yawDegrees: number;
  targetPosition?: Point;
  /** Raw addFlag; CreateWeaponAndFire also ORs 0x88 (0x80 for weapon101407). */
  flags: number;
  bulletTrait: number;
  isWorldFirePos: boolean;
  useFixedPos: boolean;
  /** Native changeWeaponAction calls owner.Weapon.CopyModInfo(newWeapon, excludes). */
  copyOwnerWeaponMods?: boolean;
  excludeOwnerModTypes?: readonly string[];
}
export interface NativeDerivedSource {
  position: Point;
  yawDegrees: number;
  weaponId: number;
  flags: number;
  ownerExists: boolean;
  ownerDead: boolean;
}

/** WeakLaser event4 finds the configured weapon's BulletId globally, across owners/camps.
 * Caller must invoke native-style OnDie(false,false,true) for each returned live UID,
 * not silently splice bullets or set ignoreTrigger=true. */
export function nativeWeakLaserReplacementUids(weakWeaponBulletId: number | undefined,
  allBullets: readonly { uid: number; bulletId: number; dead: boolean }[]): number[] {
  if (weakWeaponBulletId === undefined || weakWeaponBulletId <= 0) return [];
  return allBullets.filter(item => !item.dead && item.bulletId === weakWeaponBulletId).map(item => item.uid);
}

/** WeakLaser event22, before source destruction. No mother mods or damage snapshot. */
export function nativeWeakLaserOnDeath(weaponId: number, source: NativeDerivedSource): NativeDerivedWeaponFire | undefined {
  if (weaponId <= 0 || !source.ownerExists || source.ownerDead || (source.flags & 8)) return undefined;
  return { weaponId, origin: { ...source.position }, yawDegrees: source.yawDegrees,
    flags: 0, bulletTrait: 0, isWorldFirePos: false, useFixedPos: true };
}

export interface NativeCreateWeaponUponDeadParams {
  WeaponId: number;
  UseHurtEntityPos?: boolean;
  /** Declared native fields, but this processor never reads either one. */
  TargetTriggerCd?: number;
  AllowedSecondWeaponTypes?: readonly number[];
}

/** CreateWeaponUponDead event22 args[1] is a Vector3, not an EntityCharacter.
 * Missing args[1] remains Vector3.Zero when UseHurtEntityPos is enabled.
 * LaserStickTrajectoryModProcessor overrides X/Z with nonzero LaserStartPos.
 * It does not check owner.IsDead, TargetTriggerCd, or AllowedSecondWeaponTypes. */
export function nativeCreateWeaponUponDeath(params: NativeCreateWeaponUponDeadParams,
  source: NativeDerivedSource, eventHurtPosition?: Point,
  laserStick?: { laserStartPosition: Point; nonzero: boolean }): NativeDerivedWeaponFire | undefined {
  if (!source.ownerExists || (source.flags & 8)) return undefined;
  let origin = params.UseHurtEntityPos ? { ...(eventHurtPosition ?? { x: 0, z: 0 }) } : { ...source.position };
  if (laserStick?.nonzero) origin = { ...laserStick.laserStartPosition };
  return { weaponId: params.WeaponId, origin, yawDegrees: source.yawDegrees,
    flags: 0, bulletTrait: 0, isWorldFirePos: true, useFixedPos: false };
}

export interface NativeHitBehindFissionParams {
  Prob?: number;
  Count?: number;
  PerAngle?: number;
  ExtraOffset?: number;
  BulletTrait?: number;
  WeaponId?: number;
  IsExcludeSelf?: boolean;
}
export const nativeHitBehindFissionDefaults = {
  Prob: 1, Count: 2, PerAngle: 20, ExtraOffset: 1, BulletTrait: 16,
} as const;

/** One processor for all repeated HitBehindFissionMod installations on a source bullet.
 * Evidence: 0x6d33758, 0x6d33980, 0x6d33a5c, lambda 0x6d34580. */
export class NativeHitBehindFissionRuntime {
  private probability = 0;
  private count = 0;
  private sourceTraits = 0;

  constructor(private readonly params: NativeHitBehindFissionParams) { this.addRepeat(params); }
  get sourceInitTraits(): number { return this.sourceTraits; }

  /** Native AddModRepeat sums only probability/count and ORs source traits. */
  addRepeat(params: NativeHitBehindFissionParams): void {
    this.probability += params.Prob ?? nativeHitBehindFissionDefaults.Prob;
    this.count += Math.trunc(params.Count ?? nativeHitBehindFissionDefaults.Count);
    this.sourceTraits |= params.BulletTrait ?? nativeHitBehindFissionDefaults.BulletTrait;
  }

  /** Call specifically for component event26, after non-miss damage and CritLogic,
   * before event25. A dead target is valid; native does not require survival. */
  onEnemyHit(source: NativeDerivedSource, options: {
    disabled: boolean;
    target?: { position: Point; shapeRadius: number };
    ownerBulletTraitSplitCount: number;
    ownerHasWeapon: boolean;
    random: () => number;
  }): NativeDerivedWeaponFire[] {
    if ((source.flags & 0x10000) || options.disabled || !options.target) return [];
    // Roll occurs before resolving owner and target. Even probability=1 consumes RNG.
    if (options.random() > this.probability || !source.ownerExists) return [];
    const trait = this.params.BulletTrait ?? nativeHitBehindFissionDefaults.BulletTrait;
    const count = this.count + ((trait & 16) ? Math.floor(options.ownerBulletTraitSplitCount) : 0);
    if (count <= 0) return [];
    const radians = source.yawDegrees * Math.PI / 180;
    const forward = { x: Math.sin(radians), z: Math.cos(radians) };
    const tangent = { x: -forward.z, z: forward.x };
    const distance = options.target.shapeRadius + (this.params.ExtraOffset ?? nativeHitBehindFissionDefaults.ExtraOffset);
    const center = { x: options.target.position.x + forward.x * distance,
      z: options.target.position.z + forward.z * distance };
    const projection = (source.position.x - center.x) * tangent.x + (source.position.z - center.z) * tangent.z;
    const origin = { x: center.x + tangent.x * projection, z: center.z + tangent.z * projection };
    const step = this.params.PerAngle ?? nativeHitBehindFissionDefaults.PerAngle;
    const weaponId = (this.params.WeaponId ?? 0) > 0 ? this.params.WeaponId! : source.weaponId;
    const result: NativeDerivedWeaponFire[] = [];
    for (let i = 0; i < count; i++) {
      const yawDegrees = source.yawDegrees + i * step - (count - 1) * step / 2;
      const angle = yawDegrees * Math.PI / 180;
      result.push({ weaponId, origin: { ...origin }, yawDegrees,
        targetPosition: { x: origin.x + Math.sin(angle) * 10, z: origin.z + Math.cos(angle) * 10 },
        flags: 0x106c8, bulletTrait: 0, isWorldFirePos: true, useFixedPos: false,
        copyOwnerWeaponMods: options.ownerHasWeapon,
        excludeOwnerModTypes: this.params.IsExcludeSelf ? ['HitBehindFissionMod'] : [],
      });
    }
    return result;
  }
}
