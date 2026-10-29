// One short, non-restarting damage trail: sustained fire must not hold it full.
export function updateBossHealth(previous, boss, now, reducedMotion = false) {
  const hp = Number(boss?.hp), max = Number(boss?.maxHp);
  const ratio = Number.isFinite(hp) && Number.isFinite(max) && max > 0
    ? Math.max(0, Math.min(1, hp / max)) : 0;
  if (!previous || previous.boss !== boss || reducedMotion || ratio > previous.ratio) {
    return { boss, ratio, trail: ratio, at: now };
  }
  const dt = Math.max(0, Math.min(1, (now - previous.at) / 1000));
  return { boss, ratio, trail: Math.max(ratio, previous.trail - dt * .85), at: now };
}
