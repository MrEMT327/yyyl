// An asynchronous card/ad completion may enter playing after the visibility
// event already ran. Check this guard before both UI refresh and logic ticks.
export function createBattleActivity({page = document, host = window, allowParentFocus = false, suspend, refresh = () => {}, blocked = () => false, signal}) {
  let away = Boolean(page.hidden), disposed = false, blurTimer = null, resetFrame = Boolean(page.hidden);
  const enforce = () => {
    if (disposed) return false;
    if (!away && !page.hidden && !blocked()) return true;
    resetFrame = true; suspend();
    return false;
  };
  const focus = () => { away = Boolean(page.hidden); };
  const visibility = () => {
    away = Boolean(page.hidden);
    if (away) { enforce(); refresh(); }
  };
  const blur = () => {
    if (blurTimer !== null) host.clearTimeout(blurTimer);
    // Focus may move from the iframe to its own host (e.g. the ad placeholder).
    blurTimer = host.setTimeout(() => {
      blurTimer = null;
      if (disposed || page.hasFocus()) return;
      if (allowParentFocus && !page.hidden && host.parent !== host) {
        try { if (host.parent.document.hasFocus()) return; } catch { /* Detached host. */ }
      }
      away = true;
      enforce(); refresh();
    }, 0);
  };
  const destroy = () => {
    if (disposed) return;
    disposed = true;
    if (blurTimer !== null) host.clearTimeout(blurTimer);
    page.removeEventListener('visibilitychange', visibility);
    host.removeEventListener('blur', blur);
    host.removeEventListener('focus', focus);
    signal?.removeEventListener('abort', destroy);
  };
  page.addEventListener('visibilitychange', visibility);
  host.addEventListener('blur', blur);
  host.addEventListener('focus', focus);
  signal?.addEventListener('abort', destroy, {once: true});
  if (signal?.aborted) destroy();
  const frameDelta = delta => {
    if (!enforce()) return 0;
    if (resetFrame) { resetFrame = false; return 0; }
    return Number.isFinite(delta) ? Math.max(0, delta) : 0;
  };
  return {enforce, frameDelta, destroy};
}
