import { ECONOMY_VERSION, chapterPatrolRate } from './economy-config.js';

export const PATROL_CAP_HOURS = 8;
export const QUICK_PATROL_HOURS = 2;
export const QUICK_PATROL_STAMINA = 5;
export const QUICK_PATROL_DAILY_LIMIT = 3;
export const QUICK_PATROL_AD_DAILY_LIMIT = 3;
const HOUR = 60 * 60 * 1000;
const CAP_MS = PATROL_CAP_HOURS * HOUR;
const fields = ['coins', 'weaponParts', 'aircraftShards'];
const clean = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

export function patrolRate(tier) {
  return chapterPatrolRate(tier);
}

function legacyPatrolRate(tier) {
  const stage = Math.max(0, Math.floor(Number(tier) || 0));
  return { coins: 75 + stage * 12, weaponParts: 1 + Math.floor(stage / 8) * .25, aircraftShards: 1 / 3 };
}

export function createPatrolState(time) {
  return { economyVersion: ECONOMY_VERSION, tier: -1, lastAt: time, storedMs: 0, pending: { coins: 0, weaponParts: 0, aircraftShards: 0 }, quickRemainder: {}, quickDate: '', quickUsed: 0, quickAdDate: '', quickAdUsed: 0 };
}

export function projectPatrol(value, time, highestCleared, bonus = 0) {
  const now = Number.isFinite(Number(time)) ? Number(time) : Date.now();
  const state = value && typeof value === 'object' ? structuredClone(value) : createPatrolState(now);
  state.tier = Number.isInteger(state.tier) ? state.tier : -1;
  state.lastAt = Number.isFinite(Number(state.lastAt)) ? Number(state.lastAt) : now;
  state.storedMs = Math.min(CAP_MS, clean(state.storedMs));
  state.pending = Object.fromEntries(fields.map(key => [key, clean(state.pending?.[key])]));
  state.quickRemainder = Object.fromEntries(fields.map(key => [key, clean(state.quickRemainder?.[key]) % 1]));
  state.quickUsed = Math.max(0, Math.floor(clean(state.quickUsed)));
  state.quickDate ||= '';
  state.quickAdUsed = Math.max(0, Math.floor(clean(state.quickAdUsed)));
  state.quickAdDate ||= '';
  const unlockedTier = Number.isInteger(highestCleared) ? highestCleared : -1;
  if (state.tier < 0) {
    state.economyVersion = ECONOMY_VERSION;
    state.lastAt = now;
    if (unlockedTier >= 0) state.tier = unlockedTier;
    return state;
  }
  const elapsed = Math.max(0, now - state.lastAt);
  const credited = Math.min(elapsed, CAP_MS - state.storedMs);
  // Credit the pre-update interval at its old rate once, then switch future
  // accrual. Never reduce stored rewards or fractional quick-patrol leftovers.
  const rate = Number(state.economyVersion || 1) < ECONOMY_VERSION ? legacyPatrolRate(state.tier) : patrolRate(state.tier);
  for (const key of fields) state.pending[key] += credited / HOUR * rate[key] * (1 + Math.max(0, clean(bonus)));
  state.storedMs += credited;
  state.lastAt = now;
  state.economyVersion = ECONOMY_VERSION;
  if (unlockedTier > state.tier) state.tier = unlockedTier;
  return state;
}

export function patrolReward(value) {
  return Object.fromEntries(fields.map(key => [key, Math.floor(clean(value.pending?.[key]) + 1e-8)]));
}

export function claimPatrol(value, time) {
  const reward = patrolReward(value);
  if (!Object.values(reward).some(Boolean)) return null;
  const next = structuredClone(value);
  for (const key of fields) next.pending[key] = Math.max(0, next.pending[key] - reward[key]);
  next.storedMs = 0;
  next.lastAt = time;
  return { reward, state: next };
}

function quickPatrolAmounts(tier, bonus, remainder) {
  const rate = patrolRate(tier);
  return Object.fromEntries(fields.map(key => [key,
    rate[key] * QUICK_PATROL_HOURS * (1 + clean(bonus)) + clean(remainder?.[key]) % 1]));
}

export function quickPatrolReward(tier, bonus = 0, remainder = {}) {
  const amounts = quickPatrolAmounts(tier, bonus, remainder);
  return Object.fromEntries(fields.map(key => [key, Math.floor(amounts[key] + 1e-8)]));
}

// Keep fractional rewards across claims, days and reloads, independently of idle patrol.
export function claimQuickPatrol(value, bonus = 0) {
  const amounts = quickPatrolAmounts(value.tier, bonus, value.quickRemainder);
  const reward = quickPatrolReward(value.tier, bonus, value.quickRemainder);
  const state = structuredClone(value);
  state.quickRemainder = Object.fromEntries(fields.map(key => [key, Math.max(0, amounts[key] - reward[key])]));
  return { reward, state };
}
