// Adapter for the frozen V14 baked WebGL2 mesh streams, not a Cubism model.
const TRANSITION_SECONDS = .15;

export function createSourceMotionClock({frames = 526, idleFrames = 960, fps = 60} = {}) {
  let phase = 'idle', time = 0;
  const length = () => phase === 'source' ? frames / fps : phase === 'idle' ? idleFrames / fps : TRANSITION_SECONDS;
  return {
    start(name) { phase = name === 'idle' ? 'idle' : 'entry'; time = 0; },
    step(seconds) {
      let remaining = Math.max(0, seconds);
      const events = [];
      while (remaining > 1e-10) {
        const used = Math.min(remaining, Math.max(0, length() - time));
        time += used; remaining -= used;
        if (time + 1e-10 < length()) break;
        const previous = phase;
        phase = phase === 'entry' ? 'source' : phase === 'source' ? 'exit' : 'idle';
        time = 0;
        if (previous === 'source') events.push({type: 'source-end', frame: frames - 1});
        if (previous === 'exit') {
          events.push({type: 'action-end'});
          return {events, remaining};
        }
      }
      return {events, remaining: 0};
    },
    seek(key, frame) { phase = key === 'idle' ? 'idle' : 'source'; time = Math.max(0, Math.min((key === 'idle' ? idleFrames : frames) - 1, frame)) / fps; },
    get phase() { return phase; },
    get key() { return phase === 'entry' || phase === 'source' ? 'main3' : 'idle'; },
    get frame() { return phase === 'entry' || phase === 'exit' ? 0 : Math.min((phase === 'idle' ? idleFrames : frames) - 1, Math.floor(time * fps + 1e-7)); },
    get weight() { return Math.min(1, time / TRANSITION_SECONDS); },
    get motionName() { return phase === 'idle' ? 'idle' : 'touch_head'; },
    get currentTime() { return phase === 'source' ? TRANSITION_SECONDS + time : phase === 'exit' ? TRANSITION_SECONDS + frames / fps + time : time; },
    get duration() { return phase === 'idle' ? idleFrames / fps : frames / fps + TRANSITION_SECONDS * 2; },
  };
}

export function advanceSourceMotion(clock, seconds, renderer) {
  const step = clock.step(seconds);
  const endpoint = step.events.find(event => event.type === 'source-end');
  // An exit always starts from the authored last sample, even on a slow display.
  if (endpoint) renderer.draw('main3', endpoint.frame);
  return {...step, exitFrom: endpoint ? renderer.last : null};
}

export function createBlueHandCannonPortraitPlayer({assetBase = import.meta.env?.BASE_URL ?? '/', runtimePath = 'art/blue-hand-cannon-v28-socket/'} = {}) {
  const assetRoot = new URL(assetBase, location.href);
  const root = new URL(runtimePath, assetRoot);
  if (root.origin !== location.origin) throw new Error('角色只允许读取同源资源');
  let host = null, canvas = null, renderer = null, clock = null, loading = null;
  let state = 'idle', error = null, visible = true, paused = false, destroyed = false;
  let raf = null, lastTime = null, blendFrom = null, rendered = 0, explicit = false;
  let requestedMotion = 'idle';
  const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  const canPlay = () => !destroyed && state === 'ready' && host && visible && !paused && !document.hidden && (!reduced?.matches || explicit);
  const transitioning = () => clock && (clock.phase === 'entry' || clock.phase === 'exit');

  function updateHost() {
    if (!host) return;
    host.classList.toggle('is-ready', state === 'ready');
    Object.assign(host.dataset, {
      portraitState: state, motion: requestedMotion,
      time: (clock?.currentTime || 0).toFixed(3), playing: String(Boolean(canPlay())),
      sourceMotion: clock?.key || 'idle', sourceFrame: String(clock?.frame || 0),
      motionPhase: clock?.phase || 'idle',
    });
  }
  function clearHost() {
    if (!host) return;
    host.classList.remove('is-ready');
    for (const key of ['portraitState', 'motion', 'time', 'playing', 'sourceMotion', 'sourceFrame', 'motionPhase']) delete host.dataset[key];
  }
  function stop() { if (raf !== null) cancelAnimationFrame(raf); raf = null; lastTime = null; }
  function fail(reason) { if (destroyed) return; error = reason; state = 'error'; stop(); updateHost(); console.warn('蓝发手炮立绘载入失败', reason); }

  function fit() {
    if (!host || !canvas || !renderer) return;
    // The source masks have hard alpha edges. Supersample on 1x displays too,
    // so downscaling the canvas smooths the silhouette without changing poses.
    const bounds = host.getBoundingClientRect(), dpr = 2;
    const width = Math.max(1, Math.round(bounds.width * dpr)), height = Math.max(1, Math.round(bounds.height * dpr));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    // Preserve the source camera's scale and foot line. Extra space is letterbox,
    // never a change to character proportions, cannon scale or motion geometry.
    const scale = Math.min(canvas.width / 824, canvas.height / 1054);
    const w = canvas.width / scale, h = canvas.height / scale;
    renderer.view = [372 - (w - 824) / 2, -35 - (h - 1054), w, h];
    draw();
  }
  function draw() {
    if (destroyed || !renderer || !clock || state !== 'ready') return;
    const t = clock.weight;
    const blend = transitioning() && blendFrom ? {from: blendFrom, weight: t * t * (3 - 2 * t)} : null;
    renderer.draw(clock.key, clock.frame, {blend});
    rendered += 1; updateHost();
  }
  function schedule() { if (raf === null && canPlay()) raf = requestAnimationFrame(tick); }
  function syncPlayback() { if (canPlay()) schedule(); else stop(); updateHost(); }
  function tick(now) {
    raf = null;
    if (!canPlay()) { lastTime = null; updateHost(); return; }
    const dt = lastTime === null ? 0 : Math.max(0, (now - lastTime) / 1000);
    lastTime = now;
    let remaining = dt;
    do {
      const step = advanceSourceMotion(clock, remaining, renderer);
      if (step.exitFrom) blendFrom = step.exitFrom;
      if (!step.events.some(event => event.type === 'action-end')) {
        if (!transitioning()) blendFrom = null;
        break;
      }
      // The clock has finished the action and returned to idle. Carry excess
      // wall time into that idle cycle without starting another interaction.
      requestedMotion = 'idle'; blendFrom = null; remaining = step.remaining;
    } while (remaining > 1e-10);
    try { draw(); schedule(); } catch (reason) { fail(reason); }
  }
  function begin(name) {
    blendFrom = name === 'idle' ? null : renderer.last;
    requestedMotion = name;
    clock.start(name); paused = false; lastTime = performance.now();
    draw(); syncPlayback(); return true;
  }
  async function initialize() {
    state = 'loading'; updateHost();
    const moduleUrl = new URL('renderer.mjs?hip-fringe=v3', root).href;
    const {Renderer} = await import(/* @vite-ignore */ moduleUrl);
    if (destroyed) return false;
    canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true');
    canvas.width = 784; canvas.height = 1003;
    renderer = new Renderer(canvas, {assetBase: new URL('assets/', root).href});
    await renderer.load();
    if (destroyed) { renderer.g.getExtension('WEBGL_lose_context')?.loseContext(); return false; }
    if (renderer.bundle.frames !== 526 || renderer.bundle.idleFrames !== 960 || !(renderer.bundle.fps > 0)) throw new Error('V14 动作帧数与冻结清单不符');
    clock = createSourceMotionClock({frames: renderer.bundle.frames, idleFrames: renderer.bundle.idleFrames, fps: renderer.bundle.fps});
    state = 'ready'; if (host) host.appendChild(canvas); fit(); begin('idle'); return true;
  }
  function ensureLoaded() {
    if (destroyed || state === 'error' || !host) return Promise.resolve(false);
    return loading ||= initialize().catch(reason => { fail(reason); return false; });
  }
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(fit) : null;
  const onVisibility = () => syncPlayback();
  const onReduced = () => syncPlayback();
  document.addEventListener('visibilitychange', onVisibility);
  reduced?.addEventListener?.('change', onReduced);
  return {
    async attach(next) {
      if (destroyed) return false;
      if (next && !next.appendChild) throw new TypeError('立绘需要有效的宿主元素');
      if (host !== next) { if (host) observer?.unobserve(host); clearHost(); host = next; canvas?.remove(); if (host) { if (canvas) host.appendChild(canvas); observer?.observe(host); } }
      syncPlayback(); if (!host) return false;
      const ready = await ensureLoaded(); if (!destroyed) { fit(); syncPlayback(); } return ready;
    },
    async playMotion(name) { if (!['idle', 'touch_head'].includes(name) || !await ensureLoaded() || destroyed) return false; explicit = true; return begin(name); },
    restart() { if (!clock || destroyed) return false; explicit = true; return begin(requestedMotion); },
    setPaused(value) { paused = Boolean(value); if (!paused) explicit = true; syncPlayback(); },
    setVisible(value) { visible = Boolean(value); syncPlayback(); },
    seek(key, frame = 0) { if (!clock || !['idle', 'main3'].includes(key)) return false; paused = true; blendFrom = null; requestedMotion = key === 'idle' ? 'idle' : 'touch_head'; clock.seek(key, frame); stop(); draw(); return true; },
    captureFrame(size = 2048) {
      if (state !== 'ready' || !canvas) return null;
      if (!Number.isFinite(size) || size < 1) throw new RangeError('导出尺寸必须是正数');
      const [width, height] = [canvas.width, canvas.height], view = renderer.view;
      try { canvas.width = canvas.height = Math.round(size); renderer.view = [257, -35, 1054, 1054]; draw(); return canvas.toDataURL('image/png'); }
      finally { canvas.width = width; canvas.height = height; renderer.view = view; draw(); }
    },
    destroy() {
      if (destroyed) return; destroyed = true; stop(); observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility); reduced?.removeEventListener?.('change', onReduced);
      renderer?.g.getExtension('WEBGL_lose_context')?.loseContext(); canvas?.remove(); clearHost(); host = null; state = 'destroyed';
    },
    get ready() { return state === 'ready'; }, get state() { return state; }, get error() { return error; },
    get paused() { return paused; }, get playing() { return Boolean(canPlay()); }, get motionName() { return requestedMotion; },
    get currentTime() { return clock?.currentTime || 0; }, get duration() { return clock?.duration || 0; },
    get frameIndex() { return clock?.frame || 0; }, get sampleFps() { return renderer?.bundle.fps || 0; }, get renderedFrames() { return rendered; },
    get availableMotions() { return ['idle', 'touch_head']; }, get canvas() { return canvas; }, get renderer() { return renderer; },
  };
}
