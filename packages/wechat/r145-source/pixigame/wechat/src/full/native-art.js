import { createSurfaceCache } from './surface-cache.js';
import { Canvg } from 'canvg';
import { buf2string } from 'pako/lib/utils/strings.js';
import { imageDataUrl } from './asset-storage.js';

const rasterMime = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', avif: 'image/avif' };
const IMAGE_DECODE_TIMEOUT = 8000;
const firstChapterFiles = [
  '/art/stage1-anime-v8/cloud-bank.png',
  'assets/original-projectiles/crescent-red-v1.png',
  'assets/owned-enemies/patrol-drone-v1/parts.png',
  'assets/pathogenic-source/gfx/environment/Explosion test.png',
  'assets/pathogenic-source/gfx/player/bullets/explosive_shot.png',
];

function decodeImage(api, file, label, activeDecodes) {
  return new Promise((resolve, reject) => {
    const image = api.createImage();
    let settled = false;
    const cancel = () => finish(new Error('图片加载器已关闭'));
    const timer = setTimeout(() => {
      const error = new Error('图片解码超时：' + label);
      error.name = 'ImageDecodeTimeoutError';
      finish(error);
    }, IMAGE_DECODE_TIMEOUT);
    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      activeDecodes.delete(cancel);
      image.onload = image.onerror = null;
      if (error) reject(error);
      else resolve(image);
    }
    activeDecodes.add(cancel);
    image.onload = () => {
      const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
      finish(width > 0 && height > 0 ? undefined : new Error('图片尺寸无效：' + label));
    };
    image.onerror = () => finish(new Error('图片解码失败：' + label));
    try { image.src = file; } catch (error) { finish(error); }
  });
}

export function svgIntrinsicSize(root) {
  const box = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
  const dimension = name => { const value = root.getAttribute(name) || ''; return /^\d*\.?\d+(px)?$/.test(value) ? parseFloat(value) : 0; };
  let width = dimension('width'), height = dimension('height');
  if (box.length === 4 && box[2] > 0 && box[3] > 0) {
    if (!width && !height) { width = box[2]; height = box[3]; }
    else if (!width) width = height * box[2] / box[3];
    else if (!height) height = width * box[3] / box[2];
  }
  return { width: Math.max(1, Math.ceil(width || 300)), height: Math.max(1, Math.ceil(height || 150)) };
}

export function installNativeArt(host,cache) {
  const {api,resources,scope}=host;
  const images=createSurfaceCache({maxBytes:48*1024*1024});
  const activeDecodes=new Set();
  const fontFamilies=new Map(),fontLoads=new Map();let disposed=false;
  const lowMemory=()=>images.clear();api.onMemoryWarning?.(lowMemory);
  async function surface(source) {
    if(disposed)throw new Error('图片加载器已关闭');
    const url=resources.resolve(source,host.document.baseURI);
    return images.get(url,async()=>{
      if(/\.svg(?:[?#]|$)|^data:image\/svg\+xml/.test(url)){
        let text;if(url.startsWith('data:')){const [meta,payload]=url.split(',');text=meta.includes(';base64')?scope.atob(payload):decodeURIComponent(payload);}
        else text=buf2string(new Uint8Array(await resources.readBytes(url)));
        const canvas=api.createCanvas();
        // SVGs with only a viewBox still have an intrinsic aspect ratio.
        // Leaving a 300x150 canvas adds empty bars inside portrait icons.
        const root = new scope.DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
        Object.assign(canvas, svgIntrinsicSize(root));
        const renderer=Canvg.fromString(canvas.getContext('2d'),text,{DOMParser:scope.DOMParser,createCanvas:()=>api.createCanvas(),createImage:surface,fetch:scope.fetch,ignoreAnimation:true,ignoreMouse:true});
        await renderer.render();return canvas;
      }
      const label = url.startsWith('data:') ? '内存图片' : url.split(/[?#]/, 1)[0];
      let file;
      try {
        file = await cache.localFile(url);
        if (disposed) throw new Error('图片加载器已关闭');
        return await decodeImage(api, file, label, activeDecodes);
      }
      catch (error) {
        if (disposed) throw error;
        // Recover a dropped native callback from the known local file before
        // downloading or allocating a binary data URL for the same image.
        if (file && error.name === 'ImageDecodeTimeoutError') {
          try { return await decodeImage(api, file, label, activeDecodes); }
          catch (retryError) {
            if (disposed) throw retryError;
            error = retryError;
          }
        }
        const mime = rasterMime[/\.(\w+)$/.exec(label.toLowerCase())?.[1]];
        if (mime && !error.statusCode) {
          // Retry the image independently of the download or native file path.
          try {
            const bytes = await resources.readBytes(url);
            if (disposed) throw new Error('图片加载器已关闭');
            return await decodeImage(api, imageDataUrl(bytes, mime), label, activeDecodes);
          } catch (fallback) {
            throw new Error(`${error.message} · 备用读取失败 ${fallback.message}`);
          }
        }
        throw error;
      }
    }).catch(error=>{if(!disposed)console.warn('[wechat-image]',error);throw error;});
  }
  host.loadImageSurface=surface;
  host.peekImageSurface=source=>images.peek(source);
  async function warm(queue, limit, signal, load) {
    let next = 0, ready = 0;
    async function worker() {
      while (!disposed && !signal.aborted && next < queue.length) {
        try { await load(queue[next++]); ready++; }
        catch { /* The normal loader can report or retry the failure. */ }
      }
    }
    await Promise.all(Array.from({length: Math.min(queue.length, limit)}, worker));
    return { files: queue.length, ready };
  }
  // The scene uses the same file cache later. Leave decoding to its ordinary
  // image loader and reserve the other network slots for chapter data.
  host.warmSortieFiles = (baseURL, signal) =>
    warm(firstChapterFiles, 2, signal, path => cache.localFile(path, baseURL));
  host.warmBattleTerrain = (sources, signal) =>
    warm([...new Set(sources)], 2, signal, path => cache.localFile(path));
  host.warmBattleImages = async (sources, signal) => {
    // Warm the first-wave images, then fill the remaining slots from the
    // same ordered Phaser queue. Keep the decoded working set bounded.
    await warm(sources.slice(0, 24), 3, signal, surface);
  };
  return {fontFamilies,async loadFonts(sheets,{onReady}={}){
    const fonts=new Map();
    for(const font of sheets.flatMap(sheet=>sheet.fonts)){
      const name=font['font-family'].replace(/^["']|["']$/g,''),url=/url\(["']?(.*?)["']?\)/.exec(font.src)?.[1];
      if(!url||fonts.has(name))continue;
      fonts.set(name,url);
    }
    // Independent families can download together through the shared bounded
    // transport; registration order and first-definition precedence stay fixed.
    const resolved=await Promise.all([...fonts].map(async([name,url])=>{
      if(!fontLoads.has(name))fontLoads.set(name,(async()=>{
        const native=api.loadFont(await cache.localFile(url));if(!native)throw new Error(`字体加载失败：${name}`);return native;
      })().catch(error=>{fontLoads.delete(name);throw error;}));
      return [name,await fontLoads.get(name)];
    }));
    if(disposed)return fontFamilies;
    const changed=[];
    for(const [name,native] of resolved){
      if(fontFamilies.get(name)===native)continue;
      fontFamilies.set(name,native);
      changed.push(name);
    }
    if(changed.length)onReady?.(changed);
    return fontFamilies;
  },destroy(){disposed=true;api.offMemoryWarning?.(lowMemory);for(const cancel of activeDecodes)cancel();images.clear();}};
}
