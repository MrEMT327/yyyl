import type { NativeWeaponPoint } from './weapon-runtime-extensions';

export interface NativeThunderHost {
  position(): NativeWeaponPoint;
  owner(): NativeWeaponPoint & { yawDegrees: number };
  pose(point: NativeWeaponPoint): void;
  targetUid(): number | undefined;
  /** Native EntityBullet.IsEntityCanHit: use flags/camp/alive, not overlap. */
  canHit(uid: number): boolean;
  /** Direct Character.OnHit at its current position; do not invoke the ordinary
   * trajectory's pierce counter, overlap, or hit-death path. */
  hit(uid: number): void;
  targetAlive(uid: number): boolean;
  hasCheckAddBuff(): boolean;
  addBuffToTarget(uid: number): void;
  /** Native emits the presentation request before resolving the target. */
  render?(targetUid: number | undefined, startUid: number | undefined): void;
}

/** ThunderTrajectoryModProcessor 6dae964 / 6daec54 / 6daedf8.
 * Host keeps configured lifetime and disables generic collision/movement.
 * Call tickHit only when the generic trajectory's first hit check is eligible;
 * it is one attempt, even if target disappeared before the first check. */
export class NativeThunderRuntime {
  private firstCheck = true;
  private readonly localOffset: NativeWeaponPoint;
  constructor(private readonly host: NativeThunderHost,
    private readonly useFirePos = 0, private readonly startUid?: number) {
    const owner = host.owner(), position = host.position();
    const yaw = owner.yawDegrees * Math.PI / 180;
    const dx = position.x - owner.x, dz = position.z - owner.z;
    this.localOffset = { x: dx * Math.cos(yaw) - dz * Math.sin(yaw),
      z: dx * Math.sin(yaw) + dz * Math.cos(yaw) };
  }

  step(): void {
    if (this.useFirePos <= 0) return;
    const owner = this.host.owner(), yaw = owner.yawDegrees * Math.PI / 180;
    this.host.pose({
      x: owner.x + this.localOffset.x * Math.cos(yaw) + this.localOffset.z * Math.sin(yaw),
      z: owner.z - this.localOffset.x * Math.sin(yaw) + this.localOffset.z * Math.cos(yaw),
    });
  }

  tickHit(): void {
    if (!this.firstCheck) return;
    this.firstCheck = false;
    const uid = this.host.targetUid();
    this.host.render?.(uid, this.useFirePos > 0 ? undefined : this.startUid);
    if (uid === undefined || !this.host.canHit(uid)) return;
    this.host.hit(uid);
    if (this.host.targetAlive(uid) && this.host.hasCheckAddBuff()) this.host.addBuffToTarget(uid);
  }
}
