// One outstanding frame, with no work scheduled while the document is hidden.
// Keep intent separate from visibility so returning to a tab resumes exactly
// the loop that was running, without a large catch-up delta or duplicate RAFs.
export function createFrameLoop(update, {
  documentRef = globalThis.document,
  requestFrame = callback => globalThis.requestAnimationFrame(callback),
  cancelFrame = frame => globalThis.cancelAnimationFrame(frame),
  onResume = () => {},
} = {}) {
  let started = false, destroyed = false, frame = null, previous = null;
  const schedule = () => {
    if (started && !destroyed && !documentRef?.hidden && frame === null) frame = requestFrame(tick);
  };
  const tick = time => {
    frame = null;
    if (!started || destroyed || documentRef?.hidden) return;
    const delta = previous === null ? 1000 / 60 : Math.max(0, time - previous);
    previous = time;
    update(time, delta);
    schedule();
  };
  const cancel = () => { if (frame !== null) cancelFrame(frame); frame = null; previous = null; };
  const visibility = () => {
    cancel();
    if (!documentRef?.hidden && started) { onResume(); schedule(); }
  };
  documentRef?.addEventListener?.('visibilitychange', visibility);
  return {
    start() { if (destroyed || started) return; started = true; previous = null; onResume(); schedule(); },
    stop() { started = false; cancel(); },
    destroy() { started = false; destroyed = true; cancel(); documentRef?.removeEventListener?.('visibilitychange', visibility); },
    get started() { return started; },
  };
}
