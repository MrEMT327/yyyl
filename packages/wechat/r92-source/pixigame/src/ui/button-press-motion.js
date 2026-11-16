// The reference button settles at 90%. The shorter web press and small
// overshoot keep the feedback visible on quick taps as well as long holds.
const PRESSED = .9;
const PRESS_MS = 110;
const RELEASE_MS = 145;
const easeOut = t => 1 - (1 - t) ** 3;
const mix = (a, b, t) => a + (b - a) * t;

export function createButtonPressMotion(apply, isAlive) {
  const motions = new Map();
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  let frame = 0;
  const quiet = () => reduced?.matches || globalThis.document?.hidden;

  function cancel(target) {
    if (motions.delete(target)) apply(target, 1);
  }
  function clear() {
    for (const target of motions.keys()) cancel(target);
    if (frame) globalThis.cancelAnimationFrame?.(frame);
    frame = 0;
  }
  function sample(motion, now) {
    const { from, start, releasing } = motion;
    const t = Math.min(1, Math.max(0, (now - start) / (releasing ? RELEASE_MS : PRESS_MS)));
    if (!releasing) return mix(from, PRESSED, easeOut(t));
    const dip = Math.min(from, .94);
    if (t < .16) return mix(from, dip, easeOut(t / .16));
    if (t < .64) return mix(dip, 1.018, easeOut((t - .16) / .48));
    return mix(1.018, 1, easeOut((t - .64) / .36));
  }
  function tick(now) {
    frame = 0;
    if (quiet()) { clear(); return; }
    let pending = false;
    for (const [target, motion] of motions) {
      const complete = now - motion.start >= (motion.releasing ? RELEASE_MS : PRESS_MS);
      if (!isAlive(target) || motion.releasing && complete) { cancel(target); continue; }
      apply(target, sample(motion, now));
      pending ||= !complete;
    }
    if (pending) schedule();
  }
  function schedule() {
    if (!frame) frame = globalThis.requestAnimationFrame?.(tick) || 0;
  }
  return {
    start(target) {
      if (!target || quiet() || !isAlive(target) || !globalThis.requestAnimationFrame) return;
      const now = performance.now(), previous = motions.get(target);
      if (previous && !previous.releasing) return;
      motions.set(target, { from: previous ? sample(previous, now) : 1, start: now, releasing: false });
      schedule();
    },
    release(target) {
      const motion = motions.get(target);
      if (!motion || motion.releasing) return;
      if (quiet() || !isAlive(target)) { cancel(target); return; }
      const now = performance.now();
      motions.set(target, { from: sample(motion, now), start: now, releasing: true });
      schedule();
    },
    cancel,
    clear,
  };
}

export function createCanvasButtonPress() {
  return createButtonPressMotion((node, factor) => {
    if (factor === 1) { node.visualScale = null; return; }
    const { x, y, width, height } = node.buttonFaceBounds || node.hitArea;
    node.visualScale = { x: x + width / 2, y: y + height / 2, factor };
  }, node => Boolean(node.parent && node.worldVisible && node.enabled && node.hitArea
    && node.children.length && !node.destroyed));
}
