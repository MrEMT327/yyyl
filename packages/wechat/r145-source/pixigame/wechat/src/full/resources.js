import { buf2string } from 'pako/lib/utils/strings.js';
import inflateCodec from 'pako/lib/inflate.js';
import { sha256Fallback } from '../../../src/three/aircraft/v34/aircraft/digest.js';
import { createAssetTransport } from './asset-transport.js';
import { cleanStaleTextures, imageDataUrl, isStorageQuotaError } from './asset-storage.js';

let resourceSerial = 0;

function abortError() {
  const error = new Error('资源加载已取消');
  error.name = 'AbortError';
  return error;
}

export function createWechatResources(api, { assetOrigin, localFiles = {}, fallbackFiles = {}, cdnBase, assetTransfers = {}, cdnFiles, requirePublicNetwork = false, cacheVersion = '', loadPackage }) {
  const origin = assetOrigin.replace(/\/+$/, '');
  const assetHost = new URL(origin).origin;
  const remote = cdnBase ? new URL(cdnBase.replace(/\/+$/, '') + '/') : null;
  const releaseFiles = cdnFiles ? new Set(cdnFiles) : null;
  const compressed = new Map(Object.values(assetTransfers).filter(row => row.encoding === 'gzip').map(row => [row.path, row.bytes]));
  const battleData = new Set(Object.entries(assetTransfers)
    .filter(([key,row]) => /^replica-battle\/data\/.+\.json$/.test(key) && row.encoding === 'gzip' && row.bytes > 0)
    .map(([,row]) => row.path));
  const packagedPaths = new Set([...Object.values(localFiles), ...Object.values(fallbackFiles)]);
  const packagedCompressed = new Map(Object.entries(localFiles)
    .filter(([key,path]) => /\.(json|bin)$/.test(key) && path.endsWith('.br'))
    .map(([key,path]) => [path,key]));
  const userFiles = api.env?.USER_DATA_PATH ? api.env.USER_DATA_PATH.replace(/\/+$/, '') + '/' : null;
  const files = api.getFileSystemManager();
  const pending = new Set();
  const byteFiles = new Map();
  const byteUrls = new Map();
  let textureWritesFull = false;
  cleanStaleTextures(api, files, api.env?.USER_DATA_PATH);
  const namespace = `${Date.now().toString(36)}-${++resourceSerial}`;
  let disposed = false;
  const transport = createAssetTransport(api, { version: cacheVersion, decode: decodeBytes,
    accepts(url) {
      if (!remote || !requirePublicNetwork) return false;
      const address = new URL(url);
      return address.origin === remote.origin && address.pathname.startsWith(remote.pathname)
        && /^(?:art|assets|audio|fighters|replica-battle)\//.test(decodeURIComponent(address.pathname.slice(remote.pathname.length)));
    },
  });

  function resolve(path, baseURL = `${origin}/`) {
    path = String(path);
    if (packagedPaths.has(path) || userFiles && path.startsWith(userFiles)) return path;
    const url = new URL(path, baseURL);
    const onCdn = remote && url.origin === remote.origin && url.pathname.startsWith(remote.pathname);
    if (url.origin === assetHost || onCdn) {
      const encodedKey = url.pathname.slice(onCdn ? remote.pathname.length : 1);
      const key = decodeURIComponent(encodedKey);
      // Service endpoints are not static objects, even on the asset host.
      if (key === 'api' || key.startsWith('api/')) return publicURL(url);
      if (Object.hasOwn(localFiles, key)) return localFiles[key];
      if (remote) {
        const transfer = assetTransfers[key];
        const file = transfer?.path ?? key;
        if (releaseFiles && !releaseFiles.has(file)) throw new Error('资源未列入微信发布清单：' + key);
        const mapped = new URL(transfer ? file.split('/').map(encodeURIComponent).join('/') : encodedKey, remote);
        mapped.search = url.search; mapped.hash = url.hash;
        return publicURL(mapped);
      }
    }
    if (releaseFiles && /^https?:$/.test(url.protocol)) throw new Error('资源未列入微信发布清单：' + url.pathname);
    return publicURL(url);
  }

  function canLoad(path, baseURL) {
    if (!path) return false;
    try { resolve(path, baseURL); return true; }
    catch { return false; }
  }

  function publicURL(url) {
    if (requirePublicNetwork && /^https?:$/.test(url.protocol)) {
      const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
      const privateHost = /^(?:127\.|10\.|192\.168\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host) || host === 'localhost' || host === '0.0.0.0'
        || /\.(?:localhost|local)$/.test(host) || host === '::1' || /^(?:fc|fd)[a-f\d]{2}:|^fe80:/i.test(host);
      if (url.protocol !== 'https:' || privateHost) throw new Error(`当前微信包只使用公网 HTTPS 资源：${url.href}`);
    }
    return url.href;
  }

  function isVersionedBattleData(path, baseURL) {
    if (!cacheVersion || !requirePublicNetwork || !remote) return false;
    const resolved = resolve(path, baseURL);
    if (packagedCompressed.has(resolved)) return /^replica-battle\/data\/.+\.json$/.test(packagedCompressed.get(resolved));
    const address = new URL(resolved, `${origin}/`);
    return address.origin === remote.origin && address.pathname.startsWith(remote.pathname)
      && battleData.has(decodeURIComponent(address.pathname.slice(remote.pathname.length)));
  }

  // Only explicitly mapped transport files are decoded. Existing game .gz
  // files retain their bytes for the game's own DecompressionStream loader.
  function decodeBytes(url, data) {
    if (!remote || !/^https?:/.test(url)) return data;
    const address = new URL(url);
    if (address.origin !== remote.origin || !address.pathname.startsWith(remote.pathname)) return data;
    const expected = compressed.get(decodeURIComponent(address.pathname.slice(remote.pathname.length)));
    if (expected === undefined) return data;
    try {
      let bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      if (bytes[0] === 31 && bytes[1] === 139) bytes = inflateCodec.inflate(bytes);
      // Some CDNs apply Content-Encoding; wx.request has already decoded them.
      if (bytes.byteLength !== expected) throw new Error(`数据长度 ${bytes.byteLength}，预期 ${expected}`);
      return bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength ? bytes.buffer : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    } catch (error) { throw new Error(`资源解压失败：${url} · ${error?.message || error}`); }
  }

  async function readyLocalFile(path) {
    if (disposed) throw abortError();
    if (packagedPaths.has(path) && loadPackage) await loadPackage(path.split('/')[0]);
    if (disposed) throw abortError();
    return path;
  }

  function readyFallbackFile(path, baseURL = origin + '/') {
    if (!remote || disposed) return;
    const url = new URL(path, baseURL);
    if (url.origin !== remote.origin || !url.pathname.startsWith(remote.pathname)) return;
    const key = decodeURIComponent(url.pathname.slice(remote.pathname.length));
    if (Object.hasOwn(fallbackFiles, key)) return readyLocalFile(fallbackFiles[key]);
  }

  function preloadAssetPackage(name) {
    if (disposed || !loadPackage) return;
    const prefix = name + '/';
    for (const path of packagedPaths) {
      if (path.startsWith(prefix)) return loadPackage(name);
    }
  }

  async function readBytes(path, { signal, baseURL } = {}) {
    if (disposed || signal?.aborted) return Promise.reject(abortError());
    const url = resolve(path, baseURL);
    return new Promise((resolveRequest, rejectRequest) => {
      let task, settled = false;
      const finish = (error, data) => {
        if (settled) return;
        settled = true;
        pending.delete(cancel);
        signal?.removeEventListener('abort', cancel);
        if (error) rejectRequest(error);
        else resolveRequest(data);
      };
      const cancel = () => {
        finish(abortError());
        task?.abort?.();
      };
      pending.add(cancel);
      signal?.addEventListener('abort', cancel, { once: true });
      function requestBytes(url) {
          if (settled) return;
          task = transport.request({
            url, method: 'GET', dataType: 'text', responseType: 'arraybuffer', timeout: 30000,
            success(result) {
              if (result.statusCode < 200 || result.statusCode >= 300) {
                finish(new Error(`资源加载失败 (${result.statusCode})：${url}`));
              } else if (!(result.data instanceof ArrayBuffer)) {
                finish(new Error(`资源未以二进制返回：${url}`));
              } else {
                try { finish(null, decodeBytes(url, result.data)); } catch (error) { finish(error); }
              }
            },
            fail(error) { finish(new Error(`资源加载失败：${url} · ${error.errMsg || ''}`)); },
          });
      }
      const localFailure = error => {
        const key = packagedCompressed.get(url);
        if (!key || !remote || settled) return finish(error);
        try {
          const file = assetTransfers[key]?.path ?? key;
          if (releaseFiles && !releaseFiles.has(file)) return finish(error);
          requestBytes(publicURL(new URL(file, remote)));
        }
        catch (error) { finish(error); }
      };
      try {
        if (/^https?:\/\//.test(url)) requestBytes(url);
        else {
          readyLocalFile(url).then(() => {
            if (settled) return;
            const options = {
              filePath: url,
              success(result) { finish(null, result.data); },
              fail(error) { localFailure(new Error(`包内资源读取失败：${url} · ${error.errMsg || ''}`)); },
            };
            if (packagedCompressed.has(url)) files.readCompressedFile({...options, compressionAlgorithm:'br'});
            else files.readFile(options);
          }).catch(localFailure);
        }
      } catch (error) { finish(error); }
      if (signal?.aborted) cancel();
    });
  }

  function retainAssetBytesUrl(bytes, mimeType, digest) {
    if (disposed) throw abortError();
    const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
    const extension = extensions[mimeType];
    if (!extension) throw new Error(`不支持的纹理格式：${mimeType}`);
    const name = `${api.env.USER_DATA_PATH}/shnh-texture-${namespace}-${digest ?? sha256Fallback(bytes)}.${extension}`;
    const retained = byteFiles.get(name);
    if (retained) { retained.references++; return retained.url; }
    const buffer = bytes instanceof Uint8Array
      ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes;
    let url = name;
    if (!textureWritesFull) {
      try { files.writeFileSync(name, buffer); }
      catch (error) {
        if (!isStorageQuotaError(error)) throw error;
        textureWritesFull = true;
        try { files.unlinkSync(name); } catch { /* A failed write may leave a partial file. */ }
      }
    }
    if (textureWritesFull) url = imageDataUrl(buffer, mimeType);
    byteFiles.set(name, { references: 1, url }); byteUrls.set(url, name);
    return url;
  }

  const createAssetBytesUrl = (bytes, mimeType) => retainAssetBytesUrl(bytes, mimeType);
  function createVerifiedAssetBytesUrl(bytes, mimeType, digest) {
    // Only the aircraft loader calls this, after comparing the actual bytes
    // against the package's verified manifest. Use its existing digest as the filename.
    if(typeof digest!=='string'||!/^[0-9a-f]{64}$/.test(digest))throw new Error('纹理校验摘要无效');
    return retainAssetBytesUrl(bytes, mimeType, digest);
  }

  function revokeAssetBytesUrl(url) {
    const name = byteUrls.get(url);
    const retained = byteFiles.get(name);
    if (!retained || --retained.references > 0) return;
    byteFiles.delete(name); byteUrls.delete(url);
    if (url !== name) return;
    try { files.unlinkSync(name); }
    catch (error) { console.warn('[wechat-assets] 释放纹理文件失败', name, error); }
  }

  function createTextureScope() {
    const urls = new Map();
    let closed = false;
    const retain = (open, ...args) => {
      if(closed)throw abortError();
      const url=open(...args);
      urls.set(url,(urls.get(url)??0)+1);
      return url;
    };
    return {
      createAssetBytesUrl: (bytes,mime) => retain(createAssetBytesUrl,bytes,mime),
      createVerifiedAssetBytesUrl: (bytes,mime,sha) => retain(createVerifiedAssetBytesUrl,bytes,mime,sha),
      revokeAssetBytesUrl(url) {
        const count=urls.get(url);
        if(!count)return;
        if(count===1)urls.delete(url);else urls.set(url,count-1);
        revokeAssetBytesUrl(url);
      },
      dispose() {
        if(closed)return;
        closed=true;
        // A cached template is scoped to one battle bundle instance. Drop
        // its file references even when no one explicitly disposed the template.
        for(const [url,count] of urls)for(let i=0;i<count;i++)revokeAssetBytesUrl(url);
        urls.clear();
      },
    };
  }

  return {
    resolve, canLoad, releaseAssets: Boolean(releaseFiles), readBytes, decodeBytes, readyLocalFile, readyFallbackFile, preloadAssetPackage, isVersionedBattleData,
    requestAsset: transport.request, cacheStats: transport.stats, flushCache: transport.flush,
    async readJSON(path, options) { return JSON.parse(buf2string(new Uint8Array(await readBytes(path, options)))); },
    createAssetBytesUrl, createVerifiedAssetBytesUrl, revokeAssetBytesUrl, createTextureScope,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const cancel of [...pending].reverse()) cancel();
      transport.dispose();
      // Cached model templates release their retained texture files on disposal.
    },
  };
}
