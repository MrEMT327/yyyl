import { nativeReduceTriggerCooldownByAction } from './native-loadout-cooldowns';
import { nativeFixedFromString } from './native-pending-bullet-attributes';
import { nativeSkillPrerequisitesMet } from './skill-eligibility';
/** Native Skill_Main / Skill_Trigger adapter. Values are native units: percentages
 * are fractions, while mergeType=2 attributes contain their remaining multiplier.
 * Evidence: research/weapon-skill-{contract,events,common,cover}-native.txt. */
export type NativeRecord = Record<string, any>;
export type NativeAttributeDefinition = { name: string; valueType: number; mergeType: number; defaultValue: number; InheritFromPlayer: number };
export type NativeSkillTables = {
  skillRows: Record<number, NativeRecord>; triggers: Record<number, NativeRecord>;
  entities: Record<number, NativeRecord>; families: Record<number, NativeRecord>;
  attributeDefinitions: Record<string, NativeAttributeDefinition>;
};
export type NativeWeaponMod = { name: string; args: NativeRecord; skillId: number; order: number };
export type NativeSkillAction = { type: number; args: NativeRecord };
export type NativeSkillTrigger = {
  id: number; skillId: number; type: number; params: NativeRecord;
  cooldown: number; firstCooldown: number; now: boolean; rate: number; rateType: number;
  maxCount: number; actions: NativeSkillAction[]; recoverWhenRemove: boolean;
};
export type NativeWeaponSkillSnapshot = {
  familyId: number; entityId: number; activeSkillIds: number[];
  /** Complete defaults + entity values + active family skills; no player stats. */
  attributes: Record<string, number>;
  /** Only active skill contributions, neutral value 0 or multiplicative 1. */
  skillAttributes: Record<string, number>;
  mods: NativeWeaponMod[]; triggers: NativeSkillTrigger[];
};

/** SkillTargetCharacterType: Hero=0, All=-1, AllSecondWeapons=-3.
 * Sprite/WingPlane remain separate entity kinds, never a player fallback. */
export function nativeSkillTargetsPlayer(row: NativeRecord): boolean {
  const types: number[] = row.TargetCharacterType || [];
  return !row.TargetCharacterId?.length && (!types.length && !row.BattleSkillGroup || types.includes(0) || types.includes(-1));
}
export function nativeSkillTargetsWeapon(row: NativeRecord, entityId: number, weaponType: number): boolean {
  return !!row.TargetCharacterId?.includes(entityId) || (row.TargetCharacterType || []).some((type: number) => type === weaponType || type === -1 || type === -3);
}

export function parseNativeSkillParams(raw: unknown): NativeRecord {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as NativeRecord;
  const text = String(raw).trim();
  // APK Skill_Main 10400602 (ice blade pierce) contains one extra closing
  // brace. Match only this captured payload; retain its explicit zero damage
  // reduction and reject unrelated malformed parameters instead of hiding them.
  if (text === '{"ThroughCount":2,"AttackPercent":-0,"ThroughProbability":1}}')
    return JSON.parse(text.slice(0, -1));
  try { return JSON.parse(text); }
  catch {
    // A few shipped ModParam strings retain a second escaping layer.
    try { return JSON.parse(text.replace(/\\"/g, '"')); }
    catch { throw new Error(`Invalid native skill parameters: ${text}`); }
  }
}

export function nativeMissingOrbitChildAction(skillId: number, triggerId: number, args: NativeRecord): boolean {
  return skillId === 10201606 && triggerId === 10101610 && Object.keys(args).length === 1
    && Array.isArray(args.HeroSkills) && args.HeroSkills.length === 1 && args.HeroSkills[0] === 10101611;
}

/** This is the RANDOM-POOL slot view only, never the effect history.
 * DankeSkillCreator.RemoveSkill@6c90b9c does not undo attributes/triggers.
 * See research/skill-eligibility-fidelity.md and skill-study-chain.arm64.txt. */
export function nativeActiveSkillIds(tables: Pick<NativeSkillTables, 'skillRows'>, learnedIds: readonly number[]): number[] {
  const active: number[] = [];
  for (const id of learnedIds) {
    const row = tables.skillRows[id];
    if (!row) throw new Error(`Missing native skill ${id}`);
    const covered = Number(row.CoverSkill || 0);
    if (covered) for (let i = active.length - 1; i >= 0; i--) if (active[i] === covered) active.splice(i, 1);
    active.push(id);
  }
  return active;
}

export function nativeAttributeValue(definition: NativeAttributeDefinition, serializedValue: number): number {
  return definition.valueType === 3 ? serializedValue / 100 : serializedValue;
}

/** AttributeData.MergeAttribute@6f89480. Equality to one uses FP raw655,
 * not a hand-selected cooldown floor. Multiplication follows FP raw rounding. */
export function mergeNativeAttribute(current: number, incoming: number, mergeType: number): number {
  if (mergeType === 0) return current + incoming;
  const multiplier = mergeType === 1 ? incoming : mergeType === 2 ? incoming === 1 ? 655 / 65536 : 1 - incoming : NaN;
  if (!Number.isFinite(multiplier)) throw new Error(`Unknown native attribute merge ${mergeType}`);
  return Math.floor(current * multiplier * 65536) / 65536;
}

function applyAttributes(target: Record<string, number>, attributes: readonly string[], definitions: NativeSkillTables['attributeDefinitions']) {
  for (const encoded of attributes) {
    const at = encoded.indexOf('=');
    const name = encoded.slice(0, at).trim();
    const definition = definitions[name];
    if (at < 1 || !definition) throw new Error(`Unknown native attribute ${encoded}`);
    const value = Number(encoded.slice(at + 1));
    if (!Number.isFinite(value)) throw new Error(`Invalid native attribute ${encoded}`);
    const initial = definition.mergeType ? 1 : 0;
    target[name] = mergeNativeAttribute(target[name] ?? initial, nativeAttributeValue(definition, value), definition.mergeType);
  }
}

export function compileNativeSkillTrigger(row: NativeRecord, skillId: number): NativeSkillTrigger {
  return {
    id: row.id ?? row.ID, skillId, type: row.TriggerType, params: parseNativeSkillParams(row.TriggerParam),
    cooldown: row.TriggerCd, firstCooldown: row.FirstTriggerCd, now: Boolean(row.TriggerNow), rate: row.TriggerRate,
    rateType: row.TriggerRateType, maxCount: row.TriggerCount, recoverWhenRemove: Boolean(row.RecoverWhenRemove),
    actions: [1, 2].flatMap(index => {
      const type = Number(row[index === 1 ? 'TriggerAction' : 'TriggerAction2'] || 0);
      return type ? [{ type, args: parseNativeSkillParams(row[index === 1 ? 'ActionParam' : 'ActionParam2']) }] : [];
    }),
  };
}

export function compileNativeWeaponSkills(tables: NativeSkillTables, learnedIds: readonly number[], familyId: number): NativeWeaponSkillSnapshot {
  const family = tables.families[familyId];
  if (!family) throw new Error(`Missing native weapon family ${familyId}`);
  const entity = tables.entities[family.entityId];
  if (!entity) throw new Error(`Missing native weapon entity ${family.entityId}`);
  const group = Number(family.raw.BattleSkillGroup);
  const known = new Set(learnedIds);
  const activeSkillIds = learnedIds.filter(id => {
    const row = tables.skillRows[id];
    if (!row) throw new Error(`Missing native skill ${id}`);
    const targetsWeapon = Number(row.BattleSkillGroup) === group || nativeSkillTargetsWeapon(row, family.entityId, entity.SecondWeapenType);
    // Keep prerequisite-bound lab skills in history, but delay their effects.
    // The captured table has six such rows, each requiring a branch in this family.
    return targetsWeapon && (!row.PreSkillIds?.length || nativeSkillPrerequisitesMet(id, known));
  });
  const attributes: Record<string, number> = {};
  for (const [name, definition] of Object.entries(tables.attributeDefinitions)) attributes[name] = nativeAttributeValue(definition, definition.defaultValue);
  // CharacterData base fields are not AddAttributes strings. They are already
  // converted from FP by the exporter and must not be percentage-converted.
  for (const name of ['FireCD', 'AttackDistance']) if (Number.isFinite(entity[name])) attributes[name] = entity[name];
  applyAttributes(attributes, entity.attributes || [], tables.attributeDefinitions);
  const skillAttributes: Record<string, number> = {};
  const mods: NativeWeaponMod[] = [];
  const triggers: NativeSkillTrigger[] = [];
  for (const skillId of activeSkillIds) {
    const row = tables.skillRows[skillId];
    applyAttributes(attributes, row.AddAttributes || [], tables.attributeDefinitions);
    applyAttributes(skillAttributes, row.AddAttributes || [], tables.attributeDefinitions);
    for (let i = 1; i <= 8; i++) {
      const mod = row[`Mod${i}`];
      if (mod?.length) {
        const args = parseNativeSkillParams(mod[1]);
        mods.push({ name: mod[0], args, skillId, order: Number(args.UpdateOrder || 0) });
      }
    }
    for (const id of row.Triggers || []) {
      const trigger = tables.triggers[id];
      if (!trigger) throw new Error(`Missing native trigger ${id} in skill ${skillId}`);
      triggers.push(compileNativeSkillTrigger(trigger, skillId));
    }
  }
  return { familyId, entityId: family.entityId, activeSkillIds, attributes, skillAttributes, mods: mods.sort((a, b) => a.order - b.order), triggers };
}

/** Passive inheritance is explicit. Do not apply every player skill to every
 * secondary weapon: AttributeString.InheritFromPlayer decides the boundary. */
export function compileNativePassiveAttributes(tables: NativeSkillTables, learnedIds: readonly number[], inheritOnly = false, externalSkillIds: readonly number[] = []): Record<string, number> {
  const output: Record<string, number> = {};
  const external = new Set(externalSkillIds);
  for (const id of learnedIds) {
    const row = tables.skillRows[id];
    // getSkillMasters@6e759fc..6e75a0c targets the hero for an empty target
    // list. Local type-3 upgrades 10101101/10101102 use this route too;
    // they are not restricted to prebattle/external skills.
    if (row.SkillType !== 2 && !((external.has(id) || row.SkillType === 3) && nativeSkillTargetsPlayer(row))) continue;
    // All already applies directly to each secondary snapshot. Inheriting it
    // again from the hero would duplicate exactly the same source skill.
    if (inheritOnly && row.TargetCharacterType?.some((type: number) => type === -1 || type === -3)) continue;
    const attrs = (row.AddAttributes || []).filter((encoded: string) => !inheritOnly || tables.attributeDefinitions[encoded.split('=')[0].trim()]?.InheritFromPlayer === 1);
    applyAttributes(output, attrs, tables.attributeDefinitions);
  }
  return output;
}

/** Player-owned passive triggers must not be installed on the cannon entity.
 * The caller routes commands with passiveOwner=true to player statuses. */
export function compileNativePlayerSkills(tables: NativeSkillTables, learnedIds: readonly number[], entityId = 0, externalSkillIds: readonly number[] = []): NativeWeaponSkillSnapshot {
  const external = new Set(externalSkillIds);
  const activeSkillIds = learnedIds.filter(id => {
    const row = tables.skillRows[id];
    return row?.SkillType === 2 || !!row && (external.has(id) || row.SkillType === 3) && nativeSkillTargetsPlayer(row);
  });
  const attributes = compileNativePassiveAttributes(tables, activeSkillIds, false, externalSkillIds);
  const triggers = activeSkillIds.flatMap(skillId => (tables.skillRows[skillId].Triggers || []).map((id: number) => {
    const row = tables.triggers[id];
    if (!row) throw new Error(`Missing native player trigger ${id} in skill ${skillId}`);
    return compileNativeSkillTrigger(row, skillId);
  }));
  return { familyId: 0, entityId, activeSkillIds, attributes, skillAttributes: { ...attributes }, mods: [], triggers };
}

export type NativeWeaponEvent = {
  type: number; weaponId?: number; bulletUid?: number; targetUid?: number;
  targetType?: number; targetBuffFlags?: readonly number[]; targetBuffSourceWeaponIds?: Readonly<Record<number, readonly number[]>>; noTrigger?: boolean;
  /** Cumulative source counters, not a private per-card counter. */
  hitCount?: number; killCount?: number; fireCount?: number; dropItemType?: number;
  first?: boolean; critical?: boolean; point?: { x: number; z: number };
  ownerPoint?: { x: number; z: number }; targetPoint?: { x: number; z: number };
  attackerPoint?: { x: number; z: number }; bullet?: NativeRecord; target?: NativeRecord;
  [key: string]: unknown;
};
export type NativeWeaponActionCommand = {
  kind: 'fire' | 'cloud' | 'changeWeapon' | 'replaceWeapon' | 'addBulletMod' |
    'weaponMods' | 'heal' | 'buff' | 'bulletAttributes' | 'targetExplosion' |
    'install' | 'specialist';
  action: number; args: NativeRecord; triggerId: number; skillId: number;
  /** Stable source instance, including repeated cards. */
  sourceKey: string; event: NativeWeaponEvent;
};
type TriggerState = { spec: NativeSkillTrigger; key: string; lastTime: number; count: number; failed: number; hitTargets: Set<number> };

const nativeEventParameters: Record<number, readonly string[]> = {
  0: [], 1: [], 2: [], 3: [], 4: ['CheckNear', 'TriggerOnlyOnce'],
  5: ['CheckNear', 'TargetType', 'KillCount', 'MainWeapon', 'WeaponIds'],
  7: ['AllowedWeaponIds', 'IgnoreNoTrigger'], 10: ['DropItemType'],
  16: ['WeaponIds', 'TargetEntityTypes', 'Milestone'], 17: ['FireCount', 'ForbiddenWeaponIds'],
  6: [], 13: [], 19: [], 21: [], 23: ['DeadWeaponIds'], 26: ['HitCount', 'WeaponIds'], 28: ['WeaponIds', 'KillCount'],
  31: ['WeaponIds', 'BuffFlags', 'TargetEntityTypes'], 34: ['WeaponIds', 'BuffFlags'], 35: ['KillCount', 'WeaponIds'],
  32: ['WeaponIds', 'BuffFlags', 'SourceWeaponIds4BuffFlags'], 37: ['WeaponIds'], 38: ['WeaponIds'], 54: ['TriggerBuffId'],
  70: ['WeaponIds', 'EjectCount', 'RequireHasNextTarget'],
  41: ['WeaponIds'], 42: ['WeaponIds'], 43: ['WeaponIds'], 44: ['WeaponIds'],
  48: [], 50: [], 51: [], 52: [], 53: ['IgnoreSameEnemy'], 55: [], 56: [], 58: [], 62: [], 64: ['FireCount'], 67: [], 68: ['TriggerBuffId'],
};

/** Deliberately strict: a new condition cannot silently become unconditional. */
export function nativeTriggerUnsupportedConditions(trigger: NativeSkillTrigger): string[] {
  const allowed = nativeEventParameters[trigger.type];
  if (!allowed) return [`event:${trigger.type}`];
  const unsupported = Object.keys(trigger.params).filter(key => !allowed.includes(key));
  for (const key of ['CheckNear', 'TargetType', 'MainWeapon']) if (trigger.params[key]) unsupported.push(`${key}:${trigger.params[key]}`);
  if (trigger.rateType !== 0) unsupported.push(`rateType:${trigger.rateType}`);
  return unsupported;
}

/** CharacterComponentTrigger routes by event type. Trigger.CanTrigger orders
 * checks count -> RNG -> cooldown -> parameter predicate, which matters to the
 * native random stream. Zero TriggerRate means an unconditional probability. */
export class NativeWeaponSkillRuntime {
  private states = new Map<string, TriggerState>();
  private bulletAttributeTotals = new Map<string, Record<string, number>>();
  private onceTriggers: TriggerState[] = [];
  private onceSerial = 0;

  reset() { this.states.clear(); this.bulletAttributeTotals.clear(); this.onceTriggers = []; this.onceSerial = 0; }

  /** DropItemTrigger adds a new independent one-shot trigger for the next
   * TriggerComponent update. It does not create a permanent Skill_Main row. */
  enqueueOnceTrigger(spec: NativeSkillTrigger, clock: number) {
    const unknown = nativeTriggerUnsupportedConditions(spec);
    if (unknown.length) throw new Error(`Unsupported pickup trigger ${spec.id}: ${unknown.join(', ')}`);
    this.onceTriggers.push({ spec, key: `pickup:${++this.onceSerial}:${spec.id}`, lastTime: spec.now ? -10000 : clock - spec.cooldown + spec.firstCooldown,
      count: 0, failed: 0, hitTargets: new Set() });
  }

  reduceCooldownByAction(action: number, seconds: number) { nativeReduceTriggerCooldownByAction(this.states.values(), action, seconds); }
  hasEvent(type: number): boolean { return [...this.states.values()].some(state => state.spec.type === type); }

  sync(snapshot: NativeWeaponSkillSnapshot, clock: number, random: () => number, event: Omit<NativeWeaponEvent, 'type'> = {}): NativeWeaponActionCommand[] {
    const commands: NativeWeaponActionCommand[] = [];
    const occurrences = new Map<string, number>();
    for (const spec of snapshot.triggers) {
      const base = `${snapshot.entityId}:${spec.skillId}:${spec.id}`;
      const occurrence = occurrences.get(base) || 0; occurrences.set(base, occurrence + 1);
      const key = `${base}:${occurrence}`;
      if (this.states.has(key)) continue;
      const unknown = nativeTriggerUnsupportedConditions(spec);
      if (unknown.length) throw new Error(`Unsupported native trigger ${spec.id}: ${unknown.join(', ')}`);
      // Trigger.Init uses clock-CD+FirstCD without a zero-value fallback.
      // InitForTriggerNow only rewinds the timestamp; type2 still fires on the
      // next update rather than executing synchronously during acquisition.
      const state: TriggerState = { spec, key, lastTime: spec.now ? -10000 : clock - spec.cooldown + spec.firstCooldown, count: 0, failed: spec.now ? 10000 : 0, hitTargets: new Set() };
      this.states.set(key, state);
      // Acquisition was performed by the host before constructing this runtime.
      // A covered root stays in the source history; its second entity is never
      // recreated when another stage is selected.
      if (spec.type === 0) commands.push(...this.fire(state, { ...event, type: 0 }, clock, random));
    }
    return commands;
  }

  dispatch(event: NativeWeaponEvent, clock: number, random: () => number): NativeWeaponActionCommand[] {
    // HandleGenericHitTrigger@6ac8168 tests NoTrigger before creating event4.
    // AnyWeaponHitCount/event31 are dispatched on the preceding independent
    // path and must NOT be suppressed by this flag.
    if (event.type === 4 && event.noTrigger) return [];
    const commands: NativeWeaponActionCommand[] = [];
    if (event.type === 2) {
      const pending = this.onceTriggers; this.onceTriggers = [];
      for (const state of pending) commands.push(...this.fire(state, { ...event, type: state.spec.type }, clock, random));
    }
    for (const state of this.states.values()) if (state.spec.type === event.type) {
      // Trigger.OnUpdate@6bab8f8 checks the interval before allocating a time
      // event; 6babb58 resets time even when rate/conditions reject the action.
      if (event.type === 2 && clock - state.lastTime < state.spec.cooldown) continue;
      commands.push(...this.fire(state, event, clock, random));
      if (event.type === 2) state.lastTime = clock;
    }
    return commands;
  }

  /** Release per-bullet mutable effects when a projectile leaves the world. */
  releaseBullet(uid: number) {
    for (const key of this.bulletAttributeTotals.keys()) if (key.endsWith(`:${uid}`)) this.bulletAttributeTotals.delete(key);
  }

  private fire(state: TriggerState, event: NativeWeaponEvent, clock: number, random: () => number): NativeWeaponActionCommand[] {
    const t = state.spec;
    if (t.maxCount > 0 && state.count >= t.maxCount) return [];
    if (t.rate > 0 && random() >= t.rate) { state.failed++; return []; }
    if (clock - state.lastTime < t.cooldown) return [];
    if (!this.matches(state, event)) return [];
    state.count++; state.lastTime = clock; state.failed = 0;
    if ((t.params.TriggerOnlyOnce || t.params.IgnoreSameEnemy) && event.targetUid !== undefined) state.hitTargets.add(event.targetUid);
    return t.actions.flatMap(action => this.execute(action, state, event, random));
  }

  private matches(state: TriggerState, event: NativeWeaponEvent): boolean {
    const p = state.spec.params;
    const includes = (values: unknown, value: number | undefined) => !Array.isArray(values) || values.length === 0 || value !== undefined && values.includes(value);
    for (const name of ['WeaponIds', 'AllowedWeaponIds', 'DeadWeaponIds']) if (!includes(p[name], event.weaponId)) return false;
    if (Array.isArray(p.ForbiddenWeaponIds) && p.ForbiddenWeaponIds.includes(event.weaponId)) return false;
    if (!includes(p.TargetEntityTypes, event.targetType)) return false;
    if (!includes(p.DropItemType, event.dropItemType)) return false;
    if (!includes(p.TriggerBuffId, typeof event.buffId === 'number' ? event.buffId : undefined)) return false;
    if (state.spec.type === 54 && Number(p.TriggerBuffId) > 0 && p.TriggerBuffId !== event.buffId) return false;
    if (Array.isArray(p.BuffFlags) && p.BuffFlags.length) {
      if (state.spec.type === 32) {
        if (event.targetBuffFlags == null) return false;
        if (p.SourceWeaponIds4BuffFlags?.length && event.targetBuffFlags.some(flag => p.BuffFlags.includes(flag) && !(event.targetBuffSourceWeaponIds?.[flag] || []).some(weaponId => p.SourceWeaponIds4BuffFlags.includes(weaponId)))) return false;
      } else if (!p.BuffFlags.some((flag: number) => event.targetBuffFlags?.includes(flag))) return false;
    }
    if (state.spec.type === 70 && (Number(p.EjectCount) >= 0 && p.EjectCount !== event.ejectCount || Number(p.RequireHasNextTarget) >= 0 && event.willEject !== (p.RequireHasNextTarget === 1))) return false;
    if (state.spec.type === 7 && event.noTrigger && !p.IgnoreNoTrigger) return false;
    if ((p.TriggerOnlyOnce || p.IgnoreSameEnemy) && event.targetUid !== undefined && state.hitTargets.has(event.targetUid)) return false;
    for (const [name, count] of [['HitCount', event.hitCount], ['KillCount', event.type === 28 && !p.WeaponIds?.length ? event.killBulletTotalCount : event.killCount], ['FireCount', event.fireCount], ['Milestone', event.critCount]] as const) {
      if (Number(p[name]) > 0 && (typeof count !== 'number' || count % Number(p[name]) !== 0)) return false;
    }
    return true;
  }

  private execute(action: NativeSkillAction, state: TriggerState, event: NativeWeaponEvent, random: () => number): NativeWeaponActionCommand[] {
    const args = { ...action.args };
    const command = (kind: NativeWeaponActionCommand['kind']): NativeWeaponActionCommand[] => [{ kind, action: action.type, args, triggerId: state.spec.id, skillId: state.spec.skillId, sourceKey: state.key, event }];
    switch (action.type) {
      case 57:
        if (nativeMissingOrbitChildAction(state.spec.skillId, state.spec.id, args)) return [];
        throw new Error(`Unverified native child-skill action in trigger ${state.spec.id}`);
      case 27: return []; // creation host contract, never an unhandled action
      case 3: return command('fire');
      case 56: args.topInset = 2; return command('cloud');
      case 8: return command('changeWeapon');
      case 19: return command('replaceWeapon');
      case 9: args.mod = { name: args.ModeName, args: parseNativeSkillParams(args.ModeParam) }; return command('addBulletMod');
      case 97: args.mods = (args.Mods || []).map((m: NativeRecord, index: number) => ({ name: m.ModName, args: parseNativeSkillParams(m.ModParam), once: Boolean(args.IsOnceUse?.[index]) })); return command('weaponMods');
      case 2: args.TargetType ??= 0; return command('buff');
      case 14: return command('heal');
      case 106: {
        const uid = event.bulletUid ?? (event.bullet?.uid as number | undefined);
        if (uid === undefined) return [];
        const key = `${state.key}:${uid}`;
        const totals = this.bulletAttributeTotals.get(key) || {};
        const changes = [];
        for (const encoded of args.Attrs || []) {
          const [name, incrementText, maximumText] = String(encoded).split('|');
          const increment = nativeFixedFromString(incrementText), maximum = nativeFixedFromString(maximumText || '0');
          if (increment === undefined || maximum === undefined) throw new Error(`Invalid native bullet attribute ${encoded}`);
          const before = totals[name] || 0;
          const sum = before + increment;
          // Native positive caps take min; negative caps take max.
          const after = maximum > 0 ? Math.min(sum, maximum) : maximum < 0 ? Math.max(sum, maximum) : sum;
          totals[name] = after;
          changes.push({ name, before, after, delta: after - before });
        }
        this.bulletAttributeTotals.set(key, totals);
        args.changes = changes;
        return command('bulletAttributes');
      }
      case 174: {
        const index = (args.EntityCharacterTypes || []).indexOf(event.targetType);
        if (index < 0 || random() >= Number(args.CreateExplodeProb?.[index] || 0)) return [];
        return command('targetExplosion');
      }
      // These install event-dependent attributes/listeners. The native action
      // executes once, but its formula must be evaluated for each later hit.
      case 68: args.attribute = 'RotateBallSpeed'; args.value = Number(args.RotateSpeed || 0); return command('install');
      case 33: case 96: case 102: case 103: case 122: case 126: case 133: case 139: case 156: case 187: case 191: case 196: case 203: case 208:
      case 141: case 240: case 241: case 244: return command('install');
      case 101: case 109: case 117: case 176: case 254: return command('install');
      // Dedicated entity controllers own state and geometry for these actions.
      // Returning an explicit command is mandatory; the host must reject an
      // action it cannot consume, rather than accepting a no-op skill card.
      case 62: case 63: case 82: case 85: case 88: case 90: case 91:
      case 115: case 120: case 121: case 125: case 127: case 169:
      case 108: case 111: case 170: case 173: case 175: case 184: case 190: case 212: case 237: case 253: return command('specialist');
      case 20: case 154: case 155: case 158: case 160: case 162: case 163: case 164: case 166: case 186: case 188:
      case 1: case 39: case 40: case 95: case 124: case 197: case 199: case 209: case 211: case 243:
      case 214: case 215: case 216: case 217: case 218: case 219: case 220: case 221: case 222: case 238: case 250: case 251: case 252: return command('specialist');
      default: throw new Error(`Unsupported native weapon action ${action.type} in trigger ${state.spec.id}`);
    }
  }
}

export type NativeInstalledAttributeContext = {
  weaponId: number; weaponType?: number; firstTarget?: boolean; hpPercent?: number;
  targetBuffFlags?: readonly number[]; targetType?: number;
  /** Native counter includes THIS hit. First hit therefore gives zero bonus. */
  sameEnemyHitCount?: (intervalSeconds: number) => number;
  attackerIsRayTarget?: boolean;
};

/** Output is a modifier contribution, not a complete attribute container.
 * In particular HurtDecrease% .3 is an incoming reduction, to merge with the
 * remaining multiplier by AttributeData.MergeAttribute. No /100 conversion. */
export function nativeInstalledAttributeContributions(installed: readonly NativeWeaponActionCommand[], context: NativeInstalledAttributeContext): Record<string, number> {
  const result: Record<string, number> = {};
  const add = (name: string, value: number) => { result[name] = (result[name] || 0) + value; };
  for (const command of installed) {
    const p = command.args;
    const allowed = (list: unknown) => !Array.isArray(list) || !list.length || list.includes(context.weaponId);
    if (command.action === 117) {
      // HP2Attrs.UpdateAttributes@6b54600 multiplies CURRENT life percentage.
      for (const encoded of p.hp2Attrs || []) { const [name, value] = String(encoded).split('|'); add(name, Math.floor(Number(value) * Number(context.hpPercent ?? 1) * 65536) / 65536); }
    } else if (command.action === 109 && context.firstTarget && allowed(p.WeaponIds)) {
      for (const encoded of p.Attrs || []) { const [name, value] = String(encoded).split('|'); add(name, Number(value)); }
    } else if (command.action === 176 && allowed(p.WeaponIds)) {
      if (p.BuffFlags?.length && !p.BuffFlags.some((f: number) => context.targetBuffFlags?.includes(f))) continue;
      if (p.TargetEntityTypes?.length && !p.TargetEntityTypes.includes(context.targetType)) continue;
      for (const encoded of p.Attrs || []) { const [name, value] = String(encoded).split('|'); add(name, Number(value)); }
    } else if (command.action === 101 && Number(p.WeaponType) === context.weaponType) {
      const interval = Number(p.ComboInterval || 0) === 1 ? 1 : .5;
      const previousHits = Math.max(0, Number(context.sameEnemyHitCount?.(interval) || 0) - 1);
      for (const encoded of p.AttrInfos || []) {
        const [name, increment, cap] = String(encoded).split('|');
        add(name, Math.min(previousHits * Number(increment), Number(cap)));
      }
    } else if (command.action === 254 && context.attackerIsRayTarget) {
      for (const encoded of p.Attrs || []) { const [name, value] = String(encoded).split('|'); add(name, Number(value)); }
    } else if (command.action === 68) add('RotateBallSpeed', Number(p.RotateSpeed || 0));
  }
  return result;
}

/** Native GetPos constants. Random locations are delegated to the world map
 * sampler; the helper never silently substitutes a target for a missing owner. */
export function nativeTriggerFirePoint(positionType: number, event: NativeWeaponEvent, randomPoint: (type: number) => { x: number; z: number }): { x: number; z: number } | undefined {
  switch (positionType) {
    case 0: case 5: case 6: case 7: return randomPoint(positionType);
    case 1: return event.point;
    case 2: return event.ownerPoint;
    case 3: return event.targetPoint;
    case 4: return event.attackerPoint;
    default: throw new Error(`Unsupported native trigger position ${positionType}`);
  }
}
