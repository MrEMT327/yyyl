/** ExplosionUponDeathModProcessor.OnEvent, ARM64 RVA 0x6d24f4c.
 * Pure calculation only: the host retains the SAME bullet's damage/traits,
 * per-target hit cooldowns, and normal damage dispatch.
 */
export interface DeathExplosionContext {
  eventId: number;
  hasOwner: boolean;
  disabled: boolean;
  inMapSky: boolean;
  /** BulletData.ScalePercent, NOT the animated/rendered projectile scale. */
  bulletScalePercent: number;
  /** Normalized fractional percentages, as consumed by native AttributeData. */
  ownerAttributes?: Record<string, number>;
}

export function nativeDeathExplosionPlan(
  parameters: Record<string, any>,
  context: DeathExplosionContext,
) {
  if (context.eventId !== 22 || !context.hasOwner || context.disabled || !context.inMapSky) return null;
  const a = context.ownerAttributes || {};
  const radius = Number(parameters.Radius || 0)
    * (parameters.UseScale ? context.bulletScalePercent : 1)
    * (1 + (a['ExplodeRadius%'] || 0) + (a['AllMissileExplodeRadius%'] || 0));
  const hurtScale = Number(parameters.HurtScale || 0);
  return {
    radius,
    // A zero/default HurtScale means keep ExAttackPercent, not zero damage.
    damageMultiplier: (hurtScale > 0 ? hurtScale : 1) * (1 + (a['ExplodeHit%'] || 0)),
    effectId: Number(parameters.EffectId || 0),
    effectLifetime: 1,
    buffId: Number(parameters.BuffId || 0),
    clearBullets: Boolean(parameters.ClearBullets),
  };
}

/** EntityBullet.IsEntityCanHit, RVA 0x6a90010; do not erase the direct hit's
 * timestamp for the death explosion. Caller records a hit after this admits it.
 */
export function nativeDeathExplosionCanHit(
  targetDead: boolean, bulletTime: number, lastHitTime: number | undefined, minHurtTime: number,
): boolean {
  return !targetDead && (lastHitTime === undefined || bulletTime - lastHitTime >= minHurtTime);
}
