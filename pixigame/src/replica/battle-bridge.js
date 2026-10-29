import {captureBattleCheckpoint} from './battle-checkpoint.js';
import {battleOnboarding} from '../peripheral/onboarding.js';
import { replicaChapter } from './chapter-contract.js';
import { chapterPresentationForStage } from './chapter-presentation.js';
import './replica-battle.css';
import { showSortieLoading } from '../ui/sortie-loading.js';
import { replicaConfigurationKey } from './loadout-contract.js';
import { AIRCRAFTS } from '../pilots.js';
import { peripheralSceneForStage } from '../three/peripheral-scenes.js';
import { portraitPresentation } from '../ui/character-portraits.js';

import nativeBattleRules from './native-battle-rules.json' with { type: 'json' };

const CHANNEL = 'shnh-replica-battle-v1';
const ENGINE = 'danke-replica-v1';

// Appearance is separate from native progression IDs. Never forward legacy
// statModifiers, fixed-parts builds, difficulty multipliers or passive formulas.
export function appearanceOf(snapshot, chapter) {
  const aircraft = AIRCRAFTS.find(row => row.id === snapshot.aircraftId) || AIRCRAFTS[0];
  const pilot = portraitPresentation(snapshot.pilots?.find(row => row.id === snapshot.pilotId)
    || AIRCRAFTS.find(row => row.id === snapshot.pilotId) || AIRCRAFTS[0]);
  const absolute = path => path ? new URL(path, document.baseURI).href : '';
  return {
    aircraft: { id: aircraft.id, name: aircraft.aircraft, image: absolute(aircraft.airframe.image) },
    pilot: { id: pilot.id, name: pilot.name, image: absolute(pilot.image) },
    equipment: (snapshot.equipment?.items || []).filter(row => row.equipped).map(row => ({
      id: row.id, type: row.type, name: row.name, image: absolute(row.image || `art/project-flight-gear-v1/${row.art}.webp`),
    })),
    assetBase: absolute('./'),
    map: { id: peripheralSceneForStage(chapter.stageIndex).id, terrain: chapter.terrain },
  };
}

export function createReplicaBattleBridge({ peripheral, onEnter, onLeave, onProgress, onState, onError, requestReviveAd }) {
  let active = null;
  const send = (session, type, payload = {}) => session.frame.contentWindow?.postMessage({
    channel: CHANNEL, session: session.id, type, ...payload,
  }, location.origin);

  function close(session) {
    if (active !== session) return;
    clearTimeout(session.timer);
    document.removeEventListener('visibilitychange', session.visibility);
    document.removeEventListener('freeze', session.checkpoint);
    session.loading?.close({restoreFocus:false});
    window.removeEventListener('message', session.receive);
    window.removeEventListener('pagehide', session.leavePage);
    window.removeEventListener('pageshow', session.resumePage);
    // Synchronous, same-origin teardown before detaching the browsing context.
    // pagehide alone is not a reliable resource lifetime for removed iframes.
    session.frame.contentWindow?.dispatchEvent(new Event('shnh-dispose-replica-battle'));
    session.frame.src = 'about:blank';
    session.host.remove(); active = null;
    document.documentElement.classList.remove('replica-battle-active');
    onLeave(); session.resolve?.(false); session.focus?.focus?.({ preventScroll: true });
  }

  function settle(session, result) {
    if (!session.run || session.settled) return;
    if (result.runId !== session.run.snapshot.id) return;
    if (result.chapterId !== session.chapter.id) throw new Error('结算关卡与当前战斗不一致');
    session.lastResult = result;
    const receipt = peripheral().recordSortie({
      ...result, engine: ENGINE, stageIndex: session.chapter.stageIndex, debugRun: session.trial,
    });
    if (!receipt.ok) throw new Error(receipt.message || '战斗结算尚未保存');
    session.settled = true;
    send(session, 'settled', {runId:result.runId,rewards:receipt.rewards,trial:receipt.replica.trial});
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

  function requestConfiguration(session) {
    if (active !== session || session.preparationFailed || session.pendingConfiguration || (session.run && !session.settled)) return;
    session.startAcknowledged = false;
    session.armPreparation();
    const configuration = peripheral().replicaConfiguration();
    const requestId = ++session.configurationSerial;
    session.pendingConfiguration = { requestId, configuration, key: replicaConfigurationKey(configuration) };
    send(session, 'configure', { requestId, configuration, configurationKey: session.pendingConfiguration.key });
  }

  function launch(session, candidate) {
    if (active !== session || (session.run && !session.settled)) return;
    if (document.hidden) { session.pendingLaunch = candidate; return true; }
    const prepared = peripheral().prepareSortie({ trial: session.trial, engine: ENGINE,
      chapterId: session.chapter.id, replicaConfiguration: candidate.configuration });
    if (!prepared.ok) { onError(prepared.message); send(session, 'notice', { message: prepared.message }); return false; }
    session.pendingLaunch = null;
    session.run = prepared; session.settled = false; session.lastResult = null; session.startAcknowledged = false;
    session.reviveAdUsed = 0; session.reviveAdPending = false; session.phase = 'ready';
    session.entry = candidate.entry;
    // Hand focus to the embedded game before it starts its simulation.
    // Do not steal focus if loading completed while the user was away.
    if (document.hasFocus()) session.frame.focus({ preventScroll: true });
    session.onboarding=battleOnboarding(peripheral().snapshot(),session.chapter.id,session.trial);
    send(session, 'start', { runId: prepared.snapshot.id, chapterId: session.chapter.id, configurationKey: candidate.key, defeatCount:prepared.snapshot.nativeDefeatCount, onboarding:session.onboarding });
    return true;
  }

  async function start({ trial = false, chapterId = 1 } = {}) {
    if (active) return false;
    const chapter = replicaChapter(chapterId);
    if (!chapter) { onError('该关卡尚未接入复刻内核'); return false; }
    const chapterLabel = chapterPresentationForStage(chapter.stageIndex).chapterName;
    const snapshot = peripheral()?.snapshot();
    if (!snapshot) return false;
    const host = document.createElement('section'); host.className = 'replica-battle-host';
    host.setAttribute('aria-label', chapterLabel + '战斗');
    const frame = document.createElement('iframe');
    const id = Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16).padStart(8, '0')).join('-');
    const url = new URL(`${import.meta.env.BASE_URL}replica-battle/index.html`, document.baseURI);
    url.searchParams.set('chapter', String(chapter.id)); url.searchParams.set('session', id);
    frame.src = url.href; frame.title = '少女航线 · ' + chapterLabel;
    frame.allow = 'autoplay; fullscreen'; frame.className = 'replica-battle-frame';
    host.append(frame);
    const session = { id, host, frame, loading:null, trial, chapter, run: null, settled: false,
      focus: document.activeElement, receive: null, abandon: null, timer: null,
      configurationSerial: 0, pendingConfiguration: null, entry: null, leavePage:null, resumePage:null,
      preparationFailed:false, startAcknowledged:false, armPreparation:null };
    active = session;
    session.abandon = () => {
      if (session.run && !session.settled) {
        const checkpoint = !session.lastResult && captureBattleCheckpoint(session.frame.contentWindow);
        const current = checkpoint?.runId === session.run.snapshot.id && checkpoint.chapterId === session.chapter.id ? checkpoint : null;
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
    const failLoading = () => {
      session.loading ||= showSortieLoading({onDismiss:dismissLoading});
      session.loading.fail();
    };
    const failPreparation = () => {
      session.preparationFailed = true; session.pendingConfiguration = null; session.pendingLaunch = null;
      clearTimeout(session.timer); session.timer = null;
      // Stop a partially started or reloaded child. Returning uses the host's
      // durable result/abandon path; a late acknowledgement cannot resurrect it.
      session.frame.contentWindow?.dispatchEvent(new Event('shnh-dispose-replica-battle'));
      failLoading();
      session.resolve?.(false);
    };
    let preparationRemaining = 60000, preparationStartedAt = 0;
    const pausePreparation = () => {
      if (session.timer === null) return;
      clearTimeout(session.timer); session.timer = null;
      preparationRemaining = Math.max(0, preparationRemaining - (performance.now() - preparationStartedAt));
    };
    const resumePreparation = () => {
      if (active !== session || document.hidden || session.preparationFailed || session.startAcknowledged || session.timer !== null) return;
      preparationStartedAt = performance.now();
      session.timer = setTimeout(() => {
        if (active !== session) return;
        if (document.hidden) { pausePreparation(); return; }
        console.error('[replica-battle] 出击准备超时', { awaiting: session.run && !session.settled ? 'started' : session.pendingConfiguration ? 'configured' : 'ready' });
        failPreparation();
      }, preparationRemaining);
    };
    session.armPreparation = () => {
      clearTimeout(session.timer); session.timer = null; preparationRemaining = 60000;
      resumePreparation();
    };
    session.checkpoint = () => {
      if(active!==session || !session.run || session.settled || session.trial)return;
      const result=captureBattleCheckpoint(session.frame.contentWindow);
      if(result?.runId!==session.run.snapshot.id || result.chapterId!==session.chapter.id)return;
      const store=peripheral();
      if(typeof store.checkpointSortie==='function' && !store.checkpointSortie(result))onError('当前战斗进度待保存，请保留页面后重试');
    };
    document.addEventListener('freeze', session.checkpoint);
    session.visibility = () => {
      if (active !== session) return;
      if (document.hidden) { pausePreparation(); session.checkpoint(); return; }
      try {
        if (session.pendingLaunch && !session.preparationFailed && !launch(session, session.pendingLaunch)) { close(session); return; }
        resumePreparation();
      } catch (error) { onError(error.message); failPreparation(); }
    };
    document.addEventListener('visibilitychange', session.visibility);
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
    if (session.focus instanceof HTMLElement) session.focus.blur();
    onEnter(); document.documentElement.classList.add('replica-battle-active');
    document.body.append(host);
    session.loading=showSortieLoading({onDismiss:dismissLoading});
    const started = new Promise(resolve => {
      session.resolve = resolve;
      session.receive = event => {
        if (active !== session || event.origin !== location.origin || event.source !== frame.contentWindow) return;
        const message = event.data;
        if (message?.channel !== CHANNEL || message.session !== id) return;
        if (session.preparationFailed && ['boot','ready','configured','started','retry','phase','revive-ad'].includes(message.type)) return;
        try {
          switch (message.type) {
            case 'boot':
              if (session.run) throw new Error('战斗页面已重新载入，请返回后重新出击');
              send(session, 'initialize', { appearance: appearanceOf(snapshot, chapter) }); break;
            case 'ready':
              if (session.run) throw new Error('战斗页面已重新载入，请返回后重新出击');
              session.loading?.stage(2); requestConfiguration(session); break;
            case 'configured': {
              const candidate = session.pendingConfiguration;
              if (!candidate || message.requestId !== candidate.requestId) break;
              if (message.configurationKey !== candidate.key) throw new Error('大厅与战斗配置版本不一致，请刷新页面后重新出击');
              session.pendingConfiguration = null;
              if (!launch(session, { ...candidate, entry: message.entry })) { close(session); resolve(false); }
              break;
            }
            case 'started':
              if (message.runId !== session.run?.snapshot.id) break;
              if (message.configurationKey !== replicaConfigurationKey(session.run.snapshot.replicaConfiguration))
                throw new Error('战斗启动配置不一致，请刷新页面后重新出击');
              clearTimeout(session.timer); session.timer = null; session.startAcknowledged = true;
              session.loading?.close({restoreFocus:false}); session.loading=null;
              onState('playing'); resolve(true); break;
            case 'onboarding': {
              const group=message.group;
              if(session.settled||session.trial||message.runId!==session.run?.snapshot.id||![1,4].includes(group))break;
              if(group===1?!session.onboarding?.movement:!session.onboarding?.firstChoice)break;
              if(peripheral().completeBattleGuide(message.runId,group))send(session,'onboarding-saved',{runId:message.runId,group});
              break;
            }
            case 'phase': session.phase=message.phase; onState(message.phase); break;
            case 'revive-ad': void reviveAd(session,message); break;
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
          if (!session.startAcknowledged || ['boot','ready','error'].includes(message.type)) failPreparation();
          else failLoading();
          resolve(false);
        }
      };
      session.armPreparation();
    });
    window.addEventListener('message', session.receive);
    window.addEventListener('pagehide', session.leavePage);
    window.addEventListener('pageshow', session.resumePage);
    return started;
  }

  return { start, leavePage() { active?.leavePage(); },
    dispose() { if(active)close(active); },
    get active() { return Boolean(active); } };
}
