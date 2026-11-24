// One outstanding frame, with no work scheduled while the document is hidden.
// Keep intent separate from visibility so returning to a tab resumes exactly
// the loop that was running, without a large catch-up delta or duplicate RAFs.
export function createFrameLoop(update, {
  documentRef = globalThis.document,
  requestFrame = callback => globalThis.requestAnimationFrame(callback),
  cancelFrame = frame => globalThis.cancelAnimationFrame(frame),
  isVisible = () => !documentRef?.hidden,
  watchVisibility = listener => {
    documentRef?.addEventListener?.('visibilitychange', listener);
    return () => documentRef?.removeEventListener?.('visibilitychange', listener);
  },
  onResume = () => {},
} = {}) {
  let started = false, destroyed = false, frame = null, previous = null;
  const schedule = () => {
    if (started && !destroyed && isVisible() && frame === null) frame = requestFrame(tick);
  };
  const tick = time => {
    frame = null;
    if (!started || destroyed || !isVisible()) return;
    const delta = previous === null ? 1000 / 60 : Math.max(0, time - previous);
    previous = time;
    update(time, delta);
    schedule();
  };
  const cancel = () => { if (frame !== null) cancelFrame(frame); frame = null; previous = null; };
  const visibility = () => {
    cancel();
    if (isVisible() && started) { onResume(); schedule(); }
  };
  const unwatch = watchVisibility(visibility);
  return {
    start() { if (destroyed || started) return; started = true; previous = null; onResume(); schedule(); },
    stop() { started = false; cancel(); },
    destroy() { started = false; destroyed = true; cancel(); unwatch(); },
    get started() { return started; },
  };
}
