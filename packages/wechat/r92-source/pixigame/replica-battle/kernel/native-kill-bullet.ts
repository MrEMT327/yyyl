/** Native BulletModeProcessorBase.HurtTarget (0x5f540c8..0x5f555fc).
 * This is a collision path, not a skill trigger or an on-enter callback.
 * Evidence: research/native-kill-bullet.txt. */
export interface NativeKillBulletParams {
  LayerName?: string;
  KillBulletRate?: number;
  KillBulletCount?: number;
}
export interface NativeKillBulletInstallation {
  rate: number;
  count: number;
  flags: number;
  hitCampMask: number;
  /** Native component event46 ["add", Bullet layer]. */
  addBulletCollisionLayer: boolean;
}

/** KillBulletMod always adds the Bullet query layer, regardless of LayerName.
 * The caller installs this in native processor order (assignment, not addition). */
export function nativeInstallKillBulletMod(params: NativeKillBulletParams,
  flags: number, hitCampMask: number): NativeKillBulletInstallation {
  return { rate: params.KillBulletRate ?? 1, count: params.KillBulletCount ?? 0,
    flags: flags | 32, hitCampMask: hitCampMask | 16, addBulletCollisionLayer: true };
}

/** FollowOwner overwrites the rate but preserves an existing KillBulletCount.
 * Its default LayerName is "Bullet". It does NOT add the HitBullet flag.
 * TriggerOnly=1 bypasses HurtTarget entirely; the host must not call contact then. */
export function nativeInstallFollowOwnerKillBullet(params: NativeKillBulletParams,
  flags: number, hitCampMask: number, count = 0): NativeKillBulletInstallation {
  const addBulletCollisionLayer = (params.LayerName ?? 'Bullet') === 'Bullet' || (flags & 32) !== 0;
  return { rate: params.KillBulletRate ?? 1, count, flags,
    hitCampMask: addBulletCollisionLayer ? hitCampMask | 16 : hitCampMask, addBulletCollisionLayer };
}

export interface NativeKillBulletSource {
  uid: number;
  weaponId: number;
  ownerUid: number;
  /** Native ParentEntity normally returns self when no distinct parent exists. */
  ownerParentUid?: number;
  dead: boolean;
  hitCampMask: number;
}
export interface NativeKillBulletContact {
  uid: number;
  dead: boolean;
  bulletTrait: number;
  /** Result of native CheckHit, not an owner/faction guess. EnemyBullet is 16. */
  hitCamp: number;
}
export type NativeKillBulletCommand =
  | { kind: 'hover'; targetUid: number }
  | { kind: 'die'; targetUid: number; ignoreTrigger: false; isKillByRing: false; isNormalDie: boolean }
  | { kind: 'incrementOwnerKillBulletCount'; ownerUid: number; weaponId: number }
  | { kind: 'trigger'; entityUid: number; event: 28; weaponId: number }
  | { kind: 'trigger'; entityUid: number; event: 59 };
export interface NativeKillBulletResult {
  attempted: boolean;
  killed: boolean;
  /** Keep order: target hover/death -> owner counter/event28 -> parent59 -> source death. */
  commands: NativeKillBulletCommand[];
  /** Native HurtTarget returns false even after successfully erasing a bullet.
   * Do not run ordinary enemy-hit damage, through, or eject callbacks afterward. */
  hurtTargetResult: false;
}

/** One instance per source projectile, shared across all of its trajectory/mod callers.
 * Failed pairs persist for the lifetime of the target bullet, including exit/reentry.
 * An instance-local target set is equivalent to native target.Data.failedSources
 * because this runtime belongs to exactly one unique source entity. Never recycle uid. */
export class NativeKillBulletRuntime {
  private readonly failedTargets = new Set<number>();
  private readonly killedTargets = new Set<number>();
  private exhausted = false;
  private remaining: number;
  constructor(private rate: number, count = 0) { this.remaining = count; }
  get remainingCount(): number { return this.remaining; }
  /** For an explicit later mod installation only; never call every frame. */
  install(rate: number, count = this.remaining): void { this.rate = rate; this.remaining = count; }
  forgetRemovedTarget(uid: number): void { this.failedTargets.delete(uid); this.killedTargets.delete(uid); }

  contact(source: NativeKillBulletSource, target: NativeKillBulletContact,
    randomNextBool: (rate: number) => boolean,
    hideHoverForSourceBullet = false): NativeKillBulletResult {
    const result: NativeKillBulletResult = { attempted: false, killed: false, commands: [], hurtTargetResult: false };
    if (source.dead || this.exhausted || target.dead || source.uid === target.uid || target.hitCamp !== 16
      || (source.hitCampMask & target.hitCamp) !== target.hitCamp
      || this.failedTargets.has(target.uid) || this.killedTargets.has(target.uid)) return result;
    // Area(1) and Raycast(8) are immune. Native also remembers these failed pairs.
    if ((target.bulletTrait & 9) !== 0) { this.failedTargets.add(target.uid); return result; }
    result.attempted = true;
    // Pass the native rate directly; its RNG handles probability bounds/quantization.
    if (!randomNextBool(this.rate)) { this.failedTargets.add(target.uid); return result; }
    this.killedTargets.add(target.uid);
    result.killed = true;
    if (!hideHoverForSourceBullet) result.commands.push({ kind: 'hover', targetUid: target.uid });
    result.commands.push({ kind: 'die', targetUid: target.uid, ignoreTrigger: false, isKillByRing: false, isNormalDie: true },
      { kind: 'incrementOwnerKillBulletCount', ownerUid: source.ownerUid, weaponId: source.weaponId },
      { kind: 'trigger', entityUid: source.ownerUid, event: 28, weaponId: source.weaponId });
    if (source.ownerParentUid !== undefined && source.ownerParentUid !== source.ownerUid)
      result.commands.push({ kind: 'trigger', entityUid: source.ownerParentUid, event: 59 });
    // Zero/negative count means unlimited. Only a positive budget counts down.
    if (this.remaining > 0 && --this.remaining === 0) {
      this.exhausted = true;
      result.commands.push({ kind: 'die', targetUid: source.uid, ignoreTrigger: false, isKillByRing: false, isNormalDie: false });
    }
    return result;
  }
}
