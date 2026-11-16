import { createSurfaceCache } from './surface-cache.js';
import { Canvg } from 'canvg';
import { buf2string } from 'pako/lib/utils/strings.js';
import { imageDataUrl } from './asset-storage.js';

const packagedSkillPng = /^battle-data\/art\/(?:battle-skill-icons-v4|weapon-variant-skill-icons-v5)\/[\w-]+\.png$/;
const IMAGE_DECODE_TIMEOUT = 8000;

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
      const file = await cache.localFile(url);
      const label = url.startsWith('data:') ? '内存图片' : url.split(/[?#]/, 1)[0];
      if(disposed)throw new Error('图片加载器已关闭');
      try { return await decodeImage(api, file, label, activeDecodes); }
      catch (error) {
        if (disposed) throw error;
        if (packagedSkillPng.test(file)) {
          // Some devices cannot open an image from a subpackage path directly.
          const bytes = await resources.readBytes(file);
          if(disposed)throw new Error('图片加载器已关闭');
          return decodeImage(api, imageDataUrl(bytes, 'image/png'), label, activeDecodes);
        }
        // The file is already local. A fresh Image recovers a dropped callback
        // without repeating the download or retaining the first native handle.
        if (error.name === 'ImageDecodeTimeoutError') return decodeImage(api, file, label, activeDecodes);
        throw error;
      }
    }).catch(error=>{if(!disposed)console.warn('[wechat-image]',error);throw error;});
  }
  host.loadImageSurface=surface;
  host.peekImageSurface=source=>images.peek(source);
  host.warmBattleImages = async (sources, signal) => {
    // Warm the first-wave images, then fill the remaining slots from the
    // same ordered Phaser queue. Keep the decoded working set bounded.
    const queue = sources.slice(0, 24);
    let next = 0;
    async function worker() {
      while (!disposed && !signal.aborted && next < queue.length) {
        try { await surface(queue[next++]); }
        catch { /* The normal loader can report or retry the failure. */ }
      }
    }
    await Promise.all(Array.from({length: Math.min(queue.length, 3)}, worker));
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
