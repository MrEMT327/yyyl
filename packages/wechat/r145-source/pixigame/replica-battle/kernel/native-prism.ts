export type NativePrismPoint = { x: number; z: number };
export interface NativePrismParams {
  SideLaserWeaponId: number;
  SideFireInterval?: number;
  SideLaserLifetime?: number;
  SideLaserSpawnOffset?: number;
  SpawnForwardOffset?: number;
  MainLaserWeaponIds?: readonly number[];
  /** Serialized but not read by the recovered processor. Collision uses the
   * actual bullet collider and the laser's swept Shape2D, not this radius. */
  PrismRadius?: number;
}
export interface NativePrismState {
  uid: number; position: NativePrismPoint; yawDegrees: number;
  camp: number; alive: boolean; ownerExists: boolean;
}
export interface NativePrismHost {
  prism(): NativePrismState;
  movePrism(position: NativePrismPoint): void;
  /** Native CreateWeaponAndFire uses the prism's owner, world position and
   * fixed world +/-X rotation; set FollowEntityRef/FollowOffset before birth.
   * Return the first live emitted bullet and its effective lifetime. */
  emit(request: {
    weaponId: number; origin: NativePrismPoint; yawDegrees: number;
    followUid: number; followOffset: NativePrismPoint;
  }): { uid: number; lifetime: number } | undefined;
  alive(uid: number): boolean;
  /** ResetLifeTime: update lifetime AND birth time. Must not remove Persistence. */
  refresh(uid: number, lifetime: number): void;
  /** Real OnDie path, including downstream death events. */
  kill(uid: number): void;
}
export interface NativePrismSourceLaser {
  uid: number; weaponId: number; camp: number; alive: boolean;
}

/** Static ARM64 evidence: params ctor 6d35b0c; processor init 6d36b44,
 * update 6d37018, pair 6d372b4, emit 6d37464, react 6d366e8.
 * Does NOT invent a lifetime for persistent primary laser 202128.
 * Install once per prism bullet; host preserves Persistent+CheckOutMap.
 * Host only calls react for registered five-star receivers after event48. */
export class NativePrismRuntime {
  private initialized = false;
  private disposed = false;
  private waiting = false;
  private nextAt = 0;
  private sides: Array<{ uid: number; lifetime: number }> = [];
  constructor(private readonly params: NativePrismParams, private readonly host: NativePrismHost) {}

  private cooldown(now: number): void {
    this.nextAt = now + Math.max(0, this.params.SideFireInterval ?? 2);
  }
  init(now: number): void {
    if (this.initialized || this.disposed) return;
    this.initialized = true;
    const prism = this.host.prism();
    const radians = prism.yawDegrees * Math.PI / 180;
    const distance = this.params.SpawnForwardOffset ?? 1;
    this.host.movePrism({ x: prism.position.x + Math.sin(radians) * distance,
      z: prism.position.z + Math.cos(radians) * distance });
    this.cooldown(now);
  }
  private active(): boolean { return this.sides.some(side => this.host.alive(side.uid)); }
  update(now: number): void {
    if (!this.initialized || this.disposed) return;
    if (!this.host.prism().alive) { this.dispose(); return; }
    if (this.active()) { this.waiting = true; return; }
    if (this.waiting) { this.waiting = false; this.cooldown(now); }
    if (now >= this.nextAt) this.firePair(now);
  }
  private firePair(now: number): void {
    const prism = this.host.prism();
    if (!prism.ownerExists || this.params.SideLaserWeaponId <= 0) {
      this.cooldown(now); return;
    }
    this.sides = [];
    // Native creates RIGHT first, then LEFT, irrespective of prism rotation.
    for (const direction of [1, -1]) {
      const offset = { x: direction * (this.params.SideLaserSpawnOffset ?? 0), z: 0 };
      const emitted = this.host.emit({ weaponId: this.params.SideLaserWeaponId,
        origin: { x: prism.position.x + offset.x, z: prism.position.z },
        yawDegrees: direction * 90, followUid: prism.uid, followOffset: offset });
      if (!emitted || !this.host.alive(emitted.uid)) continue;
      const override = this.params.SideLaserLifetime ?? 0;
      const lifetime = override > 0 ? override : emitted.lifetime;
      this.sides.push({ uid: emitted.uid, lifetime });
      if (override > 0) this.host.refresh(emitted.uid, override);
    }
    this.waiting = this.active();
    if (!this.waiting) this.cooldown(now);
  }
  /** Call only after the native same-camp collision probe. now is needed when
   * an immediate pair cannot be created, so its retry obeys the native CD. */
  react(source: NativePrismSourceLaser, now: number): boolean {
    if (!this.initialized || this.disposed) return false;
    const prism = this.host.prism();
    if (!prism.alive || !source.alive || source.camp !== prism.camp
      || !this.params.MainLaserWeaponIds?.includes(source.weaponId)) return false;
    if (this.active()) {
      for (const side of this.sides)
        if (side.lifetime > 0 && this.host.alive(side.uid)) this.host.refresh(side.uid, side.lifetime);
    } else this.firePair(now);
    return true;
  }
  /** Invoke on BulletDead event27 and processor deinit. Idempotent even when
   * the emitted sides share a UID; never delete bullets silently. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const uid of new Set(this.sides.map(side => side.uid)))
      if (this.host.alive(uid)) this.host.kill(uid);
    this.sides = [];
    this.waiting = false;
  }
}

export interface NativePrismProbeReceiver {
  uid: number; camp: number; alive: boolean; registered: boolean;
}
/** LaserSameCampBulletCollisionProbe@6d596f0 sweeps the supplied laser Shape2D
 * over EACH consecutive tracker segment. Reuse the host's collision query:
 * exact Shape2D sweep width/scale semantics are deliberately not approximated
 * by a guessed point-distance threshold. Receivers must belong to the source
 * root owner's registration set. Native emits per-hit/per-segment (no dedup). */
export function nativePrismProbeSegments(
  source: NativePrismSourceLaser,
  tracker: readonly NativePrismPoint[],
  sweep: (from: NativePrismPoint, to: NativePrismPoint) => readonly NativePrismProbeReceiver[],
  collision: (receiverUid: number, source: NativePrismSourceLaser) => void,
): number {
  if (!source.alive || tracker.length < 2) return 0;
  let count = 0;
  for (let i = 1; i < tracker.length; i++) {
    for (const receiver of sweep(tracker[i - 1], tracker[i])) {
      if (receiver.uid === source.uid || !receiver.registered || !receiver.alive
        || receiver.camp !== source.camp) continue;
      collision(receiver.uid, source);
      count++;
    }
  }
  return count;
}
