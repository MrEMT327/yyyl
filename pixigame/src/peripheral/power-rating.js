import { commonWeaponStats } from '../fixed-parts/common-weapons.js';
export const POWER_DISPLAY_SCALE = 25 / 13; // Innate cannon + 100 HP = 1,000.

export const POWER_RATING_VERSION = 2;

// Lobby estimates, NOT simulation constants or measured DPS. Coverage factors
// describe representative positioning; never assume every pellet/zone hits.
// Only base mechanics count here. Collection quality does not unlock evolutions.
const PROFILES = {
  cannon: q => [q.damage / q.interval, q.damage / q.interval],
  rail: q => [q.damage / q.interval, q.damage / q.interval * 2.5],
  rocket: q => [q.damage / q.interval * .9, q.damage / q.interval * 2],
  laser: q => [q.damage / q.interval, q.damage / q.interval * 2.5],
  scatter: q => [q.damage / q.interval * q.count * .3, q.damage / q.interval * q.count * .65],
  sidegun: q => [q.damage / q.interval * 2 * .45, q.damage / q.interval * 2 * .8],
  grenade: q => [q.damage / q.interval * .65, q.damage / q.interval * 2],
  mine: q => [q.damage / q.interval * .4, q.damage / q.interval * 1.5],
  beam: q => [q.damage / q.interval * .95, q.damage / q.interval * .85],
  lightning: q => [q.damage / q.interval, q.damage / q.interval * 3],
  freeze: q => [q.damage / q.interval * .95, q.damage / q.interval * .85],
  // A sphere can contact one target every .6s; estimate 1.8s of contact.
  orb: q => [q.damage / q.interval * 3, q.damage / q.interval * 6],
  // Base poison zones do not stack damage on a target. Movement is required.
  toxin: q => [q.damage / .5 * .5, q.damage / .5 * .5 * 2.5],
  blades: q => [q.damage / q.interval * .4, q.damage / q.interval * 1.5],
  gravity: q => [q.damage / q.interval * .55, q.damage / q.interval * 2],
  // Four rays, but their shared per-tick seen set permits ONE hit per target.
  lightmine: q => [q.damage / .1 * q.life / q.interval * .55, q.damage / .1 * q.life / q.interval * 1.4],
  // One explosion (14x), eight .25s burn ticks, about five .2x contact hits.
  pyro: q => [q.damage / q.interval * 23 * .7, q.damage / q.interval * 23 * 1.8],
  shield: q => [q.damage / q.interval * .75, q.damage / q.interval * 2.5],
  tail: q => [q.damage / q.interval * q.count * .35, q.damage / q.interval * q.count * .65],
  // Steady population life/spawn interval, discounted for startup and deaths.
  drone: q => {
    const dps = q.damage / q.droneInterval * Math.min(12, q.life / q.interval) * .7;
    return [dps, dps]; // Drones select targets, not simultaneous area damage.
  },
};

export function estimateWeaponFirepower(weapon) {
  const stats = commonWeaponStats(weapon);
  const profile = PROFILES[stats.mechanic];
  const [singleTarget, crowd] = profile ? profile(stats) : [stats.damage / stats.interval, stats.damage / stats.interval];
  return { itemId: weapon.itemId, name: stats.name, mechanic: stats.mechanic, singleTarget, crowd, estimated: true };
}

/** Presentation only: no combat, save mutation, randomness or elapsed-time state. */
export function rateLoadoutPower(loadout) {
  const stats = loadout.statModifiers;
  const p = stats.pilotModifiers || {}, r = stats.researchModifiers || {};
  const weapons = loadout.weapons.map(estimateWeaponFirepower);
  // Mirrors finalPeripheralDamage, including pilot crit (not divided away).
  const crit = 1 + Math.min(p.critChanceCap??1, (p.critChance || 0) + (r.critChance || 0))
    * (.75 + (p.critMultiplierBonus || 0) + (r.critDamageBonus || 0));
  const attack = (stats.attackMultiplier || 1) * crit;
  const singleTarget = weapons.reduce((sum, w) => sum + w.singleTarget, 0)
    * attack * (p.bossDamageMultiplier || 1) * (1 + (r.bossDamageBonus || 0));
  // The crowd benchmark is 80% ordinary enemies, 20% elites.
  const crowd = weapons.reduce((sum, w) => sum + w.crowd, 0)
    * attack * (1 + .2 * (r.eliteDamageBonus || 0));
  // A 15-second pressure window, 60% useful healing/barrier absorption.
  // Refreshing barriers are NOT an unlimited pool of permanent HP.
  const recovery = (p.healInterval ? Math.floor(15 / p.healInterval) * (p.healMaxHpRatio || 0) : 0)
    + (p.shieldInterval ? Math.floor(15 / p.shieldInterval) * (p.shieldMaxHpRatio || 0)
      * Math.min(1, (p.shieldDuration || 0) / p.shieldInterval) : 0);
  const incoming = (p.damageTakenMultiplier || 1) * (1 - (stats.gearModifiers?.damageReduction || 0))
    * (.8 * (1 - Math.min(.65, r.projectileReduction || 0))
      + .2 * (1 - Math.min(.65, r.collisionReduction || 0)));
  const effectiveHp = stats.maxHp * (1 + Math.min(.3, recovery * .6)) / incoming;
  // Preserve the innate cannon / 100 HP baseline at 1,000. Components add up
  // exactly after rounding; these are score contributions, never displayed DPS.
  const focusedPower = Math.round(singleTarget * .65 * 3 * POWER_DISPLAY_SCALE);
  const crowdPower = Math.round(crowd * .35 * 3 * POWER_DISPLAY_SCALE);
  const survivalPower = Math.round(effectiveHp * 4 * POWER_DISPLAY_SCALE);
  return { version: POWER_RATING_VERSION, estimated: true,
    total: focusedPower + crowdPower + survivalPower,
    focusedPower, crowdPower, survivalPower, weapons };
}
