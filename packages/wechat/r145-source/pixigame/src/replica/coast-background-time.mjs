// Render between completed 30 Hz simulation steps without altering game time.
// Keep the last presented value across pause/resume until simulation catches up.
export function smoothCoastTime(simTime, accumulated, logicStep, nativeDelta, previous) {
  if (!(simTime > 0) || !(logicStep > 0) || !(nativeDelta > 0)) return 0;
  const fraction = Math.max(0, Math.min(1, accumulated / logicStep));
  const interpolated = Math.max(0, simTime - nativeDelta + fraction * nativeDelta);
  return Math.max(previous, interpolated);
}
