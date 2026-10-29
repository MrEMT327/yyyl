import type { RecordData, WeaponState } from './model';
import { nativeModRecords, nativeModParameters } from './native-projectile-mods';

type NativeScaleAttributes = Readonly<Record<string, number>>;
const scaleFpMultiply = (a: number, b: number): number => Math.floor(a * b * 65536) / 65536;

/** Weapon.CalculateBulletScale@6e475b4. attrs are the owner's resolved
 * attributes; optional modifiers are separate native skill/next-fire buckets.
 * Do not pass the same compiled contribution in both attrs and skillModifiers.
 * BulletScale% adds to the table scale, rather than multiplying that scale. */
export function nativeBulletScale(base: number, flags: number, traits: number,
  attrs: NativeScaleAttributes = {}, options: {
    skillModifiers?: NativeScaleAttributes; nextFireModifiers?: NativeScaleAttributes;
    modificationDelta?: number; allowModificationWhenIgnored?: boolean; forceScale?: number;
  } = {}): number {
  const ignored = Boolean(flags & 128);
  const skill = options.skillModifiers || {};
  let scale = base;
  if (!ignored) {
    scale += (attrs['BulletScale%'] || 0) + (skill['BulletScale%'] || 0)
      + (options.nextFireModifiers?.['BulletScale%'] || 0)
      + (traits & 1 ? attrs['BulletTraitAreaScale%'] || 0 : 0)
      + (traits & 4 ? attrs['BulletTraitCloseRangeScale%'] || 0 : 0);
    scale = scaleFpMultiply(scale, 1 + (attrs['BulletScaleExtra%'] || 0) + (skill['BulletScaleExtra%'] || 0));
  }
  if (!ignored || options.allowModificationWhenIgnored) scale += options.modificationDelta || 0;
  if ((options.forceScale || 0) > 0) scale = Math.trunc(options.forceScale! * 65536 / 100) / 65536;
  return scale;
}

/** ScaleAnimModParams.ctor@6d3cd74 leaves all fields zero; in particular neither
 * endpoint defaults to the Bullet table's Scale or to one. */
export function nativeScaleAnimDefaults(parameters: RecordData = {}): {
  StartScale: number; TargetScale: number; ScaleTime: number; WaitTime: number; Trigger: number;
} {
  return { StartScale: Number(parameters.StartScale ?? 0), TargetScale: Number(parameters.TargetScale ?? 0),
    ScaleTime: Number(parameters.ScaleTime ?? 0), WaitTime: Number(parameters.WaitTime ?? 0), Trigger: Number(parameters.Trigger ?? 0) };
}

/** ScaleAnim.OnUpdate@6d3d330: t is normalized animation progress AFTER wait
 * and trigger handling. Before the first update, OnModBuildComplete instead
 * installs defaults.StartScale verbatim. This processor deliberately uses a
 * different formula from Weapon.CalculateBulletScale and replaces its result. */
export function nativeScaleAnimationScale(parameters: RecordData, t: number, flags: number,
  ownerAttrs: NativeScaleAttributes = {}, weaponType = 0): number {
  const p = nativeScaleAnimDefaults(parameters);
  const progress = Math.max(0, Math.min(1, t));
  let scale = p.StartScale + scaleFpMultiply(p.TargetScale - p.StartScale, progress);
  if (flags & 128) return scale;
  const familyAttribute = weaponType === 7 ? 'AllFlameThrowerThickness%'
    : weaponType === 14 ? 'AllSlashBulletScale%' : weaponType === 10 ? 'AllWaveBulletScale%' : '';
  const delta = (ownerAttrs['BulletScale%'] || 0) + (ownerAttrs[familyAttribute] || 0);
  const multiplier = scaleFpMultiply(1 + delta, 1 + (ownerAttrs['BulletScaleExtra%'] || 0));
  scale = scaleFpMultiply(scale, multiplier);
  return scale;
}

/** Numeric mod repeats use the native processor's additions; preserve records
 * for the non-additive lifecycle processors instead of losing them in a map. */
export function nativeRuntimeWeapon(base: RecordData, state?: WeaponState): RecordData {
  if (!state?.nativeMods) return base;
  const all = nativeModRecords(base.mods || [], state.nativeMods);
  const mods: RecordData[] = [];
  const names = new Set(all.map(mod => mod.type));
  for (const name of names) {
    const records = nativeModParameters(all, name);
    const parameters = { ...records[0] };
    const add = (keys: string[]) => {
      for (const key of keys) parameters[key] = records.reduce((sum, p) => sum + Number(p[key] || 0), 0);
    };
    if (name === 'ThroughMod') {
      add(['ThroughCount']);
      parameters.ThroughProbability = records.reduce((sum, p) => sum + Number(p.ThroughProbability ?? 1), 0);
      // ThroughModParams.DefaultAttackPercent is the native -555 sentinel.
      parameters.AttackPercent = Math.max(...records.map(p => Number(p.AttackPercent ?? -555)));
    } else if (name === 'WeaponCDReset2ExAttackMod') {
      add(['ExAttack']);
    } else if (name === 'WeaponMultiMod') {
      add(['FireCount', 'FireHoldTime', 'ExAttack', 'FrontOffset', 'FireRate']);
      // AddModRepeat deliberately retains the first FireInterval.
    } else if (name === 'WeaponDulBulletMod') {
      add(['BulletNum']);
      parameters.ZOffsets = records.flatMap(p => p.ZOffsets || []);
      parameters.SpaceOffset = records.at(-1)?.SpaceOffset ?? 0;
      parameters.Formation = records.at(-1)?.Formation ?? 0;
    } else if (name === 'WeaponForsideMod') {
      parameters.SideBulletNum = records.reduce((sum, p) => sum + Number(p.SideBulletNum ?? 1), 0);
      parameters.PerAngle = records.at(-1)?.PerAngle ?? 0;
    } else if (name === 'EjectMod') {
      add(['EjectCount', 'AttackPercent', 'SpeedPercent']);
      // EjectModParams.ctor loads FP constants [1,10] from 0x1a8d8c0.
      parameters.EjectProbability = records.reduce((sum, p) => sum + Number(p.EjectProbability ?? 1), 0);
      parameters.EjectDistance = Math.max(...records.map(p => Number(p.EjectDistance ?? 10)));
      parameters.EjectDelayDuration = Math.max(...records.map(p => Number(p.EjectDelayDuration || 0)));
    } else if (name === 'FollowMod') {
      add(['RotateSpeed', 'RotateSpeedUpRate']);
      parameters.DeviationAngle = Math.max(...records.map(p => Number(p.DeviationAngle || 0)));
    }
    else if (name === 'ReboundMod') add(['ReBoundCount']);
    else if (name === 'WeaponContinueMod') {
      add(['TotalBulletCount']);
      parameters.ContinueProbability = Math.max(...records.map(p => Math.max(0, Math.min(1, Number(p.ContinueProbability ?? 1)))));
    } else if (name === 'WeaponSalvoMod') {
      add(['Count', 'TotalAngle']);
      for (const key of ['StartAngle', 'Confusion', 'FireInterval', 'IsClockWise', 'IsShapeS', 'IsSymmetricShooting']) parameters[key] = records.at(-1)?.[key] ?? 0;
    }
    else if (name === 'BlackHoleMod') {
      // BlackHoleModParams.ctor supplies 4/4/512 even for a repeat that
      // only configures IgnoreThroughMapOutWall.
      for (const key of ['PullRadius', 'PullStrength']) parameters[key] = records.reduce((sum, p) => sum + Number(p[key] ?? 4), 0);
      // Each repeat calls CheckThroughMapOutWall, which adds OR removes the
      // wall flag. The last parameter wins, rather than boolean OR.
      parameters.IgnoreThroughMapOutWall = Boolean(records.at(-1)?.IgnoreThroughMapOutWall);
      parameters.BulletTrait = records.reduce((traits, p) => traits | Number(p.BulletTrait ?? 512), 0);
    } else if (name === 'BuffMod') {
      // Separate IDs each perform their own probability roll. Same-ID repeats
      // are merged by EnemyStatusEffects.mergeMods at the actual hit.
      for (const row of records) mods.push({ type: name, parameters: row });
      continue;
    } else if (records.length > 1) {
      for (const row of records) mods.push({ type: name, parameters: row });
      continue;
    }
    mods.push({ type: name, parameters });
  }
  if (names.has('DisableReboundMod')) for (let i = mods.length - 1; i >= 0; i--) if (mods[i].type === 'ReboundMod') mods.splice(i, 1);
  if (names.has('DisableEjectMod')) for (let i = mods.length - 1; i >= 0; i--) if (mods[i].type === 'EjectMod') mods.splice(i, 1);
  for (const [disable, target] of [['DisableFollowMod', 'FollowMod'], ['DisableBlackHoleMod', 'BlackHoleMod'], ['DisableThroughMod', 'ThroughMod']]) {
    if (names.has(disable)) for (let i = mods.length - 1; i >= 0; i--) if (mods[i].type === target) mods.splice(i, 1);
  }
  const switchMod = mods.find(mod => mod.type === 'SwitchTrajectoryMod');
  if (switchMod) {
    // The only trajectory switch in this weapon pool is MoveSnake. Native
    // OnModBuildComplete selects ActiveMod, then disables other trajectories.
    const activeName = String(switchMod.parameters.ActiveMod || base.trajectory || '');
    const selected = mods.find(mod => mod.type === activeName);
    if (selected) return { ...base, mods, trajectory: activeName, trajectoryParameters: selected.parameters };
  }
  return { ...base, mods };
}

/** WeaponContinueModProcessor.FillLoadData@6dd4dd8. One roll chooses the
 * entire additional burst; the interval spans BPS-1 gaps in one second. */
export function nativeContinueFirePlan(parameters: RecordData, baseCount: number, random: () => number, modificationCount = 0): {
  count: number; interval: number; holdTime: number; delays: number[]; allowSwitchTarget: boolean;
} {
  const additional = Number(parameters.TotalBulletCount || 0);
  const probability = Number(parameters.ContinueProbability ?? 1);
  const chosen = additional > 0 && probability < 1 && random() >= probability ? 0 : additional;
  const count = Math.max(0, Math.trunc(baseCount + chosen + modificationCount));
  const gaps = Number(parameters.BulletCountPerSecond || 0) - 1;
  const interval = gaps === 0 ? 0 : Math.trunc(65536 / gaps) / 65536;
  return { count, interval, holdTime: (count - 1) * interval,
    delays: Array.from({ length: count }, (_, i) => i * interval),
    allowSwitchTarget: Number(parameters.DisableSwitchTarget || 0) === 0 };
}

/** The state retains timers/identity; skill contributions are rebuilt from the
 * native learning history so repeated cards apply once per learned occurrence. */
export function applyNativeWeaponAttributes(state: WeaponState, attributes: Record<string, number>): void {
  state.nativeAttributes = attributes;
  state.damageBonus = attributes['BulletAttack%'] || 0;
  state.cooldownReduction = 1 - (attributes['FireCDReduce%'] ?? 1);
  state.critBonus = attributes['CritRate%'] || 0;
  state.critDamage = attributes['CritValue%'] || 0;
  state.skillDamage = attributes['SkillUpgradeAttack%'] || 0;
  state.scaleBonus = attributes['BulletScale%'] || 0;
  state.speedBonus = attributes['BulletSpeed%'] || 0;
  state.lifetime = attributes.Bullet_LifeTime || 0;
  state.lifetimePercent = attributes['BulletLifeTime%'] || 0;
  state.beamWidth = attributes['LaserThickness%'] || 0;
  state.beamLength = attributes['LaserLength%'] || 0;
  state.parallelPercent = attributes['DulBulletCount%'] || 0;
  state.sidePercent = attributes['ForsideBulletCount%'] || 0;
  state.salvo = attributes.WeaponSalvoCount || 0;
  state.salvoAngle = attributes.WeaponSalvoAngle || 0;
  state.reflections = attributes.ReflectionCount || 0;
  state.explosionScale = attributes['ExplodeRadius%'] || 0;
  state.hitIntervalFactor = attributes['MinBulletHurtTimeReduce%'] ?? 1;
}
