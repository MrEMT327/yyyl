/** Detect stale whole-save writers. This is an optimistic check, not a cross-tab lock. */
export function createPeripheralSaveGuard(storage, key) {
  let expected = null, loaded = false, conflicted = false;
  try { expected = storage?.getItem?.(key) ?? null; loaded = true; } catch { /* Never overwrite an unreadable save. */ }
  function isCurrent() {
    if (!loaded || conflicted) return false;
    try {
      if ((storage?.getItem?.(key) ?? null) === expected) return true;
      conflicted = true;
    } catch { /* A temporary read failure may be retried. */ }
    return false;
  }
  return {
    initialRaw: expected, isCurrent,
    write(serialized) {
      if (!isCurrent() || !storage?.setItem) return false;
      storage.setItem(key, serialized);
      expected = serialized;
      return true;
    },
    get conflicted() { return conflicted; },
  };
}
