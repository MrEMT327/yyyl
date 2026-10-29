// Synchronous same-origin checkpoint: pagehide cannot wait for postMessage.
const CAPTURE = 'shnh-capture-replica-battle';
export function installBattleCheckpoint(read, host = window) {
  let last = null;
  const capture = () => read ? read() : last;
  host.addEventListener(CAPTURE, event => { if (event.detail) event.detail.result = capture(); });
  // Keep only the small final snapshot after teardown, not the simulation.
  // A cached/failed-save host may request it after the child's pagehide.
  return { freeze() { if (read) { last = read(); read = null; } } };
}
export function captureBattleCheckpoint(host) {
  const event = new CustomEvent(CAPTURE, {detail: {result: null}});
  try { host?.dispatchEvent(event); } catch { return null; }
  return event.detail.result;
}
