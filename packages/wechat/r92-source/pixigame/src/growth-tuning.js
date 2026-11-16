// Permanent growth only: no changes to in-run upgrades, attack patterns or saves.
export const AIRCRAFT_MAX_LEVEL = 50;
export const GROWTH_MILESTONE_INTERVAL = 10;
export const normalizeGrowthLevel = (value, maxLevel) => Math.min(maxLevel, Math.max(1,
  Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 1));

export function permanentLevelGrowth(value, maxLevel, perLevel, perMilestone) {
  const level = normalizeGrowthLevel(value, maxLevel);
  return (1 + perLevel * (level - 1)) * (1 + perMilestone * Math.floor(level / GROWTH_MILESTONE_INTERVAL));
}

export function nextGrowthMilestone(value, maxLevel) {
  const level = normalizeGrowthLevel(value, maxLevel);
  const next = (Math.floor(level / GROWTH_MILESTONE_INTERVAL) + 1) * GROWTH_MILESTONE_INTERVAL;
  return next <= maxLevel ? next : null;
}

export function aircraftGrowth(level) {
  return {
    attack: permanentLevelGrowth(level, AIRCRAFT_MAX_LEVEL, .015, .025),
    hp: permanentLevelGrowth(level, AIRCRAFT_MAX_LEVEL, .012, .02),
  };
}

export function aircraftUpgradeCost(value) {
  const level = normalizeGrowthLevel(value, AIRCRAFT_MAX_LEVEL);
  return level >= AIRCRAFT_MAX_LEVEL ? null : {
    coins: Math.round((140 + level * 45) / 10) * 10,
    aircraftShards: 2 + Math.floor(level / 10),
  };
}
