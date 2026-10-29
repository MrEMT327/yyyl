import type { NativeRecord } from './weapon-skill-runtime';

export interface NativePlaneOwner { uid: number; alive: boolean; x: number; z: number; yawDegrees: number; hp: number; hpMax: number }
export interface NativePlaneAction { action: number; args: NativeRecord; sourceKey: string }
export interface NativePlaneEvent { bulletUid?: number; targetUid?: number; attackerUid?: number; point?: { x: number; z: number }; isCrit?: boolean }
export interface NativePlaneBullet { uid: number; alive: boolean; x: number; z: number; yawDegrees: number; flags: number; familyId: number; shapeOffsetZ: number }
export interface NativePlaneFire { familyId: number; sourceKey: string; weaponId: number; position: { x: number; z: number }; yawDegrees: number; targetPosition: { x: number; z: number }; flags: number }
export interface NativeAnyWeaponBulletModification {
  DeltaScalePercent: number; AllowScaleWhenIgnored: boolean; DeltaFireCount: number; DeltaThroughCount: number;
  DeltaFireInterval: number; DeltaLifeTime: number; DeltaHawkMissileCount: number; ContinueHawkMissileCount: number; DeltaBulletCount: number;
}

/** 96 is positional zip, rejects a mismatched array pair, and adds each value
 * to the owner dictionary's previous value (default0). At bullet creation the
 * existing ExAttackPercent is multiplied by 1 + that dictionary value. */
export function nativeSkillWeaponAttackUpdates(args: NativeRecord): Array<{ weaponId: number; addition: number }> {
  const ids: number[] = args.WeaponIds || [], values: number[] = args.ExAttacks || [];
  if (ids.length !== values.length) return [];
  return ids.map((weaponId, index) => ({ weaponId, addition: Number(values[index]) }));
}

/** 156 ToModification makes a NEW complete object, then native dictionary
 * assignment REPLACES the entire prior object for this WeaponId. Missing fields
 * are zero/false, not inherited from an earlier star action's modification. */
export function nativeAnyWeaponBulletModification(args: NativeRecord): NativeAnyWeaponBulletModification {
  return { DeltaScalePercent: Number(args.DeltaScalePercent || 0), AllowScaleWhenIgnored: Boolean(args.AllowScaleWhenIgnored),
    DeltaFireCount: Math.trunc(Number(args.DeltaFireCount || 0)), DeltaThroughCount: Math.trunc(Number(args.DeltaThroughCount || 0)),
    DeltaFireInterval: Number(args.DeltaFireInterval || 0), DeltaLifeTime: Number(args.DeltaLifeTime || 0),
    DeltaHawkMissileCount: Math.trunc(Number(args.DeltaHawkMissileCount || 0)), ContinueHawkMissileCount: Math.trunc(Number(args.ContinueHawkMissileCount || 0)), DeltaBulletCount: Math.trunc(Number(args.DeltaBulletCount || 0)) };
}
export interface NativePlaneSpecialHost {
  /** Return the original trigger's owner character (hero for plane skills). */
  owner(familyId: number): NativePlaneOwner | undefined;
  addBuff(familyId: number, buffId: number): void;
  removeBuff(familyId: number, buffId: number): void;
  /** This marker also feeds native InUnrealState hit filters and visuals. */
  setUnrealState(familyId: number, active: boolean): void;
  /** Native event55 enter/event56 exit, after the marker and buff change. */
  dispatchUnrealEvent(familyId: number, type: 55 | 56, sourceKey: string): void;
  /** Action20 changes future buff resolution; it does not swap an existing buff.
   * dest0 removes the mapping. Common buff creation must consult this mapping. */
  replaceBuffIds(familyId: number, sourceBuffId: number, destinationBuffId: number): void;
  resolveBuffId?(familyId: number, buffId: number): number;
  heal?(familyId: number, baseAmount: number, sourceKind: number): void;
  bullet?(uid: number): NativePlaneBullet | undefined;
  fireWeapon?(request: NativePlaneFire): void;
  addBulletMods?(uid: number, sourceKey: string, mods: readonly { name: string; parameters: NativeRecord }[]): void;
  entityAlive?(uid: number): boolean;
  /** Enable only after damage consumes progressiveLaserBonus exactly once in
   * the native laser's damage bucket. Definitions alone are not admission. */
  progressiveDamageBucketInstalled?: boolean;
}
type PhantomShared = { cd: number; duration: number; nextAt: number; replacements: Map<number, number> };
type PhantomAction = { familyId: number; ownerUid: number; sourceKey: string; buffId: number; active: boolean; inUnreal: boolean; endAt: number; appliedBuffId: number };
type ProgressiveConfig = { familyId: number; sourceKey: string; perSecond: number; maximum: number };
type ProgressiveTrack = { targetUid: number; firstAt: number; frame: number; seen: Set<number> };

/** 158 uses the SOURCE bullet's position/heading/flags. It faces sideways:
 * cross(Up,-bullet.Forward), not the player's aim and not a radial burst. */
export function nativeDimensionSlashPlan(bullet: NativePlaneBullet, args: NativeRecord, sourceKey: string): NativePlaneFire {
  const yawDegrees = bullet.yawDegrees - 90, yaw = yawDegrees * Math.PI / 180;
  const position = { x: bullet.x, z: bullet.z + bullet.shapeOffsetZ + Number(args.CreateBulletOffsetPosZ || 0) };
  return { familyId: bullet.familyId, sourceKey, weaponId: Number(args.WeaponId), position, yawDegrees,
    targetPosition: { x: position.x + Math.sin(yaw) * 10, z: position.z + Math.cos(yaw) * 10 }, flags: bullet.flags };
}

/** Action155's native pre-RecoverHP heal. GetHpMax returns an integer; literals
 * are original FP raw constants. The shared Heal path applies source24 bonuses. */
export function nativeAngelCritBaseHeal(hpMax: number): number {
  hpMax = Math.trunc(hpMax);
  return 20 + Math.min(Math.exp(Math.log(hpMax) * (0x4ccc / 65536)), Math.max(0, hpMax - 600) * (0x147 / 65536));
}

/** Plane-specific original action state, separate from render/SIM ownership.
 * Native source: research/plane-special-phantom.arm64.txt. Timers use the battle
 * clock supplied by the host; nothing is tied to wall time or UI refreshes. */
export class NativePlaneSpecialActions {
  private shared = new Map<number, PhantomShared>();
  private phantoms = new Map<string, PhantomAction>();
  private installed = new Map<string, { action: number; familyId: number; ownerUid: number; args: NativeRecord }>();
  private progressive = new Map<number, ProgressiveConfig>();
  private laserTracking = new Map<number, ProgressiveTrack>();
  constructor(private readonly host: NativePlaneSpecialHost) {}

  canHandle(action: number): boolean {
    return [20, 163, 164, 166].includes(action) || action === 155 && !!this.host.heal
      || action === 158 && !!this.host.bullet && !!this.host.fireWeapon
      || action === 160 && !!this.host.entityAlive && this.host.progressiveDamageBucketInstalled === true
      || action === 188 && !!this.host.bullet && !!this.host.addBulletMods;
  }

  /** OnInit163 copies base CD/duration and sets nextAt=now. OnExecute163 later
   * activates it. Learning 164 changes future durations, not a running endAt. */
  install(command: NativePlaneAction, familyId: number, now: number): boolean {
    if (!this.canHandle(command.action)) return false;
    if (this.installed.has(command.sourceKey)) return true;
    const owner = this.host.owner(familyId);
    if (!owner) return true;
    this.installed.set(command.sourceKey, { action: command.action, familyId, ownerUid: owner.uid, args: { ...command.args } });
    if (command.action === 163) {
      const state = this.ownerState(owner.uid, now);
      state.cd = Number(command.args.UnrealCD || 0); state.duration = Number(command.args.UnrealInterval || 0); state.nextAt = now;
      this.phantoms.set(command.sourceKey, { familyId, ownerUid: owner.uid, sourceKey: command.sourceKey, buffId: Number(command.args.UnrealBuffId || 0), active: false, inUnreal: false, endAt: 0, appliedBuffId: 0 });
    }
    return true;
  }

  execute(command: NativePlaneAction, familyId: number, now: number, event: NativePlaneEvent = {}): boolean {
    if (!this.canHandle(command.action)) return false;
    this.install(command, familyId, now);
    const owner = this.host.owner(familyId);
    if (!owner) return true;
    const state = this.ownerState(owner.uid, now), args = command.args;
    if (command.action === 163) {
      const phantom = this.phantoms.get(command.sourceKey);
      if (phantom && !phantom.active) { phantom.active = true; phantom.inUnreal = false; phantom.appliedBuffId = 0; phantom.endAt = 0; state.nextAt = now; }
    } else if (command.action === 164) {
      state.cd += Number(args.DeltaUnrealCD || 0); state.duration += Number(args.DeltaUnrealInterval || 0);
    } else if (command.action === 166) state.nextAt = Math.max(0, state.nextAt + Number(args.DeltaTime || 0));
    else if (command.action === 20) {
      const source = Number(args.SrcBuffId || 0), destination = Number(args.DestBuffId || 0);
      if (destination) state.replacements.set(source, destination); else state.replacements.delete(source);
      this.host.replaceBuffIds(familyId, source, destination);
    } else if (command.action === 155) this.host.heal?.(familyId, nativeAngelCritBaseHeal(owner.hpMax), 24);
    else if (command.action === 158) {
      const bullet = event.bulletUid === undefined ? undefined : this.host.bullet?.(event.bulletUid);
      if (bullet) this.host.fireWeapon?.(nativeDimensionSlashPlan(bullet, args, command.sourceKey));
    } else if (command.action === 160) this.progressive.set(owner.uid, { familyId, sourceKey: command.sourceKey, perSecond: Number(args.AttackPercentPerSecond), maximum: Number(args.MaxAttackPercent) });
    return true;
  }

  step(now: number): void {
    for (const phantom of this.phantoms.values()) {
      if (!phantom.active || !this.host.owner(phantom.familyId)?.alive) continue;
      const state = this.ownerState(phantom.ownerUid, now);
      if (phantom.inUnreal) {
        if (now >= phantom.endAt) this.endPhantom(phantom, now, true);
      } else if (now >= state.nextAt) {
        phantom.inUnreal = true; phantom.endAt = now + state.duration;
        this.host.setUnrealState(phantom.familyId, true);
        if (phantom.buffId > 0) {
          const mapped = state.replacements.get(phantom.buffId) ?? phantom.buffId;
          const resolved = this.host.resolveBuffId?.(phantom.familyId, mapped) ?? mapped;
          phantom.appliedBuffId = resolved > 0 ? resolved : mapped;
          this.host.addBuff(phantom.familyId, phantom.appliedBuffId);
        }
        this.host.dispatchUnrealEvent(phantom.familyId, 55, phantom.sourceKey);
      }
    }
  }

  isUnreal(familyId: number): boolean {
    const uid = this.host.owner(familyId)?.uid;
    return [...this.phantoms.values()].some(item => item.ownerUid === uid && item.inUnreal);
  }

  /** Action188 subscribes on installation. Invoke for newly created bullets,
   * before their dynamic mods begin; it does not retrofit existing bullets or
   * remove the original BuffMod if the hero later heals above the threshold. */
  onBulletCreate(familyId: number, bulletUid: number, weaponId: number): void {
    const bullet = this.host.bullet?.(bulletUid);
    if (!bullet?.alive) return;
    for (const [sourceKey, item] of this.installed) {
      if (item.action !== 188) continue;
      const owner = this.host.owner(item.familyId), current = this.host.owner(familyId);
      if (!owner?.alive || owner.uid !== current?.uid || owner.hpMax <= 0 || owner.hp / owner.hpMax >= Number(item.args.HpPercentThreshold)) continue;
      if (item.args.WeaponIds?.length && !item.args.WeaponIds.includes(weaponId)) continue;
      const mods = (item.args.Mods || []).flatMap((mod: NativeRecord) => {
        if (!mod?.ModName) return [];
        const parameters = typeof mod.ModParam === 'string' ? JSON.parse(mod.ModParam) : mod.ModParam || {};
        return [{ name: String(mod.ModName), parameters }];
      });
      if (mods.length) this.host.addBulletMods?.(bulletUid, sourceKey, mods);
    }
  }

  /** Native160: call in the original collision order BEFORE each damage result,
   * with a stable logic-frame token. Only SpecialLaserStick uses this tracker.
   * A target is updated once/frame, but another target resets the singleton
   * first-hit clock. No-hit gaps alone do not invent a reset. */
  progressiveLaserBonus(familyId: number, bulletUid: number, targetUid: number, now: number, frame: number, specialLaserStick: boolean): number {
    const owner = this.host.owner(familyId), config = owner && this.progressive.get(owner.uid);
    if (!config || !specialLaserStick) { this.laserTracking.delete(bulletUid); return 0; }
    let track = this.laserTracking.get(bulletUid);
    if (track && !this.host.entityAlive?.(track.targetUid)) { this.laserTracking.delete(bulletUid); track = undefined; }
    if (!track) this.laserTracking.set(bulletUid, track = { targetUid, firstAt: now, frame, seen: new Set() });
    if (track.frame !== frame) { track.frame = frame; track.seen.clear(); }
    if (!track.seen.has(targetUid)) {
      if (track.targetUid !== targetUid) { track.targetUid = targetUid; track.firstAt = now; }
      track.seen.add(targetUid);
    }
    if (track.targetUid !== targetUid || config.perSecond <= 0) return 0;
    const bonus = (now - track.firstAt) * config.perSecond;
    return config.maximum > 0 ? Math.min(bonus, config.maximum) : bonus;
  }

  resetLaser(bulletUid: number): void { this.laserTracking.delete(bulletUid); }

  remove(sourceKey: string): void {
    const phantom = this.phantoms.get(sourceKey);
    if (phantom) { this.endPhantom(phantom, 0, false); this.phantoms.delete(sourceKey); }
    const item = this.installed.get(sourceKey);
    if (item?.action === 160 && this.progressive.get(item.ownerUid)?.sourceKey === sourceKey) this.progressive.delete(item.ownerUid);
    this.installed.delete(sourceKey);
    // Native 164/166/20 are immediate mutations without their own Undo; a full
    // run reset clears their owner data. Do not invent reverse CD adjustments.
  }

  clear(): void {
    for (const key of this.phantoms.keys()) this.remove(key);
    for (const entry of this.installed.values()) if (entry.action === 20) this.host.replaceBuffIds(entry.familyId, Number(entry.args.SrcBuffId), 0);
    this.installed.clear(); this.shared.clear(); this.progressive.clear(); this.laserTracking.clear();
  }

  private ownerState(uid: number, now: number): PhantomShared {
    let state = this.shared.get(uid);
    if (!state) this.shared.set(uid, state = { cd: 0, duration: 0, nextAt: now, replacements: new Map() });
    return state;
  }

  private endPhantom(phantom: PhantomAction, now: number, ordinaryExit: boolean): void {
    if (phantom.appliedBuffId > 0) this.host.removeBuff(phantom.familyId, phantom.appliedBuffId);
    phantom.appliedBuffId = 0;
    this.host.setUnrealState(phantom.familyId, false);
    phantom.inUnreal = false;
    if (ordinaryExit) {
      const state = this.ownerState(phantom.ownerUid, now);
      state.nextAt = now + state.cd;
      this.host.dispatchUnrealEvent(phantom.familyId, 56, phantom.sourceKey);
    } else phantom.active = false;
  }
}
