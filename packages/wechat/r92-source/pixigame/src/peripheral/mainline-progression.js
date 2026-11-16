import { aircraftGrowth } from '../growth-tuning.js';
import { rateLoadoutPower } from './power-rating.js';

export const MAINLINE_TUNING_VERSION = '2026.10.12-economy-6';
export const MAINLINE_BOSS_ENDURANCE_SCALE = .55;

// Permanent equipment budget benchmarks, NOT required items or a win-rate claim.
// No research RNG, rare pilot copies or in-run evolutions are prerequisites.
export const MAINLINE_REFERENCE_BUILDS = Object.freeze([
  [1, 1, 0, 1, 0], [2, 3, 1, 3, 0], [5, 10, 2, 10, 0],
  [10, 18, 3, 20, 1], [20, 28, 4, 40, 2], [30, 38, 4, 60, 3],
  [40, 46, 4, 80, 4], [50, 50, 4, 100, 4],
].map(([chapter, aircraftLevel, auxiliaryCount, weaponLevel, qualityRank]) => {
  const growth = aircraftGrowth(aircraftLevel);
  const weapons = [{ itemId: 'aux_cannon', level: 1, qualityRank: 0 },
    ...['aux_laser', 'aux_rocket', 'aux_lightning', 'aux_drone'].slice(0, auxiliaryCount)
      .map(itemId => ({ itemId, level: weaponLevel, qualityRank }))];
  const loadout = { weapons, statModifiers: { maxHp: Math.round(100 * growth.hp),
    attackMultiplier: growth.attack, pilotModifiers: {}, researchModifiers: {} } };
  const power = rateLoadoutPower(loadout).total;
  return Object.freeze({ chapter, aircraftLevel, auxiliaryCount, weaponLevel, qualityRank, power });
}));

// Chapter-local scales, before the existing easy-mode multipliers. Interpolate
// all 50 chapters here instead of inheriting unrelated old zodiac rows.
const ANCHORS = [
  // ch  HP    bossHP damage bossDmg bullet eliteHP waveSize bossBullet
  [1,    .8,    .85,  1.05,  1.0,   1.02,  3.74,  1.04,   20],
  [2,   1.05,  1.1,  1.10,  1.08,  1.03,  3.8,   1.05,   20],
  [5,   1.85,  2.2,  1.25,  1.25,  1.08,  4.0,   1.08,   21],
  [10,  2.8,   3.5,  1.50,  1.55,  1.14,  4.2,   1.12,   22],
  [20,  4.2,   5.2,  1.85,  1.90,  1.22,  4.4,   1.17,   23],
  [30,  5.5,   6.8,  2.10,  2.20,  1.28,  4.6,   1.21,   24],
  [40,  6.8,   8.3,  2.35,  2.45,  1.32,  4.8,   1.23,   25],
  [50,  8.0,   9.5,  2.55,  2.70,  1.35,  5.0,   1.25,   26],
].map(([chapter, enemyHp, bossHp, enemyDamage, bossDamage, bulletSpeed, eliteHp, waveSize, bossBulletDamage]) =>
  ({ chapter, enemyHp, bossHp, enemyDamage, bossDamage, bulletSpeed, eliteHp, waveSize, bossBulletDamage }));

function bracket(rows, chapter) {
  const upper = rows.findIndex(row => row.chapter >= chapter);
  const right = rows[upper < 0 ? rows.length - 1 : upper];
  const left = rows[Math.max(0, (upper < 0 ? rows.length - 1 : upper) - 1)];
  return { left, right, t: left === right ? 0 : (chapter - left.chapter) / (right.chapter - left.chapter) };
}
const lerp = (a, b, t) => a + (b - a) * t;

export function mainlineStageTuning(index) {
  const chapter = Math.min(50, Math.max(1, Math.floor(Number(index) || 0) + 1));
  const { left, right, t } = bracket(ANCHORS, chapter);
  const ref = bracket(MAINLINE_REFERENCE_BUILDS, chapter);
  const progression = Object.fromEntries(Object.keys(left).filter(key => key !== 'chapter')
    .map(key => [key, Number(lerp(left[key], right[key], t).toFixed(4))]));
  return Object.freeze({ ...progression,
    recommendedPower: Math.round(lerp(ref.left.power, ref.right.power, ref.t) / 50) * 50,
    mainlineBalanceVersion: MAINLINE_TUNING_VERSION,
    // Route motion, telegraph duration and barrage recovery remain authored.
    // This explicit boss recovery replaces inherited zodiac cooldown/index ramps.
    readableBossRecovery: Number(lerp(1.15, 1, (chapter - 1) / 49).toFixed(4)),
    enemySpeed: 1, bossSpeed: 1, enemyCooldown: 1, bossCooldown: 1,
    spawnInterval: 1, eliteChance: 0,
    referenceChapters: Object.freeze([ref.left.chapter, ref.right.chapter]),
  });
}

export const MAINLINE_STAGE_TUNING = Object.freeze(Array.from({ length: 50 }, (_, index) => mainlineStageTuning(index)));
