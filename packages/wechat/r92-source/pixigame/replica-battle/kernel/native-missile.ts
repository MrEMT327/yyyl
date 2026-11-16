import { nativeMissileCreationPlan, type NativeWeaponPoint } from './weapon-runtime-extensions';

type Point = NativeWeaponPoint;
export interface NativeMissileAttributes {
  missileCount: number;
  maxMissileCount: number;
  allMissileCount?: number;
  allMissileCountTimes?: number;
  allMissileConsecutiveCount?: number;
}
export interface NativeMissileHost {
  /** Skill-created owners retain their own family identity. The ordinary
   * in-battle missile family remains 200041. */
  familyEntityId?: number;
  owner(): Point & { yawDegrees: number };
  emit(weaponId: number, origin: Point, angle: number, options: {
    familyEntityId: number; held: boolean; ignoreCapacity: boolean;
  }): number | undefined;
  get(uid: number): { position: Point; yawDegrees: number; rotateSpeed: number } | undefined;
  pose(uid: number, position: Point, yawDegrees: number): void;
  hold(uid: number, held: boolean): void;
  dead(uid: number): boolean;
  kill(uid: number): void;
  /** Native EntitySelect_ForwardRandomEnemyInRange, not nearest-target selection. */
  selectForwardTarget(range: number): { uid: number; position: Point } | undefined;
  target(uid: number, targetUid: number): void;
  targetPosition(targetUid: number): Point | undefined;
  random(): number;
  /** Enable mods, then invoke WeaponFire for this bullet. Creation is not launch. */
  launched(uid: number): void;
  mergeAttributes?(uid: number, attrs: Readonly<Record<string, number>>): void;
  prepareSound?(): void;
}

interface Waiting { uid: number; ignoreCapacity: boolean }
interface Preparing {
  uid: number; elapsed: number; start: Point; end: Point; targetUid: number;
  lastTarget: Point; left: boolean; forwardUp: boolean;
}
interface Pending { at: number; weaponId: number }

const DEG = Math.PI / 180;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Native curve 100019 has weighted tangents. A plain smoothstep/Hermite loses
 * its fast initial swing. Keys come from projectile-curves.json / APK curve. */
export function nativeMissilePrepareCurve(time: number): number {
  const t = clamp01(time);
  const x1 = 0.1715686321258545;
  const x2 = 1 - 0.38235294818878174;
  const y1 = x1 * 4.786742687225342;
  const y2 = 1 - (1 - x2) * 0.09716004133224487;
  const bezier = (u: number, a: number, b: number) =>
    3 * (1 - u) ** 2 * u * a + 3 * (1 - u) * u * u * b + u ** 3;
  let lo = 0, hi = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (bezier(mid, x1, x2) < t) lo = mid; else hi = mid;
  }
  return t === 0 || t === 1 ? t : bezier((lo + hi) / 2, y1, y2);
}

/** CharacterComponentFlySword + AISecondWeaponMissile, APK 1.1.6.
 * Evidence: research/missile-blackhole-full-native.txt. The owner updates this
 * once per logic step. Waiting and preparing bullets must not move/collide/age
 * through the host's ordinary projectile update; release happens in launched().
 * This reproduces the in-battle missile family, not the separate dragon hero.
 */
export class NativeMissileRuntime {
  private readonly waiting = new Map<number, Waiting[]>();
  private readonly preparing: Preparing[] = [];
  private readonly pending: Pending[] = [];
  private attributes: NativeMissileAttributes = { missileCount: 1, maxMissileCount: 3 };
  private now = 0;
  private lastPrepareTick = 0;
  private shift = false;

  constructor(private readonly host: NativeMissileHost) {}

  setAttributes(attributes: NativeMissileAttributes): void { this.attributes = { ...attributes }; }

  /** Synchronize before an AI fire event without advancing preparation twice. */
  setClock(now: number): void { this.now = now; }

  /** Only waiting, live, non-exempt bullets count. Preparing/in-flight bullets
   * do not occupy the native MaxMissileCount capacity. */
  get waitingCount(): number {
    let count = 0;
    for (const list of this.waiting.values()) for (const bullet of list)
      if (!bullet.ignoreCapacity && !this.host.dead(bullet.uid)) count++;
    return count;
  }

  /** Native GetWaitCountByWeaponID/WaitList.Count = end-start. Unlike capacity,
   * this includes exempt bullets and preserves removal timing of the queue. */
  getWaitCountByWeaponID(weaponId: number): number { return this.waiting.get(weaponId)?.length ?? 0; }
  get totalWaitCount(): number {
    let count = 0;
    for (const list of this.waiting.values()) count += list.length;
    return count;
  }

  /** Action250 uses this component's stored/preparation path with its original
   * WeaponID. It is a real CreateOneSword, not an independently fired bullet. */
  createStored(weaponId: number, ignoreCapacity = false): number | undefined {
    return this.createOne(weaponId, ignoreCapacity);
  }

  private createOne(weaponId: number, ignoreCapacity = false, attrs?: Readonly<Record<string, number>>): number | undefined {
    const max = Math.trunc(this.attributes.maxMissileCount)
      * (1 + Math.trunc(this.attributes.allMissileConsecutiveCount ?? 0));
    if (!ignoreCapacity && this.waitingCount >= (max > 0 ? max : 99)) return undefined;
    const owner = this.host.owner();
    const uid = this.host.emit(weaponId, owner, owner.yawDegrees, {
      familyEntityId: this.host.familyEntityId ?? 200041, held: true, ignoreCapacity,
    });
    if (uid === undefined) return undefined;
    if (attrs) this.host.mergeAttributes?.(uid, attrs);
    let list = this.waiting.get(weaponId);
    if (!list) this.waiting.set(weaponId, list = []);
    list.push({ uid, ignoreCapacity });
    this.updateWaitingPoses();
    return uid;
  }

  /** Call at the real AI fire event. Action 8 selects weaponId for subsequent
   * rounds; already waiting bullets preserve their own original weapon IDs.
   * Boost extra bullets bypass capacity and never count towards it. */
  createRound(attributes: NativeMissileAttributes, weaponId: number,
    boost?: { extraCount: number; attrs: Readonly<Record<string, number>> } | ((successfulInitialCount: number) => { extraCount: number; attrs: Readonly<Record<string, number>> } | undefined)): number[] {
    this.setAttributes(attributes);
    const made: number[] = [];
    for (const request of nativeMissileCreationPlan(attributes)) {
      if (request.delay > 0) {
        this.pending.push({ at: this.now + request.delay, weaponId });
      } else {
        const uid = this.createOne(weaponId);
        if (uid !== undefined) made.push(uid);
      }
    }
    const currentBoost = typeof boost === 'function' ? boost(made.length) : boost;
    if (currentBoost && currentBoost.extraCount > 0) {
      for (const uid of made) this.host.mergeAttributes?.(uid, currentBoost.attrs);
      for (let i = 0; i < Math.trunc(currentBoost.extraCount); i++) this.createOne(weaponId, true, currentBoost.attrs);
    }
    return made;
  }

  private updateWaitingPoses(): void {
    const owner = this.host.owner();
    const yaw = owner.yawDegrees * DEG;
    for (const list of this.waiting.values()) {
      const step = list.length >= 13 ? Math.max(360 / list.length, 5) : 30;
      const initial = 270 - (list.length - 1) * step * 0.5;
      let index = 0;
      for (const item of list) {
        if (this.host.dead(item.uid)) continue;
        const angle = (initial + index++ * step) * DEG;
        const x = 2 * Math.cos(angle), z = 2 * Math.sin(angle);
        this.host.pose(item.uid, {
          x: owner.x + x * Math.cos(yaw) + z * Math.sin(yaw),
          z: owner.z - x * Math.sin(yaw) + z * Math.cos(yaw),
        }, owner.yawDegrees);
      }
    }
  }

  private selectAndPrepare(): void {
    for (const list of this.waiting.values()) {
      if (!list.length || this.now - this.lastPrepareTick < 1311 / 65536) continue;
      const index = this.shift ? list.length - 1 : 0;
      const item = list[index];
      const bullet = this.host.get(item.uid);
      if (!bullet || this.host.dead(item.uid)) { list.splice(index, 1); continue; }
      const target = this.host.selectForwardTarget(99);
      if (!target) continue;
      list.splice(index, 1);
      const owner = this.host.owner(), yaw = owner.yawDegrees * DEG;
      const left = !this.shift;
      const distance = (2 + this.host.random() * 2.5) * (left ? -1 : 1);
      const end = { x: owner.x + Math.cos(yaw) * distance, z: owner.z - Math.sin(yaw) * distance };
      this.shift = !this.shift;
      this.host.target(item.uid, target.uid);
      this.preparing.push({ uid: item.uid, elapsed: 0, start: { ...bullet.position },
        end, targetUid: target.uid, lastTarget: { ...target.position }, left, forwardUp: Math.cos(yaw) > 0 });
      this.host.prepareSound?.();
      this.lastPrepareTick = this.now;
    }
  }

  update(deltaTime: number, now: number): void {
    this.now = now;
    for (let i = 0; i < this.pending.length;) {
      const next = this.pending[i];
      if (next.at > now) { i++; continue; }
      this.pending.splice(i, 1);
      this.createOne(next.weaponId);
    }
    this.selectAndPrepare();
    for (let i = this.preparing.length - 1; i >= 0; i--) {
      const item = this.preparing[i], bullet = this.host.get(item.uid);
      if (!bullet || this.host.dead(item.uid)) { this.preparing.splice(i, 1); continue; }
      item.elapsed += deltaTime;
      const t = clamp01(item.elapsed / 0.5), eased = nativeMissilePrepareCurve(t);
      const radius = Math.hypot(item.end.x - item.start.x, item.end.z - item.start.z) * 0.5;
      const startAngle = item.forwardUp ? (item.left ? 0 : -Math.PI) : (item.left ? Math.PI : 0);
      const endAngle = item.forwardUp ? (item.left ? -Math.PI : 0) : (item.left ? 0 : Math.PI);
      const angle = startAngle + (endAngle - startAngle) * eased;
      const position = { x: (item.start.x + item.end.x) * 0.5 + Math.cos(angle) * radius,
        z: (item.start.z + item.end.z) * 0.5 + Math.sin(angle) * radius };
      item.lastTarget = this.host.targetPosition(item.targetUid) ?? item.lastTarget;
      const desired = Math.atan2(item.lastTarget.x - position.x, item.lastTarget.z - position.z) / DEG;
      const turn = ((desired - bullet.yawDegrees + 540) % 360) - 180;
      const maxTurn = bullet.rotateSpeed * deltaTime;
      const yaw = bullet.yawDegrees + Math.max(-maxTurn, Math.min(maxTurn, turn));
      this.host.pose(item.uid, position, yaw);
      if (t >= 1) {
        this.host.hold(item.uid, false);
        this.host.launched(item.uid);
        this.preparing.splice(i, 1);
      }
    }
    this.updateWaitingPoses();
  }

  clear(): void {
    for (const list of this.waiting.values()) for (const item of list) this.host.kill(item.uid);
    for (const item of this.preparing) this.host.kill(item.uid);
    this.waiting.clear(); this.preparing.length = 0; this.pending.length = 0;
    this.now = 0; this.lastPrepareTick = 0; this.shift = false;
  }
}

/** Action88 / SplitNewMissile 0x6b87ce4. Pass live, chooseable, opposite-camp
 * enemies in camera bounds in EntityManager order. It does NOT shuffle/select
 * nearest enemies and does not exclude the enemy that caused the hit event.
 * Direct children start two units along their direction, bypassing FlySword.
 */
export function nativeSplitMissilePlan(options: {
  origin: Point; weaponId: number; count: number; bulletTrait: number;
  bulletTraitSplitCount?: number; availableEnemies: readonly Point[];
}): Array<{ weaponId: number; origin: Point; yawDegrees: number; flags: number }> {
  const configuredCount = Math.trunc(options.count);
  const count = configuredCount + ((options.bulletTrait & 16) ? Math.trunc(options.bulletTraitSplitCount ?? 0) : 0);
  const enemies = options.availableEnemies;
  const result: Array<{ weaponId: number; origin: Point; yawDegrees: number; flags: number }> = [];
  for (let i = 0; i < count; i++) {
    let yaw: number;
    if (!enemies.length) yaw = configuredCount ? 360 / configuredCount * i : 0;
    else {
      const target = enemies[i < enemies.length ? i : 0];
      yaw = Math.atan2(target.x - options.origin.x, target.z - options.origin.z) / DEG;
      // Native rotates the x/z direction with x'=x*cos-z*sin. Its overflow
      // divisor uses configured Count, before the BulletTraitSplitCount bonus.
      if (i >= enemies.length) {
        const divisor = configuredCount - enemies.length + 1;
        if (divisor) yaw -= 360 / divisor * (i - enemies.length + 1);
      }
    }
    result.push({ weaponId: options.weaponId,
      origin: { x: options.origin.x + Math.sin(yaw * DEG) * 2,
        z: options.origin.z + Math.cos(yaw * DEG) * 2 }, yawDegrees: yaw, flags: 0x6c8 });
  }
  return result;
}
