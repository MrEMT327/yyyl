/** AIMoveOnPathAttackLoopBorn.Data (APK 1.1.6):
 * isSelfRotate@0x28, FP rotateSpeed@0x30, noFindTarget@0x38.
 * InitAttackLoop 0x68f2088 sets MoveOnPath's ignore-facing flag only for ==1.
 * OnMovePath 0x68f2334 advances the transform BEFORE its firing timer.
 * Do not call during Born, the exit task, or after replacing the path tangent.
 */
export function chapterPathSelfRotationEnabled(type: unknown, parameters: Record<string, unknown>): boolean {
  return type === 'AIMoveOnPathAttackLoopBorn' && Number(parameters.isSelfRotate) === 1;
}

export function chapterPathRotationRadians(
  type: unknown, parameters: Record<string, unknown>, current: number, dt: number,
): number {
  if (!chapterPathSelfRotationEnabled(type, parameters)) return current;
  return current + Number(parameters.rotateSpeed || 0) * Math.PI / 180 * dt;
}

/** InitAttackLoop 0x68f2108 skips SelectEntity_NearOne/SetTarget on ANY nonzero
 * noFindTarget. This does not itself change rotation or the Fire() entrypoint.
 * Current 310022/320052 weapons use self rotation (FireRotation=3), not aim.
 */
export function chapterPathSelectsTarget(type: unknown, parameters: Record<string, unknown>): boolean {
  return type === 'AIMoveOnPathAttackLoopBorn' && Number(parameters.noFindTarget || 0) === 0;
}
