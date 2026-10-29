import type { NativeWeaponPoint } from './weapon-runtime-extensions';

type Point = NativeWeaponPoint;
type Attributes = Readonly<Record<string, number>>;
export interface NativeExplosionParams {
  WeaponId: number;
  ExplodeRadius?: number;
  ExplosionCooldown?: number;
  TriggerOnHit?: boolean;
  TriggerOnHitNeedHitTargetCount?: number;
  TriggerOnHitNeedHitInterval?: number;
  TriggerOnDeath?: boolean;
  TriggerOnThrough?: boolean;
  IgnoreCheckCreatePosInMap?: boolean;
  TriggerOnCrit?: boolean;
  ExplodeOnTargetPosOnCrit?: boolean;
  TriggerOnChangeTarget?: boolean;
  ConsecutiveExplosionCount?: number;
  ConsecutiveExplosionInterval?: number;
  ExplosionRate?: number;
  TypeRates?: ReadonlyArray<{ Type: number; Rate: number }>;
  BulletTrait?: number;
}
export interface NativeExplosionFire {
  weaponId: number;
  origin: Point;
  yawDegrees: 0;
  /** Raw addFlag passed into CreateWeaponAndFire; its factory additionally ORs
   * 0x88 (0x80 for weapon101407). This is not the final projectile flag mask. */
  flags: 0;
  /** Additional traits, not copied mother-bullet flags/traits. */
  bulletTrait: number;
  /** ExternalWeaponFireInfo shape-radius/fire-effect override; absent on FireOnExplosion. */
  radiusOverride?: number;
  fireEffectScale?: number;
  kind: 'explosion' | 'fireOnExplosion';
}
export interface NativeExplosionSequenceHost {
  now(): number;
  ownerExists(): boolean;
  ownerDead(): boolean;
  ownerAttrs(): Attributes;
  /** Original MapManager.IsPosInMapSky, not just a projectile-screen lifetime bound. */
  isPosInMapSky(position: Point): boolean;
  /** Create an independent Weapon/OverLap bullet with its own config and owner. */
  fire(plan: NativeExplosionFire): void;
}
export interface NativeExplosionHost extends NativeExplosionSequenceHost {
  random(): number;
  sourcePosition(): Point;
  sourceFlags(): number;
  disabled(): boolean;
  fireOnExplosionWeaponId(): number;
  /** Attach to the owner; this action outlives the triggering source projectile. */
  schedule(sequence: NativeConsecutiveExplosion): void;
}
export interface NativeExplosionEvent {
  /** EntityComponentEventId: 22 BeforeDead, 25 HitTarget, 32 Through, 35 Crit, 37 ChangeTarget. */
  id: number;
  critPoint?: Point;
  /** args[1] EntityCharacterData of BulletChangeTarget; caller preserves event ordering. */
  changedTarget?: { position: Point; type: number };
  /** Query target.GetHurtByEnemyCount(ownerRef, sourceWeaponId[, now, interval]).
   * Includes this hit. The native test is count % configured N === 0, not >= N. */
  targetHitCount?(interval: number): number;
}

const value = (attrs: Attributes, name: string) => attrs[name] ?? 0;
export const nativeExplosionDefaults = {
  ExplosionCooldown: 0,
  ConsecutiveExplosionCount: 0,
  ConsecutiveExplosionInterval: 26214 / 65536,
  ExplosionRate: 1,
  BulletTrait: 2048,
} as const;

function effectiveExtraCount(params: NativeExplosionParams, attrs: Attributes): number {
  return Math.trunc(params.ConsecutiveExplosionCount ?? 0) + Math.floor(value(attrs, 'MissileExplodeCount'));
}
function radius(params: NativeExplosionParams, attrs: Attributes, mainDelta: number, first: boolean): number {
  const percent = value(attrs, 'ExplodeRadius%') + value(attrs, 'AllMissileExplodeRadius%')
    + value(attrs, 'AllSkillRange%') + (first ? value(attrs, 'BulletTraitAreaScale%') : 0);
  return ((params.ExplodeRadius ?? 0) + mainDelta) * (1 + percent);
}
function emitExplosion(params: NativeExplosionParams, host: NativeExplosionSequenceHost,
  origin: Point, mainDelta: number, extraWeaponId: number, first: boolean): void {
  const r = radius(params, host.ownerAttrs(), mainDelta, first);
  const bulletTrait = params.BulletTrait ?? nativeExplosionDefaults.BulletTrait;
  host.fire({ weaponId: params.WeaponId, origin: { ...origin }, yawDegrees: 0, flags: 0,
    bulletTrait, radiusOverride: r, fireEffectScale: r, kind: 'explosion' });
  if (extraWeaponId > 0) host.fire({ weaponId: extraWeaponId, origin: { ...origin },
    yawDegrees: 0, flags: 0, bulletTrait, kind: 'fireOnExplosion' });
}

/** Native ConsecutiveExplosionAction 0x6dc2d64 / 0x6dc3070 / 0x6dc3178. */
export class NativeConsecutiveExplosion {
  private remaining: number;
  private nextAt: number;
  private readonly origin: Point;

  constructor(private readonly params: NativeExplosionParams, origin: Point, now: number,
    count: number, private readonly mainDelta: number, private readonly extraWeaponId: number) {
    this.origin = { ...origin };
    this.remaining = count;
    this.nextAt = now + (params.ConsecutiveExplosionInterval ?? nativeExplosionDefaults.ConsecutiveExplosionInterval);
  }

  /** Returns true while scheduled; at most one attempt per logical update, no catch-up loop. */
  update(host: NativeExplosionSequenceHost): boolean {
    if (this.remaining <= 0) return false;
    const now = host.now();
    if (now < this.nextAt) return true;
    // Unlike the first explosion, native repeats always require an alive owner and map sky.
    if (host.ownerExists() && !host.ownerDead() && host.isPosInMapSky(this.origin))
      emitExplosion(this.params, host, this.origin, this.mainDelta, this.extraWeaponId, false);
    this.remaining--;
    this.nextAt = now + (this.params.ConsecutiveExplosionInterval ?? nativeExplosionDefaults.ConsecutiveExplosionInterval);
    return this.remaining > 0;
  }
}

/** One instance per source bullet's ExplosionMod. No inheritance of the source hit's damage.
 * Static evidence: research/explosion-native.arm64.txt, APK 1.1.6. */
export class NativeExplosionRuntime {
  private lastExplosionTime = 0;
  constructor(private readonly params: NativeExplosionParams) {}

  /** OnInit only installs this flag when TriggerOnHit is enabled. */
  get sourceInitFlags(): number { return this.params.TriggerOnHit ? 0x100000 : 0; }

  onEvent(event: NativeExplosionEvent, host: NativeExplosionHost): boolean {
    let origin: Point;
    switch (event.id) {
      case 22:
        if (!this.params.TriggerOnDeath) return false;
        origin = host.sourcePosition();
        break;
      case 25: {
        if (!this.params.TriggerOnHit) return false;
        const every = Math.trunc(this.params.TriggerOnHitNeedHitTargetCount ?? 0);
        if (every > 0 && (!event.targetHitCount ||
          event.targetHitCount(this.params.TriggerOnHitNeedHitInterval ?? 0) % every !== 0)) return false;
        origin = host.sourcePosition();
        break;
      }
      case 32:
        if (!this.params.TriggerOnThrough) return false;
        origin = host.sourcePosition();
        break;
      case 35:
        if (!this.params.TriggerOnCrit) return false;
        origin = this.params.ExplodeOnTargetPosOnCrit && event.critPoint ? event.critPoint : host.sourcePosition();
        break;
      case 37:
        if (!this.params.TriggerOnChangeTarget || !event.changedTarget) return false;
        // All matching TypeRates are evaluated. A missing match does not reject the event.
        for (const entry of this.params.TypeRates ?? [])
          if (entry.Type === event.changedTarget.type && host.random() > entry.Rate) return false;
        origin = event.changedTarget.position;
        break;
      default: return false;
    }
    if (host.disabled()) return false;
    // The original draws even for rate=1 and checks probability before cooldown.
    if (host.random() > (this.params.ExplosionRate ?? nativeExplosionDefaults.ExplosionRate)) return false;
    const now = host.now();
    if (now - this.lastExplosionTime < (this.params.ExplosionCooldown ?? 0)) return false;
    this.lastExplosionTime = now;
    // Map rejection consumes cooldown. This first check can be bypassed; repeats cannot.
    if (!this.params.IgnoreCheckCreatePosInMap && !host.isPosInMapSky(origin)) return false;
    if (!host.ownerExists()) return false;
    const attrs = host.ownerAttrs();
    const mainDelta = (host.sourceFlags() & 8192) ? value(attrs, 'MainWeaponExplosionMod_ExplodeRadius') : 0;
    const extraWeaponId = host.fireOnExplosionWeaponId();
    emitExplosion(this.params, host, origin, mainDelta, extraWeaponId, true);
    const count = effectiveExtraCount(this.params, host.ownerAttrs());
    if (count > 0) host.schedule(new NativeConsecutiveExplosion(this.params, origin, now, count, mainDelta, extraWeaponId));
    return true;
  }
}
