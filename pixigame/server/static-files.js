import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createBrotliCompress, createGzip, constants } from 'node:zlib';

const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.wasm': 'application/wasm',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.bin': 'application/octet-stream' };
const textFile = /\.(?:html|m?js|css|json|svg|gltf)$/i;
const compressed = new Map();
let cacheBytes = 0;
function cache(key, value) {
  if (compressed.has(key)) { cacheBytes -= compressed.get(key).length; compressed.delete(key); }
  while (compressed.size && (cacheBytes + value.length > 16 * 1024 * 1024 || compressed.size >= 64)) {
    const oldest = compressed.keys().next().value;
    cacheBytes -= compressed.get(oldest).length; compressed.delete(oldest);
  }
  compressed.set(key, value); cacheBytes += value.length;
}
function encoding(header = '') {
  const accepted = new Map(header.split(',').map(value => {
    const [name, ...options] = value.trim().split(';');
    const quality = options.find(option => /^\s*q=/i.test(option));
    return [name.trim().toLowerCase(), quality ? Number(quality.split('=')[1]) || 0 : 1];
  }));
  const q = name => accepted.get(name) ?? accepted.get('*') ?? 0;
  return q('br') > 0 && q('br') >= q('gzip') ? 'br' : q('gzip') > 0 ? 'gzip' : '';
}
export function byteRange(value, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || !size || !match[1] && !match[2]) return null;
  let start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  let end = match[1] && match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start || !match[1] && Number(match[2]) === 0) return null;
  return { start, end: Math.min(size - 1, end) };
}

// Stream media/GLB files, validate unchanged resources, and cache bounded text
// compression. A large video never becomes a whole-file Buffer per request.
export async function serveStatic(req, res, root) {
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return; }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400).end(); return; }
  if (pathname.includes('\0')) { res.writeHead(400).end(); return; }
  const directory = path.resolve(root), relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  let file = path.resolve(directory, relative), info;
  if (file !== directory && !file.startsWith(directory + path.sep)) { res.writeHead(403).end(); return; }
  try { info = await stat(file); if (!info.isFile()) throw new Error('not a file'); }
  catch {
    if (path.extname(relative) || !req.headers.accept?.includes('text/html')) { res.writeHead(404).end(); return; }
    file = path.join(directory, 'index.html');
    try { info = await stat(file); } catch { res.writeHead(404).end(); return; }
  }
  const modified = info.mtime.toUTCString(), tag = `${info.size.toString(36)}-${Math.trunc(info.mtimeMs).toString(36)}`;
  // Byte ranges refer to the original media representation, never compressed text.
  const codec = !req.headers.range && textFile.test(file) && info.size >= 1024 && info.size <= 8 * 1024 * 1024
    ? encoding(req.headers['accept-encoding']) : '';
  const etag = `W/"${tag}${codec ? '-' + codec : ''}"`;
  const headers = { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': /-[\w-]{8}\.(?:js|css)$/.test(file) ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
    'Last-Modified': modified, ETag: etag, 'Accept-Ranges': 'bytes', Vary: 'Accept-Encoding' };
  if (codec) headers['Content-Encoding'] = codec;
  const unchanged = req.headers['if-none-match']
    ? req.headers['if-none-match'].split(',').some(value => value.trim() === '*' || value.trim().replace(/^W\//, '') === etag.replace(/^W\//, ''))
    : req.headers['if-modified-since'] && Math.floor(info.mtimeMs / 1000) * 1000 <= Date.parse(req.headers['if-modified-since']);
  if (unchanged) { res.writeHead(304, headers).end(); return; }
  const rangeRequested = req.headers.range && (!req.headers['if-range'] || req.headers['if-range'] === modified);
  const range = rangeRequested ? byteRange(req.headers.range, info.size) : undefined;
  if (range === null) { res.writeHead(416, { ...headers, 'Content-Range': `bytes */${info.size}` }).end(); return; }
  if (range) {
    headers['Content-Range'] = `bytes ${range.start}-${range.end}/${info.size}`;
    headers['Content-Length'] = range.end - range.start + 1;
  } else if (!codec) headers['Content-Length'] = info.size;
  const key = `${file}:${tag}:${codec}`, hit = codec && compressed.get(key);
  if (hit) { headers['Content-Length'] = hit.length; compressed.delete(key); compressed.set(key, hit); }
  res.writeHead(range ? 206 : 200, headers);
  if (req.method === 'HEAD') { res.end(); return; }
  if (hit) { res.end(hit); return; }
  const source = createReadStream(file, range || {});
  try {
    if (!codec) { await pipeline(source, res); return; }
    const chunks = []; let bytes = 0;
    const collect = new Transform({ transform(chunk, _encoding, done) {
      bytes += chunk.length;
      if (bytes <= 1024 * 1024) chunks.push(chunk); else chunks.length = 0;
      done(null, chunk);
    } });
    const compressor = codec === 'br' ? createBrotliCompress({ params: { [constants.BROTLI_PARAM_QUALITY]: 4 } }) : createGzip({ level: 6 });
    await pipeline(source, compressor, collect, res);
    if (bytes <= 1024 * 1024) cache(key, Buffer.concat(chunks));
  } catch (error) {
    if (!['ERR_STREAM_PREMATURE_CLOSE', 'ECONNRESET', 'ABORT_ERR'].includes(error.code)) throw error;
  }
}
