// WeChat exposes callback-based decoding on devices; the browser preview can
// also return a Promise. Present one browser-compatible asynchronous contract.
export function wrapNativeAudioContext(native) {
  const methods = new Map();
  let closing;
  const close = () => closing ||= Promise.resolve().then(() => native.close());
  function decodeAudioData(data, successCallback, errorCallback) {
    const decoded = new Promise((resolve, reject) => {
      let settled = false;
      const fail = reason => {
        if (settled) return;
        settled = true;
        reject(reason instanceof Error ? reason : new Error(reason?.errMsg || String(reason || '音频解码失败')));
      };
      const ready = buffer => {
        if (settled) return;
        if (!buffer || typeof buffer.getChannelData !== 'function') {
          fail(new Error('音频解码未返回 AudioBuffer'));
          return;
        }
        settled = true;
        resolve(buffer);
      };
      if (closing) { fail(new Error('音频上下文已关闭')); return; }
      try {
        const result = native.decodeAudioData(data, ready, fail);
        if (result && typeof result.then === 'function') result.then(ready, fail);
        else if (result && typeof result.getChannelData === 'function') ready(result);
        // A void return means decoding is still pending, not an empty buffer.
      } catch (error) { fail(error); }
    });
    if (!successCallback && !errorCallback) return decoded;
    return decoded.then(buffer => { successCallback?.(buffer); return buffer; }, error => {
      errorCallback?.(error);
      throw error;
    });
  }
  return new Proxy(native, {
    get(target, key) {
      if (key === 'close') return close;
      if (key === 'decodeAudioData') return decodeAudioData;
      // Native context properties can throw after closing.
      if (key === 'state' && closing) return 'closed';
      const value = Reflect.get(target, key, target);
      if (key === 'resume' || key === 'suspend') {
        // Call during the gesture, even when the native method returns void.
        // Give browser-style callers a Promise for both results and failures.
        if (!methods.has(key)) methods.set(key, () => {
          try { return Promise.resolve(value?.call(target)); }
          catch (error) { return Promise.reject(error); }
        });
        return methods.get(key);
      }
      if (typeof value !== 'function') return value;
      if (!methods.has(key)) methods.set(key, value.bind(target));
      return methods.get(key);
    },
    set(target, key, value) { return Reflect.set(target, key, value, target); },
  });
}
