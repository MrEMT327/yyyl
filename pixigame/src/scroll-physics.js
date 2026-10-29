// Positions and velocities use CSS pixels and milliseconds, independent of FPS.
const DECAY = .0045;
const SPRING = .022;
export function rubberBand(distance, extent) {
  const limit = Math.max(24, Math.min(120, extent * .35));
  return Math.sign(distance) * limit * (1 - 1 / (Math.abs(distance) * .55 / limit + 1));
}
export function dragPosition(raw, max, extent) {
  const edge = Math.max(0, Math.min(max, raw));
  return edge + rubberBand(raw - edge, extent);
}
export function advanceScroll(state, dt, max) {
  let { position, velocity, target = null } = state;
  if (target === null) {
    const decay = Math.exp(-DECAY * dt);
    const next = position + velocity * (1 - decay) / DECAY;
    if (next >= 0 && next <= max) return { position: next, velocity: velocity * decay, target: null };
    target = next < 0 ? 0 : max;
    const crossing = -Math.log(Math.max(1e-6, 1 - DECAY * (target - position) / velocity)) / DECAY;
    velocity *= Math.exp(-DECAY * crossing);
    position = target; dt = Math.max(0, dt - crossing);
  }
  // Exact critically damped spring: no Euler instability at 60/90/120 Hz.
  const displacement = position - target, c = velocity + SPRING * displacement;
  const decay = Math.exp(-SPRING * dt);
  return { position: target + (displacement + c * dt) * decay,
    velocity: (velocity - SPRING * c * dt) * decay, target };
}
