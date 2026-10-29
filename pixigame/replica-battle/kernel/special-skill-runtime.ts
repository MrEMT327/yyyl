import { compileNativeSkillTrigger, nativeTriggerUnsupportedConditions, parseNativeSkillParams, type NativeRecord } from './weapon-skill-runtime';
import { inspectLoadoutDependencies, type LoadoutDependencyTables } from './loadout-dependencies';

export interface LoadoutSkillSupport {
  supported: boolean;
  kind: 'attributes' | 'dynamic' | 'unsupported';
  owner: 'player' | 'weapon';
  reasons: string[];
  triggerIds: number[];
}
type SupportTables = LoadoutDependencyTables;
/** Handler admission, not a claim of complete original-game fidelity. Callers
 * must supply normalized runtime rows, never the raw FP catalog trigger table. */
export const loadoutRuntimeActions = new Set([2, 3, 8, 9, 14, 19, 27, 33, 39, 40, 56, 57, 62, 63, 68, 82, 85, 88, 90, 91, 97, 101, 103, 106, 108, 109, 111, 115, 117, 120, 121, 122, 125, 126, 127, 169, 170, 173, 174, 175, 176, 184, 190, 197, 199, 209, 212, 253, 254]);
const runtimeMods = new Set(['PersistentMod', 'ThroughMod', 'ReboundMod', 'FollowMod', 'ScaleAnimMod', 'TimeCreateMod', 'MoveDisDieMod', 'WeaponFireOnDeadMod', 'WeaponSalvoMod', 'WeaponMultiMod', 'WeaponDulBulletMod', 'WeaponForsideMod', 'WeaponContinueMod', 'WeaponChargeMod', 'WeaponChangeBulletMod', 'ExplosionMod', 'BuffMod', 'EjectMod', 'DisableReboundMod', 'DisableEjectMod', 'DisableFollowMod', 'DisableThroughMod', 'DisableThroughAttackPercentReduceMod', 'DisableBlackHoleMod', 'BlackHoleMod', 'DetectBulletMod', 'WeakLaserMod', 'HitBehindFissionMod', 'DisableHitBehindFissionMod', 'CreateWeaponUponDeadMod', 'KillBulletMod', 'FlashChainMod', 'RandomTargetMod', 'SelfRotationMod', 'SwitchTrajectoryMod', 'MoveSnake', 'WeaponCDReset2ExAttackMod']);
export function inspectLoadoutSkillSupport(skill: NativeRecord, tables: SupportTables): LoadoutSkillSupport {
  const row = skill.raw || skill;
  const reasons: string[] = inspectLoadoutDependencies(row, tables, loadoutRuntimeActions);
  const owner = row.TargetCharacterType?.length || row.TargetCharacterId?.length || Number(row.BattleSkillGroup) > 0 ? 'weapon' : 'player';
  const triggerIds: number[] = row.Triggers || [];
  for (const id of triggerIds) {
    const source = tables.triggers?.[id];
    if (!source) { reasons.push(`缺少原始触发器 ${id}`); continue; }
    try {
      const trigger = compileNativeSkillTrigger(source, Number(row.id));
      for (const reason of nativeTriggerUnsupportedConditions(trigger)) reasons.push(`触发器 ${id} 未接入条件 ${reason}`);
      for (const action of trigger.actions) {
        if (!loadoutRuntimeActions.has(action.type)) reasons.push(`触发器 ${id} 未接入动作 ${action.type}`);
        if (action.type === 2 && tables.buffs && !tables.buffs[Number(action.args.BuffId)]) reasons.push(`触发器 ${id} 缺少 Buff ${action.args.BuffId}`);
        if (action.args.WeaponId && tables.weapons && !tables.weapons[Number(action.args.WeaponId)]) reasons.push(`触发器 ${id} 缺少武器 ${action.args.WeaponId}`);
      }
    } catch (error) { reasons.push(`触发器 ${id} 参数异常：${error instanceof Error ? error.message : error}`); }
  }
  for (let i = 1; i <= 8; i++) {
    const mod = row[`Mod${i}`];
    if (mod?.length && !runtimeMods.has(String(mod[0])) && mod[0] !== 'CriticalThroughMod') reasons.push(`未接入武器 Mod ${mod[0]}`);
    if (mod?.length) try { parseNativeSkillParams(mod[1]); } catch { reasons.push(`Mod ${mod[0]} 参数异常`); }
  }
  if (row.prefabId) reasons.push(`独立技能预制体 ${row.prefabId} 尚未接入`);
  const dynamic = triggerIds.length > 0 || Array.from({ length: 8 }, (_, i) => row[`Mod${i + 1}`]?.length).some(Boolean);
  return { supported: reasons.length === 0, kind: reasons.length ? 'unsupported' : dynamic ? 'dynamic' : 'attributes', owner, reasons: [...new Set(reasons)], triggerIds };
}
