import {createBattleLaunch} from './battle-launch.js';
import './battle-launch.css';
import { developerSkillsEnabled } from '../src/developer-battle-settings.js';
import { buildDeveloperSkillCatalog } from './kernel/developer-skill-catalog';
import { mountDeveloperSkills } from './developer-skills-ui';
import { pathogenicAudioManifest, combatCues, activeCombatSounds } from './kernel/combat-audio';
import '../src/ui/guide-presentation.css';
import {createMovementGuide} from './battle-onboarding';
import { installEnemyFireEffects } from './enemy-fire-effects';
import { memoryCheckpoint } from '../src/replica/memory-checkpoints.js';
import { createBattleLifetime, disposeNativeUi, disposeNativeAudio, disposeNativeGame } from './battle-lifetime.js';
import { createBattleActivity } from './battle-activity.js';
import { createBattleGraphics } from './battle-graphics.js';
import { installSafeTouchCancel } from './safe-touch-cancel.js';
import { installBattleCheckpoint } from '../src/replica/battle-checkpoint.js';
import { replicaChapter } from '../src/replica/chapter-contract';
import { chapterPresentationForStage } from '../src/replica/chapter-presentation.js';
import { loadContent } from './kernel/content';
import { Simulation } from './kernel/simulation';
import { BattleView, makeGame } from './kernel/renderer';
import { GameAudio } from './kernel/audio';
import { pathogenicBattleMusic } from '../src/battle-music.js';
import { Controls } from './kernel/input';
import { Interface } from './kernel/ui';
import { mountCloudCombat } from './cloud-combat.js';
import { nativeLogicRate, nativeLogicDelta } from './kernel/native-time';
import { loadLoadoutCatalog, loadStudyLoadoutState, createDefaultStudyLoadoutState, applyStudyLoadout } from './kernel/loadout-state';
import { createAppearance } from './appearance';
import { prepareReplicaLoadout } from './prepare-loadout';
import type { Choice } from './kernel/model';
import { readWeaponAppearances, previewWeaponAppearance } from './weapon-appearance';
import { createProjectInterfaceSprites } from '../src/ui/project-battle-interface-art.js';
import { projectExperienceContent } from '../src/replica/project-experience-art.js';
import '../src/ui/project-battle-interface-art.css';

const lifetime = createBattleLifetime();
const researchMode = new URLSearchParams(location.search).get('study') === '1';
const CHANNEL = 'shnh-replica-battle-v1';
const session = new URLSearchParams(location.search).get('session');
const requestedChapter = replicaChapter(Number(new URLSearchParams(location.search).get('chapter')));
const send = (type: string, payload: Record<string, unknown> = {}) => parent.postMessage({ channel: CHANNEL, session, type, ...payload }, location.origin);
const stage = document.getElementById('stage')!;
let startRun: ((runId: string, configurationKey: string, onboarding?: {movement?:boolean;firstChoice?:boolean}, defeatCount?:number) => void) | undefined;
let configureRun: ((requestId: number, configuration: unknown, configurationKey: unknown) => void) | undefined;
let currentRunId = '', reported = false;
let started = false;
let acknowledgeGuide: ((message:any)=>void)|undefined;
let applySettlement: ((receipt: any) => void) | undefined;
let receiveReviveAd: ((message: any) => void) | undefined;
let revealLaunch: (()=>void)|undefined;

function fail(error: unknown) {
  if (lifetime.disposed) return;
  const message = error instanceof Error ? error.message : String(error);
  console.error('[replica-battle] 战斗初始化失败', error);
  send('error', { message });
  const loading = document.querySelector('#loading');
  if (loading) loading.textContent = message;
}

function localAssetUrls(node: unknown): void {
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'string' && /^\/?assets\//.test(value)) {
      (node as Record<string, unknown>)[key] = new URL(value.replace(/^\//, ''), location.href).href;
    } else if (value && typeof value === 'object') localAssetUrls(value);
  }
}

async function initialize(appearance: any) {
  memoryCheckpoint('battle-load-start');
  const [content, catalog] = await Promise.all([loadContent(), loadLoadoutCatalog(), document.fonts.load('16px DankeUI')]);
  if (lifetime.disposed) return;
  if (!requestedChapter || Number(content.chapter.chapter.id) !== requestedChapter.id) throw new Error('关卡与出击请求不一致');
  // This host uses project map artwork. Adapt only the display name so the
  // ready screen and result UI agree with the selected terrain and lobby.
  const chapterPresentation=chapterPresentationForStage(requestedChapter.stageIndex);
  content.chapter.chapter.name=chapterPresentation.name;
  for (const row of content.chapter.catalog) {
    const chapter = replicaChapter(Number(row.id));
    if (chapter) row.name = chapterPresentationForStage(chapter.stageIndex).name;
  }
  document.title=`彼方之遥 · ${chapterPresentation.chapterName}`;
  installEnemyFireEffects(content);
  localAssetUrls(content);
  memoryCheckpoint('battle-data-ready');
  // Default state only prepares the renderer. A validated native configuration
  // must replace it before the first tick of every actual sortie.
  let prepared: ReturnType<typeof prepareReplicaLoadout> | undefined;
  let activeEntry: ReturnType<typeof prepareReplicaLoadout>['entry'] | undefined;
  const entryLoadout = createDefaultStudyLoadoutState();
  let studyLoadout: ReturnType<typeof import('./kernel/loadout').mountStudyLoadout> | undefined;
  let researchStart: (() => void) | undefined;
  const sim = new Simulation(content);
  const movementGuide=createMovementGuide(stage);lifetime.add(()=>movementGuide.destroy());
  let waitingForMovement=false,guideRetryAt=0;
  const pendingGuides=new Set<number>();
  acknowledgeGuide=message=>{if(message.runId===currentRunId)pendingGuides.delete(message.group);};
  const flushGuides=()=>{if(performance.now()<guideRetryAt||!currentRunId||reported)return;guideRetryAt=performance.now()+800;for(const group of pendingGuides)send('onboarding',{runId:currentRunId,group});};
  sim.rewardedReviveEnabled = !researchMode;
  let reviveRequestSerial = 0, pendingReviveRequest = 0;
  applyStudyLoadout(content, sim, catalog, entryLoadout);
  const music = pathogenicBattleMusic(content.chapter.chapter.id, content.assets.audio, content.chapter.musicKey, content.assets.soundKeys?.[100006]);
  const audio = new GameAudio({ ...content.assets.audio, ...pathogenicAudioManifest, ...music });
  lifetime.add(() => disposeNativeAudio(audio));
  let controls: Controls, ui: Interface, accumulated = 0, lastPhase = '';
  let activity: ReturnType<typeof createBattleActivity> | undefined;
  const graphics = createBattleGraphics({signal:lifetime.signal,onChange:()=>{activity?.enforce();ui?.update();}});
  lifetime.add(() => graphics.destroy());
  const skin = await createAppearance(content, appearance, fail, graphics.watch);
  lifetime.add(() => skin.dispose());
  const launch=createBattleLaunch({
    stage,player:()=>sim.player,bounds:()=>sim.cameraWorldBounds,
    reducedMotion:()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    clearInput:()=>{controls?.clear();accumulated=0;sim.playerMotion={x:0,z:0,rawX:0};},
    onVisual:value=>skin.setLaunchPresentation(value),
    onComplete:()=>{audio.resume();ui.update();send('control-ready',{runId:currentRunId});},
  });
  revealLaunch=()=>launch.reveal();
  lifetime.add(()=>{revealLaunch=undefined;launch.destroy();});
  if (!lifetime.disposed) memoryCheckpoint('battle-skin-ready');
  if (lifetime.disposed) return;
  const syncWeaponSkins = () => skin.setWeapons?.(readWeaponAppearances(sim));
  syncWeaponSkins();
  const weaponIcon = (familyId: number, _star: number, choice?: Choice, preview = false) => {
    const identity = choice ? previewWeaponAppearance(sim, choice, preview)
      : readWeaponAppearances(sim).find(row => row.familyId === familyId);
    return identity ? skin.weaponIcon?.(identity) : undefined;
  };
  const scene = new BattleView(projectExperienceContent(content), sim, () => {
    installSafeTouchCancel(scene.game.input);
    graphics.watch(scene.game.canvas, (scene.game.renderer as import('phaser').Renderer.WebGL.WebGLRenderer).gl);
    memoryCheckpoint('battle-textures-ready');
    ui.update(); studyLoadout?.update(); send(researchMode ? 'research-ready' : 'ready');
  }, skin);
  const requestStart = () => researchMode ? researchStart?.() : send('retry');
  ui = new Interface(document.getElementById('ui')!, sim, audio, createProjectInterfaceSprites(content.assets.sprites), requestStart, () => {
    audio.pause();
    if (researchMode) { sim.reset(); studyLoadout?.update(); }
    else {
      const result=currentRunId&&!reported ? battleResult(sim.phase!=='won'&&sim.phase!=='lost') : undefined;
      if(result){reported=true;sim.pause();controls?.clear();}
      send('home',result?{result}:{});
    }
  }, weaponIcon, researchMode);
  lifetime.add(() => disposeNativeUi(ui));
  if (!researchMode) {
    const requestReviveAd = () => {
      if (!currentRunId || reported || !sim.beginReviveAd()) return;
      controls?.clear(); audio.pause();
      pendingReviveRequest = ++reviveRequestSerial;
      send('revive-ad', {runId:currentRunId, requestId:pendingReviveRequest});
      ui.update();
    };
    receiveReviveAd = message => {
      if (message.runId !== currentRunId || message.requestId !== pendingReviveRequest || !pendingReviveRequest || reported) return;
      pendingReviveRequest = 0;
      const revived = sim.completeReviveAd(message.completed === true);
      if (revived) { accumulated = 0; controls?.clear(); audio.resume(); }
      else if (message.message) {
        const notice = document.getElementById('battle-notice')!;
        notice.textContent = message.message; notice.hidden = false;
        setTimeout(() => { notice.hidden = true; }, 3500);
      }
      ui.update(); reportPhase();
    };
    const cloud = await mountCloudCombat({stage,ui,sim,audio,signal:lifetime.signal,requestReviveAd,onGraphicsContext:graphics.watch});
    applySettlement=receipt=>cloud.setSettlement(receipt);
    lifetime.add(() => {applySettlement=undefined;receiveReviveAd=undefined;cloud.destroy();});
    if (!lifetime.disposed) memoryCheckpoint('battle-ui-ready');
    if (lifetime.disposed) return;
  }
  const developerSkills = mountDeveloperSkills(stage, sim, audio, ui);
  lifetime.add(() => developerSkills.destroy());
  const configureDeveloperSkills = () => { sim.developerSkillCatalog = developerSkillsEnabled() ? buildDeveloperSkillCatalog(content, catalog) : []; };
  controls = new Controls(stage, () => !launch.active && sim.phase === 'playing' && sim.player.hp > 0, () => {if(!launch.active)ui.togglePause();});
  lifetime.add(() => controls.clear());
  activity = createBattleActivity({
    allowParentFocus: !researchMode, signal: lifetime.signal,
    suspend: () => { if(!launch.active)sim.pause(); controls.clear(); audio.pause(); },
    refresh: () => ui.update(), blocked: graphics.blocked,
  });
  const updateUi = ui.update.bind(ui);
  ui.update = () => { activity!.enforce(); updateUi(); };
  lifetime.add(() => activity!.destroy());
  if (researchMode) {
    // Same original study state/calculator; never reads the host's formal save.
    const { mountStudyLoadout } = await import('./kernel/loadout');
    if (lifetime.disposed) return;
    researchStart = () => {
      applyStudyLoadout(content, sim, catalog, loadStudyLoadoutState(catalog));
      configureDeveloperSkills();
      accumulated = 0; controls.clear(); audio.unlock().catch(() => {}); sim.start(); syncWeaponSkins();
      audio.startMusic(content.chapter.musicKey); audio.restart(); ui.update(); studyLoadout?.update();
    };
    studyLoadout = mountStudyLoadout({ content, sim, onStart: researchStart });
    stage.removeAttribute('data-awaiting-start');
  }
  configureRun = (requestId, configuration, configurationKey) => {
    if (researchMode) throw new Error('研究模式不接受正式出击配置');
    if (currentRunId && !reported) throw new Error('当前战斗尚未结算');
    prepared = undefined;
    // A still-open old lobby must not silently wait on a newer iframe contract.
    if (typeof configurationKey !== 'string') throw new Error('大厅版本已更新，请刷新页面后重新出击');
    const candidate = prepareReplicaLoadout(catalog, configuration);
    if (candidate.key !== configurationKey) throw new Error('大厅与战斗配置版本不一致，请刷新页面后重新出击');
    prepared = candidate;
    send('configured', { requestId, configurationKey: prepared.key, entry: prepared.entry });
  };
  startRun = (runId, configurationKey, onboarding={}, defeatCount=0) => {
    if (researchMode) throw new Error('研究模式不接受正式出击指令');
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
    audio.startMusic(content.chapter.musicKey); audio.restart(); ui.update();
    stage.removeAttribute('data-awaiting-start');
    document.getElementById('battle-notice')!.hidden = true;
    send('started', { runId, configurationKey });
  };
  const sounds: Record<number, string> = { 260002: 'deng~', 260003: 'battle_restore', 300002: 'FireShoot', 230003: 'Bullet_Laser', 330001: 'Hitted_Plane', 330004: 'Hitted_Plane', 330003: 'Hitted_Plane', 330006: 'Death_Plane_Short', 330007: 'Death_jingying', 330008: 'Death_jingying', 210001: 'Death_plane_long', 410001: 'Out_LevelUp_Show' };
  function battleResult(quit=false) {
    return {
      runId:currentRunId,won:!quit&&sim.phase==='won',abandoned:false,
      endReason:quit?'quit':sim.phase==='won'?'victory':'defeat',
      chapterId:requestedChapter!.id,gold:sim.gold,kills:sim.kills,level:sim.level,
      wave:sim.wave,clock:sim.clock,damageDealt:sim.damageDealt,
      hp:sim.player.hp,maxHp:sim.player.maxHp,revivesUsed:sim.revivesUsed,adRevivesUsed:sim.adRevivesUsed,
      damageByWeapon:Array.from(sim.damageByWeapon),entry:activeEntry,
    };
  }
  const checkpoint = installBattleCheckpoint(() => currentRunId ? battleResult(sim.phase !== 'won' && sim.phase !== 'lost') : null);
  lifetime.add(() => checkpoint.freeze());
  const reportPhase = () => {
    if (sim.phase !== lastPhase) { lastPhase = sim.phase; send('phase', { phase: lastPhase }); }
    if (!researchMode && !reported && currentRunId && (sim.phase === 'won' || sim.phase === 'lost')) {
      reported = true;
      send('result', {result:battleResult()});
    }
  };
  // Kept verbatim in cadence/order from kernel/main.ts: wall clock 1/30,
  // native Q16 delta 0x888, then sound/music delivery and original UI.
  const logicStep = 1 / nativeLogicRate;
  const nativeDelta = nativeLogicDelta;
  scene.onFrame = delta => {
    if (lifetime.disposed) return;
    if (!activity!.enforce()) { accumulated = 0; return; }
    delta = activity!.frameDelta(delta);
    if(launch.active){
      accumulated=0;controls.clear();movementGuide.show(false);
      launch.update(delta/1000);ui.update();return;
    }
    if(sim.tutorialChoiceCompleted){pendingGuides.add(4);sim.tutorialChoiceCompleted=false;guideRetryAt=0;}
    flushGuides();movementGuide.show(waitingForMovement&&sim.phase==='playing');
    if (sim.phase !== 'playing') {
      audio.syncContinuous([]); audio.syncCharges([]);
      if (!document.hidden) sim.advanceRevivePrompt(Math.max(0, delta / 1000));
      accumulated = 0; controls.clear(); sim.advanceResultPresentation(Math.min(delta / 1000, .1)); syncWeaponSkins(); ui.update(); studyLoadout?.update(); reportPhase(); return;
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
    audio.syncContinuous(activeCombatSounds(sim.projectiles, sim.phase === 'playing' && sim.player.hp > 0, sim.enemies));
    audio.syncCharges(sim.activeEnemyCharges());
    syncWeaponSkins(); ui.update(); studyLoadout?.update(); reportPhase();
  };
  stage.addEventListener('pointerdown', () => { audio.unlock().catch(() => {}); }, { passive: true, signal:lifetime.signal });
  const game = makeGame(scene);
  lifetime.add(() => { scene.onFrame = undefined; disposeNativeGame(game); });
}

window.addEventListener('message', event => {
  if (lifetime.disposed || event.origin !== location.origin || event.source !== parent) return;
  const message = event.data;
  if (message?.channel !== CHANNEL || message.session !== session) return;
  if (message.type === 'initialize' && !started) { started = true; initialize(message.appearance).catch(fail); }
  try {
    if (message.type === 'launch-visible' && message.runId === currentRunId) revealLaunch?.();
    if (message.type === 'settled' && message.runId === currentRunId) applySettlement?.(message);
    if (message.type === 'revive-ad-result') receiveReviveAd?.(message);
    if (message.type === 'onboarding-saved') acknowledgeGuide?.(message);
    if (message.type === 'configure' && Number.isSafeInteger(message.requestId)) {
      if (!configureRun) throw new Error('战斗资源尚未准备完成');
      configureRun(message.requestId, message.configuration, message.configurationKey);
    }
    if (message.type === 'start' && typeof message.runId === 'string' && typeof message.configurationKey === 'string') {
      if (!startRun) throw new Error('战斗资源尚未准备完成');
      if (!requestedChapter || message.chapterId !== requestedChapter.id) throw new Error('开始指令的关卡不一致');
      startRun(message.runId, message.configurationKey, message.onboarding, message.defeatCount);
    }
  } catch (error) { fail(error); }
  if (message.type === 'notice') {
    const notice = document.getElementById('battle-notice')!; notice.textContent = message.message; notice.hidden = false;
    setTimeout(() => { notice.hidden = true; }, 3500);
  }
}, {signal:lifetime.signal});
window.addEventListener('error', event => fail(event.error || event.message), {signal:lifetime.signal});
window.addEventListener('unhandledrejection', event => fail(event.reason), {signal:lifetime.signal});
if (parent !== window && session) send('boot', {chapterId:requestedChapter?.id});
else document.querySelector('#loading')!.textContent = '请从少女航线关卡入口出击';
