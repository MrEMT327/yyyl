import type { Point, Projectile } from './model';

/** WeaponRangeTargetModProcessor.FillLoadData: sample without replacement;
 * ContainsTarget=0 excludes the monster which triggered the splash. */
export function thunderRangeTargets<T extends Point & { uid: number }>(
  origin: Point, sourceUid: number | undefined, candidates: readonly T[],
  parameters: { Range: number; RandomCount: number; ContainsTarget?: number }, random: () => number,
): T[] {
  const pool = candidates.filter(e => (parameters.ContainsTarget || e.uid !== sourceUid)
    && Math.hypot(e.x - origin.x, e.z - origin.z) <= parameters.Range);
  if (parameters.RandomCount <= 0) return pool;
  const selected: T[] = [];
  while (pool.length && selected.length < parameters.RandomCount)
    selected.push(pool.splice(Math.min(pool.length - 1, Math.floor(random() * pool.length)), 1)[0]);
  return selected;
}

/** Render adapter only: Thunder has direct-target damage, NOT a ray collider. */
export function thunderBeam(b: Projectile): Projectile | undefined {
  if (b.trajectory !== 'Thunder' || !b.segments.length || b.visualHidden || !(b.scale > 0)) return;
  return { ...b, beam: true, segments: b.segments.map(s => ({ from: { ...s.from }, to: { ...s.to } })) };
}
