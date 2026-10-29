import type { NativeRecord } from './weapon-skill-runtime';
import { nativeDamageResult } from './damage-result';

export interface LoadoutSpecialPose { uid: number; rootOwnerUid?: number; x: number; z: number; yawDegrees: number; alive: boolean }
export interface LoadoutSpecialBullet extends LoadoutSpecialPose { weaponId: number; rootOwnerUid: number }
export interface LoadoutSpecialFire {
  familyId: number; sourceKey: string; weaponId: number;
  position: { x: number; z: number }; yawDegrees: number;
  bulletFlag?: number;
  targetPosition?: { x: number; z: number };
  /** 251 replaces the emitted bullet's final collider/visual scale. */
  scaleOverride?: number;
  trajectoryOverride?: { name: 'LaserSymmetricByOwner'; LaserXPos: number; LaserYPos: number; PointShowDelay: number; LaserFireDelayTime: number };
}
export interface LoadoutSpecialEvent {
  /** The original event's entity identity; 219 falls back to owner only when
   * this entity cannot be resolved, whereas 238 requires a living attacker. */
  sourceEntityUid?: number; attackerUid?: number; targetUid?: number;
  weaponId?: number;
  /** Original EjectFlashChain event position and final-chain bit (217). */
  flashChain?: { position: { x: number; z: number }; finalHit: boolean };
}
export interface LoadoutSpecialHost {
  owner(familyId: number): LoadoutSpecialPose | undefined;
  entity(uid: number): LoadoutSpecialPose | undefined;
  bullets(): readonly LoadoutSpecialBullet[];
  fire(request: LoadoutSpecialFire): void;
  random(): number;
  hasBuff(familyId: number, buffId: number): boolean;
  addBuff(familyId: number, buffId: number): void;
  /** These are original AttributeOneElement catalog values (percentage points).
   * Replace the named contribution, then rebuild with the real mergeType. */
  replaceOwnerAttributeSource?(familyId: number, sourceKey: string, attributes: Readonly<Record<string, number>>): void;
  /** 222's pipe expressions are already native fractions; do not divide again.
   * This contribution belongs to the hit target, including its drop-rate attrs. */
  replaceTargetAttributeSource?(targetUid: number, sourceKey: string, attributes: Readonly<Record<string, number>>): void;
  /** Set only when fire() really consumes the trajectory override and the
   * common runtime supports LaserSymmetricByOwner's timing and owner following. */
  supportsSymmetricLaser?: boolean;
  /** Opposite-camp EntityCharacter inventory, in original manager order. */
  enemies?(familyId: number): readonly LoadoutSpecialPose[];
  orbit?(familyId: number): { totalBallCount: number; currentScale: number } | undefined;
  /** Resolved from the event weapon's SectorSpreadMod, using nativeSectorRadius.
   * Undefined for a different mod or missing event weapon. */
  lightningSector?(familyId: number, weaponId: number): { spreadAngle: number; maxLength: number } | undefined;
  /** Actual common event-attribute consumer for 215/217/218. */
  replaceWeaponAttributeSource?(familyId: number, sourceKey: string, weaponIds: readonly number[], nativeAttributes: Readonly<Record<string, number>>, condition?: { targetHpAtMost?: number; circularSlashOnly?: boolean }): void;
  replaceSameTargetComboSource?(familyId: number, sourceKey: string, config: { weaponId: number; attribute: 'Attack%'; add: number; max: number; intervalType: number } | undefined): void;
  replaceMissileBoostSource?(familyId: number, sourceKey: string, config: { everyFireCount: number; extraCount: number; attributes: Readonly<Record<string, number>> } | undefined): void;
  replaceCircularSlashSource?(familyId: number, sourceKey: string, config: { everySlashCount: number; rangeAddPercent: number; attributes: Readonly<Record<string, number>> } | undefined): void;
  /** Use the existing CharacterComponentFlySword implementation. The original
   * AutoCreate action does not create independent straight flying projectiles. */
  flySword?: {
    waitCount(familyId: number, checkCountType: number, weaponId: number): number;
    createOne(familyId: number, weaponId: number, ignoreMaxLimit: boolean): void;
  };
}
export interface LoadoutSpecialCommand { action: number; args: NativeRecord; sourceKey: string }
type CounterTask = { familyId: number; sourceKey: string; weaponId: number; attackerUid: number; remaining: number; interval: number; nextAt: number };
type SwordTask = { familyId: number; args: NativeRecord; elapsed: number; lastWaitCount: number; waitingForDecrease: boolean };
type BuffTask = { familyId: number; args: NativeRecord; elapsed: number; hasBuff: boolean };
type FrenzyTask = { familyId: number; args: NativeRecord; phase: 0 | 1 | 2; remaining: number };
type LightningTask = { familyId: number; sourceKey: string; args: NativeRecord; sector: { spreadAngle: number; maxLength: number }; remaining: number; nextAt: number };
type FanTask = { familyId: number; sourceKey: string; args: NativeRecord; state: 'waitRound' | 'waitEnemy' | 'firing' | 'inactive'; nextAt: number; total: number; fired: number; ballScale: number; used: Set<number>; lastTarget?: { x: number; z: number } };

export function nativeActionPipeAttributes(expressions: readonly string[] = []): Record<string, number> {
  const result: Record<string, number> = {};
  for (const expression of expressions) {
    const [name, value] = expression.split('|').map(part => part.trim());
    if (name && value !== undefined && Number.isFinite(Number(value))) result[name] = (result[name] || 0) + Number(value);
  }
  return result;
}

/** Native lock-step is 30 Hz. SnapIntervalToFrame rounds to a frame count then
 * divides with FP integer truncation; scheduling allows the raw-6 epsilon. */
export function nativeSpecialFrameInterval(seconds: number): number {
  return Math.trunc(nativeDamageResult(seconds * 30) * 65536 / 30) / 65536;
}

export function nativeFanTargets(owner: LoadoutSpecialPose, enemies: readonly LoadoutSpecialPose[], radius: number, angle: number): LoadoutSpecialPose[] {
  const yaw = owner.yawDegrees * Math.PI / 180, fx = Math.sin(yaw), fz = Math.cos(yaw);
  return enemies.filter(target => {
    const x = target.x - owner.x, z = target.z - owner.z, squared = x * x + z * z;
    if (!target.alive || squared > radius * radius || squared < 7 / 65536) return false;
    const dot = Math.max(-1, Math.min(1, (x * fx + z * fz) / Math.sqrt(squared)));
    return Math.acos(dot) * 180 / Math.PI <= angle / 2;
  });
}

/** 214 uses AttributeOneElement's Name=value encoding, unlike 222's pipes. */
export function nativePhaseAttributeValues(expression: string): Record<string, number> {
  const attributes: Record<string, number> = {};
  for (const item of String(expression || '').split('|')) {
    const separator = item.indexOf('='), name = item.slice(0, separator).trim(), value = Number(item.slice(separator + 1));
    if (separator > 0 && name && Number.isFinite(value)) attributes[name] = (attributes[name] || 0) + value;
  }
  return attributes;
}

export function nativeSymmetricLaserPlan(args: NativeRecord): Array<NonNullable<LoadoutSpecialFire['trajectoryOverride']>> {
  const count = Math.trunc(Number(args.LaserCount || 0)), result: Array<NonNullable<LoadoutSpecialFire['trajectoryOverride']>> = [];
  const fireDelay = Math.max(count - 1, 0) * Number(args.LaserShowInterval || 0) + Number(args.LaserFireDelayTime || 0);
  for (let i = 0; i < count; i++) for (const sign of [1, -1]) result.push({ name: 'LaserSymmetricByOwner',
    LaserXPos: sign * (Number(args.LaserXPos || 0) + i * Number(args.LaserXPerPos || 0)), LaserYPos: Number(args.LaserYPos || 0),
    PointShowDelay: i * Number(args.LaserShowInterval || 0), LaserFireDelayTime: fireDelay });
  return result;
}

/** Source-backed action host. It schedules original weapon/buff IDs and leaves
 * their actual bullet model, trajectory, hurt formula and buff class to the
 * common runtime. It neither changes coefficients nor replaces a missing
 * specialist component with a generic projectile. */
export class NativeLoadoutSpecialActions {
  private counters: CounterTask[] = [];
  private swords = new Map<string, SwordTask>();
  private buffs = new Map<string, BuffTask>();
  private frenzies = new Map<string, FrenzyTask>();
  private targetAttributes = new Map<string, { uid: number; values: Record<string, number> }>();
  private installations = new Map<string, { action: number; familyId: number }>();
  private lightnings: LightningTask[] = [];
  private fans = new Map<string, FanTask>();
  constructor(private readonly host: LoadoutSpecialHost) {}

  canHandle(action: number): boolean {
    return [219, 220, 238, 252].includes(action) || action === 250 && this.host.flySword !== undefined
      || action === 214 && this.host.replaceOwnerAttributeSource !== undefined
      || action === 221 && this.host.supportsSymmetricLaser === true
      || action === 222 && this.host.replaceTargetAttributeSource !== undefined
      || action === 215 && !!this.host.lightningSector && !!this.host.replaceWeaponAttributeSource && !!this.host.replaceSameTargetComboSource
      || action === 216 && !!this.host.replaceMissileBoostSource
      || action === 217 && !!this.host.replaceWeaponAttributeSource
      || action === 218 && !!this.host.replaceCircularSlashSource && !!this.host.replaceWeaponAttributeSource
      || action === 251 && !!this.host.enemies;
  }

  clear(): void {
    for (const key of new Set([...this.installations.keys(), ...this.frenzies.keys()])) this.remove(key);
    for (const [key, item] of this.targetAttributes) this.host.replaceTargetAttributeSource?.(item.uid, key, {});
    this.targetAttributes.clear(); this.counters = []; this.swords.clear(); this.buffs.clear(); this.lightnings = []; this.fans.clear();
  }
  remove(sourceKey: string): void {
    this.counters = this.counters.filter(item => item.sourceKey !== sourceKey);
    this.swords.delete(sourceKey); this.buffs.delete(sourceKey);
    const frenzy = this.frenzies.get(sourceKey);
    if (frenzy) this.host.replaceOwnerAttributeSource?.(frenzy.familyId, sourceKey, {});
    this.frenzies.delete(sourceKey);
    this.fans.delete(sourceKey); this.lightnings = this.lightnings.filter(item => item.sourceKey !== sourceKey);
    const installed = this.installations.get(sourceKey);
    if (installed) {
      this.host.replaceWeaponAttributeSource?.(installed.familyId, sourceKey, [], {});
      this.host.replaceWeaponAttributeSource?.(installed.familyId, `${sourceKey}:lowHp`, [], {});
      this.host.replaceSameTargetComboSource?.(installed.familyId, sourceKey, undefined);
      this.host.replaceMissileBoostSource?.(installed.familyId, sourceKey, undefined);
      this.host.replaceCircularSlashSource?.(installed.familyId, sourceKey, undefined);
      this.installations.delete(sourceKey);
    }
    for (const [key, item] of this.targetAttributes) if (key.startsWith(`${sourceKey}:target:`)) {
      this.host.replaceTargetAttributeSource?.(item.uid, key, {}); this.targetAttributes.delete(key);
    }
  }

  /** Call as the trigger/action is INSTALLED, even if its event has not fired.
   * Original 215—218 configuration lives in OnInit, while execute does the event. */
  install(command: LoadoutSpecialCommand, familyId: number): boolean {
    if (!this.canHandle(command.action)) return false;
    if (this.installations.has(command.sourceKey)) return true;
    this.installations.set(command.sourceKey, { action: command.action, familyId });
    const args = command.args;
    if ([215, 217].includes(command.action)) {
      const ids: number[] = args.DamageScaleWeaponIds?.length ? args.DamageScaleWeaponIds : [Number(args.LightningWeaponId)];
      this.host.replaceWeaponAttributeSource?.(familyId, command.sourceKey, ids, nativeActionPipeAttributes(args.ThunderDamageAttrs));
      if (command.action === 215 && Number(args.ConsecutiveHitDamageAddPercent) > 0)
        this.host.replaceSameTargetComboSource?.(familyId, command.sourceKey, { weaponId: Number(args.LightningWeaponId), attribute: 'Attack%', add: Number(args.ConsecutiveHitDamageAddPercent), max: Number(args.MaxConsecutiveDamageAddPercent), intervalType: Number(args.ComboIntervalType || 0) });
    } else if (command.action === 216) this.host.replaceMissileBoostSource?.(familyId, command.sourceKey, {
      everyFireCount: Math.trunc(Number(args.FireInterval)) > 0 ? Math.trunc(Number(args.FireInterval)) : 4,
      extraCount: Math.trunc(Number(args.ExtraMissileCount)) > 0 ? Math.trunc(Number(args.ExtraMissileCount)) : 1,
      attributes: args.EnableDamageAttrs ? nativeActionPipeAttributes(args.DamageAttrs) : {},
    });
    else if (command.action === 218) {
      this.host.replaceCircularSlashSource?.(familyId, command.sourceKey, { everySlashCount: Math.trunc(Number(args.SlashInterval)), rangeAddPercent: Number(args.RangeAddPercent || 0), attributes: nativeActionPipeAttributes(args.DamageAttrs) });
      // WeaponFilterType14 reads the bullet's IsCircularSlash marker (not a
      // trait bit). TargetFilterType3 compares the struck enemy's HP ratio.
      if (Number(args.LowHpThreshold) > 0 && args.LowHpDamageAttrs?.length)
        this.host.replaceWeaponAttributeSource?.(familyId, `${command.sourceKey}:lowHp`, [], nativeActionPipeAttributes(args.LowHpDamageAttrs), { targetHpAtMost: Number(args.LowHpThreshold), circularSlashOnly: true });
    } else if (command.action === 250 && !this.swords.has(command.sourceKey)) {
      const task: SwordTask = { familyId, args: { ...args }, elapsed: 0, lastWaitCount: 0, waitingForDecrease: false };
      this.swords.set(command.sourceKey, task);
      // CreateOnInit is genuinely OnInit, independent of TriggerNow/events.
      if (args.CreateOnInit) { this.createSwordBatch(task); task.waitingForDecrease = true; }
    }
    return true;
  }

  /** Host invokes once for the matching native action execution. 250/252 install
   * a persistent action; repeated syncs with the same sourceKey do not reset it. */
  execute(command: LoadoutSpecialCommand, familyId: number, now: number, event: LoadoutSpecialEvent = {}): boolean {
    if (!this.canHandle(command.action)) return false;
    this.install(command, familyId);
    const owner = this.host.owner(familyId), args = command.args;
    if (!owner?.alive) return true;
    const fire = (weaponId: number, position: { x: number; z: number }, yawDegrees: number) => this.host.fire({ familyId, sourceKey: command.sourceKey, weaponId, position: { ...position }, yawDegrees });
    if (command.action === 214) {
      if (!this.frenzies.has(command.sourceKey)) this.frenzies.set(command.sourceKey, { familyId, args: { ...args }, phase: 0, remaining: Math.max(0, Number(args.Cooldown || 0)) });
    } else if (command.action === 215) {
      const sector = this.host.lightningSector?.(familyId, Number(event.weaponId || 0));
      if (!sector || sector.maxLength <= 0) return true;
      const min = Math.trunc(Number(args.MinCount || 0)), max = Math.trunc(Number(args.MaxCount || 0));
      const count = min + Math.floor(this.host.random() * (max - min + 1));
      if (count < 1) return true;
      const task: LightningTask = { familyId, sourceKey: command.sourceKey, args: { ...args }, sector, remaining: count, nextAt: now };
      if (Number(args.FireInterval) > 0) this.lightnings.push(task);
      else while (task.remaining-- > 0) this.spawnLightning(task);
    } else if (command.action === 217) {
      if (!event.flashChain || Number(args.LightningWeaponId) <= 0) return true;
      const guaranteed = Boolean(args.GuaranteedOnFinalChainHit) && event.flashChain.finalHit;
      if (guaranteed || Number(args.Chance) > 0 && this.host.random() < Number(args.Chance)) fire(Number(args.LightningWeaponId), event.flashChain.position, 0);
    } else if (command.action === 219) {
      const count = Math.trunc(Number(args.BulletCount || 0));
      if (count < 1) return true;
      const source = event.sourceEntityUid === undefined ? undefined : this.host.entity(event.sourceEntityUid);
      const pose = source || owner;
      for (let i = 0; i < count; i++) fire(Number(args.WeaponId), pose, (source?.yawDegrees || 0) + i * 360 / count);
    } else if (command.action === 220) {
      const sourceIds: number[] = args.SourceWeaponIds || [];
      if (!sourceIds.length) return true;
      // Copy the inventory before firing; newly created children are not added
      // to the native FillBulletEntities snapshot being iterated.
      const snapshot = [...this.host.bullets()];
      const count = Math.trunc(Number(args.CreateCount || 0)), type = Number(args.CreateType || 0);
      if (count < 1 || ![0, 1].includes(type)) return true;
      for (const bullet of snapshot) if (bullet.alive && bullet.rootOwnerUid === (owner.rootOwnerUid ?? owner.uid) && sourceIds.includes(bullet.weaponId)) {
        for (let i = 0; i < count; i++) fire(Number(args.FireWeaponId), bullet, type === 1 ? i * 360 / count : 0);
      }
    } else if (command.action === 221) {
      for (const trajectoryOverride of nativeSymmetricLaserPlan(args)) this.host.fire({ familyId, sourceKey: command.sourceKey,
        weaponId: Number(args.WeaponId), position: { x: owner.x, z: owner.z }, yawDegrees: owner.yawDegrees,
        bulletFlag: Number(args.BulletFlag || 0), trajectoryOverride });
    } else if (command.action === 222) {
      if (event.targetUid === undefined || !this.host.entity(event.targetUid)) return true;
      const key = `${command.sourceKey}:target:${event.targetUid}`;
      let item = this.targetAttributes.get(key);
      if (!item) this.targetAttributes.set(key, item = { uid: event.targetUid, values: {} });
      for (const expression of (args.Attrs || []) as string[]) {
        const parts = expression.split('|').map(part => part.trim());
        if (parts.length !== 3 || !parts[0]) continue;
        const delta = Number(parts[1]), max = Number(parts[2]);
        if (!Number.isFinite(delta) || !Number.isFinite(max)) continue;
        const next = (item.values[parts[0]] || 0) + delta;
        item.values[parts[0]] = max > 0 ? Math.max(-max, Math.min(max, next)) : next;
      }
      this.host.replaceTargetAttributeSource?.(item.uid, key, { ...item.values });
    } else if (command.action === 238) {
      if (event.attackerUid === undefined) return true;
      const count = Number(args.FireCountType) === 2
        ? Math.trunc(Number(args.MinFireCount || 0)) + Math.floor(this.host.random() * (Math.trunc(Number(args.MaxFireCount || 0)) - Math.trunc(Number(args.MinFireCount || 0)) + 1))
        : Math.trunc(Number(args.FireCount || 0));
      if (count < 1) return true;
      const task: CounterTask = { familyId, sourceKey: command.sourceKey, weaponId: Number(args.WeaponId), attackerUid: event.attackerUid, remaining: count - 1, interval: Number(args.FireInterval || 0), nextAt: now + Number(args.FireInterval || 0) };
      this.counterFire(task);
      if (task.remaining > 0) this.counters.push(task);
    } else if (command.action === 250) {
      // Installation above owns this persistent action's OnInit behavior.
    } else if (command.action === 251) {
      if (this.fans.has(command.sourceKey)) return true;
      const task: FanTask = { familyId, sourceKey: command.sourceKey, args: { ...args }, state: 'inactive', nextAt: 0, total: 0, fired: 0, ballScale: 0, used: new Set() };
      this.fans.set(command.sourceKey, task);
      if (args.FireImmediately) this.beginFanRound(task, now);
      else if (Number(args.RoundInterval) > 0) { task.state = 'waitRound'; task.nextAt = now + nativeSpecialFrameInterval(Number(args.RoundInterval)); }
    } else if (command.action === 252) {
      if (this.buffs.has(command.sourceKey)) return true;
      const task: BuffTask = { familyId, args: { ...args }, elapsed: 0, hasBuff: this.host.hasBuff(familyId, Number(args.BuffId)) };
      this.buffs.set(command.sourceKey, task);
      if (!task.hasBuff && args.Immediate) this.addIntervalBuff(task);
    }
    return true;
  }

  /** Native updates consume at most one overdue shot/batch per frame. Rebase
   * on the current clock; do not catch up by replaying every missed interval. */
  step(deltaTime: number, now: number): void {
    for (let i = this.lightnings.length - 1; i >= 0; i--) {
      const task = this.lightnings[i];
      // This action alone catches up all overdue strikes from NextFireTime.
      while (task.remaining > 0 && now >= task.nextAt) {
        this.spawnLightning(task); task.remaining--; task.nextAt += Number(task.args.FireInterval);
      }
      if (task.remaining <= 0) this.lightnings.splice(i, 1);
    }
    for (const task of this.fans.values()) {
      if (!this.host.owner(task.familyId)?.alive) { task.state = 'inactive'; continue; }
      if (task.state === 'waitRound') { if (now >= task.nextAt - 6 / 65536) this.beginFanRound(task, now); continue; }
      if (task.state === 'waitEnemy') {
        if (!this.fanCandidates(task).length) continue;
        task.state = 'firing'; task.nextAt = now;
      }
      if (task.state !== 'firing' || now < task.nextAt - 6 / 65536) continue;
      if (task.fired < task.total) {
        this.fireFanOnce(task); task.fired++;
        const interval = Number(task.args.FireIntervalType) === 1
          ? Number(task.args.FireIntervalMin) + this.host.random() * (Number(task.args.FireIntervalMax) - Number(task.args.FireIntervalMin))
          : Number(task.args.FireInterval || 0);
        task.nextAt = now + nativeSpecialFrameInterval(interval);
      }
      if (task.fired >= task.total) this.completeFanRound(task, now);
    }
    for (const [key, task] of this.frenzies) {
      if (!this.host.owner(task.familyId)?.alive) continue;
      task.remaining -= deltaTime;
      if (task.remaining > 0) continue;
      if (task.phase === 0) this.enterFrenzyPhase(key, task, 1);
      else if (task.phase === 1 && !task.args.DisableWeakness && Number(task.args.WeakDuration) > 0) this.enterFrenzyPhase(key, task, 2);
      else this.enterFrenzyPhase(key, task, 0);
    }
    for (let i = this.counters.length - 1; i >= 0; i--) {
      const task = this.counters[i];
      if (!this.host.owner(task.familyId)?.alive) { this.counters.splice(i, 1); continue; }
      if (now < task.nextAt) continue;
      this.counterFire(task); task.remaining--; task.nextAt = now + task.interval;
      if (task.remaining <= 0) this.counters.splice(i, 1);
    }
    for (const task of this.swords.values()) {
      if (!this.host.owner(task.familyId)?.alive || !this.host.flySword) continue;
      const count = this.host.flySword.waitCount(task.familyId, Number(task.args.CheckCountType || 0), Number(task.args.WeaponID));
      if (task.waitingForDecrease) {
        if (Number(task.args.CheckCountType) !== 0 && count > 0 && count >= task.lastWaitCount) { task.lastWaitCount = count; continue; }
        task.waitingForDecrease = false; task.elapsed = 0;
      }
      task.lastWaitCount = count; task.elapsed += deltaTime;
      if (task.elapsed >= Number(task.args.CreateInterval || 0)) { task.elapsed = 0; this.createSwordBatch(task); task.waitingForDecrease = true; }
    }
    for (const task of this.buffs.values()) {
      if (!this.host.owner(task.familyId)?.alive) continue;
      const has = this.host.hasBuff(task.familyId, Number(task.args.BuffId));
      if (has !== task.hasBuff) { task.hasBuff = has; task.elapsed = 0; }
      if (task.hasBuff) continue;
      task.elapsed += deltaTime;
      if (task.elapsed >= Number(task.args.Interval || 0)) { task.elapsed = 0; this.addIntervalBuff(task); }
    }
  }

  private spawnLightning(task: LightningTask): void {
    const owner = this.host.owner(task.familyId);
    if (!owner || Number(task.args.LightningWeaponId) <= 0) return;
    const half = task.sector.spreadAngle * (26214 / 65536);
    const yaw = (owner.yawDegrees + (this.host.random() * 2 - 1) * half) * Math.PI / 180;
    const distance = this.host.random() * task.sector.maxLength;
    this.host.fire({ familyId: task.familyId, sourceKey: task.sourceKey, weaponId: Number(task.args.LightningWeaponId), position: { x: owner.x + Math.sin(yaw) * distance, z: owner.z + Math.cos(yaw) * distance }, yawDegrees: 0 });
  }

  private fanCandidates(task: FanTask): LoadoutSpecialPose[] {
    const owner = this.host.owner(task.familyId);
    return owner ? nativeFanTargets(owner, this.host.enemies?.(task.familyId) || [], Number(task.args.FanRadius), Number(task.args.FanAngle)) : [];
  }

  private beginFanRound(task: FanTask, now: number): void {
    const orbit = this.host.orbit?.(task.familyId);
    const type = Number(task.args.FireCountType || 0);
    task.total = type === 0 ? 1 : type === 1 ? Math.trunc(Number(task.args.FireCount)) : type === 2 ? orbit ? orbit.totalBallCount + 1 : 0 : 0;
    task.fired = 0; task.ballScale = task.args.IsSyncBallScale ? orbit?.currentScale || 0 : 0; task.used.clear(); task.lastTarget = undefined;
    if (task.total <= 0) { this.completeFanRound(task, now); return; }
    task.state = Number(task.args.TargetType || 0) === 0 || this.fanCandidates(task).length > 0 ? 'firing' : 'waitEnemy'; task.nextAt = now;
  }

  private completeFanRound(task: FanTask, now: number): void {
    if (Number(task.args.RoundInterval) > 0) { task.state = 'waitRound'; task.nextAt = now + nativeSpecialFrameInterval(Number(task.args.RoundInterval)); }
    else if (task.total > 0) this.beginFanRound(task, now);
    else task.state = 'inactive'; // Shipped configurations all have RoundInterval>0.
  }

  private fireFanOnce(task: FanTask): void {
    const owner = this.host.owner(task.familyId);
    if (!owner) return;
    const candidates = Number(task.args.TargetType || 0) ? this.fanCandidates(task) : [];
    let target: LoadoutSpecialPose | undefined;
    if (candidates.length) {
      let available = candidates;
      if (Number(task.args.TargetType) === 2) {
        available = candidates.filter(item => !task.used.has(item.uid));
        if (!available.length) { task.used.clear(); available = candidates; }
      }
      target = available[Math.floor(this.host.random() * available.length)];
      if (Number(task.args.TargetType) === 2) task.used.add(target.uid);
    }
    let targetPosition = target ? { x: target.x, z: target.z } : task.lastTarget;
    let yawDegrees: number;
    if (targetPosition) {
      yawDegrees = Math.atan2(targetPosition.x - owner.x, targetPosition.z - owner.z) * 180 / Math.PI;
      if (target) task.lastTarget = { ...targetPosition };
    } else {
      yawDegrees = owner.yawDegrees + (this.host.random() - 0.5) * Number(task.args.FanAngle);
      if (Number(task.args.RandomDirDistance) > 0) {
        const yaw = yawDegrees * Math.PI / 180;
        targetPosition = { x: owner.x + Math.sin(yaw) * Number(task.args.RandomDirDistance), z: owner.z + Math.cos(yaw) * Number(task.args.RandomDirDistance) };
      }
    }
    this.host.fire({ familyId: task.familyId, sourceKey: task.sourceKey, weaponId: Number(task.args.WeaponId), position: { x: owner.x, z: owner.z }, yawDegrees, bulletFlag: Number(task.args.BulletFlag || 0), targetPosition,
      scaleOverride: task.args.IsSyncBallScale && task.ballScale !== 0 ? task.ballScale : undefined });
  }

  /** 214 observes an actual HP decrease, including how much the host has already
   * reduced the hit. Only its cooldown phase is shortened; frenzy is unchanged. */
  ownerHpChanged(familyId: number, previous: number, current: number): void {
    if (current >= previous) return;
    for (const task of this.frenzies.values()) if (task.familyId === familyId && task.phase === 0 && task.args.ReduceCooldownOnHurt)
      task.remaining = Math.max(0, task.remaining - Math.max(0, Number(task.args.ReduceCooldownSeconds || 0)));
  }

  private enterFrenzyPhase(key: string, task: FrenzyTask, phase: 0 | 1 | 2): void {
    task.phase = phase;
    task.remaining = Math.max(0, Number(task.args[phase === 0 ? 'Cooldown' : phase === 1 ? 'FrenzyDuration' : 'WeakDuration'] || 0));
    this.host.replaceOwnerAttributeSource?.(task.familyId, key, phase === 0 ? {} : nativePhaseAttributeValues(task.args[phase === 1 ? 'FrenzyAttrs' : 'WeakAttrs']));
    // Native immediately skips a zero-duration phase. Cooldown waits until the
    // next OnUpdate, preventing an infinite loop when all three durations are 0.
    if (phase === 1 && task.remaining <= 0) this.enterFrenzyPhase(key, task,
      !task.args.DisableWeakness && Number(task.args.WeakDuration) > 0 ? 2 : 0);
    else if (phase === 2 && task.remaining <= 0) this.enterFrenzyPhase(key, task, 0);
  }

  private counterFire(task: CounterTask): void {
    const attacker = this.host.entity(task.attackerUid);
    if (!attacker?.alive) return;
    this.host.fire({ familyId: task.familyId, sourceKey: task.sourceKey, weaponId: task.weaponId, position: { x: attacker.x, z: attacker.z }, yawDegrees: 0 });
  }
  private createSwordBatch(task: SwordTask): void {
    const component = this.host.flySword;
    if (!component) return;
    for (let i = 0; i < Number(task.args.CreateCount || 0); i++) component.createOne(task.familyId, Number(task.args.WeaponID), Boolean(task.args.IgnoreMaxLimit));
    task.lastWaitCount = component.waitCount(task.familyId, Number(task.args.CheckCountType || 0), Number(task.args.WeaponID));
  }
  private addIntervalBuff(task: BuffTask): void {
    this.host.addBuff(task.familyId, Number(task.args.BuffId));
    task.hasBuff = this.host.hasBuff(task.familyId, Number(task.args.BuffId)); task.elapsed = 0;
  }
}
