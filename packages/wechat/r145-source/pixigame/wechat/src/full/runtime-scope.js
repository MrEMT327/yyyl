import { createRuntimeConsole } from './console.js';
import URL from 'core-js-pure/actual/url/index.js';
import URLSearchParams from 'core-js-pure/actual/url-search-params/index.js';
import { cloneGameData } from '../platform.js';
import { fromByteArray, toByteArray } from 'base64-js';
import { createNativeEvents } from './native-events.js';
export { createNativeCrypto } from './native-crypto.js';

// Each original H5 entry receives its own globals. A closed battle must not
// leave animation frames, keyboard listeners, timers or media in the lobby.
export function createRuntimeScope(parent = globalThis) {
  const scope = new Proxy(Object.create(null), { get: (target,key) => Object.hasOwn(target,key) ? target[key] : Reflect.get(parent,key,parent) }), timeouts = new Set(), intervals = new Set(), frames = new Set();
  const disposers = new Set(); let disposed = false;
  const raf = parent.requestAnimationFrame.bind(parent), cancel = parent.cancelAnimationFrame.bind(parent);
  class DOMException extends Error { constructor(message = '', name = 'Error') { super(message); this.name = name; } }
  class AbortController {
    constructor() { this.signal = Object.assign(createNativeEvents(), { aborted: false, reason: undefined, throwIfAborted() { if (this.aborted) throw this.reason; } }); }
    abort(reason = new DOMException('Operation aborted', 'AbortError')) { if (this.signal.aborted) return; this.signal.aborted = true; this.signal.reason = reason; this.signal.dispatchEvent({ type: 'abort', target: this.signal }); }
  }
  class ScopedURL extends URL {}
  if(parent.URL?.createObjectURL) ScopedURL.createObjectURL=blob=>parent.URL.createObjectURL(ArrayBuffer.isView(blob?.bytes) && parent.Blob ? new parent.Blob([blob.bytes],{type:blob.type}) : blob);
  if(parent.URL?.revokeObjectURL) ScopedURL.revokeObjectURL=url=>parent.URL.revokeObjectURL(url);
  Object.assign(scope, {
    console: createRuntimeConsole(parent.console),
    URL:ScopedURL, URLSearchParams, DOMException: parent.DOMException || DOMException, AbortController: parent.AbortController || AbortController,
    structuredClone: typeof parent.structuredClone === 'function'
      ? parent.structuredClone.bind(parent)
      : value => cloneGameData(value),
    queueMicrotask(callback) {
      if (typeof callback !== 'function') throw new TypeError('Expected a microtask callback');
      if (disposed) return;
      const run = () => { if (!disposed) callback(); };
      if (typeof parent.queueMicrotask === 'function') parent.queueMicrotask(run);
      else Promise.resolve().then(run).catch(error => parent.setTimeout(() => { throw error; }, 0));
    },
    atob: value => { const bytes = toByteArray(value); let result = ''; for (let start = 0; start < bytes.length; start += 8192) result += String.fromCharCode(...bytes.subarray(start, start + 8192)); return result; },
    btoa: value => fromByteArray(Uint8Array.from(value, ch => ch.charCodeAt(0))),
    setTimeout(callback, delay, ...args) { if (disposed) return 0; let id = parent.setTimeout(() => { timeouts.delete(id); if (!disposed) callback(...args); }, delay); timeouts.add(id); return id; },
    clearTimeout(id) { timeouts.delete(id); parent.clearTimeout(id); },
    setInterval(callback, delay, ...args) { if (disposed) return 0; const id = parent.setInterval(() => { if (!disposed) callback(...args); }, delay); intervals.add(id); return id; },
    clearInterval(id) { intervals.delete(id); parent.clearInterval(id); },
    requestAnimationFrame(callback) { if (disposed) return 0; const id = raf(time => { frames.delete(id); if (!disposed) callback(time); }); frames.add(id); return id; },
    cancelAnimationFrame(id) { frames.delete(id); cancel(id); },
  });
  scope.globalThis = scope;
  return { scope, onDispose(fn) { disposers.add(fn); },
    dispose() {
      if (disposed) return; disposed = true;
      for (const fn of disposers) try { fn(); } catch (error) { parent.console.warn('[wechat-dispose]', error); }
      for (const id of timeouts) parent.clearTimeout(id);
      for (const id of intervals) parent.clearInterval(id);
      for (const id of frames) cancel(id);
      timeouts.clear(); intervals.clear(); frames.clear(); disposers.clear();
    },
  };
}
