import type { Point, RecordData } from './model';
import { nativeHurtTypeFromExpressions } from './native-back-death';

/** ExplosionMod creates a fresh Weapon/Bullet; its damage is not the triggering hit. */
export interface ExplosionSpec {
  weaponId: number;
  bulletId: number;
  element: number;
  hurtType: number;
  attackMultiplier: number;
  lifetime: number;
  hitInterval: number;
  shapeRadius: number;
  canCrit: boolean;
  flags: number;
  traits: number;
}

export function resolveExplosionSpec(config: RecordData, weapon: RecordData | undefined, bullet: RecordData | undefined): ExplosionSpec | undefined {
  if (!weapon || !bullet) return;
  const expression = (bullet.hurtAttributes as string[] | undefined)?.find(value => value.startsWith('Attack='));
  // Current native explosion bullets use Attack=1*325% / Attack=1*800%.
  // Do not silently replace a missing or new formula with the cannon's 325%.
  const match = expression?.match(/^Attack=1(?:\*(\d+(?:\.\d+)?)%)?$/);
  const hurtType = nativeHurtTypeFromExpressions(bullet.hurtAttributes);
  if (!match || hurtType === undefined || !(bullet.LifeTime > 0) || !(bullet.Shape?.[0] > 0)) return;
  const flags = Number(bullet.Flag || 0);
  return {
    weaponId: Number(config.weaponId), bulletId: Number(weapon.bulletId ?? weapon.BulletId),
    element: Number(bullet.Element || 0), hurtType, attackMultiplier: match[1] ? Number(match[1]) / 100 : 1,
    lifetime: Number(bullet.LifeTime), hitInterval: Number(bullet.MinBulletHurtTime || 0),
    shapeRadius: Number(bullet.Shape[0]), canCrit: !(flags & 524288), flags,
    // ExplosionModParams..ctor adds BulletTrait.Explosion (2048).
    traits: Number(bullet.BulletTrait || 0) | Number(config.bulletTrait ?? 2048),
  };
}

/** Only ExplodeOnTargetPosOnCrit replaces the bullet position with target position. */
export function explosionOrigin(config: RecordData, source: Point, target: Point, critical: boolean): Point {
  const point = critical && config.onTargetPosition ? target : source;
  return { x: point.x, z: point.z };
}

/** Native ExplodeHurt replaces ordinary CritRate with ExplodeAttackCrit%. */
export function explosionCritChance(spec: ExplosionSpec, ordinaryCritChance: number, explodeAttackCritChance = 0): number {
  if (!spec.canCrit) return 0;
  return Math.min(1, Math.max(0, spec.flags & 4096 ? explodeAttackCritChance : ordinaryCritChance));
}

/** Values are fractions, e.g. 10% is 0.1. Native adds these before multiplying. */
export function explosionRadius(base: number, modifiers: {
  mainWeaponRadiusDelta?: number;
  explosionPercent?: number;
  missileExplosionPercent?: number;
  skillRangePercent?: number;
  areaScalePercent?: number;
}): number {
  return Math.max(0, (base + (modifiers.mainWeaponRadiusDelta || 0)) *
    (1 + (modifiers.explosionPercent || 0) + (modifiers.missileExplosionPercent || 0) +
      (modifiers.skillRangePercent || 0) + (modifiers.areaScalePercent || 0)));
}
