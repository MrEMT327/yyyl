import {NATIVE_PATROL_RULES} from './native-patrol-rules.js';
import nativePatrolSource from './native-patrol-source.json' with {type:'json'};

// Confirmed APK HangUp_HangUp.GoldPerHour. Idle and quick patrol share it;
// never derive gold from the local material-compensation anchors.
export const NATIVE_PATROL_GOLD_RATES = Object.freeze(nativePatrolSource.hangUp
  .filter(row => row.Id >= 1 && row.Id <= 60)
  .map(row => Object.freeze({chapter: row.Id, gold: row.GoldPerHour})));
const nativePatrolGold = new Map(NATIVE_PATROL_GOLD_RATES.map(row => [row.chapter, row.gold]));
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

// Gold is confirmed chapter data. Full server material curves are not captured.
// Remove the invented late-game material/key subsidies and use the supplied
// eight-hour reward sample as a replaceable local material baseline.
export const PATROL_MATERIAL_REFERENCE = Object.freeze({
  chapter: 6, hours: 8, gear: 84, research: 30,
  source: 'User-provided 8-hour patrol screenshots; no inferred late-game multiplier',
});
export const LOCAL_INCOME_BANDS = Object.freeze(NATIVE_PATROL_GOLD_RATES.map(row => Object.freeze({
  ...row, gear: PATROL_MATERIAL_REFERENCE.gear / PATROL_MATERIAL_REFERENCE.hours,
  research: PATROL_MATERIAL_REFERENCE.research / PATROL_MATERIAL_REFERENCE.hours,
})));
export function localIncomeRates(chapter) {
  const level = Math.max(1, Math.min(60, Math.floor(Number(chapter) || 1)));
  const row = LOCAL_INCOME_BANDS.find(item => item.chapter === level);
  if (!row || !Number.isSafeInteger(row.gold)) throw Error('原表巡逻金币时薪缺失');
  return {gold: row.gold, gear: row.gear, research: row.research};
}
// These were additional local compensation, absent from the supplied receipt.
export const localPatrolVoucherRates = () => ({basic: 0, advanced: 0});

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
