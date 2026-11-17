/** Project-authored recoil for ordinary/elite bars. Visual seconds only;
 * no source animation asset, simulation mutation or wall-clock tween. */
export const ENEMY_BAR_HIT_SECONDS = .24;

export function enemyBarHitPulse(elapsed: number): number {
  if (!(elapsed >= 0 && elapsed < ENEMY_BAR_HIT_SECONDS)) return 0;
  const t = elapsed / ENEMY_BAR_HIT_SECONDS;
  return Math.cos(t * Math.PI * 3) * (1 - t) ** 2;
}
