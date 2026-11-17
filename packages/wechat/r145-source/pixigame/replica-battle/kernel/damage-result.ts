/** HurtBase.FinalizeAttackResult (0x6ccd444) -> FPMath.Round (0x8353158).
 * Round the final damage, after mitigation, to an integer with ties to even.
 * This boundary does not replace the native fixed-point intermediate formula.
 */
export function nativeDamageResult(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const integer = Math.floor(value);
  const fraction = value - integer;
  if (fraction < 0.5) return integer;
  if (fraction > 0.5) return integer + 1;
  return integer % 2 === 0 ? integer : integer + 1;
}
