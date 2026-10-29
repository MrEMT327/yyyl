const SESSION_STORE = 'session';

function sessionError(code) {
  const error = new Error(code === 'busy'
    ? '游戏已在其他页面打开，请关闭后重试'
    : '暂时无法保护游戏存档，请重试');
  error.code = code;
  return error;
}

/**
 * A dedicated IndexedDB connection is the page's ownership token. Upgrading
 * requires every previous connection to close, including in an HTTP context.
 * There is no expiring lease: a suspended page still owns its saved game.
 */
export async function acquireGameSession({
  indexedDB = globalThis.indexedDB, timeoutMs = 4000,
  name = 'shnh-game-session-v1', onLost = () => {},
} = {}) {
  if (!indexedDB || typeof indexedDB.open !== 'function') throw sessionError('unavailable');
  return new Promise((resolve, reject) => {
    let finished = false, cancelled = false, current = false;
    let connection = null, opening = null, upgradeTransaction = null;
    const timer = setTimeout(() => fail('busy'), timeoutMs);

    const close = db => { try { db?.close(); } catch { /* Already unavailable. */ } };
    function fail(code) {
      if (finished) return;
      finished = true; cancelled = true; clearTimeout(timer);
      try { upgradeTransaction?.abort(); } catch { /* It may already be complete. */ }
      close(opening); opening = null;
      reject(sessionError(code));
    }
    function lose() {
      if (!current) return;
      current = false;
      close(connection);
      try { onLost(); } catch { /* A notification cannot restore ownership. */ }
    }
    const lease = {
      isCurrent() {
        if (!current) return false;
        try {
          // close events are asynchronous. This also catches a connection
          // already closed by the browser before its close event is delivered.
          connection.transaction(SESSION_STORE, 'readonly').abort();
          return true;
        } catch { lose(); return false; }
      },
      release() {
        current = false;
        close(connection);
      },
    };

    function open(version, probe) {
      let request, upgraded = false;
      try { request = version === undefined ? indexedDB.open(name) : indexedDB.open(name, version); }
      catch { fail('unavailable'); return; }
      request.onblocked = () => fail('busy');
      request.onerror = () => fail(request.error?.name === 'VersionError' ? 'busy' : 'unavailable');
      request.onupgradeneeded = () => {
        if (cancelled) {
          try { request.transaction.abort(); } catch { /* Already aborted. */ }
          close(request.result);
          return;
        }
        opening = request.result; upgradeTransaction = request.transaction;
        upgraded = true;
        try {
          if (!opening.objectStoreNames.contains(SESSION_STORE)) opening.createObjectStore(SESSION_STORE);
        } catch { fail('unavailable'); }
      };
      request.onsuccess = () => {
        const db = request.result;
        opening = null; upgradeTransaction = null;
        if (cancelled) { close(db); return; }
        if (probe) {
          const nextVersion = db.version + 1;
          close(db);
          if (!Number.isSafeInteger(nextVersion)) { fail('unavailable'); return; }
          open(nextVersion, false);
          return;
        }
        // Two contenders may request the same version. Both can open it, but
        // only the one that actually performed its upgrade owns the session.
        if (!upgraded) { close(db); fail('busy'); return; }
        connection = db; current = true;
        // This database exists solely for exclusion. Do not yield ownership
        // when another page asks to upgrade it, even when this page is hidden.
        db.onversionchange = () => {};
        db.onclose = lose;
        finished = true; clearTimeout(timer);
        resolve(lease);
      };
    }
    open(undefined, true);
  });
}
