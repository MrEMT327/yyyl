import { mergeNativeAttribute, nativeAttributeValue, type NativeAttributeDefinition } from './weapon-skill-runtime';

/** Catalog input uses displayed percentage points (20 means 20%). Runtime input
 * uses normalized fractions and mergeType=2 remaining factors. Never mix them. */
export type LoadoutAttributeValues = Readonly<Record<string, number>>;
export type LoadoutAttributeSource = { name?: string; attributes: LoadoutAttributeValues };
export type LoadoutAttributeDefinitions = Readonly<Record<string, NativeAttributeDefinition | { raw?: Partial<NativeAttributeDefinition> }>>;
export interface LoadoutRuntimeAttributeResult {
  runtimeAttributes: Record<string, number>;
  inheritedAttributes: Record<string, number>;
  capabilities: Record<string, { supported: boolean; reason?: string }>;
  unsupportedAttributes: string[];
}

// These values already have consumers in the shared weapon/bullet runtime.
// Damage-target and player-survival additions are admitted by their helpers
// below; admission of an action is separate from admission of its attributes.
const consumedAttributes = new Set([
  'Attack', 'HPMax', 'Attack%', 'HPMax%', 'CritRate%', 'CritValue%', 'ScalePercent%',
  'AllFireCDReduce%', 'FireCDReduce%', 'FireCD', 'BulletAttack%', 'SkillUpgradeAttack%', 'WeaponDamageAdd%',
  'BulletScale%', 'AllSkillRange%', 'RotateBallSpeed%', 'BulletSpeed', 'BulletSpeed%',
  'AllCurveSwordCDTime%', 'CurveSwordCDTime%', 'AllMissileFireCDReduce%',
  'AttackDistance', 'AttackDistance%', 'BulletLifeRange', 'Bullet_LifeTime', 'BulletLifeTime%',
  'LaserLength%', 'LaserThickness%', 'ExplodeRadius%', 'WeaponSalvoCount', 'WeaponSalvoAngle',
  'ReflectionCount', 'DulBulletCount', 'DulBulletCount%', 'ForsideBulletCount%',
  'BulletDeflectionAngle', 'MinBulletHurtTimeReduce%', 'BulletTraitSplitCount', 'BulletTraitReboundCount',
  'ThroughMod_ThroughCount', 'BulletThroughCount', 'MainWeaponThroughMod_ThroughCount',
  'MainWeaponThroughMod_AttackPercent', 'MainWeaponReboundMod_ReboundCount',
  'ModThroughAttack%', 'ModThroughAttackScale%', 'ModThroughMinAttackScale%', 'BulletFollowRotateSpeed%',
  'RotateSpeed', 'RotateBallRadius', 'RotateBallSpeed', 'RotateBallCount', 'RotateBallDynamicScale%',
  'MissileCount', 'MissileExplodeCount', 'AllMissileCount', 'AllMissileCountTimes', 'AllMissileConsecutiveCount', 'MaxMissileCount',
  'AllMissileExplodeRadius%', 'AllShotgunRadius', 'AllShotgunRadius%', 'ShotgunRadius', 'ShotgunRadius%',
  'CurveSwordTotalAngle', 'AllCurveSwordTotalAngle', 'XuKongZhanCount', 'AllSlashBulletThroughCount',
  'AllCurveSwordAngularSpeed%', 'AllMaxCurveSword', 'AllCurveSwordLength', 'CurveSwordReverseLength%', 'ReflectionHurtAdd%',
  'BlackHolePullRadius%', 'AllBlackHolePullRadius%', 'EjectMod_EjectCount', 'HurtDecrease%',
  'ArmorBreakBuffRate%', 'ArmorBreakBuffTime%',
  'PhysicalDamageAdd%', 'FireDamageAdd%', 'IceDamageAdd%', 'PoisonDamageAdd%', 'EnergyDamageAdd%', 'ThunderDamageAdd%',
  ...['Area', 'Trajectory', 'CloseRange', 'Raycast', 'Split', 'Through', 'BlockBullet', 'Follow', 'Rebound', 'Attract', 'Splash', 'Explosion', 'Eject'].map(n => `BulletTrait${n}DamageAdd%`),
]);

/** Native attribute definitions, not '%' spelling, determine normalization and
 * inheritance. Keep individual contribution groups: two 10% reductions yield
 * .9*.9, not .8. Native FP rounding is shared with the skill runtime. */
export function buildLoadoutRuntimeAttributes(
  input: readonly LoadoutAttributeSource[] | LoadoutAttributeValues,
  definitions: LoadoutAttributeDefinitions,
): LoadoutRuntimeAttributeResult {
  const sources: readonly LoadoutAttributeSource[] = Array.isArray(input) ? input : [{ attributes: input as LoadoutAttributeValues }];
  const runtimeAttributes: Record<string, number> = {}, inheritedAttributes: Record<string, number> = {};
  const capabilities: LoadoutRuntimeAttributeResult['capabilities'] = {};
  for (const source of sources) for (const [name, serialized] of Object.entries(source.attributes)) {
    if (!Number.isFinite(serialized) || serialized === 0) continue;
    const entry = definitions[name];
    const def = (entry && ('raw' in entry ? entry.raw : entry)) as NativeAttributeDefinition | undefined;
    if (!def || !Number.isFinite(def.mergeType) || !Number.isFinite(def.valueType)) {
      capabilities[name] = { supported: false, reason: '原始属性定义缺失' }; continue;
    }
    const neutral = def.mergeType === 0 ? 0 : 1;
    const value = nativeAttributeValue(def, serialized);
    runtimeAttributes[name] = mergeNativeAttribute(runtimeAttributes[name] ?? neutral, value, def.mergeType);
    if (Number(def.InheritFromPlayer) === 1) inheritedAttributes[name] = runtimeAttributes[name];
    capabilities[name] = { supported: consumedAttributes.has(name), ...(consumedAttributes.has(name) ? {} : { reason: '属性保留原值；运行时消费点尚未接入或未核实' }) };
  }
  return { runtimeAttributes, inheritedAttributes, capabilities, unsupportedAttributes: Object.keys(capabilities).filter(n => !capabilities[n].supported) };
}

/** Optional integration registration. Call only when the matching consumer is
 * installed; avoids claiming that a serialized attribute alone changes combat. */
export function registerLoadoutAttributeConsumers(names: readonly string[]): void {
  for (const name of names) consumedAttributes.add(name);
}

export function loadoutAttributeIsSupported(name: string): boolean { return consumedAttributes.has(name); }

export interface NativeConditionalAttributeAction { action: number; args: Record<string, any> }
export interface NativeConditionalAttributeContext {
  weaponId: number;
  targetType?: number;
  /** These two are bullet lifecycle totals in native units, NOT owner travel. */
  bulletDistance?: number; bulletDeviation?: number;
  targetHpRatio?: number; ownerHpRatio?: number; ownerTargetDistance?: number;
  wave?: number; nearEnemyCount?: (radius: number) => number;
  targetWorldZ?: number;
  /** Action 203's source normalized camera band must be resolved by the host. */
  resolveWorldZBand?: (min: number, max: number) => readonly [number, number] | undefined;
  bulletTraits?: number; bulletTargetDistance?: number; bulletShapeRadius?: number; targetShapeRadius?: number;
}

/** The | format is action-local FP; .2 is already 20%, unlike the catalog's
 * AddAttributes "Name=20". Do not percentage-convert these a second time. */
export function parseNativeConditionalAttributes(expressions: readonly string[] | undefined): Record<string, number> {
  const values: Record<string, number> = {};
  for (const expression of expressions || []) {
    const [name, raw] = expression.split('|');
    const value = Number(raw);
    if (name?.trim() && Number.isFinite(value)) values[name.trim()] = (values[name.trim()] || 0) + value;
  }
  return values;
}

/** Distance/angle modifiers replace their previous contribution as a bullet
 * moves. Hosts either rebuild from a clean snapshot using this output, or undo
 * the previous output before merging. Adding this output on every tick stacks
 * the same modifier incorrectly. */
export function nativeLinearBulletAttributeValues(expressions: readonly string[] | undefined, units: number, distance: boolean): Record<string, number> {
  const values: Record<string, number> = {};
  for (const expression of expressions || []) {
    const [rawName, perText, maxText, initialText] = expression.split('|');
    const per = Number(perText), max = Math.abs(Number(maxText)), initial = distance ? Number(initialText || 0) : 0;
    if (!rawName?.trim() || ![per, max, initial].every(Number.isFinite)) continue;
    let value = per * units + initial;
    if (max > 0) value = Math.max(-max, Math.min(max, value));
    const name = rawName.trim(); values[name] = (values[name] || 0) + value;
  }
  return values;
}

/** Stateless native event-attribute calculators. The host handles registration,
 * trigger lifetime and owner/weapon scope. Output contains incoming normalized
 * values (HurtDecrease%=.2, NOT the remaining .8 factor); merge with definitions.
 * Action139 is a persistent threshold/counter transition and has its own helper. */
export function nativeConditionalAttributeValues(
  installed: readonly NativeConditionalAttributeAction[], context: NativeConditionalAttributeContext,
): Record<string, number> {
  const result: Record<string, number> = {};
  const add = (values: Record<string, number>, scale = 1) => { for (const [name, value] of Object.entries(values)) result[name] = (result[name] || 0) + value * scale; };
  for (const { action, args } of installed) {
    if (args.WeaponIds?.length && !args.WeaponIds.includes(context.weaponId)) continue;
    if (action === 102 && context.bulletDistance !== undefined) add(nativeLinearBulletAttributeValues(args.Attrs, context.bulletDistance, true));
    else if (action === 103 && context.bulletDeviation !== undefined) add(nativeLinearBulletAttributeValues(args.Attrs, context.bulletDeviation, false));
    else if (action === 126 && [3, 15].includes(Number(context.targetType))) add(parseNativeConditionalAttributes(args.Attrs));
    else if (action === 133 && context.targetHpRatio !== undefined && context.targetHpRatio <= Number(args.HPPercent)) add(parseNativeConditionalAttributes(args.Attrs));
    else if (action === 187 && context.ownerTargetDistance !== undefined && args.Attr) {
      const max = Number(args.MaxAttrValue || 0);
      add({ [args.Attr]: Math.min(max, max / (Math.max(0, context.ownerTargetDistance) + 1)) });
    } else if (action === 203 && context.targetWorldZ !== undefined) {
      const band = context.resolveWorldZBand?.(Number(args.MinZ), Number(args.MaxZ));
      if (band && context.targetWorldZ >= band[0] && context.targetWorldZ <= band[1]) add(parseNativeConditionalAttributes(args.Attrs));
    } else if (action === 208 && context.bulletTargetDistance !== undefined && context.bulletShapeRadius !== undefined) {
      const mask = Number(args.BulletTrait || 0);
      if (mask && ((context.bulletTraits || 0) & mask) === mask && Number(args.InnerCirclePercent) > 0 && context.bulletTargetDistance <= context.bulletShapeRadius * Number(args.InnerCirclePercent) + (context.targetShapeRadius || 0)) add(parseNativeConditionalAttributes(args.Attrs));
    } else if (action === 240 && context.wave !== undefined && context.wave <= Number(args.MaxWave)) add(parseNativeConditionalAttributes(args.Attrs));
    else if (action === 241 && args.Attr && Number(args.Radius) > 0 && Number(args.EnemyCount) > 0 && (context.nearEnemyCount?.(Number(args.Radius)) || 0) > Number(args.EnemyCount)) add({ [args.Attr]: Number(args.DeltaValue || 0) });
    else if (action === 244 && context.ownerHpRatio !== undefined) {
      const hp = Math.max(0, Math.min(1, context.ownerHpRatio)), full = Number(args.FullBonusHpPercent || 0);
      add(parseNativeConditionalAttributes(args.Attrs), hp <= full ? 1 : full === 1 ? 0 : Math.max(0, Math.min(1, (1 - hp) / (1 - full))));
    }
  }
  return result;
}

/** Preserve groups when two installed actions affect the same reduction.
 * For example FireCDReduce% .2 and .3 must merge as .8*.7, never as .5. */
export function nativeConditionalAttributeGroups(installed: readonly NativeConditionalAttributeAction[], context: NativeConditionalAttributeContext): { action: number; attributes: Record<string, number> }[] {
  return installed.map(item => ({ action: item.action, attributes: nativeConditionalAttributeValues([item], context) })).filter(item => Object.keys(item.attributes).length > 0);
}

/** Incoming action values are normalized fractions, so this helper deliberately
 * does NOT call nativeAttributeValue (which is for raw catalog points). */
export function mergeNativeConditionalAttributeGroups(
  base: LoadoutAttributeValues, groups: readonly { attributes: LoadoutAttributeValues }[], definitions: LoadoutAttributeDefinitions,
): Record<string, number> {
  const result = { ...base };
  for (const group of groups) for (const [name, value] of Object.entries(group.attributes)) {
    const entry = definitions[name];
    const def = (entry && ('raw' in entry ? entry.raw : entry)) as NativeAttributeDefinition | undefined;
    if (!def || !Number.isFinite(value)) continue;
    result[name] = mergeNativeAttribute(result[name] ?? (def.mergeType ? 1 : 0), value, def.mergeType);
  }
  return result;
}

export interface NativeHpThresholdState { active: boolean; triggerCount: number; lastTriggerTime: number; lastHpRatio?: number }
/** TriggerActionHpPercentBase.OnHpPercentChanged@6b58ca4: thresholds include
 * equality, each entry consumes a count, exits remove the modifier. Regaining
 * HP above a low threshold can rearm it; waiting below it cannot retrigger. */
export function advanceNativeHpThreshold(
  args: Record<string, any>, state: NativeHpThresholdState, hpRatio: number, now: number,
) {
  const within = Number(args.IsTriggerLess) === 1 ? hpRatio <= Number(args.TriggerHpPercent || 0) : hpRatio >= Number(args.TriggerHpPercent || 0);
  let entered = false, exited = false;
  const changed = state.lastHpRatio !== hpRatio;
  state.lastHpRatio = hpRatio;
  if (!within && state.active) { state.active = false; exited = true; }
  if (changed && within && !state.active && !(Number(args.MaxTriggerCount) > 0 && state.triggerCount >= Number(args.MaxTriggerCount)) && !(Number(args.TriggerCooldown) > 0 && now - state.lastTriggerTime < Number(args.TriggerCooldown))) {
    state.active = true; state.triggerCount++; state.lastTriggerTime = now; entered = true;
  }
  return { entered, exited, active: state.active, attributes: state.active ? parseNativeConditionalAttributes(args.Attrs) : {}, recoverHpFraction: entered ? Number(args.RecoverHpPercent || 0) : 0, buffIds: entered ? args.BuffIds || [] : [], removeBuffIds: exited && !args.KeepBuff ? args.BuffIds || [] : [] };
}

/** BaseTriggerAction.TryResolveVerticalWorldZBand@6b08f34: camera bottom plus
 * normalized height; target boundary comparisons include equality. */
export function nativeLoadoutWorldZBand(bottom: number, top: number, min: number, max: number): readonly [number, number] {
  return [bottom + (top - bottom) * min, bottom + (top - bottom) * max];
}
