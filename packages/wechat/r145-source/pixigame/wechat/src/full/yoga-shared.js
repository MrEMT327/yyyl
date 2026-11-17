// Bootstrap owns the native WASM loader. Lobby and battle factories receive
// its already-started promise, without bundling another copy of the loader.
export function loadYoga() {
  const ready = globalThis.__THUNDER_RUNTIME_GLOBALS__?.yogaPromise;
  return ready || Promise.reject(new Error('微信布局引擎尚未由启动器初始化'));
}
