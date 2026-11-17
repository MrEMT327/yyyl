// Mini-game consoles may omit browser helpers such as assert. Keep the host
// untouched (it can be read-only), and retain native receivers for its methods.
export function createRuntimeConsole(nativeConsole = {}) {
  const methods = new Map();
  function assert(condition, ...data) {
    if (condition) return;
    const name = ['error', 'warn', 'log'].find(key => typeof nativeConsole[key] === 'function');
    if (name) nativeConsole[name]('Assertion failed:', ...data);
  }
  return new Proxy(Object.create(null), {
    get(_target, key) {
      const value = Reflect.get(nativeConsole, key, nativeConsole);
      if (key === 'assert' && typeof value !== 'function') return assert;
      if (typeof value !== 'function') return value;
      const cached = methods.get(key);
      if (cached?.original === value) return cached.bound;
      const bound = value.bind(nativeConsole);
      methods.set(key, { original: value, bound });
      return bound;
    },
  });
}
