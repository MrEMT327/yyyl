import type { NativeWeaponPoint } from './weapon-runtime-extensions';

export interface NativeReflectionTarget extends NativeWeaponPoint {
  uid: number;
  alive: boolean;
  inCamera: boolean;
  camp: number;
}
export interface NativeReflectionSettings {
  attackDistance: number;
  reflectionRange: number;
  /** BulletData.ReflectionCount, NOT ThroughCount. */
  reflectionCount: number;
  ownerReflectionCount: number;
  selfReflectionCount: number;
}
export interface NativeReflectionHost {
  owner(rayUid: number): NativeWeaponPoint & { uid: number; camp: number };
  /** Preserve EntityManager enumeration order, including ineligible entries. */
  targets(): readonly NativeReflectionTarget[];
  random(): number;
  /** EntitySelect.GetEntityDistance: use the host's native collider distance. */
  firstTargetDistance(rayUid: number, target: NativeReflectionTarget): number;
  /** EntitySelect.IsEntityValid and HitCamp may add filters beyond camp. */
  canSelectFirst?(rayUid: number, target: NativeReflectionTarget): boolean;
  canHit?(rayUid: number, target: NativeReflectionTarget): boolean;
  onTargetReplaced?(rayUid: number, targetUid: number): void;
}
interface RayState { path: number[]; changeIndex: number; changeCD: number; ownerUid: number }
const sqDistance = (a: NativeWeaponPoint, b: NativeWeaponPoint) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const changeDelay = 0x1999 / 65536;

/** ReflectionRayProcessor.UpdateReflectionRayPath (57da100).
 * Targets persist until dead/outside camera; distance is only an acquisition
 * condition. A broken suffix waits 0.1 fixed-point seconds before replacement.
 * The suffix search uses the ORIGINAL last retained target as its fixed center.
 */
export class NativeReflectionRayRuntime {
  private readonly rays = new Map<number, RayState>();
  private readonly firstTargets = new Map<number, { ownerUid: number; targetUid: number }>();
  constructor(private readonly host: NativeReflectionHost) {}
  clear(): void { this.rays.clear(); this.firstTargets.clear(); }
  remove(rayUid: number): void { this.rays.delete(rayUid); this.firstTargets.delete(rayUid); }
  path(rayUid: number): readonly number[] { return this.rays.get(rayUid)?.path ?? []; }

  step(rayUid: number, dt: number, settings: NativeReflectionSettings): readonly number[] {
    const owner = this.host.owner(rayUid);
    let state = this.rays.get(rayUid);
    if (!state) {
      state = { path: [], changeIndex: -1, changeCD: 0, ownerUid: owner.uid };
      this.rays.set(rayUid, state);
    }
    const all = this.host.targets();
    const byId = new Map(all.map(target => [target.uid, target]));
    if (state.changeIndex >= 0 && state.changeCD > 0) state.changeCD -= dt;
    const invalidIndex = state.path.findIndex(uid => {
      const target = byId.get(uid);
      return !target || !target.alive || !target.inCamera;
    });
    if (invalidIndex >= 0) {
      state.path.splice(invalidIndex);
      state.changeIndex = invalidIndex;
      state.changeCD = changeDelay;
    }
    if (state.changeIndex >= 0 && state.changeCD > 0) return state.path;
    if (!state.path.length) {
      this.firstTargets.delete(rayUid);
      let nearest: NativeReflectionTarget | undefined;
      let nearestDistance = settings.attackDistance;
      for (const target of all) {
        if (!this.validFirst(rayUid, target, owner.camp)) continue;
        const distance = this.host.firstTargetDistance(rayUid, target);
        if (distance < nearestDistance) { nearest = target; nearestDistance = distance; }
      }
      if (!nearest) return state.path;
      const occupied = (uid: number) => Array.from(this.firstTargets.values())
        .some(item => item.ownerUid === owner.uid && item.targetUid === uid);
      if (occupied(nearest.uid)) {
        const candidates = all.filter(target => target.uid !== owner.uid && target.alive && target.inCamera
          && target.camp !== owner.camp && sqDistance(owner, target) <= settings.attackDistance ** 2);
        if (candidates.length) {
          const start = Math.floor(this.host.random() * candidates.length);
          // TrySelectFirstTarget uses ElementAtOrDefault(start+i), WITHOUT modulo.
          // Failure to find an unclaimed suffix entry falls back to nearest.
          for (let i = start; i < candidates.length; i++) {
            if (!occupied(candidates[i]!.uid)) { nearest = candidates[i]!; break; }
          }
        }
      }
      state.path.push(nearest.uid);
      this.firstTargets.set(rayUid, { ownerUid: owner.uid, targetUid: nearest.uid });
    }
    const remaining = Math.trunc(settings.ownerReflectionCount) + Math.trunc(settings.selfReflectionCount)
      + settings.reflectionCount - state.path.length + 1;
    if (remaining > 0) {
      const center = byId.get(state.path[state.path.length - 1]!);
      const camera = all.filter(target => target.inCamera);
      if (center && camera.length) {
        const excluded = new Set(state.path);
        for (let i = 0; i < remaining; i++) {
          // FindRandomTargetInRange draws before eligibility filtering and walks
          // circularly through the complete camera list, rather than choosing a
          // uniform index in a prefiltered list or sorting by distance.
          const start = Math.floor(this.host.random() * camera.length);
          let found: NativeReflectionTarget | undefined;
          for (let j = 0; j < camera.length; j++) {
            const target = camera[(start + j) % camera.length]!;
            if (!target.alive || excluded.has(target.uid)) continue;
            if (this.host.canHit ? !this.host.canHit(rayUid, target) : target.camp === owner.camp) continue;
            if (sqDistance(center, target) < settings.reflectionRange ** 2) { found = target; break; }
          }
          if (!found) break;
          excluded.add(found.uid);
          state.path.push(found.uid);
        }
      }
    }
    if (state.changeIndex >= 0 && state.path.length > state.changeIndex) {
      this.host.onTargetReplaced?.(rayUid, state.path[state.changeIndex]!);
      state.changeIndex = -1;
      state.changeCD = 0;
    }
    return state.path;
  }
  private validFirst(rayUid: number, target: NativeReflectionTarget, ownerCamp: number): boolean {
    return target.alive && target.inCamera && target.camp !== ownerCamp
      && (this.host.canSelectFirst?.(rayUid, target) ?? true);
  }
}

/** EntityCharacter.GetAttackDistance (6bd4720). The passive multiplier modifies
 * the percentage term, not the entire final distance. All inputs native units. */
export function nativeReflectionAttackDistance(baseDistance: number, flatAttribute: number,
  percentAttribute: number, passivePercentBonus = 0): number {
  return (baseDistance + flatAttribute) * (1 + percentAttribute * (1 + passivePercentBonus));
}

/** Native CharacterData.ShapeRadius2 is the cached radius field name; despite
 * the suffix it is subtracted directly from the (not squared) distance. */
export function nativeReflectionFirstDistance(owner: NativeWeaponPoint, target: NativeWeaponPoint,
  ownerShapeRadius2: number, targetShapeRadius2: number): number {
  return Math.sqrt(sqDistance(owner, target)) - ownerShapeRadius2 - targetShapeRadius2;
}

/** Params.PathHurtRate defaults to zero; the positive scoped attribute replaces
 * it. It must not default to one, and is not an additive damage bonus. */
export function nativeReflectionPathHurtRate(scopedAttribute: number, paramsPathRate = 0): number {
  return scopedAttribute > 0 ? scopedAttribute : paramsPathRate;
}

/** TickHit (57d82ac). segmentIndex is 0 for owner -> first target.
 * Membership in the WHOLE target list determines direct target damage. Other
 * enemies pierced along a segment use PathHurtRate and consume the separate
 * per-TickHit through budget; host collision code must handle that budget.
 * There is no exponent by reflection index and no cumulative damage decay.
 */
export function nativeReflectionDamageMultiplier(targetUid: number, path: readonly number[],
  segmentIndex: number, reflectionHurtAdd: number, pathRate: number,
  exReflectionAttackPercent = 0): number {
  if (path.includes(targetUid)) return targetUid === path[0] ? 1 : 1 + reflectionHurtAdd;
  return pathRate * (segmentIndex > 0 ? 1 + reflectionHurtAdd + exReflectionAttackPercent : 1);
}
