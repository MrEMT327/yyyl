/** APK 1.1.6 Consts_Const rows 74, 102 and 122; Q16.16. */
const ONE = 65536;
const DEFAULT_DELTA_RAW = Math.trunc(-0.4 * ONE);
const MIN_THROUGH_RAW = Math.trunc(0.33 * ONE);

/** AddModRepeat keeps the largest explicitly supplied AttackPercent. */
export function mergeThroughAttackPercent(current: number | undefined, incoming: number): number {
  return current === undefined ? incoming : Math.max(current, incoming);
}

/** ThroughModParams.cctor@6d41838 initializes -555; OnEvent@6d42078
 * compares that exact sentinel before loading Const.ThroughHurtReduce.
 * Explicit zero preserves damage across passages. */
export function resolveThroughDelta(baseAttackPercent: number | undefined, repeatedAttackPercent?: number): number {
  const configured = repeatedAttackPercent === undefined
    ? (baseAttackPercent ?? -555)
    : mergeThroughAttackPercent(baseAttackPercent, repeatedAttackPercent);
  return configured === -555 ? DEFAULT_DELTA_RAW / ONE : Math.trunc(configured * ONE) / ONE;
}

/**
 * BulletData.Perform[Laser]ExThroughAttackPercentOperation:
 * max(minimum * minAttackScale, previous * (1 + delta)).
 * Call AFTER a successful passage, preserving the value for the next hit.
 * DisableThroughAttackPercentReduce skips this operation entirely.
 * Both shipped minimum constants are .33; keep the laser argument explicit
 * so integrations distinguish the two native accumulators.
 */
export function advanceThroughScale(currentScale: number, deltaPercent: number, minimumScale = 1, _laser = false): number {
  const currentRaw = Math.trunc(currentScale * ONE);
  const deltaRaw = Math.trunc(deltaPercent * ONE);
  const minimumScaleRaw = Math.trunc(minimumScale * ONE);
  // These coefficients are small enough for exact integer products in Number.
  // Native MultiplyRawValues uses an arithmetic shift (floor), not truncation.
  const floorRaw = Math.floor(MIN_THROUGH_RAW * minimumScaleRaw / ONE);
  const nextRaw = Math.floor(currentRaw * (ONE + deltaRaw) / ONE);
  return Math.max(floorRaw, nextRaw) / ONE;
}
