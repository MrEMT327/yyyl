const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

// The final wave is the boss encounter, not a completed ordinary wave. Reserve
// its share until damage is dealt, and only settlement can confirm 100%.
export function battleProgress(game, boss, stageDuration) {
  if (game.victory === true) return 1;
  if (boss) {
    const maxHp = Number(boss.maxHp);
    const hp = Number(boss.hp);
    const remaining = Number.isFinite(maxHp) && maxHp > 0 && Number.isFinite(hp) ? clamp01(hp / maxHp) : 1;
    return Math.min(.99, .88 + (1 - remaining) * .12);
  }
  const waves = game.waveStatus;
  const ordinary = waves
    ? clamp01(Number(waves.completed) / Math.max(1, (Number(waves.total) || 15) - 1))
    : clamp01((Number(game.stageElapsed) || 0) / Math.max(1, Number(stageDuration) || 1));
  return ordinary * .88;
}
