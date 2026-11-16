import type { NativeWeaponPoint } from './weapon-runtime-extensions';

export interface NativeRayTarget extends NativeWeaponPoint {
  uid: number;
  alive: boolean;
  inCamera: boolean;
  camp: number;
}
export interface NativeNearbyRayEvent {
  hitPosition?: NativeWeaponPoint;
  targetUid?: number;
  position?: NativeWeaponPoint;
}
export interface NativeNearbyRaySegment {
  targetUid: number;
  start: NativeWeaponPoint;
  end: NativeWeaponPoint;
  yawDegrees: number;
  length: number;
  extraFlags: number;
}
const nonzero = (p?: NativeWeaponPoint): p is NativeWeaponPoint => !!p && (p.x !== 0 || p.z !== 0);

/** Action 212. Preserve EntityManager camera enumeration order; the native
 * implementation does not sort by nearest distance. LifeTime in the action
 * params is unused: retain Bullet200177's actual configured life. Geometry is
 * supplied to CreateWeaponAndFire as targetPosition. UpdateRayPath emits only
 * presentation endpoints; it DOES NOT stretch the collision shape along the
 * segment. FixedPos keeps the original scaled shape at targetPosition. */
export function nativeNearbyRaySegments(owner: NativeWeaponPoint & { uid: number; camp: number },
  event: NativeNearbyRayEvent, enemies: readonly NativeRayTarget[], range: number,
  maxTargets: number): NativeNearbyRaySegment[] {
  const hitTarget = enemies.find(enemy => enemy.uid === event.targetUid && enemy.alive);
  const start = nonzero(event.hitPosition) ? event.hitPosition
    : hitTarget && nonzero(hitTarget) ? hitTarget
    : nonzero(event.position) ? event.position : owner;
  const result: NativeNearbyRaySegment[] = [];
  const seen = new Set<number>();
  let selectedCount = 0;
  for (const enemy of enemies) {
    if (!enemy.alive || !enemy.inCamera || enemy.uid === owner.uid || enemy.camp === owner.camp ||
      enemy.uid === event.targetUid || seen.has(enemy.uid)) continue;
    const dx = enemy.x - start.x, dz = enemy.z - start.z;
    if (dx * dx + dz * dz > range * range) continue;
    seen.add(enemy.uid);
    if (selectedCount >= maxTargets) break;
    selectedCount++;
    // Native skips CreateWeaponAndFire when normalized direction equals zero.
    if (dx === 0 && dz === 0) continue;
    result.push({ targetUid: enemy.uid, start: { x: start.x, z: start.z },
      end: { x: enemy.x, z: enemy.z }, yawDegrees: Math.atan2(dx, dz) * 180 / Math.PI,
      length: Math.hypot(dx, dz), extraFlags: 0x88 });
  }
  return result;
}

export interface NativeRayChaserHost {
  alive(uid: number): boolean;
  /** Read the CURRENT registered reflection path for the source ray each call.
   * A missing/dead ray must return an empty path, not its old cached targets. */
  path(sourceRayUid: number): readonly number[];
  target(uid: number): NativeWeaponPoint | undefined;
  position(uid: number): NativeWeaponPoint;
  speed(uid: number): number;
  pose(uid: number, position: NativeWeaponPoint, yawDegrees?: number): void;
  /** Native HurtCurrentTarget overlaps at the arrival position and restricts
   * hits to this uid; apply ordinary hurt/through and hit-trigger rules there.
   * Disable generic per-frame collisions for the managed projectile. */
  hit(uid: number, targetUid: number): void;
  kill(uid: number): void;
}
interface Chaser {
  uid: number;
  source: number;
  previous: number | null;
  current: number;
}

/** ReflectionRayChaserProcessor 0x6d8e7fc. One segment at most per frame;
 * unused travel distance is discarded on arrival, exactly as native. */
export class NativeRayChaserRuntime {
  private chasers: Chaser[] = [];
  constructor(private readonly host: NativeRayChaserHost) {}
  clear(): void {
    for (const chaser of this.chasers) this.host.kill(chaser.uid);
    this.chasers = [];
  }
  /** Action253 creates one bullet at the player's position/rotation for EACH
   * living matching source ray whose registered path is nonempty. */
  attach(uid: number, sourceRayUid: number): boolean {
    const path = this.host.path(sourceRayUid);
    if (!path.length) { this.host.kill(uid); return false; }
    this.chasers.push({ uid, source: sourceRayUid, previous: null, current: path[0] });
    return true;
  }
  step(deltaTime: number): void {
    for (const chaser of [...this.chasers]) {
      if (!this.host.alive(chaser.uid)) { this.forget(chaser); continue; }
      const path = this.host.path(chaser.source);
      const previousIndex = chaser.previous == null ? -1 : path.indexOf(chaser.previous);
      const valid = path.length > 0 && (chaser.previous == null
        ? path[0] === chaser.current
        : previousIndex >= 0 && path[previousIndex + 1] === chaser.current);
      const target = this.host.target(chaser.current);
      if (!valid || !target) { this.host.kill(chaser.uid); this.forget(chaser); continue; }
      const current = this.host.position(chaser.uid);
      const dx = target.x - current.x, dz = target.z - current.z;
      const distance = Math.hypot(dx, dz), travel = this.host.speed(chaser.uid) * deltaTime;
      if (travel < distance) {
        this.host.pose(chaser.uid, { x: current.x + dx * travel / distance,
          z: current.z + dz * travel / distance }, Math.atan2(dx, dz) * 180 / Math.PI);
        continue;
      }
      this.host.pose(chaser.uid, { ...target });
      this.host.hit(chaser.uid, chaser.current);
      chaser.previous = chaser.current;
      // Hit callbacks may change the registered path. GetNextTargetAfter reads
      // it again after damage, rather than advancing an old array snapshot.
      const nextPath = this.host.path(chaser.source);
      const index = nextPath.indexOf(chaser.current);
      const next = index >= 0 ? nextPath[index + 1] : undefined;
      if (next == null) { this.host.kill(chaser.uid); this.forget(chaser); }
      else chaser.current = next;
    }
  }
  private forget(chaser: Chaser): void {
    const index = this.chasers.indexOf(chaser);
    if (index >= 0) this.chasers.splice(index, 1);
  }
}
