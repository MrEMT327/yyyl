import { ObjectLoader, Source, Texture } from 'three';
import { createProjectPresentation } from '../../../src/replica/project-presentation.js';

export function createNativeEvents() {
  const listeners = new Map();
  return {
    addEventListener(type, listener, options = {}) {
      if (options.signal?.aborted) return;
      const entries = listeners.get(type) || new Map();
      if (entries.has(listener)) return;
      const remove = () => this.removeEventListener(type, listener);
      entries.set(listener, { once: options.once, signal: options.signal, remove });
      listeners.set(type, entries);
      options.signal?.addEventListener('abort', remove, { once: true });
    },
    removeEventListener(type, listener) {
      const entries = listeners.get(type);
      const entry = entries?.get(listener);
      entry?.signal?.removeEventListener('abort', entry.remove);
      entries?.delete(listener);
      if (entries?.size === 0) listeners.delete(type);
    },
    dispatchEvent(event) {
      for (const [listener, options] of [...(listeners.get(event.type) || [])]) {
        if (!listeners.get(event.type)?.has(listener)) continue;
        if (options.once) this.removeEventListener(event.type, listener);
        if (typeof listener === 'function') listener.call(this, event);
        else listener.handleEvent(event);
      }
      return !event.defaultPrevented;
    },
  };
}

export function createWechatPresentationHost(api, resources, assetOrigin) {
  const canvases = new Set();
  const events = createNativeEvents();
  const images = new Set();
  let disposed = false;
  const baseURL = `${assetOrigin.replace(/\/+$/, '')}/`;

  function createCanvas(type) {
    if (disposed) throw new Error('战斗渲染已关闭');
    // The entry creates the screen canvas first. These additional surfaces
    // preserve the original off-screen WebGL and 2D rendering passes.
    const canvas = api.createCanvas();
    canvas.style ||= {};
    if (!canvas.addEventListener) Object.assign(canvas, createNativeEvents());
    canvas.remove ||= () => canvases.delete(canvas);
    canvas.setAttribute ||= (key, value) => { canvas[key] = value; };
    if (type === 'webgl2' && !canvas.getContext('webgl2', { alpha: true, antialias: true, preserveDrawingBuffer: true })) {
      throw new Error('当前设备无法创建游戏所需的 WebGL 2 画布');
    }
    canvases.add(canvas);
    return canvas;
  }

  function loadImage(url) {
    if (disposed) return Promise.reject(new Error('战斗渲染已关闭'));
    return new Promise((resolve, reject) => {
      const image = api.createImage();
      let settled = false;
      const cancel = () => finish(new Error('图片加载已取消'));
      const finish = error => {
        if (settled) return;
        settled = true;
        images.delete(cancel);
        image.onload = image.onerror = null;
        if (error) reject(error);
        else resolve(image);
      };
      images.add(cancel);
      image.onload = () => finish();
      image.onerror = error => finish(new Error(`纹理加载失败：${url} · ${error?.errMsg || ''}`));
      try { image.src = url.startsWith(`${api.env.USER_DATA_PATH}/`) ? url : resources.resolve(url); }
      catch (error) { finish(error); }
    });
  }

  class NativeObjectLoader extends ObjectLoader {
    async parseImagesAsync(entries = []) {
      const pairs = await Promise.all(entries.map(async entry => {
        const image = Array.isArray(entry.url)
          ? await Promise.all(entry.url.map(loadImage)) : await loadImage(entry.url);
        return [entry.uuid, new Source(image)];
      }));
      return Object.fromEntries(pairs);
    }
  }

  const host = {
    baseURL, stage: { dataset: {} }, events, createCanvas,
    objectLoader: new NativeObjectLoader(), assetBytes: resources,
    textureLoader: {
      load(url, ready, _progress, failed) {
        const texture = new Texture();
        loadImage(url).then(image => {
          texture.image = image;
          texture.needsUpdate = true;
          ready?.(texture);
        }).catch(error => { texture.dispose(); failed?.(error); });
        return texture;
      },
    },
    readFighterFile(slug, name) {
      return resources.readBytes(`fighters/${slug}/${name}`, { baseURL });
    },
    createPresentation(options) { return createProjectPresentation({ ...options, host }); },
    dispose() {
      if (disposed) return;
      disposed = true;
      events.dispatchEvent({ type: 'shnh-dispose-replica-battle' });
      for (const cancel of [...images]) cancel();
      for (const canvas of canvases) canvas.width = canvas.height = 0;
      canvases.clear();
    },
  };
  return host;
}
