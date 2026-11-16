/** Native weapon-pool buffs. Evidence: research/status-effects-fix.md and
 * weapon-continue-status-native.txt; class IDs from Buff_name.json.
 * Class10: loadout-buff-sync-to-bullets.arm64.txt, owner additions in
 * loadout-buff-base-addattrs.arm64.txt, cap in loadout-buff-layer-boundaries.arm64.txt.
 * Class10's capped owner layers and uncapped per-bullet sync cache are separate. */
import { nativeUpdatedBuffTime } from './native-loadout-time-scale';
import { nativeHurtTypeFromExpressions } from './native-back-death';
export interface HitBuffMod {
  buffId: number;
  probability: number;
  forceAdd?: boolean;
  /** Action-owned duration (e.g. the beam ceasefire window). */
  duration?: number;
}

export interface StatusSource {
  buffAttributes?: Readonly<Record<string, number>>;
  /** BuffClearEvent_Time.OnInit@69fc48c: normalized caster seconds, class8 only. */
  timeShieldExtraDuration?: number;
  /** AttributeData.GetAttack at application, not the triggering projectile's damage. */
  attack: number;
  familyId: number;
  weaponId: number;
}

export interface StatusBulletSyncHost {
  /** Direct EntityBullet.OwnerEntity identity, not its root hero. A player
   * weapon character and its hero must have different ownerKey values. */
  bullets(): readonly { uid: number; ownerKey: number; weaponId: number; alive: boolean }[];
  /** Convert a table entry (Attack%=5) using the original attribute definition
   * into its incoming value (.05), not mergeType2's remaining factor. */
  normalizeAttribute(name: string, tableValue: number): number;
  /** One native MergeAttributes call. reverse=true undoes this exact incoming
   * contribution with the attribute's original merge rule. For250001 Attack%
   * mergeType0 this is +/- .05; do not negate mergeType2 remaining factors. */
  mergeAttributes(bulletUid: number, attributes: readonly { name: string; value: number }[], reverse: boolean): void;
}

export interface StatusPulse extends StatusSource {
  targetUid: number;
  buffId: number;
  element: number;
  /** Lethal death type comes from the expression, not ElementType. */
  hurtType: number;
  /** Pre-defence damage. Do not roll projectile critical or copy pierce multipliers. */
  damage: number;
}

export interface BuffDefinition {
  ID: number;
  prefabId?: number;
  posType?: number;
  clearEvent?: number;
  clearParam: number;
  stackingType: number;
  triggerType: number;
  triggerInterval: number;
  damageType: number;
  AddAttributes: string[];
  triggerAttributes: string[];
  triggerAddAttributes?: string[];
  buffClassName?: number;
  buffFlag?: number;
  buffType?: number;
  maxStackCount?: number;
  parameters?: string;
}

interface ActiveStatus {
  definition: BuffDefinition;
  source: StatusSource;
  remaining: number;
  initialDuration: number;
  triggerTimer: number;
  triggerNextFrame: boolean;
  layers: number;
  layerTimes: number[];
  shield: number;
  createTimer: number;
  age: number;
  triggerCount: number;
  parameters: Record<string, number>;
  /** Class10 tracks how many synchronizations each existing bullet received.
   * This is distinct from the owner's capped BuffBase layer count. */
  syncedBullets?: Map<number, number>;
}

export interface StatusModifiers {
  damageTaken: number;
  moveSpeed: number;
  attackSpeed: number;
  immobile: boolean;
  invincible: boolean;
}

export interface StatusWeaponFire extends StatusSource { targetUid: number; buffId: number; createdWeaponId: number }

/** Only owns gameplay state; callers retain damage, kill, pickup and UI ownership. */
export class EnemyStatusEffects {
  private readonly active = new Map<number, Map<number, ActiveStatus>>();
  private readonly weaponFires: StatusWeaponFire[] = [];
  /** BuffBase.End only; callback observes attributes before DeInit. */
  onEnd?: (targetUid: number, buffId: number) => void;
  onAdd?: (targetUid: number, buffId: number, source: StatusSource) => void;

  constructor(private readonly definitions: Record<string, BuffDefinition>, private readonly bulletSync?: StatusBulletSyncHost) {}

  clear(targetUid?: number): void {
    if (targetUid === undefined) {
      for (const statuses of this.active.values()) for (const status of statuses.values()) this.removeSyncedBulletAttributes(status);
      this.active.clear(); this.weaponFires.length = 0;
    } else {
      for (const status of this.active.get(targetUid)?.values() || []) this.removeSyncedBulletAttributes(status);
      this.active.delete(targetUid);
    }
  }

  /** Radius trigger exit/Undo explicitly removes its buff, independent of duration. */
  remove(targetUid: number, buffId: number): void {
    const statuses = this.active.get(targetUid);
    const status = statuses?.get(buffId);
    if (status) this.removeSyncedBulletAttributes(status);
    statuses?.delete(buffId);
    if (!statuses?.size) this.active.delete(targetUid);
  }

  private end(targetUid: number, buffId: number): void {
    const status = this.active.get(targetUid)?.get(buffId);
    if (!status) return;
    this.onEnd?.(targetUid, buffId);
    // A callback may replace/remove the buff; never erase a replacement.
    if (this.active.get(targetUid)?.get(buffId) === status) this.remove(targetUid, buffId);
  }

  /** Action95 changes the event target's time-clear rule, preserving the
   * caster, layer count and pulse phase. TimeScale adds initial duration. */
  updateTimes(targetUid: number, args: Record<string, any>): void {
    for (const [buffId, status] of this.active.get(targetUid) || []) {
      const selection = { buffId, buffFlag: status.definition.buffFlag || 0, buffType: status.definition.buffType || 0,
        clearEvent: status.definition.clearEvent || 0, initialDuration: status.initialDuration };
      const next = nativeUpdatedBuffTime({ ...selection, remaining: status.remaining }, args);
      if (next === undefined) continue;
      status.remaining = next;
      // Native AddClearTime touches its single clear-rule counter. Independent
      // layer clocks are not rewritten by this action (current source targets
      // use stackingType1/6; broader combinations remain unverified).
    }
  }

  /** Mod repeats add Rate before a single hit roll (BuffModProcessor.AddModRepeat). */
  static mergeMods(mods: readonly HitBuffMod[]): HitBuffMod[] {
    const merged = new Map<number, HitBuffMod>();
    for (const mod of mods) {
      const existing = merged.get(mod.buffId);
      if (existing) existing.probability += mod.probability;
      else merged.set(mod.buffId, { ...mod });
    }
    return [...merged.values()];
  }

  /** Invoke for BulletAddBuffToTarget, not once per rendered frame or per shot. */
  hit(targetUid: number, mods: readonly HitBuffMod[], source: StatusSource,
      random: () => number, immune = false, targetAttributes: Readonly<Record<string, number>> = {}): StatusPulse[] {
    const pulses: StatusPulse[] = [];
    for (const mod of EnemyStatusEffects.mergeMods(mods)) {
      const definition = this.definitions[mod.buffId];
      if (!definition) throw new Error(`Missing native buff ${mod.buffId}`);
      const armorBreak = definition.buffFlag === 7;
      if (!armorBreak && immune && !mod.forceAdd) continue;
      if (![1, 4, 6, 8, 9, 10, 12].includes(definition.buffClassName ?? 1)) throw new Error(`Unsupported native buff class ${definition.buffClassName} (${mod.buffId})`);
      if (definition.buffClassName === 10 && !this.bulletSync) throw new Error(`Native buff ${mod.buffId} requires the direct-owner bullet synchronization host`);
      if (definition.buffClassName === 10 && (definition.triggerAttributes.length || definition.triggerAddAttributes?.length)) throw new Error(`Native sync buff ${mod.buffId} trigger-attribute synchronization is not installed`);
      if (armorBreak) {
        if (mod.probability !== 0 && mod.probability !== 1) {
          const raw = (value: number) => BigInt(Math.round(value * 65536));
          const multiply = (left: bigint, right: bigint) => left * right >> 16n;
          const caster = source.buffAttributes || {};
          const factors = multiply(multiply(65536n + raw(caster['ArmorBreakBuffRate%'] || 0),
            65536n - raw(targetAttributes['ArmorBreakBuffRateResist%'] || 0)),
            65536n + raw(targetAttributes['NegativeBuffRate%'] || 0));
          const rate = Number(multiply(raw(mod.probability), factors > 0n ? factors : 0n)) / 65536;
          if (rate <= 0 || rate < 1 && random() >= rate) continue;
        }
        if (immune) continue;
      } else {
        if (mod.probability <= 0) continue;
        if (mod.probability < 1 && random() >= mod.probability) continue;
      }
      let statuses = this.active.get(targetUid);
      if (!statuses) { statuses = new Map(); this.active.set(targetUid, statuses); }
      const current = statuses.get(mod.buffId);
      // Only clearEvent=1 is elapsed time. The count shield 100103 uses
      // clearEvent=3 (being hit), with clearParam=0; zero is not zero lifetime.
      const baseDuration = definition.clearEvent === 1 && definition.clearParam > 0 ? definition.clearParam : Infinity;
      let shieldDuration = definition.buffClassName === 8 && Number.isFinite(baseDuration)
        ? baseDuration + (source.timeShieldExtraDuration || 0) : baseDuration;
      if (armorBreak && Number.isFinite(baseDuration)) {
        const raw = (value: number) => BigInt(Math.round(value * 65536));
        const caster = source.buffAttributes || {};
        const scale = 65536n + raw(caster['ArmorBreakBuffTime%'] || 0)
          + raw(caster['NegativeBuffTime%'] || 0) - raw(targetAttributes['ArmorBreakBuffTimeResist%'] || 0);
        shieldDuration = Number(raw(baseDuration) * scale >> 16n) / 65536;
      }
      // Refresh resets the existing clear-rule duration without resampling the
      // new caster; explicit action duration remains an override.
      const duration = mod.duration ?? (current && definition.stackingType >= 1 && definition.stackingType <= 4
        ? current.initialDuration : shieldDuration > 0 ? shieldDuration : Infinity);
      if (current && definition.stackingType === 5) continue;
      if (current && definition.stackingType >= 1 && definition.stackingType <= 4) {
        // Refresh only: original attacker snapshot and tick phase remain unchanged.
        if (definition.stackingType !== 2) current.remaining = definition.stackingType === 4 ? current.remaining + duration : duration;
        if (definition.stackingType >= 2 && current.layers < Number(definition.maxStackCount || 1)) {
          current.layers++;
          current.layerTimes.push(duration);
        }
        if (definition.buffClassName === 8) current.shield = Math.min(current.parameters.MaxCount || 1, current.shield + (current.parameters.AddCount || current.parameters.Count || 1));
        // TryAddLayer@69f7f68 invokes OnAddLayer even when AddLayerInternal
        // clamps the owner's count at maxStackCount. Class10 consequently adds
        // one more copy to currently live bullets on a capped refresh too.
        this.syncAttributesToBullets(targetUid, current);
        continue;
      }
      const parameters: Record<string, number> = definition.parameters ? JSON.parse(definition.parameters) : {};
      const status: ActiveStatus = {
        definition, source: { ...source }, remaining: duration, initialDuration: duration, triggerTimer: 0,
        triggerNextFrame: definition.triggerType === 5,
        layers: 1, layerTimes: [duration], parameters, shield: definition.buffClassName === 8 ? Number(parameters.Count || 1) : 0, createTimer: 0, age: 0, triggerCount: 0,
        syncedBullets: definition.buffClassName === 10 ? new Map() : undefined,
      };
      // Type 6 replaces the old fire status, reinitializing both duration and immediate tick.
      if (current) this.removeSyncedBulletAttributes(current);
      statuses.set(mod.buffId, status);
      this.syncAttributesToBullets(targetUid, status);
      if (definition.triggerType === 2 || definition.triggerType === 3) {
        const pulse = this.pulse(targetUid, status);
        if (pulse) pulses.push(pulse);
      }
      this.onAdd?.(targetUid, mod.buffId, status.source);
    }
    return pulses;
  }

  /** Called once per active simulation step; paused/upgrade/treasure time must not enter. */
  advance(dt: number, isAlive: (targetUid: number) => boolean, random?: () => number): StatusPulse[] {
    const pulses: StatusPulse[] = [];
    if (!(dt > 0)) return pulses;
    for (const [targetUid, statuses] of this.active) {
      if (!isAlive(targetUid)) { this.clear(targetUid); continue; }
      for (const [buffId, status] of statuses) {
        const definition = status.definition;
        status.age += dt;
        // Init_Trigger@0x69f5130 schedules type 5 for the next update, before
        // its independent interval counter advances (OnUpdate_Trigger@0x69f6a8c).
        if (status.triggerNextFrame) {
          status.triggerNextFrame = false;
          const pulse = this.pulse(targetUid, status);
          if (pulse) pulses.push(pulse);
        }
        // Native OnUpdate calls OnUpdate_Trigger before the clear-event timer.
        if (definition.triggerType >= 3 && definition.triggerType <= 5 && definition.triggerInterval > 0) {
          status.triggerTimer += dt;
          if (status.triggerTimer >= definition.triggerInterval) {
            status.triggerTimer -= definition.triggerInterval;
            const pulse = this.pulse(targetUid, status);
            if (pulse) pulses.push(pulse);
          }
        }
        status.remaining -= dt;
        if (definition.stackingType === 2) {
          const previousLayers = status.layers;
          status.layerTimes = status.layerTimes.map(time => time - dt).filter(time => time > 0);
          status.layers = status.layerTimes.length;
          this.removeSyncedBulletAttributes(status, previousLayers - status.layers);
          if (!status.layers) this.end(targetUid, buffId);
        } else if (status.remaining <= 0) this.end(targetUid, buffId);
        // Buff_CreateWeapon calls base update first and does not fire after
        // expiry. Its own timer RESETs to zero; it does not retain overshoot.
        if (statuses.has(buffId) && definition.buffClassName === 9) {
          status.createTimer += dt;
          if (status.createTimer >= Number(status.parameters.TriggerInterval || 0)) {
            status.createTimer = 0;
            if (!random) throw new Error('Native create-weapon buff requires the battle RNG');
            const probability = Number(status.parameters.Probability || 0);
            if (probability > 0 && (probability >= 1 || random() < probability)) this.weaponFires.push({ ...status.source, targetUid, buffId, createdWeaponId: status.parameters.WeaponId });
          }
        }
      }
      if (!statuses.size) this.active.delete(targetUid);
    }
    return pulses;
  }

  modifiers(targetUid: number): StatusModifiers {
    let damageTaken = 1, moveSpeedBonus = 0, attackSpeedBonus = 0;
    let immobile = false, invincible = false;
    for (const status of this.active.get(targetUid)?.values() ?? []) {
      immobile ||= status.definition.buffClassName === 4;
      // Buff_InvinciblePlayerReborn@6a0306c inherits Buff_Invincible unchanged.
      invincible ||= status.definition.buffClassName === 6 || status.definition.buffClassName === 12;
      for (const attribute of status.definition.AddAttributes) {
        const [name, raw] = attribute.split('=');
        const value = Number(raw) / 100;
        if (!Number.isFinite(value)) continue;
        if (name === 'HurtDecrease%') for (let layer = 0; layer < status.layers; layer++) damageTaken = Math.floor(damageTaken * (value === 1 ? 655 / 65536 : 1 - value) * 65536) / 65536;
        else if (name === 'MoveSpeed%') moveSpeedBonus += value * status.layers;
        else if (name === 'AttackSpeed%') attackSpeedBonus += value * status.layers;
      }
    }
    return { damageTaken, moveSpeed: immobile ? 0 : Math.max(0, 1 + moveSpeedBonus), attackSpeed: immobile ? 0 : Math.max(0, 1 + attackSpeedBonus), immobile, invincible };
  }

  /** Raw table entries, one per layer; caller applies AttributeDefinitions.
   * Keeping entries separate preserves multiplicative reduction merge rules. */
  attributeEntries(targetUid: number): { name: string; value: number }[] {
    const entries: { name: string; value: number }[] = [];
    for (const status of this.active.get(targetUid)?.values() ?? []) for (let layer = 0; layer < status.layers; layer++) {
      for (const encoded of status.definition.AddAttributes || []) {
        const [name, value] = encoded.split('=');
        entries.push({ name, value: Number(value) });
      }
    }
    return entries;
  }

  flags(targetUid: number): number[] {
    return [...new Set([...(this.active.get(targetUid)?.values() ?? [])].map(s => Number(s.definition.buffFlag || 0)).filter(Boolean))];
  }
  flagSourceWeaponIds(targetUid: number): Record<number, number[]> {
    const sources: Record<number, number[]> = {};
    for (const status of this.active.get(targetUid)?.values() || []) {
      const flag = Number(status.definition.buffFlag || 0);
      if (!flag) continue;
      const weapons = sources[flag] ||= [];
      if (!weapons.includes(status.source.weaponId)) weapons.push(status.source.weaponId);
    }
    return sources;
  }
  /** BuffBase.DoTriggerAttributes merges these AFTER each triggered hurt and
   * removes every accumulated entry when the buff ends. Preserve the original
   * state separately from AddAttributes. Do not invent a damage multiplier for
   * a legacy attribute without an active native damage consumer. */
  triggerAttributeEntries(targetUid: number): { name: string; value: number }[] {
    return [...this.active.get(targetUid)?.values() ?? []].flatMap(status =>
      Array.from({ length: status.triggerCount }, () => (status.definition.triggerAddAttributes || []).map(expression => {
        const [name, raw] = expression.split('='); return { name, value: Number(raw) };
      })).flat());
  }
  has(targetUid: number, buffId: number): boolean { return this.active.get(targetUid)?.has(buffId) ?? false; }

  /** View state follows the actual buff lifetime, including explicit removals
   * and depleted shields; no separate visual timer can outlive the effect. */
  visuals(): { targetUid: number; buffId: number; modelId: number; age: number; posType: number; duration: number; remaining: number; damage?: number }[] {
    return [...this.active].flatMap(([targetUid, statuses]) => [...statuses.values()].flatMap(status =>
      status.definition.prefabId ? [{ targetUid, buffId: status.definition.ID, modelId: status.definition.prefabId,
        age: status.age, posType: Number(status.definition.posType || 0),
        duration: status.age + status.remaining, remaining: status.remaining,
        damage: (() => { const coefficient = status.definition.triggerAttributes[0]?.match(/^ElementAttack(?:Fire|Ice|Poison)=1\*([\d.]+)%$/); return coefficient ? status.source.attack * Number(coefficient[1]) / 100 * status.layers : undefined; })() }] : []));
  }

  /** Native count shield blocks one eligible hurt, irrespective of its damage. */
  consumeShield(targetUid: number, checkMiss = false): boolean {
    for (const status of this.active.get(targetUid)?.values() ?? []) {
      if (status.definition.buffClassName !== 8 || status.shield <= 0 || Boolean(status.parameters.IsMiss) !== checkMiss) continue;
      status.shield--;
      if (status.shield <= 0) this.remove(targetUid, status.definition.ID);
      return true;
    }
    return false;
  }

  /** Emit at affected target position/rotation, using original caster ownership. */
  drainWeaponFires(): StatusWeaponFire[] { return this.weaponFires.splice(0); }

  clearWave(): void {
    for (const [uid, statuses] of this.active) for (const [id, status] of statuses) {
      if (status.definition.buffClassName === 8 && status.parameters.ClearOnWaveEnd) this.remove(uid, id);
    }
  }

  private pulse(targetUid: number, status: ActiveStatus): StatusPulse | undefined {
    // The exported weapon-pool rows each contain at most one attack-based expression.
    const expression = status.definition.triggerAttributes[0];
    const coefficient = expression?.match(/^ElementAttack(?:Fire|Ice|Poison)=1\*([\d.]+)%$/);
    const hurtType = nativeHurtTypeFromExpressions(status.definition.triggerAttributes);
    if (!coefficient || hurtType === undefined) return undefined;
    status.triggerCount++;
    return {
      ...status.source, targetUid, buffId: status.definition.ID,
      element: status.definition.damageType,
      hurtType,
      damage: status.source.attack * Number(coefficient[1]) / 100 * status.layers,
    };
  }

  /** BuffSync2Bullets.OnInit/OnAddLayer snapshot the CURRENT live bullets;
   * OnUpdate does not continually apply ordinary AddAttributes. A later new
   * bullet inherits the owner's ordinary buff attrs through its birth path,
   * and is only added to this cache on a subsequent buff application. */
  private syncAttributesToBullets(ownerKey: number, status: ActiveStatus): void {
    if (!status.syncedBullets || !this.bulletSync) return;
    const weaponIds = (status.parameters as Record<string, unknown>).WeaponIds as number[] | undefined;
    const attributes = this.syncedAttributeValues(status);
    for (const bullet of this.bulletSync.bullets()) {
      if (!bullet.alive || bullet.ownerKey !== ownerKey || weaponIds?.length && !weaponIds.includes(bullet.weaponId)) continue;
      status.syncedBullets.set(bullet.uid, (status.syncedBullets.get(bullet.uid) || 0) + 1);
      this.bulletSync.mergeAttributes(bullet.uid, attributes, false);
    }
  }

  /** Native reverses only cached additions, once per applied layer. Dead
   * bullets are discarded. Explicit removal/expiry/replacement also removes
   * additions made by capped refreshes, not merely owner.layers copies. */
  private removeSyncedBulletAttributes(status: ActiveStatus, maximumLayers = Infinity): void {
    if (!status.syncedBullets || !this.bulletSync || maximumLayers <= 0) return;
    const live = new Set(this.bulletSync.bullets().filter(bullet => bullet.alive).map(bullet => bullet.uid));
    const attributes = this.syncedAttributeValues(status);
    for (const [uid, count] of status.syncedBullets) {
      if (!live.has(uid)) { status.syncedBullets.delete(uid); continue; }
      const removed = Math.min(count, maximumLayers);
      for (let layer = 0; layer < removed; layer++) this.bulletSync.mergeAttributes(uid, attributes, true);
      if (removed === count) status.syncedBullets.delete(uid);
      else status.syncedBullets.set(uid, count - removed);
    }
  }

  private syncedAttributeValues(status: ActiveStatus): { name: string; value: number }[] {
    return (status.definition.AddAttributes || []).map(encoded => {
      const [name, raw] = encoded.split('=');
      return { name, value: this.bulletSync!.normalizeAttribute(name, Number(raw)) };
    });
  }
}
