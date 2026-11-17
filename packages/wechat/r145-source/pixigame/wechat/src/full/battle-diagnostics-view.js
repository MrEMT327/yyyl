const stages = [['data', '关卡数据'], ['appearance', '机体外观'], ['interface', '战斗界面'], ['textures', '战斗贴图']];
const requestStates = { active: '下载中', queued: '排队中', 'retry-wait': '等待重试' };
const performanceModes = { normal: '常规', 'high-performance': '高性能', 'high-performance-plus': '高性能+' };
const transferNames = {
  battleBlit: '战景合成', battleSnapshot: '战景快照', frozenBattleBlit: '冻结画面合成', isolatedFrameCopy: '子画布合成',
  aircraftRead: '战机像素读取', aircraftReadSubmit: '读取提交', aircraftReadCopy: '读取拷贝',
  wakeBlit: '尾迹合成', aircraftUpload: '战机贴图上传', terrainUpload: '地形贴图上传',
};
const ms = value => Number.isFinite(value) ? Math.round(Math.max(0, value)) + ' ms' : '—';
const mib = value => Number.isFinite(value) ? (value / 1048576).toFixed(1) + ' MiB' : '—';
const fileSize = value => value >= 1048576 ? mib(value) : (value / 1024).toFixed(1) + ' KiB';
const fps = value => Number.isFinite(value) ? value + ' FPS' : '—';
const eventTime = (rows, event) => rows?.find(row => row.event === event)?.atMs;
const markTime = (sortie, event) => sortie.loadMarks ? sortie.loadMarks[event] : eventTime(sortie.events, event);
const stageEnd = (stage, sortie, snapshot) => stage.progress < 1 && !sortie.controlReady
  ? snapshot?.capturedAtMs ?? stage.lastAtMs
  : stage.completedAtMs ?? stage.lastAtMs;

function overview({ boot, sortie, snapshot, recording }) {
  const readyAt = markTime(sortie, 'control-ready');
  const firstPaint = eventTime(boot?.timings, 'start-button-painted');
  const lobbyAt = eventTime(boot?.timings, 'lobby-entered');
  const packagesAt = markTime(sortie, 'battle-packages-ready');
  const lines = [
    '大厅入口 ' + ms(lobbyAt) + ' · 开始按钮 ' + ms(firstPaint),
    '战斗准备 ' + ms(packagesAt - (sortie.attemptAtMs ?? sortie.startedAtMs)),
    ...stages.map(([key, label]) => {
      const stage = sortie.loading?.[key];
      if (!stage) return label + '　未开始';
      const percent = stage.progress < 1 ? Math.floor(stage.progress * 100) : 100;
      return label + '　' + percent + '% · ' + ms(stageEnd(stage, sortie, snapshot) - stage.firstAtMs);
    }),
  ];
  if (Number.isFinite(readyAt)) lines.push('出击至可操作 ' + ms(readyAt - sortie.startedAtMs));
  const loading = sortie.resources;
  if (loading) {
    lines.push('', '加载请求 ' + loading.operations + ' · ' + mib(loading.bytesReported),
      '失败 ' + loading.failures + ' · 重试 ' + loading.retries +
      (snapshot ? ' · 未完成 ' + snapshot.pendingNetwork.count : ''));
  }
  const stats = snapshot?.stats ?? recording?.after;
  if (stats) {
    const heap = Number.isFinite(stats.heapBytes) ? 'JS 堆 ' + mib(stats.heapBytes) : 'JS 堆未上报';
    lines.push(heap + ' · 宿主画布 ' + (stats.hostCanvases ?? '—'));
    if (sortie.memoryWarnings) lines.push('内存告警 ' + sortie.memoryWarnings + ' 次');
    if (stats.cache) lines.push('资源缓存命中 ' + (stats.cache.memoryHits ?? 0) + ' 内存 / ' + (stats.cache.diskHits ?? 0) + ' 磁盘');
  }
  if (recording) {
    const frame = recording.playingPresentation;
    const cadence = frame || recording.playingScreenCallbacks;
    lines.push('', '录制 ' + ms(recording.endedAtMs - recording.startedAtMs));
    if (cadence) {
      lines.push((frame ? '实际呈现 ' : '屏幕回调 ') + cadence.fps + ' FPS',
        '帧间隔 P95 ' + ms(cadence.p95Ms) + ' · 峰值 ' + ms(cadence.maxMs),
        '超过 50 ms ' + cadence.over50 + ' 帧');
    } else lines.push('尚无可用帧率样本');
  }
  return lines.join('\n');
}

function loading({ sortie, snapshot, recording }) {
  const lines = [];
  const offset = at => '+' + ms(at - sortie.startedAtMs);
  if (sortie.attemptAtMs > sortie.startedAtMs) lines.push('本次重试 ' + offset(sortie.attemptAtMs));
  for (const [event, label] of [['battle-packages-ready', '战斗准备完成'], ['boot', '战斗脚本启动']]) {
    const at = markTime(sortie, event);
    if (Number.isFinite(at)) lines.push(label + '　' + offset(at));
  }
  const preparation = sortie.preparation ?? sortie.events ?? [];
  const warmStart = markTime(sortie, 'battle-files-warm-start');
  if (Number.isFinite(warmStart)) {
    const warmEnd = preparation.find(row => row.event === 'battle-files-warm-done');
    lines.push('贴图提前下载　' + offset(warmStart) + (warmEnd
      ? ' → ' + offset(warmEnd.atMs) + ' · ' + warmEnd.ready + '/' + warmEnd.files + ' 张'
      : sortie.controlReady ? ' · 未在可操作前完成' : ' · 进行中'));
  }
  for (const [key, label] of stages) {
    const stage = sortie.loading?.[key];
    if (!stage) continue;
    const end = stageEnd(stage, sortie, snapshot);
    lines.push(label + (stage.progress < 1 ? '（未完成）' : ''),
      offset(stage.firstAtMs) + ' → ' + offset(end) + ' · ' + ms(end - stage.firstAtMs));
  }
  for (const [event, label] of [['ready', '战斗场景就绪'], ['configured', '出击配置完成'], ['started', '首帧已呈现']]) {
    const at = markTime(sortie, event);
    if (Number.isFinite(at)) lines.push(label + '　' + offset(at));
  }
  const readyAt = markTime(sortie, 'control-ready');
  if (Number.isFinite(readyAt)) {
    lines.push('首次可操作　' + offset(readyAt));
    const textures = sortie.loading?.textures;
    if (textures?.progress === 1) {
      const completedAt = stageEnd(textures, sortie, snapshot);
      if (readyAt >= completedAt) lines.push('贴图完成至可操作　' + ms(readyAt - completedAt));
    }
  }
  const failedAt = markTime(sortie, 'battle-mount-failed');
  if (Number.isFinite(failedAt)) lines.push('战斗挂载失败　' + offset(failedAt));

  const packages = preparation.filter(row => row.event === 'subpackage-ready' || row.event === 'subpackage-failed');
  if (packages.length || snapshot?.pendingPackages?.length) {
    lines.push('', '分包明细');
    for (const row of packages) {
      lines.push(row.name + ' · ' + ms(row.elapsedMs) + (row.event === 'subpackage-failed' ? ' · 失败' : '') + ' · ' + offset(row.atMs));
    }
    for (const row of snapshot?.pendingPackages ?? []) lines.push(row.name + ' · 未完成 · 已等 ' + ms(row.elapsedMs));
  }
  const reads = preparation.filter(row => row.event === 'package-data-ready');
  if (reads.length) {
    lines.push('', '本地数据');
    for (const row of reads) {
      lines.push(row.path + ' · ' + fileSize(row.bytes), '读取解压 ' + ms(row.readMs) + ' · JSON 解析 ' + ms(row.parseMs));
    }
  }
  const stats = snapshot?.stats ?? recording?.after;
  if (Number.isFinite(stats?.assetFileCacheBytes)) lines.push('', '资源文件缓存 ' + mib(stats.assetFileCacheBytes));
  return lines.length ? lines.join('\n') : '等待战斗开始准备';
}

function resources({ sortie, snapshot, recording }) {
  const lines = [];
  const seen = new Set();
  function group(title, rows, describe) {
    let shown = 0;
    for (const row of rows ?? []) {
      if (seen.has(row.path)) continue;
      if (!shown) lines.push('', title);
      seen.add(row.path);
      lines.push(row.path.replace(/^replica-battle\/(?:assets\/)?/, ''), describe(row));
      if (++shown === 3) break;
    }
  }
  function totals(label, summary) {
    if (!summary) return;
    lines.push(label + ' ' + summary.operations + ' 个 · ' + mib(summary.bytesReported) +
      ' · 失败 ' + summary.failures + ' · 重试 ' + summary.retries);
    if (summary.operations && Number.isFinite(summary.totalQueueMs)) {
      lines.push('平均排队 ' + ms(summary.totalQueueMs / summary.operations) +
        ' · 平均请求内 ' + ms(summary.totalActiveMs / summary.operations),
        '排队 ≥500 ms ' + summary.queuedOver500 + ' 个 · 取消 ' + summary.aborted + ' 个');
    }
  }
  const summarize = row => '排队 ' + ms(row.queueMs) + ' · 请求内 ' + ms(row.activeMs) +
    '\n总计 ' + ms(row.elapsedMs) + (row.bytes > 0 ? ' · ' + fileSize(row.bytes) : '') +
    (row.attempts > 1 ? ' · 尝试 ' + row.attempts + ' 次' : '');
  totals('加载请求', sortie.resources);
  const states = snapshot?.pendingNetwork?.states;
  if (states) lines.push('未完成 · 排队 ' + states.queued + ' · 下载 ' + states.active + ' · 等重试 ' + states['retry-wait']);
  group('加载失败', sortie.resources?.errors, row => String(row.status) + ' · ' + summarize(row));
  group('未完成请求', snapshot?.pendingNetwork?.slowest, row => requestStates[row.state] + ' · ' + summarize(row));
  if (snapshot?.pendingPackages?.length) {
    if (lines.length) lines.push('');
    lines.push('未完成分包', ...snapshot.pendingPackages.map(row => row.name + '　' + ms(row.elapsedMs)));
  }
  group('排队最长', sortie.resources?.longestQueue, summarize);
  group('加载耗时较长', sortie.resources?.slowest?.filter(row => row.status === 200 || row.status === 206), summarize);
  group('加载体积最大', sortie.resources?.largest, summarize);
  if (recording?.resources) {
    lines.push('');
    seen.clear();
    totals('录制请求', recording.resources);
    group('录制期间失败', recording.resources.errors, row => String(row.status) + ' · ' + summarize(row));
    group('录制期间耗时较长', recording.resources.slowest?.filter(row => row.status === 200 || row.status === 206), summarize);
  }
  return lines.length ? lines.join('\n') : '暂无资源记录';
}

function frames({ recording }) {
  if (!recording) return '进入战斗后点「开始录制」，结束后查看掉帧明细。';
  const lines = [];
  function cadence(label, stats) {
    if (!stats) return;
    lines.push(label + ' ' + fps(stats.fps) + ' · ' + stats.intervals + ' 个帧间隔',
      'P50 ' + ms(stats.p50Ms) + ' · P95 ' + ms(stats.p95Ms) + ' · P99 ' + ms(stats.p99Ms),
      '峰值 ' + ms(stats.maxMs) + ' · 超 50/100 ms ' + stats.over50 + '/' + stats.over100 + ' 帧', '');
  }
  cadence('实际呈现', recording.playingPresentation);
  cadence('屏幕回调', recording.playingScreenCallbacks);
  if (!lines.length) lines.push('尚无可用帧率样本', '');
  if (recording.frameSpikes?.length) {
    lines.push('最长帧间隔');
    for (const row of recording.frameSpikes.slice(0, 4)) {
      lines.push('录制 +' + ms(row.atMs - recording.startedAtMs) + ' · ' + ms(row.gapMs) +
        (row.wave ? ' · 第 ' + row.wave + ' 波' : ''));
    }
    const worst = recording.slowestSamples?.[0];
    if (Number.isFinite(worst?.presentationFps)) {
      lines.push('峰值所在采样段 ' + fps(worst.presentationFps) + ' · 超 50 ms ' + worst.over50 + ' 帧');
    }
    lines.push('');
  }
  const sampled = [...(recording.slowestSamples ?? []), ...(recording.recentSamples ?? []).slice().reverse()];
  const engine = sampled.find(row => row.engine)?.engine;
  if (engine) {
    lines.push('引擎近期样本 ' + fps(engine.fps), '引擎帧间隔 P95 ' + ms(engine.frameP95Ms),
      '逻辑 P95 ' + ms(engine.updateP95Ms) + ' · 渲染 P95 ' + ms(engine.renderP95Ms));
    if (Number.isFinite(engine.drawCalls)) lines.push('每帧绘制调用 ' + engine.drawCalls + ' · 三角面 ' + engine.triangles);
  } else lines.push('本次未收到引擎样本');
  const ui = recording.compatibility?.phases?.battle;
  if (ui?.frames) {
    lines.push('', '界面 CPU P95（最近 ' + ui.frames + ' 帧）',
      '宿主布局/绘制 ' + ms(ui.host.layout?.p95) + ' / ' + ms(ui.host.paint?.p95),
      '战斗布局/绘制 ' + ms(ui.battle.layout?.p95) + ' / ' + ms(ui.battle.paint?.p95));
    if (Number.isFinite(ui.battle.inputActiveP95)) lines.push('战斗触控 P95 ' + ms(ui.battle.inputActiveP95));
  }
  const transfers = Object.entries(recording.canvasTransfers ?? {})
    .filter(([name, row]) => transferNames[name] && row?.calls > 0)
    .sort(([, a], [, b]) => (b.activeP95 ?? 0) - (a.activeP95 ?? 0));
  if (transfers.length) {
    lines.push('', '画布操作 CPU · 有调用的帧 P95');
    for (const [name, row] of transfers.slice(0, 4)) {
      lines.push(transferNames[name] + ' ' + ms(row.activeP95) + ' · ' + row.calls + ' 次');
    }
  }
  return lines.join('\n').trimEnd();
}

const pages = [['概况', overview], ['加载', loading], ['资源', resources], ['掉帧', frames]];

export function createBattleDiagnosticsView(host, { top, bottom, refresh, start }) {
  const { document } = host;
  function element(tag, style, text = '') {
    const node = document.createElement(tag);
    node.style.cssText = style;
    if (text) node.textContent = text;
    return node;
  }
  function button(label, click) {
    const node = element('button', 'box-sizing:border-box;flex-shrink:0;height:36px;min-width:65px;padding:0 10px;margin:0;border:1px solid #587894;border-radius:6px;color:#f4f8ff;font:600 13px sans-serif;text-align:center;touch-action:none;background:#172c42', label);
    node.type = 'button';
    node.addEventListener('click', click);
    return node;
  }
  const screen = element('div', 'position:fixed;z-index:2147483647;inset:0;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;background:#0a1828;color:#eef6ff;pointer-events:auto;touch-action:pan-y;font-family:sans-serif');
  screen.id = 'wechat-battle-performance-log';
  screen.setAttribute('role', 'dialog');
  screen.setAttribute('aria-label', '性能日志');
  const panel = element('div', 'width:100%;max-width:540px;flex-grow:1;min-height:0;display:flex;flex-direction:column;row-gap:8px');
  const header = element('div', 'display:flex;flex-direction:row;justify-content:space-between;align-items:center;flex-shrink:0');
  const title = element('div', 'display:block;font-size:19px;font-weight:700');
  const close = () => screen.remove();
  header.append(title, button('关闭', close));
  const detail = element('div', 'display:block;flex-shrink:0;white-space:pre-wrap;font-size:12px;line-height:16px;color:#a9bed6');
  const tabs = element('div', 'display:flex;flex-direction:row;column-gap:8px;flex-shrink:0');
  const tabButtons = pages.map(([label], index) => {
    const tab = button(label, () => select(index));
    tab.style.flexGrow = '1';
    tab.style.flexShrink = '1';
    tab.style.minWidth = '0';
    return tab;
  });
  tabs.append(...tabButtons);
  const scroll = element('div', 'display:flex;flex-direction:column;flex-grow:1;min-height:0;overflow-y:auto;touch-action:pan-y;padding:10px 12px;border:1px solid #304a64;border-radius:8px;background:#101f32');
  const body = element('div', 'display:block;flex-shrink:0;white-space:pre-wrap;font-size:14px;line-height:20px');
  scroll.append(body);
  const actions = element('div', 'display:flex;flex-direction:row;column-gap:8px;flex-shrink:0');
  const refreshButton = button('刷新加载', refresh);
  const startButton = button('开始录制', start);
  actions.append(refreshButton, startButton);
  panel.append(header, detail, tabs, scroll, actions);
  screen.append(panel);
  let report, page = 0;

  function select(next) {
    page = next;
    body.textContent = pages[page][1](report);
    scroll.scrollTop = 0;
    tabButtons.forEach((tab, index) => { tab.style.backgroundColor = index === page ? '#285375' : '#172c42'; });
  }

  return {
    show(next) {
      report = next;
      const { environment, sortie, recording, buildId } = next;
      title.textContent = recording ? '局内性能日志' : '出击加载日志';
      const status = sortie.controlReady ? '可操作' : '加载中';
      detail.textContent = [
        '关卡 ' + sortie.chapter + ' · ' + status + ' · 出击后 ' + ms(sortie.elapsedMs),
        [environment?.model, environment?.system, environment?.sdk && 'SDK ' + environment.sdk].filter(Boolean).join(' · '),
        environment?.width && environment?.height &&
          [environment.width + '×' + environment.height + ' @' + environment.pixelRatio + 'x',
            environment.platform === 'ios' && performanceModes[environment.iosPerformanceMode]].filter(Boolean).join(' · '),
        buildId,
      ].filter(Boolean).join('\n');
      screen.style.padding = Math.max(54, top + 40) + 'px 12px ' + Math.max(16, host.height - bottom + 8) + 'px';
      if (!screen.isConnected) { page = 0; document.body.append(screen); }
      select(page);
    },
    setActions({ canRefresh, canRecord }) {
      refreshButton.hidden = !canRefresh || Boolean(report?.recording);
      startButton.hidden = !canRecord;
      actions.hidden = refreshButton.hidden && startButton.hidden;
    },
    close,
  };
}
