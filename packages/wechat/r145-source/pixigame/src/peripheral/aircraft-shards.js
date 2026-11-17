import { AIRCRAFT_MAX_LEVEL, aircraftUpgradeCost, normalizeGrowthLevel } from '../growth-tuning.js';

export const AIRCRAFT_SHARD_EXCHANGE_COINS = 50;
const MAX_EXCHANGE_BATCH = 100;

// Reserve future upgrades for the entire supplied roster, including locked
// aircraft. Missing or malformed records keep the full level-1 requirement.
export function aircraftShardReserve(aircraftRecords, aircraftIds) {
  let reserve = 0;
  for (const id of new Set(aircraftIds || [])) {
    const currentLevel = normalizeGrowthLevel(aircraftRecords?.[id]?.level, AIRCRAFT_MAX_LEVEL);
    for (let level = currentLevel; level < AIRCRAFT_MAX_LEVEL; level++) {
      reserve += aircraftUpgradeCost(level).aircraftShards;
    }
  }
  return reserve;
}

// A preview only: the caller explicitly applies the exchange to its wallet.
// Round stock down and the reserve up so fractional or invalid inputs cannot
// sell material needed for a later upgrade.
export function aircraftShardExchange(walletCount, reserve, maxBatch = MAX_EXCHANGE_BATCH) {
  const stock = Number(walletCount), retained = Number(reserve), batch = Number(maxBatch);
  if (!Number.isFinite(stock) || !Number.isFinite(retained) || !Number.isFinite(batch)
    || stock < 0 || retained < 0 || batch < 1) return { amount: 0, coins: 0 };
  const available = Math.max(0, Math.floor(stock) - Math.ceil(retained));
  const amount = Math.min(available, Math.floor(batch), MAX_EXCHANGE_BATCH);
  return { amount, coins: amount * AIRCRAFT_SHARD_EXCHANGE_COINS };
}
