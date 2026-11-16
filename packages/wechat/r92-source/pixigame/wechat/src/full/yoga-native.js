// loadYoga() remains the shared display API; only WASM instantiation differs.
import loadYogaImpl from '../../../node_modules/yoga-layout/dist/binaries/yoga-wasm-base64-esm.js';
import wrapAssembly from '../../../node_modules/yoga-layout/dist/src/wrapAssembly.js';
export * from '../../../node_modules/yoga-layout/dist/src/generated/YGEnums.js';
let pending;
export function loadYoga() {
  return globalThis.__THUNDER_RUNTIME_GLOBALS__?.yogaPromise || (pending ||= new Promise((resolve, reject) => {
    loadYogaImpl({ instantiateWasm(imports, ready) {
      globalThis.WXWebAssembly.instantiate('native-core/yoga.wasm', imports).then(({ instance, module }) => ready(instance, module), reject);
      return {};
    } }).then(assembly => resolve(wrapAssembly(assembly)), reject);
  }));
}
