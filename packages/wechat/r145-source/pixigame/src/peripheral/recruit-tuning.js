// Shared by draw logic and presentation. Counters count draws, not characters.
export const RECRUIT_SINGLE_COST = 20;
export const RECRUIT_TEN_COST = 180;
export const PILOT_SSR_PITY = 30;
export const PILOT_UR_PITY = 70;
export const WEAPON_NEW_PITY = 10;

export function recruitMisses(value, limit) {
  return Math.min(limit - 1, Math.max(0, Math.floor(Number(value) || 0)));
}

// The receipt log is bounded. Credit only its verifiable trailing draws, never
// infer a dry streak from lifetime pulls or from collection ownership.
export function trailingRecruitMisses(history, pool, qualifies, limit) {
  let misses = 0;
  for (const entry of [...(history || [])].reverse()) {
    if (entry.pool !== pool) continue;
    for (const reward of [...entry.results].reverse()) {
      if (qualifies(reward)) return misses;
      misses++;
      if (misses >= limit - 1) return limit - 1;
    }
  }
  return misses;
}
