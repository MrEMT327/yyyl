import { GROWTH_SUPPLY_ITEM_IDS } from './growth-supply.js';
import { DEVELOPMENT_BALANCE } from '../development-resources.js';
import catalog from './native-economy-catalog.json' with { type: 'json' };
import research from './native-research-source.json' with { type: 'json' };

// Development materials use the same item IDs as every real upgrade quote.
const costs = [
  ...['guns', 'skins', 'pilots'].flatMap(kind => catalog[kind].flatMap(row => [row.unlockCost, ...row.stages.map(stage => stage.cost)])),
  ...catalog.labs.flatMap(row => row.levels.map(level => level.cost)),
  ...[...research.normal, ...research.ace].map(row => row.Cost),
];
export const DEVELOPMENT_ITEM_IDS = Object.freeze([...new Set([
  1, 2, 105, 106, 107, 108, 109, 112, 113, 135, 925, 926,
  ...GROWTH_SUPPLY_ITEM_IDS,
  ...costs.flatMap(cost => (cost || []).map(([id]) => id)),
])]);
export function prepareDevelopmentInventory(state, enabled) {
  const inventory = state.replicaInventory;
  if (!inventory || !Number.isSafeInteger(inventory.revision) || inventory.revision >= Number.MAX_SAFE_INTEGER) return false;
  if (enabled) {
    const backup = state.developmentInventoryBackup ||= {};
    let changed = false;
    for (const id of DEVELOPMENT_ITEM_IDS) {
      if (!Object.hasOwn(backup, id)) { backup[id] = inventory.items[id] ?? null; changed = true; }
      if ((inventory.items[id] || 0) < DEVELOPMENT_BALANCE) { inventory.items[id] = DEVELOPMENT_BALANCE; changed = true; }
    }
    if (!changed) return false;
  } else {
    const backup = state.developmentInventoryBackup;
    if (!backup) return false;
    if (!Object.entries(backup).every(([id, count]) => /^[1-9]\d*$/.test(id) && (count === null || Number.isSafeInteger(count) && count >= 0))) throw Error('测试资源备份无效');
    for (const [id, count] of Object.entries(backup)) {
      if (count === null) delete inventory.items[id];
      else inventory.items[id] = count;
    }
    delete state.developmentInventoryBackup;
  }
  inventory.revision++;
  return true;
}
