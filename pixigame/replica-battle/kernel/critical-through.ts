/** Native CriticalThroughModProcessor: OnEvent(35), AddModRepeat sums counts.
 * RVA 0x6D215F4 / 0x6D2156C. Runs before the contact consumes a penetration.
 */
export function applyCriticalThrough(bullet: {
  pierce: number;
  originalThroughCount?: number;
  runtimeMods?: Record<string, any>[];
}, eventId: number): void {
  if (eventId !== 35) return;
  let count = 0;
  for (const mod of bullet.runtimeMods || []) {
    if (mod.type !== 'CriticalThroughMod') continue;
    const value = Number(mod.parameters?.ThroughCount || 0);
    if (Number.isFinite(value)) count += Math.trunc(value);
  }
  if (count < 1) return;
  bullet.originalThroughCount = (bullet.originalThroughCount ?? bullet.pierce) + count;
  bullet.pierce += count;
}
