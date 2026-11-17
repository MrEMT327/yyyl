import { getWechatTransport } from './transport.js';
import { buf2string, string2buf } from 'pako/lib/utils/strings.js';
import inflateCodec from 'pako/lib/inflate.js';
const { inflate, inflateRaw } = inflateCodec;

export function createNativeNetwork(api, { baseURL, resolve = value => new URL(value, baseURL).href, decode = (_url, bytes) => bytes, requestAsset = options => getWechatTransport(api).request(options), readLocal }) {
  // wx.request already buffers the response. Preserve the byte-stream API used
  // by packed models without depending on a browser's Blob or native streams.
  class ByteStream {
    constructor(bytes) { this.bytes = Promise.resolve(bytes); }
    getReader() {
      let done = false;
      return {
        read: async () => { if (done) return { done: true }; done = true; return { done: false, value: await this.bytes }; },
        cancel: async () => { done = true; }, releaseLock() {},
      };
    }
    pipeThrough(transform) {
      if (typeof transform.decode !== 'function') throw new TypeError('Unsupported native byte-stream transform');
      return new ByteStream(this.bytes.then(bytes => transform.decode(bytes)));
    }
  }
  class DecompressionStream {
    constructor(format) {
      if (!['gzip', 'deflate', 'deflate-raw'].includes(format)) throw new TypeError('Unsupported compression format: ' + format);
      this.decode = bytes => {
        try { return format === 'deflate-raw' ? inflateRaw(bytes) : inflate(bytes); }
        catch (reason) { throw reason instanceof Error ? reason : new Error(String(reason)); }
      };
    }
  }
  async function readStream(stream) {
    const reader = stream.getReader(), parts = []; let size = 0;
    try { for (;;) { const { value, done } = await reader.read(); if (done) break; parts.push(value); size += value.byteLength; } }
    finally { reader.releaseLock?.(); }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    return bytes;
  }
  class Headers {
    constructor(values = {}) { this.values = new Map(values instanceof Headers ? values.values : Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)])); }
    get(key) { return this.values.get(key.toLowerCase()) ?? null; }
    has(key) { return this.values.has(key.toLowerCase()); }
    set(key, value) { this.values.set(key.toLowerCase(), String(value)); }
    entries() { return this.values.entries(); }
    [Symbol.iterator]() { return this.entries(); }
    forEach(fn) { this.values.forEach((value, key) => fn(value, key, this)); }
  }
  class Blob {
    constructor(parts = [], options = {}) {
      const arrays = parts.map(part => part instanceof Blob ? part.bytes : typeof part === 'string' ? string2buf(part) : part instanceof ArrayBuffer ? new Uint8Array(part) : new Uint8Array(part.buffer, part.byteOffset, part.byteLength));
      this.bytes = new Uint8Array(arrays.reduce((sum, bytes) => sum + bytes.byteLength, 0)); let offset = 0;
      for (const bytes of arrays) { this.bytes.set(bytes, offset); offset += bytes.byteLength; }
      this.size = this.bytes.length; this.type = options.type || '';
    }
    async arrayBuffer() { return this.bytes.slice().buffer; }
    async text() { return buf2string(this.bytes); }
    stream() { return new ByteStream(this.bytes); }
    slice(start, end, type) { return new Blob([this.bytes.slice(start, end)], { type }); }
  }
  class Response {
    constructor(bytes, { status = 200, statusText = '', headers = {}, url = '' } = {}) {
      this.source = bytes?.getReader ? bytes : null;
      this.bytes = this.source ? null : bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      this.status = status; this.statusText = statusText; this.headers = new Headers(headers); this.url = url; this.ok = status >= 200 && status < 300; this.bodyUsed = false;
      this.body = this.source || new ByteStream(this.bytes);
    }
    async arrayBuffer() { this.bodyUsed = true; this.bytes ??= await readStream(this.source); return this.bytes.slice().buffer; }
    async text() { this.bodyUsed = true; this.bytes ??= await readStream(this.source); return buf2string(this.bytes); }
    async json() { return JSON.parse(await this.text()); }
    async blob() { return new Blob([await this.arrayBuffer()], { type: this.headers.get('content-type') || '' }); }
    clone() { if (this.bodyUsed) throw new TypeError('Response body has already been read'); return new Response(this.source || this.bytes, this); }
  }
  const pending = new Set();
  let disposed = false;
  function fetch(input, options = {}) {
    if(disposed){const error=new Error('Request aborted');error.name='AbortError';return Promise.reject(error);}
    const url = resolve(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
    return new Promise((accept, reject) => {
      let task, settled = false;
      const finish = (error, result) => { if (settled) return; settled = true; pending.delete(abort); options.signal?.removeEventListener('abort', abort); if (error) reject(error); else accept(result); };
      const abort = () => { const error = new Error('Request aborted'); error.name = 'AbortError'; finish(error); task?.abort(); };
      if (options.signal?.aborted) { abort(); return; }
      pending.add(abort); options.signal?.addEventListener('abort', abort, { once: true });
      if (!/^https?:/.test(url)) {
        if (readLocal) {
          Promise.resolve().then(() => settled ? undefined : readLocal(url, { signal: options.signal }))
            .then(bytes => { if (!settled) finish(null, new Response(bytes, { url })); }, error => finish(error));
          return;
        }
        api.getFileSystemManager().readFile({ filePath: url, success: result => finish(null, new Response(result.data, { url })), fail: error => finish(new Error(error.errMsg || `Cannot read ${url}`)) });
        return;
      }
      task = requestAsset({ url, method: options.method || 'GET', header: Object.fromEntries(new Headers(options.headers)), data: options.body, cache: options.cache,
        responseType: 'arraybuffer', dataType: 'text', timeout: options.timeout || 30000,
        success(result) {
          try {
            const bytes = result.statusCode >= 200 && result.statusCode < 300 ? decode(url, result.data) : result.data;
            finish(null, new Response(bytes, { status: result.statusCode, headers: result.header, url }));
          } catch (error) { finish(error); }
        },
        fail(error) { finish(new Error(`${url}: ${error.errMsg || error.message || 'Network request failed'}`)); },
      });
    });
  }
  class XMLHttpRequest {
    constructor() { this.listeners = new Map(); this.readyState = 0; this.status = 0; this.response = null; this.responseType = ''; this.responseText = ''; this.headers = {}; this.timeout = 0; this.withCredentials = false; }
    addEventListener(type, callback) { const set = this.listeners.get(type) || new Set(); set.add(callback); this.listeners.set(type, set); }
    removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
    dispatch(type, extra = {}) { const event = { type, target: this, ...extra }; this[`on${type}`]?.(event); for (const callback of this.listeners.get(type) || []) callback(event); }
    open(method, url, asynchronous = true) { if (!asynchronous) throw new Error('Synchronous XHR is unavailable'); this.method = method; this.url = url; this.readyState = 1; this.dispatch('readystatechange'); }
    setRequestHeader(key, value) { this.headers[key] = value; }
    getResponseHeader(key) { return this.responseHeaders?.get(key) ?? null; }
    getAllResponseHeaders() { return [...(this.responseHeaders || [])].map(([key, value]) => `${key}: ${value}\r\n`).join(''); }
    overrideMimeType(type) { this.mimeType = type; }
    async send(body) {
      const controller = this.controller = new AbortController();
      this.dispatch('loadstart');
      try {
        const response = await fetch(this.url, { method: this.method, body, headers: this.headers, timeout: this.timeout || undefined, signal: controller.signal });
        if (this.controller !== controller) return;
        this.status = response.status; this.statusText = response.statusText; this.responseHeaders = response.headers; this.responseURL = response.url; this.readyState = 2; this.dispatch('readystatechange');
        this.readyState = 3; this.dispatch('readystatechange');
        const bytes = await response.arrayBuffer(); this.dispatch('progress', { lengthComputable: true, loaded: bytes.byteLength, total: bytes.byteLength });
        if (this.responseType === 'arraybuffer') this.response = bytes;
        else if (this.responseType === 'blob') this.response = new Blob([bytes], { type: this.mimeType || response.headers.get('content-type') });
        else { this.responseText = buf2string(new Uint8Array(bytes)); this.response = this.responseType === 'json' ? JSON.parse(this.responseText) : this.responseText; }
        this.readyState = 4; this.dispatch('readystatechange'); this.dispatch('load'); this.dispatch('loadend');
      } catch (error) {
        if (this.controller !== controller) return;
        this.readyState = 4; this.status = 0; this.dispatch('readystatechange'); this.dispatch(error.name === 'AbortError' ? 'abort' : 'error', { error }); this.dispatch('loadend');
      }
    }
    abort() { this.controller?.abort(); }
  }
  return { fetch, Headers, Response, Blob, DecompressionStream, XMLHttpRequest, dispose() { disposed = true; for (const abort of [...pending].reverse()) abort(); } };
}
