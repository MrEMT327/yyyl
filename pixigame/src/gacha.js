import { isGameSessionCurrent } from './platform/game-session-runtime.js';
import { getAssemblySnapshot, grantAssemblyModules } from './assembly.js';
import {
  GACHA_AIRCRAFT_ITEMS,
  GACHA_FIXED_ITEMS,
  GACHA_ITEM_MAP,
} from './gacha-config.js';
import { drawFromPool, grantItemToInventory, sanitizeGachaState, unlockAllCommonWeapons } from './gacha-engine.js';
import { getPilotState, grantPilotCopies } from './pilots.js';
import { upgradeCommonWeapon } from './fixed-parts/common-weapon-progress.js';
import { UNLIMITED_RESOURCES } from './development-resources.js';

const GACHA_STORAGE_KEY = 'thunder-gacha-v1';

function loadState() {
  try {
    const state = sanitizeGachaState(
      JSON.parse(globalThis.localStorage?.getItem(GACHA_STORAGE_KEY) || 'null'),
    );
    const ownedPilots = new Set(getPilotState().owned);
    // Once the independent roster exists, aircraft inventory must no longer
    // grant characters on reload (or inherit characters unlocked by chapters).
    const independentRoster = Boolean(globalThis.localStorage?.getItem('thunder-peripheral-v1'));
    const ownedModules = new Set(getAssemblySnapshot().ownedModules);
    for (const item of GACHA_AIRCRAFT_ITEMS) {
      if (!independentRoster && ownedPilots.has(item.refId) && !state.inventory[item.id]) {
        state.inventory[item.id] = { count: 1 };
      }
      // Gacha inventory and the pilot roster used to be persisted separately.
      // Repair older split saves from the canonical gacha item id so a drawn
      // aircraft can never disappear or turn into a different roster entry.
      if (!independentRoster && (state.inventory[item.id]?.count || 0) > 0 && !ownedPilots.has(item.refId)) {
        grantPilotCopies(item.refId, 1);
        ownedPilots.add(item.refId);
      }
    }
    for (const item of GACHA_FIXED_ITEMS) {
      if (ownedModules.has(item.id) && !state.inventory[item.id]) {
        state.inventory[item.id] = { count: 1 };
      }
    }
    return state;
  } catch {
    return sanitizeGachaState(null);
  }
}

// Preview keeps the full roster. Normal-resource saves retain their ownership;
// only genuinely fresh saves start with the cannon. Never relock old weapons.
const loadedGachaState = loadState();
let gachaState = UNLIMITED_RESOURCES ? unlockAllCommonWeapons(loadedGachaState).state : loadedGachaState;
saveState();

function saveState() {
  if (!isGameSessionCurrent()) return;
  try {
    globalThis.localStorage?.setItem(GACHA_STORAGE_KEY, JSON.stringify(gachaState));
  } catch {
    // Embedded WebViews and private browsing may deny storage.
  }
}

function applyReceipt(receipt) {
  const item = GACHA_ITEM_MAP.get(receipt.itemId) || receipt.item;
  if (!item) return;
  receipt.item = item;
  if (item.type === 'aircraft') {
    const [grant] = grantPilotCopies(item.refId, 1);
    receipt.grantedPilotId = grant?.pilot?.id || item.refId;
    receipt.resonance = grant?.resonance || 0;
    receipt.resonanceAdded = grant?.isNew ? 0 : 1;
    return;
  }
  if (item.type === 'fixed' && receipt.isFirst) {
    grantAssemblyModules([item.id]);
  }
}

export function getGachaState() {
  return sanitizeGachaState(gachaState);
}

// The peripheral layer shares this inventory and its universal parts balance.
// Work on a copy so rejected purchases cannot partially consume resources.
export function transactPeripheralInventory(update, { requirePersisted = false } = {}) {
  const next = sanitizeGachaState(gachaState);
  const result = update(next);
  if (!result?.ok) return result || { ok: false, message: '操作未完成' };
  if (requirePersisted) {
    try {
      if (!isGameSessionCurrent() || !globalThis.localStorage?.setItem) throw new Error('storage unavailable');
      globalThis.localStorage.setItem(GACHA_STORAGE_KEY, JSON.stringify(sanitizeGachaState(next)));
    } catch { return { ok:false, message:'库存存档暂不可保存' }; }
    gachaState = sanitizeGachaState(next);
    return result;
  }
  gachaState = sanitizeGachaState(next);
  saveState();
  return result;
}

export function getGachaPoolState(poolId) {
  const state = getGachaState();
  return state.pools[poolId] || null;
}

export function drawGacha(poolId, count = 1, { rng = Math.random } = {}) {
  const draw = drawFromPool(gachaState, poolId, count, rng);
  gachaState = draw.state;
  draw.results.forEach(applyReceipt);
  saveState();
  return draw.results;
}

export function grantGachaItem(itemId, count = 1, source = 'direct') {
  const grant = grantItemToInventory(gachaState, itemId, count, source);
  if (!grant.results.length) return [];
  gachaState = grant.state;
  grant.results.forEach(applyReceipt);
  saveState();
  return grant.results;
}

export function getEquippedGachaWeapon() {
  const item=GACHA_ITEM_MAP.get(gachaState.equipment.primaryWeaponId);return item?.common?item:null;
}

export function isGachaWeaponCompatible(item, aircraftId = getPilotState().selected) {
  return Boolean(item)
    && (!item.exclusiveAircraftId || item.exclusiveAircraftId === aircraftId);
}

export function isEquippedGachaWeaponExclusiveEffectActive() {
  const item = getEquippedGachaWeapon();
  return Boolean(item?.exclusiveEffect) && isGachaWeaponCompatible(item);
}

export function equipGachaWeapon(itemId) {
  const item = GACHA_ITEM_MAP.get(itemId);
  if (!item?.common || !item.isImplemented) return false;
  if ((gachaState.inventory[itemId]?.count || 0) <= 0) return false;
  if (!isGachaWeaponCompatible(item)) return false;
  gachaState.equipment.primaryWeaponId = itemId;
  saveState();
  return true;
}

export function grantAllCommonWeaponsForDebug() {
  const result = unlockAllCommonWeapons(gachaState);
  gachaState = result.state;
  saveState();
  return result.unlocked;
}

export function upgradeOwnedCommonWeapon(id,kind,coins){
  const result=upgradeCommonWeapon(gachaState.weaponProgress,id,kind,coins);
  if(result.ok){gachaState.weaponProgress=result.state;saveState();}
  return result;
}

export function resetGachaStateForTests(nextState = null) {
  gachaState = sanitizeGachaState(nextState);
  saveState();
  return getGachaState();
}
