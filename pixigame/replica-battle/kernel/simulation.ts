import { projectileSound } from './combat-audio';
import {nativeProtectHpRateRaw} from '../../src/replica/native-failure-protection.js';
import {firstGuideChoices} from '../battle-onboarding';
import { clamp, lerp, sweep, newWeapon, type WeaponState, type Choice, type Effect, type Enemy, type GameContent, type Phase, type Pickup, type Point, type Projectile, type RecordData, type Spawn } from './model';
import { advancePickup, createPickup } from './drop-motion';
import { markOrdinaryDeathVisual } from '../small-death-visual.js';
import { markAcidHitVisual } from '../acid-weapon-visual.js';
import { markBlackHoleHitVisual } from '../black-hole-hit-visual.js';
import { markIceSawHitVisual } from '../ice-saw-hit-visual.js';
import { markSwordHitVisual } from '../sword-hit-visual.js';
import { markIceHitVisual } from '../ice-weapon-visual.js';
import { markMagneticHitVisual } from '../magnetic-weapon-visual.js';
import { markLaserHitVisual } from '../laser-weapon-visual.js';
import { markScorchHitVisual } from '../scorch-weapon-visual.js';
import { markMissileExplosionVisual } from '../missile-weapon-visual.js';
import { markFrostBurstVisual } from '../frost-burst-visual.js';
import { markPlayerDeathVisual } from '../player-death-visual.js';
import { NativeKillMilestoneBuffs, nativeEquipmentMaxHp } from './native-equipment-growth';
import { NativeCooldownResetAttack, nativeHighestStarSecondWeapon } from './native-equipment-weapon-effects';
import { applyCriticalThrough } from './critical-through';
import { NativePrismRuntime, nativePrismProbeSegments, type NativePrismParams } from './native-prism';
import nativeResearchSource from '../../src/replica/native-research-source.json';
import { splitGoldReward, healthDropRateRaw, healthPickupFraction, NativeWaveGold } from './drop-rewards';
import { originalEffectDuration } from './original-effects';
import { nativeShapeRadii, sampleBornPosition, nativeBossWeaponFor, bossAttackTimeline, bossAnimationNames, createBossAttackGate, finishBossAttack, advanceBossCooldown, type BossAttackGate } from './boss-logic';
import { NativeBackDeath, nativeBackDeathSelection, nativeBackDeathFirePlan, nativeHurtTypeFromExpressions, type NativeDeathFirePlan } from './native-back-death';
import { nativeCommonBossSettings, nativeCommonBossLaserPlan, advanceNativeFollowTarget, createNativeBoss340001State, advanceNativeBoss340001, createNativeUpDownState, advanceNativeUpDown, type NativeBoss340001State, type NativeUpDownState } from './chapter-enemy';
import { originalFollowerCanFire, originalFollowerCycle, originalParallelSpacing, originalIsLaserTrajectory, nativeDiamondOffsets, nativeGradeAngles } from './weapon-pattern';
import { nativeSalvoPattern, nativeSalvoDeflection, nativeFirePositionAngle, nativeShotAimMode, type NativeSalvoShot } from './native-salvo';
import { createAttackLoop, advanceAttackLoop, canEnemySendBullet, createTwoPointMove, advanceTwoPointMove, enemyEntryPoint, nativeBornSettings, bottomAttackTarget, enemyLoopRestartPoint, advanceMoveToPoint, bossRandomTarget, advanceBossMove, bossDefaults, selectBossWeapon, type AttackLoopState, type TwoPointMove } from './enemy-ai';
import { createNativeEnemyPath, sampleNativeEnemyPath, nativePathMovementAngle, nativePathDistanceDelta, type NativeEnemyPath } from './enemy-path';
import { chapterPathSelfRotationEnabled, chapterPathRotationRadians } from '../chapter-path-self-rotation';
import { drawNativeOrdinaryChoices, drawNativeBreakthroughChoices, nativeInitialSkillGroupCount, type NativeSkillCandidate } from './skill-choice';
import { nativeSkillEligible } from './skill-eligibility';
import { createNativeEnemyRebound, checkNativeEnemyRebound, advanceNativeEnemyRebound, nativeEnemyReboundScrollXOffset, nativeReboundRay, nativeReboundRayOffset, type NativeEnemyReboundState } from './native-enemy-rebound';
import { NativeMapOutWalls, nativeChapter9WallQuerySupported, nativeOrdinaryWallQueryMask } from './native-map-out-walls';
import { nativeWallLinecast } from './native-wall-query';
import { NativeScrollCamera } from './native-scroll-camera';
import { nativePlayerMovementBounds } from './native-camera-projection';
import { advanceNativeDiffusion, advanceNativeSnake, advanceNativeStraightSpeed, createNativeProjectileMotion, nativeEllipseOffsets, type NativeProjectileMotion } from './enemy-projectile';
import { nativeMonsterElementMultiplier, nativeMonsterBlocksThrough, nativeMonsterAttribute, nativeMonsterImmuneAttract, nativeIsBoss } from './monster-abilities';
import { MonsterSkillRuntime, nativeMonsterBuffs } from './monster-skill-runtime';
import { runtimeWeaponFamilyEnabled } from './content-capabilities';
import { nativeUrgencyParameters, startNativeUrgencyWarning } from './enemy-warning';
import chestAnimations from '../public/data/chest-animation.json';
import { planDeveloperSkill, type DeveloperSkill } from './developer-skill-catalog';
import nativeBattleRules from '../../src/replica/native-battle-rules.json' with { type: 'json' };
import { entryWeaponAttribute, nativeCooldownMultiplier, nativeInheritedPassiveBonuses, nativeElementAndTraitDamageBonus, nativeLoadoutDamageFactors, nativeDistanceCriticalBonuses, nativeLoadoutDamageAttributeNames, nativeLoadoutHealAmount, nativeLoadoutHpDropRate, nativeLoadoutIncomingDamageFactors, nativeLoadoutMissChance, nativeLoadoutSurvivalAttributeNames } from './combat-attributes';
import { registerLoadoutAttributeConsumers, parseNativeConditionalAttributes, nativeConditionalAttributeGroups, mergeNativeConditionalAttributeGroups, nativeLoadoutWorldZBand, advanceNativeHpThreshold, type NativeHpThresholdState } from './loadout-attributes';
import { NativeLoadoutSpecialActions, type LoadoutSpecialFire } from './loadout-special-actions';
import { NativeColliderScale } from './loadout-projectile-mods';
import { NativePlaneSpecialActions, nativeSkillWeaponAttackUpdates, nativeAnyWeaponBulletModification, type NativeAnyWeaponBulletModification } from './plane-special-actions';
import { NativeHawkMissileRuntime } from './native-hawk-missile';
import { NativeNextFireBoostRuntime } from './native-next-fire-boost';
import { nativeInstallPersistentMod, nativeBulletUsesLifetimeExpiration, nativeBulletIsPersistent } from './native-persistent-mod';
import { NativeLoadoutCooldownActions, nativeFollowerCooldownDeadline, nativeCharacterCooldownDeadline } from './native-loadout-cooldowns';
import { NativePendingBulletAttributes, nativeFixedFromString } from './native-pending-bullet-attributes';
import { nativeLoadoutDropItem, nativeLoadoutDropPlan, nativeLoadoutDropCanAbsorb, nativeLoadoutPickupEffect, NativeLoadoutDropCounts, type NativeLoadoutDropItem } from './native-loadout-drops';
import { NativeSpecialWeaponAttributes, NativeSpecialMissileBoostCounter } from './loadout-special-attributes';
import { NativeSameTargetComboRuntime } from './native-same-target-combo';
import { registerLoadoutDependencyHandlers } from './loadout-dependencies';
import { loadoutRuntimeActions } from './special-skill-runtime';
import { EnemyStatusEffects, type StatusPulse, type StatusBulletSyncHost } from './status-effects';
import { resolveExplosionSpec, explosionOrigin, explosionCritChance } from './explosion-rules';
import { resolveThroughDelta, mergeThroughAttackPercent, advanceThroughScale } from './through-damage';
import { nativeDamageResult } from './damage-result';
import { createNativeRotatingLaser, advanceNativeRotatingLaser, nativeRotatingLaserSweepFinished, nativeRotatingLaserFireHold, createNativeRandomLaser, advanceNativeRandomLaser, nativeRandomLaserSegments, nativeRandomLaserPreFireDuration, nativeRandomLaserFireHold, type NativeRotatingLaserState, type NativeRandomLaserState } from './native-lasers';
import { nativeIsBottomAttackAI, parseNativeBehavior, createNativeDynamicRotate, advanceNativeDynamicRotate, createNativeAimedAttack, advanceNative200007, advanceNative320013, createNativeCeaseFire, advanceNativeCeaseFire, nativeCeaseFireDuration, nativeEnemyAttackTimeline, nativeEnemyAttackTimings, type DynamicRotateState, type AimedAttackState, type NativeCeaseFireState } from './enemy-behavior-extensions';
import { nativeStraightFallSummonSupported, createNativeSummons, advanceNativeSummons, beginNativeSummonChoice, nativeStraightFallChildSpawn, type NativeSummonState } from './native-summons';
import { nativeSequentialBossSupported, NativeFollowSlots, createNativeBossProgram, advanceNativeBossProgram, type NativeBossProgram } from './native-boss-behavior';
import { nativeLogicDelta } from './native-time';
import { nativePlainLaserLength, nativePlainLaserRay, type NativePlainLaserRay } from './native-plain-laser';
import { NativeWaveFlow, type NativeWaveFlowAction } from './wave-flow';
import { MissionCreators } from './mission-creators';
import type { WaveUIRequest } from './wave-ui';
import { NativeWaveExperience } from './wave-experience';
import { compileNativeSkillTrigger, compileNativeWeaponSkills, compileNativePassiveAttributes, compileNativePlayerSkills, nativeAttributeValue, mergeNativeAttribute, nativeInstalledAttributeContributions, NativeWeaponSkillRuntime, type NativeWeaponSkillSnapshot, type NativeWeaponActionCommand, type NativeWeaponEvent } from './weapon-skill-runtime';
import { nativeRuntimeWeapon, nativeContinueFirePlan, applyNativeWeaponAttributes, nativeBulletScale, nativeScaleAnimDefaults, nativeScaleAnimationScale } from './native-weapon-profile';
import { NativeSectorSpreadRuntime, nativeSectorRadius, nativeWeaponChargeHold, nativeExplosionRadius } from './weapon-runtime-extensions';
import { nativeCameraWallHit, nativeNearDamageBonus } from './native-projectile-mods';
import { NativeArcChain } from './native-arc-chain';
import { NativeOrbitWeaponRuntime, type NativeOrbitSettings } from './native-orbit-weapon';
import { NativeOrbitSpeedAttributes, nativeOrbitSpeed } from './native-orbit-speed-attributes';
import { chapterDeathChildren } from '../chapter-death-traits';
import { chapterSuicideFirePlan } from '../chapter-suicide-traits';
import { ChapterEnemyOrbits, chapterEnemyOrbitTraitSupported } from '../chapter-enemy-orbit';
import { NativeMissileRuntime, nativeSplitMissilePlan } from './native-missile';
import { NativeDropMissileRuntime, nativeDropMissileWeaponSupported } from './native-drop-missile';
import { nativeDeathExplosionPlan } from './native-death-explosion';
import { NativeCurveSwordRuntime, NativeVoidSlashRuntime, nativeSwordCompletionShot, nativeSwordSettings } from './native-curve-sword';
import { NativeFlashSplashRuntime, NativeTargetWeaponCooldowns } from './native-lightning-strike';
import { nativeNearbyRaySegments, NativeRayChaserRuntime } from './native-ray-actions';
import { NativeReflectionRayRuntime, nativeReflectionPathHurtRate, nativeReflectionDamageMultiplier } from './native-reflection-ray';
import { NativeExplosionRuntime, type NativeConsecutiveExplosion, type NativeExplosionEvent, type NativeExplosionFire, type NativeExplosionHost, type NativeExplosionSequenceHost } from './native-explosion';
import { NativeHitBehindFissionRuntime, nativeWeakLaserReplacementUids, nativeWeakLaserOnDeath, nativeCreateWeaponUponDeath, type NativeDerivedWeaponFire } from './native-derived-weapon-mods';
import { NativeEjectRuntime, type NativeEjectHost, type NativeEjectOutcome } from './native-eject';
import { NativeReturningProjectileRuntime } from './native-returning-projectile';
import { NativeThunderRuntime } from './native-thunder';
import { thunderRangeTargets } from './thunder-presentation';
import { NativeKillBulletRuntime, nativeInstallKillBulletMod, nativeInstallFollowOwnerKillBullet } from './native-kill-bullet';
import { NativeBlackHolePullRuntime, NativeBlackHoleBoundaryRuntime, NativeBlackHoleOverlapAttributes, nativeBlackHoleSplitPlan, nativeBlackHoleTransportPlan, type NativeBlackHolePullHost } from './native-black-hole';

type AlarmQueueAim = { target: Point; mount: Point; initialAngle: number; lockedDelta?: number };
type FixedWeaponFirePlan = Omit<NativeDeathFirePlan, 'allowDeadOwner'> & { allowDeadOwner: boolean; externalShapeScale?: number; fireEffectScale?: number };
type NativeFireGroup = { started: boolean; attributes: Record<string, number> };
type Shot = { silentAudio?: boolean; cooldownResetAttack?: number; fireGroup?: NativeFireGroup; at: number; owner: 'player' | 'enemy'; origin: Point; anchor?: Point; localAnchor?: boolean; ownerUid: number; weaponId: number; angle: number; attack: number; bulletId?: number; bonus?: number; familyId?: number; aimTarget?: Point; realTimeAim?: boolean; aimOffset?: number; radial?: Point; mirror?: number; flags?: number; fireEvent?: boolean; weaponOverride?: RecordData; targetUid?: number; extraTraits?: number; nativeShapeType?: number; nativeDeflectionDegrees?: number; firePositionAngle?: number; alarmAim?: AlarmQueueAim; postAimAngle?: number; fixedFire?: boolean; allowDeadOwner?: boolean };
type DamageArea = Point & { radius: number; damage: number; element: number; hurtType: number; traits: number; familyId: number; expiresAt: number; hitInterval: number; nextHit: Map<number, number>; critChance: number; critMultiplier: number };
type EnemyBehavior = {
  attack: AttackLoopState; entry: Point; entryDuration: number; attackEntered?: boolean;
  patrol?: TwoPointMove; busyUntil: number; weaponId: number; moveTarget?: Point; bossGate?: BossAttackGate;
  attackStart?: number; enterAt?: number; holdAt?: number; fireHoldAt?: number; fireAt?: number; exitAt?: number;
  boss340001?: NativeBoss340001State; upDown?: NativeUpDownState;
  path?: NativeEnemyPath; pathOrigin: Point; loopZ: number; loopRestartZOffset: number;
  pathPhase?: 'path' | 'exit' | 'warning-start' | 'warning' | 'rush';
  pathSpeedAtStart?: number; pathExitSpeed?: number; pathWait?: number; rushDirection?: number; rushSpeed?: number;
  aimedAttack?: AimedAttackState; ceaseFire?: NativeCeaseFireState; summons?: NativeSummonState;
  bossProgram?: NativeBossProgram; bottomExitSpeed?: number; moveStopAt?: number;
  rebound?: NativeEnemyReboundState; reboundTaskReady?: boolean;
};

export class Simulation {
  private readonly statuses: EnemyStatusEffects;
  private readonly playerStatuses: EnemyStatusEffects;
  private readonly weaponStatuses: EnemyStatusEffects;
  private basePlayerAttributes: Record<string, number> = {};
  private effectivePlayerAttributes: Record<string, number> = {};
  private specialAttributeSources = new Map<string, { familyId: number; attributes: Record<string, number> }>();
  private specialTargetAttributes = new Map<number, Map<string, Record<string, number>>>();
  private hpThresholds = new Map<string, NativeHpThresholdState>();
  private colliderScales = new WeakMap<Projectile, NativeColliderScale>();
  private loadoutBulletMotion = new WeakMap<Projectile, { distance: number; x: number; z: number; angle: number; deviation: number }>();
  private specialWeaponDamage = new Map<number, number>();
  private specialWeaponChanges = new Map<number, NativeAnyWeaponBulletModification>();
  private hawkMissiles?: NativeHawkMissileRuntime;
  private specialLasers = new WeakMap<Projectile, { targetUid?: number }>();
  private symmetricLasers = new WeakMap<Projectile, { parameters: RecordData; pointShown: boolean; pointEffect?: Effect }>();
  private specialWeaponAttributes = new NativeSpecialWeaponAttributes();
  private specialMissileBoost = new NativeSpecialMissileBoostCounter();
  private sameTargetCombos = new NativeSameTargetComboRuntime();
  private nextFireBoost = new NativeNextFireBoostRuntime();
  private mainFireCounts = new Map<string, number>();
  private killBulletCounts = new Map<string, number>();
  private followerCeaseStarts = new Map<number, number>();
  private pendingWeaponCease = new Map<number, { at: number; weaponId: number; shots: Set<Shot> }>();
  private activeWeaponCease = new Set<number>();
  private readonly cooldownResetAttack = new NativeCooldownResetAttack();
  private secondWeaponOrder: number[] = [];
  private maxStarWeaponBuffs = new Map<string, { owner: number; buffId: number; skillId: number; triggerId: number }>();
  private loadoutCooldowns?: NativeLoadoutCooldownActions;
  private loadoutDrops = new Map<number, NativeLoadoutDropItem>();
  private loadoutDropCounts = new NativeLoadoutDropCounts();
  private circularSlashConfig?: { everySlashCount: number; rangeAddPercent: number; attributes: Readonly<Record<string, number>> };
  private unreal?: { sourceKey: string; args: RecordData; nextAt: number; until: number; intervalAdd: number; buffId: number };
  private heroMissiles?: NativeMissileRuntime;
  private dropMissiles?: NativeDropMissileRuntime;
  private readonly deathExplosionScales = new WeakMap<Projectile, number>();
  private loadoutSpecials?: NativeLoadoutSpecialActions;
  private planeSpecials?: NativePlaneSpecialActions;
  private buffReplacements = new Map<number, number>();
  private inUnreal = false;
  private healLimits = new Map<string, number>();
  private readonly monsterSkills = new MonsterSkillRuntime();
  private inheritedBulletScale = 0;
  private inheritedSkillRange = 0;
  private inheritedOrbitSpeed = 0;
  private damageAreas: DamageArea[] = [];
  phase: Phase = 'ready';
  time = 0;
  clock = 0;
  wave = 1;
  /** Last RefreshMonsters attribute source, including NPC/empty missions. */
  currentMissionId = 0;
  runId = 0;
  waveUIRequest?: WaveUIRequest;
  musicRequests: number[] = [];
  private waveFlow!: NativeWaveFlow;
  private creators!: MissionCreators;
  private mapOutWalls?: NativeMapOutWalls;
  private scrollCamera?: NativeScrollCamera;
  private completedWaveUI?: number;
  private nativeEnemyCount = 0;
  private nativeKillCount = 0;
  private readonly killMilestoneBuffs = new NativeKillMilestoneBuffs();
  private queuedNpc: { event: RecordData; at: number }[] = [];
  level = 1;
  exp = 0;
  kills = 0;
  gold = 0;
  private protectHpRate = 1;
  damageDealt = 0;
  damageByWeapon = new Map<number, number>();
  bestCombo = 0;
  player = { x: 0, z: -10, oldX: 0, oldZ: -10, hp: 600, maxHp: 600, attack: 100, invincible: 0, fireAt: 0, hitFlash: 0 };
  playerMotion = { x: 0, z: 0, rawX: 0 };
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  pickups: Pickup[] = [];
  effects: Effect[] = [];
  tutorialFirstChoicePending = false;
  tutorialFirstChoiceActive = false;
  tutorialChoiceCompleted = false;
  choices: Choice[] = [];
  learned: Choice[] = [];
  treasures: { uid: number; modelId: number; x: number; z: number; scale: number; radius: number; progress: number; animation: 'Born' | 'Idle' | 'Enter' | 'Death'; animationAge: number }[] = [];
  private claimedTreasure?: number;
  treasureRewards: Choice[] = [];
  cannon: WeaponState = newWeapon(10000101, 200151);
  /** The cannon remains the existing controller; choosing another starting
   * family must not secretly keep its weapon or its selection slot. */
  private cannonOwned = true;
  get mainWeaponEquipped() { return this.cannonOwned; }
  /** Presentation observes the real native state; it never owns the timer. */
  get playerPhantomActive() {
    return this.inUnreal && this.player.hp > 0 && ['playing', 'paused', 'upgrade', 'treasure'].includes(this.phase);
  }
  /** Player attributes are contributions, unlike weapon snapshots with defaults. */
  get playerScale() {
    const definition = this.content.combat.attributeDefinitions['ScalePercent%'];
    return nativeAttributeValue(definition, definition.defaultValue) + (this.playerCombatAttributes()['ScalePercent%'] || 0);
  }
  get playerMovementSpeed() {
    if (this.playerStatuses.modifiers(0).immobile) return 0;
    const attrs = this.playerCombatAttributes();
    return Math.max(0, (this.content.chapter.entities[this.content.chapter.player.entityId].stats.speed + (attrs.MoveSpeed || 0)) * (1 + (attrs['MoveSpeed%'] || 0)));
  }
  get activeBuffVisuals() {
    return [...this.playerStatuses.visuals().map(item => ({ ...item, x: this.player.x, z: this.player.z })),
      ...this.weaponStatuses.visuals().map(item => ({ ...item, x: this.player.x, z: this.player.z })),
      ...this.statuses.visuals().flatMap(item => { const target = this.enemies.find(e => e.uid === item.targetUid && !e.dead); return target ? [{ ...item, x: target.x, z: target.z }] : []; })];
  }
  secondary = new Map<number, WeaponState>();
  globalCrit = 0;
  globalCritDamage = 0;
  globalCooldown = 1;
  globalAttackBonus = 0;
  sounds: number[] = [];
  notice = '';
  noticeUntil = 0;
  private serial = 1;
  private shots: Shot[] = [];
  private enemyBehaviors = new Map<number, EnemyBehavior>();
  private backDeaths = new Map<number, { runtime: NativeBackDeath; effectId: number }>();
  private projectileMotions = new WeakMap<Projectile, NativeProjectileMotion>();
  private rotatingLasers = new WeakMap<Projectile, NativeRotatingLaserState>();
  private randomLasers = new WeakMap<Projectile, NativeRandomLaserState>();
  private plainLasers = new WeakMap<Projectile, NativePlainLaserRay>();
  private randomLaserWarnings = new WeakMap<Projectile, Effect[]>();
  private sectors = new WeakMap<Projectile, NativeSectorSpreadRuntime>();
  private arcChains = new WeakMap<Projectile, NativeArcChain>();
  private ejections = new WeakMap<Projectile, NativeEjectRuntime>();
  private arcLinks = new WeakMap<Projectile, { fromTarget?: number; toTarget?: number; first: boolean; final: boolean; carrierUid: number }>();
  private weaponSnapshots = new Map<number, NativeWeaponSkillSnapshot>();
  private weaponPrograms = new Map<number, NativeWeaponSkillRuntime>();
  private readonly playerSkillProgram = new NativeWeaponSkillRuntime();
  private playerEventCounts = { hit: 0, fire: 0, crit: 0, kill: 0 };
  private heroWeapon = newWeapon(0);
  private periodicSpecials = new Map<string, { familyId: number; command: NativeWeaponActionCommand; nextAt: number }>();
  private installedWeaponActions = new Map<number, NativeWeaponActionCommand[]>();
  private weaponEventCounts = new Map<number, { hit: number; fire: number; crit: number; kill: number }>();
  private orbit?: NativeOrbitWeaponRuntime;
  private orbitSpeedAttributes = new NativeOrbitSpeedAttributes();
  private laserCannonStates = new Map<number, 0 | 1>();
  private laserFireBuffs = new Map<number, Map<string, { buffIds: number[]; applied: boolean; skillId?: number; triggerId?: number }>>();
  private enemyOrbits = new ChapterEnemyOrbits({
    create: (owner, weaponId, position, flags) => this.emitProjectile({
      at: this.clock, owner: 'enemy', origin: position, ownerUid: owner.uid,
      weaponId, angle: 0, attack: owner.attack, flags, fixedFire: true,
    }),
    bullet: uid => this.projectiles.find(bullet => bullet.uid === uid),
  });
  private missiles?: NativeMissileRuntime;
  private swords?: NativeCurveSwordRuntime;
  private voidSlashes?: NativeVoidSlashRuntime;
  private rayChasers?: NativeRayChaserRuntime;
  private rayPaths = new Map<number, number[]>();
  private reflectionRays?: NativeReflectionRayRuntime;
  private forcedProjectileTargets = new Map<number, number>();
  private weaponHitHistory = new Map<string, number[]>();
  private exactWeaponHitHistory = new Map<string, number[]>();
  private firstBulletTargets = new WeakMap<Projectile, number>();
  private prisms = new Map<Projectile, NativePrismRuntime>();
  private prismSides = new WeakMap<Projectile, { parent: Projectile; offset: Point }>();
  private dynamicBulletAttributes = new WeakMap<Projectile, Record<string, number>>();
  private flashSplashes = new WeakMap<Projectile, NativeFlashSplashRuntime[]>();
  private targetWeaponCooldowns = new NativeTargetWeaponCooldowns();
  private appliedInstalledActions = new Set<string>();
  private timedWeaponActions: { at: number; run: () => void }[] = [];
  private extraWeaponMods = new Map<number, { weaponIds: number[]; mods: { name: string; args: RecordData }[]; once: boolean }[]>();
  private pendingBulletAttributes = new NativePendingBulletAttributes();
  private actualEjectCounts = new WeakMap<Projectile, number>();
  private bulletAttributes = new WeakMap<Projectile, Record<string, number>>();
  private bulletSpeedFactors = new WeakMap<Projectile, number>();
  private incrementalBulletScales = new WeakMap<Projectile, { attribute: number; factor: number }>();
  private bulletBase = new WeakMap<Projectile, { damage: number; scale: number; radiusX: number; radiusZ: number; radiusOverride?: number; speed: number; attributes: Record<string, number> }>();
  private blackHolePulls = new Map<number, { source: Projectile; runtime: NativeBlackHolePullRuntime }>();
  private blackHoleContacts = new Map<number, Set<number>>();
  private blackHoleBulletAttrs = new NativeBlackHoleOverlapAttributes();
  private actionTimes = new Map<string, number>();
  private blackHoleBoundaries = new WeakMap<Projectile, NativeBlackHoleBoundaryRuntime>();
  private disabledBlackHoles = new Set<number>();
  private falling = new WeakMap<Projectile, { height: number; speed: number; elapsed: number; landed: boolean }>();
  private explosions = new WeakMap<Projectile, NativeExplosionRuntime[]>();
  private explosionSequences: { familyId: number; sequence: NativeConsecutiveExplosion }[] = [];
  private behindFissions = new WeakMap<Projectile, NativeHitBehindFissionRuntime>();
  private bulletDeathPoints = new WeakMap<Projectile, Point>();
  private returningProjectiles = new WeakMap<Projectile, NativeReturningProjectileRuntime>();
  private thunders = new WeakMap<Projectile, NativeThunderRuntime>();
  private skillSlashAudioAt = -Infinity;
  private skillSoundGroups = new WeakMap<object,Set<number>>();
  private enemyChargeEffects = new WeakMap<Effect,number>();
  private releasedMissileAudio = new WeakSet<Projectile>();
  private enemySoundGroups = new WeakSet<object>();
  private killBullets = new WeakMap<Projectile, { runtime: NativeKillBulletRuntime; hitCampMask: number }>();
  private lastPlayerAttacker?: Point;
  private dynamicRotations = new Map<number, DynamicRotateState>();
  private readonly bossFollowSlots = new NativeFollowSlots();
  private seed = 0x1badf00d;
  private pendingLevels = 0;
  private playerBulletHurtCount = 0;
  rerollsRemaining = 0;
  rerollsTotal = 0;
  private breakthroughChoice = false;
  private ordinarySelections = 0;
  private resultDelay = 0;
  private victoryDeparture?: { fromZ: number; targetZ: number; elapsed: number };
  private deathDelay = 0;
  private deferredWaveClear = false;
  private equipmentRevivesUsed = 0;
  private pendingEquipmentRevive: NativeWeaponActionCommand[] = [];
  rewardedReviveEnabled = false;
  revivesUsed = 0;
  adRevivesUsed = 0;
  reviveCountdown = 0;
  reviveAdPending = false;
  private manualReviveLimit = 0;
  private reviveResumeDelay = 0;
  private hpDropCompensationRaw = 0;
  private readonly waveExperience = new NativeWaveExperience();
  private readonly waveGold = new NativeWaveGold();
  private experienceWave = 0;
  constructor(public content: GameContent) {
    registerLoadoutAttributeConsumers(['ChooseSkillOnFirst', 'RefreshCount', 'FiveSkillRate%']);
    for (const action of [141, 237]) loadoutRuntimeActions.add(action);
    registerLoadoutAttributeConsumers([...nativeLoadoutDamageAttributeNames, ...nativeLoadoutSurvivalAttributeNames, 'MoveSpeed', 'MoveSpeed%', 'WaveFinishRecoverHP%', 'AddHpTriggerRate%', 'CurveSwordKillBullet2AddHp%', 'ScorchingRayPathHurtRate%', 'AttackSpeed%', 'PickDistanceHp%', 'BulletTraitAreaScale%', 'DiamondResurrection', 'LevelUpRecoverHP', 'LevelUpRecoverHP%', 'BattleGold%', 'TimeShieldExtraDuration']);
    for (const action of [1, 20, 95, 96, 102, 124, 211, 243, 133, 139, 154, 155, 156, 158, 160, 162, 163, 164, 166, 186, 187, 188, 191, 196, 203, 208, 214, 215, 216, 217, 218, 219, 220, 221, 222, 238, 240, 241, 244, 250, 251, 252]) loadoutRuntimeActions.add(action);
    registerLoadoutDependencyHandlers({ mods: ['ScaleOnlyColliderMod', 'IgnoreNoReboundDieMod', 'LaserLockMod', 'PersistentMod', 'CriticalThroughMod', 'LaserPrismMod', 'LaserPrismMainLaserReactionMod'], trajectories: ['SpecialLaserStick', 'LaserSymmetricByOwner'] });
    const buffs = { ...nativeMonsterBuffs, ...content.combat.buffs, [nativeBattleRules.invincibleBuff.ID]: nativeBattleRules.invincibleBuff };
    const bulletSync: StatusBulletSyncHost = {
      bullets: () => this.projectiles.map(b => ({ uid: b.uid, weaponId: b.weaponId, alive: !b.dead,
        ownerKey: b.owner === 'enemy' ? b.ownerUid : b.familyId === this.content.chapter.player.entityId ? 0 : b.familyId || this.content.chapter.player.weaponEntityId })),
      normalizeAttribute: (name, value) => nativeAttributeValue(content.combat.attributeDefinitions[name], value),
      mergeAttributes: (uid, attributes, reverse) => {
        const bullet = this.projectiles.find(b => b.uid === uid && !b.dead); if (!bullet) return;
        const delta: Record<string, number> = {};
        for (const { name, value } of attributes) {
          const definition = content.combat.attributeDefinitions[name];
          if (definition.mergeType !== 0) throw new Error(`BuffSync2Bullets unverified reverse merge ${name}`);
          delta[name] = (delta[name] || 0) + (reverse ? -value : value);
        }
        this.applyBulletAttributes(bullet, delta);
      },
    };
    this.statuses = new EnemyStatusEffects(buffs, bulletSync); this.playerStatuses = new EnemyStatusEffects(buffs, bulletSync); this.weaponStatuses = new EnemyStatusEffects(buffs, bulletSync); this.reset();
  }
  random() {
    let n = this.seed; n ^= n << 13; n ^= n >>> 17; n ^= n << 5;
    this.seed = n >>> 0; return this.seed / 4294967296;
  }
  reset() {
    this.protectHpRate = 1;
    this.skillSlashAudioAt = -Infinity;
    this.phase = 'ready'; this.time = this.clock = this.exp = this.kills = this.gold = this.damageDealt = 0;
    this.wave = this.level = 1; this.serial = 1; this.shots = []; this.pendingLevels = 0; this.seed = 0x1badf00d;
    this.playerBulletHurtCount = 0;
    this.rerollsRemaining = this.rerollsTotal = 0; this.breakthroughChoice = false;
    this.currentMissionId = 0; this.runId++; this.waveUIRequest = undefined; this.completedWaveUI = undefined;
    this.nativeEnemyCount = this.nativeKillCount = 0; this.queuedNpc = []; this.musicRequests = [];
    this.waveFlow = new NativeWaveFlow(this.content.chapter.waves, { chestType: Number(this.content.chapter.chapter.parameters.ChestType) });
    this.creators = new MissionCreators(this.content);
    const chapter = this.content.chapter.chapter;
    this.scrollCamera = Number(chapter.parameters.chapterType) === 8 && Number(chapter.parameters.cameraId) === 3
      ? new NativeScrollCamera(this.initialCameraBounds()) : undefined;
    this.mapOutWalls = nativeChapter9WallQuerySupported(Number(chapter.id), Number(chapter.parameters.chapterType), String(chapter.parameters.dataPath))
      ? new NativeMapOutWalls(this.cameraBounds()) : undefined;
    this.resultDelay = 0; this.victoryDeparture = undefined; this.deathDelay = 0; this.experienceWave = 0; this.deferredWaveClear = false;
    this.revivesUsed = this.adRevivesUsed = this.reviveCountdown = this.reviveResumeDelay = 0;
    this.equipmentRevivesUsed = 0; this.pendingEquipmentRevive = [];
    this.reviveAdPending = false; this.manualReviveLimit = 0;
    this.waveExperience.reset(0, false, []);
    this.waveGold.reset(0, [], this.content.assets.monsterDrops, false, () => this.random());
    this.damageByWeapon.clear();
    this.hpDropCompensationRaw = 0;
    this.ordinarySelections = 0;
    this.treasures = []; this.treasureRewards = []; this.claimedTreasure = undefined;
    this.enemyBehaviors.clear();
    this.backDeaths.clear();
    this.dynamicRotations.clear();
    this.bossFollowSlots.clear();
    this.statuses.clear();
    this.playerStatuses.clear(); this.weaponStatuses.clear(); this.monsterSkills.clear();
    this.killMilestoneBuffs.clear();
    // BuffBase.End emits event68 before DeInit removes its attributes. Explicit
    // RemoveBuff/Undo and battle reset only deinitialize and do not emit it.
    this.playerStatuses.onEnd = (_uid, buffId) => this.dispatchPlayerEvent(68, { buffId, point: this.player });
    this.weaponStatuses.onEnd = (uid, buffId) => this.dispatchWeaponEvent(68, uid, { buffId, point: this.player, skipPlayer: true });
    this.playerStatuses.onAdd = (_uid, buffId, source) => {
      if (this.content.combat.buffs[buffId]?.AddSound === 270012) this.sounds.push(270012);
      const event = { buffId, sourceUid: source.familyId, targetUid: 0, buffTarget: 'player', point: this.player };
      this.dispatchPlayerEvent(54, event);
      for (const owner of this.weaponPrograms.keys()) this.dispatchWeaponEvent(54, owner, { ...event, skipPlayer: true });
    };
    this.weaponStatuses.onAdd = (uid, buffId, source) => {
      if (this.content.combat.buffs[buffId]?.AddSound === 270012) this.sounds.push(270012);
      this.dispatchWeaponEvent(54, uid, { buffId, sourceUid: source.familyId, targetUid: uid, buffTarget: 'weapon', point: this.player, skipPlayer: true });
    };
    this.statuses.onAdd = (_uid, buffId) => {
      if (this.content.combat.buffs[buffId]?.AddSound === 270012) this.sounds.push(270012);
    };
    this.inheritedBulletScale = this.inheritedSkillRange = this.inheritedOrbitSpeed = 0;
    this.damageAreas = [];
    this.projectileMotions = new WeakMap();
    this.rotatingLasers = new WeakMap(); this.randomLasers = new WeakMap(); this.plainLasers = new WeakMap();
    this.randomLaserWarnings = new WeakMap();
    this.sectors = new WeakMap(); this.arcChains = new WeakMap(); this.arcLinks = new WeakMap();
    this.ejections = new WeakMap();
    this.enemyOrbits.clear();
    this.weaponSnapshots.clear(); this.orbit = undefined; this.weaponPrograms.clear(); this.installedWeaponActions.clear(); this.weaponEventCounts.clear();
    this.orbitSpeedAttributes.clear(); this.laserCannonStates.clear(); this.laserFireBuffs.clear();
    this.playerSkillProgram.reset();
    this.playerEventCounts = { hit: 0, fire: 0, crit: 0, kill: 0 };
    this.heroWeapon = newWeapon(0); this.periodicSpecials.clear();
    this.specialAttributeSources.clear(); this.specialTargetAttributes.clear(); this.hpThresholds.clear();
    this.colliderScales = new WeakMap(); this.loadoutBulletMotion = new WeakMap(); this.specialWeaponDamage.clear(); this.specialWeaponChanges.clear();
    this.hawkMissiles?.clear(); this.hawkMissiles = undefined;
    this.specialLasers = new WeakMap();
    this.symmetricLasers = new WeakMap();
    this.specialWeaponAttributes.clear(); this.specialMissileBoost.clear();
    this.sameTargetCombos.clear(); this.nextFireBoost.clear(); this.mainFireCounts.clear(); this.killBulletCounts.clear(); this.loadoutCooldowns = undefined; this.followerCeaseStarts.clear(); this.pendingWeaponCease.clear(); this.activeWeaponCease.clear(); this.cooldownResetAttack.clear(); this.secondWeaponOrder = []; this.maxStarWeaponBuffs.clear(); this.loadoutDrops.clear(); this.loadoutDropCounts.clear();
    this.circularSlashConfig = undefined;
    this.unreal = undefined; this.heroMissiles = undefined; this.dropMissiles = undefined; this.loadoutSpecials?.clear(); this.loadoutSpecials = undefined;
    this.planeSpecials?.clear(); this.planeSpecials = undefined; this.buffReplacements.clear(); this.inUnreal = false; this.healLimits.clear();
    this.missiles = undefined; this.timedWeaponActions = []; this.extraWeaponMods.clear(); this.pendingBulletAttributes.clear(); this.actualEjectCounts = new WeakMap(); this.bulletAttributes = new WeakMap(); this.bulletBase = new WeakMap();
    this.bulletSpeedFactors = new WeakMap();
    this.incrementalBulletScales = new WeakMap();
    this.swords = undefined; this.weaponHitHistory.clear();
    this.exactWeaponHitHistory.clear();
    this.voidSlashes = undefined; this.rayChasers = undefined; this.reflectionRays = undefined; this.rayPaths.clear(); this.forcedProjectileTargets.clear();
    for (const prism of this.prisms.values()) prism.dispose();
    this.prisms.clear(); this.prismSides = new WeakMap();
    this.firstBulletTargets = new WeakMap(); this.dynamicBulletAttributes = new WeakMap();
    this.flashSplashes = new WeakMap(); this.targetWeaponCooldowns.clear(); this.appliedInstalledActions.clear();
    this.blackHolePulls.clear(); this.blackHoleContacts.clear(); this.blackHoleBulletAttrs.clear(); this.actionTimes.clear();
    this.blackHoleBoundaries = new WeakMap(); this.disabledBlackHoles.clear();
    this.falling = new WeakMap();
    this.explosions = new WeakMap(); this.explosionSequences = [];
    this.behindFissions = new WeakMap(); this.bulletDeathPoints = new WeakMap();
    this.returningProjectiles = new WeakMap(); this.lastPlayerAttacker = undefined;
    this.thunders = new WeakMap(); this.killBullets = new WeakMap();
    this.playerMotion = { x: 0, z: 0, rawX: 0 };
    this.globalCrit = this.globalCritDamage = this.globalAttackBonus = 0; this.globalCooldown = 1;
    this.enemies = []; this.projectiles = []; this.pickups = []; this.effects = []; this.choices = []; this.learned = []; this.secondary.clear();
    const p = this.content.chapter.player;
    this.player = { x: 0, z: -this.content.world.height * 0.3, oldX: 0, oldZ: -this.content.world.height * 0.3, hp: p.hp, maxHp: p.hp, attack: p.attack, invincible: 0, fireAt: 0, hitFlash: 0 };
    this.cannon = newWeapon(p.weaponSkillId, p.bulletId);
    const study = this.content.combat.studyLoadout;
    const initialRoots: number[] = study
      ? [...new Set<number>((study.battleSkillIds || []).map(Number))].filter(id => Boolean(this.content.combat.families[id]))
      : [Number(p.weaponSkillId)];
    this.cannonOwned = initialRoots.some(id => this.content.combat.families[id]?.entityId === p.weaponEntityId);
    this.secondWeaponOrder = initialRoots.filter(id => runtimeWeaponFamilyEnabled(id)).map(id => Number(this.content.combat.families[id].entityId));
    for (const id of initialRoots) {
      const family = this.content.combat.families[id];
      if (!family || family.entityId === p.weaponEntityId || !runtimeWeaponFamilyEnabled(id)) continue;
      this.secondary.set(Number(family.entityId), newWeapon(id));
    }
    this.sounds = []; this.notice = ''; this.noticeUntil = 0;
    this.refreshNativeWeaponSkills();
    for (const id of this.skillHistory()) this.dispatchNativeSkillLearned(id);
  }
  start(onboarding: {firstChoice?: boolean} = {}, defeatCount = 0) {
    const protectHpRate = nativeProtectHpRateRaw(Number(this.content.chapter.chapter.id), defeatCount) / 65536;
    this.reset();
    this.protectHpRate = protectHpRate;
    this.tutorialFirstChoicePending=onboarding.firstChoice===true;
    this.tutorialFirstChoiceActive=false;this.tutorialChoiceCompleted=false;
    const chapter = (nativeBattleRules.chapters as Record<string, { manualRevives: number }>)[this.content.chapter.chapter.id];
    // InitReliveCount@697ff1c: chapter allowance + DiamondResurrection; ad quota is independent.
    this.manualReviveLimit = chapter ? chapter.manualRevives + Math.trunc(this.playerCombatAttributes().DiamondResurrection || 0) : 0;
    this.phase = 'playing'; this.announce(`第 1 / ${this.content.chapter.chapter.waveCount} 波`, 2.2);
    // BaseInitState.ShowSkillSelect: consumes opening choices before play,
    // without awarding experience or increasing the hero level.
    const researchAttrs = this.playerCombatAttributes();
    this.rerollsRemaining = this.rerollsTotal = Math.max(0, Math.trunc(researchAttrs.RefreshCount || 0));
    this.pendingLevels = Math.max(0, Math.trunc(researchAttrs.ChooseSkillOnFirst || 0));
    if (this.pendingLevels) this.openUpgrade();
  }
  get canAdRevive() {
    return this.rewardedReviveEnabled && this.revivesUsed < this.manualReviveLimit && this.adRevivesUsed < nativeBattleRules.adRevives;
  }
  advanceRevivePrompt(seconds: number) {
    if (this.phase !== 'revive' || this.reviveAdPending) return;
    this.reviveCountdown = Math.max(0, this.reviveCountdown - Math.max(0, seconds));
    if (!this.reviveCountdown) this.declineRevive();
  }
  beginReviveAd() {
    if (this.phase !== 'revive' || this.reviveAdPending || !this.canAdRevive) return false;
    this.reviveAdPending = true; return true;
  }
  completeReviveAd(completed: boolean) {
    if (this.phase !== 'revive' || !this.reviveAdPending) return false;
    this.reviveAdPending = false;
    if (!completed || !this.canAdRevive) return false;
    // PlayerReliveByAd -> AddAdReliveCount -> PlayerRelive(3) -> ReBorn(3).
    this.adRevivesUsed++; this.revivesUsed++; this.reviveCountdown = 0;
    this.sounds.push(270001);
    this.healPlayer(this.player.maxHp * nativeBattleRules.recoverFraction, 11);
    const buff = nativeBattleRules.invincibleBuff;
    this.playerStatuses.hit(0, [{ buffId: buff.ID, probability: 1 }],
      { attack: this.player.attack, familyId: this.content.chapter.player.entityId, weaponId: 0, timeShieldExtraDuration: this.playerCombatAttributes().TimeShieldExtraDuration || 0 }, () => this.random());
    if (buff.AddSound) this.sounds.push(buff.AddSound);
    this.refreshBuffAttributes();
    this.dispatchPlayerEvent(11, { rebornType: 3, point: this.player });
    this.player.oldX = this.player.x; this.player.oldZ = this.player.z;
    this.playerMotion = { x: 0, z: 0, rawX: 0 };
    this.deathDelay = 0; this.reviveResumeDelay = nativeBattleRules.resumeDelayRaw / 65536;
    this.phase = 'playing';
    return true;
  }
  declineRevive() {
    if (this.phase !== 'revive' || this.reviveAdPending) return;
    this.reviveCountdown = 0; this.phase = 'lost';
  }
  pause() { if (this.phase === 'playing') this.phase = 'paused'; }
  resume() { if (this.phase === 'paused') this.phase = 'playing'; }
  announce(text: string, seconds = 2) { this.notice = text; this.noticeUntil = this.clock + seconds; }
  threshold(level = this.level) { return this.content.chapter.experience.thresholds[level - 1]?.waveExp ?? Infinity; }
  get expProgress() { const before = this.level > 1 ? this.threshold(this.level - 1) : 0; return clamp((this.exp - before) / (this.threshold() - before), 0, 1); }
  get boss() { return this.enemies.find(e => e.boss && !e.dead); }
  step(dt: number, movement: Point & { dirX?: number; dirZ?: number; rawX?: number }) {
    if (this.phase !== 'playing') return;
    // Victory is committed before the presentation/loot drain. No further
    // movement, spawns, attacks or collision may turn it into a defeat.
    if (this.resultDelay > 0) { this.advanceVictory(dt); return; }
    if (this.reviveResumeDelay > 0) {
      this.reviveResumeDelay = Math.max(0, this.reviveResumeDelay - dt);
      this.advancePresentation(dt); return;
    }
    if (this.deathDelay > 0) {
      this.advancePresentation(dt);
      this.deathDelay = Math.max(0, this.deathDelay - dt);
      if (!this.deathDelay) {
        if (this.pendingEquipmentRevive.length) { this.completeEquipmentRevive(); return; }
        this.phase = this.canAdRevive ? 'revive' : 'lost';
        this.reviveCountdown = this.phase === 'revive' ? nativeBattleRules.promptSeconds : 0;
      }
      return;
    }
    // Enemy death presentation can complete while the hero is dead. Its clear
    // callback was gated then; replay that check once after either revive path,
    // without replaying the enemy death, drops or special-wave counters.
    if (this.deferredWaveClear) {
      this.deferredWaveClear = false;
      this.checkWaveClear();
      if (this.resultDelay > 0) { this.advanceVictory(dt); return; }
    }
    this.clock += dt;
    this.loadoutSpecials?.step(dt, this.clock);
    this.planeSpecials?.step(this.clock);
    this.hawkMissiles?.update(dt, this.clock);
    for (const item of this.periodicSpecials.values()) if (this.clock >= item.nextAt) {
      const args = item.command.args;
      const target = args.IgnoreTarget ? undefined : this.enemies.filter(e => this.enemyChooseable(e)).sort((a, b) => Math.hypot(a.x - this.player.x, a.z - this.player.z) - Math.hypot(b.x - this.player.x, b.z - this.player.z))[0];
      if (!args.IgnoreTarget && !target) continue;
      const interval = Number(args.FireInterval) + (this.specialWeaponChanges.get(Number(args.WeaponId))?.DeltaFireInterval || 0);
      item.nextAt = this.clock + interval;
      // FireBulletToTarget supplies Forward rotation, plus a separate target
      // point. It does not rotate a plain salvo to face that point. Keep the
      // original weapon's EntityBodyPosType queues and mount offsets.
      const first = this.shots.length;
      this.queueWeapon(Number(args.WeaponId), 'player', this.player, 0, this.player.attack, 0, undefined, 0, item.familyId || this.content.chapter.player.entityId);
      for (const shot of this.shots.slice(first)) { shot.flags = 0x88; shot.targetUid = target?.uid; }
    }
    this.explosionSequences = this.explosionSequences.filter(item => item.sequence.update(this.explosionSequenceHost(item.familyId)));
    for (let i = 0; i < this.timedWeaponActions.length;) {
      const task = this.timedWeaponActions[i];
      if (task.at > this.clock) { i++; continue; }
      this.timedWeaponActions.splice(i, 1); task.run();
    }
    const p = this.player;
    this.playerMotion = { x: movement.dirX ?? movement.x, z: movement.dirZ ?? movement.z, rawX: movement.rawX ?? movement.x };
    p.oldX = p.x; p.oldZ = p.z;
    // SetTargetPosition clamps the INPUT target. A moving camera must not
    // re-clamp an already accepted, unchanged drag target every logic tick.
    p.x += movement.x; p.z += movement.z;
    if (p.x !== p.oldX || p.z !== p.oldZ) this.scrollCamera?.setTargetPosition(p);
    p.invincible = Math.max(0, p.invincible - dt); p.hitFlash = Math.max(0, p.hitFlash - dt);
    this.applyStatusPulses(this.statuses.advance(dt, uid => this.enemies.some(enemy => enemy.uid === uid && !enemy.dead), () => this.random()));
    // Type-5 buff first ticks on the next frame, before this frame's new entries.
    for (const pulse of this.playerStatuses.advance(dt, () => p.hp > 0, () => this.random())) this.damagePlayer(pulse.damage, false);
    this.weaponStatuses.advance(dt, uid => Boolean(this.playerWeaponState(uid)), () => this.random());
    for (const command of this.playerSkillProgram.dispatch({ type: 2, passiveOwner: true, ownerPoint: { x: p.x, z: p.z } }, this.clock, () => this.random())) this.applyNativeWeaponAction(0, command);
    this.updateLoadoutHpThresholds();
    this.refreshBuffAttributes();
    for (const request of this.statuses.drainWeaponFires()) {
      const enemy = this.enemies.find(e => e.uid === request.targetUid);
      if (enemy) this.emitPlayerWeapon(request.createdWeaponId, request.familyId, enemy, enemy.angle, enemy.uid, 0x88);
    }
    if (p.hp <= 0) { this.beginPlayerDeath(); return; }
    for (const familyId of this.weaponPrograms.keys()) this.dispatchWeaponEvent(2, familyId, { skipPlayer: true });
    const actors = [{ uid: 0, x: p.x, z: p.z, attack: p.attack, dead: p.hp <= 0, side: 'player' as const },
      ...this.enemies.map(e => ({ ...e, side: 'enemy' as const }))];
    for (const event of this.monsterSkills.advance(this.clock, actors)) {
      const statuses = event.targetUid === 0 ? this.playerStatuses : this.statuses;
      if (event.kind === 'exit') statuses.remove(event.targetUid, event.buffId);
      else statuses.hit(event.targetUid, [{ buffId: event.buffId, probability: 1 }], event.source, () => this.random());
    }
    this.time += dt;
    this.dispatchPendingWeaponCease();
    if (this.cannonOwned && p.fireAt <= this.clock && !this.pendingWeaponCease.has(this.content.chapter.player.weaponEntityId) && !this.resultDelay) {
      const firstShot = this.shots.length;
      const hold = this.fireCannon();
      const entity = this.content.chapter.entities[this.content.chapter.player.weaponEntityId];
      this.followerCeaseStarts.set(this.content.chapter.player.weaponEntityId, this.clock + hold);
      p.fireAt = this.clock + originalFollowerCycle(hold, this.loadoutFireCooldown(0, entity.stats.fireInterval));
      this.scheduleWeaponCease(this.content.chapter.player.weaponEntityId, this.clock + hold, this.content.chapter.player.weaponId, firstShot);
    }
    for (const [id, weapon] of this.secondary) {
      if (id === 200141) continue;
      if (weapon.at > this.clock || this.pendingWeaponCease.has(id) || this.resultDelay) continue;
      const entity = this.content.chapter.entities[id];
      if (!entity) continue;
      if (weapon.waitingForBeams) {
        if (this.shots.some(shot => shot.familyId === id) || this.projectiles.some(bullet => bullet.familyId === id && bullet.beam && !bullet.dead)) continue;
        weapon.waitingForBeams = false;
        this.setLaserCannonState(id, 1);
        this.followerCeaseStarts.set(id, this.clock);
        // Establish the timer BEFORE event44: action197 may complete it.
        weapon.at = this.clock + this.loadoutFireCooldown(id, entity.stats.fireInterval);
        this.scheduleWeaponCease(id, this.clock, (weapon.nativeWeaponIds || entity.weaponIds).at(-1)!);
        continue;
      }
      const targetDistance = (enemy: Enemy) => Math.hypot(enemy.x - p.x, enemy.z - p.z)
        - nativeShapeRadii(this.content.chapter.entities[enemy.entityId].stats.shape).radius2 - nativeShapeRadii(entity.stats.shape).radius2;
      const target = this.enemies.filter(enemy => this.enemyChooseable(enemy) && targetDistance(enemy) <= (weapon.nativeAttributes?.AttackDistance ?? entity.stats.attackDistance ?? entity.raw.AttackDistance))
        .sort((a, b) => targetDistance(a) - targetDistance(b))[0];
      const fireType = Number(entity.ai.parameters?.FireType ?? 0);
      const aimBlackHole = (this.installedWeaponActions.get(id) || []).some(command => command.action === 125);
      if (!originalFollowerCanFire(aimBlackHole ? 1 : fireType, Boolean(target))) continue;
      const angle = (fireType === 1 || aimBlackHole) && target ? Math.atan2(target.x - p.x, target.z - p.z) : 0;
      if (id === 200101) {
        this.followerCeaseStarts.set(id, this.clock);
        this.swords?.storeAiSword();
        const attr = this.conditionalAttributes(this.weaponAttributes(id), id);
        weapon.at = this.clock + Number(attr.FireCD ?? entity.stats.fireInterval) * (attr['FireCDReduce%'] ?? 1) * (attr['AllCurveSwordCDTime%'] ?? 1) * (attr['CurveSwordCDTime%'] ?? 1) * this.globalCooldown / ((1 + (attr['AttackSpeed%'] || 0)) || 1);
        continue;
      }
      if (id === 200041) {
        this.followerCeaseStarts.set(id, this.clock);
        const attr = this.conditionalAttributes(this.weaponAttributes(id), id);
        this.missiles?.setClock(this.clock);
        for (const weaponId of weapon.nativeWeaponIds || entity.weaponIds) this.missiles?.createRound({ missileCount: attr.MissileCount || 0, maxMissileCount: attr.MaxMissileCount || 0,
          allMissileCount: attr.AllMissileCount, allMissileCountTimes: attr.AllMissileCountTimes, allMissileConsecutiveCount: attr.AllMissileConsecutiveCount }, weaponId, made => this.specialMissileBoost.successfulRound(made));
        weapon.at = this.clock + (attr.FireCD ?? entity.stats.fireInterval) * (attr['FireCDReduce%'] ?? 1) * (attr['AllMissileFireCDReduce%'] ?? 1) * this.globalCooldown / ((1 + (attr['AttackSpeed%'] || 0)) || 1);
        continue;
      }
      this.activeWeaponCease.delete(id);
      this.setLaserCannonState(id, 0);
      const firstShot = this.shots.length;
      let hold = 0;
      for (const weaponId of weapon.nativeWeaponIds || entity.weaponIds) hold = Math.max(hold, this.queueWeapon(weaponId, 'player', p, 0, p.attack, angle, weapon.bulletId || undefined, weapon.damageBonus, id));
      for (const shot of this.shots.slice(firstShot)) shot.flags = (shot.flags || 0) | 0x2000;
      weapon.waitingForBeams = (weapon.nativeWeaponIds || entity.weaponIds).some((weaponId: number) => originalIsLaserTrajectory(this.content.chapter.weapons[weaponId].trajectory));
      this.followerCeaseStarts.set(id, this.clock + hold);
      weapon.at = this.clock + (weapon.waitingForBeams ? hold : originalFollowerCycle(hold, this.loadoutFireCooldown(id, entity.stats.fireInterval)));
      if (!weapon.waitingForBeams) this.scheduleWeaponCease(id, this.clock + hold, (weapon.nativeWeaponIds || entity.weaponIds).at(-1)!, firstShot);
    }
    this.orbit?.step(dt, this.orbitSettings());
    this.missiles?.update(dt, this.clock);
    this.heroMissiles?.update(dt, this.clock);
    this.dropMissiles?.update(dt, this.clock);
    this.swords?.step(dt, this.clock);
    this.voidSlashes?.step(dt);
    for (const enemy of this.enemies) this.moveEnemy(enemy, dt);
    // Stable chronological order matters for staggered salvos and simultaneous hits.
    this.shots.sort((a, b) => a.at - b.at);
    while (this.shots.length && this.shots[0].at <= this.clock) {
      const shot = this.shots.shift()!;
      if (shot.ownerUid && !shot.allowDeadOwner && !this.enemies.some(e => e.uid === shot.ownerUid && !e.dead)) continue;
      this.emitProjectile(shot);
    }
    // Fire events and the last queued shot precede native EnterCeaseFire.
    this.dispatchPendingWeaponCease();
    for (const bullet of this.projectiles) this.moveProjectile(bullet, dt);
    for (const prism of this.prisms.values()) prism.update(this.clock);
    this.updatePrismReactions();
    // Update held followers after old-position capture and before collision.
    this.enemyOrbits.step(dt);
    for (const bullet of this.projectiles) {
      const motion = this.loadoutBulletMotion.get(bullet);
      if (motion) { motion.distance += Math.hypot(bullet.x - motion.x, bullet.z - motion.z); motion.deviation += Math.abs(Math.atan2(Math.sin(bullet.angle - motion.angle), Math.cos(bullet.angle - motion.angle))) * 180 / Math.PI; motion.x = bullet.x; motion.z = bullet.z; motion.angle = bullet.angle; }
      const collider = this.colliderScales.get(bullet);
      if (collider && !bullet.dead) { const scale = collider.step(dt), data = this.content.chapter.bullets[bullet.bulletId].parameters; bullet.radiusX = Number(data.Shape[0]) * scale; bullet.radiusZ = Number(data.Shape[1] ?? data.Shape[0]) * scale; bullet.offsetZ = Number(data.ShapeOffset?.[1] || 0) * scale; }
    }
    this.rayChasers?.step(dt);
    this.updateBlackHoles();
    this.collisions();
    this.updateDamageAreas();
    this.finalizeProjectileDeaths();
    if (p.hp <= 0) { this.projectiles = this.projectiles.filter(b => !b.dead); this.beginPlayerDeath(); return; }
    this.movePickups(dt);
    this.advancePresentation(dt);
    this.projectiles = this.projectiles.filter(b => !b.dead);
    // BattleLogicWorld.Tick: entities/late/orbits/bullets, then camera/walls,
    // then BattleManager waves. AI casts above use last tick's published walls.
    if (this.scrollCamera?.update(dt)) this.mapOutWalls?.onCameraBoundsUpdated(this.scrollCamera.bounds);
    if (this.completedWaveUI !== undefined) {
      const id = this.completedWaveUI; this.completedWaveUI = undefined;
      if (this.waveUIRequest?.id === id) this.waveUIRequest = undefined;
      this.applyWaveActions(this.waveFlow.completeUI(id));
    }
    this.applyWaveActions(this.waveFlow.step(dt, this.clock));
    for (const spawn of this.creators.takeDue(this.clock)) this.spawn(spawn);
    if (this.phase === 'playing' && !this.resultDelay) this.updateTreasures(dt);
    if (this.phase === 'playing' && !this.resultDelay) {
      if (this.waveUIRequest?.type === 4 && !this.pendingLevels && !this.pickups.some(item => item.kind === 'exp'))
        this.completeWaveUI(this.waveUIRequest.id);
    }
    if (this.pendingLevels && !this.resultDelay && this.phase === 'playing') this.openUpgrade();
  }
  completeWaveUI(id: number) {
    // UI callbacks can arrive during pause/selection. Consume the command on
    // the next playing logic frame, never create enemies from a DOM callback.
    if (this.waveUIRequest?.id === id) this.completedWaveUI = id;
  }
  private applyWaveActions(actions: NativeWaveFlowAction[]) {
    for (const action of actions) {
      if (action.kind === 'mission-selected') {
        this.wave = Number(action.wave.number);
        if (this.experienceWave !== this.wave) {
          this.voidSlashes?.clear();
          this.experienceWave = this.wave;
          for (const familyId of this.weaponPrograms.keys()) this.dispatchWeaponEvent(1, familyId, { skipPlayer: true });
          this.dispatchPlayerEvent(1);
          const plannedEntities = this.content.spawns.filter(spawn => spawn.wave === this.wave)
            .map(spawn => this.content.chapter.entities[spawn.entityId]);
          this.waveExperience.reset(Number(action.wave.experienceBudget), Boolean(action.wave.stopByEliteOrBossKilled),
            plannedEntities.map(entity => ({ weight: Number(entity.stats.expWeight), type: Number(entity.raw.Type) })));
          this.waveGold.reset(Number(action.wave.goldBudget),
            plannedEntities.map(entity => ({ dropType: Number(entity.raw.MonsterDropType), characterType: Number(entity.raw.Type) })),
            this.content.assets.monsterDrops, Boolean(action.wave.stopByEliteOrBossKilled), () => this.random());
        }
      } else if (action.kind === 'mission') {
        this.currentMissionId = Number(action.event.id);
        this.creators.refresh(action.event, action.refreshWorldClock,
          spawn => this.waveGold.create(Number(this.content.chapter.entities[spawn.entityId].raw.MonsterDropType)), this.cameraBounds());
        for (const event of this.content.chapter.npc?.events || []) if (event.missionId === action.event.id && event.enabled)
          this.queuedNpc.push({ event, at: action.refreshWorldClock + Number(event.extraDelaySeconds || 0) });
        const musicId = Number(action.wave.raw.bgMusic || 0);
        if (action.event.type !== 9 && musicId > 0) this.musicRequests.push(musicId);
      } else if (action.kind === 'ui') {
        this.waveUIRequest = action;
        if (action.type === 2 || action.type === 5) this.sounds.push(action.type === 2 ? 100007 : -24);
        // TriggerBossNoticeStart@6984f38: boss notice only (not type5).
        if (action.type === 2) this.dispatchPlayerEvent(67);
        // UpLevelProgress calls AbsorbAll only if XP is still arriving. The
        // ordinary Type8 direct-XP path must not vacuum repairs at every wave.
        if (action.type === 4 && this.pickups.some(item => item.kind === 'exp')) this.collectWaveRemainders();
      } else if (action.kind === 'collect-exp') {
        for (const item of this.pickups) if (item.kind === 'exp') item.attracted = true;
      } else if (action.kind === 'mission-event') {
        // Ordinary WorldType=1 CheckContractDevil emits event 8 after a
        // nonfinal boss mission. This is independent of authored type9 NPCs.
        const config = this.content.chapter.npc?.configs?.[8];
        if (!config) throw new Error('缺少原版任务事件 8 的宝箱配置');
        this.spawnTreasure({ entityId: 8, modelId: config.modelId, position: config.position });
      } else if (action.kind === 'cancel-wave-creators') {
        this.creators.cancelWave(action.wave.number);
      } else if (action.kind === 'wave-finish') {
        // MainDropManager.WaveGold -> IMainChapter.waveGold, followed by
        // WaterfallBattleManager.AddExpAndGold's FP multiply and CeilToInt.
        // All captured normal chapters have waveGold=0. Picked-up monster
        // coins are a separate path and must NOT receive this multiplier.
        const baseGold = (nativeResearchSource.chapterWaveGold as Record<string, number>)[this.content.chapter.chapter.id];
        if (baseGold === undefined) throw new Error('缺少原版波次固定金币配置');
        const rateRaw = BigInt(Math.round((this.playerCombatAttributes()['BattleGold%'] || 0) * 65536));
        this.gold += Number((BigInt(baseGold) * (65536n + rateRaw) + 65535n) >> 16n);
        const heal = this.playerCombatAttributes()['WaveFinishRecoverHP%'] || 0;
        if (heal > 0 && this.player.hp > 0) this.healPlayer(this.player.maxHp * heal);
        this.playerStatuses.clearWave(); this.weaponStatuses.clearWave();
        for (const familyId of this.weaponPrograms.keys()) this.dispatchWeaponEvent(52, familyId, { skipPlayer: true });
        this.dispatchPlayerEvent(52);
      } else if (action.kind === 'chapter-complete') this.beginVictory();
    }
  }
  private beginVictory() {
    if (this.resultDelay || this.player.hp <= 0) return;
    this.resultDelay = Math.max(1.4, ...this.effects.filter(fx => fx.kind === 'explosion').map(fx => fx.duration - fx.age));
    for (const bullet of this.projectiles) for (const effect of this.randomLaserWarnings.get(bullet) || []) effect.duration = effect.age;
    this.waveUIRequest = undefined; this.completedWaveUI = undefined;
    this.collectWaveRemainders(); this.projectiles = []; this.shots = []; this.damageAreas = []; this.announce('战斗胜利', 10);
    this.playerMotion = { x: 0, z: 0, rawX: 0 };
    for (const enemy of this.enemies) { enemy.laserWarning = undefined; enemy.urgencyWarning = undefined; }
  }
  private advanceVictory(dt: number) {
    this.movePickups(dt);
    this.advancePresentation(dt);
    if (this.victoryDeparture) {
      const departure = this.victoryDeparture;
      departure.elapsed += dt;
      const t = clamp(departure.elapsed, 0, 1);
      this.player.oldZ = this.player.z;
      this.player.z = lerp(departure.fromZ, departure.targetZ, t * t);
      this.resultDelay = Math.max(0, 1.3 - departure.elapsed);
      if (departure.elapsed >= 1.3) { this.pendingLevels = 0; this.phase = 'won'; }
      return;
    }
    this.resultDelay = Math.max(0, this.resultDelay - dt);
    if (this.resultDelay === 0) {
      if (this.pickups.some(item => item.attracted)) this.resultDelay = dt;
      else {
        // Original battle-end presentation specifies a one-second leave and
        // .3-second tail wait. Its exact authored curve is not available here.
        this.victoryDeparture = { fromZ: this.player.z, targetZ: this.cameraBounds().top + 5, elapsed: 0 };
        this.resultDelay = 1.3;
      }
    }
  }
  private beginPlayerDeath() {
    // GetRebornType/ReduceReborn@6f8a800/6f8a984: skill1 (type4) wins
    // over manual/ad revival and consumes its count at death-state entry.
    const revives = (this.installedWeaponActions.get(0) || []).filter(command => command.action === 191);
    const count = revives.reduce((total, command) => total + Number(command.args.TriggerCount || 0), 0);
    if (count > this.equipmentRevivesUsed) { this.equipmentRevivesUsed++; this.pendingEquipmentRevive = [...revives]; }
    const entity = this.content.chapter.entities[this.content.chapter.player.entityId];
    let effectId = 0;
    try { effectId = Number(JSON.parse(entity.raw.deathParams || '{}').ExplosionEffectId || 0); } catch {}
    if (effectId) {
      const effect = this.effect('explosion', this.player.x, this.player.z, 1, 1, undefined, effectId);
      markPlayerDeathVisual(effect);
      effect.originalScale = 1;
    }
    if (entity.raw.deadSoundId) this.sounds.push(entity.raw.deadSoundId);
    // BaseHeroDieState.OnEnter@6946878 writes FP0xcccc before offering manual revival.
    this.deathDelay = 52428 / 65536;
    this.playerMotion = { x: 0, z: 0, rawX: 0 };
    this.noticeUntil = 0;
  }
  private completeEquipmentRevive() {
    // BaseHeroDieState.OnUpdate@69471a0 waits for the normal death effect.
    // Skill1 recovery is additive, and does not consume manual/ad quotas or
    // increment their result counter (BattleWorldContext.AddReliveCount).
    const commands = this.pendingEquipmentRevive; this.pendingEquipmentRevive = [];
    this.sounds.push(270001);
    const recover = commands.reduce((total, command) => total + Number(command.args.RecoverPercent || 0), 0);
    this.healPlayer(this.player.maxHp * recover, 11);
    const source = { attack: this.player.attack, familyId: this.content.chapter.player.entityId, weaponId: 0,
      timeShieldExtraDuration: this.playerCombatAttributes().TimeShieldExtraDuration || 0 };
    const common = nativeBattleRules.invincibleBuff;
    this.playerStatuses.hit(0, [{ buffId: common.ID, probability: 1 }], source, () => this.random());
    if (common.AddSound) this.sounds.push(common.AddSound);
    this.refreshBuffAttributes();
    this.dispatchPlayerEvent(11, { rebornType: 4, point: this.player });
    // HeroComponentDie.ReBorn invokes OnReborn after event11. Action191 then
    // applies modifiers, buffs, and finally its configured weapon/flags.
    for (const command of commands) {
      this.specialAttributeSources.set(`skill1-reborn:${command.sourceKey}`, { familyId: 0,
        attributes: parseNativeConditionalAttributes(command.args.Attrs) });
      this.refreshBuffAttributes();
      for (const buffId of command.args.BuffIds || []) {
        this.playerStatuses.hit(0, [{ buffId, probability: 1 }], source, () => this.random());
        const sound = this.content.combat.buffs[buffId]?.AddSound;
        if (sound) this.sounds.push(Number(sound));
      }
      this.refreshBuffAttributes();
      if (Number(command.args.WeaponId) > 0) this.fireLoadoutSpecial({ familyId: this.content.chapter.player.entityId,
        sourceKey: command.sourceKey, weaponId: Number(command.args.WeaponId), position: { x: this.player.x, z: this.player.z },
        yawDegrees: 0, bulletFlag: Number(command.args.BulletFlag || 0) });
    }
    this.player.oldX = this.player.x; this.player.oldZ = this.player.z;
    this.playerMotion = { x: 0, z: 0, rawX: 0 };
    this.deathDelay = 0; this.reviveResumeDelay = nativeBattleRules.resumeDelayRaw / 65536;
    this.phase = 'playing';
  }
  private advancePresentation(dt: number) {
    for (const chest of this.treasures) {
      chest.animationAge += dt;
      if (chest.animation === 'Born' && chest.animationAge >= chestAnimations.clips.Born.duration) {
        chest.animationAge -= chestAnimations.clips.Born.duration; chest.animation = 'Idle';
      }
    }
    for (const chest of [...this.treasures]) if (chest.animation === 'Death' && chest.animationAge >= chestAnimations.clips.Death.duration) {
      this.treasures = this.treasures.filter(item => item.uid !== chest.uid);
      // The only certified NPC factory here is Punchboard (NpcType 8).
      this.applyWaveActions(this.waveFlow.npcRemoved(8, this.treasures.length > 0));
    }
    for (const fx of this.effects) fx.age += dt;
    this.effects = this.effects.filter(fx => fx.age < fx.duration && (fx.duration !== Infinity || !fx.ownerUid || this.enemies.some(e => e.uid === fx.ownerUid && !e.dead)));
    for (const enemy of this.enemies) if (enemy.dead) {
      this.enemyBehaviors.delete(enemy.uid);
      this.dynamicRotations.delete(enemy.uid);
      this.removeMonsterSkills(enemy.uid);
      if (enemy.deathRemaining !== undefined) {
        enemy.deathAge = (enemy.deathAge || 0) + dt;
        const death = this.backDeaths.get(enemy.uid);
        if (death) {
          const edge = death.runtime.update(Math.round(dt * 65536));
          if (edge.enterDeathComplete) {
            this.playEnemyDeathEffect(enemy, death.effectId);
            if (edge.fireWeaponId && !this.resultDelay && !this.deathDelay && this.player.hp > 0)
              this.fireEnemyDeathWeapon(enemy, edge.fireWeaponId);
          }
          if (edge.destroy) { enemy.deathRemaining = 0; this.backDeaths.delete(enemy.uid); }
        } else enemy.deathRemaining -= dt;
        if (enemy.deathRemaining <= 0) {
          if (enemy.deathSound) { this.sounds.push(enemy.deathSound); enemy.deathSound = 0; }
          if (this.waveExperience.complete(Number(this.content.chapter.entities[enemy.entityId].raw.Type)))
            this.applyWaveActions(this.waveFlow.finishSpecialWave());
          // OnEnemyDie calls special logic before CheckEnemyAllDie. KillCount
          // has already increased at death start, but alone is not a callback.
          if (this.player.hp <= 0) this.deferredWaveClear = true;
          else this.checkWaveClear();
        }
      }
    }
    for (const enemy of this.enemies)
      if (enemy.dead && !(enemy.deathRemaining! > 0)) {
        this.enemyOrbits.remove(enemy.uid);
        // These target IDs are never reused within a run. Keep all hit counts
        // through death callbacks, then release their timestamp histories.
        const suffix = `:${enemy.uid}`;
        for (const key of this.weaponHitHistory.keys()) if (key.endsWith(suffix)) this.weaponHitHistory.delete(key);
        for (const key of this.exactWeaponHitHistory.keys()) if (key.endsWith(suffix)) this.exactWeaponHitHistory.delete(key);
      }
    this.enemies = this.enemies.filter(e => !e.dead || (e.deathRemaining || 0) > 0);
  }
  private checkWaveClear() {
    this.applyWaveActions(this.waveFlow.checkClear({ queuedCount: this.creators.queuedCount,
      enemyCount: this.nativeEnemyCount, killCount: this.nativeKillCount,
      hasNpc: this.treasures.length > 0, heroDead: this.player.hp <= 0 }));
  }
  advanceResultPresentation(dt: number) {
    // Let the original smoke finish underneath the result overlay without
    // advancing battle time, attacks, damage, rewards or upgrade selection.
    if (this.phase === 'lost') {
      for (const fx of this.effects) fx.age += dt;
      this.effects = this.effects.filter(fx => fx.age < fx.duration);
    }
  }
  private updateTreasures(dt: number) {
    const npc = this.content.chapter.npc;
    for (const { event } of this.queuedNpc.filter(row => row.at <= this.clock)) {
      this.spawnTreasure(event);
    }
    this.queuedNpc = this.queuedNpc.filter(row => row.at > this.clock);
    for (const chest of this.treasures) {
      if (chest.animation === 'Death' || chest.uid === this.claimedTreasure) continue;
      const touching = Math.hypot(this.player.x - chest.x, this.player.z - chest.z) <= chest.radius + .25;
      chest.progress = touching ? chest.progress + dt / (npc.rules.pickupCountdownTime || .2)
        : Math.max(0, chest.progress - dt / (npc.rules.pickupCountdownBackTime || 10));
      if (chest.progress <= 1) continue;
      this.claimedTreasure = chest.uid;
      this.openTreasure();
      break;
    }
  }
  private spawnTreasure(event: RecordData) {
    const config = this.content.chapter.npc.configs[event.entityId]?.entity;
    if (!config) throw new Error(`缺少原版 NPC 配置 ${event.entityId}`);
    this.treasures.push({ uid: this.serial++, modelId: event.modelId, ...event.position,
      scale: config.ModelScale, radius: Number(config.Shape[0]), progress: 0, animation: 'Born', animationAge: 0 });
  }
  private openTreasure() {
    // Const..cctor #4f0/#4f8: metadata 0xF001E0 = [60,0,30,0,10].
    // GetPunchboardRandomCount blocks the fifth reward at <=4 weapon families;
    // XXRandom's inclusive upper ticket falls back to one reward.
    const rules = this.content.chapter.npc.rules;
    const weights = [...rules.rewardCountWeights] as number[];
    // HeroComponentRandomSkill.GetPunchboardRandomCount@6ca3de4: only
    // the last reward-count weight is multiplied and rounded (not +chance).
    const fiveRate = this.playerCombatAttributes()['FiveSkillRate%'] || 0;
    if (fiveRate > 0) weights[weights.length - 1] = Math.round(weights[weights.length - 1] * (1 + fiveRate));
    if (1 + this.secondary.size <= rules.fiveRewardBlockedAtWeaponCount) weights[4] = 0;
    let ticket = Math.floor(this.random() * (weights.reduce((sum, weight) => sum + weight, 0) + 1));
    let count = 1;
    for (let i = 0; i < weights.length; i++) { ticket -= weights[i]; if (ticket < 0) { count = i + 1; break; } }
    this.treasureRewards = [];
    for (let i = 0; i < count; i++) {
      // Local supported-skill adaptation of the already-studied pool. Each reward
      // updates prerequisites before the next draw; no XP level is consumed.
      this.choices = this.makeChoices(true); this.phase = 'upgrade';
      if (!this.choices.length) break;
      let card = this.choices[0];
      this.choose(card.id, true);
      if (this.choices.length) {
        card = this.choices[0]; this.choose(card.id, true);
      }
      this.treasureRewards.push(card);
    }
    this.choices = []; this.phase = 'treasure'; // Supply presentation owns its audio.
  }
  closeTreasure() {
    if (this.phase !== 'treasure') return;
    const chest = this.treasures.find(item => item.uid === this.claimedTreasure);
    if (chest) { chest.animation = 'Death'; chest.animationAge = 0; chest.progress = 0; }
    this.claimedTreasure = undefined;
    this.phase = 'playing';
  }
  spawn(s: Spawn, angle = Math.PI) {
    const d = this.content.chapter.entities[s.entityId];
    if (!d) return;
    const boss = nativeIsBoss(d.raw.Type), elite = d.raw.Type === 201;
    // CreateEnemy@6e6cc2c: protection scales HPMaxMission, never attack.
    const hp = d.stats.hp * s.hpMultiplier * this.protectHpRate;
    const enemy: Enemy = {
      uid: this.serial++, entityId: s.entityId, modelId: d.modelId, scale: d.modelScale, x: s.x, z: s.z,
      oldX: s.x, oldZ: s.z, hp, maxHp: hp, attack: d.stats.attack * s.attackMultiplier,
      // CreateEnemy merges AttackMission into BOTH Attack and BodyAttack.
      bodyAttack: d.stats.bodyAttack * s.attackMultiplier, ignoreDrop: s.ignoreDrop, parentUid: s.parentUid,
      radiusX: d.stats.shape[0] || 0.8, radiusZ: d.stats.shape[1] ?? d.stats.shape[0] ?? 0.8,
      age: 0, fireAt: 0, weaponStep: 0,
      wave: s.wave, origin: { x: s.x, z: s.z }, target: { x: s.x, z: s.z }, pathDistance: 0,
      // Chapter creation overload 0x6e70910 supplies AngleY=180 degrees;
      // layout.rotation is not passed to that overload.
      angle, hitFlash: 0, exp: s.exp, gold: s.gold, carriesGold: Boolean(s.carriesGold),
      hpDropMultiplierRaw: s.hpDropMultiplierRaw, boss, elite, dead: false, box: d.stats.shape.length > 1,
    };
    const born = nativeBornSettings(d.ai.bornType, d.ai.bornParameters || {});
    const entryDuration = born.duration;
    const entry = entryDuration ? enemyEntryPoint(enemy.origin, this.cameraBounds(), born.parallel, born.randomEdge, born.edgeType, () => this.random()) : { ...enemy.origin };
    enemy.x = enemy.oldX = entry.x; enemy.z = enemy.oldZ = entry.z;
    enemy.viewResetPosition = { ...entry }; enemy.viewPositionRevision = 0;
    if (d.ai.type === 'AIMoveReboundWall') enemy.angle = Number(d.ai.parameters?.OriginAngle ?? 0) * Math.PI / 180;
    const path = s.pathId && this.content.assets.geometry.paths[s.pathId];
    this.enemyBehaviors.set(enemy.uid, { attack: createAttackLoop(Number(d.ai.parameters?.fireDelay || 0)), entry, entryDuration, busyUntil: 0, weaponId: 0,
      path: path ? createNativeEnemyPath(path) : undefined, pathOrigin: { ...enemy.origin }, loopZ: s.loopZ, loopRestartZOffset: s.loopRestartZOffset });
    this.enemies.push(enemy);
    if ((d.raw.SpecialTrait || []).some((trait: unknown) => chapterEnemyOrbitTraitSupported(this.content, s.entityId, trait)))
      this.enemyOrbits.add(enemy);
    this.nativeEnemyCount++;
    const skills = this.monsterSkills.add({ ...enemy, side: 'enemy' }, d.raw.MonsterAbility || [], {
      entityType: d.raw.Type, chapterFeatureIds: this.content.chapter.chapter.parameters.ChapterMonsterFeature || [],
    });
    for (const aura of skills.visuals) {
      const fx = this.effect('muzzle', enemy.x, enemy.z, Infinity, aura.diameter, undefined, aura.effectId);
      fx.ownerUid = enemy.uid; fx.duration = Infinity;
    }
    if (nativeUrgencyParameters(d).onCreate) startNativeUrgencyWarning(enemy, d);
  }
  private restartEnemyLoop(enemy: Enemy, behavior: EnemyBehavior, data: RecordData) {
    const next = enemyLoopRestartPoint(enemy.origin, this.cameraBounds(), nativeShapeRadii(data.stats.shape).radius, behavior.loopRestartZOffset);
    this.setEnemyPositionImmediately(enemy, next);
    this.resetEnemyMovementTasks(enemy, behavior, data);
  }
  private setEnemyPositionImmediately(enemy: Enemy, next: Point) {
    enemy.x = enemy.oldX = next.x; enemy.z = enemy.oldZ = next.z;
    enemy.viewResetPosition = { ...next }; enemy.viewPositionRevision = (enemy.viewPositionRevision || 0) + 1;
  }
  /** ClearTask -> Attack re-entry rebuilds movement from the current position.
   * Keep InMapOrigin for later natural loop births; being pulled is not a
   * request to teleport back to the original path or to the top of the map. */
  private resetEnemyMovementTasks(enemy: Enemy, behavior: EnemyBehavior, data: RecordData) {
    behavior.attackEntered = true;
    enemy.pathDistance = 0; behavior.pathOrigin = { x: enemy.x, z: enemy.z };
    behavior.patrol = undefined; behavior.moveTarget = undefined; behavior.bottomExitSpeed = undefined;
    behavior.pathPhase = 'path'; behavior.pathWait = 0; behavior.rushDirection = undefined; behavior.rushSpeed = undefined;
    behavior.pathSpeedAtStart = undefined; behavior.pathExitSpeed = undefined;
    behavior.reboundTaskReady = false;
    enemy.urgencyWarning = undefined;
    behavior.attack = createAttackLoop(Number(data.ai.parameters?.fireDelay || 0));
    if (enemy.animationClip !== 'Idle') { enemy.animationClip = 'Idle'; enemy.animationTime = 0; }
  }
  private followPath(enemy: Enemy, behavior: EnemyBehavior, data: RecordData, dt: number) {
    const path = behavior.path!;
    if (behavior.pathPhase === 'exit') {
      // MoveOnPathEnd starts on the update AFTER the curve task completes.
      const exitSpeed = behavior.pathExitSpeed ??= Number(data.stats.speed);
      const distance = exitSpeed * dt;
      enemy.x += Math.sin(enemy.angle) * distance; enemy.z += Math.cos(enemy.angle) * distance;
      const loopSelf = data.ai.parameters?.IsLoopSelf === true;
      const padding = loopSelf ? 0 : 5, bounds = this.cameraBounds();
      if (enemy.x < bounds.left - padding || enemy.x > bounds.right + padding || enemy.z < bounds.bottom - padding || enemy.z > bounds.top + padding) {
        if (loopSelf) this.restartEnemyLoop(enemy, behavior, data);
        else this.suicideEnemy(enemy);
      }
      return;
    }
    if (data.ai.type === 'AIMoveOnPathLoopBorn') {
      if (behavior.pathPhase === 'warning-start') {
        startNativeUrgencyWarning(enemy, data);
        behavior.pathPhase = 'warning'; behavior.pathWait = 0;
        return;
      }
      if (behavior.pathPhase === 'warning') {
        const warningTime = nativeUrgencyParameters(data).duration;
        behavior.pathWait = (behavior.pathWait || 0) + dt;
        if (behavior.pathWait >= warningTime) behavior.pathPhase = 'rush';
        return;
      }
      if (behavior.pathPhase === 'rush') {
        if (behavior.rushSpeed === undefined) {
          behavior.rushDirection = data.ai.parameters.SecondMoveIsRotateToTarget === 1 ? Math.atan2(this.player.x - enemy.x, this.player.z - enemy.z) : Math.PI;
          // MoveOnStraightDown.OnStart snapshots MoveSpeed; later attribute
          // changes must not rewrite this already-started rush task.
          behavior.rushSpeed = data.stats.speed;
          enemy.angle = behavior.rushDirection;
        }
        const distance = behavior.rushSpeed! * Number(data.ai.parameters.SecondMoveSpeedScale || 0) * dt;
        enemy.x += Math.sin(behavior.rushDirection!) * distance; enemy.z += Math.cos(behavior.rushDirection!) * distance;
        const bounds = this.cameraBounds();
        // MoveOnStraightDown uses MapManager.monsterDieCameraOffset=5.
        if (enemy.x < bounds.left - 5 || enemy.x > bounds.right + 5 || enemy.z < bounds.bottom - 5 || enemy.z > bounds.top + 5) this.restartEnemyLoop(enemy, behavior, data);
        return;
      }
    }
    const pathStartSpeed = behavior.pathSpeedAtStart ??= Number(data.stats.speed);
    const rawSpeed = this.content.chapter.entities[enemy.entityId].stats.speed;
    enemy.pathDistance += nativePathDistanceDelta(pathStartSpeed, data.stats.speed, rawSpeed, dt);
    // OnMovePath is invoked before the completion check and before this tick's
    // sampled displacement. Its firing eligibility uses the old position.
    if (data.ai.type === 'AIMoveOnPathAttackLoopBorn') {
      enemy.angle = chapterPathRotationRadians(data.ai.type, data.ai.parameters || {}, enemy.angle, dt);
      this.advanceOrdinaryEnemyAttack(enemy, behavior, data, dt);
    }
    if (enemy.pathDistance >= path.length) {
      if (data.ai.type === 'AIFixedBezierPath') behavior.pathPhase = 'exit';
      else if (data.ai.type === 'AIMoveOnPathLoopBorn') behavior.pathPhase = 'warning-start';
      else this.restartEnemyLoop(enemy, behavior, data);
      return;
    }
    const next = sampleNativeEnemyPath(path, behavior.pathOrigin, enemy.pathDistance);
    if (data.ai.parameters?.rotateType !== 1 && !chapterPathSelfRotationEnabled(data.ai.type, data.ai.parameters || {})) enemy.angle = nativePathMovementAngle(enemy, next, enemy.angle);
    enemy.x = next.x; enemy.z = next.z;
  }
  private moveEnemy(e: Enemy, dt: number) {
    if (e.dead) return;
    const sourceData = this.content.chapter.entities[e.entityId];
    const status = this.statuses.modifiers(e.uid);
    const d = { ...sourceData, stats: { ...sourceData.stats, speed: sourceData.stats.speed * status.moveSpeed } }, ai = d.ai.parameters || {};
    const behavior = this.enemyBehaviors.get(e.uid)!;
    e.oldX = e.x; e.oldZ = e.z; e.age += dt; e.hitFlash = Math.max(0, e.hitFlash - dt);
    if (status.immobile) { e.age -= dt; e.fireAt += dt; return; }
    const pulled = this.blackHolePulls.get(e.uid);
    if (pulled) {
      if (pulled.runtime.update(dt, this.blackHolePullHost(e, pulled.source))) { e.age -= dt; e.fireAt += dt; return; }
      this.blackHolePulls.delete(e.uid);
      this.resetEnemyMovementTasks(e, behavior, d);
      // The pull task's completion changes AI state; the newly rebuilt task
      // is not advanced by this same AIStateController.UpdateTask call.
      return;
    }
    if (!behavior.attackEntered && e.age <= behavior.entryDuration) {
      e.animationClip = 'Born'; e.animationTime = e.age;
      Object.assign(e, sampleBornPosition(behavior.entry, e.origin, e.age, behavior.entryDuration));
      return;
    }
    if (!behavior.attackEntered) {
      behavior.attackEntered = true;
      e.x = e.origin.x; e.z = e.origin.z;
      e.animationClip = 'Idle'; e.animationTime = 0;
    } else if (!e.boss && e.animationClip === 'Idle') e.animationTime = (e.animationTime || 0) + dt;
    // AICommonBoss.OnMoveEventUpdate (0x690af48..0x690b0b0): rotate the
    // entity during Attack, including cooldown, but never during Born.
    if (d.ai.type === 'AICommonBoss') e.angle += Number(ai.SelfRotateSpeed || 0) * Math.PI / 180 * dt;
    // AIMoveForward.InitAttackLoop 0x68f0700 creates MoveOnPathEnd.
    // OnStart 0x69dc388 snapshots speed; zero SpeedScale becomes identity.
    if (d.ai.type === 'AIMoveForward')
      behavior.bottomExitSpeed ??= Number(d.stats.speed) * (Number(ai.SpeedScale) || 1);
    if (behavior.bottomExitSpeed !== undefined) {
      // MoveOnPathEnd snapshots speed on entry, retains forward heading,
      // and self-dies outside camera+5. It does not cancel existing salvos.
      e.x += Math.sin(e.angle) * behavior.bottomExitSpeed * dt;
      e.z += Math.cos(e.angle) * behavior.bottomExitSpeed * dt;
      const bounds = this.cameraBounds();
      if (e.x < bounds.left - 5 || e.x > bounds.right + 5 || e.z < bounds.bottom - 5 || e.z > bounds.top + 5) this.suicideEnemy(e);
      return;
    }
    if (ai.CallMonsters?.length) {
      if (!nativeStraightFallSummonSupported(d, this.content.chapter.chapter.parameters))
        throw new Error(`敌人 ${e.entityId} 的召唤分支尚未还原`);
      behavior.summons ??= createNativeSummons();
      const holding = advanceNativeSummons(behavior.summons, ai, dt, () => this.random(), () => this.spawnNativeChildren(e, ai));
      if (holding) { e.animationClip = 'Idle'; e.animationTime = e.age; return; }
    }
    if (d.ai.type === '200007' || d.ai.type === '320013') {
      this.advanceDedicatedEnemyAttack(e, behavior, d, dt, status.attackSpeed);
      return;
    }
    if (d.ai.type === 'AICommonBossNew') {
      this.advanceSequentialBoss(e, behavior, d, dt, status.attackSpeed);
      return;
    }
    if (d.ai.type === 'AIMoveDynamicRotateCenter') {
      let rotation = this.dynamicRotations.get(e.uid);
      if (!rotation) {
        const node = parseNativeBehavior(ai.Behaviour).find(node => node.name === 'MoveDynamicRotateCenter');
        if (!node) throw new Error(`敌人 ${e.entityId} 缺少原生绕中心移动参数`);
        rotation = createNativeDynamicRotate(node.parameters); this.dynamicRotations.set(e.uid, rotation);
      }
      if (advanceNativeDynamicRotate(e, rotation, dt)) { this.suicideEnemy(e); this.dynamicRotations.delete(e.uid); }
      return;
    }
    if (d.ai.type === 'AIMoveFollowTarget') {
      advanceNativeFollowTarget(e, this.player, d.stats.speed, nativeShapeRadii(d.stats.shape).radius, dt, ai);
      return;
    }
    if (d.ai.type === 'AIMoveUpDown') {
      behavior.upDown ??= createNativeUpDownState(ai, () => this.random());
      const action = advanceNativeUpDown(behavior.upDown, e, this.cameraBounds(), nativeShapeRadii(d.stats.shape).radius2, d.stats.speed, dt, () => this.random(), ai, () => {
        // onReachBottom / onMoveUpCallback call CreateWeaponAndFire before
        // movement, with a fixed world pose rather than a moving Head mount.
        for (const id of d.weaponIds) this.fireEnemyFixedWeapon(e, { weaponId: id,
          fixedPosition: { x: e.x, y: 0, z: e.z }, angle: e.angle, flags: 0x88, allowDeadOwner: false });
      });
      const clip = action.phase === 'warning' ? 'Warning' : action.phase === 'down' ? 'Rush' : action.phase === 'up' ? 'RushEnd' : 'Run';
      e.animationTime = e.animationClip === clip ? (e.animationTime || 0) + dt : 0;
      e.animationClip = clip;
      return;
    }
    const boundsForFire = this.cameraBounds();
    const allowSend = canEnemySendBullet(e.z, Number(d.parameters?.NoAttackArea || 0), boundsForFire.bottom, boundsForFire.top - boundsForFire.bottom);
    let finishedBossAttack = false;
    if (e.boss && behavior.bossGate?.phase === 'attacking' && e.age >= behavior.busyUntil
      && !this.shots.some(shot => shot.ownerUid === e.uid)
      && !this.projectiles.some(bullet => bullet.ownerUid === e.uid && bullet.beam && !bullet.dead)) {
      const settings = nativeCommonBossSettings(ai, Math.max(0, d.weaponIds.indexOf(behavior.weaponId)));
      finishBossAttack(behavior.bossGate, settings.cooldownMin + this.random() * (settings.cooldownMax - settings.cooldownMin));
      finishedBossAttack = true;
    }
    const specialBoss = e.boss && d.ai.type === '340001';
    if (specialBoss) behavior.boss340001 ??= createNativeBoss340001State();
    const bossReady = specialBoss
      ? advanceNativeBoss340001(behavior.boss340001!, e, this.cameraBounds(), nativeShapeRadii(d.stats.shape).radius2, d.stats.speed, dt, () => this.random(), finishedBossAttack, ai)
      : e.boss && (!behavior.bossGate || advanceBossCooldown(behavior.bossGate, finishedBossAttack ? 0 : dt));
    if (bossReady && allowSend) {
      if (behavior.summons && beginNativeSummonChoice(behavior.summons, ai, this.clock, () => this.random(), () => this.spawnNativeChildren(e, ai))) {
        behavior.bossGate = undefined; behavior.moveTarget = undefined;
        e.animationClip = 'Idle'; e.animationTime = e.age;
        return;
      }
      const id = selectBossWeapon(d.weaponIds, ai.WeaponWeights, this.random());
      behavior.weaponId = id; behavior.moveTarget = undefined;
      const w = this.content.chapter.weapons[id];
      const timing = nativeBossWeaponFor(e.entityId, id), alarm = timing?.alarmSeconds || 0;
      const fireHold = timing?.fireHoldSeconds || 0;
      const laserPlan = d.ai.type === 'AICommonBoss' ? nativeCommonBossLaserPlan(w.trajectory, ai) : { warning: 0, gap: 0 };
      const warning = laserPlan.warning, attackDelay = warning + laserPlan.gap;
      behavior.moveStopAt = warning ? e.age + warning : undefined;
      const timeline = bossAttackTimeline(id, 0, status.attackSpeed, e.entityId);
      if (!timing || !timeline) throw new Error(`缺少 Boss 武器动画时序：${e.entityId}/${id}`);
      // Animator Hold event is at 1/60. Hold and FireHold each run their alarm substate.
      const enter = attackDelay + timeline.enter;
      const startDelay = attackDelay + timeline.firstFire;
      const hold = this.queueWeapon(id, 'enemy', e, e.uid, e.attack, e.angle, undefined, undefined, 0, startDelay);
      behavior.bossGate = createBossAttackGate();
      behavior.attackStart = e.age; behavior.enterAt = e.age + attackDelay;
      behavior.holdAt = behavior.enterAt + timeline.enter;
      behavior.fireHoldAt = behavior.enterAt + timeline.fireHoldStart;
      behavior.fireAt = e.age + startDelay;
      behavior.exitAt = behavior.enterAt + timeline.exitStart;
      behavior.busyUntil = Math.max(behavior.enterAt + timeline.exitEnd, behavior.fireAt + hold);
      if (warning) {
        const model = Object.values(this.content.assets.prefabs).find((p: any) => p.modelIds?.includes(e.modelId)) as RecordData | undefined;
        const mounts = (w.parameters.EntityBodyPosType as number[]).map(slot => model?.firePositions?.[slot]).filter(p => p && !p.missing).map(p => ({ x: p.x * e.scale, z: p.z * e.scale }));
        e.laserWarning = { target: { x: this.player.x, z: this.player.z }, until: e.age + warning, mounts };
      }
      if (alarm && timing.alarmEffect) {
        for (let i = 0; i < (fireHold > 0 ? 2 : 1); i++) {
          const effect = this.effect('muzzle', e.x, e.z, alarm, 1, undefined, timing.alarmEffect);
          effect.age = -(enter + i * alarm); effect.duration = alarm; effect.ownerUid = e.uid; this.enemyChargeEffects.set(effect,id);
        }
      }
      // HoldEffect belongs to charge Hold, not FireHold. These three weapons
      // have no charge modifier; do not fabricate a charge from FireHoldTime.
    }
    if (e.boss) {
      if (e.laserWarning) {
        // MultiWarningRedLineAction updates the target throughout its warning
        // task, then hides on task end. The pending salvo retains that last aim.
        e.laserWarning.target = { x: this.player.x, z: this.player.z };
        for (const shot of this.shots) if (shot.ownerUid === e.uid && shot.weaponId === behavior.weaponId) {
          if (shot.alarmAim && shot.alarmAim.lockedDelta === undefined) shot.alarmAim.target = { ...e.laserWarning.target };
          else if (shot.nativeShapeType === undefined && shot.aimTarget) shot.aimTarget = { ...e.laserWarning.target };
        }
        if (e.age >= e.laserWarning.until) e.laserWarning = undefined;
      }
      let clip = 'Idle', since = 0;
      if (behavior.bossGate?.phase === 'attacking') {
        const names = bossAnimationNames(behavior.weaponId, e.entityId)!;
        if (e.age < behavior.enterAt!) { clip = 'Warning'; since = behavior.attackStart!; }
        else if (e.age < behavior.holdAt!) { clip = names.enter; since = behavior.enterAt!; }
        else if (e.age < behavior.fireHoldAt!) { clip = names.hold; since = behavior.holdAt!; }
        else if (e.age < behavior.exitAt!) { clip = names.fireHold; since = behavior.fireHoldAt!; }
        else { clip = names.exit; since = behavior.exitAt!; }
      }
      e.animationClip = clip; e.animationTime = Math.max(0, (e.age - since) * status.attackSpeed);
    }
    if (d.ai.type === 'AIMoveReboundWall') {
      behavior.rebound ??= createNativeEnemyRebound(e.angle * 180 / Math.PI, d.stats.speed);
      if (!behavior.reboundTaskReady) {
        // A new straight task snapshots speed. AI-level boundary flags survive
        // ClearTask/re-entry; they are not reset by every direction change.
        behavior.rebound.taskSpeed = d.stats.speed;
        behavior.rebound.direction = { x: Math.sin(e.angle), z: Math.cos(e.angle) };
        behavior.reboundTaskReady = true;
      }
      // Original Linecast starts at the forward collider offset, with a length
      // based on CURRENT speed. The straight task below retains its speed snapshot.
      const shape: number[] = d.stats.shape;
      const shapeType = shape.length === 1 ? 1 : shape.length === 2 ? 4 : 0;
      const ray = nativeReboundRay(e, behavior.rebound, nativeReboundRayOffset(shapeType, shape), d.stats.speed, dt);
      const hit = this.mapOutWalls && nativeWallLinecast(ray.start, ray.end, this.mapOutWalls.boxes, nativeOrdinaryWallQueryMask, 0x800f);
      // S_1_1 has no StoneRects/ColliderRects. Its generated dynamic wall
      // entities have EntityType5 -> HitCamp32; no static SkyBound filter.
      // CheckRebound consumes one closest hit before movement, without snapping
      // position, adding a cooldown or trying a second wall after reflection.
      if (checkNativeEnemyRebound(e, behavior.rebound, { camera: this.cameraBounds(), scrollXOffset: nativeEnemyReboundScrollXOffset,
        cast: hit ? { camp: 32, normal: hit.normal } : undefined,
        nearestTarget: () => this.player.hp > 0 ? this.player : undefined })) e.angle = Math.atan2(behavior.rebound.direction.x, behavior.rebound.direction.z);
      advanceNativeEnemyRebound(e, behavior.rebound, dt);
    }
    else if (behavior.path) this.followPath(e, behavior, d, dt);
    else if (e.boss && !specialBoss) {
      // CommonBoss cancels its parallel movement when red-line warning ends.
      // Its aim gap, attack and cooldown then remain stationary.
      if (behavior.moveStopAt !== undefined && e.age >= behavior.moveStopAt) return;
      const index = Math.max(0, d.weaponIds.indexOf(behavior.weaponId));
      const settings = nativeCommonBossSettings(ai, index);
      if (!behavior.moveTarget || (e.x === behavior.moveTarget.x && e.z === behavior.moveTarget.z)) behavior.moveTarget = bossRandomTarget(e, this.cameraBounds(), settings.minZ, settings.maxZ, nativeShapeRadii(d.stats.shape).radius2, settings.moveType, () => this.random());
      advanceBossMove(e, behavior.moveTarget, d.stats.speed, dt, settings.moveType);
    } else if (specialBoss) {
      // Its horizontal move task has already advanced above; attacks hold position.
    } else if (/TwoPoints/.test(d.ai.type)) {
      if (!behavior.patrol) {
        behavior.patrol = createTwoPointMove(e, { x: Number(ai.nextPointX || 0), z: Number(ai.nextPointZ || 0) });
        e.angle = Math.atan2(Number(ai.fireDirectionX || 0), Number(ai.fireDirectionZ ?? -1));
      }
      advanceTwoPointMove(e, behavior.patrol, d.stats.speed, dt);
    } else if (nativeIsBottomAttackAI(d.ai.type)) {
      if (!behavior.moveTarget) {
        behavior.moveTarget = bottomAttackTarget(e, this.cameraBounds(), behavior.loopZ, { x: Number(ai.nextPointOffsetX || 0), z: Number(ai.nextPointOffsetZ || 0) });
        e.angle = Math.atan2(Number(ai.fireDirectionX || 0), Number(ai.fireDirectionZ ?? -1));
      }
      if (advanceMoveToPoint(e, behavior.moveTarget, d.stats.speed, dt)) {
        if (ai.isLoop === 1) this.restartEnemyLoop(e, behavior, d);
        else { behavior.bottomExitSpeed = d.stats.speed; return; }
      }
    } else {
      e.z -= Math.max(0.1, d.stats.speed) * dt;
    }
    // Each native movement task owns its exit/death. A generic screen-margin
    // deletion has no source contract and strands cumulative EnemyCount.
    if (d.ai.type !== 'AIMoveOnPathAttackLoopBorn') this.advanceOrdinaryEnemyAttack(e, behavior, d, dt);
  }
  private advanceOrdinaryEnemyAttack(e: Enemy, behavior: EnemyBehavior, d: RecordData, dt: number) {
    const ai = d.ai.parameters || {};
    if (!ai.needAttack || e.dead || e.boss) return;
    {
      const boundsForFire = this.cameraBounds();
      const allowSend = canEnemySendBullet(e.z, Number(d.parameters?.NoAttackArea || 0), boundsForFire.bottom, boundsForFire.top - boundsForFire.bottom);
      const path = /Path/.test(d.ai.type);
      const bounds = this.cameraBounds();
      const legal = e.x >= bounds.left && e.x <= bounds.right && e.z >= bounds.bottom && e.z <= bounds.top;
      // Old Bottom returns the authored interval verbatim; NewBottom delegates
      // to CalculateCeaseFireTime(custom), adding FireCD before attack speed.
      const fireInterval = d.ai.type === 'AIMoveToBottomAndAttackNew'
        ? nativeCeaseFireDuration(Number(ai.fireInterval || 0), Number(d.stats.fireInterval || 0), 0, 1, 1, this.statuses.modifiers(e.uid).attackSpeed)
        : ai.fireInterval ?? (Number(d.stats.fireInterval || 0) / Math.max(1e-6, this.statuses.modifiers(e.uid).attackSpeed));
      if (!advanceAttackLoop(behavior.attack, dt, Number(fireInterval), e.age < behavior.busyUntil, allowSend, path ? allowSend && legal : true, !path)) return;
      const direction = path ? e.angle : Math.atan2(Number(ai.fireDirectionX || 0), Number(ai.fireDirectionZ ?? -1));
      let hold = 0;
      for (const id of d.weaponIds) hold = Math.max(hold, this.queueWeapon(id, 'enemy', e, e.uid, e.attack, direction));
      behavior.busyUntil = e.age + hold;
    }
  }
  private spawnNativeChildren(owner: Enemy, ai: RecordData) {
    const call = ai.CallMonsters[0];
    const mission = this.content.chapter.waves.flatMap((wave: RecordData) => wave.events)
      .find((event: RecordData) => event.id === this.currentMissionId);
    for (let i = 0; i < Number(call.Count ?? 1); i++)
      this.spawn(nativeStraightFallChildSpawn(this.content, call, owner.uid, this.wave, mission, this.clock, this.cameraBounds(), () => this.random()));
  }
  /** The stationary attack tasks must not fall through to generic downward
   * movement or fireInterval. Their own wait begins only after OnFireEnd. */
  private advanceDedicatedEnemyAttack(e: Enemy, behavior: EnemyBehavior, d: RecordData, dt: number, attackSpeed: number) {
    const ai = d.ai.parameters || {}, is200007 = d.ai.type === '200007';
    const id = Number(d.weaponIds[0]);
    const timing = nativeEnemyAttackTimings[e.entityId]?.weapons[id];
    if (!timing || d.weaponIds.length !== 1) throw new Error(`缺少敌人 ${e.entityId} 武器 ${id} 的原生攻击时序`);
    // AI320013 320063/320075 use base FireCD=4, no WeaponAttr. The native
    // CeaseFire.Enter -> CalculateCeaseFireTime path already consumes this
    // base cooldown below; do not confuse it with the unused AI fireInterval.
    const supportedBaseCooldown = d.ai.type === '320013'
      && [320063, 320075].includes(e.entityId) && Number(d.stats.fireInterval) === 4;
    // Other nonzero cooldown/weapon-attribute variants remain unverified.
    if ((is200007 && (Number(d.raw.attackPossibility) !== 65536 || Number(ai.WarnTime || 0) !== 0))
      || (Number(d.stats.fireInterval || 0) !== 0 && !supportedBaseCooldown) || (this.content.chapter.weapons[id].raw?.WeaponAttr || []).length)
      throw new Error(`敌人 ${e.entityId} 的攻击参数变体尚未还原`);
    behavior.aimedAttack ??= createNativeAimedAttack();
    const state = behavior.aimedAttack;
    if (!is200007 && state.phase === 'ready') e.angle = Math.atan2(Number(ai.fireDirectionX || 0), Number(ai.fireDirectionZ ?? -1));
    let attackFinished = false;
    if (state.phase === 'attack' && e.age >= behavior.busyUntil
      && !this.shots.some(shot => shot.ownerUid === e.uid && shot.weaponId === id)) {
      const liveLasers = this.projectiles.some(bullet => bullet.ownerUid === e.uid && bullet.weaponId === id && bullet.beam && !bullet.dead);
      if (!behavior.ceaseFire) {
        behavior.ceaseFire = createNativeCeaseFire(nativeCeaseFireDuration(0, Number(d.stats.fireInterval || 0), 0, 1, 1, attackSpeed), liveLasers);
      } else {
        attackFinished = advanceNativeCeaseFire(behavior.ceaseFire, dt, !liveLasers);
      }
    }
    // 200007 selects a target within AttackDistance at the next task cycle;
    // a currently executing task retains its selected target through the cycle.
    const distance = Math.hypot(this.player.x - e.x, this.player.z - e.z);
    const selecting = state.phase === 'ready' || (state.phase === 'wait' && state.remaining <= dt);
    const target = !is200007 || !selecting || distance <= Number(d.parameters.AttackDistance)
      ? this.player : undefined;
    const action = is200007
      ? advanceNative200007(state, ai, dt, target, () => this.random(), attackFinished, true)
      : advanceNative320013(state, ai, dt, this.player, attackFinished);
    if (action.trackHeading && target) e.angle = Math.atan2(target.x - e.x, target.z - e.z);
    if (action.startWarning) {
      if (action.startWarning.directionType !== 0 && action.startWarning.directionType !== 1)
        throw new Error(`敌人 ${e.entityId} 的预警方向尚未还原`);
      const w = this.content.chapter.weapons[id];
      const model = Object.values(this.content.assets.prefabs).find((p: any) => p.modelIds?.includes(e.modelId)) as RecordData | undefined;
      const mounts = (w.parameters.EntityBodyPosType as number[]).map(slot => model?.firePositions?.[slot])
        .filter(p => p && !p.missing).map(p => ({ x: p.x * e.scale, z: p.z * e.scale }));
      // SelfDir is a fixed heading warning, not a red line tracking the hero.
      const warningTarget = action.startWarning.directionType === 1
        ? { x: e.x + Math.sin(e.angle) * this.content.world.height, z: e.z + Math.cos(e.angle) * this.content.world.height }
        : { x: this.player.x, z: this.player.z };
      e.laserWarning = { target: warningTarget, until: e.age + action.startWarning.duration, mounts };
    }
    if (e.laserWarning && Number(ai.WarningDir || 0) === 0) e.laserWarning.target = { x: this.player.x, z: this.player.z };
    if (action.stopWarning) e.laserWarning = undefined;
    if (action.attack) {
      const timeline = nativeEnemyAttackTimeline(e.entityId, id, 0, attackSpeed);
      if (!timeline) throw new Error(`缺少敌人 ${e.entityId} 武器 ${id} 的动画事件`);
      behavior.weaponId = id; behavior.ceaseFire = undefined;
      behavior.attackStart = behavior.enterAt = e.age;
      behavior.holdAt = e.age + timeline.enter;
      behavior.fireHoldAt = e.age + timeline.fireHoldStart;
      behavior.fireAt = e.age + timeline.firstFire;
      behavior.exitAt = e.age + timeline.exitStart;
      const hold = this.queueWeapon(id, 'enemy', e, e.uid, e.attack, e.angle, undefined, undefined, 0, timeline.firstFire);
      if (action.attack.targetAlarmPos) for (const shot of this.shots)
        if (shot.ownerUid === e.uid && shot.weaponId === id) {
          if (shot.alarmAim && shot.alarmAim.lockedDelta === undefined) shot.alarmAim.target = { ...action.attack.targetAlarmPos };
          else if (shot.nativeShapeType === undefined && shot.aimTarget) shot.aimTarget = { ...action.attack.targetAlarmPos };
        }
      behavior.busyUntil = Math.max(e.age + timeline.exitEnd, behavior.fireAt + hold);
      const effectId = Number(this.content.chapter.weapons[id].parameters.AttackAlarmEffect || 0);
      if (effectId && timing.alarmSeconds > 0) for (let i = 0; i < (timing.fireHoldSeconds > 0 ? 2 : 1); i++) {
        const effect = this.effect('muzzle', e.x, e.z, timing.alarmSeconds, 1, undefined, effectId);
        effect.age = -(i === 0 ? timeline.enter : timeline.holdEnd);
        effect.ownerUid = e.uid; this.enemyChargeEffects.set(effect,id);
      }
    }
    let clip = 'Idle', since = e.age;
    if (state.phase === 'attack') {
      const suffix = String(timing.animationId).padStart(2, '0');
      if (e.age < behavior.holdAt!) { clip = `SkillEnter${suffix}`; since = behavior.enterAt!; }
      else if (e.age < behavior.fireHoldAt!) { clip = `SkillHold${suffix}`; since = behavior.holdAt!; }
      else if (e.age < behavior.exitAt!) { clip = `SkillFireHold${suffix}`; since = behavior.fireHoldAt!; }
      else if (e.age < behavior.busyUntil) { clip = `SkillExit${suffix}`; since = behavior.exitAt!; }
    }
    e.animationClip = clip; e.animationTime = Math.max(0, (e.age - since) * attackSpeed);
  }
  /** AIStatusManager's certified sequential tasks. These bosses never fall
   * through to old CommonBoss's concurrent random patrol/attack loop. */
  private advanceSequentialBoss(e: Enemy, behavior: EnemyBehavior, d: RecordData, dt: number, attackSpeed: number) {
    if (!nativeSequentialBossSupported(d) || Number(d.stats.fireInterval || 0) !== 0
      || Number(d.raw.attackPossibility) !== 65536 || !d.raw.rotateWhenAttack?.length
      || d.raw.rotateWhenAttack.some((value: number) => value === 1)
      || (d.weaponIds as number[]).some(id => (this.content.chapter.weapons[id].raw?.WeaponAttr || []).length))
      throw new Error(`敌人 ${e.entityId} 的新版 Boss 参数尚未完整还原`);
    this.bossFollowSlots.retain(uid => this.enemies.some(enemy => enemy.uid === uid && !enemy.dead));
    behavior.bossProgram ??= createNativeBossProgram(d, e, this.cameraBounds(), attackSpeed, () => this.random());
    const state = behavior.bossProgram;
    const targetRadius = nativeShapeRadii(this.content.chapter.entities[this.content.chapter.player.entityId].stats.shape).radius;
    const finished = advanceNativeBossProgram(state, e, this.player.hp > 0 ? this.player : undefined,
      targetRadius, d.stats.speed, dt, this.bossFollowSlots, id => {
        const w = this.content.chapter.weapons[id], timing = nativeEnemyAttackTimings[e.entityId]?.weapons[id];
        const fireHold = w.trajectory === 'LaserRandomPoints' ? nativeRandomLaserFireHold(w.trajectoryParameters || {})
          : w.trajectory === 'LaserRotateByOwner' ? nativeRotatingLaserFireHold(w.trajectoryParameters || {}) : timing?.fireHoldSeconds;
        const timeline = nativeEnemyAttackTimeline(e.entityId, id, 0, attackSpeed, fireHold);
        if (!timeline || !timing) throw new Error(`缺少新版 Boss ${e.entityId} 武器 ${id} 的原生攻击动画事件`);
        behavior.weaponId = id; behavior.ceaseFire = undefined;
        behavior.attackStart = behavior.enterAt = e.age;
        behavior.holdAt = e.age + timeline.enter;
        behavior.fireHoldAt = e.age + timeline.fireHoldStart;
        behavior.fireAt = e.age + timeline.firstFire;
        behavior.exitAt = e.age + timeline.exitStart;
        const hold = this.queueWeapon(id, 'enemy', e, e.uid, e.attack, e.angle, undefined, undefined, 0, timeline.firstFire);
        behavior.busyUntil = Math.max(e.age + timeline.exitEnd, behavior.fireAt + hold);
        const effectId = Number(w.parameters.AttackAlarmEffect || 0);
        if (effectId && timing.alarmSeconds > 0) for (let i = 0; i < ((fireHold || 0) > 0 ? 2 : 1); i++) {
          const effect = this.effect('muzzle', e.x, e.z, timing.alarmSeconds, 1, undefined, effectId);
          effect.age = -(i === 0 ? timeline.enter : timeline.holdEnd); effect.ownerUid = e.uid; this.enemyChargeEffects.set(effect,id);
        }
      }, () => {
        const id = behavior.weaponId;
        if (e.age < behavior.busyUntil || this.shots.some(shot => shot.ownerUid === e.uid && shot.weaponId === id)) return false;
        const liveLasers = this.projectiles.some(bullet => bullet.ownerUid === e.uid && bullet.weaponId === id && bullet.beam && !bullet.dead);
        if (!behavior.ceaseFire) {
          behavior.ceaseFire = createNativeCeaseFire(0, liveLasers);
          return false;
        }
        return advanceNativeCeaseFire(behavior.ceaseFire, dt, !liveLasers);
      });
    let clip = 'Idle', since = e.age;
    if (state.attackPhase === 'attack') {
      const timing = nativeEnemyAttackTimings[e.entityId].weapons[behavior.weaponId];
      const suffix = String(timing.animationId).padStart(2, '0');
      if (e.age < behavior.holdAt!) { clip = `SkillEnter${suffix}`; since = behavior.enterAt!; }
      else if (e.age < behavior.fireHoldAt!) { clip = `SkillHold${suffix}`; since = behavior.holdAt!; }
      else if (e.age < behavior.exitAt!) { clip = `SkillFireHold${suffix}`; since = behavior.fireHoldAt!; }
      else if (e.age < behavior.busyUntil) { clip = `SkillExit${suffix}`; since = behavior.exitAt!; }
    }
    e.animationClip = clip; e.animationTime = Math.max(0, (e.age - since) * attackSpeed);
    // UpdateTask invokes TaskEndAction immediately after its last task; sample
    // the next round now, but execute its first task on the following frame.
    if (finished) behavior.bossProgram = createNativeBossProgram(d, e, this.cameraBounds(), attackSpeed, () => this.random(), state.selectedTarget);
  }
  get cameraPosition(): Readonly<Point> { return this.scrollCamera?.position ?? { x: 0, z: 0 }; }
  get cameraRevision(): number { return this.scrollCamera?.revision ?? 0; }
  get cameraWorldBounds() { return this.cameraBounds(); }
  get playerMovementBounds() {
    const radius = nativeShapeRadii(this.content.chapter.entities[this.content.chapter.player.entityId].stats.shape).radius * this.playerScale;
    return nativePlayerMovementBounds(this.cameraBounds(), radius, Number(this.content.chapter.chapter.id));
  }
  private initialCameraBounds() {
    return { left: -this.content.world.width / 2, right: this.content.world.width / 2, bottom: -this.content.world.height / 2, top: this.content.world.height / 2 };
  }
  private cameraBounds() { return this.scrollCamera?.bounds ?? this.initialCameraBounds(); }
  private blackHolePullHost(enemy: Enemy, source: Projectile): NativeBlackHolePullHost {
    const raw = this.content.chapter.entities[enemy.entityId].raw;
    return { position: () => enemy, source: () => source.dead ? undefined : source, dead: () => enemy.dead, mass: () => Number(raw.mass),
      enemyPullStrengthPercent: () => nativeMonsterAttribute(raw.MonsterAbility, 'AllBlackHolePullStrength%') / 100,
      ownerPullRadiusPercent: () => this.weaponAttributes(source.familyId)['AllBlackHolePullRadius%'] || 0,
      random: () => this.random(), move: position => { enemy.x = position.x; enemy.z = position.z; },
      clamp: position => { const b = this.cameraBounds(); return { x: clamp(position.x, b.left + enemy.radiusX, b.right - enemy.radiusX), z: clamp(position.z, b.bottom + enemy.radiusX, b.top - enemy.radiusX) }; },
      inside: position => this.inCamera(position), sourceAboveTop: (position, radius) => position.z > this.cameraBounds().top + radius,
      disableSourcePull: () => this.disabledBlackHoles.add(source.uid),
    };
  }
  private updateBlackHoles() {
    for (const source of this.projectiles) {
      const mod = source.runtimeMods?.find(mod => mod.type === 'BlackHoleMod')?.parameters;
      if (!mod || source.dead) continue;
      let boundary = this.blackHoleBoundaries.get(source);
      if (!boundary) { boundary = new NativeBlackHoleBoundaryRuntime(); this.blackHoleBoundaries.set(source, boundary); }
      const edge = boundary.update(source, { x: Math.sin(source.angle), z: Math.cos(source.angle) }, source.radiusX, this.cameraBounds());
      if (edge.touch) this.dispatchWeaponEvent(51, source.familyId, { weaponId: source.weaponId, bullet: source, point: edge.touch.position, direction: edge.touch.normal });
      if (edge.dispose) { source.dead = true; continue; }
      const radius = source.radiusX + 1, attr = this.weaponAttributes(source.familyId);
      if (!this.disabledBlackHoles.has(source.uid)) for (const enemy of this.enemies) {
        const raw = this.content.chapter.entities[enemy.entityId].raw;
        if (enemy.dead || enemy.boss || this.blackHolePulls.has(enemy.uid) || !this.enemyBehaviors.has(enemy.uid)
          || nativeMonsterImmuneAttract(raw.MonsterAbility) || nativeMonsterAttribute(raw.MonsterAbility, 'ImmuneControl')) continue;
        if (Math.hypot(enemy.x - source.x, enemy.z - source.z) >= radius * (1 + (attr['AllBlackHolePullRadius%'] || 0))) continue;
        const runtime = new NativeBlackHolePullRuntime({ sourcePosition: source, sourceRadius: source.radiusX, pullRadius: radius,
          pullStrength: Number(mod.PullStrength) * (1 + (attr['BlackHolePullStrength%'] || 0)), pullBackToCenter: Boolean(mod.PullBackToCenter) }, this.blackHolePullHost(enemy, source));
        this.blackHolePulls.set(enemy.uid, { source, runtime });
        // Capture aborts Born and makes the target hittable; release returns
        // to Attack instead of replaying the abandoned birth movement.
        this.enemyBehaviors.get(enemy.uid)!.attackEntered = true;
        this.dispatchWeaponEvent(53, source.familyId, { weaponId: source.weaponId, bullet: source, target: enemy, point: enemy });
      }
      const overlapAction = (this.installedWeaponActions.get(source.familyId) || []).filter(command => command.action === 121);
      const previous = this.blackHoleContacts.get(source.uid) || new Set<number>(), current = new Set<number>();
      if (overlapAction.length) for (const enemyBullet of this.projectiles) {
        if (enemyBullet.owner !== 'enemy' || enemyBullet.dead || Math.hypot(enemyBullet.x - source.x, enemyBullet.z - source.z) > source.radiusX + enemyBullet.radiusX) continue;
        current.add(enemyBullet.uid);
        if (!previous.has(enemyBullet.uid)) for (const action of overlapAction) this.applyBulletAttributes(enemyBullet, this.blackHoleBulletAttrs.enter(enemyBullet.uid, action.args.Attrs));
      }
      for (const uid of previous) if (!current.has(uid)) { const enemyBullet = this.projectiles.find(b => b.uid === uid); if (enemyBullet) this.applyBulletAttributes(enemyBullet, this.blackHoleBulletAttrs.exit(uid)); }
      this.blackHoleContacts.set(source.uid, current);
    }
    for (const [uid, contacts] of this.blackHoleContacts) if (!this.projectiles.some(b => b.uid === uid && !b.dead)) {
      for (const id of contacts) { const bullet = this.projectiles.find(b => b.uid === id); if (bullet) this.applyBulletAttributes(bullet, this.blackHoleBulletAttrs.exit(id)); }
      this.blackHoleContacts.delete(uid);
    }
  }
  private playerWeaponState(entityId = 0) { return entityId === this.content.chapter.player.entityId ? this.heroWeapon : entityId && entityId !== this.content.chapter.player.weaponEntityId ? this.secondary.get(entityId) : this.cannonOwned ? this.cannon : undefined; }
  private resolveNativeWeaponId(weaponId: number, familyId: number) {
    const owner = familyId === this.content.chapter.player.entityId ? 0 : familyId || this.content.chapter.player.weaponEntityId;
    return (this.installedWeaponActions.get(owner) || []).filter(command => command.kind === 'replaceWeapon')
      .reduce((current, command) => current === Number(command.args.SrcWeaponId) ? Number(command.args.DestWeaponId) : current, weaponId);
  }
  private runtimeWeapon(weaponId: number, owner: 'player' | 'enemy', familyId = 0) {
    const base = this.content.chapter.weapons[weaponId];
    if (owner !== 'player' || !base) return base;
    const state = this.playerWeaponState(familyId);
    const extras = [...(this.extraWeaponMods.get(0) || []), ...(this.extraWeaponMods.get(familyId || this.content.chapter.player.weaponEntityId) || [])]
      .filter(item => !item.weaponIds.length || item.weaponIds.includes(weaponId));
    const entityId = familyId || this.content.chapter.player.weaponEntityId;
    const sourceIds = [...(state?.nativeWeaponIds || []), ...(this.content.chapter.entities[entityId]?.weaponIds || [])];
    return nativeRuntimeWeapon(base, state && { ...state, nativeMods: [...(sourceIds.includes(weaponId) ? state.nativeMods || [] : []), ...extras.flatMap(item => item.mods)] });
  }
  private consumeWeaponMods(weaponId: number, familyId = 0) {
    let consumed = false;
    for (const owner of new Set([0, familyId || this.content.chapter.player.weaponEntityId])) {
      const entries = this.extraWeaponMods.get(owner);
      if (!entries) continue;
      const remaining = entries.filter(entry => !entry.once || !entry.weaponIds.includes(weaponId));
      if (remaining.length === entries.length) continue;
      this.extraWeaponMods.set(owner, remaining);
      consumed = true;
    }
    return consumed;
  }
  private weaponAttributes(entityId = 0): Record<string, number> { return this.playerWeaponState(entityId)?.nativeAttributes || {}; }
  private loadoutInstalled(familyId = 0) {
    const id = familyId === this.content.chapter.player.entityId ? 0 : familyId || this.content.chapter.player.weaponEntityId;
    return this.installedWeaponActions.get(id) || [];
  }
  private conditionalAttributes(base: Record<string, number>, familyId = 0, projectile?: Projectile, target?: Enemy) {
    const bounds = this.cameraBounds();
    const groups = nativeConditionalAttributeGroups(this.loadoutInstalled(familyId), {
      weaponId: projectile?.weaponId || 0, targetType: target && Number(this.content.chapter.entities[target.entityId].raw.Type), wave: this.wave, ownerHpRatio: this.player.hp / this.player.maxHp,
      targetHpRatio: target && target.hp / target.maxHp, targetWorldZ: target?.z,
      ownerTargetDistance: target && Math.hypot(target.x - this.player.x, target.z - this.player.z),
      bulletDistance: projectile && this.loadoutBulletMotion.get(projectile)?.distance,
      bulletDeviation: projectile && this.loadoutBulletMotion.get(projectile)?.deviation,
      bulletTraits: projectile?.traits, bulletTargetDistance: projectile && target ? Math.hypot(projectile.x - target.x, projectile.z - target.z) : undefined,
      bulletShapeRadius: projectile?.radiusX, targetShapeRadius: target?.radiusX,
      nearEnemyCount: radius => this.enemies.filter(e => !e.dead && Math.hypot(e.x - this.player.x, e.z - this.player.z) <= radius).length,
      resolveWorldZBand: (min, max) => nativeLoadoutWorldZBand(bounds.bottom, bounds.top, min, max),
    });
    return mergeNativeConditionalAttributeGroups(base, groups, this.content.combat.attributeDefinitions);
  }
  private playerCombatAttributes() { return this.conditionalAttributes(this.effectivePlayerAttributes, this.content.chapter.player.entityId); }
  private loadoutFireCooldown(familyId: number, defaultInterval: number) {
    const attrs = this.conditionalAttributes(this.weaponAttributes(familyId), familyId);
    return Number(attrs.FireCD ?? defaultInterval) * (attrs['FireCDReduce%'] ?? 1) * this.globalCooldown / ((1 + (attrs['AttackSpeed%'] || 0)) || 1);
  }
  private updateLoadoutHpThresholds() {
    for (const [familyId, commands] of this.installedWeaponActions) for (const command of commands) {
      if (command.action !== 139) continue;
      const key = `${familyId}:${command.sourceKey}:139`, state = this.hpThresholds.get(key) || { active: false, triggerCount: 0, lastTriggerTime: -Infinity };
      this.hpThresholds.set(key, state);
      const change = advanceNativeHpThreshold(command.args, state, this.player.hp / this.player.maxHp, this.clock);
      this.specialAttributeSources.set(key, { familyId, attributes: change.attributes });
      for (const buffId of change.buffIds) this.playerStatuses.hit(0, [{ buffId, probability: 1 }], { attack: this.player.attack, familyId, weaponId: 0, timeShieldExtraDuration: this.playerCombatAttributes().TimeShieldExtraDuration || 0 }, () => this.random());
      for (const buffId of change.removeBuffIds) this.playerStatuses.remove(0, buffId);
      if (change.recoverHpFraction > 0) this.healPlayer(this.player.maxHp * change.recoverHpFraction);
    }
  }
  private loadoutDamageAttributes(familyId: number, projectile?: Projectile, target?: Enemy) {
    const base = { ...this.weaponAttributes(familyId) };
    for (const [name, value] of Object.entries(projectile ? this.bulletAttributes.get(projectile) || {} : {})) base[name] = (base[name] || 0) + value;
    const conditional = this.conditionalAttributes(base, familyId, projectile, target);
    return mergeNativeConditionalAttributeGroups(conditional, this.specialWeaponAttributes.groups({ familyId,
      weaponId: projectile?.weaponId || 0, targetHpRatio: target ? target.hp / target.maxHp : undefined,
      isCircularSlash: projectile ? Boolean(this.swords?.circularSlash(projectile.uid)) : false }), this.content.combat.attributeDefinitions);
  }
  private healPlayer(amount: number, sourceKind = 0) {
    const oldHp = this.player.hp;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + nativeLoadoutHealAmount(amount, this.playerCombatAttributes(), sourceKind));
    if (this.player.hp !== oldHp) this.dispatchPlayerEvent(6);
  }
  private getLoadoutSpecials() {
    return this.loadoutSpecials ||= new NativeLoadoutSpecialActions({
      owner: familyId => ({ uid: familyId, rootOwnerUid: 0, x: this.player.x, z: this.player.z, yawDegrees: 0, alive: this.player.hp > 0 }),
      entity: uid => { if (!uid) return { uid: 0, x: this.player.x, z: this.player.z, yawDegrees: 0, alive: this.player.hp > 0 }; const e = this.enemies.find(e => e.uid === uid); return e && { ...e, alive: !e.dead, yawDegrees: e.angle * 180 / Math.PI }; },
      bullets: () => this.projectiles.filter(b => b.owner === 'player').map(b => ({ ...b, rootOwnerUid: 0, alive: !b.dead, yawDegrees: b.angle * 180 / Math.PI })),
      fire: request => this.fireLoadoutSpecial(request), random: () => this.random(),
      hasBuff: (familyId, buffId) => (familyId ? this.weaponStatuses : this.playerStatuses).has(familyId, buffId),
      addBuff: (familyId, buffId) => {
        (familyId ? this.weaponStatuses : this.playerStatuses).hit(familyId, [{ buffId, probability: 1 }], { attack: this.player.attack, familyId, weaponId: 0, timeShieldExtraDuration: this.playerCombatAttributes().TimeShieldExtraDuration || 0 }, () => this.random());
        this.refreshBuffAttributes();
      },
      replaceOwnerAttributeSource: (familyId, sourceKey, attributes) => {
        const normalized: Record<string, number> = {};
        for (const [name, value] of Object.entries(attributes)) { const def = this.content.combat.attributeDefinitions[name]; if (def) normalized[name] = nativeAttributeValue(def, value); }
        this.specialAttributeSources.set(sourceKey, { familyId, attributes: normalized }); this.refreshBuffAttributes();
      },
      replaceTargetAttributeSource: (uid, key, attributes) => { const sources = this.specialTargetAttributes.get(uid) || new Map(); sources.set(key, { ...attributes }); this.specialTargetAttributes.set(uid, sources); },
      replaceWeaponAttributeSource: (familyId, key, ids, attributes, condition) => this.specialWeaponAttributes.replace(familyId, key, ids, attributes, condition),
      replaceSameTargetComboSource: (familyId, key, config) => this.sameTargetCombos.replace(familyId, key, config),
      lightningSector: (familyId, weaponId) => { const w = this.runtimeWeapon(weaponId, 'player', familyId); if (w?.trajectory !== 'SectorSpreadMod') return undefined;
        const params = w.trajectoryParameters || {}, attr = this.conditionalAttributes(this.weaponAttributes(familyId), familyId);
        return { spreadAngle: Number(params.SpreadAngle), maxLength: nativeSectorRadius({ spreadRadius: Number(params.SpreadRadius),
          shotgunRadius: attr.ShotgunRadius, allShotgunRadius: attr.AllShotgunRadius, shotgunRadiusPercent: attr['ShotgunRadius%'], allShotgunRadiusPercent: attr['AllShotgunRadius%'] }) }; },
      replaceMissileBoostSource: (_familyId, _key, config) => { if (config) this.specialMissileBoost.configure(config.everyFireCount, config.extraCount, config.attributes); else this.specialMissileBoost.clear(); },
      replaceCircularSlashSource: (_familyId, _key, config) => { this.circularSlashConfig = config; this.swords?.setCircularSlashConfig(config); },
      supportsSymmetricLaser: true,
      enemies: () => this.enemies.filter(e => this.enemyChooseable(e)).map(e => ({ ...e, alive: !e.dead, yawDegrees: e.angle * 180 / Math.PI })),
      orbit: () => { const balls = this.orbit?.balls || [], first = balls[0] && this.projectiles.find(b => b.uid === balls[0].uid); return { totalBallCount: balls.length, currentScale: first?.scale || 0 }; },
      flySword: {
        waitCount: (_familyId, type, weaponId) => type === 1 ? this.getHeroMissiles().getWaitCountByWeaponID(weaponId) : type === 2 ? this.getHeroMissiles().totalWaitCount : 0,
        createOne: (_familyId, weaponId, ignoreLimit) => { this.getHeroMissiles().setClock(this.clock); this.getHeroMissiles().createStored(weaponId, ignoreLimit); },
      },
    });
  }
  private fireLoadoutSpecial(request: LoadoutSpecialFire) {
    const familyId = request.familyId || this.content.chapter.player.entityId;
    const angle = request.targetPosition ? Math.atan2(request.targetPosition.x - request.position.x, request.targetPosition.z - request.position.z) : request.yawDegrees * Math.PI / 180;
    const first = this.shots.length;
    this.queueWeapon(request.weaponId, 'player', request.position, 0, this.player.attack, angle, undefined, 0, familyId);
    for (const shot of this.shots.slice(first)) {
      shot.anchor = undefined; shot.localAnchor = false; shot.origin = { ...request.position }; shot.flags = request.bulletFlag ?? 0x88; shot.fireEvent = false;
      if (request.targetPosition) shot.fixedFire = true;
      (shot as Shot & { scaleOverride?: number }).scaleOverride = request.scaleOverride;
      if (request.trajectoryOverride) {
        const weapon = this.runtimeWeapon(request.weaponId, 'player', familyId);
        shot.weaponOverride = { ...weapon, trajectory: request.trajectoryOverride.name,
          trajectoryParameters: { ...weapon.trajectoryParameters, ...request.trajectoryOverride } };
      }
    }
  }
  private playMissileRelease(b: Projectile) {
    if(b.dead||this.player.hp<=0||this.releasedMissileAudio.has(b))return;
    this.releasedMissileAudio.add(b);this.sounds.push(-17);
  }
  activeEnemyCharges() {
    if(this.phase!=='playing'||this.player.hp<=0)return [];
    const result: {key:string;token:string;volume:number}[]=[];
    for(const e of this.enemies){
      if(e.dead||e.hp<=0)continue;
      if(e.laserWarning&&e.age<e.laserWarning.until){
        result.push({key:'pathogenic:laserCharge',token:`warning:${e.uid}:${e.laserWarning.until}`,volume:.06});continue;
      }
      for(const fx of this.effects){
        const id=this.enemyChargeEffects.get(fx);
        if(!id||fx.ownerUid!==e.uid||fx.age<0||fx.age>=fx.duration)continue;
        if(!this.shots.some(s=>s.owner==='enemy'&&s.ownerUid===e.uid&&s.weaponId===id))continue;
        const laser=originalIsLaserTrajectory(this.content.chapter.weapons[id]?.trajectory||'');
        result.push({key:laser?'pathogenic:laserCharge':'pathogenic:charge',token:`alarm:${fx.uid}`,volume:.055});
      }
    }
    return result;
  }
  private getHeroMissiles() {
    return this.heroMissiles ||= new NativeMissileRuntime({
      familyEntityId: this.content.chapter.player.entityId,
      owner: () => ({ ...this.player, yawDegrees: 0 }),
      emit: (weaponId, origin, yaw, options) => { const b = this.emitPlayerWeapon(weaponId, options.familyEntityId, origin, yaw * Math.PI / 180, undefined, 0x88, true); b.held = b.collisionDisabled = options.held; return b.uid; },
      get: uid => { const b = this.projectiles.find(b => b.uid === uid && !b.dead); return b && { position: b, yawDegrees: b.angle * 180 / Math.PI, rotateSpeed: b.follow }; },
      pose: (uid, p, yaw) => { const b = this.projectiles.find(b => b.uid === uid); if (b) { const speed = Math.hypot(b.vx, b.vz); b.x = p.x; b.z = p.z; b.angle = yaw * Math.PI / 180; b.vx = Math.sin(b.angle) * speed; b.vz = Math.cos(b.angle) * speed; } },
      hold: (uid, held) => { const b = this.projectiles.find(b => b.uid === uid); if (b) b.held = b.collisionDisabled = held; },
      dead: uid => !this.projectiles.some(b => b.uid === uid && !b.dead), kill: uid => { const b = this.projectiles.find(b => b.uid === uid); if (b) b.dead = true; },
      selectForwardTarget: range => { const choices = this.enemies.filter(e => this.enemyChooseable(e) && e.z >= this.player.z && Math.hypot(e.x - this.player.x, e.z - this.player.z) < range), target = choices[Math.floor(this.random() * choices.length)]; return target && { uid: target.uid, position: target }; },
      target: (uid, targetUid) => { const b = this.projectiles.find(b => b.uid === uid); if (b) b.targetUid = targetUid; },
      targetPosition: uid => this.enemies.find(e => e.uid === uid && !e.dead), random: () => this.random(),
      launched: uid => { const b = this.projectiles.find(b => b.uid === uid); if (b) { b.age = 0; this.playMissileRelease(b); this.dispatchPlayerEvent(17, { weaponId: b.weaponId, bullet: b, point: b }); } },
      mergeAttributes: (uid, attributes) => { const b = this.projectiles.find(b => b.uid === uid); if (b) this.applyBulletAttributes(b, { ...attributes }); },
    });
  }
  private getDropMissiles() {
    return this.dropMissiles ||= new NativeDropMissileRuntime({
      familyEntityId: this.content.chapter.player.entityId,
      owner: () => ({ ...this.player, yawDegrees: 0 }),
      emit: (weaponId, origin, yaw, options) => {
        const b = this.emitPlayerWeapon(weaponId, options.familyEntityId, origin, yaw * Math.PI / 180, undefined, 0x6c8, true);
        b.held = b.collisionDisabled = true;
        return b.uid;
      },
      get: uid => { const b = this.projectiles.find(b => b.uid === uid && !b.dead); return b && { position: b, yawDegrees: b.angle * 180 / Math.PI, rotateSpeed: Number(this.content.chapter.bullets[b.bulletId].parameters.RotateSpeed || 0) }; },
      pose: (uid, p, yaw) => { const b = this.projectiles.find(b => b.uid === uid); if (b) { const speed = Math.hypot(b.vx, b.vz); b.x = b.oldX = p.x; b.z = b.oldZ = p.z; b.angle = yaw * Math.PI / 180; b.vx = Math.sin(b.angle) * speed; b.vz = Math.cos(b.angle) * speed; } },
      hold: (uid, held) => { const b = this.projectiles.find(b => b.uid === uid); if (b) b.held = b.collisionDisabled = held; },
      dead: uid => !this.projectiles.some(b => b.uid === uid && !b.dead),
      kill: uid => { const b = this.projectiles.find(b => b.uid === uid); if (b) b.dead = true; },
      selectForwardTarget: range => { const choices = this.enemies.filter(e => this.enemyChooseable(e) && e.z >= this.player.z && Math.hypot(e.x - this.player.x, e.z - this.player.z) < range), target = choices[Math.floor(this.random() * choices.length)]; return target && { uid: target.uid, position: target }; },
      target: (uid, targetUid) => { const b = this.projectiles.find(b => b.uid === uid); if (b) b.targetUid = targetUid; },
      targetPosition: uid => this.enemies.find(e => e.uid === uid && !e.dead),
      random: () => this.random(),
      // Default DropItemMissile only enables the existing projectile, not WeaponFire.
      launched: uid => { const b = this.projectiles.find(b => b.uid === uid); if (b) { b.age = 0; this.playMissileRelease(b); } },
    });
  }
  private getPlaneSpecials() {
    return this.planeSpecials ||= new NativePlaneSpecialActions({
      owner: () => ({ uid: 0, alive: this.player.hp > 0, ...this.player, yawDegrees: 0, hpMax: this.player.maxHp }),
      addBuff: (_familyId, buffId) => { this.playerStatuses.hit(0, [{ buffId, probability: 1 }], { attack: this.player.attack, familyId: this.content.chapter.player.entityId, weaponId: 0, timeShieldExtraDuration: this.playerCombatAttributes().TimeShieldExtraDuration || 0 }, () => this.random()); this.refreshBuffAttributes(); },
      removeBuff: (_familyId, buffId) => { this.playerStatuses.remove(0, buffId); this.refreshBuffAttributes(); },
      setUnrealState: (_familyId, active) => { this.inUnreal = active; },
      dispatchUnrealEvent: (_familyId, type) => this.dispatchPlayerEvent(type, { point: this.player }),
      replaceBuffIds: (_familyId, source, destination) => { if (destination) this.buffReplacements.set(source, destination); else this.buffReplacements.delete(source); },
      resolveBuffId: (_familyId, id) => this.buffReplacements.get(id) || id,
      heal: (_familyId, amount, kind) => this.healPlayer(amount, kind),
      bullet: uid => { const b = this.projectiles.find(b => b.uid === uid); return b && { ...b, alive: !b.dead, yawDegrees: b.angle * 180 / Math.PI, flags: b.flags || 0, shapeOffsetZ: b.offsetZ }; },
      fireWeapon: request => this.fireLoadoutSpecial({ ...request, bulletFlag: request.flags }),
      addBulletMods: (uid, _key, mods) => { const b = this.projectiles.find(b => b.uid === uid); if (!b) return; for (const mod of mods) { b.runtimeMods = [...(b.runtimeMods || []), { type: mod.name, parameters: mod.parameters }]; if (mod.name === 'BuffMod') { b.hitBuffs.push({ buffId: mod.parameters.BuffId, probability: mod.parameters.Rate ?? 1 }); b.flags = (b.flags || 0) | 0x200000; } } },
      entityAlive: uid => this.enemies.some(e => e.uid === uid && !e.dead),
      progressiveDamageBucketInstalled: true,
    });
  }
  private getHawkMissiles() {
    return this.hawkMissiles ||= new NativeHawkMissileRuntime({
      familyEntityId: this.content.chapter.player.entityId,
      owner: () => ({ ...this.player, yawDegrees: 0, alive: this.player.hp > 0 }),
      modification: id => this.specialWeaponChanges.get(id),
      emit: (id, origin, yaw, options) => { const b = this.emitPlayerWeapon(id, options.familyEntityId, origin, yaw * Math.PI / 180, undefined, options.flags, true); b.held = b.collisionDisabled = true; this.dispatchPlayerEvent(17, { weaponId: b.weaponId, bullet: b, point: b }); return b.uid; },
      get: uid => { const b = this.projectiles.find(b => b.uid === uid && !b.dead); return b && { position: b, yawDegrees: b.angle * 180 / Math.PI, rotateSpeed: Number(this.content.chapter.bullets[b.bulletId]?.parameters.RotateSpeed || 0) }; },
      pose: (uid, p, yaw) => { const b = this.projectiles.find(b => b.uid === uid); if (b) { const speed = Math.hypot(b.vx, b.vz); b.x = p.x; b.z = p.z; b.angle = yaw * Math.PI / 180; b.vx = Math.sin(b.angle) * speed; b.vz = Math.cos(b.angle) * speed; } },
      dead: uid => !this.projectiles.some(b => b.uid === uid && !b.dead),
      kill: uid => { const b = this.projectiles.find(b => b.uid === uid); if (b) b.dead = true; },
      release: uid => { const b = this.projectiles.find(b => b.uid === uid); if (b) { b.held = b.collisionDisabled = false; b.age = 0; this.playMissileRelease(b); } },
      selectForwardTarget: range => { const choices = this.enemies.filter(e => this.enemyChooseable(e) && e.z >= this.player.z && Math.hypot(e.x - this.player.x, e.z - this.player.z) < range), target = choices[Math.floor(this.random() * choices.length)]; return target && { uid: target.uid, position: target }; },
      target: (uid, targetUid) => { const b = this.projectiles.find(b => b.uid === uid); if (b) b.targetUid = targetUid; },
      targetPosition: uid => this.enemies.find(e => e.uid === uid && !e.dead), random: () => this.random(),
    });
  }
  private installLoadoutProgram(snapshot: NativeWeaponSkillSnapshot, familyId: number) {
    const occurrences = new Map<string, number>();
    for (const trigger of snapshot.triggers) {
      const base = `${snapshot.entityId}:${trigger.skillId}:${trigger.id}`, occurrence = occurrences.get(base) || 0; occurrences.set(base, occurrence + 1);
      for (const action of trigger.actions) {
        const command = { action: action.type, args: action.args, sourceKey: `${base}:${occurrence}:action:${action.type}` };
        this.getLoadoutSpecials().install(command, familyId); this.getPlaneSpecials().install(command, familyId, this.clock);
        if (command.action === 162) this.getHawkMissiles().install(command.sourceKey, command.args, this.clock);
      }
    }
  }
  private applyKillMilestoneBuff(buffId: number) {
    this.playerStatuses.hit(0, [{ buffId, probability: 1 }],
      { attack: this.player.attack, familyId: this.content.chapter.player.entityId, weaponId: 0 }, () => this.random());
    this.refreshBuffAttributes();
  }
  private refreshBuffAttributes() {
    const defs = this.content.combat.attributeDefinitions;
    const playerAttributes = { ...this.basePlayerAttributes };
    const merge = (attrs: Record<string, number>, entry: { name: string; value: number }) => {
      const def = defs[entry.name]; if (!def) throw new Error(`Missing buff attribute ${entry.name}`);
      attrs[entry.name] = mergeNativeAttribute(attrs[entry.name] ?? (def.mergeType ? 1 : 0), nativeAttributeValue(def, entry.value), def.mergeType);
    };
    const inherited = this.playerStatuses.attributeEntries(0);
    for (const entry of inherited) merge(playerAttributes, entry);
    for (const source of this.specialAttributeSources.values()) if (!source.familyId || source.familyId === this.content.chapter.player.entityId)
      Object.assign(playerAttributes, mergeNativeConditionalAttributeGroups(playerAttributes, [source], defs));
    this.effectivePlayerAttributes = playerAttributes;
    const loadout = this.content.combat.studyLoadout;
    const flatHp = loadout?.contributions?.reduce((sum: number, source: { attributes: Record<string, number> }) => sum + (source.attributes.HPMax || 0), 0);
    // Normal loadouts retain their explicit pre-percentage HPMax. An existing
    // debug override only exposes final HP, so preserve that preset fallback.
    const nativeFlatHp = flatHp !== undefined && loadout.hp === Math.max(1, flatHp * (1 + (loadout.attributes?.['HPMax%'] || 0) / 100)) ? flatHp : undefined;
    const maxHp = nativeEquipmentMaxHp(this.content.chapter.player.hp,
      loadout?.runtimeAttributes?.['HPMax%'] || 0,
      playerAttributes.HPMax || 0, playerAttributes['HPMax%'] || 0, nativeFlatHp);
    if (maxHp !== this.player.maxHp) {
      // EntityCharacter.OnCharacterHpMaxUpdate adds the maximum's delta to
      // current HP, then clamps; this is not Heal and has no heal multiplier.
      this.player.hp = clamp(this.player.hp + maxHp - this.player.maxHp, 0, maxHp);
      this.player.maxHp = maxHp;
    }
    const heroAttributes: Record<string, number> = {};
    for (const [name, definition] of Object.entries(defs) as [string, any][]) heroAttributes[name] = nativeAttributeValue(definition, definition.defaultValue);
    for (const [name, value] of Object.entries(playerAttributes)) heroAttributes[name] = value;
    applyNativeWeaponAttributes(this.heroWeapon, heroAttributes);
    this.player.attack = this.content.chapter.player.attack * (1 + (playerAttributes['Attack%'] || 0));
    this.globalCooldown = playerAttributes['AllFireCDReduce%'] ?? 1;
    for (const [id, snapshot] of this.weaponSnapshots) {
      if (!this.playerWeaponState(id)) continue;
      const attrs = { ...snapshot.attributes };
      for (const entry of inherited) if (defs[entry.name].InheritFromPlayer === 1) merge(attrs, entry);
      for (const entry of this.weaponStatuses.attributeEntries(id)) merge(attrs, entry);
      for (const source of this.specialAttributeSources.values()) if (source.familyId === id || !source.familyId) {
        const attributes = Object.fromEntries(Object.entries(source.attributes).filter(([name]) => source.familyId === id || defs[name]?.InheritFromPlayer === 1));
        Object.assign(attrs, mergeNativeConditionalAttributeGroups(attrs, [{ attributes }], defs));
      }
      applyNativeWeaponAttributes(this.playerWeaponState(id)!, attrs);
    }
    if (this.secondary.has(200141)) {
      const settings = this.orbitSettings();
      this.orbitSpeedAttributes.observe(nativeOrbitSpeed(settings.angularSpeed, settings.angularSpeedPercent));
      const state = this.playerWeaponState(200141)!;
      const attrs = { ...state.nativeAttributes };
      const snapshot = this.weaponSnapshots.get(200141);
      for (const command of this.installedWeaponActions.get(200141) || []) {
        if (command.action !== 122 || !snapshot?.activeSkillIds.includes(command.skillId)) continue;
        for (const [name, value] of Object.entries(this.orbitSpeedAttributes.attributes(command.args))) {
          const definition = defs[name];
          attrs[name] = mergeNativeAttribute(attrs[name] ?? (definition.mergeType ? 1 : 0), value, definition.mergeType);
        }
      }
      applyNativeWeaponAttributes(state, attrs);
      this.orbit?.refreshAttributes(this.orbitSettings());
    }
  }
  private setLaserCannonState(owner: number, state: 0 | 1) {
    const entity = this.content.combat.entities[owner];
    if (Number(entity?.Type) !== 12 || Number(entity?.SecondWeapenType) !== 11) return;
    if ((this.laserCannonStates.get(owner) ?? 1) === state) return;
    this.laserCannonStates.set(owner, state);
    if (this.player.hp <= 0) return;
    for (const source of this.laserFireBuffs.get(owner)?.values() || []) {
      if (state === 0 && !source.applied) {
        for (const buffId of source.buffIds) this.playerStatuses.hit(0, [{ buffId, probability: 1 }],
          { attack: this.player.attack, familyId: this.content.chapter.player.entityId, weaponId: 0 }, () => this.random());
        source.applied = true;
      } else if (state === 1 && source.applied) {
        for (const buffId of source.buffIds) this.playerStatuses.remove(0, buffId);
        source.applied = false;
      }
    }
    this.refreshBuffAttributes();
  }
  private undoLaserFireBuff(owner: number, sourceKey?: string) {
    const sources = this.laserFireBuffs.get(owner);
    if (!sources) return;
    for (const [key, source] of sources) {
      if (sourceKey !== undefined && key !== sourceKey) continue;
      if (source.applied && this.player.hp > 0) for (const buffId of source.buffIds) this.playerStatuses.remove(0, buffId);
      sources.delete(key);
    }
    if (!sources.size) this.laserFireBuffs.delete(owner);
    this.refreshBuffAttributes();
  }
  private enemyBuffAttributes(enemy: Enemy): Record<string, number> {
    const raw = this.content.chapter.entities[enemy.entityId].raw, defs = this.content.combat.attributeDefinitions;
    const attrs: Record<string, number> = {};
    const names = new Set(['ArmorBreakBuffRateResist%', 'ArmorBreakBuffTimeResist%', 'NegativeBuffRate%']);
    const entries = (raw.attributes || []).map((expression: string) => {
      const [name, value] = expression.split('='); return { name, value: Number(value) };
    });
    for (const name of names) entries.push({ name, value: nativeMonsterAttribute(raw.MonsterAbility, name,
      { entityType: raw.Type, chapterFeatureIds: this.content.chapter.chapter.parameters.ChapterMonsterFeature || [] }) });
    entries.push(...this.statuses.attributeEntries(enemy.uid), ...this.statuses.triggerAttributeEntries(enemy.uid));
    for (const entry of entries) {
      const def = defs[entry.name];
      if (!names.has(entry.name) || !def || !Number.isFinite(entry.value)) continue;
      attrs[entry.name] = mergeNativeAttribute(attrs[entry.name] ?? (def.mergeType ? 1 : 0), nativeAttributeValue(def, entry.value), def.mergeType);
    }
    return attrs;
  }
  private inCamera(point: Point, radius = 0) { const b = this.cameraBounds(); return point.x >= b.left - radius && point.x <= b.right + radius && point.z >= b.bottom - radius && point.z <= b.top + radius; }
  private enemySelectionState(enemy: Enemy) {
    if (enemy.dead) return 6;
    const behavior = this.enemyBehaviors.get(enemy.uid);
    if (!behavior?.attackEntered && enemy.age <= (behavior?.entryDuration || 0)) return 1;
    if (this.blackHolePulls.has(enemy.uid)) return 9;
    // All active states (Idle/Alert/Attack/Dizzy/FirstIdle) are eligible for
    // sword selection. Behavior subtasks do not imply a different main state.
    return 2;
  }
  private enemyChooseable(enemy: Enemy) { return !enemy.dead && (!enemy.boss || this.enemySelectionState(enemy) !== 1) && this.inCamera(enemy); }
  private installWeaponAction(familyId: number, command: NativeWeaponActionCommand) {
    const commands = this.installedWeaponActions.get(familyId) || [];
    if (!commands.some(item => item.sourceKey === command.sourceKey && item.action === command.action)) commands.push(command);
    this.installedWeaponActions.set(familyId, commands);
    const key = `loadout:${familyId}:${command.sourceKey}:${command.action}`;
    if (this.appliedInstalledActions.has(key)) return;
    this.appliedInstalledActions.add(key);
    if (command.action === 96) for (const update of nativeSkillWeaponAttackUpdates(command.args)) this.specialWeaponDamage.set(update.weaponId, (this.specialWeaponDamage.get(update.weaponId) || 0) + update.addition);
    if (command.action === 156) this.specialWeaponChanges.set(Number(command.args.WeaponId), nativeAnyWeaponBulletModification(command.args));
  }
  private applyBulletAttributes(bullet: Projectile, delta: Record<string, number>, incrementalScale = false) {
    const attrs = this.bulletAttributes.get(bullet) || {};
    if (incrementalScale && delta['BulletScale%']) {
      const scale = this.incrementalBulletScales.get(bullet) || { attribute: 0, factor: 1 };
      scale.attribute += delta['BulletScale%'];
      scale.factor = Math.floor(scale.factor * (1 + delta['BulletScale%']) * 65536) / 65536;
      this.incrementalBulletScales.set(bullet, scale);
    }
    for (const [name, value] of Object.entries(delta)) attrs[name] = (attrs[name] || 0) + value;
    this.bulletAttributes.set(bullet, attrs);
    this.refreshLiveProjectile(bullet);
  }
  private refreshLiveProjectile(bullet: Projectile) {
    const base = this.bulletBase.get(bullet);
    if (!base) return;
    const attrs = this.bulletAttributes.get(bullet) || {}, current = bullet.owner === 'player' ? this.weaponAttributes(bullet.familyId) : base.attributes;
    const merged = (name: string) => (current[name] || 0) + (attrs[name] || 0);
    const fraction = (name: string) => (1 + merged(name)) / (1 + (base.attributes[name] || 0));
    bullet.damage = base.damage * (1 + (attrs['Attack%'] || 0) / (1 + (base.attributes['Attack%'] || 0))) * fraction('BulletAttack%') * fraction('SkillUpgradeAttack%') * fraction('WeaponDamageAdd%')
      * (bullet.owner === 'player' && bullet.attackSnapshot ? this.player.attack / bullet.attackSnapshot : 1);
    const incrementalScale = this.incrementalBulletScales.get(bullet);
    // Scale is fixed at birth unless an explicit controller/action reshapes it.
    // Action106 keeps an attribute total AND a separate multiplicative shape.
    const scale = (1 + (attrs['BulletScale%'] || 0) - (incrementalScale?.attribute || 0)) * (incrementalScale?.factor ?? 1);
    if (!bullet.scaleAnimation && (bullet.familyId !== 200141 || !bullet.held)) bullet.scale = base.scale * scale;
    if (!bullet.scaleAnimation && !(bullet.familyId === 200141 && bullet.held) && !(bullet.familyId === 200101 && bullet.trajectory === 'SemiCircleMov2Mod')) {
      bullet.radiusX = base.radiusOverride ?? base.radiusX * scale * fraction('LaserThickness%'); bullet.radiusZ = base.radiusOverride ?? base.radiusZ * scale;
      bullet.offsetZ = base.radiusOverride === undefined ? Number(this.content.chapter.bullets[bullet.bulletId].parameters.ShapeOffset?.[1] || 0) * bullet.scale : 0;
    }
    // Ordinary frenzy buffs affect the emitting owner; keep AllBulletSpeed at
    // birth unless an explicit bullet-attribute action changes this projectile.
    const allSpeed = (base.attributes['AllBulletSpeed%'] || 0) + (attrs['AllBulletSpeed%'] || 0);
    const speedFactor = (1 + merged('BulletSpeed%') + allSpeed) / (1 + (base.attributes['BulletSpeed%'] || 0) + (base.attributes['AllBulletSpeed%'] || 0)), previousSpeedFactor = this.bulletSpeedFactors.get(bullet) ?? 1;
    if (speedFactor !== previousSpeedFactor) { const ratio = previousSpeedFactor ? speedFactor / previousSpeedFactor : 0; bullet.vx *= ratio; bullet.vz *= ratio; this.bulletSpeedFactors.set(bullet, speedFactor); }
    bullet.critChance = ((bullet.flags || 0) & 4096) ? merged('ExplodeAttackCrit%') : this.content.chapter.player.critRate + merged('CritRate%');
    bullet.critMultiplier = 1.5 + entryWeaponAttribute(this.content.combat, 'CritValue%') / 100 + merged('CritValue%');
  }
  private updateProjectileScaleAnimation(bullet: Projectile) {
    const animation = bullet.scaleAnimation;
    if (!animation || bullet.age < animation.wait) return;
    const t = animation.duration > 0 ? clamp((bullet.age - animation.wait) / animation.duration, 0, 1) : 1;
    const attrs = bullet.owner === 'player' ? this.weaponAttributes(bullet.familyId) : {};
    const scale = nativeScaleAnimationScale({ StartScale: animation.start, TargetScale: animation.target }, t, bullet.flags || 0, attrs,
      Number(this.content.chapter.entities[bullet.familyId || this.content.chapter.player.weaponEntityId]?.raw.SecondWeapenType || 0));
    const source = this.content.chapter.bullets[bullet.bulletId].parameters, base = this.bulletBase.get(bullet);
    bullet.scale = scale;
    bullet.radiusX = base?.radiusOverride ?? Number(source.Shape[0] || 0) * scale * (1 + (attrs['LaserThickness%'] || 0));
    bullet.radiusZ = base?.radiusOverride ?? Number(bullet.beam ? source.Shape[0] : source.Shape[1] ?? source.Shape[0]) * scale;
    bullet.offsetZ = base?.radiusOverride === undefined ? Number(source.ShapeOffset?.[1] || 0) * scale : 0;
  }
  private addProjectileTraits(bullet: Projectile, traits: number) {
    const oldTraits = bullet.traits || 0, newTraits = oldTraits | traits;
    if (oldTraits === newTraits) return;
    bullet.traits = newTraits;
    // Enemy traits must never inherit this browser's player equipment bonuses.
    if (bullet.owner !== 'player') return;
    const attr = this.weaponAttributes(bullet.familyId), data = this.content.chapter.bullets[bullet.bulletId].parameters;
    const bonus = (mask: number) => nativeElementAndTraitDamageBonus(name => entryWeaponAttribute(this.content.combat, name) + (attr[name] || 0) * 100, data.Element, mask);
    const ratio = (1 + bonus(newTraits)) / (1 + bonus(oldTraits));
    bullet.damage *= ratio;
    const base = this.bulletBase.get(bullet); if (base) base.damage *= ratio;
  }
  private updateDynamicBulletAttributes(bullet: Projectile) {
    const installed = this.installedWeaponActions.get(bullet.familyId || this.content.chapter.player.weaponEntityId) || [];
    const values = nativeInstalledAttributeContributions(installed.filter(c => c.action === 117), { weaponId: bullet.weaponId, hpPercent: this.player.maxHp ? this.player.hp / this.player.maxHp : 0 });
    const previous = this.dynamicBulletAttributes.get(bullet) || {}, delta: Record<string, number> = {};
    for (const name of new Set([...Object.keys(values), ...Object.keys(previous)])) delta[name] = (values[name] || 0) - (previous[name] || 0);
    if (Object.values(delta).some(value => value !== 0)) this.applyBulletAttributes(bullet, delta);
    this.dynamicBulletAttributes.set(bullet, values);
    this.refreshLiveProjectile(bullet);
  }
  private applyNativeWeaponAction(familyId: number, command: NativeWeaponActionCommand) {
    const { args, event } = command;
    const fireFamilyId = event.passiveOwner ? this.content.chapter.player.entityId : familyId;
    const state = this.playerWeaponState(fireFamilyId);
    if (command.action === 173) {
      const entity = this.content.combat.entities[fireFamilyId];
      if (Number(entity?.Type) !== 12 || Number(entity?.SecondWeapenType) !== 11) return;
      let sources = this.laserFireBuffs.get(fireFamilyId);
      if (!sources) { sources = new Map(); this.laserFireBuffs.set(fireFamilyId, sources); }
      let source = sources.get(command.sourceKey);
      if (!source) {
        source = { buffIds: [...args.FireBuffIds], applied: false, skillId: command.skillId, triggerId: command.triggerId };
        sources.set(command.sourceKey, source);
      }
      if (this.player.hp > 0 && (this.laserCannonStates.get(fireFamilyId) ?? 1) === 0 && !source.applied) {
        for (const buffId of source.buffIds) this.playerStatuses.hit(0, [{ buffId, probability: 1 }],
          { attack: this.player.attack, familyId: this.content.chapter.player.entityId, weaponId: 0 }, () => this.random());
        source.applied = true;
        this.refreshBuffAttributes();
      }
      return;
    }
    // Player-owned equipment/plane skills exist without a machine cannon.
    // Only commands that modify an actual weapon require a weapon state.
    if (!state && !event.passiveOwner) throw new Error(`Native action ${command.action}: missing owner ${familyId}`);
    const bullet = event.bullet as Projectile | undefined, target = event.target as Enemy | undefined;
    const loadoutCommand = { action: command.action, args, sourceKey: `${command.sourceKey}:action:${command.action}` };
    const fire = (weaponId: number, origin: Point, angle = 0, targetUid?: number, flags = 0) => this.emitPlayerWeapon(weaponId, fireFamilyId, origin, angle, targetUid, flags | (weaponId === 101407 ? 0x80 : 0x88));
    switch (command.kind) {
      case 'install': this.installWeaponAction(familyId, command); return;
      case 'changeWeapon': if (state) state.nativeWeaponIds = [Number(args.WeaponId)]; return;
      case 'replaceWeapon':
        if (state) state.nativeWeaponIds = (state.nativeWeaponIds || []).map(id => id === args.SrcWeaponId ? args.DestWeaponId : id);
        this.installWeaponAction(familyId, command); return;
      case 'weaponMods': {
        const weaponIds = args.WeaponIds?.length ? args.WeaponIds : event.weaponId ? [event.weaponId] : [];
        if (!weaponIds.length) return;
        const extras = this.extraWeaponMods.get(familyId) || [];
        for (const mod of args.mods) extras.push({ weaponIds, mods: [{ name: mod.name, args: mod.args }], once: mod.once });
        this.extraWeaponMods.set(familyId, extras);
        if (!args.IgnoreNotifyExistingBullets) for (const b of this.projectiles) if (b.owner === 'player' && !b.dead && (!familyId || b.familyId === familyId) && weaponIds.includes(b.weaponId))
          for (const mod of args.mods) {
            b.runtimeMods = [...(b.runtimeMods || []), { type: mod.name, parameters: mod.args }];
            if (mod.name === 'BuffMod') { b.hitBuffs.push({ buffId: mod.args.BuffId, probability: mod.args.Rate ?? 1, forceAdd: Boolean(mod.args.ForceAdd) }); b.flags = (b.flags || 0) | 0x200000; }
            if (mod.name === 'KillBulletMod') this.installProjectileKillBullet(b, mod.args);
          }
        return;
      }
      case 'addBulletMod':
        if (bullet) {
          bullet.runtimeMods = [...(bullet.runtimeMods || []), { type: args.mod.name, parameters: args.mod.args }];
          if (args.mod.name === 'ExplosionMod') this.addExplosionRuntime(bullet, args.mod.args);
          if (args.mod.name === 'BuffMod') { bullet.hitBuffs.push({ buffId: args.mod.args.BuffId, probability: args.mod.args.Rate ?? 1 }); bullet.flags = (bullet.flags || 0) | 0x200000; }
          if (args.mod.name === 'KillBulletMod') this.installProjectileKillBullet(bullet, args.mod.args);
        }
        return;
      case 'bulletAttributes':
        if (bullet) this.applyBulletAttributes(bullet, Object.fromEntries(args.changes.map((change: RecordData) => [change.name, change.delta])), true);
        return;
      case 'heal': {
        const attrs = this.playerCombatAttributes(), rate = Number(args.Rate || 0) * (1 + (attrs['AddHpTriggerRate%'] || 0));
        if (rate > 0 && this.random() >= rate) return;
        const percent = Number(args.Percent || 0) * (1 + (attrs['CurveSwordKillBullet2AddHp%'] || 0));
        let amount = Number(args.BaseAttr) === 2 ? Number(args.FixedHp || 0) : (Number(args.BaseAttr || 0) === 1 ? this.player.attack : this.player.maxHp) * percent;
        if (Number(args.LimitType) === 1) {
          const used = this.healLimits.get(command.sourceKey) || 0, max = this.content.chapter.player.hp * Number(args.RecoverInitMaxHPScale || 0);
          amount = Math.max(0, Math.min(amount, max - used)); this.healLimits.set(command.sourceKey, used + amount);
        }
        this.healPlayer(amount, 23); return;
      }
      case 'buff': {
        const type = Number(args.TargetType), playerSelf = type === 0 && Boolean(event.passiveOwner), uid = type === 1 ? target?.uid : type === 0 && !playerSelf ? familyId : 0;
        if (uid !== undefined) this.applyStatusPulses((type === 0 && !playerSelf ? this.weaponStatuses : type === 1 ? this.statuses : this.playerStatuses).hit(uid, [{ buffId: this.buffReplacements.get(Number(args.BuffId)) || Number(args.BuffId), probability: 1 }], { attack: this.player.attack, familyId, weaponId: Number(event.weaponId || 0), timeShieldExtraDuration: this.weaponAttributes(fireFamilyId).TimeShieldExtraDuration || 0 }, () => this.random()));
        this.refreshBuffAttributes();
        return;
      }
      case 'cloud': {
        const bounds = this.cameraBounds();
        fire(Number(args.WeaponId), { x: bounds.left + this.random() * (bounds.right - bounds.left), z: bounds.top - Number(args.topInset) }); return;
      }
      case 'fire': {
        const bounds = this.cameraBounds();
        let origin: Point = this.player;
        if (args.FirePosType === 1) origin = event.point || bullet || target || this.player;
        else if (args.FirePosType === 3 && target) origin = target;
        else if (args.FirePosType === 4 && event.attackerPoint) origin = event.attackerPoint;
        else if (args.FirePosType === 5) origin = this.enemies.filter(e => !e.dead && e.hp > 0 && this.inCamera(e))[Math.floor(this.random() * this.enemies.filter(e => !e.dead && e.hp > 0 && this.inCamera(e)).length)] || this.player;
        else if ([0, 6, 7].includes(Number(args.FirePosType || 0))) origin = { x: bounds.left + this.random() * (bounds.right - bounds.left), z: args.FirePosType === 7 ? bounds.top : bounds.bottom + this.random() * (bounds.top - bounds.bottom) };
        const angle = args.FireDirType === 5 ? Math.PI : args.FireDirType === 3 && target ? Math.atan2(target.x - origin.x, target.z - origin.z) : 0;
        // A fire action uses the configured weapon pattern (salvos/mods), not a
        // single synthetic projectile. Explicit positions never use hull mounts.
        const start = this.shots.length;
        this.queueWeapon(Number(args.WeaponId), 'player', origin, 0, this.player.attack, angle, undefined, 0, fireFamilyId, 0, 0, undefined, undefined, target?.uid);
        for (const shot of this.shots.slice(start)) { shot.origin = { ...origin }; shot.anchor = undefined; shot.localAnchor = false; shot.flags = Number(args.BulletFlag || 0) | (shot.weaponId === 101407 ? 0x80 : 0x88); shot.fireEvent = false; }
        return;
      }
      case 'targetExplosion':
        if (bullet && target) {
          const radius = this.resolveBulletExplosion(bullet, args).radius;
          this.fireNativeExplosion(familyId, { weaponId: args.WeaponId, origin: target, yawDegrees: 0, flags: 0, bulletTrait: 2048, radiusOverride: radius, fireEffectScale: radius, kind: 'explosion' });
        }
        return;
      case 'specialist': break;
      default: throw new Error(`Native weapon action kind ${command.kind}`);
    }
    if (command.action === 237) {
      // TriggerActionForceDropHp@6b4b440 -> CreateHp(1,true): force a
      // repair pickup above the camera, even when normal drop caps are full.
      const origin = { x: -3 + this.random() * 6, z: this.cameraBounds().top + 3 + this.random() * 2 };
      this.dropItems(origin, 1, 'heart', healthPickupFraction(this.content.assets.battleItems[1].parameter), 1);
      return;
    }
    if (command.action === 39) {
      this.getDropMissiles().configure(Number(args.MissileWeaponId || 0), Number(args.Count || 0)); return;
    }
    if (command.action === 40) { this.getDropMissiles().collect(); return; }
    if (command.action === 95) {
      if (event.targetUid !== undefined) (event.buffTarget === 'player' ? this.playerStatuses : event.buffTarget === 'weapon' ? this.weaponStatuses : this.statuses).updateTimes(event.targetUid, args);
      return;
    }
    if (command.action === 1) {
      const raw = this.content.assets.battleItems[Number(args.DropItem)];
      const item = raw && nativeLoadoutDropItem(raw, 'raw-fp');
      if (!item) throw new Error(`Native drop action requires Item_battle ${args.DropItem}`);
      const plan = nativeLoadoutDropPlan(args, item, this.cameraBounds(), () => this.random());
      if (!plan) throw new Error(`Unverified native drop position ${args.DropPosType}`);
      const limit = 1 + (this.playerCombatAttributes().MapBuffCount || 0);
      if (!this.loadoutDropCounts.canCreate(item.itemId, limit)) return;
      const uid = this.serial++, point = plan.position;
      this.pickups.push({ uid, itemId: item.itemId, modelId: item.modelId, kind: item.dropType === 3 ? 'buff' : 'trigger', value: 1,
        x: point.x, z: point.z, age: 0, delay: 0, attracted: false, state: 'stay', stateTime: 0, speed: 0,
        origin: { ...point }, destination: { ...point }, retreatDistance: 0, retreatDuration: 0 });
      this.loadoutDrops.set(uid, item); this.loadoutDropCounts.created(item.itemId);
      if (raw.dropSoundId) this.sounds.push(Number(raw.dropSoundId));
      return;
    }
    if (command.action === 199) {
      const buffId = Number(args.BuffId);
      const owner = nativeHighestStarSecondWeapon(this.secondWeaponOrder.filter(id => Boolean(this.playerWeaponState(id))),
        this.content.combat.entities, this.content.combat.skillRows, this.skillHistory());
      const previous = this.maxStarWeaponBuffs.get(command.sourceKey);
      if (previous?.owner === owner && previous?.buffId === buffId) return;
      if (previous) this.weaponStatuses.remove(previous.owner, previous.buffId);
      this.maxStarWeaponBuffs.delete(command.sourceKey);
      if (owner !== undefined) {
        this.weaponStatuses.hit(owner, [{ buffId, probability: 1, forceAdd: true }],
          { attack: this.player.attack, familyId: this.content.chapter.player.entityId, weaponId: 0 }, () => this.random());
        this.maxStarWeaponBuffs.set(command.sourceKey, { owner, buffId, skillId: command.skillId, triggerId: command.triggerId });
      }
      this.refreshBuffAttributes();
      return;
    }
    if (command.action === 209) {
      if (!event.passiveOwner) throw new Error('Native kill milestone buff requires the hero owner');
      if (this.player.hp > 0) this.killMilestoneBuffs.execute(command.sourceKey,
        Number(args.KillCountMilestone), Number(args.BuffId), this.nativeKillCount, id => this.applyKillMilestoneBuff(id));
      return;
    }
    if (command.action === 211) {
      this.nextFireBoost.execute(event.passiveOwner ? 0 : familyId, args, state?.nativeWeaponIds?.[0]); return;
    }
    this.loadoutCooldowns ||= new NativeLoadoutCooldownActions({
      resetCeaseFireCooldown: owner => {
        // EntityCharacter.ResetCeaseFireTimer@6be1404 only accepts an active
        // CeaseFire state. AI-only missile/sword storage and orbit have none.
        if (!this.activeWeaponCease.has(owner)) return;
        if (owner === this.content.chapter.player.weaponEntityId && this.cannonOwned) {
          this.player.fireAt = this.clock; this.cooldownResetAttack.reset(owner);
        } else {
          const weapon = this.secondary.get(owner);
          if (weapon && !weapon.waitingForBeams) { weapon.at = this.clock; this.cooldownResetAttack.reset(owner); }
        }
      },
      reduceTriggerCooldownByAction: (owner, action, seconds) => (owner ? this.weaponPrograms.get(owner) : this.playerSkillProgram)?.reduceCooldownByAction(action, seconds),
      reduceFireCooldown: (_owner, reduction) => {
        // The replica's follower deadline represents its current wait task,
        // not two independent character and AI timers. Reduce it once.
        if (reduction.groups.includes(-3)) {
          if (this.cannonOwned && this.player.fireAt > this.clock && this.clock >= (this.followerCeaseStarts.get(this.content.chapter.player.weaponEntityId) || 0)) this.player.fireAt = nativeFollowerCooldownDeadline(this.player.fireAt, this.clock, reduction.percent, reduction.seconds);
          for (const [id, weapon] of this.secondary) if (!weapon.waitingForBeams && weapon.at > this.clock && this.clock >= (this.followerCeaseStarts.get(id) || 0)) weapon.at = nativeFollowerCooldownDeadline(weapon.at, this.clock, reduction.percent, reduction.seconds);
        }
      },
    });
    if (this.loadoutCooldowns.execute(loadoutCommand, event.passiveOwner ? 0 : familyId)) return;
    if (this.getPlaneSpecials().execute(loadoutCommand, familyId, this.clock, { bulletUid: bullet?.uid, targetUid: target?.uid, attackerUid: event.attackerUid as number | undefined, point: event.point, isCrit: event.type === 16 })) return;
    if (this.getLoadoutSpecials().execute(loadoutCommand, familyId, this.clock, { sourceEntityUid: event.type === 4 ? target?.uid : undefined, attackerUid: event.attackerUid as number | undefined,
      targetUid: target?.uid, weaponId: event.weaponId, flashChain: event.type === 41 || event.type === 43 ? { position: event.point || target || this.player, finalHit: Boolean(event.final) } : undefined })) return;
    switch (command.action) {
      case 154:
        if (!this.periodicSpecials.has(command.sourceKey)) this.periodicSpecials.set(command.sourceKey, { familyId, command, nextAt: this.clock });
        return;
      case 162: this.getHawkMissiles().execute(loadoutCommand.sourceKey, args, this.clock); return;
      case 186: fire(Number(args.WeaponId), this.player); return;
      case 82: case 85: case 63: case 125: case 121:
        this.installWeaponAction(familyId, command); return;
      case 62: {
        const shot = nativeSwordCompletionShot(this.player, event.point || target || this.player);
        const replacements = this.installedWeaponActions.get(familyId) || [];
        const weaponId = replacements.filter(c => c.kind === 'replaceWeapon' && c.args.SrcWeaponId === args.WeaponId).reduce((id, c) => Number(c.args.DestWeaponId), Number(args.WeaponId));
        fire(weaponId, shot.origin, shot.yawDegrees * Math.PI / 180); return;
      }
      case 90:
        this.voidSlashes ??= new NativeVoidSlashRuntime({ random: () => this.random(), fire: (weaponId, origin, yawDegrees, flags) => { fire(weaponId, origin, yawDegrees * Math.PI / 180, undefined, flags); } });
        this.voidSlashes.trigger(event.point || target || this.player, args as any, this.weaponAttributes(familyId).XuKongZhanCount || 0);
        return;
      case 115: this.swords?.createFromPickup(this.clock, args.Rates, args.CD); return;
      case 88:
        for (const split of nativeSplitMissilePlan({ origin: event.point || bullet || target || this.player, weaponId: args.WeaponId, count: args.Count, bulletTrait: args.BulletTrait,
          bulletTraitSplitCount: this.weaponAttributes(familyId).BulletTraitSplitCount || 0, availableEnemies: this.enemies.filter(e => !e.dead && this.inCamera(e)) })) {
          const child = fire(split.weaponId, split.origin, split.yawDegrees * Math.PI / 180, undefined, split.flags);
          this.addProjectileTraits(child, Number(args.BulletTrait || 0));
        }
        return;
      case 91: {
        const origin = { ...this.player };
        const candidates = this.enemies.filter(e => !e.dead && this.inCamera(e) && Math.hypot(e.x - origin.x, e.z - origin.z) < Number(args.Range));
        for (let index = 0; index < Number(args.WeaponCount); index++) this.timedWeaponActions.push({ at: this.clock + index * Number(args.FireInterval), run: () => {
          const live = candidates.filter(e => !e.dead); if (!live.length) return;
          const chosen = live[Math.floor(this.random() * live.length)]; candidates.splice(candidates.indexOf(chosen), 1);
          fire(args.WeaponId, this.player, Math.atan2(chosen.x - this.player.x, chosen.z - this.player.z), chosen.uid, 0x88);
        } });
        return;
      }
      case 120:
        if (target) {
          const plan = nativeBlackHoleTransportPlan({ position: target, radius: target.radiusX, camera: this.cameraBounds(), dead: target.dead, elite: target.elite, boss: target.boss,
            immuneControl: Boolean(nativeMonsterAttribute(this.content.chapter.entities[target.entityId].raw.MonsterAbility, 'ImmuneControl')), borderTypes: args.borderTypes, buffIds: args.buffIds, random: () => this.random() });
          if (plan?.position && !this.statuses.modifiers(target.uid).immobile) this.setEnemyPositionImmediately(target, plan.position);
          if (plan) this.applyStatusPulses(this.statuses.hit(target.uid, plan.buffIds.map(buffId => ({ buffId, probability: 1 })), { attack: this.player.attack, familyId, weaponId: Number(event.weaponId || 0), timeShieldExtraDuration: this.weaponAttributes(fireFamilyId).TimeShieldExtraDuration || 0 }, () => this.random()));
        }
        return;
      case 127:
        if (bullet) for (const split of nativeBlackHoleSplitPlan(bullet, event.direction as Point || { x: -Math.sin(bullet.angle), z: -Math.cos(bullet.angle) }, args.Angle)) fire(args.WeaponId, split.origin, split.yawDegrees * Math.PI / 180, undefined, bullet.flags);
        return;
      case 169: {
        // TriggerActionBulletFission.OnExecute requires both the hit bullet and
        // target. OnHit@6b1e100..2f8 applies owner probability/count bonuses.
        if (!bullet || !target) return;
        const attrs = this.weaponAttributes(familyId);
        const probability = Math.floor(Number(args.Prob) * (1 + (attrs['ImproveBulletFission%'] || 0)) * 65536) / 65536;
        if (Math.floor(this.random() * 65536) / 65536 > probability) return;
        const trait = Number(args.BulletTrait || 0);
        const count = Number(args.Count) + Math.floor(attrs.ImproveBulletFissionCount || 0)
          + (trait & 16 ? Math.floor(attrs.BulletTraitSplitCount || 0) : 0);
        const origin = event.point || target;
        for (let i = 0; i < count; i++) {
          // CalcAngle uses configured Count, NOT the count after bonuses.
          // CreateWeaponAndFire@6b1e49c supplies 0x6c8 for these children.
          const child = fire(args.WeaponID, origin, bullet.angle + (i - (Number(args.Count) - 1) / 2) * Number(args.PerAngle) * Math.PI / 180, undefined, 0x6c8);
          this.addProjectileTraits(child, trait);
        }
        return;
      }
      case 184:
        this.orbit?.fireOnOwnerHurt(scale => {
          const child = fire(args.WeaponId, this.player, 0);
          if (scale !== undefined) {
            const ratio = scale / child.scale; child.radiusX *= ratio; child.radiusZ *= ratio; child.scale = scale;
            const base = this.bulletBase.get(child); if (base) { base.scale = scale; base.radiusX = child.radiusX; base.radiusZ = child.radiusZ; }
          }
        }, Boolean(args.IsSyncBallScale));
        return;
      case 212: {
        const segments = nativeNearbyRaySegments({ uid: 0, camp: 1, x: this.player.x, z: this.player.z }, { hitPosition: event.point, targetUid: target?.uid, position: bullet },
          this.enemies.map(e => ({ uid: e.uid, x: e.x, z: e.z, camp: 2, alive: !e.dead, inCamera: this.inCamera(e) })), Number(args.Range), Number(args.MaxTargets));
        for (const segment of segments) { const child = fire(args.WeaponId, segment.start, segment.yawDegrees * Math.PI / 180, segment.targetUid, segment.extraFlags); child.fixedSegments = child.beam = true; child.pierce = Infinity; child.radiusX = child.scale * Number(this.content.chapter.bullets[child.bulletId].parameters.Shape[0]); child.segments = [{ from: segment.start, to: segment.end }]; }
        return;
      }
      case 253:
        this.ensureRayChasers();
        for (const source of [...this.projectiles]) if (!source.dead && args.SourceWeaponIds.includes(source.weaponId) && this.rayPaths.get(source.uid)?.length) {
          const child = fire(args.WeaponId, this.player, 0, undefined, 0);
          child.beam = child.ray = false; child.held = child.collisionDisabled = true;
          child.radiusZ = this.content.chapter.bullets[child.bulletId].parameters.Shape[1] * child.scale;
          this.rayChasers!.attach(child.uid, source.uid);
        }
        return;
      case 175: {
        if (Number(args.TriggerType) !== 1) throw new Error(`Unverified native range-buff target ${args.TriggerType}`);
        if (!bullet || bullet.dead || this.content.chapter.bullets[bullet.bulletId]?.parameters.Type !== 1 || Number(args.RandomCount) < 1) return;
        const probability = Number(args.Prob || 0);
        if (probability <= 0 || probability < 1 && this.random() >= probability) return;
        const candidates = this.enemies.filter(enemy => !enemy.dead && enemy.hp > 0 && this.inCamera(enemy) && Math.hypot(enemy.x - bullet.x, enemy.z - bullet.z) <= bullet.radiusX);
        const count = Number(args.RandomCount), selected: Enemy[] = [];
        if (candidates.length <= count) selected.push(...candidates);
        else for (let index = 0; index < count; index++) {
          const maximum = count - 1 - index;
          selected.push(...candidates.splice(maximum > 0 ? Math.floor(this.random() * maximum) : 0, 1));
        }
        for (const enemy of selected) this.applyStatusPulses(this.statuses.hit(enemy.uid, (args.BuffIds || []).map((buffId: number) => ({ buffId, probability: 1 })), { attack: this.player.attack, familyId: fireFamilyId, weaponId: Number(event.weaponId || 0) }, () => this.random()));
        return;
      }
      case 190: this.pendingBulletAttributes.execute(fireFamilyId || this.content.chapter.player.weaponEntityId, command.sourceKey, args); return;
      case 108: {
        const owner = familyId || this.content.chapter.player.weaponEntityId;
        if (!state || !this.activeWeaponCease.has(owner)) return;
        const percent = nativeFixedFromString(String(args.reducePercent || 0)), seconds = nativeFixedFromString(String(args.reduceTime || 0));
        if (percent === undefined || seconds === undefined) throw new Error('Invalid native cease-fire reduction');
        if (owner === this.content.chapter.player.weaponEntityId) this.player.fireAt = nativeCharacterCooldownDeadline(this.player.fireAt, this.clock, percent, seconds);
        else state.at = nativeCharacterCooldownDeadline(state.at, this.clock, percent, seconds);
        return;
      }
      case 170:
        for (const buffId of args.CDBuffIds || []) this.playerStatuses.hit(0, [{ buffId, probability: 1, duration: (state?.nativeAttributes?.FireCD ?? 0) * (state?.nativeAttributes?.['FireCDReduce%'] ?? 1) * this.globalCooldown }], { attack: this.player.attack, familyId, weaponId: Number(event.weaponId || 0), timeShieldExtraDuration: this.weaponAttributes(fireFamilyId).TimeShieldExtraDuration || 0 }, () => this.random());
        return;
      case 111:
        this.fireNativeLightning(command, familyId); return;
      default: throw new Error(`Native weapon action ${command.action} has no host`);
    }
  }
  private resolveBulletExplosion(bullet: Projectile, params: RecordData): RecordData {
    const attr = this.weaponAttributes(bullet.familyId);
    return { weaponId: Number(params.WeaponId), radius: nativeExplosionRadius({ explodeRadius: Number(params.ExplodeRadius || 0), bulletFlags: bullet.flags,
      mainWeaponExplosionRadius: attr.MainWeaponExplosionMod_ExplodeRadius, explodeRadiusPercent: attr['ExplodeRadius%'], allMissileExplodeRadiusPercent: attr['AllMissileExplodeRadius%'], allSkillRangePercent: attr['AllSkillRange%'], bulletTraitAreaScalePercent: attr['BulletTraitAreaScale%'] }),
      onCrit: Boolean(params.TriggerOnCrit), onTargetPosition: Boolean(params.ExplodeOnTargetPosOnCrit), onDeath: Boolean(params.TriggerOnDeath), consecutiveCount: Number(params.ConsecutiveExplosionCount || 0), consecutiveInterval: Number(params.ConsecutiveExplosionInterval || 0) };
  }
  private addExplosionRuntime(bullet: Projectile, params: RecordData) {
    const runtime = new NativeExplosionRuntime(params as any), list = this.explosions.get(bullet) || [];
    list.push(runtime); this.explosions.set(bullet, list); bullet.flags = (bullet.flags || 0) | runtime.sourceInitFlags;
  }
  private fireNativeExplosion(familyId: number, plan: NativeExplosionFire) {
    const bullet = this.emitPlayerWeapon(plan.weaponId, familyId, plan.origin, 0, undefined, plan.flags | 0x88);
    const source = this.content.chapter.bullets[bullet.bulletId].parameters, attr = this.weaponAttributes(familyId);
    const oldBonus = nativeElementAndTraitDamageBonus(name => entryWeaponAttribute(this.content.combat, name) + (attr[name] || 0) * 100, source.Element, bullet.traits);
    bullet.traits = (bullet.traits || 0) | plan.bulletTrait;
    const newBonus = nativeElementAndTraitDamageBonus(name => entryWeaponAttribute(this.content.combat, name) + (attr[name] || 0) * 100, source.Element, bullet.traits);
    bullet.damage *= (1 + newBonus) / (1 + oldBonus);
    if (plan.radiusOverride !== undefined) { bullet.radiusX = bullet.radiusZ = plan.radiusOverride; bullet.box = false; bullet.offsetX = bullet.offsetZ = 0; }
    if ((bullet.flags || 0) & 4096) bullet.critChance = attr['ExplodeAttackCrit%'] || 0;
    const base = this.bulletBase.get(bullet); if (base) { base.damage = bullet.damage; base.radiusX = bullet.radiusX; base.radiusZ = bullet.radiusZ; base.radiusOverride = plan.radiusOverride; }
  }
  private explosionSequenceHost(familyId: number): NativeExplosionSequenceHost {
    return { now: () => this.clock, ownerExists: () => Boolean(this.playerWeaponState(familyId)), ownerDead: () => this.player.hp <= 0,
      ownerAttrs: () => this.weaponAttributes(familyId), isPosInMapSky: point => this.inCamera(point), fire: plan => this.fireNativeExplosion(familyId, plan) };
  }
  private dispatchExplosionEvent(bullet: Projectile, event: NativeExplosionEvent) {
    const host: NativeExplosionHost = { ...this.explosionSequenceHost(bullet.familyId), random: () => this.random(), sourcePosition: () => bullet,
      sourceFlags: () => bullet.flags || 0, disabled: () => Boolean(bullet.runtimeMods?.some(mod => mod.type === 'DisableExplosionMod')),
      fireOnExplosionWeaponId: () => Number(bullet.runtimeMods?.find(mod => mod.type === 'FireOnExplosionMod')?.parameters.WeaponId || 0),
      schedule: sequence => this.explosionSequences.push({ familyId: bullet.familyId, sequence }) };
    for (const runtime of this.explosions.get(bullet) || []) runtime.onEvent(event, host);
  }
  private derivedSource(bullet: Projectile) {
    return { position: bullet, yawDegrees: bullet.angle * 180 / Math.PI, weaponId: bullet.weaponId, flags: bullet.flags || 0,
      ownerExists: Boolean(this.playerWeaponState(bullet.familyId)), ownerDead: this.player.hp <= 0 };
  }
  private fireDerivedWeapon(familyId: number, plan: NativeDerivedWeaponFire) {
    let override: RecordData | undefined;
    if (plan.copyOwnerWeaponMods) {
      const sourceWeaponId = this.playerWeaponState(familyId)?.nativeWeaponIds?.[0];
      const source = sourceWeaponId && this.runtimeWeapon(sourceWeaponId, 'player', familyId);
      if (source) {
        const inherited = source.mods.filter((mod: RecordData) => !plan.excludeOwnerModTypes?.includes(mod.type));
        // CopyModInfo@6e3a1c0 clears the destination before cloning the source.
        // Adding its table mods again would duplicate default bursts/piercing.
        override = nativeRuntimeWeapon({ ...this.content.chapter.weapons[plan.weaponId], mods: inherited }, { ...newWeapon(0), nativeMods: [] });
      }
    }
    const start = this.shots.length;
    this.queueWeapon(plan.weaponId, 'player', plan.origin, 0, this.player.attack, plan.yawDegrees * Math.PI / 180, undefined, 0, familyId, 0, 0, override);
    const children = this.shots.splice(start);
    for (const shot of children) {
      shot.origin = { ...plan.origin }; shot.anchor = undefined; shot.localAnchor = false;
      shot.flags = plan.flags | (plan.weaponId === 101407 ? 0x80 : 0x88); shot.extraTraits = plan.bulletTrait; shot.fireEvent = false;
      if (shot.at <= this.clock) this.emitProjectile(shot); else this.shots.push(shot);
    }
  }
  private ejectHost(bullet: Projectile): NativeEjectHost {
    const target = (enemy: Enemy) => ({ uid: enemy.uid, x: enemy.x, z: enemy.z, dead: enemy.dead, noEject: nativeMonsterAttribute(this.content.chapter.entities[enemy.entityId].raw.MonsterAbility, 'ImmuneBulletEject') > 0, hitCamp: 2 });
    return { position: () => bullet, random: () => this.random(), disabled: () => Boolean(bullet.runtimeMods?.some(mod => mod.type === 'DisableEjectMod')),
      ownerAttributes: () => this.weaponAttributes(bullet.familyId), hitCampMask: () => Number(this.content.chapter.bullets[bullet.bulletId].parameters.HitCamp?.reduce((mask: number, camp: number) => mask | camp, 0) || 2),
      target: uid => { const enemy = this.enemies.find(e => e.uid === uid); return enemy && target(enemy); },
      targetsInCamera: () => [{ uid: 0, x: this.player.x, z: this.player.z, hitCamp: 1 }, ...this.enemies.filter(e => this.inCamera(e)).map(target)],
    };
  }
  private applyEjectOutcome(bullet: Projectile, result: NativeEjectOutcome) {
    if (result.kind !== 'turn' && result.kind !== 'dead') return;
    bullet.damage *= result.damageScaleRatio;
    const base = this.bulletBase.get(bullet); if (base) base.damage *= result.damageScaleRatio;
    if (result.firstSpeedAttributeDelta) this.applyBulletAttributes(bullet, { 'BulletSpeed%': result.firstSpeedAttributeDelta });
    bullet.flags = (bullet.flags || 0) | result.addFlags; bullet.ricochet = result.remainingCount;
    if (result.kind === 'dead') { bullet.dead = true; return; }
    this.actualEjectCounts.set(bullet, (this.actualEjectCounts.get(bullet) || 0) + 1);
    bullet.x = result.position.x; bullet.z = result.position.z; bullet.targetUid = result.targetUid;
    bullet.angle = result.yawRadians!;
    const speed = Math.hypot(bullet.vx, bullet.vz); bullet.vx = Math.sin(bullet.angle) * speed; bullet.vz = Math.cos(bullet.angle) * speed;
  }
  private installProjectileKillBullet(bullet: Projectile, params: RecordData, followOwner = false) {
    const current = this.killBullets.get(bullet);
    const mask = current?.hitCampMask ?? this.content.chapter.bullets[bullet.bulletId].parameters.HitCamp.reduce((sum: number, camp: number) => sum | camp, 0);
    const install = followOwner ? nativeInstallFollowOwnerKillBullet(params, bullet.flags || 0, mask, current?.runtime.remainingCount)
      : nativeInstallKillBulletMod(params, bullet.flags || 0, mask);
    bullet.flags = install.flags;
    if (current) { current.runtime.install(install.rate, install.count); current.hitCampMask = install.hitCampMask; }
    else this.killBullets.set(bullet, { runtime: new NativeKillBulletRuntime(install.rate, install.count), hitCampMask: install.hitCampMask });
  }
  private erasePlayerBulletsWithEnemyOrbit(source: Projectile) {
    if (source.owner !== 'enemy' || source.weaponId !== 70053 || !(source.flags! & 32)) return;
    let eraser = this.killBullets.get(source);
    if (!eraser) {
      eraser = { runtime: new NativeKillBulletRuntime(1, 0), hitCampMask: 16 };
      this.killBullets.set(source, eraser);
    }
    for (const target of this.projectiles) {
      if (target.owner !== 'player' || target.dead || sweep({ ...source, oldX: source.x, oldZ: source.z }, target) === null) continue;
      const result = eraser.runtime.contact({
        uid: source.uid, weaponId: source.weaponId, ownerUid: source.ownerUid!,
        dead: source.dead, hitCampMask: 16,
      }, { uid: target.uid, dead: target.dead, bulletTrait: target.traits || 0, hitCamp: 16 }, rate => this.random() < rate);
      // Enemy followers have no player weapon programs. Do not route their
      // counters/events into the player's upgrade/kill-bullet event pipeline.
      for (const command of result.commands)
        if (command.kind === 'die' && command.targetUid === target.uid) target.dead = true;
    }
  }
  private killEnemyBullets(source: Projectile, deathExplosionRadius?: number) {
    const eraser = this.killBullets.get(source);
    if (!eraser) return;
    let erased = false;
    const dx = Math.sin(source.angle), dz = Math.cos(source.angle), ox = (source.offsetX || 0) * Math.cos(source.angle), oz = -(source.offsetX || 0) * Math.sin(source.angle);
    for (const target of this.projectiles) {
      if (source.dead && deathExplosionRadius === undefined) break;
      if (target.owner !== 'enemy' || target.dead) continue;
      const shape = { ...source, x: source.x + dx * source.offsetZ + ox, z: source.z + dz * source.offsetZ + oz,
        oldX: source.oldX + dx * source.offsetZ + ox, oldZ: source.oldZ + dz * source.offsetZ + oz };
      const overlaps = deathExplosionRadius !== undefined
        ? sweep({ ...source, oldX: source.x, oldZ: source.z, box: false, radiusX: deathExplosionRadius,
          radiusZ: deathExplosionRadius }, { ...target, oldX: target.x, oldZ: target.z }) !== null
        : this.arcLinks.has(source) ? source.segments.some(segment => {
        const mid = { x: (segment.from.x + segment.to.x) / 2, z: (segment.from.z + segment.to.z) / 2 };
        return sweep({ ...shape, ...mid, oldX: mid.x, oldZ: mid.z, box: true,
          radiusZ: Math.hypot(segment.to.x - segment.from.x, segment.to.z - segment.from.z) / 2,
          angle: Math.atan2(segment.to.x - segment.from.x, segment.to.z - segment.from.z) }, target) !== null;
      }) : sweep({ ...shape, oldX: shape.x, oldZ: shape.z }, target) !== null;
      if (!overlaps) continue;
      const result = eraser.runtime.contact({ uid: source.uid, weaponId: source.weaponId, ownerUid: source.familyId, dead: deathExplosionRadius === undefined && source.dead, hitCampMask: eraser.hitCampMask },
        { uid: target.uid, dead: target.dead, bulletTrait: target.traits || 0, hitCamp: 16 }, rate => this.random() < rate);
      for (const command of result.commands) {
        if (command.kind === 'die') { const bullet = command.targetUid === source.uid ? source : target; if(bullet===target&&!target.dead)erased=true; bullet.dead = true; }
        else if (command.kind === 'incrementOwnerKillBulletCount') {
          const owner = source.familyId || this.content.chapter.player.weaponEntityId;
          for (const id of [source.weaponId, 0]) { const key = `${owner}:${id}`; this.killBulletCounts.set(key, (this.killBulletCounts.get(key) || 0) + 1); }
        } else if (command.kind === 'trigger' && command.event === 28) {
          const owner = source.familyId || this.content.chapter.player.weaponEntityId;
          this.dispatchWeaponEvent(28, source.familyId, { weaponId: source.weaponId, bullet: source, point: target,
            killCount: this.killBulletCounts.get(`${owner}:${source.weaponId}`) || 0, killBulletTotalCount: this.killBulletCounts.get(`${owner}:0`) || 0 });
        }
      }
    }
    if (erased) this.sounds.push(-14);
  }
  private fireNativeLightning(command: NativeWeaponActionCommand, familyId: number) {
    const bullet = command.event.bullet as Projectile | undefined;
    if (!bullet) return;
    const effects = this.flashSplashes.get(bullet) || [];
    effects.push(new NativeFlashSplashRuntime(command.args as any)); this.flashSplashes.set(bullet, effects);
    bullet.flags = (bullet.flags || 0) | NativeFlashSplashRuntime.sourceBulletFlag;
  }
  private ensureRayChasers() {
    this.rayChasers ??= new NativeRayChaserRuntime({
      alive: uid => this.projectiles.some(b => b.uid === uid && !b.dead),
      path: uid => this.projectiles.some(b => b.uid === uid && !b.dead) ? this.rayPaths.get(uid) || [] : [],
      target: uid => this.enemies.find(e => e.uid === uid && !e.dead),
      position: uid => this.projectiles.find(b => b.uid === uid)!,
      speed: uid => { const b = this.projectiles.find(b => b.uid === uid)!; return Math.hypot(b.vx, b.vz); },
      pose: (uid, position, yaw) => { const b = this.projectiles.find(b => b.uid === uid)!; b.x = position.x; b.z = position.z; if (yaw !== undefined) b.angle = yaw * Math.PI / 180; },
      hit: (uid, targetUid) => { const b = this.projectiles.find(b => b.uid === uid)!; b.collisionDisabled = false; this.forcedProjectileTargets.set(uid, targetUid); this.collisions(b); this.forcedProjectileTargets.delete(uid); b.collisionDisabled = true; },
      kill: uid => { const b = this.projectiles.find(b => b.uid === uid); if (b) b.dead = true; },
    });
  }
  private refreshNativeWeaponSkills() {
    for (const owner of this.laserFireBuffs.keys()) if (!this.playerWeaponState(owner)) {
      this.undoLaserFireBuff(owner); this.laserCannonStates.delete(owner);
    }
    const combat = this.content.combat, history = this.skillHistory();
    const inherited = compileNativePassiveAttributes(combat as any, history, true, combat.studyLoadout?.battleSkillIds || []);
    const passives = compileNativePassiveAttributes(combat as any, history, false, combat.studyLoadout?.battleSkillIds || []);
    // Study attack/HP are already resolved by the prebattle calculator. Only
    // other globals join the runtime, using native normalized attribute units.
    for (const [name, value] of Object.entries(combat.studyLoadout?.runtimeAttributes || {}) as [string, number][]) {
      if (['Attack', 'HPMax', 'Attack%', 'HPMax%'].includes(name)) continue;
      const definition = combat.attributeDefinitions[name];
      if (!definition) continue;
      const combine = (target: Record<string, number>) => {
        target[name] = definition.mergeType ? (target[name] ?? 1) * value : (target[name] ?? 0) + value;
      };
      combine(passives);
      if (definition.InheritFromPlayer === 1) combine(inherited);
    }
    this.basePlayerAttributes = passives;
    this.globalAttackBonus = passives['Attack%'] || 0;
    this.player.attack = this.content.chapter.player.attack * (1 + this.globalAttackBonus);
    this.globalCooldown = passives['AllFireCDReduce%'] ?? 1;
    this.globalCrit = this.globalCritDamage = 0;
    // Each snapshot carries inherited values. No second global multiplication
    // may reapply BulletScale/crit/range on top of the same merged attributes.
    this.inheritedBulletScale = this.inheritedSkillRange = this.inheritedOrbitSpeed = 0;
    for (const family of Object.values(combat.families) as RecordData[]) {
      const state = this.playerWeaponState(family.entityId);
      if (!state) continue;
      const snapshot = compileNativeWeaponSkills(combat as any, history, family.id);
      for (const [name, value] of Object.entries(inherited)) {
        const definition = combat.attributeDefinitions[name];
        // Inherited percentage-reduction values are already merged factors.
        snapshot.attributes[name] = definition.mergeType === 2 || definition.mergeType === 1
          ? (snapshot.attributes[name] ?? 1) * value : (snapshot.attributes[name] ?? 0) + value;
      }
      applyNativeWeaponAttributes(state, snapshot.attributes);
      state.nativeMods = snapshot.mods;
      state.nativeWeaponIds ??= [...combat.entities[family.entityId].WeaponID];
      this.weaponSnapshots.set(family.entityId, snapshot);
      for (const [key, source] of this.laserFireBuffs.get(family.entityId) || []) {
        if (!snapshot.triggers.some(trigger => trigger.skillId === source.skillId && trigger.id === source.triggerId)) this.undoLaserFireBuff(family.entityId, key);
      }
      this.installLoadoutProgram(snapshot, family.entityId);
      let program = this.weaponPrograms.get(family.entityId);
      if (!program) { program = new NativeWeaponSkillRuntime(); this.weaponPrograms.set(family.entityId, program); }
      for (const command of program.sync(snapshot, this.clock, () => this.random(), { ownerPoint: { x: this.player.x, z: this.player.z } }))
        this.applyNativeWeaponAction(family.entityId, command);
    }
    const playerSnapshot = compileNativePlayerSkills(combat as any, history, this.content.chapter.player.entityId, combat.studyLoadout?.battleSkillIds || []);
    // Undo the old action's buff if its owning skill/trigger was removed.
    for (const [key, previous] of this.maxStarWeaponBuffs) {
      if (playerSnapshot.triggers.some(trigger => trigger.skillId === previous.skillId && trigger.id === previous.triggerId)) continue;
      this.weaponStatuses.remove(previous.owner, previous.buffId); this.maxStarWeaponBuffs.delete(key);
    }
    this.refreshBuffAttributes();
    this.installLoadoutProgram(playerSnapshot, 0);
    for (const command of this.playerSkillProgram.sync(playerSnapshot, this.clock, () => this.random(), { passiveOwner: true, ownerPoint: { x: this.player.x, z: this.player.z } })) this.applyNativeWeaponAction(0, command);
    this.refreshBuffAttributes();
    if (this.secondary.has(200141)) {
      this.orbit ??= new NativeOrbitWeaponRuntime({
        owner: () => this.player,
        create: (weaponId, position) => {
          const bullet = this.emitPlayerWeapon(weaponId, 200141, position, 0);
          bullet.held = true; bullet.repeatHits = true; bullet.lifetime = Infinity;
          return bullet.uid;
        },
        alive: uid => this.projectiles.some(bullet => bullet.uid === uid && !bullet.dead),
        pose: (uid, position, yaw) => { const bullet = this.projectiles.find(bullet => bullet.uid === uid); if (bullet) { bullet.x = position.x; bullet.z = position.z; bullet.angle = yaw * Math.PI / 180; } },
        remove: uid => { const bullet = this.projectiles.find(bullet => bullet.uid === uid); if (bullet) bullet.dead = true; },
        refresh: (uid, dynamicScale) => {
          const bullet = this.projectiles.find(bullet => bullet.uid === uid);
          if (!bullet) return;
          const source = this.content.chapter.bullets[bullet.bulletId].parameters;
          const attr = this.weaponAttributes(200141), expression = source.hurtAttributes.find((s: string) => s.startsWith('Attack='));
          const coefficient = expression?.match(/\*([\d.]+)%/);
          bullet.damage = this.player.attack * (coefficient ? Number(coefficient[1]) / 100 : 1) * (1 + (attr['BulletAttack%'] || 0)) * (1 + (attr['SkillUpgradeAttack%'] || 0)) * (1 + (attr['WeaponDamageAdd%'] || 0))
            * (1 + nativeElementAndTraitDamageBonus(name => entryWeaponAttribute(this.content.combat, name) + (attr[name] || 0) * 100, source.Element, bullet.traits));
          bullet.critChance = this.content.chapter.player.critRate + (attr['CritRate%'] || 0);
          bullet.critMultiplier = 1.5 + entryWeaponAttribute(this.content.combat, 'CritValue%') / 100 + (attr['CritValue%'] || 0);
          bullet.hitInterval = source.MinBulletHurtTime * (attr['MinBulletHurtTimeReduce%'] ?? 1);
          const scale = (this.bulletBase.get(bullet)?.scale ?? bullet.scale) * dynamicScale;
          bullet.radiusX = Number(source.Shape[0]) * scale; bullet.radiusZ = Number(source.Shape[1] ?? source.Shape[0]) * scale;
          bullet.scale = scale;
        },
        innerLaserCreate: (weaponId, ballUid, from, to) => {
          const b = this.emitPlayerWeapon(weaponId, 200141, from, Math.atan2(to.x - from.x, to.z - from.z), undefined, 0x440 | 0x88);
          b.fixedSegments = b.beam = true; b.pierce = Infinity; b.lifetime = Infinity;
          b.segments = [{ from: { ...from }, to: { ...to } }]; return b.uid;
        },
        innerLaserPose: (uid, from, to) => { const b = this.projectiles.find(b => b.uid === uid); if (b) { b.x = from.x; b.z = from.z; b.angle = Math.atan2(to.x - from.x, to.z - from.z); b.segments = [{ from: { ...from }, to: { ...to } }]; } },
        bulletScale: uid => this.projectiles.find(b => b.uid === uid)?.scale || 0,
      });
      this.orbit.reconcile(this.orbitSettings());
    }
    if (this.secondary.has(200041)) this.missiles ??= new NativeMissileRuntime({
      owner: () => ({ x: this.player.x, z: this.player.z, yawDegrees: 0 }),
      emit: (weaponId, origin, yaw, options) => {
        const b = this.emitPlayerWeapon(weaponId, options.familyEntityId, origin, yaw * Math.PI / 180, undefined, 0, true);
        b.held = options.held; b.collisionDisabled = options.held;
        if (options.ignoreCapacity) b.flags = (b.flags || 0) | 0x4000000;
        return b.uid;
      },
      get: uid => { const b = this.projectiles.find(b => b.uid === uid && !b.dead); return b ? { position: b, yawDegrees: b.angle * 180 / Math.PI, rotateSpeed: b.follow } : undefined; },
      pose: (uid, pos, yaw) => { const b = this.projectiles.find(b => b.uid === uid); if (b) { const speed = Math.hypot(b.vx, b.vz); b.x = pos.x; b.z = pos.z; b.angle = yaw * Math.PI / 180; b.vx = Math.sin(b.angle) * speed; b.vz = Math.cos(b.angle) * speed; } },
      hold: (uid, held) => { const b = this.projectiles.find(b => b.uid === uid); if (b) b.held = b.collisionDisabled = held; },
      dead: uid => !this.projectiles.some(b => b.uid === uid && !b.dead),
      kill: uid => { const b = this.projectiles.find(b => b.uid === uid); if (b) b.dead = true; },
      selectForwardTarget: range => { const choices = this.enemies.filter(e => this.enemyChooseable(e) && e.z >= this.player.z && Math.hypot(e.x - this.player.x, e.z - this.player.z) < range); const e = choices[Math.floor(this.random() * choices.length)]; return e && { uid: e.uid, position: e }; },
      target: (uid, targetUid) => { const b = this.projectiles.find(b => b.uid === uid); if (b) b.targetUid = targetUid; },
      targetPosition: uid => this.enemies.find(e => e.uid === uid && !e.dead),
      random: () => this.random(),
      launched: uid => { const b = this.projectiles.find(b => b.uid === uid); if (b) { b.age = 0; this.playMissileRelease(b); this.dispatchWeaponEvent(17, 200041, { weaponId: b.weaponId, bullet: b, point: b }); } },
      mergeAttributes: (uid, attrs) => { const b = this.projectiles.find(b => b.uid === uid); if (b) this.applyBulletAttributes(b, { ...attrs }); },
    });
    const previousSwords = this.swords;
    if (this.secondary.has(200101)) this.swords ??= new NativeCurveSwordRuntime({
      owner: () => this.player, ownerYaw: () => 0,
      settings: () => ({ ...nativeSwordSettings(name => this.weaponAttributes(200101)[name] || 0, this.content.chapter.weapons[200101].trajectoryParameters),
        noSwingInterval: (this.installedWeaponActions.get(200101) || []).some(command => command.action === 33),
        weaponId: this.playerWeaponState(200101)?.nativeWeaponIds?.[0] }),
      targets: () => this.enemies.filter(e => this.enemyChooseable(e)).map(e => ({ uid: e.uid, x: e.x, z: e.z, bossElite: e.boss || e.elite, aiState: this.enemySelectionState(e),
        distance: Math.hypot(e.x - this.player.x, e.z - this.player.z) - nativeShapeRadii(this.content.chapter.entities[e.entityId].stats.shape).radius2 - nativeShapeRadii(this.content.chapter.entities[200101].stats.shape).radius2 })),
      random: () => this.random(),
      create: (weaponId, origin) => { const b = this.emitPlayerWeapon(weaponId, 200101, origin, 0); b.held = true; b.lifetime = Infinity; return b.uid; },
      alive: uid => this.projectiles.some(b => b.uid === uid && !b.dead),
      pose: (uid, position, yaw) => { const b = this.projectiles.find(b => b.uid === uid); if (b) { b.oldX = b.x; b.oldZ = b.z; b.x = position.x; b.z = position.z; b.angle = yaw * Math.PI / 180; } },
      active: (uid, active) => { const b = this.projectiles.find(b => b.uid === uid); if (b) b.collisionDisabled = !active; },
      shape: (uid, halfWidth, halfHeight, offsetX) => { const b = this.projectiles.find(b => b.uid === uid); if (b) { b.box = true; b.radiusX = halfWidth; b.radiusZ = halfHeight; b.offsetX = offsetX; } },
      kill: uid => { const b = this.projectiles.find(b => b.uid === uid); if (b) b.dead = true; },
      stampCircularSlash: (uid, stamp) => { const b = this.projectiles.find(b => b.uid === uid); if (b) this.applyBulletAttributes(b, { ...stamp.attributes }); },
      onSwing: swing => {
        const bullet = this.projectiles.find(b => b.uid === swing.uid);
        if (bullet) bullet.visualHidden = true; // Native DispatchScaleEvent(0,true), collision remains unchanged.
        const duration = swing.circular ? 1 : .5;
        const fx = this.effect('muzzle', swing.position.x, swing.position.z, duration, 1, undefined, swing.circular ? 220017 : 220005);
        fx.duration = duration;
        fx.originalScale = swing.radius * (0xb5c2 / 65536);
        fx.originalSpeed = swing.simulationSpeed;
        fx.originalMirrorX = !swing.clockwise;
        fx.angle = Math.atan2(swing.direction.x, swing.direction.z);
      },
      onConsume: (uid, targetUid) => { const b = this.projectiles.find(b => b.uid === uid); if (b) { b.targetUid = targetUid; this.dispatchWeaponEvent(17, 200101, { weaponId: b.weaponId, bullet: b, point: b }); } },
      onHalf: (uid, targetUid, point) => { const b = this.projectiles.find(b => b.uid === uid); if (b) this.dispatchWeaponEvent(21, 200101, { weaponId: b.weaponId, bullet: b, target: this.enemies.find(e => e.uid === targetUid), point }); },
    });
    if (!previousSwords && this.swords) this.swords.setCircularSlashConfig(this.circularSlashConfig);
    for (const command of this.installedWeaponActions.get(200141) || []) {
      if (command.action === 82 && !this.appliedInstalledActions.has(command.sourceKey)) {
        this.orbit?.setDynamicRadius(command.args.RadiusMaxScale, command.args.RadiusMinScale, command.args.RadiusMaxTime, command.args.RadiusMinTime);
        this.appliedInstalledActions.add(command.sourceKey);
      }
      if (command.action === 85 && command.args.AllowInSideLaser) {
        const data = command.args.InSideLaserData;
        this.orbit?.setInnerLaser(Number(JSON.parse(data[1]).WeaponId));
      }
    }
  }
  private orbitSettings(): NativeOrbitSettings {
    const attr = this.weaponAttributes(200141), family = this.content.combat.families[10001601];
    const speed = (this.installedWeaponActions.get(200141) || []).filter(command => command.action === 68).reduce((sum, command) => sum + Number(command.args.value || 0), 0);
    return { group0Weapons: family.creation.BallWeaponIds || [], extraBallCount: attr.RotateBallCount || 0,
      angularSpeed: (attr.RotateBallSpeed || 0) + speed, angularSpeedPercent: attr['RotateBallSpeed%'] || 0,
      extraRadius: attr.RotateBallRadius || 0, dynamicScalePercent: attr['RotateBallDynamicScale%'] || 0 };
  }
  private emitPlayerWeapon(weaponId: number, familyId: number, origin: Point, angle: number, targetUid?: number, flags = 0, silentAudio = false): Projectile {
    weaponId = this.resolveNativeWeaponId(weaponId, familyId);
    const cooldownResetAttack = this.cooldownResetAttack.consume(familyId || this.content.chapter.player.weaponEntityId,
      this.runtimeWeapon(weaponId, 'player', familyId)?.mods || []);
    const projectile = this.emitProjectile({ at: this.clock, owner: 'player', ownerUid: 0, weaponId, familyId, origin: { ...origin }, angle, attack: this.player.attack, flags, cooldownResetAttack, silentAudio });
    if (!projectile) throw new Error(`缺少原版武器依赖 ${weaponId}`);
    projectile.targetUid = targetUid;
    const runtime = this.runtimeWeapon(weaponId, 'player', familyId);
    const range = runtime?.trajectory === 'Thunder' && runtime.mods.find((m: RecordData) => m.type === 'WeaponRangeTargetMod')?.parameters;
    if (range) {
      const targets = thunderRangeTargets(origin, targetUid, this.enemies.filter(e => this.enemyChooseable(e)), range, () => this.random());
      projectile.targetUid = targets[0]?.uid;
      for (const target of targets.slice(1)) this.emitProjectile({ at: this.clock, owner: 'player', ownerUid: 0,
        weaponId, familyId, origin: { ...origin }, angle, attack: this.player.attack, flags, cooldownResetAttack, targetUid: target.uid });
    }
    const weapon = this.content.chapter.weapons[weaponId];
    const target = this.enemies.find(enemy => enemy.uid === targetUid);
    if (target && weapon.trajectory === 'FixedPos' && !weapon.trajectoryParameters.DisableTargetPosAsBirthPos) {
      projectile.x = projectile.oldX = target.x; projectile.z = projectile.oldZ = target.z;
    }
    return projectile;
  }
  private installPrism(bullet: Projectile, parameters: NativePrismParams) {
    if (this.prisms.has(bullet)) return;
    // The prism has no HitCamp; it is a receiver, not a damaging contact bullet.
    bullet.collisionDisabled = true;
    const runtime = new NativePrismRuntime(parameters, {
      prism: () => ({ uid: bullet.uid, position: bullet, yawDegrees: bullet.angle * 180 / Math.PI,
        camp: bullet.owner === 'player' ? 1 : 2, alive: !bullet.dead,
        ownerExists: bullet.owner === 'player' ? this.player.hp > 0 : this.enemies.some(e => e.uid === bullet.ownerUid && !e.dead) }),
      movePrism: point => { bullet.x = bullet.oldX = point.x; bullet.z = bullet.oldZ = point.z; },
      emit: request => {
        const side = this.emitProjectile({ at: this.clock, owner: bullet.owner, ownerUid: bullet.ownerUid,
          weaponId: request.weaponId, familyId: bullet.familyId, origin: request.origin,
          angle: request.yawDegrees * Math.PI / 180, attack: bullet.attackSnapshot, flags: 0x88 });
        if (!side) return undefined;
        this.prismSides.set(side, { parent: bullet, offset: request.followOffset });
        side.segments = [{ from: { x: side.x, z: side.z },
          to: { x: side.x + Math.sin(side.angle) * side.beamLength, z: side.z + Math.cos(side.angle) * side.beamLength } }];
        return { uid: side.uid, lifetime: side.lifetime };
      },
      alive: uid => this.projectiles.some(b => b.uid === uid && !b.dead),
      refresh: (uid, lifetime) => {
        const b = this.projectiles.find(b => b.uid === uid && !b.dead);
        if (b) {
          // Hit cooldown is world-time based in native code. Our timestamps
          // use bullet age, so shift them when resetting the birth time.
          for (const [target, at] of b.hitTimes) b.hitTimes.set(target, at - b.age);
          b.age = 0; b.lifetime = lifetime;
        }
      },
      kill: uid => { const b = this.projectiles.find(b => b.uid === uid); if (b) b.dead = true; },
    });
    this.prisms.set(bullet, runtime);
    runtime.init(this.clock);
  }
  private updatePrismReactions() {
    if (!this.prisms.size) return;
    for (const laser of [...this.projectiles]) {
      if (laser.dead || !laser.beam || laser.collisionDisabled) continue;
      const source = { uid: laser.uid, weaponId: laser.weaponId, camp: laser.owner === 'player' ? 1 : 2, alive: true };
      for (const segment of laser.segments) nativePrismProbeSegments(source, [segment.from, segment.to],
        (from, to) => [...this.prisms.keys()].filter(prism => prism.owner === laser.owner && prism.ownerUid === laser.ownerUid && !prism.dead
          && prism.runtimeMods?.some(mod => mod.type === 'LaserPrismMainLaserReactionMod')
          && sweep({ ...to, oldX: from.x, oldZ: from.z, radiusX: laser.radiusX, radiusZ: laser.radiusX, box: false, angle: laser.angle },
            { ...prism, oldX: prism.x, oldZ: prism.z }) !== null)
          .map(prism => ({ uid: prism.uid, camp: prism.owner === 'player' ? 1 : 2, alive: !prism.dead, registered: true })),
        (uid, hit) => { const prism = this.projectiles.find(b => b.uid === uid); if (prism) this.prisms.get(prism)?.react(hit, this.clock); });
    }
  }
  private scheduleWeaponCease(familyId: number, at: number, weaponId: number, firstShot = this.shots.length) {
    this.activeWeaponCease.delete(familyId);
    this.pendingWeaponCease.set(familyId, { at, weaponId, shots: new Set(this.shots.slice(firstShot)) });
  }
  private dispatchPendingWeaponCease() {
    for (const [familyId, pending] of this.pendingWeaponCease) {
      if (pending.at > this.clock || this.shots.some(shot => pending.shots.has(shot))) continue;
      this.pendingWeaponCease.delete(familyId);
      if (!this.playerWeaponState(familyId)) continue;
      this.activeWeaponCease.add(familyId);
      this.setLaserCannonState(familyId, 1);
      this.cooldownResetAttack.enterCease(familyId);
      // DispatchEnterCeaseFireTrigger@6c58264 is once per state entry and
      // belongs to this weapon's component, not the player's component.
      this.dispatchWeaponEvent(44, familyId, { weaponId: pending.weaponId, point: this.player, skipPlayer: true });
    }
  }
  private dispatchWeaponEvent(type: number, familyId: number, data: RecordData = {}) {
    // Native HandleGenericHitTrigger returns before RNG when NoTrigger is set.
    // AnyWeapon (31) and source counters (26) are separate, earlier adapters.
    if (type === 4 && (data.bullet?.flags & 8)) return;
    const entityId = familyId || this.content.chapter.player.weaponEntityId;
    const program = this.weaponPrograms.get(entityId);
    const count = this.weaponEventCounts.get(entityId) || { hit: 0, fire: 0, crit: 0, kill: 0 };
    if (type === 31) count.hit++; else if (type === 17) count.fire++; else if (type === 16) count.crit++; else if (type === 5) count.kill++;
    this.weaponEventCounts.set(entityId, count);
    const event: NativeWeaponEvent = { type, ...data, weaponId: data.weaponId, targetType: data.target?.entityId ? Number(this.content.chapter.entities[data.target.entityId].raw.Type) : data.targetType,
      bulletUid: data.bullet?.uid, targetUid: data.target?.uid ?? data.targetUid, noTrigger: Boolean(data.bullet?.flags & 8),
      ownerPoint: { x: this.player.x, z: this.player.z }, targetPoint: data.target ? { x: data.target.x, z: data.target.z } : undefined,
      targetBuffFlags: data.target?.uid ? this.statuses.flags(data.target.uid) : [], targetBuffSourceWeaponIds: data.target?.uid ? this.statuses.flagSourceWeaponIds(data.target.uid) : {}, hitCount: count.hit, fireCount: type === 64 ? Number(data.mainFireCount ?? data.fireCount) : count.fire, critCount: count.crit, killCount: type === 28 ? Number(data.killCount) : count.kill };
    if (program) {
      for (const command of program.dispatch(event, this.clock, () => this.random())) this.applyNativeWeaponAction(entityId, command);
      if (type === 31) for (const command of program.dispatch({ ...event, type: 26 }, this.clock, () => this.random())) this.applyNativeWeaponAction(entityId, command);
      if (type === 23 && data.bullet?.uid !== undefined) program.releaseBullet(data.bullet.uid);
    }
    if (!data.skipPlayer && (![16, 37, 38, 64, 70].includes(type) || entityId === this.content.chapter.player.entityId)) this.dispatchPlayerEvent(type, event);
  }
  private dispatchPlayerEvent(type: number, data: RecordData = {}) {
    const count = this.playerEventCounts;
    if (type === 31) count.hit++; else if (type === 17) count.fire++; else if (type === 16) count.crit++; else if (type === 5) count.kill++;
    const event: NativeWeaponEvent = { ...data, type, passiveOwner: true, ownerPoint: { x: this.player.x, z: this.player.z }, hitCount: count.hit, fireCount: type === 64 ? Number(data.mainFireCount ?? data.fireCount) : count.fire, critCount: count.crit, killCount: type === 28 ? Number(data.killCount) : count.kill };
    for (const command of this.playerSkillProgram.dispatch(event, this.clock, () => this.random())) this.applyNativeWeaponAction(0, command);
    if (type === 31) for (const command of this.playerSkillProgram.dispatch({ ...event, type: 26 }, this.clock, () => this.random())) this.applyNativeWeaponAction(0, command);
    if (type === 23 && data.bulletUid !== undefined) this.playerSkillProgram.releaseBullet(data.bulletUid);
  }
  private createArcLink(carrier: Projectile, target: Enemy) {
    const chain = this.arcChains.get(carrier)!;
    const ejectCount = this.actualEjectCounts.get(carrier) || 0;
    const hit = chain.hit(target, { x: this.player.x + carrier.anchorX, z: this.player.z + carrier.anchorZ },
      this.enemies.filter(e => this.inCamera(e)).map(e => ({ ...e, hitCamp: 2, noEject: Boolean(nativeMonsterAttribute(this.content.chapter.entities[e.entityId].raw.MonsterAbility, 'ImmuneBulletEject')) })), () => this.random(), carrier);
    if (!(carrier.flags! & 8)) this.dispatchWeaponEvent(70, carrier.familyId, { weaponId: carrier.weaponId, bullet: carrier, target, point: target, ejectCount, willEject: !hit.final, skipPlayer: true });
    const link = this.emitPlayerWeapon(hit.weaponId, carrier.familyId, hit.from, Math.atan2(hit.to.x - hit.from.x, hit.to.z - hit.from.z), target.uid, 0x88);
    link.beam = true; link.fixedSegments = true; link.damageDisabled = false;
    link.pierce = Infinity; link.damage *= hit.scale; link.radiusX = 1;
    const base = this.bulletBase.get(link); if (base) { base.damage *= hit.scale; base.radiusX = 1; base.radiusOverride = 1; }
    link.segments = [{ from: hit.from, to: hit.to }];
    if (hit.previousTarget) link.hitTimes.set(hit.previousTarget, link.age);
    this.arcLinks.set(link, { fromTarget: hit.previousTarget, toTarget: target.uid, first: hit.first, final: hit.final, carrierUid: carrier.uid });
    // Ejection links, including the first chain, have Eject trait 4096.
    this.addProjectileTraits(link, 4096);
    this.dispatchWeaponEvent(41, carrier.familyId, { weaponId: link.weaponId, bullet: link, target, point: hit.to, first: hit.first, final: hit.final, ejectCount: carrier.hit.size });
    if (hit.first) this.dispatchWeaponEvent(42, carrier.familyId, { weaponId: link.weaponId, bullet: link, target, point: hit.to });
    carrier.hitTimes.set(target.uid, carrier.age);
    carrier.x = target.x; carrier.z = target.z;
    if (hit.final) carrier.dead = true;
    else {
      this.actualEjectCounts.set(carrier, ejectCount + 1);
      carrier.targetUid = chain.nextTarget;
    }
  }
  private fireCannon() {
    const p = this.player;
    const firstShot = this.shots.length;
    const hold = this.queueWeapon(this.content.chapter.player.weaponId, 'player', p, 0, p.attack, 0, this.cannon.bulletId, this.cannon.damageBonus);
    for (const shot of this.shots.slice(firstShot)) shot.flags = (shot.flags || 0) | 0x2000;
    return hold;
  }
  private queueWeapon(weaponId: number, owner: 'player' | 'enemy', origin: Point, ownerUid: number, attack: number, angle: number, bulletId?: number, bonus = 0, familyId = 0, startDelay = 0, startAngleOffset = 0, weaponOverride?: RecordData, fixedFire?: FixedWeaponFirePlan, sourceTargetUid?: number) {
    if (owner === 'player') weaponId = this.resolveNativeWeaponId(weaponId, familyId);
    const w = weaponOverride || this.runtimeWeapon(weaponId, owner, familyId);
    if (!w) return 0;
    const snapshotWeapon = owner === 'player' && this.consumeWeaponMods(weaponId, familyId);
    const range = owner === 'player' && w.trajectory === 'Thunder' && w.mods.find((mod: RecordData) => mod.type === 'WeaponRangeTargetMod')?.parameters;
    const rangeTargets = range ? thunderRangeTargets(origin, sourceTargetUid, this.enemies.filter(enemy => enemy.hp > 0 && this.enemyChooseable(enemy)), range, () => this.random()) : undefined;
    const salvoMod = w.mods.find((m: RecordData) => m.type === 'WeaponSalvoMod');
    const salvo = salvoMod?.parameters || {};
    const multi = w.mods.find((m: RecordData) => m.type === 'WeaponMultiMod')?.parameters || {};
    const ellipse = w.mods.find((m: RecordData) => m.type === 'WeaponEllipseMod')?.parameters;
    const circle = w.mods.find((m: RecordData) => m.type === 'WeaponCircleBulletMod')?.parameters;
    const diamond = w.mods.find((m: RecordData) => m.type === 'WeaponDiamondMod')?.parameters;
    const grade = w.mods.find((m: RecordData) => m.type === 'WeaponGradeMod')?.parameters;
    const dual = w.mods.find((m: RecordData) => m.type === 'WeaponDulBulletMod')?.parameters;
    const charge = w.mods.find((m: RecordData) => m.type === 'WeaponChargeMod')?.parameters;
    const continued = w.mods.find((m: RecordData) => m.type === 'WeaponContinueMod')?.parameters;
    const firstQueued = this.shots.length;
    const fireGroup: NativeFireGroup = { started: false, attributes: {} };
    const state = owner === 'player' ? this.playerWeaponState(familyId) : undefined;
    // Weapon.GetModInfo seeds fireCount=1; Multi adds its configured extra shots.
    const count = Math.max(1, Number(salvo.Count || 1) + (state?.salvo || 0));
    const modification = owner === 'player' ? this.specialWeaponChanges.get(weaponId) : undefined;
    const burst = continued ? nativeContinueFirePlan(continued, Number(multi.FireCount || 0) + (state?.fireCount || 1) + (modification?.DeltaFireCount || 0), () => this.random()) : undefined;
    const repeats = burst?.count ?? Math.max(1, Number(multi.FireCount || 0) + (state?.fireCount || 1));
    const repeatInterval = burst?.interval ?? state?.fireInterval ?? multi.FireInterval;
    const total = Number(salvo.TotalAngle || 0) + (state?.salvoAngle || 0);
    const actor = owner === 'player' ? this.player : this.enemies.find(e => e.uid === ownerUid);
    const playerEntity = this.content.chapter.entities[this.content.chapter.player.entityId];
    const modelId = actor && 'modelId' in actor ? actor.modelId : playerEntity.modelId;
    const selectedPlane = owner === 'player' ? this.content.assets.playerAppearances?.planes?.[this.content.combat.studyLoadout?.selectedSkinId || 10100] : undefined;
    const model = (selectedPlane?.firePositions ? selectedPlane : Object.values(this.content.assets.prefabs).find((p: any) => p.modelIds?.includes(modelId))) as RecordData | undefined;
    const scale = actor && 'scale' in actor ? actor.scale : playerEntity.modelScale;
    const slots: number[] = fixedFire ? [] : w.parameters?.EntityBodyPosType || [];
    // Keep the original queue index: skipping an unavailable anchor must not
    // shift FirePosRotations or symmetric-shot direction onto another mount.
    const offsets: Array<Point & { queueIndex: number }> = slots.flatMap((slot, queueIndex) => {
      const p = model?.firePositions?.[slot];
      return p && !p.missing ? [{ x: p.x * scale, z: p.z * scale, queueIndex }] : [];
    });
    if (!offsets.length) offsets.push({ x: fixedFire ? 0 : origin.x - (actor?.x || 0), z: fixedFire ? 0 : origin.z - (actor?.z || 0), queueIndex: 0 });
    const bullet = this.content.chapter.bullets[bulletId || w.bulletId]?.parameters;
    const deflectionAngle = Number(bullet?.RandomDeflectionAngle || 0) + Number(state?.nativeAttributes?.BulletDeflectionAngle || 0);
    // WeaponPreFire samples once before creating any mount queues. Later
    // rounds and later bullets resample in nativeSalvoPattern's native order.
    const firstDeflection = nativeSalvoDeflection(deflectionAngle, () => this.random());
    const spacing = originalParallelSpacing(bullet?.Shape?.[0] || 0, nativeBulletScale(Number(bullet?.Scale ?? 1), Number(bullet?.Flag || 0), Number(bullet?.BulletTrait || 0), state?.nativeAttributes), Number(dual?.SpaceOffset || 0), bullet?.DulBulletSpaceOffset || 0);
    const parallel = Math.max(1, Math.floor(((state?.parallel || 1) + Number(dual?.BulletNum || 0)) * (1 + (state?.parallelPercent || 0))));
    const sideMod = w.mods.find((m: RecordData) => m.type === 'WeaponForsideMod')?.parameters;
    const sideCount = 2 * Math.max(0, Math.floor(((state?.side || 0) / 2 + Number(sideMod?.SideBulletNum || 0)) * (1 + (state?.sidePercent || 0))));
    for (const mount of offsets) {
      const mountIndex = mount.queueIndex;
      const worldMount = this.rotateMount(mount, actor && 'angle' in actor ? actor.angle : 0);
      const realTimeAim = !fixedFire && Number(w.parameters?.BulletRotate2Target || 0) >= 1 && !w.parameters?.DisableRealTimeTarget && !w.parameters?.BulletToAlarmPos;
      const aimedPattern = !fixedFire && (Number(w.parameters?.BulletToAlarmPos) === 1 || Number(w.parameters?.BulletRotate2Target) === 1 || Number(w.parameters?.FireRotation) === 1 || realTimeAim);
      // FireRotation=3 is LookFromEntityToFirePos: radial mount direction,
      // not the fire-position Transform's localRotation (Weapon.GetFireRotation).
      const direction = fixedFire ? fixedFire.angle : w.parameters?.FireRotation === 3 ? Math.atan2(worldMount.x, worldMount.z) : w.parameters?.FireRotation === 2 ? 0
        : owner === 'enemy' && Number(w.parameters?.FireRotation) === 1 && actor ? Math.atan2(this.player.x - actor.x - worldMount.x, this.player.z - actor.z - worldMount.z) : angle;
      const initialTargetAngle = actor ? Math.atan2(this.player.x - actor.x - worldMount.x, this.player.z - actor.z - worldMount.z) : direction;
      // The host queues animation-delayed attacks early. Alarm actions may
      // still update their target; freeze one queue baseline at its first fire
      // (native WeaponFire), never recalculate every later shot independently.
      const alarmAim: AlarmQueueAim | undefined = !fixedFire && owner === 'enemy' && Number(w.parameters?.BulletToAlarmPos) === 1
        && (Number(w.parameters?.FireRotation) === 1 || (Boolean(salvoMod) && count > 1))
        ? { target: { ...this.player }, mount, initialAngle: initialTargetAngle } : undefined;
      const mirror = w.parameters?.IsFirePosSymmetry && mountIndex % 2 === 0 ? -1 : 1;
      const pattern = grade ? Array.from({ length: repeats }, (_, repeat) => nativeGradeAngles(grade.MaxBulletCount, grade.PerWaveReduceBulletCount, repeat, grade.PerAngle, direction)
        .map((angle, index) => ({ angle, index, repeat, delay: repeat * Number(repeatInterval ?? 0) + index * Number(grade.FireInterval || 0) }))).flat()
        : nativeSalvoPattern({ count, totalAngleDegrees: total, baseAngle: direction,
          startAngleDegrees: Number(salvo.StartAngle || 0) + startAngleOffset * 180 / Math.PI,
          targetAngle: !fixedFire && owner === 'enemy' && actor && (Number(w.parameters?.BulletRotate2Target) === 1 || Number(w.parameters?.BulletToAlarmPos) === 1)
            ? Math.atan2(this.player.x - actor.x - worldMount.x, this.player.z - actor.z - worldMount.z) : undefined,
          salvoMod: Boolean(salvoMod), queueIndex: mountIndex, parameters: salvo,
          bulletInterval: salvo.FireInterval, repeats, repeatInterval,
          deflectionAngleDegrees: deflectionAngle, firstDeflectionDegrees: firstDeflection, random: () => this.random() });
      for (const shot of pattern) {
        const nativeShot = shot as Partial<NativeSalvoShot>;
        const nativeShape = !grade && !circle && !ellipse && !diamond;
        const metadata = { nativeShapeType: nativeShape ? nativeShot.shapeType : undefined,
          nativeDeflectionDegrees: nativeShape ? nativeShot.deflectionDegrees : undefined,
          firePositionAngle: nativeFirePositionAngle(w.parameters?.FirePosRotations, mountIndex), alarmAim: nativeShape ? alarmAim : undefined };
        if (diamond) {
          for (const [index, radial] of nativeDiamondOffsets(diamond.Count, diamond.Width, diamond.Height).entries()) {
            this.shots.push({ ...metadata, at: this.clock + startDelay + shot.delay + index * Number(diamond.FireInterval || 0), owner, origin: { ...origin }, anchor: mount, localAnchor: true, ownerUid, weaponId, angle: shot.angle, attack, bulletId, bonus, familyId, radial: this.rotateMount(radial, direction), mirror,
              aimTarget: owner === 'enemy' && aimedPattern ? { ...this.player } : undefined, realTimeAim: owner === 'enemy' && realTimeAim, aimOffset: shot.angle - direction });
          }
          continue;
        }
        if (circle) {
          const radius = Number(circle.Radius || 0);
          for (const [index, radial] of nativeEllipseOffsets({ Count: circle.Count, SemiMajorAxis: radius, SemiMinorAxis: radius }).entries()) {
            // Circle DirectionType 0 translates the complete ring; 1 points
            // outwards, 2 uses a configured absolute direction.
            const rotation = direction + Number(circle.InitialAngle || 0) * Math.PI / 180;
            const ringOffset = this.rotateMount(radial, rotation);
            const fireAngle = circle.DirectionType === 1 ? Math.atan2(ringOffset.x, ringOffset.z) : circle.DirectionType === 2 ? Number(circle.DirectionAngle || 0) * Math.PI / 180 : shot.angle;
            this.shots.push({ ...metadata, at: this.clock + startDelay + shot.delay + index * Number(circle.FireInterval || 0), owner, origin: { ...origin }, anchor: mount, localAnchor: true, ownerUid, weaponId, angle: fireAngle, attack, bulletId, bonus, familyId, radial: ringOffset, mirror });
          }
          continue;
        }
        if (ellipse) {
          for (const radial of nativeEllipseOffsets(ellipse)) {
            this.shots.push({ ...metadata, at: this.clock + startDelay + shot.delay, owner, origin: { ...origin }, anchor: mount, localAnchor: true, ownerUid, weaponId, angle: shot.angle, attack, bulletId, bonus, familyId, radial, mirror,
              aimTarget: owner === 'enemy' && aimedPattern ? { ...this.player } : undefined, realTimeAim: owner === 'enemy' && realTimeAim, aimOffset: shot.angle - direction });
          }
          continue;
        }
        const splitPrimary = !nativeShape || nativeShot.primary !== false;
        const splitCount = splitPrimary ? parallel : 1;
        for (let n = 0; n < splitCount; n++) {
          const anchor = { x: mount.x + (n - (splitCount - 1) / 2) * spacing, z: mount.z };
          this.shots.push({ ...metadata, at: this.clock + startDelay + shot.delay, owner, origin: { x: origin.x, z: origin.z }, anchor, localAnchor: true, ownerUid, weaponId, angle: shot.angle, attack, bulletId, bonus, familyId,
            aimTarget: owner === 'enemy' && aimedPattern ? { x: this.player.x, z: this.player.z } : undefined, realTimeAim: owner === 'enemy' && realTimeAim, aimOffset: shot.angle - direction, mirror });
        }
        for (let n = 0; n < (splitPrimary ? sideCount : 0); n++) {
          const side = (Math.floor(n / 2) + 1) * Number(sideMod?.PerAngle ?? state?.sideAngle ?? 0) * Math.PI / 180 * (n % 2 ? 1 : -1);
          this.shots.push({ ...metadata, at: this.clock + startDelay + shot.delay, owner, origin: { x: origin.x, z: origin.z }, anchor: mount, localAnchor: true, ownerUid, weaponId, angle: shot.angle, postAimAngle: side, attack, bulletId, bonus, familyId });
        }
      }
    }
    const trajectoryHold = w.trajectory === 'LaserRotateByOwner' ? nativeRotatingLaserFireHold(w.trajectoryParameters || {})
      : w.trajectory === 'LaserRandomPoints' ? nativeRandomLaserFireHold(w.trajectoryParameters || {}) : 0;
    // The verified rotating/polyline laser rows have no Multi mod. Their
    // combination is rejected by capabilities until its merge rule is known.
    const hold = (w.trajectory === 'LaserRotateByOwner' || w.trajectory === 'LaserRandomPoints' ? trajectoryHold : burst?.holdTime ?? Number(multi.FireHoldTime || 0)) + (state?.fireHoldBonus || 0);
    if (weaponOverride) for (const shot of this.shots.slice(firstQueued)) shot.weaponOverride = weaponOverride;
    if (fixedFire) for (const shot of this.shots.slice(firstQueued)) {
      // FireNow(FPVector3) uses a fixed world position, including AI callbacks
      // and death weapons. Keep the ordinary mod/attribute/Salvo calculation.
      shot.origin = { x: fixedFire.fixedPosition.x, z: fixedFire.fixedPosition.z };
      shot.anchor = undefined; shot.localAnchor = false;
      shot.fixedFire = true; shot.allowDeadOwner = fixedFire.allowDeadOwner;
      Object.assign(shot, { externalShapeScale: fixedFire.externalShapeScale, fireEffectScale: fixedFire.fireEffectScale });
      shot.flags = Number(shot.flags || 0) | fixedFire.flags;
    }
    if (owner === 'enemy') for (const shot of this.shots.slice(firstQueued)) shot.fireGroup = fireGroup;
    if (owner === 'player' && this.shots[firstQueued]) {
      this.shots[firstQueued].fireEvent = true;
      const cooldownResetAttack = this.cooldownResetAttack.consume(familyId || this.content.chapter.player.weaponEntityId, w.mods || []);
      for (const shot of this.shots.slice(firstQueued)) {
        shot.fireGroup = fireGroup;
        shot.cooldownResetAttack = cooldownResetAttack;
        if (snapshotWeapon) shot.weaponOverride = w;
      }
    }
    if (rangeTargets) {
      const queued = this.shots.splice(firstQueued);
      for (const shot of queued) for (const target of rangeTargets) this.shots.push({ ...shot, targetUid: target.uid });
    }
    if (owner === 'player' && charge) {
      const chargeHold = nativeWeaponChargeHold(charge, hold);
      for (const shot of this.shots.slice(firstQueued)) shot.at += chargeHold;
      if (chargeHold > 0) {
        const play = (effectId: number, duration: number, position: RecordData | undefined) => {
          if (!effectId) return;
          const mount = { x: Number(position?.x || 0) * scale, z: Number(position?.z || 0) * scale };
          const effect = this.effect('muzzle', this.player.x + mount.x, this.player.z + mount.z, duration, 1, undefined, effectId);
          effect.followPlayer = true; effect.followOffset = mount; effect.originalScale = 1;
          effect.duration = duration;
        };
        // Hold.Enter attaches to firePos[2]. Completion instead uses the Head
        // body anchor (EntityBodyPosType=2), not the fire-position index.
        play(Number(w.parameters.HoldEffect || 0), chargeHold, model?.firePositions?.[2]);
        if (w.parameters.HoldCompleteEffect) this.timedWeaponActions.push({ at: this.clock + chargeHold,
          run: () => { if (this.player.hp > 0) play(Number(w.parameters.HoldCompleteEffect), .5, model?.mounts?.m_head); } });
      }
      return chargeHold;
    }
    return hold;
  }
  private rotateMount(mount: Point, angle: number): Point {
    const co = Math.cos(angle), si = Math.sin(angle);
    return { x: mount.x * co + mount.z * si, z: -mount.x * si + mount.z * co };
  }
  private emitProjectile(shot: Shot) {
    const w = shot.weaponOverride || this.runtimeWeapon(shot.weaponId, shot.owner, shot.familyId);
    if (shot.owner === 'player' && !shot.fireGroup) this.consumeWeaponMods(shot.weaponId, shot.familyId);
    const changedBullet = w.mods.find((m: RecordData) => m.type === 'WeaponChangeBulletMod')?.parameters.BulletId;
    const id = changedBullet || shot.bulletId || w.bulletId;
    const b = this.content.chapter.bullets[id]?.parameters;
    if (!b) return;
    if (shot.owner === 'player' && shot.fireGroup && !shot.fireGroup.started) {
      const group = shot.fireGroup, owner = shot.familyId || this.content.chapter.player.weaponEntityId;
      group.started = true;
      this.nextFireBoost.weaponFire(owner, shot.weaponId);
      if (shot.fireEvent) this.dispatchWeaponEvent(17, shot.familyId || 0, { weaponId: shot.weaponId, point: shot.origin });
      const flags = Number(b.Flag || 0) | Number(shot.flags || 0);
      this.nextFireBoost.mainWeaponFire(owner, flags);
      if (flags & 0x2000) {
        const key = `${owner}:${shot.weaponId}`, count = (this.mainFireCounts.get(key) || 0) + 1;
        this.mainFireCounts.set(key, count);
        this.dispatchWeaponEvent(64, shot.familyId || 0, { weaponId: shot.weaponId, point: shot.origin, mainFireCount: count });
      }
      // One native WeaponFire constructs its complete salvo. Later delayed
      // births retain that fire's attributes when another round starts first.
      group.attributes = this.nextFireBoost.attributes(owner, shot.weaponId);
    }
    const fireBoost = shot.fireGroup?.attributes || (shot.owner === 'player' ? this.nextFireBoost.attributes(shot.familyId || this.content.chapter.player.weaponEntityId, shot.weaponId) : {});
    const formula = (b.hurtAttributes || []).find((s: string) => s.startsWith('Attack=')) || 'Attack=1';
    const match = formula.match(/\*(\d+(?:\.\d+)?)%/), multiplier = match ? Number(match[1]) / 100 : 1;
    const through = w.mods.find((m: RecordData) => m.type === 'ThroughMod')?.parameters;
    const rebound = w.mods.find((m: RecordData) => m.type === 'ReboundMod')?.parameters;
    const follow = w.mods.find((m: RecordData) => m.type === 'FollowMod')?.parameters;
    const scaleMod = w.mods.find((m: RecordData) => m.type === 'ScaleAnimMod')?.parameters;
    const eject = w.mods.find((m: RecordData) => m.type === 'EjectMod')?.parameters;
    const flashChain = w.mods.find((m: RecordData) => m.type === 'FlashChainMod')?.parameters;
    const explosion = w.mods.find((m: RecordData) => m.type === 'ExplosionMod')?.parameters;
    const beam = originalIsLaserTrajectory(w.trajectory);
    const state = shot.owner === 'player' ? this.playerWeaponState(shot.familyId || 0) : undefined;
    // ScaleAnimModProcessor.ForceSetScale replaces the source scale, including
    // collision dimensions; multiplying it by Bullet.Scale double-scales shots.
    const finalFlags = Number(b.Flag || 0) | Number(shot.flags || 0);
    const scaleAnimation = scaleMod ? nativeScaleAnimDefaults(scaleMod) : undefined;
    const modification = shot.owner === 'player' ? this.specialWeaponChanges.get(shot.weaponId) : undefined;
    const scale = (shot as Shot & { scaleOverride?: number }).scaleOverride ?? (scaleAnimation ? scaleAnimation.StartScale : nativeBulletScale(Number(b.Scale ?? 1), finalFlags, Number(b.BulletTrait || 0), state?.nativeAttributes,
      { nextFireModifiers: fireBoost, modificationDelta: modification?.DeltaScalePercent, allowModificationWhenIgnored: modification?.AllowScaleWhenIgnored }));
    const ownerAttackRatio = shot.owner === 'player' ? (1 + (state?.nativeAttributes?.['Attack%'] || 0)) / (1 + (this.effectivePlayerAttributes['Attack%'] || 0)) : 1;
    const speed = (b.MoveSpeed + (state?.nativeAttributes?.BulletSpeed || 0)) * (1 + (state?.speedBonus || 0) + (state?.nativeAttributes?.['AllBulletSpeed%'] || 0));
    const origin = { ...shot.origin };
    const actor = shot.owner === 'player' ? this.player : this.enemies.find(e => e.uid === shot.ownerUid);
    if (actor && shot.anchor) {
      const mount = shot.localAnchor ? this.rotateMount(shot.anchor, 'angle' in actor ? actor.angle : 0) : shot.anchor;
      origin.x = actor.x + mount.x; origin.z = actor.z + mount.z;
    }
    if (shot.radial) { origin.x += shot.radial.x; origin.z += shot.radial.z; }
    if (!shot.fixedFire && shot.nativeShapeType !== undefined) {
      if (shot.alarmAim && actor) {
        const aim = shot.alarmAim;
        if (aim.lockedDelta === undefined) {
          const mount = this.rotateMount(aim.mount, 'angle' in actor ? actor.angle : 0);
          aim.lockedDelta = Math.atan2(aim.target.x - actor.x - mount.x, aim.target.z - actor.z - mount.z) - aim.initialAngle;
        }
        shot.angle += aim.lockedDelta;
      }
      const mode = nativeShotAimMode(shot.nativeShapeType, w.parameters || {});
      // Native replacement cancels the queued rotation and deflection.
      // WeaponForside multiAngle is applied by the bullet builder afterwards.
      // No target leaves the original rotation intact, even if owner rotation
      // is enabled (CalculateDeltaRotation@6e48568 returns immediately).
      if (mode === 'target' && shot.owner === 'enemy')
        shot.angle = Math.atan2(this.player.x - origin.x, this.player.z - origin.z);
      else if (mode === 'owner' && actor) shot.angle = 'angle' in actor ? actor.angle : 0;
      else if (mode === 'radial' && actor) shot.angle = Math.atan2(origin.x - actor.x, origin.z - actor.z);
    } else if (!shot.fixedFire) {
      // Existing non-salvo shape handlers retain their separate contracts.
      if (actor && w.parameters?.FireRotation === 3 && w.parameters?.RealTimeEntityRotation)
        shot.angle = Math.atan2(origin.x - actor.x, origin.z - actor.z);
      const aimTarget = shot.owner === 'enemy' && shot.realTimeAim ? this.player : shot.aimTarget;
      if (aimTarget) shot.angle = Math.atan2(aimTarget.x - origin.x, aimTarget.z - origin.z) + (shot.aimOffset || 0);
    }
    shot.angle += (shot.firePositionAngle || 0) + (shot.postAimAngle || 0);
    const projectile: Projectile = {
      uid: this.serial++, x: origin.x, z: origin.z, oldX: origin.x, oldZ: origin.z, owner: shot.owner,
      ownerUid: shot.ownerUid, weaponId: shot.weaponId, bulletId: id, modelId: b.ModelId, vx: Math.sin(shot.angle) * speed, vz: Math.cos(shot.angle) * speed,
      attackSnapshot: shot.attack, hitBuffs: [...(state?.hitBuffs || []), ...w.mods.filter((m: RecordData) => m.type === 'BuffMod').map((m: RecordData) => ({ buffId: m.parameters.BuffId, probability: m.parameters.Rate ?? 1, forceAdd: Boolean(m.parameters.ForceAdd) }))].map(mod => ({ ...mod })),
      age: 0, lifetime: b.LifeTime > 0 ? b.LifeTime * (1 + (state?.lifetimePercent || 0)) + (state?.lifetime || 0) + (modification?.DeltaLifeTime || 0) : Infinity,
      scale, damage: shot.attack * ownerAttackRatio * multiplier * (1 + (shot.cooldownResetAttack || 0)) * (shot.owner === 'player' ? 1 + (this.specialWeaponDamage.get(shot.weaponId) || 0) : 1) * (1 + (state?.damageBonus ?? shot.bonus ?? 0)) * (1 + (state?.skillDamage || 0)) * (1 + (state?.nativeAttributes?.['WeaponDamageAdd%'] || 0)) * (shot.owner === 'player' ? 1 + nativeElementAndTraitDamageBonus(name => entryWeaponAttribute(this.content.combat, name) + (state?.nativeAttributes?.[name] || 0) * 100, b.Element, b.BulletTrait) : 1), radiusX: (b.Shape[0] ?? 0.25) * (1 + (state?.beamWidth || 0)) * scale,
      radiusZ: (beam ? b.Shape[0] || 0.25 : b.Shape[1] ?? b.Shape[0] ?? 0.25) * scale, offsetZ: (b.ShapeOffset?.[1] || 0) * scale,
      angle: shot.angle, pierce: Math.max(0, Number(through?.ThroughCount || 0) + (state?.pierce || 0) + (through ? modification?.DeltaThroughCount || 0 : 0)),
      bounce: Number(rebound?.ReBoundCount || 0), follow: Number(follow?.RotateSpeed || 0) + (state?.homing || 0), hit: new Set(), beam, beamLength: beam ? Number(b.Shape[1] || 50) * (1 + (state?.beamLength || 0)) : 0,
      dead: false, hitInterval: (b.MinBulletHurtTime ?? 0.1) * (state?.hitIntervalFactor ?? 1), hitTimes: new Map(), box: b.Shape.length > 1,
      critChance: this.content.chapter.player.critRate + this.globalCrit + (state?.critBonus || 0), critMultiplier: Math.max(1, 1.5 + entryWeaponAttribute(this.content.combat, 'CritValue%') / 100 + this.globalCritDamage + (state?.critDamage || 0)),
      warmup: 0, familyId: shot.familyId || 0, reflections: state?.reflections || 0,
      ray: /ReflectionRay/.test(w.trajectory), segments: [], anchorX: 0, anchorZ: 0, throughScale: 1,
      throughDamage: state?.disableThroughReduction || (!through && !(state?.pierce)) ? 0 : resolveThroughDelta(through?.AttackPercent === undefined ? undefined : Number(through.AttackPercent), state?.throughDamage),
      ricochet: Number(eject?.EjectCount || 0) + Number(state?.nativeAttributes?.EjectMod_EjectCount || 0), ricochetRange: Number(eject?.EjectDistance || 0), ricochetDamage: Number(eject?.AttackPercent || 0) * 100, ricochetSpeed: Number(eject?.SpeedPercent || 0) * 100,
      explosion: explosion ? { weaponId: explosion.WeaponId,
        radius: nativeExplosionRadius({ explodeRadius: Number(explosion.ExplodeRadius || 0), bulletFlags: Number(b.Flag || 0),
          mainWeaponExplosionRadius: state?.nativeAttributes?.MainWeaponExplosionMod_ExplodeRadius,
          explodeRadiusPercent: state?.nativeAttributes?.['ExplodeRadius%'], allMissileExplodeRadiusPercent: state?.nativeAttributes?.['AllMissileExplodeRadius%'],
          allSkillRangePercent: state?.nativeAttributes?.['AllSkillRange%'], bulletTraitAreaScalePercent: state?.nativeAttributes?.['BulletTraitAreaScale%'] }),
        onCrit: Boolean(explosion.TriggerOnCrit), onTargetPosition: Boolean(explosion.ExplodeOnTargetPosOnCrit), consecutiveCount: Number(explosion.ConsecutiveExplosionCount || 0) } : undefined,
      scaleAnimation: scaleAnimation && !scaleAnimation.Trigger ? { start: scaleAnimation.StartScale, target: scaleAnimation.TargetScale, duration: scaleAnimation.ScaleTime, wait: scaleAnimation.WaitTime } : undefined,
      followLimit: Number(follow?.DeviationAngle || 0) * Math.PI / 180, followTurned: 0,
      birth: { ...origin }, ownerAngleAtBirth: actor && 'angle' in actor ? actor.angle : 0,
      localMount: shot.localAnchor && shot.anchor ? { ...shot.anchor } : undefined,
      runtimeMods: w.mods, flags: finalFlags, traits: Number(b.BulletTrait || 0),
      trajectory: w.trajectory, trajectoryParameters: w.trajectoryParameters,
      damageDisabled: Boolean(w.trajectoryParameters?.DisableHurtTarget), repeatHits: true, targetUid: shot.targetUid,
    };
    this.loadoutBulletMotion.set(projectile, { distance: 0, x: projectile.x, z: projectile.z, angle: projectile.angle, deviation: 0 });
    const colliderMod = w.mods.find((mod: RecordData) => mod.type === 'ScaleOnlyColliderMod')?.parameters;
    if (colliderMod) {
      const controller = new NativeColliderScale(colliderMod); this.colliderScales.set(projectile, controller);
      projectile.radiusX = Number(b.Shape[0]) * controller.scale; projectile.radiusZ = Number(b.Shape[1] ?? b.Shape[0]) * controller.scale;
    }
    this.bulletBase.set(projectile, { damage: projectile.damage, scale: projectile.scale, radiusX: projectile.radiusX, radiusZ: projectile.radiusZ, speed,
      attributes: { ...(state?.nativeAttributes || {}) } });
    // FollowModProcessor.OnModBuildComplete adds the source default trait128,
    // separately from its RotateSpeed/DeviationAngle attributes.
    if (w.mods.some((mod: RecordData) => mod.type === 'PersistentMod')) projectile.flags = nativeInstallPersistentMod(projectile.flags);
    if (follow) this.addProjectileTraits(projectile, Number(follow.BulletTrait ?? 128));
    if (shot.extraTraits) this.addProjectileTraits(projectile, shot.extraTraits);
    if (projectile.hitBuffs.length) projectile.flags = (projectile.flags || 0) | 0x200000;
    if (projectile.flags! & 524288) projectile.critChance = 0;
    for (const mod of w.mods.filter((mod: RecordData) => mod.type === 'ExplosionMod')) this.addExplosionRuntime(projectile, mod.parameters);
    if (w.mods.some((mod: RecordData) => mod.type === 'DisableThroughMod')) projectile.pierce = 0;
    if (w.mods.some((mod: RecordData) => mod.type === 'DisableThroughAttackPercentReduceMod')) projectile.throughDamage = 0;
    const blackHole = w.mods.find((mod: RecordData) => mod.type === 'BlackHoleMod')?.parameters;
    if (blackHole) {
      projectile.flags = blackHole.IgnoreThroughMapOutWall ? projectile.flags! & ~0x2000000 : projectile.flags! | 0x2000000;
      this.addProjectileTraits(projectile, Number(blackHole.BulletTrait ?? 512));
    }
    const anchor = shot.owner === 'player' ? this.player : this.enemies.find(e => e.uid === shot.ownerUid);
    if (anchor) { projectile.anchorX = projectile.x - anchor.x; projectile.anchorZ = projectile.z - anchor.z; }
    const externalShapeScale = (shot as Shot & { externalShapeScale?: number }).externalShapeScale;
    if (externalShapeScale !== undefined) {
      projectile.radiusX *= externalShapeScale; projectile.radiusZ *= externalShapeScale;
      const base = this.bulletBase.get(projectile);
      if (base) { base.radiusX = projectile.radiusX; base.radiusZ = projectile.radiusZ; }
    }
    this.projectiles.push(projectile);
    if (shot.owner === 'player' && nativeDropMissileWeaponSupported(shot.weaponId))
      this.deathExplosionScales.set(projectile, nativeBulletScale(Number(b.Scale ?? 1), finalFlags, Number(b.BulletTrait || 0), state?.nativeAttributes,
        { nextFireModifiers: fireBoost, modificationDelta: modification?.DeltaScalePercent, allowModificationWhenIgnored: modification?.AllowScaleWhenIgnored }));
    projectile.originalThroughCount = projectile.pierce;
    projectile.suppressFirstTargetEvent = speed !== 0 && Number(state?.nativeAttributes?.BulletRangeAttack || 0) > 0 && [1, 3].includes(Number(b.Type));
    if (shot.owner === 'enemy' && w.trajectory === 'Laser' && actor && 'entityId' in actor
      && !w.trajectoryParameters?.EnableLock && !follow && !rebound) {
      const entity = this.content.chapter.entities[actor.entityId];
      projectile.beamLength = nativePlainLaserLength(Number(b.Shape[1]), Number(entity.parameters.BulletLifeRange), origin, actor, finalFlags);
      this.plainLasers.set(projectile, nativePlainLaserRay(origin, shot.angle, projectile.beamLength));
    }
    if (shot.owner === 'player') {
      // Scale was calculated by Weapon.GetBulletScalePercent above; copying
      // it again into the live scale bucket would apply the same boost twice.
      const { 'BulletScale%': _birthScale, ...copied } = fireBoost;
      this.applyBulletAttributes(projectile, copied);
      this.updateDynamicBulletAttributes(projectile);
    }
    this.projectileMotions.set(projectile, createNativeProjectileMotion(shot.angle, shot.radial, shot.mirror ?? 1, shot.attack));
    if (w.trajectory === 'LaserRotateByOwner') this.rotatingLasers.set(projectile,
      createNativeRotatingLaser(w.trajectoryParameters || {}, shot.angle, projectile.ownerAngleAtBirth || 0));
    if (w.trajectory === 'LaserRandomPoints') {
      const parameters = w.trajectoryParameters || {};
      this.randomLasers.set(projectile, createNativeRandomLaser(parameters));
      this.randomLaserWarnings.set(projectile, []);
      projectile.lifetime += nativeRandomLaserPreFireDuration(parameters);
    }
    if (w.trajectory === 'SpecialLaserStick') this.specialLasers.set(projectile, {});
    if (w.trajectory === 'LaserSymmetricByOwner') {
      this.symmetricLasers.set(projectile, { parameters: w.trajectoryParameters || {}, pointShown: false });
      projectile.beam = true; projectile.collisionDisabled = true; projectile.segments = [];
    }
    if (w.trajectory === 'SectorSpreadMod') {
      const parameters = w.trajectoryParameters, attr = { ...(state?.nativeAttributes || {}) };
      for (const [name, value] of Object.entries(fireBoost)) attr[name] = (attr[name] || 0) + value;
      this.sectors.set(projectile, new NativeSectorSpreadRuntime({ origin, ownerYawDegrees: shot.angle * 180 / Math.PI,
        rayCount: parameters.RayCount, spreadAngleDegrees: parameters.SpreadAngle, expansionTime: parameters.ExpansionTime,
        maxRadius: nativeSectorRadius({ spreadRadius: parameters.SpreadRadius, shotgunRadius: attr.ShotgunRadius,
          allShotgunRadius: attr.AllShotgunRadius, shotgunRadiusPercent: attr['ShotgunRadius%'], allShotgunRadiusPercent: attr['AllShotgunRadius%'] }) }));
      projectile.fixedSegments = true; projectile.radiusX = projectile.radiusZ = 0; projectile.pierce = Infinity;
    }
    if (['FixedPos', 'OverLapShapeAndStay', 'FollowOwner', 'Thunder', 'FallDown'].includes(w.trajectory)) {
      projectile.held = true; projectile.pierce = Infinity;
      if (w.trajectory === 'FallDown') {
        this.falling.set(projectile, { height: Number(w.trajectoryParameters.Height || 0), speed, elapsed: 0, landed: false });
        projectile.flags = (projectile.flags || 0) | 0x200;
        projectile.collisionDisabled = true;
      }
    }
    if (w.trajectory === 'MoveAndReturnStay') {
      projectile.held = true; projectile.pierce = Infinity;
      this.returningProjectiles.set(projectile, new NativeReturningProjectileRuntime({ position: () => projectile, owner: () => this.player, rootAlive: () => this.player.hp > 0,
        speedPercent: () => (this.weaponAttributes(projectile.familyId)['BulletSpeed%'] || 0) + (this.bulletAttributes.get(projectile)?.['BulletSpeed%'] || 0) + (this.bulletBase.get(projectile)?.attributes['AllBulletSpeed%'] || 0) + (this.bulletAttributes.get(projectile)?.['AllBulletSpeed%'] || 0),
        pose: point => { projectile.x = point.x; projectile.z = point.z; }, kill: () => { projectile.dead = true; },
      }, w.trajectoryParameters, { baseSpeed: Number(b.MoveSpeed) + Number(state?.nativeAttributes?.BulletSpeed || 0), forward: { x: Math.sin(shot.angle), z: Math.cos(shot.angle) }, hurtSourcePosition: this.lastPlayerAttacker }));
    }
    for (const mod of w.mods.filter((mod: RecordData) => mod.type === 'KillBulletMod')) this.installProjectileKillBullet(projectile, mod.parameters);
    if (shot.owner === 'player' && (this.installedWeaponActions.get(shot.familyId || this.content.chapter.player.weaponEntityId) || []).some(command => command.action === 63 && command.args.EnableBulletDestruction))
      this.installProjectileKillBullet(projectile, {});
    if (w.trajectory === 'FollowOwner' && !w.trajectoryParameters.TriggerOnly) this.installProjectileKillBullet(projectile, w.trajectoryParameters, true);
    if (w.trajectory === 'Thunder') {
      projectile.collisionDisabled = true;
      this.thunders.set(projectile, new NativeThunderRuntime({ position: () => projectile,
        owner: () => ({ ...this.player, yawDegrees: 0 }), pose: point => { projectile.x = point.x; projectile.z = point.z; },
        targetUid: () => projectile.targetUid, canHit: uid => this.enemies.some(enemy => enemy.uid === uid && !enemy.dead),
        hit: uid => {
          projectile.collisionDisabled = false; this.forcedProjectileTargets.set(projectile.uid, uid);
          this.collisions(projectile, true); this.forcedProjectileTargets.delete(projectile.uid); projectile.collisionDisabled = true;
        }, targetAlive: () => false, hasCheckAddBuff: () => false, addBuffToTarget: () => {},
        render: uid => {
          const target = this.enemies.find(e => e.uid === uid);
          if (target) projectile.segments = [{ from: { x: projectile.x, z: projectile.z }, to: { x: target.x, z: target.z } }];
        },
      }, Number(w.trajectoryParameters.UseFirePos || 0)));
    }
    if (w.mods.some((mod: RecordData) => mod.type === 'RandomTargetMod')) {
      const choices = this.enemies.filter(e => !e.dead && this.inCamera(e));
      projectile.targetUid = choices[Math.floor(this.random() * choices.length)]?.uid;
    }
    const fissions = w.mods.filter((mod: RecordData) => mod.type === 'HitBehindFissionMod');
    if (fissions.length) {
      const fission = new NativeHitBehindFissionRuntime(fissions[0].parameters);
      for (const mod of fissions.slice(1)) fission.addRepeat(mod.parameters);
      this.behindFissions.set(projectile, fission); this.addProjectileTraits(projectile, fission.sourceInitTraits);
    }
    const weak = w.mods.find((mod: RecordData) => mod.type === 'WeakLaserMod')?.parameters;
    if (weak) for (const uid of nativeWeakLaserReplacementUids(this.content.chapter.weapons[weak.WeaponId]?.bulletId, this.projectiles)) {
      const old = this.projectiles.find(b => b.uid === uid); if (old) old.dead = true;
    }
    if (eject) {
      const runtime = new NativeEjectRuntime(eject, state?.nativeAttributes || {}, { flags: projectile.flags }, () => this.random());
      this.addProjectileTraits(projectile, runtime.trait);
      if (flashChain) this.arcChains.set(projectile, new NativeArcChain({ chainWeaponId: flashChain.ChainWeaponId, startChainWeaponId: flashChain.StartChainWeaponId,
        ejectCount: runtime.remainingCount, ejectDistance: runtime.range, ejectDelay: runtime.delay,
        ejectProbability: 1, randomType: Number(eject.EjectModRandomType || 0), attackPercent: Number(eject.AttackPercent || 0) + Number(state?.nativeAttributes?.['EjectHurtReduce%'] || 0) }));
      else this.ejections.set(projectile, runtime);
    }
    const sound = projectileSound(projectile, Number(b.bulletStartSoundId || 0), this.content.chapter.player.weaponEntityId);
    const skillSound = sound === -15 || sound === -16 || sound === -19 || sound === -21 || sound === -22 || sound === -23 || sound === -25;
    const playedSkillSounds = shot.fireGroup && this.skillSoundGroups.get(shot.fireGroup);
    // Native action90 emits three slashes 0.15s apart. One burst, one sound.
    const slashReady = sound !== -19 || this.clock - this.skillSlashAudioAt >= .5;
    if (!shot.silentAudio && sound && slashReady && !(skillSound && playedSkillSounds?.has(sound)) && (shot.owner === 'player' || !shot.fireGroup || !this.enemySoundGroups.has(shot.fireGroup))) {
      this.sounds.push(sound);
      if(sound === -19)this.skillSlashAudioAt = this.clock;
      if(skillSound && shot.fireGroup){const played=playedSkillSounds||new Set<number>();played.add(sound);this.skillSoundGroups.set(shot.fireGroup,played);}
      if (shot.owner === 'enemy' && shot.fireGroup) this.enemySoundGroups.add(shot.fireGroup);
    }
    const birthEffect = b.bulletStartPrefabId || w.parameters?.FireEffectId;
    // A detached FireEffect must not inherit the collision animation's zero
    // start scale forever (acid explosion 200068 grows from 0 to 3 in .2s).
    const birthEffectScale = scaleAnimation ? nativeBulletScale(Number(b.Scale ?? 1), finalFlags, Number(b.BulletTrait || 0), state?.nativeAttributes,
      { nextFireModifiers: fireBoost, modificationDelta: modification?.DeltaScalePercent, allowModificationWhenIgnored: modification?.AllowScaleWhenIgnored }) : scale;
    if (birthEffect) { const fx = this.effect('muzzle', origin.x, origin.z, .1, .45, undefined, birthEffect); fx.angle = shot.angle; fx.originalScale = birthEffectScale * ((shot as Shot & { fireEffectScale?: number }).fireEffectScale ?? 1); markMissileExplosionVisual(fx, shot); markFrostBurstVisual(fx, shot); }
    if (shot.owner === 'player') {
      const pending = this.pendingBulletAttributes.consume(shot.familyId || this.content.chapter.player.weaponEntityId, shot.weaponId);
      if (Object.keys(pending).length) this.applyBulletAttributes(projectile, pending);
      this.planeSpecials?.onBulletCreate(shot.familyId || 0, projectile.uid, shot.weaponId);
      this.dispatchWeaponEvent(7, shot.familyId || 0, { weaponId: shot.weaponId, bullet: projectile, point: origin });
    }
    const prism = w.mods.find((mod: RecordData) => mod.type === 'LaserPrismMod');
    if (prism) this.installPrism(projectile, prism.parameters);
    return projectile;
  }
  private moveProjectile(b: Projectile, dt: number) {
    if (b.dead) return;
    if (b.owner === 'player') this.updateDynamicBulletAttributes(b);
    // Stationary direct-target lightning is not an unreleased held missile.
    if (b.held && b.collisionDisabled && !this.falling.has(b) && !this.thunders.has(b)) return;
    b.oldX = b.x; b.oldZ = b.z; b.age += dt;
    if (nativeBulletUsesLifetimeExpiration(b.flags) && b.age >= b.lifetime) { b.dead = true; const fx = this.symmetricLasers.get(b)?.pointEffect; if (fx) fx.duration = fx.age; return; }
    const prismSide = this.prismSides.get(b);
    if (prismSide) {
      if (prismSide.parent.dead) { b.dead = true; return; }
      b.x = prismSide.parent.x + prismSide.offset.x; b.z = prismSide.parent.z + prismSide.offset.z;
      b.segments = [{ from: { x: b.x, z: b.z }, to: { x: b.x + Math.sin(b.angle) * b.beamLength, z: b.z + Math.cos(b.angle) * b.beamLength } }];
      return;
    }
    const symmetric = this.symmetricLasers.get(b);
    if (symmetric) {
      const owner = b.owner === 'player' ? this.player : this.enemies.find(e => e.uid === b.ownerUid && !e.dead);
      if (!owner) { b.dead = true; if (symmetric.pointEffect) symmetric.pointEffect.duration = symmetric.pointEffect.age; return; }
      const params = symmetric.parameters, yaw = 'angle' in owner ? owner.angle : 0;
      const offset = this.rotateMount({ x: Number(params.LaserXPos || 0), z: Number(params.LaserYPos || 0) }, yaw);
      b.x = owner.x + offset.x; b.z = owner.z + offset.z; b.angle = yaw;
      if (!symmetric.pointShown && b.age >= Number(params.PointShowDelay || 0)) {
        symmetric.pointShown = true;
        if (Number(params.FirePointEffectId) > 0) symmetric.pointEffect = this.effect('muzzle', b.x, b.z, Infinity, 1, undefined, Number(params.FirePointEffectId));
      }
      if (symmetric.pointEffect) { symmetric.pointEffect.x = b.x; symmetric.pointEffect.z = b.z; }
      const firing = b.age >= Number(params.LaserFireDelayTime || 0);
      b.collisionDisabled = !firing;
      b.segments = firing ? [{ from: { x: b.x, z: b.z }, to: { x: b.x + Math.sin(yaw) * b.beamLength, z: b.z + Math.cos(yaw) * b.beamLength } }] : [];
      return;
    }
    const ejection = this.ejections.get(b);
    if (ejection?.waiting) { this.applyEjectOutcome(b, ejection.update(dt, this.ejectHost(b))); return; }
    const sourceWeapon = { ...this.content.chapter.weapons[b.weaponId], trajectory: b.trajectory || this.content.chapter.weapons[b.weaponId].trajectory,
      trajectoryParameters: b.trajectoryParameters || this.content.chapter.weapons[b.weaponId].trajectoryParameters };
    const spin = b.runtimeMods?.find(mod => mod.type === 'SelfRotationMod')?.parameters;
    if (spin?.EnableSelfRotation) b.visualAngle = (b.visualAngle ?? b.angle) + Number(spin.SelfRotateSpeed || 0) * Math.PI / 180 * dt;
    const thunder = this.thunders.get(b);
    if (thunder) { thunder.step(); if (b.age >= b.warmup) thunder.tickHit(); return; }
    const returning = this.returningProjectiles.get(b);
    if (returning) { returning.step(dt); return; }
    const fall = this.falling.get(b);
    if (fall && !fall.landed) {
      const params = sourceWeapon.trajectoryParameters;
      fall.elapsed += dt;
      if (fall.elapsed < Number(params.StayTime || 0)) return;
      // Native FallDown stores speed+=G per logic tick, then advances speed*dt.
      fall.speed += Number(params.G || 0); fall.height -= fall.speed * dt;
      if (fall.height <= Number(params.StayHeight || 0)) {
        fall.landed = true;
        if (params.FallDownEffect && !params.StayOnLand) {
          b.oldX = b.x; b.oldZ = b.z; b.collisionDisabled = false;
          // TickHit overlaps the parent's real shape before firing its child.
          // directTarget=true would bypass that shape and damage every enemy.
          this.collisions(b);
        }
        if (params.FallDownWeaponId) this.emitPlayerWeapon(params.FallDownWeaponId, b.familyId, b, 0, b.targetUid, 8);
        if (params.FallDownEffect) this.effect('hit', b.x, b.z, .4, 1, undefined, params.FallDownEffect);
        b.dead = !params.StayOnLand; b.collisionDisabled = Boolean(b.dead);
      }
      return;
    }
    if (sourceWeapon.trajectory === 'FollowOwner') { b.x = this.player.x; b.z = this.player.z; }
    const sector = this.sectors.get(b);
    if (sector) { b.segments = [...sector.advance(dt)]; return; }
    if (b.fixedSegments) {
      const link = this.arcLinks.get(b);
      if (link && b.weaponId === 200006 && b.segments.length) b.segments[0].from = { x: this.player.x + b.anchorX, z: this.player.z + b.anchorZ };
      return;
    }
    const arc = this.arcChains.get(b);
    if (arc?.waiting) {
      if (arc.advance(dt)) {
        const target = arc.resolveNextTarget(this.enemies.filter(e => this.inCamera(e)).map(e => ({ ...e, hitCamp: 2,
          noEject: Boolean(nativeMonsterAttribute(this.content.chapter.entities[e.entityId].raw.MonsterAbility, 'ImmuneBulletEject')) })), () => this.random(), b, uid => this.enemies.find(e => e.uid === uid));
        if (!target) { b.dead = true; return; }
        b.targetUid = target.uid; b.angle = Math.atan2(target.x - b.x, target.z - b.z);
        const speed = Math.hypot(b.vx, b.vz); b.vx = Math.sin(b.angle) * speed; b.vz = Math.cos(b.angle) * speed;
      }
      return;
    }
    this.updateProjectileScaleAnimation(b);
    if (b.held) return;
    if (b.beam) {
      const special = this.specialLasers.get(b);
      if (special) {
        const owner = b.owner === 'player' ? this.player : this.enemies.find(e => e.uid === b.ownerUid && !e.dead);
        if (!owner) { b.dead = true; return; }
        b.x = owner.x + b.anchorX; b.z = owner.z + b.anchorZ;
        let target = this.enemies.find(e => e.uid === special.targetUid && !e.dead);
        // LaserLockMod is BulletData.EnableLaserLock. Once acquired, the
        // original retains a living target even when it leaves the range.
        if (!target && b.owner === 'player' && b.runtimeMods?.some((m: RecordData) => m.type === 'LaserLockMod')) {
          target = this.enemies.filter(e => this.enemyChooseable(e) && Math.hypot(e.x - owner.x, e.z - owner.z) <= 15)
            .sort((a, e) => Math.hypot(a.x - owner.x, a.z - owner.z) - Math.hypot(e.x - owner.x, e.z - owner.z))[0];
          special.targetUid = target?.uid;
        }
        const end = target ? { x: target.x, z: target.z } : { x: b.x + Math.sin(b.angle) * b.beamLength, z: b.z + Math.cos(b.angle) * b.beamLength };
        b.segments = [{ from: { x: b.x, z: b.z }, to: end }]; return;
      }
      const plain = this.plainLasers.get(b);
      if (plain) {
        // Ordinary Laser caches its world ray on creation. Actor movement,
        // rotation or death is not an implicit BulletLaserUpdateData event29.
        b.x = plain.start.x; b.z = plain.start.z; b.angle = plain.angle;
        b.segments = [{ from: { ...plain.start }, to: { x: b.x + Math.sin(plain.angle) * plain.length, z: b.z + Math.cos(plain.angle) * plain.length } }];
        return;
      }
      const randomLaser = this.randomLasers.get(b);
      if (randomLaser) {
        const update = advanceNativeRandomLaser(randomLaser, dt, this.cameraBounds(), () => this.random());
        const warnings = this.randomLaserWarnings.get(b)!;
        for (const marker of update.addedPointEffects) {
          const effect = this.effect('muzzle', marker.point.x, marker.point.z, Infinity, 1, undefined, marker.effectId);
          // This effect belongs to the point's lifetime, not its asset clip.
          effect.duration = Infinity; warnings.push(effect);
        }
        if (update.removePointEffects) for (const effect of warnings) effect.duration = effect.age;
        b.segments = nativeRandomLaserSegments(randomLaser).map(segment => ({ from: segment.start, to: segment.end }));
        return;
      }
      const owner = b.owner === 'player' ? this.player : this.enemies.find(e => e.uid === b.ownerUid && !e.dead);
      if (!owner) { b.dead = true; return; }
      b.x = owner.x + b.anchorX; b.z = owner.z + b.anchorZ;
      const rotating = this.rotatingLasers.get(b);
      if (rotating) {
        const next = advanceNativeRotatingLaser(rotating, dt, { ...owner, angle: 'angle' in owner ? owner.angle : 0 }, b.localMount);
        b.x = next.start.x; b.z = next.start.z; b.angle = next.angle;
      }
      b.segments = [];
      if (b.ray && b.owner === 'player') {
        this.reflectionRays ??= new NativeReflectionRayRuntime({ owner: () => ({ uid: 0, camp: 1, x: this.player.x, z: this.player.z }),
          targets: () => this.enemies.map(e => ({ uid: e.uid, x: e.x, z: e.z, alive: !e.dead, inCamera: this.inCamera(e), camp: 2 })), random: () => this.random(),
          firstTargetDistance: (uid, target) => { const b = this.projectiles.find(b => b.uid === uid)!; const e = this.enemies.find(e => e.uid === target.uid)!; return Math.hypot(target.x - this.player.x, target.z - this.player.z) - nativeShapeRadii(this.content.chapter.entities[e.entityId].stats.shape).radius2 - nativeShapeRadii(this.content.chapter.entities[b.familyId].stats.shape).radius2; },
          canSelectFirst: (_, target) => this.enemyChooseable(this.enemies.find(e => e.uid === target.uid)!),
          onTargetReplaced: (uid, targetUid) => { const source = this.projectiles.find(b => b.uid === uid); const target = this.enemies.find(e => e.uid === targetUid); if (source && target) this.dispatchExplosionEvent(source, { id: 37, changedTarget: { position: target, type: this.content.chapter.entities[target.entityId].raw.Type } }); },
        });
        const attr = this.weaponAttributes(b.familyId), trajectory = sourceWeapon.trajectoryParameters;
        const path = this.reflectionRays.step(b.uid, dt, { attackDistance: Number(attr.AttackDistance ?? this.content.chapter.entities[b.familyId].raw.AttackDistance) * (1 + (attr['AttackDistance%'] || 0)),
          reflectionRange: Number(trajectory.ReflectionRange), reflectionCount: 0, ownerReflectionCount: attr.ReflectionCount || 0, selfReflectionCount: this.bulletAttributes.get(b)?.ReflectionCount || 0 });
        let origin: Point = b;
        for (const targetUid of path) {
          const target = this.enemies.find(e => e.uid === targetUid && !e.dead); if (!target) break;
          b.segments.push({ from: { x: origin.x, z: origin.z }, to: { x: target.x, z: target.z } });
          origin = target;
        }
        this.rayPaths.set(b.uid, [...path]);
      } else {
        const from = { x: b.x, z: b.z }, to = { x: b.x + Math.sin(b.angle) * b.beamLength, z: b.z + Math.cos(b.angle) * b.beamLength };
        if (b.owner === 'player') {
          const traits = Number(this.content.chapter.bullets[b.bulletId]?.parameters.BulletTrait || 0);
          let block = 1;
          for (const enemy of this.enemies) {
            if (enemy.dead || !nativeMonsterBlocksThrough(this.content.chapter.entities[enemy.entityId].raw.MonsterAbility, traits)) continue;
            const at = sweep({ ...b, ...to, oldX: from.x, oldZ: from.z, box: false }, enemy);
            if (at !== null) block = Math.min(block, at + 1e-7);
          }
          to.x = lerp(from.x, to.x, block); to.z = lerp(from.z, to.z, block);
        }
        b.segments.push({ from, to });
      }
      return;
    }
    // MoveStraightProcessor 0x6d84034..0x6d841c8: DeviationAngle is the
    // cumulative turning limit; it is not a targeting cone or a per-frame angle.
    if (b.follow && (!b.followLimit || (b.followTurned || 0) <= b.followLimit)) {
      const target = b.owner === 'player' ? this.enemies.find(enemy => enemy.uid === b.targetUid && !enemy.dead) || this.closestEnemy(b) : this.player;
      if (target) {
        const angle = Math.atan2(target.x - b.x, target.z - b.z);
        const change = Math.atan2(Math.sin(angle - b.angle), Math.cos(angle - b.angle));
        const turn = clamp(change, -b.follow * Math.PI / 180 * dt, b.follow * Math.PI / 180 * dt);
        b.angle += turn; b.followTurned = (b.followTurned || 0) + Math.abs(turn);
        const speed = Math.hypot(b.vx, b.vz); b.vx = Math.sin(b.angle) * speed; b.vz = Math.cos(b.angle) * speed;
      }
    }
    const weapon = { ...sourceWeapon, mods: b.runtimeMods || this.content.chapter.weapons[b.weaponId].mods };
    const motion = this.projectileMotions.get(b)!;
    if (weapon.trajectory === 'MoveSnake') advanceNativeSnake(b, motion, weapon.trajectoryParameters || {}, dt);
    else if (weapon.trajectory === 'MoveDiffusion') advanceNativeDiffusion(b, motion, weapon.trajectoryParameters || {}, dt);
    else {
      if (weapon.trajectory === 'MoveStraight') advanceNativeStraightSpeed(b, motion, weapon.trajectoryParameters || {}, dt);
      b.x += b.vx * dt; b.z += b.vz * dt;
    }
    const timeCreate = weapon.mods.find((mod: RecordData) => mod.type === 'TimeCreateMod')?.parameters;
    if (timeCreate && Number(timeCreate.Interval) > 0) {
      motion.createElapsed += dt;
      if (motion.createElapsed >= Number(timeCreate.Interval)) {
        motion.createElapsed -= Number(timeCreate.Interval);
        const bounds = this.cameraBounds();
        const owner = b.owner === 'player' ? this.player : this.enemies.find(e => e.uid === b.ownerUid && !e.dead);
        if (owner && b.x >= bounds.left && b.x <= bounds.right && b.z >= bounds.bottom && b.z <= bounds.top) {
          // TimeCreate's OffsetY is altitude. The shipped OffsetX spelling on
          // 50014 is not a parameter in this APK and must not shift world X.
          const first = this.shots.length;
          this.queueWeapon(Number(timeCreate.WeaponId), b.owner, b, b.ownerUid, motion.attack, b.angle, undefined, 0, b.familyId);
          for (const child of this.shots.slice(first)) {
            child.origin = { x: b.x, z: b.z }; child.anchor = undefined; child.localAnchor = false; child.flags = 0x88; child.fireEvent = false;
          }
        }
      }
    }
    const camera = this.cameraBounds();
    const distanceDeath = weapon.mods.find((mod: RecordData) => mod.type === 'MoveDisDieMod')?.parameters;
    if (distanceDeath && b.birth && Math.hypot(b.x - b.birth.x, b.z - b.birth.z) >= Number(distanceDeath.BulletLifeRange)) b.dead = true;
    const onWall = weapon.mods.find((mod: RecordData) => mod.type === 'FireOnHittingWallMod')?.parameters;
    if ((b.bounce > 0 || onWall) && !((b.flags || 0) & 0x2000000)) {
      const wall = nativeCameraWallHit({ x: b.oldX, z: b.oldZ }, b, Math.max(b.radiusX, b.radiusZ), this.cameraBounds());
      if (wall) {
        const rebound = weapon.mods.find((mod: RecordData) => mod.type === 'ReboundMod')?.parameters || {};
        const allowed = !(rebound.OnlyEnable4HSideWall && wall.normal.z !== 0) && !(rebound.OnlyEnable4VSideWall && wall.normal.x !== 0);
        if (onWall && this.random() < Number(onWall.FireRate ?? 1)) {
          // SpawnWallReflectionBullet rotates the inward WALL NORMAL, not
          // the incoming bullet. ReflectionAngle defaults to zero in ctor.
          const angle = Math.atan2(wall.normal.x, wall.normal.z) + Number(onWall.ReflectionAngle || 0) * Math.PI / 180;
          const child = this.emitPlayerWeapon(Number(onWall.WeaponId), b.familyId, wall.point, angle, undefined, 8);
          if (child.beam) {
            child.fixedSegments = true;
            child.segments = [{ from: wall.point, to: { x: wall.point.x + Math.sin(angle) * child.beamLength, z: wall.point.z + Math.cos(angle) * child.beamLength } }];
          }
        }
        if (allowed && b.bounce > 0) {
          if (b.owner === 'player') this.dispatchWeaponEvent(38, b.familyId, { weaponId: b.weaponId, bullet: b, point: wall.point, direction: wall.normal, skipPlayer: true });
          b.x = wall.point.x; b.z = wall.point.z;
          if (Number(rebound.ReBoundType || 0) === 1) { b.vx *= -1; b.vz *= -1; }
          else { const dot = b.vx * wall.normal.x + b.vz * wall.normal.z; b.vx -= 2 * dot * wall.normal.x; b.vz -= 2 * dot * wall.normal.z; }
          b.bounce--; b.angle = Math.atan2(b.vx, b.vz);
        } else if ((allowed || !rebound.ThroughNonAllowedWall) && !weapon.mods.some((mod: RecordData) => mod.type === 'IgnoreNoReboundDieMod')) b.dead = true;
      }
    }
    if ((!nativeBulletIsPersistent(b.flags) || ((b.flags || 0) & 4)) && (b.x < camera.left - 5 || b.x > camera.right + 5 || b.z < camera.bottom - 8 || b.z > camera.top + 8)) b.dead = true;
  }
  private explodeDropMissile(bullet: Projectile) {
    if (bullet.owner !== 'player' || !nativeDropMissileWeaponSupported(bullet.weaponId) || bullet.held) return;
    const mods = bullet.runtimeMods || this.content.chapter.weapons[bullet.weaponId].mods;
    for (const mod of mods.filter((m: RecordData) => m.type === 'ExplosionUponDeathMod')) {
      const plan = nativeDeathExplosionPlan(mod.parameters, { eventId: 22,
        hasOwner: Boolean(this.playerWeaponState(bullet.familyId)),
        disabled: mods.some((m: RecordData) => m.type === 'DisableExplosionMod'),
        inMapSky: this.inCamera(bullet), bulletScalePercent: this.deathExplosionScales.get(bullet) ?? 1,
        ownerAttributes: this.weaponAttributes(bullet.familyId) });
      if (!plan) continue;
      if (plan.buffId) throw new Error('Unverified drop missile explosion BuffId');
      if (plan.clearBullets) {
        // OnEvent@6d255dc adds HitBullet32 and HitCamp.EnemyBullet16,
        // NOT the Split bullet trait. BulletData ctor@6a474b0 defaults rate1.
        bullet.flags = (bullet.flags || 0) | 32;
        const eraser = this.killBullets.get(bullet);
        if (eraser) eraser.hitCampMask |= 16;
        else this.killBullets.set(bullet, { runtime: new NativeKillBulletRuntime(1, 0), hitCampMask: 16 });
        this.killEnemyBullets(bullet, plan.radius);
      }
      if (plan.effectId) {
        const effect = this.effect('explosion', bullet.x, bullet.z, plan.effectLifetime, plan.radius * 2, undefined, plan.effectId);
        effect.originalScale = plan.radius;
      }
      this.collisions(bullet, false, { radius: plan.radius, multiplier: plan.damageMultiplier });
    }
  }
  private finalizeProjectileDeaths() {
    for (const [bullet, prism] of this.prisms) if (bullet.dead) { prism.dispose(); this.prisms.delete(bullet); }
    for (const bullet of this.projectiles) {
      const rotating = this.rotatingLasers.get(bullet);
      if (rotating && nativeRotatingLaserSweepFinished(rotating)) bullet.dead = true;
      if (bullet.dead) for (const effect of this.randomLaserWarnings.get(bullet) || []) effect.duration = effect.age;
      if (!bullet.dead || bullet.deathHandled) continue;
      bullet.deathHandled = true;
      this.explodeDropMissile(bullet);
      this.reflectionRays?.remove(bullet.uid); this.rayPaths.delete(bullet.uid);
      if (bullet.owner === 'player') this.dispatchExplosionEvent(bullet, { id: 22 });
      if (bullet.owner === 'player') for (const mod of bullet.runtimeMods || []) {
        const plan = mod.type === 'WeakLaserMod' ? nativeWeakLaserOnDeath(mod.parameters.WeaponId, this.derivedSource(bullet))
          : mod.type === 'CreateWeaponUponDeadMod' ? nativeCreateWeaponUponDeath(mod.parameters, this.derivedSource(bullet), this.bulletDeathPoints.get(bullet),
            this.content.chapter.weapons[bullet.weaponId].trajectory === 'LaserStick' ? { laserStartPosition: bullet, nonzero: Boolean(bullet.x || bullet.z) } : undefined) : undefined;
        if (plan) this.fireDerivedWeapon(bullet.familyId, plan);
      }
      if (bullet.owner === 'player') this.dispatchWeaponEvent(23, bullet.familyId, { weaponId: bullet.weaponId, bullet, point: bullet });
      const mod = (bullet.runtimeMods || this.content.chapter.weapons[bullet.weaponId].mods).find((item: RecordData) => item.type === 'WeaponFireOnDeadMod')?.parameters;
      if (!mod?.WeaponId) continue;
      const owner = bullet.owner === 'player' ? (this.player.hp > 0 ? this.player : undefined) : this.enemies.find(e => e.uid === bullet.ownerUid && !e.dead);
      if (!owner) continue;
      const first = this.shots.length;
      // Native OnBulletDestroyBefore creates at bullet position. OffsetY is
      // vertical altitude, not the scrolling plane's Z coordinate.
      // CreateWeaponAndFire receives the parent's rotation. KeepDir additionally
      // modifies FireInfo.loadData.startAngle (0x78), not the rotation twice.
      this.queueWeapon(Number(mod.WeaponId), bullet.owner, bullet, bullet.ownerUid, owner.attack, bullet.angle, undefined, 0, bullet.familyId, 0, mod.IsCreateBulletKeepDir === 1 ? bullet.angle : 0);
      for (const child of this.shots.splice(first)) {
        child.origin = { x: bullet.x, z: bullet.z }; child.anchor = undefined; child.localAnchor = false;
        child.flags = Number(child.flags || 0) | 0x88;
        // CreateWeaponAndFire -> WeaponFire -> FireOnce runs its first shot
        // here, rather than waiting for another ordinary owner attack cycle.
        if (child.at <= this.clock) this.emitProjectile(child);
        else this.shots.push(child);
      }
    }
  }
  private collisions(onlyBullet?: Projectile, directTarget = false, deathExplosion?: { radius: number; multiplier: number }) {
    const p = this.player;
    for (const b of this.projectiles) {
      if (onlyBullet && b !== onlyBullet) continue;
      if ((b.dead && !deathExplosion) || b.collisionDisabled || this.arcChains.get(b)?.waiting || this.ejections.get(b)?.waiting || b.age < b.warmup) continue;
      this.erasePlayerBulletsWithEnemyOrbit(b);
      const dx = Math.sin(b.angle), dz = Math.cos(b.angle);
      const offsetX = (b.offsetX || 0) * Math.cos(b.angle), offsetZ = -(b.offsetX || 0) * Math.sin(b.angle);
      const orbitFixed = b.owner === 'enemy' && b.weaponId === 70053;
      const a = { x: (orbitFixed ? b.x : b.oldX) + dx * b.offsetZ + offsetX, z: (orbitFixed ? b.z : b.oldZ) + dz * b.offsetZ + offsetZ };
      const end = b.beam ? { x: b.x + dx * b.beamLength, z: b.z + dz * b.beamLength } : { x: b.x + dx * b.offsetZ + offsetX, z: b.z + dz * b.offsetZ + offsetZ };
      const segments = deathExplosion ? [{ from: b, to: b }] : b.beam || b.fixedSegments ? b.segments : [{ from: a, to: end }];
      // EntityBullet.IsEntityCanHit (0x6a90010) stores an independent last-hit
      // time for each target. Entering a beam cannot inherit its global pulse.
      // Beam attenuation is spatial here; native accumulator reset remains
      // a fidelity boundary, separate from the verified per-target cooldown.
      if (b.beam) b.throughScale = 1;
      if (b.owner === 'player') {
        if (!deathExplosion) this.killEnemyBullets(b);
        if (b.dead && !deathExplosion) continue;
        const hits: { enemy: Enemy; at: number }[] = [];
        for (const e of this.enemies) {
          if (this.forcedProjectileTargets.has(b.uid) && this.forcedProjectileTargets.get(b.uid) !== e.uid) continue;
          if (e.dead || (!deathExplosion && !b.repeatHits && !b.beam && b.hit.has(e.uid))) continue;
          if (this.arcChains.get(b)?.lastTarget === e.uid) continue;
          let first: number | null = directTarget ? 0 : null;
          for (const [index, segment] of segments.entries()) {
            if (directTarget) break;
            const type8 = this.content.chapter.bullets[b.bulletId].parameters.Type === 8;
            const chain = this.arcLinks.has(b);
            const mid = { x: (segment.from.x + segment.to.x) / 2, z: (segment.from.z + segment.to.z) / 2 };
            const collider = chain ? { ...b, ...mid, oldX: mid.x, oldZ: mid.z, box: true, radiusX: b.radiusX,
              radiusZ: Math.hypot(segment.to.x - segment.from.x, segment.to.z - segment.from.z) / 2 }
              // Reflection rays collide along each selected target segment. Their
              // Type 8 record is not a stationary shape at the maximum range.
              : b.beam && b.ray ? { ...b, ...segment.to, oldX: segment.from.x, oldZ: segment.from.z, box: false }
              : type8 || ['FixedPos', 'SemiCircleMov2Mod', 'MoveAndReturnStay', 'OverLapShapeAndStay', 'FollowOwner'].includes(b.trajectory || '') ? { ...b, x: end.x, z: end.z, oldX: end.x, oldZ: end.z }
              : { ...b, ...segment.to, oldX: segment.from.x, oldZ: segment.from.z, box: b.beam || b.fixedSegments ? false : b.box };
            const at = sweep(deathExplosion ? { ...b, oldX: b.x, oldZ: b.z, box: false, radiusX: deathExplosion.radius, radiusZ: deathExplosion.radius, offsetX: 0, offsetZ: 0 } : collider, e);
            if (at !== null && (first === null || index + at < first)) first = index + at;
          }
          if (first !== null) hits.push({ enemy: e, at: first });
        }
        hits.sort((a, b) => a.at - b.at);
        if (b.beam && !b.ray) hits.length = Math.min(hits.length, b.pierce + 1);
        let rayThroughRemaining = b.pierce;
        for (const hit of hits) {
          const rayAttr = this.weaponAttributes(b.familyId), rayPath = this.rayPaths.get(b.uid) || [];
          const rayMultiplier = b.ray ? nativeReflectionDamageMultiplier(hit.enemy.uid, rayPath, Math.floor(hit.at), rayAttr['ReflectionHurtAdd%'] || 0,
            nativeReflectionPathHurtRate(rayAttr['ScorchingRayPathHurtRate%'] || 0, Number(this.content.chapter.weapons[b.weaponId].trajectoryParameters.PathHurtRate || 0)),
            (this.bulletAttributes.get(b)?.ExReflectionAttackPercent || 0) + (rayAttr.ExReflectionAttackPercent || 0)) : 1;
          if (rayMultiplier <= 0) continue;
          if (b.ray && !rayPath.includes(hit.enemy.uid)) {
            if (rayThroughRemaining <= 0) continue;
            if (!nativeMonsterBlocksThrough(this.content.chapter.entities[hit.enemy.entityId].raw.MonsterAbility, b.traits || 0)) {
              rayThroughRemaining--;
              this.dispatchExplosionEvent(b, { id: 32 });
            }
          }
          if (b.beam || b.repeatHits || nativeDropMissileWeaponSupported(b.weaponId)) {
            const lastHit = b.hitTimes.get(hit.enemy.uid);
            if (lastHit !== undefined && b.age - lastHit < b.hitInterval) {
              // A target on cooldown still occupies its place in the beam.
              if (!b.ray && b.throughDamage !== 0) b.throughScale = advanceThroughScale(b.throughScale, b.throughDamage, 1, true);
              continue;
            }
            b.hitTimes.set(hit.enemy.uid, b.age);
          }
          if (this.arcChains.has(b)) { this.createArcLink(b, hit.enemy); break; }
          if (!b.beam && !(b.flags! & 8) && this.weaponPrograms.get(b.familyId || this.content.chapter.player.weaponEntityId)?.hasEvent(70)) {
            const eject = this.ejections.get(b), host = this.ejectHost(b);
            const nextUid = eject?.admission(2, host) === 0 ? eject.predict(hit.enemy.uid, host) : undefined;
            const next = nextUid === undefined ? undefined : host.target(nextUid);
            this.dispatchWeaponEvent(70, b.familyId, { weaponId: b.weaponId, bullet: b, target: hit.enemy, point: hit.enemy, ejectCount: this.actualEjectCounts.get(b) || 0, willEject: next !== undefined && !next.dead, skipPlayer: true });
          }
          const characterAccepts = !this.statuses.modifiers(hit.enemy.uid).invincible;
          const historyKey = `${b.familyId}:${hit.enemy.uid}`, history = (this.weaponHitHistory.get(historyKey) || []).filter(time => this.clock - time <= 1);
          if (characterAccepts) { history.push(this.clock); this.weaponHitHistory.set(historyKey, history); }
          const exactKey = `${b.familyId}:${b.weaponId}:${hit.enemy.uid}`, exactHistory = this.exactWeaponHitHistory.get(exactKey) || [];
          if (characterAccepts) { exactHistory.push(this.clock); this.exactWeaponHitHistory.set(exactKey, exactHistory); }
          if (!this.firstBulletTargets.has(b)) {
            this.firstBulletTargets.set(b, hit.enemy.uid);
            // HurtTarget emits event34 once, before Character damage admission.
            // ElectricThunder has its own first-target path without this event.
            if (!this.thunders.has(b) && !b.suppressFirstTargetEvent)
              this.dispatchWeaponEvent(34, b.familyId, { weaponId: b.weaponId, bullet: b, target: hit.enemy, point: hit.enemy });
          }
          // Character.OnHitByBullet dispatches the owner counters and generic
          // hit before damage calculation. Invincibility gates that subflow;
          // a shield configured as Miss still receives these earlier events.
          if (characterAccepts) {
            this.sameTargetCombos.recordHit(0, hit.enemy.uid, b.weaponId, this.clock);
            this.dispatchWeaponEvent(31, b.familyId, { weaponId: b.weaponId, bullet: b, target: hit.enemy, point: hit.enemy });
            this.dispatchWeaponEvent(4, b.familyId, { weaponId: b.weaponId, bullet: b, target: hit.enemy, point: hit.enemy });
            this.refreshLiveProjectile(b);
          }
          const damageAccepted = characterAccepts && !this.statuses.consumeShield(hit.enemy.uid, true);
          const nativeContributions = nativeInstalledAttributeContributions((this.installedWeaponActions.get(b.familyId || this.content.chapter.player.weaponEntityId) || []).filter(c => [101, 109, 176].includes(c.action)), {
            weaponId: b.weaponId, weaponType: Number(this.content.chapter.entities[b.familyId || this.content.chapter.player.weaponEntityId].raw.SecondWeapenType),
            firstTarget: this.firstBulletTargets.get(b) === hit.enemy.uid, targetType: Number(this.content.chapter.entities[hit.enemy.entityId].raw.Type), targetBuffFlags: this.statuses.flags(hit.enemy.uid),
            sameEnemyHitCount: interval => history.filter(time => this.clock - time <= interval).length,
          });
          const attr = this.weaponAttributes(b.familyId);
          const hitAttributes = mergeNativeConditionalAttributeGroups(this.loadoutDamageAttributes(b.familyId, b, hit.enemy), [{ attributes: nativeContributions }], this.content.combat.attributeDefinitions);
          const distanceCrit = nativeDistanceCriticalBonuses(hitAttributes, Math.hypot(hit.enemy.x - this.player.x, hit.enemy.z - this.player.z));
          const critical = damageAccepted && !(b.flags! & 524288) && this.random() < b.critChance + (hitAttributes['CritRate%'] || 0) - (attr['CritRate%'] || 0) - (this.bulletAttributes.get(b)?.['CritRate%'] || 0) + distanceCrit.critRate;
          const splash = this.flashSplashes.get(b) || [];
          if (damageAccepted) for (const mod of splash) mod.beforeHit({ secondWeaponType: Number(this.content.chapter.entities[b.familyId || this.content.chapter.player.weaponEntityId].raw.SecondWeapenType), triggerRatePercent: attr['FlashSplashTriggerRate%'] || 0 }, () => this.random());
          const critValue = b.critMultiplier + (hitAttributes['CritValue%'] || 0) - (attr['CritValue%'] || 0) - (this.bulletAttributes.get(b)?.['CritValue%'] || 0) + distanceCrit.critValue;
          const damage = b.damage * (deathExplosion?.multiplier ?? 1) * (critical ? critValue : 1) * (b.ray ? rayMultiplier : b.throughScale)
            * ((1 + (hitAttributes['SkillUpgradeAttack%'] || 0)) / (1 + (attr['SkillUpgradeAttack%'] || 0) + (this.bulletAttributes.get(b)?.['SkillUpgradeAttack%'] || 0)));
          const bulletConfig = this.content.chapter.bullets[b.bulletId]?.parameters;
          const segmentIndex = Math.min(segments.length - 1, Math.floor(hit.at));
          const segment = segments[segmentIndex], contactTime = hit.at - segmentIndex;
          if (bulletConfig?.hitCharacterPrefabId && segment) markSwordHitVisual(markIceSawHitVisual(markBlackHoleHitVisual(markScorchHitVisual(markLaserHitVisual(markMagneticHitVisual(markIceHitVisual(markAcidHitVisual(this.effect('hit', lerp(segment.from.x, segment.to.x, contactTime), lerp(segment.from.z, segment.to.z, contactTime), .16, .8, undefined, bulletConfig.hitCharacterPrefabId), b), b), b), b), b), b), b), b);
          const hurtType = nativeHurtTypeFromExpressions(bulletConfig?.hurtAttributes);
          if (damageAccepted && !b.damageDisabled && hurtType !== undefined)
            this.damageEnemy(hit.enemy, damage, critical, b.familyId, Number(bulletConfig?.Element || 0), Number(b.traits ?? bulletConfig?.BulletTrait ?? 0), b, hurtType, hitAttributes);
          if (critical) {
            applyCriticalThrough(b, 35);
            this.dispatchExplosionEvent(b, { id: 35, critPoint: hit.enemy });
          }
          this.bulletDeathPoints.set(b, { x: hit.enemy.x, z: hit.enemy.z });
          const fission = this.behindFissions.get(b);
          if (damageAccepted && fission) for (const plan of fission.onEnemyHit(this.derivedSource(b), { disabled: Boolean(b.runtimeMods?.some(mod => mod.type === 'DisableHitBehindFissionMod')),
            target: { position: hit.enemy, shapeRadius: hit.enemy.radiusX }, ownerBulletTraitSplitCount: attr.BulletTraitSplitCount || 0, ownerHasWeapon: true, random: () => this.random() })) this.fireDerivedWeapon(b.familyId, plan);
          if (damageAccepted) for (const mod of splash) {
            const shot = mod.afterHit({ uid: hit.enemy.uid, position: hit.enemy, yawDegrees: hit.enemy.angle * 180 / Math.PI }, this.player.hp > 0, this.clock, this.targetWeaponCooldowns);
            if (shot) this.emitPlayerWeapon(shot.weaponId, b.familyId, shot.origin, shot.yawDegrees * Math.PI / 180, shot.targetUid, shot.flags | 0x88);
          }
          if (critical) {
            this.dispatchWeaponEvent(16, b.familyId, { weaponId: b.weaponId, bullet: b, target: hit.enemy, point: hit.enemy });
            if (this.arcLinks.has(b)) this.dispatchWeaponEvent(43, b.familyId, { weaponId: b.weaponId, bullet: b, target: hit.enemy, point: hit.enemy });
          }
          if (!b.beam) b.hit.add(hit.enemy.uid);
          // HurtTarget emits damage first, then BulletAddBuffToTarget only if
          // the target survived. The first armour-break hit gets no retroactive bonus.
          if (!hit.enemy.dead && b.hitBuffs.length && (!this.thunders.has(b) || Boolean((b.flags || 0) & 0x200000))) this.applyStatusPulses(this.statuses.hit(hit.enemy.uid, b.hitBuffs,
            { attack: p.hp > 0 ? p.attack : b.attackSnapshot, familyId: b.familyId, weaponId: b.weaponId, timeShieldExtraDuration: this.weaponAttributes(b.familyId).TimeShieldExtraDuration || 0,
              buffAttributes: this.weaponAttributes(b.familyId) }, () => this.random(), this.statuses.modifiers(hit.enemy.uid).invincible, this.enemyBuffAttributes(hit.enemy)));
          if (damageAccepted) this.dispatchExplosionEvent(b, { id: 25, targetHitCount: interval => interval > 0 ? exactHistory.filter(time => this.clock - time <= interval).length : exactHistory.length });
          if (deathExplosion) continue;
          const eject = this.ejections.get(b);
          if (eject && !b.beam) {
            const outcome = eject.beginHit({ target: { ...hit.enemy, hitCamp: 2 }, position: b, direction: { x: Math.sin(b.angle), z: Math.cos(b.angle) }, piercing: b.pierce > 0 }, this.ejectHost(b));
            this.applyEjectOutcome(b, outcome);
            if (outcome.kind !== 'none') break;
          }
          const immuneThrough = nativeMonsterBlocksThrough(this.content.chapter.entities[hit.enemy.entityId].raw.MonsterAbility, Number(bulletConfig?.BulletTrait || 0));
          if (!b.beam && !b.held && (immuneThrough || b.pierce-- <= 0)) { b.dead = true; break; }
          if (!b.beam && !b.held) this.dispatchExplosionEvent(b, { id: 32 });
          if (!b.ray && b.throughDamage !== 0) b.throughScale = advanceThroughScale(b.throughScale, b.throughDamage, 1, b.beam);
          if (this.returningProjectiles.get(b)?.onHit(Number(this.content.chapter.entities[hit.enemy.entityId].raw.Type))) break;
        }
      } else if (!b.hitTimes.has(0) || b.age - b.hitTimes.get(0)! >= b.hitInterval) {
        const radius = this.content.chapter.entities[this.content.chapter.player.entityId].stats.shape[0] * this.playerScale;
        if (segments.some(segment => sweep({ ...b, ...segment.to, oldX: segment.from.x, oldZ: segment.from.z, box: b.beam ? false : b.box }, { ...p, radiusX: radius, radiusZ: radius, box: false, angle: 0 }) !== null)) {
          // IsEntityCanHit records the contact before CharacterComponentOnHit.
          // Hero invincibility/shield may reject HP damage but do not reject
          // HurtTarget's successful-contact result or its through lifecycle.
          b.hitTimes.set(0, b.age); b.hit.add(0);
          const buffImmuneBeforeHit = Boolean(p.invincible || this.playerStatuses.modifiers(0).invincible);
          if (!p.invincible) this.damagePlayer(b.damage * b.throughScale, true, b);
          if (b.weaponId === 80001 && b.hitBuffs.length && p.hp > 0)
            for (const pulse of this.playerStatuses.hit(0, b.hitBuffs,
              { attack: b.attackSnapshot, familyId: b.ownerUid, weaponId: b.weaponId }, () => this.random(),
              buffImmuneBeforeHit)) this.damagePlayer(pulse.damage, false);
          if (!b.beam && !b.held) {
            if (b.pierce-- <= 0) b.dead = true;
            else if (b.throughDamage !== 0) b.throughScale = advanceThroughScale(b.throughScale, b.throughDamage);
          }
        }
      }
    }
    if (!onlyBullet && !p.invincible) for (const e of this.enemies) {
      if (e.dead) continue;
      // OnHitByBody (0x6ace2f4) rejects an attacker still in its Born state.
      const behavior = this.enemyBehaviors.get(e.uid);
      if (!behavior?.attackEntered && e.age <= (behavior?.entryDuration || 0)) continue;
      const radius = this.content.chapter.entities[this.content.chapter.player.entityId].stats.shape[0] * this.playerScale;
      if (sweep({ ...p, radiusX: radius, radiusZ: radius, box: false, angle: 0 }, e) !== null) {
          this.damagePlayer(e.bodyAttack, true, undefined, e); break;
      }
    }
  }
  private damageEnemy(e: Enemy, damage: number, critical: boolean, sourceEntityId: number, element = 0, traits = 0, projectile?: Projectile, hurtType = 1, hitAttributes?: Record<string, number>) {
    if (this.statuses.modifiers(e.uid).invincible || this.statuses.consumeShield(e.uid)) return;
    const entity = this.content.chapter.entities[e.entityId];
    const attrs = hitAttributes || this.loadoutDamageAttributes(sourceEntityId, projectile, e);
    const emittedAttrs = projectile ? this.bulletBase.get(projectile)?.attributes || this.weaponAttributes(sourceEntityId) : {};
    const emittedWeapon = projectile ? (this.weaponAttributes(sourceEntityId)['WeaponDamageAdd%'] || 0) + (this.bulletAttributes.get(projectile)?.['WeaponDamageAdd%'] || 0) : 0;
    const emittedElement = projectile ? nativeElementAndTraitDamageBonus(name => entryWeaponAttribute(this.content.combat, name) + (emittedAttrs[name] || 0) * 100, element, traits) : 0;
    damage *= nativeLoadoutDamageFactors(attrs, { secondWeaponType: Number(this.content.chapter.entities[sourceEntityId || this.content.chapter.player.weaponEntityId]?.raw.SecondWeapenType || 0),
      element, bulletTraits: traits, targetType: Number(entity.raw.Type), targetTags: entity.raw.Tag || [], ownerTargetDistance: Math.hypot(e.x - this.player.x, e.z - this.player.z),
      ownerHpRatio: this.player.hp / this.player.maxHp, targetHpRatio: e.hp / e.maxHp, emittedWeaponBonus: emittedWeapon, emittedElementTraitBonus: emittedElement }).emissionCorrection;
    if (projectile) {
      const progressive = this.planeSpecials?.progressiveLaserBonus(sourceEntityId, projectile.uid, e.uid, this.clock,
        Math.round(this.clock / nativeLogicDelta), projectile.trajectory === 'SpecialLaserStick') || 0;
      const combo = this.sameTargetCombos.bonus({ ownerKey: sourceEntityId, rootOwnerUid: 0, targetUid: e.uid,
        weaponId: projectile.weaponId, attribute: 'Attack%', now: this.clock });
      damage *= 1 + progressive + combo;
    }
    damage *= nativeMonsterElementMultiplier(entity.raw.MonsterAbility, element, traits, {
      entityType: entity.raw.Type, chapterFeatureIds: this.content.chapter.chapter.parameters.ChapterMonsterFeature || [],
    });
    damage *= this.statuses.modifiers(e.uid).damageTaken;
    damage = nativeDamageResult(damage);
    if (e.dead || damage <= 0) return;
    if (critical && damage >= e.hp) this.dispatchWeaponEvent(37, sourceEntityId, { weaponId: projectile?.weaponId, bullet: projectile, target: e, point: e, critical: true, skipPlayer: true });
    const dealt = Math.min(e.hp, damage); e.hp -= damage; e.hitFlash = 0.065; this.damageDealt += dealt;
    if (dealt > 0) this.sounds.push(projectile?.familyId === 200101 && projectile.trajectory === 'SemiCircleMov2Mod' ? -18 : -9);
    // Projectile.familyId is the owning weapon entity (0 denotes the cannon),
    // not the bullet ID: replacements and explosions stay in the same row.
    const weaponId = sourceEntityId || this.content.chapter.player.weaponEntityId;
    this.damageByWeapon.set(weaponId, (this.damageByWeapon.get(weaponId) || 0) + dealt);
    if (this.effects.filter(fx => fx.kind === 'text').length < 32) { const fx = this.effect('text', e.x, e.z, 0.65, critical ? 1.2 : 1, `${Math.round(damage)}`); fx.critical = critical; }
    if (e.hp > 0) return;
    this.dispatchWeaponEvent(32, sourceEntityId, { weaponId: projectile?.weaponId, bullet: projectile, target: e, point: e, critical });
    this.beginEnemyDeath(e, false, hurtType);
    if (this.player.hp > 0) this.killMilestoneBuffs.ownerKill(this.nativeKillCount, id => this.applyKillMilestoneBuff(id));
    this.dispatchWeaponEvent(5, sourceEntityId, { weaponId: projectile?.weaponId, bullet: projectile, target: e, point: e });
    const raw = this.content.chapter.entities[e.entityId].raw;
    // CharacterComponentDeath 0x6aaa8e0 skips DropMgr.DropItems for IgnoreDrop,
    // but still enters normal death/count bookkeeping. Supported babies are
    // ordinary Type2: they do not decrement the special-monster wave gate.
    // Return before XP remainder allocation, HP compensation or any loot RNG.
    if (e.ignoreDrop) return;
    const experience = this.waveExperience.reward({ weight: Number(entity.stats.expWeight), type: Number(raw.Type) }, Number(raw.exp));
    // DropAbsorbExp is true only for chapter type 7. Type 8 calls AddExp directly.
    if (experience > 0) {
      if (this.content.chapter.chapter.parameters.chapterType === 7) this.dropItems(e, raw.expType === 1 ? 11 : 10, 'exp', experience, Math.max(1, raw.expWeight || 1));
      else this.addExp(experience);
    }
    const drop = this.content.assets.monsterDrops?.[raw.MonsterDropType];
    const gold = this.waveGold.reward({ dropType: Number(raw.MonsterDropType), characterType: Number(raw.Type) }, Boolean(e.carriesGold), this.content.assets.monsterDrops);
    if (gold > 0 && drop?.DropItem) this.dropItems(e, drop.DropItem, 'gold', gold, drop.DropItemNum);
    // AddDropHp gates once, then tries all three slots. Compensation is shared,
    // uses truncated FP division, and resets after EVERY successful drop.
    const healthRates = ['hpDropRate', 'hpDropRate2', 'hpDropRate3'].map(key => Number(raw[key] || 0));
    if (healthRates.some(rate => rate > 0) && this.pickups.filter(item => item.kind === 'heart').length < 4) {
      for (const baseRate of healthRates) {
        const dropAttributes = { ...this.playerCombatAttributes() };
        for (const source of this.specialTargetAttributes.get(e.uid)?.values() || []) for (const [name, value] of Object.entries(source)) dropAttributes[name] = (dropAttributes[name] || 0) + value;
        const rate = Math.trunc(nativeLoadoutHpDropRate(healthDropRateRaw(baseRate, e.hpDropMultiplierRaw), dropAttributes));
        const chance = rate + this.hpDropCompensationRaw;
        if (chance >= 65536 || (chance > 0 && Math.floor(this.random() * 65536) < chance)) {
          this.hpDropCompensationRaw = 0;
          this.dropItems(e, 1, 'heart', healthPickupFraction(this.content.assets.battleItems[1].parameter), 1);
        } else this.hpDropCompensationRaw += Math.trunc(rate / 1000);
      }
    }
  }
  private suicideEnemy(enemy: Enemy) {
    if (enemy.dead) return;
    const plan = chapterSuicideFirePlan(this.content.chapter.entities[enemy.entityId].raw.SpecialTrait || [], enemy, true, enemy.dead);
    enemy.ignoreDrop = true;
    this.beginEnemyDeath(enemy, true);
    // Native Suicide emits OnSuicide only after IsDead; ordinary kills never
    // enter here. Keep the source snapshot and allow its death-owned fire.
    if (plan) {
      const firstQueued = this.shots.length;
      this.queueWeapon(plan.weaponId, 'enemy', plan.fixedPosition, enemy.uid, enemy.attack,
        plan.angle, undefined, 0, 0, 0, 0, undefined, plan);
      for (const shot of this.shots.splice(firstQueued)) {
        if (shot.at <= this.clock) this.emitProjectile(shot);
        else this.shots.push(shot);
      }
    }
  }
  private beginEnemyDeath(e: Enemy, self: boolean, hurtType = 1) {
    e.dead = true; this.nativeKillCount++;
    this.sameTargetCombos.forgetTarget(e.uid);
    // AddKillCount always increments KillCount. AttackerType.Self(5) only
    // suppresses RealKillCount, which supplies the visible kill statistic.
    if (!self) this.kills++;
    this.removeMonsterSkills(e.uid);
    this.statuses.clear(e.uid);
    e.deathAge = 0;
    const raw = this.content.chapter.entities[e.entityId].raw;
    // EntityCharacter.OnDeath 0x6bbb688 invokes OnEntityDead at death start;
    // the named trait subscribes there (0x69261ac), not death-complete.
    const mission = this.content.chapter.waves.flatMap((wave: RecordData) => wave.events)
      .find((event: RecordData) => event.id === this.currentMissionId);
    for (const trait of raw.SpecialTrait || [])
      for (const child of chapterDeathChildren(this.content, trait, e, this.wave, mission, this.clock))
        this.spawn(child.spawn, child.angle);
    let parameters: RecordData = {};
    try { parameters = JSON.parse(raw.deathParams || '{}') || {}; } catch {}
    const selection = nativeBackDeathSelection(Number(raw.deathClassId), hurtType, parameters);
    const effectId = Number((!selection || selection.useTableParameters) && parameters.ExplosionEffectId || 210009);
    if (selection) {
      // Keep the model until the original controller's separate removal edge.
      e.deathRemaining = Infinity;
      this.backDeaths.set(e.uid, { runtime: new NativeBackDeath(selection), effectId });
    } else {
      // Other native death classes retain their existing presentation fallback.
      e.deathRemaining = 4 * nativeLogicDelta;
      this.playEnemyDeathEffect(e, effectId).age = -3 * nativeLogicDelta;
    }
    e.deathSound = e.boss ? -26 : e.elite ? -11 : -12; // Boss and elite retain separate presentation cues.
  }
  private playEnemyDeathEffect(enemy: Enemy, effectId: number) {
    const effect = this.effect('explosion', enemy.x, enemy.z, enemy.boss ? 1.2 : 0.55,
      enemy.boss ? 8 : enemy.elite ? 4 : 2, undefined, effectId);
    effect.originalScale = 1;
    markOrdinaryDeathVisual(effect, enemy);
    return effect;
  }
  private fireEnemyDeathWeapon(enemy: Enemy, weaponId: number) {
    const plan = nativeBackDeathFirePlan(weaponId, enemy, enemy.angle);
    if (!plan) return;
    this.fireEnemyFixedWeapon(enemy, plan);
  }
  private fireEnemyFixedWeapon(enemy: Enemy, plan: FixedWeaponFirePlan) {
    const firstQueued = this.shots.length;
    const fireGroup: NativeFireGroup = { started: false, attributes: {} };
    this.queueWeapon(plan.weaponId, 'enemy', plan.fixedPosition, enemy.uid, enemy.attack,
      plan.angle, undefined, 0, 0, 0, 0, undefined, plan);
    // Both native AI and death callbacks fire now. Only the explicit death
    // plan allows pending shots to survive their owner's removal.
    for (const shot of this.shots.splice(firstQueued)) {
      if (shot.at <= this.clock) this.emitProjectile(shot);
      else this.shots.push(shot);
    }
  }
  private applyStatusPulses(pulses: readonly StatusPulse[]) {
    for (const pulse of pulses) {
      const enemy = this.enemies.find(e => e.uid === pulse.targetUid && !e.dead);
      if (enemy) this.damageEnemy(enemy, pulse.damage, false, pulse.familyId, pulse.element, 0, undefined, pulse.hurtType);
    }
  }
  private removeMonsterSkills(ownerUid: number) {
    for (const event of this.monsterSkills.removeOwner(ownerUid))
      (event.targetUid === 0 ? this.playerStatuses : this.statuses).remove(event.targetUid, event.buffId);
  }
  private explode(source: Projectile, target: Point, critical: boolean) {
    const config = source.explosion!;
    const weapon = this.content.chapter.weapons[config.weaponId], bullet = weapon && this.content.chapter.bullets[weapon.bulletId]?.parameters;
    const spec = resolveExplosionSpec(config, weapon, bullet);
    if (!spec) return;
    const at = explosionOrigin(config, source, target, critical);
    const state = source.familyId ? this.secondary.get(source.familyId) : this.cannon;
    const damage = this.player.attack * spec.attackMultiplier * (1 + (state?.damageBonus || 0)) * (1 + (state?.skillDamage || 0))
      * (1 + nativeElementAndTraitDamageBonus(name => entryWeaponAttribute(this.content.combat, name), spec.element, spec.traits));
    this.damageAreas.push({ ...at, radius: config.radius, damage, element: spec.element, hurtType: spec.hurtType, traits: spec.traits, familyId: source.familyId,
      expiresAt: this.clock + spec.lifetime, hitInterval: spec.hitInterval, nextHit: new Map(),
      critChance: explosionCritChance(spec, this.content.chapter.player.critRate + this.globalCrit + (state?.critBonus || 0), entryWeaponAttribute(this.content.combat, 'ExplodeAttackCrit%') / 100),
      critMultiplier: Math.max(1, 1.5 + entryWeaponAttribute(this.content.combat, 'CritValue%') / 100 + this.globalCritDamage + (state?.critDamage || 0)) });
    this.effect('explosion', at.x, at.z, .4, config.radius * 2, undefined, 210009);
  }
  private updateDamageAreas() {
    this.damageAreas = this.damageAreas.filter(area => this.clock < area.expiresAt);
    for (const area of this.damageAreas) for (const enemy of this.enemies) {
      if (enemy.dead || this.clock < (area.nextHit.get(enemy.uid) ?? -Infinity)) continue;
      // The stationary OverLapShapeAndStay bullet remains live for its native
      // lifetime. Use the same circle/rotated-box collision as other bullets.
      const hit = sweep({ ...area, oldX: area.x, oldZ: area.z, radiusX: area.radius, radiusZ: area.radius, box: false, angle: 0 },
        { ...enemy, oldX: enemy.x, oldZ: enemy.z });
      if (hit === null) continue;
      area.nextHit.set(enemy.uid, area.hitInterval > 0 ? this.clock + area.hitInterval : Infinity);
      const critical = area.critChance > 0 && this.random() < area.critChance;
      this.damageEnemy(enemy, area.damage * (critical ? area.critMultiplier : 1), critical, area.familyId, area.element, area.traits, undefined, area.hurtType);
    }
  }
  private damagePlayer(damage: number, contact = true, projectile?: Projectile, attacker?: Enemy) {
    if (this.playerStatuses.modifiers(0).invincible || this.playerStatuses.consumeShield(0)) {
      return;
    }
    const attackerUid = attacker?.uid ?? projectile?.ownerUid;
    const source = attacker || (projectile ? this.enemies.find(e => e.uid === projectile.ownerUid) : undefined);
    const groups: { attributes: Record<string, number> }[] = [];
    // Action141: owner BulletHurtCount < HurtTimes, evaluated before this hit.
    // Body collisions, shields and misses never spend a protected bullet hit.
    if (projectile) for (const command of this.installedWeaponActions.get(0) || []) {
      if (command.action === 141 && this.playerBulletHurtCount < Number(command.args.HurtTimes))
        groups.push({ attributes: parseNativeConditionalAttributes(command.args.Attrs) });
    }
    if (source) for (const command of this.installedWeaponActions.get(0) || []) {
      if (command.action !== 196) continue;
      const args = command.args, hp = this.player.hp / this.player.maxHp;
      // Hitted event attrs@6b51348: inclusive owner-HP and inside-circle
      // filters run before this hit changes HP; they never affect outgoing damage.
      const threshold = Number(args.TriggerHpPercent || 0);
      const hpMatches = threshold < 1 / 65536 || (args.IsTriggerLess ? hp <= threshold : hp >= threshold);
      if (hpMatches && Math.hypot(source.x - this.player.x, source.z - this.player.z) <= Number(args.Radius))
        groups.push({ attributes: parseNativeConditionalAttributes(args.Attrs) });
    }
    const attrs = mergeNativeConditionalAttributeGroups(this.playerCombatAttributes(), groups, this.content.combat.attributeDefinitions);
    const sourceData = source && this.content.chapter.entities[source.entityId]?.raw;
    const miss = nativeLoadoutMissChance(attrs, Number(sourceData?.HitRate || 0), source ? Math.hypot(source.x - this.player.x, source.z - this.player.z) : 0, projectile?.traits || 0);
    if (this.playerStatuses.consumeShield(0, true) || miss.ordinary > 0 && this.random() < miss.ordinary || miss.trait > 0 && this.random() < miss.trait) {
      this.dispatchPlayerEvent(13, { attackerUid, attackerPoint: source || projectile }); return;
    }
    const incoming = nativeLoadoutIncomingDamageFactors(attrs, { attackerKind: projectile ? 'bullet' : source ? 'body' : 'other', attackerType: sourceData?.Type,
      standing: !this.playerMotion.x && !this.playerMotion.z, attackerFlying: sourceData ? Number(sourceData.MonsterType) === 1 : undefined });
    let reduction = incoming.remainingMultiplier;
    for (const [familyId, installed] of this.installedWeaponActions) {
      const matched = this.projectiles.some(b => !b.dead && b.familyId === familyId && this.rayPaths.get(b.uid)?.includes(Number(attackerUid)));
      const modifiers = nativeInstalledAttributeContributions(installed.filter(c => c.action === 254), { weaponId: 0, attackerIsRayTarget: matched });
      if (modifiers['HurtDecrease%']) reduction = mergeNativeAttribute(reduction, modifiers['HurtDecrease%'], 2);
    }
    damage = damage * reduction - incoming.flatReduction;
    damage = nativeDamageResult(damage);
    const p = this.player;
    const oldHp = p.hp;
    p.hp = Math.max(0, p.hp - Math.max(0, damage));
    if (projectile && damage > 0) this.playerBulletHurtCount++;
    if (p.hp !== oldHp) this.dispatchPlayerEvent(6);
    for (const familyId of new Set([0, ...this.weaponPrograms.keys()])) this.loadoutSpecials?.ownerHpChanged(familyId, oldHp, p.hp);
    if (source) this.lastPlayerAttacker = { x: source.x, z: source.z };
    for (const type of [3, 19, 62]) {
      const data = { bullet: projectile, weaponId: projectile?.weaponId, point: this.player, attackerPoint: source || projectile, attackerUid };
      for (const familyId of this.weaponPrograms.keys()) this.dispatchWeaponEvent(type, familyId, { ...data, skipPlayer: true });
      this.dispatchPlayerEvent(type, data);
    }
    if (contact) p.invincible = this.content.chapter.entities[this.content.chapter.player.entityId].stats.hitInterval || 1;
    if (p.hp < oldHp) {
      p.hitFlash = 0.3;
      this.effect('text', p.x, p.z + 1, 0.8, 1, `−${Math.round(oldHp - p.hp)}`);
      this.sounds.push(330001);
    }
  }
  private movePickups(dt: number) {
    const p = this.player;
    for (const item of this.pickups) {
      const special = this.loadoutDrops.get(item.uid);
      const remove = () => { item.value = 0; if (this.loadoutDrops.delete(item.uid)) this.loadoutDropCounts.removed(item.itemId); };
      if (special && item.age + dt >= special.life || item.state === 'stay' && !item.attracted && item.z < this.cameraBounds().bottom - 2) { remove(); continue; }
      if (!advancePickup(item, p, dt, special ? {
        canAbsorb: age => nativeLoadoutDropCanAbsorb(special.dropType, age),
        distance: 6 + (this.playerCombatAttributes().PickDistanceBuff || 0), dropSpeed: special.dropSpeed,
        beginAbsorb: () => ({ retreatDistance: 2 + this.random(), retreatDuration: .15 + this.random() * .05 }),
      } : item.kind === 'heart' ? { distance: (8 + (this.playerCombatAttributes().PickDistanceHp || 0)) * (1 + (this.playerCombatAttributes()['PickDistanceHp%'] || 0)) } : {})) continue;
      if (special) {
        const effect = nativeLoadoutPickupEffect(special);
        if (effect.kind === 'buff') {
          this.applyStatusPulses(this.playerStatuses.hit(0, [{ buffId: effect.buffId, probability: 1 }], { attack: p.attack, familyId: 0, weaponId: 0, timeShieldExtraDuration: this.playerCombatAttributes().TimeShieldExtraDuration || 0 }, () => this.random()));
          this.refreshBuffAttributes();
        } else {
          const raw = this.content.combat.triggers[effect.triggerId];
          if (!raw) throw new Error(`Missing native pickup trigger ${effect.triggerId}`);
          this.playerSkillProgram.enqueueOnceTrigger(compileNativeSkillTrigger(raw, 0), this.clock);
        }
      } else if (item.kind === 'exp') this.addExp(item.value);
      else if (item.kind === 'gold') this.gold += item.value;
      else this.healPlayer(p.maxHp * item.value, 1);
      for (const familyId of this.weaponPrograms.keys()) this.dispatchWeaponEvent(10, familyId, { dropItemType: Number(this.content.assets.battleItems[item.itemId]?.dropType ?? item.itemId), point: item, skipPlayer: true });
      this.dispatchPlayerEvent(10, { dropItemType: Number(this.content.assets.battleItems[item.itemId]?.dropType ?? item.itemId), point: item });
      const config = this.content.assets.battleItems?.[item.itemId];
      // Item120 queues the real shockwave (10001) for the next component step.
      // Its birth owns the sound, so collection cannot double-play before/after a pause.
      if (config?.collectSoundId && !(special && item.itemId === 120 && special.parameter === 11002108)) this.sounds.push(config.collectSoundId);
      if (config?.collectEffectId && this.content.assets.originalEffects.effects[config.collectEffectId]) {
        const fx = this.effect('muzzle', p.x, p.z, config.EffectTime / 65536, 1, undefined, config.collectEffectId);
        fx.originalScale = config.EffectScale / 65536; fx.followPlayer = true;
      }
      remove();
    }
    this.pickups = this.pickups.filter(item => item.value > 0);
  }
  private dropItems(origin: Point, itemId: number, kind: Pickup['kind'], totalValue: number, count: number) {
    const config = this.content.assets.battleItems[itemId];
    const amounts = kind === 'gold' ? splitGoldReward(totalValue, count) : Array.from({ length: count }, () => totalValue / count);
    for (const [i, value] of amounts.entries()) {
      const item = createPickup(this.serial++, itemId, config.prefabId, kind, value, origin, i, () => this.random());
      if ('dead' in origin && origin.dead) item.delay += 4 * nativeLogicDelta;
      this.pickups.push(item);
    }
  }
  private collectWaveRemainders() { for (const pickup of this.pickups) pickup.attracted = true; }
  private addExp(value: number) {
    this.exp += value;
    while (this.exp >= this.threshold() && this.level < 40) {
      this.level++; this.pendingLevels++;
      // HeroComponentExp.UpdateLevel / HealSelfByPercent, source kind 13.
      const attrs = this.playerCombatAttributes();
      const flat = attrs.LevelUpRecoverHP || 0, ratio = attrs['LevelUpRecoverHP%'] || 0;
      if ((flat > 0 || ratio > 0) && this.player.hp > 0) {
        const percentRaw = BigInt(Math.round(ratio * 65536));
        const maxHpRaw = BigInt(Math.round(this.player.maxHp * 65536));
        this.healPlayer(flat + Number((maxHpRaw * percentRaw) >> 16n) / 65536, 13);
      }
    }
  }
  developerSkillCatalog: DeveloperSkill[] = [];
  learnDeveloperSkill(id: number): boolean {
    if (!this.developerSkillCatalog.length || !['playing', 'paused', 'upgrade'].includes(this.phase) || this.player.hp <= 0) return false;
    const plan = planDeveloperSkill(this.content, this.developerSkillCatalog, id, this.skillHistory());
    if (!plan.choices.length && !plan.external.length) return false;
    const phase = this.phase, pending = this.pendingLevels, tutorial = this.tutorialFirstChoiceActive;
    const study = this.content.combat.studyLoadout;
    if (!study) throw new Error('战斗配置尚未就绪');
    study.battleSkillIds = [...new Set<number>([...study.battleSkillIds.filter((value: number) => !plan.removed.includes(value)), ...plan.external])];
    this.learned = this.learned.filter(card => !plan.removed.includes(card.id));
    this.pendingLevels = 0; this.tutorialFirstChoiceActive = false;
    // Apply through the same weapon/state/trigger path as normal level-up cards.
    for (const choice of plan.choices) {
      this.phase = 'upgrade'; this.choices = [choice]; this.choose(choice.id);
    }
    this.refreshNativeWeaponSkills();
    for (const value of plan.external) this.dispatchNativeSkillLearned(value);
    this.pendingLevels = pending; this.choices = []; this.breakthroughChoice = false;
    this.phase = phase === 'upgrade' ? 'playing' : phase;
    if (tutorial) this.tutorialChoiceCompleted = true;
    if (phase === 'upgrade' && pending) this.openUpgrade();
    return true;
  }
  get canRerollUpgrade() { return this.phase === 'upgrade' && !this.breakthroughChoice && !this.tutorialFirstChoiceActive && this.rerollsRemaining > 0; }
  rerollUpgrade() {
    if (!this.canRerollUpgrade) return false;
    // openUpgrade already removed the visible choice from pendingLevels.
    // Refresh keeps that choice's level, rather than borrowing the next one's slots.
    const choices = this.makeChoices(false, this.level - Math.max(0, this.pendingLevels));
    if (!choices.length) return false;
    this.choices = choices; this.rerollsRemaining--; this.ordinarySelections++;
    return true;
  }
  private openUpgrade() {
    this.breakthroughChoice = false;
    this.choices = this.makeChoices();
    if (!this.choices.length) { this.pendingLevels = 0; return; }
    this.ordinarySelections++;
    this.pendingLevels--; this.phase = 'upgrade'; this.sounds.push(410001);
  }
  makeChoices(treasure = false, heroLevel = this.level - Math.max(0, this.pendingLevels - 1)): Choice[] {
    const combat = this.content.combat;
    if(!treasure&&this.tutorialFirstChoicePending){
      const choices=firstGuideChoices(combat);
      this.tutorialFirstChoicePending=false;this.tutorialFirstChoiceActive=true;
      return choices;
    }
    const candidates: NativeSkillCandidate[] = [];
    for (const family of Object.values(combat.families || {}) as RecordData[]) {
      if (!runtimeWeaponFamilyEnabled(family.id)) continue;
      const owned = family.entityId === this.content.chapter.player.weaponEntityId ? this.cannonOwned ? this.cannon : undefined : this.secondary.get(family.entityId);
      if (!owned) {
        // Native AddDankeSkillGroupToRandom excludes banned root entries.
        // RemoveSkill can still add the next stage of an already-equipped weapon.
        if (!treasure && !combat.studyLoadout?.banSkillIds?.includes(family.id))
          candidates.push({ stageId: family.id, rootId: family.id, owned: false });
        continue;
      }
      const current = family.stages.find((s: RecordData) => s.skillId === owned.stageId);
      if (!current || current.star >= family.maxStar) continue;
      const next = family.stages.find((s: RecordData) => s.skillId === current.nextSkillId);
      if (next) candidates.push({ stageId: next.skillId, rootId: family.id, owned: true });
    }
    for (const card of Object.values(combat.cards) as RecordData[]) {
      if (card.id < 11000000 || !card.supported || !this.requirementsMet(card) || this.learned.some(c => c.id === card.id)) continue;
      const previous = card.raw.CoverSkill;
      if (treasure && !previous) continue;
      if (previous && !this.learned.some(c => c.id === previous)) continue;
      candidates.push({ stageId: card.id, rootId: card.familyId, owned: Boolean(previous) });
    }
    // Each parent weapon occupies one weighted slot. IsUpgrade=2 resolves its
    // basic branch before display; IsUpgrade=1 opens a separate two-card choice.
    const occupiedPassives = new Set(this.learned.filter(c => c.id >= 11000000).map(c => c.group)).size;
    return drawNativeOrdinaryChoices(candidates, id => this.canStudySkill(id), () => this.random(), {
      mode: combat.mode,
      weightGroup: this.content.chapter.chapter.parameters[combat.mode === 'B' ? 'SkillGroupWeight_B' : 'SkillGroupWeight'],
      initialPool: !treasure && this.ordinarySelections < nativeInitialSkillGroupCount, count: treasure ? 1 : 3,
      // This runtime loads Chapter_MainChapter; world type 1 is distinct from chapterType 8.
      worldType: 1, newPlayerProtect: this.content.chapter.chapter.parameters.NewPlayerProtect,
      learnedSkillIds: this.skillHistory(),
      heroLevel,
      occupiedWeaponSlots: Number(this.cannonOwned) + this.secondary.size, occupiedPassiveSlots: occupiedPassives,
    }).map(offer => {
      const family = combat.families[offer.rootId];
      if (!family) {
        const card = combat.cards[offer.id];
        return { ...card, description: '', group: card.familyId, star: card.raw.SkillStar || 1 } as Choice;
      }
      const stage = family.stages.find((s: RecordData) => s.skillId === offer.parentStageId);
      if (offer.kind === 'minor') return { ...combat.cards[offer.id], id: offer.id, group: family.id, advance: stage.skillId, star: stage.star } as Choice;
      const isNew = stage.star === 1;
      return { ...stage, id: offer.id, name: stage.name || family.name, description: '', icon: family.icon, star: stage.star, group: family.id,
        advance: isNew ? undefined : stage.skillId, opensBreakthrough: offer.kind === 'breakthrough',
        effects: isNew ? [{ type: 'addSecondary', entityId: family.entityId, skillId: family.id }, ...(stage.effects || [])] : [] } as Choice;
    });
  }
  private canStudySkill(id: number) {
    const card = this.content.combat.cards[id];
    if (card) return card.supported && (!this.content.combat.families[card.familyId] || runtimeWeaponFamilyEnabled(card.familyId)) && this.requirementsMet(card);
    return nativeSkillEligible(id, this.skillHistory()) && Object.values(this.content.combat.families).some((family: any) => runtimeWeaponFamilyEnabled(family.id) && family.stages.some((stage: any) => stage.skillId === id && stage.supported !== false));
  }
  private dispatchNativeSkillLearned(skillId: number) {
    // BattleWorldContext.PostProcessLearnedSkill@0x6e76e40 sends event 58
    // only for IsRealSkill=1, after applying the complete skill.
    const row = this.content.combat.skillRows[skillId];
    if (Number(row?.IsRealSkill) !== 1) return;
    this.dispatchPlayerEvent(58, { skillId });
  }
  private skillHistory(): number[] {
    const study = this.content.combat.studyLoadout;
    const initial: number[] = study ? study.battleSkillIds || [] : [this.content.chapter.player.weaponSkillId];
    return [...new Set(initial), ...this.learned.flatMap(c => c.advance && c.advance !== c.id ? [c.id, c.advance] : [c.id])];
  }
  private requirementsMet(card: RecordData) {
    return nativeSkillEligible(card.id, this.skillHistory());
  }
  choose(id: number, treasure = false) {
    if (this.phase !== 'upgrade') return;
    const card = this.choices.find(c => c.id === id);
    if (!card) return;
    const family = this.content.combat.families[card.group];
    if (family && !this.secondWeaponOrder.includes(Number(family.entityId))) this.secondWeaponOrder.push(Number(family.entityId));
    if (family?.entityId === this.content.chapter.player.weaponEntityId) this.cannonOwned = true;
    let state = family && family.entityId !== this.content.chapter.player.weaponEntityId ? this.secondary.get(family.entityId) : this.cannon;
    const stage = family?.stages.find((s: RecordData) => s.skillId === card.advance);
    if (family && !state) {
      state = { ...newWeapon(family.id), at: this.clock };
      this.secondary.set(family.entityId, state);
    }
    if (card.advance && state) state.stageId = card.advance;
    this.learned.push(card);
    // HPMax is recomputed with the shared attribute stack in refreshBuffAttributes.
    this.refreshNativeWeaponSkills();
    this.dispatchNativeSkillLearned(card.id);
    if(this.tutorialFirstChoiceActive&&!treasure){this.tutorialFirstChoiceActive=false;this.tutorialChoiceCompleted=true;}
    if (card.advance && card.advance !== card.id) this.dispatchNativeSkillLearned(card.advance);
    if (card.opensBreakthrough && family && card.advance) {
      this.breakthroughChoice = true;
      this.choices = drawNativeBreakthroughChoices(card.advance, id => this.canStudySkill(id), () => this.random(), { mode: this.content.combat.mode, weightGroup: this.content.chapter.chapter.parameters[this.content.combat.mode === 'B' ? 'SkillGroupWeight_B' : 'SkillGroupWeight'] }).map(id => ({
        ...this.content.combat.cards[id], id, group: family.id, star: card.star,
        // Parent was already learned above. The child spends no additional level
        // and must not apply the parent's inherent attributes a second time.
        advance: undefined, opensBreakthrough: false,
      }));
      if (this.choices.length) { if (treasure) this.choices = this.choices.slice(0, 1); return; }
    }
    this.choices = []; this.phase = 'playing'; this.breakthroughChoice = false;
    this.effect('level', this.player.x, this.player.z, 0.6, 3);
    if (this.pendingLevels && !treasure) this.openUpgrade();
  }
  private closestEnemy(point: Point) { let best: Enemy | undefined, distance = Infinity; for (const enemy of this.enemies) { if (enemy.dead) continue; const d = Math.hypot(enemy.x - point.x, enemy.z - point.z); if (d < distance) { distance = d; best = enemy; } } return best; }
  effect(kind: Effect['kind'], x: number, z: number, duration: number, size: number, value?: string, modelId?: number) { const originalDuration = modelId ? originalEffectDuration(this.content.assets.originalEffects, modelId) : 0; if (Number.isFinite(originalDuration) && originalDuration > 0) duration = originalDuration; const fx: Effect = { uid: this.serial++, kind, x, z, age: 0, duration, size, value, modelId }; this.effects.push(fx); return fx; }
}
