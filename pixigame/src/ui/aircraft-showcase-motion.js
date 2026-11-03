// Preview-only clock. The battle's simulation, cooldowns and damage never use it.
export const AIRCRAFT_SHOWCASE = Object.freeze({ entryDelay: .35, hold: 1.8, rest: 8 });
export function aircraftShowcasePose(time, duration, reducedMotion = false) {
  const t = Math.max(0, Number(time) || 0), d = Math.max(0, Number(duration) || 0);
  if (reducedMotion || !d) return { timeline: 0, progress: 0, phase: 'idle', bob: 0, pitch: 0, yaw: 0 };
  const { entryDelay, hold, rest } = AIRCRAFT_SHOWCASE;
  const cycle = 2 * d + hold + rest, elapsed = Math.max(0, t - entryDelay) % cycle;
  const timeline = t < entryDelay ? 0 : elapsed < d ? elapsed : elapsed < d + hold ? d
    : elapsed < 2 * d + hold ? 2 * d + hold - elapsed : 0;
  return { timeline, progress: timeline / d,
    phase: t < entryDelay ? 'entry' : elapsed < d ? 'deploy' : elapsed < d + hold ? 'hold' : elapsed < 2 * d + hold ? 'retract' : 'idle',
    bob: Math.sin(t * .85) * .10, pitch: Math.sin(t * .6) * .012, yaw: Math.sin(t * .42) * .025 };
}
