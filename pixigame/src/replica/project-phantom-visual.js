/** Visual-only echoes of the actual aircraft. All ages use simulation seconds,
 * so pause freezes them and ending the active effect clears them immediately. */
export function createPhantomTrailState() {
  return { runId: undefined, lastClock: -Infinity, history: [] };
}
export function samplePhantomTrail(state, { clock, runId, phantomActive, rollActive = false, pose }) {
  if (state.runId !== runId || clock < state.lastClock) state.history.length = 0;
  state.runId = runId;
  state.lastClock = clock;
  if ((!phantomActive && !rollActive) || !pose?.visible) {
    state.history.length = 0;
    return [];
  }
  const width = Math.max(pose.width, pose.height) * pose.scaleX;
  const height = Math.max(pose.width, pose.height) * pose.scaleY;
  const current = { clock, x: pose.x, y: pose.y };
  const previous = state.history.at(-1);
  if (!previous || clock - previous.clock >= .035) state.history.push(current);
  while (state.history.length > 8 || state.history.length > 1 && clock - state.history[0].clock > .22) state.history.shift();
  return [0, 1].map(index => {
    const target = clock - (index + 1) * .07;
    const old = state.history.reduce((best, point) => Math.abs(point.clock - target) < Math.abs(best.clock - target) ? point : best);
    const dx = old.x - pose.x, dy = old.y - pose.y, distance = Math.hypot(dx, dy);
    // Keep the copies within the hull's neighborhood even after a teleport.
    const ratio = distance ? Math.min(1, Math.max(8, width * .24) / distance) : 1;
    const side = index ? 1 : -1;
    const offset = phantomActive ? Math.min(14, Math.max(6, width * .10)) * side : 0;
    return { x: pose.x + dx * ratio + offset, y: pose.y + dy * ratio + 2 + index * 2,
      width, height, tint: index ? 0xd6f5ff : 0x71d9ff, alpha: phantomActive ? (index ? .26 : .40) : (distance > .5 ? (index ? .13 : .24) : 0) };
  });
}
