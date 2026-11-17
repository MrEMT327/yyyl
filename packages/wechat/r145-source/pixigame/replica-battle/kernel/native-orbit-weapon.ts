import {
  nativeOrbitAngularSpeed, nativeOrbitCreationPlan, nativeOrbitRadius,
  nativeOrbitRealRadius, nativeOrbitStep,
  type NativeOrbitRadiusState, type NativeWeaponPoint,
} from './weapon-runtime-extensions';

/** Active APK controller: CharacterComponentSecondWeaponRotateBall2, not the
 * older paired-arm RotateBall. Host bullet identities remain alive between ticks
 * so their per-target hit gates and hit-count triggers also remain intact. */
export interface NativeOrbitHost {
  owner(): NativeWeaponPoint;
  create(weaponId: number, position: NativeWeaponPoint): number;
  alive(uid: number): boolean;
  pose(uid: number, position: NativeWeaponPoint, yawDegrees: number): void;
  remove(uid: number): void;
  /** Refresh owner-derived damage/elements and scale from their ORIGINAL base,
   * never multiply the previous tick's values again. Dynamic scale is a separate
   * factor after BulletScale, matching OnRotateBallDynamicScaleUpdate. */
  refresh(uid: number, dynamicScaleMultiplier: number): void;
  /** FireOnceMod children use the orbit bullet's lifetime, not a repeated timer.
   * Create once, then update the same beam from ball to current owner. */
  innerLaserCreate?(weaponId: number, ballUid: number, from: NativeWeaponPoint, to: NativeWeaponPoint): number;
  innerLaserPose?(uid: number, from: NativeWeaponPoint, to: NativeWeaponPoint): void;
  bulletScale?(uid: number): number;
}

export interface NativeOrbitSettings {
  group0Weapons: readonly number[];
  group1Weapons?: readonly number[];
  extraBallCount: number;
  angularSpeed: number;
  angularSpeedPercent: number;
  extraRadius: number;
  dynamicScalePercent: number;
  attackDistanceEventBonus?: number;
}

export interface NativeOrbitBall {
  uid: number;
  weaponId: number;
  index: number;
  group: 0 | 1;
  position: NativeWeaponPoint;
  /** Outward radial yaw, independent of the visual SelfRotationMod. */
  yawDegrees: number;
}

export class NativeOrbitWeaponRuntime {
  private groups: [NativeOrbitBall[], NativeOrbitBall[]] = [[], []];
  private angles: [number, number] = [0, 0];
  private innerLaserWeapon: number | null = null;
  private innerLasers = new Map<number, number>();
  private radiusState: NativeOrbitRadiusState = {
    direction: 0, offset: 0, maxScale: 0, minScale: 0,
    expandDuration: 0, contractDuration: 0,
  };

  constructor(private readonly host: NativeOrbitHost) {}

  get balls(): readonly NativeOrbitBall[] { return [...this.groups[0], ...this.groups[1]]; }

  refreshAttributes(settings: NativeOrbitSettings): void {
    for (const ball of this.balls) if (this.host.alive(ball.uid)) this.host.refresh(ball.uid, 1 + settings.dynamicScalePercent);
  }

  clear(): void {
    for (const uid of this.innerLasers.values()) this.host.remove(uid);
    this.innerLasers.clear(); this.innerLaserWeapon = null;
    for (const ball of this.balls) this.host.remove(ball.uid);
    this.groups = [[], []];
    this.angles = [0, 0];
    this.radiusState = { direction: 0, offset: 0, maxScale: 0, minScale: 0,
      expandDuration: 0, contractDuration: 0 };
  }

  /** TriggerRotateBallDynamicRadius / AddDynamicRadius 0x6aea894. */
  setDynamicRadius(maxScale: number, minScale: number, expandDuration: number, contractDuration: number): void {
    this.radiusState = { direction: 1, offset: 0,
      maxScale: this.radiusState.maxScale + maxScale,
      minScale: this.radiusState.minScale + minScale,
      expandDuration: this.radiusState.expandDuration + expandDuration,
      contractDuration: this.radiusState.contractDuration + contractDuration };
  }

  /** Action 85 / SetInSideLaserData: attach to existing and future balls. */
  setInnerLaser(weaponId: number | null): void {
    if (this.innerLaserWeapon === weaponId) return;
    for (const uid of this.innerLasers.values()) this.host.remove(uid);
    this.innerLasers.clear();
    this.innerLaserWeapon = weaponId;
    this.updateInnerLasers();
  }

  /** Action 184 (ConsumeBall=false on the in-run card): gate on an actual live
   * ball, and copy its FINAL scale, replacing the emitted bullet's scale. */
  fireOnOwnerHurt(fire: (scale: number | undefined) => void, syncScale: boolean): boolean {
    const ball = this.balls.find(candidate => this.host.alive(candidate.uid));
    if (!ball) return false;
    fire(syncScale ? this.host.bulletScale?.(ball.uid) : undefined);
    return true;
  }

  private updateInnerLasers(): void {
    const liveBalls = new Set(this.balls.filter(ball => this.host.alive(ball.uid)).map(ball => ball.uid));
    for (const [ballUid, laserUid] of this.innerLasers) {
      if (!liveBalls.has(ballUid)) { this.host.remove(laserUid); this.innerLasers.delete(ballUid); }
    }
    if (this.innerLaserWeapon == null) return;
    for (const ball of this.balls) {
      if (!liveBalls.has(ball.uid)) continue;
      let uid = this.innerLasers.get(ball.uid);
      if (uid == null && this.host.innerLaserCreate) {
        uid = this.host.innerLaserCreate(this.innerLaserWeapon, ball.uid, ball.position, this.host.owner());
        this.innerLasers.set(ball.uid, uid);
      }
      if (uid != null && this.host.alive(uid)) this.host.innerLaserPose?.(uid, ball.position, this.host.owner());
    }
  }

  /** Use once after acquisition and attribute/card changes. The native groups
   * each have capacity 24. Existing balls are retained when their IDs match. */
  reconcile(settings: NativeOrbitSettings): void {
    const plans = [
      nativeOrbitCreationPlan(settings.group0Weapons, settings.extraBallCount),
      nativeOrbitCreationPlan(settings.group1Weapons ?? [], settings.extraBallCount),
    ];
    const owner = this.host.owner();
    for (const group of [0, 1] as const) {
      const wanted = plans[group].slice(0, 24);
      const old = this.groups[group];
      for (let i = old.length - 1; i >= 0; i--) {
        if (i >= wanted.length || old[i].weaponId !== wanted[i] || !this.host.alive(old[i].uid)) {
          this.host.remove(old[i].uid);
          old.splice(i, 1);
        }
      }
      for (let i = 0; i < wanted.length; i++) {
        if (old[i]?.weaponId === wanted[i]) continue;
        const radius = nativeOrbitRadius(group, settings.extraRadius);
        const theta = (this.angles[group] + i * 360 / wanted.length) * Math.PI / 180;
        const position = { x: owner.x + Math.cos(theta) * radius, z: owner.z + Math.sin(theta) * radius };
        old.splice(i, 0, { uid: this.host.create(wanted[i], position), weaponId: wanted[i],
          group, index: i, position, yawDegrees: 90 - theta * 180 / Math.PI });
      }
      old.forEach((ball, index) => { ball.index = index; });
      for (const ball of old) this.host.refresh(ball.uid, 1 + settings.dynamicScalePercent);
    }
    this.updateInnerLasers();
  }

  /** Native radius state is shared and advances once for EACH nonempty group,
   * in group order. Do not normalize it to one update per frame. */
  step(deltaTime: number, settings: NativeOrbitSettings): void {
    const owner = this.host.owner();
    for (const group of [0, 1] as const) {
      const balls = this.groups[group];
      if (!balls.length) continue;
      const radius = nativeOrbitRealRadius(nativeOrbitRadius(group, settings.extraRadius),
        deltaTime, this.radiusState, settings.attackDistanceEventBonus ?? 0);
      const motion = nativeOrbitStep({ owner, angleDegrees: this.angles[group],
        angularSpeed: nativeOrbitAngularSpeed(settings.angularSpeed, settings.angularSpeedPercent, group),
        deltaTime, radius, sets: balls.map(ball => ({ index: ball.index, bulletId: ball.uid })) });
      this.angles[group] = motion.angleDegrees;
      for (let index = 0; index < balls.length; index++) {
        const ball = balls[index];
        if (!this.host.alive(ball.uid)) continue;
        const position = motion.positions[index];
        ball.position = { x: position.x, z: position.z };
        ball.yawDegrees = Math.atan2(position.x - owner.x, position.z - owner.z) * 180 / Math.PI;
        this.host.pose(ball.uid, ball.position, ball.yawDegrees);
      }
    }
    this.updateInnerLasers();
  }
}
