import { compileNativeSkillTrigger, nativeTriggerUnsupportedConditions, nativeMissingOrbitChildAction, parseNativeSkillParams, type NativeRecord } from './weapon-skill-runtime';
import { loadoutAttributeIsSupported } from './loadout-attributes';
import { nativeDropMissileWeaponSupported } from './native-drop-missile';

export interface LoadoutDependencyTables {
  skillRows?: Record<number, NativeRecord>;
  triggers?: Record<number, NativeRecord>;
  weapons?: Record<number, NativeRecord>;
  bullets?: Record<number, NativeRecord>;
  buffs?: Record<number, NativeRecord>;
  battleItems?: Record<number, NativeRecord>;
  attributeDefinitions?: Record<string, NativeRecord>;
}

// Explicit handlers in Simulation/content-capabilities; a name alone never
// admits a new implementation. LaserStick uses the existing owner ray path.
const trajectories = new Set(['MoveStraight', 'MoveSnake', 'MoveDiffusion', 'Laser', 'LaserStick', 'ReflectionRay', 'ReflectionRayChaser', 'LaserRotateByOwner', 'LaserRandomPoints',
  'SectorSpreadMod', 'SemiCircleMov2Mod', 'MoveAndReturnStay', 'FlashChain', 'FollowFlashChain', 'Thunder', 'FixedPos', 'OverLapShapeAndStay', 'FollowOwner', 'FallDown']);
const mods = new Set(['WeaponSalvoMod', 'WeaponMultiMod', 'WeaponEllipseMod', 'WeaponCircleBulletMod',
  'ThroughMod', 'ReboundMod', 'FollowMod', 'ScaleAnimMod', 'TimeCreateMod', 'MoveDisDieMod', 'WeaponFireOnDeadMod', 'WeaponDiamondMod', 'WeaponGradeMod', 'WeaponDulBulletMod',
  'WeaponChargeMod', 'WeaponContinueMod', 'WeaponForsideMod', 'WeaponChangeBulletMod', 'ExplosionMod', 'ExplosionUponDeathMod', 'BuffMod', 'EjectMod',
  'DisableReboundMod', 'DisableEjectMod', 'DisableFollowMod', 'DisableThroughMod', 'DisableThroughAttackPercentReduceMod', 'DisableBlackHoleMod', 'BlackHoleMod',
  'DetectBulletMod', 'WeakLaserMod', 'HitBehindFissionMod', 'DisableHitBehindFissionMod', 'CreateWeaponUponDeadMod', 'KillBulletMod', 'FlashChainMod', 'RandomTargetMod',
  'SelfRotationMod', 'SwitchTrajectoryMod', 'MoveSnake', 'WeaponCDReset2ExAttackMod']);

/** Walk the actual child-skill/buff/projectile graph before admitting a meta
 * skill. This is a static capability check, never gameplay verification. */
export function inspectLoadoutDependencies(row: NativeRecord, tables: LoadoutDependencyTables, admittedActions?: ReadonlySet<number>): string[] {
  const reasons = new Set<string>(), visited = new Set<string>();
  const parse = (value: unknown, owner: string): NativeRecord | undefined => {
    try { return parseNativeSkillParams(value); }
    catch {
      // Match the content loader's narrowly scoped repair of the shipped
      // redundant final brace; do not guess missing configuration values.
      if (typeof value === 'string' && /}}\s*$/.test(value)) {
        try { return parseNativeSkillParams(value.replace(/}}\s*$/, '}')); } catch { /* report below */ }
      }
      reasons.add(`${owner} 的原始参数无法解析`); return undefined;
    }
  };
  const attrs = (values: string[] | undefined, owner: string) => {
    for (const expression of values || []) {
      const key = String(expression).split('=')[0].trim();
      if (!tables.attributeDefinitions?.[key]) reasons.add(`${owner} 缺少属性定义 ${key}`);
      else if (!loadoutAttributeIsSupported(key)) reasons.add(`${owner} 的属性 ${key} 尚无已核实消费点`);
    }
  };
  const scan = (value: unknown, owner: string, field = ''): void => {
    if (typeof value === 'string') {
      if (/^\s*[\[{]/.test(value)) { const parsed = parse(value, owner); if (parsed) scan(parsed, owner); }
      return;
    }
    if (Array.isArray(value)) { for (const item of value) scan(item, owner, field); return; }
    if (value && typeof value === 'object') {
      const record = value as NativeRecord, modName = record.ModName || record.ModeName;
      if (modName && !mods.has(String(modName))) reasons.add(`${owner} 的 Mod ${modName} 尚未接入`);
      if (typeof record.Trajectory === 'string' && !trajectories.has(record.Trajectory)) reasons.add(`${owner} 的替换弹道 ${record.Trajectory} 尚未接入`);
      for (const [key, item] of Object.entries(value)) {
        // Prism main lasers are accepted collision sources, not spawned children.
        // Still require their records, but do not pretend this skill fires them.
        if (key === 'MainLaserWeaponIds') {
          for (const id of Array.isArray(item) ? item : []) if (!tables.weapons?.[id]) reasons.add(`缺少武器 ${id}`);
        } else scan(item, owner, key);
      }
      return;
    }
    if (typeof value !== 'number' || value <= 0) return;
    if (/weapon(?:id|ids)?$/i.test(field) && !/type|count/i.test(field)) weapon(value);
    else if (/buff(?:id|ids)?$/i.test(field)) buff(value);
    else if (/(?:SkillIds?|Skills)$/i.test(field)) skill(value);
    else if (/^(?:BulletId|BulletIds|DestBulletId)$/i.test(field)) bullet(value);
    else if (/^(?:DropItem|BattleItemId)$/i.test(field)) battleItem(value);
  };
  const inspectMod = (record: unknown, owner: string, trajectory?: string) => {
    if (!Array.isArray(record) || !record.length) return;
    const name = String(record[0]);
    if (!mods.has(name) && !(name === 'WeaponRangeTargetMod' && trajectory === 'Thunder')) reasons.add(`${owner} 的 Mod ${name} 尚未接入`);
    const args = parse(record[1], `${owner}/${name}`); if (args) scan(args, owner);
  };
  const bullet = (id: number) => {
    const key = `bullet:${id}`; if (visited.has(key)) return; visited.add(key);
    const source = tables.bullets?.[id];
    if (!source) { reasons.add(`缺少子弹 ${id}`); return; }
    scan(source, `子弹 ${id}`);
  };
  const weapon = (id: number) => {
    const key = `weapon:${id}`; if (visited.has(key)) return; visited.add(key);
    const source = tables.weapons?.[id];
    if (!source) { reasons.add(`缺少武器 ${id}`); return; }
    const owner = `武器 ${id}`;
    if (['BulletMod1', 'BulletMod2', 'BulletMod3', 'BulletMod4', 'BulletMod5'].some(field => source[field]?.[0] === 'ExplosionUponDeathMod')
      && !nativeDropMissileWeaponSupported(id)) reasons.add(`${owner} 的死亡爆炸变体尚未核实`);
    if (source.Trajectory === 'LaserStick' && ['WeaponMod', 'WeaponMod2', 'WeaponMod3', 'BulletMod1', 'BulletMod2', 'BulletMod3', 'BulletMod4', 'BulletMod5'].some(field => source[field]?.[0] === 'PersistentMod')) reasons.add(`${owner} 的持久激光销毁时机尚未核实`);
    if (!trajectories.has(source.Trajectory)) reasons.add(`${owner} 的弹道 ${source.Trajectory || '(空)'} 尚未接入`);
    bullet(Number(source.BulletId));
    for (const field of ['WeaponMod', 'WeaponMod2', 'WeaponMod3', 'BulletMod1', 'BulletMod2', 'BulletMod3', 'BulletMod4', 'BulletMod5']) inspectMod(source[field], owner, source.Trajectory);
    scan(source.TrajectoryParams, owner);
  };
  const buff = (id: number) => {
    const key = `buff:${id}`; if (visited.has(key)) return; visited.add(key);
    const source = tables.buffs?.[id];
    if (!source) { reasons.add(`缺少 Buff ${id}`); return; }
    const owner = `Buff ${id}`;
    if (![1, 4, 6, 8, 9, 10].includes(source.buffClassName ?? 1)) reasons.add(`${owner} 的类型 ${source.buffClassName} 尚未接入`);
    if (source.buffClassName === 10 && (source.triggerAttributes?.length || source.triggerAddAttributes?.length)) reasons.add(`${owner} 的子弹触发属性同步尚未接入`);
    attrs(source.AddAttributes, owner);
    if ((source.triggerAttributes || []).some((text: string) => !/^ElementAttack(?:Fire|Ice|Poison)=1\*[\d.]+%$/.test(text))) reasons.add(`${owner} 的触发表达式尚未接入`);
    scan(source.parameters, owner);
  };
  const battleItem = (id: number) => {
    const key = `item:${id}`; if (visited.has(key)) return; visited.add(key);
    const source = tables.battleItems?.[id];
    if (!source) { reasons.add(`缺少战斗掉落物 ${id}`); return; }
    if (Number(source.dropType) === 3 && Number(source.parameter) > 0) buff(Number(source.parameter));
    if (Number(source.dropType) === 4 && Number(source.parameter) > 0) inspectRow({ Triggers: [Number(source.parameter)] }, `掉落物 ${id}`);
  };
  const inspectRow = (source: NativeRecord, owner: string) => {
    attrs(source.AddAttributes, owner);
    for (let i = 1; i <= 8; i++) inspectMod(source[`Mod${i}`], owner);
    for (const id of source.Triggers || []) {
      const raw = tables.triggers?.[id];
      if (!raw) { reasons.add(`${owner} 缺少触发器 ${id}`); continue; }
      try {
        const trigger = compileNativeSkillTrigger(raw, Number(source.id ?? source.ID));
        for (const condition of nativeTriggerUnsupportedConditions(trigger)) reasons.add(`触发器 ${id} 的条件 ${condition} 尚未接入`);
        for (const action of trigger.actions) {
          if (action.type === 57) {
            if (nativeMissingOrbitChildAction(trigger.skillId, trigger.id, action.args) && !tables.skillRows?.[10101611]) continue;
            reasons.add(`触发器 ${id} 的子技能动作尚未核实`);
          }
          if (action.type === 39 && !nativeDropMissileWeaponSupported(Number(action.args.MissileWeaponId))) reasons.add(`触发器 ${id} 的导弹空投武器尚未核实`);
          if (admittedActions && !admittedActions.has(action.type)) reasons.add(`触发器 ${id} 的动作 ${action.type} 尚未接入`);
          scan(action.args, `触发器 ${id}`);
        }
      } catch { reasons.add(`触发器 ${id} 的参数无法解析`); }
    }
    if (source.prefabId) reasons.add(`${owner} 的独立预制体 ${source.prefabId} 尚未接入`);
  };
  const skill = (id: number) => {
    const key = `skill:${id}`; if (visited.has(key)) return; visited.add(key);
    const source = tables.skillRows?.[id];
    if (!source) { reasons.add(`缺少子技能 ${id}`); return; }
    inspectRow(source, `子技能 ${id}`);
  };
  const source = row.raw || row;
  visited.add(`skill:${source.id ?? source.ID}`);
  inspectRow(source, `技能 ${source.id ?? source.ID}`);
  return [...reasons];
}

/** Register only beside a newly installed host implementation. */
export function registerLoadoutDependencyHandlers(handlers: { trajectories?: readonly string[]; mods?: readonly string[] }): void {
  for (const name of handlers.trajectories || []) trajectories.add(name);
  for (const name of handlers.mods || []) mods.add(name);
}
