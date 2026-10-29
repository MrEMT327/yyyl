import {hostSignInSnapshot,claimHostSignIn} from './replica/host-signin.js';
import { isGameSessionCurrent } from './platform/game-session-runtime.js';
import { cancelLocalRewardedAd } from './ui/local-rewarded-ad.js';
import { memoryCheckpoint } from './replica/memory-checkpoints.js';
import { replicaChapter, replicaChapterForStage, replicaStageAccessible } from './replica/chapter-contract.js';
import { ColorMatrixFilter, Container, Graphics, Text, Ticker, WebGLRenderer } from './three/display.js';
import { HOSTILE_PROJECTILE_COLOR } from './fixed-parts/hostile-projectile-material.js';
import { combatDelta } from './combat-time.js';
import { createFrameLoop } from './frame-loop.js';
import { BUILD_IDENTITY } from './build-info.js';
import {DEFAULT_PLAYER_NAME, playerName} from './player-identity.js';
import { performanceMonitor } from './performance-monitor.js';
import { createVictoryDeparture } from './render/victory-departure.js';
import { MusicDirector } from './music-director.js';
import {createLobbyFeedback,createLobbySoundPlayer} from './ui/lobby-audio.js';
import { readAudioPreferences, saveAudioPreferences } from './audio-preferences.js';
import { movingCircleHitTime, sweptCircleHitsSegment } from './combat-collision.js';
import { assessRunStars, starGoals, normalizeStarRecord, bestStarRecord } from './campaign-stars.js';
import { developmentWallet } from './development-resources.js';
import { clearLocalGameSave, DEVELOPER_CURRENCY_GRANTS } from './developer-tools.js';
import { victoryCurrencyReward, victoryAdReward } from './sortie-rewards.js';
import { showRunLevelFeedback,showWeaponUpgradeFeedback } from './ui/run-growth-feedback.js';
import { mountTapFeedback } from './ui/tap-feedback.js';
import { frameSafeInsets } from './ui/safe-area.js';
import { readFixedLoadout, createFixedCombat } from './fixed-parts/runtime.js';
import { fixedLaunchVelocity } from './fixed-parts/weapon-profiles.js';
import { PHYSICS_STEP } from './fixed-parts/pathogenic-rules.js';
import { loadFixedProjectileArt, attachFixedProjectileArt, syncFixedProjectileShape, attachHostileProjectileArt, detachProjectileArt, projectileAssets } from './fixed-parts/projectile-art.js';
import { createCombatVfx } from './three/combat-vfx.js';
import {hitFeedbackProfile,canOverrideHitFeedback} from './three/enemy-hit-feedback.js';
import { createPickupModel } from './three/pickup-model.js';
import { createSortieTrace } from './three/sortie-performance.js';
import { showSortieLoading, nextLoadingFrame } from './ui/sortie-loading.js';
// Browser combat entry already awaits these assets when it needs them.
if (globalThis.__THUNDER_RUNTIME_GLOBALS__?.canvas && !globalThis.__THUNDER_RUNTIME_GLOBALS__?.nativePeripheralLobby)
  loadFixedProjectileArt().catch(error=>console.warn('弹体模型加载失败',error));
import { advanceFixedProjectile } from './fixed-parts/projectile-flight.js';
import { FIXED_NODE_BY_ID } from './fixed-parts/growth.js';
import { ARSENAL } from './fixed-parts/airframe-arsenal.js';
import { planBattleSupply } from './fixed-parts/battle-supply.js';
import { createBattleWaveDirector, battleRoutePosition, formationHpScale } from './battle-waves.js';
import { bossBarragePlan, eliteBarragePlan, regularBarragePlan } from './boss-barrage.js';
import { chapterEnemyProfile, enemyTierMetrics, chapterBossPosition } from './chapter-enemies.js';
import {loadEnemyLibrary,createLibraryEnemy,enemyLibrarySpec,enemyLibraryColor,releaseUnusedEnemyLibrary,retireLibraryEnemy,stepEnemyRemains,clearEnemyRemains} from './render/enemy-library.js';
import { loadFighterPackages, fighterForPilot } from './three/aircraft/fighter-packages.js';
import { createEnemyModel, flightRollAngle } from './three/aircraft/aircraft-view.js';
import { createWorldEnvironment } from './three/world.js';
import { createPeripheralSystem } from './peripheral/system.js';
import { createReplicaBattleBridge } from './replica/battle-bridge.js';
import { preserveReplicaStars, countStars as countReplicaStars } from './replica/native-battle-rating.js';
import { firstStarCoins, sortieCoins, sortieMaterialReward, tuneMainlineCampaign } from './peripheral/balance-tuning.js';
import { MAINLINE_BOSS_ENDURANCE_SCALE } from './peripheral/mainline-progression.js';
import { applyPeripheralStats, finalPeripheralDamage, peripheralDodgeCooldown, updatePeripheralPassive, updatePeripheralAircraftAbilities } from './peripheral/combat.js';
import { mountPeripheralLobby } from './ui/peripheral-lobby.js';
import { loadImportedArt, importedTexture, updateBossArt } from './render/imported-art.js';
import { createPilot01Visual } from './render/pilot-01-visual.js';
import { playerDamageFeedback, shouldShowLowHealthWarning } from './render/player-damage-feedback.js';
import { createExperienceChip, createExperienceTrails } from './render/experience-visual.js';
import { battleProgress } from './ui/battle-progress.js';
import { createTidalBackground, TIDAL_ASSET_IDS, TIDAL_THEME_ID } from './render/tidal-background.js';
import './style.css';
import { healingReceived } from './ui/battle-feedback.js';
import { stealthOpacity, barrierOpacity } from './ui/status-feedback.js';
import { warningPhase } from './ui/threat-feedback.js';
import {
  RARITIES,
  ROUTES,
  ROUTE_MAP,
  SKILL_MAP,
  createMainWeaponOfferBag,
  createRunStats,
  getDominantPaths,
  getOwnedPaths,
  getReadyUltimateRecipes,
  getSkillChoices,
  getSkillDescription,
  getUltimateProgress,
  ULTIMATE_STAGE_TWO_TASKS,
  weaponBossDamageMultiplier,
} from './roguelite.js';
import { CAMPAIGN as SOURCE_CAMPAIGN, stageLabel, stageWaveTime } from './campaign.js';
import { getBasicShotPattern, getBossMoveDeck, getEnemyAbility, getStageEncounter } from './encounters.js';
import { terrainForStage } from './terrain.js';
import {
  BALANCE_GLOBAL,
  DIFFICULTIES,
  DIFFICULTY_MAP,
  createRunBalance,
  estimateStagePower,
  getEnemyTypeBalance,
  ratePowerReadiness,
} from './balance.js';
import {
  createAssemblyAircraftVisual,
  createEmbeddedAssemblyBay,
  grantAssemblyModules,
  getAssemblyBonuses,
  getAssemblyModuleInfo,
  getAssemblyPassiveWeapons,
  getAssemblyPower,
  getAssemblySnapshot,
  getAssemblyAppearance,
  getFixedModuleCatalog,
  getAssemblySupports,
  getAssemblyWeaponUpgradeCost,
  mountAssemblyBay,
  redrawAssemblyAircraftVisual,
  reconcileCampaignWeaponModules,
  resetAssembly,
  setAssemblySlot,
  setAssemblyDebugUnlocks,
  updateAssemblyAircraftVisual,
  upgradeAssemblyWeapon,
} from './assembly.js';
import {
  SKILL_PATH_UNLOCK_ORDER,
  stageModuleRewardIds,
} from './progression.js';
import {
  PILOTS_BY_RARITY,
  AIRCRAFTS,
  SSR_PILOTS,
  SSR_PILOT_MAP,
  getActivePilot,
  getPilotState,
  pilotCardMarkup,
  resonanceDamageMultiplier,
  selectPilot,
} from './pilots.js';
import {
  GACHA_GOLD_WEAPONS,
  GACHA_POOLS,
  GACHA_PURPLE_WEAPONS,
  GACHA_COMMON_WEAPONS,
  GACHA_QUALITIES,
  GACHA_SLOTS,
} from './gacha-config.js';
import {
  drawGacha,
  equipGachaWeapon,
  getEquippedGachaWeapon,
  getGachaState,
  grantAllCommonWeaponsForDebug,
  grantGachaItem,
  isGachaWeaponCompatible,
  upgradeOwnedCommonWeapon,
} from './gacha.js';
import {
  getDailyLoginStatus,
  loadDailyLoginState,
  planDailyLoginClaim,
  saveDailyLoginState,
} from './daily-login.js';
import {
  canSubmit4399Ranking,
  get4399Api,
  play4399RewardedAd,
  show4399Ranking,
  submit4399Ranking,
} from './platform/4399.js';
import {
  clampCriticalChance,
  createPhaseAfterimageState,
  exclusiveEffectActive,
  resolveMinimumDirectShotProfile,
  sanctuaryEchoProjectileCount,
  storeImmunityCharges,
} from './aircraft-combat.js';
import {
  flightComboLabel,
  pickFlightActionText,
} from './flight-quality.js';
import {
  isDodgeTutorialRunEligible,
  shouldTriggerDodgeTutorial,
} from './dodge-tutorial.js';
import {
  FIRST_SORTIE_STORAGE_KEY,
  shouldAutoStartFirstSortie,
} from './first-sortie.js';
import { mountScrollView, unmountScrollView } from './scroll-view.js';
import { bindDragScrolling } from './drag-scrolling.js';
import {
  createPixiCombatUi,
  createPixiLobby,
  loadPixiLobbyPilotTextures,
} from './ui/pixi-lobby.js';
import { installSinglePointerGuard } from './single-pointer.js';
import { traceFlightInput } from './flight-input-diagnostics.js';
import { createI18n } from './i18n.js';

async function startThunderRuntime() {
function requireGameSession(cleanup) {
  if(isGameSessionCurrent())return;
  cleanup?.();
  throw Object.assign(new Error('当前页面已停止运行，请重新进入游戏'),{code:'retired'});
}
requireGameSession();
const thunderRuntimeGlobals = globalThis.__THUNDER_RUNTIME_GLOBALS__ || {};
const document = thunderRuntimeGlobals.document || globalThis.document;
const window = thunderRuntimeGlobals.window || globalThis.window;
const navigator = thunderRuntimeGlobals.navigator || globalThis.navigator;
const performance = thunderRuntimeGlobals.performance || globalThis.performance;
const localStorage = thunderRuntimeGlobals.localStorage || globalThis.localStorage;
const sessionStorage = thunderRuntimeGlobals.sessionStorage || globalThis.sessionStorage;
const detectedWechatApi = thunderRuntimeGlobals.wx || window?.wx || globalThis.wx;
const platformKind = thunderRuntimeGlobals.platformKind
  || (detectedWechatApi ? 'wechat' : 'web');
const RELEASE_MODE = __THUNDER_RELEASE_MODE__;
const IS_4399_RELEASE = RELEASE_MODE === '4399';
const CHINESE_RELEASE_ONLY = RELEASE_MODE === 'zh' || IS_4399_RELEASE;
// 4399 requires a visible leaderboard entry. Keep the same entry visible in
// local development so the 4399 UI can be reviewed before packaging; other
// release targets still keep utility buttons hidden.
const TOP_UTILITY_BUTTONS_ENABLED = IS_4399_RELEASE || import.meta.env.DEV;
const leaderboardEnabled = TOP_UTILITY_BUTTONS_ENABLED
  && thunderRuntimeGlobals.leaderboardEnabled !== false;
const openPlatformLeaderboard = typeof thunderRuntimeGlobals.openLeaderboard === 'function'
  ? thunderRuntimeGlobals.openLeaderboard
  : null;
const submitPlatformLeaderboards = typeof thunderRuntimeGlobals.submitLeaderboards === 'function'
  ? thunderRuntimeGlobals.submitLeaderboards
  : null;
const submitWorldLeaderboard = typeof thunderRuntimeGlobals.submitWorldLeaderboard === 'function'
  ? thunderRuntimeGlobals.submitWorldLeaderboard
  : null;
const getWorldLeaderboard = typeof thunderRuntimeGlobals.getWorldLeaderboard === 'function'
  ? thunderRuntimeGlobals.getWorldLeaderboard
  : null;
const requestUserProfile = typeof thunderRuntimeGlobals.requestUserProfile === 'function'
  ? thunderRuntimeGlobals.requestUserProfile
  : null;
if (platformKind !== 'wechat') installSinglePointerGuard(window, {
  allowMultiple: event => event.target?.dataset?.multiPointer === 'assembly',
});
const CpSDK = thunderRuntimeGlobals.CpSDK || globalThis.CpSDK;
const sdk = typeof CpSDK === 'function'
  ? new CpSDK({
    // PlayHub supplies the production game ID when the platform package is
    // published. Keep a stable local slug so the development SDK remains
    // deterministic without inventing a production identifier.
    gameId: 'thunder-route',
    rankId: 1307,
    // Keep a hard 10s minimum while still allowing a longer host override.
    // Starting with Math.max also avoids an `1e4` false positive in release audits.
    loadTimeout: Math.max(10000, Number(globalThis.__CP_SDK_LOAD_TIMEOUT__ || 0)),
    debug: false,
  })
      : null;
const i18n = createI18n({
  windowRef: window,
  documentRef: document,
  navigatorRef: navigator,
  localStorageRef: localStorage,
  sdk,
  forcedLanguage: CHINESE_RELEASE_ONLY ? 'zh' : null,
});
i18n.installPixiText(Text);
if (TOP_UTILITY_BUTTONS_ENABLED && !CHINESE_RELEASE_ONLY) {
  i18n.bindToggle(document.querySelector('#languageToggle'));
}
let sdkReady = false;
let sdkGameplayActive = false;

async function initCommonSdk() {
  if (!sdk) return;
  try {
    await sdk.ready();
    sdkReady = true;
  } catch (error) {
    console.warn('通用 SDK 不可用，继续离线运行。', error);
  }
}

function sdkGameplayStart() {
  if (!sdkReady || sdkGameplayActive || typeof sdk?.gameplayStart !== 'function') return;
  try {
    sdk.gameplayStart();
    sdkGameplayActive = true;
  } catch (error) {
    console.warn('通用 SDK gameplayStart 失败。', error);
  }
}

function sdkGameplayStop() {
  if (!sdkReady || !sdkGameplayActive || typeof sdk?.gameplayStop !== 'function') return;
  try {
    sdk.gameplayStop();
  } catch (error) {
    console.warn('通用 SDK gameplayStop 失败。', error);
  } finally {
    sdkGameplayActive = false;
  }
}

async function playRewardedAd() {
  sdkGameplayStop();
  if (typeof thunderRuntimeGlobals.playRewardedAd === 'function') {
    return thunderRuntimeGlobals.playRewardedAd();
  }
  if (sdkReady && typeof sdk?.ads?.rewarded === 'function') {
    const result = await sdk.ads.rewarded();
    if (result?.status !== 'completed') {
      throw new Error('需完整观看广告才能获得奖励');
    }
    return result;
  }
  return play4399RewardedAd();
}

function requireCompletedRewardedAd(result) {
  if (result === false || result?.completed === false || result?.success === false
    || (result?.status && result.status !== 'completed')
    || (result?.code != null && Number(result.code) !== 10001)) {
    throw new Error('需完整观看广告才能获得奖励');
  }
  // The embedded runtime may resolve without a receipt; its resolved promise
  // is the completion signal. Explicit cancellation or failure never grants it.
}
const urlSearchParams = new URLSearchParams(window.location.search);
// Browser builds always use the latest PSD lobby. Native canvas hosts retain
// their required canvas shell until a native PSD lobby is supplied.
const usePeripheralLobby = !thunderRuntimeGlobals.canvas || thunderRuntimeGlobals.nativePeripheralLobby === true;
const BOSS_TEST_MODE = urlSearchParams.get('boss-test') === '1';
const CAMPAIGN = BOSS_TEST_MODE ? SOURCE_CAMPAIGN : tuneMainlineCampaign(SOURCE_CAMPAIGN);
const BOSS_TEST_STAGE_INDEX = Math.max(0, Math.min(
  CAMPAIGN.length - 1,
  Math.floor(Number(urlSearchParams.get('stage')) || 1) - 1,
));
const BOSS_TEST_DIFFICULTY_ID = ['easy', 'hard', 'hell'].includes(urlSearchParams.get('difficulty'))
  ? urlSearchParams.get('difficulty')
  : 'hard';
const BOSS_TEST_LEAD_SECONDS = Math.max(1, Math.min(12, Number(urlSearchParams.get('lead')) || 4));
const BOSS_TEST_HP_MULTIPLIER = Math.max(0.25, Math.min(12, Number(urlSearchParams.get('boss-hp')) || 1));
const BOSS_TEST_LOADOUT_ID = urlSearchParams.get('loadout') === 'standard' ? 'standard' : 'ultimate';
const requestedBossTestRoute = urlSearchParams.get('route');
const BOSS_TEST_ROUTE = ROUTE_MAP.has(requestedBossTestRoute) ? requestedBossTestRoute : null;
const REDUCED_MOTION = Boolean(
  urlSearchParams.get('calm') === '1'
  || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches,
);

const W = 600;
// 600 × 1300 matches the target 750 × 1624 mobile frame at 1.25× render scale.
const H = 1300;
const WORLD_HORIZON_Y = 98;
const WORLD_PROJECTION_OFFSET = 180;
const WORLD_PROJECTION_EXPONENT = 1;
// Legacy ricochet wall; projectile lifetime culling uses the camera viewport.
const RICOCHET_TOP_WORLD_Y = -WORLD_PROJECTION_OFFSET + 10;
const OPENING_BOSS_FIRST_DASH_DELAY_SECONDS = 8;
const OPENING_BOSS_DASH_RECAST_SECONDS = 10;
const BOSS_BARRAGE_INTERVAL_BY_DIFFICULTY = Object.freeze({
  easy: 0.95,
  hard: 0.78,
  hell: 0.58,
});
const BOSS_BARRAGE_MOVES = new Set([
  'fan', 'wall', 'pincer', 'lances', 'wave', 'tsunami', 'spiral', 'pulse', 'radial',
]);
const PLANET_CENTER_Y = 1078;
const PLANET_RADIUS = 980;
const WORLD_UNIT_SCALE = 1.1;
// Aircraft presentation scale; enemy hurt areas follow it, player contact cores do not.
const AIRCRAFT_RENDER_SCALE = 1.32;
// Offset the smaller enemy chassis and distant perspective to approach player size.
const ENEMY_RENDER_SCALE = AIRCRAFT_RENDER_SCALE * 1.6;
function enemyRenderScale(enemy) {
  return enemy.config ? 1.08 * AIRCRAFT_RENDER_SCALE : enemy.elite ? AIRCRAFT_RENDER_SCALE * 1.1 : ENEMY_RENDER_SCALE;
}
// Slightly generous hurt areas catch shots along the visible hull edge.
const ENEMY_HURT_PADDING = 1.15;
const PLAYER_PICKUP_RADIUS = 30;
const FLIGHT_SCORE_SCALE = 0.012;
const FLIGHT_CHAIN_DURATION = 4;
const FLIGHT_GRADES = [
  { id: 'C', min: 0, color: 0xa7c3c5 },
  { id: 'B', min: 600, color: 0x78f1e5 },
  { id: 'A', min: 1600, color: 0x5ec8ff },
  { id: 'S', min: 3200, color: 0xffcc58 },
  { id: 'SS', min: 6000, color: 0xff78c8 },
];
const COLORS = {
  red: 0xff9a83,
  blue: 0x76d7ff,
  cyan: 0xb7a3ff,
  amber: 0xe7ff78,
  white: 0xf8f6ff,
  ink: 0x0a0820,
};
// Enemy projectiles and danger previews share one red visual cue.
const TELEGRAPH_COLOR = HOSTILE_PROJECTILE_COLOR;
const LASER_TELEGRAPH_COLOR = HOSTILE_PROJECTILE_COLOR;
// Visual identity is bound to the stable enemy ID, never to a wave or attack.
const ENEMY_SKIN_BY_ID = Object.freeze({ scout: 0, dart: 1, turret: 2, heavy: 3, relay: 4 });
// Per-tier source bounds and forgiving collision cores live in chapter-enemies.
const TOTAL_SKILL_PATH_COUNT = SKILL_PATH_UNLOCK_ORDER.length;
const PROFILE_STORAGE_KEY = 'thunder-profile-v1';
// Expose the existing debug panel in the current playable build.
const DEBUG_TOOLS_ENABLED = true;
// Opening gameplay tools does not enable the performance overlay.
const PERFORMANCE_DIAGNOSTICS_ENABLED = false;
const AUDIO_DISABLED = thunderRuntimeGlobals.audioDisabled === true || urlSearchParams.get('mute') === '1';
const DIAMOND_AD_REWARD = 20;
// Boss patterns should be threatening because their shape is readable, not
// because every barrage receives a hidden extra damage/count multiplier.
const BOSS_BARRAGE_DAMAGE_MULTIPLIER = 1;
const BOSS_BARRAGE_COUNT_MULTIPLIER = 1;
const BOSS_ENDURANCE_SCALE = MAINLINE_BOSS_ENDURANCE_SCALE;
const COMBAT_SCREEN_SHAKE_SCALE = REDUCED_MOTION ? 0.35 : 0.62;
const COMBAT_FLASH_SCALE = REDUCED_MOTION ? 0.35 : 0.58;
const COMBAT_BACKGROUND_DIM_ALPHA = REDUCED_MOTION ? 0.32 : 0.23;

const DAMAGE_SOURCE_LABELS = Object.freeze({
  bullet: ['敌方子弹', 'Enemy projectile'],
  beam: ['激光束', 'Laser beam'],
  zone: ['范围攻击', 'Area attack'],
  'boss-zone': ['Boss范围攻击', 'Boss area attack'],
  collision: ['敌机碰撞', 'Enemy collision'],
  'boss-dash': ['Boss冲撞', 'Boss dash'],
});

function damageSourceLabel(source) {
  const labels = DAMAGE_SOURCE_LABELS[source] || ['未知攻击', 'Unknown attack'];
  return i18n.getLanguage() === 'en' ? labels[1] : labels[0];
}

function formatLastDamageSummary(damage = game.lastDamageAmount, source = game.lastDamageSource) {
  if (!Number.isFinite(Number(damage)) || !source) return '';
  const prefix = i18n.getLanguage() === 'en' ? 'Last hit' : '最后受击';
  return `${prefix} · ${damageSourceLabel(source)} · -${Math.max(1, Math.ceil(Number(damage)))}`;
}

function boostedBossBarrageCount(count) {
  return Math.max(1, Math.round(count * BOSS_BARRAGE_COUNT_MULTIPLIER));
}

function createWhiteHitFilter() {
  const filter = new ColorMatrixFilter();
  filter.matrix = [
    0, 0, 0, 0, 1,
    0, 0, 0, 0, 1,
    0, 0, 0, 0, 1,
    0, 0, 0, 1, 0,
  ];
  return filter;
}

function triggerHitReaction(target, heavy = false, presentation = null) {
  if (!target || target.dead) return;
  // Shared across weapons on this target; rejected hits never extend a pulse.
  // This gates visuals only: damage is already applied by the caller.
  const profile=hitFeedbackProfile(presentation?.mechanic,heavy,REDUCED_MOTION);
  if ((target.hitFeedbackCooldown || 0) > 0 && !canOverrideHitFeedback(target.hitFeedbackProfile,profile)) return;
  if(target.model?.reactToHit&&!target.model.reactToHit(profile,presentation?.angle||0))return;
  target.hitFeedbackProfile = profile;
  target.hitFeedbackCooldown = Math.max(profile.cooldown,profile.duration);
  target.hitPunchTime = profile.duration;
  target.hitPunchDuration = profile.duration;
  target.hitPunchStrength = profile.strength;
  // Regular enemies keep a short white hit cue, regardless of renderer.
  // The shared cooldown above prevents refresh spam. Elites, bosses and
  // sustained damage retain the softer contact patch instead.
  if (target.config || target.elite || profile.kind==='continuous' || REDUCED_MOTION) {
    target.hitFlashTime = 0;
    target.view.filters = null;
    return;
  }
  target.hitFlashTime = Math.min(profile.duration,0.065);
  target.hitFlashFilter ||= createWhiteHitFilter();
  target.view.filters = [target.hitFlashFilter];
}

function updateHitReaction(target, dt) {
  target.hitFeedbackCooldown = Math.max(0,(target.hitFeedbackCooldown || 0)-dt);
  if (target.hitFlashTime > 0) {
    target.hitFlashTime = Math.max(0, target.hitFlashTime - dt);
    if (target.hitFlashTime <= 0) target.view.filters = null;
  }
  if (!(target.hitPunchTime > 0)) return 1;
  target.hitPunchTime = Math.max(0, target.hitPunchTime - dt);
  const duration = Math.max(0.001, target.hitPunchDuration || 0.09);
  const progress = 1 - target.hitPunchTime / duration;
  return 1 + Math.sin(progress * Math.PI) * (target.hitPunchStrength ?? 0.04);
}

await initCommonSdk();
requireGameSession();

const shell = document.querySelector('#gameShell');
mountTapFeedback(shell);
// Keep logical screen coordinates independent of the high-DPI back buffer.
const isCoarsePointerBrowser = platformKind === 'wechat'
  || (!thunderRuntimeGlobals.canvas && Boolean(window.matchMedia?.('(pointer: coarse)').matches));
const rendererOptions = {
  width: Math.max(1, shell.clientWidth),
  height: Math.max(1, shell.clientHeight),
  backgroundColor: 0x061820,
  // Touch input is not a reason to disable edge smoothing in browser WebGL.
  // The native WeChat context keeps its explicit compatibility settings below.
  antialias: true,
  autoDensity: true,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
};
if (thunderRuntimeGlobals.canvas) {
  const nativePixelRatio = Math.max(
    1,
    Math.min(3, Number(thunderRuntimeGlobals.window?.devicePixelRatio) || 1),
  );
  const contextOptions = {
    alpha: false,
    antialias: false,
    depth: true,
    stencil: true,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
  };
  const context = thunderRuntimeGlobals.canvas.getContext('webgl2', contextOptions);
  if (!context) throw new Error('三维战斗需要支持 WebGL2 的设备或微信基础库。');
  Object.assign(rendererOptions, {
    canvas: thunderRuntimeGlobals.canvas,
    context,
    antialias: false,
    autoDensity: false,
    // 微信的 windowWidth/windowHeight 是逻辑像素。此前强制 resolution=1，
    // 会把 390×844 的画布直接放大到高 DPI 屏，位图字库因此明显发糊。
    // screen 保持逻辑尺寸，Three.js 按设备像素比生成上屏缓冲。
    resolution: nativePixelRatio,
  });
}
const renderer = new WebGLRenderer();
memoryCheckpoint('host-before-renderer');
await renderer.init(rendererOptions);
requireGameSession(()=>renderer.destroy());
memoryCheckpoint('host-renderer-ready');
await loadFighterPackages({ pilotIds: usePeripheralLobby ? [getActivePilot().id, 'pilot-01'] : undefined });
requireGameSession(()=>renderer.destroy());
memoryCheckpoint('host-aircraft-ready');
const app = {
  renderer,
  stage: new Container(),
  ticker: new Ticker({ documentRef: document }),
  get canvas() { return renderer.canvas; },
  get screen() { return renderer.screen; },
};
document.querySelector('#game').appendChild(app.canvas);

// Three's aircraft and chapter scenery do not consume the old sprite atlas.
const importedArtReady = renderer.type === 'three' || thunderRuntimeGlobals.canvas ? Promise.resolve() : loadImportedArt(document);
const pixiLobbyPilotTexturesPromise = thunderRuntimeGlobals.canvas
  ? Promise.resolve(new Map())
  : importedArtReady.then(() => loadPixiLobbyPilotTextures(document, { pilotIds: [getActivePilot().id] }));
const pixiLobbyDailyLoginTexturePromise = thunderRuntimeGlobals.canvas
  ? Promise.resolve(thunderRuntimeGlobals.resolveDailyLoginTexture?.() || null)
  : Promise.resolve(null);

const scene = new Container();
const backgroundLayer = new Container();
const groundLayer = new Container();
const enemyLayer = new Container({ sortableChildren: true });
const bulletLayer = new Container({ sortableChildren: true });
const combatVfx = createCombatVfx();
bulletLayer.addChild(combatVfx.view);
const playerLayer = new Container();
const companionLayer = new Container();
const pickupLayer = new Container();
const experienceTrails = createExperienceTrails(pickupLayer);
const fxLayer = new Container({ sortableChildren: true });
const dangerLayer = new Container({ sortableChildren: true });
// Enemy bullets remain above friendly light, debris and score text; attack
// warnings retain priority above this container. Coordinates/collisions match.
combatVfx.dangerView.zIndex=-10;
dangerLayer.addChild(combatVfx.dangerView);
// A restrained veil keeps terrain identity while separating it from the
// gameplay layers above it. This is deliberately below enemies, bullets and
// the player so it improves contrast without muting combat feedback.
const combatReadabilityOverlay = new Graphics()
  .rect(0, 0, W, H)
  .fill({ color: 0x020614, alpha: COMBAT_BACKGROUND_DIM_ALPHA });
combatReadabilityOverlay.eventMode = 'none';
scene.addChild(backgroundLayer, groundLayer, enemyLayer, pickupLayer, bulletLayer, playerLayer, companionLayer, fxLayer, dangerLayer);
app.stage.addChild(scene);
renderer.configureWorld({layers:[backgroundLayer,groundLayer,enemyLayer,pickupLayer,bulletLayer,playerLayer,companionLayer,fxLayer,dangerLayer],frame:scene});
const threeEnvironment=createWorldEnvironment(renderer.worldScene, { shadowsEnabled: renderer.three.shadowMap.enabled, renderer: renderer.three,
  preloadInitial: !usePeripheralLobby });
backgroundLayer.renderable=false;
groundLayer.renderable=false;

const sceneFrameOrigin = { x: 0, y: 0 };
function resizeScene() {
  app.renderer.resize(Math.max(1, shell.clientWidth), Math.max(1, shell.clientHeight));
  // Browser builds can also run edge-to-edge on a notched iPhone.  Read the
  // CSS safe-area variables here so the Pixi lobby/combat layers share the
  // same inset handling as the legacy DOM HUD. WeChat supplies its insets to
  // its own bootstrap resize handler, so it must not be applied twice here.
  const style = platformKind === 'wechat' ? null : globalThis.getComputedStyle?.(document.documentElement);
  const cssPixels = (property) => {
    const value = Number.parseFloat(style?.getPropertyValue(property));
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  };
  const bounds = shell.getBoundingClientRect();
  const insets = platformKind === 'wechat' ? { top: 0, bottom: 0 } : frameSafeInsets({
    top: bounds.top, bottom: bounds.bottom, height: bounds.height,
    viewportHeight: document.documentElement.clientHeight || window.innerHeight,
    safeTop: cssPixels('--safe-area-inset-top'), safeBottom: cssPixels('--safe-area-inset-bottom'),
    topGap: cssPixels('--mobile-ui-top-gap'),
  });
  const nativeInsets = platformKind === 'wechat' ? app.renderer.nativeUiInsets : null;
  const safeTop = insets.top + (nativeInsets?.top || 0);
  const safeBottom = insets.bottom + (nativeInsets?.bottom || 0);
  if (platformKind !== 'wechat') {
    shell.style.setProperty('--ui-safe-top', `${safeTop}px`);
    shell.style.setProperty('--ui-safe-bottom', `${safeBottom}px`);
  }
  const safeHeight = Math.max(1, app.screen.height - safeTop - safeBottom);
  const contentWidth = Math.max(1, app.screen.width - (nativeInsets?.right || 0));
  const scale = Math.min(contentWidth / W, safeHeight / H);
  scene.scale.set(scale);
  sceneFrameOrigin.x = (contentWidth - W * scale) / 2;
  sceneFrameOrigin.y = safeTop + (safeHeight - H * scale) / 2;
  scene.position.set(sceneFrameOrigin.x, sceneFrameOrigin.y);
}
resizeScene();
window.addEventListener('resize', resizeScene);
window.visualViewport?.addEventListener('resize', resizeScene);
// Lobby skins can change the shell aspect ratio without a window resize.
if (platformKind !== 'wechat' && typeof ResizeObserver === 'function') {
  new ResizeObserver(() => {
    if (app.screen.width !== shell.clientWidth || app.screen.height !== shell.clientHeight) resizeScene();
  }).observe(shell);
}

const ui = {
  performanceHud: document.querySelector('#performanceHud'),
  performanceFps: document.querySelector('#performanceFps'),
  performanceFrameTime: document.querySelector('#performanceFrameTime'),
  score: document.querySelector('#score'),
  high: document.querySelector('#highScore'),
  lives: document.querySelector('#lives'),
  skillDock: document.querySelector('#skillDock'),
  activeWeaponDock: document.querySelector('#activeWeaponDock'),
  activeWeaponButtons: [...document.querySelectorAll('[data-active-slot]')],
  bossWrap: document.querySelector('#bossWrap'),
  bossBar: document.querySelector('#bossBar'),
  bossPercent: document.querySelector('#bossPercent'),
  bossName: document.querySelector('#bossName'),
  combo: document.querySelector('#combo'),
  toast: document.querySelector('#toast'),
  overlay: document.querySelector('#gameOverlay'),
  overlayCopy: document.querySelector('#overlayCopy'),
  startButton: document.querySelector('#startButton'),
  runLevel: document.querySelector('#runLevel'),
  runTimer: document.querySelector('#runTimer'),
  killCount: document.querySelector('#killCount'),
  liveScore: document.querySelector('#liveScore'),
  liveKills: document.querySelector('#liveKills'),
  liveCombo: document.querySelector('#liveCombo'),
  flightQuality: document.querySelector('#flightQuality'),
  flightGrade: document.querySelector('#flightGrade'),
  flightFeed: document.querySelector('#flightFeed'),
  flightFeedAction: document.querySelector('#flightFeedAction'),
  flightFeedCombo: document.querySelector('#flightFeedCombo'),
  flightFeedPoints: document.querySelector('#flightFeedPoints'),
  runProgress: document.querySelector('.run-progress'),
  xpBar: document.querySelector('#xpBar'),
  xpText: document.querySelector('#xpText'),
  campaignProgress: document.querySelector('.campaign-progress'),
  campaignProgressBar: document.querySelector('#campaignProgressBar'),
  campaignProgressText: document.querySelector('#campaignProgressText'),
  campaignDistanceText: document.querySelector('#campaignDistanceText'),
  playerHealth: document.querySelector('#playerHealth'),
  playerHealthLabel: document.querySelector('#playerHealthLabel'),
  playerHealthBar: document.querySelector('#playerHealthBar'),
  playerHealthText: document.querySelector('#playerHealthText'),
  exitButton: document.querySelector('#exitButton'),
  pauseOverlay: document.querySelector('#pauseOverlay'),
  pauseEyebrow: document.querySelector('#pauseEyebrow'),
  pauseTitle: document.querySelector('#pauseTitle'),
  pauseCopy: document.querySelector('#pauseCopy'),
  pausePrimary: document.querySelector('#pausePrimary'),
  pauseSecondary: document.querySelector('#pauseSecondary'),
  upgradeOverlay: document.querySelector('#upgradeOverlay'),
  reviveOverlay: document.querySelector('#reviveOverlay'),
  reviveCountdown: document.querySelector('#reviveCountdown'),
  acceptRevive: document.querySelector('#acceptRevive'),
  declineRevive: document.querySelector('#declineRevive'),
  deathSequence: document.querySelector('#deathSequence'),
  deathTitle: document.querySelector('#deathTitle'),
  deathStatus: document.querySelector('#deathStatus'),
  deathCause: document.querySelector('#deathCause'),
  victorySequence: document.querySelector('#victorySequence'),
  victoryEyebrow: document.querySelector('#victoryEyebrow'),
  victoryTitle: document.querySelector('#victoryTitle'),
  victoryStatus: document.querySelector('#victoryStatus'),
  resultOverlay: document.querySelector('#resultOverlay'),
  resultTitle: document.querySelector('#resultTitle'),
  resultSubtitle: document.querySelector('#resultSubtitle'),
  resultTime: document.querySelector('#resultTime'),
  resultKills: document.querySelector('#resultKills'),
  resultLevel: document.querySelector('#resultLevel'),
  resultScore: document.querySelector('#resultScore'),
  resultStars: document.querySelector('#resultStars'),
  resultReward: document.querySelector('#resultReward'),
  resultContinue: document.querySelector('#resultContinue'),
  upgradeCards: document.querySelector('#upgradeCards'),
  takeAllButton: document.querySelector('#takeAllButton'),
  rerollButton: document.querySelector('#rerollButton'),
  buildList: document.querySelector('#buildList'),
  shieldStatus: document.querySelector('#shieldStatus'),
  routeBadge: document.querySelector('#routeBadge'),
  routeName: document.querySelector('#routeName'),
  routeChain: document.querySelector('#routeChain'),
  upgradeEyebrow: document.querySelector('#upgradeEyebrow'),
  upgradeTitle: document.querySelector('#upgradeTitle'),
  upgradeCopy: document.querySelector('#upgradeCopy'),
  stageLabel: document.querySelector('#stageLabel'),
  sealStatus: document.querySelector('#sealStatus'),
  stageBanner: document.querySelector('#stageBanner'),
  stageBannerArc: document.querySelector('#stageBannerArc'),
  stageBannerName: document.querySelector('#stageBannerName'),
  stageBannerTitle: document.querySelector('#stageBannerTitle'),
  evolutionTracker: document.querySelector('#evolutionTracker'),
  evolutionRequirement: document.querySelector('#evolutionRequirement'),
  evolutionPips: document.querySelector('#evolutionPips'),
  evolutionOverlay: document.querySelector('#evolutionOverlay'),
  evolutionOverlayIcon: document.querySelector('#evolutionOverlayIcon'),
  evolutionOverlayName: document.querySelector('#evolutionOverlayName'),
  evolutionOverlayCopy: document.querySelector('#evolutionOverlayCopy'),
  leaderboardList: document.querySelector('#leaderboardList'),
  leaderboardStatus: document.querySelector('#leaderboardStatus'),
  leaderboardOverlay: document.querySelector('#leaderboardOverlay'),
  rankButton: document.querySelector('#rankButton'),
  leaderboardClose: document.querySelector('#leaderboardClose'),
  menuRankButton: document.querySelector('#menuRankButton'),
  debugUnlockButton: document.querySelector('#debugUnlockButton'),
  pilotLevel: document.querySelector('#pilotLevel'),
  pilotName: document.querySelector('#pilotName'),
  coinBalance: document.querySelector('#coinBalance'),
  diamondBalance: document.querySelector('#diamondBalance'),
  diamondAdButton: document.querySelector('.lobby-wallet .diamond button'),
  battlePower: document.querySelector('#battlePower'),
  battleHome: document.querySelector('#battleHome'),
  growthView: document.querySelector('#growthView'),
  growthEyebrow: document.querySelector('#growthEyebrow'),
  growthTitle: document.querySelector('#growthTitle'),
  growthPower: document.querySelector('#growthPower'),
  growthContent: document.querySelector('#growthContent'),
  lobbyNav: document.querySelector('#lobbyNav'),
  supplyDot: document.querySelector('#supplyDot'),
  difficultyTabs: document.querySelector('#difficultyTabs'),
  starRewards: document.querySelector('#starRewards'),
  stagePrev: document.querySelector('#stagePrev'),
  stageNext: document.querySelector('#stageNext'),
  stagePickerLabel: document.querySelector('#stagePickerLabel'),
  chapterCover: document.querySelector('#chapterCover'),
  chapterArc: document.querySelector('#chapterArc'),
  chapterName: document.querySelector('#chapterName'),
  chapterPower: document.querySelector('#chapterPower'),
  stageDetailsButton: document.querySelector('#stageDetailsButton'),
  stageDetailsPage: document.querySelector('#stageDetailsPage'),
  stageDetailsClose: document.querySelector('#stageDetailsClose'),
  stageDetailsList: document.querySelector('#stageDetailsList'),
  debugPage: document.querySelector('#debugPage'),
  debugPageClose: document.querySelector('#debugPageClose'),
  debugUnlockToggle: document.querySelector('#debugUnlockToggle'),
  debugAddCoins: document.querySelector('#debugAddCoins'),
  debugAddDiamonds: document.querySelector('#debugAddDiamonds'),
  debugGrantWeapons: document.querySelector('#debugGrantWeapons'),
  debugCoinBalance: document.querySelector('#debugCoinBalance'),
  debugDiamondBalance: document.querySelector('#debugDiamondBalance'),
  clearSaveButton: document.querySelector('#clearSaveButton'),
  combatPilotAvatar: document.querySelector('#combatPilotAvatar'),
  combatPilotAvatarImage: document.querySelector('#combatPilotAvatarImage'),
  combatPilotAvatarLevel: document.querySelector('#combatPilotAvatarLevel'),
  combatPilotAvatarResonance: document.querySelector('#combatPilotAvatarResonance'),
  combatPilotAvatarName: document.querySelector('#combatPilotAvatarName'),
  pilotSkillCutIn: document.querySelector('#pilotSkillCutIn'),
  pilotSkillCutInImage: document.querySelector('#pilotSkillCutInImage'),
  pilotSkillCutInCode: document.querySelector('#pilotSkillCutInCode'),
  pilotSkillCutInName: document.querySelector('#pilotSkillCutInName'),
  pilotSkillCutInSkill: document.querySelector('#pilotSkillCutInSkill'),
  gachaOverlay: document.querySelector('#gachaOverlay'),
  gachaCore: document.querySelector('.gacha-core span'),
  gachaResults: document.querySelector('#gachaResults'),
  gachaSkipButton: document.querySelector('#gachaSkipButton'),
  gachaCloseButton: document.querySelector('#gachaCloseButton'),
  pilotArtOverlay: document.querySelector('#pilotArtOverlay'),
  pilotArtClose: document.querySelector('#pilotArtClose'),
  pilotArtImage: document.querySelector('#pilotArtImage'),
  pilotArtCallsign: document.querySelector('#pilotArtCallsign'),
  pilotArtTitle: document.querySelector('#pilotArtTitle'),
  pilotArtSubtitle: document.querySelector('#pilotArtSubtitle'),
  pilotArtSkillIcon: document.querySelector('#pilotArtSkillIcon'),
  pilotArtSkillName: document.querySelector('#pilotArtSkillName'),
  pilotArtSkillDescription: document.querySelector('#pilotArtSkillDescription'),
  pilotArtStatus: document.querySelector('#pilotArtStatus'),
};

ui.performanceHud.hidden = !PERFORMANCE_DIAGNOSTICS_ENABLED;
ui.debugUnlockButton.hidden = !DEBUG_TOOLS_ENABLED;
ui.debugPage.hidden = !DEBUG_TOOLS_ENABLED;

let performanceSampleStartedAt = performance.now();
let performancePreviousFrameAt = performanceSampleStartedAt;
let performanceFrames = 0;
let performanceWorstFrameTime = 0;
let performanceUpdateTime = 0;
let performanceUpdateSamples = 0;
let performanceRenderTime = 0;
let performanceRenderSamples = 0;
const performanceRendererLabel = 'Three.js / WebGL2';

function updatePerformanceHud(now) {
  const frameTime = now - performancePreviousFrameAt;
  performancePreviousFrameAt = now;

  if (frameTime > 1000) {
    performanceSampleStartedAt = now;
    performanceFrames = 0;
    performanceWorstFrameTime = 0;
    performanceUpdateTime = 0;
    performanceUpdateSamples = 0;
    performanceRenderTime = 0;
    performanceRenderSamples = 0;
    window.requestAnimationFrame(updatePerformanceHud);
    return;
  }

  performanceFrames += 1;
  performanceWorstFrameTime = Math.max(performanceWorstFrameTime, frameTime);
  const sampleDuration = now - performanceSampleStartedAt;

  if (sampleDuration >= 750 && performanceFrames > 0) {
    const fps = performanceFrames * 1000 / sampleDuration;
    const averageFrameTime = sampleDuration / performanceFrames;
    const averageUpdateTime = performanceUpdateTime / Math.max(1, performanceUpdateSamples);
    const averageRenderTime = performanceRenderTime / Math.max(1, performanceRenderSamples);
    const roundedFps = Math.round(fps);
    const level = roundedFps < 40 ? 'danger' : roundedFps < 50 ? 'warning' : 'good';

    ui.performanceFps.textContent = String(roundedFps);
    const audioState = sfx?.disabled ? 'off' : sfx?.ctx?.state || 'none';
    ui.performanceFrameTime.textContent = `${averageFrameTime.toFixed(1)}ms · U${averageUpdateTime.toFixed(1)} · R${averageRenderTime.toFixed(1)} · ${performanceRendererLabel} · A:${audioState}`;
    ui.performanceHud.dataset.level = level;

    performanceSampleStartedAt = now;
    performanceFrames = 0;
    performanceWorstFrameTime = 0;
    performanceUpdateTime = 0;
    performanceUpdateSamples = 0;
    performanceRenderTime = 0;
    performanceRenderSamples = 0;
  }

  window.requestAnimationFrame(updatePerformanceHud);
}

if (PERFORMANCE_DIAGNOSTICS_ENABLED) window.requestAnimationFrame(updatePerformanceHud);

const game = {
  state: 'menu',
  elapsed: 0,
  score: 0,
  high: 25000,
  hp: 100,
  lives: 0,
  activeWeapons: [],
  assemblySupports: [],
  balance: null,
  weapon: 'white',
  weaponLevels: { white: 1 },
  combo: 0,
  comboTimer: 0,
  shake: 0,
  flash: 0,
  bossSpawned: false,
  victory: false,
  pointerActive: false,
  relativeDragActive: false,
  relativeDragDeltaX: 0,
  targetX: W / 2,
  targetY: H * 0.78,
  keys: new Set(),
  level: 1,
  xp: 0,
  xpNext: 5,
  kills: 0,
  waveIndex: 0,
  waveTimer: 0.8,
  skills: {},
  primarySkillPath: null,
  evolutionTimer: 0,
  evolutionDuration: 0,
  evolutionDeadline: 0,
  evolutionQueue: [],
  evolutionCurrent: null,
  evolutionReturnState: 'playing',
  mainWeaponOfferBag: [],
  upgradeAdAction: '',
  pendingLevels: 0,
  healDropCounter: 0,
  shieldReady: false,
  shieldTimer: 0,
  missileTimer: 2.5,
  stageIndex: 0,
  stageElapsed: 0,
  stageBossesDefeated: 0,
  sealedSkillId: null,
  scoreSubmitted: false,
  difficultyId: 'easy',
  hitsTaken: 0,
  revivesUsed: 0,
  lastDamageSource: '',
  lastDamageAmount: 0,
  lastDamageSummary: '',
  damageHistory: [],
  lowHealthWarningAt: -Infinity,
  reviveAvailable: false,
  reviveCountdown: 0,
  reviveDeadline: 0,
  reviveAdPending: false,
  victoryRewardDoublePending: false,
  victoryRewardDoubled: false,
  victoryRewardDoubleNotice: false,
  dodgeTutorialPrompted: false,
  pauseMode: 'pause',
  exitFromPause: false,
  flightQuality: 0,
  flightGrade: 'C',
  flightChain: 0,
  flightChainTimer: 0,
  flightLastActionAt: -10,
  flightLastAction: '',
  flightLastPhrase: '',
  flightLastPoints: 0,
  flightLastColor: 0x78f1e5,
  flightDashDistance: 0,
  flightDashCount: 0,
  flightDashCooldown: 0,
  flightFlipCooldown: 0,
  flightFlipArmed: true,
  flightQueuedFlipDirection: 0,
  flightFlipQueueTime: 0,
  flightLastDirection: 0,
  flightLastInputDirection: 0,
  flightSteerDirection: 0,
  flightLastCommandX: W / 2,
  flightHasSteered: false,
  flightFlipTime: 0,
  flightFlipDirection: 1,
  flightBoost: 0,
  flightTrailTimer: 0,
  flightTrailAnchors: null,
  surfaceTravel: 0,
  surfaceHeading: 0,
  surfacePlayerX: W / 2,
  lastFlipDodgeAt: -10,
  grazeCount: 0,
  lastGrazeAt: -10,
  completionRecorded: false,
  callsign: DEFAULT_PLAYER_NAME,
  pilotAbilityTimer: 0,
  pilotSkillCutInShown: false,
  pilotShieldReady: false,
  pilotStealthTime: 0,
  pilotBarrierHp: 0,
  pilotBarrierTime: 0,
  phaseAfterimage: null,
  pilotTrailTimer: 0,
};

const CAMPAIGN_STORAGE_KEY = 'thunder-campaign-v1';
const DEBUG_UNLOCK_STORAGE_KEY = 'thunder-debug-unlock-v1';
const H4399_RANK_ID = '1307';
let firstSortieAlreadyStarted = false;
try {
  firstSortieAlreadyStarted = localStorage.getItem(FIRST_SORTIE_STORAGE_KEY) === '1';
} catch {
  // Storage can be unavailable in embedded previews; this session can still proceed.
}
let debugUnlockAll = false;
const campaignState = loadCampaignState();
let selectedStageIndex = campaignState.selected;
let selectedDifficultyId = campaignState.selectedDifficulty;
if (BOSS_TEST_MODE) {
  debugUnlockAll = true;
  selectedStageIndex = BOSS_TEST_STAGE_INDEX;
  selectedDifficultyId = BOSS_TEST_DIFFICULTY_ID;
}
const profileState = developmentWallet(loadProfileState());
game.callsign = profileState.playerName;
const dailyLoginState = loadDailyLoginState(localStorage);
let rewardedAdPending = false;
let pixiLobby = null;
let pixiCombatUi = null;
let peripheralSystem = null;
let nativeDetailsPendingKey='',nativeDetailsFailedKey='',nativeDetailsResolvedKey='';
function refreshNativeLobbyDetails() {
  if(!peripheralSystem)return;
  const configuration=peripheralSystem.replicaConfiguration(),key=JSON.stringify(configuration);
  if(nativeDetailsResolvedKey===key||nativeDetailsPendingKey===key||nativeDetailsFailedKey===key)return;
  nativeDetailsPendingKey=key;
  import('./replica/native-loadout-details.js').then(({replicaLoadoutDetails})=>replicaLoadoutDetails(configuration))
    .then(result=>{if(peripheralSystem?.acceptReplicaLoadoutDetails(result))nativeDetailsResolvedKey=key;})
    .catch(()=>{nativeDetailsFailedKey=key;})
    .finally(()=>{if(nativeDetailsPendingKey===key)nativeDetailsPendingKey='';});
}
let replicaBattle = null;
setAssemblyDebugUnlocks(debugUnlockAll);
reconcileCampaignWeaponModules(
  Array.from({ length: Math.max(0, campaignState.highestCleared + 1) }, (_, index) => (
    stageModuleRewardIds(index)
  )).flat(),
);
const previewLobbyTab = import.meta.env.DEV
  ? (urlSearchParams.get('lobby-tab') || urlSearchParams.get('pixi-tab'))
  : null;
const previewLobbyModal = import.meta.env.DEV
  && urlSearchParams.get('pixi-modal') === 'daily-login'
  ? 'daily-login'
  : null;
const autoStartFirstSortie = !usePeripheralLobby && shouldAutoStartFirstSortie({
  alreadyStarted: firstSortieAlreadyStarted,
  bossTestMode: BOSS_TEST_MODE,
  previewLobbyTab,
  campaignState,
});
if (autoStartFirstSortie) {
  selectedStageIndex = 0;
  selectedDifficultyId = 'easy';
}
let activeLobbyTab = ['loadout', 'assembly', 'battle', 'upgrade', 'supply'].includes(previewLobbyTab)
  ? previewLobbyTab
  : (BOSS_TEST_MODE ? 'battle' : null);
let selectedGachaPoolId = 'aircraft_permanent';
let activeAssemblyBay = null;
let assemblyMountToken = 0;
let activeAirframePreview = null;
let airframePreviewToken = 0;
const growthPanelCache = new Map();
let activeGrowthPanel = null;
let runStats = createRunStats();

const enemies = [];
const playerBullets = [];
const enemyBullets = [];
const telegraphs = [];
const hostileBeams = [];
const pickups = [];
const particles = [];
const xpOrbs = [];
const drones = [];
const tetherPairs = [];
// Visual effects are decorative. Keep their creation bounded so a high-rate
// build (especially full drone swarms) cannot turn a boss fight into hundreds
// of transient Pixi Graphics per frame. Damage simulation is never throttled.
const MAX_FX_PARTICLES = 360;
const FX_FRAME_LIMITS = Object.freeze({
  trail: 14,
  hit: 12,
  burst: 22,
  debris: 12,
  smoke: 5,
  ring: 3,
  flash: 2,
  text: 1,
});
let fxBudgetFrame = -1;
const fxBudgetUsed = {};

function reserveFxParticles(kind, requested = 1) {
  const frame = Math.floor(performance.now() / (1000 / 60));
  if (frame !== fxBudgetFrame) {
    fxBudgetFrame = frame;
    Object.keys(fxBudgetUsed).forEach((key) => { delete fxBudgetUsed[key]; });
  }
  const cap = FX_FRAME_LIMITS[kind] ?? requested;
  const availableForKind = Math.max(0, cap - (fxBudgetUsed[kind] || 0));
  const availableTotal = Math.max(0, MAX_FX_PARTICLES - particles.length);
  const granted = Math.max(0, Math.min(Math.floor(requested), availableForKind, availableTotal));
  if (granted > 0) fxBudgetUsed[kind] = (fxBudgetUsed[kind] || 0) + granted;
  return granted;
}
let currentUpgradeChoices = [];
let boss = null;
const laserBeamView = new Graphics();
laserBeamView.zIndex = 900;
laserBeamView.bloom = true;
laserBeamView.additive = false;
fxLayer.addChild(laserBeamView);

const LOBBY_MUSIC_URL = new URL('../assets/audio/sfx/music/skin_calm.mp3', import.meta.url).href;
// Combat music uses the current Ogg assets in the music directory.
const FIGHT_MUSIC_URLS = Object.freeze([
  new URL('../assets/audio/sfx/music/brain_fight.ogg', import.meta.url).href,
  new URL('../assets/audio/sfx/music/heart_fight.ogg', import.meta.url).href,
  new URL('../assets/audio/sfx/music/intestine_fight.ogg', import.meta.url).href,
  new URL('../assets/audio/sfx/music/liver_fight.ogg', import.meta.url).href,
  new URL('../assets/audio/sfx/music/lungs_fight.ogg', import.meta.url).href,
  new URL('../assets/audio/sfx/music/skin_fight.ogg', import.meta.url).href,
  new URL('../assets/audio/sfx/music/stomach_fight.ogg', import.meta.url).href,
]);
const BOSS_MUSIC_URL = new URL('../assets/audio/sfx/music/heart_boss.ogg', import.meta.url).href;
// Keep the music present beneath combat effects on both desktop and touch
// speakers, while leaving enough headroom for sharp impact sounds.
const SFX_MASTER_VOLUME = isCoarsePointerBrowser ? 1.6 : 1.25;
const MUSIC_VOLUME = 1;
const SYNTH_SFX_VOLUME = isCoarsePointerBrowser ? 1.25 : 1;
const AUDIO_ASSET = Object.freeze({
  dodge: new URL('../assets/audio/sfx/dodge.wav', import.meta.url).href,
  playerHit: new URL('../assets/audio/sfx/player_hit2.wav', import.meta.url).href,
  wallHit: new URL('../assets/audio/sfx/wall_hit.wav', import.meta.url).href,
  shotHit: new URL('../assets/audio/sfx/shot_hit.wav', import.meta.url).href,
  enemyDeathNormal: new URL('../assets/audio/sfx/enemy_death_normal.wav', import.meta.url).href,
  enemyDeathFly: new URL('../assets/audio/sfx/enemy_death_fly.wav', import.meta.url).href,
  enemyDeathLong: new URL('../assets/audio/sfx/enemy_death_long.wav', import.meta.url).href,
  pickup: new URL('../assets/audio/sfx/pickup_sound.wav', import.meta.url).href,
  upgrade: new URL('../assets/audio/sfx/upgrade_sound.wav', import.meta.url).href,
  volcano: new URL('../assets/audio/sfx/volcano_erupt.wav', import.meta.url).href,
  gun: new URL('../assets/audio/sfx/shots/gun_shot.wav', import.meta.url).href,
  shotgun: new URL('../assets/audio/sfx/shots/shotgun.wav', import.meta.url).href,
  sniper: new URL('../assets/audio/sfx/shots/sniper_shot.wav', import.meta.url).href,
  grenade: new URL('../assets/audio/sfx/shots/grenade_launcher.wav', import.meta.url).href,
  cannon: new URL('../assets/audio/sfx/shots/cannon_shot.wav', import.meta.url).href,
  laser: new URL('../assets/audio/sfx/shots/laser_shot.wav', import.meta.url).href,
  laserLoop: new URL('../assets/audio/sfx/shots/wall_spider_laser_looped.wav', import.meta.url).href,
  lightning: new URL('../assets/audio/sfx/shots/lightning.wav', import.meta.url).href,
  flameLoop: new URL('../assets/audio/sfx/shots/flamethrower.wav', import.meta.url).href,
  deflect: new URL('../assets/audio/sfx/shots/deflect_shot.wav', import.meta.url).href,
  sword: new URL('../assets/audio/sfx/shots/sword_slash.wav', import.meta.url).href,
  swordImpact: new URL('../assets/audio/sfx/shots/sword_impact_gore2.wav', import.meta.url).href,
});
const ENEMY_HIT_URLS = Object.freeze([1, 2, 3, 4].map((index) => new URL(`../assets/audio/sfx/enemy_hit${index}.wav`, import.meta.url).href));
const ENEMY_SPAWN_URLS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8].map((index) => new URL(`../assets/audio/sfx/spawn${index}.wav`, import.meta.url).href));

function setAudioDebugState(key, value) {
  if (!import.meta.env.DEV) return;
  document.documentElement.dataset[key] = String(value);
}

class Sfx {
  constructor() {
    this.disabled = AUDIO_DISABLED;
    this.preferences = readAudioPreferences(localStorage);
    this.effectsMuted = !this.preferences.effects;
    this.ctx = null;
    this.lastAt = new Map();
    this.music = new MusicDirector({
      lobby: LOBBY_MUSIC_URL, fights: FIGHT_MUSIC_URLS, boss: BOSS_MUSIC_URL,
      volume: MUSIC_VOLUME, disabled: this.disabled, debug: setAudioDebugState,
    });
    this.music.muted = !this.preferences.music;
    this.sampleDefinitions = new Map();
    this.samplePools = new Map();
    this.sampleBuffers = new Map();
    this.sampleVolumes = new Map();
    this.loopingSamples = new Map();
    this.loopFadeTimers = new Map();
    this.registerSamples({
      dodge: [AUDIO_ASSET.dodge, 3, 0.42], playerHit: [AUDIO_ASSET.playerHit, 3, 0.5], wallHit: [AUDIO_ASSET.wallHit, 2, 0.3],
      shotHit: [AUDIO_ASSET.shotHit, 7, 0.3], enemyDeathNormal: [AUDIO_ASSET.enemyDeathNormal, 6, 0.36], enemyDeathFly: [AUDIO_ASSET.enemyDeathFly, 4, 0.34],
      enemyDeathLong: [AUDIO_ASSET.enemyDeathLong, 2, 0.54], pickup: [AUDIO_ASSET.pickup, 3, 0.42], upgrade: [AUDIO_ASSET.upgrade, 2, 0.46],
      volcano: [AUDIO_ASSET.volcano, 2, 0.48],
      gun: [AUDIO_ASSET.gun, 8, 0.2], shotgun: [AUDIO_ASSET.shotgun, 5, 0.28], sniper: [AUDIO_ASSET.sniper, 4, 0.28],
      grenade: [AUDIO_ASSET.grenade, 4, 0.34], cannon: [AUDIO_ASSET.cannon, 3, 0.38], laser: [AUDIO_ASSET.laser, 5, 0.22],
      lightning: [AUDIO_ASSET.lightning, 3, 0.25], deflect: [AUDIO_ASSET.deflect, 3, 0.3], sword: [AUDIO_ASSET.sword, 5, 0.27],
      swordImpact: [AUDIO_ASSET.swordImpact, 5, 0.3],
      ...Object.fromEntries(ENEMY_HIT_URLS.map((source, index) => [`enemyHit${index + 1}`, [source, 3, 0.27]])),
      ...Object.fromEntries(ENEMY_SPAWN_URLS.map((source, index) => [`spawn${index + 1}`, [source, 1, 0.3]])),
    });
    this.sampleCursors = new Map();
    this.unlock = this.unlock.bind(this);
    window.addEventListener('pointerdown', this.unlock, { passive: true });
    window.addEventListener('click', this.unlock, { passive: true });
    window.addEventListener('keydown', this.unlock);
    setAudioDebugState('battleMusicSource', LOBBY_MUSIC_URL);
    setAudioDebugState('battleMusicLoop', true);
  }

  registerSamples(definitions) {
    for (const [name, [source, size, volume]] of Object.entries(definitions)) {
      this.sampleDefinitions.set(name, { source, size });
      this.sampleVolumes.set(name, volume);
    }
  }

  setPreference(key,enabled) {
    if (!['music','effects'].includes(key)) return;
    this.preferences[key]=!!enabled;
    this.effectsMuted=!this.preferences.effects;
    if (this.effectsMuted) {
      for (const audio of this.loopingSamples.values()) {audio.pause();audio.volume=0;}
      for (const pool of this.samplePools.values()) for(const audio of pool) audio.pause();
      this.ctx?.suspend?.().catch?.(()=>{});
    } else this.ensureContext()?.resume?.().catch?.(()=>{});
    this.music.setMuted(!this.preferences.music,game,document.hidden);
    saveAudioPreferences(localStorage,this.preferences);
  }

  makeSamplePool(source, size) {
    if (typeof Audio !== 'function') return [];
    // Fallback for browsers without Web Audio. One reusable element prevents
    // Mobile Safari from downloading and decoding the same WAV once per pool
    // voice. Desktop keeps overlapping voices for richer playback.
    const poolSize = isCoarsePointerBrowser ? 1 : size;
    return Array.from({ length: poolSize }, () => {
      const audio = new Audio(source);
      // Creating 99 autoplay-preloaded nodes on boot overwhelms mobile Safari.
      // Each pool is created only when that sound is actually used.
      audio.preload = 'none';
      return audio;
    });
  }

  ensureContext() {
    if (this.disabled) return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!this.ctx) this.ctx = new AudioContextClass();
    return this.ctx;
  }

  start() {
    if (this.disabled) return;
    this.music.beginRun();
    if (!this.effectsMuted) this.ensureContext()?.resume?.().catch?.(() => {});
  }

  syncMusic() {
    this.music.update(game, document.hidden);
  }

  stopCombatLoops() {
    this.flameLoop(false);
    this.laserLoop(false);
  }

  unlock() {
    if (this.disabled) return;
    // On iOS the context must be created/resumed during the first pointerdown;
    // creating it later from the Pixi pointerup action can leave it suspended.
    const context = this.ensureContext();
    if (!this.effectsMuted && context?.state === 'suspended') context.resume().catch(() => {});
    this.music.unlock(game, document.hidden);
  }

  loadSampleBuffer(name) {
    if (this.sampleBuffers.has(name)) return this.sampleBuffers.get(name);
    const definition = this.sampleDefinitions.get(name);
    if (!definition || !this.ctx || typeof fetch !== 'function') return null;
    const context = this.ctx;
    const pending = fetch(definition.source)
      .then((response) => {
        if (!response.ok) throw new Error(`Audio fetch failed: ${response.status}`);
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data))
      .catch((error) => {
        setAudioDebugState(`${name}BufferError`, error?.name || 'decode-failed');
        return null;
      });
    this.sampleBuffers.set(name, pending);
    return pending;
  }

  playBufferedSample(name, { playbackRate = 1, volumeScale = 1 } = {}) {
    const context = this.ctx;
    const pending = this.loadSampleBuffer(name);
    if (!pending || !context) return false;
    const requestedAt = performance.now();
    pending.then((buffer) => {
      // Cache the first request, but do not play a late impact sound after its
      // visual event has already disappeared.
      if (!buffer || this.disabled || this.effectsMuted || this.ctx !== context || performance.now() - requestedAt > 300) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.playbackRate.value = Math.max(0.65, Math.min(1.45, playbackRate));
      const baseVolume = this.sampleVolumes.get(name) ?? 0.3;
      gain.gain.value = Math.max(0, Math.min(1, baseVolume * volumeScale * SFX_MASTER_VOLUME));
      source.connect(gain).connect(context.destination);
      source.start();
    });
    return true;
  }

  playSample(name, { playbackRate = 1, volumeScale = 1 } = {}) {
    if (this.disabled || this.effectsMuted) return false;
    if (isCoarsePointerBrowser) {
      const mobileGroup = name.startsWith('enemyHit')
        ? 'hit'
        : name.startsWith('enemyDeath')
          ? 'death'
          : name.startsWith('spawn')
            ? 'spawn'
            : null;
      const mobileCooldown = mobileGroup === 'hit' ? 90 : mobileGroup === 'death' ? 120 : 140;
      if (mobileGroup) {
        const now = performance.now();
        const key = `mobile:${mobileGroup}`;
        if (now - (this.lastAt.get(key) || -Infinity) < mobileCooldown) return false;
        this.lastAt.set(key, now);
      }
    }
    // AudioBuffer is decoded once and shared by every overlapping voice. This
    // avoids the request/decode storm caused by HTMLAudioElement pools on iOS.
    if (isCoarsePointerBrowser && this.ctx) {
      return this.playBufferedSample(name, { playbackRate, volumeScale });
    }
    let pool = this.samplePools.get(name);
    if (!pool) {
      const definition = this.sampleDefinitions.get(name);
      if (!definition) return false;
      pool = this.makeSamplePool(definition.source, definition.size);
      this.samplePools.set(name, pool);
    }
    if (!pool.length) return false;
    const cursor = this.sampleCursors.get(name) || 0;
    const audio = pool[cursor % pool.length];
    this.sampleCursors.set(name, (cursor + 1) % pool.length);
    audio.pause();
    try {
      audio.currentTime = 0;
    } catch {
      // Playing from the beginning is best effort before metadata loads.
    }
    audio.playbackRate = Math.max(0.65, Math.min(1.45, playbackRate));
    const baseVolume = this.sampleVolumes.get(name) ?? 0.3;
    audio.volume = Math.max(0, Math.min(1, baseVolume * volumeScale * SFX_MASTER_VOLUME));
    const attempt = audio.play();
    attempt?.then?.(() => setAudioDebugState(`${name}SamplePlaying`, true))
      .catch?.((error) => setAudioDebugState(`${name}SampleError`, error?.name || 'play-rejected'));
    return true;
  }
  playThrottled(key, cooldown, name, options = {}) {
    const now = performance.now();
    if (now - (this.lastAt.get(key) || -Infinity) < cooldown) return false;
    this.lastAt.set(key, now);
    return this.playSample(name, options);
  }
  positionalVolume(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !player) return 1;
    const distance = Math.hypot(x - player.x, y - player.y);
    // Tiny phone speakers lose quiet, distant impacts almost completely. Keep
    // spatial depth, but retain enough floor for hit feedback to stay legible.
    const floor = isCoarsePointerBrowser ? 0.45 : 0.22;
    return Math.max(floor, 1 - distance / 1100);
  }
  playAt(name, x, y, options = {}) {
    return this.playSample(name, { ...options, volumeScale: (options.volumeScale ?? 1) * this.positionalVolume(x, y) });
  }
  setLoop(name, source, active, volume = 0.2) {
    if (this.disabled) return;
    if (this.effectsMuted) active=false;
    let audio = this.loopingSamples.get(name);
    if (!audio && active && typeof Audio === 'function') {
      audio = new Audio(source);
      audio.preload = 'none';
      audio.loop = true;
      audio.volume = Math.min(1, volume * SFX_MASTER_VOLUME);
      this.loopingSamples.set(name, audio);
    }
    if (!audio) return;
    const fadeTimer = this.loopFadeTimers.get(name);
    if (active) {
      if (fadeTimer) window.clearTimeout(fadeTimer);
      this.loopFadeTimers.delete(name);
      audio.volume = Math.min(1, volume * SFX_MASTER_VOLUME);
      if (!audio.paused) return;
      audio.play().catch(() => {});
    } else if (!audio.paused) {
      if (fadeTimer) return;
      audio.volume = 0.0001;
      this.loopFadeTimers.set(name, window.setTimeout(() => {
        if (!audio.paused && audio.volume <= 0.001) {
          audio.pause();
          try { audio.currentTime = 0; } catch { /* Metadata is optional. */ }
        }
        this.loopFadeTimers.delete(name);
      }, 120));
    }
  }
  tone(freq, duration, type = 'square', volume = 0.035, slide = 0) {
    if (this.disabled || this.effectsMuted) return;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(25, freq + slide), now + duration);
    gain.gain.setValueAtTime(Math.min(0.25, volume * SYNTH_SFX_VOLUME), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }
  burstTone(sequence = []) {
    for (const step of sequence) {
      const delay = Math.max(0, Number(step.delay) || 0);
      window.setTimeout(() => {
        this.tone(
          step.freq,
          step.duration,
          step.type,
          step.volume,
          step.slide,
        );
      }, delay);
    }
  }
  fireWeapon(type = 'gun') {
    const cooldowns = { gun: 72, shotgun: 130, sniper: 180, grenade: 160, cannon: 190, laser: 85, lightning: 130, sword: 150, stomp: 250 };
    this.playThrottled(`weapon:${type}`, cooldowns[type] || 100, type, { playbackRate: 0.95 + Math.random() * 0.1 });
  }
  dodge() { this.playThrottled('dodge', 110, 'dodge'); }
  wallHit(x, y) { this.playThrottled('wall-hit', 170, 'wallHit', { volumeScale: this.positionalVolume(x, y) }); }
  playerHit() { this.playThrottled('player-hit', 220, 'playerHit'); }
  projectileImpact(style, x, y) {
    const melee = style === 'sword' || style === 'tether';
    const name = melee ? 'swordImpact' : 'shotHit';
    this.playThrottled(`impact:${melee ? 'melee' : 'shot'}`, melee ? 75 : 55, name, { volumeScale: this.positionalVolume(x, y) });
  }
  enemyHit(enemy, x, y, impactStyle = '') {
    const now = performance.now();
    if (now - (enemy.lastAudioHitAt || -Infinity) < 72) return;
    enemy.lastAudioHitAt = now;
    const name = impactStyle === 'sword' || impactStyle === 'tether'
      ? 'swordImpact'
      : `enemyHit${1 + Math.floor(Math.random() * ENEMY_HIT_URLS.length)}`;
    this.playAt(name, x, y, { volumeScale: enemy.config ? 1.2 : 1 });
  }
  enemyDeath(enemy) {
    const name = enemy.kind === 'heavy' || enemy.elite ? 'enemyDeathLong' : enemy.kind === 'dart' ? 'enemyDeathFly' : 'enemyDeathNormal';
    this.playAt(name, enemy.x, enemy.y);
  }
  enemySpawn() {
    const name = `spawn${1 + Math.floor(Math.random() * ENEMY_SPAWN_URLS.length)}`;
    this.playThrottled('enemy-spawn', 110, name, { volumeScale: 0.9 });
  }
  explode(big = false) {
    this.playThrottled('generic-explosion', big ? 180 : 95, big ? 'enemyDeathLong' : 'shotHit', { volumeScale: big ? 0.8 : 0.65 });
  }
  pickup() { this.playThrottled('pickup', 70, 'pickup'); }
  upgrade() { this.playThrottled('upgrade', 120, 'upgrade'); }
  volcano() { this.playThrottled('volcano', 220, 'volcano'); }
  deflect(x, y) { this.playThrottled('deflect', 80, 'deflect', { volumeScale: this.positionalVolume(x, y) }); }
  flameLoop(active) { this.setLoop('flame', AUDIO_ASSET.flameLoop, active, 0.17); }
  laserLoop(active) { this.setLoop('laser', AUDIO_ASSET.laserLoop, active, 0.16); }
  active() { this.tone(120, 0.7, 'sawtooth', 0.09, -90); }
  bossWarning() {
    this.burstTone([
      { freq: 720, duration: 0.12, type: 'square', volume: 0.028, slide: -60, delay: 0 },
      { freq: 180, duration: 0.24, type: 'sawtooth', volume: 0.048, slide: -45, delay: 0 },
      { freq: 860, duration: 0.1, type: 'square', volume: 0.024, slide: -90, delay: 210 },
      { freq: 140, duration: 0.28, type: 'triangle', volume: 0.036, slide: 55, delay: 210 },
    ]);
  }
  bossSpawn() {
    this.burstTone([
      { freq: 88, duration: 0.52, type: 'sawtooth', volume: 0.08, slide: -32, delay: 0 },
      { freq: 146, duration: 0.34, type: 'triangle', volume: 0.045, slide: 180, delay: 70 },
      { freq: 420, duration: 0.18, type: 'square', volume: 0.022, slide: -170, delay: 220 },
    ]);
  }
  bossPhaseShift(phase = 2) {
    if (phase >= 3) {
      this.burstTone([
        { freq: 110, duration: 0.5, type: 'sawtooth', volume: 0.082, slide: -35, delay: 0 },
        { freq: 260, duration: 0.26, type: 'triangle', volume: 0.038, slide: 260, delay: 120 },
        { freq: 980, duration: 0.11, type: 'square', volume: 0.026, slide: -420, delay: 250 },
      ]);
      return;
    }
    this.burstTone([
      { freq: 130, duration: 0.3, type: 'sawtooth', volume: 0.058, slide: 70, delay: 0 },
      { freq: 240, duration: 0.2, type: 'triangle', volume: 0.032, slide: 240, delay: 90 },
      { freq: 680, duration: 0.1, type: 'square', volume: 0.02, slide: -180, delay: 180 },
    ]);
  }
  bossFire(pattern = '', phase = 1) {
    const cooldown = pattern === 'spiral' ? 120 : pattern === 'thunder' ? 160 : 190;
    if (!this.playThrottled('boss-fire', cooldown, 'cannon', { playbackRate: 0.9 + phase * 0.04, volumeScale: 0.88 + phase * 0.12 })) return;
    const power = 0.024 + Math.min(0.022, Math.max(0, phase - 1) * 0.008);
    if (pattern === 'thunder' || pattern === 'lances' || pattern === 'arrows') {
      this.burstTone([
        { freq: 420, duration: 0.08, type: 'square', volume: power, slide: 320, delay: 0 },
        { freq: 165, duration: 0.18, type: 'triangle', volume: power + 0.01, slide: -40, delay: 0 },
      ]);
      return;
    }
    if (pattern === 'solar' || pattern === 'underworld' || pattern === 'spiral' || pattern === 'tsunami') {
      this.burstTone([
        { freq: 210, duration: 0.16, type: 'sawtooth', volume: power + 0.01, slide: 90, delay: 0 },
        { freq: 520, duration: 0.09, type: 'square', volume: power * 0.7, slide: -110, delay: 55 },
      ]);
      return;
    }
    this.burstTone([
      { freq: 170, duration: 0.18, type: 'triangle', volume: power + 0.008, slide: -28, delay: 0 },
      { freq: 360, duration: 0.07, type: 'square', volume: power * 0.66, slide: -120, delay: 40 },
    ]);
  }
  bossDeathFinal() {
    this.playThrottled('boss-death', 0, 'enemyDeathLong', { volumeScale: 1.25 });
    this.burstTone([
      { freq: 72, duration: 0.7, type: 'sawtooth', volume: 0.1, slide: -24, delay: 0 },
      { freq: 118, duration: 0.46, type: 'triangle', volume: 0.05, slide: 180, delay: 150 },
      { freq: 980, duration: 0.12, type: 'square', volume: 0.028, slide: -520, delay: 460 },
    ]);
  }
}
const sfx = new Sfx();
const lobbyAudioEnabled=()=>!sfx.disabled&&!sfx.effectsMuted&&!document.hidden&&['menu','gameover','victory'].includes(game.state);
const lobbySoundPlayer=createLobbySoundPlayer({context:()=>sfx.ensureContext(),enabled:lobbyAudioEnabled});
const lobbyFeedback=createLobbyFeedback({play:key=>void lobbySoundPlayer.play(key),stop:()=>lobbySoundPlayer.stop(),prepare:()=>lobbySoundPlayer.prepare(),enabled:lobbyAudioEnabled});
window.addEventListener('pointerdown',()=>lobbySoundPlayer.prepare());
window.addEventListener('keydown',()=>lobbySoundPlayer.prepare());
document.addEventListener('visibilitychange',()=>{if(document.hidden)lobbyFeedback.stop();});
// The first user gesture unlocks the track requested by the current scene.

function createBossTestLoadout() {
  if (BOSS_TEST_LOADOUT_ID !== 'ultimate') return { id: 'standard', route: null, primaryWeapon: null };
  const route = BOSS_TEST_ROUTE || ROUTES[Math.floor(Math.random() * ROUTES.length)]?.id || 'red';
  return { id: 'ultimate', route, primaryWeapon: null };
}

const bossTestLoadout = BOSS_TEST_MODE ? createBossTestLoadout() : null;

function currentPrimaryWeapon() {
  const item=game.debugPrimaryWeapon || getEquippedGachaWeapon();
  return item?.common ? null : item;
}

function worldProjectionDepth(y) {
  return Math.max(0, Math.min(1, (y + WORLD_PROJECTION_OFFSET) / (H + WORLD_PROJECTION_OFFSET)));
}

function projectWorldPoint(x, y) {
  if (renderer.type === 'three') return { x, y, scale:1, unitScale:1, depth:Math.max(0,Math.min(1,y/H)) };
  const depth = worldProjectionDepth(y);
  const curvedDepth = Math.pow(depth, WORLD_PROJECTION_EXPONENT);
  const lateralScale = 0.62 + Math.pow(depth, 0.78) * 0.38;
  return {
    x: W / 2 + (x - W / 2) * lateralScale,
    y: WORLD_HORIZON_Y + (H - WORLD_HORIZON_Y) * curvedDepth,
    scale: 0.58 + Math.pow(depth, 0.72) * 0.42,
    unitScale: 0.66 + Math.pow(depth, 0.72) * 0.34,
    depth,
  };
}

function unprojectWorldPoint(x, y) {
  if (renderer.type === 'three') return renderer.unprojectBattle(x,y);
  const curvedDepth = Math.max(0, Math.min(1, (y - WORLD_HORIZON_Y) / (H - WORLD_HORIZON_Y)));
  const depth = Math.pow(curvedDepth, 1 / WORLD_PROJECTION_EXPONENT);
  const lateralScale = 0.62 + Math.pow(depth, 0.78) * 0.38;
  return {
    x: W / 2 + (x - W / 2) / Math.max(0.62, lateralScale),
    y: depth * (H + WORLD_PROJECTION_OFFSET) - WORLD_PROJECTION_OFFSET,
  };
}

let activeTerrainTheme = terrainForStage(CAMPAIGN[selectedStageIndex]);
const spaceBackdrop = new Graphics();
const starField = new Graphics();
for (let i = 0; i < 92; i += 1) {
  const x = (i * 137 + (i % 7) * 31) % W;
  const y = (i * 73 + (i % 5) * 19) % 455;
  const size = i % 13 === 0 ? 1.8 : i % 5 === 0 ? 1.1 : 0.65;
  starField.circle(x, y, size).fill({
    color: i % 11 === 0 ? COLORS.cyan : i % 7 === 0 ? 0xffb09c : 0xe5e3ff,
    alpha: 0.16 + (i % 4) * 0.1,
  });
}

const astralFragments = new Graphics();
for (let index = 0; index < 76; index += 1) {
  const angle = (index * 2.39996) % (Math.PI * 2);
  const radius = 180 + ((index * 53) % 390);
  const x = W / 2 + Math.cos(angle) * radius;
  const y = H * 0.49 + Math.sin(angle) * radius * 1.24;
  const size = 1.5 + (index % 5) * 0.7;
  astralFragments
    .poly([x, y - size * 1.7, x + size, y + size, x - size * 0.7, y + size * 0.45])
    .fill({
      color: index % 9 === 0 ? COLORS.red : index % 5 === 0 ? COLORS.cyan : 0xe8e4ff,
      alpha: 0.035 + (index % 4) * 0.018,
    });
}
const highAtmosphere = new Graphics();
const planetBody = new Graphics();
const planetMask = new Graphics().circle(W / 2, PLANET_CENTER_Y, PLANET_RADIUS).fill({ color: 0xffffff });
const surfaceDetails = new Container({ sortableChildren: true });
surfaceDetails.mask = planetMask;

const skyDetails = new Graphics();
const surfaceTexture = new Graphics();
const oceanBands = new Graphics();
const horizonLandmarks = new Graphics();

function mixColor(a, b, t = 0.5) {
  const ratio = Math.max(0, Math.min(1, t));
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  return (
    (Math.round(ar + (br - ar) * ratio) << 16)
    | (Math.round(ag + (bg - ag) * ratio) << 8)
    | Math.round(ab + (bb - ab) * ratio)
  );
}

function rgbToHsl(color) {
  const r = ((color >> 16) & 0xff) / 255;
  const g = ((color >> 8) & 0xff) / 255;
  const b = (color & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: lightness };

  const delta = max - min;
  const saturation = lightness > 0.5
    ? delta / (2 - max - min)
    : delta / (max + min);
  let hue;
  if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return { h: hue * 60, s: saturation, l: lightness };
}

function hslToRgb(hue, saturation, lightness) {
  const h = ((hue % 360) + 360) % 360 / 360;
  const s = Math.max(0, Math.min(1, saturation));
  const l = Math.max(0, Math.min(1, lightness));
  if (s === 0) {
    const channel = Math.round(l * 255);
    return (channel << 16) | (channel << 8) | channel;
  }

  const hueToRgb = (p, q, t) => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = hueToRgb(p, q, h + 1 / 3);
  const g = hueToRgb(p, q, h);
  const b = hueToRgb(p, q, h - 1 / 3);
  return (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
}

// Enemy silhouettes deliberately sit on the opposite side of the stage hue.
// The stage keeps its atmospheric palette; only hostile units get this
// contrast pass so they remain readable in dense waves and boss patterns.
function enemyPaletteForStage(stage) {
  const earlyPalette = EARLY_ENEMY_PALETTES[stage?.index];
  if (earlyPalette) return earlyPalette;
  const source = rgbToHsl(stage?.color ?? COLORS.cyan);
  const hue = source.h + 180;
  const saturation = Math.max(0.72, Math.min(0.96, source.s * 1.18 + 0.16));
  const lightness = source.l > 0.68 ? 0.46 : source.l < 0.34 ? 0.58 : 0.52;
  const base = hslToRgb(hue, saturation, lightness);
  return Object.freeze({
    base,
    dark: hslToRgb(hue, Math.min(0.9, saturation * 0.84), Math.max(0.25, lightness - 0.22)),
    accent: hslToRgb(hue + 28, Math.min(0.98, saturation + 0.08), 0.74),
    glow: hslToRgb(hue + 8, Math.min(0.96, saturation), 0.62),
  });
}

const TERRAIN_TONE_WEIGHTS = Object.freeze({
  sky: 1,
  atmosphere: 0.72,
  surface: 0.95,
  surfaceDeep: 0.9,
  bandA: 0.9,
  bandB: 0.9,
  land: 0.88,
  landLight: 0.62,
  grid: 0.58,
  gridAccent: 0.38,
  structure: 0.78,
  light: 0.32,
  weather: 0.28,
});

// The first three combat zones use authored tone ramps instead of mixing the
// original warm terrain colors into a pastel target. That old interpolation
// produced a gray veil on stage one, especially over the large planet surface.
const EARLY_TERRAIN_PALETTES = Object.freeze([
  {
    sky: 0x1d507b,
    atmosphere: 0x4597c4,
    surface: 0x347ba5,
    surfaceDeep: 0x20577d,
    bandA: 0x438aaf,
    bandB: 0x326f96,
    land: 0x3e829f,
    landLight: 0x70b6d3,
    grid: 0x2e73a0,
    gridAccent: 0x82cfe8,
    structure: 0x1c4a65,
    light: 0xa9e6f7,
    weather: 0x7ec7dd,
  },
  {
    sky: 0x174832,
    atmosphere: 0x52ab78,
    surface: 0x3b8c62,
    surfaceDeep: 0x245f45,
    bandA: 0x479a6d,
    bandB: 0x367d59,
    land: 0x438e65,
    landLight: 0x78c68d,
    grid: 0x347d59,
    gridAccent: 0x91ddaa,
    structure: 0x1f5039,
    light: 0xb5efc0,
    weather: 0x86d19c,
  },
  {
    sky: 0x5a2644,
    atmosphere: 0xc95e90,
    surface: 0xa94773,
    surfaceDeep: 0x6e2f4d,
    bandA: 0xb65680,
    bandB: 0x973e69,
    land: 0xae5379,
    landLight: 0xde8eb0,
    grid: 0x984469,
    gridAccent: 0xf2a5c5,
    structure: 0x5c2b43,
    light: 0xffc3da,
    weather: 0xe88db4,
  },
]);

const EARLY_ENEMY_PALETTES = Object.freeze([
  { base: 0xe66f45, dark: 0x55243a, accent: 0xffc06b, glow: 0xff8d58 }, // 蓝底 · 橙敌
  { base: 0xb63d8f, dark: 0x431b55, accent: 0xff91c6, glow: 0xe35cac }, // 绿底 · 洋红敌
  { base: 0x087d86, dark: 0x073d4e, accent: 0x5de9d5, glow: 0x24bbc0 }, // 粉底 · 青敌
]);

function terrainThemeForStage(stageIndex) {
  const base = terrainForStage(CAMPAIGN[stageIndex] || CAMPAIGN[0]);
  const earlyPalette = EARLY_TERRAIN_PALETTES[stageIndex];
  const lateProgress = stageIndex < 3
    ? 0
    : Math.min(1, (stageIndex - 2) / 2);
  const lateDarkness = stageIndex < 3 ? 0 : 0.1 + lateProgress * 0.68;
  const colors = {};

  for (const [key, weight] of Object.entries(TERRAIN_TONE_WEIGHTS)) {
    if (!Number.isFinite(base[key])) continue;
    if (earlyPalette) {
      colors[key] = Number.isFinite(earlyPalette[key])
        ? earlyPalette[key]
        : base[key];
      continue;
    }
    const source = rgbToHsl(base[key]);
    const darkTarget = hslToRgb(source.h, Math.min(1, source.s * 1.12 + 0.04), 0.075);
    colors[key] = mixColor(base[key], darkTarget, lateDarkness * weight);
  }

  return Object.freeze({ ...base, ...colors });
}

function drawSkyDetails(graphics, theme) {
  graphics.clear();
  const glow = mixColor(theme.atmosphere, theme.gridAccent, 0.35);
  if (theme.skyFeature === 'storm-clouds') {
    for (let i = 0; i < 8; i += 1) {
      const x = -80 + i * 92;
      const y = 120 + (i % 3) * 34;
      graphics.ellipse(x, y, 74, 22).fill({ color: theme.surfaceDeep, alpha: 0.2 })
        .ellipse(x + 36, y + 10, 92, 28).fill({ color: theme.grid, alpha: 0.1 });
    }
    graphics.moveTo(105, 145).lineTo(86, 190).lineTo(112, 182).lineTo(94, 232)
      .stroke({ color: theme.gridAccent, width: 2.4, alpha: 0.28 });
  } else if (theme.skyFeature === 'cold-aurora' || theme.skyFeature === 'ion-aurora' || theme.skyFeature === 'green-aurora') {
    for (let i = 0; i < 4; i += 1) {
      const y = 105 + i * 34;
      graphics.moveTo(-40, y)
        .bezierCurveTo(110, y - 55, 225, y + 60, 380, y - 16)
        .bezierCurveTo(470, y - 52, 555, y + 20, 650, y - 22)
        .stroke({ color: i % 2 ? theme.gridAccent : glow, width: 9 - i, alpha: 0.045 + i * 0.012 });
    }
  } else if (theme.skyFeature === 'solar-haze' || theme.skyFeature === 'dust-moon' || theme.skyFeature === 'sand-haze') {
    graphics.circle(470, 156, 54).fill({ color: theme.light, alpha: 0.075 })
      .circle(470, 156, 32).fill({ color: theme.atmosphere, alpha: 0.11 });
    for (let i = 0; i < 7; i += 1) {
      const y = 92 + i * 42;
      graphics.moveTo(-30, y).quadraticCurveTo(220, y + (i % 2 ? 12 : -12), W + 30, y + 4)
        .stroke({ color: theme.weather, width: 2 + (i % 3), alpha: 0.035 });
    }
  } else if (theme.skyFeature === 'ember-haze' || theme.skyFeature === 'spore-haze') {
    for (let i = 0; i < 28; i += 1) {
      const x = (i * 53) % W;
      const y = 72 + (i * 97) % 320;
      graphics.circle(x, y, 1.5 + (i % 4)).fill({ color: i % 3 ? theme.weather : theme.light, alpha: 0.06 + (i % 3) * 0.025 });
    }
  } else {
    graphics.ellipse(W / 2, 170, 240, 42).fill({ color: theme.atmosphere, alpha: 0.035 })
      .ellipse(W / 2, 205, 320, 28).stroke({ color: theme.gridAccent, width: 1.5, alpha: 0.08 });
  }
}

function drawSurfaceTexture(graphics, theme, travel = 0, heading = 0) {
  graphics.clear();
  const line = mixColor(theme.grid, theme.landLight, 0.32);
  const driftX = Math.sin(heading * 0.38) * 42;
  const tiles = (base, spacing, count) => {
    const pixelTravel = travel * 520;
    const phase = ((pixelTravel % spacing) + spacing) % spacing;
    return Array.from({ length: count }, (_, index) => ({
      index,
      // Keep the world moving toward the player. Once a line exits at the
      // bottom, the next repeated line enters above the horizon instead of
      // rewinding the entire pattern upward.
      y: WORLD_HORIZON_Y + base + index * spacing + phase - spacing,
    }));
  };
  const xAt = (seed, loop = W + 140) => ((seed % loop) + loop) % loop - 70 + driftX;
  if (theme.textureType === 'sand-ripples' || theme.textureType === 'snowdrifts') {
    for (const tile of tiles(38, 50, 24)) {
      const amplitude = theme.textureType === 'snowdrifts' ? 16 : 24;
      graphics.moveTo(-35, tile.y)
        .quadraticCurveTo(130, tile.y - amplitude, 305, tile.y + amplitude * 0.35)
        .quadraticCurveTo(480, tile.y + amplitude, W + 35, tile.y - amplitude * 0.2)
        .stroke({ color: line, width: tile.index % 4 === 0 ? 2.2 : 1.2, alpha: theme.textureType === 'snowdrifts' ? 0.11 : 0.15 });
    }
  } else if (theme.textureType === 'lava-cracks' || theme.textureType === 'ice-cracks' || theme.textureType === 'salt-flats') {
    for (const tile of tiles(32, 67, 38)) {
      const x = xAt(tile.index * 83);
      const crackColor = theme.textureType === 'lava-cracks' ? theme.light : line;
      graphics.moveTo(x, tile.y)
        .lineTo(x + 18 - (tile.index % 5) * 7, tile.y + 28)
        .lineTo(x + 44 - (tile.index % 3) * 12, tile.y + 48)
        .stroke({ color: crackColor, width: theme.textureType === 'lava-cracks' ? 2.4 : 1.6, alpha: theme.textureType === 'lava-cracks' ? 0.26 : 0.17 });
    }
  } else if (theme.textureType === 'currents') {
    for (const tile of tiles(35, 61, 21)) {
      graphics.moveTo(-20, tile.y)
        .bezierCurveTo(110, tile.y + 28, 225, tile.y - 34, 360, tile.y + 8)
        .bezierCurveTo(462, tile.y + 38, 530, tile.y - 12, W + 25, tile.y + 16)
        .stroke({ color: theme.gridAccent, width: 2.2, alpha: 0.17 });
    }
  } else if (theme.textureType === 'blocks' || theme.textureType === 'runic-plates') {
    for (const tile of tiles(26, 88, 14)) {
      const offset = tile.index % 2 ? 46 : 0;
      for (let col = -2; col < 8; col += 1) {
        graphics.rect(col * 96 + offset + driftX, tile.y, 72, 36)
          .stroke({ color: line, width: 1.4, alpha: 0.105 + Math.abs(tile.index % 14) * 0.006 });
      }
    }
  } else if (theme.textureType === 'terrace-lines') {
    for (const tile of tiles(32, 58, 21)) {
      const sizeIndex = Math.abs(tile.index % 21);
      graphics.ellipse(W / 2, tile.y, 330 + sizeIndex * 8, 21 + sizeIndex * 1.5)
        .stroke({ color: theme.landLight, width: 1.6, alpha: 0.17 });
    }
  } else if (theme.textureType === 'facets') {
    for (const tile of tiles(28, 109, 32)) {
      const x = xAt(tile.index * 71);
      const s = 14 + Math.abs(tile.index % 5) * 8;
      graphics.poly([x, tile.y - s, x + s * 0.7, tile.y, x, tile.y + s, x - s * 0.75, tile.y])
        .stroke({ color: tile.index % 2 ? theme.gridAccent : theme.landLight, width: 1.6, alpha: 0.18 });
    }
  } else if (theme.textureType === 'bog-pools') {
    for (const tile of tiles(38, 79, 24)) {
      const x = xAt(tile.index * 97);
      graphics.ellipse(x, tile.y, 26 + Math.abs(tile.index % 4) * 11, 8 + Math.abs(tile.index % 3) * 5)
        .fill({ color: theme.landLight, alpha: 0.1 })
        .stroke({ color: theme.light, width: 1.2, alpha: 0.14 });
    }
  } else {
    for (const tile of tiles(36, 61, 28)) {
      const x = xAt(tile.index * 89);
      graphics.ellipse(x, tile.y, 32, 10).stroke({ color: line, width: 1.3, alpha: 0.14 });
    }
  }
}
function drawHorizonLandmarks(graphics, theme) {
  graphics.clear();
  const count = Math.round(7 * (theme.featureDensity || 1));
  for (let i = 0; i < count; i += 1) {
    const x = 36 + i * (W - 72) / Math.max(1, count - 1);
    const y = WORLD_HORIZON_Y + 32 + (i % 3) * 8;
    const h = 22 + (i % 4) * 10;
    const body = i % 2 ? theme.structure : mixColor(theme.structure, theme.land, 0.35);
    if (theme.landmarkType?.includes('harbor') || theme.landmarkType?.includes('platform')) {
      graphics.rect(x - 18, y, 36, 5).fill({ color: body, alpha: 0.62 })
        .rect(x - 6, y - h, 12, h).fill({ color: body, alpha: 0.58 })
        .circle(x, y - h - 4, 3).fill({ color: theme.light, alpha: 0.42 });
    } else if (theme.landmarkType?.includes('tower') || theme.landmarkType?.includes('spire') || theme.landmarkType?.includes('obelisk')) {
      graphics.poly([x - 8, y + 4, x - 3, y - h, x, y - h - 16, x + 3, y - h, x + 8, y + 4])
        .fill({ color: body, alpha: 0.56 })
        .circle(x, y - h - 18, 4).fill({ color: theme.light, alpha: 0.38 });
    } else if (theme.landmarkType?.includes('city') || theme.landmarkType?.includes('citadel')) {
      graphics.rect(x - 20, y - h * 0.55, 10, h * 0.55).fill({ color: body, alpha: 0.52 })
        .rect(x - 5, y - h, 12, h).fill({ color: body, alpha: 0.62 })
        .rect(x + 12, y - h * 0.72, 12, h * 0.72).fill({ color: body, alpha: 0.5 });
    } else if (theme.landmarkType?.includes('lab') || theme.landmarkType?.includes('relay')) {
      graphics.rect(x - 16, y - 7, 32, 7).fill({ color: body, alpha: 0.56 })
        .moveTo(x, y - 8).lineTo(x, y - h - 8)
        .stroke({ color: theme.landLight, width: 2, alpha: 0.54 })
        .ellipse(x, y - h - 10, 13, 5).stroke({ color: theme.light, width: 1.6, alpha: 0.58 });
    } else {
      graphics.poly([x - 24, y + 4, x - 10, y - h * 0.75, x + 5, y - h, x + 24, y + 4])
        .fill({ color: body, alpha: 0.48 })
        .rect(x - 5, y - h - 5, 10, 9).fill({ color: theme.light, alpha: 0.38 });
    }
  }
}

function drawSurfaceLand(graphics, theme, index, width, height) {
  graphics.clear();
  if (theme.featureType === 'dunes' || theme.featureType === 'canyon') {
    graphics
      .ellipse(0, 1, width * 1.15, height * 0.8).fill({ color: theme.land })
      .moveTo(-width, 2).quadraticCurveTo(-width * 0.2, -height * 1.25, width, 1)
      .stroke({ color: theme.landLight, width: 3, alpha: 0.58 });
    if (theme.featureType === 'canyon') {
      graphics.poly([-width * 0.7, 2, -width * 0.35, -height, width * 0.25, -height * 0.7, width * 0.72, 2])
        .fill({ color: theme.landLight, alpha: 0.38 });
    }
    return;
  }
  if (theme.featureType === 'snow' || theme.featureType === 'glacier') {
    graphics
      .poly([-width, 5, -width * 0.55, -height * 0.45, -width * 0.12, -height * 1.5, width * 0.28, -height * 0.65, width, 4])
      .fill({ color: theme.land })
      .poly([-width * 0.35, -height * 0.55, -width * 0.12, -height * 1.5, width * 0.12, -height * 0.72])
      .fill({ color: theme.landLight, alpha: 0.96 });
    if (theme.featureType === 'glacier') {
      graphics.poly([-width * 0.7, 2, -width * 0.2, -height * 0.7, width * 0.38, -height * 0.42, width * 0.75, 2])
        .stroke({ color: theme.gridAccent, width: 2, alpha: 0.72 });
    }
    return;
  }
  if (theme.featureType === 'crystal') {
    graphics
      .poly([-width, 4, -width * 0.52, -height * 0.45, -width * 0.12, -height * 1.45, width * 0.12, -height * 0.6, width * 0.52, -height, width, 3])
      .fill({ color: theme.land })
      .poly([-width * 0.2, -height * 0.2, 0, -height * 1.6, width * 0.2, -height * 0.15])
      .fill({ color: theme.landLight, alpha: 0.74 });
    return;
  }
  if (theme.featureType === 'volcanic') {
    graphics
      .poly([-width, 5, -width * 0.7, -height * 0.35, -width * 0.18, -height, width * 0.18, -height * 0.72, width, 4])
      .fill({ color: theme.land })
      .moveTo(-width * 0.45, -height * 0.15).lineTo(-width * 0.1, -height * 0.5).lineTo(width * 0.12, -height * 0.16).lineTo(width * 0.48, -height * 0.5)
      .stroke({ color: theme.light, width: 2.2, alpha: 0.86 });
    return;
  }
  if (theme.featureType === 'terraces') {
    graphics.ellipse(0, 3, width, height).fill({ color: theme.land });
    for (let row = 0; row < 3; row += 1) {
      graphics.ellipse(0, 1 - row * 3.5, width * (0.8 - row * 0.16), height * (0.62 - row * 0.1))
        .stroke({ color: theme.landLight, width: 2, alpha: 0.5 });
    }
    return;
  }
  if (theme.featureType === 'marsh') {
    graphics
      .ellipse(-width * 0.25, 0, width * 0.72, height * 0.75).fill({ color: theme.land })
      .ellipse(width * 0.35, 2, width * 0.68, height * 0.66).fill({ color: theme.landLight, alpha: 0.54 })
      .circle(-width * 0.15, -height * 0.2, 3 + index % 3).fill({ color: theme.light, alpha: 0.38 });
    return;
  }
  if (theme.featureType === 'salt') {
    graphics
      .poly([-width, 2, -width * 0.55, -height * 0.45, width * 0.35, -height * 0.28, width, 3, width * 0.5, height * 0.55, -width * 0.45, height * 0.45])
      .fill({ color: theme.land })
      .moveTo(-width * 0.72, 0).lineTo(width * 0.68, -height * 0.1)
      .moveTo(-width * 0.2, -height * 0.42).lineTo(width * 0.08, height * 0.35)
      .stroke({ color: theme.landLight, width: 1.5, alpha: 0.72 });
    return;
  }
  graphics.poly([
    -width, 4, -width * 0.62, -height * 0.45, -width * 0.18, -height,
    width * 0.28, -height * 0.72, width, 2, width * 0.42, height * 0.6, -width * 0.48, height * 0.7,
  ]).fill({ color: theme.land });
  graphics.poly([
    -width * 0.54, 1, -width * 0.18, -height * 0.65, width * 0.25, -height * 0.45,
    width * 0.54, 0, width * 0.15, height * 0.24, -width * 0.35, height * 0.28,
  ]).fill({ color: theme.landLight, alpha: 0.72 });
}

function drawSurfaceStructure(graphics, theme, index) {
  graphics.clear();
  const light = theme.light;
  const body = theme.structure;
  const side = index % 2 ? 1 : -1;
  if (theme.structureType === 'farm') {
    graphics.rect(-16, -10, 32, 8).fill({ color: body })
      .moveTo(-15, -8).lineTo(15, -8).stroke({ color: theme.landLight, width: 2, alpha: 0.8 })
      .rect(side * 7 - 2, -22, 4, 14).fill({ color: body })
      .circle(side * 7, -23, 2.5).fill({ color: light });
  } else if (theme.structureType === 'harbor' || theme.structureType === 'platform') {
    graphics.rect(-18, -5, 36, 6).fill({ color: body })
      .rect(-9, -14, 18, 10).fill({ color: body })
      .rect(side * 12 - 1.5, -24, 3, 19).fill({ color: theme.landLight })
      .circle(side * 12, -25, 2.5).fill({ color: light });
  } else if (theme.structureType === 'city' || theme.structureType === 'citadel') {
    const towerHeight = theme.structureType === 'citadel' ? 24 : 16;
    graphics.rect(-17, -9, 11, 10).fill({ color: body })
      .rect(-3, -towerHeight, 9, towerHeight + 1).fill({ color: body })
      .rect(9, -14, 10, 15).fill({ color: body })
      .rect(-1, -towerHeight + 4, 3, 3).fill({ color: light })
      .rect(12, -10, 3, 3).fill({ color: light });
  } else if (theme.structureType === 'obelisk' || theme.structureType === 'spire') {
    graphics.poly([-6, 0, -3, -25, 0, -34, 3, -25, 6, 0]).fill({ color: body })
      .circle(0, -35, 3.2).fill({ color: light })
      .circle(0, -35, 8).stroke({ color: light, width: 1.4, alpha: 0.48 });
  } else if (theme.structureType === 'research' || theme.structureType === 'relay') {
    graphics.rect(-13, -7, 26, 8).fill({ color: body })
      .rect(-2, -23, 4, 17).fill({ color: theme.landLight })
      .ellipse(0, -24, 10, 4).stroke({ color: light, width: 2, alpha: 0.88 })
      .circle(0, -24, 2.3).fill({ color: light });
  } else if (theme.structureType === 'ruins') {
    graphics.rect(-16, -14, 5, 15).fill({ color: body })
      .rect(-3, -9, 5, 10).fill({ color: body })
      .rect(10, -18, 5, 19).fill({ color: body })
      .moveTo(-18, 1).lineTo(18, 1).stroke({ color: theme.landLight, width: 2, alpha: 0.72 });
  } else if (theme.structureType === 'refinery' || theme.structureType === 'bunker') {
    graphics.roundRect(-17, -12, 34, 13, 3).fill({ color: body })
      .rect(side * 10 - 2, -27, 4, 16).fill({ color: body })
      .circle(side * 10, -28, 2.5).fill({ color: light })
      .rect(-9, -8, 4, 3).fill({ color: light, alpha: 0.72 });
  } else {
    graphics.rect(-14, -10, 28, 11).fill({ color: body })
      .rect(side * 8 - 2, -24, 4, 15).fill({ color: theme.landLight })
      .circle(side * 8, -25, 2.6).fill({ color: light });
  }
}

function makeSurfaceFeature(index) {
  const view = new Container();
  const shadow = new Graphics();
  const land = new Graphics();
  const structures = new Graphics();
  const wake = new Graphics();
  view.addChild(shadow, wake, land, structures);
  view.zIndex = 10;
  return {
    view, index, shadow, wake, land, structures,
    lane: ((index * 0.47) % 1.8) - 0.9,
    depthOffset: ((index * 0.163) % 1.08) - 0.08,
  };
}

const surfaceFeatures = Array.from({ length: 24 }, (_, index) => makeSurfaceFeature(index));
const surfaceGrid = new Graphics();
surfaceGrid.zIndex = 2000;
surfaceDetails.addChild(surfaceTexture, oceanBands, horizonLandmarks, ...surfaceFeatures.map((feature) => feature.view), surfaceGrid);

// Re-recording Graphics commands is much more expensive than transforming a
// display object on iOS Safari. The terrain still travels continuously, but
// its two large procedural Graphics buffers are rebuilt at 15Hz on touch
// browsers instead of every render frame. 15Hz is deliberate: it keeps the
// far-field motion readable while leaving the foreground, gameplay and input
// at the ticker's full rate.
const MOBILE_SURFACE_REBUILD_INTERVAL = 1 / 15;
let surfaceGeometryElapsed = MOBILE_SURFACE_REBUILD_INTERVAL;

const planetRim = new Graphics();
const horizonBeacon = new Graphics();

backgroundLayer.addChild(
  spaceBackdrop,
  starField,
  skyDetails,
  highAtmosphere,
  planetBody,
  surfaceDetails,
  planetMask,
  planetRim,
  horizonBeacon,
  astralFragments,
);

const weatherStreaks = [];
for (let i = 0; i < 28; i += 1) {
  const length = 12 + (i % 5) * 7;
  const view = new Graphics();
  view.position.set((i * 79) % W, (i * 137) % H);
  view.rotation = -0.14;
  groundLayer.addChild(view);
  weatherStreaks.push({ view, index: i, length, speed: 90 + (i % 7) * 22, drift: -9 - (i % 4) * 3 });
}
groundLayer.addChild(combatReadabilityOverlay);

function drawWeather(streak, theme) {
  const { view, index, length } = streak;
  view.clear();
  view.rotation = -0.14;
  if (theme.weatherType === 'snow') {
    view.circle(0, 0, 1.8 + index % 3).fill({ color: theme.weather, alpha: 0.34 + (index % 3) * 0.1 });
  } else if (theme.weatherType === 'ash' || theme.weatherType === 'spore' || theme.weatherType === 'pollen') {
    view.circle(0, 0, 1.2 + (index % 4) * 0.6).fill({ color: theme.weather, alpha: 0.12 + (index % 3) * 0.06 });
  } else if (theme.weatherType === 'spark') {
    view.poly([0, -4, 1.5, -1, 0, 4, -1.5, -1]).fill({ color: theme.weather, alpha: 0.3 + (index % 3) * 0.08 });
  } else if (theme.weatherType === 'heat') {
    view.moveTo(-length * 0.35, 0).quadraticCurveTo(0, -3, length * 0.35, 0)
      .stroke({ color: theme.weather, width: 1.4, alpha: 0.12 + (index % 3) * 0.04 });
    view.rotation = 0;
  } else {
    view.roundRect(-1, -length, theme.weatherType === 'rain' ? 2 : 1.5, length, 1)
      .fill({ color: theme.weather, alpha: theme.weatherType === 'rain' ? 0.12 + (index % 3) * 0.04 : 0.07 + (index % 3) * 0.025 });
  }
}

let tidalBackground = null;
function applyTerrainTheme(stageIndex = selectedStageIndex) {
  activeTerrainTheme = terrainThemeForStage(stageIndex);
  // Three owns the visible canyon. Do not rebuild hundreds of hidden legacy
  // Graphics paths on every sortie or chapter selection.
  if (renderer.type === 'three') return;
  tidalBackground?.setStage(CAMPAIGN[stageIndex]?.id);
  const theme = activeTerrainTheme;
  skyDetails.alpha = REDUCED_MOTION ? 0.62 : 0.78;
  surfaceDetails.alpha = REDUCED_MOTION ? 0.48 : 0.72;
  spaceBackdrop.clear().rect(0, 0, W, H).fill({ color: theme.sky });
  highAtmosphere.clear()
    .circle(W / 2, PLANET_CENTER_Y, PLANET_RADIUS + 24).fill({ color: theme.atmosphere, alpha: 0.045 })
    .circle(W / 2, PLANET_CENTER_Y, PLANET_RADIUS + 12).stroke({ color: theme.gridAccent, width: 10, alpha: 0.11 });
  drawSkyDetails(skyDetails, theme);
  planetBody.clear()
    .circle(W / 2, PLANET_CENTER_Y, PLANET_RADIUS).fill({ color: theme.surface })
    .circle(W / 2, PLANET_CENTER_Y + 155, PLANET_RADIUS - 35).fill({ color: theme.surfaceDeep, alpha: 0.58 });
  drawSurfaceTexture(surfaceTexture, theme);
  drawHorizonLandmarks(horizonLandmarks, theme);
  oceanBands.clear();
  for (let band = 0; band < 10; band += 1) {
    const y = WORLD_HORIZON_Y + 72 + band * 112;
    oceanBands.rect(-80, y, W + 160, 58).fill({
      color: band % 2 ? theme.bandA : theme.bandB,
      alpha: 0.06 + band * 0.007,
    });
  }
  oceanBands
    .ellipse(84, 570, 245, 82).fill({ color: theme.landLight, alpha: 0.07 })
    .ellipse(515, 845, 280, 118).fill({ color: theme.land, alpha: 0.08 })
    .ellipse(260, 1160, 390, 120).fill({ color: theme.grid, alpha: 0.08 });
  for (const feature of surfaceFeatures) {
    const density = theme.featureDensity || 1;
    const width = (24 + (feature.index % 5) * 7) * (0.9 + density * 0.12);
    const height = (11 + (feature.index % 3) * 4) * (0.94 + density * 0.08);
    feature.shadow.clear().ellipse(0, 9, 31 + (feature.index % 4) * 6, 8).fill({ color: theme.surfaceDeep, alpha: 0.46 });
    drawSurfaceLand(feature.land, theme, feature.index, width, height);
    drawSurfaceStructure(feature.structures, theme, feature.index);
    feature.wake.clear();
    if (theme.waterLike) {
      feature.wake.moveTo(-width * 0.75, 8).quadraticCurveTo(0, 18, width * 0.75, 8)
        .stroke({ color: theme.gridAccent, width: 1.5, alpha: 0.28 });
    }
  }
  planetRim.clear()
    .circle(W / 2, PLANET_CENTER_Y, PLANET_RADIUS + 2).stroke({ color: theme.gridAccent, width: 5, alpha: 0.27 })
    .circle(W / 2, PLANET_CENTER_Y, PLANET_RADIUS - 5).stroke({ color: theme.landLight, width: 1.5, alpha: 0.22 });
  horizonBeacon.clear()
    .ellipse(W / 2, WORLD_HORIZON_Y + 18, 230, 20).fill({ color: theme.atmosphere, alpha: 0.045 })
    .ellipse(W / 2, WORLD_HORIZON_Y + 18, 230, 20).stroke({ color: theme.gridAccent, width: 1, alpha: 0.14 });
  weatherStreaks.forEach((streak) => drawWeather(streak, theme));
  if (import.meta.env.DEV) {
    document.documentElement.dataset.terrainId = tidalBackground?.active ? TIDAL_THEME_ID : theme.id;
    document.documentElement.dataset.terrainName = tidalBackground?.active ? '潮汐群岛' : theme.name;
  }
}

applyTerrainTheme(selectedStageIndex);

const scanlines = new Graphics();
for (let y = 0; y < H; y += 8) scanlines.rect(0, y, W, 1).fill({ color: 0xd8ffff, alpha: 0.012 });
fxLayer.addChild(scanlines);

const ULTIMATE_WING_PROFILES = Object.freeze({
  red: {
    points: [[0, -15], [25, -13], [84, -8], [69, 1], [79, 14], [39, 10], [22, 27], [3, 16]],
    detail: 'blade', span: 84, fold: 0.38, deploy: 0.025, speed: 9.4, flap: 0.025, heave: 0.8, flex: 0.035, haloSpeed: 1.8,
  },
  blue: {
    points: [[0, -14], [20, -16], [45, -12], [77, 2], [69, 19], [45, 12], [21, 27], [3, 17]],
    detail: 'wave', span: 77, fold: 0.42, deploy: 0.12, speed: 3.2, flap: 0.08, heave: 2.2, flex: 0.05, haloSpeed: -0.9, phase: Math.PI,
  },
  prism: {
    points: [[0, -15], [18, -19], [42, -9], [68, -15], [82, 0], [62, 17], [37, 10], [21, 25], [3, 16]],
    detail: 'crystal', span: 82, fold: 0.36, deploy: 0.06, speed: 5.6, flap: 0.04, heave: 1.2, flex: 0.07, haloSpeed: 1.25,
  },
  ricochet: {
    points: [[0, -13], [21, -15], [52, -10], [76, 2], [66, 20], [42, 18], [22, 27], [4, 15]],
    detail: 'orb', span: 76, fold: 0.34, deploy: 0.09, speed: 6.8, flap: 0.055, heave: 1.7, flex: 0.09, haloSpeed: 1.5, pulse: 0.08,
  },
  mech: {
    points: [[0, -14], [18, -16], [33, -10], [48, -15], [64, -6], [79, 4], [65, 17], [43, 12], [26, 23], [3, 16]],
    detail: 'drone', span: 79, fold: 0.44, deploy: 0.045, speed: 7.4, flap: 0.035, heave: 1.8, flex: 0.025, haloSpeed: 1.1, phase: Math.PI * 0.5,
  },
  frost: {
    points: [[0, -15], [18, -17], [34, -28], [42, -12], [62, -22], [80, 0], [63, 20], [49, 11], [34, 24], [21, 10], [4, 17]],
    detail: 'frost', span: 80, fold: 0.4, deploy: 0.075, speed: 2.4, flap: 0.045, heave: 1, flex: 0.045, haloSpeed: -0.65,
  },
  cluster: {
    points: [[0, -16], [28, -18], [62, -12], [84, 2], [75, 22], [50, 17], [41, 28], [24, 20], [3, 16]],
    detail: 'pods', span: 84, fold: 0.31, deploy: 0.035, speed: 8.6, flap: 0.03, heave: 1.4, flex: 0.08, haloSpeed: 1.35, pulse: 0.045,
  },
  sword: {
    points: [[0, -12], [18, -12], [92, -3], [78, 7], [89, 12], [28, 13], [16, 25], [3, 16]],
    detail: 'sword', span: 92, fold: 0.48, deploy: -0.025, speed: 4.6, flap: 0.065, heave: 1.5, flex: 0.03, haloSpeed: 1.7,
  },
  tether: {
    points: [[0, -14], [19, -15], [42, -4], [66, -12], [82, 2], [66, 15], [42, 8], [21, 25], [3, 16]],
    detail: 'tether', span: 82, fold: 0.43, deploy: 0.14, speed: 3.8, flap: 0.09, heave: 2.8, flex: 0.055, haloSpeed: -1.4, phase: Math.PI,
  },
  laser: {
    points: [[0, -13], [20, -16], [88, -5], [82, 7], [45, 10], [21, 25], [3, 16]],
    detail: 'solar', span: 88, fold: 0.35, deploy: 0.015, speed: 2.8, flap: 0.025, heave: 0.7, flex: 0.04, haloSpeed: 2.1,
  },
  execute: {
    points: [[0, -15], [20, -18], [44, -7], [81, -16], [72, 2], [86, 15], [48, 12], [24, 27], [3, 16]],
    detail: 'scythe', span: 86, fold: 0.5, deploy: 0.11, speed: 7.8, flap: 0.075, heave: 2, flex: 0.08, haloSpeed: -1.9, phase: Math.PI * 0.35,
  },
  split: {
    points: [[0, -14], [22, -14], [47, -21], [44, -6], [79, -1], [68, 10], [46, 8], [55, 24], [31, 13], [20, 28], [3, 16]],
    detail: 'fork', span: 79, fold: 0.39, deploy: 0.055, speed: 5.2, flap: 0.07, heave: 1.8, flex: 0.075, haloSpeed: 1.05, phase: Math.PI * 0.7,
  },
});

function mirrorWingPoints(points, side) {
  return points.flatMap(([x, y]) => [side * x, y]);
}

function drawUltimateWingBlade(view, side, tint, routeId = 'blue') {
  const profile = ULTIMATE_WING_PROFILES[routeId] || ULTIMATE_WING_PROFILES.blue;
  const span = profile.span;
  view.clear()
    .poly(mirrorWingPoints(profile.points, side))
    .fill({ color: 0x11152f, alpha: 0.96 })
    .stroke({ color: tint, width: 2.2, alpha: 0.92, join: 'round' })
    .poly([
      side * 9, -9,
      side * (span * 0.72), 1,
      side * (span * 0.58), 9,
      side * 18, 7,
    ])
    .fill({ color: tint, alpha: 0.44 })
    .moveTo(side * 17, 15)
    .lineTo(side * (span - 16), 6)
    .stroke({ color: 0xffffff, width: 1.2, alpha: 0.6, cap: 'round' });

  const rectX = (x, width) => (side > 0 ? x : -x - width);
  if (profile.detail === 'blade' || profile.detail === 'sword') {
    view.poly(mirrorWingPoints([[28, -8], [span - 4, -4], [span - 17, 3], [33, 5]], side))
      .fill({ color: tint, alpha: profile.detail === 'sword' ? 0.72 : 0.55 });
  } else if (profile.detail === 'wave') {
    for (let index = 0; index < 3; index += 1) {
      view.circle(side * (31 + index * 15), -2 + index * 4, 3.4)
        .stroke({ color: tint, width: 1.4, alpha: 0.7 - index * 0.12 });
    }
  } else if (profile.detail === 'crystal' || profile.detail === 'frost') {
    view.poly(mirrorWingPoints([[31, -7], [43, -18], [48, -5]], side))
      .fill({ color: 0xffffff, alpha: 0.54 })
      .poly(mirrorWingPoints([[50, 5], [62, -11], [68, 5]], side))
      .fill({ color: tint, alpha: 0.72 });
  } else if (profile.detail === 'orb' || profile.detail === 'tether') {
    view.circle(side * (span - 19), 3, 9)
      .stroke({ color: tint, width: 2, alpha: 0.8 })
      .circle(side * (span - 19), 3, 3)
      .fill({ color: 0xffffff, alpha: 0.86 });
  } else if (profile.detail === 'drone') {
    [29, 48, 65].forEach((x, index) => {
      view.roundRect(rectX(x, 12), -7 + (index % 2) * 5, 12, 8, 2)
        .fill({ color: tint, alpha: 0.58 + index * 0.1 });
    });
  } else if (profile.detail === 'pods') {
    [43, 61].forEach((x) => {
      view.circle(side * x, 4, 6)
        .fill({ color: tint, alpha: 0.44 })
        .stroke({ color: 0xffffff, width: 1, alpha: 0.5 });
    });
  } else if (profile.detail === 'solar') {
    view.roundRect(rectX(30, 43), -7, 43, 10, 2)
      .fill({ color: tint, alpha: 0.62 })
      .moveTo(side * 42, -6).lineTo(side * 42, 2)
      .moveTo(side * 55, -5).lineTo(side * 55, 3)
      .stroke({ color: 0xffffff, width: 1, alpha: 0.55 });
  } else if (profile.detail === 'scythe') {
    view.poly(mirrorWingPoints([[40, -5], [span - 2, -13], [span - 15, 4], [49, 8]], side))
      .fill({ color: tint, alpha: 0.66 });
  } else if (profile.detail === 'fork') {
    view.poly(mirrorWingPoints([[35, -7], [69, -2], [45, 3]], side))
      .fill({ color: tint, alpha: 0.64 })
      .poly(mirrorWingPoints([[31, 9], [53, 21], [43, 8]], side))
      .fill({ color: 0xffffff, alpha: 0.42 });
  }

  view.circle(side * (span - 11), 5, 3.6)
    .fill({ color: tint, alpha: 0.94 })
    .circle(side * (span - 11), 5, 1.5)
    .fill({ color: 0xffffff, alpha: 0.96 });
}

function createUltimateWingForm() {
  const root = new Container();
  root.visible = false;
  root.alpha = 0;
  const aura = new Graphics()
    .ellipse(0, 5, 142, 45)
    .fill({ color: COLORS.cyan, alpha: 0.08 });
  const halo = new Graphics()
    .circle(0, 2, 56)
    .stroke({ color: COLORS.cyan, width: 1.6, alpha: 0.44 })
    .circle(0, 2, 48)
    .stroke({ color: 0xffffff, width: 1, alpha: 0.16 })
    .poly([0, -61, 4, -54, -4, -54])
    .fill({ color: COLORS.cyan, alpha: 0.9 })
    .poly([61, 2, 54, 6, 54, -2])
    .fill({ color: COLORS.cyan, alpha: 0.72 });
  const left = new Graphics();
  const right = new Graphics();
  const frontLeft = new Graphics();
  const frontRight = new Graphics();
  const core = new Graphics()
    .poly([0, -19, 10, 1, 0, 18, -10, 1])
    .fill({ color: 0x10142c, alpha: 0.98 })
    .stroke({ color: COLORS.cyan, width: 1.8, alpha: 0.9 })
    .poly([0, -12, 5, 1, 0, 11, -5, 1])
    .fill({ color: COLORS.cyan, alpha: 0.72 });
  root.addChild(aura, halo, left, right, frontLeft, frontRight, core);
  drawUltimateWingBlade(left, -1, COLORS.cyan, 'blue');
  drawUltimateWingBlade(right, 1, COLORS.cyan, 'blue');
  drawUltimateWingBlade(frontLeft, -1, COLORS.cyan, 'blue');
  drawUltimateWingBlade(frontRight, 1, COLORS.cyan, 'blue');
  return {
    root,
    aura,
    halo,
    left,
    right,
    frontLeft,
    frontRight,
    core,
    progress: 0,
    frontProgress: 0,
    routeId: '',
    tint: COLORS.cyan,
    profile: ULTIMATE_WING_PROFILES.blue,
  };
}

function makePlayerShip() {
  const c = new Container();
  const sigil = new Graphics()
    .circle(0, 0, 45).stroke({ color: COLORS.cyan, width: 1.5, alpha: 0.24 })
    .circle(0, 0, 35).stroke({ color: COLORS.white, width: 1, alpha: 0.1 })
    .poly([0, -49, 4, -43, -4, -43]).fill({ color: COLORS.amber, alpha: 0.8 })
    .poly([49, 0, 43, 4, 43, -4]).fill({ color: COLORS.red, alpha: 0.66 });
  const glow = new Graphics().ellipse(0, 7, 48, 30).fill({ color: COLORS.cyan, alpha: 0.075 });
  const phaseAfterimages = new Graphics()
    .poly([-48, -30, -62, -4, -56, 24, -43, 13, -38, -20]).fill({ color: 0x9a7cff, alpha: 0.22 })
    .poly([48, -30, 62, -4, 56, 24, 43, 13, 38, -20]).fill({ color: 0x9a7cff, alpha: 0.22 })
    .poly([-50, -26, -54, 14, -45, 8]).stroke({ color: 0xe8e1ff, width: 1.5, alpha: 0.68 })
    .poly([50, -26, 54, 14, 45, 8]).stroke({ color: 0xe8e1ff, width: 1.5, alpha: 0.68 });
  phaseAfterimages.visible = false;
  const aircraft = createAssemblyAircraftVisual();
  aircraft.root.scale.set(0.24);
  const ultimateWingForm = createUltimateWingForm();
  const pilotMarkings = new Graphics();
  const mountedModules = new Container();
  const weaponCore = new Graphics()
    .roundRect(-2, -39, 4, 14, 2).fill({ color: COLORS.red })
    .circle(0, 4, 4).fill({ color: COLORS.red, alpha: 0.9 });
  const rails = new Graphics()
    .roundRect(-31, -6, 4, 28, 2).fill({ color: 0xbcd0d0 })
    .roundRect(27, -6, 4, 28, 2).fill({ color: 0xbcd0d0 })
    .rect(-30, -4, 2, 18).fill({ color: COLORS.cyan, alpha: 0.58 })
    .rect(28, -4, 2, 18).fill({ color: COLORS.cyan, alpha: 0.58 });
  c.addChild(
    sigil,
    glow,
    ultimateWingForm.root,
    phaseAfterimages,
    aircraft.root,
    pilotMarkings,
    mountedModules,
    weaponCore,
    rails,
  );
  c.position.set(W / 2, H * 0.78);
  playerLayer.addChild(c);
  return {
    view: c,
    x: c.x,
    y: c.y,
    radius: 7,
    fireTimer: 0,
    invincible: 0,
    aircraft,
    ultimateWingForm,
    pilotMarkings,
    engine: aircraft.engine,
    wing: aircraft.wing,
    tail: aircraft.tail,
    body: aircraft.body,
    weaponCore,
    rails,
    mountedModules,
    sigil,
    glow,
    phaseAfterimages,
  };
}
await importedArtReady;
requireGameSession(()=>{app.ticker.stop();renderer.destroy();});
threeEnvironment.setTextures(Object.fromEntries(TIDAL_ASSET_IDS.map(id => [id, importedTexture(id, false)])));
tidalBackground = createTidalBackground(backgroundLayer,
  [...backgroundLayer.children, ...weatherStreaks.map(streak => streak.view)],
  Object.fromEntries(TIDAL_ASSET_IDS.map(id => [id, importedTexture(id, false)])));
applyTerrainTheme(selectedStageIndex);
const player = makePlayerShip();
// World-sized marker: never inherit aircraft magnification, banking or roll.
const playerHitMarker = new Graphics()
  .circle(0, 0, player.radius).fill({color:0x8af4ff,alpha:.16}).stroke({color:0x092331,width:3})
  .circle(0, 0, player.radius).stroke({color:0xbdfaff,width:1.2})
  .circle(0, 0, 2).fill({color:0xffffff,alpha:.95});
playerHitMarker.zIndex = 1000;
playerHitMarker.visible = false;
playerHitMarker.eventMode = 'none';
dangerLayer.addChild(playerHitMarker);
const pilotArtVisual = createPilot01Visual(player,
  importedTexture('airframe-pilot-01', false),
  importedTexture('airframe-pilot-02', false),
  importedTexture('airframe-pilot-03', false),
  Object.fromEntries(SSR_PILOTS.slice(3).map(pilot => [pilot.id, importedTexture(`airframe-${pilot.id}`, false)])));
pilotArtVisual.update(getActivePilot().id, game.elapsed, false, 0);
let playerAircraftOrbitTime = 0;

function assemblyStartingSkills() {
  // 永久挂载武器与局内肉鸽弹道是两套系统，不提前解锁三选一技能。
  return {};
}

function createActiveWeaponRuntime() {
  return getAssemblyPassiveWeapons().map((weapon, index) => ({
    ...weapon,
    active: weapon.passiveEffect,
    charges: Number.POSITIVE_INFINITY,
    cooldown: weapon.passiveEffect ? 1.2 + index * 0.8 : 0,
    cooldownDuration: weapon.passiveEffect?.interval || 0,
    killCounter: 0,
  }));
}

function activeWeaponForShortcut(shortcut) {
  return game.activeWeapons.find((weapon) => weapon.shortcut === shortcut) || null;
}

function syncPlayerAssemblyVisual() {
  const snapshot = getAssemblySnapshot();
  redrawAssemblyAircraftVisual(player.aircraft);
  player.engine.visible = false;
  player.pilotMarkings.clear();
  player.rails.visible = snapshot.slots.some((slot) => slot.family === 'hardpoint' && slot.module);
  player.mountedModules.removeChildren().forEach((child) => child.destroy());
  snapshot.slots
    .filter((slot) => slot.family === 'hardpoint' && slot.module && slot.muzzle)
    .forEach((slot) => {
    const color = slot.module.color || COLORS.cyan;
    const muzzle = slot.muzzle;
    const pod = new Graphics()
      .roundRect(-5, -8, 10, 17, 3).fill({ color, alpha: 1 })
      .roundRect(-3, -8, 6, 13, 2).fill({ color: 0xeaffff, alpha: 1 })
      .circle(0, -7, 2.4).stroke({ color: 0xffffff, width: 1.5, alpha: 1 });
    pod.position.set(muzzle.x, muzzle.y + 4);
    player.mountedModules.addChild(pod);
  });
}

function currentUltimateAircraftRoute() {
  const path = game.primarySkillPath;
  if (!path || !(game.skills?.[`${path}_cap`] > 0)) return null;
  return ROUTE_MAP.get(path) || null;
}

function currentUltimateAircraftStage() {
  const path = game.primarySkillPath;
  return Math.max(0, Math.min(2, Number(game.skills?.[`${path}_cap`]) || 0));
}

function redrawUltimateAircraftForm(route) {
  const form = player.ultimateWingForm;
  const tint = Number.parseInt((route?.color || '#b7a3ff').slice(1), 16);
  const profile = ULTIMATE_WING_PROFILES[route?.id] || ULTIMATE_WING_PROFILES.blue;
  form.routeId = route?.id || '';
  form.tint = tint;
  form.profile = profile;
  form.aura.clear()
    .ellipse(0, 5, profile.span * 1.9, 45 + profile.heave * 2)
    .fill({ color: tint, alpha: 0.1 });
  form.halo.clear()
    .circle(0, 2, 56)
    .stroke({ color: tint, width: 1.6, alpha: 0.48 })
    .circle(0, 2, 48)
    .stroke({ color: 0xffffff, width: 1, alpha: 0.16 })
    .poly([0, -61, 4, -54, -4, -54])
    .fill({ color: tint, alpha: 0.92 })
    .poly([61, 2, 54, 6, 54, -2])
    .fill({ color: tint, alpha: 0.74 });
  drawUltimateWingBlade(form.left, -1, tint, route?.id);
  drawUltimateWingBlade(form.right, 1, tint, route?.id);
  drawUltimateWingBlade(form.frontLeft, -1, tint, route?.id);
  drawUltimateWingBlade(form.frontRight, 1, tint, route?.id);
  form.core.clear()
    .poly([0, -19, 10, 1, 0, 18, -10, 1])
    .fill({ color: 0x10142c, alpha: 0.98 })
    .stroke({ color: tint, width: 1.8, alpha: 0.94 })
    .poly([0, -12, 5, 1, 0, 11, -5, 1])
    .fill({ color: tint, alpha: 0.78 });
}

function resetUltimateAircraftForm() {
  const form = player.ultimateWingForm;
  form.progress = 0;
  form.routeId = '';
  form.root.visible = false;
  form.root.alpha = 0;
  form.left.scale.set(0.22, 0.76);
  form.right.scale.set(0.22, 0.76);
  form.frontLeft.scale.set(0.22, 0.76);
  form.frontRight.scale.set(0.22, 0.76);
  form.frontLeft.alpha = 0;
  form.frontRight.alpha = 0;
  form.frontProgress = 0;
}

function updateUltimateAircraftForm(dt) {
  const form = player.ultimateWingForm;
  const route = currentUltimateAircraftRoute();
  const stage = currentUltimateAircraftStage();
  if (route && route.id !== form.routeId) redrawUltimateAircraftForm(route);
  // 第一段先展开贴近机身的内侧机翼；第二段才解锁外侧的大机翼。
  // 这样会保持一段机翼，并在二段时向两侧扩展，而不是先出现下方
  // 的大机翼、再补上内侧的一对。
  const target = route && stage >= 2 ? 1 : 0;
  const response = 1 - Math.pow(0.0015, Math.max(0, dt));
  form.progress += (target - form.progress) * response;
  const frontTarget = route ? 1 : 0;
  form.frontProgress += (frontTarget - form.frontProgress) * response;
  if (Math.abs(target - form.progress) < 0.001) form.progress = target;
  if (Math.abs(frontTarget - form.frontProgress) < 0.001) form.frontProgress = frontTarget;
  const progress = Math.max(0, Math.min(1, form.progress));
  const frontProgress = Math.max(0, Math.min(1, form.frontProgress));
  const eased = 1 - (1 - progress) ** 3;
  const frontEased = 1 - (1 - frontProgress) ** 3;
  const formIntensity = Math.max(progress, frontProgress);
  const profile = form.profile || ULTIMATE_WING_PROFILES.blue;
  const leftWave = Math.sin(game.elapsed * profile.speed);
  const rightWave = Math.sin(game.elapsed * profile.speed + (profile.phase || 0));
  // Stage 2: the broad, rear-swept outer wings deploy after the inner pair.
  const rearRotation = Math.PI / 6;
  // Stage 1: a compact, forward-facing inner pair opens close to the airframe.
  const frontRotation = Math.PI * 70 / 180;
  const baseScaleX = 0.22 + eased * 0.78;
  const pulseX = (profile.pulse || 0) * progress;
  form.root.visible = formIntensity > 0.004;
  if (!form.root.visible) return;
  form.root.alpha = Math.min(1, formIntensity * 1.8);
  form.left.scale.set(
    baseScaleX + leftWave * pulseX,
    0.76 + eased * 0.24 + leftWave * profile.flex * progress,
  );
  form.right.scale.set(
    baseScaleX + rightWave * pulseX,
    0.76 + eased * 0.24 + rightWave * profile.flex * progress,
  );
  form.left.position.set(-1 - eased * 6, 4 - eased * 3 + leftWave * profile.heave * progress);
  form.right.position.set(1 + eased * 6, 4 - eased * 3 + rightWave * profile.heave * progress);
  form.left.rotation = -(rearRotation + leftWave * profile.flap * progress);
  form.right.rotation = rearRotation + rightWave * profile.flap * progress;
  form.left.alpha = progress;
  form.right.alpha = progress;
  const frontScale = (0.22 + frontEased * 0.78) * frontProgress * 0.58;
  form.frontLeft.scale.set(frontScale, (0.76 + frontEased * 0.24) * frontProgress * 0.58);
  form.frontRight.scale.set(frontScale, (0.76 + frontEased * 0.24) * frontProgress * 0.58);
  form.frontLeft.position.set(-2 - frontEased * 4, -7 - frontEased * 2);
  form.frontRight.position.set(2 + frontEased * 4, -7 - frontEased * 2);
  form.frontLeft.rotation = frontRotation;
  form.frontRight.rotation = -frontRotation;
  form.frontLeft.alpha = frontProgress;
  form.frontRight.alpha = frontProgress;
  form.root.rotation = route?.id === 'execute'
    ? Math.sin(game.elapsed * 3.7) * 0.012 * formIntensity
    : 0;
  form.halo.rotation += dt * profile.haloSpeed * (0.7 + eased * 0.8);
  const pulse = 0.5 + Math.sin(game.elapsed * 6.4) * 0.5;
  form.halo.alpha = formIntensity * (0.32 + pulse * 0.28);
  form.aura.alpha = formIntensity * (0.5 + pulse * 0.34);
  form.core.alpha = formIntensity * (0.72 + pulse * 0.28);
  form.core.scale.set(0.82 + pulse * 0.12);
}

syncPlayerAssemblyVisual();
game.activeWeapons = createActiveWeaponRuntime();
game.assemblySupports = getAssemblySupports();

const shieldView = new Graphics()
  .circle(0, 0, 41).fill({ color: COLORS.cyan, alpha: 0.045 })
  .circle(0, 0, 39).stroke({ color: COLORS.cyan, width: 1.5, alpha: 0.75 })
  .circle(0, 0, 35).stroke({ color: COLORS.white, width: 1, alpha: 0.22 });
shieldView.visible = false;
shieldView.zIndex = 20;
companionLayer.addChild(shieldView);

function drawEnemyChapterMotif(stageIndex, color, accent) {
  const motif = new Graphics();
  switch (stageIndex) {
    case 0: motif.poly([-28, -16, -46, -38, -34, -7, 34, -7, 46, -38, 28, -16]).stroke({ color: accent, width: 3, alpha: 0.9 }); break;
    case 1: motif.rect(-38, -22, 18, 13).fill({ color: accent, alpha: 0.72 }).rect(20, -22, 18, 13).fill({ color: accent, alpha: 0.72 }); break;
    case 2: motif.circle(-30, -4, 15).stroke({ color: accent, width: 3, alpha: 0.9 }).circle(30, -4, 15).stroke({ color: accent, width: 3, alpha: 0.9 }); break;
    case 3: motif.poly([-48, 8, -30, -18, -18, 20, -43, 30]).fill({ color: accent, alpha: 0.76 }).poly([48, 8, 30, -18, 18, 20, 43, 30]).fill({ color: accent, alpha: 0.76 }); break;
    case 4: for (let index = 0; index < 6; index += 1) { const angle = -Math.PI / 2 + (index - 2.5) * 0.28; motif.moveTo(Math.cos(angle) * 26, Math.sin(angle) * 26).lineTo(Math.cos(angle) * 45, Math.sin(angle) * 45).stroke({ color: accent, width: 3, alpha: 0.85 }); } break;
    case 5: motif.poly([-28, 30, -11, -35, 0, 26, 11, -35, 28, 30]).stroke({ color: accent, width: 3, alpha: 0.92 }); break;
    case 6: motif.rect(-42, -24, 84, 6).fill({ color: accent, alpha: 0.7 }).circle(-29, -8, 10).stroke({ color: accent, width: 2, alpha: 0.8 }).circle(29, -8, 10).stroke({ color: accent, width: 2, alpha: 0.8 }); break;
    case 7: motif.poly([0, 34, 18, 7, 37, -8, 22, -26, 48, -43]).stroke({ color: accent, width: 4, alpha: 0.92 }); break;
    case 8: motif.poly([0, -46, 16, -18, 6, -18, 6, 31, -6, 31, -6, -18, -16, -18]).fill({ color: accent, alpha: 0.84 }); break;
    case 9: motif.poly([-48, 30, -21, -30, 0, 2, 23, -43, 48, 30]).stroke({ color: accent, width: 3, alpha: 0.9 }); break;
    case 10: for (let index = -1; index <= 1; index += 1) motif.moveTo(-46, index * 12).bezierCurveTo(-18, index * 12 - 14, 18, index * 12 + 14, 46, index * 12).stroke({ color: accent, width: 2.5, alpha: 0.82 }); break;
    case 11: motif.poly([-44, 22, -12, 5, -25, -26, 0, -5, 25, -26, 12, 5, 44, 22, 0, 35]).stroke({ color: accent, width: 3, alpha: 0.88 }); break;
    case 12: motif.poly([0, -48, 10, -13, 28, 20, 10, 15, 0, 43, -10, 15, -28, 20, -10, -13]).fill({ color: accent, alpha: 0.78 }); break;
    case 13: motif.poly([0, -44, 36, -22, 28, 25, 0, 42, -28, 25, -36, -22]).stroke({ color: accent, width: 3.5, alpha: 0.9 }); break;
    case 14: motif.circle(0, -5, 29).stroke({ color: accent, width: 3, alpha: 0.82 }).circle(-10, -5, 4).fill({ color: accent }).circle(10, -5, 4).fill({ color: accent }).rect(-13, 12, 26, 4).fill({ color: accent, alpha: 0.85 }); break;
    case 15: motif.moveTo(0, -44).lineTo(0, 36).moveTo(-24, -27).lineTo(0, -44).lineTo(24, -27).stroke({ color: accent, width: 3.5, alpha: 0.9 }); break;
    case 16: motif.poly([-14, -46, 14, -46, 3, -13, 27, -13, -20, 43, -6, 6, -29, 6]).fill({ color: accent, alpha: 0.92 }); break;
    default: motif.circle(0, 0, 26).stroke({ color, width: 3, alpha: 0.8 });
  }
  return motif;
}

function drawEnemyFormFrame(form, stageIndex, color, accent) {
  const frame = new Graphics();
  const variant = (stageIndex * 11 + form * 7) % 17;
  if (form === 0) {
    const length = 38 + variant;
    frame.poly([0, -length, 14, -8, 9, 30, 0, 40, -9, 30, -14, -8]).stroke({ color: accent, width: 3, alpha: 0.88 });
  } else if (form === 1) {
    const span = 42 + variant;
    frame.poly([-span, 8, -18, -18, -6, 11, 0, 28, 6, 11, 18, -18, span, 8, 20, 23, -20, 23]).fill({ color, alpha: 0.34 }).stroke({ color: accent, width: 2.2, alpha: 0.84 });
  } else if (form === 2) {
    const radius = 30 + variant % 8;
    frame.circle(0, 0, radius).stroke({ color: accent, width: 3, alpha: 0.82 })
      .circle(0, 0, Math.max(14, radius - 13)).stroke({ color, width: 2, alpha: 0.62 });
  } else if (form === 3) {
    const span = 35 + variant % 10;
    frame.poly([-span, -18, -13, -36, 0, -23, 13, -36, span, -18, span - 9, 25, 0, 38, -span + 9, 25]).stroke({ color: accent, width: 3.4, alpha: 0.88 });
  } else {
    const spike = 27 + variant % 12;
    frame.poly([-spike, 30, -spike / 2, -7, 0, -spike, spike / 2, -7, spike, 30, 0, 20]).stroke({ color: accent, width: 3, alpha: 0.9 })
      .poly([0, 17, 9, 36, 0, 48, -9, 36]).fill({ color, alpha: 0.62 });
  }
  return frame;
}

function enemySkinForId(kind) {
  return ENEMY_SKIN_BY_ID[kind] ?? 0;
}

function enemyDisplayScaleForId(kind, elite = false) {
  return enemyTierMetrics(kind,elite).scale;
}

function drawEnemy(kind, stage = CAMPAIGN[game.stageIndex] || CAMPAIGN[0], form = 0) {
  const palette = enemyPaletteForStage(stage);
  const { base, dark, accent } = palette;
  const c = new Container();
  const glow = new Graphics().circle(0, 0, kind === 'heavy' ? 44 : 30).fill({ color: palette.glow, alpha: 0.16 });
  c.addChild(glow);
  if (kind === 'scout') {
    c.addChild(new Graphics()
      .poly([0, 24, -23, -12, -7, -6, 0, -26, 7, -6, 23, -12]).fill({ color: base })
      .poly([0, 18, -7, -5, 0, -20, 7, -5]).fill({ color: accent })
      .circle(0, -3, 3).fill({ color: COLORS.white }));
  } else if (kind === 'dart') {
    c.addChild(new Graphics()
      .poly([0, 27, -29, -2, -10, -12, 0, -28, 10, -12, 29, -2]).fill({ color: dark })
      .poly([0, 20, -7, -7, 0, -23, 7, -7]).fill({ color: accent })
      .rect(-24, -3, 48, 4).fill({ color: base }));
  } else if (kind === 'turret') {
    c.addChild(new Graphics()
      .circle(0, 0, 24).fill({ color: dark })
      .circle(0, 0, 16).fill({ color: base })
      .roundRect(-5, -23, 10, 29, 4).fill({ color: accent })
      .circle(0, 1, 7).fill({ color: 0x07141d }));
  } else if (kind === 'heavy') {
    c.addChild(new Graphics()
      .poly([0, 42, -45, 16, -34, -20, -12, -11, 0, -42, 12, -11, 34, -20, 45, 16]).fill({ color: dark })
      .poly([-31, 8, -14, -3, -9, 23, -29, 26]).fill({ color: base })
      .poly([31, 8, 14, -3, 9, 23, 29, 26]).fill({ color: base })
      .poly([0, 33, -10, -4, 0, -35, 10, -4]).fill({ color: accent })
      .circle(0, -4, 6).fill({ color: COLORS.white }));
  } else if (kind === 'relay') {
    c.addChild(new Graphics()
      .circle(0, 0, 25).fill({ color: dark })
      .circle(0, 0, 18).stroke({ color: base, width: 6, alpha: 0.95 })
      .circle(0, 0, 10).fill({ color: accent })
      .circle(0, 0, 4).fill({ color: COLORS.white })
      .poly([-38, 0, -24, -8, -24, 8]).fill({ color: base })
      .poly([38, 0, 24, -8, 24, 8]).fill({ color: base })
      .poly([0, -38, -8, -24, 8, -24]).fill({ color: accent }));
  }
  const stageIndex = stage.index ?? game.stageIndex;
  c.addChild(drawEnemyFormFrame(form, stageIndex, base, accent));
  c.addChild(drawEnemyChapterMotif(stageIndex, base, accent));
  return c;
}

function enemyTopEntryY(screenMargin = 120) {
  // World Y=0 is not the screen top under the oblique battle camera. Leave
  // room for the entire illustrated hull, not just its collision center.
  return renderer.type === 'three'
    ? renderer.unprojectBattle(W / 2, -screenMargin).y
    : -screenMargin;
}

function spawnEnemy(kind, x, y = enemyTopEntryY(), options = {}) {
  const enemyType = getEnemyTypeBalance(kind);
  const stage = CAMPAIGN[game.stageIndex] || CAMPAIGN[0];
  const balance = game.balance || createRunBalance(stage, game.difficultyId, profilePower());
  const elite = Boolean(options.elite);
  const formation = Boolean(options.waveRole);
  const openingSafeSeconds = Math.max(0, Number(stage.openingSafeSeconds) || 0);
  const openingTraining = game.stageElapsed < openingSafeSeconds;
  const openingRamp = Math.min(1, game.stageElapsed / Math.max(1, Number(stage.openingRampSeconds) || 1));
  const openingHpScale = (Number(stage.openingHpStart) || 1) + (1 - (Number(stage.openingHpStart) || 1)) * openingRamp;
  const timeHpPressure = Math.min(
    Number(BALANCE_GLOBAL.timeHpMax) || 1.65,
    1 + game.stageElapsed * (Number(BALANCE_GLOBAL.timeHpPerSecond) || 0),
  );
  const lateEnemyHpStartSeconds = Math.max(0, Number(BALANCE_GLOBAL.lateEnemyHpStartSeconds) || 90);
  const lateEnemyHpPressure = Math.min(
    Number(BALANCE_GLOBAL.lateEnemyHpMax) || 1.75,
    1 + Math.max(0, game.stageElapsed - lateEnemyHpStartSeconds)
      * (Number(BALANCE_GLOBAL.lateEnemyHpPerSecond) || 0.0075),
  );
  const waveHpPressure = Math.min(
    Number(BALANCE_GLOBAL.waveHpMax) || 1.55,
    1 + game.waveIndex * (Number(BALANCE_GLOBAL.waveHpPerWave) || 0),
  );
  const timeSpeedPressure = Math.min(
    Number(BALANCE_GLOBAL.timeSpeedMax) || 1.18,
    1 + game.stageElapsed * (Number(BALANCE_GLOBAL.timeSpeedPerSecond) || 0),
  );
  const attackKind = options.attackKind || getEnemyAbility(game.stageIndex, game.enemySkillSpawnIndex++);
  const form = enemySkinForId(kind);
  const view = drawEnemy(kind, stage, form);
  const displayScale = enemyDisplayScaleForId(kind, elite);
  const collisionRadius = enemyTierMetrics(kind,elite).radius;
  let eliteAura = null;
  let eliteBar = null;
  if (elite) {
    const auraRadius = collisionRadius / displayScale;
    eliteAura = new Graphics()
      .poly([0, -auraRadius - 15, 4, -auraRadius - 9, -4, -auraRadius - 9]).fill({ color: COLORS.amber, alpha: 0.9 });
    eliteBar = new Graphics();
    view.addChildAt(eliteAura, 0);
    view.addChild(eliteBar);
  }
  view.scale.set(displayScale);
  view.position.set(x, y);
  enemyLayer.addChild(view);
  const maxHp = enemyType.baseHp
    * balance.enemyHp
    * (formation ? formationHpScale(kind, elite, game.waveStatus?.index ?? 0) : timeHpPressure * lateEnemyHpPressure * waveHpPressure)
    * (formation ? Math.max(.9, openingHpScale) : openingHpScale)
    * (elite ? balance.eliteHp : 1);
  const fireUnlockTime = Math.max(openingSafeSeconds, Number(enemyType.fireUnlockSeconds) || 0);
  const openingFireFullStrengthSeconds = Math.max(
    openingSafeSeconds,
    Number(BALANCE_GLOBAL.openingFireFullStrengthSeconds) || 60,
  );
  const openingFireRamp = Math.min(1, Math.max(0,
    (game.stageElapsed - openingSafeSeconds)
      / Math.max(1, openingFireFullStrengthSeconds - openingSafeSeconds),
  ));
  const openingFireStartMultiplier = Number(BALANCE_GLOBAL.openingFireStartMultiplier) || 0.08;
  const openingFireRampExponent = Math.max(1, Number(BALANCE_GLOBAL.openingFireRampExponent) || 2);
  const openingFireMultiplier = openingFireStartMultiplier
    + (1 - openingFireStartMultiplier) * openingFireRamp ** openingFireRampExponent;
  const isArmedForOpening = game.stageElapsed >= openingFireFullStrengthSeconds
    || Math.random() < openingFireMultiplier;
  const regularFireChance = Math.min(1, Number(enemyType.fireChance) || 0);
  const baseSpeed = options.speed ?? enemyType.baseSpeed;
  const enemy = {
    view, kind, form, x, y, baseX: x, age: 0,
    waveRole: options.waveRole, keyTarget: Boolean(options.keyTarget), route: options.route, routeCanFire: false,
    barrageGroup: options.barrageGroup, barrageSeed: game.enemySkillSpawnIndex,
    hp: maxHp, maxHp, radius: collisionRadius, displayScale, elite,
    speed: baseSpeed * balance.enemySpeed * timeSpeedPressure,
    pattern: options.pattern ?? 'straight', phase: options.phase ?? 0,
    fireTimer: (Number(enemyType.fireCooldown) || 1.8) * (0.72 + Math.random() * 0.55),
    attackKind,
    attackPending: false,
    shotBurst: null,
    dash: null,
    canFire: formation ? true : !openingTraining && isArmedForOpening && (elite || (options.canFire ?? (game.elapsed > fireUnlockTime && (kind === 'heavy' || kind === 'turret' || kind === 'relay' || Math.random() < regularFireChance)))),
    fireCooldown: Number(enemyType.fireCooldown) || 1.8,
    bulletDamage: Number(enemyType.bulletDamage) || 12,
    bulletCount: Math.max(1, Math.round(Number(enemyType.bulletCount) || 1)),
    spread: Number(enemyType.spread) || 0,
    bulletScale: Number(enemyType.bulletScale) || 0.5,
    eliteBulletCountAdd: Math.max(0, Math.round(Number(enemyType.eliteBulletCountAdd) || 0)),
    eliteCooldown: Number(enemyType.eliteCooldown) || 0.72,
    bulletSpeed: Number(enemyType.bulletSpeed) || 150,
    collisionDamage: Number(enemyType.collisionDamage) || 18,
    score: (Number(enemyType.score) || 150) * (elite ? 5 : 1),
    xpValue: (Number(enemyType.xp) || 1) * (elite ? 4 : formation ? .65 : 1),
    burnTime: 0, burnDps: 0, frostTime: 0, stunTime: 0,
    redHuntMarkUntil: 0, redHuntMarkPower: 0, redHuntMarkStacks: 0, redHuntMarkView: null,
    vulnerabilityTime: 0, vulnerability: 0, eliteAura, eliteBar,
    dead: false,
  };
  for (const child of enemy.view.children) if (child !== enemy.eliteBar && child !== enemy.eliteAura) child.visible = false;
  const visualChapter=chapterEnemyProfile(game.stageIndex).id;
  enemy.visualSpec=enemyLibrarySpec(visualChapter,kind,elite);
  enemy.visualColor=enemyLibraryColor(visualChapter,kind,elite);
  enemy.model = createLibraryEnemy(enemy.visualSpec,{radius:collisionRadius,parentScale:displayScale,motionSeed:game.enemySkillSpawnIndex})
    || createEnemyModel(kind, false, { stageIndex: game.stageIndex, elite, ...(game.stageIndex>=5?{color:stage.color,accent:stage.accent}:{}) });
  enemy.view.addChild(enemy.model);
  enemy.hurtRadius = enemy.radius * WORLD_UNIT_SCALE * enemyRenderScale(enemy) * ENEMY_HURT_PADDING;
  if (formation) {
    enemy.fireTimer = options.waveRole === 'elite' ? .8 : .35 + (game.enemySkillSpawnIndex % 3) * .18;
    enemy.waveCue = new Graphics();
    enemy.view.addChild(enemy.waveCue);
  }
  enemies.push(enemy);
  sfx.enemySpawn();
  return enemy;
}

function drawBossMotif(config, palette = enemyPaletteForStage(config)) {
  const g = new Graphics();
  const color = palette.accent;
  if (config.pattern === 'charge') g.poly([-64, -30, -94, -76, -82, -12, 82, -12, 94, -76, 64, -30]).stroke({ color, width: 8, alpha: 0.78 });
  else if (config.pattern === 'walls') g.poly([-104, -50, -66, -64, -48, -28, 48, -28, 66, -64, 104, -50]).fill({ color, alpha: 0.5 });
  else if (config.pattern === 'twins') g.circle(-42, -12, 25).stroke({ color, width: 7, alpha: 0.72 }).circle(42, -12, 25).stroke({ color, width: 7, alpha: 0.72 });
  else if (config.pattern === 'claws') g.circle(-87, 8, 22).stroke({ color, width: 8, alpha: 0.65 }).circle(87, 8, 22).stroke({ color, width: 8, alpha: 0.65 });
  else if (config.pattern === 'solar') {
    for (let i = 0; i < 12; i += 1) { const a = i / 12 * Math.PI * 2; g.poly([Math.cos(a) * 62, Math.sin(a) * 62, Math.cos(a - 0.07) * 92, Math.sin(a - 0.07) * 92, Math.cos(a + 0.07) * 92, Math.sin(a + 0.07) * 92]).fill({ color, alpha: 0.5 }); }
  } else if (config.pattern === 'lances') g.poly([-90, 38, -56, -60, -38, 38, 0, -78, 38, 38, 56, -60, 90, 38]).stroke({ color, width: 5, alpha: 0.62 });
  else if (config.pattern === 'balance') g.rect(-88, -45, 176, 7).fill({ color, alpha: 0.65 }).circle(-65, 3, 27).stroke({ color, width: 5, alpha: 0.55 }).circle(65, 3, 27).stroke({ color, width: 5, alpha: 0.55 });
  else if (config.pattern === 'venom') g.poly([0, 68, 28, 40, 46, 12, 30, -25, 57, -56]).stroke({ color, width: 9, alpha: 0.62 });
  else if (config.pattern === 'arrows') g.poly([-72, 45, 0, -76, 72, 45]).stroke({ color, width: 7, alpha: 0.62 }).poly([0, -94, 11, -69, -11, -69]).fill({ color, alpha: 0.9 });
  else if (config.pattern === 'mountain') g.poly([-96, 44, -52, -55, 0, 4, 48, -82, 96, 44]).stroke({ color, width: 7, alpha: 0.58 });
  else if (config.pattern === 'streams' || config.pattern === 'tsunami') {
    for (let i = -2; i <= 2; i += 1) g.moveTo(-105, i * 20).bezierCurveTo(-46, i * 20 - 30, 46, i * 20 + 30, 105, i * 20).stroke({ color, width: config.pattern === 'tsunami' ? 7 : 4, alpha: 0.5 });
  } else if (config.pattern === 'spiral') g.circle(-38, 0, 29).stroke({ color, width: 6, alpha: 0.58 }).circle(38, 0, 29).stroke({ color, width: 6, alpha: 0.58 });
  else if (config.pattern === 'war') g.poly([-92, 42, -18, -74, 0, -22, 18, -74, 92, 42]).stroke({ color, width: 10, alpha: 0.72 });
  else if (config.pattern === 'aegis') g.poly([0, -88, 76, -46, 62, 43, 0, 78, -62, 43, -76, -46]).stroke({ color, width: 8, alpha: 0.72 });
  else if (config.pattern === 'underworld') g.circle(0, -8, 72).stroke({ color, width: 8, alpha: 0.44 }).circle(-27, -8, 13).fill({ color, alpha: 0.58 }).circle(27, -8, 13).fill({ color, alpha: 0.58 });
  else if (config.pattern === 'thunder') g.poly([-22, -92, 28, -34, 2, -27, 36, 26, -12, 7, 9, 76, -44, 5, -16, -6]).fill({ color, alpha: 0.78 });
  return g;
}

function drawBoss(config = CAMPAIGN[game.stageIndex]) {
  const palette = enemyPaletteForStage(config);
  const c = new Container();
  const halo = new Graphics()
    .circle(0, 0, 126).stroke({ color: palette.base, width: 2, alpha: 0.2 })
    .circle(0, 0, 112).stroke({ color: palette.accent, width: 1, alpha: 0.24 })
    .poly([0, -132, 7, -121, -7, -121]).fill({ color: palette.base, alpha: 0.75 })
    .poly([132, 0, 121, 7, 121, -7]).fill({ color: palette.accent, alpha: 0.7 });
  const shadow = new Graphics().ellipse(0, 20, 93, 34).fill({ color: 0x000000, alpha: 0.22 });
  const engines = new Graphics()
    .poly([-73, 32, -55, 32, -64, 78]).fill({ color: palette.base, alpha: 0.28 })
    .poly([73, 32, 55, 32, 64, 78]).fill({ color: palette.base, alpha: 0.28 })
    .poly([-69, 33, -59, 33, -64, 64]).fill({ color: 0xfff0aa, alpha: 0.6 })
    .poly([69, 33, 59, 33, 64, 64]).fill({ color: 0xfff0aa, alpha: 0.6 });
  const body = new Graphics()
    .poly([0, 75, -92, 42, -118, -4, -83, -39, -44, -31, -25, -70, 0, -91, 25, -70, 44, -31, 83, -39, 118, -4, 92, 42]).fill({ color: palette.base, alpha: 0.44 })
    .poly([0, 61, -33, 24, -24, -49, 0, -75, 24, -49, 33, 24]).fill({ color: palette.base, alpha: 0.88 })
    .poly([-99, -1, -53, -22, -42, 15, -80, 39]).fill({ color: palette.accent, alpha: 0.48 })
    .poly([99, -1, 53, -22, 42, 15, 80, 39]).fill({ color: palette.accent, alpha: 0.48 })
    .circle(-49, 2, 19).fill({ color: 0x312f3b })
    .circle(49, 2, 19).fill({ color: 0x312f3b })
    .circle(-49, 2, 9).fill({ color: palette.accent })
    .circle(49, 2, 9).fill({ color: palette.accent })
    .circle(0, -23, 11).fill({ color: palette.accent })
    .circle(0, -23, 20).stroke({ color: palette.accent, width: 2, alpha: 0.32 })
    .rect(-88, 18, 176, 3).fill({ color: palette.accent, alpha: 0.18 });
  const phaseArmor = new Graphics()
    .poly([-35, -55, -108, -88, -137, -35, -103, -50, -65, -28]).fill({ color: palette.accent, alpha: 0.52 })
    .poly([35, -55, 108, -88, 137, -35, 103, -50, 65, -28]).fill({ color: palette.accent, alpha: 0.52 })
    .poly([-116, 6, -151, 31, -102, 33, -69, 18]).fill({ color: palette.base, alpha: 0.72 })
    .poly([116, 6, 151, 31, 102, 33, 69, 18]).fill({ color: palette.base, alpha: 0.72 })
    .circle(0, -22, 37).stroke({ color: palette.accent, width: 4, alpha: 0.55 });
  phaseArmor.visible = false;
  phaseArmor.alpha = 0;
  const rageForm = new Graphics()
    .poly([0, -126, -15, -84, 0, -95, 15, -84]).fill({ color: 0xffffff, alpha: 0.9 })
    .poly([-151, -5, -112, -19, -127, 2, -108, 20]).fill({ color: palette.accent, alpha: 0.86 })
    .poly([151, -5, 112, -19, 127, 2, 108, 20]).fill({ color: palette.accent, alpha: 0.86 })
    .poly([-81, 55, -53, 31, -63, 83, -39, 46]).fill({ color: palette.base, alpha: 0.78 })
    .poly([81, 55, 53, 31, 63, 83, 39, 46]).fill({ color: palette.base, alpha: 0.78 })
    .circle(0, -23, 53).stroke({ color: 0xffffff, width: 3, alpha: 0.35 });
  rageForm.visible = false;
  rageForm.alpha = 0;
  const coreGlow = new Graphics()
    .circle(0, -23, 8).fill({ color: 0xffffff, alpha: 0.98 })
    .circle(0, -23, 24).fill({ color: palette.glow, alpha: 0.22 })
    .circle(0, -23, 33).stroke({ color: palette.accent, width: 2, alpha: 0.42 });
  coreGlow.alpha = 0.3;
  const motif = drawBossMotif(config, palette);
  c.addChild(halo, shadow, engines, phaseArmor, body, motif, rageForm, coreGlow);
  const baseScale = config.final ? 0.98 : 0.9;
  c.scale.set(baseScale);
  const entryStartY=enemyTopEntryY(200);
  c.position.set(W / 2, entryStartY);
  enemyLayer.addChild(c);
  const balance = game.balance || createRunBalance(config, game.difficultyId, profilePower());
  const bossHp = (Number(BALANCE_GLOBAL.baseBossHp) || 7200)
    * balance.bossHp
    * BOSS_ENDURANCE_SCALE
    * (BOSS_TEST_MODE ? BOSS_TEST_HP_MULTIPLIER : 1);
  const result = {
    view: c, x: W / 2, y: entryStartY, entryStartY, radius: (config.final ? 88 : 78), config,
    hp: bossHp, maxHp: bossHp, age: 0, fireTimer: 1, entered: false, dead: false,
    burnTime: 0, burnDps: 0, frostTime: 0, stunTime: 0,
    redHuntMarkUntil: 0, redHuntMarkPower: 0, redHuntMarkStacks: 0, redHuntMarkView: null,
    vulnerabilityTime: 0, vulnerability: 0, halo, engines, body, motif, phaseArmor, rageForm, coreGlow,
    visualPalette: palette,
    phase: 1, volleyCount: 0, baseScale,
    attackPending: false, lastMove: '', dash: null,
    // The opening boss teaches regular fire first. Its charge is an occasional
    // dodge check instead of a repeated source of movement pressure.
    nextDashAt: game.elapsed + (config.index === 0 ? OPENING_BOSS_FIRST_DASH_DELAY_SECONDS : 0),
    movePhase: 0, verticalPhase: 0,
    lastDamageAt: -Infinity, burstHits: 0,
  };
  const visualChapter=chapterEnemyProfile(game.stageIndex).id;
  result.visualSpec=enemyLibrarySpec(visualChapter,null,false,true);
  result.visualColor=enemyLibraryColor(visualChapter,null,false,true);
  if(result.visualSpec)result.config={...config,title:result.visualSpec.name};
  result.model = createLibraryEnemy(result.visualSpec,{radius:result.radius,parentScale:baseScale,motionSeed:game.stageIndex}) || createEnemyModel(config.id, true, config);
  for (const child of result.view.children) child.visible = false;
  result.view.addChild(result.model);
  result.hurtRadius = result.radius * WORLD_UNIT_SCALE * enemyRenderScale(result) * ENEMY_HURT_PADDING;
  return result;
}

class BulletPool {
  constructor(friendly) {
    this.friendly = friendly;
    this.free = [];
  }
  acquire(style = 'red', tier = 1) {
    const b = this.free.pop() || { view: new Graphics(), active: false };
    detachProjectileArt(b);
    b.view.clear();
    b.view.scale.set(1);
    b.view.alpha = 1;
    b.view.bloom = this.friendly;
    b.view.additive = false;
    if (this.friendly && game.fixedPartsMode) {
      // Formal shots receive their GLB instance after launch parameters exist.
      b.radius = 5;
      b.damage = 1;
    } else if (this.friendly) {
      if (style === 'missile') {
        b.view.poly([0, -14, 7, 9, 0, 6, -7, 9]).fill({ color: 0xffe7a0 })
          .poly([-4, 8, 0, 18, 4, 8]).fill({ color: COLORS.red, alpha: 0.75 });
        b.radius = 8;
        b.damage = 8;
      } else if (style === 'blue') {
        const length = 25 + Math.min(18, tier * 2);
        b.view.roundRect(-2, -length / 2, 4, length, 2).fill({ color: 0xffffff })
          .roundRect(-5, -length / 2 + 2, 10, length - 4, 5).fill({ color: 0x9deaff, alpha: 0.48 })
          .roundRect(-9, -length / 2 + 5, 18, length - 10, 9).fill({ color: COLORS.blue, alpha: tier >= 6 ? 0.22 : 0.12 });
        if (tier >= 7 || runStats.blueOverdrive) b.view.rect(-1, -length / 2 - 5, 2, length + 10).fill({ color: 0xdfffff, alpha: 0.9 });
        b.radius = 6 + Math.min(4, tier * 0.35);
        b.damage = 1;
      } else if (style === 'prism') {
        b.view.poly([0, -13, 6, 0, 0, 13, -6, 0]).fill({ color: 0xf4ecff })
          .poly([0, -19, 11, 0, 0, 19, -11, 0]).stroke({ color: 0xa88cff, width: 2, alpha: 0.72 })
          .circle(0, 0, 14).fill({ color: 0xa88cff, alpha: 0.1 });
        b.radius = 6;
        b.damage = 1;
      } else if (style === 'ricochet') {
        b.view.circle(0, 0, 7).fill({ color: 0xfff0bd })
          .circle(0, 0, 11).stroke({ color: 0xffb85c, width: 3, alpha: 0.88 })
          .circle(0, 0, 17).fill({ color: 0xffb85c, alpha: 0.09 });
        b.radius = 8;
        b.damage = 1;
      } else if (style === 'frost') {
        b.view.poly([0, -13, 4, -4, 12, 0, 4, 4, 0, 13, -4, 4, -12, 0, -4, -4]).fill({ color: 0xe9ffff })
          .circle(0, 0, 14).fill({ color: 0x7adfff, alpha: 0.15 });
        b.radius = 6;
        b.damage = 1;
      } else if (style === 'cluster') {
        b.view.circle(0, 0, 8).fill({ color: 0x2b1712 })
          .circle(0, 0, 7).stroke({ color: 0xff7c4f, width: 3, alpha: 0.95 })
          .poly([-5, 6, 0, 15, 5, 6]).fill({ color: 0xffd15c, alpha: 0.9 })
          .circle(0, 0, 17).fill({ color: 0xff643d, alpha: 0.1 });
        b.radius = 8;
        b.damage = 1;
      } else if (style === 'sword') {
        b.view
          .poly([0, -31, 8, 5, 4, 15, 0, 9, -4, 15, -8, 5]).fill({ color: 0x65dfff, alpha: 0.34 })
          .poly([0, -28, 4.2, 6, 0, 15, -4.2, 6]).fill({ color: 0xf6fdff, alpha: 0.98 })
          .rect(-11, 5, 22, 3.5).fill({ color: 0x8de8ff, alpha: 0.94 })
          .poly([-3, 9, 0, 27, 3, 9]).fill({ color: 0xb8eaff, alpha: 0.88 })
          .circle(0, -3, 19).fill({ color: 0x65dfff, alpha: 0.075 });
        b.radius = 5;
        b.damage = 1;
      } else if (style === 'execute') {
        b.view.roundRect(-2, -28, 4, 56, 2).fill({ color: 0xffffff })
          .roundRect(-5, -25, 10, 50, 4).fill({ color: 0xffd5ee, alpha: 0.74 })
          .roundRect(-10, -21, 20, 42, 8).fill({ color: 0xff4fa3, alpha: 0.22 })
          .poly([0, -36, 4, -25, 0, -29, -4, -25]).fill({ color: 0xffeff8 })
          .circle(0, 0, 18).fill({ color: 0xff4fa3, alpha: 0.08 });
        b.radius = 7;
        b.damage = 1;
      } else if (style === 'tether') {
        b.view.circle(0, 0, 8).fill({ color: 0xeafff6 })
          .circle(0, 0, 12).stroke({ color: 0x65ffb5, width: 3, alpha: 0.9 })
          .circle(0, 0, 19).fill({ color: 0x65ffb5, alpha: 0.09 });
        b.radius = 9;
        b.damage = 1;
      } else if (style === 'red') {
        const size = 4 + Math.min(4, tier * 0.42);
        b.view.poly([0, -size * 1.9, size * 0.8, size * 0.72, 0, size * 0.35, -size * 0.8, size * 0.72]).fill({ color: 0xffd1b8 })
          .circle(0, 0, size + 2).fill({ color: COLORS.red, alpha: tier >= 6 ? 0.55 : 0.34 })
          .circle(0, 0, size + 8).fill({ color: 0xff241d, alpha: tier >= 7 || runStats.redOverdrive ? 0.2 : 0.09 });
        b.radius = 5 + Math.min(4, tier * 0.38);
        b.damage = 1;
      } else {
        // Base cannon: a compact HDR lance with a readable white core and a
        // long, layered exhaust. Bloom turns the translucent outer shapes
        // into one continuous neon trail without spawning per-frame meshes.
        b.view
          .poly([-17, 8, 0, 58, 17, 8, 7, 28, 0, 78, -7, 28]).fill({ color: 0x168dff, alpha: 0.055 })
          .poly([-11, 2, 0, 43, 11, 2, 5, 24, 0, 62, -5, 24]).fill({ color: 0x28c8ff, alpha: 0.13 })
          .poly([-7, -14, 0, 34, 7, -14, 3.5, 17, 0, 48, -3.5, 17]).fill({ color: 0x7eeaff, alpha: 0.3 })
          .roundRect(-5.5, -24, 11, 43, 5.5).fill({ color: 0x8eeeff, alpha: 0.68 })
          .roundRect(-2.4, -28, 4.8, 45, 2.4).fill({ color: 0xffffff, alpha: 0.98 })
          .poly([0, -38, 5.5, -23, 0, -27, -5.5, -23]).fill({ color: 0xffffff })
          .circle(0, -19, 8).fill({ color: 0xdfffff, alpha: 0.28 })
          .circle(0, -19, 17).fill({ color: 0x4edaff, alpha: 0.075 });
        b.radius = 5;
        b.damage = 1;
      }
    } else {
      attachHostileProjectileArt(b);
      b.radius = 6;
      b.damage = 1;
    }
    b.style = style;
    b.weaponTier = tier;
    b.active = true;
    b.view.visible = true;
    b.view.tint = 0xffffff;
    b.view.zIndex = this.friendly ? 0 : 900;
    (this.friendly ? bulletLayer : dangerLayer).addChild(b.view);
    return b;
  }
  release(b) {
    if (!b.active) return;
    detachProjectileArt(b);
    b.active = false;
    b.view.visible = false;
    b.view.removeFromParent();
    this.free.push(b);
  }
}
const friendlyPool = new BulletPool(true);
const hostilePool = new BulletPool(false);

function skillActive(id) {
  return game.sealedSkillId !== id;
}

function combatPowerMultiplier() {
  const missingLives = Math.max(0, (runStats.maxHp - game.hp) / Math.max(1, runStats.maxHp / 3));
  const sealedPowerPenalty = !skillActive('power') ? Math.pow(1.22, -(game.skills.power || 1)) : 1;
  return runStats.damageMultiplier * sealedPowerPenalty * (1 + missingLives * runStats.lowHealthPower);
}

function projectileBuffProfile(path) {
  if (path === 'red') return { vulnerability: runStats.redVulnerability, vulnerabilityDuration: runStats.redVulnerabilityDuration };
  if (path === 'blue') return { stunChance: runStats.blueStunChance, stunDuration: runStats.blueStunDuration };
  if (path === 'prism') return { stunChance: runStats.prismStunChance, stunDuration: runStats.prismStunDuration };
  if (path === 'ricochet') return { knockback: runStats.ricochetKnockback };
  if (path === 'mech') return { vulnerability: runStats.mechVulnerability, vulnerabilityDuration: runStats.mechVulnerabilityDuration };
  if (path === 'cluster') return { knockback: runStats.clusterKnockback };
  if (path === 'sword') return { vulnerability: runStats.swordVulnerability, vulnerabilityDuration: runStats.swordVulnerabilityDuration };
  if (path === 'tether') return { stunChance: runStats.tetherStunChance, stunDuration: runStats.tetherStunDuration };
  if (path === 'split') return { knockback: runStats.splitKnockback };
  return {};
}

function firePlayerBullet(x, y, angle = -Math.PI / 2, options = {}) {
  const style = options.style || game.weapon;
  const tier = options.weaponLevel ?? (game.weaponLevels[style] || 1);
  const b = friendlyPool.acquire(style, tier);
  b.fixedSource = options.fixedSource || null;
  b.fixedLife = options.fixedLife || 0;
  b.fixedFirstStep = options.fixedFirstStep ?? null;
  const baseSpeed = style === 'missile' ? 390 : style === 'cluster' ? 520 : style === 'sword' ? 610 : style === 'tether' ? 560 : style === 'blue' ? 840 : 720;
  const speed = (options.speed || baseSpeed) * runStats.projectileSpeedMultiplier;
  b.x = x; b.y = y; b.vx = Math.cos(angle) * speed; b.vy = Math.sin(angle) * speed;
  b.damage = options.finalDamage ?? ((options.damage ?? b.damage) * (1 + Math.max(0, tier - 1) * 0.06) * combatPowerMultiplier());
  b.bossDamageMultiplier = options.bossDamageMultiplier ?? runStats.bossDamageMultiplier;
  b.eliteDamageMultiplier = options.eliteDamageMultiplier ?? runStats.eliteDamageMultiplier;
  b.pierce = options.pierce ?? ((skillActive('pierce') ? runStats.pierce : 0) + (style === 'blue' ? 1 : 0));
  b.critChance = options.critChance ?? runStats.critChance;
  b.critMultiplier = runStats.critMultiplier;
  b.burnDps = options.noEffects || !skillActive('burn') ? 0 : runStats.burnDps * combatPowerMultiplier();
  b.burnDuration = runStats.burnDuration;
  b.frostChance = options.noEffects || style !== 'frost' ? 0 : runStats.frostChance;
  b.frostDuration = runStats.frostDuration;
  b.chainChance = options.noEffects || style !== 'prism' ? 0 : runStats.chainChance;
  b.chainDamage = runStats.chainDamage;
  b.chainJumps = style === 'prism' ? runStats.chainJumps : 0;
  b.homing = options.homing ?? (style === 'red');
  b.homingStrength = (options.homingStrength ?? (style === 'missile' ? 4.8 : 1.35 + tier * 0.1)) * runStats.homingStrengthMultiplier;
  b.target = options.target || null;
  b.waveAmplitude = (options.waveAmplitude ?? (style === 'blue' ? 7 : 0)) * runStats.spiralScale;
  b.waveFrequency = (options.waveFrequency ?? (style === 'blue' ? 8.5 : 0)) * runStats.spiralFrequency;
  b.wavePhase = options.wavePhase ?? 0;
  b.waveAge = 0;
  b.explosionRadius = options.explosionRadius || 0;
  b.splashDamageRatio = options.splashDamageRatio ?? 0.55;
  b.explosionHitsPrimary = Boolean(options.explosionHitsPrimary);
  b.ricochetBounces = options.ricochetBounces ?? (style === 'ricochet' ? runStats.ricochetBounces : 0);
  b.ricochetRetention = runStats.ricochetRetention;
  b.splitLevel = options.splitLevel ?? (style === 'white' ? runStats.splitLevel : 0);
  b.splitDamage = runStats.splitDamage;
  b.isSplit = options.isSplit ?? false;
  b.effectPath = options.effectPath ?? (style === 'white' ? 'split' : style);
  const buff = options.noEffects ? {} : projectileBuffProfile(b.effectPath);
  b.knockback = options.knockback ?? buff.knockback ?? 0;
  b.stunChance = options.stunChance ?? buff.stunChance ?? 0;
  b.stunDuration = options.stunDuration ?? buff.stunDuration ?? 0;
  b.vulnerability = options.vulnerability ?? buff.vulnerability ?? 0;
  b.vulnerabilityDuration = options.vulnerabilityDuration ?? buff.vulnerabilityDuration ?? 0;
  b.clusterFragments = options.clusterFragments ?? 0;
  b.clusterFragmentDamage = options.clusterFragmentDamage ?? runStats.clusterFragmentDamage;
  b.clusterFuse = options.clusterFuse ?? 0;
  b.swordDelay = options.swordDelay ?? 0;
  b.pendingHoming = Boolean(options.pendingHoming);
  b.swordAttacksRemaining = Math.max(1, Math.floor(options.swordAttacks ?? (style === 'sword' ? runStats.swordAttackCount : 1)));
  b.swordRearmAt = 0;
  b.expire = false;
  b.persistOnHit = Boolean(options.persistOnHit);
  b.redUltimate = Boolean(options.redUltimate);
  b.age = 0;
  b.trailTimer = 0;
  b.hitTargets = new Set();
  const familyScale = style === 'ricochet'
    ? runStats.projectileScale * runStats.ricochetScale
    : style === 'missile'
      ? 1
      : runStats.projectileScale;
  const projectileScale = (options.scale || familyScale) * (1 + Math.min(0.24, Math.max(0, tier - 1) * 0.035));
  b.view.scale.set(projectileScale);
  b.radius *= projectileScale;
  b.view.position.set(x, y);
  b.view.rotation = angle + Math.PI / 2;
  playerBullets.push(b);
  return b;
}

function playerLocalPoint(x, y) {
  const scaleX = player.view.scale.x;
  const scaleY = player.view.scale.y;
  const rotation = player.view.rotation;
  const scaledX = x * scaleX;
  const scaledY = y * scaleY;
  return {
    x: player.view.x + scaledX * Math.cos(rotation) - scaledY * Math.sin(rotation),
    y: player.view.y + scaledX * Math.sin(rotation) + scaledY * Math.cos(rotation),
  };
}

function muzzleFlash(color, level) {
  const size = 12 + Math.min(24, level * 2.5);
  const view = new Graphics()
    .poly([0, -size * 1.7, size * 0.55, 2, 0, size * 0.35, -size * 0.55, 2]).fill({ color, alpha: 0.56 })
    .circle(0, -5, size * 0.58).fill({ color: COLORS.white, alpha: 0.26 });
  const muzzle = { x: 0, y: -32 };
  const point = playerLocalPoint(muzzle.x, muzzle.y);
  view.bloom = true;
  view.additive = true;
  view.position.set(point.x, point.y);
  fxLayer.addChild(view);
  particles.push({ view, x: view.x, y: view.y, vx: 0, vy: -70, life: 0.075, maxLife: 0.075, spin: 0, fade: true });
  if (level >= 6) ringEffect(point.x, point.y - 2, color, 32 + level * 2, 0.16);
}

function fireSwordVolley() {
  const activeSwords = playerBullets.reduce((count, bullet) => count + (bullet.style === 'sword' ? 1 : 0), 0);
  const count = Math.min(19, runStats.swordShots, Math.max(0, 44 - activeSwords));
  if (!count) return;
  const targets = damageTargetsInRange(player.x, player.y, 1000);
  for (let i = 0; i < count; i += 1) {
    const slot = i - (count - 1) / 2;
    const side = Math.sign(slot || (i % 2 ? 1 : -1));
    const width = Math.min(250, 42 + Math.abs(slot) * 19);
    const angle = -Math.PI / 2 + side * (0.16 + Math.min(0.42, Math.abs(slot) * 0.035));
    firePlayerBullet(player.x + side * width * 0.34, player.y - 22 + Math.abs(slot) * 2.5, angle, {
      style: 'sword',
      damage: runStats.swordDamage,
      speed: 500 + Math.min(180, Math.abs(slot) * 18),
      homing: false,
      pendingHoming: true,
      homingStrength: runStats.swordGuidance,
      swordDelay: runStats.swordDelay + (i % 4) * 0.035,
      target: targets.length ? targets[i % targets.length] : null,
      swordAttacks: runStats.swordAttackCount,
      pierce: runStats.swordPierce,
      bossDamageMultiplier: weaponBossDamageMultiplier(runStats, 'sword'),
      splitLevel: 0,
      waveAmplitude: 5 + Math.abs(slot) * 0.8,
      waveFrequency: 6.5,
      wavePhase: side > 0 ? Math.PI : 0,
    });
  }
  ringEffect(player.x, player.y - 48, 0xb9efff, 72 + count * 2, 0.28);
  sfx.fireWeapon('sword');
}

function fireTetherVolley() {
  const pairCount = Math.min(4, runStats.tetherPairs);
  for (let i = 0; i < pairCount; i += 1) {
    const centerOffset = (i - (pairCount - 1) / 2) * 34;
    const span = Math.min(180, runStats.tetherSpan);
    const angleOffset = (i - (pairCount - 1) / 2) * 0.035;
    const left = firePlayerBullet(player.x + centerOffset - span / 2, player.y - 28, -Math.PI / 2 + angleOffset, {
      style: 'tether', damage: runStats.tetherDamage, speed: 550, pierce: 99, splitLevel: 0,
      persistOnHit: true, waveAmplitude: 8, waveFrequency: 5.2, wavePhase: 0,
    });
    const right = firePlayerBullet(player.x + centerOffset + span / 2, player.y - 28, -Math.PI / 2 - angleOffset, {
      style: 'tether', damage: runStats.tetherDamage, speed: 550, pierce: 99, splitLevel: 0,
      persistOnHit: true, waveAmplitude: 8, waveFrequency: 5.2, wavePhase: Math.PI,
    });
    const view = new Graphics();
    view.zIndex = 880;
    fxLayer.addChild(view);
    tetherPairs.push({
      left,
      right,
      view,
      cooldowns: new Map(),
      damage: runStats.tetherTickDamage * combatPowerMultiplier(),
      critChance: runStats.critChance,
      critMultiplier: runStats.critMultiplier,
      bossDamageMultiplier: runStats.bossDamageMultiplier,
      stunChance: runStats.tetherStunChance,
      stunDuration: runStats.tetherStunDuration,
    });
  }
  sfx.fireWeapon('sword');
}

function primaryWeaponSfx(primaryWeapon) {
  switch (primaryWeapon?.weapon?.mode) {
    case 'spread': return 'shotgun';
    case 'beam': return 'laser';
    case 'homing': return 'sniper';
    case 'explosive': return 'grenade';
    case 'phase-blades': return 'sword';
    case 'aegis-lances': return 'sniper';
    default: return 'gun';
  }
}

function routeWeaponTier(path) {
  const routePath = path === 'white' ? 'split' : path;
  const investment = Object.entries(game.skills).reduce((sum, [skillId, level]) => (
    SKILL_MAP.get(skillId)?.path === routePath ? sum + level : sum
  ), 0);
  return Math.max(1, Math.min(8, 1 + investment));
}

function fireRedUltimateVolley(extraShots = 0) {
  const count = Math.min(10, runStats.redShots + extraShots);
  if (count <= 0) return;
  const targets = damageTargetsInRange(player.x, player.y, 1100).slice(0, Math.max(1, count));
  const tier = Math.max(7, routeWeaponTier('red'));
  const muzzle = { x: 0, y: -28 };
  game.redUltimateVolley = (game.redUltimateVolley || 0) + 1;
  for (let i = 0; i < count; i += 1) {
    const slot = i - (count - 1) / 2;
    const point = playerLocalPoint(muzzle.x + slot * 8, muzzle.y - Math.abs(slot) * 2);
    firePlayerBullet(point.x, point.y, -Math.PI / 2 + slot * 0.105, {
      style: 'red',
      weaponLevel: tier,
      damage: runStats.redDamage,
      homing: true,
      homingStrength: 2.15,
      target: targets.length ? targets[i % targets.length] : null,
      pierce: 0,
      redUltimate: true,
      scale: 1.18,
    });
  }
  if (game.redUltimateVolley % 4 === 1 || extraShots > 0) {
    const point = playerLocalPoint(0, -34);
    ringEffect(point.x, point.y, COLORS.red, 56 + count * 3, 0.2);
  }
}

function playerShoot() {
  const pilot = getActivePilot();
  const pilotAbility = pilot.ability;
  const fireFan = (count, style, damage, spread = 0.09, options = {}) => {
    const { angleOffset = 0, ...bulletOptions } = options;
    const capped = Math.min(7, count);
    const muzzle = { x: 0, y: -28 };
    for (let i = 0; i < capped; i += 1) {
      const slot = i - (capped - 1) / 2;
      const offset = slot * spread;
      const point = playerLocalPoint(muzzle.x + slot * 9, muzzle.y - Math.abs(slot) * 2);
      firePlayerBullet(point.x, point.y, -Math.PI / 2 + offset + angleOffset, {
        style,
        weaponLevel: routeWeaponTier(style),
        damage,
        wavePhase: i % 2 ? Math.PI : 0,
        ...bulletOptions,
      });
    }
  };

  const primaryWeapon = currentPrimaryWeapon();
  if (!primaryWeapon) {
    const profile = resolveMinimumDirectShotProfile(pilotAbility, {
      mode: 'base',
      mechanism: 'direct',
      projectileCount: runStats.baseShots,
      damageRatio: 1,
      spread: 0.075,
    });
    fireFan(profile.shotCount, 'white', profile.damageRatio, profile.spread, { pierce: runStats.pierce });
  } else if (primaryWeapon.weapon.mode === 'parallel') {
    const profile = resolveMinimumDirectShotProfile(pilotAbility, primaryWeapon.weapon);
    fireFan(profile.shotCount, 'white', profile.damageRatio, profile.spread, { pierce: 0, speed: 880 });
  } else if (primaryWeapon.weapon.mode === 'spread') {
    const muzzle = playerLocalPoint(0, -28);
    for (const angle of primaryWeapon.weapon.angles) {
      firePlayerBullet(muzzle.x, muzzle.y, -Math.PI / 2 + angle * Math.PI / 180, {
        style: 'white',
        damage: primaryWeapon.weapon.damageRatio,
        pierce: 0,
        splitLevel: 0,
      });
    }
  } else if (primaryWeapon.weapon.mode === 'beam') {
    const muzzle = playerLocalPoint(0, -34);
    firePlayerBullet(muzzle.x, muzzle.y, -Math.PI / 2, {
      style: 'blue',
      damage: primaryWeapon.weapon.damageRatio,
      speed: 1500,
      pierce: primaryWeapon.weapon.maxTargets - 1,
      splitLevel: 0,
      scale: 0.52,
      noEffects: true,
    });
  } else if (primaryWeapon.weapon.mode === 'homing') {
    const targets = damageTargetsInRange(player.x, player.y, 1200)
      .sort((a, b) => (
        (a.x - player.x) ** 2 + (a.y - player.y) ** 2
        - ((b.x - player.x) ** 2 + (b.y - player.y) ** 2)
      ));
    for (let index = 0; index < primaryWeapon.weapon.projectileCount; index += 1) {
      const slot = index - (primaryWeapon.weapon.projectileCount - 1) / 2;
      const muzzle = playerLocalPoint(slot * 12, -26);
      firePlayerBullet(muzzle.x, muzzle.y, -Math.PI / 2 + slot * 0.08, {
        style: 'missile',
        damage: primaryWeapon.weapon.damageRatio,
        speed: 470,
        homing: true,
        homingStrength: 5.2,
        target: targets[0] || null,
        pierce: 0,
        splitLevel: 0,
        explosionRadius: 52,
        splashDamageRatio: primaryWeapon.weapon.splashDamageRatio / primaryWeapon.weapon.damageRatio,
        noEffects: true,
      });
    }
  } else if (primaryWeapon.weapon.mode === 'explosive') {
    const muzzle = playerLocalPoint(0, -32);
    firePlayerBullet(muzzle.x, muzzle.y, -Math.PI / 2, {
      style: 'cluster',
      damage: primaryWeapon.weapon.damageRatio,
      speed: 440,
      pierce: 0,
      splitLevel: 0,
      explosionRadius: 76,
      splashDamageRatio: primaryWeapon.weapon.splashDamageRatio / primaryWeapon.weapon.damageRatio,
      explosionHitsPrimary: true,
      clusterFragments: 0,
      scale: 1.35,
      noEffects: true,
    });
  } else if (primaryWeapon.weapon.mode === 'aegis-lances') {
    const ratios = primaryWeapon.weapon.damageRatios;
    ratios.forEach((damageRatio, index) => {
      const slot = index - 1;
      const muzzle = playerLocalPoint(slot * 13, -30);
      firePlayerBullet(muzzle.x, muzzle.y, -Math.PI / 2 + slot * 0.045, {
        style: 'white',
        damage: damageRatio,
        speed: 920,
        pierce: 0,
        splitLevel: 0,
        noEffects: true,
      });
    });
  } else if (primaryWeapon.weapon.mode === 'phase-blades') {
    fireFan(
      primaryWeapon.weapon.projectileCount,
      'white',
      primaryWeapon.weapon.damageRatio,
      0,
      { pierce: primaryWeapon.weapon.pierce, speed: 920, splitLevel: 0, noEffects: true },
    );
  }
  if (game.phaseAfterimage?.remaining > 0 && primaryWeapon?.id === 'GOLD-NIGHTFALL-00') {
    for (const cloneOffset of [-38, 38]) {
      for (let index = 0; index < primaryWeapon.weapon.projectileCount; index += 1) {
        const slot = index - (primaryWeapon.weapon.projectileCount - 1) / 2;
        const muzzle = playerLocalPoint(cloneOffset + slot * 8, -25);
        firePlayerBullet(muzzle.x, muzzle.y, -Math.PI / 2, {
          style: 'white',
          damage: primaryWeapon.weapon.damageRatio * game.phaseAfterimage.damageRatio,
          speed: 920,
          pierce: primaryWeapon.weapon.pierce,
          splitLevel: 0,
          noEffects: true,
          scale: 0.78,
        });
      }
    }
  }
  if (pilotAbility.type === 'side-shot') {
    const left = playerLocalPoint(-22, 1);
    const right = playerLocalPoint(22, 1);
    firePlayerBullet(left.x, left.y, Math.PI, {
      style: 'blue', damage: pilotAbility.damage, pierce: 2, splitLevel: 0,
    });
    firePlayerBullet(right.x, right.y, 0, {
      style: 'blue', damage: pilotAbility.damage, pierce: 2, splitLevel: 0,
    });
  }
  if (runStats.redShots > 0) {
    if (runStats.redOverdrive) fireRedUltimateVolley();
    else fireFan(runStats.redShots, 'red', runStats.redDamage, 0.13, { homing: true, pierce: 0 });
    sfx.fireWeapon('gun');
  }
  if (runStats.blueShots > 0) {
    fireFan(runStats.blueShots, 'blue', runStats.blueDamage, 0.035, { pierce: 1 + runStats.pierce, splitLevel: 0 });
    sfx.fireWeapon('laser');
  }
  if (runStats.prismShots > 0) {
    fireFan(runStats.prismShots, 'prism', runStats.prismDamage, 0.07, { pierce: runStats.pierce, splitLevel: 0 });
    sfx.fireWeapon('lightning');
  }
  if (runStats.ricochetShots > 0) {
    game.ricochetVolley = (game.ricochetVolley || 0) + 1;
    const activeRicochets = playerBullets.reduce((count, bullet) => count + (bullet.style === 'ricochet' ? 1 : 0), 0);
    const activeCap = Math.min(22, 4 + runStats.ricochetShots * 3);
    if (game.ricochetVolley % 2 === 1 && activeRicochets < activeCap) {
      const angleOffset = Math.floor(game.ricochetVolley / 2) % 2 ? -0.13 : 0.13;
      const availableSlots = Math.max(0, activeCap - activeRicochets);
      fireFan(Math.min(runStats.ricochetShots, availableSlots), 'ricochet', runStats.ricochetDamage, 0.18, { angleOffset, pierce: 0, splitLevel: 0 });
    }
  }
  if (runStats.frostShots > 0) fireFan(runStats.frostShots, 'frost', runStats.frostDamage, 0.11, { pierce: 0, splitLevel: 0 });
  if (runStats.clusterShots > 0) {
    game.clusterVolley = (game.clusterVolley || 0) + 1;
    if (game.clusterVolley % runStats.clusterVolleyEvery === 1) {
      fireFan(runStats.clusterShots, 'cluster', runStats.clusterDamage, 0.16, {
        pierce: 0,
        splitLevel: 0,
        clusterFragments: runStats.clusterFragments,
        clusterFragmentDamage: runStats.clusterFragmentDamage,
        clusterFuse: runStats.clusterFuse,
        explosionRadius: runStats.clusterExplosionRadius,
      });
      sfx.fireWeapon('grenade');
    }
  }
  if (runStats.swordShots > 0) {
    game.swordVolley = (game.swordVolley || 0) + 1;
    if (game.swordVolley % runStats.swordVolleyEvery === 1) fireSwordVolley();
  }
  if (runStats.executeSwords > 0) {
    const count = Math.min(8, runStats.executeSwords);
    fireFan(count, 'execute', runStats.executeSwordDamage, 0.075, {
      pierce: 1,
      splitLevel: 0,
      speed: 960,
      effectPath: 'execute',
    });
    sfx.fireWeapon('sword');
  }
  if (runStats.tetherPairs > 0) {
    game.tetherVolley = (game.tetherVolley || 0) + 1;
    if (game.tetherVolley % runStats.tetherVolleyEvery === 1) fireTetherVolley();
  }
  muzzleFlash(COLORS.white, 1 + getOwnedPaths(game.skills).filter((path) => path !== 'split').length);
  if (primaryWeapon?.weapon?.mode !== 'beam') sfx.fireWeapon(primaryWeaponSfx(primaryWeapon));
}

function fireEnemyBullet(x, y, angle, speed = 180, color = 0xff684f, scale = 1, damage = null, damageMultiplier = null, visualColor = null) {
  const b = hostilePool.acquire('hostile');
  b.spawnedAt = game.elapsed;
  const bulletScale = Math.max(0.64, scale);
  b.view.clear();
  b.artModel.bulletScale = bulletScale;
  b.artModel.color = HOSTILE_PROJECTILE_COLOR;
  b.radius = 4.6 * bulletScale;
  const scaledSpeed = speed * (game.balance?.bulletSpeed || 1) * (runStats.enemyBulletSpeedMultiplier || 1);
  b.x = x; b.y = y; b.vx = Math.cos(angle) * scaledSpeed; b.vy = Math.sin(angle) * scaledSpeed;
  const rawDamage = damage ?? (8 + bulletScale * 7 + Math.max(0, speed - 150) * 0.025);
  b.damage = Math.max(1, Math.round(rawDamage * (damageMultiplier ?? game.balance?.enemyDamage ?? 1)));
  b.grazeCandidate = false;
  b.grazed = false;
  b.flipDodged = false;
  b.commonBulletId = `hostile-${++game.fixedTargetSerial}`;
  b.enhanced = bulletScale >= 1.4;
  b.view.position.set(x, y);
  enemyBullets.push(b);
}

function enemyBulletScale(enemy) {
  if (Number.isFinite(enemy.bulletScale)) return enemy.bulletScale;
  if (enemy.config) return enemy.config.final ? 1.2 : 1;
  if (enemy.elite) return enemy.kind === 'heavy' ? 0.92 : 0.78;
  if (enemy.kind === 'heavy') return 0.76;
  if (enemy.kind === 'relay') return 0.58;
  if (enemy.kind === 'turret') return 0.62;
  if (enemy.kind === 'dart') return 0.52;
  return 0.46;
}

function aimedShot(enemy, count = 1, spread = 0.18, speed = 180) {
  enemy.model?.fire?.();
  const base = Math.atan2(player.y - enemy.y, player.x - enemy.x);
  const scale = enemyBulletScale(enemy);
  const isBoss = Boolean(enemy.config);
  const bossPattern = game.balance?.bossPattern;
  const shotCount = isBoss ? boostedBossBarrageCount(count * (bossPattern?.bulletCount || 1)) : count;
  const shotSpread = spread * (isBoss ? (bossPattern?.spread || 1) : 1);
  const shotSpeed = speed * (isBoss ? (bossPattern?.bulletSpeed || 1) : 1);
  const rawDamage = isBoss ? (bossPattern?.bulletDamage || 22) * BOSS_BARRAGE_DAMAGE_MULTIPLIER : enemy.bulletDamage;
  const damageMultiplier = isBoss ? game.balance?.bossDamage : game.balance?.enemyDamage;
  for (let i = 0; i < shotCount; i += 1) {
    const offset = shotCount === 1 ? 0 : (i - (shotCount - 1) / 2) * shotSpread;
    fireEnemyBullet(enemy.x, enemy.y + 14, base + offset, shotSpeed, enemy.config?.color || 0xff684f, scale, rawDamage, damageMultiplier,enemy.visualColor);
  }
}

function projectedPoint(x, y) {
  return projectWorldPoint(x, y);
}

function attackRangeEndpoint(originX, originY, targetX, targetY, maxDistance = Infinity) {
  const angle = Math.atan2(targetY - originY, targetX - originX);
  const vx = Math.cos(angle);
  const vy = Math.sin(angle);
  let distance = maxDistance;
  const bounds = { left: -35, right: W + 35, top: -35, bottom: H + 35 };
  if (vx > 0) distance = Math.min(distance, (bounds.right - originX) / vx);
  if (vx < 0) distance = Math.min(distance, (bounds.left - originX) / vx);
  if (vy > 0) distance = Math.min(distance, (bounds.bottom - originY) / vy);
  if (vy < 0) distance = Math.min(distance, (bounds.top - originY) / vy);
  return {
    x: originX + vx * Math.max(0, distance),
    y: originY + vy * Math.max(0, distance),
    angle,
  };
}

function drawHostileTelegraph(telegraph) {
  if (telegraph.showWarning === false) return;
  const { view, type, elapsed, duration, color, targetX, targetY, radius, marks } = telegraph;
  const progress = Math.min(1, elapsed / Math.max(0.01, duration));
  const quiet=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const phase=warningPhase(elapsed,duration);
  view.alpha=phase.alpha;
  const pulse = phase.urgent ? .95 : quiet ? .48 : 0.48 + Math.sin(elapsed * 12) * 0.12;
  const origin = telegraph.source
    ? projectedPoint(telegraph.source.x, telegraph.source.y)
    : projectedPoint(telegraph.originX, telegraph.originY);
  const target = projectedPoint(targetX, targetY);
  view.clear();
  if (type === 'dash') {
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) return;
    const directionX = dx / distance;
    const directionY = dy / distance;
    const normalX = -directionY;
    const normalY = directionX;
    const halfWidth = Math.max(16, (telegraph.source?.radius || 18) * 0.78);
    const flash = phase.urgent ? 1 : quiet ? .4 : (Math.sin(elapsed * 12) + 1) / 4;
    const startX = origin.x - directionX * 6;
    const startY = origin.y - directionY * 6;
    const endX = target.x + directionX * 6;
    const endY = target.y + directionY * 6;
    const points = [
      startX + normalX * halfWidth, startY + normalY * halfWidth,
      endX + normalX * halfWidth, endY + normalY * halfWidth,
      endX - normalX * halfWidth, endY - normalY * halfWidth,
      startX - normalX * halfWidth, startY - normalY * halfWidth,
    ];
    view.poly(points).fill({ color: 0x020611, alpha: 0.32 })
      .poly(points).fill({ color, alpha: 0.06 + flash * 0.16 })
      .poly(points).stroke({ color: COLORS.white, width: 1.6, alpha: 0.22 + flash * 0.72 });
    return;
  }
  if (type === 'zone') {
    const r = radius * (0.76 + progress * 0.24);
    view.circle(target.x, target.y, r + 4).stroke({ color: 0x020611, width: 7, alpha: 0.72 })
      .circle(target.x, target.y, r).fill({ color, alpha: 0.08 + pulse * 0.08 })
      .circle(target.x, target.y, r).stroke({ color, width: 2.5, alpha: 0.6 + pulse * 0.28 })
      .circle(target.x, target.y, Math.max(5, r * (1 - progress))).stroke({ color: COLORS.white, width: 1.2, alpha: 0.65 });
    return;
  }
  if (type === 'wall') {
    for (const mark of marks || []) {
      const point = projectedPoint(mark.x, mark.y);
      const end = projectedPoint(mark.x, H + 35);
      const height = Math.max(8, end.y - point.y);
      view.roundRect(point.x - 9, point.y - 2, 18, height + 4, 5).fill({ color: 0x020611, alpha: 0.42 })
        .roundRect(point.x - 7, point.y, 14, height, 4).fill({ color, alpha: 0.045 + pulse * 0.045 })
        .roundRect(point.x - 7, point.y, 14, height, 4).stroke({ color, width: 1.6, alpha: 0.3 + pulse * 0.16 });
    }
    return;
  }
  if (type === 'cone') {
    const cones = telegraph.cones || [{ offsetX: 0, offsetY: 0, targetX, targetY, spread: telegraph.spread || 0.84 }];
    for (const cone of cones) {
      const sourceX = (telegraph.source?.x ?? telegraph.originX) + (cone.offsetX || 0);
      const sourceY = (telegraph.source?.y ?? telegraph.originY) + (cone.offsetY || 0);
      const source = projectedPoint(sourceX, sourceY);
      const angle = Math.atan2(cone.targetY - sourceY, cone.targetX - sourceX);
      const halfSpread = cone.spread / 2;
      const leftWorld = attackRangeEndpoint(sourceX, sourceY, sourceX + Math.cos(angle - halfSpread), sourceY + Math.sin(angle - halfSpread));
      const rightWorld = attackRangeEndpoint(sourceX, sourceY, sourceX + Math.cos(angle + halfSpread), sourceY + Math.sin(angle + halfSpread));
      const left = projectedPoint(leftWorld.x, leftWorld.y);
      const right = projectedPoint(rightWorld.x, rightWorld.y);
      view.moveTo(source.x, source.y)
        .lineTo(left.x, left.y)
        .lineTo(right.x, right.y)
        .closePath().fill({ color: 0x020611, alpha: 0.3 })
        .moveTo(source.x, source.y)
        .lineTo(left.x, left.y)
        .lineTo(right.x, right.y)
        .closePath().fill({ color, alpha: 0.05 + pulse * 0.05 })
        .moveTo(source.x, source.y)
        .lineTo(left.x, left.y)
        .moveTo(source.x, source.y)
        .lineTo(right.x, right.y)
        .stroke({ color, width: 2.2, alpha: 0.36 + pulse * 0.16 });
    }
    return;
  }
  if (telegraph.lines) {
    for (const line of telegraph.lines) {
      const start = projectedPoint((telegraph.source?.x ?? 0) + (line.offsetX || 0), (telegraph.source?.y ?? 0) + (line.offsetY || 0));
      const end = projectedPoint(line.targetX, line.targetY);
      view.moveTo(start.x, start.y).lineTo(end.x, end.y)
        .stroke({ color: 0x020611, width: 25, alpha: 0.72 })
        .moveTo(start.x, start.y).lineTo(end.x, end.y)
        .stroke({ color, width: 20, alpha: 0.055 + pulse * 0.035 })
        .moveTo(start.x, start.y).lineTo(end.x, end.y)
        .stroke({ color, width: 7, alpha: 0.28 + pulse * 0.16 });
    }
    return;
  }
  const width = type === 'laser' ? 6 + progress * 10 : 3 + progress * 4;
  const lineAlpha = type === 'laser' ? 0.24 + pulse * 0.16 : 0.3 + pulse * 0.16;
  view.moveTo(origin.x, origin.y).lineTo(target.x, target.y)
    .stroke({ color: 0x020611, width: width * 2.8, alpha: 0.72 })
    .moveTo(origin.x, origin.y).lineTo(target.x, target.y)
    .stroke({ color, width: width * 2.2, alpha: 0.035 + pulse * 0.035 })
    .moveTo(origin.x, origin.y).lineTo(target.x, target.y)
    .stroke({ color, width, alpha: lineAlpha });
}

function queueHostileTelegraph(options) {
  const telegraph = {
    ...options,
    // Quiet ordinary aiming stripes by default; explicit hazard warnings win.
    showWarning: options.showWarning ?? !['shot', 'cone'].includes(options.type),
    elapsed: 0,
    duration: Math.max(0.35, options.duration || 0.8),
    color: options.type === 'laser' ? LASER_TELEGRAPH_COLOR : TELEGRAPH_COLOR,
    view: new Graphics(),
  };
  telegraph.view.zIndex = 850;
  telegraph.view.screenSpaceGeometry = true;
  fxLayer.addChild(telegraph.view);
  telegraphs.push(telegraph);
  if (telegraph.showWarning !== false) sfx.tone(options.type === 'laser' ? 420 : 310, 0.09, 'triangle', 0.018, 80);
  return telegraph;
}

function spawnHostileBeam(originX, originY, targetX, targetY, color, damage, duration = 0.55, width = 15) {
  const beam = { originX, originY, targetX, targetY, color: HOSTILE_PROJECTILE_COLOR, damage, duration, width, spawnedAt: game.elapsed, elapsed: 0, hitTimer: 0, view: new Graphics() };
  beam.view.zIndex = 855;
  beam.view.screenSpaceGeometry = true;
  fxLayer.addChild(beam.view);
  hostileBeams.push(beam);
}

function updateTelegraphs(dt) {
  // A pattern owns one clock. If a whole beat cannot fit, hold that beat and
  // all later beats instead of dropping it or releasing a backlog together.
  const timelines = new Set(telegraphs.filter(t=>t.timeline&&!t.source?.dead).map(t=>t.timeline));
  for (const timeline of timelines) {
    timeline.elapsed += dt;
    const scheduled = telegraphs.filter(t=>t.timeline===timeline&&!t.source?.dead)
      .sort((a,b)=>a.duration-b.duration);
    for (const telegraph of scheduled) {
      if (telegraph.duration > timeline.elapsed) break;
      if (!telegraphs.includes(telegraph)) continue;
      if (telegraph.execute?.() === false) {
        timeline.onDelay?.(timeline.elapsed - telegraph.duration);
        timeline.elapsed = telegraph.duration;
        break;
      }
      telegraph.view.removeFromParent();
      const index = telegraphs.indexOf(telegraph);
      if (index >= 0) telegraphs.splice(index, 1);
    }
  }
  for (let index = telegraphs.length - 1; index >= 0; index -= 1) {
    const telegraph = telegraphs[index];
    if (telegraph.source?.dead) {
      telegraph.view.removeFromParent();
      telegraphs.splice(index, 1);
      continue;
    }
    telegraph.elapsed = telegraph.timeline ? telegraph.timeline.elapsed : telegraph.elapsed + dt;
    drawHostileTelegraph(telegraph);
    if (telegraph.timeline) continue;
    if (telegraph.elapsed < telegraph.duration) continue;
    telegraph.view.removeFromParent();
    telegraphs.splice(index, 1);
    telegraph.execute?.();
  }
}

function cancelTelegraphsFrom(source) {
  for (let index = telegraphs.length - 1; index >= 0; index -= 1) {
    if (telegraphs[index].source !== source) continue;
    telegraphs[index].view.removeFromParent();
    telegraphs.splice(index, 1);
  }
}

function updateHostileBeams(dt) {
  for (let index = hostileBeams.length - 1; index >= 0; index -= 1) {
    const beam = hostileBeams[index];
    beam.elapsed += dt;
    const start = projectedPoint(beam.originX, beam.originY);
    const end = projectedPoint(beam.targetX, beam.targetY);
    const pulse = 0.72 + Math.sin(beam.elapsed * 34) * 0.2;
    beam.view.clear()
      .moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ color: beam.color, width: beam.width * 2.2, alpha: 0.15 })
      .moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ color: beam.color, width: beam.width, alpha: 0.88 })
      .moveTo(start.x, start.y).lineTo(end.x, end.y).stroke({ color: 0xffb6be, width: beam.width * 0.52, alpha: pulse });
    beam.hitTimer -= dt;
    // Stroke width is a full diameter. Its faint halo is cosmetic, not damage.
    const playerStart = beam.spawnedAt === game.elapsed ? player : collisionStart(player);
    if (beam.hitTimer <= 0 && sweptCircleHitsSegment(playerStart,player,
      {x:beam.originX,y:beam.originY},{x:beam.targetX,y:beam.targetY},beam.width * .5 + player.radius)) {
      beam.hitTimer = 0.22;
      hitPlayer(beam.damage, 'beam');
    }
    if (beam.elapsed < beam.duration) continue;
    beam.view.removeFromParent();
    hostileBeams.splice(index, 1);
  }
}

function hostileFan(originX, originY, count, baseAngle, spread, speed, color, damage, scale = 0.8, damageMultiplier = game.balance?.enemyDamage) {
  for (let index = 0; index < count; index += 1) {
    const offset = count === 1 ? 0 : (index / (count - 1) - 0.5) * spread;
    fireEnemyBullet(originX, originY, baseAngle + offset, speed, color, scale, damage, damageMultiplier);
  }
}

function hostileWall(y, color, damage, speed = 210, gapX = player.x, count = 7, damageMultiplier = game.balance?.enemyDamage) {
  const spacing = (W - 72) / Math.max(1, count - 1);
  for (let index = 0; index < count; index += 1) {
    const x = 36 + index * spacing;
    if (Math.abs(x - gapX) < spacing * 0.72) continue;
    fireEnemyBullet(x, y, Math.PI / 2, speed, color, 0.88, damage, damageMultiplier);
  }
}

function wallMarks(y, count, gapX) {
  const spacing = (W - 72) / Math.max(1, count - 1);
  return Array.from({ length: count }, (_, index) => ({ x: 36 + index * spacing, y }))
    .filter((mark) => Math.abs(mark.x - gapX) >= spacing * 0.72);
}

function queuePatternVolley(source,plan,{limit,damage,multiplier,windup=.55,scale=.72}) {
  const originX=source.x,originY=source.y;
  const beats=[...new Set(plan.shots.map(shot=>shot.delay||0))].sort((a,b)=>a-b);
  const hazards=plan.hazards||[];
  plan={...plan,color:source.visualColor??plan.color};
  let pending=beats.length+hazards.length;
  if(!pending){source.attackPending=false;source.fireTimer=plan.cooldown;return;}
  source.attackPending=true;
  source.currentPattern=plan.name;
  const timeline={elapsed:0,onDelay:seconds=>{
    if(source===boss){
      const rate=(source.frostTime>0?1-runStats.frostStrength*.45:1)*(source.stunTime>0?.28:1);
      source.fireTimer+=seconds*rate;
    }
  }};
  const complete=()=>{if(--pending===0){source.attackPending=false;if(source!==boss)source.fireTimer=plan.recovery??plan.cooldown;}};
  beats.forEach((delay,index)=>queueHostileTelegraph({source,timeline,type:'shot',showWarning:!!plan.warning&&index===0,
    targetX:plan.targetX??player.x,targetY:plan.targetY??player.y,duration:windup+delay,
    execute:()=>{
      if(source.dead)return;
      const shots=plan.shots.filter(shot=>(shot.delay||0)===delay);
      // Never release a partial pattern: its designed gap must stay intact.
      if(enemyBullets.length+shots.length>limit)return false;
      source.model?.fire?.();for(const shot of shots){
        fireEnemyBullet(source.x+shot.x-originX,source.y+shot.y-originY,shot.angle,
          shot.speed/Math.max(1,game.balance?.bulletSpeed||1),plan.color||COLORS.red,scale,damage,multiplier,source.visualColor);
      }
      complete();
    }}));
  for(const hazard of hazards) {
    const beam=hazard.type==='beam';
    queueHostileTelegraph({source,timeline,type:beam?'laser':'zone',showWarning:true,
      targetX:beam?hazard.targetX:hazard.x,targetY:beam?hazard.targetY:hazard.y,
      radius:hazard.radius,color:plan.color||COLORS.red,
      duration:Math.max(windup,hazard.duration)+hazard.delay,
      ...(beam?{lines:[{offsetX:hazard.x-originX,offsetY:hazard.y-originY,targetX:hazard.targetX,targetY:hazard.targetY}]}:{}),
      execute:()=>{
        if(source.dead)return;
        source.model?.fire?.();
        const hitDamage=damage*(multiplier||1)*.65;
        if(beam)spawnHostileBeam(source.x+hazard.x-originX,source.y+hazard.y-originY,
          hazard.targetX,hazard.targetY,plan.color||COLORS.red,hitDamage,hazard.lifetime,hazard.width);
        else {
          if(Math.hypot(player.x-hazard.x,player.y-hazard.y)<hazard.radius+player.radius)hitPlayer(hitDamage,'chapter-zone');
          impactExplosion(hazard.x,hazard.y,plan.color||COLORS.red,.8);
        }
        complete();
      }});
  }
}

function queueFormationRelay(enemy) {
  const group=enemies.filter(e=>!e.dead&&e.barrageGroup?.id===enemy.barrageGroup.id);
  if(group.length<2)return false; // A survivor still has its ordinary single-enemy rule.
  if(group.some(e=>e.attackPending)) {enemy.fireTimer=.25;return true;}
  // Hold the first arrival briefly so late members join instead of spending
  // their only route firing window waiting for a solo shot's cooldown.
  if(group.some(e=>!e.routeCanFire&&e.age<2.2)) {enemy.fireTimer=0;return true;}
  const ready=group.filter(e=>e.canFire&&e.routeCanFire&&e.y>20&&e.y<H*.56&&player.y>=e.y+100)
    .sort((a,b)=>a.barrageGroup.slot-b.barrageGroup.slot);
  if(ready.length<2)return false;
  // Synchronize the next round without releasing a late, simultaneous burst.
  if(ready.some(e=>e.fireTimer>0)) {enemy.fireTimer=0;return true;}
  if(enemyBullets.length+ready.length>28) {enemy.fireTimer=.5;return true;}
  ready.forEach((member,index)=>{
    const base=regularBarragePlan({x:member.x,y:member.y,chapter:game.stageIndex,
      resourceId:'S01',targetX:player.x,targetY:player.y});
    const plan={...base,name:'编队接力点射',resourceId:'S08',recovery:4.1,
      shots:base.shots.map(shot=>({...shot,delay:index*.42}))};
    queuePatternVolley(member,plan,{limit:28,damage:member.bulletDamage,
      multiplier:game.balance?.enemyDamage,windup:plan.duration});
  });
  return true;
}

function startEnemyAttack(enemy) {
  if (enemy.waveRole) {
    if(enemyBullets.length >= 48) { enemy.fireTimer=.5; return; }
    if(enemy.waveRole==='elite'){
      const plan=eliteBarragePlan({x:enemy.x,y:enemy.y,chapter:game.stageIndex,
        volley:enemy.patternVolley||0,targetX:player.x,targetY:player.y});
      if(player.y<enemy.y+100){enemy.fireTimer=.4;return;}
      enemy.patternVolley=(enemy.patternVolley||0)+1;
      queuePatternVolley(enemy,plan,{limit:48,damage:enemy.bulletDamage,multiplier:game.balance?.enemyDamage,windup:plan.duration});
      return;
    }
    if(player.y<enemy.y+100){enemy.fireTimer=.4;return;}
    if(enemy.barrageGroup&&queueFormationRelay(enemy))return;
    const plan=regularBarragePlan({x:enemy.x,y:enemy.y,kind:enemy.kind,chapter:game.stageIndex,
      resourceId:enemy.barrageId,route:enemy.route,seed:enemy.barrageSeed||0,volley:enemy.patternVolley||0,
      targetX:player.x,targetY:player.y});
    enemy.barrageId=plan.resourceId; // A single aircraft keeps the same readable rule.
    enemy.patternVolley=(enemy.patternVolley||0)+1;
    queuePatternVolley(enemy,plan,{limit:enemy.waveRole==='light'?28:48,damage:enemy.bulletDamage,multiplier:game.balance?.enemyDamage,windup:plan.duration});
    return;
  }
  const targetX = Math.max(45, Math.min(W - 45, player.x + (player.x - enemy.x) * 0.14));
  const targetY = Math.max(180, Math.min(H - 120, player.y + (player.y - enemy.y) * 0.1));
  const color = CAMPAIGN[game.stageIndex]?.accent || COLORS.red;
  const damage = enemy.bulletDamage;
  const cooldown = Math.max(Number(BALANCE_GLOBAL.minEnemyCooldown) || 0.42, enemy.fireCooldown * (game.balance?.enemyCooldown || 1) * (enemy.elite ? enemy.eliteCooldown : 1) * (0.95 + Math.random() * 0.2));
  if (enemy.attackKind === 'shot') {
    const pattern = getBasicShotPattern(game.stageIndex);
    aimedShot(enemy, pattern.bulletCount, pattern.spread, enemy.bulletSpeed);
    enemy.attackPending = true;
    enemy.shotBurst = {
      wavesRemaining: pattern.waveCount - 1,
      interval: pattern.waveInterval,
      timer: pattern.waveInterval,
      bulletCount: pattern.bulletCount,
      spread: pattern.spread,
      cooldown,
    };
    return;
  }
  enemy.fireTimer = cooldown;
  if (enemy.attackKind === 'fan') {
    enemy.model?.fire?.();
    const angle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
    hostileFan(enemy.x, enemy.y, enemy.bulletCount + 2 + (enemy.elite ? 1 : 0), angle, 0.68, enemy.bulletSpeed, color, damage, 0.74);
    return;
  }
  enemy.attackPending = true;
  const complete = (action) => () => {
    if (enemy.dead) return;
    enemy.attackPending = false;
    enemy.model?.fire?.();
    action();
  };
  if (enemy.attackKind === 'dash') {
    const dashTarget = attackRangeEndpoint(enemy.x, enemy.y, targetX, targetY, 430 * 0.46);
    queueHostileTelegraph({ source: enemy, type: 'dash', targetX: dashTarget.x, targetY: dashTarget.y, duration: 0.72, color, execute: complete(() => {
      const angle = Math.atan2(dashTarget.y - enemy.y, dashTarget.x - enemy.x);
      enemy.dash = { vx: Math.cos(angle) * 430, vy: Math.sin(angle) * 430, time: 0.46 };
    }) });
  } else if (enemy.attackKind === 'snipe' || enemy.attackKind === 'lance') {
    const shotEnd = attackRangeEndpoint(enemy.x, enemy.y, targetX, targetY);
    // This resolves as the standard enemy bullet, so it should not masquerade as a telegraphed attack.
    complete(() => {
      const angle = Math.atan2(shotEnd.y - enemy.y, shotEnd.x - enemy.x);
      fireEnemyBullet(enemy.x, enemy.y, angle, enemy.bulletSpeed + 82, color, 1.22, damage + 4, game.balance?.enemyDamage);
      ringEffect(enemy.x, enemy.y, color, 34, 0.16);
    })();
  } else if (enemy.attackKind === 'laser') {
    queueHostileTelegraph({ source: enemy, type: 'laser', targetX, targetY, duration: 0.9, color, execute: complete(() => spawnHostileBeam(enemy.x, enemy.y, targetX, targetY, color, damage * 0.62, 0.5, 10)) });
  } else if (enemy.attackKind === 'wall') {
    const marks = wallMarks(enemy.y + 22, 7, targetX);
    queueHostileTelegraph({ source: enemy, type: 'wall', marks, targetX, targetY, duration: 0.82, color, execute: complete(() => hostileWall(enemy.y + 22, color, damage, enemy.bulletSpeed + 40, targetX)) });
  } else if (enemy.attackKind === 'mortar' || enemy.attackKind === 'mine' || enemy.attackKind === 'venom' || enemy.attackKind === 'thunder') {
    const radius = enemy.attackKind === 'mine' ? 48 : 64;
    queueHostileTelegraph({ source: enemy, type: 'zone', targetX, targetY, radius, duration: 0.88, color, execute: complete(() => {
      if ((player.x - targetX) ** 2 + (player.y - targetY) ** 2 < (radius + player.radius) ** 2) hitPlayer(damage * 1.15, 'zone');
      impactExplosion(targetX, targetY, color, 0.78);
    }) });
  } else if (enemy.attackKind === 'pulse' || enemy.attackKind === 'spiral') {
    complete(() => hostileFan(enemy.x, enemy.y, enemy.attackKind === 'spiral' ? 8 : 6, Math.PI / 2, Math.PI * 2, enemy.bulletSpeed, color, damage, 0.72))();
  } else {
    // Unmapped advanced abilities fall back to a normal bullet fan; normal bullets do not need a warning.
    complete(() => {
      const angle = Math.atan2(targetY - enemy.y, targetX - enemy.x);
      hostileFan(enemy.x, enemy.y, enemy.bulletCount + 2 + (enemy.elite ? 1 : 0), angle, 0.68, enemy.bulletSpeed, color, damage, 0.74);
    })();
  }
}

function spawnPickup(x, y, forcedType) {
  const type = forcedType || 'heal';
  const solid = type === 'heal' || type === 'battle-supply';
  const view = solid ? createPickupModel(type) : new Container();
  if (!solid) {
  const pickupColor = type === 'battle-supply' ? 0xffd56b : type === 'heal' ? 0x66f59d : type === 'red' ? COLORS.red : COLORS.blue;
  const ring = new Graphics()
    .circle(0, 0, 17).fill({ color: pickupColor, alpha: 0.08 })
    .circle(0, 0, 15).stroke({ color: pickupColor, width: 3 })
    .circle(0, 0, 10).fill({ color: 0x071820, alpha: 0.9 });
  const letter = new Graphics();
  if (type === 'heal') letter.roundRect(-3, -9, 6, 18, 2).fill({ color: pickupColor }).roundRect(-9, -3, 18, 6, 2).fill({ color: pickupColor });
  else if (type === 'battle-supply') letter.roundRect(-10, -7, 20, 15, 2).fill({ color: pickupColor }).rect(-3, -11, 6, 4).fill({ color: 0xfff2b7 }).rect(-6, -1, 12, 3).fill({ color: 0x263646 });
  else if (type === 'red') letter.poly([-6, -7, 0, 0, 6, -7, 3, 8, -3, 8]).fill({ color: COLORS.red });
  else letter.poly([-6, -7, 4, -7, 7, -2, 3, 1, 7, 6, -6, 6]).fill({ color: COLORS.blue });
  view.addChild(ring, letter);
  }
  view.position.set(x, y);
  fxLayer.addChild(view);
  const emphasis=new Graphics();emphasis.eventMode='none';view.addChild(emphasis);view.pickupEmphasis=emphasis;
  pickups.push({ view, x, y, type, age: 0, radius: type === 'battle-supply' ? 22 : 15, dead: false,
    chestId: type === 'battle-supply' ? `${game.fixedGrowth.state.runId}/elite-${++game.battleSupplySerial}` : null });
}

function spawnXpOrb(x, y, value = 1) {
  const {view, radius} = createExperienceChip(value);
  view.position.set(x, y);
  pickupLayer.addChild(view);
  xpOrbs.push({ view, x, y, vx: (Math.random() - 0.5) * 70, vy: 24 + Math.random() * 35, value, radius, age: 0, dead: false });
}

function xpForLevel(level) {
  const mythicTier = Math.floor((level - 1) / 8);
  const baseRequirement = 5 + Math.floor((level - 1) * 5.2) + mythicTier * mythicTier * 8;
  return Math.round(baseRequirement * 1.2);
}

function gainXp(amount) {
  if (game.fixedPartsMode) return gainFixedXp(amount);
  const previousLevel = game.level;
  const research = game.peripheralSnapshot?.stats.researchModifiers || {};
  game.xp += amount * runStats.xpMultiplier;
  while (game.xp >= game.xpNext) {
    game.xp -= game.xpNext;
    game.level += 1;
    game.xpNext = xpForLevel(game.level);
    game.pendingLevels += 1;
    game.hp = Math.min(runStats.maxHp, game.hp + (research.levelHealFlat || 0) + runStats.maxHp * (research.levelHealRatio || 0));
    if (runStats.levelHeal > 0) {
      game.hp = Math.min(
        runStats.maxHp,
        game.hp + Math.ceil(runStats.maxHp * 0.08 * runStats.levelHeal * (runStats.healingMultiplier || 1)),
      );
    }
  }
  updateUI();
  if (game.pendingLevels > 0 && game.state === 'playing') openLevelUp();
  showRunLevelFeedback(previousLevel, game.level);
}

function burst(x, y, color = COLORS.red, amount = 14, speed = 140) {
  if (game.fixedPartsMode) { combatVfx.impact(x,y,color,Math.min(1.5,amount/12)); return; }
  const visibleAmount = reserveFxParticles('burst', amount);
  for (let i = 0; i < visibleAmount; i += 1) {
    const view = new Graphics();
    const size = 1.5 + Math.random() * 4.5;
    if (i % 3 === 0) view.poly([0, -size * 2.4, size * 1.2, size, -size, size * 0.45]).fill({ color: i % 2 ? COLORS.white : COLORS.amber });
    else view.poly([0, -size * 1.8, size, size, -size, size * 0.55]).fill({ color: i % 2 ? color : 0xd7ceff });
    view.position.set(x, y);
    fxLayer.addChild(view);
    const angle = Math.random() * Math.PI * 2;
    const velocity = speed * (0.25 + Math.random());
    particles.push({ view, x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity, life: 0.35 + Math.random() * 0.5, maxLife: 0.85, spin: (Math.random() - 0.5) * 9 });
  }
}

function impactExplosion(x, y, color = COLORS.red, scale = 1) {
  if (game.fixedPartsMode) { combatVfx.impact(x,y,0xffbc79,scale,true); return; }
  burst(x, y, color, Math.round(16 * scale), 145 * scale);
  ringEffect(x, y, color, 48 * scale, 0.28 + scale * 0.08);
  ringEffect(x, y, COLORS.amber, 28 * scale, 0.18 + scale * 0.05);
  if (reserveFxParticles('flash')) {
    const flash = new Graphics().circle(0, 0, 14 * scale).fill({ color: COLORS.white, alpha: 0.72 })
      .circle(0, 0, 26 * scale).fill({ color, alpha: 0.2 });
    flash.bloom = true;
    flash.additive = true;
    flash.position.set(x, y);
    fxLayer.addChild(flash);
    particles.push({ view: flash, x, y, vx: 0, vy: 0, life: 0.12, maxLife: 0.12, spin: 0, fade: true });
  }
  const debrisScale = Math.max(0.92, Math.sqrt(scale));
  const debrisCount = reserveFxParticles('debris', Math.round(8 + scale * 7));
  for (let i = 0; i < debrisCount; i += 1) {
    const width = (4.2 + Math.random() * 4.8) * debrisScale;
    const length = (12 + Math.random() * 15) * debrisScale;
    const shardColor = i % 3 === 0 ? COLORS.white : i % 2 ? color : COLORS.amber;
    const view = new Graphics();
    if (i % 3 === 0) {
      view
        .poly([
          -width, -length * 0.32,
          width * 0.72, -length * 0.48,
          width, length * 0.18,
          -width * 0.42, length * 0.55,
        ])
        .fill({ color: shardColor, alpha: 0.94 });
    } else if (i % 3 === 1) {
      view
        .poly([
          -width * 0.55, -length * 0.58,
          width * 0.9, -length * 0.18,
          width * 0.42, length * 0.62,
          -width, length * 0.16,
        ])
        .fill({ color: shardColor, alpha: 0.92 });
    } else {
      view
        .roundRect(-width * 0.46, -length * 0.5, width * 0.92, length, Math.min(2, width * 0.25))
        .fill({ color: shardColor, alpha: 0.92 });
    }
    view.stroke({ color: COLORS.white, width: 1.1, alpha: 0.32 });
    view.position.set(
      x + (Math.random() - 0.5) * 13 * debrisScale,
      y + (Math.random() - 0.5) * 13 * debrisScale,
    );
    fxLayer.addChild(view);
    const angle = Math.random() * Math.PI * 2;
    const velocity = (115 + Math.random() * 190) * (0.8 + scale * 0.35);
    const life = 0.58 + Math.random() * 0.45 + scale * 0.08;
    particles.push({
      view,
      x: view.x,
      y: view.y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life,
      maxLife: life,
      spin: (Math.random() - 0.5) * 12,
    });
  }
  const smokeCount = reserveFxParticles('smoke', Math.ceil(scale * 3));
  for (let i = 0; i < smokeCount; i += 1) {
    const view = new Graphics().circle(0, 0, (9 + Math.random() * 9) * scale).fill({ color: 0x18333a, alpha: 0.28 });
    view.position.set(x + (Math.random() - 0.5) * 18 * scale, y + (Math.random() - 0.5) * 18 * scale);
    fxLayer.addChild(view);
    particles.push({ view, x: view.x, y: view.y, vx: (Math.random() - 0.5) * 28, vy: -25 - Math.random() * 34, life: 0.65 + Math.random() * 0.35, maxLife: 1, spin: 0, smoke: true, grow: 1.5 + Math.random() * 0.7 });
  }
}

function ringEffect(x, y, color = COLORS.cyan, max = 70, duration = 0.45) {
  combatVfx.impact(x,y,color,Math.max(.5,Math.min(2,max/70)));
}

function hitSpark(x, y, color, critical = false) {
  if (game.fixedPartsMode) { combatVfx.impact(x,y,color,critical?1.5:.8); return; }
  const desiredShards = critical ? 9 : 5;
  const allocated = reserveFxParticles('hit', desiredShards + 1);
  if (!allocated) return;
  const view = new Graphics();
  const count = critical ? 14 : 8;
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.28;
    const inner = 2 + Math.random() * 4;
    const outer = (critical ? 29 : 17) + Math.random() * (critical ? 18 : 12);
    view.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
      .lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
      .stroke({ color: i % 2 ? color : COLORS.white, width: critical ? 3 : 2.15, alpha: 0.96 });
  }
  view.circle(0, 0, critical ? 8 : 5).fill({ color: COLORS.white, alpha: 0.82 });
  view.bloom = true;
  view.additive = true;
  view.position.set(x, y);
  fxLayer.addChild(view);
  const flashLife = critical ? 0.25 : 0.16;
  particles.push({ view, x, y, vx: 0, vy: 0, life: flashLife, maxLife: flashLife, spin: 0, fade: true });
  const shardCount = Math.min(desiredShards, allocated - 1);
  for (let i = 0; i < shardCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (critical ? 135 : 90) + Math.random() * (critical ? 150 : 105);
    const size = (critical ? 3.2 : 2.4) + Math.random() * 2.8;
    const shard = new Graphics()
      .poly([0, -size * 1.8, size * 0.75, size, -size * 0.65, size * 0.45])
      .fill({ color: i % 3 ? color : COLORS.white, alpha: 0.95 });
    shard.position.set(x, y);
    fxLayer.addChild(shard);
    const life = (critical ? 0.3 : 0.22) + Math.random() * 0.14;
    particles.push({
      view: shard,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life,
      maxLife: life,
      spin: (Math.random() - 0.5) * 18,
    });
  }
  game.shake = Math.max(game.shake, critical ? 4.5 : 1.4);
}

function damageNumber(x, y, damage, critical, executeMultiplier) {
  if (!critical && executeMultiplier <= 1) return;
  const activeDamageText=particles.filter(p=>p.damageText);
  if(activeDamageText.length >= (executeMultiplier>=8?8:5))return;
  if(executeMultiplier<8&&activeDamageText.some(p=>p.maxLife-p.life<.12&&Math.hypot(p.x-x,p.y-y)<90))return;
  if (!reserveFxParticles('text')) return;
  const execution = executeMultiplier > 1;
  const highExecution = executeMultiplier >= 8;
  const label = execution
    ? `${critical ? '暴击 · ' : ''}裁决 ×${executeMultiplier}  ${Math.max(1, Math.round(damage))}`
    : `暴击  ${Math.max(1, Math.round(damage))}`;
  const fill = execution ? (highExecution ? 0xffe27a : 0xff5bbf) : 0xffe05e;
  const view = new Text({
    text: label,
    style: {
      fontFamily: '"Arial Black", "PingFang SC", sans-serif',
      fontSize: highExecution ? 25 : execution ? 20 : 17,
      fontWeight: '900',
      fill,
      stroke: { color: 0x270712, width: highExecution ? 6 : 4 },
      letterSpacing: 1,
      align: 'center',
    },
  });
  view.anchor.set(0.5);
  view.position.set(x, y - 18);
  view.zIndex = 1000;
  fxLayer.addChild(view);
  const life = highExecution ? 0.8 : 0.58;
  particles.push({
    view, x, y: y - 18, vx: (Math.random() - 0.5) * 22, vy: highExecution ? -82 : -64,
    life, maxLife: life, spin: 0, damageText: true, baseScale: highExecution ? 1.12 : 1,
  });
}

function shipCallout(text, color = 0x8dffae) {
  const view = new Text({
    text,
    style: {
      fontFamily: '"Arial Black", "PingFang SC", sans-serif',
      fontSize: 18,
      fontWeight: '900',
      fill: color,
      stroke: { color: 0x062028, width: 4 },
      letterSpacing: 1,
      align: 'center',
    },
  });
  view.anchor.set(0.5);
  view.position.set(player.x, player.y - 44);
  view.zIndex = 1001;
  fxLayer.addChild(view);
  particles.push({
    view, x: player.x, y: player.y - 44, vx: (Math.random() - 0.5) * 15, vy: -52,
    life: 0.72, maxLife: 0.72, spin: 0, damageText: true, baseScale: 1,
  });
}

function flightGradeFor(score = game.flightQuality) {
  return [...FLIGHT_GRADES].reverse().find((grade) => score >= grade.min) || FLIGHT_GRADES[0];
}

function resetFlightQualityChain() {
  game.flightQuality = 0;
  game.flightGrade = 'C';
  game.flightChain = 0;
  game.flightChainTimer = 0;
  game.flightLastActionAt = -10;
  game.flightLastAction = '';
  game.flightLastPhrase = '';
  game.flightLastPoints = 0;
  game.flightLastColor = 0x78f1e5;
  window.cancelAnimationFrame(showFlightFeed.scoreFrame);
  window.clearTimeout(showFlightFeed.timer);
  ui.flightFeedCombo.dataset.value = '0';
  ui.flightFeedCombo.textContent = '0';
  ui.flightFeedPoints.textContent = flightComboLabel(1);
  ui.flightFeed.classList.remove('visible');
  ui.flightQuality.classList.remove('pulse', 'grade-up', 'chained');
}

function flightAfterimage(x, y, color = COLORS.cyan, rotation = 0, scaleX = 1) {
  // The imported aircraft uses volume exhaust; don't leave the old flat
  // fighter silhouette underneath a genuinely banked three-dimensional hull.
  if(player.aircraft.model)return;
  const view = new Graphics()
    .poly([0, -35, -29, 17, -9, 9, 0, 27, 9, 9, 29, 17])
    .fill({ color, alpha: 0.16 })
    .poly([0, -29, -7, 8, 0, 21, 7, 8])
    .stroke({ color: COLORS.white, width: 2, alpha: 0.22 });
  view.position.set(x, y);
  view.rotation = rotation;
  view.scale.x = scaleX;
  fxLayer.addChild(view);
  particles.push({
    view, x, y, vx: 0, vy: 24, life: 0.34, maxLife: 0.34,
    spin: 0, fade: true,
  });
}

function flightWingTrails(x, y, movedX, movedY, rotation = 0, scaleX = 1, color = COLORS.amber) {
  const ultimateForm = player.ultimateWingForm;
  const deployedSpan = (ultimateForm?.profile?.span || 80) * 0.72;
  const wingSpan = 27 + (ultimateForm?.progress || 0) * (deployedSpan - 27);
  const wingX = Math.cos(rotation) * wingSpan * scaleX;
  const wingY = Math.sin(rotation) * wingSpan * scaleX;
  const currentTips = [-1, 1]
    .map((side) => ({
      x: x + wingX * side,
      y: y + wingY * side + 7,
    }))
    .sort((a, b) => a.x - b.x);
  const movedLength = Math.hypot(movedX, movedY);
  const trailDirection = movedLength > 0.2
    ? { x: movedX / movedLength, y: movedY / movedLength }
    : { x: 0, y: -1 };
  let previousTips = game.flightTrailAnchors;
  if (
    !previousTips
    || Math.hypot(
      currentTips[0].x - previousTips[0].x,
      currentTips[0].y - previousTips[0].y,
    ) > 90
  ) {
    previousTips = currentTips.map((tip) => ({
      x: tip.x - trailDirection.x * 36,
      y: tip.y - trailDirection.y * 36,
    }));
  }
  const view = new Graphics();
  for (let index = 0; index < currentTips.length; index += 1) {
    const current = projectWorldPoint(currentTips[index].x, currentTips[index].y);
    const previous = projectWorldPoint(previousTips[index].x, previousTips[index].y);
    view.moveTo(previous.x, previous.y)
      .lineTo(current.x, current.y)
      .stroke({ color, width: 10, alpha: 0.23, cap: 'round', join: 'round' });
    view.moveTo(previous.x, previous.y)
      .lineTo(current.x, current.y)
      .stroke({ color: COLORS.white, width: 2.5, alpha: 0.7, cap: 'round', join: 'round' });
  }
  game.flightTrailAnchors = currentTips;
  fxLayer.addChild(view);
  particles.push({
    view, x: 0, y: 0, vx: 0, vy: 0,
    life: 0.78, maxLife: 0.78, spin: 0, fade: true, screenSpaceGeometry: true,
  });
}

function pilotThrusterTrail() {
  const pilot = getActivePilot();
  const color = Number.parseInt(pilot.color.slice(1), 16);
  const count = pilotArtVisual.active ? pilotArtVisual.nozzles.length : Math.max(1, Math.min(4, pilot.airframe.nozzles || 1));
  for (let index = 0; index < count; index += 1) {
    const offset = (index - (count - 1) / 2) * 7;
    const nozzle = pilotArtVisual.active ? pilotArtVisual.nozzles[index] : { x: offset, y: 27 };
    const point = playerLocalPoint(nozzle.x, nozzle.y);
    const length = 17 + Math.random() * 15 + (game.flightBoost > 0 ? 16 : 0);
    const width = 2.2 + Math.random() * 1.5;
    const view = new Graphics()
      .roundRect(-width / 2, 0, width, length, width / 2).fill({ color, alpha: 0.58 })
      .roundRect(-0.65, 0, 1.3, length * 0.62, 0.65).fill({ color: 0xffffff, alpha: 0.82 });
    view.position.set(point.x, point.y);
    view.rotation = player.view.rotation * 0.35;
    fxLayer.addChild(view);
    const life = 0.24 + Math.random() * 0.12;
    particles.push({
      view,
      x: point.x,
      y: point.y,
      vx: (Math.random() - 0.5) * 12,
      vy: 62 + Math.random() * 28,
      life,
      maxLife: life,
      spin: 0,
      fade: true,
    });
  }
}

function awardFlightQuality(action, basePoints, color = COLORS.cyan) {
  if (game.state !== 'playing') return;
  const chained = game.flightChainTimer > 0 && game.flightQuality > 0;
  if (!chained) game.flightQuality = 0;
  game.flightChain = chained ? Math.min(9, game.flightChain + 1) : 1;
  game.flightChainTimer = FLIGHT_CHAIN_DURATION;
  game.flightLastActionAt = game.elapsed;
  const chainMultiplier = 1 + Math.min(5, game.flightChain - 1) * 0.18;
  const chainBonus = game.flightChain >= 3 && game.flightChain % 3 === 0
    ? 500 * Math.floor(game.flightChain / 3)
    : 0;
  const points = Math.max(5, Math.round((basePoints + chainBonus) * chainMultiplier * FLIGHT_SCORE_SCALE / 5) * 5);
  const previousGrade = game.flightGrade;
  game.flightQuality += points;
  game.score += points;
  const grade = flightGradeFor();
  game.flightGrade = grade.id;
  const flightPhrase = pickFlightActionText(game.flightLastPhrase);
  const statusSuffix = action.includes('+1血') ? ' · +1血' : '';
  const displayAction = `${flightPhrase}${statusSuffix}`;
  game.flightLastPhrase = flightPhrase;
  game.flightLastAction = displayAction;
  game.flightLastPoints = points;
  game.flightLastColor = color;
  const praise = action.includes('翻转')
    ? '惊艳'
    : action.includes('冲刺')
      ? '超燃'
      : action.includes('躲避') || action.includes('闪避')
        ? '好险'
        : '漂亮';
  shipCallout(praise, color);
  showFlightFeed(displayAction, points, color);
  ringEffect(player.x, player.y, color, 58 + Math.min(32, game.flightChain * 5), 0.34);
  burst(player.x, player.y + 12, color, 8 + Math.min(10, game.flightChain), 125);
  ui.flightQuality.classList.remove('pulse', 'grade-up');
  void ui.flightQuality.offsetWidth;
  ui.flightQuality.classList.add(previousGrade === grade.id ? 'pulse' : 'grade-up');
  sfx.tone(previousGrade === grade.id ? 690 : 820, 0.13, 'sine', 0.03, 140);
  updateUI();
}

function triggerFlightFlip(direction) {
  if (game.state !== 'playing' || !direction || game.flightFlipCooldown > 0) return false;
  game.flightFlipCooldown = peripheralDodgeCooldown(0.6, game.peripheralSnapshot);
  game.flightFlipTime = 0.72;
  game.flightFlipDirection = direction;
  game.flightQueuedFlipDirection = 0;
  game.flightFlipQueueTime = 0;
  game.flightBoost = Math.max(game.flightBoost, 0.5);
  awardFlightQuality('空中翻转', 860, 0x5ec8ff);
  sfx.dodge();
  return true;
}

function requestFlightFlip(direction) {
  if (game.state !== 'playing' || !direction) return false;
  if (game.flightFlipTime > 0.1 && direction === game.flightFlipDirection) return false;
  if (game.flightFlipCooldown <= 0 && game.flightFlipTime <= 0.1) {
    return triggerFlightFlip(direction);
  }
  if (
    game.flightQueuedFlipDirection !== direction
    || game.flightFlipQueueTime < 0.8
  ) {
    game.flightQueuedFlipDirection = direction;
    game.flightFlipQueueTime = 1.55;
  }
  return false;
}

function registerFlipDodge() {
  if (game.elapsed - game.lastFlipDodgeAt < 0.42) return;
  game.lastFlipDodgeAt = game.elapsed;
  awardFlightQuality('翻滚闪避', 320, COLORS.blue);
  ringEffect(player.x, player.y, COLORS.blue, 46, 0.28);
  sfx.dodge();
}

function registerNearMiss() {
  if (game.state !== 'playing' || game.elapsed - game.lastGrazeAt < 0.7) return;
  game.lastGrazeAt = game.elapsed;
  game.grazeCount += 1;
  const before = game.hp;
  game.hp = Math.min(runStats.maxHp, game.hp + 1);
  const healed = game.hp > before;
  const labels = ['惊险躲避', '漂亮切线', '极限闪避'];
  awardFlightQuality(`${labels[(game.grazeCount - 1) % labels.length]}${healed ? ' · +1血' : ''}`, 380 + Math.min(220, game.grazeCount * 20), 0x8dffae);
  sfx.dodge();
}

function projectBulletTrailPoint(b, x = b.x, y = b.y) {
  return projectWorldPoint(x, y);
}

function projectileTrail(b) {
  if (!reserveFxParticles('trail')) return;
  const color = b.style === 'blue' || b.style === 'frost'
    ? COLORS.blue
    : b.style === 'sword'
      ? 0xd8f4ff
      : b.style === 'execute'
        ? 0xff4fa3
      : b.style === 'tether'
        ? 0x65ffb5
        : b.style === 'cluster'
          ? 0xff704d
    : b.style === 'missile' || b.style === 'ricochet'
      ? COLORS.amber
      : b.style === 'prism'
        ? 0xa88cff
        : b.style === 'red'
          ? COLORS.red
          : COLORS.white;
  const isJudgementSword = b.style === 'execute';
  const isWhiteLance = b.style === 'white';
  const view = isJudgementSword
    ? new Graphics()
      .roundRect(-3, 0, 6, 42, 3).fill({ color: 0xffd5ee, alpha: 0.34 })
      .roundRect(-8, 5, 16, 31, 7).fill({ color: 0xff4fa3, alpha: 0.12 })
      .circle(0, 4, 11).fill({ color: 0xfff5fb, alpha: 0.18 })
    : isWhiteLance
      ? new Graphics()
        .roundRect(-2.2, 0, 4.4, 38, 2.2).fill({ color: 0xffffff, alpha: 0.42 })
        .roundRect(-5.5, 4, 11, 46, 5.5).fill({ color: 0x55dfff, alpha: 0.12 })
      : new Graphics().circle(0, 0, b.style === 'missile' ? 4 : 2.5).fill({ color, alpha: 0.34 });
  const point = projectBulletTrailPoint(b);
  const previous = projectBulletTrailPoint(b, b.x - b.vx * 0.045, b.y - b.vy * 0.045);
  view.position.set(point.x, point.y);
  // Projectile heads own the actual bloom. Trail sprites remain additive so
  // dense barrages stay luminous without duplicating every transient mesh in
  // the expensive blur pass.
  view.bloom = false;
  view.additive = true;
  view.scale.set(b.view.scale.x * point.unitScale * WORLD_UNIT_SCALE);
  view.rotation = Math.atan2(point.y - previous.y, point.x - previous.x) + Math.PI / 2;
  fxLayer.addChild(view);
  particles.push({
    view, x: point.x, y: point.y, vx: 0, vy: 0,
    life: isJudgementSword ? 0.3 : 0.2, maxLife: isJudgementSword ? 0.3 : 0.2, spin: 0, fade: true, screenSpaceGeometry: true,
  });
}

function nearestDamageTarget(x, y, excluded, maxDistance = 140) {
  const excludedTargets = excluded instanceof Set ? excluded : new Set(excluded ? [excluded] : []);
  let nearest = null;
  let best = maxDistance * maxDistance;
  for (const enemy of enemies) {
    if (enemy.dead || excludedTargets.has(enemy)) continue;
    const distance = (enemy.x - x) ** 2 + (enemy.y - y) ** 2;
    if (distance < best) { best = distance; nearest = enemy; }
  }
  if (boss && !boss.dead && !excludedTargets.has(boss)) {
    const distance = (boss.x - x) ** 2 + (boss.y - y) ** 2;
    if (distance < best) { best = distance; nearest = boss; }
  }
  return nearest;
}

function isActiveDamageTarget(target) {
  if (!target || target.dead || target.view?.destroyed) return false;
  if (target === boss) return boss === target && !boss.dead;
  return enemies.includes(target);
}

function continueSwordAttacks(b) {
  b.swordAttacksRemaining -= 1;
  if (b.swordAttacksRemaining <= 0) return true;

  let nextTarget = nearestDamageTarget(b.x, b.y, b.hitTargets, 1200);
  // Once every live target has been struck, allow the sword to begin a new
  // pass. The short re-arm window keeps it from repeatedly hitting while its
  // sprite is still overlapping the same enemy.
  if (!nextTarget) {
    b.hitTargets.clear();
    nextTarget = nearestDamageTarget(b.x, b.y, null, 1200);
  }
  if (!nextTarget) return true;

  b.target = nextTarget;
  b.homing = false;
  b.pendingHoming = true;
  b.swordDelay = 0;
  b.swordRearmAt = game.elapsed + 0.075;
  return false;
}

function damageTargetsInRange(x, y, maxDistance = 900) {
  const maxDistanceSq = maxDistance * maxDistance;
  const targets = enemies.filter((enemy) => (
    !enemy.dead && (enemy.x - x) ** 2 + (enemy.y - y) ** 2 <= maxDistanceSq
  ));
  if (boss && !boss.dead && (boss.x - x) ** 2 + (boss.y - y) ** 2 <= maxDistanceSq) targets.push(boss);
  return targets.sort((a, b) => (
    (a.x - x) ** 2 + (a.y - y) ** 2 - ((b.x - x) ** 2 + (b.y - y) ** 2)
  ));
}

function arcEffect(from, to) {
  const projectedFrom = projectWorldPoint(from.x, from.y);
  const projectedTo = projectWorldPoint(to.x, to.y);
  const view = new Graphics()
    .moveTo(projectedFrom.x, projectedFrom.y)
    .lineTo(
      projectedFrom.x + (projectedTo.x - projectedFrom.x) * 0.34 + (Math.random() - 0.5) * 28,
      projectedFrom.y + (projectedTo.y - projectedFrom.y) * 0.42,
    )
    .lineTo(
      projectedFrom.x + (projectedTo.x - projectedFrom.x) * 0.68 + (Math.random() - 0.5) * 28,
      projectedFrom.y + (projectedTo.y - projectedFrom.y) * 0.64,
    )
    .lineTo(projectedTo.x, projectedTo.y)
    .stroke({ color: 0xcba7ff, width: 3, alpha: 0.92 });
  fxLayer.addChild(view);
  particles.push({
    view, x: 0, y: 0, vx: 0, vy: 0, life: 0.13, maxLife: 0.13, spin: 0, fade: true, screenSpaceGeometry: true,
  });
}

function damageBoss(amount, hitX, hitY, heavyHit = false, impactStyle = '', presentation = null) {
  if (!boss || boss.dead) return;
  // Bosses still reward burst windows, but a stacked multi-hit build cannot
  // erase an entire phase before its moves become readable.
  const timeSinceLastHit = game.elapsed - boss.lastDamageAt;
  boss.burstHits = timeSinceLastHit > 0.42 ? 0 : boss.burstHits;
  boss.burstHits += 1;
  boss.lastDamageAt = game.elapsed;
  const sustainedHits = Math.max(0, boss.burstHits - 5);
  const burstFalloff = Math.max(0.58, 1 - sustainedHits * 0.08);
  const singleHitCap = boss.maxHp * 0.018;
  const resolvedDamage = Math.min(Math.max(0, amount) * burstFalloff, singleHitCap);
  sfx.enemyHit(boss, hitX, hitY, impactStyle);
  boss.hp -= resolvedDamage;
  triggerHitReaction(boss, heavyHit, presentation);
  if (Math.random() > 0.7 && !presentation?.hit) burst(hitX, hitY, COLORS.amber, 2, 45);
  if (boss.hp <= 0) killBoss();
  updateUI();
}

function damageEnemy(enemy, amount, hitX, hitY, heavyHit = false, impactStyle = '', presentation = null) {
  if (enemy.dead) return;
  sfx.enemyHit(enemy, hitX, hitY, impactStyle);
  enemy.hp -= amount;
  triggerHitReaction(enemy, heavyHit, presentation);
  if (Math.random() > 0.6 && !presentation?.hit) burst(hitX, hitY, COLORS.amber, 2, 45);
  if (enemy.hp <= 0) killEnemy(enemy, presentation);
}

function targetVulnerabilityMultiplier(target) {
  return target.vulnerabilityTime > 0 ? 1 + Math.max(0, target.vulnerability || 0) : 1;
}

function redHuntMarkEffect(target, stacks) {
  const radius = Math.max(18, (target.radius || 16) * 0.8);
  const view = new Graphics()
    .circle(0, 0, radius).stroke({ color: COLORS.red, width: 2.5, alpha: 0.86 })
    .moveTo(-radius - 7, 0).lineTo(-radius + 2, 0).stroke({ color: COLORS.white, width: 2, alpha: 0.88 })
    .moveTo(radius - 2, 0).lineTo(radius + 7, 0).stroke({ color: COLORS.white, width: 2, alpha: 0.88 })
    .poly([0, -radius - 5, 5, -radius + 2, -5, -radius + 2]).fill({ color: stacks >= 3 ? COLORS.amber : COLORS.red, alpha: 0.95 });
  view.position.set(target.x, target.y);
  fxLayer.addChild(view);
  particles.push({
    view,
    x: target.x,
    y: target.y,
    vx: 0,
    vy: 0,
    life: stacks >= 3 ? 0.34 : 0.22,
    maxLife: stacks >= 3 ? 0.34 : 0.22,
    spin: stacks >= 3 ? 5 : -3,
    fade: true,
  });
}

function ensureRedHuntMarker(target) {
  if (!target.redHuntMarkView) {
    const radius = Math.max(20, (target.radius || 16) * 0.92);
    target.redHuntMarkView = new Graphics()
      .circle(0, 0, radius).stroke({ color: COLORS.red, width: 2.2, alpha: 0.64 })
      .moveTo(-radius - 7, 0).lineTo(-radius + 4, 0).stroke({ color: COLORS.red, width: 3, alpha: 0.9 })
      .moveTo(radius - 4, 0).lineTo(radius + 7, 0).stroke({ color: COLORS.red, width: 3, alpha: 0.9 })
      .moveTo(0, -radius - 7).lineTo(0, -radius + 4).stroke({ color: COLORS.white, width: 2, alpha: 0.74 })
      .moveTo(0, radius - 4).lineTo(0, radius + 7).stroke({ color: COLORS.white, width: 2, alpha: 0.74 });
    target.view.addChild(target.redHuntMarkView);
  }
  target.redHuntMarkView.visible = true;
}

function updateRedHuntMarker(target, dt) {
  if (!target.redHuntMarkView) return;
  if ((target.redHuntMarkUntil || 0) <= game.elapsed) {
    target.redHuntMarkUntil = 0;
    target.redHuntMarkPower = 0;
    target.redHuntMarkStacks = 0;
    target.redHuntMarkView.visible = false;
    return;
  }
  target.redHuntMarkView.visible = true;
  target.redHuntMarkView.rotation += dt * 1.8;
  const pulse = 1 + Math.sin(game.elapsed * 9) * 0.055;
  target.redHuntMarkView.scale.set(pulse);
  target.redHuntMarkView.alpha = 0.72 + Math.sin(game.elapsed * 12) * 0.18;
}

function prepareRedUltimateMark(target, bullet) {
  if ((target.redHuntMarkUntil || 0) < game.elapsed) {
    target.redHuntMarkPower = 0;
    target.redHuntMarkStacks = 0;
  }
  target.redHuntMarkUntil = game.elapsed + 4.5;
  target.redHuntMarkPower = Math.max(target.redHuntMarkPower || 0, bullet.damage);
  target.redHuntMarkStacks = (target.redHuntMarkStacks || 0) + 1;
  const pulseReady = target.redHuntMarkStacks >= 3;
  if (pulseReady) target.redHuntMarkStacks = 0;
  ensureRedHuntMarker(target);
  redHuntMarkEffect(target, pulseReady ? 3 : target.redHuntMarkStacks);
  return pulseReady;
}

function detonateRedUltimateMark(source, power, radius, includeSource = false) {
  if (!source) return;
  ringEffect(source.x, source.y, COLORS.red, radius, 0.34);
  burst(source.x, source.y, COLORS.red, radius >= 100 ? 14 : 10, 170);
  game.shake = Math.max(game.shake, radius >= 100 ? 9 : 5);
  for (const target of damageTargetsInRange(source.x, source.y, radius)) {
    if (target === source && !includeSource) continue;
    const falloff = target === source ? 0.58 : 0.72;
    const damage = power * falloff * targetVulnerabilityMultiplier(target);
    if (target === boss) damageBoss(damage * runStats.bossDamageMultiplier * 0.62, target.x, target.y, true);
    else damageEnemy(target, damage, target.x, target.y, true);
  }
}

function applyProjectileBuff(target, bullet) {
  if (bullet.vulnerability > 0) {
    target.vulnerability = Math.max(target.vulnerability || 0, bullet.vulnerability);
    target.vulnerabilityTime = Math.max(target.vulnerabilityTime || 0, bullet.vulnerabilityDuration);
  }
  if (bullet.stunChance > 0 && Math.random() < bullet.stunChance) {
    const bossScale = target === boss ? 0.42 : 1;
    target.stunTime = Math.max(target.stunTime || 0, bullet.stunDuration * bossScale);
    ringEffect(target.x, target.y, bullet.effectPath === 'tether' ? 0x65ffb5 : 0xb899ff, Math.max(28, (target.radius || 16) * 1.35), 0.2);
  }
  if (bullet.knockback > 0) {
    if (target === boss) {
      target.hitPunchStrength = Math.max(target.hitPunchStrength || 0, Math.min(0.11, bullet.knockback * 0.001));
    } else {
      target.y -= bullet.knockback;
    }
  }
}

function resolvePlayerHit(target, bullet, hitX, hitY) {
  const critical = Math.random() < bullet.critChance;
  const redUltimatePulse = bullet.redUltimate
    ? prepareRedUltimateMark(target, bullet)
    : false;
  let executeMultiplier = 1;
  if (runStats.executeChance > 0) {
    runStats.executeCounter += 1;
    const pity = runStats.executePityEvery > 0 && runStats.executeCounter >= runStats.executePityEvery;
    if (pity || Math.random() < runStats.executeChance) {
      const available = [2, 4, 8, 16].filter((value) => value <= Math.max(2, runStats.executeMultiplier));
      executeMultiplier = available[Math.floor(Math.random() * available.length)] || 2;
      runStats.executeCounter = 0;
    }
  }
  const bossExecuteMultiplier = target === boss ? Math.min(4, executeMultiplier) : executeMultiplier;
  const damage = bullet.damage
    * (critical ? bullet.critMultiplier : 1)
    * bossExecuteMultiplier
    * (target === boss ? bullet.bossDamageMultiplier : 1)
    * (target !== boss && target.elite ? (bullet.eliteDamageMultiplier || 1) : 1)
    * targetVulnerabilityMultiplier(target);
  const execution = executeMultiplier > 1;
  const bulletColor = bullet.style === 'blue' || bullet.style === 'frost'
    ? COLORS.blue
    : bullet.style === 'sword'
      ? 0xd8f4ff
      : bullet.style === 'execute'
        ? 0xff4fa3
      : bullet.style === 'tether'
        ? 0x65ffb5
        : bullet.style === 'cluster'
          ? 0xff704d
    : bullet.style === 'prism'
      ? 0xa88cff
      : bullet.style === 'ricochet'
        ? COLORS.amber
        : bullet.style === 'red'
          ? COLORS.red
          : COLORS.white;
  hitSpark(hitX, hitY, execution ? COLORS.amber : bulletColor, critical || execution);
  damageNumber(hitX, hitY, damage, critical, executeMultiplier);
  if (bullet.style === 'execute') {
    ringEffect(hitX, hitY, 0xff4fa3, 32, 0.2);
    burst(hitX, hitY, 0xffc9e8, 4, 78);
  }
  if (critical) burst(hitX, hitY, COLORS.white, 5, 75);
  if (execution) {
    burst(hitX, hitY, COLORS.amber, 7 + executeMultiplier, 105);
    ringEffect(hitX, hitY, COLORS.amber, 34 + executeMultiplier * 2, 0.22);
    if (executeMultiplier >= 8) showToast(`量子裁决 · ${executeMultiplier}×`);
  }
  if (bullet.burnDps > 0) {
    target.burnTime = Math.max(target.burnTime || 0, bullet.burnDuration);
    target.burnDps = Math.max(target.burnDps || 0, bullet.burnDps);
  }
  if (bullet.frostChance > 0 && Math.random() < bullet.frostChance) {
    target.frostTime = Math.max(target.frostTime || 0, bullet.frostDuration);
    ringEffect(target.x, target.y, COLORS.blue, Math.max(28, (target.radius || 16) * 1.45), 0.24);
  }
  applyProjectileBuff(target, bullet);
  const heavyHit = critical || execution || bullet.explosionRadius > 0;
  if (target === boss) damageBoss(damage, hitX, hitY, heavyHit, bullet.style);
  else damageEnemy(target, damage, hitX, hitY, heavyHit, bullet.style);
  if (redUltimatePulse && !target.dead) {
    detonateRedUltimateMark(target, bullet.damage * 2, 78, true);
  }

  if (bullet.chainChance > 0 && Math.random() < bullet.chainChance) {
    const visited = new Set([target]);
    let from = target;
    for (let jump = 0; jump < Math.max(1, bullet.chainJumps); jump += 1) {
      const chained = nearestDamageTarget(from.x, from.y, visited, 175 + jump * 8);
      if (!chained) break;
      visited.add(chained);
      arcEffect(from, chained);
      const chainDamage = bullet.damage * bullet.chainDamage * Math.pow(0.88, jump) * targetVulnerabilityMultiplier(chained);
      if (chained === boss) damageBoss(chainDamage * bullet.bossDamageMultiplier, chained.x, chained.y);
      else damageEnemy(chained, chainDamage, chained.x, chained.y);
      applyProjectileBuff(chained, bullet);
      from = chained;
    }
  }
}

function detachEnemyVisual(enemy) {
  if(enemy.model?.libraryEnemy)enemy.model.destroy({children:true});
  enemy.view.removeFromParent();
}

function killEnemy(enemy, presentation = null) {
  if (enemy.dead) return;
  enemy.dead = true;
  cancelTelegraphsFrom(enemy);
  enemy.attackPending = false;
  enemy.shotBurst = null;
  const redDetonationPower = enemy.redHuntMarkUntil > game.elapsed
    ? Math.max(1, enemy.redHuntMarkPower || runStats.redDamage * combatPowerMultiplier())
    : 0;
  enemy.redHuntMarkUntil = 0;
  enemy.redHuntMarkPower = 0;
  enemy.redHuntMarkStacks = 0;
  if (enemy.redHuntMarkView) enemy.redHuntMarkView.visible = false;
  const big = enemy.kind === 'heavy';
  const reducedDeathMotion = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  combatVfx.enemyExplosion(enemy.x, enemy.y, 1, reducedDeathMotion,
    { tier: enemy.elite ? 'elite' : big ? 'heavy' : 'regular', chapter: game.stageIndex,
      vx:enemy.model?.flightVelocity?.x||0,vy:enemy.model?.flightVelocity?.y||0 });
  sfx.enemyDeath(enemy);
  if (!reducedDeathMotion) game.shake = Math.max(game.shake, enemy.elite ? 5 : big ? 2 : 0);
  game.score += enemy.score * Math.max(1, Math.min(5, Math.floor(game.combo / 5) + 1));
  game.kills += 1;
  game.combo += 1;
  game.comboTimer = 2.1;
  spawnXpOrb(enemy.x, enemy.y, enemy.xpValue);
  if (enemy.elite && game.fixedPartsMode) {
    spawnPickup(enemy.x, enemy.y, 'battle-supply');
    showToast('精英补给已掉落 · 接取形态强化');
  }
  const rechargedActives = [];
  for (const weapon of game.activeWeapons) {
    const active = weapon.active;
    if (!active || weapon.charges >= active.maxCharges) continue;
    weapon.killCounter += 1;
    if (weapon.killCounter < active.rechargeKills) continue;
    weapon.killCounter = 0;
    weapon.charges = Math.min(active.maxCharges, weapon.charges + 1);
    rechargedActives.push(active.name);
  }
  if (rechargedActives.length) {
    showToast(`${rechargedActives.slice(0, 2).join(' / ')} · 充能恢复`);
  }
  if (game.hp < runStats.maxHp) {
    game.healDropCounter += 1;
    const baseHealChance = enemy.elite ? 0.28 : enemy.kind === 'heavy' ? 0.18 : enemy.kind === 'turret' ? 0.08 : enemy.kind === 'dart' ? 0.035 : 0.015;
    const healChance = Math.min(.8, baseHealChance * (game.stageIndex === 0 ? 1.4 : 1) * (1 + (game.peripheralSnapshot?.stats.researchModifiers?.repairDropBonus || 0)));
    if (Math.random() < healChance || game.healDropCounter >= (game.stageIndex === 0 ? 18 : 22)) {
      game.healDropCounter = 0;
      spawnPickup(enemy.x, enemy.y, 'heal');
    }
  }
  if (redDetonationPower > 0) {
    detonateRedUltimateMark(enemy, redDetonationPower * 6.2, 112, false);
  }
  retireLibraryEnemy(enemy,enemyLayer,reducedDeathMotion);
  detachEnemyVisual(enemy);
  if (runStats.killBlastRadius > 0 && skillActive('blast')) {
    ringEffect(enemy.x, enemy.y, COLORS.red, runStats.killBlastRadius, 0.35);
    for (const other of enemies) {
      if (other.dead || other === enemy) continue;
      if ((other.x - enemy.x) ** 2 + (other.y - enemy.y) ** 2 <= runStats.killBlastRadius ** 2) {
        damageEnemy(other, runStats.killBlastDamage * combatPowerMultiplier(), other.x, other.y);
      }
    }
  }
  updateUI();
}

function killBoss() {
  if (!boss || boss.dead) return;
  const defeatedBoss = boss;
  defeatedBoss.dead = true;
  defeatedBoss.hp = 0;
  defeatedBoss.attackPending=false;defeatedBoss.shotBurst=null;
  cancelTelegraphsFrom(defeatedBoss);
  for(const beam of hostileBeams)beam.view.removeFromParent();
  hostileBeams.length=0;
  game.stageBossesDefeated = 1;
  game.score += 8000 + game.stageIndex * 2200;
  game.state = 'victory_cinematic';
  sfx.syncMusic();
  sfx.stopCombatLoops();
  game.victoryReveal = false;
  sdkGameplayStop();
  game.victory = true;
  enemyBullets.forEach((bullet) => hostilePool.release(bullet));
  enemyBullets.length = 0;
  ui.bossBar.style.width = '0%';
  ui.bossPercent.textContent = '已摧毁';
  ui.bossName.textContent = `${defeatedBoss.config.name} · 已击破`;
  ui.victoryEyebrow.textContent = '旗舰核心摧毁';
  ui.victoryTitle.textContent = '旗舰击破';
  ui.victoryStatus.textContent = '正在确认战区肃清状态';
  ui.victorySequence.classList.remove('visible', 'complete');
  game.victoryTimers = [];
  const schedule = (callback, delay) => {
    const timer = window.setTimeout(callback, delay);
    game.victoryTimers.push(timer);
  };
  const reducedDeathMotion = !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(!reducedDeathMotion)defeatedBoss.model?.beginDeath?.(1.35);
  const eruptionCount = reducedDeathMotion ? 2 : 6;
  // Break the outer hull first, then work inward toward the final core burst.
  const rupturePoints=[[-.8,-.3],[.75,.25],[-.55,.5],[.5,-.4],[-.2,0],[.15,.1]];
  for (let i = 0; i < eruptionCount; i += 1) {
    schedule(() => {
      const [dx,dy]=rupturePoints[i];
      combatVfx.enemyExplosion(defeatedBoss.x + dx*defeatedBoss.radius,
        defeatedBoss.y + dy*defeatedBoss.radius, 1, reducedDeathMotion,
        { tier: 'rupture', chapter: game.stageIndex });
      sfx.explode(true);
      if (!reducedDeathMotion) {
        game.shake = 5 + i * .4;
      }
      defeatedBoss.view.alpha = 1 - i / eruptionCount * .35;
    }, i * (reducedDeathMotion ? 500 : 200));
  }
  schedule(() => {
    defeatedBoss.view.visible = false;
    combatVfx.enemyExplosion(defeatedBoss.x, defeatedBoss.y, 1.15, reducedDeathMotion,
      { tier: 'boss', chapter: game.stageIndex });
    sfx.bossDeathFinal();
    game.flash = reducedDeathMotion ? 0 : .12;
    game.shake = reducedDeathMotion ? 0 : 14;
    if (!reducedDeathMotion) {
      game.victoryDeparture = createVictoryDeparture(player, drones, game.fixedCombat?.energyVisuals() || [], W, H);
      // End firing visuals before departure; gameplay was already stopped above.
      for (const bullet of playerBullets) friendlyPool.release(bullet);
      playerBullets.length = 0;
    }
  }, 1350);
  schedule(() => {
    game.victoryReveal = true;
    ui.victorySequence.classList.add('visible', 'complete');
    ui.victoryEyebrow.textContent = '任务完成';
    ui.victoryTitle.textContent = '战区肃清';
    ui.victoryStatus.textContent = `${defeatedBoss.config.name}旗舰已确认摧毁`;
  }, 2050);
  schedule(() => showVictorySettlement(defeatedBoss.config), 3450);
}

function showVictorySettlement(config) {
  game.state = 'victory_result';
  sdkGameplayStop();
  ui.victorySequence.classList.remove('visible', 'complete');
  ui.bossWrap.classList.remove('visible');
  const completion = recordRunVictory(config);
  const mode = DIFFICULTY_MAP.get(completion.difficultyId) || DIFFICULTIES[0];
  ui.resultTitle.textContent = `${config.name} · ${mode.label}肃清`;
  ui.resultSubtitle.textContent = `${config.title} · 旗舰核心已彻底摧毁`;
  ui.resultTime.textContent = formatTime(game.elapsed);
  ui.resultKills.textContent = String(game.kills).padStart(3, '0');
  ui.resultLevel.textContent = `等级${game.level}`;
  ui.resultScore.textContent = String(Math.floor(game.score)).padStart(6, '0');
  ui.resultStars.textContent = `${completion.stars}星 / 3星`;
  const rewardParts = [];
  if (completion.earned.coins) rewardParts.push(`金币 +${completion.earned.coins}`);
  if (completion.earned.diamonds) rewardParts.push(`钻石 +${completion.earned.diamonds}`);
  for (const reward of completion.peripheralRewards || []) {
    if (reward.type === 'weapon') rewardParts.push(`首通武器：${reward.name}`);
    else if (reward.amount > 0) rewardParts.push(`${reward.name} +${reward.amount}`);
  }
  if (completion.unlockedModules?.length) {
    rewardParts.push(`新装备：${completion.unlockedModules.map((module) => module.shortName).join('、')}`);
  }
  if (completion.unlockedSkillPath) {
    rewardParts.push(`技能池：${ROUTE_MAP.get(completion.unlockedSkillPath)?.name || completion.unlockedSkillPath}`);
  }
  ui.resultReward.textContent = completion.debugRun
    ? '调试试玩 · 不写入关卡、货币与装备进度'
    : rewardParts.length
    ? `${rewardParts.join(' · ')}${completion.stars === 3 ? ' · 三星达成' : ''}`
    : `历史最佳 ${completion.bestStars} 星 · 累计奖励请在星级奖励中领取`;
  ui.resultOverlay.classList.add('visible');
  if (!completion.debugRun) submitRunScore(true);
}

function showDefeatSettlement() {
  if (game.state !== 'dying') return;
  game.state = 'defeat_result';
  sfx.syncMusic();
  sfx.stopCombatLoops();
  sdkGameplayStop();
  ui.deathSequence.classList.remove('visible', 'detonate');
  const materialReward = game.peripheralSnapshot && !game.debugRun
    ? sortieMaterialReward(game.stageIndex, false)
    : null;
  const sortieReceipt = game.peripheralSnapshot ? peripheralSystem?.recordSortie({
    runId: game.peripheralSnapshot.id, won: false,
    stageIndex: game.stageIndex, debugRun: game.debugRun,
  }) : null;
  game.defeatReward = sortieReceipt?.ok ? materialReward : null;
  const stage = CAMPAIGN[Math.min(game.stageIndex, CAMPAIGN.length - 1)];
  const mode = DIFFICULTY_MAP.get(game.difficultyId) || DIFFICULTIES[0];
  ui.resultTitle.textContent = `${stage.name} · ${mode.label}失守`;
  ui.resultSubtitle.textContent = game.lastDamageSummary || '作战信号中断';
  ui.resultTime.textContent = formatTime(game.elapsed);
  ui.resultKills.textContent = String(game.kills).padStart(3, '0');
  ui.resultLevel.textContent = `等级${game.level}`;
  ui.resultScore.textContent = String(Math.floor(game.score)).padStart(6, '0');
  ui.resultStars.textContent = '未通关';
  ui.resultReward.textContent = game.defeatReward
    ? `出击补给 · 机体碎片 +${game.defeatReward.aircraftShards} · 武器零件 +${game.defeatReward.weaponParts}`
    : '本局未获得通关奖励';
  ui.resultOverlay.classList.add('visible');
  if (!game.debugRun) submitRunScore(false);
}

function clearCombatField() {
  clearEnemyRemains();
  for (const enemy of enemies) detachEnemyVisual(enemy);
  enemies.length = 0;
  enemyBullets.forEach((bullet) => hostilePool.release(bullet));
  enemyBullets.length = 0;
}

function showStageBanner(config = CAMPAIGN[game.stageIndex]) {
  const mode = DIFFICULTY_MAP.get(game.difficultyId) || DIFFICULTIES[0];
  ui.stageBannerArc.textContent = `${mode.label}模式 · ${config.arc} · ${stageLabel(game.stageIndex)}`;
  ui.stageBannerName.textContent = config.name;
  ui.stageBannerTitle.textContent = config.title;
  ui.stageBanner.classList.add('visible');
  window.clearTimeout(showStageBanner.timer);
  showStageBanner.timer = window.setTimeout(() => ui.stageBanner.classList.remove('visible'), 2200);
}

function sealSkillForBoss(config) {
  game.sealedSkillId = null;
  if (!config.purge) return;
  const sealable = ['power', 'rapid', 'multishot', 'pierce', 'burn', 'frost', 'lightning', 'blast', 'drone', 'missile', 'shield'];
  const candidates = sealable
    .filter((id) => (game.skills[id] || 0) > 0)
    .sort((a, b) => (game.skills[b] || 0) - (game.skills[a] || 0));
  if (!candidates.length) return;
  const top = candidates.slice(0, Math.min(candidates.length, 2 + config.purge));
  game.sealedSkillId = top[Math.floor(Math.random() * top.length)];
  syncDrones();
  updateCombatSkillDock();
  const skill = SKILL_MAP.get(game.sealedSkillId);
  showToast(`${config.name}·技能清缴：${skill.name}已封印`);
}

function collectPickup(pickup) {
  if (pickup.dead) return;
  if (pickup.type === 'battle-supply' && game.fixedGrowth?.state.offer) return;
  pickup.dead = true;
  if (pickup.type === 'battle-supply') {
    const offer = game.fixedGrowth && planBattleSupply(game.fixedGrowth);
    if (!offer) { pickup.view.removeFromParent(); return; }
    game.battleSupply = { ...offer, chestId: pickup.chestId, phase: 'idle', pickupView:pickup.view, pickupAt:performance.now(), pickupX:pickup.x, pickupY:pickup.y };
    game.state = 'battle-supply';
    resetRelativeDrag();
    sdkGameplayStop();
    sfx.pickup();
    pixiCombatUi?.render();
    return;
  }
  if (pickup.type === 'heal') {
    const research = game.peripheralSnapshot?.stats.researchModifiers || {};
    const heal = Math.round((25 + (research.pickupHealFlat || 0)) * (1 + (research.pickupHealBonus || 0) + (game.peripheralSnapshot?.stats.gearModifiers?.pickupHealBonus || 0)) * (runStats.healingMultiplier || 1));
    const beforeHp = game.hp;
    game.hp = Math.min(runStats.maxHp, game.hp + heal);
    const received = healingReceived(beforeHp,game.hp);
    pickup.view.removeFromParent();
    ringEffect(player.x, player.y, 0x66f59d, 92, 0.48);
    burst(player.x, player.y, 0x66f59d, 18, 145);
    showToast(received>0?`维修 +${received} · ${Math.ceil(game.hp)}/${runStats.maxHp}`:'耐久已满');
    if(received>0)shipCallout(`+${received}`,0x66f59d);
    sfx.pickup();
    updateUI();
    return;
  }
  game.weaponLevels[pickup.type] = Math.min(6, game.weaponLevels[pickup.type] + 1);
  pickup.view.removeFromParent();
  ringEffect(player.x, player.y, pickup.type === 'red' ? COLORS.red : COLORS.blue, 80, 0.5);
  showToast(`${pickup.type === 'red' ? '火神炮' : '脉冲激光'} 已强化 · ${game.weaponLevels[pickup.type]}级`);
  sfx.pickup();
  updateUI();
}

function switchWeapon(type, feedback = true) {
  const changed = game.weapon !== 'white';
  game.weapon = 'white';
  const weaponColor = COLORS.white;
  player.weaponCore.clear()
    .roundRect(-2, -39, 4, 14, 2).fill({ color: weaponColor })
    .circle(0, 4, 4).fill({ color: weaponColor, alpha: 0.9 });
  player.glow.tint = weaponColor;
  player.fireTimer = Math.min(player.fireTimer, 0.04);
  if (feedback && changed) {
    ringEffect(player.x, player.y, COLORS.white, 72, 0.28);
    showToast('基础白弹');
    sfx.tone(360, 0.1, 'sine', 0.035, 180);
  }
  updateUI();
}

function clearHostileBulletsNear(x, y, radius) {
  const radiusSq = radius * radius;
  let cleared = 0;
  for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
    const bullet = enemyBullets[i];
    if ((bullet.x - x) ** 2 + (bullet.y - y) ** 2 > radiusSq) continue;
    hostilePool.release(bullet);
    enemyBullets.splice(i, 1);
    cleared += 1;
  }
  return cleared;
}

function beginDodgeTutorial() {
  if (!isDodgeTutorialRunEligible({
    stageIndex: game.stageIndex,
    difficultyId: game.difficultyId,
    prompted: game.dodgeTutorialPrompted,
  })) return false;
  game.dodgeTutorialPrompted = true;
  game.state = 'dodge-tutorial';
  sdkGameplayStop();
  game.pointerActive = false;
  resetRelativeDrag();
  sfx.flameLoop(false);
  navigator.vibrate?.([35, 40, 35]);
  return true;
}

function completeDodgeTutorial(direction = 1) {
  if (game.state !== 'dodge-tutorial') return false;
  const dodgeDirection = Math.sign(Number(direction) || 1) || 1;
  game.flightHasSteered = true;
  game.flightLastCommandX = player.x;
  game.targetX = Math.max(32, Math.min(W - 32, player.x + dodgeDirection * 210));
  game.targetY = player.y;
  game.flightLastInputDirection = dodgeDirection;
  game.flightFlipArmed = true;
  requestFlightFlip(dodgeDirection);
  player.invincible = Math.max(player.invincible, 0.9);
  game.state = 'playing';
  sdkGameplayStart();
  shipCallout('漂亮闪避！', COLORS.amber);
  sfx.dodge();
  updateUI();
  return true;
}

function beginRevivePrompt() {
  if (!game.reviveAvailable) return false;
  game.state = 'revive-prompt';
  sdkGameplayStop();
  game.reviveCountdown = 10;
  game.reviveDeadline = performance.now() + 10000;
  game.reviveAdPending = false;
  player.invincible = 99;
  game.shake = 8;
  game.flash = 0.2;
  ui.reviveCountdown.textContent = '10';
  ui.reviveOverlay.style.setProperty('--revive-progress', '360deg');
  ui.reviveOverlay.classList.add('visible');
  ringEffect(player.x, player.y, COLORS.red, 135, 0.65);
  sfx.tone(180, 0.32, 'sawtooth', 0.05, -80);
  navigator.vibrate?.([90, 50, 90]);
  updateUI();
  return true;
}

function acceptRevive() {
  if (game.state !== 'revive-prompt') return;
  game.revivesUsed += 1;
  game.reviveAvailable = false;
  game.reviveCountdown = 0;
  game.reviveDeadline = 0;
  game.state = 'dying';
  game.deathElapsed = 0;
  game.deathOriginX = player.x;
  game.deathOriginY = player.y;
  ui.reviveOverlay.classList.remove('visible');
  ui.deathTitle.textContent = '紧急重构';
  ui.deathStatus.textContent = '机体恢复 50%';
  ui.deathSequence.classList.remove('detonate');
  ui.deathSequence.classList.add('visible');
  enemyBullets.forEach((bullet) => hostilePool.release(bullet));
  enemyBullets.length = 0;
  impactExplosion(player.x, player.y, COLORS.red, 0.9);
  ringEffect(player.x, player.y, COLORS.cyan, 170, 0.82);
  sfx.tone(180, 0.4, 'sawtooth', 0.06, 520);
  navigator.vibrate?.([90, 50, 110]);
  window.setTimeout(() => {
    if (game.state !== 'dying') return;
    game.hp = Math.ceil(runStats.maxHp * 0.5);
    game.state = 'playing';
    sdkGameplayStart();
    player.x = W / 2;
    player.y = H * 0.78;
    game.targetX = player.x;
    game.targetY = player.y;
    player.view.position.set(player.x, player.y);
    player.view.visible = true;
    player.view.alpha = 1;
    player.view.rotation = 0;
    player.view.scale.set(1);
    player.view.skew.y = 0;
    player.engine.alpha = 1;
    player.invincible = 3.2;
    ui.deathSequence.classList.remove('visible', 'detonate');
    burst(player.x, player.y, COLORS.cyan, 34, 240);
    ringEffect(player.x, player.y, COLORS.white, 150, 0.7);
    shipCallout('复活！ 50%');
    showToast('紧急复活 · 本局仅一次');
    sfx.tone(360, 0.34, 'sine', 0.055, 680);
    updateUI();
  }, 1050);
}

function declineRevive() {
  if (game.state !== 'revive-prompt' || game.reviveAdPending) return;
  game.reviveAvailable = false;
  game.reviveCountdown = 0;
  game.reviveDeadline = 0;
  ui.reviveOverlay.classList.remove('visible');
  beginDeathSequence(true);
}

function syncReviveAdButton() {
  if (!ui.acceptRevive) return;
  ui.acceptRevive.disabled = game.reviveAdPending;
  ui.acceptRevive.textContent = game.reviveAdPending ? '广告播放中…' : '看广告复活';
}

async function requestAdRevive() {
  if (game.state !== 'revive-prompt' || game.reviveAdPending || rewardedAdPending) return;

  const remainingSeconds = Math.max(0.1, game.reviveCountdown || 0);
  game.reviveAdPending = true;
  rewardedAdPending = true;
  syncReviveAdButton();
  showToast('正在拉起激励广告');

  try {
    requireCompletedRewardedAd(await playRewardedAd());
    if (game.state !== 'revive-prompt') return;
    game.reviveAdPending = false;
    rewardedAdPending = false;
    syncReviveAdButton();
    acceptRevive();
  } catch (error) {
    if (game.state === 'revive-prompt') {
      game.reviveAdPending = false;
      game.reviveDeadline = performance.now() + remainingSeconds * 1000;
      syncReviveAdButton();
      showToast(error?.message || '广告播放失败，请稍后再试');
    }
  } finally {
    rewardedAdPending = false;
    if (game.state !== 'revive-prompt') game.reviveAdPending = false;
  }
}

async function requestAdVictoryDouble() {
  if (game.state !== 'victory_result') return;
  if (game.victoryRewardDoublePending || game.victoryRewardDoubled || rewardedAdPending) return;
  const completion = game.completionSummary;
  const { coins, diamonds } = victoryAdReward(completion);
  if (!game.debugRun && coins <= 0 && diamonds <= 0) {
    showToast('本局没有可翻倍的货币奖励');
    return;
  }
  // The debug preview is deterministic: do not open a real ad or write fake
  // currency into the player profile while the panel is being styled.
  if (game.debugRun) {
    game.victoryRewardDoubled = true;
    game.victoryRewardDoubleNotice = true;
    showToast('调试预览 · 双倍奖励已到账');
    pixiCombatUi?.render();
    return;
  }

  game.victoryRewardDoublePending = true;
  rewardedAdPending = true;
  pixiCombatUi?.render();
  showToast('完整观看广告，通关和首通货币翻倍；材料不翻倍');
  try {
    requireCompletedRewardedAd(await playRewardedAd());
    if (game.state !== 'victory_result' || game.completionSummary !== completion || game.victoryRewardDoubled) return;
    const before = { coins: profileState.coins, diamonds: profileState.diamonds };
    try {
      profileState.coins += coins;
      profileState.diamonds += diamonds;
      saveProfileState();
    } catch (error) {
      profileState.coins = before.coins;
      profileState.diamonds = before.diamonds;
      throw error;
    }
    game.victoryRewardDoubled = true;
    updateLobbyHeader();
    const rewardParts = [];
    if (coins > 0) rewardParts.push(`金币 +${coins}`);
    if (diamonds > 0) rewardParts.push(`钻石 +${diamonds}`);
    game.victoryRewardDoubleNotice = true;
    showToast(`奖励双倍已到账 · ${rewardParts.join(' · ')}`);
    // Keep the settlement visible until the player confirms the reward. The
    // confirmation handler performs the same transition as “返回航母”.
    pixiCombatUi?.render();
  } catch (error) {
    if (game.state === 'victory_result') {
      showToast(error?.message || '广告播放失败，请稍后再试');
    }
  } finally {
    game.victoryRewardDoublePending = false;
    rewardedAdPending = false;
    // endGame() stops the ticker after rendering the lobby. Refresh once more
    // here so the lobby does not retain the transient “ad playing” state.
    pixiLobby?.update();
    pixiCombatUi?.update();
  }
}

function confirmVictoryRewardDouble() {
  if (game.state !== 'victory_result' || !game.victoryRewardDoubleNotice) return;
  game.victoryRewardDoubleNotice = false;
  endGame(true);
}

function beginDeathSequence() {
  if (game.state !== 'playing' || game.runEnded) return;
  // Defeat no longer opens revive, death cinematic, or result screens.
  // Defer teardown until the current collision/pool iteration has unwound.
  game.state = 'returning';
  game.reviveAvailable = false;
  game.reviveCountdown = 0;
  game.reviveDeadline = 0;
  game.reviveAdPending = false;
  game.keys.clear();
  resetRelativeDrag();
  sdkGameplayStop();
  queueMicrotask(() => {
    if (game.state === 'returning' && !game.runEnded) endGame(false);
  });
}

function hitPlayer(damage = 18, source = 'bullet') {
  if (player.invincible > 0 || game.pilotStealthTime > 0 || game.state !== 'playing') return;
  if (game.pilotShieldReady) {
    game.pilotShieldReady = false;
    player.invincible = 0.7;
    clearHostileBulletsNear(player.x, player.y, 230);
    ringEffect(player.x, player.y, Number.parseInt(getActivePilot().color.slice(1), 16), 145, 0.55);
    showToast(`${game.aircraftImmunitySource?.name||getActivePilot().skillName} · 伤害已抵消`);
    sfx.tone(520, 0.22, 'sine', 0.04, 280);
    return;
  }
  if (game.stageIndex === 0 && game.difficultyId === 'easy' && game.bossSpawned && game.openingGuard) {
    game.openingGuard = false;
    player.invincible = 2.6;
    game.flash = 0.14;
    game.shake = 6;
    ringEffect(player.x, player.y, COLORS.white, 135, 0.55);
    burst(player.x, player.y, COLORS.cyan, 20, 190);
    clearHostileBulletsNear(player.x, player.y, 300);
    showToast('白羊试炼 · 救援护盾');
    sfx.tone(310, 0.25, 'sine', 0.045, 520);
    return;
  }
  if (game.shieldReady && runStats.shieldLevel > 0 && skillActive('shield')) {
    game.shieldReady = false;
    game.shieldTimer = Math.max(runStats.fortressOverdrive ? 6 : 12, (25 - runStats.shieldLevel * 4) * (runStats.fortressOverdrive ? 0.5 : 1));
    game.flash = 0.16;
    game.shake = 7;
    ringEffect(player.x, player.y, COLORS.cyan, 125, 0.5);
    burst(player.x, player.y, COLORS.cyan, 18, 175);
    sfx.tone(260, 0.28, 'sine', 0.05, 620);
    player.invincible = 1.1;
    enemyBullets.forEach((b) => hostilePool.release(b));
    enemyBullets.length = 0;
    showToast('量子护盾·伤害抵消');
    updateUI();
    return;
  }
  const contact = source === 'collision' || source === 'boss-dash';
  const sourceMultiplier = contact
    ? (runStats.collisionDamageTakenMultiplier || 1) * (1 - (runStats.researchCollisionReduction || 0))
    : (1 - (runStats.researchProjectileReduction || 0));
  let appliedDamage = Math.max(1, Math.round(
    damage * (runStats.damageTakenMultiplier || 1) * sourceMultiplier,
  ));
  if (!contact && game.researchHalfHitsRemaining > 0) {
    game.researchHalfHitsRemaining -= 1;
    appliedDamage = Math.max(1, Math.ceil(appliedDamage / 2));
  }
  if (game.pilotBarrierTime > 0 && game.pilotBarrierHp > 0) {
    const absorbed = Math.min(game.pilotBarrierHp, appliedDamage);
    game.pilotBarrierHp = Math.max(0, game.pilotBarrierHp - absorbed);
    appliedDamage -= absorbed;
    if(game.pilotBarrierHp===0){burst(player.x,player.y,0xffb66d,8,90);shipCallout('护盾破裂',0xffc288);}
    shipCallout(`护盾 -${Math.ceil(absorbed)}`, 0x66f0b0);
    ringEffect(player.x, player.y, 0x66f0b0, 92, 0.34);
    if (appliedDamage <= 0) {
      player.invincible = 0.28;
      return;
    }
  }
  const hpBeforeHit = game.hp;
  game.hp = Math.max(0, game.hp - appliedDamage);
  game.hitsTaken += 1;
  game.lastDamageSource = source;
  game.lastDamageAmount = appliedDamage;
  game.lastDamageSummary = formatLastDamageSummary(appliedDamage, source);
  game.damageHistory = [
    ...(game.damageHistory || []),
    { source, amount: appliedDamage, elapsed: game.elapsed },
  ].slice(-4);
  resetFlightQualityChain();
  game.flightBoost = 0;
  game.flightFlipTime = 0;
  game.flightDashDistance = 0;
  game.flightQueuedFlipDirection = 0;
  game.flightFlipQueueTime = 0;
  game.flightFlipArmed = true;
  game.flightTrailAnchors = null;
  player.view.scale.set(1);
  player.view.skew.y = 0;
  shipCallout(`-${appliedDamage} · ${damageSourceLabel(source)}`, 0xff7080);
  if (game.hp <= 0) {
    beginDeathSequence();
    return;
  }
  player.invincible = source === 'collision' ? 2.6 : 1.8;
  const feedback = playerDamageFeedback(hpBeforeHit - game.hp, runStats.maxHp, REDUCED_MOTION);
  game.shake = Math.max(game.shake, feedback.shake);
  game.flash = Math.max(game.flash, feedback.flash);
  // One local impact, rather than stacking a burst and another white impact
  // over the same hull. The health bar and damage callout remain unchanged.
  if (game.fixedPartsMode) combatVfx.impact(player.x, player.y, feedback.color, feedback.impact, false, {priority:'player'});
  else burst(player.x, player.y, feedback.color, feedback.particles, feedback.speed);
  sfx.playerHit();
  if (feedback.vibration > 0) navigator.vibrate?.(feedback.vibration);
  clearHostileBulletsNear(player.x, player.y, 210);
  updateUI();
  if (game.hp / runStats.maxHp <= 0.25) {
    if (shouldShowLowHealthWarning(hpBeforeHit, game.hp, runStats.maxHp, game.elapsed, game.lowHealthWarningAt)) {
      game.lowHealthWarningAt = game.elapsed;
      showToast('警告 · 耐久过低');
      if (!REDUCED_MOTION) navigator.vibrate?.([80, 45, 80]);
    }
    // Audio remains as-is; only the visual/haptic reminder is rate-limited.
    sfx.tone(170, 0.36, 'sawtooth', 0.055, -70);
  }
}

function damageWithActiveWeapon(target, amount, heavyHit = true) {
  if (!target || target.dead) return;
  if (target === boss) damageBoss(amount * (runStats.bossDamageMultiplier || 1), target.x, target.y, heavyHit);
  else damageEnemy(target, amount, target.x, target.y, heavyHit);
}

const ACTIVE_WEAPON_TYPES = new Set([
  'lance',
  'swarm',
  'emp',
  'cryo',
  'prism',
  'rail',
  'plasma',
  'meteor',
]);

function useActiveWeapon(shortcut, automatic = false) {
  const weapon = activeWeaponForShortcut(shortcut);
  const active = weapon?.active;
  if (game.state !== 'playing' || !active) return;
  if (!ACTIVE_WEAPON_TYPES.has(active.type)) {
    showToast(`${active.name} · 火控协议不兼容`);
    return;
  }
  if (weapon.cooldown > 0) {
    showToast(`${shortcut}号 ${active.name} · 冷却 ${weapon.cooldown.toFixed(1)}秒`);
    return;
  }
  if (weapon.charges <= 0) {
    const remaining = Math.max(0, active.rechargeKills - weapon.killCounter);
    showToast(`${shortcut}号 ${active.name} · 再击破 ${remaining} 架充能`);
    return;
  }

  weapon.charges -= 1;
  // Automatic weapons fire as soon as ready; signal the actual activation,
  // rather than showing a misleading persistent "ready" state.
  weapon.feedbackActivationAt = performance.now();
  weapon.cooldownDuration = Math.max(
    0.8,
    (active.interval || active.cooldown) * (runStats.activeCooldownMultiplier || 1),
  );
  weapon.cooldown = weapon.cooldownDuration;
  const origin = playerLocalPoint(weapon.muzzle?.x ?? 0, weapon.muzzle?.y ?? -28);
  const power = Math.max(1, active.damage || 20)
    * combatPowerMultiplier()
    * (runStats.activeDamageMultiplier || 1);
  const color = weapon.color || COLORS.cyan;
  ringEffect(origin.x, origin.y, color, 24, .18);
  triggerPilotSkillCutIn(active.name);

  if (active.type === 'lance') {
    sfx.fireWeapon('sniper');
    for (let i = -2; i <= 2; i += 1) {
      firePlayerBullet(origin.x + i * 8, origin.y, -Math.PI / 2 + i * 0.012, {
        style: 'blue',
        finalDamage: power * 0.72,
        speed: 1150,
        pierce: 9,
        noEffects: true,
        scale: 1.25,
      });
    }
    ringEffect(origin.x, origin.y, color, 92, 0.32);
  } else if (active.type === 'swarm') {
    sfx.fireWeapon('grenade');
    const targets = damageTargetsInRange(player.x, player.y, 1100);
    for (let i = 0; i < 8; i += 1) {
      const target = targets[i % Math.max(1, targets.length)] || null;
      firePlayerBullet(origin.x + (i % 2 ? 14 : -14), origin.y + Math.floor(i / 2) * 4, -Math.PI / 2 + (i - 3.5) * 0.12, {
        style: 'missile',
        finalDamage: power * 0.48,
        homing: true,
        target,
        explosionRadius: 64,
        pierce: 0,
        noEffects: true,
      });
    }
  } else if (active.type === 'emp') {
    sfx.fireWeapon('lightning');
    clearHostileBulletsNear(player.x, player.y, 430);
    ringEffect(player.x, player.y, color, 430, 0.72);
    for (const target of damageTargetsInRange(player.x, player.y, 520)) {
      target.stunTime = Math.max(target.stunTime || 0, target === boss ? 0.8 : 2.4);
      damageWithActiveWeapon(target, power * 0.56);
    }
  } else if (active.type === 'cryo') {
    sfx.fireWeapon('laser');
    clearHostileBulletsNear(player.x, player.y, 260);
    ringEffect(player.x, player.y, color, 560, 0.82);
    for (const target of damageTargetsInRange(player.x, player.y, 590)) {
      target.frostTime = Math.max(target.frostTime || 0, target === boss ? 2.2 : 5);
      damageWithActiveWeapon(target, power * 0.68);
    }
  } else if (active.type === 'prism') {
    sfx.fireWeapon('lightning');
    const targets = damageTargetsInRange(player.x, player.y, 980).slice(0, 9);
    let from = { x: origin.x, y: origin.y };
    targets.forEach((target, index) => {
      arcEffect(from, target);
      damageWithActiveWeapon(target, power * Math.pow(0.86, index));
      from = target;
    });
    if (!targets.length) ringEffect(origin.x, origin.y, color, 140, 0.4);
  } else if (active.type === 'rail') {
    sfx.fireWeapon('sword');
    for (let i = -3; i <= 3; i += 1) {
      firePlayerBullet(origin.x + i * 10, origin.y, -Math.PI / 2 + i * 0.035, {
        style: 'sword',
        finalDamage: power * 0.82,
        speed: 980,
        pierce: 5,
        noEffects: true,
        scale: 1.18,
      });
    }
  } else if (active.type === 'plasma') {
    sfx.fireWeapon('gun');
    for (let i = -7; i <= 7; i += 1) {
      firePlayerBullet(origin.x, origin.y, -Math.PI / 2 + i * 0.075, {
        style: 'red',
        finalDamage: power * 0.34,
        speed: 760,
        pierce: 1,
        noEffects: true,
        scale: 1.12,
      });
    }
  } else if (active.type === 'meteor') {
    sfx.volcano();
    const targets = damageTargetsInRange(player.x, player.y, 1200).slice(0, 6);
    targets.forEach((target, index) => {
      impactExplosion(target.x, target.y, color, 1.2 + index * 0.08);
      damageWithActiveWeapon(target, power * 1.12);
      for (const nearby of damageTargetsInRange(target.x, target.y, 90)) {
        if (nearby !== target) damageWithActiveWeapon(nearby, power * 0.38, false);
      }
    });
  }

  game.flash = Math.max(game.flash, 0.18);
  game.shake = Math.max(game.shake, 10);
  burst(origin.x, origin.y, color, 30, 260);
  if (!automatic) {
    navigator.vibrate?.([35, 25, 65]);
    showToast(`${active.name} · 已释放`);
    updateUI();
  }
}

function showToast(text) {
  ui.toast.textContent = text;
  ui.toast.classList.add('visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => ui.toast.classList.remove('visible'), 1500);
}

function animateFlightScore(targetScore) {
  const currentValue = Number(ui.flightFeedCombo.dataset.value || 0);
  const startValue = targetScore < currentValue ? 0 : currentValue;
  const startedAt = performance.now();
  const duration = 520;
  window.cancelAnimationFrame(showFlightFeed.scoreFrame);
  const tick = (now) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - (1 - progress) ** 3;
    const value = Math.round(startValue + (targetScore - startValue) * eased);
    ui.flightFeedCombo.dataset.value = String(value);
    ui.flightFeedCombo.textContent = formatDisplayNumber(value);
    if (progress < 1) showFlightFeed.scoreFrame = window.requestAnimationFrame(tick);
  };
  showFlightFeed.scoreFrame = window.requestAnimationFrame(tick);
  ui.flightFeedCombo.classList.remove('bump');
  void ui.flightFeedCombo.offsetWidth;
  ui.flightFeedCombo.classList.add('bump');
}

function showFlightFeed(action, points, color) {
  if (!ui.flightFeed) return;
  const accent = `#${Number(color).toString(16).padStart(6, '0')}`;
  ui.flightFeed.style.setProperty('--feed-color', accent);
  ui.flightFeedAction.textContent = `${action}  +${formatDisplayNumber(points)}`;
  ui.flightFeedPoints.textContent = flightComboLabel(game.flightChain);
  ui.flightFeed.classList.add('visible');
  animateFlightScore(game.flightQuality);
  window.clearTimeout(showFlightFeed.timer);
}

function showPauseMenu() {
  if (!['playing','paused'].includes(game.state)) return;
  if (game.state === 'playing') {
    if (game.fixedPartsMode) saveFixedGrowthCheckpoint();
    game.pauseReturnState = 'playing';
    sdkGameplayStop();
  }
  game.state = 'paused';
  game.pauseMode = 'pause';
  game.pointerActive = false;
  game.keys.clear();
  ui.pauseOverlay.classList.remove('visible','confirm-exit');
  pixiCombatUi?.render();
}

function resumeGame() {
  if (game.state !== 'paused') return;
  if (game.fixedPartsMode) restoreFixedGrowthCheckpoint();
  game.state = game.pauseReturnState === 'playing' ? 'playing' : 'menu';
  if (game.state === 'playing') sdkGameplayStart();
  ui.pauseOverlay.classList.remove('visible', 'confirm-exit');
  ui.flightQuality.classList.remove('pulse', 'grade-up', 'chained');
}

function showExitConfirm() {
  if (game.state !== 'playing' && game.state !== 'paused') return;
  if (game.state === 'playing') {
    if (game.fixedPartsMode) saveFixedGrowthCheckpoint();
    game.state = 'paused';
    game.pauseReturnState = 'playing';
    sdkGameplayStop();
  }
  game.pauseMode = 'exit';
  game.exitFromPause = false;
  ui.pauseOverlay.classList.add('visible', 'confirm-exit');
  ui.pauseEyebrow.textContent = '确认操作';
  ui.pauseTitle.textContent = '退出本局？';
  ui.pauseCopy.textContent = '本局进度不会保存';
  ui.pauseSecondary.textContent = '取消';
  ui.pausePrimary.textContent = '确认退出';
  pixiCombatUi?.render();
}

function confirmExitRun() {
  if (game.state !== 'paused' || game.pauseMode !== 'exit') return;
  ui.pauseOverlay.classList.remove('visible', 'confirm-exit');
  endGame(false, true);
}

function handlePausePrimary() {
  confirmExitRun();
}

function handlePauseSecondary() {
  showPauseMenu();
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remain = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
}

function formatDisplayNumber(value) {
  return String(Math.round(Number(value) || 0));
}

function loadCampaignState() {
  const fallback = {
    version: 4,
    highestUnlocked: CAMPAIGN.length - 1,
    highestCleared: -1,
    selected: 0,
    selectedDifficulty: 'easy',
    results: {},
  };
  try {
    const parsed = JSON.parse(localStorage.getItem(CAMPAIGN_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return fallback;
    const rawResults = parsed.results && typeof parsed.results === 'object' ? parsed.results : {};
    const retiredResults = { ...(parsed.retiredResults || {}) };
    // Retain every former sub-stage record without treating unfinished chapters
    // as completed. Only the old final sub-stage carries chapter completion.
    if ((Number(parsed.version) || 0) < 4) {
      Object.assign(retiredResults, rawResults);
      for (const [chapterId, finalStageId] of [['aries','leo'],['virgo','capricorn'],['aquarius','hades']]) {
        for (const difficulty of DIFFICULTIES) {
          const key = `${chapterId}:${difficulty.id}`;
          const completed = rawResults[`${finalStageId}:${difficulty.id}`];
          if (completed) rawResults[key] = completed;
          else delete rawResults[key];
        }
      }
      // Previously retired god stages are not clears of the two new themes.
      for (const key of Object.keys(rawResults)) if (key.startsWith('poseidon:') || key.startsWith('zeus:')) delete rawResults[key];
    }
    for (const [key, value] of Object.entries(rawResults)) {
      if (key.startsWith('poseidon:') || key.startsWith('zeus:')) retiredResults[key] = value;
    }
    const results = {};
    for (const stage of CAMPAIGN) {
      for (const difficulty of DIFFICULTIES) {
        const key = `${stage.id}:${difficulty.id}`;
        const raw = rawResults[key];
        if (!raw || typeof raw !== 'object') continue;
        const {stars,starMask} = normalizeStarRecord(raw);
        results[key] = {
          cleared: Boolean(raw.cleared) || stars > 0,
          stars,
          starMask,
          bestTime: Math.max(0, Math.floor(Number(raw.bestTime) || 0)),
          bestScore: Math.max(0, Math.floor(Number(raw.bestScore) || 0)),
        };
      }
    }
    let highestCleared = -1;
    for (let index = 0; index < CAMPAIGN.length; index += 1) {
      if (!results[`${CAMPAIGN[index].id}:easy`]?.cleared) break;
      highestCleared = index;
    }
    const highestUnlocked = CAMPAIGN.length - 1;
    const savedSelection = Math.max(0, Math.floor(Number(parsed.selected) || 0));
    const selected = Math.min(highestUnlocked, Number(parsed.version) >= 4 ? savedSelection : Math.min(2, Math.floor(savedSelection / 5)));
    return {
      version: 4,
      highestUnlocked,
      highestCleared,
      selected,
      selectedDifficulty: 'easy',
      results,
      retiredResults,
    };
  } catch {
    return fallback;
  }
}

function saveCampaignState() {
  if(!isGameSessionCurrent())return;
  campaignState.selected = selectedStageIndex;
  campaignState.selectedDifficulty = selectedDifficultyId;
  campaignState.version = 4;
  try {
    localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(campaignState));
  } catch {
    // Storage can be unavailable in private mode or a constrained platform WebView.
  }
}

function difficultyResultKey(stageIndex, difficultyId) {
  return `${CAMPAIGN[stageIndex]?.id || stageIndex}:${difficultyId}`;
}

function getDifficultyResult(stageIndex, difficultyId) {
  return campaignState.results[difficultyResultKey(stageIndex, difficultyId)] || {
    cleared: false,
    stars: 0,
    bestTime: 0,
    bestScore: 0,
  };
}

function effectiveHighestUnlocked() {
  return debugUnlockAll ? CAMPAIGN.length - 1 : campaignState.highestUnlocked;
}

function accountSkillPathIds() {
  // 局内主武器不再受主线通关顺序限制；12 条路线从第一局起全部可见。
  return [...SKILL_PATH_UNLOCK_ORDER];
}

function isDifficultyUnlocked(stageIndex, difficultyId) {
  if (stageIndex < 0 || stageIndex >= CAMPAIGN.length || !DIFFICULTY_MAP.has(difficultyId)) return false;
  if (debugUnlockAll) return true;
  if (stageIndex > campaignState.highestUnlocked) return false;
  if (difficultyId === 'easy') return true;
  if (difficultyId === 'hard') return getDifficultyResult(stageIndex, 'easy').cleared;
  return getDifficultyResult(stageIndex, 'hard').cleared;
}

function rewardFor(stageIndex, difficultyId, star) {
  const mode = DIFFICULTY_MAP.get(difficultyId) || DIFFICULTIES[0];
  if (star === 3) {
    return { type: 'diamonds', amount: 0 };
  }
  if (star === 1) {
    return { type: 'coins', amount: Math.round(firstStarCoins(stageIndex) * mode.rewardScale / 10) * 10 };
  }
  // Star rewards now belong to the cumulative, manually claimed reward track.
  return { type: 'coins', amount: 0 };
}

function starGoalDefinitions(difficultyId = selectedDifficultyId) {
  return starGoals(difficultyId);
}

function calculateRunStars() {
  return assessRunStars({won:true,difficulty:game.difficultyId,hp:game.hp,maxHp:runStats.maxHp,
    revivesUsed:game.revivesUsed,elapsed:game.elapsed,hitsTaken:game.hitsTaken});
}

function bestStageStars(stageIndex) {
  return Math.max(...DIFFICULTIES.map((mode) => getDifficultyResult(stageIndex, mode.id).stars), 0);
}

function animateChapter(direction) {
  if (!direction) return;
  ui.chapterCover.classList.remove('swipe-next', 'swipe-prev');
  void ui.chapterCover.offsetWidth;
  ui.chapterCover.classList.add(direction > 0 ? 'swipe-next' : 'swipe-prev');
  window.setTimeout(() => ui.chapterCover.classList.remove('swipe-next', 'swipe-prev'), 320);
}

function selectCampaignStage(index, direction = 0) {
  const nextIndex = Math.max(0, Math.min(CAMPAIGN.length - 1, index));
  if (nextIndex === selectedStageIndex) return;
  const previousIndex = selectedStageIndex;
  selectedStageIndex = nextIndex;
  if (!isDifficultyUnlocked(selectedStageIndex, selectedDifficultyId)) selectedDifficultyId = 'easy';
  if (!['playing', 'paused', 'levelup', 'dying', 'transition'].includes(game.state)) game.stageIndex = selectedStageIndex;
  saveCampaignState();
  renderStageSelector();
  animateChapter(direction || Math.sign(nextIndex - previousIndex));
  updateUI();
}

function selectDifficulty(difficultyId) {
  const mode = DIFFICULTY_MAP.get(difficultyId);
  if (!mode) return;
  if (!isDifficultyUnlocked(selectedStageIndex, difficultyId)) {
    showToast(difficultyId === 'hard' ? '先通关本章简单模式' : '先通关本章困难模式');
    return;
  }
  selectedDifficultyId = difficultyId;
  saveCampaignState();
  renderStageSelector();
}

function renderDifficultyTabs() {
  ui.difficultyTabs.querySelectorAll('[data-difficulty]').forEach((button) => {
    const difficultyId = button.dataset.difficulty;
    const mode = DIFFICULTY_MAP.get(difficultyId);
    const unlocked = isDifficultyUnlocked(selectedStageIndex, difficultyId);
    const result = getDifficultyResult(selectedStageIndex, difficultyId);
    button.classList.toggle('active', difficultyId === selectedDifficultyId);
    button.classList.toggle('locked', !unlocked);
    button.style.setProperty('--difficulty-color', mode.color);
    button.querySelector('small').textContent = unlocked
      ? result.stars ? `${result.stars}星` : mode.short
      : difficultyId === 'hard' ? '通关简单' : '通关困难';
  });
}

function renderStarRewards() {
  const config = CAMPAIGN[selectedStageIndex];
  const result = getDifficultyResult(selectedStageIndex, selectedDifficultyId);
  const goals = starGoalDefinitions();
  ui.starRewards.replaceChildren();
  goals.forEach((goal, index) => {
    const star = index + 1;
    const achieved = Number.isInteger(result.starMask) && Boolean(result.starMask & (1 << index));
    const card = document.createElement('div');
    card.className = 'star-reward';
    card.classList.toggle('earned', achieved);
    card.classList.toggle('locked', !isDifficultyUnlocked(selectedStageIndex, selectedDifficultyId));
    card.innerHTML = `<i>★</i><b>${goal.label}</b><small>${achieved ? '已达成' : '通关时判定'}</small>`;
    ui.starRewards.appendChild(card);
  });
}

function compactPower(value) {
  const power = Math.max(0, Math.round(Number(value) || 0));
  if (power >= 10000) {
    const precision = power % 10000 === 0 ? 0 : 1;
    return `${(power / 10000).toFixed(precision)}万`;
  }
  if (power >= 1000) {
    const precision = power % 1000 === 0 ? 0 : 1;
    return `${(power / 1000).toFixed(precision)}k`;
  }
  return String(power);
}

function renderStageSelector() {
  const config = CAMPAIGN[selectedStageIndex];
  const mode = DIFFICULTY_MAP.get(selectedDifficultyId) || DIFFICULTIES[0];
  const currentPower = profilePower();
  const powerEstimate = estimateStagePower(config, selectedDifficultyId);
  const readiness = ratePowerReadiness(currentPower, powerEstimate.recommendedPower);
  const number = String(selectedStageIndex + 1).padStart(2, '0');
  const stageColor = `#${config.color.toString(16).padStart(6, '0')}`;
  const stageUnlocked = selectedStageIndex <= effectiveHighestUnlocked();
  const unlocked = isDifficultyUnlocked(selectedStageIndex, selectedDifficultyId);
  ui.stagePickerLabel.textContent = `第 ${number} / ${CAMPAIGN.length} 章`;
  ui.chapterArc.textContent = `${config.arc} · ${number}/${CAMPAIGN.length}`;
  ui.chapterName.textContent = `${config.name} · ${config.title}`;
  ui.chapterPower.textContent = `关卡需求 ${formatDisplayNumber(powerEstimate.recommendedPower)} 战力 · ${readiness.label}`;
  ui.chapterPower.dataset.readiness = readiness.id;
  ui.chapterCover.style.setProperty('--stage-color', stageColor);
  ui.chapterCover.style.setProperty('--readiness-color', readiness.color);
  ui.overlayCopy.textContent = i18n.getLanguage() === 'en'
    ? `${i18n.T(readiness.label)} · ${i18n.T(readiness.detail)}`
    : `${readiness.label} · ${readiness.detail}`;
  ui.startButton.disabled = !unlocked;
  ui.startButton.querySelector('span').textContent = unlocked
    ? `挑战第 ${number} 章 · ${mode.label}`
    : stageUnlocked ? '当前难度尚未解锁' : `第 ${number} 章尚未解锁`;
  ui.startButton.querySelector('small').textContent = unlocked
    ? `需求 ${formatDisplayNumber(powerEstimate.recommendedPower)} 战力 · ${readiness.label}`
    : stageUnlocked
      ? selectedDifficultyId === 'hard' ? '先通关简单' : '先通关困难'
      : `先通关第 ${String(selectedStageIndex).padStart(2, '0')} 章`;
  ui.stagePrev.disabled = selectedStageIndex <= 0;
  ui.stageNext.disabled = selectedStageIndex >= CAMPAIGN.length - 1;
  renderDifficultyTabs();
  renderStarRewards();
  renderStageDetails();
}

function renderStageDetails() {
  if (!ui.stageDetailsList) return;
  const currentPower = profilePower();
  const mode = DIFFICULTY_MAP.get(selectedDifficultyId) || DIFFICULTIES[0];
  ui.stageDetailsList.replaceChildren();
  CAMPAIGN.forEach((stage, index) => {
    const node = document.createElement('button');
    const unlocked = index <= effectiveHighestUnlocked();
    const stars = bestStageStars(index);
    const stageEstimate = estimateStagePower(stage, selectedDifficultyId);
    const stageReadiness = ratePowerReadiness(currentPower, stageEstimate.recommendedPower);
    const stageNumber = String(index + 1).padStart(2, '0');
    node.type = 'button';
    node.className = 'stage-detail-card';
    node.innerHTML = `
      <i>${String(index + 1).padStart(2, '0')}</i>
      <span>
        <b>${stageNumber} · ${stage.name} · ${stage.title}</b>
        <small>${stage.arc} · ${mode.label}建议战力 ${compactPower(stageEstimate.recommendedPower)}</small>
        <em>${unlocked ? '' : '尚未解锁'}</em>
      </span>
    `;
    node.style.setProperty('--detail-color', `#${stage.color.toString(16).padStart(6, '0')}`);
    node.disabled = !unlocked;
    node.classList.toggle('locked', !unlocked);
    node.classList.toggle('selected', index === selectedStageIndex);
    node.classList.toggle('final-stage', index === CAMPAIGN.length - 1);
    node.addEventListener('click', () => {
      selectCampaignStage(index);
      closeStageDetails();
    });
    ui.stageDetailsList.appendChild(node);
  });
}

function openStageDetails() {
  renderStageDetails();
  ui.stageDetailsPage.classList.add('visible');
  ui.stageDetailsButton.setAttribute('aria-expanded', 'true');
  ui.stageDetailsList.querySelector('.selected')?.scrollIntoView({ block: 'center' });
}

function closeStageDetails() {
  ui.stageDetailsPage.classList.remove('visible');
  ui.stageDetailsButton.setAttribute('aria-expanded', 'false');
}

function unlockNextStage(clearedIndex) {
  campaignState.highestCleared = Math.max(campaignState.highestCleared, clearedIndex);
  campaignState.highestUnlocked = Math.max(campaignState.highestUnlocked, Math.min(CAMPAIGN.length - 1, clearedIndex + 1));
  saveCampaignState();
}

function focusNextStageAfterEasyClear(clearedIndex) {
  selectedStageIndex = Math.min(CAMPAIGN.length - 1, Math.max(0, clearedIndex + 1));
  selectedDifficultyId = 'easy';
  saveCampaignState();
}

function recordRunVictory(config) {
  if (game.completionRecorded) return game.completionSummary;
  const difficultyId = game.difficultyId;
  const key = difficultyResultKey(game.stageIndex, difficultyId);
  const previous = getDifficultyResult(game.stageIndex, difficultyId);
  const assessment = calculateRunStars();
  const {stars,mask:starMask,goals:starObjectives} = assessment;
  const best = bestStarRecord(previous,assessment);
  const bestStars = best.stars;
  if (game.debugRun) {
    game.completionRecorded = true;
    game.completionSummary = {
      stars,
      starMask, starObjectives,
      bestStars,
      earned: { coins: 0, diamonds: 0 },
      unlockedModules: [],
      unlockedSkillPath: null,
      difficultyId,
      debugRun: true,
    };
    return game.completionSummary;
  }
  const mode = DIFFICULTY_MAP.get(difficultyId) || DIFFICULTIES[0];
  const baseCoins = Math.round(sortieCoins(game.stageIndex) * mode.rewardScale / 10) * 10;
  const firstClearCoins = previous.cleared ? 0 : rewardFor(game.stageIndex, difficultyId, 1).amount;
  const researchCoinBonus = game.peripheralSnapshot?.stats.researchModifiers?.stageCoinBonus || 0;
  const { earned, coinBreakdown } = victoryCurrencyReward(baseCoins, firstClearCoins, researchCoinBonus);
  campaignState.results[key] = {
    cleared: true,
    stars: bestStars,
    starMask: best.starMask,
    bestTime: previous.bestTime ? Math.min(previous.bestTime, Math.floor(game.elapsed)) : Math.floor(game.elapsed),
    bestScore: Math.max(previous.bestScore || 0, Math.floor(game.score)),
  };
  const firstEasyClear = difficultyId === 'easy' && !previous.cleared;
  if (difficultyId === 'easy') {
    unlockNextStage(game.stageIndex);
    focusNextStageAfterEasyClear(game.stageIndex);
  }
  const unlockedModules = firstEasyClear
    ? grantAssemblyModules(stageModuleRewardIds(game.stageIndex))
    : [];
  const unlockedSkillPath = firstEasyClear
    ? SKILL_PATH_UNLOCK_ORDER[4 + game.stageIndex] || null
    : null;
  profileState.coins += earned.coins;
  profileState.diamonds += earned.diamonds;
  saveCampaignState();
  saveProfileState();
  const peripheralReceipt = game.peripheralSnapshot ? peripheralSystem?.recordSortie({
    runId: game.peripheralSnapshot.id, won: true, stageIndex: game.stageIndex,
    firstMainlineClear: firstEasyClear,
    debugRun: game.debugRun,
  }) : null;
  game.completionRecorded = true;
  game.completionSummary = {
    stars,
    starMask, starObjectives,
    bestStars,
    earned,
    coinBreakdown,
    unlockedModules,
    unlockedSkillPath,
    peripheralRewards: peripheralReceipt?.ok ? peripheralReceipt.rewards : [],
    difficultyId,
    debugRun: false,
  };
  updateLobbyHeader();
  renderStageSelector();
  return game.completionSummary;
}

function loadProfileState() {
  const fallback = {
    playerName: DEFAULT_PLAYER_NAME,
    coins: 600,
    diamonds: 0,
    fighterLevel: 1,
    gearLevel: 1,
    techLevel: 1,
    supplyOpened: 0,
    lastFreeSupply: '',
  };
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return fallback;
    const coins = Number(parsed.coins);
    const diamonds = Number(parsed.diamonds);
    return {
      playerName: playerName(parsed.playerName),
      coins: Math.max(0, Math.floor(Number.isFinite(coins) ? coins : fallback.coins)),
      diamonds: Math.max(0, Math.floor(Number.isFinite(diamonds) ? diamonds : fallback.diamonds)),
      fighterLevel: Math.max(1, Math.min(50, Math.floor(Number(parsed.fighterLevel) || 1))),
      gearLevel: Math.max(1, Math.min(50, Math.floor(Number(parsed.gearLevel) || 1))),
      techLevel: Math.max(1, Math.min(50, Math.floor(Number(parsed.techLevel) || 1))),
      supplyOpened: Math.max(0, Math.floor(Number(parsed.supplyOpened) || 0)),
      lastFreeSupply: String(parsed.lastFreeSupply || ''),
    };
  } catch {
    return fallback;
  }
}

function saveProfileState() {
  if(!isGameSessionCurrent())return;
  localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profileState));
}

async function requestAdDiamonds() {
  if (rewardedAdPending) {
    showToast('广告正在播放，请稍候');
    return;
  }

  rewardedAdPending = true;
  pixiLobby?.render();
  showToast(`完整观看广告可获得 ${DIAMOND_AD_REWARD} 钻石`);

  try {
    await playRewardedAd();
    profileState.diamonds += DIAMOND_AD_REWARD;
    saveProfileState();
    updateLobbyHeader();
    if (activeLobbyTab && activeLobbyTab !== 'battle') renderGrowthPanel(activeLobbyTab);
    pixiLobby?.render();
    showToast(`广告奖励 · 钻石 +${DIAMOND_AD_REWARD}`);
  } catch (error) {
    showToast(error?.message || '广告播放失败，请稍后再试');
  } finally {
    rewardedAdPending = false;
    pixiLobby?.render();
  }
}

function startBattleSupply() {
  const supply=game.battleSupply;
  if(game.state!=='battle-supply'||supply?.phase!=='idle')return false;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  Object.assign(supply,{phase:'rolling',startedAt:performance.now(),durationMs:reduced?300:3800});
  sfx.pickup();
  game.battleSupplyTimer=window.setTimeout(()=>{
    if(game.state!=='battle-supply'||game.battleSupply!==supply)return;
    skipBattleSupply();
  },supply.durationMs);
  pixiCombatUi?.render();
  return true;
}

function skipBattleSupply() {
  const supply=game.battleSupply;
  if(game.state!=='battle-supply'||supply?.phase!=='rolling')return false;
  window.clearTimeout(game.battleSupplyTimer);game.battleSupplyTimer=null;
  supply.phase='ready';supply.revealedAt=performance.now();
  sfx.upgrade();pixiCombatUi?.render();
  return true;
}

function claimBattleSupply() {
  const supply = game.battleSupply;
  if (game.state !== 'battle-supply' || supply?.phase !== 'ready') return false;
  const card = game.fixedGrowth.claimSupply(supply.chestId, supply.reward.id, supply.reward.ownerId);
  if (!card) return false;
  window.clearTimeout(game.battleSupplyTimer);
  game.battleSupplyTimer = null;
  game.fixedCombat.syncBuild();
  syncFixedGrowth();
  showWeaponUpgradeFeedback(card);
  saveFixedGrowthCheckpoint();
  game.battleSupply = null;
  pixiCombatUi?.flySupplyReward({x:player.x,y:player.y});
  ringEffect(player.x,player.y,0x95edff,60,.32);
  game.state = 'playing';
  sdkGameplayStart();
  showToast(`战斗补给 · ${card.name}已生效`);
  updateUI();
  if (game.pendingLevels) openLevelUp();
  pixiCombatUi?.render();
  return true;
}

// Lobby services own rewards and limits; this adapter confirms platform completion.
async function playPeripheralShopAd() {
  if (rewardedAdPending) throw new Error('广告正在播放，请稍候');
  rewardedAdPending = true;
  try {
    const result = await playRewardedAd();
    if (result === false || result?.completed === false || result?.success === false
      || (result?.status && result.status !== 'completed') || (result?.code != null && Number(result.code) !== 10001)) {
      throw new Error('需完整观看广告才能获得奖励');
    }
    return {completed:true};
  } finally { rewardedAdPending = false; }
}

function localDayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function freeSupplyAvailable() {
  return profileState.lastFreeSupply !== localDayKey();
}

function getDailyLoginSnapshot() {
  if(peripheralSystem)return hostSignInSnapshot(peripheralSystem);
  return getDailyLoginStatus(dailyLoginState);
}

function claimDailyLoginReward() {
  if(peripheralSystem){
    const result=claimHostSignIn(peripheralSystem);
    showToast(result.message||'签到未完成');return result;
  }
  // The separate archived host-only build keeps its own legacy save format.
  const claim = planDailyLoginClaim(dailyLoginState);
  if (!claim.ok) {
    const message = claim.reason === 'completed'
      ? '七日签到奖励已全部领取'
      : claim.reason === 'already-claimed'
        ? '今日奖励已领取 · 明日再来'
        : claim.reason === 'clock-rollback'
          ? '设备日期早于上次签到日期，暂时无法领取'
          : '当前日期不可用，请稍后再试';
    showToast(message);
    return claim;
  }

  let receipt = null;
  if (claim.reward.type === 'coins') {
    profileState.coins += claim.reward.amount;
    saveProfileState();
  } else if (claim.reward.type === 'gacha-item') {
    [receipt] = grantGachaItem(claim.reward.itemId, 1, 'daily-login');
    if (!receipt) {
      showToast('签到奖励配置异常，请稍后再试');
      return { ok: false, reason: 'grant-failed', status: claim.status };
    }
  }

  Object.assign(dailyLoginState, claim.state);
  saveDailyLoginState(dailyLoginState, localStorage);
  updateLobbyHeader();
  renderStageSelector();
  if (activeLobbyTab && activeLobbyTab !== 'battle') renderGrowthPanel(activeLobbyTab);

  const duplicateLabel = receipt && !receipt.isFirst
    ? receipt.item?.type === 'aircraft'
      ? ' · 已转化为青岚共鸣 +1'
      : ` · 重复组件 ×${receipt.ownedCount}`
    : '';
  showToast(`第${claim.reward.day}日签到 · ${claim.reward.title}${duplicateLabel}`);
  return { ...claim, receipt };
}

function profilePower() {
  const pilotCollection = getPilotState();
  return 1280
    + (profileState.fighterLevel - 1) * 135
    + (profileState.gearLevel - 1) * 165
    + (profileState.techLevel - 1) * 120
    + getAssemblyPower()
    + 620
    + Math.max(0, pilotCollection.owned.length - 1) * 85;
}

function profileUpgradeCost(type) {
  const level = profileState[`${type}Level`] || 1;
  const base = type === 'fighter' ? 340 : type === 'gear' ? 420 : 380;
  const growth = type === 'fighter' ? 48 : type === 'gear' ? 58 : 52;
  return Math.round((base + level * level * growth) / 10) * 10;
}

function syncPilotUI() {
  const pilot = getActivePilot();
  if (!pilot || !ui.combatPilotAvatar) return;
  ui.combatPilotAvatar.style.setProperty('--pilot-color', pilot.color);
  ui.combatPilotAvatar.style.setProperty('--portrait-x', `${pilot.avatar ? 50 : pilot.portraitFocus?.x ?? 50}%`);
  ui.combatPilotAvatar.style.setProperty('--portrait-y', `${pilot.avatar ? 50 : pilot.portraitFocus?.y ?? 13}%`);
  ui.combatPilotAvatar.style.setProperty('--portrait-zoom', pilot.avatar ? 1 : pilot.portraitFocus?.zoom ?? 4.2);
  ui.combatPilotAvatarImage.src = pilot.avatar || pilot.image;
  ui.combatPilotAvatarImage.alt = pilot.name;
  if (ui.combatPilotAvatarLevel) {
    ui.combatPilotAvatarLevel.textContent = `等级${Math.max(1, Math.round(Number(game.level) || 1))}`;
  }
  if (ui.combatPilotAvatarResonance) {
    ui.combatPilotAvatarResonance.textContent = `共鸣 ${getPilotState().resonance[pilot.id] || 0}`;
  }
  ui.combatPilotAvatarName.textContent = pilot.name;
  ui.pilotSkillCutIn.style.setProperty('--pilot-color', pilot.color);
  ui.pilotSkillCutIn.style.setProperty('--pilot-accent', pilot.accent);
  ui.pilotSkillCutInImage.src = pilot.image;
  ui.pilotSkillCutInImage.alt = `${pilot.name}技能演出`;
  ui.pilotSkillCutInCode.textContent = pilot.aircraft;
  ui.pilotSkillCutInName.textContent = pilot.name;
  ui.pilotSkillCutInSkill.textContent = pilot.skillName;
}

function triggerPilotSkillCutIn(skillName = '') {
  // Periodic pilot traits keep their normal cadence; the large presentation
  // plays only once per sortie so it cannot repeatedly cover hostile fire.
  if (game.state !== 'playing' || game.pilotSkillCutInShown) return;
  game.pilotSkillCutInShown = true;
  const pilot = getActivePilot();
  if (pixiCombatUi) {
    pixiCombatUi.showPilotSkillCutIn(pilot, skillName || pilot.skillName);
    return;
  }
  syncPilotUI();
  ui.pilotSkillCutInSkill.textContent = skillName || pilot.skillName;
  ui.pilotSkillCutIn.classList.remove('visible');
  void ui.pilotSkillCutIn.offsetWidth;
  ui.pilotSkillCutIn.classList.add('visible');
  window.clearTimeout(triggerPilotSkillCutIn.timer);
  triggerPilotSkillCutIn.timer = window.setTimeout(() => {
    ui.pilotSkillCutIn.classList.remove('visible');
  }, 1000);
}

function updateLobbyHeader() {
  const currentPower = profilePower();
  const activePilot = getActivePilot();
  ui.pilotLevel.textContent = `等级${profileState.fighterLevel}`;
  ui.pilotName.textContent = `${activePilot.name} · ${activePilot.aircraft}`;
  ui.coinBalance.textContent = formatDisplayNumber(profileState.coins);
  ui.diamondBalance.textContent = formatDisplayNumber(profileState.diamonds);
  ui.battlePower.textContent = `战力 ${formatDisplayNumber(currentPower)}`;
  ui.growthPower.textContent = `战力 ${formatDisplayNumber(currentPower)}`;
  ui.supplyDot.classList.toggle('visible', profileState.diamonds >= 20);
  syncPilotUI();
}

function updateDebugUnlockButton() {
  if (!ui.debugUnlockButton) return;
  ui.debugUnlockButton.classList.toggle('active', debugUnlockAll);
  ui.debugUnlockButton.textContent = debugUnlockAll ? '调试 · 全开' : '调试页面';
  ui.debugUnlockButton.setAttribute('aria-expanded', String(ui.debugPage?.classList.contains('visible')));
  if (ui.debugUnlockToggle) {
    ui.debugUnlockToggle.classList.toggle('active', debugUnlockAll);
    ui.debugUnlockToggle.setAttribute('aria-pressed', String(debugUnlockAll));
  }
}

function openDebugPage() {
  ui.debugPage.classList.add('visible');
  updateDebugUnlockButton();
  updateDebugResourceReadout();
}

function closeDebugPage() {
  ui.debugPage.classList.remove('visible');
  updateDebugUnlockButton();
  resetClearSaveConfirmation();
}

let clearSaveConfirmationTimer = 0;

function resetClearSaveConfirmation() {
  window.clearTimeout(clearSaveConfirmationTimer);
  clearSaveConfirmationTimer = 0;
  if (!ui.clearSaveButton) return;
  ui.clearSaveButton.classList.remove('confirming');
  ui.clearSaveButton.querySelector('span').textContent = '清空存档并重启';
  ui.clearSaveButton.querySelector('small').textContent = '恢复全新飞行员状态';
}

function clearGameSaveAndRestart() {
  if (!DEBUG_TOOLS_ENABLED || !['menu', 'gameover', 'victory'].includes(game.state) || rewardedAdPending) {
    const result = { ok: false, message: '请先结束战斗或广告，再清空存档' };
    showToast(result.message);
    return result;
  }
  const access = peripheralSystem?.developerToolsAccess({ reset: true });
  if (access && !access.ok) { showToast(access.message); return access; }
  try {
    clearLocalGameSave(localStorage, sessionStorage);
  } catch (error) {
    showToast(error.message);
    return { ok: false, message: error.message };
  }
  window.location.reload();
  return { ok: true };
}

function requestClearGameSave() {
  if (!ui.clearSaveButton.classList.contains('confirming')) {
    ui.clearSaveButton.classList.add('confirming');
    ui.clearSaveButton.querySelector('span').textContent = '再次点击确认清空';
    ui.clearSaveButton.querySelector('small').textContent = '此操作无法撤销 · 完成后自动重启';
    clearSaveConfirmationTimer = window.setTimeout(resetClearSaveConfirmation, 4500);
    return;
  }
  clearGameSaveAndRestart();
}

function updateDebugResourceReadout() {
  const wallet = peripheralSystem?.snapshot().wallet || profileState;
  if (ui.debugCoinBalance) ui.debugCoinBalance.textContent = formatDisplayNumber(wallet.coins);
  if (ui.debugDiamondBalance) ui.debugDiamondBalance.textContent = formatDisplayNumber(wallet.diamonds);
}

function addDebugCurrency(type) {
  if (!Object.hasOwn(DEVELOPER_CURRENCY_GRANTS, type)) return { ok: false, message: '请选择金币或钻石' };
  let result;
  if (peripheralSystem) {
    result = peripheralSystem.action('developerCurrency', { currency: type, expectedRevision: peripheralSystem.state.replicaInventory.revision });
    if (!result.ok) { showToast(result.message); return result; }
  } else {
    const grant = DEVELOPER_CURRENCY_GRANTS[type];
    const balance = profileState[type] + grant.amount;
    if (!Number.isSafeInteger(balance)) return { ok: false, message: '资源数量已达上限' };
    const previous = profileState[type];
    profileState[type] = balance;
    try { saveProfileState(); }
    catch { profileState[type] = previous; return { ok: false, message: '资源未保存，请重试' }; }
    result = { ok: true, message: `${grant.name} +${grant.amount}` };
  }
  updateLobbyHeader();
  updateDebugResourceReadout();
  if (activeLobbyTab !== 'battle') renderGrowthPanel(activeLobbyTab);
  showToast(result.message);
  return result;
}


function grantDebugWeapons() {
  const unlocked = grantAllCommonWeaponsForDebug();
  if (activeLobbyTab !== 'battle') renderGrowthPanel(activeLobbyTab);
  showToast(unlocked ? `已获得 ${unlocked} 把新武器 · 共 20 把` : '已拥有全部 20 把新武器');
  return unlocked;
}

function toggleDebugUnlockAll() {
  debugUnlockAll = !debugUnlockAll;
  try {
    sessionStorage.setItem(DEBUG_UNLOCK_STORAGE_KEY, debugUnlockAll ? '1' : '0');
  } catch {
    // Embedded WebViews may deny sessionStorage; the in-memory toggle still works.
  }
  setAssemblyDebugUnlocks(debugUnlockAll);
  if (!debugUnlockAll) {
    selectedStageIndex = Math.min(selectedStageIndex, campaignState.highestUnlocked);
    if (!isDifficultyUnlocked(selectedStageIndex, selectedDifficultyId)) selectedDifficultyId = 'easy';
    game.stageIndex = selectedStageIndex;
    game.difficultyId = selectedDifficultyId;
    saveCampaignState();
  }
  updateDebugUnlockButton();
  updateLobbyHeader();
  renderStageSelector();
  if (activeLobbyTab !== 'battle') renderGrowthPanel(activeLobbyTab);
  updateUI();
  showToast(debugUnlockAll
    ? '调试全开 · 试玩不写入正常进度'
    : '已恢复正常养成进度');
}

function applyProfileBonuses(stats) {
  const assembly = getAssemblyBonuses();
  const activePilot = getActivePilot();
  stats.damageTakenMultiplier ??= 1;
  stats.activeCooldownMultiplier ??= 1;
  stats.activeDamageMultiplier ??= 1;
  stats.supportDamageMultiplier ??= 1;
  stats.supportFireRateMultiplier ??= 1;
  stats.enemyBulletSpeedMultiplier ??= 1;
  stats.healingMultiplier ??= 1;
  stats.eliteDamageMultiplier ??= 1;
  stats.maxHpMultiplier ??= 1;
  stats.collisionDamageTakenMultiplier ??= 1;
  stats.magnetRangeMultiplier ??= 1;
  stats.maxHp += (profileState.fighterLevel - 1) * 4;
  stats.moveSpeedMultiplier *= 1 + (profileState.fighterLevel - 1) * 0.006;
  stats.damageMultiplier *= 1 + (profileState.gearLevel - 1) * 0.022;
  const resonance = getPilotState().resonance[activePilot.id] || 0;
  stats.damageMultiplier *= resonanceDamageMultiplier(resonance);
  stats.fireRateMultiplier *= 1 + (profileState.gearLevel - 1) * 0.006;
  stats.xpMultiplier *= 1 + (profileState.techLevel - 1) * 0.014;
  stats.critChance += (profileState.techLevel - 1) * 0.002;
  stats.maxHp += assembly.maxHp || 0;
  stats.maxHp *= assembly.maxHpMultiplier || 1;
  stats.damageMultiplier *= assembly.damageMultiplier || 1;
  stats.fireRateMultiplier *= assembly.fireRateMultiplier || 1;
  stats.moveSpeedMultiplier *= assembly.moveSpeedMultiplier || 1;
  stats.xpMultiplier *= assembly.xpMultiplier || 1;
  stats.projectileSpeedMultiplier *= assembly.projectileSpeedMultiplier || 1;
  stats.bossDamageMultiplier *= assembly.bossDamageMultiplier || 1;
  stats.eliteDamageMultiplier *= assembly.eliteDamageMultiplier || 1;
  stats.damageTakenMultiplier *= assembly.damageTakenMultiplier || 1;
  stats.collisionDamageTakenMultiplier *= assembly.collisionDamageTakenMultiplier || 1;
  stats.activeCooldownMultiplier *= assembly.activeCooldownMultiplier || 1;
  stats.activeDamageMultiplier *= assembly.activeDamageMultiplier || 1;
  stats.supportDamageMultiplier *= assembly.supportDamageMultiplier || 1;
  stats.supportFireRateMultiplier *= assembly.supportFireRateMultiplier || 1;
  stats.enemyBulletSpeedMultiplier *= assembly.enemyBulletSpeedMultiplier || 1;
  stats.healingMultiplier *= assembly.healingMultiplier || 1;
  stats.critChance += assembly.critChance || 0;
  stats.critMultiplier += assembly.critMultiplier || 0;
  stats.magnetRange = (stats.magnetRange + (assembly.magnetRange || 0))
    * (assembly.magnetRangeMultiplier || 1);
  stats.assemblySupports = getAssemblySupports();
  if (activePilot.ability.type === 'critical') {
    stats.critChance += activePilot.ability.chance;
    stats.critMultiplier += activePilot.ability.multiplier;
  }
  stats.critChance = clampCriticalChance(
    stats.critChance,
    activePilot.ability.globalChanceCap || 0.75,
  );
}

function upgradeProfile(type) {
  const stateKey = `${type}Level`;
  if (!(stateKey in profileState) || profileState[stateKey] >= 50) return;
  const cost = profileUpgradeCost(type);
  if (profileState.coins < cost) {
    showToast('金币不足 · 完成关卡与三星目标可获得金币');
    return;
  }
  profileState.coins -= cost;
  profileState[stateKey] += 1;
  saveProfileState();
  updateLobbyHeader();
  renderStageSelector();
  renderGrowthPanel(
    activeLobbyTab === 'assembly'
      ? 'assembly'
      : activeLobbyTab === 'upgrade'
        ? 'upgrade'
        : type,
  );
  showToast(`${type === 'fighter' ? '战机' : type === 'gear' ? '装备' : '科技'}升级成功`);
}

function showGachaResults(receipts) {
  const qualityOrder = ['R', 'white', 'SR', 'green', 'SSR', 'blue', 'purple', 'UR', 'gold'];
  const bestReceipt = [...receipts].sort(
    (a, b) => qualityOrder.indexOf(b.quality) - qualityOrder.indexOf(a.quality),
  )[0];
  if (ui.gachaCore) ui.gachaCore.textContent = GACHA_QUALITIES[bestReceipt?.quality]?.name || 'DRAW';
  ui.gachaResults.className = `gacha-results${receipts.length === 1 ? ' single' : ''}`;
  const resultsHeader = receipts.length > 1
    ? `<header class="gacha-results-head"><div><small>永久卡池</small><strong>${receipts[0]?.poolId === 'aircraft_permanent' ? '飞行员抽取结果' : '武器抽取结果'}</strong></div><span>10 / 10 · 上下滑动查看</span></header>`
    : '';
  ui.gachaResults.innerHTML = resultsHeader + receipts.map((receipt, index) => {
    const item = receipt.item;
    const quality = GACHA_QUALITIES[receipt.quality];
    const pilot = item?.type === 'aircraft'
      ? SSR_PILOT_MAP.get(receipt.grantedPilotId || item.refId)
      : null;
    const typeLabel = item?.type === 'fixed'
      ? `固定件 · ${GACHA_SLOTS[item.slot]?.name || item.slot}`
      : item?.type === 'aircraft'
        ? '飞机'
        : item?.isUniversal
          ? '通用武器'
          : `专属武器 · ${item?.exclusiveCallsign || '专属角色'}`;
    const icon = pilot
      ? `<img src="${pilot.image}" alt="${pilot.name}" />`
      : `<i>${item?.icon || (receipt.pendingContent ? '◇' : '◆')}</i>`;
    const obtainLabel = receipt.pendingContent
      ? '内容待配置 · 已保留金色记录'
      : receipt.isFirst
        ? '首次获得'
        : item?.type === 'aircraft'
          ? `重复获得 · 共鸣 +${receipt.resonanceAdded || 1} → ${receipt.resonance || 0}`
        : `重复获得 ${receipt.duplicateCount} 次`;
    return `
      <article class="gacha-item-card" style="--reveal-index:${index};--quality-color:${quality?.color || '#fff'}">
        <div class="gacha-item-art">${icon}<b>${quality?.name || receipt.quality}</b></div>
        <div class="gacha-item-copy">
          <small>${typeLabel}</small>
          <strong>${item?.name || '金色角色专有武器（待配置）'}</strong>
          <span>${obtainLabel}</span>
          <em>${receipt.pityTriggered ? `保底触发 · ${receipt.pityTier.toUpperCase()}` : '基础概率结果'}</em>
        </div>
        <span class="gacha-new-badge">${receipt.isFirst ? '新' : receipt.pendingContent ? '待配置' : `×${receipt.ownedCount}`}</span>
      </article>
    `;
  }).join('');
  ui.gachaResults.scrollTop = 0;
  if (receipts.length > 1) {
    mountScrollView(ui.gachaResults, { axis: 'y', friction: 0.88 });
  } else {
    unmountScrollView(ui.gachaResults);
  }
  ui.gachaOverlay.classList.remove('results-visible');
  ui.gachaOverlay.classList.add('visible');
  window.clearTimeout(showGachaResults.timer);
  showGachaResults.timer = window.setTimeout(() => {
    ui.gachaOverlay.classList.add('results-visible');
  }, 1250);
}

function skipGachaAnimation() {
  window.clearTimeout(showGachaResults.timer);
  ui.gachaOverlay.classList.add('results-visible');
}

function closeGachaResults() {
  window.clearTimeout(showGachaResults.timer);
  unmountScrollView(ui.gachaResults);
  ui.gachaOverlay.classList.remove('visible', 'results-visible');
  renderGrowthPanel('supply');
}

function claimSupply(action, { showResults = true } = {}) {
  const count = action === 'ten' ? 10 : 1;
  const cost = count === 10 ? 180 : 20;
  if (profileState.diamonds < cost) {
    showToast(`以太晶体不足 · ${count === 10 ? '十连需要 180' : '单次需要 20'}`);
    return [];
  }
  profileState.diamonds -= cost;
  profileState.supplyOpened += count;
  saveProfileState();
  const receipts = drawGacha(selectedGachaPoolId, count);
  updateLobbyHeader();
  renderStageSelector();
  if (showResults) showGachaResults(receipts);
  return receipts;
}

function calibrationTarget() {
  return ['fighter', 'gear', 'tech'].sort((a, b) => (
    profileState[`${a}Level`] - profileState[`${b}Level`]
  ))[0];
}

function calibrationLabel(type) {
  if (type === 'fighter') return '机体';
  if (type === 'gear') return '火控';
  return '研究';
}

function disposeAssemblyBay(entry = activeGrowthPanel) {
  assemblyMountToken += 1;
  if (entry) entry.assemblyMountToken = (entry.assemblyMountToken || 0) + 1;
  const controller = entry?.assemblyBay || activeAssemblyBay;
  controller?.destroy?.();
  if (entry) entry.assemblyBay = null;
  if (activeAssemblyBay === controller) activeAssemblyBay = null;
}

function disposeAirframePreview(entry = activeGrowthPanel) {
  airframePreviewToken += 1;
  if (entry) entry.airframePreviewToken = (entry.airframePreviewToken || 0) + 1;
  const controller = entry?.airframePreview || activeAirframePreview;
  controller?.destroy?.();
  if (entry) entry.airframePreview = null;
  if (activeAirframePreview === controller) activeAirframePreview = null;
}

async function mountAirframePreview(entry = activeGrowthPanel) {
  const host = entry?.root?.querySelector('[data-airframe-preview]');
  if (!host) {
    disposeAirframePreview(entry);
    return;
  }
  disposeAirframePreview(entry);
  const token = (entry.airframePreviewToken || 0) + 1;
  entry.airframePreviewToken = token;
  const previewRenderer = new WebGLRenderer();
  try {
    await previewRenderer.init({
      width: 180,
      height: 220,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      backgroundAlpha: 0,
      manageImports: false,
    });
  } catch (error) {
    console.error('Airframe preview renderer failed to initialize.', error);
    return;
  }
  if (token !== entry.airframePreviewToken || entry.destroyed) {
    previewRenderer.destroy();
    return;
  }
  const stage = new Container();
  const aircraft = createAssemblyAircraftVisual();
  aircraft.root.position.set(90, 108);
  aircraft.root.scale.set(0.61);
  stage.addChild(aircraft.root);
  previewRenderer.render({ container: stage });
  previewRenderer.canvas.style.width = '92px';
  previewRenderer.canvas.style.height = '112px';
  previewRenderer.canvas.setAttribute('aria-label', `${getActivePilot().aircraft} Pixi 矢量预览`);
  host.prepend(previewRenderer.canvas);
  const controller = {
    destroy() {
      stage.destroy({ children: true });
      previewRenderer.destroy();
      host.replaceChildren();
    },
  };
  entry.airframePreview = controller;
  if (entry === activeGrowthPanel) activeAirframePreview = controller;
}

function updateAssemblyReadout(root = activeGrowthPanel?.root || document, syncLobby = true) {
  const bonuses = getAssemblyBonuses();
  const snapshot = getAssemblySnapshot();
  const passiveWeapons = getAssemblyPassiveWeapons().filter((weapon) => weapon.passiveEffect);
  const totalWeaponLevel = passiveWeapons.reduce((sum, weapon) => sum + weapon.level, 0);
  const values = {
    assemblyDamage: `+${Math.max(0, Math.round(((bonuses.damageMultiplier || 1) - 1) * 100))}%`,
    assemblyFixed: `${snapshot.summary.fixedCount}/3`,
    assemblyPassive: `${passiveWeapons.length}/3`,
    assemblyWeaponLevel: `等级${totalWeaponLevel}`,
    assemblyPower: `+${formatDisplayNumber(getAssemblyPower())}`,
  };
  Object.entries(values).forEach(([id, value]) => {
    const node = root.querySelector?.(`#${id}`);
    if (node) node.textContent = value;
  });
  if (syncLobby) {
    updateLobbyHeader();
    renderStageSelector();
  }
}

function mountAssemblyPanel(system = 'fixed', entry = activeGrowthPanel) {
  const host = entry?.root?.querySelector('#assemblyCanvas');
  if (!host) return;
  assemblyMountToken += 1;
  const token = (entry.assemblyMountToken || 0) + 1;
  entry.assemblyMountToken = token;
  let bay;
  try {
    bay = mountAssemblyBay(host, {
      inventoryCategory: system === 'weapon' ? 'weapon' : 'fixed',
      system,
      canAffordUpgrade: (cost) => profileState.coins >= cost,
      onUpgrade: (moduleId, shownCost) => {
        if (debugUnlockAll && !getAssemblySnapshot().ownedModules.includes(moduleId)) {
          showToast('调试临时装备不可培养 · 正常通关获得后开放');
          return false;
        }
        const cost = getAssemblyWeaponUpgradeCost(moduleId);
        if (!cost || cost !== shownCost || profileState.coins < cost) {
          showToast('金币不足 · 完成关卡可继续培养挂载武器');
          return false;
        }
        profileState.coins -= cost;
        if (!upgradeAssemblyWeapon(moduleId)) {
          profileState.coins += cost;
          return false;
        }
        saveProfileState();
        updateLobbyHeader();
        renderStageSelector();
        showToast('被动武器强化成功');
        return true;
      },
      onChange: () => {
        updateAssemblyReadout(entry.root, entry === activeGrowthPanel);
        syncPlayerAssemblyVisual();
        if (game.state === 'menu') {
          game.activeWeapons = createActiveWeaponRuntime();
          updateUI();
        }
      },
    });
  } catch (error) {
    console.error('Assembly bay failed to mount.', error);
    host.innerHTML = '<div class="assembly-loading">装配舱离线 · 请刷新重试</div>';
    return;
  }
  entry.assemblyBay = bay;
  if (entry === activeGrowthPanel) activeAssemblyBay = bay;
  Promise.resolve(bay.ready).then(() => {
    if (token !== entry.assemblyMountToken || entry.destroyed) {
      bay?.destroy?.();
      return;
    }
    if (entry !== activeGrowthPanel) bay.pause?.();
    updateAssemblyReadout(entry.root, entry === activeGrowthPanel);
  }).catch((error) => {
    console.error('Assembly bay failed to mount.', error);
    if (activeAssemblyBay === bay) activeAssemblyBay = null;
    if (entry.assemblyBay === bay) entry.assemblyBay = null;
    host.innerHTML = '<div class="assembly-loading">装配舱离线 · 请刷新重试</div>';
  });
}

function pilotAirframePreviewMarkup(pilot) {
  return `<div class="loadout-airframe-canvas" data-airframe-preview aria-label="${pilot.aircraft}矢量预览"></div>`;
}

function openPilotArt(pilot = getActivePilot()) {
  const collection = getPilotState();
  const owned = collection.owned.includes(pilot.id);
  const selected = collection.selected === pilot.id;
  const resonance = collection.resonance[pilot.id] || 0;
  ui.pilotArtImage.src = pilot.image;
  ui.pilotArtImage.alt = `${pilot.name}角色全图`;
  ui.pilotArtCallsign.textContent = `${pilot.rarity} · ${pilot.aircraft}`;
  ui.pilotArtTitle.textContent = pilot.name;
  ui.pilotArtSubtitle.textContent = `${pilot.title} · ${pilot.aircraft}`;
  ui.pilotArtSkillIcon.textContent = pilot.icon;
  ui.pilotArtSkillName.textContent = pilot.skillName;
  ui.pilotArtSkillDescription.textContent = pilot.description;
  ui.pilotArtStatus.textContent = selected
    ? `当前出击 · 共鸣 ${resonance}`
    : owned
      ? `已获得 · 共鸣 ${resonance}`
      : '招募后解锁';
  ui.pilotArtOverlay.style.setProperty('--pilot-color', pilot.color);
  ui.pilotArtOverlay.style.setProperty('--pilot-accent', pilot.accent);
  ui.pilotArtOverlay.classList.add('visible');
  ui.pilotArtClose.focus();
}

function closePilotArt() {
  ui.pilotArtOverlay.classList.remove('visible');
}

function growthPanelScrollTarget(entry) {
  return entry?.scrollInContent ? ui.growthContent : ui.growthView;
}

function scheduleAssemblyPanelMount(entry) {
  if (!entry?.isAssemblyPanel || entry.destroyed || entry.assemblyBay || entry.mountTimer) return;
  entry.mountTimer = window.setTimeout(() => {
    entry.mountTimer = 0;
    if (entry.destroyed || activeGrowthPanel !== entry || entry.assemblyBay) return;
    mountAssemblyPanel(entry.assemblySystem, entry);
  }, 650);
}

function scheduleAirframePreviewMount(entry) {
  if (entry?.tabId !== 'loadout' || entry.destroyed || entry.airframePreview || entry.previewTimer) return;
  entry.previewTimer = window.setTimeout(() => {
    entry.previewTimer = 0;
    if (entry.destroyed || activeGrowthPanel !== entry || entry.airframePreview) return;
    void mountAirframePreview(entry);
  }, 420);
}

function scheduleAssemblyResume(entry) {
  if (!entry?.assemblyBay || entry.destroyed || entry.resumeTimer) return;
  entry.resumeTimer = window.setTimeout(() => {
    entry.resumeTimer = 0;
    if (entry.destroyed || activeGrowthPanel !== entry) return;
    entry.assemblyBay?.resume?.();
  }, 180);
}

function deactivateGrowthPanel() {
  if (!activeGrowthPanel) return;
  const entry = activeGrowthPanel;
  entry.scrollTop = growthPanelScrollTarget(entry).scrollTop;
  window.clearTimeout(entry.mountTimer);
  window.clearTimeout(entry.previewTimer);
  window.clearTimeout(entry.resumeTimer);
  entry.mountTimer = 0;
  entry.previewTimer = 0;
  entry.resumeTimer = 0;
  entry.assemblyBay?.pause?.();
  entry.root.remove();
  activeGrowthPanel = null;
  activeAssemblyBay = null;
  activeAirframePreview = null;
}

function activateGrowthPanel(entry) {
  if (!entry || entry.destroyed) return;
  if (activeGrowthPanel !== entry) {
    deactivateGrowthPanel();
    ui.growthContent.replaceChildren(entry.root);
    activeGrowthPanel = entry;
  }
  activeAssemblyBay = entry.assemblyBay || null;
  activeAirframePreview = entry.airframePreview || null;
  ui.growthView.classList.toggle('assembly-mode', entry.isAssemblyPanel);
  ui.growthView.classList.toggle('loadout-mode', entry.tabId === 'loadout');
  ui.growthView.classList.toggle('pilot-recruit-mode', entry.tabId === 'supply');
  ui.growthEyebrow.textContent = entry.eyebrow;
  ui.growthTitle.textContent = entry.title;
  ui.growthPower.textContent = `战力 ${formatDisplayNumber(profilePower())}`;
  unmountScrollView(ui.growthView);
  unmountScrollView(ui.growthContent);
  const scrollTarget = growthPanelScrollTarget(entry);
  scrollTarget.scrollLeft = 0;
  scrollTarget.scrollTop = entry.scrollTop || 0;
  mountScrollView(scrollTarget, { axis: 'y', friction: 0.88 });
  if (entry.assemblyBay) {
    updateAssemblyReadout(entry.root, false);
    scheduleAssemblyResume(entry);
  }
  else scheduleAssemblyPanelMount(entry);
  scheduleAirframePreviewMount(entry);
}

function destroyGrowthPanel(entry) {
  if (!entry || entry.destroyed) return;
  entry.destroyed = true;
  window.clearTimeout(entry.mountTimer);
  window.clearTimeout(entry.previewTimer);
  window.clearTimeout(entry.resumeTimer);
  entry.mountTimer = 0;
  entry.previewTimer = 0;
  entry.resumeTimer = 0;
  if (activeGrowthPanel === entry) deactivateGrowthPanel();
  disposeAssemblyBay(entry);
  disposeAirframePreview(entry);
  entry.root.remove();
  if (growthPanelCache.get(entry.tabId) === entry) growthPanelCache.delete(entry.tabId);
}

function showGrowthPanel(tabId) {
  const cached = growthPanelCache.get(tabId);
  if (cached && !cached.destroyed) {
    activateGrowthPanel(cached);
    return cached;
  }
  return renderGrowthPanel(tabId);
}

function renderGrowthPanel(tabId) {
  const fighterCost = profileUpgradeCost('fighter');
  const gearCost = profileUpgradeCost('gear');
  const techCost = profileUpgradeCost('tech');
  const pilotCollection = getPilotState();
  const activePilot = getActivePilot();
  const supplyPityNote = i18n.getLanguage() === 'en' ? 'Shared single-pull pity' : '与单抽共用保底';
  const panels = {
    loadout: () => ({
      eyebrow: '',
      title: '战姬',
      html: `
        <section class="loadout-pilot-section" style="--pilot-color:${activePilot.color};--pilot-accent:${activePilot.accent}">
          <div class="loadout-section-head">
            <div><small>01 / 选择主角</small><strong>选择出战主角</strong></div>
            <b>已获得 ${pilotCollection.owned.length}/10</b>
          </div>
          <article class="loadout-current-pilot">
            <button class="loadout-current-art" type="button" data-view-pilot-art aria-label="查看${activePilot.name}角色全图">
              <img src="${activePilot.image}" alt="${activePilot.name}" />
              <em>查看全图</em>
            </button>
            <div class="loadout-current-copy">
              <small>${activePilot.rarity} · ${activePilot.aircraft} · 当前出战</small>
              <strong>${activePilot.name}</strong>
              <b>${activePilot.aircraft}</b>
              <p><i>${activePilot.icon}</i>${activePilot.skillName} · ${activePilot.description}</p>
            </div>
            <div class="loadout-airframe-preview">
              ${pilotAirframePreviewMarkup(activePilot)}
              <span>${activePilot.airframe.profile}</span>
            </div>
          </article>
          <div class="loadout-pilot-roster-wrap">
            <div class="loadout-pilot-roster" aria-label="可选主角">
              ${PILOTS_BY_RARITY.map((pilot) => {
    const owned = pilotCollection.owned.includes(pilot.id);
    const selected = activePilot.id === pilot.id;
    const resonance = pilotCollection.resonance[pilot.id] || 0;
    const focus = pilot.avatar ? { x: 50, y: 50, zoom: 1 } : pilot.portraitFocus || {};
    return `
                <button class="loadout-pilot-chip${selected ? ' selected' : ''}${owned ? '' : ' locked'}"
                  data-pilot-id="${pilot.id}"
                  style="--pilot-color:${pilot.color};--pilot-accent:${pilot.accent};--pilot-rarity-color:${GACHA_QUALITIES[pilot.rarity]?.color || pilot.accent};--portrait-x:${focus.x ?? 50}%;--portrait-y:${focus.y ?? 13}%;--portrait-zoom:${focus.zoom ?? 4.2}"
                  aria-label="${owned ? `选择${pilot.name}出战` : `${pilot.name}尚未获得`}">
                  <img src="${pilot.avatar || pilot.image}" alt="" loading="lazy" />
                  <b>${pilot.rarity}</b>
                  ${owned ? `<i>共鸣 ${resonance}</i>` : ''}
                  <em>${selected ? '出战中' : owned ? pilot.airframe.profile : '未获得'}</em>
                </button>
              `;
  }).join('')}
            </div>
          </div>
        </section>
      `,
    }),
    assembly: () => ({
      eyebrow: '',
      title: '固定件装配',
      html: `
        <section class="assembly-panel">
          <div class="assembly-toolbar">
            <div class="assembly-identity">
              <strong>雷隼 NX-07 · 机体平台</strong>
              <small>固定件不改机身 · 三层元素螺旋环绕</small>
            </div>
          </div>
          <div class="assembly-canvas" id="assemblyCanvas">
            <div class="assembly-loading">装配界面加载中…</div>
          </div>
          <div class="assembly-summary" aria-label="固定件属性摘要">
            <div class="assembly-readout">
              <span><small>固定件</small><b id="assemblyFixed">0/3</b></span>
              <span><small>综合增伤</small><b id="assemblyDamage">+0%</b></span>
              <span><small>装配战力</small><b id="assemblyPower">+0</b></span>
            </div>
            <div class="assembly-legend">
              <span style="--link-color:#78f1e5">外层刃环 / 中层核环 / 内层稳环与战斗完全同步</span>
            </div>
          </div>
        </section>
      `,
    }),
    weapons: () => ({
      eyebrow: '',
      title: '武器挂载',
      html: `
        <section class="assembly-panel">
          <div class="assembly-toolbar">
            <div class="assembly-identity">
              <strong>自动火控挂载</strong>
              <small>3 挂点 · 无需按键 · 每件独立等级1–10</small>
            </div>
          </div>
          <div class="assembly-canvas" id="assemblyCanvas">
            <div class="assembly-loading">武器界面加载中…</div>
          </div>
          <div class="assembly-summary" aria-label="武器挂载摘要">
            <div class="assembly-readout">
              <span><small>被动挂载</small><b id="assemblyPassive">0/3</b></span>
              <span><small>养成总级</small><b id="assemblyWeaponLevel">等级0</b></span>
              <span><small>综合增伤</small><b id="assemblyDamage">+0%</b></span>
            </div>
          </div>
        </section>
      `,
    }),
    upgrade: () => ({
      eyebrow: '',
      title: '战机升级',
      html: `
        <div class="upgrade-lines">
          <article class="upgrade-line" style="--growth-color:#78f1e5">
            <i>▲</i>
            <div>
              <small>机体成长</small>
              <strong>雷霆战机 · 等级${profileState.fighterLevel}</strong>
              <span>基础耐久 ${100 + (profileState.fighterLevel - 1) * 4} · 移动 +${((profileState.fighterLevel - 1) * 0.6).toFixed(1)}%</span>
            </div>
            <button data-profile-upgrade="fighter" ${profileState.coins < fighterCost ? 'disabled' : ''}><b>升级</b><em>● ${formatDisplayNumber(fighterCost)}</em></button>
          </article>
          <article class="upgrade-line" style="--growth-color:#ffbd63">
            <i>ϟ</i>
            <div>
              <small>火控成长</small>
              <strong>基础攻击 · 等级${profileState.gearLevel}</strong>
              <span>攻击 +${((profileState.gearLevel - 1) * 2.2).toFixed(1)}% · 射速 +${((profileState.gearLevel - 1) * 0.6).toFixed(1)}%</span>
            </div>
            <button data-profile-upgrade="gear" ${profileState.coins < gearCost ? 'disabled' : ''}><b>升级</b><em>● ${formatDisplayNumber(gearCost)}</em></button>
          </article>
          <article class="upgrade-line" style="--growth-color:#a88cff">
            <i>⌬</i>
            <div>
              <small>核心成长</small>
              <strong>雷核矩阵 · 等级${profileState.techLevel}</strong>
              <span>经验 +${((profileState.techLevel - 1) * 1.4).toFixed(1)}% · 暴击 +${((profileState.techLevel - 1) * 0.2).toFixed(1)}%</span>
            </div>
            <button data-profile-upgrade="tech" ${profileState.coins < techCost ? 'disabled' : ''}><b>升级</b><em>● ${formatDisplayNumber(techCost)}</em></button>
          </article>
        </div>
        <div class="upgrade-summary">
          <span><small>当前战力</small><b>${formatDisplayNumber(profilePower())}</b></span>
          <span><small>下次机体</small><b>耐久 +4</b></span>
          <span><small>等级上限</small><b>50级</b></span>
        </div>
        <p class="growth-note">升级效果永久生效。</p>
      `,
    }),
    fighter: () => ({
      eyebrow: '',
      title: '战机强化',
      html: `
        <article class="growth-hero" style="--growth-color:#78f1e5">
          <i>▲</i>
          <div><strong>雷霆战机 · 等级${profileState.fighterLevel}</strong><span>提升基础耐久与移动；每级 +4 耐久。</span></div>
        </article>
        <div class="growth-stats">
          <div class="growth-stat"><small>耐久上限</small><b>${100 + (profileState.fighterLevel - 1) * 4}</b></div>
          <div class="growth-stat"><small>移动增益</small><b>+${((profileState.fighterLevel - 1) * 0.6).toFixed(1)}%</b></div>
          <div class="growth-stat"><small>下级战力</small><b>+165</b></div>
        </div>
        <button class="growth-action" data-profile-upgrade="fighter" ${profileState.coins < fighterCost ? 'disabled' : ''}><span>强化战机</span><small>● ${formatDisplayNumber(fighterCost)}</small></button>
        <p class="growth-note">永久生效</p>
      `,
    }),
    gear: () => ({
      eyebrow: '',
      title: '装备工坊',
      html: `
        <article class="growth-hero" style="--growth-color:#ffbd63">
          <i>▦</i>
          <div><strong>六槽装备 · 等级${profileState.gearLevel}</strong><span>提升伤害与射速。</span></div>
        </article>
        <div class="gear-grid">
          ${[
    ['ϟ', '主炮', '#ff776c'], ['◇', '瞄具', '#a88cff'], ['▣', '装甲', '#78f1e5'],
    ['⌁', '引擎', '#5ec8ff'], ['◈', '僚机', '#ffe071'], ['Ψ', '核心', '#80ef9c'],
  ].map(([icon, name, color]) => `<div class="gear-slot" style="--gear-color:${color}"><i>${icon}</i><b>${name}</b><small>等级${profileState.gearLevel}</small></div>`).join('')}
        </div>
        <button class="growth-action" data-profile-upgrade="gear" ${profileState.coins < gearCost ? 'disabled' : ''}><span>全部强化</span><small>● ${formatDisplayNumber(gearCost)}</small></button>
      `,
    }),
    tech: () => ({
      eyebrow: '',
      title: '科技矩阵',
      html: `
        <article class="growth-hero" style="--growth-color:#a88cff">
          <i>⌬</i>
          <div><strong>矩阵研究 · 等级${profileState.techLevel}</strong><span>提升经验与暴击。</span></div>
        </article>
        <div class="tech-grid">
          <div class="tech-node"><b>能量回收</b><span>经验获取 +${((profileState.techLevel - 1) * 1.4).toFixed(1)}%</span></div>
          <div class="tech-node"><b>弱点解析</b><span>暴击率 +${((profileState.techLevel - 1) * 0.2).toFixed(1)}%</span></div>
          <div class="tech-node"><b>快速重构</b><span>更快升级</span></div>
          <div class="tech-node"><b>研究共振</b><span>全技能生效</span></div>
        </div>
        <button class="growth-action" data-profile-upgrade="tech" ${profileState.coins < techCost ? 'disabled' : ''}><span>推进研究</span><small>● ${formatDisplayNumber(techCost)}</small></button>
      `,
    }),
    supply: () => ({
      eyebrow: '',
      title: '永久补给',
      html: `
        <section class="pilot-recruit-hero">
          <small>永久补给 · 无概率提升</small>
          <strong>${GACHA_POOLS[selectedGachaPoolId].name}</strong>
          <span>${selectedGachaPoolId === 'aircraft_permanent'
    ? '只产出飞机 · 10 / 30 / 70 抽分层保底'
    : '固定件与通用武器 · 10 抽紫色 / 60 抽金色保底'}</span>
          <div class="pilot-recruit-stats">
            <b>累计 ${getGachaState().pools[selectedGachaPoolId].totalPulls} 抽</b>
            ${selectedGachaPoolId === 'aircraft_permanent'
    ? `<b>SR ${getGachaState().pools.aircraft_permanent.pity.sr}/10</b><b>SSR ${getGachaState().pools.aircraft_permanent.pity.ssr}/30 · UR ${getGachaState().pools.aircraft_permanent.pity.ur}/70</b>`
    : `<b>紫色 ${getGachaState().pools.weapon_permanent.pity.purple}/10</b><b>金色 ${getGachaState().pools.weapon_permanent.pity.gold}/60</b>`}
          </div>
        </section>
        <div class="gacha-pool-tabs">
          <button class="${selectedGachaPoolId === 'aircraft_permanent' ? 'active' : ''}" data-gacha-pool="aircraft_permanent">飞机角色池</button>
          <button class="${selectedGachaPoolId === 'weapon_permanent' ? 'active' : ''}" data-gacha-pool="weapon_permanent">通用武器池</button>
        </div>
        <div class="pilot-roster-head">
          <strong>${selectedGachaPoolId === 'aircraft_permanent' ? '永久飞机档案' : '永久主武器档案'}</strong>
          ${selectedGachaPoolId === 'weapon_permanent' ? '<small>20 把通用武器 · 六档品质成长</small>' : ''}
        </div>
        ${selectedGachaPoolId === 'aircraft_permanent'
    ? `<div class="pilot-roster">${PILOTS_BY_RARITY.map((pilot) => (
      pilotCardMarkup(pilot, { compact: true, interactive: true })
    )).join('')}</div>`
    : `<div class="gacha-weapon-roster">${GACHA_COMMON_WEAPONS.map((weapon) => {
      const ownedCount = getGachaState().inventory[weapon.id]?.count || 0;
      const equipped = getGachaState().equipment.primaryWeaponId === weapon.id;
      const compatible = isGachaWeaponCompatible(weapon, activePilot.id);
      const quality = GACHA_QUALITIES[weapon.quality];
      const typeLabel = weapon.isUniversal ? '通用武器' : `专属武器 · ${weapon.exclusiveCallsign}`;
      return `
          <article style="--quality-color:${quality.color}">
            <i>${weapon.icon}</i>
            <div><small>${quality.name} · ${typeLabel} · 持有 ${ownedCount}</small><strong>${weapon.name}</strong><span>${weapon.effects.slice(0, 2).map((entry) => entry.description).join(' · ')}${weapon.exclusiveAircraftId ? ` · ${compatible ? '当前角色可启用专属效果' : `需 ${weapon.exclusiveCallsign} 启用专属效果`}` : ''}</span></div>
            <button data-equip-gacha-weapon="${weapon.id}" ${ownedCount && compatible ? '' : 'disabled'}>${equipped ? (compatible ? '已装备' : '效果未启用') : !ownedCount ? '未获得' : compatible ? '装备' : `专属 ${weapon.exclusiveCallsign}`}</button>
          </article>
        `;
    }).join('')}</div>`}
        <div class="pilot-recruit-actions">
          <button class="pilot-recruit-action secondary" data-supply-action="single" ${profileState.diamonds < 20 ? 'disabled' : ''}>
            <span>抽取 1 次</span><small>◆ 20</small>
          </button>
          <button class="pilot-recruit-action" data-supply-action="ten" ${profileState.diamonds < 180 ? 'disabled' : ''}>
            <span>抽取 10 次</span><small>◆ 180 · ${supplyPityNote}</small>
          </button>
        </div>
      `,
    }),
  };
  const panel = (panels[tabId] || panels.fighter)();
  destroyGrowthPanel(growthPanelCache.get(tabId));
  const isAssemblyPanel = tabId === 'loadout' || tabId === 'assembly' || tabId === 'weapons';
  const root = document.createElement('div');
  root.className = 'growth-panel-root';
  root.dataset.growthPanel = tabId;
  root.innerHTML = panel.html;
  const entry = {
    tabId,
    root,
    eyebrow: panel.eyebrow,
    title: panel.title,
    isAssemblyPanel,
    assemblySystem: tabId === 'loadout' || tabId === 'weapons' ? 'weapon' : 'fixed',
    scrollInContent: tabId === 'loadout' || tabId === 'supply',
    scrollTop: 0,
    assemblyBay: null,
    airframePreview: null,
    mountTimer: 0,
    previewTimer: 0,
    resumeTimer: 0,
    destroyed: false,
  };
  growthPanelCache.set(tabId, entry);
  activateGrowthPanel(entry);
  root.querySelector('[data-view-pilot-art]')?.addEventListener('click', () => openPilotArt(activePilot));
  root.querySelectorAll('[data-profile-upgrade]').forEach((button) => {
    button.addEventListener('click', (event) => {
      upgradeProfile(event.currentTarget.dataset.profileUpgrade);
    });
  });
  root.querySelectorAll('[data-supply-action]').forEach((button) => {
    button.addEventListener('click', () => claimSupply(button.dataset.supplyAction));
  });
  root.querySelectorAll('[data-gacha-pool]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedGachaPoolId = button.dataset.gachaPool;
      renderGrowthPanel('supply');
    });
  });
  root.querySelectorAll('[data-equip-gacha-weapon]').forEach((button) => {
    button.addEventListener('click', () => {
      if (equipGachaWeapon(button.dataset.equipGachaWeapon)) {
        showToast('主武器已装备 · 将替换基础射击');
        renderGrowthPanel('supply');
      }
    });
  });
  root.querySelectorAll('[data-pilot-id]').forEach((card) => {
    card.addEventListener('click', () => {
      const pilot = SSR_PILOTS.find((entry) => entry.id === card.dataset.pilotId);
      if (tabId === 'supply' && pilot) {
        openPilotArt(pilot);
        return;
      }
      if (!selectPilot(card.dataset.pilotId)) {
        showToast('尚未获得该机甲少女');
        return;
      }
      syncPlayerAssemblyVisual();
      updateLobbyHeader();
      renderGrowthPanel(tabId);
      showToast(`${getActivePilot().name} · 已设为出击角色`);
    });
    card.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      card.click();
    });
  });
  root.querySelector('[data-assembly-reset]')?.addEventListener('click', () => {
    resetAssembly(tabId === 'loadout' || tabId === 'weapons' ? 'weapon' : 'fixed');
    renderGrowthPanel(tabId);
    showToast('已恢复推荐配置');
  });
  return entry;
}

function switchLobbyTab(tabId) {
  if (usePeripheralLobby) {
    activeLobbyTab = tabId;
    pixiLobby?.switchTab(tabId);
    return;
  }
  const battleActive = tabId === 'battle';
  if (
    activeLobbyTab === tabId
    && (battleActive ? !ui.battleHome.hidden : activeGrowthPanel?.tabId === tabId)
  ) return;
  activeLobbyTab = tabId;
  ui.lobbyNav.querySelectorAll('[data-lobby-tab]').forEach((button) => {
    button.classList.toggle('active', button.dataset.lobbyTab === tabId);
  });
  ui.battleHome.hidden = !battleActive;
  ui.growthView.hidden = battleActive;
  if (battleActive) {
    deactivateGrowthPanel();
    renderStageSelector();
  }
  else showGrowthPanel(tabId);
}

function rankScoreEntries(scores) {
  return [...scores].sort((a, b) => {
    const clearDelta = Number(b.victory) - Number(a.victory);
    if (clearDelta) return clearDelta;
    if (a.victory && b.victory) return Number(b.score) - Number(a.score) || Number(a.time) - Number(b.time);
    return Number(b.time) - Number(a.time) || Number(b.score) - Number(a.score);
  }).slice(0, 12);
}

function renderLeaderboard(scores) {
  const ranked = rankScoreEntries(scores);
  ui.leaderboardList.replaceChildren();
  ui.leaderboardStatus.textContent = ranked.length ? `已记录 ${ranked.length} 条最近战绩` : '还没有飞行员留下战绩';
  ranked.forEach((entry, index) => {
    const item = document.createElement('li');
    const rank = document.createElement('b');
    rank.textContent = String(index + 1).padStart(2, '0');
    const pilot = document.createElement('span');
    const name = document.createElement('strong');
    name.textContent = entry.name || '飞行员';
    const progress = document.createElement('small');
    const stageNumber = String((Number(entry.stageIndex) || 0) + 1).padStart(2, '0');
    const stageName = entry.stageName || CAMPAIGN[Number(entry.stageIndex) || 0]?.name || '未知战区';
    const difficultyLabel = DIFFICULTY_MAP.get(entry.difficulty)?.label || '简单';
    const stars = Math.max(0, Math.min(3, Number(entry.stars) || 0));
    progress.textContent = entry.victory
      ? `第 ${stageNumber} 章 · ${difficultyLabel} · ${stars}星`
      : `第 ${stageNumber} 章 · ${difficultyLabel} · 坚守 ${formatTime(Number(entry.time) || 0)}`;
    pilot.append(name, progress);
    const score = document.createElement('em');
    score.textContent = `${String(Math.floor(Number(entry.score) || 0)).padStart(6, '0')}\n${formatTime(Number(entry.time) || 0)}`;
    item.append(rank, pilot, score);
    ui.leaderboardList.appendChild(item);
  });
}

function localScores() {
  try { return JSON.parse(localStorage.getItem('thunder-route-scores') || '[]').filter((entry) => entry.mode === 'chapter-v3'); }
  catch { return []; }
}

function saveLocalScore(entry) {
  const scores = rankScoreEntries([...localScores(), entry]);
  try {
    localStorage.setItem('thunder-route-scores', JSON.stringify(scores));
  } catch {
    // Platform submission remains authoritative when local storage is full or
    // unavailable in an embedded preview.
  }
  return scores;
}

function getBestLeaderboardSubmission() {
  const entries = rankScoreEntries(localScores());
  const best = entries[0];
  if (!best) return null;
  const highestCleared = Number(campaignState.highestCleared);
  const chapter = Math.max(
    0,
    Number.isFinite(highestCleared) ? highestCleared + 1 : 0,
    best.victory ? Number(best.stageIndex) + 1 : 0,
  );
  return {
    score: Math.max(0, Math.floor(Number(best.score) || 0)),
    chapter,
    name: best.name || game.callsign || '飞行员',
    stageIndex: Math.max(0, Math.floor(Number(best.stageIndex) || 0)),
    victory: Boolean(best.victory),
  };
}

async function requestLeaderboardProfile() {
  if (typeof requestUserProfile !== 'function') return null;
  let profile = null;
  try {
    profile = await requestUserProfile();
  } catch {
    return null;
  }
  const payload = getBestLeaderboardSubmission();
  if (!profile || !payload) return profile;
  const submission = {
    ...payload,
    name: profile.name || payload.name,
  };
  const tasks = [
    submitPlatformLeaderboards?.(submission),
    submitWorldLeaderboard?.(submission),
  ].filter(Boolean);
  await Promise.all(tasks.map((task) => Promise.resolve(task).catch(() => null)));
  return profile;
}

function to4399RankScore(entry) {
  // The platform leaderboard displays the submitted value as-is.
  return Math.max(0, Math.min(2_147_483_647, Math.floor(Number(entry.score) || 0)));
}

function open4399Leaderboard() {
  return show4399Ranking(get4399Api());
}

async function loadLeaderboard() {
  ui.leaderboardStatus.textContent = '正在读取战绩……';
  try {
    const response = await fetch('/api/scores', { cache: 'no-store' });
    if (!response.ok) throw new Error('Leaderboard unavailable');
    const data = await response.json();
    renderLeaderboard(data.scores || []);
  } catch {
    renderLeaderboard(localScores());
    ui.leaderboardStatus.textContent += ' · 本机榜';
  }
}

function openLeaderboard() {
  if (game.state === 'evolving') return;
  if (open4399Leaderboard()) return;
  game._rankReturnState = game.state;
  if (game.state === 'playing') {
    game.state = 'paused';
    sdkGameplayStop();
  }
  ui.leaderboardOverlay.classList.add('visible');
  loadLeaderboard();
}

function closeLeaderboard() {
  ui.leaderboardOverlay.classList.remove('visible');
  if (game.state === 'paused') {
    game.state = game._rankReturnState === 'playing' ? 'playing' : 'menu';
    if (game.state === 'playing') sdkGameplayStart();
  }
}

async function submitRunScore(victory) {
  if (game.scoreSubmitted) return;
  game.scoreSubmitted = true;
  if (!leaderboardEnabled) return;
  const config = CAMPAIGN[Math.min(game.stageIndex, CAMPAIGN.length - 1)];
  const entry = {
    mode: 'chapter-v3',
    name: game.callsign,
    stageIndex: game.stageIndex,
    stageName: config.name,
    difficulty: game.difficultyId,
    stars: game.completionSummary?.stars || 0,
    bossesDefeated: game.stageBossesDefeated,
    score: Math.floor(game.score),
    time: Math.floor(game.elapsed),
    victory,
  };
  try {
    if (submitPlatformLeaderboards || submitWorldLeaderboard) {
      const highestCleared = Number(campaignState.highestCleared);
      const currentCleared = victory ? Number(game.stageIndex) : -1;
      const chapter = Math.max(0, highestCleared + 1, currentCleared + 1);
      const leaderboardPayload = {
        score: entry.score,
        chapter,
        name: entry.name,
        stageIndex: entry.stageIndex,
        victory: entry.victory,
      };
      const submissionTasks = [
        submitPlatformLeaderboards?.(leaderboardPayload),
        submitWorldLeaderboard?.(leaderboardPayload),
      ].filter(Boolean);
      const submissions = await Promise.all(submissionTasks.map((task) => (
        Promise.resolve(task).then(
          (value) => ({ value }),
          (error) => ({ error }),
        )
      )));
      if (submissions.some(({ value }) => value?.submitted)) {
        // Keep a local copy even when a platform request succeeds. It lets a
        // later leaderboard tap retry a failed friend-board write without
        // asking the player to complete the stage again.
        saveLocalScore(entry);
        return;
      }
    }
    if (canSubmit4399Ranking(get4399Api(), H4399_RANK_ID)) {
      await submit4399Ranking(to4399RankScore(entry), { rankId: H4399_RANK_ID });
      return;
    }
    const response = await fetch('/api/scores', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry),
    });
    if (!response.ok) throw new Error('Score submit failed');
    const data = await response.json();
    renderLeaderboard(data.scores || []);
  } catch {
    const scores = saveLocalScore(entry);
    renderLeaderboard(scores);
    ui.leaderboardStatus.textContent += ' · 本机榜';
  }
}

function updateUI() {
  game.high = Math.max(game.high, game.score);
  ui.score.textContent = String(Math.floor(game.score)).padStart(6, '0');
  ui.high.textContent = String(Math.floor(game.high)).padStart(6, '0');
  ui.lives.textContent = `${Math.max(0, Math.ceil(game.hp))}`;
  for (const button of ui.activeWeaponButtons) {
    const shortcut = Number(button.dataset.activeSlot);
    const weapon = activeWeaponForShortcut(shortcut);
    const active = weapon?.active;
    const icon = button.querySelector('span');
    const status = button.querySelector('b');
    if (!active) {
      icon.textContent = '＋';
      status.textContent = '--';
      button.style.setProperty('--active-color', '#53737a');
      button.style.setProperty('--cooldown-angle', '0deg');
      button.classList.add('empty');
      button.classList.remove('ready', 'cooling', 'depleted');
      button.disabled = true;
      button.setAttribute('aria-label', `自动挂点 ${shortcut}，空`);
      continue;
    }

    const color = `#${(weapon.color || COLORS.cyan).toString(16).padStart(6, '0')}`;
    const cooldownRatio = Math.max(
      0,
      Math.min(1, weapon.cooldown / Math.max(0.1, weapon.cooldownDuration || active.cooldown)),
    );
    const stateLabel = weapon.cooldown > 0
      ? `${weapon.cooldown.toFixed(1)} 秒后自动触发`
      : '正在自动触发';
    icon.textContent = active.icon || 'Λ';
    status.textContent = `等级${weapon.level}`;
    button.style.setProperty('--active-color', color);
    button.style.setProperty('--cooldown-angle', `${cooldownRatio * 360}deg`);
    button.classList.remove('empty');
    if(button.__feedbackWeapon!==weapon){button.__feedbackWeapon=weapon;button.__feedbackActivationAt=weapon.feedbackActivationAt;}
    if(weapon.feedbackActivationAt!==button.__feedbackActivationAt){
      button.__feedbackActivationAt=weapon.feedbackActivationAt;
      button.getAnimations().forEach(a=>a.cancel());
      if(button.getBoundingClientRect().width && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
        button.animate([{filter:'brightness(1)'},{filter:'brightness(1.65)'},{filter:'brightness(1)'}],{duration:280});
    }
    button.classList.toggle('ready', weapon.cooldown <= 0);
    button.classList.toggle('cooling', weapon.cooldown > 0);
    button.classList.remove('depleted');
    button.disabled = false;
    button.setAttribute('aria-label', `自动挂点 ${shortcut}，${active.name}，等级${weapon.level}，${stateLabel}`);
  }
  ui.runLevel.textContent = `等级${game.level}`;
  if (ui.combatPilotAvatarLevel) {
    ui.combatPilotAvatarLevel.textContent = `等级${Math.max(1, Math.round(Number(game.level) || 1))}`;
  }
  if (ui.combatPilotAvatarResonance) {
    const activePilot = getActivePilot();
    ui.combatPilotAvatarResonance.textContent = `共鸣 ${getPilotState().resonance[activePilot.id] || 0}`;
  }
  ui.runTimer.textContent = formatTime(game.elapsed);
  ui.stageLabel.textContent = '经验';
  ui.killCount.textContent = String(game.kills).padStart(3, '0');
  ui.liveScore.textContent = String(Math.floor(game.score));
  ui.liveKills.textContent = String(game.kills);
  if (ui.liveCombo) ui.liveCombo.textContent = `×${Math.max(1, game.combo)}`;
  const flightGrade = flightGradeFor();
  ui.flightGrade.textContent = flightGrade.id;
  ui.flightQuality.dataset.grade = flightGrade.id;
  ui.flightQuality.classList.toggle('chained', game.flightChain >= 2 && game.flightChainTimer > 0);
  ui.flightQuality.setAttribute('aria-label', `飞行品质 ${flightGrade.id}，品质分 ${game.flightQuality}`);
  if (game.flightChainTimer > 0 && game.flightQuality > 0) {
    ui.flightFeedPoints.textContent = flightComboLabel(game.flightChain);
    ui.flightFeed.classList.add('visible');
  }
  const xpPercent = Math.min(100, game.xp / game.xpNext * 100);
  ui.xpBar.style.width = `${xpPercent}%`;
  ui.runProgress.style.setProperty('--ring-progress', `${xpPercent * 3.6}deg`);
  ui.xpText.textContent = `${Math.floor(game.xp)} / ${game.xpNext}`;
  const stageConfig = CAMPAIGN[Math.min(game.stageIndex, CAMPAIGN.length - 1)];
  const currentStageProgress = battleProgress(game, boss, stageWaveTime(stageConfig));
  const stagePercent = Math.floor(currentStageProgress * 100);
  ui.campaignProgressBar.style.width = '100%';
  ui.campaignProgressBar.style.height = `${currentStageProgress * 100}%`;
  ui.campaignProgress.style.setProperty('--ring-progress', `${currentStageProgress * 360}deg`);
  ui.campaignProgressText.textContent = game.victory ? '100%' : `${stagePercent}%`;
  const healthPercent = Math.max(0, Math.min(100, game.hp / Math.max(1, runStats.maxHp) * 100));
  ui.playerHealthBar.style.width = `${healthPercent}%`;
  ui.playerHealthLabel.textContent = '耐久';
  ui.playerHealthText.textContent = `${Math.max(0, Math.ceil(game.hp))} / ${runStats.maxHp}`;
  ui.playerHealth.classList.toggle('danger', (game.state === 'playing' || game.state === 'dying' || game.state === 'revive-prompt') && healthPercent <= 25);
  syncUpgradeAdButtons();
  if (game.pilotShieldReady) {
    ui.shieldStatus.classList.add('visible');
    ui.shieldStatus.textContent = '天穹圣域 · 免疫 1 次';
  } else if (game.pilotBarrierHp > 0 && game.pilotBarrierTime > 0) {
    ui.shieldStatus.classList.add('visible');
    ui.shieldStatus.textContent = `生命护盾 ${Math.ceil(game.pilotBarrierHp)} · ${game.pilotBarrierTime.toFixed(1)}秒`;
  } else if (runStats.shieldLevel > 0) {
    ui.shieldStatus.classList.add('visible');
    ui.shieldStatus.textContent = !skillActive('shield') ? '护盾封印' : game.shieldReady ? '护盾就绪' : `护盾 ${Math.ceil(game.shieldTimer)}秒`;
  } else ui.shieldStatus.classList.remove('visible');
  if (game.sealedSkillId) {
    ui.sealStatus.classList.add('visible');
    ui.sealStatus.textContent = `清缴封印 · ${SKILL_MAP.get(game.sealedSkillId)?.name || game.sealedSkillId}`;
  } else ui.sealStatus.classList.remove('visible');
  if (boss && !boss.dead) {
    const pct = Math.max(0, boss.hp / boss.maxHp * 100);
    ui.bossBar.style.width = `${pct}%`;
    ui.bossPercent.textContent = `${Math.ceil(pct)}%`;
    ui.bossName.textContent = boss.visualSpec?.name || boss.config.name;
  }
  shell.classList.toggle('boss-active', Boolean(boss && !boss.dead));
  if (game.combo >= 2 && game.comboTimer > 0) {
    ui.combo.innerHTML = `连击 × <b>${game.combo}</b>`;
    ui.combo.classList.add('visible');
  } else ui.combo.classList.remove('visible');
}

function updateCombatSkillDock() {
  if (!ui.skillDock) return;
  const routeLevels = new Map(ROUTES.map((route) => [route.id, 0]));
  for (const [id, level] of Object.entries(game.skills)) {
    const skill = SKILL_MAP.get(id);
    if (!skill) continue;
    routeLevels.set(skill.path, (routeLevels.get(skill.path) || 0) + level);
  }
  const sealedPath = SKILL_MAP.get(game.sealedSkillId)?.path;
  const visibleRoutes = ROUTES
    .filter((route) => route.id === 'split' || (routeLevels.get(route.id) || 0) > 0)
    .sort((a, b) => {
      if (a.id === 'split') return -1;
      if (b.id === 'split') return 1;
      return (routeLevels.get(b.id) || 0) - (routeLevels.get(a.id) || 0);
    });
  ui.skillDock.replaceChildren();
  for (const route of visibleRoutes) {
    const level = (route.id === 'split' ? 1 : 0) + (routeLevels.get(route.id) || 0);
    const slot = document.createElement('div');
    slot.className = `combat-skill${route.id === 'split' ? ' base' : ''}${sealedPath === route.id ? ' sealed' : ''}`;
    slot.style.setProperty('--skill-color', route.id === 'split' ? '#eefbf7' : route.color);
    slot.setAttribute('aria-label', `${route.name} ${level}级${sealedPath === route.id ? '，当前被封印' : ''}`);
    const icon = document.createElement('i');
    icon.textContent = route.id === 'split' ? '│' : route.icon;
    const rank = document.createElement('b');
    rank.textContent = String(level);
    slot.append(icon, rank);
    ui.skillDock.appendChild(slot);
  }
}

function renderEvolutionPips(container, progress) {
  if (!container || !progress) return;
  const total = Math.max(1, progress.required || 1);
  container.style.setProperty('--evolution-steps', String(total));
  container.replaceChildren();
  for (let index = 0; index < total; index += 1) {
    const pip = document.createElement('i');
    if (index < progress.completed || progress.crafted) pip.className = 'filled';
    container.appendChild(pip);
  }
  container.setAttribute(
    'aria-label',
    `${progress.name}蓝图进度 ${progress.crafted ? total : progress.completed} / ${total}`,
  );
}

function evolutionMissingText(progress) {
  if (!progress) return '';
  const missing = progress.requirements
    .filter((requirement) => !requirement.complete)
    .map((requirement) => `${requirement.name.replace(/^激活·/, '')} ${requirement.current}/${requirement.required}`);
  return missing.length ? `尚缺 ${missing.slice(0, 2).join(' · ')}` : '配方完成 · 正在重构武装';
}

function updateEvolutionTracker() {
  if (!ui.evolutionTracker) return;
  const path = game.primarySkillPath;
  const route = ROUTE_MAP.get(path);
  const progress = path ? getUltimateProgress(game.skills, path, game.ultimateStageTwoTasks?.[path]) : null;
  const complete = Boolean(progress?.crafted);
  ui.evolutionTracker.classList.toggle('active', Boolean(progress) && !complete);
  ui.evolutionTracker.classList.toggle('locked', Boolean(progress) && !complete);
  ui.evolutionTracker.classList.toggle('ready', Boolean(progress?.ready) && !complete);
  ui.evolutionTracker.classList.toggle('complete', complete);
  if (!route || !progress) {
    ui.evolutionTracker.style.setProperty('--evolution-color', '#b7a3ff');
    ui.evolutionRequirement.textContent = '首次升级选择主武器并生成蓝图';
    const placeholder = { name: '终极蓝图', required: 5, completed: 0, crafted: false };
    renderEvolutionPips(ui.evolutionPips, placeholder);
    return;
  }
  ui.evolutionTracker.style.setProperty('--evolution-color', route.color);
  ui.evolutionRequirement.textContent = progress.crafted
    ? path === 'red'
      ? '猎杀标记 · 三击爆破 · 击破连锁'
      : '终极武装已完成'
    : progress.stageOneCrafted
      ? `二段任务 · 再完成本路线任意强化 ${progress.completed}/${progress.required}`
    : evolutionMissingText(progress);
  renderEvolutionPips(ui.evolutionPips, progress);
}

function updateBuildList() {
  updateCombatSkillDock();
  updateEvolutionTracker();
  const allowedPaths = game.allowedSkillPaths || accountSkillPathIds();
  const dominantPaths = getDominantPaths(game.skills);
  const ownedPaths = getOwnedPaths(game.skills);
  const specialOwnedPaths = ownedPaths.filter((path) => path !== 'split');
  const skillPathStatus = ownedPaths.length > 5
    ? `技能 ${ownedPaths.length}/5 · 广告突破`
    : `技能 ${ownedPaths.length}/5`;
  const route = ROUTE_MAP.get(dominantPaths[0]);
  ui.routeBadge.className = `route-badge${route ? ` active ${route.id}` : ''}`;
  ui.routeName.textContent = route ? `当前投入最高 · ${route.icon} ${route.name}` : '基础白弹';
  ui.routeChain.textContent = specialOwnedPaths.length
    ? `${skillPathStatus} · 本局 ${specialOwnedPaths.map((id) => ROUTE_MAP.get(id)?.name).join(' / ')}`
    : `${skillPathStatus} · 12套主武器全部参与轮换`;
  ui.buildList.replaceChildren();
  const entries = Object.entries(game.skills)
    .map(([id, level]) => ({ skill: SKILL_MAP.get(id), level }))
    .filter(({ skill }) => skill)
    .sort((a, b) => b.level - a.level);
  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'build-empty';
    empty.textContent = '本局升级后将自动记录构筑';
    ui.buildList.appendChild(empty);
    return;
  }
  for (const { skill, level } of entries) {
    const item = document.createElement('div');
    item.className = `build-skill ${skill.rarity}`;
    const icon = document.createElement('i');
    icon.textContent = skill.icon;
    const name = document.createElement('span');
    name.textContent = skill.name;
    const rank = document.createElement('b');
    rank.textContent = `${level}级`;
    item.append(icon, name, rank);
    ui.buildList.appendChild(item);
  }
}

function drawMainWeaponChoices() {
  if (!Array.isArray(game.mainWeaponOfferBag)) game.mainWeaponOfferBag = [];
  while (game.mainWeaponOfferBag.length < 3) {
    game.mainWeaponOfferBag.push(...createMainWeaponOfferBag());
  }
  return game.mainWeaponOfferBag
    .splice(0, 3)
    .map((skillId) => SKILL_MAP.get(skillId))
    .filter(Boolean);
}

function syncFixedGrowth() {
  const state = game.fixedGrowth.state;
  for (const key of ['level', 'xp', 'xpNext', 'pendingLevels']) game[key] = state[key];
}

function saveFixedGrowthCheckpoint() {
  if (!game.fixedPartsMode || !game.fixedGrowth || game.fixedGrowth.state.ended) return null;
  game.fixedCheckpoint = JSON.parse(JSON.stringify(game.fixedGrowth.snapshot()));
  return structuredClone(game.fixedCheckpoint);
}

function restoreFixedGrowthCheckpoint() {
  if (!game.fixedCheckpoint || !game.fixedCombat.restoreGrowth(game.fixedCheckpoint)) return false;
  game.fixedGrowth = game.fixedCombat.growth;
  syncFixedGrowth();
  if (game.state === 'levelup') renderFixedUpgradeChoices();
  return true;
}

function gainFixedXp(amount) {
  if (!game.fixedGrowth || game.fixedGrowth.state.ended) return;
  const previousLevel = game.fixedGrowth.state.level;
  // The 1+1 prototype needs enough investments to reach a capstone within
  // the existing ten waves; the legacy mode keeps its original XP economy.
  const gained = game.fixedGrowth.gainXp(amount * 3 * (runStats.xpMultiplier || 1));
  const research = game.peripheralSnapshot?.stats.researchModifiers || {};
  if (gained) game.hp = Math.min(runStats.maxHp, game.hp + gained * ((research.levelHealFlat || 0) + runStats.maxHp * (research.levelHealRatio || 0)));
  syncFixedGrowth(); updateUI();
  if (game.pendingLevels && game.state === 'playing') openLevelUp();
  showRunLevelFeedback(previousLevel, game.level);
}

function renderFixedUpgradeChoices() {
  const offer = game.fixedGrowth.offer();
  if (!offer) return;
  currentUpgradeChoices = offer.cards.map(card => ({ ...card, token: { runId: offer.runId, offerId: offer.offerId, buildVersion: offer.buildVersion } }));
  ui.upgradeEyebrow.textContent = '固定件成长'; ui.upgradeTitle.textContent = '选择一项升级';
  ui.upgradeCopy.textContent = `待选 ${game.pendingLevels} 级 · 仅当前有效装配`;
  ui.takeAllButton.classList.add('hidden'); ui.rerollButton.disabled = !game.fixedGrowth.state.rerolls;
  ui.rerollButton.textContent = `免费重抽 · 剩余 ${game.fixedGrowth.state.rerolls} 次`;
  ui.upgradeCards.replaceChildren();
  for (const skill of currentUpgradeChoices) {
    const button = document.createElement('button'); button.className = 'upgrade-card';
    button.textContent = `${skill.ownerName} ${skill.slots.join('/')} · ${skill.name}：${skill.description} ${skill.restriction}`;
    button.addEventListener('click', () => chooseFixedUpgrade(skill)); ui.upgradeCards.append(button);
  }
  saveFixedGrowthCheckpoint(); pixiCombatUi?.render();
}

function chooseFixedUpgrade(skill) {
  if (game.state !== 'levelup' || !skill?.token || !game.fixedGrowth.choose(skill.token, skill.id, skill.ownerId)) return false;
  syncFixedGrowth(); game.fixedCombat.syncBuild(); sfx.upgrade();
  showWeaponUpgradeFeedback(skill);
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) ringEffect(player.x, player.y, 0x95edff, 65, .38);
  if (game.pendingLevels) renderFixedUpgradeChoices();
  else { currentUpgradeChoices = []; ui.upgradeOverlay.classList.remove('visible'); resetRelativeDrag(); game.state = 'playing'; sdkGameplayStart(); }
  saveFixedGrowthCheckpoint(); updateUI(); pixiCombatUi?.render();
  traceBrowserFlight('upgrade-complete', {}, { skill: skill.id }); return true;
}

function rerollFixedUpgrade() {
  if (!game.fixedPartsMode || game.state !== 'levelup') return false;
  if (!game.fixedGrowth.reroll(game.fixedGrowth.state.offer)) return false;
  renderFixedUpgradeChoices(); return true;
}

document.addEventListener('visibilitychange', () => {
  if (!game.fixedPartsMode || !game.fixedGrowth || game.fixedGrowth.state.ended) return;
  if (document.hidden) {
    saveFixedGrowthCheckpoint();
    if (game.state === 'playing') { game.state = 'paused'; game.pauseReturnState = 'playing'; game.pauseMode = ''; sdkGameplayStop(); }
  } else restoreFixedGrowthCheckpoint();
});

function renderUpgradeChoices() {
  if (game.fixedPartsMode) return renderFixedUpgradeChoices();
  const allowedPaths = game.allowedSkillPaths || accountSkillPathIds();
  const ownedPaths = getOwnedPaths(game.skills);
  const specialOwnedPaths = ownedPaths.filter((path) => path !== 'split');
  const dominantPaths = getDominantPaths(game.skills);
  const selectingMainRoute = !game.primarySkillPath && specialOwnedPaths.length === 0;
  const primaryRoute = ROUTE_MAP.get(game.primarySkillPath);
  ui.upgradeEyebrow.textContent = selectingMainRoute
    ? '本局构筑 · 主武器协议'
    : `${primaryRoute?.name || '技能池'} · 本局路线 ${specialOwnedPaths.length}`;
  ui.upgradeTitle.textContent = selectingMainRoute ? '锁定一条主武器路线' : '选择一项升级';
  ui.upgradeCopy.textContent = selectingMainRoute
    ? '12套主武器使用无重复轮换 · 每四次展示完整走完一轮'
    : '主武器任务保底 1 张 · 其余全池随机';
  ui.rerollButton.classList.remove('hidden');
  ui.takeAllButton.classList.remove('hidden');
  ui.upgradeCards.classList.remove('route-mode');
  const choices = selectingMainRoute
    ? drawMainWeaponChoices()
    : getSkillChoices(game.skills, 3, {
      allowedPaths,
      primary: game.primarySkillPath,
      ultimateStageTwoTasks: game.ultimateStageTwoTasks,
    });
  currentUpgradeChoices = choices;
  ui.upgradeCards.replaceChildren();
  if (!choices.length) {
    currentUpgradeChoices = [];
    game.pendingLevels = 0;
    resetRelativeDrag();
    game.state = 'playing';
    sdkGameplayStart();
    ui.upgradeOverlay.classList.remove('visible');
    return;
  }
  syncUpgradeAdButtons();
  for (const skill of choices) {
    const nextLevel = (game.skills[skill.id] || 0) + 1;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `upgrade-card ${skill.rarity}`;
    const route = ROUTE_MAP.get(skill.path);
    const highestInvestment = dominantPaths[0] === skill.path;
    const mainRouteChoice = game.primarySkillPath === skill.path;
    if (highestInvestment) card.classList.add('recommended');
    if (mainRouteChoice) card.classList.add('recommended');
    card.style.setProperty('--skill-color', route?.color || '#78f1e5');
    const rarity = document.createElement('small');
    rarity.className = 'upgrade-rarity';
    rarity.textContent = `${selectingMainRoute ? '主武器蓝图' : skill.starter ? '新技能激活' : route?.name || '技能强化'} · ${RARITIES[skill.rarity].label}`;
    const kindBadge = document.createElement('em');
    kindBadge.className = `upgrade-kind ${skill.starter ? 'unlock' : 'enhance'}`;
    kindBadge.textContent = selectingMainRoute ? '锁定' : skill.starter ? '解锁' : '强化';
    const icon = document.createElement('i');
    icon.className = 'upgrade-icon';
    icon.textContent = skill.icon;
    const title = document.createElement('strong');
    title.textContent = skill.name;
    const description = document.createElement('span');
    description.textContent = getSkillDescription(skill, nextLevel).split('；')[0];
    const rank = document.createElement('b');
    rank.textContent = `等级 ${nextLevel} / ${skill.maxLevel}`;
    card.append(rarity, kindBadge, icon, title, description);
    if (skill.buff) {
      const buff = document.createElement('small');
      buff.className = 'upgrade-buff';
      buff.textContent = `增益 · ${skill.buff}`;
      card.append(buff);
    }
    const trackedPath = game.primarySkillPath || (skill.starter ? skill.path : null);
    if (trackedPath && skill.path === trackedPath) {
      const previewSkills = { ...game.skills, [skill.id]: nextLevel };
      const progress = getUltimateProgress(previewSkills, trackedPath, game.ultimateStageTwoTasks?.[trackedPath]);
      if (progress) {
        const evolution = document.createElement('div');
        evolution.className = 'upgrade-evolution-progress';
        evolution.style.setProperty('--evolution-color', route?.color || '#b7a3ff');
        const label = document.createElement('span');
        label.append(`${progress.name} `);
        const count = document.createElement('b');
        count.textContent = `${progress.completed} / ${progress.required}`;
        label.appendChild(count);
        const pips = document.createElement('div');
        pips.className = 'evolution-pips';
        renderEvolutionPips(pips, progress);
        evolution.append(label, pips);
        card.appendChild(evolution);
      }
    }
    card.append(rank);
    card.addEventListener('click', () => chooseSkill(skill));
    ui.upgradeCards.appendChild(card);
  }
}

function openLevelUp() {
  if (game.pendingLevels <= 0 || game.state !== 'playing') return;
  resetRelativeDrag();
  game.state = 'levelup';
  sdkGameplayStop();
  sfx.flameLoop(false);
  sfx.laserLoop(false);
  ui.upgradeOverlay.classList.add('visible');
  renderUpgradeChoices();
  sfx.tone(420, 0.18, 'sine', 0.045, 420);
}

function applySkillUpgrade(skill) {
  if (!skill || (game.skills[skill.id] || 0) >= skill.maxLevel) return null;
  const level = (game.skills[skill.id] || 0) + 1;
  game.skills[skill.id] = level;
  skill.apply({ stats: runStats, game }, level);
  const capId = `${skill.path}_cap`;
  if (
    skill.path
    && !skill.id.endsWith('_cap')
    && (game.skills[capId] || 0) === 1
  ) {
    game.ultimateStageTwoTasks ||= {};
    game.ultimateStageTwoTasks[skill.path] = Math.min(
      ULTIMATE_STAGE_TWO_TASKS,
      (Number(game.ultimateStageTwoTasks[skill.path]) || 0) + 1,
    );
  }
  sfx.upgrade();
  if (!game.primarySkillPath && (skill.starter || skill.path === 'split')) {
    game.primarySkillPath = skill.path;
  }
  return level;
}

function applyBossTestLoadout() {
  if (!bossTestLoadout || bossTestLoadout.id !== 'ultimate') return;
  const routeSkills = [...SKILL_MAP.values()]
    .filter((skill) => skill.path === bossTestLoadout.route && !skill.id.endsWith('_cap'));
  for (const skill of routeSkills) {
    while ((game.skills[skill.id] || 0) < skill.maxLevel) applySkillUpgrade(skill);
  }
  const capstone = SKILL_MAP.get(`${bossTestLoadout.route}_cap`);
  while (capstone && (game.skills[capstone.id] || 0) < capstone.maxLevel) applySkillUpgrade(capstone);
}

function craftReadyUltimates({ secondStageOnly = false } = {}) {
  const ready = getReadyUltimateRecipes(game.skills, game.ultimateStageTwoTasks)
    .filter((progress) => !secondStageOnly || progress.nextStage === 2);
  const crafted = [];
  for (const progress of ready) {
    const cap = SKILL_MAP.get(progress.capId);
    if (!cap || (game.skills[cap.id] || 0) >= cap.maxLevel) continue;
    const level = (game.skills[cap.id] || 0) + 1;
    game.skills[cap.id] = level;
    cap.apply({ stats: runStats, game }, level);
    if (level === 1) {
      game.ultimateStageTwoTasks ||= {};
      game.ultimateStageTwoTasks[progress.path] = 0;
    }
    crafted.push({
      ...progress,
      crafted: true,
      completed: progress.required,
      stage: level,
      skill: cap,
    });
  }
  return crafted.sort((a, b) => (
    Number(b.path === game.primarySkillPath) - Number(a.path === game.primarySkillPath)
  ));
}

function ultimateEvolutionCopy(evolution) {
  const stage = evolution.stage || evolution.nextStage || 1;
  if (evolution.path === 'red' && stage >= 2) return '全场索敌 · 三击爆破 · 标记击破触发连锁';
  return `第 ${stage} 段 · ${getSkillDescription(evolution.skill, stage).split('；')[0]}`;
}

function activateUltimateEvolution(evolution) {
  const route = ROUTE_MAP.get(evolution.path);
  // 终极进化必须是一段完整的战斗中断演出。不能跟随系统“减少动态
  // 效果”被压缩到几百毫秒，否则玩家根本看不清角色和终极武装名称。
  const durationMs = 4200;
  game.evolutionCurrent = evolution;
  game.evolutionTimer = 0;
  game.evolutionDuration = durationMs / 1000;
  game.evolutionDeadline = performance.now() + durationMs;
  ui.evolutionOverlay.style.setProperty('--evolution-color', route?.color || '#e7ff78');
  ui.evolutionOverlayIcon.textContent = evolution.icon || route?.icon || '✦';
  ui.evolutionOverlayName.textContent = `${evolution.name} · 第${evolution.stage || 1}段`;
  ui.evolutionOverlayCopy.textContent = ultimateEvolutionCopy(evolution);
  ui.evolutionOverlay.classList.remove('visible');
  void ui.evolutionOverlay.offsetWidth;
  ui.evolutionOverlay.classList.add('visible');
  clearHostileBulletsNear(player.x, player.y, 1200);
  ringEffect(player.x, player.y - 28, Number.parseInt((route?.color || '#e7ff78').slice(1), 16), 240, 0.9);
  burst(player.x, player.y - 28, Number.parseInt((route?.color || '#e7ff78').slice(1), 16), 34, 285);
  game.flash = Math.max(game.flash, 0.78);
  game.shake = Math.max(game.shake, 25);
  sfx.tone(160, 0.62, 'sawtooth', 0.07, 520);
  sfx.tone(480, 0.7, 'sine', 0.045, 520);
  navigator.vibrate?.([45, 35, 90]);
  updateBuildList();
}

function beginUltimateEvolution(evolutions, returnState = 'playing') {
  if (!evolutions.length) return;
  currentUpgradeChoices = [];
  ui.upgradeOverlay.classList.remove('visible');
  game.evolutionQueue = [...evolutions];
  game.evolutionReturnState = returnState;
  game.state = 'evolving';
  sdkGameplayStop();
  activateUltimateEvolution(game.evolutionQueue.shift());
}

function finishUltimateEvolution() {
  const completed = game.evolutionCurrent;
  ui.evolutionOverlay.classList.remove('visible');
  if (completed?.path === 'red' && completed.stage >= 2) {
    fireRedUltimateVolley(3);
    showToast('赤色天网 · 猎杀协议上线');
  } else if (completed?.stage === 1) {
    showToast(`${completed.name} · 一段展开`);
  } else if (completed?.stage === 2) {
    showToast(`${completed.name} · 二段完全展开`);
  }
  if (game.evolutionQueue.length) {
    activateUltimateEvolution(game.evolutionQueue.shift());
    return;
  }
  game.evolutionCurrent = null;
  game.evolutionTimer = 0;
  game.evolutionDuration = 0;
  game.evolutionDeadline = 0;
  if (game.pendingLevels > 0) {
    game.state = 'levelup';
    ui.upgradeOverlay.classList.add('visible');
    renderUpgradeChoices();
  } else {
    game.state = game.evolutionReturnState || 'playing';
    if (game.state === 'playing') sdkGameplayStart();
  }
  game.evolutionReturnState = 'playing';
  updateUI();
}

function previewUltimateEvolution(path = 'blue') {
  const route = ROUTE_MAP.get(path) || ROUTE_MAP.get('blue');
  const skill = SKILL_MAP.get(`${route.id}_cap`);
  if (!skill) return;
  game.pendingLevels = 0;
  // DEBUG 预览需要把同一套“已完成”外形也展示出来；这里只改本局内存，
  // 不调用技能 apply，也不会写入玩家存档。下次正式出击会完整重置。
  game.primarySkillPath = route.id;
  game.skills = {
    ...(game.skills || {}),
    [skill.id]: Math.max(2, Number(game.skills?.[skill.id]) || 0),
  };
  beginUltimateEvolution([{
    path: route.id,
    name: skill.name,
    icon: skill.icon,
    skill,
    crafted: true,
    stage: 2,
  }], 'menu');
  app.ticker.start();
}

function debugCompleteCurrentRun() {
  const stageIndex = Math.max(0, Math.min(CAMPAIGN.length - 1, selectedStageIndex));
  const difficultyId = selectedDifficultyId;
  const stage = CAMPAIGN[stageIndex] || CAMPAIGN[0];
  resetRelativeDrag();
  clearEntities();
  runStats = createRunStats();
  runStats.maxHp = 110;
  game.runEnded = false;
  game.state = 'victory_result';
  sdkGameplayStop();
  game.victory = true;
  game.debugRun = true;
  game.elapsed = 188;
  game.score = 227255;
  game.kills = 311;
  game.level = 18;
  game.hp = runStats.maxHp;
  game.stageIndex = stageIndex;
  game.stageElapsed = stageWaveTime(stage);
  game.difficultyId = difficultyId;
  game.completionRecorded = true;
  game.completionSummary = {
    stars: 3,
    bestStars: 3,
    earned: { coins: 660, diamonds: 20 },
    unlockedModules: [],
    unlockedSkillPath: null,
    difficultyId,
    debugRun: true,
    debugPreview: true,
  };
  game.victoryRewardDoublePending = false;
  game.victoryRewardDoubled = false;
  game.victoryRewardDoubleNotice = false;
  game.reviveAdPending = false;
  ui.resultOverlay.classList.remove('visible');
  ui.victorySequence.classList.remove('visible', 'complete');
  ui.bossWrap.classList.remove('visible');
  ui.deathSequence.classList.remove('visible', 'detonate');
  ui.reviveOverlay.classList.remove('visible');
  ui.pauseOverlay.classList.remove('visible', 'confirm-exit');
  ui.upgradeOverlay.classList.remove('visible');
  ui.evolutionOverlay.classList.remove('visible');
  ui.overlay.classList.remove('visible');
  shell.classList.remove('boss-active', 'run-active');
  sfx.stopCombatLoops();
  sfx.syncMusic();
  app.ticker.start();
  updateUI();
  pixiLobby?.update();
  pixiCombatUi?.update();
  app.renderer.render({ container: app.stage });
  showToast(`调试预览 · ${stage.name} · 已打开通关结算面板`);
}

function updateUltimateEvolution(dt) {
  game.evolutionTimer += dt;
  if (performance.now() >= game.evolutionDeadline) finishUltimateEvolution();
}

function finishUpgradeSelection(toastText, evolutions = []) {
  game.pendingLevels -= 1;
  syncDrones();
  updateBuildList();
  updateUI();
  if (!evolutions.length) {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) ringEffect(player.x, player.y, 0x95edff, 65, .38);
  }
  if (evolutions.length) {
    beginUltimateEvolution(evolutions);
    return;
  }
  if (game.pendingLevels > 0) renderUpgradeChoices();
  else {
    currentUpgradeChoices = [];
    ui.upgradeOverlay.classList.remove('visible');
    resetRelativeDrag();
    game.state = 'playing';
    sdkGameplayStart();
  }
}

function chooseSkill(skill) {
  if (game.fixedPartsMode) return chooseFixedUpgrade(skill);
  if (game.state !== 'levelup') return;
  const level = applySkillUpgrade(skill);
  if (level === null) return;
  const evolutions = craftReadyUltimates();
  finishUpgradeSelection(`${skill.name} · ${level}级`, evolutions);
}

function canTakeAllUpgradeChoices() {
  return game.state === 'levelup'
    && currentUpgradeChoices.length > 1;
}

function syncUpgradeAdButtons() {
  const pending = Boolean(game.upgradeAdAction);
  if (ui.rerollButton) {
    ui.rerollButton.disabled = pending;
    ui.rerollButton.textContent = pending && game.upgradeAdAction === 'reroll'
      ? '广告播放中…'
      : '看广告 · 重选';
  }
  if (ui.takeAllButton) {
    const available = canTakeAllUpgradeChoices();
    ui.takeAllButton.disabled = pending || !available;
    ui.takeAllButton.textContent = pending && game.upgradeAdAction === 'take-all'
      ? '广告播放中…'
      : '看广告 · 我全要';
  }
}

function chooseAllSkills() {
  if (game.fixedPartsMode) return;
  if (!canTakeAllUpgradeChoices()) return;
  const applied = currentUpgradeChoices
    .map((skill) => ({ skill, level: applySkillUpgrade(skill) }))
    .filter(({ level }) => level !== null);
  if (!applied.length) return;
  const evolutions = craftReadyUltimates();
  finishUpgradeSelection(`我全要 · ${applied.length} 项已获得`, evolutions);
}

async function requestUpgradeReward(action) {
  if (game.fixedPartsMode) { if (action === 'reroll') rerollFixedUpgrade(); return; }
  if (game.state !== 'levelup' || rewardedAdPending || game.upgradeAdAction) return;
  if (action === 'take-all' && !canTakeAllUpgradeChoices()) {
    showToast('当前没有可全部获得的升级');
    return;
  }

  game.upgradeAdAction = action;
  rewardedAdPending = true;
  syncUpgradeAdButtons();
  pixiCombatUi?.render();
  showToast(action === 'take-all' ? '完整观看广告即可获得全部升级' : '完整观看广告即可重选');

  try {
    await playRewardedAd();
    if (game.state !== 'levelup' || game.fixedPartsMode) return;
    game.upgradeAdAction = '';
    rewardedAdPending = false;
    if (action === 'take-all') {
      chooseAllSkills();
    } else {
      renderUpgradeChoices();
      updateUI();
      showToast('升级选项已重选');
    }
  } catch (error) {
    if (game.state === 'levelup') {
      showToast(error?.message || '广告播放失败，请稍后再试');
    }
  } finally {
    game.upgradeAdAction = '';
    rewardedAdPending = false;
    syncUpgradeAdButtons();
    pixiCombatUi?.render();
  }
}

function clearEntities() {
  combatVfx.clear();
  experienceTrails.clear();
  clearEnemyRemains();
  for (const enemy of enemies) detachEnemyVisual(enemy);
  for (const b of playerBullets) friendlyPool.release(b);
  for (const b of enemyBullets) hostilePool.release(b);
  for (const p of pickups) p.view.removeFromParent();
  for (const p of particles) p.view.removeFromParent();
  for (const orb of xpOrbs) orb.view.destroy();
  for (const drone of drones) drone.view.removeFromParent();
  for (const pair of tetherPairs) pair.view.removeFromParent();
  for (const telegraph of telegraphs) telegraph.view.removeFromParent();
  for (const beam of hostileBeams) beam.view.removeFromParent();
  laserBeamView.clear();
  enemies.length = 0;
  playerBullets.length = 0;
  enemyBullets.length = 0;
  pickups.length = 0;
  particles.length = 0;
  xpOrbs.length = 0;
  drones.length = 0;
  drones.signature = '';
  tetherPairs.length = 0;
  telegraphs.length = 0;
  hostileBeams.length = 0;
  if (boss) detachEnemyVisual(boss);
  boss = null;
}

async function startGame(options = {}) {
  if (replicaBattle && !BOSS_TEST_MODE) {
    return replicaBattle.start({ trial: options.trial === true || debugUnlockAll, chapterId: selectedStageIndex + 1 });
  }
  if(game.sortieLoading || (!['menu','gameover','victory','fixed_result'].includes(game.state) && !options.trial))return false;
  game.sortieLoading = true;
  game.keys.clear();resetRelativeDrag();
  const loading = showSortieLoading({
    stageName:CAMPAIGN[BOSS_TEST_MODE ? BOSS_TEST_STAGE_INDEX : selectedStageIndex]?.name,
    aircraftId:peripheralSystem?.getAircraftId()||getActivePilot().id,
    resourceCount:thunderRuntimeGlobals.canvas?4:5,
  });
  let started = false;
  let resourceTimeout;
  try {
    // Two frames let the browser paint the loading page before synchronous work.
    await nextLoadingFrame();await nextLoadingFrame();
    await Promise.race([Promise.all([
      loadFixedProjectileArt(),
      threeEnvironment.preload(BOSS_TEST_MODE ? BOSS_TEST_STAGE_INDEX : selectedStageIndex),
      loadFighterPackages({ pilotIds: [peripheralSystem?.getAircraftId() || getActivePilot().id, getActivePilot().id] }),
      ...(thunderRuntimeGlobals.canvas ? [] : [loadPixiLobbyPilotTextures(document, {
        pilotIds: [getActivePilot().id, peripheralSystem?.getAircraftId() || getActivePilot().id], textures: pixiLobbyPilotTextures,
      })]),
      loadEnemyLibrary(chapterEnemyProfile(BOSS_TEST_MODE?BOSS_TEST_STAGE_INDEX:selectedStageIndex).id),
    ].map(task=>Promise.resolve(task).then(value=>{loading.resource();return value;}))),new Promise((_,reject)=>{
      resourceTimeout=window.setTimeout(()=>reject(new Error('作战资源加载超时')),30000);
    })]);
    window.clearTimeout(resourceTimeout);
    loading.stage(0,'作战资源已就绪');
    await nextLoadingFrame();
    started = initializeGame(options);
    if(!started){await loading.close();return false;}
    releaseUnusedEnemyLibrary(chapterEnemyProfile(game.stageIndex).id);
    loading.stage(1,'正在准备战场…');
    threeEnvironment.update(0,game.stageIndex,{lateral:0});
    pixiCombatUi?.update();pixiLobby?.update();
    // Render behind the opaque loading page while simulation remains frozen.
    // Wait for a short stable frame window; do not invent a completion percent.
    let stable = 0, last = performance.now();
    for(let frame=0;frame<45 && stable<6;frame++) {
      await nextLoadingFrame();
      const now=performance.now();stable=now-last<80?stable+1:0;last=now;
    }
    loading.stage(2,'准备完成');
    await nextLoadingFrame();await nextLoadingFrame();
    await loading.close();
    return true;
  } catch(error) {
    console.error('出击准备失败',error);
    if(game.state==='playing'){game.state='paused';game.pauseMode='pause';pixiCombatUi?.render();}
    loading.fail({onRetry:!started?()=>startGame(options):null});
    return false;
  } finally {
    window.clearTimeout(resourceTimeout);
    game.sortieLoading = false;
    sfx.syncMusic();
    game.keys.clear();resetRelativeDrag();
  }
}

function initializeGame(options = {}) {
  const sortieStartedAt = performance.now();
  if (!['menu', 'gameover', 'victory', 'fixed_result'].includes(game.state) && !options.trial) return false;
  if (!projectileAssets.ready) {
    showToast(projectileAssets.error ? '武器资源加载失败，正在重试，请稍后出击' : '武器资源加载中，请稍后出击');
    loadFixedProjectileArt().catch(error=>console.warn('弹体模型加载失败',error));
    return false;
  }
  // All player-facing sorties use the saved fixed-parts build. Only the
  // explicit Boss developer harness retains its archived combat mode.
  const fixedPartsMode = !BOSS_TEST_MODE || options.fixedParts === true;
  let fixedLoadout = null;
  let peripheralSnapshot = null;
  if (fixedPartsMode && !peripheralSystem) {
    try { fixedLoadout = readFixedLoadout(getActivePilot().id, localStorage); }
    catch (error) { switchLobbyTab('assembly'); showToast(error.message); return false; }
  }
  resetRelativeDrag();
  const startStageIndex = BOSS_TEST_MODE ? BOSS_TEST_STAGE_INDEX : selectedStageIndex;
  const startDifficultyId = BOSS_TEST_MODE ? BOSS_TEST_DIFFICULTY_ID : selectedDifficultyId;
  if (!BOSS_TEST_MODE && !isDifficultyUnlocked(startStageIndex, startDifficultyId)) {
    showToast('当前关卡或难度尚未解锁');
    return;
  }
  if (fixedPartsMode && peripheralSystem) {
    const prepared = peripheralSystem.prepareSortie({ trial: options.trial === true || debugUnlockAll || BOSS_TEST_MODE });
    if (!prepared.ok) { showToast(prepared.message); return false; }
    fixedLoadout = prepared.loadout;
    peripheralSnapshot = prepared.snapshot;
  }
  const sortieTrace = createSortieTrace(sortieStartedAt);
  sortieTrace.mark('prepareLoadout');
  sfx.start();
  app.ticker.start();
  currentUpgradeChoices = [];
  window.clearTimeout(game.battleSupplyTimer);
  for (const timer of game.victoryTimers || []) window.clearTimeout(timer);
  game.victoryTimers = [];
  clearEntities();
  game.victoryDeparture = null;
  game.victoryDepartureFrame = null;
  sortieTrace.mark('clearEntities');
  runStats = createRunStats();
  if (!fixedPartsMode) applyProfileBonuses(runStats);
  if (peripheralSnapshot) applyPeripheralStats(runStats, peripheralSnapshot);
  syncPlayerAssemblyVisual();
  player.aircraft.model.setPilot(fixedLoadout?.pilotId || getActivePilot().id);
  player.aircraft.model.setFixedParts(fixedLoadout);
  sortieTrace.mark('playerModels');
  const activeWeapons = fixedPartsMode ? [] : createActiveWeaponRuntime();
  const assemblySupports = fixedPartsMode ? [] : getAssemblySupports();
  const mode = DIFFICULTY_MAP.get(startDifficultyId) || DIFFICULTIES[0];
  const stage = CAMPAIGN[startStageIndex] || CAMPAIGN[0];
  applyTerrainTheme(startStageIndex);
  const balance = createRunBalance(stage, startDifficultyId, fixedPartsMode ? 0 : profilePower());
  runStats.maxHp = Math.max(60, runStats.maxHp - mode.lifePenalty * 25);
  const callsign = playerName(profileState.playerName);
  Object.assign(game, {
    fixedPartsMode, fixedLoadout, peripheralSnapshot, fixedCombat: fixedLoadout ? createFixedCombat(fixedLoadout) : null, fixedExperience: 0,
    battleSupply: null, battleSupplyTimer: null, battleSupplySerial: 0,
    state: 'playing', elapsed: 0, score: 0, hp: runStats.maxHp, lives: 0,
    activeWeapons,
    assemblySupports,
    balance,
    weapon: 'white', weaponLevels: { white: 1 }, combo: 0, comboTimer: 0,
    bossSpawned: false, victory: false, pointerActive: false,
    relativeDragActive: false, relativeDragDeltaX: 0,
    targetX: W / 2, targetY: H * 0.78,
    level: 1, xp: 0, xpNext: xpForLevel(1), kills: 0,
    waveIndex: 0, waveTimer: 0.8 * balance.spawnInterval, enemySkillSpawnIndex: 0, skills: fixedPartsMode ? {} : assemblyStartingSkills(),
    waveDirector: createBattleWaveDirector({ stageIndex: startStageIndex, waveSize: balance.waveSize, duration: stageWaveTime(stage) }),
    waveStatus: null, waveStartedAt: -Infinity, _directorElapsed: 0,
    primarySkillPath: null, evolutionTimer: 0, evolutionDuration: 0, evolutionDeadline: 0,
    evolutionQueue: [], evolutionCurrent: null, evolutionReturnState: 'playing',
    redUltimateVolley: 0, mainWeaponOfferBag: [], upgradeAdAction: '', pendingLevels: fixedPartsMode ? 0 : (peripheralSnapshot?.stats.researchModifiers?.openingChoices || 0), ultimateStageTwoTasks: {},
    allowedSkillPaths: fixedPartsMode ? [] : accountSkillPathIds(),
    ricochetVolley: 0, clusterVolley: 0, swordVolley: 0, tetherVolley: 0, laserDamageTimer: 0,
    healDropCounter: 0, researchHalfHitsRemaining: peripheralSnapshot?.stats.researchModifiers?.earlyHitHalves || 0, shieldReady: false, shieldTimer: 0, missileTimer: 2.5,
    stageIndex: startStageIndex, stageElapsed: 0, stageBossesDefeated: 0,
    sealedSkillId: null, openingGuard: true, bossWarningShown: false, scoreSubmitted: false,
    difficultyId: startDifficultyId, hitsTaken: 0, revivesUsed: 0, runEnded: false,
    lastDamageSource: '', lastDamageAmount: 0, lastDamageSummary: '', damageHistory: [], lowHealthWarningAt: -Infinity,
    reviveAvailable: false, reviveCountdown: 0, reviveDeadline: 0,
    reviveAdPending: false,
    victoryRewardDoublePending: false,
    victoryRewardDoubled: false,
    victoryRewardDoubleNotice: false,
    dodgeTutorialPrompted: false, battleNotice: null,
    pauseMode: 'pause', pauseWeaponPage:0, pauseUpgradePage:0, pauseDetail:null, exitFromPause: false, pauseReturnState: 'playing', grazeCount: 0, lastGrazeAt: -10,
    flightQuality: 0, flightGrade: 'C', flightChain: 0, flightChainTimer: 0, flightLastActionAt: -10,
    flightLastAction: '', flightLastPhrase: '', flightLastPoints: 0, flightLastColor: 0x78f1e5,
    flightDashDistance: 0, flightDashCount: 0, flightDashCooldown: 0, flightFlipCooldown: 0,
    flightFlipArmed: true, flightQueuedFlipDirection: 0, flightFlipQueueTime: 0, flightLastDirection: 0,
    flightLastInputDirection: 0, flightSteerDirection: 0, flightLastCommandX: W / 2, flightHasSteered: false,
    flightFlipTime: 0, flightFlipDirection: 1, flightBoost: 0, flightTrailTimer: 0, flightTrailAnchors: null,
    surfaceTravel: 0, surfaceHeading: 0, surfacePlayerX: W / 2,
    lastFlipDodgeAt: -10,
    pilotAbilityTimer: getActivePilot().ability.interval || 0, peripheralPassiveTimer: null, peripheralPassiveTimers:null,peripheralAircraftTimers:null,aircraftImmunitySource:null,
    pilotSkillCutInShown: false,
    pilotShieldReady: false,
    pilotStealthTime: 0,
    pilotBarrierHp: 0,
    pilotBarrierTime: 0,
    phaseAfterimage: null,
    pilotTrailTimer: 0,
    completionRecorded: false, completionSummary: null, defeatReward: null,
    debugRun: options.trial === true || debugUnlockAll || BOSS_TEST_MODE,
    debugPrimaryWeapon: bossTestLoadout?.primaryWeapon || null,
    callsign, _directorElapsed: 0, uiTimer: 0,
  });
  game.fixedGrowth = game.fixedCombat?.growth || null;
  sortieTrace.mark('battleState');
  if (game.fixedGrowth) syncFixedGrowth();
  game.fixedCheckpoint = null; game.fixedTargetSerial = 0;
  sdkGameplayStart();
  if (BOSS_TEST_MODE && !fixedPartsMode) {
    game.stageElapsed = Math.max(0, stageWaveTime(stage) - BOSS_TEST_LEAD_SECONDS);
    game.waveTimer = 99;
    applyBossTestLoadout();
  }
  player.x = W / 2;
  player.y = H * 0.78;
  player.view.position.set(player.x, player.y);
  player.sigil.rotation = 0;
  player.sigil.alpha = 0.7;
  player.view.visible = true;
  player.view.alpha = 1;
  player.view.rotation = 0;
  player.view.scale.set(1);
  player.view.skew.y = 0;
  player.view.tint = 0xffffff;
  resetUltimateAircraftForm();
  player.phaseAfterimages.visible = false;
  player.engine.alpha = 1;
  player.invincible = 2.1;
  player.fireTimer = 0;
  switchWeapon('white', false);
  ui.deathSequence.classList.remove('visible', 'detonate');
  ui.reviveOverlay.classList.remove('visible');
  ui.pauseOverlay.classList.remove('visible', 'confirm-exit');
  ui.victorySequence.classList.remove('visible', 'complete');
  ui.evolutionOverlay.classList.remove('visible');
  ui.resultOverlay.classList.remove('visible');
  ui.overlay.classList.remove('visible');
  window.cancelAnimationFrame(showFlightFeed.scoreFrame);
  window.clearTimeout(showFlightFeed.timer);
  ui.flightFeed.classList.remove('visible');
  ui.flightFeedCombo.dataset.value = '0';
  ui.flightFeedCombo.textContent = '0';
  ui.leaderboardOverlay.classList.remove('visible');
  ui.upgradeOverlay.classList.remove('visible');
  ui.bossWrap.classList.remove('visible');
  shell.classList.remove('boss-active');
  shell.classList.add('run-active');
  syncDrones();
  showToast(fixedPartsMode ? '自动开火' : BOSS_TEST_MODE
    ? `Boss试炼 · ${stage.name} · ${mode.label} · ${bossTestLoadout.id === 'ultimate' ? `${ROUTE_MAP.get(bossTestLoadout.route)?.name || '随机'}二段终极` : '当前配装'} · HP×${BOSS_TEST_HP_MULTIPLIER}`
    : '基础白弹 · 自动射击启动');
  showStageBanner();
  updateBuildList();
  updateUI();
  pixiLobby?.update();
  if (game.pendingLevels) openLevelUp();
  if (!BOSS_TEST_MODE) {
    try { localStorage.setItem(FIRST_SORTIE_STORAGE_KEY, '1'); }
    catch { /* The current sortie remains playable without persistence. */ }
  }
  sortieTrace.mark('uiAndEffects');
  sortieTrace.finish();
  return true;
}

function endGame(victory, abandoned = false) {
  if (game.runEnded) return;
  game.runEnded = true;
  playerHitMarker.visible = false;
  window.clearTimeout(game.battleSupplyTimer);
  game.battleSupplyTimer = null;
  game.battleSupply = null;
  if (game.peripheralSnapshot) peripheralSystem?.recordSortie({
    runId: game.peripheralSnapshot.id, won: victory && !abandoned,
    stageIndex: game.stageIndex, debugRun: game.debugRun, abandoned,
  });
  if (game.fixedPartsMode) {
    game.fixedRunSummary = { build: game.fixedGrowth.snapshot(), combat: structuredClone(game.fixedCombat.state) };
    game.fixedCheckpoint = null;
    game.fixedCombat.dispose();
    combatVfx.clear();
    for (let i = playerBullets.length - 1; i >= 0; i--) if (playerBullets[i].fixedSource) {
      friendlyPool.release(playerBullets[i]); playerBullets.splice(i, 1);
    }
    player.aircraft.model.setFixedParts(null);
  }
  resetRelativeDrag();
  sdkGameplayStop();
  sfx.stopCombatLoops();
  game.keys.clear();
  game.shake = 0;
  game.flash = 0;
  app.canvas.style.filter = '';
  pixiCombatUi?.setScreenShakeCompensation(0, 0);
  navigator.vibrate?.(0);
  game.state = victory ? 'victory' : 'gameover';
  // The completed run will never resume. Release its enemy meshes, pickups,
  // trails and pooled bullet views now instead of retaining them in the lobby
  // until the next sortie. Settlement already owns the immutable run summary.
  clearEntities();
  sfx.syncMusic();
  const config = CAMPAIGN[Math.min(game.stageIndex, CAMPAIGN.length - 1)];
  const completedStageIndex = game.stageIndex;
  renderStageSelector();
  shieldView.visible = false;
  ui.deathSequence.classList.remove('visible', 'detonate');
  ui.reviveOverlay.classList.remove('visible');
  ui.pauseOverlay.classList.remove('visible', 'confirm-exit');
  ui.victorySequence.classList.remove('visible', 'complete');
  ui.evolutionOverlay.classList.remove('visible');
  ui.resultOverlay.classList.remove('visible');
  ui.upgradeOverlay.classList.remove('visible');
  ui.overlayCopy.innerHTML = abandoned
    ? `已退出第 ${String(completedStageIndex + 1).padStart(2, '0')} 关<br />本局进度未保存`
    : victory
    ? `第 ${String(completedStageIndex + 1).padStart(2, '0')} 关已肃清<br />${config.name} · ${String(Math.floor(game.score)).padStart(6, '0')} 分 · ${formatTime(game.elapsed)}`
    : `第 ${String(completedStageIndex + 1).padStart(2, '0')} 关失守<br />抵达 ${formatTime(game.elapsed)} · 击破 ${String(game.kills).padStart(3, '0')} · ${String(Math.floor(game.score)).padStart(6, '0')} 分`;
  ui.startButton.querySelector('small').textContent = abandoned ? '重新出击' : victory && completedStageIndex < CAMPAIGN.length - 1 ? '下一关' : victory ? '已通关' : '重试';
  switchLobbyTab('battle');
  ui.overlay.classList.add('visible');
  ui.bossWrap.classList.remove('visible');
  shell.classList.remove('boss-active', 'run-active');
  resizeScene();
  if (!abandoned && !game.debugRun) submitRunScore(victory);
  pixiLobby?.update();
  // endGame stops the ticker immediately, so the shared combat layer cannot
  // wait for its next frame to observe the new lobby state. Hide/rebuild it
  // synchronously before the final render or the result panel remains above
  // the lobby and makes "返回航母" appear unresponsive.
  pixiCombatUi?.update();
  app.renderer.render({ container: app.stage });
  app.ticker.stop();
}

// Combat-time notices survive a pause/upgrade without expiring in the menu.
// Only one entry notice owns this slot; boss phases replace one another.
function showBattleNotice(kind, text, duration) {
  game.battleNotice = { kind, text, duration, at: game.elapsed };
}

function enemyHasEnteredView(enemy) {
  const point = renderer.type === 'three'
    ? renderer.projectBattle(enemy.x, enemy.y) : enemy;
  return point.x >= 20 && point.x <= W - 20 && point.y >= 100 && point.y < H * .7;
}

function combatCircleIntersectsView(x, y, radius, margin = 0) {
  // The tilted camera shows negative world Y and wider lanes near the top.
  // Project the collision circle's enclosing box before visibility culling.
  const project = renderer.type === 'three'
    ? (px,py) => renderer.projectBattle(px,py) : projectWorldPoint;
  const corners = [project(x-radius,y-radius),project(x+radius,y-radius),
    project(x-radius,y+radius),project(x+radius,y+radius)];
  return Math.max(...corners.map(p=>p.x)) >= -margin
    && Math.min(...corners.map(p=>p.x)) <= W+margin
    && Math.max(...corners.map(p=>p.y)) >= -margin
    && Math.min(...corners.map(p=>p.y)) <= H+margin;
}

function spawnDirector(t) {
  const config = CAMPAIGN[game.stageIndex];
  if (game.bossSpawned) return;
  const dt = Math.max(0, Math.min(.05, t - (game._directorElapsed || 0)));
  game._directorElapsed = t;
  let bossReady = false;
  if (BOSS_TEST_MODE) {
    bossReady = game.stageElapsed >= stageWaveTime(config);
  } else {
    const liveCount = enemies.reduce((count, enemy) => count + !enemy.dead, 0);
    const dangerCount = enemyBullets.length + hostileBeams.length * 8 + telegraphs.length;
    const keyTargetAlive = enemies.some(enemy => enemy.keyTarget && !enemy.dead);
    const events = game.waveDirector.step(dt, { liveCount, dangerCount, keyTargetAlive, paused: game.state !== 'playing' });
    for (const event of events) {
      if (event.type === 'wave') {
        game.waveIndex = event.index + 1;
        game.waveStartedAt = game.elapsed;
      } else if (event.type === 'spawn') {
        const { spec } = event;
        const route = {...spec.route,entryTop:enemyTopEntryY()};
        const point = battleRoutePosition(route, 0, W, H);
        spawnEnemy(spec.kind, point.x, point.y, { waveRole: spec.role, route, elite: spec.elite, keyTarget: spec.keyTarget, barrageGroup: spec.barrageGroup });
      } else if (event.type === 'warning') {
        game.bossWarningShown = true;
        sfx.syncMusic();
        sfx.bossWarning();
        showBattleNotice('boss-warning', '旗舰接近 · 准备迎战', event.rest);
      } else if (event.type === 'boss') bossReady = true;
    }
    game.waveStatus = game.waveDirector.snapshot;
  }
  if (bossReady) {
    game.bossSpawned = true;
    clearCombatField();
    if (game.peripheralSnapshot?.stats.researchModifiers?.preBossRepair) spawnPickup(W / 2, H * .72, 'heal');
    boss = drawBoss(config);
    ui.bossWrap.classList.add('visible');
    sealSkillForBoss(config);
    showBattleNotice('boss-entry', '旗舰正在入场', Infinity);
    sfx.bossSpawn();
    sfx.syncMusic();
    return;
  }
}

function updatePlayer(dt) {
  const previousX = player.x;
  const previousY = player.y;
  player.collisionPreviousX = previousX;
  player.collisionPreviousY = previousY;
  game.flightDashCooldown = Math.max(0, game.flightDashCooldown - dt);
  game.flightFlipCooldown = Math.max(0, game.flightFlipCooldown - dt);
  game.flightFlipQueueTime = Math.max(0, game.flightFlipQueueTime - dt);
  game.flightBoost = Math.max(0, game.flightBoost - dt);
  const steerOffsetX = game.relativeDragActive
    ? game.relativeDragDeltaX
    : game.targetX - player.x;
  if (Math.abs(steerOffsetX) < 42) game.flightFlipArmed = true;
  if (
    game.flightQueuedFlipDirection
    && game.flightFlipQueueTime > 0
    && game.flightFlipCooldown <= 0
    && game.flightFlipTime <= 0.1
  ) {
    const queuedDirection = game.flightQueuedFlipDirection;
    const activeDirection = Math.abs(steerOffsetX) >= 55 ? Math.sign(steerOffsetX) : 0;
    if (activeDirection === queuedDirection) triggerFlightFlip(queuedDirection);
    else if (!activeDirection) {
      game.flightQueuedFlipDirection = 0;
      game.flightFlipQueueTime = 0;
    }
  } else if (game.flightFlipQueueTime <= 0) {
    game.flightQueuedFlipDirection = 0;
  }
  if (Math.abs(steerOffsetX) >= 90) {
    const steerDirection = Math.sign(steerOffsetX);
    if (game.flightSteerDirection && steerDirection !== game.flightSteerDirection) requestFlightFlip(steerDirection);
    game.flightSteerDirection = steerDirection;
  }
  if (game.flightChainTimer > 0) {
    game.flightChainTimer = Math.max(0, game.flightChainTimer - dt);
    if (game.flightChainTimer <= 0) resetFlightQualityChain();
  }
  let dx = 0;
  let dy = 0;
  if (game.keys.has('ArrowLeft') || game.keys.has('KeyA')) dx -= 1;
  if (game.keys.has('ArrowRight') || game.keys.has('KeyD')) dx += 1;
  if (game.keys.has('ArrowUp') || game.keys.has('KeyW')) dy -= 1;
  if (game.keys.has('ArrowDown') || game.keys.has('KeyS')) dy += 1;
  if (dx || dy) {
    const length = Math.hypot(dx, dy);
    const strength = Math.min(1, length);
    player.x += dx / length * strength * 410 * runStats.moveSpeedMultiplier * (game.fixedCombat?.speedMultiplier||1) * dt;
    player.y += dy / length * strength * 410 * runStats.moveSpeedMultiplier * (game.fixedCombat?.speedMultiplier||1) * dt;
    game.targetX = player.x;
    game.targetY = player.y;
  } else if (game.relativeDragActive) {
    // The touch anchor is the ship's position at press time. Each move event
    // updates this target from the touch's relative offset, so the ship tracks
    // finger speed without jumping to the point that was pressed.
    player.x = game.targetX;
    player.y = game.targetY;
  } else {
    const easing = 1 - Math.pow(0.0008, dt);
    player.x += (game.targetX - player.x) * easing;
    player.y += (game.targetY - player.y) * easing;
  }
  const attemptedX = player.x;
  const attemptedY = player.y;
  player.x = Math.max(32, Math.min(W - 32, player.x));
  player.y = Math.max(95, Math.min(H - 112, player.y));
  if (player.x !== attemptedX || player.y !== attemptedY) sfx.wallHit(player.x, player.y);
  const movedX = player.x - previousX;
  const movedY = player.y - previousY;
  const movedDistance = Math.hypot(movedX, movedY);
  const moveSpeed = movedDistance / Math.max(0.001, dt);
  const moveDirection = Math.abs(movedX) >= 1.5 ? Math.sign(movedX) : 0;

  if (moveSpeed >= 300) {
    game.flightDashDistance += movedDistance;
    if (game.flightDashDistance >= 270 && game.flightDashCooldown <= 0) {
      game.flightDashDistance = 0;
      game.flightDashCount += 1;
      game.flightDashCooldown = peripheralDodgeCooldown(3.2, game.peripheralSnapshot);
      game.flightBoost = 0.72;
      game.shake = Math.max(game.shake, 5);
      if (game.flightDashCount % 2 === 0) {
        requestFlightFlip(moveDirection || game.flightLastDirection || 1);
      } else {
        awardFlightQuality('超燃冲刺', 680, COLORS.amber);
      }
    }
  } else if (moveSpeed < 180) {
    game.flightDashDistance = Math.max(0, game.flightDashDistance - 320 * dt);
  }

  if (
    moveDirection
    && game.flightLastDirection
    && moveDirection !== game.flightLastDirection
    && moveSpeed >= 160
  ) {
    requestFlightFlip(moveDirection);
  }
  if (moveDirection && moveSpeed >= 140) game.flightLastDirection = moveDirection;

  player.view.position.set(player.x, player.y);
  player.sigil.rotation += dt * 0.34;
  player.sigil.alpha = 0.62 + Math.sin(game.elapsed * 2.4) * 0.12;
  const bankRotation = game.relativeDragActive
    ? Math.max(-0.18, Math.min(0.18, game.relativeDragDeltaX * 0.004))
    : Math.max(-0.18, Math.min(0.18, (game.targetX - player.x) * 0.012));
  if (game.flightFlipTime > 0) {
    game.flightFlipTime = Math.max(0, game.flightFlipTime - dt);
    const flipProgress = 1 - game.flightFlipTime / 0.72;
    const rollWave = Math.cos(flipProgress * Math.PI * 2);
    const rollScaleX = Math.sign(rollWave || 1) * Math.max(0.14, Math.abs(rollWave));
    player.view.rotation = bankRotation + Math.sin(flipProgress * Math.PI * 2) * 0.075 * game.flightFlipDirection;
    player.view.skew.y = Math.sin(flipProgress * Math.PI * 2) * 0.12 * game.flightFlipDirection;
    player.view.y = player.y - Math.sin(flipProgress * Math.PI) * 9;
    player.view.scale.set(player.aircraft.model?1:rollScaleX,player.aircraft.model?1:1+Math.sin(flipProgress*Math.PI)*.05);
  } else {
    player.view.rotation = bankRotation;
    player.view.skew.y = 0;
    player.view.scale.set(1);
  }
  // 推进器不再挂在机身上；型号差异全部通过持续拖尾的数量与颜色表现。
  if(player.aircraft.model){
    player.flightBank=bankRotation*1.5;
    player.view.rotation=0;player.view.skew.set(0);
    player.view.y=player.y;player.view.scale.set(1);
  }
  game.pilotTrailTimer -= dt;
  if (game.pilotTrailTimer <= 0) {
    game.pilotTrailTimer = game.flightBoost > 0 ? 0.018 : 0.042;
    pilotThrusterTrail();
  }

  if (game.flightBoost > 0 || game.flightFlipTime > 0) {
    game.flightTrailTimer -= dt;
    if (game.flightTrailTimer <= 0) {
      game.flightTrailTimer = 0.012;
      if (game.flightBoost > 0) {
        flightWingTrails(
          player.x,
          player.y,
          movedX,
          movedY,
          player.view.rotation,
          player.view.scale.x,
          game.flightFlipTime > 0 ? COLORS.blue : COLORS.amber,
        );
      }
      if (game.flightFlipTime > 0) {
        flightAfterimage(previousX, previousY, COLORS.blue, player.view.rotation, player.view.scale.x);
      }
    }
  } else {
    game.flightTrailTimer = 0;
    game.flightTrailAnchors = null;
  }

  // A held finger has no steering force. Let the banking cue settle between
  // touchmove events instead of leaving the aircraft tilted in its last direction.
  if (game.relativeDragActive) game.relativeDragDeltaX *= Math.max(0, 1 - dt * 14);

  player.fireTimer -= dt;
  if (!game.fixedPartsMode && player.fireTimer <= 0) {
    playerShoot();
    const missingLives = Math.max(0, (runStats.maxHp - game.hp) / Math.max(1, runStats.maxHp / 3));
    const desperationRate = 1 + missingLives * runStats.lowHealthPower;
    const effectiveFireRate = runStats.fireRateMultiplier || 1;
    const primaryWeapon = currentPrimaryWeapon();
    const baseInterval = primaryWeapon
      ? (primaryWeapon.weapon.attackInterval || primaryWeapon.weapon.damageTick || 0.18)
      : 0.18;
    player.fireTimer = baseInterval / (effectiveFireRate * desperationRate);
  }
  if (game.pilotStealthTime > 0) {
    player.view.alpha = stealthOpacity(game.pilotStealthTime);
  } else if (player.invincible > 0) {
    player.invincible -= dt;
    player.view.alpha = Math.sin(player.invincible * 22) > 0 ? 0.35 : 1;
  } else player.view.alpha = 1;
}

function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const e = enemies[i];
    if (e.dead) { enemies.splice(i, 1); continue; }
    e.collisionPreviousX = e.x;
    e.collisionPreviousY = e.y;
    // Keep the route as a base position, with a damped collision displacement.
    e.x-=e.fixedPushX||0;e.y-=e.fixedPushY||0;
    const fixedBaseX=e.x,fixedBaseY=e.y;
    if (e.burnTime > 0) {
      e.burnTime -= dt;
      e.hp -= e.burnDps * dt;
      if (Math.random() < dt * 3.5) hitSpark(e.x + (Math.random() - 0.5) * e.radius, e.y, COLORS.red, false);
      if (e.hp <= 0) { killEnemy(e); continue; }
    }
    if (e.frostTime > 0) e.frostTime -= dt;
    if (e.stunTime > 0) e.stunTime -= dt;
    if (e.vulnerabilityTime > 0) e.vulnerabilityTime -= dt;
    updateRedHuntMarker(e, dt);
    const statusSpeed = (e.frostTime > 0 ? 1 - runStats.frostStrength : 1) * (e.stunTime > 0 ? 0 : 1);
    e.age += dt * statusSpeed;
    if (e.route) {
      const point = battleRoutePosition(e.route, e.age, W, H);
      const dx = point.x - e.x, dy = point.y - e.y;
      // Enemy airframes point +Y on screen; align the nose to the route tangent.
      if (e.model.directional && Math.hypot(dx, dy) > .001) e.model.rotation = Math.atan2(dy, dx) - Math.PI / 2;
      e.x = point.x; e.y = point.y; e.routeCanFire = point.canFire;
      if (point.escaped) {
        e.dead = true;
        cancelTelegraphsFrom(e);
        detachEnemyVisual(e);
        enemies.splice(i, 1);
        continue;
      }
    } else if (e.dash?.time > 0) {
      e.dash.time -= dt * statusSpeed;
      e.x += e.dash.vx * dt * statusSpeed;
      e.y += e.dash.vy * dt * statusSpeed;
      if (e.dash.time <= 0) e.dash = null;
    } else {
      e.y += e.speed * statusSpeed * dt;
      if (e.pattern === 'sine') e.x = e.baseX + Math.sin(e.age * 2.2 + e.phase) * 55;
      if (e.pattern === 'zigzag') e.x = e.baseX + Math.sin(e.age * 3.4 + e.phase) * 85;
      if (e.pattern === 'sweepRight') e.x += (95 + e.age * 4) * dt;
      if (e.pattern === 'sweepLeft') e.x -= (95 + e.age * 4) * dt;
    }
    if(game.fixedPartsMode){
      e.fixedMotionX=dt>0?(e.x-fixedBaseX)/dt:0;e.fixedMotionY=dt>0?(e.y-fixedBaseY)/dt:0;
      const damping=Math.exp(-6*dt),returning=Math.exp(-2*dt);
      e.fixedPushVx=(e.fixedPushVx||0)*damping;e.fixedPushVy=(e.fixedPushVy||0)*damping;
      e.fixedPushX=((e.fixedPushX||0)+e.fixedPushVx*dt)*returning;e.fixedPushY=((e.fixedPushY||0)+e.fixedPushVy*dt)*returning;
      e.x+=e.fixedPushX;e.y+=e.fixedPushY;
    }
    const hitScale = updateHitReaction(e, dt);
    e.view.scale.set(e.displayScale * hitScale);
    e.view.position.set(e.x, e.y);
    if (e.elite && !e.entryNoticeShown && enemyHasEnteredView(e)) {
      e.entryNoticeShown = true;
      if (!game.bossSpawned) showBattleNotice('elite', '精英来袭', 1.6);
    }
    e.model?.updateEnemy(e.age,{charging:e.attackPending,motionDt:dt*statusSpeed,
      vx:dt>0?(e.x-(e.fixedPushX||0)-fixedBaseX)/dt:0,
      vy:dt>0?(e.y-(e.fixedPushY||0)-fixedBaseY)/dt:0});
    e.view.rotation = e.route || e.model?.libraryEnemy ? 0 : e.kind === 'turret' ? Math.sin(e.age) * 0.03 : e.kind === 'relay' ? e.age * 0.75 : Math.sin(e.age * 3 + e.phase) * 0.13;
    if (e.eliteAura) {
      e.eliteAura.rotation = e.age * 0.85;
      e.eliteAura.alpha = 0.72 + Math.sin(e.age * 5) * 0.18;
      const localRadius = e.radius / e.displayScale;
      const barWidth = localRadius * 1.45;
      e.eliteBar.clear()
        .roundRect(-barWidth / 2, -localRadius - 17, barWidth, 4, 2).fill({ color: 0x07131a, alpha: 0.88 })
        .roundRect(-barWidth / 2, -localRadius - 17, barWidth * Math.max(0, e.hp / e.maxHp), 4, 2).fill({ color: COLORS.amber, alpha: 0.95 });
    }
    if (e.waveCue) {
      const radius = e.radius / e.displayScale;
      const cue = e.waveCue.clear();
      if (e.waveRole !== 'light') {
        const bar = radius * 1.5;
        cue.rect(-bar / 2, -radius - 12, bar, 4).fill({ color: 0x07131a, alpha: .9 })
          .rect(-bar / 2, -radius - 12, bar * Math.max(0, e.hp / e.maxHp), 4)
          .fill({ color: e.elite ? 0x76baff : COLORS.red, alpha: .9 });
        if (e.attackPending) cue.circle(0, radius * .7, 5 + Math.sin(e.age * 18) * 1.5)
          .fill({ color: 0xffd278, alpha: .95 });
      }
      if (['crossing','sideDive','pincer','hook','arcSweep','sideAnchor'].includes(e.route.template) && e.age < 1.2) {
        const edge = (e.x < 0 ? -e.x + 12 : W - e.x - 12) / e.displayScale;
        cue.circle(edge, 0, 8).stroke({ color: 0xffbd63, width: 2, alpha: .85 });
      }
      const routeTime=e.age*8/(e.route.duration||8);
      if(e.route.template==='holdDive'&&routeTime>=2.4&&routeTime<3.4){
        const tip=radius+16;
        cue.moveTo(-8,tip-7).lineTo(0,tip).lineTo(8,tip-7)
          .stroke({color:0xffd278,width:2.5,alpha:.85});
      }
    }
    if (!e.route || e.routeCanFire) e.fireTimer -= dt * statusSpeed;
    if (e.shotBurst) {
      e.shotBurst.timer -= dt * statusSpeed;
      while (e.shotBurst && e.shotBurst.timer <= 0) {
        aimedShot(e, e.shotBurst.bulletCount, e.shotBurst.spread, e.bulletSpeed);
        e.shotBurst.wavesRemaining -= 1;
        if (e.shotBurst.wavesRemaining <= 0) {
          e.fireTimer = e.shotBurst.cooldown;
          e.shotBurst = null;
          e.attackPending = false;
          break;
        }
        e.shotBurst.timer += e.shotBurst.interval;
      }
    }
    if (e.canFire && (!e.route || e.routeCanFire) && !e.attackPending && e.fireTimer <= 0 && e.y > 20 && e.y < H * 0.68) startEnemyAttack(e);
    if (e.y > H + 90 || e.x < -130 || e.x > W + 130) {
      detachEnemyVisual(e);
      enemies.splice(i, 1);
    }
  }
}

function bossFan(originX, originY, count, start, end, speed, color, offset = 0) {
  const pattern = game.balance?.bossPattern;
  const shotCount = boostedBossBarrageCount(count * (pattern?.bulletCount || 1));
  const middle = (start + end) / 2;
  const angularRange = (end - start) * (pattern?.spread || 1);
  const adjustedStart = middle - angularRange / 2;
  const shotSpeed = speed * (pattern?.bulletSpeed || 1);
  for (let i = 0; i < shotCount; i += 1) {
    const angle = shotCount === 1 ? middle : adjustedStart + (angularRange * i) / (shotCount - 1);
    fireEnemyBullet(
      originX, originY, angle + offset, shotSpeed, color, 1,
      (pattern?.bulletDamage || 22) * BOSS_BARRAGE_DAMAGE_MULTIPLIER,
      game.balance?.bossDamage,
    );
  }
}

function fireBossPattern(targetBoss) {
  const { pattern, color } = targetBoss.config;
  const rage = targetBoss.phase >= 2;
  const tier = Math.floor(game.stageIndex / 4);
  const spin = targetBoss.age * 0.7;
  sfx.bossFire(pattern, targetBoss.phase);
  if (pattern === 'charge') {
    const openingBoss = game.stageIndex === 0;
    aimedShot(targetBoss, openingBoss ? (rage ? 3 : 1) : (rage ? 5 : 3), openingBoss ? 0.16 : 0.12, (openingBoss ? 195 : 235) + tier * 8);
    bossFan(targetBoss.x, targetBoss.y + 25, (openingBoss ? 3 : 5) + tier, 0.38, Math.PI - 0.38, openingBoss ? 135 : 155, color);
    return openingBoss ? (rage ? 0.95 : 1.4) : (rage ? 0.72 : 1.05);
  }
  if (pattern === 'walls' || pattern === 'mountain') {
    const patternConfig = game.balance?.bossPattern;
    const count = Math.max(4, boostedBossBarrageCount((8 + tier) * (patternConfig?.bulletCount || 1)));
    for (let i = 0; i < count; i += 1) if ((i + Math.floor(targetBoss.age)) % 3 !== 1) {
      fireEnemyBullet(
        45 + i * ((W - 90) / (count - 1)),
        targetBoss.y + 15,
        Math.PI / 2,
        (rage ? 225 : 178) * (patternConfig?.bulletSpeed || 1),
        color,
        1.05,
        (patternConfig?.bulletDamage || 22) * BOSS_BARRAGE_DAMAGE_MULTIPLIER,
        game.balance?.bossDamage,
      );
    }
    return rage ? 0.8 : 1.18;
  }
  if (pattern === 'twins') {
    bossFan(targetBoss.x - 48, targetBoss.y + 20, 6 + tier, 0.25, Math.PI - 0.25, 185, color, Math.sin(spin) * 0.12);
    bossFan(targetBoss.x + 48, targetBoss.y + 20, 6 + tier, 0.25, Math.PI - 0.25, 185, color, -Math.sin(spin) * 0.12);
    return rage ? 0.72 : 1.0;
  }
  if (pattern === 'claws') {
    const left = { x: targetBoss.x - 72, y: targetBoss.y + 28 };
    const right = { x: targetBoss.x + 72, y: targetBoss.y + 28 };
    const baseL = Math.atan2(player.y - left.y, player.x - left.x);
    const baseR = Math.atan2(player.y - right.y, player.x - right.x);
    bossFan(left.x, left.y, 4 + tier, baseL - 0.24, baseL + 0.24, 215, color);
    bossFan(right.x, right.y, 4 + tier, baseR - 0.24, baseR + 0.24, 215, color);
    return 0.92;
  }
  if (pattern === 'solar' || pattern === 'underworld') {
    bossFan(targetBoss.x, targetBoss.y, 14 + tier * 2, 0, Math.PI * 2, rage ? 230 : 175, color, spin);
    aimedShot(targetBoss, rage ? 5 : 3, 0.15, 245);
    return rage ? 0.62 : 0.92;
  }
  if (pattern === 'lances' || pattern === 'arrows') {
    aimedShot(targetBoss, rage ? 9 : 5 + tier, 0.085, rage ? 285 : 245);
    return rage ? 0.55 : 0.86;
  }
  if (pattern === 'balance' || pattern === 'aegis') {
    const side = Math.floor(targetBoss.age * 1.4) % 2 ? -1 : 1;
    bossFan(targetBoss.x, targetBoss.y + 25, 8 + tier, 0.2, Math.PI - 0.2, 195, color, side * 0.22);
    return rage ? 0.58 : 0.82;
  }
  if (pattern === 'venom') {
    for (let arm = 0; arm < 3; arm += 1) bossFan(targetBoss.x, targetBoss.y, 5 + tier, Math.PI / 2, Math.PI / 2, 165 + arm * 24, color, spin + arm * Math.PI * 2 / 3);
    return rage ? 0.48 : 0.68;
  }
  if (pattern === 'streams' || pattern === 'tsunami') {
    const count = pattern === 'tsunami' ? 13 + tier : 9 + tier;
    bossFan(targetBoss.x, targetBoss.y + 20, count, 0.14, Math.PI - 0.14, pattern === 'tsunami' ? 230 : 190, color, Math.sin(targetBoss.age * 1.8) * 0.24);
    return rage ? 0.48 : 0.74;
  }
  if (pattern === 'spiral') {
    const patternConfig = game.balance?.bossPattern;
    const armCount = Math.max(4, boostedBossBarrageCount(4 * (patternConfig?.bulletCount || 1)));
    for (let arm = 0; arm < armCount; arm += 1) {
      fireEnemyBullet(
        targetBoss.x,
        targetBoss.y,
        spin + arm * Math.PI * 2 / armCount,
        (180 + (arm % 2) * 35) * (patternConfig?.bulletSpeed || 1),
        color,
        1,
        (patternConfig?.bulletDamage || 22) * BOSS_BARRAGE_DAMAGE_MULTIPLIER,
        game.balance?.bossDamage,
      );
    }
    return rage ? 0.12 : 0.17;
  }
  if (pattern === 'war') {
    aimedShot(targetBoss, rage ? 11 : 7, 0.09, 260);
    bossFan(targetBoss.x, targetBoss.y, 10 + tier, 0.3, Math.PI - 0.3, 175, color, spin * 0.3);
    return rage ? 0.46 : 0.7;
  }
  if (pattern === 'thunder') {
    aimedShot(targetBoss, rage ? 13 : 7, 0.065, rage ? 330 : 285);
    bossFan(targetBoss.x, targetBoss.y, 12 + tier, 0, Math.PI * 2, 205, color, spin);
    return rage ? 0.38 : 0.58;
  }
  aimedShot(targetBoss, rage ? 7 : 5, 0.12, 230);
  return rage ? 0.58 : 0.86;
}

function queueBossZones(targetBoss, targets, color, damage, radius = 64, duration = 0.82) {
  for (const target of targets) {
    queueHostileTelegraph({
      source: targetBoss,
      type: 'zone',
      targetX: target.x,
      targetY: target.y,
      radius,
      duration,
      color,
      execute: () => {
        if (targetBoss.dead) return;
        if ((player.x - target.x) ** 2 + (player.y - target.y) ** 2 < (radius + player.radius) ** 2) hitPlayer(damage, 'boss-zone');
        impactExplosion(target.x, target.y, color, 0.92);
      },
    });
  }
}

function startBossAttack(targetBoss) {
  // All live chapters (including the trial) use the same authored, low-density
  // chapter deck. No fifth-volley fallback into the old hard zodiac patterns.
  {
    targetBoss.lastMove='readableBarrage';
    const plan=bossBarragePlan({x:targetBoss.x,y:targetBoss.y,chapter:game.stageIndex,
      volley:targetBoss.volleyCount,targetX:player.x,targetY:player.y});
    sfx.bossFire(targetBoss.config.pattern,targetBoss.phase);
    queuePatternVolley(targetBoss,plan,{limit:72,windup:plan.duration,
      damage:(Number(game.balance?.bossPattern?.bulletDamage)||22)*.8,multiplier:game.balance?.bossDamage});
    return plan.cooldown;
  }
}

function updateBoss(dt) {
  if (!boss || boss.dead) return;
  const previousBossX=boss.x,previousBossY=boss.y;
  boss.collisionPreviousX = previousBossX;
  boss.collisionPreviousY = previousBossY;
  boss.age += dt;
  if (boss.burnTime > 0) {
    boss.burnTime -= dt;
    boss.hp -= boss.burnDps * dt;
    if (Math.random() < dt * 5) hitSpark(boss.x + (Math.random() - 0.5) * boss.radius, boss.y + (Math.random() - 0.5) * boss.radius, COLORS.red, false);
    if (boss.hp <= 0) { killBoss(); return; }
  }
  if (boss.frostTime > 0) boss.frostTime -= dt;
  if (boss.stunTime > 0) boss.stunTime -= dt;
  if (boss.vulnerabilityTime > 0) boss.vulnerabilityTime -= dt;
  updateRedHuntMarker(boss, dt);
  // Chapters share a single-phase boss rule; content varies by scene and enemy.
  boss.phase = 1;
  boss.phaseArmor.visible = false;
  boss.rageForm.visible = false;
  boss.coreGlow.alpha = 0.46 + Math.sin(boss.age * 8) * 0.13;
  const hitScale = updateHitReaction(boss, dt);
  boss.view.scale.set(boss.baseScale * hitScale);
  const statusSpeed = (boss.frostTime > 0 ? 1 - runStats.frostStrength * 0.45 : 1) * (boss.stunTime > 0 ? 0.28 : 1);
  const bossSpeed = game.balance?.bossSpeed || 1;
  if (!boss.entered) {
    boss.entryProgress=Math.min(1,(boss.entryProgress||0)+65*bossSpeed*statusSpeed*dt/350);
    const u=boss.entryProgress;
    const entryStartY=boss.entryStartY ?? -175;
    boss.y=entryStartY+(175-entryStartY)*(u*u*u*(u*(u*6-15)+10));
    if (u >= 1) {
      boss.y = 175;
      boss.entered = true;
      showBattleNotice('boss-engage', '旗舰接战', 1.2);
      // The arrival accent belongs to the visible hull settling into place,
      // not its creation above the screen. Keep the first-shot delay intact.
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        game.shake = Math.max(game.shake, 4);
        ringEffect(boss.x, boss.y, boss.visualColor || boss.config.color, boss.radius * 1.15, .4);
      }
    }
  } else if (boss.dash) {
    boss.dash.elapsed += dt * statusSpeed;
    const progress = Math.min(1, boss.dash.elapsed / Math.max(0.01, boss.dash.duration));
    const easedProgress = 1 - (1 - progress) ** 3;
    boss.x = boss.dash.startX + (boss.dash.targetX - boss.dash.startX) * easedProgress;
    boss.y = boss.dash.startY + (boss.dash.targetY - boss.dash.startY) * easedProgress;
    if (progress >= 1) {
      const impactRadius = boss.radius + player.radius + 12;
      const connects = (boss.x - player.x) ** 2 + (boss.y - player.y) ** 2 <= impactRadius ** 2;
      impactExplosion(boss.x, boss.y, boss.config.accent, 1.18);
      ringEffect(boss.x, boss.y, boss.config.color, impactRadius * 1.45, 0.36);
      game.shake = Math.max(game.shake, 13);
      if (connects) hitPlayer(68 * (game.balance?.bossDamage || 1), 'boss-dash');
      boss.dash = null;
    }
  } else {
    // Hold the firing platform during windup; beam warnings and ring openings
    // must not sweep across the player while being emitted.
    if(!boss.attackPending)boss.movePhase += dt * bossSpeed * statusSpeed;
    const {x:targetX,y:targetY}=chapterBossPosition(game.stageIndex,boss.movePhase,boss.phase,W);
    const movementResponse = 1 - Math.exp(-6 * Math.max(0.28, statusSpeed) * dt);
    boss.x += (targetX - boss.x) * movementResponse;
    boss.y += (targetY - boss.y) * movementResponse;
    boss.fireTimer -= dt * statusSpeed;
    if (!boss.attackPending && boss.fireTimer <= 0) {
      const baseCooldown = startBossAttack(boss);
      boss.volleyCount += 1;
      const stageRate = Math.max(0.72, 1 - game.stageIndex * 0.012);
      const openingRate = game.stageIndex === 0 ? 1.22 : 1;
      const barrageInterval = BOSS_BARRAGE_MOVES.has(boss.lastMove)
        ? BOSS_BARRAGE_INTERVAL_BY_DIFFICULTY[game.difficultyId]
        : null;
      boss.fireTimer = Math.max(
        boss.lastMove === 'readableBarrage' ? baseCooldown : 0,
        Number(BALANCE_GLOBAL.minBossCooldown) || 0.13,
        boss.lastMove === 'readableBarrage' && boss.config.mainlineBalanceVersion
          ? baseCooldown * boss.config.readableBossRecovery
          : barrageInterval || (baseCooldown * stageRate * openingRate * (game.balance?.bossCooldown || 1)),
      );
    }
  }
  if (boss.revealedAt == null && (boss.entered || enemyHasEnteredView(boss))) {
    boss.revealedAt = game.elapsed;
  }
  boss.view.position.set(boss.x, boss.y);
  boss.view.rotation = boss.model?.libraryEnemy ? 0 : Math.sin(boss.age * 0.7) * 0.045;
  boss.halo.rotation = boss.age * 0.18;
  boss.halo.alpha = 0.68 + Math.sin(boss.age * 2.4) * 0.18;
  boss.phaseArmor.rotation = Math.sin(boss.age * 1.6) * (boss.phase >= 3 ? 0.035 : 0.018);
  boss.rageForm.rotation = -Math.sin(boss.age * 2.1) * 0.025;
  boss.motif.rotation = boss.phase >= 2 ? Math.sin(boss.age * 1.7) * 0.055 : 0;
  boss.engines.scale.y = 0.85 + Math.sin(boss.age * 16) * 0.16;
  boss.engines.alpha = 0.72 + Math.sin(boss.age * 20) * 0.18;
  updateBossArt(boss);
  if(boss.model){
    boss.model.updateEnemy(boss.age,{phase:boss.phase,charging:boss.attackPending,motionDt:dt*statusSpeed,
      healthRatio:Math.max(0,boss.hp/Math.max(1,boss.maxHp)),wearDt:dt,
      wearActive:boss.entered&&game.state==='playing',reducedMotion:REDUCED_MOTION,
      vx:dt>0?(boss.x-previousBossX)/dt:0,vy:dt>0?(boss.y-previousBossY)/dt:0});
    const wearSpark = boss.model.consumeWearSpark?.();
    if (wearSpark && boss.entered && game.state === 'playing') {
      // The adapter returns the current articulated part in model-local space.
      // Convert only for drawing; collision/muzzle coordinates remain unchanged.
      const x = wearSpark.x * boss.view.scale.x, y = wearSpark.y * boss.view.scale.y;
      const c = Math.cos(boss.view.rotation), s = Math.sin(boss.view.rotation);
      combatVfx.impact(boss.x+x*c-y*s,boss.y+x*s+y*c,wearSpark.color ?? 0xffc17f,
        .5,false,{priority:'ambient',core:false});
    }
    for(const child of boss.view.children) child.visible=child===boss.model;
  }
}

function spawnClusterFragments(b) {
  const fragmentCount = Math.min(14, Math.max(0, b.clusterFragments));
  if (!fragmentCount) return;
  const baseAngle = Math.atan2(b.vy, b.vx);
  for (let index = 0; index < fragmentCount; index += 1) {
    const normalized = fragmentCount === 1 ? 0 : index / (fragmentCount - 1) - 0.5;
    const angle = baseAngle + normalized * 1.75 + (Math.random() - 0.5) * 0.12;
    firePlayerBullet(b.x, b.y, angle, {
      style: 'cluster',
      weaponLevel: 1,
      finalDamage: b.damage * b.clusterFragmentDamage,
      speed: 470 + Math.random() * 150,
      pierce: 0,
      splitLevel: 0,
      clusterFragments: 0,
      clusterFuse: 0,
      explosionRadius: Math.max(12, runStats.clusterExplosionRadius * 0.22),
      scale: 0.56,
      effectPath: 'cluster',
    });
  }
  b.clusterFragments = 0;
  burst(b.x, b.y, 0xff704d, 10 + Math.ceil(fragmentCount / 2), 125);
  ringEffect(b.x, b.y, 0xffc25f, Math.max(42, runStats.clusterExplosionRadius * 0.78), 0.28);
}

function collisionStart(entity) {
  return { x: entity.collisionPreviousX ?? entity.x, y: entity.collisionPreviousY ?? entity.y };
}

function pointSegmentDistanceSquared(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0.001) return (px - ax) ** 2 + (py - ay) ** 2;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  const x = ax + dx * t;
  const y = ay + dy * t;
  return (px - x) ** 2 + (py - y) ** 2;
}

function updateTetherPairs() {
  for (let index = tetherPairs.length - 1; index >= 0; index -= 1) {
    const pair = tetherPairs[index];
    if (!pair.left.active || !pair.right.active) {
      for (const orb of [pair.left, pair.right]) {
        if (!orb.active) continue;
        friendlyPool.release(orb);
        const bulletIndex = playerBullets.indexOf(orb);
        if (bulletIndex >= 0) playerBullets.splice(bulletIndex, 1);
      }
      pair.view.removeFromParent();
      pair.view.destroy();
      tetherPairs.splice(index, 1);
      continue;
    }
    const left = projectWorldPoint(pair.left.x, pair.left.y);
    const right = projectWorldPoint(pair.right.x, pair.right.y);
    const midX = (left.x + right.x) / 2;
    const midY = (left.y + right.y) / 2;
    pair.view.clear()
      .moveTo(left.x, left.y)
      .lineTo(midX - 9, midY - 5)
      .lineTo(midX + 9, midY + 5)
      .lineTo(right.x, right.y)
      .stroke({ color: 0xeafff6, width: 5, alpha: 0.2 })
      .moveTo(left.x, left.y)
      .lineTo(midX - 9, midY - 5)
      .lineTo(midX + 9, midY + 5)
      .lineTo(right.x, right.y)
      .stroke({ color: 0x65ffb5, width: 2.1, alpha: 0.92 });

    const source = {
      style: 'tether',
      effectPath: 'tether',
      damage: pair.damage,
      critChance: pair.critChance,
      critMultiplier: pair.critMultiplier,
      bossDamageMultiplier: pair.bossDamageMultiplier,
      burnDps: 0,
      burnDuration: 0,
      frostChance: 0,
      frostDuration: 0,
      chainChance: 0,
      chainDamage: 0,
      chainJumps: 0,
      explosionRadius: 0,
      knockback: 0,
      stunChance: pair.stunChance,
      stunDuration: pair.stunDuration,
      vulnerability: 0,
      vulnerabilityDuration: 0,
    };
    const targets = damageTargetsInRange(
      (pair.left.x + pair.right.x) / 2,
      (pair.left.y + pair.right.y) / 2,
      Math.abs(pair.left.x - pair.right.x) + 80,
    );
    for (const target of targets) {
      if (game.elapsed < (pair.cooldowns.get(target) || 0)) continue;
      const hitRadius = (target.radius || 16) + 9;
      if (pointSegmentDistanceSquared(target.x, target.y, pair.left.x, pair.left.y, pair.right.x, pair.right.y) > hitRadius * hitRadius) continue;
      pair.cooldowns.set(target, game.elapsed + 0.28);
      resolvePlayerHit(target, source, target.x, target.y);
    }
  }
}

// Apply aircraft base growth at the final damage boundary. Keep the weapon
// simulation's cadence, contacts, derived triggers and visual values intact.
function fixedAircraftDamage(amount, isBoss = false, isElite = false) {
  return finalPeripheralDamage(amount, game.peripheralSnapshot, { boss: isBoss, elite: isElite });
}

function updateFixedParts(dt) {
  const targets = [...enemies, ...(boss && boss.entered ? [boss] : [])]
    .filter(e=>!e.dead&&combatCircleIntersectsView(e.x,e.y,e.hurtRadius ?? e.radius));
  const worldTargets=targets.map(e=>({id:e.fixedTargetId ||= ++game.fixedTargetSerial,x:e.x,y:e.y,previousX:e.collisionPreviousX??e.x,previousY:e.collisionPreviousY??e.y,radius:e.hurtRadius ?? e.radius,boss:e===boss,elite:Boolean(e.elite),hp:e.hp,reward:e.xpValue||2}));
  const hasTargets = targets.length>0;
  const hostiles=enemyBullets.map(b=>({id:b.commonBulletId,x:b.x,y:b.y,vx:b.vx,vy:b.vy,radius:b.radius,enhanced:b.enhanced}));
  const top = renderer.type === 'three' ? enemyTopEntryY(0) : -WORLD_PROJECTION_OFFSET;
  for (const shot of game.fixedCombat.step(dt, { hasTargets,targets:worldTargets,origin:player,height:H,width:W,top,hostiles })) {
    const muzzle = player.aircraft.model.fixedParts.muzzle(shot.slotId, shot.barrel, bulletLayer);
    const angle = game.fixedCombat.direction(shot, muzzle, player, H);
    game.fixedCombat.launch(shot,muzzle,angle,H);
    if(shot.energy)continue;
    const b = firePlayerBullet(muzzle.x, muzzle.y, -Math.PI / 2, {
      style: 'white', weaponLevel: 1, finalDamage: shot.damage, pierce: 0, splitLevel: 0,
      noEffects: true, homing: false, critChance: 0, bossDamageMultiplier: 1, eliteDamageMultiplier: 1,
      fixedSource: shot.source, fixedLife: shot.life, fixedFirstStep: shot.firstStep, scale: shot.pulse ? 1.1 : .8,
    });
    const velocity=fixedLaunchVelocity(angle,shot.speedRatio*H,game.fixedCombat.velocity);
    b.vx=velocity.x;b.vy=velocity.y;
    b.view.rotation = angle;
    b.radius = shot.radius;
    if(shot.rail){b.view.scale.x*=shot.radius/2.2;b.view.scale.y*=2.3;}
    b.fixedOrigin={x:muzzle.x,y:muzzle.y};b.fixedAngle=angle;
    b.rocketGuidance=null;b.fixedExploded=false;
    b.fixedRules = shot; b.fixedTargets = new Set(); b.fixedRemaining = shot.penetration;
    b.fixedBounces=shot.bounces||0;b.fixedDistance=0;
    b.mass=shot.mass;b.restitution=shot.restitution;b.fixedSpeed=shot.speedRatio*H;
    b.fixedGuided=game.fixedCombat.guides(shot.source.weaponId);b.fixedContacts=new Set();b.fixedIgnoreUntil=-Infinity;b.fixedNormalize=false;b.fixedHitCount=0;b.fixedContactId=0;
    b.fixedFirstStep=shot.firstStep ?? dt;b.fixedStepRemaining=0;b.fixedShape=null;b.fixedShapeBound=null;
    b.view.tint = b.fixedGuided?0xd391ff:shot.pulse ? 0xffc45c : shot.rail ? 0x82f5f2 : shot.calibrated ? 0x91f8cf : shot.cross ? 0x98bcff : 0xeaf6ff;
    attachFixedProjectileArt(b,shot,H);
    combatVfx.muzzle(muzzle.x,muzzle.y,angle,shot.rail?0x9cdaff:0xffc78a);
  }
  for(const effect of game.fixedCombat.takeWorldEffects()){
    if(effect.block&&effect.hostileId){const index=enemyBullets.findIndex(b=>b.commonBulletId===effect.hostileId);if(index>=0){hostilePool.release(enemyBullets[index]);enemyBullets.splice(index,1);}continue;}
    const target=targets.find(t=>t.fixedTargetId===effect.targetId);
    if(target&&!target.dead){
      if(effect.control){
        if(effect.freeze)target.stunTime=Math.max(target.stunTime||0,effect.freeze);
        if(target!==boss&&Number.isFinite(effect.dx)&&Number.isFinite(effect.dy)){target.x+=effect.dx;target.y+=effect.dy;}
        continue;
      }
      if(effect.rootBlast||effect.rootBeam){
        const id=target.fixedTargetId,source=effect.source;
        if(game.fixedCombat.hit(source,id,{x:effect.x,y:effect.y,damage:effect.damage,distance:effect.distance,angle:effect.angle,boss:target===boss,shouldTrigger:target.shouldTriggerOnDeath!==false})){
          const before=Math.max(0,target.hp);target.lastFixedHitSource=source;
          if(target===boss)damageBoss(fixedAircraftDamage(effect.damage, true),effect.x,effect.y,true,'',effect.presentation);else damageEnemy(target,fixedAircraftDamage(effect.damage, false, target.elite),effect.x,effect.y,true,'',effect.presentation);
          game.fixedCombat.resolveHit(source,before-Math.max(0,target.hp),target.dead,id);
          for(const extra of game.fixedCombat.effects(source,id))if(!target.dead)applyFixedDerived(extra,target);
          if(target.dead)game.fixedCombat.forgetTarget(id);
        }
      }else applyFixedDerived(effect,target);
    }
  }
  combatVfx.setEnergy(game.fixedCombat.energyVisuals(),game.fixedCombat.visuals(),game.fixedCombat.blastVisuals());
}

function applyFixedDerived(effect,hit){
  const before=Math.max(0,hit.hp);hit.lastFixedHitSource=effect.source;
  if(hit===boss)damageBoss(fixedAircraftDamage(effect.damage, true),hit.x,hit.y,true);
  else damageEnemy(hit,fixedAircraftDamage(effect.damage, false, hit.elite),hit.x,hit.y,true);
  game.fixedCombat.recordDerived(effect,before-Math.max(0,hit.hp),hit.dead);
  ringEffect(hit.x,hit.y,effect.source.module.startsWith('focus')?0x9bf8a2:0x91e8f0,22,.14);
  if(hit.dead)game.fixedCombat.forgetTarget(hit.fixedTargetId);
}

function updateFixedBullet(b, dt) {
  syncFixedProjectileShape(b);
  const targets = boss && !boss.dead && boss.entered ? [...enemies, boss] : enemies;
  if(boss)boss.fixedStatic=true;
  let remaining = Math.min(dt, b.fixedFirstStep ?? dt), consumed = false;
  b.fixedFirstStep = null;
  // Move every frame, including slow-motion fractions. Guidance impulses keep
  // their fixed cadence, while collisions use each interval's enemy positions.
  while (!consumed && remaining > 1e-9) {
  if (!(b.fixedStepRemaining > 1e-9)) {
  b.fixedStepRemaining = PHYSICS_STEP;
  game.fixedCombat.guide(b,targets,H);
  const nextAngle=Math.atan2(b.vx,-b.vy);
  if(Math.abs(nextAngle-b.fixedAngle)>.008){
    game.fixedCombat.advance(b.fixedSource,b.x,b.y,[...b.fixedTargets].map(t=>t.fixedTargetId),false);
    game.fixedCombat.bend(b.fixedSource,b.x,b.y,nextAngle);
  }
  b.fixedAngle=nextAngle;
  }
  const step = Math.min(remaining, b.fixedStepRemaining);
  const motion = {start:(dt-remaining)/dt,end:(dt-remaining+step)/dt};
  consumed=advanceFixedProjectile(b,step,targets,(hit,impact)=>{
    if(b.fixedRules.missile){game.fixedCombat.explode(b.fixedRules,b.x,b.y);b.fixedExploded=true;}
    const source={...b.fixedSource,contactId:b.fixedContactId};
    const targetId = hit.fixedTargetId ||= ++game.fixedTargetSerial;
    const distance=b.fixedDistance;
    let damage=b.damage;
    if(b.fixedRules.rail){
      damage*=b.fixedHitCount===1?b.fixedRules.firstMultiplier:b.fixedRules.laterMultiplier;
      if(b.fixedRules.tactic==='T2'&&distance>H*.4)damage*=.8;
    }
    if (game.fixedCombat.hit(source, targetId,{distance,x:b.x,y:b.y,angle:b.fixedAngle,boss:hit===boss,damage:b.fixedRules.missile?b.fixedRules.blastDamage:b.damage,shouldTrigger:hit.shouldTriggerOnDeath!==false})) {
      const hpBefore = Math.max(0, hit.hp);
      combatVfx.impact(impact.x,impact.y,b.artModel?.color ?? COLORS.amber,b.fixedRules.rail ? .85 : .45,false);
      hit.lastFixedHitSource = b.fixedSource;
      if (hit === boss) damageBoss(fixedAircraftDamage(damage * (b.fixedHitCount === 1 ? b.fixedRules.bossMultiplier : 1), true), b.x, b.y);
      else damageEnemy(hit, fixedAircraftDamage(damage, false, hit.elite), b.x, b.y);
      game.fixedCombat.resolveHit(source, hpBefore - Math.max(0, hit.hp), hit.dead, targetId);
      for (const effect of game.fixedCombat.effects(source, targetId)) if (!hit.dead) {
        applyFixedDerived(effect,hit);
      }
      if (hit.dead) game.fixedCombat.forgetTarget(targetId);
    }
  },()=>{
    game.fixedCombat.advance(b.fixedSource,b.x,b.y,[...b.fixedTargets].map(t=>t.fixedTargetId),false);
    game.fixedCombat.bounce(b.fixedSource,b.x,b.y,b.fixedAngle);
    ringEffect(b.x,b.y,0x82f5f2,15,.12);
  },motion);
  remaining -= step;
  b.fixedStepRemaining -= step;
  }
  if(consumed&&b.fixedRules.missile&&!b.fixedExploded){game.fixedCombat.explode(b.fixedRules,b.x,b.y,true);b.fixedExploded=true;}
  b.view.position.set(b.x, b.y);b.view.rotation=b.fixedAngle;
  // Camera perspective exposes wider lanes than the nominal world rectangle.
  const ended=consumed || !combatCircleIntersectsView(b.x,b.y,b.fixedShapeBound ?? b.radius,100);
  game.fixedCombat.advance(b.fixedSource,b.x,b.y,[...b.fixedTargets].map(t=>t.fixedTargetId),ended);
  return ended;
}

function updateBullets(dt) {
  for (let i = playerBullets.length - 1; i >= 0; i -= 1) {
    const b = playerBullets[i];
    if (b.fixedSource) {
      if (updateFixedBullet(b, dt)) { friendlyPool.release(b); playerBullets.splice(i, 1); }
      continue;
    }
    b.age += dt;
    if (b.pendingHoming && b.age >= b.swordDelay && (!b.swordRearmAt || game.elapsed >= b.swordRearmAt)) {
      b.pendingHoming = false;
      b.homing = true;
      if (!isActiveDamageTarget(b.target)) b.target = nearestDamageTarget(b.x, b.y, null, 1000);
      ringEffect(b.x, b.y, 0xd8f4ff, 24, 0.12);
    }
    if (b.clusterFuse > 0) {
      b.clusterFuse -= dt;
      if (b.clusterFuse <= 0) {
        spawnClusterFragments(b);
        friendlyPool.release(b);
        playerBullets.splice(i, 1);
        continue;
      }
    }
    if (b.homing) {
      if (!isActiveDamageTarget(b.target)) b.target = nearestDamageTarget(b.x, b.y, null, 900);
      if (b.target) {
        const current = Math.atan2(b.vy, b.vx);
        const desired = Math.atan2(b.target.y - b.y, b.target.x - b.x);
        let delta = ((desired - current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        delta = Math.max(-b.homingStrength * dt, Math.min(b.homingStrength * dt, delta));
        const speed = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(current + delta) * speed;
        b.vy = Math.sin(current + delta) * speed;
        b.view.rotation = current + delta + Math.PI / 2;
      } else if (b.style === 'sword') {
        // A sword must never keep orbiting the last known position of an
        // enemy that was removed outside the normal death flow.
        b.expire = true;
      }
    }
    const motionStartX = b.x;
    const motionStartY = b.y;
    const motionVx = b.vx;
    const motionVy = b.vy;
    const motionPath = [{ x: b.x, y: b.y, t: 0 }];
    let pendingRicochet = false;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.ricochetBounces > 0) {
      let bounced = false;
      if ((b.x <= 18 && b.vx < 0) || (b.x >= W - 18 && b.vx > 0)) {
        b.x = Math.max(18, Math.min(W - 18, b.x));
        b.vx *= -1;
        bounced = true;
      }
      if ((b.y <= RICOCHET_TOP_WORLD_Y && b.vy < 0) || (b.y >= H - 22 && b.vy > 0)) {
        b.y = Math.max(RICOCHET_TOP_WORLD_Y, Math.min(H - 22, b.y));
        b.vy *= -1;
        bounced = true;
      }
      if (bounced) {
        b.ricochetBounces -= 1;
        pendingRicochet = true;
        const assistTarget = nearestDamageTarget(b.x, b.y, null, 380);
        if (assistTarget) {
          const current = Math.atan2(b.vy, b.vx);
          const desired = Math.atan2(assistTarget.y - b.y, assistTarget.x - b.x);
          let delta = ((desired - current + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          delta = Math.max(-0.28, Math.min(0.28, delta));
          const speed = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(current + delta) * speed;
          b.vy = Math.sin(current + delta) * speed;
        }
        ringEffect(b.x, b.y, COLORS.amber, 30 + b.radius, 0.18);
        burst(b.x, b.y, COLORS.amber, 5, 85);
        sfx.deflect(b.x, b.y);
        b.view.rotation = Math.atan2(b.vy, b.vx) + Math.PI / 2;
      }
    }
    if (b.waveAmplitude > 0) {
      const forwardEndX = b.x, forwardEndY = b.y;
      const previousWave = Math.sin(b.waveAge * b.waveFrequency + b.wavePhase);
      b.waveAge += dt;
      const nextWave = Math.sin(b.waveAge * b.waveFrequency + b.wavePhase);
      const speed = Math.max(1, Math.hypot(b.vx, b.vy));
      const waveDelta = (nextWave - previousWave) * b.waveAmplitude;
      b.x += (-b.vy / speed) * waveDelta;
      b.y += (b.vx / speed) * waveDelta;
      const heading = Math.atan2(b.vy, b.vx);
      const lateralSpeed = b.waveAmplitude * b.waveFrequency * Math.cos(b.waveAge * b.waveFrequency + b.wavePhase);
      b.view.rotation = heading + Math.PI / 2 + Math.atan2(lateralSpeed, speed);
      // Follow the wave itself, rather than cutting through its inside arc.
      const collisionSegments = Math.min(32, Math.max(1, Math.ceil(Math.abs(dt * b.waveFrequency) * 8)));
      for (let segment = 1; segment < collisionSegments; segment += 1) {
        const t = segment / collisionSegments;
        const wave = (Math.sin((b.waveAge - dt + dt * t) * b.waveFrequency + b.wavePhase) - previousWave) * b.waveAmplitude;
        motionPath.push({ x: motionStartX + (forwardEndX - motionStartX) * t - b.vy / speed * wave,
          y: motionStartY + (forwardEndY - motionStartY) * t + b.vx / speed * wave, t });
      }
      if (b.style === 'blue') {
        // High blue-spiral levels cover a large arc in one frame. Fill that
        // arc with evenly spaced after-images so the projectile remains a
        // continuous helix instead of looking like a series of hops.
        const forwardDistance = Math.hypot(motionVx * dt, motionVy * dt);
        const lateralDistance = Math.abs(waveDelta);
        const segments = Math.min(8, Math.max(1, Math.ceil(Math.max(forwardDistance, lateralDistance) / 11)));
        for (let segment = 1; segment <= segments; segment += 1) {
          const t = segment / segments;
          const phase = (b.waveAge - dt + dt * t) * b.waveFrequency + b.wavePhase;
          const lateralOffset = (Math.sin(phase) - previousWave) * b.waveAmplitude;
          projectileTrail({
            ...b,
            x: motionStartX + motionVx * dt * t + (-motionVy / speed) * lateralOffset,
            y: motionStartY + motionVy * dt * t + (motionVx / speed) * lateralOffset,
          });
        }
      }
    }
    b.view.position.set(b.x, b.y);
    if (['blue', 'missile', 'prism', 'ricochet', 'frost', 'cluster', 'sword', 'execute', 'tether'].includes(b.style) || b.weaponTier >= 6 || (b.style === 'red' && runStats.redOverdrive)) {
      if (b.style === 'blue' && b.waveAmplitude > 0) {
        // Blue spirals emit their trail above along the exact curve.
      } else {
      b.trailTimer -= dt;
      if (b.trailTimer <= 0) {
        b.trailTimer = b.style === 'missile' ? 0.055 : (b.style === 'sword' || b.style === 'execute') ? 0.22 : b.style === 'blue' ? 0.14 : 0.13;
        projectileTrail(b);
      }
      }
    }
    let consumed = false;
    let primaryTarget = null;
    motionPath.push({ x: b.x, y: b.y, t: 1 });
    const contacts = [];
    const candidates = b.style === 'sword' && game.elapsed < b.swordRearmAt
      ? [] : [...enemies, ...(boss && boss.entered ? [boss] : [])];
    for (const target of candidates) {
      if (target.dead || b.hitTargets.has(target)) continue;
      const targetStart = collisionStart(target);
      for (let step = 1; step < motionPath.length; step += 1) {
        const from = motionPath[step - 1], to = motionPath[step];
        const at = t => ({x:targetStart.x+(target.x-targetStart.x)*t,y:targetStart.y+(target.y-targetStart.y)*t});
        const time = movingCircleHitTime(from,to,at(from.t),at(to.t),b.radius+(target.hurtRadius ?? target.radius));
        if (time === null) continue;
        contacts.push({target,time:from.t+(to.t-from.t)*time,x:from.x+(to.x-from.x)*time,y:from.y+(to.y-from.y)*time});
        break;
      }
    }
    // Resolve the first physical contact, independent of enemy array order;
    // piercing shots can then reach the remaining contacts in the same frame.
    contacts.sort((a,z)=>a.time-z.time);
    for (const contact of contacts) {
      const target = contact.target;
      if (target.dead) continue;
      b.hitTargets.add(target);
      resolvePlayerHit(target,b,contact.x,contact.y);
      primaryTarget = target;
      if (b.style === 'sword') consumed = continueSwordAttacks(b);
      else if (b.style === 'ricochet' || b.persistOnHit) consumed = false;
      else if (b.pierce > 0 && !b.explosionRadius) b.pierce -= 1;
      else consumed = true;
      if (consumed) { b.x=contact.x; b.y=contact.y; b.view.position.set(b.x,b.y); }
      if (consumed || b.style === 'sword') break;
    }
    if (primaryTarget && b.explosionRadius > 0) {
      if (b.clusterFragments > 0) spawnClusterFragments(b);
      sfx.projectileImpact('cluster', b.x, b.y);
      burst(b.x, b.y, COLORS.amber, 16, 155);
      ringEffect(b.x, b.y, COLORS.red, b.explosionRadius, 0.38);
      if (b.explosionHitsPrimary) {
        const splashDamage = b.damage * b.splashDamageRatio;
        if (primaryTarget === boss) damageBoss(splashDamage, primaryTarget.x, primaryTarget.y);
        else if (!primaryTarget.dead) damageEnemy(primaryTarget, splashDamage, primaryTarget.x, primaryTarget.y);
      }
      for (const enemy of enemies) {
        if (enemy.dead || enemy === primaryTarget) continue;
        if ((enemy.x - b.x) ** 2 + (enemy.y - b.y) ** 2 <= b.explosionRadius ** 2) {
          damageEnemy(enemy, b.damage * b.splashDamageRatio, enemy.x, enemy.y);
        }
      }
      if (boss && !boss.dead && boss !== primaryTarget && (boss.x - b.x) ** 2 + (boss.y - b.y) ** 2 <= b.explosionRadius ** 2) {
        damageBoss(b.damage * b.splashDamageRatio, boss.x, boss.y);
      }
      game.shake = Math.max(game.shake, 4);
      consumed = true;
    }
    if (primaryTarget && b.splitLevel > 0 && !b.explosionRadius) {
      const baseAngle = Math.atan2(b.vy, b.vx);
      const splitCount = Math.min(4, 2 + Math.floor((b.splitLevel - 1) / 2));
      for (let splitIndex = 0; splitIndex < splitCount; splitIndex += 1) {
        const offset = (splitIndex - (splitCount - 1) / 2) * 0.34;
        const child = firePlayerBullet(b.x, b.y, baseAngle + offset, {
          style: b.style,
          weaponLevel: Math.max(1, b.weaponTier - 1),
          finalDamage: b.damage * b.splitDamage,
          splitLevel: b.splitLevel - 1,
          isSplit: true,
          pierce: Math.max(0, b.pierce),
          noEffects: b.splitLevel <= 1,
          scale: Math.max(0.58, b.view.scale.x * 0.76),
        });
        child.hitTargets.add(primaryTarget);
      }
      burst(b.x, b.y, b.style === 'blue' ? COLORS.blue : COLORS.cyan, 6 + splitCount, 90);
    }
    // Incoming travel used the old damage/contact set. Apply wall retention
    // only to the next frame's reflected leg, without re-hitting that path.
    if (pendingRicochet && !consumed) { b.damage *= b.ricochetRetention; b.hitTargets.clear(); }
    if (consumed || b.expire || !combatCircleIntersectsView(b.x,b.y,b.radius,100)) {
      friendlyPool.release(b);
      playerBullets.splice(i, 1);
    }
  }
  updateTetherPairs();
  for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
    const b = enemyBullets[i];
    const start = { x: b.x, y: b.y };
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.view.position.set(b.x, b.y);
    const rr = b.radius + player.radius;
    const distanceSq = (b.x - player.x) ** 2 + (b.y - player.y) ** 2;
    // Shots born after this frame's movement cannot hit the player's old path.
    const playerStart = b.spawnedAt === game.elapsed ? player : collisionStart(player);
    const contactTime = movingCircleHitTime(start,b,playerStart,player,rr);
    if (contactTime !== null) {
      if (game.flightFlipTime > 0.04) {
        if(!b.flipDodged){b.flipDodged=true;b.grazed=true;registerFlipDodge();}
      } else if (player.invincible <= 0 && game.pilotStealthTime <= 0) {
      hostilePool.release(b);
      enemyBullets.splice(i, 1);
      hitPlayer(b.damage, 'bullet');
      // hitPlayer removes nearby hostile bullets; stop this pass so stale
      // indexes from the previous array length are never read this frame.
      return;
      }
    }
    const grazeRadius = rr + 22;
    if (!b.grazed && movingCircleHitTime(start,b,playerStart,player,grazeRadius) !== null) b.grazeCandidate = true;
    if (b.grazeCandidate && !b.grazed && distanceSq > (grazeRadius + 10) ** 2) {
      b.grazed = true;
      registerNearMiss();
    }
    if (!combatCircleIntersectsView(b.x,b.y,b.radius,35)) {
      hostilePool.release(b);
      enemyBullets.splice(i, 1);
    }
  }
}

function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    const p = pickups[i];
    if (p.dead) { p.view.removeFromParent(); pickups.splice(i, 1); continue; }
    p.age += dt;
    if (p.type === 'battle-supply') {
      if (p.age > 1.4) {
        // Once attraction starts, never clamp back to the staging distance:
        // that distance (90) is outside the actual pickup radius (52).
        const attraction = 1 - Math.exp(-.9 * dt);
        p.x += (player.x - p.x) * attraction;
        p.y += (player.y - p.y) * attraction;
      } else {
        p.y = Math.min(player.y - 90, p.y + 132 * dt);
      }
    } else {
      p.y += 102 * dt;
      p.x += Math.sin(p.age * 3.4) * 26 * dt;
    }
    p.view.position.set(p.x, p.y);
    const emphasis=p.view.pickupEmphasis?.clear();
    const quiet=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lowRepair=p.type==='heal'&&game.hp/runStats.maxHp<=.3;
    const birth=Math.max(0,1-p.age/.65);
    if(emphasis&&(birth>0||lowRepair)){
      const color=p.type==='heal'?0x79ffc0:0xffdc74;
      const radius=quiet?27:27+(birth>0?8*(1-birth):3*Math.sin(p.age*3));
      emphasis.circle(0,0,radius).stroke({color,width:2,alpha:birth>0?birth:.55});
    }
    p.view.rotation = ['battle-supply', 'heal'].includes(p.type) ? Math.sin(p.age * 2.4) * .07 : p.view.rotation + dt * 1.8;
    const rr = p.radius + PLAYER_PICKUP_RADIUS;
    if ((p.x - player.x) ** 2 + (p.y - player.y) ** 2 < rr * rr) {
      collectPickup(p);
      if (!p.dead) continue;
      pickups.splice(i, 1);
      if (game.state !== 'playing') break;
      continue;
    }
    if (p.type !== 'battle-supply' && p.y > H + 30) { p.view.removeFromParent(); pickups.splice(i, 1); }
  }
}

function updateXpOrbs(dt) {
  const reduced = REDUCED_MOTION || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (let i = xpOrbs.length - 1; i >= 0; i -= 1) {
    const orb = xpOrbs[i];
    orb.age += dt;
    const dx = player.x - orb.x;
    const dy = player.y - orb.y;
    const distance = Math.hypot(dx, dy);
    const collectRadius = PLAYER_PICKUP_RADIUS + orb.radius;
    if (distance <= collectRadius) {
      gainXp(orb.value);
      orb.view.destroy();
      xpOrbs.splice(i, 1);
      if (game.state !== 'playing') break;
      continue;
    }
    if (!orb.collectFlight && (distance < runStats.magnetRange || orb.age > 7)) {
      const nx=dx/Math.max(1,distance), ny=dy/Math.max(1,distance);
      const retreat=reduced?0:Math.min(36,distance*.2), side=orb.vx<0?-1:1;
      orb.collectFlight={age:0,startX:orb.x,startY:orb.y,
        backX:orb.x-nx*retreat,backY:orb.y-ny*retreat,
        curveX:-ny*side*Math.min(36,distance*.15),curveY:nx*side*Math.min(36,distance*.15),
        kick:reduced?0:.1,duration:Math.min(.52,.22+distance/2200),reduced};
    }
    if (orb.collectFlight) {
      const flight=orb.collectFlight;flight.age+=dt;
      if(flight.age<flight.kick){
        const t=1-(1-flight.age/flight.kick)**2;
        orb.x=flight.startX+(flight.backX-flight.startX)*t;
        orb.y=flight.startY+(flight.backY-flight.startY)*t;
      }else{
        const t=Math.min(1,(flight.age-flight.kick)/flight.duration)**1.9, u=1-t;
        const cx=flight.backX+(player.x-flight.backX)*.45+flight.curveX;
        const cy=flight.backY+(player.y-flight.backY)*.45+flight.curveY;
        orb.x=u*u*flight.backX+2*u*t*cx+t*t*player.x;
        orb.y=u*u*flight.backY+2*u*t*cy+t*t*player.y;
      }
    } else {
      orb.vx *= Math.pow(0.25, dt);
      orb.vy = Math.min(95, orb.vy + 18 * dt);
      orb.x += orb.vx * dt;
      orb.y += orb.vy * dt;
    }
    orb.view.position.set(orb.x, orb.y);
    orb.view.rotation = reduced ? 0 : Math.sin(orb.age * 1.3) * .08;
    const movedDistance = Math.hypot(player.x - orb.x, player.y - orb.y);
    if (movedDistance <= collectRadius) {
      gainXp(orb.value);
      orb.view.destroy();
      xpOrbs.splice(i, 1);
      if (game.state !== 'playing') break;
    } else if (!orb.collectFlight && orb.y > H + 45 && orb.age < 7) {
      orb.y = H - 8;
      orb.vy = -28;
    }
  }
  experienceTrails.update(xpOrbs, dt, {enabled:!reduced, crowded:xpOrbs.length>36 || enemyBullets.length>40});
}

function supportModeFor(descriptor = {}) {
  const support = descriptor.support || {};
  if (support.kind === 'repair') return 'repair';
  if (support.kind === 'missile') return 'missile';
  if (support.kind === 'interceptor' || support.kind === 'shield') return 'intercept';
  if (support.kind === 'scanner' || support.kind === 'tractor') return 'jammer';
  if (support.mode === 'homing') return 'missile';
  if (support.mode === 'screen') return 'intercept';
  if (support.mode && !['formation', 'orbit', 'sweep'].includes(support.mode)) return support.mode;
  const style = `${descriptor.style || ''} ${descriptor.moduleId || ''}`;
  if (/repair/i.test(style)) return 'repair';
  if (/intercept/i.test(style)) return 'intercept';
  if (/missile/i.test(style)) return 'missile';
  if (/frost|jam/i.test(style)) return 'jammer';
  return 'assault';
}

function createDroneView(descriptor = {}) {
  const color = descriptor.color || COLORS.cyan;
  const mode = supportModeFor(descriptor);
  const view = new Container();
  view.addChild(new Graphics()
    .poly([0, -15, 13, 7, 5, 12, 0, 8, -5, 12, -13, 7]).fill({ color: 0x17333c })
    .poly([0, -10, 5, 5, 0, 9, -5, 5]).fill({ color })
    .circle(0, 1, mode === 'repair' ? 4 : 3).fill({ color: mode === 'repair' ? 0x8dffb3 : COLORS.white })
    .circle(0, 0, 17).stroke({ color, width: 1, alpha: 0.24 }));
  view.children.forEach(child => { child.visible = false; });
  const droneModel = createEnemyModel('scout');
  droneModel.scale.set(.38);droneModel.rotation=Math.PI;
  view.addChild(droneModel);
  companionLayer.addChild(view);
  return {
    view,
    descriptor,
    x: player.x,
    y: player.y,
    angle: Math.random() * Math.PI * 2,
    fireTimer: Math.random() * 0.7,
  };
}

function syncDrones() {
  const desired = [];
  const rogueliteCount = skillActive('drone') ? runStats.droneCount : 0;
  for (let i = 0; i < rogueliteCount; i += 1) {
    desired.push({
      moduleId: `roguelite-drone-${i}`,
      color: COLORS.cyan,
      support: {
        kind: 'drone',
        mode: 'assault',
        damage: runStats.droneDamage,
        fireInterval: runStats.droneFireInterval,
        homing: true,
        homingStrength: runStats.droneHomingStrength,
      },
    });
  }
  for (const module of game.assemblySupports || runStats.assemblySupports || []) {
    const support = module.support || {};
    if (!['drone', 'companion', 'wingman', 'missile', 'repair', 'interceptor', 'shield', 'scanner', 'tractor'].includes(support.kind)) continue;
    for (let i = 0; i < Math.max(1, support.units || support.count || 1); i += 1) {
      desired.push({ ...module, moduleId: `${module.moduleId}-${i}` });
    }
  }
  const signature = desired.map((item) => item.moduleId).join('|');
  if (drones.signature === signature) return;
  drones.splice(0).forEach((drone) => drone.view.removeFromParent());
  desired.forEach((descriptor) => drones.push(createDroneView(descriptor)));
  drones.signature = signature;
}

function updateDrones(dt) {
  for (let i = 0; i < drones.length; i += 1) {
    const drone = drones[i];
    const support = drone.descriptor.support || {};
    const mode = supportModeFor(drone.descriptor);
    drone.angle += dt * (0.8 + i * 0.07);
    const slot = drone.angle + i * (Math.PI * 2 / Math.max(1, drones.length));
    const desiredX = player.x + Math.cos(slot) * (52 + i * 7);
    const desiredY = player.y + Math.sin(slot) * 24;
    drone.x += (desiredX - drone.x) * (1 - Math.pow(0.002, dt));
    drone.y += (desiredY - drone.y) * (1 - Math.pow(0.002, dt));
    drone.view.position.set(drone.x, drone.y);
    drone.view.rotation = Math.sin(game.elapsed * 3 + i) * 0.12;
    drone.fireTimer -= dt;
    if (drone.fireTimer <= 0) {
      const interval = Math.max(
        0.35,
        (support.fireInterval || support.interval || support.cooldown || 1.1)
          / (runStats.supportFireRateMultiplier || 1),
      );
      if (mode === 'repair') {
        if (game.hp < runStats.maxHp) {
          const heal = Math.max(1, (support.heal || 2) * (runStats.healingMultiplier || 1));
          game.hp = Math.min(runStats.maxHp, game.hp + heal);
          ringEffect(drone.x, drone.y, 0x8dffb3, 54, 0.34);
        }
        drone.fireTimer = interval;
        continue;
      }
      if (mode === 'intercept') {
        const bulletIndex = enemyBullets.findIndex((bullet) => (
          (bullet.x - drone.x) ** 2 + (bullet.y - drone.y) ** 2 < (support.radius || 115) ** 2
        ));
        if (bulletIndex >= 0) {
          const bullet = enemyBullets[bulletIndex];
          burst(bullet.x, bullet.y, drone.descriptor.color || COLORS.cyan, 7, 90);
          hostilePool.release(bullet);
          enemyBullets.splice(bulletIndex, 1);
        }
        drone.fireTimer = interval;
        continue;
      }
      const target = nearestDamageTarget(drone.x, drone.y, null, 760);
      if (target) {
        const angle = Math.atan2(target.y - drone.y, target.x - drone.x);
        const style = mode === 'missile' ? 'missile' : mode === 'jammer' ? 'frost' : 'blue';
        const homing = mode === 'missile' || Boolean(support.homing);
        const baseDamage = support.damage
          || (support.damageMultiplier ? runStats.droneDamage * support.damageMultiplier : runStats.droneDamage);
        if (mode === 'jammer') {
          target.frostTime = Math.max(target.frostTime || 0, target === boss ? 0.45 : 1.4);
        }
        firePlayerBullet(drone.x, drone.y - 8, angle, {
          style,
          finalDamage: baseDamage * combatPowerMultiplier() * (runStats.supportDamageMultiplier || 1),
          speed: mode === 'missile' ? 430 : 610,
          homing,
          homingStrength: support.homingStrength || (mode === 'missile' ? 4.8 : 0),
          target: homing ? target : null,
          explosionRadius: mode === 'missile' ? (support.explosionRadius || 48) : 0,
          frostChance: mode === 'jammer' ? 1 : 0,
          pierce: runStats.swarmOverdrive ? 1 : 0,
          scale: mode === 'missile' ? 0.82 : 0.72,
          weaponLevel: 1,
          effectPath: 'mech',
        });
        drone.fireTimer = interval / Math.max(0.5, runStats.droneFireRate || 1);
      } else {
        drone.fireTimer = Math.min(0.5, interval);
      }
    }
  }
}

function updateLaser(dt) {
  laserBeamView.clear();
  if (runStats.laserDps <= 0) {
    game.laserDamageTimer = 0;
    sfx.laserLoop(false);
    return;
  }
  const targets = damageTargetsInRange(player.x, player.y, runStats.laserRange).slice(0, Math.min(6, runStats.laserTargets));
  if (!targets.length) {
    game.laserDamageTimer = 0;
    sfx.laserLoop(false);
    return;
  }
  sfx.laserLoop(true);
  const start = projectWorldPoint(player.x, player.y - 34);
  for (const target of targets) {
    const end = projectWorldPoint(target.x, target.y);
    const jitter = Math.sin(game.elapsed * 38 + target.x * 0.03) * 5;
    laserBeamView
      .moveTo(start.x, start.y)
      .lineTo((start.x + end.x) / 2 + jitter, (start.y + end.y) / 2)
      .lineTo(end.x, end.y)
      .stroke({ color: 0xff7a24, width: 9, alpha: .13 })
      .moveTo(start.x, start.y)
      .lineTo((start.x + end.x) / 2 + jitter, (start.y + end.y) / 2)
      .lineTo(end.x, end.y)
      .stroke({ color: 0xffc72e, width: 5.5, alpha: .24 })
      .moveTo(start.x, start.y)
      .lineTo((start.x + end.x) / 2 + jitter, (start.y + end.y) / 2)
      .lineTo(end.x, end.y)
      .stroke({ color: 0xffff83, width: 3.2, alpha: .94 })
      .circle(end.x, end.y, (8) + Math.sin(game.elapsed * 18) * 2)
      .stroke({ color: 0xffffe5, width: 2, alpha: .86 });
  }

  game.laserDamageTimer = (game.laserDamageTimer || 0) + dt;
  if (game.laserDamageTimer < 0.1) return;
  const tick = game.laserDamageTimer;
  game.laserDamageTimer = 0;
  const power = combatPowerMultiplier();
  for (const target of targets) {
    if (target.dead) continue;
    const bossMultiplier = target === boss ? runStats.laserBossMultiplier * runStats.bossDamageMultiplier : 1;
    const damage = runStats.laserDps * tick * power * bossMultiplier * targetVulnerabilityMultiplier(target);
    target.burnTime = Math.max(target.burnTime || 0, runStats.laserBurnDuration);
    target.burnDps = Math.max(target.burnDps || 0, runStats.laserBurnDps * power);
    if (target === boss) damageBoss(damage, target.x, target.y);
    else damageEnemy(target, damage, target.x, target.y);
    if (Math.random() < 0.45) hitSpark(target.x, target.y, 0xffdf5f, false);
  }
}

function fireSanctuaryEchoLances(count, effect) {
  const targets = damageTargetsInRange(player.x, player.y, 1200);
  for (let index = 0; index < count; index += 1) {
    const slot = index - (count - 1) / 2;
    const target = targets[index % Math.max(1, targets.length)]
      || nearestDamageTarget(player.x, player.y, null, 1200);
    firePlayerBullet(player.x + slot * 7, player.y - 24, -Math.PI / 2 + slot * 0.035, {
      style: 'missile',
      damage: effect.projectileDamageRatio,
      speed: 620,
      homing: true,
      homingStrength: 5.6,
      target,
      pierce: 0,
      splitLevel: 0,
      noEffects: true,
      scale: 0.72,
    });
  }
}

function activatePilotAbility(pilot = getActivePilot(), aircraftSkill = false) {
  const ability = pilot.ability;
  const color = Number.parseInt(pilot.color.slice(1), 16);
  if (ability.type === 'phase') {
    game.pilotStealthTime = ability.duration;
    ringEffect(player.x, player.y, color, 128, 0.48);
    const weapon = currentPrimaryWeapon();
    if (exclusiveEffectActive(weapon, pilot.id) && weapon.exclusiveEffect.id === 'phase-counterpoint') {
      game.phaseAfterimage = createPhaseAfterimageState(weapon.exclusiveEffect);
      player.phaseAfterimages.visible = true;
    }
  } else if (ability.type === 'heal') {
    const before = game.hp;
    const amount = Math.max(1, Math.ceil(runStats.maxHp * ability.ratio));
    game.hp = Math.min(runStats.maxHp, game.hp + amount);
    if (game.hp <= before) {
      const shield=runStats.maxHp * ability.fullHealthShieldRatio;
      if(!aircraftSkill||!(game.pilotBarrierTime>0)||shield>=(game.pilotBarrierHp||0)) {
        game.pilotBarrierHp=shield;
        game.pilotBarrierTime=ability.shieldDuration;
      }
    }
    ringEffect(player.x, player.y, color, 112, 0.52);
    shipCallout(game.hp > before ? `+${Math.ceil(game.hp - before)}` : `护盾 ${Math.ceil(game.pilotBarrierHp)}`, color);
  } else if (ability.type === 'missile') {
    const targets = damageTargetsInRange(player.x, player.y, 1100);
    for (let index = 0; index < ability.count; index += 1) {
      const target = targets[index % Math.max(1, targets.length)] || nearestDamageTarget(player.x, player.y, null, 1100);
      firePlayerBullet(player.x + (index - 1) * 13, player.y - 18, -Math.PI / 2 + (index - 1) * 0.16, {
        style: 'missile',
        damage: ability.damage,
        homing: true,
        target,
        explosionRadius: 72,
        pierce: 0,
        noEffects: true,
      });
    }
  } else if (ability.type === 'sanctuary') {
    game.pilotShieldReady = storeImmunityCharges(Number(game.pilotShieldReady), ability) > 0;
    game.aircraftImmunitySource=aircraftSkill?{name:pilot.skillName,color:pilot.color}:null;
    const clearedBullets = clearHostileBulletsNear(player.x, player.y, ability.radius);
    ringEffect(player.x, player.y, color, ability.radius, 0.75);
    const weapon = currentPrimaryWeapon();
    if (exclusiveEffectActive(weapon, pilot.id) && weapon.exclusiveEffect.id === 'sanctuary-echo') {
      fireSanctuaryEchoLances(
        sanctuaryEchoProjectileCount(clearedBullets, weapon.exclusiveEffect),
        weapon.exclusiveEffect,
      );
    }
  } else {
    return;
  }
  if(!aircraftSkill)triggerPilotSkillCutIn();
  if (!aircraftSkill&&!pixiCombatUi) showToast(`${pilot.name} · ${pilot.skillName}`);
  sfx.active();
}

function updateRunAbilities(dt) {
  const pilotAbility = getActivePilot().ability;
  if (pilotAbility.interval > 0) {
    game.pilotAbilityTimer -= dt;
    if (game.pilotAbilityTimer <= 0) {
      activatePilotAbility();
      game.pilotAbilityTimer = pilotAbility.interval;
    }
  }
  if (game.pilotStealthTime > 0) {
    game.pilotStealthTime = Math.max(0, game.pilotStealthTime - dt);
  }
  if (game.phaseAfterimage?.remaining > 0) {
    game.phaseAfterimage.remaining = Math.max(0, game.phaseAfterimage.remaining - dt);
    player.phaseAfterimages.visible = game.phaseAfterimage.remaining > 0;
    player.phaseAfterimages.alpha = 0.45 + Math.sin(game.elapsed * 22) * 0.22;
    if (game.phaseAfterimage.remaining <= 0) game.phaseAfterimage = null;
  } else {
    player.phaseAfterimages.visible = false;
  }
  if (game.pilotBarrierTime > 0) {
    game.pilotBarrierTime = Math.max(0, game.pilotBarrierTime - dt);
    if (game.pilotBarrierTime <= 0) game.pilotBarrierHp = 0;
  }
  for (const weapon of game.activeWeapons) {
    if (!weapon.active) continue;
    weapon.cooldown = Math.max(0, weapon.cooldown - dt);
    if (weapon.cooldown <= 0) useActiveWeapon(weapon.shortcut, true);
  }
  shieldView.position.set(player.x, player.y);
  shieldView.rotation += dt * 0.45;
  shieldView.visible = game.pilotShieldReady
    || game.pilotBarrierHp > 0
    || (runStats.shieldLevel > 0 && game.shieldReady && skillActive('shield'));
  if (runStats.shieldLevel > 0 && !game.shieldReady) {
    game.shieldTimer -= dt;
    if (game.shieldTimer <= 0) {
      game.shieldTimer = 0;
      game.shieldReady = true;
      ringEffect(player.x, player.y, COLORS.cyan, 105, 0.55);
      showToast('量子护盾·充能完成');
    }
  }

  if (runStats.missileLevel > 0 && skillActive('missile')) {
    game.missileTimer -= dt;
    if (game.missileTimer <= 0) {
      const count = runStats.missileLevel >= 3 ? 2 : 1;
      for (let i = 0; i < count; i += 1) {
        const source = drones.length
          ? drones[i % drones.length]
          : { x: player.x + (i ? 16 : -16), y: player.y - 20 };
        const target = nearestDamageTarget(source.x, source.y, null, 900);
        if (!target) break;
        const angle = Math.atan2(target.y - source.y, target.x - source.x);
        firePlayerBullet(source.x, source.y - 8, angle, {
          style: 'missile', damage: 12 + runStats.missileLevel * 6, homing: true, target,
          explosionRadius: 68 + runStats.missileLevel * 8, pierce: 0, noEffects: true,
        });
      }
      game.missileTimer = Math.max(1.6, 4.0 - runStats.missileLevel * 0.75);
    }
  }
  updateLaser(dt);
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    if (p.ring) {
      const progress = 1 - p.life / p.maxLife;
      p.view.scale.set(1 + progress * (p.maxScale - 1));
      p.view.alpha = 1 - progress;
    } else if (p.damageText) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.18, dt);
      p.view.position.set(p.x, p.y);
      const progress = 1 - p.life / p.maxLife;
      const pop = progress < 0.16 ? 0.72 + progress / 0.16 * 0.28 : 1;
      p.view.scale.set(p.baseScale * pop);
      p.view.alpha = progress < 0.68 ? 1 : Math.max(0, (1 - progress) / 0.32);
    } else if (p.smoke) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.view.position.set(p.x, p.y);
      const progress = 1 - p.life / p.maxLife;
      p.view.scale.set(1 + progress * p.grow);
      p.view.alpha = Math.max(0, (1 - progress) * 0.65);
    } else if (p.fade) {
      p.view.alpha = Math.max(0, p.life / p.maxLife);
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;
      p.vx *= Math.pow(0.4, dt);
      p.view.position.set(p.x, p.y);
      p.view.rotation += p.spin * dt;
      p.view.alpha = Math.max(0, p.life / p.maxLife);
    }
    if (p.life <= 0) { p.view.removeFromParent(); p.view.destroy(); particles.splice(i, 1); }
  }
}

function updateBackground(dt) {
  // The flight world owns the background now. Keep the legacy scroll reference
  // current, without updating hidden sprite backgrounds and surface grids.
  if(renderer.type==='three'){game.surfacePlayerX=player.x;return;}
  if (tidalBackground?.active) {
    tidalBackground.update(dt, game.state === 'playing');
    game.surfacePlayerX = player.x;
    return;
  }
  const flightRate = game.state === 'playing' ? 1 : 0;
  const horizontalSpeed = (player.x - game.surfacePlayerX) / Math.max(0.001, dt);
  game.surfacePlayerX = player.x;
  const steering = game.state === 'playing'
    ? Math.max(-1, Math.min(1, horizontalSpeed / 360))
    : 0;
  game.surfaceTravel += dt * 0.17 * flightRate;
  game.surfaceHeading += steering * dt * 0.26 * flightRate;
  surfaceGeometryElapsed += dt;
  const rebuildSurfaceGeometry = !isCoarsePointerBrowser
    || (flightRate > 0 && surfaceGeometryElapsed >= MOBILE_SURFACE_REBUILD_INTERVAL);
  if (rebuildSurfaceGeometry) {
    surfaceGeometryElapsed = 0;
    drawSurfaceTexture(surfaceTexture, activeTerrainTheme, game.surfaceTravel, game.surfaceHeading);
    surfaceGrid.clear();
    const gridPhase = (game.surfaceTravel * 3) % 1;
    for (let index = 0; index < 13; index += 1) {
      const depth = (index + gridPhase) / 12;
      if (depth > 1) continue;
      const logicalY = depth * (H + WORLD_PROJECTION_OFFSET) - WORLD_PROJECTION_OFFSET;
      const point = projectWorldPoint(W / 2, logicalY);
      const halfWidth = 168 + depth * 464;
      const edgeDrop = 6 + depth * 42;
      surfaceGrid
        .moveTo(W / 2 - halfWidth, point.y + edgeDrop)
        .quadraticCurveTo(W / 2, point.y - edgeDrop * 0.28, W / 2 + halfWidth, point.y + edgeDrop)
        .stroke({
          color: index % 3 === 0 ? activeTerrainTheme.gridAccent : activeTerrainTheme.grid,
          width: index % 3 === 0 ? 1.25 : 0.75,
          alpha: 0.08 + depth * 0.13,
        });
    }
    const headingOffset = ((game.surfaceHeading * 95) % 95 + 95) % 95;
    for (let lane = -6; lane <= 6; lane += 1) {
      const nearX = W / 2 + lane * 95 - headingOffset;
      const farX = W / 2 + lane * 19 - headingOffset * 0.12;
      surfaceGrid
        .moveTo(farX, WORLD_HORIZON_Y + 3)
        .bezierCurveTo(
          farX + (nearX - farX) * 0.16,
          WORLD_HORIZON_Y + 190,
          nearX,
          H - 250,
          nearX,
          H + 80,
        )
        .stroke({
          color: lane === 0 ? activeTerrainTheme.gridAccent : activeTerrainTheme.grid,
          width: lane === 0 ? 1.15 : 0.75,
          alpha: lane === 0 ? 0.17 : 0.1,
        });
    }
  }

  for (const feature of surfaceFeatures) {
    const depthLoop = 1.16;
    const travelledDepth = feature.depthOffset + game.surfaceTravel * 0.25;
    const depth = ((travelledDepth + 0.08) % depthLoop + depthLoop) % depthLoop - 0.08;
    let visibleLane = feature.lane - game.surfaceHeading * 0.2;
    visibleLane = ((visibleLane + 1.2) % 2.4 + 2.4) % 2.4 - 1.2;
    const visibleDepth = Math.max(0, depth);
    const logicalY = visibleDepth * (H + WORLD_PROJECTION_OFFSET) - WORLD_PROJECTION_OFFSET;
    const point = projectWorldPoint(W / 2 + visibleLane * W * 0.64, logicalY);
    const featureScale = point.scale * (0.28 + visibleDepth * 1.05);
    feature.view.position.set(point.x, point.y);
    feature.view.scale.set(featureScale);
    feature.view.rotation = -visibleLane * 0.055;
    feature.view.alpha = depth < 0 ? 0 : Math.min(0.9, 0.18 + visibleDepth * 0.9);
    feature.view.zIndex = Math.floor(point.y);
  }
  for (const streak of weatherStreaks) {
    streak.view.y += streak.speed * (game.state === 'playing' ? 1 : 0.32) * dt;
    streak.view.x += streak.drift * dt;
    streak.view.alpha = streak.view.y < WORLD_HORIZON_Y + 30
      ? 0
      : Math.min(1, (streak.view.y - WORLD_HORIZON_Y - 30) / 180);
    if (streak.view.y > H + 40) streak.view.y = -20;
    if (streak.view.x < -20) streak.view.x = W + 10;
  }
}

function updateCollisions() {
  const activeAbility = getActivePilot().ability;
  const phaseAbility=game.peripheralSnapshot?.stats.aircraftAbilities?.find(s=>s.ability?.type==='phase')?.ability||activeAbility;
  const phasesThroughNormalEnemies = game.pilotStealthTime > 0
    && phaseAbility.type === 'phase'
    && phaseAbility.ignoresNormalCollisions;
  for (const e of enemies) {
    if (e.dead) continue;
    if (phasesThroughNormalEnemies) continue;
    const rr = e.radius + player.radius;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const distanceSq = dx * dx + dy * dy;
    if (movingCircleHitTime(collisionStart(e),e,collisionStart(player),player,rr) === null) continue;

    // Separate only a remaining overlap. A swept contact may already have
    // passed the player; pushing that enemy again would cause a visible jump.
    if (distanceSq < rr * rr) {
      const distance = Math.sqrt(distanceSq);
      const normalX = distance > 0 ? dx / distance : 0;
      const normalY = distance > 0 ? dy / distance : -1;
      const separation = rr - distance + 10;
      e.x = Math.max(e.radius, Math.min(W - e.radius, e.x + normalX * separation));
      e.y += normalY * separation;
      e.view.position.set(e.x, e.y);
    }

    const contactDamage = e.collisionDamage
      * (game.balance?.enemyDamage || 1)
      * (e.elite ? 1.15 : 1);
    hitPlayer(contactDamage, 'collision');
  }
  if (boss && !boss.dead && boss.entered) {
    const rr = boss.radius + player.radius;
    if (movingCircleHitTime(collisionStart(boss),boss,collisionStart(player),player,rr) !== null) {
      hitPlayer(48 * (game.balance?.bossDamage || 1), 'collision');
    }
  }
}

function projectViewForRender(restores, view, x, y, scaleBias = 1, topWorldY = null) {
  if (!view || !view.parent) return;
  restores.push({
    view,
    x: view.x,
    y: view.y,
    scaleX: view.scale.x,
    scaleY: view.scale.y,
  });
  const projected = projectWorldPoint(x, y);
  if (Number.isFinite(topWorldY)) {
    const projectedTop = projectWorldPoint(x, topWorldY).y;
    projected.y = Math.max(0, Math.min(H, (projected.y - projectedTop) * H / Math.max(1, H - projectedTop)));
  }
  view.position.set(projected.x, projected.y);
  view.scale.set(
    view.scale.x * projected.unitScale * WORLD_UNIT_SCALE * scaleBias,
    view.scale.y * projected.unitScale * WORLD_UNIT_SCALE * scaleBias,
  );
}

function projectWorldForRender() {
  const restores = [];
  playerHitMarker.visible = ['playing','paused','levelup','evolving','dodge-tutorial'].includes(game.state);
  playerHitMarker.position.set(player.x, player.y);
  playerHitMarker.alpha = player.invincible > 0 || game.pilotStealthTime > 0 || game.flightFlipTime > .04 ? .35 : .95;
  const departure = ['victory_cinematic','victory_result'].includes(game.state) ? game.victoryDepartureFrame : null;
  const hero = departure?.hero || player;
  for (const enemy of enemies) projectViewForRender(restores, enemy.view, enemy.x, enemy.y, enemyRenderScale(enemy));
  if (boss) projectViewForRender(restores, boss.view, boss.x, boss.y, enemyRenderScale(boss));
  for (const bullet of playerBullets) {
    projectViewForRender(
      restores,
      bullet.view,
      bullet.x,
      bullet.y,
    );
  }
  for (const bullet of enemyBullets) projectViewForRender(restores, bullet.view, bullet.x, bullet.y);
  for (const pickup of pickups) projectViewForRender(restores, pickup.view, pickup.x, pickup.y);
  for (const orb of xpOrbs) projectViewForRender(restores, orb.view, orb.x, orb.y);
  for (const drone of drones) {
    const point = departure?.followers.get(drone) || drone;
    projectViewForRender(restores, drone.view, point.x, point.y, AIRCRAFT_RENDER_SCALE);
  }
  for (const particle of particles) {
    if (!particle.screenSpaceGeometry) {
      projectViewForRender(restores, particle.view, particle.x, particle.y);
    }
  }
  projectViewForRender(restores, shieldView, hero.x, hero.y, AIRCRAFT_RENDER_SCALE);
  projectViewForRender(restores, player.view, hero.x, hero.y, AIRCRAFT_RENDER_SCALE);
  return restores;
}

function restoreProjectedWorld(restores) {
  for (let index = restores.length - 1; index >= 0; index -= 1) {
    const state = restores[index];
    state.view.position.set(state.x, state.y);
    state.view.scale.set(state.scaleX, state.scaleY);
  }
}

app.stage.eventMode = 'static';
app.stage.hitArea = app.screen;
let relativeDragPointerId = null;
let relativeDragOriginX = 0;
let relativeDragOriginY = 0;
let relativeDragPlayerScreenOrigin = null;
// Keep gesture eligibility across a modal reset, but never across touch end
// or focus loss. Only gestures begun on the playable canvas may resume.
const browserFlightPointers = new Set();

function traceBrowserFlight(stage, event = {}, extra = {}) {
  traceFlightInput(stage, {
    type: event.type, pointerType: event.pointerType, pointerId: event.pointerId,
    primary: event.isPrimary, buttons: event.buttons, state: game.state,
    loading: game.sortieLoading, owner: relativeDragPointerId,
    eligible: browserFlightPointers.has(event.pointerId), active: game.relativeDragActive,
    target: [game.targetX, game.targetY], player: [player.x, player.y],
    ...extra,
  });
}

function resetRelativeDrag() {
  relativeDragPointerId = null;
  relativeDragPlayerScreenOrigin = null;
  game.relativeDragActive = false;
  game.relativeDragDeltaX = 0;
  game.pointerActive = false;
  game.targetX = player?.x ?? game.targetX;
  game.targetY = player?.y ?? game.targetY;
}

function dragScreenDeltaToScene(dx, dy) {
  const bounds = app.canvas.getBoundingClientRect?.();
  const canvasScaleX = bounds?.width ? app.screen.width / bounds.width : 1;
  const canvasScaleY = bounds?.height ? app.screen.height / bounds.height : 1;
  return {
    x: dx * canvasScaleX / Math.max(0.001, scene.scale.x),
    y: dy * canvasScaleY / Math.max(0.001, scene.scale.y),
  };
}

function updateRelativeDrag(clientX, clientY) {
  if (!relativeDragPlayerScreenOrigin) return;
  const offset = dragScreenDeltaToScene(
    clientX - relativeDragOriginX,
    clientY - relativeDragOriginY,
  );
  const boost=game.fixedCombat?.speedMultiplier||1;
  const previous=game.relativeDragLastOffset||{x:0,y:0},accumulated=game.relativeDragBoostedOffset||{x:0,y:0};
  accumulated.x+=(offset.x-previous.x)*boost;accumulated.y+=(offset.y-previous.y)*boost;
  game.relativeDragLastOffset=offset;game.relativeDragBoostedOffset=accumulated;
  const target = unprojectWorldPoint(
    relativeDragPlayerScreenOrigin.x + accumulated.x,
    relativeDragPlayerScreenOrigin.y + accumulated.y,
  );
  const nextX = Math.max(32, Math.min(W - 32, target.x));
  const nextY = Math.max(95, Math.min(H - 112, target.y));
  game.relativeDragDeltaX = nextX - game.targetX;
  game.targetX = nextX;
  game.targetY = nextY;
  game.flightHasSteered ||= Math.abs(game.relativeDragDeltaX) > 0.5;
}

function beginRelativeDrag(pointerId, originX, originY, currentX = originX, currentY = originY) {
  if (game.state !== 'playing' || relativeDragPointerId !== null) return false;
  relativeDragPointerId = pointerId;
  relativeDragOriginX = Number(originX) || 0;
  relativeDragOriginY = Number(originY) || 0;
  relativeDragPlayerScreenOrigin = renderer.type==='three'?renderer.projectBattle(player.x,player.y):projectWorldPoint(player.x, player.y);
  game.pointerActive = false;
  game.relativeDragActive = true;
  game.relativeDragLastOffset={x:0,y:0};game.relativeDragBoostedOffset={x:0,y:0};
  game.relativeDragDeltaX = 0;
  game.targetX = player.x;
  game.targetY = player.y;
  updateRelativeDrag(Number(currentX) || 0, Number(currentY) || 0);
  return true;
}

function beginBrowserRelativeDrag(event) {
  traceBrowserFlight('canvas-down', event);
  if (game.state !== 'playing' || game.sortieLoading) return;
  if (event.pointerType !== 'touch') return;
  // Recover a dropped gesture end without letting a second finger take over.
  if (event.isPrimary === true) {
    browserFlightPointers.clear();
    resetRelativeDrag();
  }
  const bounds = app.canvas.getBoundingClientRect();
  const global = {
    x: (event.clientX - bounds.left) * app.screen.width / bounds.width,
    y: (event.clientY - bounds.top) * app.screen.height / bounds.height,
  };
  if (pixiCombatUi?.blocksFlightPointer(global)) { traceBrowserFlight('down-blocked', event, { reason: 'combat-ui' }); return; }
  browserFlightPointers.add(event.pointerId);
  if (relativeDragPointerId !== null) return;
  event.preventDefault();
  beginRelativeDrag(event.pointerId, event.clientX, event.clientY);
  traceBrowserFlight('drag-started', event);
  try { app.canvas.setPointerCapture(event.pointerId); } catch { /* Pointer capture is best effort. */ }
}

function moveBrowserRelativeDrag(event) {
  traceBrowserFlight('canvas-move', event);
  if (!browserFlightPointers.has(event.pointerId)) return;
  if (!event.buttons) { endBrowserRelativeDrag(event); return; }
  if (game.state !== 'playing' || game.sortieLoading) return;
  if (relativeDragPointerId === null) {
    // Re-anchor at the current finger/ship positions. Discard movement made
    // while a menu was open instead of teleporting to a stale target.
    event.preventDefault();
    beginRelativeDrag(event.pointerId, event.clientX, event.clientY);
    return;
  }
  if (event.pointerId !== relativeDragPointerId || !game.relativeDragActive) return;
  event.preventDefault();
  updateRelativeDrag(event.clientX, event.clientY);
  traceBrowserFlight('drag-move-applied', event);
}

function endBrowserRelativeDrag(event) {
  traceBrowserFlight('drag-end', event);
  browserFlightPointers.delete(event.pointerId);
  if (event.pointerId !== relativeDragPointerId) return;
  event.preventDefault();
  resetRelativeDrag();
  try { app.canvas.releasePointerCapture(event.pointerId); } catch { /* It may already be released. */ }
}

function beginWechatRelativeDrag(originX, originY, currentX = originX, currentY = originY) {
  if (platformKind !== 'wechat') return false;
  return beginRelativeDrag('wechat-touch', originX, originY, currentX, currentY);
}

function handleWechatRelativeDrag(x, y, phase = 'move') {
  if (game.state !== 'playing') return false;
  const clientX = Number(x) || 0;
  const clientY = Number(y) || 0;

  if (phase === 'start') {
    beginWechatRelativeDrag(clientX, clientY);
    return true;
  }

  if (relativeDragPointerId !== 'wechat-touch') return true;
  if (phase === 'move') {
    updateRelativeDrag(clientX, clientY);
    return true;
  }
  if (phase === 'end' || phase === 'cancel') {
    resetRelativeDrag();
    return true;
  }
  return true;
}

// WeChat routes raw wx touch events through handleWechatRelativeDrag below.
// Route by the actual event type: DevTools can enable touch after page load.
// Keep the native pointer listeners for browser builds only.
if (platformKind !== 'wechat') {
  app.canvas.addEventListener('pointerdown', beginBrowserRelativeDrag, { passive: false });
  app.canvas.addEventListener('pointermove', moveBrowserRelativeDrag, { passive: false });
  // Releases outside the canvas or during an overlay must also unlock flight.
  window.addEventListener('pointerup', endBrowserRelativeDrag, { capture: true, passive: false });
  window.addEventListener('pointercancel', endBrowserRelativeDrag, { capture: true, passive: false });
  app.canvas.addEventListener('lostpointercapture', endBrowserRelativeDrag, { passive: false });
}
window.addEventListener('blur', () => {
  game.keys.clear();
  browserFlightPointers.clear();
  resetRelativeDrag();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { browserFlightPointers.clear(); resetRelativeDrag(); sfx.stopCombatLoops(); }
  sfx.syncMusic();
});
app.canvas.addEventListener('lostpointercapture', () => { game.pointerActive = false; });

function setPointerTarget(global) {
  const screenPoint = scene.toLocal(global);
  const p = unprojectWorldPoint(screenPoint.x, screenPoint.y);
  const nextTargetX = Math.max(28, Math.min(W - 28, p.x));
  const commandDeltaX = nextTargetX - game.flightLastCommandX;
  const inputOffsetX = nextTargetX - player.x;
  if (Math.abs(inputOffsetX) < 42) {
    game.flightFlipArmed = true;
  } else if (Math.abs(inputOffsetX) >= 92) {
    const inputDirection = Math.sign(inputOffsetX);
    const reversed = game.flightLastInputDirection && inputDirection !== game.flightLastInputDirection;
    const decisiveMove = game.flightFlipArmed && (
      Math.abs(commandDeltaX) >= 70
      || !game.flightLastInputDirection
    );
    if (reversed || decisiveMove) {
      requestFlightFlip(inputDirection);
      game.flightFlipArmed = false;
    }
    game.flightLastInputDirection = inputDirection;
  }
  game.flightHasSteered = true;
  game.flightLastCommandX = nextTargetX;
  game.targetX = nextTargetX;
  game.targetY = Math.max(90, Math.min(H - 105, p.y));
}
app.stage.on('pointerdown', (event) => {
  if (game.state !== 'playing' || game.sortieLoading) return;
  if (event.pointerType === 'touch') return;
  if (pixiCombatUi?.blocksFlightPointer(event.global)) return;
  game.pointerActive = true;
  setPointerTarget(event.global);
});
app.stage.on('pointermove', (event) => {
  if (game.state !== 'playing' || game.sortieLoading) return;
  if (event.pointerType === 'touch') return;
  if (pixiCombatUi?.blocksFlightPointer(event.global)) return;
  if (game.pointerActive || event.pointerType === 'mouse') setPointerTarget(event.global);
});
app.stage.on('pointerup', () => { game.pointerActive = false; });
app.stage.on('pointerupoutside', () => { game.pointerActive = false; });

window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Escape'].includes(event.code)) event.preventDefault();
  if (game.state === 'dodge-tutorial' && ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(event.code)) {
    completeDodgeTutorial(event.code === 'ArrowLeft' || event.code === 'KeyA' ? -1 : 1);
    return;
  }
  game.keys.add(event.code);
  if (event.code === 'Escape') {
    if (ui.pilotArtOverlay.classList.contains('visible')) {
      closePilotArt();
    } else if (ui.debugPage.classList.contains('visible')) {
      closeDebugPage();
    } else if (ui.stageDetailsPage.classList.contains('visible')) {
      closeStageDetails();
    } else if (game.state === 'paused') {
      if (game.pauseMode && game.pauseMode !== 'pause') showPauseMenu();
      else resumeGame();
    } else showPauseMenu();
  }
});
window.addEventListener('keyup', (event) => game.keys.delete(event.code));
ui.exitButton.addEventListener('click', showPauseMenu);
ui.pausePrimary.addEventListener('click', handlePausePrimary);
ui.pauseSecondary.addEventListener('click', handlePauseSecondary);
ui.rankButton.addEventListener('pointerdown', (event) => { event.stopPropagation(); openLeaderboard(); });
ui.menuRankButton.addEventListener('click', openLeaderboard);
ui.debugUnlockButton.addEventListener('click', openDebugPage);
ui.debugPageClose.addEventListener('click', closeDebugPage);
ui.debugUnlockToggle.addEventListener('click', toggleDebugUnlockAll);
ui.debugAddCoins.addEventListener('click', () => addDebugCurrency('coins'));
ui.debugAddDiamonds.addEventListener('click', () => addDebugCurrency('diamonds'));
ui.debugGrantWeapons.addEventListener('click', grantDebugWeapons);
ui.clearSaveButton.addEventListener('click', requestClearGameSave);
ui.gachaSkipButton.addEventListener('click', skipGachaAnimation);
ui.gachaCloseButton.addEventListener('click', closeGachaResults);
ui.pilotArtClose.addEventListener('click', closePilotArt);
ui.pilotArtOverlay.addEventListener('click', (event) => {
  if (event.target === ui.pilotArtOverlay) closePilotArt();
});
ui.stageDetailsButton.addEventListener('click', openStageDetails);
ui.stageDetailsClose.addEventListener('click', closeStageDetails);
if (platformKind !== 'wechat') {
  bindDragScrolling(document);
  mountScrollView(ui.stageDetailsList, { axis: 'y', friction: 0.88 });
  mountScrollView(ui.battleHome, { axis: 'y', friction: 0.88 });
}
ui.leaderboardClose.addEventListener('click', closeLeaderboard);
ui.startButton.addEventListener('click', startGame);
ui.diamondAdButton.addEventListener('click', requestAdDiamonds);
ui.resultContinue.addEventListener('click', () => {
  if (game.victoryRewardDoublePending) return;
  if (game.state === 'victory_result' || game.state === 'defeat_result') {
    endGame(game.state === 'victory_result');
  }
});
ui.stagePrev.addEventListener('click', () => selectCampaignStage(selectedStageIndex - 1, -1));
ui.stageNext.addEventListener('click', () => selectCampaignStage(selectedStageIndex + 1, 1));
ui.difficultyTabs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-difficulty]');
  if (button) selectDifficulty(button.dataset.difficulty);
});
ui.lobbyNav.addEventListener('click', (event) => {
  const button = event.target.closest('[data-lobby-tab]');
  if (button) switchLobbyTab(button.dataset.lobbyTab);
});
document.querySelectorAll('.lobby-wallet button').forEach((button) => {
  button.addEventListener('click', () => switchLobbyTab('supply'));
});
let chapterSwipeStart = null;
ui.chapterCover.addEventListener('pointerdown', (event) => {
  if (event.target.closest('.chapter-turn')) {
    chapterSwipeStart = null;
    return;
  }
  chapterSwipeStart = { x: event.clientX, y: event.clientY };
  ui.chapterCover.setPointerCapture?.(event.pointerId);
});
ui.chapterCover.addEventListener('pointerup', (event) => {
  if (!chapterSwipeStart) return;
  const dx = event.clientX - chapterSwipeStart.x;
  const dy = event.clientY - chapterSwipeStart.y;
  chapterSwipeStart = null;
  if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy) * 1.15) return;
  const direction = dx < 0 ? 1 : -1;
  const target = selectedStageIndex + direction;
  if (target < 0 || target >= CAMPAIGN.length) {
    showToast(direction > 0 ? '已经是最后一章' : '已经是第一章');
    return;
  }
  selectCampaignStage(target, direction);
});
ui.chapterCover.addEventListener('pointercancel', () => { chapterSwipeStart = null; });
ui.rerollButton.addEventListener('click', () => requestUpgradeReward('reroll'));
ui.takeAllButton.addEventListener('click', () => requestUpgradeReward('take-all'));
ui.acceptRevive.addEventListener('click', requestAdRevive);
ui.declineRevive.addEventListener('click', declineRevive);

app.ticker.add((ticker) => {
  sfx.syncMusic();
  if(game.sortieLoading)return;
  performanceMonitor.frame('combat');
  const updateStartedAt = PERFORMANCE_DIAGNOSTICS_ENABLED || performanceMonitor.enabled ? performance.now() : 0;
  const dt = combatDelta(ticker.deltaMS, game);
  if (!usePeripheralLobby || game.state !== 'menu') {
    threeEnvironment.update(game.elapsed, game.stageIndex, { lateral: (player.x - W / 2) / (W / 2) });
  }
  if (game.state !== 'playing' && game.relativeDragActive) resetRelativeDrag();
  const evolutionFrozen = game.state === 'evolving';
  const dodgeTutorialFrozen = game.state === 'dodge-tutorial';
  if (!evolutionFrozen && !dodgeTutorialFrozen) updateBackground(dt);
  if (game.state === 'returning') return;
  if (!dodgeTutorialFrozen) updateParticles(dt);
  if (!evolutionFrozen && !dodgeTutorialFrozen) {
    playerAircraftOrbitTime += dt;
    updateAssemblyAircraftVisual(player.aircraft, playerAircraftOrbitTime);
  }
  if (!dodgeTutorialFrozen) updateUltimateAircraftForm(dt);

  if (game.state === 'playing') {
    game.elapsed += dt;
    game.stageElapsed += dt;
    spawnDirector(game.elapsed);
    const barrierBefore = {time:game.pilotBarrierTime,hp:game.pilotBarrierHp};
    updatePlayer(dt);
    if (game.state === 'returning') return;
    if (!game.fixedPartsMode) { updateDrones(dt); updateRunAbilities(dt); }
    else if (game.peripheralSnapshot) {
      updatePeripheralPassive(game, runStats, dt);
      updatePeripheralAircraftAbilities(game,dt,source=>{const pilot=AIRCRAFTS.find(p=>p.id===source.id);if(pilot)activatePilotAbility({...pilot,ability:source.ability},true);});
      shieldView.position.set(player.x, player.y);
      shieldView.rotation += dt * 0.45;
      shieldView.visible = game.pilotShieldReady || game.pilotBarrierHp > 0 && game.pilotBarrierTime > 0;
    }
    shieldView.alpha=game.pilotBarrierHp>0&&game.pilotBarrierTime>0?barrierOpacity(game.pilotBarrierTime):1;
    if(barrierBefore.time>0&&barrierBefore.hp>0&&game.pilotBarrierTime<=0)ringEffect(player.x,player.y,0x66f0b0,48,.22);
    updateEnemies(dt);
    if (game.state === 'returning') return;
    updateBoss(dt);
    if (game.state === 'returning') return;
    // Both enemy endpoints must belong to this frame before common weapons sweep.
    if (game.fixedPartsMode) updateFixedParts(dt);
    if (game.state === 'returning') return;
    sfx.flameLoop(enemies.some((enemy) => !enemy.dead && enemy.burnTime > 0) || Boolean(boss && !boss.dead && boss.burnTime > 0));
    updateTelegraphs(dt);
    if (game.state === 'returning') return;
    updateHostileBeams(dt);
    if (game.state === 'returning') return;
    updateBullets(dt);
    if (game.state === 'returning') return;
    updatePickups(dt);
    if (game.state === 'playing') updateXpOrbs(dt);
    if (game.state === 'playing') updateCollisions();
    if (game.state === 'returning') return;
    game.uiTimer -= dt;
    if (game.uiTimer <= 0) { game.uiTimer = 0.16; updateUI(); }
    if (game.comboTimer > 0) {
      game.comboTimer -= dt;
      if (game.comboTimer <= 0) { game.combo = 0; updateUI(); }
    }
  } else if (game.state === 'revive-prompt' && !game.reviveAdPending) {
    game.reviveCountdown = Math.max(0, (game.reviveDeadline - performance.now()) / 1000);
    ui.reviveCountdown.textContent = String(Math.max(0, Math.ceil(game.reviveCountdown)));
    ui.reviveOverlay.style.setProperty('--revive-progress', `${game.reviveCountdown / 10 * 360}deg`);
    if (game.reviveCountdown <= 0) declineRevive();
  } else if (game.state === 'dying') {
    game.deathElapsed += dt;
    const collapse = Math.min(1.4, game.deathElapsed);
    player.x = game.deathOriginX + Math.sin(game.deathElapsed * 13) * (4 + collapse * 9);
    player.y = game.deathOriginY + game.deathElapsed * game.deathElapsed * 20;
    player.view.position.set(player.x, player.y);
    player.view.rotation = Math.sin(game.deathElapsed * 9) * 0.16 + game.deathElapsed * 0.24;
    player.engine.alpha = 0.25 + Math.max(0, Math.sin(game.deathElapsed * 31)) * 0.35;
  } else if (game.state === 'evolving') {
    updateUltimateEvolution(dt);
  }

  if (game.state === 'victory_cinematic' && game.victoryDeparture) {
    game.victoryDepartureFrame = game.victoryDeparture.frame();
    combatVfx.setEnergy(game.victoryDepartureFrame.energy, [], []);
  }
  combatVfx.step(game.state === 'playing' || game.state === 'dying' ? dt : 0,playerBullets,enemyBullets);
  if (game.state === 'victory_cinematic') {
    combatVfx.stepDeaths(dt);
    boss?.model?.updateDeath?.(dt);
  }
  if(['playing','dying','victory_cinematic'].includes(game.state))stepEnemyRemains(dt);
  pilotArtVisual.update(game.fixedPartsMode ? game.fixedLoadout.pilotId : getActivePilot().id, game.elapsed, game.pilotStealthTime > 0, player.invincible, false, {
    roll:flightRollAngle(game.flightFlipTime,game.flightFlipDirection),
    pitch:Math.max(-.04,Math.min(.04,(game.targetY-player.y)*.001)),
  });
  if (game.shake > 0.1) {
    game.shake *= Math.pow(0.015, dt);
    const shakeX = (Math.random() - 0.5) * game.shake * COMBAT_SCREEN_SHAKE_SCALE;
    const shakeY = (Math.random() - 0.5) * game.shake * COMBAT_SCREEN_SHAKE_SCALE;
    // Retain the same origin as resizeScene, including the external debug area.
    const originX = sceneFrameOrigin.x;
    const originY = sceneFrameOrigin.y;
    scene.position.x = originX + shakeX * scene.scale.x;
    scene.position.y = originY + shakeY * scene.scale.y;
    pixiCombatUi?.setScreenShakeCompensation(-shakeX, -shakeY);
  } else if (game.shake !== 0) {
    game.shake = 0;
    resizeScene();
    pixiCombatUi?.setScreenShakeCompensation(0, 0);
  }
  if (game.flash > 0) {
    game.flash -= dt;
    // A CSS filter on the canvas allocates a full-screen compositing pass in
    // Mobile Safari. It is a nice desktop flourish, but can dominate a frame
    // during repeated hits on a phone.
    if (!isCoarsePointerBrowser) {
      const visualFlash = game.flash * COMBAT_FLASH_SCALE;
      app.canvas.style.filter = `brightness(${1 + visualFlash * 2.2}) saturate(${1 + visualFlash * 1.4})`;
    }
  } else if (app.canvas.style.filter) app.canvas.style.filter = '';
  if(performanceMonitor.enabled)performanceMonitor.record('combat',performance.now()-updateStartedAt);
  if (PERFORMANCE_DIAGNOSTICS_ENABLED) {
    performanceUpdateTime += performance.now() - updateStartedAt;
    performanceUpdateSamples += 1;
  }
});

if (!isDifficultyUnlocked(selectedStageIndex, selectedDifficultyId)) selectedDifficultyId = 'easy';
game.stageIndex = selectedStageIndex;
game.difficultyId = selectedDifficultyId;
updateLobbyHeader();
updateDebugUnlockButton();
switchLobbyTab(previewLobbyTab || 'battle');
renderStageSelector();
updateUI();
loadLeaderboard();
app.ticker.add(() => {
  const renderStartedAt = PERFORMANCE_DIAGNOSTICS_ENABLED || performanceMonitor.enabled ? performance.now() : 0;
  const projectedWorld = projectWorldForRender();
  app.renderer.render({ container: app.stage });
  restoreProjectedWorld(projectedWorld);
  if(performanceMonitor.enabled)performanceMonitor.record('render',performance.now()-renderStartedAt);
  if (PERFORMANCE_DIAGNOSTICS_ENABLED) {
    performanceRenderTime += performance.now() - renderStartedAt;
    performanceRenderSamples += 1;
  }
});
app.renderer.render({ container: app.stage });

const [pixiLobbyPilotTextures, pixiLobbyDailyLoginTexture] = await Promise.all([
  pixiLobbyPilotTexturesPromise,
  pixiLobbyDailyLoginTexturePromise,
]);
requireGameSession(()=>{app.ticker.stop();renderer.destroy();sfx.stopCombatLoops();sfx.music.update(game,true);});
if (usePeripheralLobby) {
  peripheralSystem = createPeripheralSystem({
    storage: localStorage, profile: profileState, stages: CAMPAIGN, canWrite:isGameSessionCurrent,
    getCampaign: () => ({ ...campaignState, highestUnlocked: effectiveHighestUnlocked() }), saveProfile: saveProfileState,
    selectStage: index => selectCampaignStage(index),
    getSelectedStage: () => selectedStageIndex,
    playShopAd: playPeripheralShopAd,
    playPatrolAd: playPeripheralShopAd,
  });
}

// Replica outcomes contain the actual battle result, not the archived host
// score/coin formula. Only the cleared flag and next chapter are projected into
// the old lobby while its progression is being replaced in a later stage.
function recordReplicaProgress(result) {
  if (!result.won || result.abandoned || result.trial) return;
  // Old receipts predate chapter routing and could only originate in chapter 1.
  const chapter = replicaChapter(result.chapterId ?? 1);
  if (!chapter || !CAMPAIGN[chapter.stageIndex]) return;
  const key = difficultyResultKey(chapter.stageIndex, 'easy');
  const previous = campaignState.results[key] || {};
  const nativeMask=peripheralSystem.state.replicaCampaign.starMasks?.[chapter.id];
  const starMask=preserveReplicaStars(nativeMask,result);
  campaignState.results[key] = { ...previous, cleared: true,
    stars: countReplicaStars(starMask), starMask,
    replica: { engine: 'danke-replica-v1', runId: result.runId, clock: result.clock,
      kills: result.kills, wave: result.wave, gold: result.gold, damageDealt: result.damageDealt } };
  campaignState.highestCleared = Math.max(campaignState.highestCleared, chapter.stageIndex);
  const next = replicaChapterForStage(chapter.stageIndex + 1);
  if (next) campaignState.highestUnlocked = Math.max(campaignState.highestUnlocked, next.stageIndex);
  saveCampaignState();
}
if (usePeripheralLobby && peripheralSystem) {
  for (const result of peripheralSystem.replicaResults) recordReplicaProgress(result);
  const nativeCampaign = peripheralSystem.state.replicaCampaign;
  if (!replicaStageAccessible(selectedStageIndex, nativeCampaign.highestUnlocked)) {
    selectCampaignStage(nativeCampaign.highestUnlocked);
  }
  replicaBattle = createReplicaBattleBridge({
    peripheral: () => peripheralSystem,
    onEnter() {
      lobbyFeedback.stop(); game.state = 'replica-battle'; game.keys.clear(); resetRelativeDrag();
      app.ticker.stop(); pixiLobby?.setVisible(false); sfx.stopCombatLoops(); sfx.syncMusic();
      sdkGameplayStop();
    },
    onLeave() {
      game.state = 'menu'; game.keys.clear(); resetRelativeDrag(); sdkGameplayStop();
      updateLobbyHeader(); renderStageSelector(); switchLobbyTab('battle');
      pixiLobby?.setVisible(true); pixiCombatUi?.update(); app.ticker.start(); sfx.syncMusic();
    },
    async requestReviveAd() {
      if (rewardedAdPending) throw new Error('已有广告正在播放，请稍后再试');
      rewardedAdPending = true;
      try { requireCompletedRewardedAd(await playRewardedAd()); }
      finally { rewardedAdPending = false; }
    },
    onProgress: recordReplicaProgress,
    onState(phase) {
      if (phase === 'playing') sdkGameplayStart(); else sdkGameplayStop();
    },
    onError: message => { console.error('[replica battle]', message); showToast(message); },
  });
}

let gameSessionClosed=false;
const thunderBridge = {
  closeGameSession({save=true}={}) {
    if(gameSessionClosed)return;
    gameSessionClosed=true;
    try { if(save)replicaBattle?.leavePage(); }
    finally {
      replicaBattle?.dispose();cancelLocalRewardedAd();
      thunderBridge.replicaResearchTool?.destroy?.();thunderBridge.performancePanel?.destroy?.();
      game.state='session-stopped';game.keys.clear();resetRelativeDrag();
      app.ticker.stop();pixiLobby?.destroy?.();lobbyFeedback.stop();
      sfx.stopCombatLoops();sfx.music.update(game,true);sdkGameplayStop();
    }
  },
  buildIdentity: BUILD_IDENTITY,
  gameplayVersion: 'peripheral-redesign-v1',
  openReplicaResearch() {
    if (!peripheralSystem || !['menu','gameover','victory'].includes(game.state) || replicaBattle?.active) return {ok:false,message:'请先结束当前战斗'};
    game.state='replica-research'; game.keys.clear(); resetRelativeDrag();
    app.ticker.stop(); pixiLobby?.setVisible(false); sfx.stopCombatLoops(); sfx.syncMusic(); sdkGameplayStop();
    return {ok:true};
  },
  closeReplicaResearch() {
    if(game.state!=='replica-research')return;
    game.state='menu'; game.keys.clear(); resetRelativeDrag(); sdkGameplayStop();
    updateLobbyHeader(); renderStageSelector(); switchLobbyTab('battle');
    pixiLobby?.setVisible(true); pixiCombatUi?.update(); app.ticker.start(); sfx.syncMusic();
  },
  getPeripheralSnapshot: () => {
    refreshNativeLobbyDetails();
    return peripheralSystem?.snapshot();
  },
  async getReplicaLoadoutDetails() {
    if(!peripheralSystem)throw new Error('出击配置尚未准备完成');
    const configuration=peripheralSystem.replicaConfiguration();
    const {replicaLoadoutDetails}=await import('./replica/native-loadout-details.js');
    const result=await replicaLoadoutDetails(configuration);
    if(JSON.stringify(peripheralSystem.replicaConfiguration())!==JSON.stringify(configuration))throw new Error('装备已变化，请重新读取属性');
    peripheralSystem.acceptReplicaLoadoutDetails(result);nativeDetailsFailedKey='';nativeDetailsResolvedKey=JSON.stringify(configuration);
    return result;
  },
  peripheralAction(action, payload = {}) {
    if (!peripheralSystem) return { ok: false, message: '当前平台未启用新版指挥部' };
    if (!['menu', 'gameover', 'victory'].includes(game.state)) return { ok: false, message: '请先完成当前出击' };
    if (action === 'start') {
      // Start the chapter actually displayed in the lobby, not a stale selection
      // left behind when browsing a locked chapter with the arrows.
      const index = Number(payload.index ?? payload.stageIndex ?? selectedStageIndex);
      const selection = peripheralSystem.action('selectStage', { index });
      if (!selection.ok) return selection;
      return startGame().then(started=>({ ok: Boolean(started), started: Boolean(started), message: started ? '' : '出击未开始，请检查体力或资源加载状态' }));
    }
    const result = lobbyFeedback.run(action,payload,()=>peripheralSystem.action(action,payload),()=>peripheralSystem.snapshot());
    if (result?.ok && action === 'renamePlayer') game.callsign = result.playerName;
    if (result?.then) return result.then(receipt=>{if(receipt.ok){updateLobbyHeader();pixiLobby?.render();}return receipt;});
    if (result.ok) { updateLobbyHeader(); pixiLobby?.render(); }
    return result;
  },
  fighterForPilot,
  app,
  resizeScene,
  scene,
  platformKind,
  game,
  ui,
  isCoarsePointerBrowser,
  profileState,
  campaignState,
  startGame,
  get ordnanceSnapshot() { return combatVfx.snapshot(); },
  startFixedPartsTrial: () => startGame({ fixedParts: true, trial: true }),
  rerollFixedUpgrade,
  claimBattleSupply,
  startBattleSupply,
  skipBattleSupply,
  battleSupplyTick: () => sfx.tone(720,.025,'sine',.02,-120),
  fixedNodeName: id => {
    const match=/^AF-(\w+)-(\d+)-(\w+)$/.exec(id);
    if (match && ARSENAL[match[1]]?.common) return `${ARSENAL[match[1]].name} · 战斗调校 ${Number(match[2])}`;
    return match ? `${ARSENAL[match[1]]?.name} · ${Number(match[2])<6?ARSENAL[match[1]]?.stages[Math.min(5,Number(match[2]))]:`共鸣 ${Number(match[2])-5}`}` : FIXED_NODE_BY_ID.get(id)?.name || id;
  },
  focusFixedWeapon: id => game.fixedGrowth?.focus(id),
  saveFixedGrowthCheckpoint,
  restoreFixedGrowthCheckpoint,
  get fixedPartsSnapshot() {
    if (!game.fixedCombat) return null;
    return structuredClone({ loadout: game.fixedLoadout, state: game.fixedCombat.state, growth: game.fixedGrowth.state,
      player: { x: player.x, y: player.y }, rays:game.fixedCombat.visuals(), blasts:game.fixedCombat.blastVisuals(), energy:game.fixedCombat.energyVisuals(),energyCounts:game.fixedCombat.energyCounts(),
      projectiles: playerBullets.map(b => ({ x: b.x, y: b.y, vx:b.vx,vy:b.vy,age: b.age, damage: b.damage, source: b.fixedSource,
        mass:b.mass,restitution:b.restitution,guided:b.fixedGuided,contacts:b.fixedHitCount,sourceArt:!!b.artModel,model:b.artModel?.kind,missile:!!b.fixedRules?.missile,tracking:b.rocketGuidance })),
      targets: [...enemies, ...(boss && boss.entered ? [boss] : [])].filter(e => !e.dead).map(e => ({ x: e.x, y: e.y, hp: e.hp, radius: e.radius })),
    });
  },
  unlockAudio: sfx.unlock,
  playUiClick: () => { sfx.unlock(); lobbyFeedback.click(); },
  playUiFeedback: key => lobbyFeedback.present(key),
  endGame,
  showExitConfirm,
  showPauseMenu,
  getCombatAudioSettings: () => ({...sfx.preferences}),
  setCombatAudioSetting: (key,enabled) => { const result=sfx.setPreference(key,enabled); if(key==='effects'&&!enabled)lobbyFeedback.stop(); return result; },
  resumeGame,
  confirmExitRun,
  requestAdRevive,
  requestAdVictoryDouble,
  confirmVictoryRewardDouble,
  declineRevive,
  completeDodgeTutorial,
  beginBrowserRelativeDrag,
  beginWechatRelativeDrag,
  handleWechatRelativeDrag,
  chooseSkill,
  chooseAllSkills,
  requestAdReroll: () => requestUpgradeReward('reroll'),
  requestAdTakeAll: () => requestUpgradeReward('take-all'),
  finishBattleResult: () => {
    if (game.victoryRewardDoublePending) return;
    if (game.state === 'victory_result' || game.state === 'defeat_result') {
      endGame(game.state === 'victory_result');
    }
  },
  selectCampaignStage,
  selectDifficulty,
  switchLobbyTab: (tabId) => {
    activeLobbyTab = tabId;
  },
  getLanguage: i18n.getLanguage,
  toggleLanguage: i18n.toggleLanguage,
  showGrowthPanel,
  renderStageSelector,
  renderGrowthPanel,
  upgradeProfile,
  requestAdDiamonds,
  getDailyLoginSnapshot,
  claimDailyLoginReward,
  addDebugCurrency,
  grantDebugWeapons,
  toggleDebugUnlockAll,
  clearGameSaveAndRestart,
  previewUltimateEvolution,
  debugCompleteCurrentRun,
  claimSupply: (action) => claimSupply(action, { showResults: false }),
  selectGachaPool(poolId) {
    if (GACHA_POOLS[poolId]) selectedGachaPoolId = poolId;
  },
  selectPilot: (pilotId) => {
    if (!selectPilot(pilotId)) {
      showToast('尚未获得该机甲少女');
      return false;
    }
    syncPlayerAssemblyVisual();
    updateLobbyHeader();
    showToast(`${getActivePilot().name} · 已设为出击角色`);
    return true;
  },
  resetAssembly: (category) => {
    resetAssembly(category);
    syncPlayerAssemblyVisual();
    updateLobbyHeader();
    showToast('已恢复推荐配置');
  },
  setAssemblySlot: (slotId, moduleId) => {
    if (!setAssemblySlot(slotId, moduleId)) return false;
    syncPlayerAssemblyVisual();
    updateLobbyHeader();
    showToast(moduleId ? '固定件已装配' : '固定件已卸下');
    return true;
  },
  getActivePilot,
  getPilotState,
  getGachaState,
  upgradeCommonWeapon(id,kind){const result=upgradeOwnedCommonWeapon(id,kind,profileState.coins);if(result.ok){profileState.coins=result.coins;saveProfileState();updateLobbyHeader();}return result;},
  leaderboardEnabled,
  getLeaderboardEntries: () => (leaderboardEnabled ? rankScoreEntries(localScores()) : []),
  getLeaderboardSubmission: getBestLeaderboardSubmission,
  requestLeaderboardProfile,
  getWorldLeaderboard,
  openLeaderboard: leaderboardEnabled
    ? (openPlatformLeaderboard || open4399Leaderboard)
    : () => false,
  getAssemblySnapshot,
  getAssemblyAppearance,
  getFixedModuleCatalog,
  getAssemblyModuleInfo,
  createAssemblyAircraftVisual,
  updateAssemblyAircraftVisual,
  createEmbeddedAssemblyBay,
  resolvePilotTexture: (pilotId) => (
    thunderRuntimeGlobals.resolvePilotTexture?.(pilotId)
    || pixiLobbyPilotTextures.get(pilotId)
  ),
  resolvePilotAvatarTexture: (pilotId) => (
    thunderRuntimeGlobals.resolvePilotAvatarTexture?.(pilotId)
    || pixiLobbyPilotTextures.get(`${pilotId}:avatar`)
  ),
  resolveDailyLoginTexture: () => (
    thunderRuntimeGlobals.resolveDailyLoginTexture?.()
    || pixiLobbyDailyLoginTexture
  ),
  getEquippedGachaWeapon,
  isGachaWeaponCompatible: (weapon) => (
    isGachaWeaponCompatible(weapon, getActivePilot().id)
  ),
  equipGachaWeapon: (weaponId) => {
    if (!equipGachaWeapon(weaponId)) return false;
    syncPlayerAssemblyVisual();
    updateLobbyHeader();
    showToast('主武器已装备');
    return true;
  },
  profilePower,
  rewardFor,
  starGoalDefinitions,
  profileUpgradeCost,
  isDifficultyUnlocked,
  getDifficultyResult,
  isStageUnlocked: (stageIndex) => stageIndex <= effectiveHighestUnlocked(),
  bestStageStars,
  setPointer(x, y, phase = 'move') {
    if (phase === 'end' || phase === 'cancel') {
      game.pointerActive = false;
      return;
    }
    game.pointerActive = true;
    setPointerTarget({ x, y });
  },
  get selectedStageIndex() {
    return selectedStageIndex;
  },
  get selectedDifficultyId() {
    return selectedDifficultyId;
  },
  get activeLobbyTab() {
    return activeLobbyTab;
  },
  get previewLobbyModal() {
    return previewLobbyModal;
  },
  get selectedGachaPoolId() {
    return selectedGachaPoolId;
  },
  get debugUnlockAll() {
    return debugUnlockAll;
  },
  get debugToolsEnabled() {
    return DEBUG_TOOLS_ENABLED;
  },
  get rewardedAdPending() {
    return rewardedAdPending;
  },
  get boss() {
    return boss;
  },
  get runStats() {
    return runStats;
  },
  get incomingThreats() {
    if(game.state!=='playing')return [];
    return telegraphs.filter(t=>t.showWarning!==false&&!t.source?.dead)
      .map(t=>projectedPoint(t.source?.x??t.originX,t.source?.y??t.originY));
  },
  get currentUpgradeChoices() {
    return currentUpgradeChoices;
  },
};

pixiLobby = usePeripheralLobby
  ? mountPeripheralLobby({ bridge: thunderBridge, parent: shell, system: peripheralSystem })
  : createPixiLobby({ bridge: thunderBridge, parent: scene });
pixiCombatUi = createPixiCombatUi({ bridge: thunderBridge, parent: scene });
if (pixiLobby) {
  ui.overlay.hidden = true;
  ui.overlay.style.display = 'none';
  shell.classList.add('pixi-lobby-active', 'pixi-combat-active');
  if (usePeripheralLobby) {
    shell.classList.add('peripheral-lobby-active');
    const update = pixiLobby.update;
    let previousVisible;
    pixiLobby.render ||= pixiLobby.refresh;
    pixiLobby.update = ticker => {
      const visible = ['menu', 'gameover', 'victory'].includes(game.state);
      if (visible !== previousVisible) { pixiLobby.setVisible(visible); previousVisible = visible; }
      update(ticker);
    };
    // The combat ticker stops in the lobby. The DOM preview has its own small
    // render loop, so thumbnails and the selected aircraft remain responsive.
    const lobbyFrames = createFrameLoop((_time, delta) => {
      pixiLobby.update(delta / 1000);
      if (thunderRuntimeGlobals.canvas && pixiLobby.state.visible) app.renderer.render({container:app.stage});
    }, {
      documentRef: document,
      requestFrame: callback => window.requestAnimationFrame(callback),
      cancelFrame: frame => window.cancelAnimationFrame(frame),
    });
    const destroyLobby = pixiLobby.destroy;
    pixiLobby.destroy = () => { lobbyFrames.destroy(); destroyLobby(); };
    lobbyFrames.start();
  } else app.ticker.add(pixiLobby.update);
  app.ticker.add(pixiCombatUi.update);
  thunderBridge.pixiLobby = pixiLobby;
  thunderBridge.pixiCombatUi = pixiCombatUi;
}

if (BOSS_TEST_MODE) {
  startGame();
} else if (autoStartFirstSortie) {
  startGame();
}

globalThis.__THUNDER_ORIGINAL_GAME__ = thunderBridge;
return thunderBridge;
}

const thunderRuntimeReady = globalThis.__THUNDER_DEFER_RUNTIME_START__
  ? null
  : startThunderRuntime();

export { startThunderRuntime, thunderRuntimeReady };
