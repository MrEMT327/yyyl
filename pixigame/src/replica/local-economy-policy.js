import {NATIVE_PATROL_RULES} from './native-patrol-rules.js';
import { replaceUnavailableMaterials } from './native-material-replacements.js';

export const LOCAL_ECONOMY_POLICY = Object.freeze({
  version: 1,
  label: '离线兼容规则 v1（非原版服务端算法）',
  dayOffsetHours: 8,
  boxFreeHours: {3: 120, 4: 24},
  boxQualityPity: {3: 10, 4: 10},
  advancedSPity: 50,
  patrolIntervalSeconds: NATIVE_PATROL_RULES.intervalSeconds,
  patrolCapSeconds: NATIVE_PATROL_RULES.capSeconds,
  quickSeconds: 7200,
  quickDailyCount: NATIVE_PATROL_RULES.quickDailyCount,
  quickAdDailyCount: NATIVE_PATROL_RULES.quickAdDailyCount,
  quickStamina: NATIVE_PATROL_RULES.quickStamina,
});

// Local pacing recalibration: gear needs 1,469,150 sheets across five parts;
// labs need 227,040 across eleven. Preserve early income and native costs.
// Only coefficients change; rotation, patrol durations and quotas are intact.
export const LOCAL_INCOME_BANDS = Object.freeze([
  {chapter: 1, gold: 5000, gear: 30, research: 11},
  {chapter: 10, gold: 40000, gear: 150, research: 55},
  {chapter: 20, gold: 100000, gear: 750, research: 220},
  {chapter: 30, gold: 200000, gear: 2400, research: 660},
  {chapter: 60, gold: 500000, gear: 5000, research: 880},
]);

export function localIncomeRates(chapter) {
  const level = Math.max(1, Math.min(60, Number(chapter) || 1));
  const upper = LOCAL_INCOME_BANDS.find(row => row.chapter >= level) || LOCAL_INCOME_BANDS.at(-1);
  const lower = LOCAL_INCOME_BANDS.filter(row => row.chapter <= level).at(-1);
  const fraction = upper.chapter === lower.chapter ? 0 : (level - lower.chapter) / (upper.chapter - lower.chapter);
  return Object.fromEntries(['gold', 'gear', 'research'].map(key => [key, Math.floor(lower[key] + (upper[key] - lower[key]) * fraction)]));
}

export const localPatrolVoucherRates = chapter => ({basic:8*(1+Math.min(2,Math.floor(chapter/20))),advanced:Math.min(5,Math.floor(chapter/10))});

export function localRewardPairs(pairs, rng = Math.random) {
  const expanded = pairs.flatMap(([id, count]) => id === 10010007 || id === 10010008
    ? localRandomMaterials(id, count, rng) : [[id, count]]);
  return replaceUnavailableMaterials(expanded);
}

export function economyTime(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw Error('经济时钟无效');
  return value;
}

export const economyDay = value => String(Math.floor((economyTime(value) + 28800000) / 86400000));

export function localRandomMaterials(groupId, count, rng = Math.random) {
  const candidates = groupId === 10010007 ? [105, 106, 107, 108, 109]
    : groupId === 10010008 ? [801, 802, 803, 804, 805, 806, 807, 808, 809, 810, 811] : null;
  if (!candidates || !Number.isSafeInteger(count) || count < 1 || count > 100000)
    throw Error('兼容随机材料参数无效');
  const totals = new Map();
  for (let index = 0; index < count; index++) {
    const value = rng();
    if (!Number.isFinite(value) || value < 0 || value >= 1) throw Error('兼容随机材料抽取失败');
    const id = candidates[Math.floor(value * candidates.length)];
    totals.set(id, (totals.get(id) || 0) + 1);
  }
  return [...totals];
}
