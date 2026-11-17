import type { Point, RecordData } from './model';

export interface NativeWallHit { point: Point; normal: Point; fraction: number }

/** ReboundDetectionHelper traces the camera's four walls. The radius offsets
 * the centre to the tangent point; use the earliest wall, not an X-only clamp.
 * Caller retains the post-contact frame boundary and native rebound count. */
export function nativeCameraWallHit(from: Point, to: Point, radius: number,
  bounds: { left: number; right: number; bottom: number; top: number }): NativeWallHit | undefined {
  const dx = to.x - from.x, dz = to.z - from.z;
  const candidates: NativeWallHit[] = [];
  const tryWall = (axis: 'x' | 'z', edge: number, normal: Point) => {
    const delta = axis === 'x' ? dx : dz;
    if (delta * (axis === 'x' ? normal.x : normal.z) >= 0 || delta === 0) return;
    const fraction = (edge - from[axis]) / delta;
    if (fraction < 0 || fraction > 1) return;
    const point = { x: from.x + dx * fraction, z: from.z + dz * fraction };
    if (point.x < bounds.left - radius || point.x > bounds.right + radius
      || point.z < bounds.bottom - radius || point.z > bounds.top + radius) return;
    candidates.push({ point, normal, fraction });
  };
  tryWall('x', bounds.left + radius, { x: 1, z: 0 });
  tryWall('x', bounds.right - radius, { x: -1, z: 0 });
  tryWall('z', bounds.bottom + radius, { x: 0, z: 1 });
  tryWall('z', bounds.top - radius, { x: 0, z: -1 });
  return candidates.sort((a, b) => a.fraction - b.fraction)[0];
}

/** HurtSourceData.SetFormula_DistanceBasedAttackPercent 0x6ce5960.
 * Const.MaxDisForNearAttr=15 (cctor 0x688b018, ScriptString slot 0x9502a88).
 * Distance is OwnerAndTargetDistance, not distance from the emitted bullet. */
export function nativeNearDamageBonus(owner: Point, target: Point, attackAddForNear: number): number {
  const distance = Math.hypot(owner.x - target.x, owner.z - target.z);
  return attackAddForNear > 0 && distance <= 15 ? attackAddForNear * (15 - distance) / 15 : 0;
}

/** Preserve repeated mod records for processors needing a per-record identity.
 * Numeric additive processors consume these with their own native merge rule. */
export function nativeModRecords(base: readonly RecordData[], learned: readonly { name: string; args: RecordData }[] = []): RecordData[] {
  return [...base, ...learned.map(mod => ({ type: mod.name, parameters: mod.args }))];
}

export function nativeModParameters(mods: readonly RecordData[], name: string): RecordData[] {
  return mods.filter(mod => mod.type === name).map(mod => mod.parameters || {});
}
