import {validateReplicaInventory} from './native-economy.js';

// First diamond revive shown by the supplied reference. Only one paid revive
// is offered per run; do not invent a price ladder for additional purchases.
export const BATTLE_REVIVE_DIAMONDS = 50;
export function planBattleRevivePurchase(rawInventory, receipts = [], runId) {
  if (typeof runId !== 'string' || !runId) throw Error('无效战斗');
  const inventory = validateReplicaInventory(rawInventory);
  if (receipts.some(row => row.runId === runId)) return {inventory, receipts, duplicate:true};
  if ((inventory.items[2] || 0) < BATTLE_REVIVE_DIAMONDS) throw Error('钻石不足');
  inventory.items[2] -= BATTLE_REVIVE_DIAMONDS;
  inventory.revision++;
  if (!Number.isSafeInteger(inventory.revision)) throw Error('库存版本超限');
  return {inventory, receipts:[...receipts, {runId, cost:BATTLE_REVIVE_DIAMONDS}].slice(-50), duplicate:false};
}
