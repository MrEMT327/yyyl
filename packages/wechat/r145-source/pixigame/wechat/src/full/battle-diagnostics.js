import { captureBattleCheckpoint } from '../../../src/replica/battle-checkpoint.js';
import { BATTLE_WORK_PHASES, createBattlePerformanceSource } from '../../../src/replica/battle-performance.js';
import { createBattleDiagnosticsView } from './battle-diagnostics-view.js';
import { createDomFramePerformance } from './dom-frame-performance.js';
import { getWechatTransport } from './transport.js';

const intervalMs = 1500;
const round = value => Math.round(value * 10) / 10;
const phases = new Set(['ready', 'playing', 'paused', 'upgrade', 'treasure', 'revive', 'won', 'lost']);
const loadPhases = new Set(['data', 'appearance', 'interface', 'textures']);
const milestones = new Set(['boot', 'ready', 'configured', 'started', 'control-ready', 'error']);
const loadMarks = new Set(['battle-packages-ready', 'battle-files-warm-start', 'boot', 'ready', 'configured', 'started', 'control-ready', 'battle-mount-failed']);
const preparationEvents = new Set(['subpackage-ready', 'subpackage-failed', 'package-data-ready', 'battle-files-warm-done']);
const reportKey = 'shnh-wechat-pending-battle-performance-v1';
const reportHeader = '少女航线 · 真机性能日志\n';
const reportSchema = 'shnh-wechat-battle-performance-v1';

function append(rows, row, limit) {
  rows.push(row);
  if (rows.length > limit) rows.shift();
}

function keepHighest(rows, row, key, limit) {
  if (rows.length === limit && row[key] <= rows[rows.length - 1][key]) return;
  rows.push(row);
  rows.sort((a, b) => b[key] - a[key]);
  if (rows.length > limit) rows.pop();
}

function resourceSummary() {
  return {
    operations: 0, bytesReported: 0, failures: 0, retries: 0, aborted: 0,
    totalQueueMs: 0, totalActiveMs: 0, queuedOver500: 0,
    slowest: [], longestQueue: [], largest: [], errors: [],
  };
}

function countResource(summary, row) {
  if (row.status === 'aborted') { summary.aborted++; return; }
  summary.operations++;
  summary.bytesReported += row.bytes ?? 0;
  summary.totalQueueMs += row.queueMs;
  summary.totalActiveMs += row.activeMs;
  if (row.queueMs >= 500) summary.queuedOver500++;
  summary.retries += Math.max(0, row.attempts - 1);
  if (row.status !== 200 && row.status !== 206) {
    summary.failures++;
    append(summary.errors, row, 5);
  }
  keepHighest(summary.slowest, row, 'elapsedMs', 7);
  if (row.queueMs > 0) keepHighest(summary.longestQueue, row, 'queueMs', 5);
  if (row.bytes > 0) keepHighest(summary.largest, row, 'bytes', 5);
}

function currentWave(sortie) {
  const wave = captureBattleCheckpoint(sortie?.frame.contentWindow)?.wave;
  return Number.isSafeInteger(wave) && wave > 0 ? wave : null;
}

function createCadence() {
  // One millisecond bins retain whole-run percentiles without storing frames.
  const bins = new Uint32Array(501);
  let count = 0, total = 0, max = 0, over34 = 0, over50 = 0, over100 = 0;
  let seconds = 0, secondFrames = 0, secondsAtTarget = 0;
  return {
    add(ms) {
      if (ms <= 0 || !Number.isFinite(ms)) return;
      bins[Math.min(500, Math.round(ms))]++;
      count++; total += ms; max = Math.max(max, ms);
      // Count full seconds of active play, including seconds crossed by a stall.
      const elapsedSeconds = Math.floor(total / 1000);
      if (elapsedSeconds === seconds) secondFrames++;
      else {
        const endsOnBoundary = total === elapsedSeconds * 1000;
        if (endsOnBoundary && elapsedSeconds === seconds + 1) secondFrames++;
        if (secondFrames >= 56) secondsAtTarget++;
        seconds = elapsedSeconds;
        secondFrames = endsOnBoundary ? 0 : 1;
      }
      if (ms > 34) over34++;
      if (ms > 50) over50++;
      if (ms > 100) over100++;
    },
    summary() {
      if (!count) return null;
      const percentile = p => {
        let sum = 0;
        for (let i = 0; i < bins.length; i++) {
          sum += bins[i];
          if (sum >= Math.ceil(count * p)) return i;
        }
        return 500;
      };
      return { intervals: count, fps: round(count * 1000 / total), meanMs: round(total / count),
        fps56: { seconds, passed: secondsAtTarget },
        p50Ms: percentile(.5), p95Ms: percentile(.95), p99Ms: percentile(.99), maxMs: round(max), over34, over50, over100 };
    },
  };
}

// Only the preview build subscribes. Boot/entry retain a bounded record of
// work that finishes before the tester can reach the in-battle button.
export function createBattleDiagnostics(api, { buildId, cdnBase, iosPerformanceMode, now = () => performance.now() } = {}) {
  const bootAt = now();
  const boot = { timings: [], resources: resourceSummary() };
  const pendingPackages = new Map();
  const transport = getWechatTransport(api);
  let host, button, source, readStats, sortie, record, insets, viewer, lastReport, disposed = false;
  const time = () => round(now() - bootAt);
  const safeCall = (fn, fallback = null) => { try { return fn() ?? fallback; } catch { return fallback; } };
  const isLoading = () => sortie && !sortie.controlReady;
  const note = (event, detail = {}) => {
    const row = { atMs: time(), event, ...detail };
    if (event === 'subpackage-start') pendingPackages.set(detail.name, row.atMs);
    if (event === 'subpackage-ready' || event === 'subpackage-failed') pendingPackages.delete(detail.name);
    if (sortie) {
      if (loadMarks.has(event)) sortie.loadMarks[event] ??= row.atMs;
      if (!sortie.controlReady && preparationEvents.has(event)) append(sortie.preparation, row, 16);
      append(sortie.events, row, 30);
    }
    else if (!boot.entered) append(boot.timings, row, 30);
  };
  const assetPath = url => {
    if (!cdnBase || !url.startsWith(cdnBase)) return null;
    // Do not collect query strings, external URLs, headers or response bodies.
    const path = url.slice(cdnBase.length).split(/[?#]/, 1)[0];
    return /^(?:art|assets|audio|fighters|replica-battle)\//.test(path) ? path.slice(0, 180) : null;
  };
  const unsubscribe = transport.observe(result => {
    if (sortie ? !record && sortie.controlReady : boot.entered) return;
    const path = assetPath(result.url);
    if (!path) return;
    const { type, status, bytes, attempts, elapsedMs, queueMs, activeMs } = result;
    const row = { atMs: time(), path, type, status, bytes, attempts,
      elapsedMs: round(elapsedMs), queueMs: round(queueMs), activeMs: round(activeMs) };
    if (!sortie) countResource(boot.resources, row);
    else {
      if (isLoading()) countResource(sortie.resources, row);
      if (record) countResource(record.resources, row);
    }
  });

  function syncButton() {
    if (!button) return;
    const label = record && !isLoading() ? '停止并查看' : '查看日志';
    const hidden = !sortie && !lastReport;
    if (button.textContent !== label) button.textContent = label;
    if (button.hidden !== hidden) button.hidden = hidden;
    button.setAttribute('aria-pressed', String(Boolean(record)));
    button.style.backgroundColor = record ? '#872337' : '#102338';
    viewer?.setActions({ canRefresh: Boolean(sortie), canRecord: Boolean(sortie?.controlReady && !record) });
  }

  function remember(payload) {
    const json = JSON.stringify(payload);
    lastReport = JSON.parse(json);
    const text = reportHeader + json;
    safeCall(() => api.setStorageSync?.(reportKey, text));
    console.info('[wechat-perf-report]', text);
    return lastReport;
  }

  function showReport(report) {
    viewer ||= createBattleDiagnosticsView(host, {
      ...insets,
      refresh: () => { if (sortie) showReport(captureLoading()); },
      start: begin,
    });
    viewer.show(report);
    syncButton();
  }

  function sample() {
    if (!record || host.document.hidden) return;
    const status = source.snapshot();
    const engine = status.metrics;
    const frame = engine?.frames.battle;
    const compat = record.profile.snapshot().phases.battle;
    const window = { atMs: time(), phase: sortie?.phase, wave: currentWave(sortie), gapMaxMs: round(record.windowGap),
      presentationFps: record.windowMs > 0 ? round(record.windowFrames * 1000 / record.windowMs) : null,
      over50: record.windowOver50,
      engine: frame?.count ? { fps: frame.active && frame.mean ? round(1000 / frame.mean) : null,
        frameP95Ms: round(frame.p95), frameMaxMs: round(frame.max),
        updateP95Ms: round(engine.costs.update.p95), renderP95Ms: round(engine.costs.render.p95),
        workP95Ms: Object.fromEntries(BATTLE_WORK_PHASES.filter(name => engine.costs[name]?.count)
          .map(name => [name, round(engine.costs[name].p95)])),
        ...(engine.peakFrame ? {peakFrame: {
          ...engine.peakFrame,
          ...Object.fromEntries(['gapMs','waitMs','updateMs','renderMs','presentMs'].map(name=>[name,round(engine.peakFrame[name])])),
          work: Object.fromEntries(Object.entries(engine.peakFrame.work).map(([name,value])=>[name,round(value)])),
        }} : {}),
        drawCalls: engine.rendering.available ? round(engine.rendering.calls) : null,
        drawContexts: engine.contexts.filter(context => context.available && Number.isFinite(context.calls))
          .map(context => ({name:context.name,calls:round(context.calls),triangles:round(context.triangles)})),
        triangles: engine.rendering.available ? round(engine.rendering.triangles) : null } : null,
      ui: compat ? { hostLayoutP95Ms: compat.host.layout?.p95, hostPaintP95Ms: compat.host.paint?.p95,
        battleLayoutP95Ms: compat.battle.layout?.p95, battlePaintP95Ms: compat.battle.paint?.p95,
        battleInputP95Ms: compat.battle.inputActiveP95 } : null,
    };
    record.windowGap = record.windowFrames = record.windowMs = record.windowOver50 = 0;
    append(record.recent, window, 6);
    if (window.gapMaxMs > 0) keepHighest(record.worst, window, 'gapMaxMs', 6);
  }

  function begin() {
    if (!sortie?.controlReady || record || disposed) return;
    viewer?.close();
    record = { startedAtMs: time(), phase: sortie.phase, profile: createDomFramePerformance(now, 120),
      cadence: createCadence(), screenCadence: createCadence(), lastFrame: null, lastTick: null, windowGap: 0,
      windowFrames: 0, windowMs: 0, windowOver50: 0,
      recent: [], worst: [], spikes: [], resources: resourceSummary(), before: safeCall(readStats) };
    source.setEnabled(true);
    record.timer = host.scope.setInterval(sample, intervalMs);
    syncButton();
  }

  function makeReport(recording, snapshot = null) {
    const device = safeCall(() => api.getDeviceInfo?.()) || {};
    const app = safeCall(() => api.getAppBaseInfo?.()) || {};
    const { chapter, startedAtMs, attemptAtMs, phase, controlReady, loading, events, resources, loadMarks, preparation, memoryWarnings } = sortie;
    const view = { width: host.width, height: host.height, pixelRatio: host.pixelRatio };
    const capturedAtMs = snapshot?.capturedAtMs ?? recording.endedAtMs;
    return {
      schema: reportSchema, buildId,
      environment: { model: device.model, system: device.system, platform: device.platform,
        benchmarkLevel: device.benchmarkLevel, sdk: app.SDKVersion, iosPerformanceMode, ...view },
      boot,
      sortie: { chapter, startedAtMs, attemptAtMs, elapsedMs: round(capturedAtMs - startedAtMs),
        phase, controlReady, loading, loadMarks, preparation, events, resources, memoryWarnings },
      ...(snapshot && { snapshot }),
      recording,
    };
  }

  function captureLoading() {
    const capturedAtMs = time();
    const pendingNetwork = { count: 0, states: { queued: 0, active: 0, 'retry-wait': 0 }, slowest: [] };
    for (const { url, type, state, attempts, elapsedMs, queueMs, activeMs } of transport.pendingSnapshot()) {
      const path = assetPath(url);
      if (!path) continue;
      pendingNetwork.count++;
      pendingNetwork.states[state]++;
      keepHighest(pendingNetwork.slowest, { path, type, state, attempts, elapsedMs: round(elapsedMs),
        queueMs: round(queueMs), activeMs: round(activeMs) }, 'elapsedMs', 7);
    }
    return remember(makeReport(null, {
      reason: 'loading-view', capturedAtMs, pendingNetwork,
      pendingPackages: Array.from(pendingPackages, ([name, startedAtMs]) => ({
        name, startedAtMs, elapsedMs: round(capturedAtMs - startedAtMs),
      })),
      stats: safeCall(readStats),
    }));
  }

  function stop(reason, display = false) {
    if (!record) return;
    sample();
    const finished = record;
    record = undefined;
    host.scope.clearInterval(finished.timer);
    source.setEnabled(false);
    const report = remember(makeReport({
      startedAtMs: finished.startedAtMs, endedAtMs: time(), reason, startPhase: finished.phase,
      playingPresentation: finished.cadence.summary(), playingScreenCallbacks: finished.screenCadence.summary(),
      frameSpikes: finished.spikes, recentSamples: finished.recent, slowestSamples: finished.worst,
      compatibility: finished.profile.snapshot(), canvasTransfers: finished.profile.transfers(),
      resources: finished.resources, before: finished.before, after: safeCall(readStats),
    }));
    sortie.lastRecording = report;
    if (display) showReport(report);
  }

  function visibility() {
    if (!sortie) return;
    note(host.document.hidden ? 'background' : 'foreground');
    if (record) record.lastFrame = record.lastTick = null;
  }

  function memoryWarning(event) {
    if (sortie) sortie.memoryWarnings++;
    note('memory-warning', { level: Number.isFinite(event?.level) ? event.level : null });
  }

  function bindEngineSampler() {
    source?.destroy();
    source = createBattlePerformanceSource({ documentRef: host.document, windowRef: host.window, now });
    if (record) source.setEnabled(true);
  }

  return {
    note,
    lobbyEntered() { note('lobby-entered'); boot.entered = true; },
    attach(nextHost, { top, left, bottom = nextHost.height, getStats }) {
      host = nextHost;
      insets = { top, bottom };
      readStats = typeof getStats === 'function' ? getStats : () => null;
      bindEngineSampler();
      button = host.document.createElement('button');
      button.type = 'button';
      button.id = 'wechat-battle-performance-record';
      const battleTop = Math.max(0, (host.height - host.width * 16 / 9) / 2);
      // On short screens the margin above the battle overlaps its pause
      // control. Move the recorder below the HUD in that case.
      if (top + 34 > battleTop + 8) top = Math.max(top, battleTop + Math.min(host.width * .55, host.height * .36));
      button.style.cssText = `position:fixed;z-index:2147483646;left:${left}px;top:${top}px;box-sizing:border-box;width:90px;height:34px;margin:0;padding:0;border:1px solid #759cb8;border-radius:7px;color:white;font:600 12px sans-serif;text-align:center;touch-action:none`;
      button.addEventListener('click', () => {
        if (disposed) return;
        if (record && !isLoading()) stop('stop-button', true);
        else if (sortie) showReport(sortie.lastRecording ?? captureLoading());
        else if (lastReport) showReport(lastReport);
      });
      const saved = safeCall(() => api.getStorageSync?.(reportKey));
      if (typeof saved === 'string' && saved.startsWith(reportHeader)) {
        const report = safeCall(() => JSON.parse(saved.slice(reportHeader.length)));
        if (report?.schema === reportSchema && report.sortie) lastReport = report;
      }
      syncButton();
      host.document.body.append(button);
      host.document.addEventListener('visibilitychange', visibility);
      api.onMemoryWarning?.(memoryWarning);
    },
    enter(frame) {
      if (disposed || !frame.classList.contains('replica-battle-frame')) return;
      if (sortie?.frame === frame && sortie.source === frame.src) return;
      const chapter = safeCall(() => Number(new URL(frame.src, host.document.baseURI).searchParams.get('chapter')));
      if (!Number.isSafeInteger(chapter) || chapter < 1) return;
      if (sortie?.frame === frame) {
        sortie.source = frame.src;
        sortie.attemptAtMs = time();
        sortie.phase = 'loading';
        sortie.controlReady = false;
        sortie.loading = {};
        sortie.loadMarks = {};
        sortie.preparation = [];
        sortie.lastRecording = null;
        note('sortie-preparation-retry');
        if (record) {
          record.lastFrame = record.lastTick = null;
          bindEngineSampler();
        }
        syncButton();
        return;
      }
      if (record) stop('battle-changed');
      const startedAtMs = time();
      sortie = { frame, source: frame.src, chapter, startedAtMs, attemptAtMs: startedAtMs, phase: 'loading',
        controlReady: false, loading: {}, loadMarks: {}, preparation: [], events: [], resources: resourceSummary(), memoryWarnings: 0 };
      syncButton();
    },
    leave(frame) {
      if (sortie?.frame !== frame) return;
      note('left-battle');
      if (record) stop('left-battle');
      sortie = undefined;
      syncButton();
    },
    message(frame, data) {
      if (sortie?.frame !== frame || data?.channel !== 'shnh-replica-battle-v1') return;
      if (data.type === 'loading-progress' && loadPhases.has(data.phase)) {
        const progress = Number(data.progress);
        if (!Number.isFinite(progress)) return;
        const atMs = time();
        const row = sortie.loading[data.phase] ||= { firstAtMs: atMs };
        row.lastAtMs = atMs;
        row.progress = Math.min(1, Math.max(0, progress));
        if (row.progress === 1) row.completedAtMs ??= atMs;
      } else if (data.type === 'phase' && phases.has(data.phase)) {
        if (sortie.phase === data.phase) return;
        sortie.phase = data.phase;
        note('phase', { phase: data.phase });
        if (record) record.lastFrame = record.lastTick = null;
      } else if (milestones.has(data.type)) {
        if (data.type === 'control-ready') {
          sortie.controlReady = true;
          sortie.phase = 'playing';
          if (record) record.lastFrame = record.lastTick = null;
          syncButton();
        }
        note(data.type);
      }
    },
    presented(frame, nowMs) {
      if (!record || sortie?.frame !== frame || sortie.phase !== 'playing' || host.document.hidden) return;
      if (record.lastFrame !== null) {
        const gap = nowMs - record.lastFrame;
        if (gap > 0 && Number.isFinite(gap)) {
          record.cadence.add(gap);
          record.windowGap = Math.max(record.windowGap, gap);
          record.windowFrames++;
          record.windowMs += gap;
          if (gap > 50) record.windowOver50++;
          const gapMs = round(gap);
          if (gap > 34 && (record.spikes.length < 10 || gapMs > record.spikes[9].gapMs)) {
            keepHighest(record.spikes, { atMs: time(), gapMs, wave: currentWave(sortie) }, 'gapMs', 10);
          }
        }
      }
      record.lastFrame = nowMs;
    },
    screenTick(nowMs) {
      if (!record || sortie?.phase !== 'playing') return;
      if (record.lastTick !== null) record.screenCadence.add(nowMs - record.lastTick);
      record.lastTick = nowMs;
    },
    get profile() { return record?.profile; },
    destroy() {
      if (disposed) return;
      disposed = true;
      if (record) host.scope.clearInterval(record.timer);
      record = undefined;
      unsubscribe();
      source?.destroy();
      host?.document.removeEventListener('visibilitychange', visibility);
      api.offMemoryWarning?.(memoryWarning);
      viewer?.close();
      button?.remove();
    },
  };
}
