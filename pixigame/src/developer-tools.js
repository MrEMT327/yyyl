import { validateReplicaInventory } from './replica/native-economy.js';

export const DEVELOPER_CURRENCY_GRANTS = Object.freeze({
  coins: Object.freeze({ id: 1, amount: 100_000, name: '金币' }),
  diamonds: Object.freeze({ id: 2, amount: 1_000, name: '钻石' }),
});

export function planDeveloperCurrency(rawInventory, { currency, expectedRevision } = {}) {
  const inventory = validateReplicaInventory(rawInventory);
  const grant = Object.hasOwn(DEVELOPER_CURRENCY_GRANTS, currency) && DEVELOPER_CURRENCY_GRANTS[currency];
  if (!grant) throw new Error('请选择金币或钻石');
  if (inventory.revision !== expectedRevision) throw new Error('资源已变化，请重新点击');
  const balance = (inventory.items[grant.id] || 0) + grant.amount;
  if (!Number.isSafeInteger(balance) || inventory.revision >= Number.MAX_SAFE_INTEGER) throw new Error('资源数量或存档版本已达上限');
  inventory.items[grant.id] = balance;
  inventory.revision++;
  return { inventory, message: `${grant.name} +${grant.amount.toLocaleString('zh-CN')}` };
}

function gameSaveEntries(storage) {
  if (!storage?.getItem || !storage?.setItem || !storage?.removeItem || !storage?.key) throw new Error('浏览器存储不可用');
  const entries = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith('thunder-')) entries.push([key, storage.getItem(key)]);
  }
  return entries;
}

export function clearLocalGameSave(storage, session) {
  const stores = [{ store: storage, entries: gameSaveEntries(storage) }];
  if (session) stores.push({ store: session, entries: gameSaveEntries(session) });
  try {
    for (const { store, entries } of stores) for (const [key] of entries) {
      store.removeItem(key);
      if (store.getItem(key) !== null) throw new Error('存档删除失败');
    }
  } catch {
    let restored = true;
    for (const { store, entries } of stores) for (const [key, value] of entries) {
      try { store.setItem(key, value); } catch { restored = false; }
    }
    throw new Error(restored ? '清档未完成，原存档已保留，请重试' : '清档未完成且部分记录无法恢复，请勿刷新页面');
  }
  return { ok: true };
}
