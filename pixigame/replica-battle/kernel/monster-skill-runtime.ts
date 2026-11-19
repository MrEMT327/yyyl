import source from '../public/data/monster-abilities.json';
import { nativeMonsterSkillIds, type NativeMonsterContext } from './monster-abilities';
import type { BuffDefinition, StatusSource } from './status-effects';

export const nativeMonsterBuffs = source.buffs as Record<string, BuffDefinition>;
export interface MonsterSkillActor {
  uid: number; x: number; z: number; attack: number; dead: boolean;
  /** Caller supplies faction, rather than guessing from entity ID. */
  side: 'player' | 'enemy';
}
interface RadiusParameters {
  TriggerType: number; TriggerSelf?: number; CheckInterval: number; CheckRadius: number;
  IsTriggerLess: number; BuffIds: number[]; EffectID: number;
}
interface RadiusState { ownerUid: number; skillId: number; parameters: RadiusParameters; lastCheck: number; inside: Set<number> }
export type MonsterBuffEvent = {
  kind: 'enter' | 'exit'; ownerUid: number; targetUid: number; buffId: number; source: StatusSource;
};
export interface MonsterAuraVisual { ownerUid: number; effectId: number; diameter: number }

/** Verified action 159 only. Other skills are reported, never interpreted as no-op success.
 * Evidence: research/later-monster-features-native.txt, Check/Enter/Exit/Undo. */
export class MonsterSkillRuntime {
  private auras = new Map<string, RadiusState>();
  clear(): void { this.auras.clear(); }
  /** Undo is synchronous with owner removal, before a later frame can tick. */
  removeOwner(ownerUid: number): MonsterBuffEvent[] {
    const events: MonsterBuffEvent[] = [];
    for (const [key, aura] of this.auras) {
      if (aura.ownerUid !== ownerUid) continue;
      for (const targetUid of aura.inside) for (const buffId of aura.parameters.BuffIds)
        events.push({ kind: 'exit', ownerUid, targetUid, buffId, source: { attack: 0, familyId: 0, weaponId: 0 } });
      this.auras.delete(key);
    }
    return events;
  }

  add(owner: MonsterSkillActor, abilityIds: readonly number[], context?: NativeMonsterContext): { visuals: MonsterAuraVisual[]; unsupported: number[] } {
    const visuals: MonsterAuraVisual[] = [], unsupported: number[] = [];
    for (const skillId of nativeMonsterSkillIds(abilityIds, context)) {
      // Only 300025's complete trigger+buff semantics have been recovered.
      if (skillId !== 300025) { unsupported.push(skillId); continue; }
      const skill = (source.skills as Record<number, { Triggers: number[] }>)[skillId];
      for (const triggerId of skill?.Triggers || []) {
        const trigger = (source.triggers as Record<number, { TriggerAction: number; ActionParam: string }>)[triggerId];
        if (trigger?.TriggerAction !== 159) { unsupported.push(skillId); continue; }
        const parameters = JSON.parse(trigger.ActionParam) as RadiusParameters;
        const key = `${owner.uid}:${triggerId}`;
        if (this.auras.has(key)) continue;
        // OnInit initializes lastCheckTime to zero (global battle clock), not spawn time.
        this.auras.set(key, { ownerUid: owner.uid, skillId, parameters, lastCheck: 0, inside: new Set() });
        if (parameters.EffectID) visuals.push({ ownerUid: owner.uid, effectId: parameters.EffectID, diameter: parameters.CheckRadius * 2 });
      }
    }
    return { visuals, unsupported };
  }

  /** Call once per active simulation step using the battle clock. Pauses do not advance it.
   * Original uses distance <= radius for IsTriggerLess=1, >= for other values.
   * Enter adds once; exit and owner destruction remove. No damage is rolled here. */
  advance(clock: number, actors: readonly MonsterSkillActor[]): MonsterBuffEvent[] {
    const byId = new Map(actors.map(actor => [actor.uid, actor]));
    const events: MonsterBuffEvent[] = [];
    for (const [key, aura] of this.auras) {
      const owner = byId.get(aura.ownerUid);
      if (!owner || owner.dead) {
        for (const targetUid of aura.inside) for (const buffId of aura.parameters.BuffIds)
          events.push({ kind: 'exit', ownerUid: aura.ownerUid, targetUid, buffId, source: { attack: 0, familyId: 0, weaponId: 0 } });
        this.auras.delete(key); continue;
      }
      const p = aura.parameters;
      if (clock - aura.lastCheck < p.CheckInterval) continue;
      aura.lastCheck = clock;
      const nowInside = new Set<number>();
      const source = { attack: owner.attack, familyId: 0, weaponId: 0 };
      for (const target of actors) {
        if (target.dead || (target.uid === owner.uid && p.TriggerSelf !== 1)) continue;
        const sameSide = target.side === owner.side;
        if (p.TriggerType === 0 || (p.TriggerType === 1 && sameSide) || (p.TriggerType === 2 && !sameSide)) continue;
        const distance = Math.hypot(target.x - owner.x, target.z - owner.z);
        if (!(p.IsTriggerLess === 1 ? distance <= p.CheckRadius : distance >= p.CheckRadius)) continue;
        nowInside.add(target.uid);
        if (!aura.inside.has(target.uid)) for (const buffId of p.BuffIds)
          events.push({ kind: 'enter', ownerUid: owner.uid, targetUid: target.uid, buffId, source });
      }
      for (const targetUid of aura.inside) if (!nowInside.has(targetUid)) for (const buffId of p.BuffIds)
        events.push({ kind: 'exit', ownerUid: owner.uid, targetUid, buffId, source });
      aura.inside = nowInside;
    }
    return events;
  }
}
