import type { GameContent, RecordData } from './model';
import { nativeDropMissileWeaponSupported } from './native-drop-missile';
import { parseNativeBehavior, nativeEnemyAttackTimings } from './enemy-behavior-extensions';
import { nativeBossWeaponFor } from './boss-logic';
import { nativeSalvoFeatures } from './native-salvo';
import { nativeHurtTypeFromExpressions } from './native-back-death';
import { nativeStraightFallSummonSupported } from './native-summons';
import { nativeSequentialBossSupported } from './native-boss-behavior';
import { nativeChapter9WallQuerySupported } from './native-map-out-walls';
import { chapterDeathCallParameters } from '../chapter-death-traits';
import { chapterSuicideTraitSupported } from '../chapter-suicide-traits';
import { chapterEnemyOrbitTraitSupported } from '../chapter-enemy-orbit';

/** Static admission checks, not proof of visual or numerical fidelity. Keep
 * unknowns visible; only definite missing data/handlers block a new chapter. */
export interface ContentCapabilityIssue {
  severity: 'error' | 'warning';
  code: string;
  reference: string;
  message: string;
}
export interface ContentCapabilityOverrides {
  enemyAI?: readonly string[];
  trajectories?: readonly string[];
  weaponMods?: readonly string[];
  behaviorActions?: readonly string[];
  monsterSkills?: readonly number[];
  mapDoors?: boolean;
}
export interface ContentCapabilityReport {
  chapterId: number;
  canPlay: boolean;
  issues: ContentCapabilityIssue[];
}

// These names have explicit handlers in the existing runtime. Inclusion means
// a handler exists, not that every optional parameter has been reconstructed.
const enemyAI = new Set(['340001', 'AIMoveDynamicRotateCenter', '200007', '320013', 'AICommonBoss', 'AICommonBossNew', 'AIFixedBezierPath',
  'AIMoveFollowTarget', 'AIMoveInTwoPointsAndAttack', 'AIMoveInTwoPointsAndAttackNew',
  'AIMoveOnPathAttackLoopBorn', 'AIMoveOnPathLoopBorn', 'AIMoveReboundWall',
  'AIMoveToBottomAndAttack', 'AIMoveToBottomAndAttackNew', 'AIMoveUpDown', 'AIMoveForward']);
const trajectories = new Set(['MoveStraight', 'MoveSnake', 'MoveDiffusion', 'Laser', 'LaserStick', 'SpecialLaserStick', 'LaserSymmetricByOwner', 'ReflectionRay', 'ReflectionRayChaser', 'LaserRotateByOwner', 'LaserRandomPoints',
  'SectorSpreadMod', 'SemiCircleMov2Mod', 'MoveAndReturnStay', 'FlashChain', 'FollowFlashChain', 'Thunder', 'FixedPos', 'OverLapShapeAndStay', 'FollowOwner', 'FallDown']);
const weaponMods = new Set(['WeaponSalvoMod', 'WeaponMultiMod', 'WeaponEllipseMod', 'WeaponCircleBulletMod',
  'ThroughMod', 'ReboundMod', 'FollowMod', 'ScaleAnimMod', 'ScaleOnlyColliderMod', 'IgnoreNoReboundDieMod', 'LaserLockMod', 'TimeCreateMod',
  'MoveDisDieMod', 'WeaponFireOnDeadMod', 'WeaponDiamondMod', 'WeaponGradeMod', 'WeaponDulBulletMod',
  'WeaponChargeMod', 'WeaponContinueMod', 'WeaponForsideMod', 'WeaponChangeBulletMod', 'ExplosionMod', 'BuffMod', 'EjectMod',
  'DisableReboundMod', 'DisableEjectMod', 'DisableFollowMod', 'DisableThroughMod', 'DisableThroughAttackPercentReduceMod',
  'DisableBlackHoleMod', 'BlackHoleMod', 'DetectBulletMod', 'WeakLaserMod', 'HitBehindFissionMod', 'DisableHitBehindFissionMod',
  'CreateWeaponUponDeadMod', 'KillBulletMod', 'FlashChainMod', 'RandomTargetMod', 'SelfRotationMod', 'SwitchTrajectoryMod', 'MoveSnake', 'WeaponCDReset2ExAttackMod']);
const parse = (value: unknown): any => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { try { return JSON.parse(value.replace(/}}$/, '}')); } catch { return undefined; } }
};

export function inspectContentCapabilities(content: GameContent, extra: ContentCapabilityOverrides = {}): ContentCapabilityReport {
  const chapter = content.chapter;
  const chapterId = Number(chapter.chapter.id);
  const issues: ContentCapabilityIssue[] = [];
  const seen = new Set<string>();
  const report = (code: string, reference: string, message: string, severity: ContentCapabilityIssue['severity'] = 'warning') => {
    const key = `${code}:${reference}`;
    if (!seen.has(key)) { seen.add(key); issues.push({ severity, code, reference, message }); }
  };
  // Previously shipped chapters remain available with explicit limitations.
  // Their known gaps must not be relabelled as fully supported to pass a gate.
  const missingHandler = chapterId <= 10 ? 'warning' : 'error';
  const aiSupport = new Set([...enemyAI, ...(extra.enemyAI || [])]);
  const trajectorySupport = new Set([...trajectories, ...(extra.trajectories || [])]);
  const modSupport = new Set([...weaponMods, ...(extra.weaponMods || [])]);
  const behaviorSupport = new Set(['MoveDynamicRotateCenter', ...(extra.behaviorActions || [])]);
  const monsterSkillSupport = new Set([300025, ...(extra.monsterSkills || [])]);
  const requiredWeapons = new Set<number>();
  const collectWeapons = (value: unknown): void => {
    const parsed = parse(value);
    if (parsed && parsed !== value) { collectWeapons(parsed); return; }
    if (Array.isArray(value)) { for (const item of value) collectWeapons(item); return; }
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (/(?:weaponids?|preloadweapons?)$/i.test(key)) {
        for (const id of Array.isArray(item) ? item : [item]) if (typeof id === 'number' && id > 0) requiredWeapons.add(id);
      }
      collectWeapons(item);
    }
  };
  const requiredEnemies = new Set<number>(chapter.enemyIds || []);
  const availableModels = new Set<number>((Object.values(content.assets.prefabs || {}) as RecordData[])
    .flatMap(prefab => prefab.modelIds || []).map(Number));
  for (const id of requiredEnemies) {
    const entity = chapter.entities[id];
    if (!entity) { report('missing-entity', String(id), `缺少敌人配置 ${id}`, 'error'); continue; }
    if (!aiSupport.has(String(entity.ai?.type))) report('enemy-ai', String(id), `敌人 ${id} 的 AI ${entity.ai?.type} 尚无已登记处理器`, missingHandler);
    const ai = entity.ai?.parameters || {};
    if (entity.ai?.type === 'AIMoveReboundWall' && !nativeChapter9WallQuerySupported(chapterId, Number(chapter.chapter.parameters.chapterType), String(chapter.chapter.parameters.dataPath)))
      report('enemy-rebound-physics', String(id), `敌人 ${id} 所在地图的物理墙体与静态障碍查询尚未核对接入`, missingHandler);
    else if (entity.ai?.type === 'AIMoveReboundWall')
      report('enemy-rebound-corner-order', String(id), `敌人 ${id} 已接原程序墙；不同墙面完全等距时仍缺原完整物理场景条目顺序`, 'warning');
    if (entity.ai?.type === 'AIMoveUpDown' && entity.weaponIds?.length !== 1)
      report('enemy-updown-weapon-choice', String(id), `敌人 ${id} 的上下冲刺多武器随机选择尚未闭合`, missingHandler);
    if (!availableModels.has(Number(entity.modelId)))
      report('enemy-model', String(id), `敌人 ${id} 缺少模型 ${entity.modelId} 的资源清单`, missingHandler);
    if (Number(ai.PathId) > 0 && !content.assets.geometry?.paths?.[ai.PathId])
      report('enemy-path', `${id}/${ai.PathId}`, `敌人 ${id} 缺少移动路径 ${ai.PathId}`, missingHandler);
    // Summoned children can have their own summoning and weapon dependencies.
    // Keep this graph separate from preloaded player/subweapon entities.
    for (const summon of ai.CallMonsters || []) if (Number(summon.CallMonsterId) > 0)
      requiredEnemies.add(Number(summon.CallMonsterId));
    // SpecialTrait is a separate native entry point from MonsterTraitID and
    // MonsterAbility. Numeric entries learn skills; named entries create AI
    // trait handlers. Neither is implemented by the player weapon adapters.
    for (const trait of entity.raw.SpecialTrait || []) if (String(trait).trim()) {
      const deathCall = chapterDeathCallParameters(trait);
      if (deathCall) requiredEnemies.add(deathCall.callEntityID);
      else if (chapterSuicideTraitSupported(trait)) requiredWeapons.add(80001);
      else if (chapterEnemyOrbitTraitSupported(content, id, trait)) requiredWeapons.add(70053);
      else report('special-trait-unhandled', `${id}/${trait}`, `敌人 ${id} 的 SpecialTrait ${trait} 尚未接入`, missingHandler);
    }
    if (![5, 6].includes(Number(entity.raw.deathClassId)))
      report('enemy-death-handler', `${id}/${entity.raw.deathClassId}`, `敌人 ${id} 的死亡类 ${entity.raw.deathClassId} 尚未还原`, missingHandler);
    if (['AICommonBoss', '340001'].includes(String(entity.ai?.type))) {
      for (const weaponId of entity.weaponIds || []) {
        const timing = nativeBossWeaponFor(id, weaponId);
        if (!timing || timing.enterHold == null || timing.exitEnd == null
          || (timing.fireHoldSeconds > 0 ? timing.fireEvent == null : timing.exitFire == null))
          report('boss-attack-timing', `${id}/${weaponId}`, `Boss ${id} 武器 ${weaponId} 缺少实际动画开火/结束事件`, missingHandler);
      }
    }
    const sequentialBoss = entity.ai?.type === 'AICommonBossNew' && nativeSequentialBossSupported(entity);
    if (entity.ai?.type === 'AICommonBossNew') {
      if (!sequentialBoss) report('boss-behavior-program', String(id), `Boss ${id} 的行为任务组合尚未闭环`, missingHandler);
      if (!entity.raw.rotateWhenAttack?.length || entity.raw.rotateWhenAttack.some((value: number) => value === 1))
        report('boss-behavior-rotation', String(id), `Boss ${id} 的攻击旋转参数尚未闭环`, missingHandler);
    }
    if (['200007', '320013', 'AICommonBossNew'].includes(String(entity.ai?.type))) {
      if (entity.ai?.type !== 'AICommonBossNew' && entity.weaponIds?.length !== 1) report('aimed-ai-weapons', String(id), `敌人 ${id} 的多武器攻击调度尚未闭环`, missingHandler);
      const supportedBaseCooldown = entity.ai?.type === '320013'
        && [320063, 320075].includes(id) && Number(entity.stats.fireInterval) === 4;
      if ((Number(entity.stats.fireInterval) !== 0 && !supportedBaseCooldown) || (entity.weaponIds || []).some((weaponId: number) => chapter.weapons[weaponId]?.raw?.WeaponAttr?.length))
        report('aimed-ai-cooldown', String(id), `敌人 ${id} 的 FireCD/WeaponAttr 调度变体尚未闭环`, missingHandler);
      for (const weaponId of entity.weaponIds || []) {
        const timing = nativeEnemyAttackTimings[id]?.weapons[weaponId];
        if (!timing || timing.enterHold == null || timing.exitEnd == null
          || (timing.fireHoldSeconds > 0 ? timing.fireEvent == null : timing.exitFire == null))
          report('enemy-attack-timing', `${id}/${weaponId}`, `敌人 ${id} 武器 ${weaponId} 缺少实际动画开火/结束事件`, missingHandler);
      }
      if (Number(entity.raw.attackPossibility) !== 65536)
        report('aimed-ai-probability', String(id), `敌人 ${id} 的非必发概率分支尚未闭环`, missingHandler);
      if (String(entity.ai.type) === '200007' && Number(ai.WarnTime || 0) !== 0)
        report('aimed-ai-warning', String(id), `敌人 ${id} 的 WarnTime 预警动作尚未闭环`, missingHandler);
      if (String(entity.ai.type) === '320013' && ![0, 1].includes(Number(ai.WarningDir || 0)))
        report('aimed-ai-direction', String(id), `敌人 ${id} 的 WarningDir ${ai.WarningDir} 尚未接入`, missingHandler);
    }
    for (const traitId of entity.raw.MonsterTraitID || [])
      report('monster-trait', `${id}/${traitId}`, `敌人 ${id} 的特性 ${traitId} 独立技能/材质行为尚未接入`, missingHandler);
    if (ai.CallMonsters?.length) {
      if (!nativeStraightFallSummonSupported(entity, chapter.chapter.parameters || {}))
        report('enemy-summon', String(id), `敌人 ${id} 的 CallMonsters 召唤参数组合尚未接入`, missingHandler);
      else {
        const childId = Number(ai.CallMonsters[0].CallMonsterId), child = chapter.entities[childId];
        if (!child || Number(child.raw?.Type) !== 2)
          report('summon-child-type', String(childId), `召唤子怪 ${childId} 不符合已闭环的 Type2 分支`, missingHandler);
      }
    }
    if (ai.Behaviour && !sequentialBoss) {
      try {
        for (const node of parseNativeBehavior(ai.Behaviour)) if (!behaviorSupport.has(node.name))
          report('enemy-behavior', `${id}/${node.name}`, `敌人 ${id} 的 Behaviour 任务 ${node.name} 尚未接入`, missingHandler);
      } catch {
        report('enemy-behavior-format', String(id), `敌人 ${id} 的 Behaviour 无法解析`, missingHandler);
      }
    }
    const effects: string[] = (entity.raw.MonsterAbility || entity.raw.MonsterAbilityID || []).flatMap((abilityId: number) => chapter.monsterAbilities?.[abilityId]?.effects || []);
    if (entity.raw.Type === 2) for (const feature of Object.values(chapter.chapterMonsterFeatures || {}) as RecordData[])
      if (feature.Type === 'Skill') effects.push(String(feature.Args));
    for (const effect of effects) {
      const match = String(effect).trim().match(/^(?:skill=)?(\d+)$/i);
      if (match && !monsterSkillSupport.has(Number(match[1])))
        report('monster-skill', `${id}/${match[1]}`, `敌人 ${id} 的技能 ${match[1]} 触发与 Buff 行为尚未接入`, missingHandler);
    }
    collectWeapons(entity.raw);
    for (const weaponId of entity.weaponIds || []) requiredWeapons.add(weaponId);
  }
  const visited = new Set<number>();
  for (const id of requiredWeapons) {
    if (visited.has(id)) continue;
    visited.add(id);
    const weapon = chapter.weapons[id];
    if (!weapon) { report('missing-weapon', String(id), `缺少武器依赖 ${id}`, 'error'); continue; }
    collectWeapons(weapon.raw);
    if (!chapter.bullets[weapon.bulletId]) report('missing-bullet', String(weapon.bulletId), `武器 ${id} 缺少子弹 ${weapon.bulletId}`, 'error');
    const expressions = chapter.bullets[weapon.bulletId]?.parameters?.hurtAttributes;
    if (expressions?.length && nativeHurtTypeFromExpressions(expressions) === undefined)
      report('hurt-expression', String(weapon.bulletId), `子弹 ${weapon.bulletId} 的伤害类型表达式尚未识别`, missingHandler);
    if (!trajectorySupport.has(weapon.trajectory)) report('trajectory', String(id), `武器 ${id} 的弹道 ${weapon.trajectory || '(空)'} 尚无已登记处理器`, missingHandler);
    if (weapon.trajectory === 'Laser') {
      for (const [key, value] of Object.entries(weapon.trajectoryParameters || {})) if (key !== 'FireHoldTime' && value)
        report('plain-laser-parameters', `${id}/${key}`, `普通激光 ${id} 的 ${key} 变体尚未闭环`, missingHandler);
      for (const mod of weapon.mods || []) if (['FollowMod', 'ReboundMod'].includes(mod.type))
        report('plain-laser-combination', `${id}/${mod.type}`, `普通激光 ${id} 与 ${mod.type} 的组合尚未闭环`, missingHandler);
    }
    if (weapon.trajectory === 'LaserRotateByOwner' || weapon.trajectory === 'LaserRandomPoints') {
      const params = weapon.trajectoryParameters || {};
      const allowed = weapon.trajectory === 'LaserRotateByOwner'
        ? ['FireHoldTime', 'LaserType', 'SweepAngle', 'SweepSpeed', 'SweepOriginDir', 'SweepAccelerateSpeed', 'SweepMaxSpeed', 'SweepMaxAngle']
        : ['FireHoldTime', 'PointCount', 'PointInterval', 'PointEffectId', 'FireDelay', 'RandomType', 'EdgeDistanceX', 'EdgeDistanceZ'];
      for (const [key, value] of Object.entries(params)) if (!allowed.includes(key) && value !== 0 && value !== false && value != null)
        report('laser-parameters', `${id}/${key}`, `激光 ${id} 的参数 ${key} 尚未接入`, missingHandler);
      if (weapon.trajectory === 'LaserRotateByOwner' && ![0, 1].includes(Number(params.LaserType || 0)))
        report('laser-mode', String(id), `激光 ${id} 的 LaserType ${params.LaserType} 尚未接入`, missingHandler);
      if (weapon.trajectory === 'LaserRandomPoints' && (Number(params.PointCount) < 2 || Number(params.PointInterval) < 0 || Number(params.FireDelay) < 0))
        report('laser-points', String(id), `激光 ${id} 的点数/时间参数不满足已接入路径`, missingHandler);
      // The new fixed polyline and owner sweep share existing hit handling.
      // Rebound, ejection, child weapons and scale/follow interactions need
      // their own native closure before accepting those combinations.
      for (const mod of weapon.mods || []) if (mod.type !== 'ThroughMod')
        report('laser-mod-combination', `${id}/${mod.type}`, `激光 ${id} 与 ${mod.type} 的组合尚未闭环`, missingHandler);
    }
    for (const mod of weapon.mods || []) {
      if (!modSupport.has(mod.type) && !(mod.type === 'ExplosionUponDeathMod' && nativeDropMissileWeaponSupported(Number(id)))) report('weapon-mod', `${id}/${mod.type}`, `武器 ${id} 的 ${mod.type} 尚未确认完整执行`, missingHandler);
      if (mod.type === 'WeaponSalvoMod') {
        const active = ['Confusion', 'IsShapeS', 'IsSymmetricShooting'].some(field => Number(mod.parameters?.[field]) === 1);
        const alternative = (weapon.mods || []).filter((item: RecordData) => ['WeaponGradeMod', 'WeaponCircleBulletMod', 'WeaponEllipseMod', 'WeaponDiamondMod'].includes(item.type));
        if (active && (!nativeSalvoFeatures.strictIntegerFlags || alternative.length))
          report('salvo-shape-combination', String(id), `武器 ${id} 的特殊齐射与其他形状组合尚未闭环`, missingHandler);
      }
      if (mod.type === 'WeaponDulBulletMod' && (Number(mod.parameters?.Formation || 0) !== 0 || mod.parameters?.ZOffsets?.length))
        report('weapon-mod-parameters', `${id}/${mod.type}`, `武器 ${id} 的双发 Formation/ZOffsets 变体尚未接入`, missingHandler);
    }
  }
  // InitWaterfallMap sets HasDoor=false before WorldBattle's LoadDoor gate;
  // a populated DoorRes is deliberately inactive in ordinary Waterfall mode.
  if (Number(chapter.map?.DoorRes) > 0 && ![7, 8].includes(Number(chapter.chapter?.raw?.chapterType)) && !extra.mapDoors)
    report('map-door', String(chapter.map.id), '非 Waterfall 模式的动态门行为尚未还原', missingHandler);
  for (const wave of chapter.waves || []) {
    for (const key of ['WaveStartSpecialUIType', 'WaveEndSpecialUIType']) {
      const tasks = wave.raw?.[key] || [];
      for (const type of tasks) if (![1, 2, 4, 5].includes(type))
        report('wave-ui-task', `${wave.number}/${key}/${type}`, `波次 ${wave.number} 的 UI 任务 ${type} 尚未接入`, missingHandler);
      // Start task 1 receives special native index handling. Certify the
      // observed ordinary sequences, not arbitrary rearrangements of names.
      const supported = key === 'WaveStartSpecialUIType' ? ['', '1', '1,2', '1,5'] : ['', '4'];
      if (!supported.includes(tasks.join(',')))
        report('wave-ui-sequence', `${wave.number}/${key}`, `波次 ${wave.number} 的 UI 任务顺序 ${tasks.join(',')} 尚未闭环`, missingHandler);
    }
    for (const event of wave.events || []) {
    const params: RecordData = event.parameters || {};
    if (params.pathMonster?.length || params.MonsterFlushConfigId?.length) report('spawn-mode', String(event.id), '事件包含尚未接入的专用刷怪模式', 'error');
    if (params.RandomNpc && params.RandomNpc !== 1) report('random-npc', String(event.id), '随机 NPC 条件尚未接入；值 1 已确认被原生忽略', missingHandler);
    const randomConfig = content.assets.geometry?.randomSpawns?.[event.id];
    if (randomConfig && new Set(randomConfig.groups.flatMap((group: RecordData) => group.entityIds)).size > 1)
      report('random-pool-budget', String(event.id), '随机出怪池包含不同实体，运行抽取与原版预算权重尚未闭环', missingHandler);
    }
  }
  for (const dependency of chapter.dependencyAudit?.missing || [])
    report('missing-dependency', `${dependency.kind}/${dependency.id}`, `缺少 ${dependency.kind} 依赖 ${dependency.id}（${dependency.source}）`, 'error');
  return { chapterId, canPlay: !issues.some(issue => issue.severity === 'error'), issues };
}

/** APK 1.1.6's eleven battle roots now have explicit entity/trajectory/skill
 * adapters. This is handler availability, not a runtime fidelity certification. */
export const establishedWeaponFamilies: readonly number[] = [10000101, 10000201, 10000301, 10000401, 10000601, 10000701,
  10000901, 10001101, 10001501, 10001601, 10001701];
export function runtimeWeaponFamilyEnabled(familyId: number, enabled: readonly number[] = establishedWeaponFamilies): boolean {
  return enabled.includes(familyId);
}
