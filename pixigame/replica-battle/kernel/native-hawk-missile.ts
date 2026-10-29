import { nativeMissilePrepareCurve } from './native-missile';
import type { NativeAnyWeaponBulletModification } from './plane-special-actions';
import type { NativeRecord } from './weapon-skill-runtime';
import type { NativeWeaponPoint } from './weapon-runtime-extensions';

type Point = NativeWeaponPoint;
export interface NativeHawkMissileHost {
  familyEntityId: number;
  owner(): Point & { yawDegrees: number; alive: boolean };
  /** Original WeaponPreFire/WeaponFire happens NOW at creation, with flags0x6c0.
   * Return its bullet with trajectory/mod updates held. Do not emit WeaponFire
   * a second time when released after preparation. */
  emit(weaponId: number, origin: Point, yawDegrees: number, options: {
    familyEntityId: number; held: true; flags: number;
  }): number | undefined;
  get(uid: number): { position: Point; yawDegrees: number; rotateSpeed: number } | undefined;
  pose(uid: number, position: Point, yawDegrees: number): void;
  dead(uid: number): boolean;
  kill(uid: number): void;
  /** Enable native Follow/Explosion/etc mods and release the held trajectory.
   * This is EnableMod, not an extra original WeaponFire event. */
  release(uid: number): void;
  selectForwardTarget(range: number): { uid: number; position: Point } | undefined;
  target(uid: number, targetUid: number): void;
  targetPosition(targetUid: number): Point | undefined;
  random(): number;
  modification(weaponId: number): NativeAnyWeaponBulletModification | undefined;
  /** Original sound270014, played when a missile leaves its wait row. */
  prepareSound?(soundId: number): void;
  trail?(uid: number, enabled: boolean): void;
}

type Action = { weaponId: number; bulletCount: number; fireInterval: number; nextAt: number; active: boolean; pending: Array<{ at: number; remaining: number }> };
type Preparing = { uid: number; elapsed: number; start: Point; end: Point; targetUid: number; lastTarget: Point; left: boolean; forwardUp: boolean };
const DEG = Math.PI / 180;
const FIRE_INTERVAL = 1311 / 65536;
const CONSECUTIVE_INTERVAL = 0x3333 / 65536;

/** Original CharacterComponentHawkMissile + action162. Independent of the
 * ordinary missile's grouped/capacity-exempt queue. Evidence and limits:
 * research/plane-special-hawk-runtime.json. Call once per original logic step.
 * The owner host must hold waiting/preparing bullets against movement, aging,
 * ordinary collisions and mods, then retain FollowMod after release. */
export class NativeHawkMissileRuntime {
  private actions = new Map<string, Action>();
  private waiting: number[] = [];
  private preparing: Preparing[] = [];
  private weaponId = 120007;
  private lastPrepareTick = 0;
  private shift = false;
  constructor(private readonly host: NativeHawkMissileHost) {}

  install(sourceKey: string, args: NativeRecord, now: number): void {
    if (this.actions.has(sourceKey)) return;
    this.weaponId = Number(args.WeaponId);
    this.actions.set(sourceKey, { weaponId: this.weaponId, bulletCount: Math.trunc(Number(args.BulletCount)),
      fireInterval: Number(args.FireInterval), nextAt: now, active: false, pending: [] });
  }

  /** Native OnExecute clears old consecutive tasks, changes the component's
   * weapon, sets active, and schedules first firing for the current battle time. */
  execute(sourceKey: string, args: NativeRecord, now: number): void {
    this.install(sourceKey, args, now);
    const action = this.actions.get(sourceKey)!;
    this.weaponId = action.weaponId; action.pending.length = 0;
    action.active = true; action.nextAt = now;
  }

  get waitingCount(): number { return this.waiting.length; }
  get preparingCount(): number { return this.preparing.length; }

  private createOne(): number | undefined {
    // Original Count=end-start, including stale entries until their normal pop.
    if (this.waiting.length >= 99) return undefined;
    const owner = this.host.owner();
    const count = this.waiting.length + 1, step = this.intervalAngle(count);
    // Native repositions the existing live entries before WeaponFire. Dead
    // queue entries still affect centering but do not consume a visual slot.
    const liveCount = this.updateWaitingPoses(count);
    const angle = (270 - (count - 1) * step * 0.5 + liveCount * step) * DEG;
    const local = { x: 2 * Math.cos(angle), z: 2 * Math.sin(angle) };
    const yaw = owner.yawDegrees * DEG;
    const origin = { x: owner.x + local.x * Math.cos(yaw) + local.z * Math.sin(yaw),
      z: owner.z - local.x * Math.sin(yaw) + local.z * Math.cos(yaw) };
    const uid = this.host.emit(this.weaponId, origin, owner.yawDegrees, {
      familyEntityId: this.host.familyEntityId, held: true, flags: 0x6c0,
    });
    if (uid !== undefined) { this.host.trail?.(uid, false); this.waiting.push(uid); }
    return uid;
  }

  private fireRound(action: Action, now: number): void {
    const modification = this.host.modification(action.weaponId);
    const count = action.bulletCount + (modification?.DeltaBulletCount ?? 0);
    const consecutive = modification?.ContinueHawkMissileCount ?? 0;
    for (let i = 0; i < count; i++) {
      this.createOne();
      if (consecutive > 0) action.pending.push({ at: now + CONSECUTIVE_INTERVAL, remaining: consecutive });
    }
  }

  update(deltaTime: number, now: number): void {
    if (!this.host.owner().alive) return;
    for (const action of this.actions.values()) {
      if (!action.active) continue;
      // Original Parallel<Sequence<Wait,DoEvent>> runs before the main timer.
      for (let i = 0; i < action.pending.length;) {
        const task = action.pending[i];
        if (task.at > now) { i++; continue; }
        this.createOne();
        if (--task.remaining > 0) { task.at = now + CONSECUTIVE_INTERVAL; i++; }
        else action.pending.splice(i, 1);
      }
      if (now >= action.nextAt) {
        this.fireRound(action, now);
        action.nextAt = now + action.fireInterval + (this.host.modification(action.weaponId)?.DeltaFireInterval ?? 0);
      }
    }
    this.selectAndPrepare(now);
    this.updatePreparing(deltaTime);
    this.updateWaitingPoses();
  }

  private intervalAngle(count: number): number {
    return count >= 13 ? Math.max(Math.floor((360 * 65536) / count) / 65536, 5) : 30;
  }

  private updateWaitingPoses(count = this.waiting.length): number {
    const step = this.intervalAngle(count), owner = this.host.owner();
    const initial = 270 - (count - 1) * step * 0.5, yaw = owner.yawDegrees * DEG;
    let liveIndex = 0;
    for (const uid of this.waiting) {
      if (this.host.dead(uid)) continue;
      const angle = (initial + liveIndex++ * step) * DEG;
      const x = 2 * Math.cos(angle), z = 2 * Math.sin(angle);
      this.host.pose(uid, { x: owner.x + x * Math.cos(yaw) + z * Math.sin(yaw),
        z: owner.z - x * Math.sin(yaw) + z * Math.cos(yaw) }, owner.yawDegrees);
    }
    return liveIndex;
  }

  private selectAndPrepare(now: number): void {
    if (!this.waiting.length || now - this.lastPrepareTick < FIRE_INTERVAL) return;
    const index = this.shift ? this.waiting.length - 1 : 0, uid = this.waiting[index];
    const bullet = this.host.get(uid);
    if (!bullet || this.host.dead(uid)) { this.waiting.splice(index, 1); return; }
    const target = this.host.selectForwardTarget(99);
    if (!target) return;
    this.waiting.splice(index, 1);
    const owner = this.host.owner(), yaw = owner.yawDegrees * DEG, left = !this.shift;
    const distance = (2 + this.host.random() * 2.5) * (left ? -1 : 1);
    const end = { x: owner.x + Math.cos(yaw) * distance, z: owner.z - Math.sin(yaw) * distance };
    this.shift = !this.shift;
    this.host.target(uid, target.uid); this.host.trail?.(uid, true);
    this.preparing.push({ uid, elapsed: 0, start: { ...bullet.position }, end,
      targetUid: target.uid, lastTarget: { ...target.position }, left, forwardUp: Math.cos(yaw) > 0 });
    this.host.prepareSound?.(270014); this.lastPrepareTick = now;
  }

  private updatePreparing(deltaTime: number): void {
    let popCount = 0;
    for (const item of this.preparing) {
      const bullet = this.host.get(item.uid);
      if (!bullet || this.host.dead(item.uid)) { popCount++; continue; }
      item.elapsed += deltaTime;
      const t = Math.min(1, Math.max(0, item.elapsed / 0.5)), eased = nativeMissilePrepareCurve(t);
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
      this.host.pose(item.uid, position, bullet.yawDegrees + Math.max(-maxTurn, Math.min(maxTurn, turn)));
      if (t >= 1) { this.host.release(item.uid); popCount++; }
    }
    // Native preparing list pops a prefix after visiting every entry.
    if (popCount) this.preparing.splice(0, popCount);
  }

  remove(sourceKey: string): void { this.actions.delete(sourceKey); }
  clear(): void {
    for (const uid of this.waiting) this.host.kill(uid);
    for (const item of this.preparing) this.host.kill(item.uid);
    this.actions.clear(); this.waiting.length = 0; this.preparing.length = 0;
    this.weaponId = 120007; this.lastPrepareTick = 0; this.shift = false;
  }
}
