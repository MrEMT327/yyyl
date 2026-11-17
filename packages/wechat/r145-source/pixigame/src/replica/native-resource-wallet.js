import { GEAR_PARTS } from '../peripheral/equipment-system.js';
import { validateReplicaInventory } from './native-economy.js';

export const REPLICA_WALLET_SOURCE = 'replica-items-v1';
// IDs come from the same equipment reference used by native equipment payment.
export const REPLICA_RESOURCE_IDS = Object.freeze({
  coins: 1, diamonds: 2, basicKeys: 113, advancedKeys: 112,
  ...Object.fromEntries(GEAR_PARTS.map(part => [`blueprint${part.type}`, part.blueprintId])),
  ...Object.fromEntries(Array.from({length:11},(_,index)=>[`researchBlueprint${801+index}`,801+index])),
});
export function replicaResourceWallet(rawInventory) {
  const inventory = validateReplicaInventory(rawInventory);
  return { ...Object.fromEntries(Object.entries(REPLICA_RESOURCE_IDS)
    .map(([key, id]) => [key, inventory.items[id] || 0])), unlimited: false };
}

/** Replay absolute balances from a persisted receipt. Never import legacy money. */
export function applyReplicaResourceReceipt(rawInventory, { before, after, walletSource }) {
  if (walletSource !== REPLICA_WALLET_SOURCE) throw new Error('资源凭据来源不一致');
  const inventory = validateReplicaInventory(rawInventory);
  let changed = false;
  for (const [key, amount] of Object.entries(after)) {
    const id = REPLICA_RESOURCE_IDS[key];
    if (!id) continue;
    if (!Number.isSafeInteger(before[key]) || before[key] < 0
      || !Number.isSafeInteger(amount) || amount < 0) throw new Error('资源凭据数量无效');
    const current = inventory.items[id] || 0;
    if (current !== before[key] && current !== amount) throw new Error('资源凭据余额待核对');
    if (current !== amount) { inventory.items[id] = amount; changed = true; }
  }
  if (changed) inventory.revision++;
  return validateReplicaInventory(inventory);
}
