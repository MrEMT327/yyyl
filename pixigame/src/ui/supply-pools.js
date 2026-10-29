// Peripheral snapshots expose a pool list; the lobby context indexes it by id.
// Both presentation entry points must use the same canonical prices and pity.
export function supplyPool(snapshot,id) {
  const pools=snapshot.pools;
  return (Array.isArray(pools)?pools.find(pool=>pool.id===id):pools?.[id])||{};
}
