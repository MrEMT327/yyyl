import { normalizeGrowthLevel, permanentLevelGrowth } from '../growth-tuning.js';

export const WEAPON_QUALITY_LEVEL_CAPS = Object.freeze([10, 20, 40, 60, 120, 140]);
export const WEAPON_MAX_LEVEL = WEAPON_QUALITY_LEVEL_CAPS.at(-1);
export const weaponLevelCap = qualityRank => WEAPON_QUALITY_LEVEL_CAPS[Math.max(0, Math.min(5, Math.floor(Number(qualityRank) || 0)))];
export const weaponLevelLimitMessage = qualityRank => Number(qualityRank) >= 5
  ? `已达最高等级 Lv.${WEAPON_MAX_LEVEL}`
  : `已达当前品级上限 Lv.${weaponLevelCap(qualityRank)}，请先提升品级`;

export const weaponLevelGrowth = level => permanentLevelGrowth(level, WEAPON_MAX_LEVEL, .01, .025);

export function commonWeaponUpgradeCost(value, qualityRank = 0) {
  const level = normalizeGrowthLevel(value, WEAPON_MAX_LEVEL);
  return level >= weaponLevelCap(qualityRank) ? null : {
    coins: Math.round((90 + (level - 1) * 22) / 10) * 10,
    weaponParts: 2 + Math.floor(level / 20),
  };
}
