// Versioned loadout files are shared with the lobby. Local URL changes only
// copy branches containing an actual change when the original is immutable.
export function rewriteBattleUrls<T>(value: T, rewrite: (value: string, key: string) => string): T {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    const items: unknown[] = value;
    let result = items;
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const next = typeof item === 'string' ? rewrite(item, '') : rewriteBattleUrls(item, rewrite);
      if (next === item) continue;
      if (result === items && Object.isFrozen(items)) result = items.slice();
      result[index] = next;
    }
    return result as T;
  }
  const record = value as Record<string, unknown>;
  let result = record;
  for (const key of Object.keys(record)) {
    const item = record[key];
    const next = typeof item === 'string' ? rewrite(item, key) : rewriteBattleUrls(item, rewrite);
    if (next === item) continue;
    if (result === record && Object.isFrozen(record)) result = { ...record };
    result[key] = next;
  }
  return result as T;
}
