import type { NativeWeaponPoint } from './weapon-runtime-extensions';

type Point = NativeWeaponPoint;
/** BlackHoleModParams ctor@6d205ec (native-eject-extra.txt). Normalize EACH
 * original mod record before repeat aggregation, including partial upgrades. */
export const NATIVE_BLACK_HOLE_MOD_DEFAULTS = Object.freeze({
  PullRadius: 4, PullStrength: 4, BulletTrait: 512,
  PullBackToCenter: false, IgnoreThroughMapOutWall: false,
});
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const lengthSq = (a: Point, b: Point) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const normalized = (p: Point): Point => {
  const length = Math.hypot(p.x, p.z);
  return length ? { x: p.x / length, z: p.z / length } : { x: 0, z: 0 };
};

export interface NativeBlackHolePullHost {
  position(): Point;
  /** Missing means the source bullet has been destroyed, not merely disabled. */
  source(): Point | undefined;
  dead(): boolean;
  mass(): number;
  /** AllBlackHolePullStrength% belongs to the affected enemy's attributes. */
  enemyPullStrengthPercent(): number;
  /** AllBlackHolePullRadius% belongs to the source weapon follower's owner. */
  ownerPullRadiusPercent(): number;
  random(): number;
  move(position: Point): void;
  clamp(position: Point): Point;
  inside(position: Point): boolean;
  /** Native tests the source against top camera bounds with -sourceRadius. */
  sourceAboveTop(position: Point, sourceRadius: number): boolean;
  disableSourcePull(): void;
}

export interface NativeBlackHolePullOptions {
  sourcePosition: Point;
  sourceRadius: number;
  /** Source's actual collider radius + Const BlackHole_DeltaRadius (1).
   * MoveStraight.tryPullEnemies does not use BlackHoleMod.PullRadius here. */
  pullRadius: number;
  pullStrength: number;
  pullBackToCenter?: boolean;
}

/** MoveStraight.tryPullEnemies 0x6d7dc88 and 0x6d7e080. */
export function nativeBlackHoleCaptureRadius(colliderRadius: number, ownerRadiusPercent = 0): number {
  return (colliderRadius + 1) * (1 + ownerRadiusPercent);
}

/** EntityCharacter.AllowBePulled 0x6bbfba0. Elites are not independently
 * excluded here; transport action120 has a different eligibility rule. */
export function nativeBlackHoleCanPull(options: {
  dead: boolean; alreadyBeingPulled: boolean; boss: boolean;
  immuneControl: boolean; immuneBulletAttract: number; hasAI: boolean;
}): boolean {
  return !options.dead && !options.alreadyBeingPulled && !options.boss
    && !options.immuneControl && options.immuneBulletAttract === 0 && options.hasAI;
}

export interface NativeBlackHoleCamera { left: number; right: number; bottom: number; top: number }
/** ComputeWallNormalFromCameraBounds 0x6d807e4: choose the greatest positive
 * penetration. Equal penetration retains left > right > bottom > top order. */
export function nativeBlackHoleWallNormal(position: Point, camera: NativeBlackHoleCamera): Point {
  let greatest = 0, normal = { x: 0, z: 0 };
  const candidates = [
    { distance: camera.left - position.x, normal: { x: 1, z: 0 } },
    { distance: position.x - camera.right, normal: { x: -1, z: 0 } },
    { distance: camera.bottom - position.z, normal: { x: 0, z: 1 } },
    { distance: position.z - camera.top, normal: { x: 0, z: -1 } },
  ];
  for (const candidate of candidates) if (candidate.distance > greatest) {
    greatest = candidate.distance; normal = candidate.normal;
  }
  return normal;
}

/** The native black-hole touch event (51) fires once when the center exits the
 * camera, even before the trailing collider edge leaves. Call before destroying
 * the source so the split action can still read its owner and bullet flags. */
export class NativeBlackHoleBoundaryRuntime {
  private notified = false;
  update(position: Point, forward: Point, colliderRadius: number, camera: NativeBlackHoleCamera): {
    touch?: { position: Point; normal: Point }; dispose: boolean;
  } {
    const inside = (p: Point) => p.x >= camera.left && p.x <= camera.right && p.z >= camera.bottom && p.z <= camera.top;
    const centerInside = inside(position);
    let touch: { position: Point; normal: Point } | undefined;
    if (!centerInside && !this.notified) {
      this.notified = true;
      touch = { position: { ...position }, normal: nativeBlackHoleWallNormal(position, camera) };
    }
    const direction = forward.x || forward.z ? normalized(forward) : { x: 0, z: 1 };
    const rear = { x: position.x - direction.x * colliderRadius, z: position.z - direction.z * colliderRadius };
    return { touch, dispose: !centerInside && !inside(rear) };
  }
}

/** BeingPulledAction (0x69c654c..0x69c9500): capture changes the enemy AI task.
 * The caller must suspend its normal path/AI movement until update returns false.
 * Damage, detection radius and capture eligibility remain in the host collision
 * pipeline. This action is not a decorative centerward velocity override.
 */
export class NativeBlackHolePullRuntime {
  private state: 'towards' | 'downward' | 'away' = 'towards';
  private struggleTimer = 1;
  private moveTime = 0;
  private shakeSeed = 0;
  private oldSource: Point;
  private reverse: Point = { x: 0, z: 0 };
  private readonly randomOffset: Point;
  private readonly maxDistanceSquared: number;
  private finished = false;

  constructor(private readonly options: NativeBlackHolePullOptions, host: NativeBlackHolePullHost) {
    this.oldSource = { ...options.sourcePosition };
    const angle = host.random() * 2 * Math.PI, radius = host.random() * 3;
    this.randomOffset = { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
    this.maxDistanceSquared = this.radius(host) ** 2;
  }

  private radius(host: NativeBlackHolePullHost): number {
    return this.options.pullRadius * (1 + host.ownerPullRadiusPercent());
  }
  private strength(host: NativeBlackHolePullHost): number {
    return this.options.pullStrength * (1 + host.enemyPullStrengthPercent());
  }
  private distanceRatio(position: Point, source: Point): number {
    return this.maxDistanceSquared ? clamp01(lengthSq(position, source) / this.maxDistanceSquared) : 0;
  }
  private beginAway(host: NativeBlackHolePullHost): void {
    this.state = 'away'; this.moveTime = 0;
    const position = host.position();
    this.reverse = { x: position.x - this.oldSource.x,
      z: position.z - this.oldSource.z - this.radius(host) };
  }
  private moveAway(dt: number, host: NativeBlackHolePullHost): boolean {
    const duration = 13107 / 65536;
    const t = clamp01(this.moveTime / duration), strength = this.strength(host);
    const distance = strength * (strength * 0.25 * host.mass() / 5) * (1 - (1 - t) ** 2) * dt;
    const direction = normalized(this.reverse), sign = this.options.pullBackToCenter ? -1 : 1;
    const delta = { x: direction.x * distance * sign, z: direction.z * distance * sign };
    const position = host.position();
    const candidate = host.clamp({ x: position.x + delta.x, z: position.z + delta.z });
    // The native edge test is one additional delta beyond the clamped candidate.
    if (!host.inside({ x: candidate.x + delta.x, z: candidate.z + delta.z })) return false;
    host.move(candidate);
    this.moveTime += dt;
    return this.moveTime < duration;
  }
  private shake(dt: number, direction: Point): Point {
    this.shakeSeed += dt * 2;
    const noise = (value: number) => (Math.sin(value * 2 * (205887 / 65536)) + 1) * 0.5;
    const magnitude = 13107 / 65536;
    const main = noise(this.shakeSeed) * magnitude;
    const extra = noise(this.shakeSeed + 10) * magnitude * 0.5;
    return { x: direction.x * main + extra, z: direction.z * main + extra };
  }

  update(deltaTime: number, host: NativeBlackHolePullHost): boolean {
    if (this.finished || host.dead()) { this.finished = true; return false; }
    const source = host.source();
    if (!source && this.state !== 'away') this.beginAway(host);
    if (this.state === 'away') {
      const active = this.moveAway(deltaTime, host);
      this.finished = !active;
      return active;
    }
    // The branch above has handled missing sources.
    if (!source) return false;
    this.oldSource = { ...source };
    if (this.state === 'towards') {
      const position = host.position();
      const target = { x: source.x + this.randomOffset.x, z: source.z + this.randomOffset.z };
      const distance = Math.hypot(target.x - position.x, target.z - position.z);
      const mass = host.mass();
      const step = this.strength(host) * (mass ? 5 / mass : 0) * deltaTime;
      const factor = distance ? Math.min(1, step / distance) : 0;
      host.move(host.clamp({ x: position.x + (target.x - position.x) * factor,
        z: position.z + (target.z - position.z) * factor }));
      this.struggleTimer -= deltaTime;
      if (this.struggleTimer <= 0) {
        this.struggleTimer = 1;
        const ratio = this.distanceRatio(host.position(), source);
        const roll = host.random();
        if (roll <= (52429 / 65536) * (1 - ratio)
          && lengthSq(host.position(), source) < this.maxDistanceSquared) {
          this.state = 'downward';
          this.moveTime = 0.25 + host.random() * 0.5;
        }
      }
      if (lengthSq(host.position(), source) >= this.maxDistanceSquared) {
        this.finished = true; return false;
      }
    } else {
      const position = host.position();
      if (lengthSq(position, source) >= this.maxDistanceSquared) {
        this.finished = true; return false;
      }
      this.moveTime -= deltaTime;
      if (this.moveTime <= 0) this.state = 'towards';
      else {
        const distance = Math.min(this.radius(host) * (19661 / 65536),
          this.strength(host) * 0.5 * (1 + this.distanceRatio(position, source)) * host.mass() / 5 * deltaTime);
        const delta = { x: 0, z: -distance };
        const shake = this.shake(deltaTime, normalized(delta));
        host.move(host.clamp({ x: position.x + shake.x, z: position.z + delta.z + shake.z }));
      }
    }
    if (host.sourceAboveTop(this.oldSource, this.options.sourceRadius)) {
      host.disableSourcePull(); this.beginAway(host);
    }
    return true;
  }
}

/** TriggerActionSplitTwoBlackHole 0x6b88b34/0x6b88ef8. Event51 supplies the
 * collision normal; the two new directions rotate that vector by +/-Angle.
 * Origin is the source position; the explicit target is ten units forward.
 * The host copies source flags and uses args.WeaponId, not the source weapon.
 */
export function nativeBlackHoleSplitPlan(source: Point, eventDirection: Point, angleDegrees: number):
  Array<{ origin: Point; direction: Point; target: Point; yawDegrees: number }> {
  return [angleDegrees, -angleDegrees].map(angle => {
    const radians = angle * Math.PI / 180;
    const direction = normalized({ x: eventDirection.x * Math.cos(radians) + eventDirection.z * Math.sin(radians),
      z: -eventDirection.x * Math.sin(radians) + eventDirection.z * Math.cos(radians) });
    return { origin: { ...source }, direction,
      target: { x: source.x + direction.x * 10, z: source.z + direction.z * 10 },
      yawDegrees: Math.atan2(direction.x, direction.z) * 180 / Math.PI };
  });
}

/** TriggerActionTransportTarget2ScreenEdge 0x6b8be48. The selected border is
 * from action config (missing/empty list becomes [1]), never the bottom edge. */
export function nativeBlackHoleTransportPosition(position: Point, radius: number,
  camera: { left: number; right: number; top: number }, border: number): Point {
  if (border === 2) return { x: camera.left + radius, z: position.z };
  if (border === 3) return { x: camera.right - radius, z: position.z };
  return { x: position.x, z: camera.top - radius };
}

/** Action120 eligibility and buffs are separate: elites/bosses are excluded
 * altogether; control immunity suppresses transport but not configured buffs.
 * The event rate gate belongs to the caller (native card uses 0.0700073242).
 */
export function nativeBlackHoleTransportPlan(options: {
  position: Point; radius: number; camera: { left: number; right: number; top: number };
  dead: boolean; elite: boolean; boss: boolean; immuneControl: boolean;
  borderTypes?: readonly number[]; buffIds?: readonly number[]; random: () => number;
}): { position?: Point; buffIds: number[] } | undefined {
  if (options.dead || options.elite || options.boss) return undefined;
  let position: Point | undefined;
  if (!options.immuneControl) {
    const borders = options.borderTypes?.length ? options.borderTypes : [1];
    const border = borders[Math.min(borders.length - 1, Math.floor(options.random() * borders.length))];
    position = nativeBlackHoleTransportPosition(options.position, options.radius, options.camera, border);
  }
  return { position, buffIds: (options.buffIds ?? []).filter(id => id > 0) };
}

/** Action121 keeps one running amount per (enemy bullet, attr), across black
 * holes. Enter adds the configured step with a symmetric absolute cap; Stay
 * does nothing. Any Exit removes the entire accumulated amount, as native does.
 * Returns a delta for the host's bullet attribute bucket, not a speed multiplier.
 */
export class NativeBlackHoleOverlapAttributes {
  private readonly values = new Map<number, Map<string, number>>();
  enter(uid: number, attrs: readonly string[]): Record<string, number> {
    let state = this.values.get(uid);
    if (!state) this.values.set(uid, state = new Map());
    const delta: Record<string, number> = {};
    for (const encoded of attrs) {
      const [name, valueText, capText] = encoded.split('|');
      const step = Number(valueText), cap = Math.abs(Number(capText ?? 0));
      if (!name || !Number.isFinite(step) || !Number.isFinite(cap)) continue;
      const old = state.get(name) ?? 0;
      const value = cap ? Math.max(-cap, Math.min(cap, old + step)) : old + step;
      state.set(name, value); delta[name] = (delta[name] ?? 0) + value - old;
    }
    return delta;
  }
  exit(uid: number): Record<string, number> {
    const state = this.values.get(uid), delta: Record<string, number> = {};
    if (state) for (const [name, value] of state) delta[name] = -value;
    this.values.delete(uid);
    return delta;
  }
  clear(): void { this.values.clear(); }
}
