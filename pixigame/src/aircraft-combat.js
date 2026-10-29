export function isOrdinaryDirectWeapon(weapon = {}) {
  return (weapon.mechanism || 'direct') === 'direct'
    && !['beam', 'homing', 'explosive'].includes(weapon.mode);
}

export function resolveMinimumDirectShotProfile(ability, weapon = {}) {
  const original = {
    shotCount: Math.max(1, Math.floor(Number(weapon.shotCount || weapon.projectileCount) || 1)),
    damageRatio: Number(weapon.damageRatio) || 1,
    spread: Number(weapon.spread) || 0,
    supplemented: false,
  };
  if (ability?.type !== 'minimum-direct-shots' || !isOrdinaryDirectWeapon(weapon)) {
    return original;
  }
  const minimumShots = Math.max(1, Math.floor(Number(ability.minimumShots) || 1));
  if (original.shotCount >= minimumShots) return original;
  return {
    shotCount: minimumShots,
    damageRatio: Number(ability.damageRatio) || original.damageRatio,
    spread: Number(ability.spread) || original.spread,
    supplemented: true,
  };
}

export function clampCriticalChance(value, cap = 0.75) {
  return Math.max(0, Math.min(Number(cap) || 0.75, Number(value) || 0));
}

export function sanctuaryEchoProjectileCount(clearedBullets, effect = {}) {
  const cleared = Math.max(0, Math.floor(Number(clearedBullets) || 0));
  const fallback = Math.max(0, Math.floor(Number(effect.fallbackProjectiles) || 3));
  const maximum = Math.max(1, Math.floor(Number(effect.maxProjectiles) || 8));
  return Math.min(maximum, cleared > 0 ? cleared : fallback);
}

export function storeImmunityCharges(currentCharges, ability = {}) {
  const current = Math.max(0, Math.floor(Number(currentCharges) || 0));
  const granted = Math.max(0, Math.floor(Number(ability.immunityCharges) || 1));
  const maximum = Math.max(1, Math.floor(Number(ability.maxStoredCharges) || 1));
  return Math.min(maximum, current + granted);
}

export function exclusiveEffectActive(weapon, aircraftId) {
  return Boolean(
    weapon?.exclusiveEffect
    && weapon.exclusiveAircraftId
    && weapon.exclusiveAircraftId === aircraftId,
  );
}

export function createPhaseAfterimageState(effect = {}) {
  return {
    remaining: Math.max(0, Number(effect.duration) || 1.2),
    cloneCount: Math.max(0, Math.floor(Number(effect.cloneCount) || 2)),
    damageRatio: Math.max(0, Number(effect.damageRatio) || 0.35),
    recursive: false,
    copies: 'base-weapon-only',
  };
}
