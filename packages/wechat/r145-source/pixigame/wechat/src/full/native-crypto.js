const batchSize = 16384;
const lowWater = 4096;

// Native entropy arrives asynchronously. Refill ahead of draws so the reward
// planners keep using synchronous, unbiased integer tickets.
export function createNativeRandomPool(api) {
  let pool = new Uint8Array(), offset = 0, refill;
  const remaining = () => pool.length - offset;
  function replenish() {
    if (!refill) refill = new Promise((resolve, reject) => {
      const manager = api.getUserCryptoManager?.();
      if (!manager?.getRandomValues) { reject(Error('当前微信版本不支持游戏随机数')); return; }
      const timer = setTimeout(() => reject(Error('微信随机数请求超时')), 4000);
      const fail = error => { clearTimeout(timer); reject(error); };
      try {
        manager.getRandomValues({
          length: batchSize,
          success({randomValues}) {
            clearTimeout(timer);
            const bytes = new Uint8Array(randomValues);
            if (bytes.length === batchSize) resolve(bytes);
            else reject(Error('微信随机数返回长度不符'));
          },
          fail,
        });
      } catch (error) { fail(error); }
    }).then(bytes => {
      const rest = pool.subarray(offset);
      pool = new Uint8Array(rest.length + bytes.length);
      pool.set(rest); pool.set(bytes, rest.length); offset = 0;
    }).finally(() => { refill = null; });
    return refill;
  }
  const crypto = {
    prepare() { if (remaining() < lowWater) return replenish(); },
    getRandomValues(view) {
      if (!ArrayBuffer.isView(view) || view instanceof DataView || view instanceof Float32Array || view instanceof Float64Array)
        throw new TypeError('Expected integer typed array');
      if (view.byteLength > remaining()) throw Error('随机数尚未准备好，请稍后重试');
      new Uint8Array(view.buffer, view.byteOffset, view.byteLength).set(pool.subarray(offset, offset + view.byteLength));
      offset += view.byteLength;
      if (remaining() < lowWater) replenish().catch(error => console.warn('[random]', error?.message || error));
      return view;
    },
    randomUUID() {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = bytes[6] & 15 | 64; bytes[8] = bytes[8] & 63 | 128;
      const hex = [...bytes].map(v => v.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    },
  };
  return crypto;
}

export async function createNativeCrypto(api) {
  const crypto = createNativeRandomPool(api);
  await crypto.prepare();
  return crypto;
}
