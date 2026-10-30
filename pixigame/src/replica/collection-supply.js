// Retired local giveaways. Keep the legacy API inert for stale callers.
export function collectionSupplySnapshot() { return {}; }
export function claimCollectionSupply() {
  throw Error('机炮／飞机自选补给已停用');
}
