import { buf2string } from 'pako/lib/utils/strings.js';

// Shared game state uses plain records and arrays with optional fields.
// Preserve undefined and primitive values without a JSON round trip.
export function cloneGameData(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  const clone = Array.isArray(value) ? new Array(value.length) : {};
  seen.set(value, clone);
  for (const key of Object.keys(value)) {
    Object.defineProperty(clone, key, {
      value: cloneGameData(value[key], seen), enumerable: true, configurable: true, writable: true,
    });
  }
  return clone;
}

export function createWechatHost(api, assetOrigin, { files, art }) {
  const fs = api.getFileSystemManager();
  const packages = new Map();
  const storage = {
    getItem(key) {
      const value = api.getStorageSync(key);
      return typeof value === 'string' && value ? value : null;
    },
    setItem(key, value) { api.setStorageSync(key, String(value)); },
    removeItem(key) { api.removeStorageSync(key); },
  };

  function loadPackage(name) {
    if (!packages.has(name)) {
      const request = new Promise((resolve, reject) => api.loadSubpackage({
        name,
        success: resolve,
        fail: error => reject(new Error(`分包加载失败 ${name} · ${error.errMsg || ''}`)),
      })).catch(error => {
        packages.delete(name);
        throw error;
      });
      packages.set(name, request);
    }
    return packages.get(name);
  }

  function requestResource(path) {
    if (!assetOrigin) return Promise.resolve({ ok: false, status: 404 });
    return new Promise((resolve, reject) => api.request({
      url: `${assetOrigin}/replica-battle/${path}`,
      dataType: 'json',
      timeout: 12000,
      success({ statusCode, data }) {
        resolve({ ok: statusCode >= 200 && statusCode < 300, status: statusCode,
          async json() { return typeof data === 'string' ? JSON.parse(data) : data; } });
      },
      fail(error) { reject(new Error(`读取关卡资源失败 ${path} · ${error.errMsg || ''}`)); },
    }));
  }

  async function readPackageFile(path) {
    const folder = files[path];
    if (!folder) return undefined;
    await loadPackage(folder);
    const filePath = `${folder}/${path}.br`;
    const buffer = await new Promise((resolve, reject) => fs.readCompressedFile({
      filePath, compressionAlgorithm: 'br', success: result => resolve(result.data),
      fail: error => reject(new Error(`分包文件读取失败 ${path} · ${error.errMsg || ''}`)),
    }));
    return JSON.parse(buf2string(new Uint8Array(buffer)));
  }

  async function fetchResource(path) {
    if (!files[path]) return requestResource(path);
    return {
      ok: true,
      status: 200,
      async json() {
        const data = await readPackageFile(path);
        if (Array.isArray(data?.bossAnimations?.models)) {
          const models = await readPackageFile('data/shared-boss-models.json');
          data.bossAnimations.models = Object.fromEntries(data.bossAnimations.models.map(name => [name, models[name]]));
        }
        return data;
      },
    };
  }

  function bindTouch(handle) {
    let activeId;
    const forward = (phase, touch) => handle({ phase, x: touch.clientX ?? touch.x,
      y: touch.clientY ?? touch.y });
    api.onTouchStart(event => {
      if (activeId !== undefined || event.touches.length !== 1) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      activeId = touch.identifier;
      forward('start', touch);
    });
    const follow = phase => event => {
      if (activeId === undefined) return;
      const touch = event.changedTouches.find(item => item.identifier === activeId);
      if (!touch) return;
      if (phase !== 'move') activeId = undefined;
      forward(phase, touch);
    };
    api.onTouchMove(follow('move'));
    api.onTouchEnd(follow('end'));
    api.onTouchCancel(() => {
      activeId = undefined;
      handle({ phase: 'cancel' });
    });
    api.onHide(() => {
      activeId = undefined;
      handle({ phase: 'cancel' });
    });
  }

  function resolveAsset(path) {
    const clean = path.replace(/^\.?\//, '');
    return art[clean] || (/^https?:\/\//.test(clean) ? clean : `${assetOrigin}/${clean}`);
  }

  return { storage, loadPackage, fetchResource, resolveAsset, bindTouch };
}
