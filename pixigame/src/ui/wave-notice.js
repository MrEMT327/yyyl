// Local HUD timing, inspired by the native event-driven wave transition.
// This never completes native UI tasks or changes the spawn schedule.
export function waveNoticeAlpha(game) {
  const age = game.elapsed - game.waveStartedAt;
  if (game.state !== 'playing' || !(game.waveIndex > 0)
      || !Number.isFinite(age) || age < .2 || age >= 2.2) return 0;
  if (age < .35) return (age - .2) / .15;
  if (age > 1.85) return (2.2 - age) / .35;
  return 1;
}
