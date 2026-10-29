import { chapterVictoryReward } from './economy-config.js';
import { MAINLINE_STAGE_TUNING } from './mainline-progression.js';
export { MAINLINE_TUNING_VERSION, MAINLINE_STAGE_TUNING } from './mainline-progression.js';
export { POWER_DISPLAY_SCALE } from './power-rating.js';

// Repeat clears provide stable growth; first-clear and star rewards are bonuses.
export const FIRST_CLEAR_WEAPON_PRIORITY = Object.freeze([
  'aux_laser', 'aux_rocket', 'aux_lightning', 'aux_scatter', 'aux_drone',
]);

export function tuneMainlineCampaign(stages) {
  // Only the complete 15-wave mainline uses this curve. Archived modes and
  // future chapters outside this authored range must not silently inherit it.
  return stages.map((stage, index) => ({ ...stage,
    ...(stage.waveCount === 15 ? MAINLINE_STAGE_TUNING[index] || {} : {}) }));
}

export const FIRST_STAR_COINS = Object.freeze([
  220, 600, 800, 1000, 1250, 1450, 1650, 1900, 2150,
  2400, 2650, 2950, 3250, 3600, 4000, 4450, 4950,
]);

export function firstStarCoins(stageIndex) {
  const index = Math.max(0, Math.floor(Number(stageIndex) || 0));
  return FIRST_STAR_COINS[index] ?? FIRST_STAR_COINS.at(-1) + (index - FIRST_STAR_COINS.length + 1) * 550;
}

export function sortieCoins(stageIndex) {
  return chapterVictoryReward(stageIndex).coins;
}

export function sortieMaterialReward(stageIndex, won) {
  if (!won) return { aircraftShards: 1, weaponParts: 2 };
  const { aircraftShards, weaponParts } = chapterVictoryReward(stageIndex);
  return { aircraftShards, weaponParts };
}
