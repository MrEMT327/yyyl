import { nativeMissilePrepareCurve, type NativeMissileHost } from './native-missile';

type Point = { x: number; z: number };
type Preparing = { uid: number; elapsed: number; start: Point; end: Point;
  targetUid: number; lastTarget: Point; left: boolean; forwardUp: boolean };
const DEG = Math.PI / 180;

/** Original normal/equipment airdrops share the same non-laser controller. */
export function nativeDropMissileWeaponSupported(id: number): boolean { return [110001, 400043, 400044].includes(id); }

/** CharacterComponentDropItemMissile, verified normal and equipment paths.
 * Separate state from FlySword. See research/missile-airdrop-integration.md.
 * Host disables mods while held; release enables them without firing again.
 */
export class NativeDropMissileRuntime {
  private weaponId = 0;
  private count = 0;
  private waiting: number[] = [];
  private preparing: Preparing[] = [];
  private lastPrepareTick = 0;
  private shift = false;
  constructor(private readonly host: NativeMissileHost) {}
  get waitingCount() { return this.waiting.length; }
  get preparingCount() { return this.preparing.length; }
  configure(weaponId: number, count: number) {
    if (weaponId <= 0) return;
    if (!nativeDropMissileWeaponSupported(weaponId)) throw new Error(`Unverified drop missile weapon ${weaponId}`);
    this.weaponId = weaponId;
    this.count = Math.trunc(count); // Action39 overwrites, never accumulates.
  }
  /** Action40 ignores its own Count; uses the count last assigned by action39. */
  collect() {
    if (!this.weaponId) return;
    for (let i = 0; i < this.count && this.waiting.length < 99; i++) {
      const owner = this.host.owner();
      const uid = this.host.emit(this.weaponId, owner, owner.yawDegrees,
        { familyEntityId: this.host.familyEntityId!, held: true, ignoreCapacity: false });
      if (uid !== undefined) this.waiting.push(uid);
    }
    this.positionWaiting();
  }
  private positionWaiting() {
    const owner = this.host.owner(), yaw = owner.yawDegrees * DEG;
    const step = this.waiting.length >= 13 ? Math.max(360 / this.waiting.length, 5) : 30;
    const initial = 270 - (this.waiting.length - 1) * step / 2;
    let index = 0;
    for (const uid of this.waiting) {
      if (this.host.dead(uid)) continue;
      const angle = (initial + index++ * step) * DEG, x = 2 * Math.cos(angle), z = 2 * Math.sin(angle);
      this.host.pose(uid, { x: owner.x + x * Math.cos(yaw) + z * Math.sin(yaw),
        z: owner.z - x * Math.sin(yaw) + z * Math.cos(yaw) }, owner.yawDegrees);
    }
  }
  update(dt: number, now: number) {
    if (this.waiting.length && now - this.lastPrepareTick >= 1311 / 65536) {
      const index = this.shift ? this.waiting.length - 1 : 0, uid = this.waiting[index];
      const bullet = this.host.get(uid);
      if (!bullet || this.host.dead(uid)) this.waiting.splice(index, 1);
      else {
        const target = this.host.selectForwardTarget(99);
        if (target) {
          this.waiting.splice(index, 1);
          const owner = this.host.owner(), yaw = owner.yawDegrees * DEG, left = !this.shift;
          const distance = (2 + this.host.random() * 2.5) * (left ? -1 : 1);
          this.preparing.push({ uid, elapsed: 0, start: { ...bullet.position },
            end: { x: owner.x + Math.cos(yaw) * distance, z: owner.z - Math.sin(yaw) * distance },
            targetUid: target.uid, lastTarget: { ...target.position }, left, forwardUp: Math.cos(yaw) > 0 });
          this.host.target(uid, target.uid);
          this.shift = !this.shift; this.lastPrepareTick = now;
          this.host.prepareSound?.();
        }
      }
    }
    for (let i = this.preparing.length - 1; i >= 0; i--) {
      const item = this.preparing[i], bullet = this.host.get(item.uid);
      if (!bullet || this.host.dead(item.uid)) { this.preparing.splice(i, 1); continue; }
      item.elapsed += dt;
      const t = Math.min(1, item.elapsed / .5), eased = nativeMissilePrepareCurve(t);
      const radius = Math.hypot(item.end.x - item.start.x, item.end.z - item.start.z) / 2;
      const a = item.forwardUp ? (item.left ? 0 : -Math.PI) : (item.left ? Math.PI : 0);
      const b = item.forwardUp ? (item.left ? -Math.PI : 0) : (item.left ? 0 : Math.PI);
      const angle = a + (b - a) * eased;
      const position = { x: (item.start.x + item.end.x) / 2 + Math.cos(angle) * radius,
        z: (item.start.z + item.end.z) / 2 + Math.sin(angle) * radius };
      item.lastTarget = this.host.targetPosition(item.targetUid) ?? item.lastTarget;
      const desired = Math.atan2(item.lastTarget.x - position.x, item.lastTarget.z - position.z) / DEG;
      const turn = ((desired - bullet.yawDegrees + 540) % 360) - 180, maxTurn = bullet.rotateSpeed * dt;
      this.host.pose(item.uid, position, bullet.yawDegrees + Math.max(-maxTurn, Math.min(maxTurn, turn)));
      if (t >= 1) {
        this.host.hold(item.uid, false);
        this.host.launched(item.uid);
        this.preparing.splice(i, 1);
      }
    }
    this.positionWaiting();
  }
  clear() {
    for (const uid of this.waiting) this.host.kill(uid);
    for (const item of this.preparing) this.host.kill(item.uid);
    this.waiting = []; this.preparing = []; this.lastPrepareTick = 0; this.shift = false;
    this.weaponId = this.count = 0;
  }
}
