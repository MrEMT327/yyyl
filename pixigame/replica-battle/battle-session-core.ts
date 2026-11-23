import type {createBattlePerformanceReporter} from '../src/replica/battle-performance.js';
import type {createBattleLaunch} from './battle-launch.js';
import type {createBattleLifetime} from './battle-lifetime.js';
import type {createBattleActivity} from './battle-activity.js';
import type {GameAudio} from './kernel/audio';
import type {Controls} from './kernel/input';
import type {BattleRendering} from './battle-rendering';
import { developerSkillsEnabled } from '../src/developer-battle-settings.js';
import { buildDeveloperSkillCatalog } from './kernel/developer-skill-catalog';
import { pathogenicAudioManifest, combatCues, activeCombatSounds } from './kernel/combat-audio';
import { memoryCheckpoint } from '../src/replica/memory-checkpoints.js';
import { createBattleGraphics } from './battle-graphics.js';
import { createBattleFrameReuse } from './battle-frame-reuse.js';
import { replicaChapter } from '../src/replica/chapter-contract';
import { createBattleRunContent, prepareBattleData, type PreparedBattleData } from './prepare-battle-data';
import type {ReadSharedLoadoutJSON} from './kernel/loadout-resources';
import { Simulation } from './kernel/simulation';
import {planBattleImages} from './kernel/battle-image-plan';
import { pathogenicBattleMusic } from '../src/battle-music.js';
import { BattleHudFlow } from './battle-hud-flow';
import { nativeLogicRate, nativeLogicDelta } from './kernel/native-time';
import { smoothCoastTime } from '../src/replica/coast-background-time.mjs';
import { loadLoadoutCatalog, createDefaultStudyLoadoutState, applyStudyLoadout } from './kernel/loadout-state';
import { loadFighterPackages } from '../src/three/aircraft/fighter-packages.js';
import { peripheralSceneForStage } from '../src/three/peripheral-scenes.js';
import { worldTextureSources } from '../src/three/world.js';
import { prepareReplicaLoadout } from './prepare-loadout';
import { playerSpineLayers, selectPlayerAppearance } from './kernel/player-appearance';
import type { Choice } from './kernel/model';
import { readWeaponAppearances, previewWeaponAppearance } from './weapon-appearance';
import { projectExperienceContent } from '../src/replica/project-experience-art.js';

export type BattlePlatform = {
  emit?: (message: Record<string, unknown>) => void;
  checkpointTarget?: EventTarget;
  setNotice?:(text:string)=>void;
  setLoadingMessage?:(text:string)=>void;
  movementGuide?: {show(value:boolean):void;destroy():void};
  window: Window & typeof globalThis;
  document: Document;
  location: Location;
  parent: Window;
  canvas: HTMLCanvasElement;
  fetchResource: typeof fetch;
  presentFrame?: () => boolean | void;
  frozenFrame?: { capture: () => boolean; present: () => void };
  loadCatalog?: typeof loadLoadoutCatalog;
  readSharedLoadoutJSON?: ReadSharedLoadoutJSON;
  warmBattleImages?: (urls: string[], signal: AbortSignal) => Promise<void>;
  warmBattleTerrain?: (urls: string[], signal: AbortSignal) => Promise<unknown>;
  loadBattleData?: (chapterId: number, signal: AbortSignal, prepare: () => Promise<PreparedBattleData>) => Promise<PreparedBattleData>;
  hudHost?: unknown;
  skinHost?: Parameters<typeof import('../src/replica/project-presentation.js').createProjectPresentation>[0]['host'];
};
export type BattleBindings = {
  stage?:HTMLElement;
  id:string | null;
  chapterId:number;
  baseURL:string;
  battleURL:string;
  hidden:()=>boolean;
  now:()=>number;
  reducedMotion:()=>boolean;
  developerEnabled?:()=>boolean;
  emit:(message:Record<string,unknown>)=>void;
  playable:boolean;
  createLifetime:()=>ReturnType<typeof createBattleLifetime>;
  bind:(receive:(message:any)=>void,fail:(error:unknown)=>void,signal:AbortSignal)=>void;
  createPerformance?:()=>ReturnType<typeof createBattlePerformanceReporter>;
  createGuide:()=>{show(value:boolean):void;destroy():void};
  createAudio:(manifest:Record<string,any>)=>GameAudio;
  prepareAudio?:(audio:GameAudio)=>void;
  disposeAudio:(audio:GameAudio)=>void;
  createLaunch:(options:Omit<Parameters<typeof createBattleLaunch>[0],'stage'>)=>ReturnType<typeof createBattleLaunch>;
  createControls:(canMove:()=>boolean,pause:()=>void,signal:AbortSignal)=>Pick<Controls,'clear'|'read'|'held'>;
  onActivity:(options:{signal:AbortSignal;suspend:()=>void;refresh:()=>void;blocked:()=>boolean})=>ReturnType<typeof createBattleActivity>;
  unlockOnPointer:(unlock:()=>void,signal:AbortSignal)=>void;
  watchVisibility:(change:()=>void,signal:AbortSignal)=>()=>void;
  registerCheckpoint?:(read:()=>any)=>{freeze():void};
  markStarted?:()=>void;
};
export type SharedBattlePlatform = Omit<BattlePlatform,'window'|'document'|'parent'|'location'> & {
  bindings:BattleBindings;
  memoryContext?:Parameters<typeof memoryCheckpoint>[1];
};

export function mountSharedBattleSession(platform:SharedBattlePlatform,engine:BattleRendering) {
const {bindings}=platform;
const checkpointMemory=(stage:string)=>memoryCheckpoint(stage,platform.memoryContext);
const {stage,baseURL,battleURL,hidden,now}=bindings;
const lifetime=bindings.createLifetime();
const CHANNEL='shnh-replica-battle-v1';
const session=bindings.id;
const battlePerformance=bindings.createPerformance?.();
if(battlePerformance)lifetime.add(()=>battlePerformance.destroy());
const requestedChapter=replicaChapter(bindings.chapterId);
const send=(type:string,payload:Record<string,unknown>={})=>bindings.emit({channel:CHANNEL,session,type,...payload});
const reportLoading=(phase:string,progress:number)=>{
  if(!lifetime.disposed)send('loading-progress',{phase,progress});
};
let readCheckpoint:(()=>any)|undefined;
let lastCheckpoint:any=null;

let startRun: ((runId: string, configurationKey: string, onboarding?: {movement?:boolean;firstChoice?:boolean}, defeatCount?:number) => void) | undefined;
let configureRun: ((requestId: number, configuration: unknown, configurationKey: unknown) => Promise<void>) | undefined;
let currentRunId = '', reported = false;
let started = false;
let acknowledgeGuide: ((message:any)=>void)|undefined;
let applySettlement: ((receipt: any) => void) | undefined;
let receiveReviveAd: ((message: any) => void) | undefined;
let revealLaunch: (()=>void)|undefined;

let noticeTimer: ReturnType<typeof setTimeout> | undefined;
function notice(text=''){
  clearTimeout(noticeTimer);platform.setNotice?.(text);
  if(text)noticeTimer=setTimeout(()=>platform.setNotice?.(''),3500);
}
lifetime.add(()=>{clearTimeout(noticeTimer);platform.setNotice?.('');});

function fail(error: unknown) {
  if (lifetime.disposed) return;
  const message = error instanceof Error ? error.message : String(error);
  console.error('[replica-battle] 战斗初始化失败', error);
  send('error', { message });
  platform.setLoadingMessage?.(message);
}

async function initialize(appearance: any, initialConfiguration?: unknown) {
  if (!requestedChapter) throw new Error('出击关卡不存在');
  checkpointMemory('battle-load-start');
  reportLoading('data',0);
  const fetchResource = platform.fetchResource;
  // Keep the aircraft request running while data and terrain are prepared.
  // Its result is consumed by the presentation, so slow aircraft decoding
  // cannot hold back the first terrain texture request.
  const assetBase = new URL(appearance.assetBase, battleURL);
  const aircraftReady = loadFighterPackages({pilotIds:[appearance.aircraft.id],allowTextureFallback:true,assetBase,
    read:platform.skinHost?.readFighterFile,objectLoader:platform.skinHost?.objectLoader,assetBytes:platform.skinHost?.assetBytes});
  // Data may fail or the battle may close before presentation consumes it.
  // Observe an early rejection without replacing the original result.
  void aircraftReady.catch(() => {});
  const chapterId = requestedChapter.id;
  const prepare = () => prepareBattleData({
    chapterId, baseURL: battleURL, fetchResource, signal: lifetime.signal,
    loadCatalog: platform.loadCatalog,
    readSharedLoadoutJSON: platform.readSharedLoadoutJSON,
    onProgress: (completed, total) => reportLoading('data', completed / total),
  });

  const battleData = platform.loadBattleData ? platform.loadBattleData(chapterId, lifetime.signal, prepare) : prepare();
  if (platform.warmBattleTerrain && appearance.map?.terrain === 'cloud') {
    const scene = peripheralSceneForStage(requestedChapter.stageIndex);
    const sources = worldTextureSources(scene).flatMap(([, path]) => path ? [new URL(path, assetBase).href] : []);
    void platform.warmBattleTerrain(sources, lifetime.signal);
  }
  const data = await battleData;
  if (lifetime.disposed) return;
  const content = createBattleRunContent(data.content), { catalog } = data;
  checkpointMemory('battle-data-ready');
  reportLoading('data',1);
  // The initial selection prepares the renderer. The final configuration
  // handshake still validates every sortie before it can start.
  let prepared: ReturnType<typeof prepareReplicaLoadout> | undefined;
  let firstFrame: {runId:string; configurationKey:string} | undefined;
  let activeEntry: ReturnType<typeof prepareReplicaLoadout>['entry'] | undefined;
  // Construct the actual consumer before checking its supported attributes.
  // A fresh battle module has no registrations from the lobby or prior sorties.
  const sim = new Simulation(content);
  const entryLoadout = initialConfiguration === undefined ? createDefaultStudyLoadoutState()
    : prepareReplicaLoadout(catalog, initialConfiguration).state;

  const movementGuide=bindings.createGuide();lifetime.add(()=>movementGuide.destroy());
  let waitingForMovement=false,guideRetryAt=0;
  const pendingGuides=new Set<number>();
  acknowledgeGuide=message=>{if(message.runId===currentRunId)pendingGuides.delete(message.group);};
  const flushGuides=()=>{if(!pendingGuides.size||now()<guideRetryAt||!currentRunId||reported)return;guideRetryAt=now()+800;for(const group of pendingGuides)send('onboarding',{runId:currentRunId,group});};
  sim.rewardedReviveEnabled = true;
  let reviveRequestSerial = 0, pendingReviveRequest = 0, pendingReviveKind = 'ad';
  applyStudyLoadout(content, sim, catalog, entryLoadout);
  const visualContent = projectExperienceContent(content);
  const replaceTerrain = appearance.map?.terrain === 'cloud';
  const imagePlan = platform.warmBattleImages ? planBattleImages(visualContent, {
    playerLayers: selectPlayerAppearance(content).layers,
    bodyPoseOnly: true,
    replaceTerrain,
    nativeTerrain: !replaceTerrain && Boolean(content.assets.map.nativeLayers?.renderers?.length),
  }) : undefined;
  if (imagePlan) {
    const orderedURLs = [...new Set(imagePlan.images.map(([, url]) => url))];
    void platform.warmBattleImages?.(orderedURLs, lifetime.signal);
  }
  const music = pathogenicBattleMusic(content.chapter.chapter.id, content.assets.audio, content.chapter.musicKey, content.assets.soundKeys?.[100006]);
  const audio = bindings.createAudio({ ...content.assets.audio, ...pathogenicAudioManifest, ...music, 'project:flight-roll': { url: new URL('../assets/audio/sfx/dodge.wav', import.meta.url).href }, 'project:defeat': {url:new URL('../audio/mixkit/defeat-2042.wav',baseURL).href} });
  lifetime.add(() => bindings.disposeAudio(audio));
  bindings.prepareAudio?.(audio);
  let controls: ReturnType<BattleBindings['createControls']>, ui: BattleHudFlow, accumulated = 0, lastPhase = '';
  let activity: ReturnType<typeof createBattleActivity> | undefined;
  let cloudFrame=(callback:()=>void)=>callback();
  let frameReuse: ReturnType<typeof createBattleFrameReuse> | undefined;
  const graphics = createBattleGraphics({signal:lifetime.signal,onChange:()=>{frameReuse?.invalidate();activity?.enforce();ui?.update();}});
  lifetime.add(() => graphics.destroy());
  const watchGraphics=(canvas:HTMLCanvasElement,context:WebGLRenderingContext|WebGL2RenderingContext)=>{graphics.watch(canvas,context);battlePerformance?.watch(canvas,context);};
  reportLoading('appearance',0);
  const appearanceReady = engine.createAppearance(content, appearance, fail, watchGraphics,
    (completed,total)=>reportLoading('appearance',completed/total),
    ()=>audio.effect('project:flight-roll',.22,.5),platform.skinHost,aircraftReady).then(skin => {
      lifetime.add(() => skin.dispose());
      return skin;
    });
  const skin = await appearanceReady;
  if (lifetime.disposed) return;
  const launch=bindings.createLaunch({
    player:()=>sim.player,bounds:()=>sim.cameraWorldBounds,reducedMotion:bindings.reducedMotion,
    clearInput:()=>{controls?.clear();accumulated=0;sim.playerMotion={x:0,z:0,rawX:0};},
    onVisual:value=>skin.setLaunchPresentation(value),
    onComplete:()=>{audio.resume();ui.update();send('control-ready',{runId:currentRunId});},
  });
  revealLaunch=()=>launch.reveal();
  lifetime.add(()=>{revealLaunch=undefined;launch.destroy();});
  if (!lifetime.disposed) checkpointMemory('battle-skin-ready');
  if (lifetime.disposed) return;
  reportLoading('appearance',1);
  let appliedEquipmentRevision = -1;
  const syncWeaponSkins = () => {
    const revision = sim.equipmentRevision;
    if (revision === appliedEquipmentRevision) return;
    skin.setWeapons?.(readWeaponAppearances(sim));
    appliedEquipmentRevision = revision;
  };
  syncWeaponSkins();
  const weaponIcon = (familyId: number, choice?: Choice) => {
    const identity = choice ? previewWeaponAppearance(sim, choice, false)
      : readWeaponAppearances(sim).find(row => row.familyId === familyId);
    return identity ? skin.weaponIcon?.(identity)?.key : undefined;
  };
  const developerMode=bindings.developerEnabled?.()??developerSkillsEnabled();
  const optimizeChapterOne = chapterId === 1 && Boolean(platform.warmBattleImages) && !developerMode;
  const scene = engine.createView(visualContent, sim, () => {
    engine.ready?.(scene,skin,watchGraphics);
    checkpointMemory('battle-textures-ready');
    ui.update(); send('ready');
  }, skin, undefined, imagePlan, optimizeChapterOne, Boolean(platform.warmBattleImages) && !developerMode);
  ui = new BattleHudFlow(stage, sim, audio, () => {
    audio.pause();
    const result=currentRunId&&!reported ? battleResult(sim.phase!=='won'&&sim.phase!=='lost') : undefined;
    if(result){reported=true;sim.pause();controls?.clear();}
    send('home',result?{result}:{});
  }, weaponIcon, optimizeChapterOne ? card => scene.prepareChoiceArt(card) : undefined,engine.createChoiceBurst(),{active:()=>!lifetime.disposed,visible:()=>!hidden()});
  lifetime.add(() => ui.dispose());
  {
    const requestReviveAd = () => {
      if (!currentRunId || reported || !sim.beginReviveAd()) return;
      controls?.clear(); audio.pause();
      pendingReviveRequest = ++reviveRequestSerial;
      pendingReviveKind = 'ad';
      send('revive-ad', {runId:currentRunId, requestId:pendingReviveRequest});
      ui.update();
    };
    const requestDiamondRevive = () => {
      if (!currentRunId || reported || !sim.beginDiamondRevive()) return;
      controls?.clear(); audio.pause();
      pendingReviveRequest = ++reviveRequestSerial; pendingReviveKind = 'diamond';
      send('revive-diamond', {runId:currentRunId, requestId:pendingReviveRequest});
      ui.update();
    };
    receiveReviveAd = message => {
      if (message.runId !== currentRunId || message.requestId !== pendingReviveRequest || !pendingReviveRequest || reported) return;
      if (message.type !== `revive-${pendingReviveKind}-result`) return;
      pendingReviveRequest = 0;
      const revived = pendingReviveKind === 'diamond' ? sim.completeDiamondRevive(message.completed === true) : sim.completeReviveAd(message.completed === true);
      if (revived) { accumulated = 0; controls?.clear(); audio.resume(); }
      else if (message.message) {
        notice(message.message);
      }
      ui.update(); reportPhase();
    };
    reportLoading('interface',0);
    const cloud = await engine.mountCombatHud({stage,ui,sim,audio,hudHost:platform.hudHost,signal:lifetime.signal,requestReviveAd,requestDiamondRevive,aircraftId:appearance.aircraft?.id,reducedMotion:bindings.reducedMotion,onGraphicsContext:watchGraphics,screen:skin.screen});
    cloudFrame=cloud.frame;
    applySettlement=receipt=>cloud.setSettlement(receipt);
    lifetime.add(() => {applySettlement=undefined;receiveReviveAd=undefined;cloud.destroy();});
    if (!lifetime.disposed) checkpointMemory('battle-ui-ready');
    if (lifetime.disposed) return;
  }
  reportLoading('interface',1);
  if (developerMode) {
    const developerSkills = engine.mountDeveloperSkills(stage, sim, audio, ui);
    lifetime.add(() => developerSkills.destroy());
  }
  const configureDeveloperSkills = () => { sim.developerSkillCatalog = developerMode ? buildDeveloperSkillCatalog(content, catalog) : []; };
  controls = bindings.createControls(() => !launch.active && sim.phase === 'playing' && sim.player.hp > 0, () => {if(!launch.active)ui.togglePause();},lifetime.signal);
  lifetime.add(() => controls.clear());
  activity = bindings.onActivity({
    signal:lifetime.signal,
    suspend: () => { if(!launch.active)sim.pause(); controls.clear(); audio.pause(); },
    refresh: () => ui.update(), blocked: graphics.blocked,
  });
  const updateUi = ui.update.bind(ui);
  ui.update = () => { activity!.enforce(); updateUi(); };
  lifetime.add(() => activity!.destroy());
  const releasedTime=engine.installPace({scene,controls,signal:lifetime.signal,
    isPlaying:()=>!launch.active&&!waitingForMovement&&!sim.victoryPresentationActive&&sim.phase==='playing'&&sim.player.hp>0});
  lifetime.add(()=>releasedTime.destroy());
  let configurationGeneration = 0;
  configureRun = async (requestId, configuration, configurationKey) => {
    if (currentRunId && !reported) throw new Error('当前战斗尚未结算');
    prepared = undefined;
    const generation = ++configurationGeneration;
    // A still-open old lobby must not silently wait on a newer iframe contract.
    if (typeof configurationKey !== 'string') throw new Error('大厅版本已更新，请刷新页面后重新出击');
    const candidate = prepareReplicaLoadout(catalog, configuration);
    if (candidate.key !== configurationKey) throw new Error('大厅与战斗配置版本不一致，请刷新页面后重新出击');
    try {
      const layers = playerSpineLayers(selectPlayerAppearance(content, candidate.entry).layers, Boolean(skin.playerSkin));
      await engine.preparePlayer(scene, layers, lifetime.signal);
      await scene.prepareLoadoutArt?.(candidate.entry.battleSkillIds);
    } catch (error) {
      if (generation === configurationGeneration) throw error;
      return;
    }
    if (lifetime.disposed || generation !== configurationGeneration) return;
    prepared = candidate;
    send('configured', { requestId, configurationKey: prepared.key, entry: prepared.entry });
  };
  startRun = (runId, configurationKey, onboarding={}, defeatCount=0) => {
    if (!prepared || prepared.key !== configurationKey || (currentRunId && !reported)) {
      throw new Error('战前配置尚未确认或当前战斗尚未结算');
    }
    const accepted = prepared; prepared = undefined;
    activeEntry = accepted.entry;
    currentRunId = runId; reported = false; accumulated = 0; pendingReviveRequest = 0;
    applySettlement?.(null);
    applyStudyLoadout(content, sim, catalog, accepted.state);
    configureDeveloperSkills();
    pendingGuides.clear();guideRetryAt=0;waitingForMovement=onboarding.movement===true;
    controls.clear(); audio.unlock().catch(() => {}); sim.start(onboarding, defeatCount); syncWeaponSkins();
    launch.begin();
    audio.startMusic(content.chapter.musicKey,true); ui.update();
    bindings.markStarted?.();
    notice();
    firstFrame = { runId, configurationKey };
  };
  const sounds: Record<number, string> = { 260002: 'deng~', 260003: 'battle_restore', 300002: 'FireShoot', 230003: 'Bullet_Laser', 330001: 'Hitted_Plane', 330004: 'Hitted_Plane', 330003: 'Hitted_Plane', 330006: 'Death_Plane_Short', 330007: 'Death_jingying', 330008: 'Death_jingying', 210001: 'Death_plane_long', 410001: 'Out_LevelUp_Show' };
  function battleResult(quit=false) {
    return {
      runId:currentRunId,won:!quit&&sim.phase==='won',abandoned:false,
      endReason:quit?'quit':sim.phase==='won'?'victory':'defeat',
      chapterId:requestedChapter!.id,gold:sim.gold,kills:sim.kills,bossKills:sim.bossKills,level:sim.level,
      wave:sim.wave,completedWave:sim.completedWave,clock:sim.clock,damageDealt:sim.damageDealt,
      hp:sim.player.hp,maxHp:sim.player.maxHp,revivesUsed:sim.revivesUsed,adRevivesUsed:sim.adRevivesUsed,
      damageByWeapon:Array.from(sim.damageByWeapon),entry:activeEntry,
    };
  }
  readCheckpoint=()=>currentRunId?battleResult(sim.phase!=='won'&&sim.phase!=='lost'):null;
  const checkpoint=bindings.registerCheckpoint?.(readCheckpoint);
  lifetime.add(()=>{checkpoint?.freeze();lastCheckpoint=readCheckpoint?.();readCheckpoint=undefined;});
  const reportPhase = () => {
    if (sim.phase !== lastPhase) { lastPhase = sim.phase; send('phase', { phase: lastPhase }); }
    if (!reported && currentRunId && (sim.phase === 'won' || sim.phase === 'lost')) {
      reported = true;
      send('result', {result:battleResult()});
    }
  };
  // Keep the native 1/30 wall-clock cadence and Q16 delta 0x888, followed
  // by sound/music delivery and the combat interface.
  const logicStep = 1 / nativeLogicRate;
  const nativeDelta = nativeLogicDelta;
  let backgroundRunId = sim.runId;
  scene.onFrame = (delta:number) => cloudFrame(() => {
    if (lifetime.disposed) return;
    if (backgroundRunId !== sim.runId) { backgroundRunId = sim.runId; scene.coastBackgroundTime = 0; }
    if (!activity!.enforce()) { accumulated = 0; return; }
    // The visual-only takeoff keeps its authored wall-clock duration even
    // when Phaser smooths a 30 Hz browser frame down toward 16.7 ms.
    delta = activity!.frameDelta(launch.active ? engine.rawDelta(scene) : delta);
    if(launch.active){
      accumulated=0;controls.clear();movementGuide.show(false);
      launch.update(delta/1000);ui.update();return;
    }
    if(sim.tutorialChoiceCompleted){pendingGuides.add(4);sim.tutorialChoiceCompleted=false;guideRetryAt=0;}
    flushGuides();movementGuide.show(waitingForMovement&&sim.phase==='playing');
    if (sim.phase !== 'playing') {
      audio.syncContinuous(); audio.syncCharges();
      if (!hidden()) sim.advanceRevivePrompt(Math.max(0, delta / 1000));
      accumulated = 0; controls.clear(); sim.advanceResultPresentation(Math.min(delta / 1000, .1)); syncWeaponSkins(); ui.update(); reportPhase(); return;
    }
    accumulated += Math.min(delta / 1000, 0.1);
    while (accumulated >= logicStep && sim.phase === 'playing') {
      const viewCamera = scene.cameraPosition;
      const movement = controls.read(nativeDelta, content.world.width, content.world.height, sim.playerMovementSpeed,
        { x: sim.player.x, y: -sim.player.z }, sim.playerMovementBounds, { x: viewCamera.x, y: -viewCamera.z });
      if(waitingForMovement){
        if(Math.hypot(movement.x,movement.y)<1e-6){accumulated-=logicStep;continue;}
        waitingForMovement=false;movementGuide.show(false);
        sim.step(nativeDelta, {x:movement.x,z:-movement.y,dirX:movement.dirX,dirZ:movement.dirZ,rawX:movement.rawX});
        pendingGuides.add(1);guideRetryAt=0;flushGuides();
      } else sim.step(nativeDelta, { x: movement.x, z: -movement.y, dirX: movement.dirX, dirZ: movement.dirZ, rawX: movement.rawX });
      accumulated -= logicStep;
    }
    if (sim.phase === 'playing' && !waitingForMovement)
      scene.coastBackgroundTime = smoothCoastTime(sim.time, accumulated, logicStep, nativeDelta, scene.coastBackgroundTime);
    ui.update();
    for (const id of sim.sounds) {
      const cue = combatCues[id];
      if (cue) { audio.effect(cue.key, cue.volume, cue.interval); continue; }
      const key = content.assets.soundKeys?.[id] || sounds[id];
      if (key) audio.effect(key, id === 300002 ? .2 : .4, id === 300002 ? .035 : .065);
    }
    for (const id of sim.musicRequests) {
      const key = content.assets.soundKeys?.[id] || (id === 100006 ? 'BGM_BOSS_temp' : undefined);
      if (id > 0 && key) audio.startMusic(key);
    }
    sim.musicRequests.length = 0;
    sim.sounds.length = 0;
    if(audio.needsCombatCues&&sim.phase==='playing'&&sim.player.hp>0){
      audio.syncContinuous(activeCombatSounds(sim.projectiles,true,sim.enemies));
      audio.syncCharges(sim.activeEnemyCharges());
    }else{
      audio.syncContinuous();audio.syncCharges();
    }
    syncWeaponSkins(); reportPhase();
  });
  bindings.unlockOnPointer(()=>{audio.unlock().catch(()=>{});},lifetime.signal);
  const frozenFrame = platform.frozenFrame;
  if (frozenFrame) {
    frameReuse = createBattleFrameReuse({
      getRunId: () => currentRunId,
      canFreeze: () => !lifetime.disposed && !hidden() && !launch.active &&
        (sim.phase === 'paused' || sim.phase === 'upgrade') && !graphics.blocked(),
      capture: frozenFrame.capture,
      updateOverlay(delta) {
        scene.onFrame?.(delta);
        frozenFrame.present();
      },
    });
    lifetime.add(bindings.watchVisibility(frameReuse.invalidate,lifetime.signal));
  }
  engine.start({scene,platform,lifetime,frameReuse,graphics,battlePerformance,
    reportLoading,fail,renderedFrame(){
      if(lifetime.disposed||hidden()||graphics.blocked())return;
    if(!firstFrame)return;
    const rendered=firstFrame;firstFrame=undefined;
    send('started',rendered);
    }});

}

function receive(message:any){
  if(lifetime.disposed)return;
  if (message?.channel !== CHANNEL || message.session !== session) return;
  if (message.type === 'initialize' && !started) { started = true; initialize(message.appearance, message.initialConfiguration).catch(fail); }
  try {
    if (message.type === 'launch-visible' && message.runId === currentRunId) revealLaunch?.();
    if (message.type === 'settled' && message.runId === currentRunId) applySettlement?.(message);
    if (message.type === 'revive-ad-result' || message.type === 'revive-diamond-result') receiveReviveAd?.(message);
    if (message.type === 'onboarding-saved') acknowledgeGuide?.(message);
    if (message.type === 'configure' && Number.isSafeInteger(message.requestId)) {
      if (!configureRun) throw new Error('战斗资源尚未准备完成');
      void configureRun(message.requestId, message.configuration, message.configurationKey).catch(fail);
    }
    if (message.type === 'start' && typeof message.runId === 'string' && typeof message.configurationKey === 'string') {
      if (!startRun) throw new Error('战斗资源尚未准备完成');
      if (!requestedChapter || message.chapterId !== requestedChapter.id) throw new Error('开始指令的关卡不一致');
      startRun(message.runId, message.configurationKey, message.onboarding, message.defeatCount);
    }
  } catch (error) { fail(error); }
  if (message.type === 'notice') {
    notice(message.message);
  }
}
bindings.bind(receive,fail,lifetime.signal);
if(bindings.playable&&session)send('boot',{chapterId:requestedChapter?.id});
else platform.setLoadingMessage?.('请从少女航线关卡入口出击');
return {receive,dispose:lifetime.dispose,checkpoint:()=>readCheckpoint?.()??lastCheckpoint};
}
