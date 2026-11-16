import project from '../../package.json' with { type: 'json' };
import wavePresentation from '../../replica-battle/public/data/wave-presentation.json' with { type: 'json' };
import { loadContent } from '../../replica-battle/kernel/content';
import { loadLoadoutRuntime, loadPlayerAppearances } from '../../replica-battle/kernel/loadout-resources';
import { applyStudyLoadout } from '../../replica-battle/kernel/loadout-state';
import { Simulation } from '../../replica-battle/kernel/simulation';
import { nativeLogicDelta, nativeLogicRate } from '../../replica-battle/kernel/native-time';
import { prepareReplicaLoadout } from '../../replica-battle/prepare-loadout';
import { chapterPresentationForStage } from '../../src/replica/chapter-presentation.js';
import { peripheralSceneForStage } from '../../src/three/peripheral-scenes.js';
import { diagnosticReport, recordDiagnostic } from '../../src/diagnostic-log.js';
import { cloneGameData, createWechatHost } from './platform.js';
import { createView, width, height } from './view.js';
import { createWechatBattleAudio } from './audio.js';

const secondsPerTick = 1 / nativeLogicRate;
const engine = 'danke-replica-v1';

export function startWechatGame(api) {
  const canvas = api.createCanvas();
  const host = createWechatHost(api, __WECHAT_ASSET_ORIGIN__, __WECHAT_PACKAGE_RESOURCES__);
  if (!globalThis.localStorage) globalThis.localStorage = host.storage;
  if (typeof globalThis.structuredClone !== 'function') globalThis.structuredClone = cloneGameData;
  if (!Object.hasOwn) Object.hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const view = createView(canvas, api, host.resolveAsset);
  const audio = createWechatBattleAudio(api, host.resolveAsset, __WECHAT_PACKAGE_RESOURCES__.music);
  const frame = globalThis.requestAnimationFrame ?? canvas.requestAnimationFrame?.bind(canvas);
  const actions = {
    diagnostics() {
      previousMode = mode;
      diagnosticText = diagnosticReport();
      const lines = diagnosticText.split('\n');
      diagnosticPreview = [...lines.slice(0, 3), ...lines.slice(3).slice(-5)].join('\n');
      copyMessage = '';
      mode = 'diagnostics';
    },
    affection() { mode = 'affection'; },
    pause() { sim.pause(); audio.pause(); drag = null; },
    resume() { sim.resume(); audio.resume(); drag = null; },
    leave,
  };

  let mode = 'boot', previousMode = 'menu', copyMessage = '', errorMessage = '';
  let diagnosticText = '', diagnosticPreview = '';
  let lobby, chapter = 1, stageArt, sim, progress = 0, video, aircraftId;
  let activeRun = 0, previousTime, accumulator = 0, warning, press, drag, resultLogged = false;
  let hidden = false, requestCatalog, sortieRun, activeEntry, waitingForMovement = false, loadoutDetailsKey;

  const readJson = async path => {
    const response = await host.fetchResource(path);
    if (!response.ok) throw new Error(`缺少关卡资源 ${path}`);
    return response.json();
  };

  async function loadCatalog() {
    return requestCatalog ||= Promise.all([
      readJson('data/loadout-catalog.json'), loadLoadoutRuntime(host.fetchResource),
      loadPlayerAppearances(host.fetchResource),
    ]).then(([catalog, runtime, appearances]) => ({ ...catalog, runtime, appearances }))
      .catch(error => { requestCatalog = undefined; throw error; });
  }

  function updateLoadoutStats() {
    if (!lobby) return;
    const configuration = lobby.system.replicaConfiguration();
    const key = JSON.stringify(configuration);
    if (loadoutDetailsKey === key) return;
    loadoutDetailsKey = key;
    void loadCatalog().then(catalog => {
      if (loadoutDetailsKey !== key) return;
      const { entry, key: configurationKey } = prepareReplicaLoadout(catalog, configuration);
      lobby.system.acceptReplicaLoadoutDetails({ ...entry, configurationKey, power: Math.floor(entry.attack + entry.hp / 4) });
      lobby.refresh();
    }).catch(error => {
      if (loadoutDetailsKey === key) loadoutDetailsKey = undefined;
      recordDiagnostic('战力读取失败', error.message);
    });
  }

  function result(quit = false) {
    const { id, stageIndex } = sortieRun.snapshot;
    const won = !quit && sim.phase === 'won';
    return { runId: id, engine, stageIndex, chapterId: chapter, won, abandoned: false,
      endReason: quit ? 'quit' : won ? 'victory' : 'defeat', gold: sim.gold, kills: sim.kills,
      bossKills: sim.bossKills, level: sim.level, wave: sim.wave, completedWave: sim.completedWave,
      clock: sim.clock, damageDealt: sim.damageDealt, hp: sim.player.hp, maxHp: sim.player.maxHp,
      revivesUsed: sim.revivesUsed, adRevivesUsed: sim.adRevivesUsed,
      damageByWeapon: Array.from(sim.damageByWeapon), entry: activeEntry };
  }

  function settle(quit) {
    if (!sortieRun || resultLogged) return true;
    const receipt = lobby.system.recordSortie(result(quit));
    if (!receipt.ok) {
      errorMessage = receipt.message || '战斗结算尚未保存';
      recordDiagnostic('结算保存失败', errorMessage);
      mode = 'settlement-error';
      return false;
    }
    resultLogged = true;
    audio.stop();
    const outcome = quit ? '退出战斗' : sim.phase === 'won' ? '通关' : '战败';
    recordDiagnostic(outcome, `第 ${chapter} 章 · 波次 ${sim.wave}`);
    return true;
  }

  function leave() {
    if (sim && !settle(sim.phase !== 'won' && sim.phase !== 'lost')) return;
    activeRun++;
    sim = undefined; warning = undefined; drag = null; press = null; accumulator = 0;
    audio.stop();
    sortieRun = undefined; activeEntry = undefined;
    lobby.refresh();
    mode = 'menu';
  }

  async function start() {
    if (mode === 'loading' || mode === 'battle' || !lobby) return { ok: false, message: '出击正在准备' };
    const run = ++activeRun;
    const selected = chapter = lobby.chapter;
    mode = 'loading'; progress = 0;
    recordDiagnostic('出击准备', `第 ${selected} 章`);
    try {
      const [content, catalog] = await Promise.all([
        loadContent((count, total) => { if (run === activeRun) progress = Math.min(.92, count / total); },
          { chapterId: selected, fetchResource: host.fetchResource }),
        loadCatalog(),
      ]);
      if (run !== activeRun) return { ok: false };
      const configuration = lobby.system.replicaConfiguration();
      const sortie = prepareReplicaLoadout(catalog, configuration);
      const game = new Simulation(content);
      applyStudyLoadout(content, game, catalog, sortie.state);
      game.rewardedReviveEnabled = false;
      const onboarding = lobby.onboarding;
      const prepared = lobby.system.prepareSortie({ engine, chapterId: selected, replicaConfiguration: sortie.configuration });
      if (!prepared.ok) throw new Error(prepared.message);
      sortieRun = prepared; activeEntry = sortie.entry;
      aircraftId = lobby.snapshot().aircraftId;
      waitingForMovement = onboarding.movement === true;
      game.start(onboarding, prepared.snapshot.nativeDefeatCount);
      const scene = peripheralSceneForStage(selected - 1);
      const imagePath = (scene.previewUrl || scene.depthUrl || scene.artUrl)?.replace(/^\//, '');
      stageArt = selected !== 1 && imagePath && __WECHAT_ASSET_ORIGIN__
        ? `${__WECHAT_ASSET_ORIGIN__}/${imagePath}` : undefined;
      sim = game; warning = undefined; drag = null; press = null;
      accumulator = 0; resultLogged = false; progress = 1;
      mode = 'battle';
      audio.start(content);
      recordDiagnostic('进入战斗', `第 ${selected} 章 · 攻击 ${Math.round(game.player.attack)}`);
      return { ok: true };
    } catch (error) {
      if (run !== activeRun) return;
      errorMessage = error.message || String(error);
      recordDiagnostic('出击失败', errorMessage);
      mode = 'error';
      return { ok: false, message: errorMessage };
    }
  }

  function touch({ phase, x, y }) {
    if (mode === 'menu' && lobby) {
      const point = phase === 'cancel' ? { x: 0, y: 0 } : view.point(x, y);
      lobby.handlePointer({ phase, ...point });
      return;
    }
    if (phase === 'cancel') { press = null; drag = null; return; }
    const point = view.point(x, y);
    if (phase === 'start') {
      const target = view.find(point.x, point.y);
      press = target ? { target, point } : null;
      if (!target && mode === 'battle' && sim.phase === 'playing') {
        drag = { point, playerX: sim.player.x, playerZ: sim.player.z, targetX: sim.player.x, targetZ: sim.player.z };
      }
    } else if (phase === 'move' && drag && sim?.phase === 'playing') {
      const bounds = sim.cameraWorldBounds;
      drag.targetX = drag.playerX + (point.x - drag.point.x) / width * (bounds.right - bounds.left);
      drag.targetZ = drag.playerZ - (point.y - drag.point.y) / height * (bounds.top - bounds.bottom);
    } else if (phase === 'end') {
      const active = press;
      press = null; drag = null;
      if (active && Math.hypot(point.x - active.point.x, point.y - active.point.y) < 30
        && view.find(point.x, point.y)?.id === active.target.id) active.target.onPress();
    }
  }

  function battleStep() {
    let x = 0, z = 0;
    if (drag) {
      x = drag.targetX - sim.player.x; z = drag.targetZ - sim.player.z;
      const distance = Math.hypot(x, z);
      const ratio = distance ? Math.min(1, sim.playerMovementSpeed * nativeLogicDelta / distance) : 0;
      x *= ratio; z *= ratio;
    }
    if (waitingForMovement) {
      if (Math.hypot(x, z) < 1e-6) return;
      waitingForMovement = false;
      lobby.system.completeBattleGuide(sortieRun.snapshot.id, 1);
    }
    sim.step(nativeLogicDelta, { x, z });
    if (sim.tutorialChoiceCompleted) {
      sim.tutorialChoiceCompleted = false;
      lobby.system.completeBattleGuide(sortieRun.snapshot.id, 4);
    }
    audio.update(sim);
    const request = sim.waveUIRequest;
    if (!request) { warning = undefined; return; }
    if (warning?.id !== request.id) {
      const isWarning = request.type === 2 || request.type === 5;
      const delay = request.type === 1
        ? wavePresentation.hudProgress.preDelay[request.previousMissionType === 2 ? 'previousMissionType2' : 'normal']
          + wavePresentation.hudProgress.finishEvent.time
        : isWarning ? wavePresentation.finishEvent.time : Infinity;
      warning = { id: request.id, remaining: delay,
        label: isWarning ? (request.type === 5 ? 'BOSS 来袭' : '强敌来袭') : '' };
    }
    warning.remaining -= nativeLogicDelta;
    if (warning.remaining <= 0) sim.completeWaveUI(warning.id);
  }

  function advance(delta) {
    if (sim.phase === 'playing') {
      accumulator += delta;
      while (accumulator >= secondsPerTick && sim.phase === 'playing') {
        battleStep(); accumulator -= secondsPerTick;
      }
    } else {
      accumulator = 0; drag = null;
      sim.advanceRevivePrompt(delta);
      sim.advanceResultPresentation(delta);
      audio.update(sim);
      if (!resultLogged && (sim.phase === 'won' || sim.phase === 'lost')) settle(false);
    }
  }

  function render() {
    const title = chapterPresentationForStage(chapter - 1).chapterName;
    if (mode === 'menu') {
      lobby.update(); lobby.renderMenu(); view.present(lobby.canvas);
    } else if (mode === 'battle') view.battle(sim, actions, stageArt, aircraftId, warning?.label || (waitingForMovement ? '拖动屏幕控制战机' : ''));
    else if (mode === 'diagnostics') {
      view.status('诊断日志', diagnosticPreview);
      if (copyMessage) view.text(copyMessage, 375, 986, 25, '#8bd7eb', 'center');
      view.button('back', '返回', 109, 1021, 249, 63, () => { mode = previousMode; });
      view.button('copy', '复制完整日志', 383, 1021, 258, 63, () => api.setClipboardData({
        data: diagnosticText,
        success() { copyMessage = '已复制'; },
        fail(error) { copyMessage = '复制失败'; recordDiagnostic('复制日志失败', error.errMsg); },
      }), false, true);
    } else if (mode === 'affection') {
      const data = lobby.affection;
      view.status('好感度', `${data.name}\n\n${data.points} / ${data.max}`);
      view.meter(116, 795, 518, 22, data.points / data.max, '#4ad2ed');
      if (data.video) view.button('video', '播放专属视频', 187, 862, 376, 77, () => playVideo(data.video), false, true);
      view.button('back', '返回', 187, 960, 376, 77, () => { mode = 'menu'; });
    } else if (mode === 'video') {
      view.button('close-video', '关闭视频', 510, 36, 190, 65, closeVideo);
    } else if (mode === 'boot') {
      view.status('少女航线', '正在加载大厅…');
    } else if (mode === 'settlement-error') {
      view.status('结算待保存', errorMessage);
      view.button('settle-retry', '重试保存', 187, 916, 376, 77, leave, false, true);
    } else if (mode === 'loading') {
      view.status(title, '正在准备出击…');
      view.meter(116, 814, 518, 22, progress, '#4ad2ed');
      view.button('cancel', '返回', 187, 916, 376, 77, leave);
    } else {
      view.status('出击准备失败', errorMessage);
      view.button('back', '返回', 108, 916, 250, 77, leave);
      view.button('retry', '重试', 388, 916, 250, 77, start, false, true);
      view.button('developer', '诊断日志', 187, 1005, 376, 70, actions.diagnostics);
    }
  }

  function closeVideo() { video?.destroy?.(); video = null; mode = 'affection'; }

  function playVideo(path) {
    if (!api.createVideo) { recordDiagnostic('视频失败', '微信基础库不支持视频'); return; }
    const info = api.getWindowInfo();
    const top = (info.safeArea?.top || 0) + 66;
    video = api.createVideo({ src: host.resolveAsset(path), x: 0, y: top,
      width: info.windowWidth, height: info.windowHeight - top, controls: true, showFullscreenBtn: false,
      objectFit: 'contain', autoplay: true });
    video.onError?.(error => { recordDiagnostic('视频失败', error.errMsg); closeVideo(); });
    mode = 'video';
  }

  function tick(timestamp) {
    const delta = previousTime === undefined ? 0 : Math.max(0, Math.min(.1, (timestamp - previousTime) / 1000));
    previousTime = timestamp;
    if (!hidden) {
      try {
        if (mode === 'battle') advance(delta);
        view.begin();
        try { render(); } finally { view.end(); }
      } catch (error) {
        errorMessage = error.message || String(error);
        recordDiagnostic('运行异常', errorMessage);
        mode = 'error';
      }
    }
    frame(tick);
  }

  host.bindTouch(touch);
  api.onWindowResize?.(view.resize);
  api.onHide(() => {
    hidden = true; previousTime = undefined;
    if (sim?.phase === 'playing') sim.pause();
    audio.pause();
    if (sim && sortieRun && !resultLogged) lobby.system.checkpointSortie(result(true));
    video?.pause?.();
    recordDiagnostic('切到后台');
  });
  api.onShow(() => { hidden = false; previousTime = undefined; recordDiagnostic('返回前台'); });
  api.onError?.(error => recordDiagnostic('脚本异常', error.message || error));
  api.onUnhandledRejection?.(event => recordDiagnostic('异步异常', event.reason?.message || event.reason));
  recordDiagnostic('微信启动', `v${project.version}`);
  void Promise.all([host.loadPackage('lobby-code'), host.loadPackage('art-local')]).then(() => {
    const { createWechatLobby } = require('./lobby-code/lobby.js');
    lobby = createWechatLobby({ api, screen: canvas, storage: host.storage, resolveAsset: host.resolveAsset,
      start, openDiagnostics: actions.diagnostics, openAffection: actions.affection, onChange: updateLoadoutStats });
    mode = 'menu';
    updateLoadoutStats();
  }).catch(error => {
    errorMessage = error.message || String(error);
    mode = 'boot-error';
    recordDiagnostic('大厅加载失败', errorMessage);
  });
  frame(tick);
}

startWechatGame(wx);
