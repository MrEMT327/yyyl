import type { NativeWeaponPoint } from './weapon-runtime-extensions';
import { NativeSpecialCircularSlashCounter, type NativeCircularSlashStamp } from './loadout-special-attributes';

export interface NativeSwordTarget extends NativeWeaponPoint {
  uid: number;
  bossElite?: boolean;
  /** ECharacterState. None/Born/Death/Leave (0/1/6/8) are excluded. */
  aiState?: number;
  /** EntitySelect.GetEntityDistance, when collider-aware distance is available. */
  distance?: number;
}
export interface NativeSwordSettings {
  weaponId?: number;
  maxSwords: number;
  swordLength: number;
  angularSpeed: number;
  totalAngle: number;
  swingIntervalMultiplier: number;
  noSwingInterval?: boolean;
  reverseRate: number;
  bossEliteReverseRate: number;
  localAngularSpeedPercent?: number;
  reverseLengthPercent: number;
}
export interface NativeSwordHost {
  owner(): NativeWeaponPoint;
  ownerYaw(): number;
  settings(): NativeSwordSettings;
  targets(): readonly NativeSwordTarget[];
  random(): number;
  create(weaponId: number, position: NativeWeaponPoint): number;
  alive(uid: number): boolean;
  pose(uid: number, position: NativeWeaponPoint, yawDegrees: number): void;
  /** Stored swords have neither trajectory nor collision; a reverse wait also
   * disables collision. Native SemiCircleMov2.TickHit runs only in Moving. */
  active(uid: number, active: boolean): void;
  /** Native SetCurSwordShape: box half extents, then local X offset. */
  shape(uid: number, halfWidth: number, halfHeight: number, widthOffset: number): void;
  kill(uid: number): void;
  /** Original StampCircularSlash merges these native fraction attributes into
   * this stored bullet. Persist its bool separately for EventAttrEffect.Hit. */
  stampCircularSlash?(uid: number, stamp: Readonly<NativeCircularSlashStamp>): void;
  onStore?(uid: number): void;
  onConsume?(uid: number, targetUid: number): void;
  /** Original PlayCurveSwordEffect presentation message; no damage or RNG. */
  onSwing?(swing: { uid: number; position: NativeWeaponPoint; direction: NativeWeaponPoint; clockwise: boolean; radius: number; simulationSpeed: number; circular: boolean }): void;
  /** Event 21 occurs at HALF the sweep, including the reverse sweep.
   * eventPosition is the cached target position, not the current sword tip. */
  onHalf?(uid: number, targetUid: number, eventPosition: NativeWeaponPoint): void;
}
interface WaitingSword { uid: number; angle: number }
interface MovingSword {
  uid: number; targetUid: number; center: NativeWeaponPoint; target: NativeWeaponPoint;
  targetLine: NativeWeaponPoint; clockwise: boolean; angle: number; totalAngle: number;
  speed: number; length: number; radius: number; halfSent: boolean;
  reverses: number; reversed: boolean; wait: number | null; circular: boolean;
}
const DEG = Math.PI / 180;
const rotate = (v: NativeWeaponPoint, degrees: number): NativeWeaponPoint => {
  const c = Math.cos(degrees * DEG), s = Math.sin(degrees * DEG);
  return { x: v.x * c - v.z * s, z: v.x * s + v.z * c };
};
const add = (a: NativeWeaponPoint, b: NativeWeaponPoint, scale: number): NativeWeaponPoint =>
  ({ x: a.x + b.x * scale, z: a.z + b.z * scale });

/** Attribute values are native units: percentages are fractions; mergeType 2
 * reductions are already resolved multipliers. Missing global defaults belong
 * in the caller's attribute resolver, not in tuning constants here. */
export function nativeSwordSettings(attribute: (name: string) => number,
  trajectory: { AngularSpeed: number }, attackDistanceEventBonus = 0): NativeSwordSettings {
  return {
    maxSwords: Math.trunc(attribute('AllMaxCurveSword')) + Math.trunc(attribute('MaxCurveSword')),
    // GetSwordLength 0x6be1c60 does NOT consume flat CurveSwordLength (347).
    swordLength: attribute('AllCurveSwordLength') *
      (1 + attribute('AllSkillRange%') + attribute('CurveSwordLength%')) * (1 + attackDistanceEventBonus),
    angularSpeed: trajectory.AngularSpeed *
      (1 + attribute('AllCurveSwordAngularSpeed%') + attribute('CurveSwordAngularSpeed%')),
    totalAngle: attribute('AllCurveSwordTotalAngle') + attribute('CurveSwordTotalAngle'),
    swingIntervalMultiplier: attribute('CurveSwordSwingIntervalReduce%'),
    reverseRate: attribute('AllCurveSwordReverseRate%'),
    bossEliteReverseRate: attribute('CurveSwordReverseRate4BossElite%'),
    reverseLengthPercent: attribute('CurveSwordReverseLength%'),
    localAngularSpeedPercent: attribute('CurveSwordAngularSpeed%'),
  };
}

/** CharacterComponentCurveSword + SemiCircleMov2Processor. Stored swords are
 * persistent entities; native AI creates ONE per fire round. There is no
 * generic spread or guessed periodic radial emission. */
export class NativeCurveSwordRuntime {
  private waiting: WaitingSword[] = [];
  private moving: MovingSword[] = [];
  private shift = false;
  private lastPrepare = 0;
  private pickupLast = 0;
  private circularCounter = new NativeSpecialCircularSlashCounter();
  private circularStamps = new Map<number, NativeCircularSlashStamp>();
  constructor(private readonly host: NativeSwordHost) {}
  get waitingCount(): number { return this.waiting.length; }
  get activeCount(): number { return this.moving.length; }

  /** Action218 OnInit; original Configure resets its creation counter. Existing
   * stamped bullets keep their own metadata when configuration changes. */
  setCircularSlashConfig(config: { everySlashCount: number; rangeAddPercent: number; attributes: Readonly<Record<string, number>> } | undefined): void {
    if (config) this.circularCounter.configure(config.everySlashCount, config.rangeAddPercent, config.attributes);
    else this.circularCounter.clear();
  }
  circularSlash(uid: number): Readonly<NativeCircularSlashStamp> | undefined { return this.circularStamps.get(uid); }

  /** AISecondWeaponCurveSword only: successful creation ticks the original218
   * IntervalTrigger. Pickup-created swords do not tick/stamp this AI counter. */
  storeAiSword(): number | null { return this.storeSword(true); }

  clear(): void {
    for (const sword of [...this.waiting, ...this.moving]) this.host.kill(sword.uid);
    this.waiting = []; this.moving = []; this.shift = false;
    this.lastPrepare = 0; this.pickupLast = 0;
    this.circularCounter.clear(); this.circularStamps.clear();
  }

  storeSword(tickCircularSlash = false): number | null {
    const s = this.host.settings();
    if (this.waiting.length >= 99 || this.waiting.length >= Math.trunc(s.maxSwords)) return null;
    const uid = this.host.create(s.weaponId ?? 200101, this.host.owner());
    this.host.active(uid, false);
    this.waiting.push({ uid, angle: 0 });
    this.reindex(); this.placeWaiting(); this.host.onStore?.(uid);
    if (tickCircularSlash) {
      const stamp = this.circularCounter.createdSword();
      if (stamp) { this.circularStamps.set(uid, stamp); this.host.stampCircularSlash?.(uid, stamp); }
    }
    return uid;
  }

  /** Action 115: one weighted choice of 1..N swords, with its own success CD.
   * The native RNG samples [0,sum), then compares cumulative weights. */
  createFromPickup(now: number, rates: readonly number[], cd: number): number {
    if (this.pickupLast > 0 && cd > 0 && now - this.pickupLast < cd) return 0;
    const total = rates.reduce((sum, rate) => sum + rate, 0);
    if (total <= 0) return 0;
    const draw = this.host.random() * total;
    let sum = 0, count = 0;
    for (let i = 0; i < rates.length; i++) {
      sum += rates[i];
      if (draw < sum) { count = i + 1; break; }
    }
    for (let i = 0; i < count; i++) this.storeSword();
    if (count > 0) this.pickupLast = now;
    return count;
  }

  private reindex(): void {
    const count = this.waiting.length;
    const step = count <= 12 ? 30 : Math.max(5, 360 / count);
    this.waiting.forEach((sword, i) => { sword.angle = 270 + (i - (count - 1) / 2) * step; });
  }

  private placeWaiting(): void {
    const owner = this.host.owner();
    for (const sword of this.waiting) {
      const angle = sword.angle + this.host.ownerYaw();
      const v = { x: Math.cos(angle * DEG), z: Math.sin(angle * DEG) };
      this.host.pose(sword.uid, add(owner, v, 2), Math.atan2(v.x, v.z) / DEG);
    }
  }

  step(deltaTime: number, now: number): void {
    for (const uid of this.circularStamps.keys()) if (!this.host.alive(uid)) this.circularStamps.delete(uid);
    this.waiting = this.waiting.filter(sword => this.host.alive(sword.uid));
    this.moving = this.moving.filter(sword => this.host.alive(sword.uid));
    const settings = this.host.settings();
    const interval = settings.noSwingInterval ? 0 : (0xb333 / 65536) * settings.swingIntervalMultiplier;
    if (this.waiting.length && now - this.lastPrepare >= interval) {
      const owner = this.host.owner();
      let nearest: NativeSwordTarget | undefined, distance = settings.swordLength + 2;
      for (const target of this.host.targets()) {
        if (target.aiState != null && [0, 1, 6, 8].includes(target.aiState)) continue;
        const d = target.distance ?? Math.hypot(target.x - owner.x, target.z - owner.z);
        if (d < distance) { nearest = target; distance = d; }
      }
      if (nearest) {
        const sword = (this.shift ? this.waiting.pop() : this.waiting.shift())!;
        this.shift = !this.shift;
        this.lastPrepare = now;
        // Native selection consumes a [2,4.5] FP random sample even though the
        // resulting side preparation position is not interpolated (prepare=0).
        this.host.random();
        this.launch(sword.uid, nearest, settings);
      }
    }
    this.placeWaiting();
    for (const sword of [...this.moving]) {
      if (sword.wait != null) {
        sword.wait += deltaTime;
        if (sword.wait < 0xccc / 65536) continue;
        sword.wait = null; sword.clockwise = !sword.clockwise;
        sword.reversed = true; sword.angle = 0; sword.halfSent = false;
        sword.radius = sword.length * (1 + this.host.settings().reverseLengthPercent) + 2;
        this.configureShape(sword);
        this.host.active(sword.uid, true);
        this.presentSwing(sword);
        // Native Wait branch prepares reverse but does not integrate it until
        // the next trajectory update.
        continue;
      }
      sword.angle += Math.abs(sword.speed * deltaTime);
      this.placeMoving(sword, sword.angle >= sword.totalAngle);
      if (!sword.halfSent && sword.angle >= sword.totalAngle / 2) {
        sword.halfSent = true;
        this.host.onHalf?.(sword.uid, sword.targetUid, sword.target);
      }
      if (sword.angle >= sword.totalAngle) {
        sword.reverses--;
        this.host.active(sword.uid, false);
        if (sword.reverses >= 0) sword.wait = 0;
        else {
          this.host.kill(sword.uid);
          this.moving.splice(this.moving.indexOf(sword), 1);
        }
      }
    }
  }

  private launch(uid: number, target: NativeSwordTarget, s: NativeSwordSettings): void {
    const center = { ...this.host.owner() };
    const delta = { x: target.x - center.x, z: target.z - center.z };
    const magnitude = Math.hypot(delta.x, delta.z);
    const reverse = this.host.random() <= s.reverseRate + (target.bossElite ? s.bossEliteReverseRate : 0);
    const circular = this.circularStamps.get(uid);
    // SemiCircleMov2.InitializeMovement first GetSwordLength+1, then the
    // stamped range factor, THEN the original2-unit sword-space radius. The
    // constructor's circleSpeedScale is raw81920=1.25; ordinary swords use1.
    const length = (s.swordLength + 1) * (circular ? 1 + circular.rangeAddPercent : 1);
    const sword: MovingSword = {
      uid, center, targetUid: target.uid, target: { x: target.x, z: target.z },
      targetLine: magnitude ? { x: delta.x / magnitude, z: delta.z / magnitude } : { x: 0, z: 0 },
      clockwise: this.host.random() < .5, angle: 0, totalAngle: circular?.totalAngle ?? s.totalAngle,
      speed: s.angularSpeed * (circular ? 1.25 : 1), length, radius: circular ? length + 2 : s.swordLength + 3,
      halfSent: false, reverses: reverse ? 1 : 0, reversed: false, wait: null, circular: Boolean(circular),
    };
    this.moving.push(sword);
    this.configureShape(sword);
    this.placeMoving(sword, false);
    this.host.active(uid, true);
    this.host.onConsume?.(uid, target.uid);
    this.presentSwing(sword);
  }

  private presentSwing(sword: MovingSword): void {
    // SemiCircleMov2.onStarted/tryReverse: midpoint for an arc, center for a circle.
    const position = add(sword.center, sword.targetLine,
      sword.totalAngle >= 360 ? 0 : sword.radius * Math.cos(sword.totalAngle / 2 * DEG));
    const denominator = 770 * (1 + (this.host.settings().localAngularSpeedPercent || 0));
    this.host.onSwing?.({ uid: sword.uid, position, direction: sword.targetLine,
      clockwise: sword.clockwise, radius: sword.radius, circular: sword.circular,
      simulationSpeed: denominator > 0 ? (0xb5c2 / 65536) * sword.speed / denominator : 0 });
  }

  private configureShape(sword: MovingSword): void {
    const length = sword.radius - 2;
    this.host.shape(sword.uid, length / 2, .5, (sword.clockwise ? 1 : -1) * length / 2);
  }

  private placeMoving(sword: MovingSword, endpoint: boolean): void {
    const sign = sword.clockwise ? 1 : -1;
    const start = rotate(sword.targetLine, sign * sword.totalAngle / 2);
    // InitializeMovement uses RotateVector for mirrorPos, whereas moving uses
    // Quaternion.AngleAxis(up), whose xz convention is the opposite sign.
    const radial = rotate(start, endpoint ? sign * sword.totalAngle : -sign * sword.angle);
    const position = add(sword.center, radial, sword.radius);
    const tangent = { x: sign * radial.z, z: -sign * radial.x };
    this.host.pose(sword.uid, position, Math.atan2(tangent.x, tangent.z) / DEG);
  }
}

/** Action 62 spawns at the event's cached target position and points away from
 * the sword entity's owner. The +/-45-degree directions calculated by native
 * code are unused; there is only ONE CreateWeaponAndFire call. */
export function nativeSwordCompletionShot(owner: NativeWeaponPoint, target: NativeWeaponPoint):
  { origin: NativeWeaponPoint; yawDegrees: number } {
  return { origin: { ...target }, yawDegrees: Math.atan2(target.x - owner.x, target.z - owner.z) / DEG };
}

export interface NativeVoidSlashParams {
  WeaponId: number;
  FireInterval: number;
  Rate: number;
  Range: number;
  Count?: number;
}

/** Action90 native point generation (0x6b27810). In particular, preserve the
 * original three-point midpoint/perpendicular construction and the native
 * 0x6487e fixed-point step for larger counts. Replacing either with an even
 * spread/nearest-enemy chain changes the actual attack coverage. */
export function nativeVoidSlashPoints(start: NativeWeaponPoint, params: NativeVoidSlashParams,
  extraCount: number, random: () => number): NativeWeaponPoint[] {
  const count = (params.Count != null && params.Count > 0 ? params.Count : 3) + Math.trunc(extraCount);
  const points: NativeWeaponPoint[] = [{ ...start }];
  if (count <= 1) return points;
  const angle = Math.floor(random() * 360);
  const min = 3, max = min + params.Range;
  const radius = min + random() * (max - min);
  const at = (degrees: number, distance: number): NativeWeaponPoint => ({
    x: start.x + Math.sin(degrees * DEG) * distance,
    z: start.z + Math.cos(degrees * DEG) * distance,
  });
  if (count === 2) points.push(at(angle, radius));
  else if (count === 3) {
    const second = at(angle, radius);
    points.push(second);
    const midpoint = { x: (start.x + second.x) / 2, z: (start.z + second.z) / 2 };
    const magnitude = Math.hypot(midpoint.x, midpoint.z);
    const thirdRadius = min + random() * (max - min);
    points.push({ x: midpoint.x + (magnitude ? -midpoint.z / magnitude : 0) * thirdRadius,
      z: midpoint.z + (magnitude ? midpoint.x / magnitude : 0) * thirdRadius });
  } else {
    const step = Math.trunc(0x6487e / (count - 1)) / 65536;
    for (let i = 0; i < count - 1; i++) {
      const offset = (random() - .5) * params.Range;
      points.push(at(angle + step * i, Math.max(min, Math.min(max, radius + offset))));
    }
  }
  return points;
}

export interface NativeVoidSlashHost {
  random(): number;
  /** Standard native CreateWeaponAndFire, extraFlags=0x88. Each slash uses the
   * configured weapon's own trajectory/lifetime/scale; direction aims at the
   * next cached point, wrapping last back to first. */
  fire(weaponId: number, point: NativeWeaponPoint, yawDegrees: number, extraFlags: number): void;
}

export class NativeVoidSlashRuntime {
  private instances: { params: NativeVoidSlashParams; points: NativeWeaponPoint[]; index: number; cd: number }[] = [];
  constructor(private readonly host: NativeVoidSlashHost) {}
  /** On native event21, start is that event's cached TargetPos. Other events
   * use a random alive enemy after sorting by uid (or random map position when
   * none); the caller resolves that event-specific start position. */
  trigger(start: NativeWeaponPoint, params: NativeVoidSlashParams, extraCount: number): boolean {
    if (this.host.random() >= params.Rate) return false;
    this.instances.push({ params, points: nativeVoidSlashPoints(start, params, extraCount,
      () => this.host.random()), index: 0, cd: 0 });
    return true;
  }
  /** Native OnWaveStart/Undo clear all in-flight sequences. */
  clear(): void { this.instances = []; }
  step(deltaTime: number): void {
    for (let i = this.instances.length - 1; i >= 0; i--) {
      const instance = this.instances[i];
      if (instance.index >= instance.points.length) { this.instances.splice(i, 1); continue; }
      instance.cd -= deltaTime;
      if (instance.cd > 0) continue;
      instance.cd = instance.params.FireInterval;
      const current = instance.points[instance.index];
      const next = instance.points[(instance.index + 1) % instance.points.length];
      this.host.fire(instance.params.WeaponId, current,
        Math.atan2(next.x - current.x, next.z - current.z) / DEG, 0x88);
      instance.index++;
    }
  }
}
