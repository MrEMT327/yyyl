import { acquireGameSession } from './game-session.js';

let managed = false;
let currentSession = null;

// Native/test hosts that do not use the browser boot keep their existing path.
export function isGameSessionCurrent() {
  return !managed || Boolean(currentSession?.isCurrent());
}

export async function startGameSession({
  windowRef = globalThis.window, beforeRelease = () => {}, onLost = () => {},
  acquire = acquireGameSession,
} = {}) {
  managed = true;
  let lease = null, retired = false, releasing = false;
  const session = {
    isCurrent: () => !retired && Boolean(lease?.isCurrent()),
    release() {
      if (retired || releasing) return;
      releasing = true;
      let cleanup;
      // Settle the battle while this page still owns the save. An import in
      // flight retains the connection until its remaining initialization ends.
      try { cleanup = beforeRelease(); } catch { /* The next page recovers the checkpoint. */ }
      retired = true;
      windowRef?.removeEventListener('pagehide', leave);
      const finish = () => lease?.release();
      if (cleanup?.then) Promise.resolve(cleanup).then(finish, finish);
      else finish();
    },
  };
  currentSession = session;
  const leave = () => session.release();
  const restored = event => { if (event.persisted) windowRef.location.reload(); };
  windowRef?.addEventListener('pagehide', leave);
  // A cached, retired renderer must never resume writing against a new owner.
  windowRef?.addEventListener('pageshow', restored);
  try {
    lease = await acquire({ onLost() {
      if (retired) return;
      retired = true;
      windowRef?.removeEventListener('pagehide', leave);
      try { onLost(); } finally { lease?.release(); }
    } });
    if (retired) {
      lease.release();
      throw Object.assign(new Error('页面已退出，请重新进入游戏'), { code: 'retired' });
    }
    return session;
  } catch (error) {
    retired = true;
    windowRef?.removeEventListener('pagehide', leave);
    throw error;
  }
}
