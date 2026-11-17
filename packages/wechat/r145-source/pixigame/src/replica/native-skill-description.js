import displayRuntime from './native-skill-description-runtime.json' with { type: 'json' };

const number = value => Number.isFinite(value) ? String(Math.round(value * 10000) / 10000) : '';
const percent = value => number(value * 100);
const parse = value => {
  try { return typeof value === 'string' ? JSON.parse(value || '{}') : value || {}; }
  catch { return {}; }
};
function action(runtime, skillId, type, accepts = () => true) {
  for (const id of [...(runtime.skillRows?.[skillId]?.Triggers || [])].reverse()) {
    const trigger = runtime.triggers?.[id];
    for (const suffix of ['2', '']) {
      if (Number(trigger?.[`TriggerAction${suffix}`]) !== type) continue;
      const args = parse(trigger[`ActionParam${suffix}`]);
      if (accepts(args)) return args;
    }
  }
  return {};
}
const triggerFor = (runtime, skillId, type) => (runtime.skillRows?.[skillId]?.Triggers || [])
  .map(id => runtime.triggers?.[id]).find(row => row?.TriggerAction === type || row?.TriggerAction2 === type);
const pipeAttribute = (args, attribute) => {
  const row = args?.Attrs?.find(value => value.startsWith(`${attribute}|`));
  return row ? Number(row.slice(row.indexOf('|') + 1)) : NaN;
};
const bulletFor = (runtime, id) => runtime.bullets?.[runtime.weapons?.[id]?.BulletId];
const buffAttribute = (buff, attribute) => {
  const row = buff?.AddAttributes?.find(value => value.startsWith(`${attribute}=`));
  return row ? Number(row.slice(row.indexOf('=') + 1)) : NaN;
};
function attackCoefficient(bullet) {
  const row = bullet?.hurtAttributes?.find(value => /^Attack=1\*[\d.]+%$/.test(value));
  return row ? Number(row.match(/\*([\d.]+)%$/)[1]) : NaN;
}

/** Correct only verified source-copy conflicts. Combat keeps its native rows;
 * unreviewed descriptions are returned unchanged. The default is a generated,
 * tested slice of loadout-runtime; live battle callers pass their own runtime. */
export function nativeSkillDescription(skill, runtime = displayRuntime) {
  const fallback = String(skill?.description ?? skill?.descriptionSource ?? '');
  const id = Number(skill?.id);
  if (id === 10807011) {
    const args = action(runtime, id, 250);
    // Native250 waits for the orbiting missile count to decrease before its
    // replenishment timer starts. Creation is not immediate enemy-directed fire.
    if (args.CreateOnInit && args.CheckCountType === 1 && [args.CreateCount, args.CreateInterval].every(Number.isFinite))
      return `开局生成${number(args.CreateCount)}枚蜂巢导弹；导弹数量减少后，间隔${number(args.CreateInterval)}秒补充一批`;
  } else if ([10807014, 10807015, 10815014, 10815015, 10802014, 10802015, 10806014, 10806015, 10816014, 10816015].includes(id)) {
    const attribute = Math.trunc(id / 10) === 1081501 ? 'WeaponDamageAdd%' : 'CommonDamageAdd%';
    const previous = pipeAttribute(action(runtime, id - 1, 176), attribute);
    const current = pipeAttribute(action(runtime, id, 176), attribute);
    if ([previous, current].every(Number.isFinite))
      return fallback.replace(/伤害\s+\d+(?:\.\d+)?%->\d+(?:\.\d+)?%/, `伤害 ${percent(previous)}%->${percent(current)}%`);
  } else if ([10804011, 10804013, 10804014].includes(id)) {
    const args = action(runtime, id, 211), previous = action(runtime, id - 1, 211);
    const radius = pipeAttribute(args, 'AllShotgunRadius%'), crit = pipeAttribute(args, 'CritValue%');
    const previousRadius = pipeAttribute(previous, 'AllShotgunRadius%'), previousCrit = pipeAttribute(previous, 'CritValue%');
    const count = parse(triggerFor(runtime, id, 211)?.TriggerParam).FireCount;
    if (id === 10804011 && [radius, crit, count].every(Number.isFinite))
      // The active secondary weapon family 10000401 is presented as 磁暴枪.
      return `磁暴枪每攻击${number(count)}次，下一次攻击范围+${percent(radius)}%，暴击伤害+${percent(crit)}%`;
    if (id === 10804013 && [radius, previousRadius].every(Number.isFinite))
      return `攻击范围 ${percent(previousRadius)}%->${percent(radius)}%`;
    if (id === 10804014 && [radius, crit, previousRadius, previousCrit].every(Number.isFinite))
      return `暴击伤害 ${percent(previousCrit)}%->${percent(crit)}%，攻击范围 ${percent(previousRadius)}%->${percent(radius)}%`;
  } else if (id >= 10817011 && id <= 10817015) {
    const args = action(runtime, id, 252), buff = runtime.buffs?.[args.BuffId];
    const reflection = buffAttribute(buff, 'ReflectionCount'), crit = buffAttribute(buff, 'CritRate%');
    // Native252 pauses elapsed time while the buff is active; its interval
    // begins when the buff disappears, not at the start of the previous buff.
    if ([args.Interval, buff?.clearParam, reflection].every(Number.isFinite))
      return `折射次数+${number(reflection)}${Number.isFinite(crit) ? `、暴击率+${number(crit)}%` : ''}，持续${number(buff.clearParam)}秒；结束后${number(args.Interval)}秒再次触发`;
  } else if (id === 10811011) {
    const cooldown = triggerFor(runtime, id, 90)?.TriggerCd;
    if (Number.isFinite(cooldown)) return `能量光剑每隔${number(cooldown)}秒，额外释放一轮次元斩`;
  }
  if (id === 3010104) {
    const args = action(runtime, id, 156, row => row.DeltaScalePercent !== undefined);
    if (Number.isFinite(args.DeltaScalePercent) && Number.isFinite(args.DeltaFireCount))
      return `光芒弹体型提升${percent(args.DeltaScalePercent)}%，子弹数增加${number(args.DeltaFireCount)}颗`;
  } else if (id === 3010105) {
    const size = action(runtime, id, 156, row => row.DeltaThroughCount !== undefined);
    const damage = action(runtime, id, 96, row => row.WeaponIds?.includes(size.WeaponId));
    const delta = damage.ExAttacks?.[damage.WeaponIds?.indexOf(size.WeaponId)];
    if (Number.isFinite(size.DeltaThroughCount) && Number.isFinite(delta) && delta < 0)
      return `光芒弹增加${number(size.DeltaThroughCount)}次穿透，伤害降低${percent(-delta)}%`;
  } else if (id === 3010205) {
    const args = action(runtime, id, 188);
    if (Number.isFinite(args.HpPercentThreshold))
      return `生命低于${percent(args.HpPercentThreshold)}%时，辐射脉冲会使敌人【腐蚀】`;
  } else if (id === 3020101) {
    const args = action(runtime, id, 154), bullet = bulletFor(runtime, args.WeaponId);
    if (Number.isFinite(args.FireInterval) && Number.isFinite(bullet?.LifeTime))
      return `每隔${number(args.FireInterval)}秒释放一轮毒刺激光，持续${number(bullet.LifeTime)}秒`;
  } else if (id === 3020205) {
    const args = action(runtime, id, 154), original = action(runtime, 3020201, 154);
    const weapon = runtime.weapons?.[args.WeaponId];
    const mod = [weapon?.WeaponMod, weapon?.WeaponMod2, weapon?.WeaponMod3].find(row => row?.[0] === 'WeaponMultiMod');
    const count = parse(mod?.[1]).FireCount;
    const base = attackCoefficient(bulletFor(runtime, original.WeaponId));
    const damage = attackCoefficient(bulletFor(runtime, args.WeaponId));
    if (Number.isFinite(args.FireInterval) && Number.isFinite(count) && base > 0 && damage > 0 && damage < base)
      return `每隔${number(args.FireInterval)}秒释放${number(1 + count)}道居合斩，居合斩伤害降低${percent(1 - damage / base)}%`;
  } else if (id === 3020301) {
    const args = action(runtime, id, 163), buff = runtime.buffs?.[args.UnrealBuffId];
    const damage = buffAttribute(buff, 'CommonDamageAdd%'), dodge = buffAttribute(buff, 'Miss%');
    if ([args.UnrealCD, args.UnrealInterval, damage, dodge].every(Number.isFinite))
      return `进入【幻影状态】，全体伤害+${number(damage)}%、闪避率+${number(dodge)}%，持续${number(args.UnrealInterval)}秒；结束后${number(args.UnrealCD)}秒再次触发`;
  }
  return fallback;
}
