/** ARM64: Weapon.onCreateSpreadShape 0x6e4f20c, Weapon.LoadFireQueue 0x6e44a24.
 * Angles are radians clockwise from +Z, matching simulation.ts.
 * Compatibility helper for callers that only request a deterministic fan.
 * The game queue uses nativeSalvoPattern, which also restores the native random,
 * S-pattern, symmetric-mount and single-shot branches.
 */
export function originalSalvoPattern(options: {
  count: number;
  totalAngleDegrees: number;
  baseAngle: number;
  startAngleDegrees?: number;
  clockwise?: boolean;
  bulletInterval?: number;
  repeats?: number;
  repeatInterval?: number;
}): Array<{ angle: number; delay: number; repeat: number; index: number }> {
  const count = Math.max(1, Math.trunc(options.count));
  const repeats = Math.max(1, Math.trunc(options.repeats ?? 1));
  const total = options.totalAngleDegrees;
  // 0x6e4f5ac..5dc: >= 360 divides by count; smaller fans by count - 1.
  const denominator = total >= 360 ? count : count - 1;
  const step = denominator ? total / denominator : 0;
  // 0x6e4f368..3c8: nonzero StartAngle supplies an absolute rotation.
  const base = options.startAngleDegrees ? options.startAngleDegrees * Math.PI / 180 : options.baseAngle;
  const sign = options.clockwise ? -1 : 1;
  const shots: Array<{ angle: number; delay: number; repeat: number; index: number }> = [];
  for (let repeat = 0; repeat < repeats; repeat++) {
    for (let index = 0; index < count; index++) {
      shots.push({
        angle: base + sign * (total / 2 - index * step) * Math.PI / 180,
        delay: repeat * (options.repeatInterval ?? 0) + index * (options.bulletInterval ?? 0),
        repeat,
        index,
      });
    }
  }
  return shots;
}

/** FollowerFireBehaviorTask.CanFire 0x69cbc88, config FireType at +0x14. */
export function originalFollowerCanFire(fireType: number, hasTarget: boolean): boolean {
  return fireType === 0 || (fireType === 1 && hasTarget);
}

/** Weapon.FireMultipleBullets 0x6e49198..6e493ec.
 * HalfBulletWidthPercent is actually an additive factor, 1.2f (Const.cctor
 * 0x688b164..174, ELF relocation 0x952faa0 -> literal 0x9963550).
 */
export function originalParallelSpacing(
  shapeHalfWidth: number, bulletScale: number, modSpaceOffset = 0,
  bulletSpaceOffset = 0, spacingPercent = 0,
): number {
  return (shapeHalfWidth * bulletScale + modSpaceOffset + bulletSpaceOffset) * 2.2 * (1 + spacingPercent);
}

/** No-animation follower state sequence: FireHold -> Exit -> CeaseFire.
 * FireHold is occupied time, not a reduction of the subsequent FireCD.
 * The caller keeps any separate attack-warning/animation duration.
 */
export function originalFollowerCycle(fireHold: number, fireCooldown: number): number {
  return Math.max(0, fireHold) + Math.max(0, fireCooldown);
}

/** IsLaserWeapon 0x6c57f38: ToLower().Contains("laser" / "reflectionray").
 * ELF relocations 0x95390f8 -> 161077664, 0x955b908 -> 161090072;
 * values corroborated by script.json ScriptString. */
export function originalIsLaserTrajectory(trajectory: string): boolean {
  const value = trajectory.toLowerCase();
  return value.includes('laser') || value.includes('reflectionray');
}

/** Weapon.onCreateDiamondShape@0x6e4c7c8: equally spaced perimeter points,
 * starting at +Z, then +X, -Z, -X. Width/Height are full diagonals. */
export function nativeDiamondOffsets(count: number, width: number, height: number): Array<{ x: number; z: number }> {
  const corners = [{ x: 0, z: height / 2 }, { x: width / 2, z: 0 }, { x: 0, z: -height / 2 }, { x: -width / 2, z: 0 }];
  return Array.from({ length: Math.max(0, Math.trunc(count)) }, (_, i) => {
    const q = i * 4 / count, index = Math.floor(q), t = q - index;
    const a = corners[index], b = corners[(index + 1) % 4];
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
  });
}

/** Weapon.onCreateGradeShape@0x6e4e698: MaxBulletCount - repeatIndex *
 * PerWaveReduceBulletCount. Empty later rows stay empty (no clamp to one). */
export function nativeGradeAngles(maxCount: number, reduction: number, repeat: number, perAngle: number, direction: number): number[] {
  const count = Math.max(0, Math.trunc(maxCount - repeat * reduction));
  return Array.from({ length: count }, (_, i) => direction + (i - (count - 1) / 2) * perAngle * Math.PI / 180);
}
