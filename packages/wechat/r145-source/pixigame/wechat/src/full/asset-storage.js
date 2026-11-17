import { fromByteArray } from 'base64-js';

export function isStorageQuotaError(error) {
  return [error?.errCode, error?.errno, error?.code].some(code => String(code) === '1300202' || code === 'ENOSPC')
    || /file storage limit is exceeded|storage (?:space )?(?:is )?full|quota exceeded|no space left on device|存储空间不足|缓存空间不足/i
      .test([error?.errMsg, error?.message, error].join(' '));
}

export function imageDataUrl(bytes, mimeType) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return `data:${mimeType};base64,${fromByteArray(data)}`;
}

// A second resource owner in the same running game must not delete files
// retained by the first. Only a fresh API session sweeps old texture names.
const swept = new WeakSet();
export function cleanStaleTextures(api, files, root) {
  if (!root || swept.has(api) || typeof files.readdirSync !== 'function') return;
  let names;
  try { names = files.readdirSync(root); } catch { return; }
  swept.add(api);
  for (const name of names) {
    if (!/^shnh-texture-(?:[a-z0-9]+-\d+-)?[a-f\d]{64}\.(?:png|jpg|webp)$/.test(name)) continue;
    try { files.unlinkSync(root.replace(/\/+$/, '') + '/' + name); } catch { /* Optional stale cache. */ }
  }
}
