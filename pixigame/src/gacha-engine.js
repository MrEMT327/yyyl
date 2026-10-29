import { GACHA_COMMON_WEAPONS, GACHA_ITEM_MAP, GACHA_POOLS } from './gacha-config.js';
import { sanitizeWeaponProgress, receiveCommonWeapon } from './fixed-parts/common-weapon-progress.js';
import { WEAPON_NEW_PITY, recruitMisses } from './peripheral/recruit-tuning.js';

export const GACHA_STATE_VERSION = 1;

function freshPoolState(pool) {
  return {
    totalPulls: 0,
    ...(pool.id === 'weapon_permanent' ? { newWeaponMisses: 0 } : {}),
    pity: Object.fromEntries(Object.keys(pool.pityCounters).map((key) => [key, 0])),
  };
}

export function createInitialGachaState() {
  return {
    version: GACHA_STATE_VERSION,
    pools: Object.fromEntries(
      Object.values(GACHA_POOLS).map((pool) => [pool.id, freshPoolState(pool)]),
    ),
    inventory: { 'weapon:aux_cannon':{count:1} },
    weaponProgress:sanitizeWeaponProgress(null),
    pendingContent: {},
    equipment: { primaryWeaponId: null },
  };
}

export function sanitizeGachaState(value) {
  const fallback = createInitialGachaState();
  if (!value || typeof value !== 'object') return fallback;
  const inventory = {'weapon:aux_cannon':{count:1}};
  for (const [itemId, record] of Object.entries(value.inventory || {})) {
    if (!GACHA_ITEM_MAP.has(itemId)) continue;
    const count = Math.max(0, Math.floor(Number(record?.count ?? record) || 0));
    if (count > 0) inventory[itemId] = { count };
  }
  const pools = {};
  for (const pool of Object.values(GACHA_POOLS)) {
    const source = value.pools?.[pool.id] || {};
    pools[pool.id] = {
      totalPulls: Math.max(0, Math.floor(Number(source.totalPulls) || 0)),
      ...(pool.id === 'weapon_permanent' ? { newWeaponMisses: source.newWeaponMisses != null && Number.isFinite(Number(source.newWeaponMisses))
        ? recruitMisses(source.newWeaponMisses, WEAPON_NEW_PITY) : null } : {}),
      pity: Object.fromEntries(Object.keys(pool.pityCounters).map((key) => [
        key,
        Math.max(0, Math.floor(Number(source.pity?.[key]) || 0)),
      ])),
    };
  }
  const pendingContent = {};
  for (const [quality, countValue] of Object.entries(value.pendingContent || {})) {
    const count = Math.max(0, Math.floor(Number(countValue) || 0));
    if (count > 0) pendingContent[quality] = count;
  }
  const requestedWeaponId = value.equipment?.primaryWeaponId;
  const requestedWeapon = GACHA_ITEM_MAP.get(requestedWeaponId);
  const primaryWeaponId = requestedWeapon?.common && inventory[requestedWeaponId]?.count > 0
    ? requestedWeaponId
    : null;
  // Old saves may predate weaponProgress. Keep ownership recorded in inventory
  // when the normal-resource build no longer auto-unlocks the entire roster.
  const weaponProgress = sanitizeWeaponProgress(value.weaponProgress);
  for (const item of GACHA_COMMON_WEAPONS) {
    if (inventory[item.id]?.count > 0) weaponProgress.weapons[item.refId].unlocked = true;
  }
  return {
    version: GACHA_STATE_VERSION,
    pools,
    inventory,
    weaponProgress,
    pendingContent,
    equipment: { primaryWeaponId },
  };
}

export function unlockAllCommonWeapons(stateValue) {
  const state = sanitizeGachaState(stateValue);
  let unlocked = 0;
  for (const item of GACHA_COMMON_WEAPONS) {
    const weapon = state.weaponProgress.weapons[item.refId];
    if (!weapon.unlocked) unlocked++;
    weapon.unlocked = true;
    state.inventory[item.id] ||= { count: 1 };
  }
  return { state, unlocked };
}

function normalizedRoll(rng) {
  const value = Number(rng());
  if (!Number.isFinite(value)) return 0;
  return Math.min(0.999999999999, Math.max(0, value));
}

function weightedChoice(weights, rng) {
  const entries = Object.entries(weights).filter(([, weight]) => Number(weight) > 0);
  const total = entries.reduce((sum, [, weight]) => sum + Number(weight), 0);
  if (total <= 0) return null;
  let roll = normalizedRoll(rng) * total;
  for (const [id, weight] of entries) {
    roll -= Number(weight);
    if (roll < 0) return id;
  }
  return entries[entries.length - 1]?.[0] || null;
}

function pityRuleFor(pool, poolState) {
  return [...pool.pityRules]
    .sort((a, b) => b.priority - a.priority)
    .find((rule) => poolState.pity[rule.counter] >= rule.triggerAt - 1) || null;
}

function weightsForRule(pool, rule) {
  if (!rule) return pool.qualityProbabilities;
  if (rule.weights) return rule.weights;
  const eligible = new Set(rule.eligibleQualities || []);
  return Object.fromEntries(
    Object.entries(pool.qualityProbabilities).filter(([quality]) => eligible.has(quality)),
  );
}

function updatePityCounters(pool, poolState, quality) {
  for (const [counter, config] of Object.entries(pool.pityCounters)) {
    if (config.resetQualities.includes(quality)) poolState.pity[counter] = 0;
    else poolState.pity[counter] += 1;
  }
}

function chooseItem(pool, quality, rng) {
  const ids = pool.itemIdsByQuality[quality] || [];
  if (!ids.length) return null;
  return GACHA_ITEM_MAP.get(ids[Math.floor(normalizedRoll(rng) * ids.length)]) || null;
}

export function drawFromPool(stateValue, poolId, count = 1, rng = Math.random) {
  const state = sanitizeGachaState(stateValue);
  const pool = GACHA_POOLS[poolId];
  if (!pool) throw new Error(`Unknown gacha pool: ${poolId}`);
  const drawCount = Math.max(1, Math.floor(Number(count) || 1));
  const poolState = state.pools[poolId];
  const results = [];

  for (let index = 0; index < drawCount; index += 1) {
    const pityRule = pityRuleFor(pool, poolState);
    const quality = weightedChoice(weightsForRule(pool, pityRule), rng);
    const missing = poolId === 'weapon_permanent'
      ? GACHA_COMMON_WEAPONS.filter(w => !state.weaponProgress.weapons[w.refId]?.unlocked) : [];
    const newWeaponDue = missing.length > 0 && (poolState.newWeaponMisses || 0) >= WEAPON_NEW_PITY - 1;
    const item = newWeaponDue ? missing[Math.floor(normalizedRoll(rng) * missing.length)] : chooseItem(pool, quality, rng);
    updatePityCounters(pool, poolState, quality);
    poolState.totalPulls += 1;

    let ownedCount = 0;
    let isFirst = false;
    if (item) {
      const previousCount = state.inventory[item.id]?.count || 0;
      ownedCount = previousCount + 1;
      isFirst = previousCount === 0;
      state.inventory[item.id] = { count: ownedCount };
    } else {
      state.pendingContent[quality] = (state.pendingContent[quality] || 0) + 1;
    }

    let commonReceipt={};
    if(item?.common){const grant=receiveCommonWeapon(state.weaponProgress,item.refId,quality);state.weaponProgress=grant.state;commonReceipt={isFirst:grant.first,fragmentsAdded:grant.fragmentsAdded};}
    if (poolId === 'weapon_permanent') poolState.newWeaponMisses = !missing.length || commonReceipt.isFirst
      ? 0 : (poolState.newWeaponMisses || 0) + 1;
    results.push({
      index,
      poolId,
      quality,
      item,
      itemId: item?.id || null,
      pityTriggered: Boolean(pityRule) || newWeaponDue,
      pityTier: pityRule?.id || (newWeaponDue ? 'newWeapon' : null),
      newWeaponGuaranteed: newWeaponDue,
      isFirst,
      ownedCount,
      duplicateCount: item ? Math.max(0, ownedCount - 1) : 0,
      pendingContent: !item,
      ...commonReceipt,
    });
  }

  return { state, results };
}

export function grantItemToInventory(stateValue, itemId, count = 1, source = 'direct') {
  const state = sanitizeGachaState(stateValue);
  const item = GACHA_ITEM_MAP.get(itemId);
  if (!item) return { state, results: [] };
  const grantCount = Math.max(1, Math.floor(Number(count) || 1));
  const results = [];

  for (let index = 0; index < grantCount; index += 1) {
    const previousCount = state.inventory[item.id]?.count || 0;
    const ownedCount = previousCount + 1;
    state.inventory[item.id] = { count: ownedCount };
    let commonReceipt={};
    if(item.common){const grant=receiveCommonWeapon(state.weaponProgress,item.refId,item.quality);state.weaponProgress=grant.state;commonReceipt={isFirst:grant.first,fragmentsAdded:grant.fragmentsAdded};}
    results.push({
      index,
      poolId: null,
      source,
      quality: item.quality,
      item,
      itemId: item.id,
      pityTriggered: false,
      pityTier: null,
      isFirst: previousCount === 0,
      ownedCount,
      duplicateCount: Math.max(0, ownedCount - 1),
      pendingContent: false,
      ...commonReceipt,
    });
  }

  return { state, results };
}

export function probabilityTotal(poolId) {
  const pool = GACHA_POOLS[poolId];
  if (!pool) return 0;
  return Object.values(pool.qualityProbabilities).reduce((sum, value) => sum + Number(value), 0);
}
