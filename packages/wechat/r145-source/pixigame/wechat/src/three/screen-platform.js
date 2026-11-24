import { WebGLRenderer } from 'three';
import { createGameDisplay } from '../../../../../../../pixigame/src/three/game-screen/page-display.js';
import { createArtworkLoader, useArtworkLoader } from '../../../../../../../pixigame/src/three/game-screen/image-loading.js';
import { createAssetCache } from '../full/asset-cache.js';

function canvasTarget(canvas) {
  if (typeof canvas.addEventListener === 'function' && typeof canvas.removeEventListener === 'function') return canvas;
  return {
    get width() { return canvas.width; },
    set width(value) { canvas.width = value; },
    get height() { return canvas.height; },
    set height(value) { canvas.height = value; },
    addEventListener(type, listener, options) { canvas.addEventListener?.(type, listener, options); },
    removeEventListener(type, listener, options) { canvas.removeEventListener?.(type, listener, options); },
  };
}

function bounds(left, top, width, height) {
  return { x: left, y: top, left, top, width, height, right: left + width, bottom: top + height };
}

function readWindow(api) {
  const { windowWidth, windowHeight, pixelRatio, safeArea, statusBarHeight } = api.getWindowInfo();
  const menu = api.getMenuButtonBoundingClientRect?.();
  const menuButton = menu?.height > 0 && Number.isFinite(menu.left) && Number.isFinite(menu.top) &&
    Number.isFinite(menu.bottom) && menu.left > 0 && menu.top >= 0 && menu.bottom > menu.top && menu.bottom <= windowHeight
    ? { left: menu.left, top: menu.top, bottom: menu.bottom }
    : undefined;
  const top = Math.max(safeArea?.top || 0, menuButton?.bottom || 0);
  return {
    screen: bounds(0, 0, windowWidth, windowHeight),
    density: Math.max(1, Math.min(pixelRatio || 1, 2)),
    safeTop: Math.min(top, windowHeight),
    safeContentTop: Math.min(windowHeight, Math.max(0, safeArea?.top || 0, statusBarHeight || 0)),
    menuButton,
    safeBottom: Math.max(0, windowHeight - (safeArea?.bottom ?? windowHeight)),
  };
}

function decode(api, path, cancelDecodes) {
  return new Promise((resolve, reject) => {
    const image = api.createImage();
    const cancel = () => finish(new Error('贴图读取已取消'));
    const timer = setTimeout(() => finish(new Error('贴图解码超时 ' + path)), 8000);
    function finish(error) {
      if (!cancelDecodes.delete(cancel)) return;
      clearTimeout(timer);
      image.onload = image.onerror = null;
      if (error) reject(error); else resolve(image);
    }
    cancelDecodes.add(cancel);
    image.onload = () => {
      const w = image.naturalWidth || image.width, h = image.naturalHeight || image.height;
      finish(w > 0 && h > 0 ? null : new Error('贴图尺寸无效 ' + path));
    };
    image.onerror = () => finish(new Error('无法读取贴图 ' + path));
    try { image.src = path; } catch (error) { finish(error); }
  });
}

export function openWechatThreeScreen(api, resources, baseURL, debugLog) {
  const nativeCanvas = globalThis.canvas || api.createCanvas();
  const context = nativeCanvas.getContext('webgl2', { alpha: true, antialias: true, premultipliedAlpha: true });
  if (!context || typeof context.texStorage2D !== 'function') {
    throw new Error('此设备的小游戏环境需要支持 WebGL 2');
  }
  const clockSource = typeof globalThis.requestAnimationFrame === 'function' ? globalThis : nativeCanvas;
  if (typeof clockSource.requestAnimationFrame !== 'function' || typeof clockSource.cancelAnimationFrame !== 'function') {
    throw new Error('小游戏环境缺少帧调度接口');
  }
  const renderer = new WebGLRenderer({ canvas: canvasTarget(nativeCanvas), context, alpha: true, antialias: true });
  let viewport = readWindow(api), foreground = true, closed = false;
  const subscriptions = new Set(), surfaces = [];
  const heldPointers = new Map(), detach = [];
  const display = createGameDisplay(renderer, () => viewport.screen);
  const localFiles = createAssetCache(api, resources), cancelDecodes = new Set();
  const failedArtwork = new Set();
  const now = typeof globalThis.performance?.now === 'function'
    ? globalThis.performance.now.bind(globalThis.performance)
    : Date.now;
  let lastTouchAt = -Infinity;

  function readArtwork(file, trace, started, path, fallback = false) {
    if (!trace) return decode(api, file, cancelDecodes);
    const decoding = now();
    return decode(api, file, cancelDecodes).then(image => {
      const source = fallback ? '包内回退' : /^https?:/i.test(path) ? 'CDN/缓存' : '包内';
      trace.slowArtwork(path, source, decoding - started, now() - decoding);
      return image;
    });
  }

  const loadArtwork = createArtworkLoader({
    address: path => resources.resolve(path, baseURL),
    cachePixels: 1500000, // Small lobby images only, with no retained WebGL textures.
    onFailure(path, error) {
      if (closed || failedArtwork.has(path) || failedArtwork.size >= 48) return;
      failedArtwork.add(path);
      console.warn('[Three 贴图读取失败]', path, error?.message || error);
    },
    async openImage(path) {
      if (closed) throw new Error('贴图读取已取消');
      const trace = debugLog?.activeMenu, started = trace ? now() : 0;
      try {
        const file = await localFiles.localFile(path, baseURL);
        if (closed) throw new Error('贴图读取已取消');
        return await readArtwork(file, trace, started, path);
      } catch (error) {
        if (closed) throw error;
        const fallback = await resources.readyFallbackFile(path, baseURL);
        if (!fallback || closed) throw error;
        return readArtwork(fallback, trace, started, path, true);
      }
    },
  });
  async function warmArtworkFiles(sources, signal, workers = 1) {
    // These are file reads only. The normal artwork loader shares their
    // downloads and retains control of decoding and upload.
    const files = [...new Set(sources)];
    let next = 0;
    await Promise.all(Array.from({length: Math.min(workers, files.length)}, async () => {
      while (!closed && !signal.aborted && next < files.length) {
        try { await localFiles.localFile(files[next++], baseURL); }
        catch { /* The regular artwork loader handles retries and fallbacks. */ }
      }
    }));
  }

  const restoreArtwork = useArtworkLoader(loadArtwork);

  function notifyViewport() {
    viewport = readWindow(api);
    for (const listener of subscriptions) listener(viewport, foreground);
  }

  function on(add, remove, listener) {
    if (typeof api[add] !== 'function') return;
    api[add](listener);
    detach.push(() => api[remove]?.(listener));
  }

  function cancelTouches(owner) {
    for (const [id, held] of heldPointers) {
      if (!owner || held.owner === owner) {
        heldPointers.delete(id);
        held.owner({ ...held.point, phase: 'cancel' });
      }
    }
  }

  function tap(phase, event) {
    if (!foreground || closed) return;
    lastTouchAt = now();
    for (const changed of event.changedTouches || []) {
      const pointerId = changed.identifier ?? 0;
      const x = changed.clientX ?? changed.x, y = changed.clientY ?? changed.y;
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const point = { phase, x, y, pointerId };
      if (phase === 'start') {
        let route;
        for(let index=surfaces.length-1;index>=0;index--){
          const candidate=surfaces[index];
          if(candidate.accepts(point)){route=candidate.handler;break;}
        }
        if (route) {
          heldPointers.set(pointerId, { owner: route, point });
          route(point);
        }
      } else {
        const held = heldPointers.get(pointerId);
        if (!held) continue;
        if (phase === 'end' || phase === 'cancel') heldPointers.delete(pointerId);
        else held.point = point;
        held.owner(point);
      }
    }
  }

  on('onTouchStart', 'offTouchStart', event => tap('start', event));
  on('onTouchMove', 'offTouchMove', event => tap('move', event));
  on('onTouchEnd', 'offTouchEnd', event => tap('end', event));
  on('onTouchCancel', 'offTouchCancel', event => tap('cancel', event));
  on('onWindowResize', 'offWindowResize', notifyViewport);
  on('onHide', 'offHide', () => { foreground = false; cancelTouches(); notifyViewport(); });
  on('onShow', 'offShow', () => { foreground = true; notifyViewport(); });
  return {
    renderer, display, loadArtwork, warmArtworkFiles, now, debugLog,
    get viewport() { return viewport; },
    get visible() { return foreground; },
    get inputIdle() { return !heldPointers.size && now() - lastTouchAt >= 100; },
    requestFrame(paint) { return clockSource.requestAnimationFrame(() => { if (!closed) paint(now()); }); },
    cancelFrame(handle) { clockSource.cancelAnimationFrame(handle); },
    onViewport(handler) {
      subscriptions.add(handler);
      handler(viewport, foreground);
      return () => subscriptions.delete(handler);
    },
    bindTouches(handler,priority=0,accepts=()=>true) {
      cancelTouches();
      const route={handler,priority,accepts};
      const next=surfaces.findIndex(surface=>surface.priority>priority);
      if(next<0)surfaces.push(route);else surfaces.splice(next,0,route);
      return () => {
        const index = surfaces.indexOf(route);
        if (index === -1) return;
        surfaces.splice(index, 1);
        cancelTouches(handler);
      };
    },
    close() {
      if (closed) return;
      closed = true;
      cancelTouches();
      for (const remove of detach) remove();
      for (const cancel of cancelDecodes) cancel();
      restoreArtwork();
      subscriptions.clear();
      surfaces.length = 0;
      display.close();
      renderer.dispose();
    },
  };
}
