import { isGameSessionCurrent } from './platform/game-session-runtime.js';
import {
  GACHA_AIRCRAFT_ITEMS,
  GACHA_FIXED_ITEMS,
} from './gacha-config.js';
import { sanitizeGachaState, unlockAllCommonWeapons } from './gacha-engine.js';
import { getPilotState, grantPilotCopies } from './pilots.js';
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
    // Older assembly saves treated every configured fixed part as owned.
    // Mirror that inventory without initializing the retired assembly UI.
    for (const item of GACHA_FIXED_ITEMS) {
      if (!state.inventory[item.id]) {
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

