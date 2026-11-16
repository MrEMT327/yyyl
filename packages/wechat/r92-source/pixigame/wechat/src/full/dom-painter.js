import { cssLength, cssEdges, splitCss, cssBackgroundPosition, cssObjectViewBox } from './css-values.js';
import { nativeSurface } from './dom-environment.js';
import { cssTransformMatrix, hasCssTransform } from './css-transform.js';

const imageURL = value => /url\(["']?(.*?)["']?\)/.exec(value || '')?.[1];
const borderImageURL = style => imageURL(style['border-image-source']) || imageURL(style['border-image']);
const transparent = color => !color || color === 'transparent' || color === 'none';
const clipsOverflow = /hidden|clip|auto|scroll/;
const maskDefaults = {
  origin: 'border-box', clip: 'border-box', position: '0% 0%',
  size: 'auto', repeat: 'repeat', composite: 'add',
};

function intersectClip(box, previous) {
  if (!previous) return box;
  return {
    left: Math.max(box.left, previous.left),
    top: Math.max(box.top, previous.top),
    right: Math.min(box.right, previous.right),
    bottom: Math.min(box.bottom, previous.bottom),
  };
}

function outsideClip(box, clip) {
  // Leave a pixel at the boundary for fractional positions and antialiasing.
  return box.right < clip.left - 1 || box.left > clip.right + 1 ||
    box.bottom < clip.top - 1 || box.top > clip.bottom + 1;
}

export function nineSlice(context, image, box, sourceSides, targetSides, fill = true) {
  const [st, sr, sb, sl] = sourceSides, [dt, dr, db, dl] = targetSides;
  const fit = Math.min(1, box.width / Math.max(1, dl + dr), box.height / Math.max(1, dt + db));
  const sx = [0, sl, image.width - sr, image.width], sy = [0, st, image.height - sb, image.height];
  const dx = [0, dl * fit, box.width - dr * fit, box.width], dy = [0, dt * fit, box.height - db * fit, box.height];
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
    if (x === 1 && y === 1 && !fill) continue;
    if (sx[x + 1] <= sx[x] || sy[y + 1] <= sy[y] || dx[x + 1] <= dx[x] || dy[y + 1] <= dy[y]) continue;
    context.drawImage(image, sx[x], sy[y], sx[x + 1] - sx[x], sy[y + 1] - sy[y], box.left + dx[x], box.top + dy[y], dx[x + 1] - dx[x], dy[y + 1] - dy[y]);
  }
}

export function createDomPainter(host, layout, canvas, { pixelRatio = host.pixelRatio, skipUnchanged = false } = {}) {
  let context = canvas?.getContext('2d');
  let maskTile;
  const images = new Map(), usedImages = new Set(), ownedSurfaces = new Map(), usedSurfaces = new Set(), inlineSvg = new WeakMap(), maskedLayers=new WeakMap(), backgroundLayers=new WeakMap();
  const stackingOrder=new WeakMap(),serializedSvg=new WeakMap(),paintStyles=new WeakMap();
  const buttonArtwork = new WeakMap(), paintedButtons = new WeakMap();
  function paintOrder(record){if(layout.paintOrder)return layout.paintOrder(record);let ordered=stackingOrder.get(record);if(!ordered){ordered=[...record.children].sort((a,b)=>(Number(a.style['z-index'])||0)-(Number(b.style['z-index'])||0));stackingOrder.set(record,ordered);}return ordered;}
  let disposed = false;
  let frames=0,skippedFrames=0,renderMs=0,maximumRenderMs=0,clippedSubtrees=0;
  let paintedRevision=-1,paintedAnimationRevision=-1,assetDirty=true;
  const measure=host.measurePerformance;
  const invalidatePixels=()=>{assetDirty=true;};
  if(skipUnchanged)host.document.addEventListener('visibilitychange',invalidatePixels);
  if (canvas) {
    canvas.width = Math.round(host.width * pixelRatio); canvas.height = Math.round(host.height * pixelRatio);
  }
  const lengthContext = style => ({ width: host.width, height: host.height, containerWidth: style.containerWidth ?? host.width, fontSize: style.fontSize });
  const len = (value, style, percent) => cssLength(value, { ...lengthContext(style), percent }, 0);
  const insetBox=(box,edges)=>({...box,left:box.left+edges[3],top:box.top+edges[0],right:box.right-edges[1],bottom:box.bottom-edges[2],width:Math.max(0,box.width-edges[1]-edges[3]),height:Math.max(0,box.height-edges[0]-edges[2])});
  function paintStyle(record) {
    let cached = paintStyles.get(record);
    if (!cached || cached.source !== record.style || cached.value.containerWidth !== record.containerWidth) {
      cached = { source: record.style, value: { ...record.style, containerWidth: record.containerWidth } };
      paintStyles.set(record, cached);
    }
    return cached.value;
  }
  function transformFor(style, box) {
    return hasCssTransform(style) ? cssTransformMatrix(style, box, { width: host.width, height: host.height }) : null;
  }
  function watchImage(element) {
    if(!skipUnchanged)return;
    element.addEventListener('load',invalidatePixels,{once:true});
    element.addEventListener('error',invalidatePixels,{once:true});
  }
  function imageElement(url) {
    if (!images.has(url)) {
      const element = host.document.createElement('img'); watchImage(element); element.src = url;
      images.set(url, element);
    }
    return images.get(url);
  }
  function image(url) {
    if (!url) return null;
    usedImages.add(url);
    const element = imageElement(url);
    return element.complete ? element[nativeSurface] : null;
  }
  function artworkFor(record) {
    if (record.element.tagName !== 'BUTTON') return null;
    const bar = record.parent?.element.hasAttribute?.('data-button-bar') ? record.parent.style : null;
    let cached = buttonArtwork.get(record);
    if (cached && cached.style === record.style && cached.bar === bar) return cached.faces;
    const urls = new Set(), elements = [];
    const addBackground = style => {
      const border = borderImageURL(style);
      if (border) urls.add(border);
      for (const layer of splitCss(style['background-image'])) {
        const url = imageURL(layer);
        if (url) urls.add(url);
      }
    };
    addBackground(record.style);
    if (bar) addBackground(bar);
    // A frame pseudo-element usually covers the button. Small badges, icons
    // and selection marks should never hold up the rest of the control.
    for (const child of record.children) {
      if (child.pseudoOwner !== record.element || child.style.visibility === 'hidden' || Number(child.style.opacity) === 0) continue;
      const wide = Math.min(child.box.right, record.box.right) - Math.max(child.box.left, record.box.left);
      const high = Math.min(child.box.bottom, record.box.bottom) - Math.max(child.box.top, record.box.top);
      if (wide >= record.box.width * .8 && high >= record.box.height * .8) addBackground(child.style);
    }
    for (const face of record.element.querySelectorAll('img[data-button-face][src]')) elements.push(face);
    const faces = urls.size || elements.length ? { urls: [...urls], elements } : null;
    buttonArtwork.set(record, { style: record.style, bar, faces });
    return faces;
  }
  function canHitControl(record) {
    // Image decode can finish between a tap and the next paint. Enable the
    // control when its pixels have actually been submitted to this canvas.
    return paintedButtons.get(record.element) === frames || !artworkFor(record);
  }
  layout.canHitControl = canHitControl;
  function buttonArtworkStatus({ urls, elements }) {
    let pending = false, failed = false;
    function check(element) {
      if (element.complete && element.naturalWidth) return;
      if (host.imageFailed?.(element) || element.complete) failed = true;
      else pending = true;
    }
    for (const url of urls) {
      usedImages.add(url);
      check(imageElement(url));
    }
    for (const element of elements) {
      host.loadImage(element);
      check(element);
    }
    return pending ? 'pending' : failed ? 'fallback' : 'ready';
  }
  async function prepareBorderImage(button) {
    const url = button && borderImageURL(layout.styles.read(button));
    if (!url) return null;
    const element = imageElement(url);
    try { await element.decode(); } catch { return null; }
    if (!element.complete || !element.naturalWidth) return null;
    // The hidden button does not use its image during loading, so the painter
    // can evict its entry. Reinsert the decoded image when the button is shown.
    return () => {
      images.set(url, element);
      invalidatePixels();
    };
  }
  function ownSurface(surface, cache) { ownedSurfaces.set(surface, cache); usedSurfaces.add(surface); }
  function releaseSurface(surface, cache) { surface.width=surface.height=0; if(cache)cache.key=undefined; ownedSurfaces.delete(surface); }
  function svgImage(owner, url) {
    let state=inlineSvg.get(owner);
    if(!state){state={url:null,pending:null,ready:null};inlineSvg.set(owner,state);}
    if(state.pending?.complete){state.ready=state.pending[nativeSurface];state.pending=null;}
    // Coalesce rapidly changing SVGs while their rasterization is pending.
    // Keep the last completed frame visible instead of creating a blank frame.
    if(!state.pending&&state.url!==url){
      const pending=host.document.createElement('img');state.pending=pending;state.url=url;
      watchImage(pending);
      pending.addEventListener('error',()=>{if(state.pending===pending)state.pending=null;},{once:true});
      pending.src=url;
      if(pending.complete){state.ready=pending[nativeSurface];state.pending=null;}
    }
    return state.ready;
  }
  function roundedRect(box, radius) {
    context.beginPath();
    if (radius > 0 && context.roundRect) context.roundRect(box.left, box.top, box.width, box.height, radius);
    else if(radius>0){const r=Math.min(radius,box.width/2,box.height/2),x=box.left,y=box.top,w=box.width,h=box.height;context.moveTo(x+r,y);context.lineTo(x+w-r,y);context.quadraticCurveTo(x+w,y,x+w,y+r);context.lineTo(x+w,y+h-r);context.quadraticCurveTo(x+w,y+h,x+w-r,y+h);context.lineTo(x+r,y+h);context.quadraticCurveTo(x,y+h,x,y+h-r);context.lineTo(x,y+r);context.quadraticCurveTo(x,y,x+r,y);context.closePath();}
    else context.rect(box.left, box.top, box.width, box.height);
  }
  function gradient(value, box, style={}) {
    const match = /^(?:repeating-)?(linear|radial)-gradient\((.*)\)$/.exec(value); if (!match) return null;
    const parts = splitCss(match[2]); let options = '';
    if (/^(to |[-.\d]+(?:deg|turn)|circle|ellipse|at )/.test(parts[0])) options = parts.shift();
    let result,span;
    if (match[1] === 'radial') {
      const xy = /at\s+([\d.]+)%\s+([\d.]+)%/.exec(options);
      const x = box.left + box.width * (xy ? Number(xy[1]) / 100 : .5), y = box.top + box.height * (xy ? Number(xy[2]) / 100 : .5);
      span=Math.max(box.width,box.height)*.6;
      result = context.createRadialGradient(x, y, 0, x, y, span);
    } else {
      let angle = /deg/.test(options) ? parseFloat(options) * Math.PI / 180 : /turn/.test(options) ? parseFloat(options) * Math.PI * 2 : Math.PI;
      if (options.startsWith('to ')) angle = ({ 'to right': Math.PI / 2, 'to left': -Math.PI / 2, 'to top': 0, 'to bottom': Math.PI, 'to bottom right': Math.PI * .75, 'to top right': Math.PI * .25 })[options] ?? Math.PI;
      const dx = Math.sin(angle), dy = -Math.cos(angle), extent = (Math.abs(dx) * box.width + Math.abs(dy) * box.height) / 2;
      span=extent*2;
      const x = box.left + box.width / 2, y = box.top + box.height / 2;
      result = context.createLinearGradient(x - dx * extent, y - dy * extent, x + dx * extent, y + dy * extent);
    }
    const stops = parts.flatMap((part, i) => {
      const tokens = splitCss(part, ' '), color = tokens.shift();
      return (tokens.length ? tokens : [null]).map(position => ({ color, value:position==null?null:len(position,style,span)/Math.max(1,span) }));
    });
    if(stops[0]?.value==null)stops[0].value=0;
    if(stops.at(-1)?.value==null)stops.at(-1).value=1;
    for(let i=1;i<stops.length;i++)if(stops[i].value==null){let end=i;while(stops[end]?.value==null)end++;const from=stops[i-1].value,to=Math.max(from,stops[end]?.value??1);for(let j=i;j<end;j++)stops[j].value=from+(to-from)*(j-i+1)/(end-i+1);i=end-1;}
    let previous = 0;
    for (const stop of stops) {
      const at = Math.max(previous, Math.max(0, Math.min(1, stop.value))); previous = at;
      try { result.addColorStop(at, /^currentcolor$/i.test(stop.color)?style.color:stop.color); } catch { /* Invalid CSS color does not paint. */ }
    }
    return result;
  }
  function fitImage(source, box, fit = 'fill', position = 'center', viewBox = 'none', style = {}, draw) {
    if (!source || !source.width || !source.height || box.width <= 0 || box.height <= 0) return;
    const view = cssObjectViewBox(viewBox, source.width, source.height, lengthContext(style));
    if (!(view.width > 0 && view.height > 0)) return;
    let scale = fit === 'cover' ? Math.max(box.width / view.width, box.height / view.height) : Math.min(box.width / view.width, box.height / view.height);
    if (fit === 'none') scale = 1;
    if (fit === 'scale-down') scale = Math.min(1, scale);
    const width = fit === 'fill' ? box.width : view.width * scale, height = fit === 'fill' ? box.height : view.height * scale;
    const [x, y] = cssBackgroundPosition(position, box.width, box.height, width, height, lengthContext(style));
    const sx = width / view.width, sy = height / view.height;
    const left = box.left + x - view.x * sx, top = box.top + y - view.y * sy;
    const destWidth = source.width * sx, destHeight = source.height * sy;
    context.save(); roundedRect(box, 0); context.clip();
    try {
      if (draw) draw(context,left,top,destWidth,destHeight);
      else context.drawImage(source,left,top,destWidth,destHeight);
    } finally { context.restore(); }
  }
  function backgroundImage(source, box, style, index, radius) {
    if (!(source.width > 0 && source.height > 0 && box.width > 0 && box.height > 0)) return;
    const value = (property, fallback) => { const list = splitCss(style[property] || fallback); return list[index % list.length]; };
    const size = value('background-size', 'auto');
    let width, height;
    if (size === 'cover' || size === 'contain') {
      const scale = (size === 'cover' ? Math.max : Math.min)(box.width / source.width, box.height / source.height);
      width = source.width * scale; height = source.height * scale;
    } else {
      const [x = 'auto', y = 'auto'] = splitCss(size, ' ');
      width = x === 'auto' ? null : len(x, style, box.width);
      height = y === 'auto' ? null : len(y, style, box.height);
      if (width == null && height == null) { width = source.width; height = source.height; }
      else if (width == null) width = height * source.width / source.height;
      else if (height == null) height = width * source.height / source.width;
    }
    if (!(width > 0 && height > 0)) return;
    const [x,y]=cssBackgroundPosition(value('background-position','0% 0%'),box.width,box.height,width,height,lengthContext(style));
    const left=box.left+x,top=box.top+y;
    const repeat = value('background-repeat', 'repeat');
    const repeatX = repeat === 'repeat' || repeat === 'repeat-x', repeatY = repeat === 'repeat' || repeat === 'repeat-y';
    const startX = repeatX ? left - Math.ceil((left - box.left) / width) * width : left;
    const startY = repeatY ? top - Math.ceil((top - box.top) / height) * height : top;
    context.save(); roundedRect(box, radius); context.clip();
    for (let y = startY; y < (repeatY ? box.bottom : startY + 1); y += height)
      for (let x = startX; x < (repeatX ? box.right : startX + 1); x += width) context.drawImage(source, x, y, width, height);
    context.restore();
  }
  function backgroundFill(style, box, radius, modes = []) {
    if (!transparent(style['background-color'])) {
      roundedRect(box, radius);
      context.fillStyle = /^currentcolor$/i.test(style['background-color']) ? style.color : style['background-color'];
      context.fill();
    }
    const layers = splitCss(style['background-image']);
    for (let index = layers.length - 1; index >= 0; index--) {
      context.save();
      if (modes.length) context.globalCompositeOperation = modes[index % modes.length] === 'normal' ? 'source-over' : modes[index % modes.length];
      const layer = layers[index];
      const url = imageURL(layer), source = image(url);
      if (source) backgroundImage(source, box, style, index, radius);
      else if (!url) { const fill = gradient(layer, box,style); if (fill) { context.fillStyle = fill; roundedRect(box, radius); context.fill(); } }
      context.restore();
    }
  }
  function paintBackground(style, box, cacheKey) {
    const radius = Math.min(box.width / 2, box.height / 2, len(style['border-radius'], style, Math.min(box.width, box.height)));
    const modes = splitCss(style['background-blend-mode'] || 'normal');
    if (box.width > 0 && box.height > 0 && modes.some(mode => mode !== 'normal')) {
      // CSS background layers blend with each other, never with content behind the element.
      // Cache the isolated surface so static scene textures do not need another full paint each frame.
      let cached = cacheKey && backgroundLayers.get(cacheKey);
      if (!cached) { cached = { canvas: host.api.createCanvas() }; if (cacheKey) backgroundLayers.set(cacheKey, cached); }
      const sources = splitCss(style['background-image']).map(layer => image(imageURL(layer)));
      const key = JSON.stringify([box.width, box.height, radius, style.containerWidth, style.fontSize, style.color,
        ...['background-color','background-image','background-position','background-size','background-repeat','background-blend-mode','image-rendering'].map(name => style[name]),
        sources.map(source => source ? [source.width, source.height] : null)]);
      const surface = cached.canvas, parentContext = context; ownSurface(surface,cached);
      if (cached.key !== key) {
        surface.width = Math.ceil(box.width * pixelRatio); surface.height = Math.ceil(box.height * pixelRatio);
        try {
          context = surface.getContext('2d');
          context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
          context.globalAlpha = 1; context.globalCompositeOperation = 'source-over';
          context.imageSmoothingEnabled = parentContext.imageSmoothingEnabled;
          if ('imageSmoothingQuality' in context) context.imageSmoothingQuality = 'high';
          if ('filter' in context) context.filter = 'none';
          backgroundFill(style, { left: 0, top: 0, width: box.width, height: box.height, right: box.width, bottom: box.height }, radius, modes);
          cached.key = key;
        } finally { context = parentContext; }
      }
      context.drawImage(surface, 0, 0, box.width * pixelRatio, box.height * pixelRatio, box.left, box.top, box.width, box.height);
    } else backgroundFill(style, box, radius);
    const border = style['border-image'];
    const source = image(borderImageURL(style));
    if (source) {
      const withoutUrl = (border || '').replace(/url\(.*?\)/, '').trim(), sections = splitCss(withoutUrl, '/');
      const sliceValue = style['border-image-slice'] || sections[0] || '100%';
      const slice = cssEdges(sliceValue.replace(/\bfill\b/, '').trim()).map((v, i) => v.endsWith('%') ? parseFloat(v) / 100 * (i % 2 ? source.width : source.height) : Number(v));
      const widths = cssEdges((style['border-image-width'] || sections[1] || '1').replace(/\b(stretch|repeat|round|space)\b/g, '').trim()).map((v, i) => /^\d*\.?\d+$/.test(v) ? Number(v) * len(style[`border-${['top', 'right', 'bottom', 'left'][i]}-width`], style, box.width) : len(v, style, i % 2 ? box.width : box.height));
      nineSlice(context, source, box, slice, widths, /\bfill\b/.test(sliceValue));
    } else {
      const thickness=len(style['border-top-width'],style,box.width),color=style['border-top-color'];
      const uniform=radius>0&&thickness>0&&['top','right','bottom','left'].every(side=>style[`border-${side}-style`]==='solid'&&len(style[`border-${side}-width`],style,box.width)===thickness&&style[`border-${side}-color`]===color);
      if(uniform){const inset=thickness/2;context.lineWidth=thickness;context.strokeStyle=color==='currentColor'?style.color:color;roundedRect({...box,left:box.left+inset,top:box.top+inset,width:Math.max(0,box.width-thickness),height:Math.max(0,box.height-thickness)},Math.max(0,radius-inset));context.stroke();return;}
      for (const [i, side] of ['top', 'right', 'bottom', 'left'].entries()) {
        const thickness = len(style[`border-${side}-width`], style, box.width), type = style[`border-${side}-style`];
        if (!(thickness > 0) || !type || type === 'none') continue;
        const color = style[`border-${side}-color`]; context.fillStyle = color === 'currentColor' ? style.color : color;
        if (i % 2) context.fillRect(i === 1 ? box.right - thickness : box.left, box.top, thickness, box.height);
        else context.fillRect(box.left, i === 2 ? box.bottom - thickness : box.top, box.width, thickness);
      }
    }
  }
  function paintMasked(record,style,box,maskImage,matrix,scrollX,scrollY){
    if(!(box.width>0&&box.height>0))return;
    let layer = maskedLayers.get(record.element);
    if (!layer) {
      layer = { surface: host.api.createCanvas(), mask: host.api.createCanvas() };
      maskedLayers.set(record.element, layer);
    }
    const {surface,mask}=layer, parentContext=context;
    ownSurface(surface);
    ownSurface(mask,layer);
    const width=Math.ceil(box.width*pixelRatio),height=Math.ceil(box.height*pixelRatio);
    const sources=splitCss(maskImage), maskSources=sources.map(source=>image(imageURL(source)));
    const values = Object.fromEntries(Object.entries(maskDefaults).map(([name, fallback]) => [
      name, style[`mask-${name}`] || style[`-webkit-mask-${name}`] || fallback,
    ]));
    const signature = JSON.stringify([box.width, box.height, record.padding, style.containerWidth,
      style.fontSize, style.color, style['border-radius'], maskImage, values]);
    const reset=target=>{if(target.width!==width)target.width=width;if(target.height!==height)target.height=height;const ctx=target.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,width,height);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';if('filter'in ctx)ctx.filter='none';ctx.setTransform(pixelRatio,0,0,pixelRatio,-box.left*pixelRatio,-box.top*pixelRatio);return ctx;};
    try{
      context=reset(surface);paint(record,null,true,true,scrollX,scrollY);
      // The content may move behind a fixed mask. Rebuild the mask only when
      // its geometry, CSS or decoded pixels change.
      if (layer.key?.signature !== signature || maskSources.some((source, i) => source !== layer.key.sources[i])) {
        const maskContext = reset(mask);
        const parts = Object.fromEntries(Object.entries(values).map(([name,value])=>[name,splitCss(value)]));
        const part = (name,index) => parts[name][index % parts[name].length];
        for (let index = sources.length - 1; index >= 0; index--) {
          const first = index === sources.length - 1;
          if (first) context = maskContext;
          else {
            maskTile ||= host.api.createCanvas();
            ownSurface(maskTile);
            context = reset(maskTile);
          }
          context.save();
          const target = part('origin',index)==='content-box' ? insetBox(box,record.padding) : box;
          if (part('clip',index)==='content-box') { roundedRect(insetBox(box,record.padding),0); context.clip(); }
          const maskStyle = { ...style,
            'background-color':'transparent', 'background-image':sources[index],
            'background-position':part('position',index), 'background-size':part('size',index),
            'background-repeat':part('repeat',index), 'background-blend-mode':'normal',
            'border-image':'none', 'border-image-source':'none',
          };
          for (const side of ['top','right','bottom','left']) maskStyle[`border-${side}-style`] = 'none';
          paintBackground(maskStyle,target);
          context.restore();
          if (!first) {
            maskContext.setTransform(1,0,0,1,0,0);
            maskContext.globalCompositeOperation = {
              intersect:'destination-in', 'source-in':'destination-in',
              exclude:'xor', xor:'xor', subtract:'destination-out',
            }[part('composite',index)] || 'source-over';
            maskContext.drawImage(maskTile,0,0);
          }
        }
        layer.key = {signature,sources:maskSources};
      }
      context=surface.getContext('2d');context.setTransform(1,0,0,1,0,0);context.globalCompositeOperation='destination-in';context.drawImage(mask,0,0);context.globalCompositeOperation='source-over';
    }finally{context=parentContext;}
    context.save();context.globalAlpha*=Number(style.opacity??1);
    if (matrix) context.transform(...matrix);
    if(['screen','multiply'].includes(style['mix-blend-mode']))context.globalCompositeOperation=style['mix-blend-mode'];
    context.drawImage(surface,0,0,width,height,box.left,box.top,box.width,box.height);context.restore();
  }
  function paint(record, inheritedClip, maskedRoot = false, filterFree = true, scrollX=0, scrollY=0) {
    const visual = layout.visualStyle(record,paintStyle(record));
    const style = maskedRoot ? {...visual} : visual;
    if (style.visibility === 'hidden' || style.visibility === 'collapse' || Number(style.opacity) === 0) return;
    // Flush once through layout.tree; geometry is stable during this paint.
    const box = layout.offsetRect ? layout.offsetRect(record.box,scrollX,scrollY)
      : layout.paintRect ? layout.paintRect(record) : layout.rawRect(record.element);
    if (!(box.width > 0 && box.height > 0) && !record.children.length) return;
    if(maskedRoot)Object.assign(style,{transform:'none',translate:'',rotate:'',scale:'',opacity:'1','mix-blend-mode':'normal'});
    const matrix = transformFor(style, box);
    const clips = !record.isText && clipsOverflow.test(style.overflow || style['overflow-y']);
    const maskImage = style['mask-image'] || style['-webkit-mask-image'];
    const masked = !maskedRoot && maskImage && maskImage !== 'none';
    filterFree = filterFree && (!style.filter || style.filter === 'none');
    // A transform changes the coordinate space. A filter can extend pixels
    // beyond the box. Only skip subtrees bounded by their own overflow clip.
    const clip = filterFree && !matrix ? inheritedClip : null;
    if (clip && (clips || masked) && outsideClip(box, clip)) {
      clippedSubtrees++;
      return;
    }
    const artwork = artworkFor(record);
    const artworkStatus = artwork && buttonArtworkStatus(artwork);
    if (artworkStatus === 'pending') return;
    if(masked){paintMasked(record,style,box,maskImage,matrix,scrollX,scrollY);return;}
    context.save(); context.globalAlpha *= Number(style.opacity ?? 1);
    if (matrix) context.transform(...matrix);
    context.imageSmoothingEnabled = !['pixelated', 'crisp-edges'].includes(style['image-rendering']);
    if ('imageSmoothingQuality' in context) context.imageSmoothingQuality = 'high';
    if (style['mix-blend-mode'] === 'screen') context.globalCompositeOperation = 'screen';
    if (style['mix-blend-mode'] === 'multiply') context.globalCompositeOperation = 'multiply';
    if (style.filter && style.filter !== 'none' && 'filter' in context) context.filter = `${style.filter}${context.filter && context.filter !== 'none' ? ' ' + context.filter : ''}`;
    const polygon = /^polygon\(([\s\S]*)\)$/.exec((style['clip-path'] || '').trim());
    if (polygon) {
      context.beginPath(); splitCss(polygon[1]).forEach((point, i) => { const [x, y] = splitCss(point, ' '); const args = [box.left + len(x, style, box.width), box.top + len(y, style, box.height)]; if (i) context.lineTo(...args); else context.moveTo(...args); }); context.closePath(); context.clip();
    }
    if (record.isText) {
      const typeface = layout.font(style);
      context.font = typeface; context.textBaseline = 'alphabetic'; context.fillStyle = style.color;
      const shadow = splitCss(style['text-shadow'])[0];
      if (shadow && shadow !== 'none') {
        const terms = splitCss(shadow, ' '), color = terms.find(x => /^#|^rgb|^[a-z]+$/.test(x));
        const offsets = terms.filter(x => /^-?[\d.]/.test(x));
        context.shadowColor = color || '#000'; context.shadowOffsetX = len(offsets[0], style, 0); context.shadowOffsetY = len(offsets[1], style, 0); context.shadowBlur = len(offsets[2], style, 0);
      }
      const text = record.textLayout;
      for (let i = 0; i < text.lines.length; i++) {
        const line = text.lines[i]; let x = box.left;
        if (style['text-align'] === 'center') x += (box.width - line.width) / 2;
        if (style['text-align'] === 'right') x += box.width - line.width;
        const y = box.top + text.lineHeight * (i + .5) + style.fontSize * .35;
        if (text.spacing) for (const char of line.text) {
          context.fillText(char, x, y);
          x += (layout.glyphWidth ? layout.glyphWidth(typeface, char) : context.measureText(char).width) + text.spacing;
        }
        else context.fillText(line.text, x, y);
      }
    } else {
      if (artworkStatus === 'fallback') {
        context.fillStyle = '#203b51';
        context.strokeStyle = '#7092a7';
        context.lineWidth = 1;
        roundedRect(box, Math.min(6, box.width / 2, box.height / 2));
        context.fill(); context.stroke();
        // Some lobby hotspots have their caption baked into the artwork.
        const hasText = node => node.isText ? Boolean(node.text?.trim()) : node.children.some(hasText);
        const label = !hasText(record) && record.element.getAttribute('aria-label');
        if (label) {
          context.fillStyle = '#edf6fa';
          context.font = layout.font(style);
          context.textAlign = 'center'; context.textBaseline = 'middle';
          context.fillText(label, box.left + box.width / 2, box.top + box.height / 2, Math.max(1, box.width - 6));
          context.textAlign = 'start';
        }
      }
      paintBackground(style, box, record.element);
      if (clips) { roundedRect(box, len(style['border-radius'], style, box.width)); context.clip(); }
      const contentBox=insetBox(box,record.padding||[0,0,0,0]);
      if(record.element.tagName==='INPUT'&&record.element.type==='range'){
        const input=record.element,min=Number(input.min??input.getAttribute('min')??0),max=Number(input.max??input.getAttribute('max')??100);
        const amount=max>min?Math.max(0,Math.min(1,(Number(input.value)-min)/(max-min))):0;
        const x=contentBox.left,y=contentBox.top+contentBox.height/2,width=contentBox.width;
        context.save();if(input.disabled)context.globalAlpha*=.45;
        context.fillStyle='#425b6b';context.fillRect(x,y-2,width,4);
        context.fillStyle=style['accent-color']||'#80d9ee';context.fillRect(x,y-2,width*amount,4);
        context.beginPath();context.arc(x+width*amount,y,5,0,Math.PI*2);context.fill();context.restore();
      }else if (['INPUT','TEXTAREA'].includes(record.element.tagName)) {
        const input=record.element,multiple=input.tagName==='TEXTAREA',value=String(input.value || ''),placeholder=input.getAttribute('placeholder') || '';
        const text=input.type==='password'?'•'.repeat(value.length):value || placeholder;
        context.save();context.beginPath();context.rect(contentBox.left,contentBox.top,contentBox.width,contentBox.height);context.clip();
        context.font=layout.font(style);context.textBaseline='alphabetic';context.fillStyle=value?style.color:'#757575';
        const metrics=layout.wrapText(text,{...style,'white-space':multiple?'pre-wrap':'nowrap'},contentBox.width);
        const start=multiple?contentBox.top:contentBox.top+(contentBox.height-metrics.lineHeight)/2;
        const focused=host.document.activeElement===input;
        const caret=focused&&!multiple?context.measureText(text.slice(0,input.selectionEnd)).width:0;
        const offset=focused&&!multiple?Math.max(0,caret-contentBox.width+1):0;
        if(focused&&!multiple&&input.selectionEnd>input.selectionStart){
          const left=context.measureText(text.slice(0,input.selectionStart)).width;
          context.fillStyle='#b5d7ff';context.fillRect(contentBox.left+left-offset,start,caret-left,metrics.lineHeight);context.fillStyle=style.color;
        }
        metrics.lines.forEach((line,index)=>context.fillText(line.text,contentBox.left-offset,start+metrics.lineHeight*(index+.5)+style.fontSize*.35));
        if(focused&&!multiple&&input.selectionStart===input.selectionEnd){context.fillStyle=style.color;context.fillRect(contentBox.left+caret-offset,start,1,metrics.lineHeight);}
        context.restore();
      }
      if (record.element.tagName === 'IMG') { host.loadImage(record.element); if (record.element.complete) fitImage(record.element[nativeSurface], contentBox, style['object-fit'] || 'fill', style['object-position'] || 'center', style['object-view-box'], style); }
      if (record.element.tagName === 'SVG') {
        // Inline SVGs include cropped PSD frame regions, not just icon paths.
        // Rasterize their authored viewBox through the same SVG loader as files.
        let cached=serializedSvg.get(record.element);
        if(!cached||cached.generation!==layout.generation||cached.color!==style.color){
          const svg=record.element.cloneNode(true);svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('color',style.color);
          cached={generation:layout.generation,color:style.color,url:'data:image/svg+xml,'+encodeURIComponent(svg.outerHTML)};serializedSvg.set(record.element,cached);
        }
        const aspect=record.element.getAttribute('preserveAspectRatio')||'xMidYMid meet';
        const fit=style['object-fit']&&style['object-fit']!=='fill'?style['object-fit']:aspect==='none'?'fill':aspect.includes('slice')?'cover':'contain';
        fitImage(svgImage(record.element,cached.url),contentBox,fit,style['object-position']||'center');
      }
      if (['CANVAS','IFRAME','VIDEO'].includes(record.element.tagName)) {
        const drawFrame=host.paintEmbeddedFrame?.get(record.element);
        const battleCanvas=record.element===host.battleCanvas;
        const surface=(battleCanvas && host.frozenBattleSurface) || record.element[nativeSurface];
        fitImage(drawFrame || surface, contentBox, style['object-fit'] || 'fill', 'center', 'none', undefined,
          drawFrame?.paint || (battleCanvas && host.measureTransfer ? drawBattleBuffer : undefined));
      }
      if (record.element.tagName === 'PROGRESS') {
        const fraction = Math.max(0, Math.min(1, Number(record.element.value ?? record.element.getAttribute('value') ?? 0) / Number(record.element.max ?? record.element.getAttribute('max') ?? 1)));
        const track = {...layout.styles.read(record.element, '-webkit-progress-bar'),containerWidth:record.containerWidth};
        paintBackground(track, contentBox, record.element);
        const trackBox=insetBox(contentBox,['top','right','bottom','left'].map(side=>track[`border-${side}-style`]&&track[`border-${side}-style`]!=='none'?len(track[`border-${side}-width`],track,contentBox.width):0));
        const fill = {...layout.styles.read(record.element, '-webkit-progress-value'),containerWidth:record.containerWidth};
        const fillBox = { ...trackBox, width: trackBox.width * fraction, right: trackBox.left + trackBox.width * fraction };
        if (fill['border-image'] || fill['background-image'] || !transparent(fill['background-color'])) paintBackground(fill, fillBox, record.element);
        else { context.fillStyle = style['accent-color'] || '#4dd0e1'; context.fillRect(fillBox.left, fillBox.top, fillBox.width, fillBox.height); }
      }
      const childClip = clips && filterFree ? intersectClip(box, clip) : clip;
      const children=paintOrder(record);
      if(children.length){
        const dx=scrollX+(record.element.scrollLeft||0),dy=scrollY+(record.element.scrollTop||0);
        for (const child of children) paint(child, childClip, false, filterFree, dx, dy);
      }
    }
    context.restore();
    if (artwork) paintedButtons.set(record.element, frames + 1);
  }
  function drawBattleBuffer(target,left,top,width,height) {
    const frozen=host.frozenBattleSurface;
    const source=frozen || host.battleCanvas[nativeSurface];
    host.measureTransfer(frozen ? 'frozenBattleBlit' : 'battleBlit',source.width*source.height,()=>target.drawImage(source,left,top,width,height));
  }
  function render(target, left=0, top=0, width=host.width, height=host.height) {
    if (disposed) return false;
    if(host.document.hidden){assetDirty=true;return false;}
    const started=performance.now();
    host.animations?.tick(); const tree = layout.tree;
    if(!target && skipUnchanged && layout.paintRevision!==undefined){
      const revision=layout.paintRevision,animationRevision=host.animations?.revision;
      // Canvas/video/iframe contents and form values can change without a DOM
      // mutation. These trees still paint at the same revision.
      if(!assetDirty&&layout.hasLiveContent===false&&revision===paintedRevision&&animationRevision===paintedAnimationRevision){
        skippedFrames++;return false;
      }
      paintedRevision=revision;paintedAnimationRevision=animationRevision;assetDirty=false;
    }
    if(target){
      context=target;
      context.save();
      // The parent already clipped to the iframe. Keep its transform and
      // rasterize the child at the screen position, without a bitmap in between.
      context.translate(left,top);context.scale(width/host.width,height/host.height);
    }else{
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);context.clearRect(0, 0, host.width, host.height);
    }
    usedImages.clear(); usedSurfaces.clear();
    try{if (tree) paint(tree);}
    finally{if(target){target.restore();context=null;}}
    for (const url of images.keys()) if (!usedImages.has(url)) images.delete(url);
    for (const [surface,cache] of ownedSurfaces) if (!usedSurfaces.has(surface)) releaseSurface(surface,cache);
    const elapsed=performance.now()-started;frames++;renderMs+=elapsed;maximumRenderMs=Math.max(maximumRenderMs,elapsed);
    return true;
  }
  return { context, prepareBorderImage,
    get stats(){return {frames,skippedFrames,totalMs:Math.round(renderMs),meanMs:Math.round(renderMs/Math.max(1,frames)*100)/100,maxMs:Math.round(maximumRenderMs*100)/100,backgroundSurfaces:ownedSurfaces.size,clippedSubtrees};},
    render:measure ? (...args)=>measure('paint',()=>render(...args)) : render,
    destroy() {
      disposed=true;
      if (layout.canHitControl === canHitControl) delete layout.canHitControl;
      if(skipUnchanged)host.document.removeEventListener('visibilitychange',invalidatePixels);
      images.clear();usedImages.clear();usedSurfaces.clear();
      for(const [surface,cache] of ownedSurfaces)releaseSurface(surface,cache);
    },
  };
}
