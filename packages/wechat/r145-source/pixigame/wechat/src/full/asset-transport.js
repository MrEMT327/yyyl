import { sha256Fallback } from '../../../src/three/aircraft/v34/aircraft/digest.js';
import { string2buf } from 'pako/lib/utils/strings.js';
import { getWechatTransport } from './transport.js';

// Shared by lobby fetch, battle XHR and direct binary readers. API requests,
// authenticated requests and explicit no-cache requests never enter this cache.
export function createAssetTransport(api, { accepts, decode = (_url, bytes) => bytes, retryURL, version = '', concurrency = 6,
  memoryLimit = 8 * 1024 * 1024, diskLimit = 64 * 1024 * 1024, cacheTimeoutMs = 1500 } = {}) {
  const jobs = new Map(), queue = [], memory = new Map(), disk = new Map();
  const fs = api.getFileSystemManager();
  const upstream = getWechatTransport(api);
  const folder = api.env?.USER_DATA_PATH && `${api.env.USER_DATA_PATH.replace(/\/+$/, '')}/shnh-binary-assets-v1`;
  const persistent = Boolean(folder && version && fs.readFile && fs.writeFile && fs.unlink);
  let active = 0, memoryBytes = 0, diskBytes = 0, disposed = false, indexTimer = null, indexWriting = false, indexDirty = false;
  let diskSerial = Promise.resolve(), queuedDiskBytes = 0;
  const stats = { requests: 0, joined: 0, memoryHits: 0, diskHits: 0, downloadedBytes: 0, failures: 0, cacheTimeouts: 0 };
  const io = (method, options) => new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (error) reject(error); else resolve(result);
    };
    // File-system callbacks can also disappear on a device. An optional cache
    // must never hold every battle request behind an unresolved promise.
    const timer = setTimeout(() => {
      if (stats.cacheTimeouts++ === 0) console.warn('[wechat-asset-cache]', { operation: method, timeoutMs: cacheTimeoutMs });
      finish(new Error(`Cache ${method} timed out`));
    }, cacheTimeoutMs);
    timer.unref?.();
    try { fs[method]({ ...options, success: result => finish(null, result), fail: error => finish(error) }); }
    catch (error) { finish(error); }
  });
  const keyFor = url => sha256Fallback(string2buf(`${version}\n${url}`).buffer);
  const ready = !persistent ? Promise.resolve() : (async () => {
    try { fs.mkdirSync(folder, true); } catch {}
    try {
      const result = await io('readFile', { filePath: `${folder}/index.json`, encoding: 'utf8' });
      const rows = JSON.parse(result.data);
      for (const row of Array.isArray(rows) ? rows : []) {
        if (!/^[a-f\d]{64}$/.test(row.key) || !Number.isSafeInteger(row.size) || row.size <= 0 || row.size > diskLimit || disk.has(row.key)) continue;
        disk.set(row.key, row); diskBytes += row.size;
      }
    } catch { /* A fresh or corrupt index is a cold cache. */ }
  })();
  // Maintenance shares the write queue, not the read prerequisite. A large
  // orphan sweep or a silent unlink must not delay a fresh chapter download.
  if (persistent) diskSerial = ready.then(async () => {
    if (disposed) return;
    // An interrupted metadata write may leave orphan files. Only remove our
    // hash-named cache files, never other user data or temporary model textures.
    if (fs.readdir) try {
      const {files=[]}=await io('readdir',{dirPath:folder});
      for(const file of files) if(/^[a-f\d]{64}\.bin$/.test(file) && !disk.has(file.slice(0,-4))) {
        if (disposed) return;
        try {await io('unlink',{filePath:`${folder}/${file}`});} catch {}
      }
    } catch {}
    while(!disposed && diskBytes>diskLimit && disk.size){const oldest=[...disk.values()].reduce((a,b)=>a.used<=b.used?a:b);await removeDisk(oldest.key);}
  });
  async function writeIndex() {
    indexTimer = null;
    if (indexWriting || !persistent || !indexDirty) return;
    indexDirty = false; indexWriting = true;
    try { await io('writeFile', { filePath: `${folder}/index.json`, data: JSON.stringify([...disk.values()]), encoding: 'utf8' }); }
    catch { /* Cache metadata is optional, never block play. */ }
    finally { indexWriting = false; if (indexDirty) scheduleIndex(); }
  }
  function scheduleIndex() {
    indexDirty = true;
    if (!indexTimer && !indexWriting) { indexTimer = setTimeout(writeIndex, 500); indexTimer.unref?.(); }
  }
  async function removeDisk(key) {
    const row = disk.get(key); if (!row) return;
    disk.delete(key); diskBytes -= row.size; scheduleIndex();
    try { await io('unlink', { filePath: `${folder}/${key}.bin` }); } catch {}
  }
  function saveDisk(key, result) {
    if (!persistent || disposed || !(result.data.byteLength > 0) || result.data.byteLength > diskLimit / 2 || queuedDiskBytes + result.data.byteLength > diskLimit / 2) return;
    queuedDiskBytes += result.data.byteLength;
    diskSerial = diskSerial.then(async () => {
      await ready;
      if (disposed) return;
      const size = result.data.byteLength;
      while (diskBytes + size > diskLimit && disk.size) {
        const oldest = [...disk.values()].reduce((a,b) => a.used <= b.used ? a : b);
        await removeDisk(oldest.key);
      }
      try {
        await io('writeFile', { filePath: `${folder}/${key}.bin`, data: result.data });
        const previous = disk.get(key); if (previous) diskBytes -= previous.size;
        disk.set(key, { key, size, header: result.header || {}, used: Date.now() }); diskBytes += size; scheduleIndex();
      } catch { /* Full/unavailable storage falls back to this downloaded data. */ }
    }).catch(() => {}).finally(()=>{queuedDiskBytes-=result.data.byteLength;});
  }
  function retain(url, result) {
    const size = result.data.byteLength;
    if (size > memoryLimit / 2 || !size) return;
    const previous = memory.get(url); if (previous) { memoryBytes -= previous.data.byteLength; memory.delete(url); }
    while (memoryBytes + size > memoryLimit && memory.size) {
      const first = memory.keys().next().value; memoryBytes -= memory.get(first).data.byteLength; memory.delete(first);
    }
    memory.set(url, result); memoryBytes += size;
  }
  function deliver(subscriber, error, result) {
    if (subscriber.done) return;
    subscriber.done = true;
    if (error) subscriber.options.fail?.(error);
    else subscriber.options.success?.({ ...result, header: { ...result.header }, data: result.data.slice(0) });
  }
  function finish(job, error, result) {
    if (job.done) return;
    job.done = true;
    if (jobs.get(job.url) === job) jobs.delete(job.url);
    if (job.active) { active--; job.active = false; }
    if (error) stats.failures++;
    for (const subscriber of job.subscribers) deliver(subscriber, error, result);
    job.subscribers.clear(); drain();
  }
  function validate(url, result) {
    if (!(result.data instanceof ArrayBuffer)) throw new Error(`资源未以二进制返回：${url}`);
    return { ...result, data: result.statusCode >= 200 && result.statusCode < 300 ? decode(url, result.data) : result.data };
  }
  function drain() {
    while (!disposed && active < concurrency && queue.length) {
      const job = queue.shift(); if (job.done || !job.subscribers.size) continue;
      job.active = true; active++; stats.requests++;
      try {
        job.task = upstream.request({ url: job.url, retryURL, method: 'GET', responseType: 'arraybuffer', dataType: 'text', timeout: job.timeout,
          success(result) {
            if (job.done) return;
            try {
              const validated = validate(job.url, result);
              if (result.statusCode === 200) { stats.downloadedBytes += result.data.byteLength; retain(job.url, validated); saveDisk(job.key, result); }
              finish(job, null, validated);
            } catch (error) { finish(job, { errMsg: error.message }); }
          }, fail: error => finish(job, error),
        });
      } catch (error) { finish(job, { errMsg: error.message }); }
    }
  }
  async function start(job) {
    await ready;
    if (job.done || disposed) return;
    const row = persistent && disk.get(job.key);
    if (row) {
      try {
        const result = await io('readFile', { filePath: `${folder}/${job.key}.bin` });
        if (!(result.data instanceof ArrayBuffer) || result.data.byteLength !== row.size) throw new Error('Invalid cached bytes');
        const validated = validate(job.url, { statusCode: 200, header: row.header, data: result.data });
        if (job.done || disposed) return;
        row.used = Date.now(); stats.diskHits++; scheduleIndex(); retain(job.url, validated); finish(job, null, validated); return;
      } catch { await removeDisk(job.key); }
    }
    if (!job.done && !disposed) { queue.push(job); drain(); }
  }
  function eligible(options) {
    return (options.method || 'GET').toUpperCase() === 'GET' && options.data == null
      && !Object.keys(options.header || {}).length && !['no-store','reload','no-cache'].includes(options.cache)
      && accepts?.(options.url);
  }
  function request(options) {
    if (!eligible(options)) return upstream.request(options);
    const url = options.url.split('#')[0], subscriber = { options, done: false };
    let job;
    const handle = { abort() {
      if (subscriber.done) return;
      deliver(subscriber, { errMsg: 'request:fail abort' });
      if (!job) return;
      job.subscribers.delete(subscriber);
      if (!job.subscribers.size && !job.done) { finish(job, { errMsg: 'request:fail abort' }); job.task?.abort?.(); }
    } };
    if (disposed) { deliver(subscriber, { errMsg: 'request:fail disposed' }); return handle; }
    const cached = memory.get(url);
    if (cached) {
      stats.memoryHits++; memory.delete(url); memory.set(url, cached);
      Promise.resolve().then(() => { if (!disposed) deliver(subscriber, null, cached); else deliver(subscriber, { errMsg: 'request:fail disposed' }); });
      return handle;
    }
    job = jobs.get(url);
    if (job) { stats.joined++; job.subscribers.add(subscriber); }
    else {
      job = { url, key: persistent ? keyFor(url) : '', timeout: options.timeout || 30000, subscribers: new Set([subscriber]), done: false, active: false };
      jobs.set(url, job);
      // Keep the existing synchronous wx.request dispatch when no disk lookup is needed.
      if (persistent) void start(job); else { queue.push(job); drain(); }
    }
    return handle;
  }
  return { request, stats, get memoryBytes(){return memoryBytes;}, get diskBytes(){return diskBytes;},
    async flush() { await diskSerial; if (indexTimer) clearTimeout(indexTimer); await writeIndex(); },
    dispose() {
      if (disposed) return; disposed = true;
      for (const job of [...jobs.values()]) { finish(job, { errMsg: 'request:fail abort' }); job.task?.abort?.(); }
      queue.length = 0; memory.clear(); memoryBytes = 0;
      if (indexTimer) clearTimeout(indexTimer); void writeIndex();
    },
  };
}
