import {equipmentArtPath} from './equipment-art.js';
import { recordDiagnostic } from '../diagnostic-log.js';
import {battleOnboarding} from '../peripheral/onboarding.js';
import { replicaChapter } from './chapter-contract.js';
import { chapterPresentationForStage } from './chapter-presentation.js';
import { replicaConfigurationKey } from './loadout-contract.js';
import { AIRCRAFTS } from '../pilots.js';
import { portraitPresentation } from '../ui/character-portraits.js';

import nativeBattleRules from './native-battle-rules.json' with { type: 'json' };

const CHANNEL = 'shnh-replica-battle-v1';
const ENGINE = 'danke-replica-v1';
const PREPARATION_LIMIT_MS = 120000;
const PREPARATION_IDLE_MS = 60000;
const LOADING_PHASES = Object.freeze({
  data: [.03,.28,'正在读取关卡…'],
  appearance: [.28,.62,'正在加载飞机与地图…'],
  interface: [.62,.68,'正在准备战斗界面…'],
  textures: [.68,.95,'正在加载战斗贴图…'],
});
const preparationStages = {
  code: '战斗模块', data: '关卡数据', appearance: '飞机与地图', interface: '战斗界面',
  textures: '战斗贴图', configure: '战前配置', frame: '战斗首帧',
};

// Appearance is separate from native progression IDs. Never forward legacy
// statModifiers, fixed-parts builds, difficulty multipliers or passive formulas.
export function appearanceOf(snapshot, chapter, baseURL) {
  const aircraft = AIRCRAFTS.find(row => row.id === snapshot.aircraftId) || AIRCRAFTS[0];
  const pilot = portraitPresentation(snapshot.pilots?.find(row => row.id === snapshot.pilotId)
    || AIRCRAFTS.find(row => row.id === snapshot.pilotId) || AIRCRAFTS[0]);
  const absolute = path => path ? new URL(path, baseURL).href : '';
  return {
    aircraft: { id: aircraft.id, name: aircraft.aircraft, image: absolute(aircraft.airframe.image) },
    pilot: { id: pilot.id, name: pilot.name, image: absolute(pilot.image) },
    equipment: (snapshot.equipment?.items || []).filter(row => row.equipped).map(row => ({
      id: row.id, type: row.type, name: row.name, image: absolute(row.image || equipmentArtPath(row.art)),
    })),
    assetBase: absolute('./'),
    map: { id: chapterPresentationForStage(chapter.stageIndex).mapSceneId, terrain: chapter.terrain },
  };
}

export function createSortieController({peripheral,onEnter,onLeave,onProgress,onState,onError,requestReviveAd,screen,showSortieLoading,host}) {
  let active = null;
  function send(session,type,payload={}){
    const message={channel:CHANNEL,session:session.id,type,...payload};
    if(session.controller)session.controller.receive(message);
    else session.queued.push(message);
  }
  function checkpoint(session){return session.controller?.checkpoint?.()??session.lastCheckpoint??null;}
  function stop(session){
    session.generation++;
    const controller=session.controller;
    session.controller=null;
    if(controller){
      try{controller.dispose();}
      finally{session.lastCheckpoint=controller.checkpoint?.()??session.lastCheckpoint;}
    }
  }
  async function load(session){
    const generation=++session.generation;
    const deliver=message=>Promise.resolve().then(()=>{
      if(active===session&&generation===session.generation)session.receiveMessage(message);
    });
    try{
      const controller=await session.surface.mount({id:session.id,chapterId:session.chapter.id,emit:deliver});
      if(active!==session||generation!==session.generation){controller.dispose();return;}
      session.controller=controller;
      for(const message of session.queued.splice(0))controller.receive(message);
    }catch(error){
      if(active===session&&generation===session.generation)deliver({channel:CHANNEL,session:session.id,type:'error',message:error.message});
    }
  }

  function close(session) {
    if (active !== session) return;
    clearTimeout(session.timer);session.removeListeners?.();
    session.loading?.close({restoreFocus:false});
    try{stop(session);}
    finally{
      session.surface.close();active=null;
      host.setLaunching(false);onLeave();session.resolve?.(false);session.surface.restoreFocus?.();
    }
  }


  function settle(session, result) {
    if (!session.run || session.settled) return;
    if (result.runId !== session.run.snapshot.id) return;
    if (result.chapterId !== session.chapter.id) throw new Error('结算关卡与当前战斗不一致');
    session.lastResult = result;
    const receipt = peripheral().recordSortie({
      ...result, engine: ENGINE, stageIndex: session.chapter.stageIndex, debugRun: session.trial,
    });
    if (!receipt.ok) {
      recordDiagnostic('结算保存失败', receipt.message);
      throw new Error(receipt.message || '战斗结算尚未保存');
    }
    const outcome = result.endReason === 'quit' || result.abandoned ? '退出' : result.won ? '通关' : '战败';
    recordDiagnostic('结算已保存', `第 ${session.chapter.id} 章 · ${outcome}`);
    session.settled = true;
    send(session, 'settled', {runId:result.runId,rewards:receipt.rewards,trial:receipt.replica.trial,
      pilotAffection:receipt.replica.pilotAffection});
    if (!session.trial && !receipt.replica.abandoned) onProgress(receipt.replica);
  }

  async function reviveAd(session, message) {
    if (active !== session || !session.run || session.settled || session.phase !== 'revive'
      || message.runId !== session.run.snapshot.id || !Number.isSafeInteger(message.requestId)
      || message.requestId <= (session.lastReviveRequest || 0) || session.reviveAdPending) return;
    session.lastReviveRequest=message.requestId; session.reviveAdPending=true;
    const runId=message.runId, requestId=message.requestId;
    let completed=false, failure='';
    try {
      if(session.reviveAdUsed>=nativeBattleRules.adRevives)throw new Error('本局广告复活次数已用完');
      if(typeof requestReviveAd!=='function')throw new Error('广告服务暂未就绪，请稍后再试');
      await requestReviveAd();
      if(active!==session||session.run?.snapshot.id!==runId||session.settled||session.phase!=='revive')return;
      session.reviveAdUsed++;completed=true;
    } catch(error) { failure=error instanceof Error?error.message:'广告未完成，请重试'; }
    finally { session.reviveAdPending=false; }
    if(active===session&&session.run?.snapshot.id===runId&&!session.settled)
      send(session,'revive-ad-result',{runId,requestId,completed,message:failure});
  }

  function reviveDiamond(session, message) {
    if (active !== session || !session.run || session.settled || session.phase !== 'revive'
      || message.runId !== session.run.snapshot.id || !Number.isSafeInteger(message.requestId)
      || message.requestId <= (session.lastDiamondRequest || 0) || session.reviveAdPending) return;
    session.lastDiamondRequest = message.requestId;
    const receipt = peripheral().action('battleRevivePurchase', {runId:message.runId});
    send(session, 'revive-diamond-result', {runId:message.runId, requestId:message.requestId,
      completed:Boolean(receipt.ok), message:receipt.message || ''});
  }

  function configurationFor(session) {
    return session.retrying && session.run
      ? session.run.snapshot.replicaConfiguration : peripheral().replicaConfiguration();
  }

  function requestConfiguration(session) {
    if (active !== session || session.preparationFailed || session.pendingConfiguration || (session.run && !session.settled && !session.retrying)) return;
    session.startAcknowledged = false;
    session.armPreparation('configure');
    const configuration = configurationFor(session);
    const requestId = ++session.configurationSerial;
    session.pendingConfiguration = { requestId, configuration, key: replicaConfigurationKey(configuration) };
    send(session, 'configure', { requestId, configuration, configurationKey: session.pendingConfiguration.key });
  }

  function launch(session, candidate) {
    if (active !== session || (session.run && !session.settled && !session.retrying)) return;
    if (host.hidden()) { session.pendingLaunch = candidate; return true; }
    // Retrying preparation must not charge stamina or create a second run.
    const prepared = session.retrying && session.run ? session.run : peripheral().prepareSortie({ trial: session.trial, engine: ENGINE,
      chapterId: session.chapter.id, replicaConfiguration: candidate.configuration });
    if (!prepared.ok) { onError(prepared.message); send(session, 'notice', { message: prepared.message }); return false; }
    session.pendingLaunch = null;
    session.run = prepared; session.settled = false; session.lastResult = null; session.startAcknowledged = false; session.retrying = false;
    session.reviveAdUsed = 0; session.reviveAdPending = false; session.phase = 'ready';
    session.entry = candidate.entry;
    // Hand focus to the embedded game before it starts its simulation.
    // Do not steal focus if loading completed while the user was away.
    session.surface.focus?.();
    session.onboarding=battleOnboarding(peripheral().snapshot(),session.chapter.id,session.trial);
    send(session, 'start', { runId: prepared.snapshot.id, chapterId: session.chapter.id, configurationKey: candidate.key, defeatCount:prepared.snapshot.nativeDefeatCount, onboarding:session.onboarding });
    return true;
  }

  async function start({ trial = false, chapterId = 1 } = {}) {
    if (active) return false;
    const chapter = replicaChapter(chapterId);
    if (!chapter) { onError('关卡暂不可用'); return false; }
    const chapterLabel = chapterPresentationForStage(chapter.stageIndex).chapterName;
    const snapshot = peripheral()?.snapshot();
    if (!snapshot) return false;
    const appearance = appearanceOf(snapshot, chapter, host.baseURL);
    const aircraft = appearance.aircraft;
    const loadingOptions = {
      screen,
      stageName: chapterLabel,
      aircraftId: aircraft.id,
      resourceCount: 1,
      indeterminate: true,
    };
    const id=host.makeSessionId(),surface=host.createSurface(chapterLabel);
    const session = { id, surface, generation:0, controller:null, queued:[], loading:null, trial, chapter, run:null, settled:false,
      lastCheckpoint:null, abandon:null, timer:null, removeListeners:null,
      configurationSerial:0, pendingConfiguration:null, entry:null, leavePage:null, resumePage:null,
      preparationFailed:false, startAcknowledged:false, retrying:false, armPreparation:null };
    active = session;
    session.abandon = () => {
      if (session.run && !session.settled) {
        const saved = !session.lastResult && checkpoint(session);
        const current = saved?.runId === session.run.snapshot.id && saved.chapterId === session.chapter.id ? saved : null;
        settle(session, session.lastResult || current || {
          runId: session.run.snapshot.id, won: false, abandoned: true, gold: 0, entry: session.entry, chapterId: session.chapter.id,
        });
      }
    };
    const dismissLoading = () => {
      // The loading view closes itself before invoking this callback. A failed
      // retry needs a new usable view, not fail() on the already-closed one.
      session.loading = null;
      try { session.abandon(); close(session); }
      catch (error) { onError(error.message); failLoading(); }
    };
    const retryPreparation = () => {
      if(active!==session || !session.preparationFailed || session.startAcknowledged || session.settled)return;
      session.preparationFailed=false;session.retrying=Boolean(session.run);
      session.pendingConfiguration=null;session.pendingLaunch=null;
      // A fresh message identity rejects late events from the disposed iframe.
      session.id=host.makeSessionId();
      session.loading=showSortieLoading({...loadingOptions,onDismiss:dismissLoading});
      session.armPreparation();stop(session);session.queued.length=0;void load(session);
    };
    const failLoading = message => {
      recordDiagnostic(session.startAcknowledged ? '战斗异常' : '出击准备失败', `第 ${chapter.id} 章 · ${message}`);
      session.loading ||= showSortieLoading({...loadingOptions,onDismiss:dismissLoading});
      session.loading.fail({message,onRetry:!session.startAcknowledged&&!session.settled?retryPreparation:undefined});
    };
    const failPreparation = message => {
      session.preparationFailed = true; session.pendingConfiguration = null; session.pendingLaunch = null;
      clearTimeout(session.timer); session.timer = null;
      // Stop a partially started or reloaded child. Returning uses the host's
      // durable result/abandon path; a late acknowledgement cannot resurrect it.
      stop(session);
      failLoading(message);
      session.resolve?.(false);
    };
    let preparationRemaining, idleRemaining, preparationStartedAt = 0;
    let preparationStage, preparationProgress, stageProgress;
    const pausePreparation = () => {
      if (session.timer === null) return;
      clearTimeout(session.timer); session.timer = null;
      const elapsed = host.now() - preparationStartedAt;
      preparationRemaining = Math.max(0, preparationRemaining - elapsed);
      idleRemaining = Math.max(0, idleRemaining - elapsed);
    };
    const resumePreparation = () => {
      if (active !== session || host.hidden() || session.preparationFailed || session.startAcknowledged || session.timer !== null) return;
      preparationStartedAt = host.now();
      session.timer = setTimeout(() => {
        if (active !== session) return;
        if (host.hidden()) { pausePreparation(); return; }
        const awaiting = session.run && !session.settled ? 'started' : session.pendingConfiguration ? 'configured' : 'ready';
        const percent = Math.round(stageProgress * 100);
        console.error('[replica-battle] 出击准备超时', { chapterId: chapter.id, awaiting, phase: preparationStage, percent });
        failPreparation(`关卡准备超时（${preparationStages[preparationStage]} ${percent}%），请重试`);
      }, Math.min(preparationRemaining, idleRemaining));
    };
    session.armPreparation = (stage = 'code') => {
      clearTimeout(session.timer); session.timer = null;
      preparationRemaining = PREPARATION_LIMIT_MS;
      idleRemaining = PREPARATION_IDLE_MS;
      preparationStage = stage;
      preparationProgress = stageProgress = 0;
      resumePreparation();
    };
    const advancePreparation = (value, stage, fraction, label) => {
      if (value < preparationProgress) return;
      preparationStage = stage;
      stageProgress = fraction;
      session.loading?.update(value, label);
      // Only new work extends the idle deadline. Duplicate notifications
      // do not keep a stalled loader alive, and the total budget still applies.
      if (value === preparationProgress) return;
      preparationProgress = value;
      pausePreparation();
      idleRemaining = PREPARATION_IDLE_MS;
      resumePreparation();
    };
    session.checkpoint = () => {
      if(active!==session || !session.run || session.settled || session.trial)return;
      const result=checkpoint(session);
      if(result?.runId!==session.run.snapshot.id || result.chapterId!==session.chapter.id)return;
      const store=peripheral();
      if(typeof store.checkpointSortie==='function' && !store.checkpointSortie(result))onError('当前战斗进度待保存，请保留页面后重试');
    };
    session.visibility = () => {
      if (active !== session) return;
      if (host.hidden()) { pausePreparation(); session.checkpoint(); return; }
      try {
        if (session.pendingLaunch && !session.preparationFailed && !launch(session, session.pendingLaunch)) { close(session); return; }
        resumePreparation();
      } catch (error) { onError(error.message); failPreparation(error.message); }
    };
    // beforeunload can be cancelled. Only commit an interrupted sortie once
    // departure is certain; otherwise its later real result would be ignored.
    session.leavePage = () => {
      if (active !== session) return;
      clearTimeout(session.timer);
      try { session.abandon(); close(session); }
      catch (error) { onError(error.message); failLoading(); }
    };
    // pagehide disposes the child game even when the browser caches the page.
    // Keep a failed receipt available and retry it when that page is restored.
    session.resumePage = event => { if (event.persisted) session.leavePage(); };
    // Release the sortie button before its lobby ancestor becomes aria-hidden.
    surface.releaseLobbyFocus?.();
    recordDiagnostic('开始出击', `第 ${chapter.id} 章${trial ? ' · 试打' : ''}`);
    onEnter();surface.show();
    session.loading=showSortieLoading({...loadingOptions,onDismiss:dismissLoading});
    const started = new Promise(resolve => {
      session.resolve = resolve;
      session.receiveMessage = message => {
        if(active!==session)return;
        if (message?.channel !== CHANNEL || message.session !== session.id) return;
        if (session.preparationFailed && ['boot','loading-progress','ready','configured','started','retry','phase','revive-ad'].includes(message.type)) return;
        try {
          switch (message.type) {
            case 'boot':
              if (session.run && !session.retrying) throw new Error('战斗页面已重新载入，请重试');
              advancePreparation(.03,'data',0,'正在读取关卡…');
              send(session, 'initialize', {appearance, initialConfiguration:configurationFor(session)}); break;
            case 'loading-progress': {
              if(session.startAcknowledged||(session.run&&!session.retrying)||!Object.hasOwn(LOADING_PHASES,message.phase)||!Number.isFinite(message.progress))break;
              const [from,to,label]=LOADING_PHASES[message.phase];
              const fraction = Math.min(1, Math.max(0, message.progress));
              advancePreparation(from + (to - from) * fraction, message.phase, fraction, label);
              break;
            }
            case 'ready':
              if (session.run && !session.retrying) throw new Error('战斗页面已重新载入，请重试');
              session.loading?.update(.96,'正在准备战场…'); requestConfiguration(session); break;
            case 'configured': {
              const candidate = session.pendingConfiguration;
              if (!candidate || message.requestId !== candidate.requestId) break;
              if (message.configurationKey !== candidate.key) throw new Error('大厅与战斗配置版本不一致，请刷新页面后重新出击');
              session.pendingConfiguration = null;
              advancePreparation(.98,'frame',0,'正在准备出击…');
              // The lift is decorative and stays live until the battle has
              // rendered. The existing preparation timeout covers this gap.
              if(!launch(session,{...candidate,entry:message.entry})){close(session);resolve(false);}
              break;
            }
            case 'started':
              if (message.runId !== session.run?.snapshot.id) break;
              if (message.configurationKey !== replicaConfigurationKey(session.run.snapshot.replicaConfiguration))
                throw new Error('战斗启动配置不一致，请刷新页面后重新出击');
              clearTimeout(session.timer); session.timer = null; session.startAcknowledged = true;
              session.loading?.update(1,'准备完成');
              host.setLaunching(true);
              const covering=session.loading;session.loading=null;
              void Promise.resolve(covering?.close({restoreFocus:false,keepMotion:true})).then(()=>{
                if(active===session&&!session.preparationFailed)send(session,'launch-visible',{runId:session.run.snapshot.id});
              });
              recordDiagnostic('战斗已启动', `第 ${chapter.id} 章`);
              onState('playing'); resolve(true); break;
            case 'control-ready':
              if(message.runId===session.run?.snapshot.id){
                host.setLaunching(false);
                recordDiagnostic('战斗操作就绪', `第 ${chapter.id} 章`);
              }
              break;
            case 'onboarding': {
              const group=message.group;
              if(session.settled||session.trial||message.runId!==session.run?.snapshot.id||![1,4].includes(group))break;
              if(group===1?!session.onboarding?.movement:!session.onboarding?.firstChoice)break;
              if(peripheral().completeBattleGuide(message.runId,group))send(session,'onboarding-saved',{runId:message.runId,group});
              break;
            }
            case 'phase': session.phase=message.phase; onState(message.phase); break;
            case 'revive-ad': void reviveAd(session,message); break;
            case 'revive-diamond': reviveDiamond(session,message); break;
            case 'result': settle(session, message.result); break;
            case 'retry':
              if (!session.settled && session.lastResult) settle(session, session.lastResult);
              if (session.settled) requestConfiguration(session);
              break;
            case 'home':
              // Explicit quit carries the current earned balance. A missing
              // result (loading cancellation/crash) still uses abandon().
              if(message.result) settle(session,message.result);
              session.abandon(); close(session); resolve(false); break;
            case 'error': session.pendingConfiguration = null; throw new Error(message.message || chapterLabel + '资源加载失败');
          }
        } catch (error) {
          clearTimeout(session.timer);
          console.error('[replica-battle] 出击准备失败', error);
          onError(error.message);
          if (!session.startAcknowledged || ['boot','ready','error'].includes(message.type)) failPreparation(error.message);
          else failLoading(error.message);
          resolve(false);
        }
      };
      session.armPreparation();
    });
    session.removeListeners=host.bind({visibility:session.visibility,checkpoint:session.checkpoint,
      leave:session.leavePage,resume:session.resumePage});
    void load(session);
    return started;
  }

  return { start, leavePage() { active?.leavePage(); },
    dispose() { if(active)close(active); },
    get active() { return Boolean(active); } };
}
