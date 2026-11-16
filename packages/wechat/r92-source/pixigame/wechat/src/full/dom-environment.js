import { parseHTML } from 'linkedom';
import { buf2string, string2buf } from 'pako/lib/utils/strings.js';
import { mediaMatches } from './media-query.js';
import { OWNED_CANVAS_FRAME, RELEASE_OWNED_CANVAS } from '../../../src/ui/release-owned-canvas.js';
import { DRAW_BUTTON_PRESS_SCALE } from '../../../src/ui/dom-button-press.js';

export const nativeSurface = Symbol('wechat.nativeSurface');
const environments = new WeakMap();
const contextTypes = new WeakMap();
const retiredCanvases = new WeakSet();
const frameManagedCanvases = new WeakSet();
let patched = false;
const blankRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });

function surfaceFor(value) {
  // A blank canvas is a valid texture source before getContext is ever called.
  // Phaser creates its procedural textures in exactly that order.
  if (value?.tagName === 'CANVAS' && !value[nativeSurface]) {
    const host = environments.get(value.ownerDocument);
    if (host && !retiredCanvases.has(value)) {
      const width = value.width, height = value.height;
      value[nativeSurface] = host.api.createCanvas();
      value[nativeSurface].width = width; value[nativeSurface].height = height;
      host.canvases.add(value);
    }
  }
  return value?.[nativeSurface] || value;
}

function retireCanvas(canvas) {
  if (retiredCanvases.has(canvas)) return;
  retiredCanvases.add(canvas);
  environments.get(canvas.ownerDocument)?.canvases.delete(canvas);
  // Renderer owners delete their resources first. Lose leftover probe
  // contexts where supported, and still drop the backing store on iOS.
  for (const [type, context] of canvas._contexts || []) {
    if (context && /webgl/.test(type)) {
      try { if (!context.isContextLost?.()) context.getExtension?.('WEBGL_lose_context')?.loseContext(); }
      catch (error) { console.warn('[wechat-canvas-release]', error); }
    }
  }
  canvas._contexts?.clear();
  try { canvas.width = canvas.height = 0; }
  catch (error) { console.warn('[wechat-canvas-release]', error); }
  finally { canvas[nativeSurface] = undefined; }
}

const sourceMethods2D = new Set(['drawImage', 'createPattern', 'drawImageFromRect']);
const textureSourceMethods = new Set(['texImage2D', 'texSubImage2D', 'texImage3D', 'texSubImage3D']);

function wrapContext(context, element, type) {
  const methods = new Map();
  const sourceMethods = type === '2d' ? sourceMethods2D : textureSourceMethods;
  const wrapped = new Proxy(context, {
    get(target, key) {
      if (key === 'canvas') return element;
      if (methods.has(key)) return methods.get(key);
      const value = target[key];
      if (typeof value !== 'function') return value;
      // Only image-consuming methods need the simulated DOM converted to a
      // native surface. Numeric draws and state changes can call WebGL directly.
      let call;
      if (sourceMethods.has(key) && type === '2d') {
        call = (source, ...args) => value.call(target, surfaceFor(source), ...args);
      } else if (sourceMethods.has(key)) {
        call = (...args) => {
          const last = args.length - 1;
          if (last >= 0) args[last] = surfaceFor(args[last]);
          return value.apply(target, args);
        };
      } else {
        call = value.bind(target);
      }
      methods.set(key, call);
      return call;
    },
    set(target, key, value) {
      if (!Reflect.set(target, key, value)) return false;
      // Honor instrumentation installed through the context. Its saved
      // original method is already bound to the underlying native object.
      if (typeof value === 'function') methods.set(key, value);
      else if (methods.has(key)) methods.delete(key);
      return true;
    },
    defineProperty(target, key, descriptor) {
      if (!Reflect.defineProperty(target, key, descriptor)) return false;
      methods.delete(key);
      return true;
    },
    deleteProperty(target, key) {
      if (!Reflect.deleteProperty(target, key)) return false;
      methods.delete(key);
      return true;
    },
  });
  contextTypes.set(wrapped,type);
  return wrapped;
}

function patchElements(window) {
  if (patched) return;
  patched = true;
  const env = element => environments.get(element.ownerDocument);
  const element = window.HTMLElement.prototype;
  const template = window.HTMLTemplateElement.prototype;
  const templateContent = Object.getOwnPropertyDescriptor(template, 'content').get;
  const html = Object.getOwnPropertyDescriptor(window.Element.prototype, 'innerHTML');
  Object.defineProperty(window.Element.prototype,'innerHTML',{...html,set(value){
    html.set.call(this,value);
    // Parsed videos must have media state before the caller mounts controls.
    env(this)?.onMarkupChanged?.(this);
  }});
  const cloneElement = window.Element.prototype.cloneNode, serializeElement = window.Element.prototype.toString;
  // Linkedom initially clones template children into a separate fragment. The
  // lobby edits that fragment and then serializes innerHTML; both must expose
  // the same live content, including when it becomes empty or is reassigned.
  Object.defineProperty(template, 'content', { configurable: true, get() {
    const content = templateContent.call(this);
    if (this.hasChildNodes()) content.replaceChildren(...this.childNodes);
    return content;
  } });
  Object.defineProperty(template, 'innerHTML', { configurable: true,
    get() { return html.get.call(this.content); },
    set(value) { html.set.call(this.content, String(value ?? '')); },
  });
  template.cloneNode = function (deep = false) {
    const copy = cloneElement.call(this, false);
    if (deep) copy.innerHTML = this.innerHTML;
    return copy;
  };
  template.toString = function () {
    const copy = cloneElement.call(this, false);
    html.set.call(copy, this.innerHTML);
    return serializeElement.call(copy);
  };
  const stylePrototype = Object.getPrototypeOf(window.document.createElement('div').style);
  const setProperty = stylePrototype.setProperty;
  stylePrototype.getPropertyPriority = function (name) { return /\s*!important\s*$/.test(String(this.getPropertyValue(name))) ? 'important' : ''; };
  stylePrototype.setProperty = function (name,value,priority='') { return setProperty.call(this,name,priority==='important' ? `${value} !important` : value); };
  const readStyle = Object.getOwnPropertyDescriptor(window.Element.prototype, 'style').get;
  const wrappedStyles = new WeakMap();
  Object.defineProperty(window.Element.prototype, 'style', { configurable: true, get() {
    if (!wrappedStyles.has(this)) {
      const owner = this, native = readStyle.call(this), methods = new Map();
      const invalidate = property => {
        if (!owner.isConnected) return;
        const layout = env(owner)?.layout;
        if (layout?.invalidateStyle) layout.invalidateStyle(owner, property);
        else layout?.invalidate();
      };
      wrappedStyles.set(this, new Proxy(native, {
        get(target, name) {
          const value = target[name];
          if (typeof value !== 'function') return value;
          if (!methods.has(name)) methods.set(name, (...args) => {
            const mutates = name === 'setProperty' || name === 'removeProperty';
            const before = mutates ? target.cssText : null;
            const result = value.apply(target, args);
            if (mutates && target.cssText !== before) invalidate(args[0]);
            return result;
          });
          return methods.get(name);
        },
        set(target, name, value) {
          const before = target[name]; target[name] = value;
          if (target[name] !== before) invalidate(name);
          return true;
        },
      }));
    }
    return wrappedStyles.get(this);
  } });
  for (const name of ['clientWidth', 'clientHeight', 'offsetWidth', 'offsetHeight', 'offsetLeft', 'offsetTop', 'scrollWidth', 'scrollHeight']) {
    Object.defineProperty(element, name, { configurable: true, get() {
      const box = env(this)?.layout?.box(this) || blankRect();
      return ({ clientWidth: box.width, clientHeight: box.height, offsetWidth: box.width, offsetHeight: box.height, offsetLeft: box.x, offsetTop: box.y, scrollWidth: box.scrollWidth ?? box.width, scrollHeight: box.scrollHeight ?? box.height })[name];
    } });
  }
  for (const name of ['scrollLeft', 'scrollTop']) {
    const positions = new WeakMap();
    Object.defineProperty(element, name, { configurable: true,
      get() { return positions.get(this) || 0; },
      set(value) {
        const n=Number(value),next=Number.isFinite(n)?n:0;
        if(next===(positions.get(this)||0))return;
        positions.set(this,next);env(this)?.layout?.invalidatePaint?.();
      },
    });
  }
  element.getBoundingClientRect = function () { return env(this)?.layout?.rect(this) || blankRect(); };
  element.getClientRects = function () { const rect = this.getBoundingClientRect(); return rect.width && rect.height ? [rect] : []; };
  window.Element.prototype.getBoundingClientRect=element.getBoundingClientRect;
  window.Element.prototype.getClientRects=element.getClientRects;
  element.setPointerCapture = function (id) { env(this)?.capture.set(id, this); };
  element.hasPointerCapture = function (id) { return env(this)?.capture.get(id) === this; };
  element.releasePointerCapture = function (id) {
    if (!this.hasPointerCapture(id)) return;
    env(this).capture.delete(id);
    const event = new window.Event('lostpointercapture', { bubbles: true }); event.pointerId = id; this.dispatchEvent(event);
  };
  element.focus = function () {
    const host = env(this); if (!host || this.disabled) return;
    if (host.document.activeElement !== this) { host.document.activeElement?.blur?.(); host.document.activeElement = this; this.dispatchEvent(new window.Event('focus')); }
    host.onElementFocus?.(this);
  };
  element.blur = function () { const host = env(this); if (host?.document.activeElement === this) host.document.activeElement = host.document.body; host?.onElementBlur?.(this); this.dispatchEvent(new window.Event('blur')); };
  element.scrollTo = function (x, y) { if (typeof x === 'object') { y = x.top; x = x.left; } if (x != null) this.scrollLeft = x; if (y != null) this.scrollTop = y; this.dispatchEvent(new window.Event('scroll')); };
  element.scrollIntoView = function (options) { env(this)?.layout?.scrollIntoView(this, options); };
  element.animate = function (frames, options) { return env(this).animations.animate(this, frames, options); };
  element.getAnimations = function (options = {}) { return env(this).animations.forElement(this, options.subtree); };
  Object.defineProperty(element,DRAW_BUTTON_PRESS_SCALE,{value(factor){
    const host=env(this);
    if(!host||(host.buttonPressScales.get(this)??1)===factor)return;
    if(factor===1)host.buttonPressScales.delete(this);
    else host.buttonPressScales.set(this,factor);
    if(this.isConnected)host.layout?.invalidatePaint();
  }});
  const canvas = window.HTMLCanvasElement.prototype;
  Object.defineProperty(canvas, RELEASE_OWNED_CANVAS, { value() { retireCanvas(this); } });
  Object.defineProperty(canvas, OWNED_CANVAS_FRAME, { value() {
    const host = env(this);
    if (!host || retiredCanvases.has(this)) return;
    if (!frameManagedCanvases.has(this)) {
      frameManagedCanvases.add(this);
      if (this.isConnected) host.layout?.invalidate();
    } else if (this.isConnected) {
      host.layout?.invalidatePaint();
    }
  } });
  for (const name of ['width', 'height']) Object.defineProperty(canvas, name, { configurable: true,
    get() { return this[nativeSurface]?.[name] ?? Number(this.getAttribute(name) || (name === 'width' ? 300 : 150)); },
    set(value) { this.setAttribute(name, String(Math.max(0, Number(value) || 0))); if (this[nativeSurface]) this[nativeSurface][name] = Number(value); },
  });
  canvas.getContext = function (type, options) {
    const host = env(this); if (!host || retiredCanvases.has(this)) return null;
    surfaceFor(this);
    this._contexts ||= new Map();
    if (!this._contexts.has(type)) {
      const context = this[nativeSurface].getContext(type, options);
      this._contexts.set(type, context ? wrapContext(context, this, type) : null);
    }
    return this._contexts.get(type);
  };
  canvas.toDataURL = function (...args) { return this[nativeSurface]?.toDataURL(...args) || 'data:,'; };
  canvas.requestAnimationFrame = function (callback) { return env(this).requestAnimationFrame(callback); };
  canvas.cancelAnimationFrame = function (id) { env(this).cancelAnimationFrame(id); };
  const image = window.HTMLImageElement.prototype;
  Object.defineProperty(image, 'src', { configurable: true, get() { return this.getAttribute('src') || ''; }, set(value) { this.setAttribute('src', value); env(this)?.loadImage(this); } });
  for (const name of ['naturalWidth', 'naturalHeight', 'complete']) Object.defineProperty(image, name, { configurable: true, get() { return name === 'complete' ? Boolean(this._loaded) : this[nativeSurface]?.[name === 'naturalWidth' ? 'width' : 'height'] || 0; } });
  for (const name of ['width', 'height']) Object.defineProperty(image, name, { configurable: true,
    get() {
      const authored = this.getAttribute(name);
      if (authored != null) return Math.max(0, Number(authored) || 0);
      return this[nativeSurface]?.[name] || 0;
    },
    set(value) { this.setAttribute(name, String(Math.max(0, Number(value) || 0))); },
  });
  image.decode = function () { const host = env(this); return host?.loadImage(this) || Promise.resolve(); };
  for (const input of [window.HTMLInputElement.prototype, window.HTMLTextAreaElement.prototype]) {
    Object.defineProperties(input, {
      maxLength: { configurable:true, get(){ return this.hasAttribute('maxlength') ? Number(this.getAttribute('maxlength')) : -1; },set(value){this.setAttribute('maxlength',String(value));} },
      readOnly: { configurable:true, get(){ return this.hasAttribute('readonly'); },set(value){this.toggleAttribute('readonly',Boolean(value));} },
      selectionStart: { configurable:true, get(){return Math.min(this._selectionStart || 0,String(this.value || '').length);},set(value){this.setSelectionRange(value,this.selectionEnd);} },
      selectionEnd: { configurable:true, get(){return Math.min(this._selectionEnd || 0,String(this.value || '').length);},set(value){this.setSelectionRange(this.selectionStart,value);} },
    });
    input.setSelectionRange = function(start,end,direction='none') {
      const size=String(this.value || '').length;
      this._selectionEnd=Math.max(0,Math.min(size,Number(end)||0));this._selectionStart=Math.max(0,Math.min(this._selectionEnd,Number(start)||0));this.selectionDirection=direction;
    };
    input.select = function(){this.setSelectionRange(0,String(this.value || '').length);env(this)?.emit(this,'select');};
  }
  function setProgressAttribute(element,name,value){
    const text=String(value);
    if(element.getAttribute(name)===text)return;
    element.setAttribute(name,text);
    // LinkeDOM's observer can deliver reflected writes later than the next
    // canvas render. The setter must also mark the value as changed now.
    env(element)?.layout?.invalidateAttribute?.(element,name);
  }
  // Parsed PROGRESS nodes use HTMLElement in LinkeDOM. Its specialized
  // constructor is not guaranteed for markup, so reflect only that tag.
  for(const name of ['max','value']){
    const original=Object.getOwnPropertyDescriptor(element,name);
    Object.defineProperty(element,name,{configurable:true,
      get(){
        if(this.tagName!=='PROGRESS')return original?.get?.call(this);
        const number=Number(this.getAttribute(name));
        return name==='max' ? Number.isFinite(number)&&number>0?number:1
          : Math.max(0,Math.min(this.max,number||0));
      },
      set(value){
        if(this.tagName!=='PROGRESS'){
          if(original?.set)original.set.call(this,value);
          else Object.defineProperty(this,name,{value,writable:true,enumerable:true,configurable:true});
          return;
        }
        const n=Number(value);
        if(Number.isFinite(n)&&(name==='value'||n>0))setProgressAttribute(this,name,Math.max(0,n));
      },
    });
  }
  const select = window.HTMLSelectElement.prototype;
  Object.defineProperties(select, {
    value: { configurable: true,
      get() { return this._selectionEmpty ? '' : (this.querySelector('option[selected]') || this.options[0])?.value || ''; },
      set(value) {
        let found = false;
        for (const option of this.options) { const selected = !found && option.value === String(value); option.selected = selected; found ||= selected; }
        this._selectionEmpty = !found; env(this)?.layout?.invalidate();
      },
    },
    selectedIndex: { configurable: true,
      get() { return this._selectionEmpty ? -1 : Math.max(0, [...this.options].findIndex(option => option.selected)); },
      set(index) { this.value = this.options[Number(index)]?.value ?? '\u0000'; },
    },
  });
}

export function createDomEnvironment(api, { resources, baseURL, markup = '<html><head></head><body></body></html>', screenCanvas, width, height, pixelRatio = 1, globalScope = globalThis }) {
  const { window: domWindow, document } = parseHTML(markup);
  const window = new Proxy(domWindow, {
    get(target, key) {
      if (key === 'window' || key === 'self') return window;
      if (key === 'document') return document;
      if (['addEventListener','removeEventListener','dispatchEvent'].includes(key)) return target[key];
      return Object.hasOwn(globalScope, key) ? globalScope[key] : target[key];
    },
    set(_target, key, value) { globalScope[key] = value; return true; },
  });
  const properties = new Map(), pendingImages = new Set(), observers = new Set();
  let disposed = false;
  const frameSource = globalThis.requestAnimationFrame || screenCanvas?.requestAnimationFrame?.bind(screenCanvas);
  const cancelSource = globalThis.cancelAnimationFrame || screenCanvas?.cancelAnimationFrame?.bind(screenCanvas);
  const host = { api, resources, document, window, capture: new Map(), canvases: new Set(), buttonPressScales:new WeakMap(),
    width, height, pixelRatio, scope: globalScope, layout: null, animations: null,
    isFrameManagedCanvas: canvas => frameManagedCanvases.has(canvas),
    requestAnimationFrame: callback => frameSource(callback), cancelAnimationFrame: id => cancelSource(id),
  };
  // Prototype patches outlive individual scopes. Capture Linkedom's own
  // constructors, not a runtime proxy that changes when another scene mounts.
  environments.set(document, host); patchElements(domWindow);
  Object.defineProperty(document, 'defaultView', { configurable: true, value: window });
  const base = document.createElement('base'); base.href = baseURL; document.head.prepend(base);
  Object.defineProperty(document, 'baseURI', { configurable: true, value: baseURL });
  document.hidden = false; document.visibilityState = 'visible'; document.readyState = 'complete';
  document.activeElement = document.body;
  document.hasFocus = () => !document.hidden;
  document.elementFromPoint = (x, y, excludedSubtree) => host.layout?.hit(x, y, null, excludedSubtree) || document.body;
  document.fonts = { ready: Promise.resolve(), check: () => true, load: () => Promise.resolve([]), addEventListener() {}, removeEventListener() {} };
  const Event = domWindow.Event;
  function emit(target, name, fields) {
    // A failed img request fires on that element. The window's error handler
    // reports runtime exceptions and must not treat a missing icon as one.
    const imageError = name === 'error' && target.tagName === 'IMG';
    const event = new Event(name, { bubbles: !imageError, cancelable: !imageError }); Object.assign(event, fields);
    // Linkedom registers HTMLElement.on* through addEventListener already.
    // Calling the property again completes image loads and button actions twice.
    try {
      target.dispatchEvent(event);
      if (target === window || target.nodeType === 9) target[`on${name}`]?.(event);
    } catch (error) {
      // Browser event-handler errors reach the window; they are not image
      // decode rejections that may be swallowed by the resource cache.
      if (name === 'error') throw error;
      console.error('[wechat-dom-event]', error);
      emit(window, 'error', { error, message: error?.message || String(error) });
    }
    if (!imageError && target !== window && target.isConnected && !event.cancelBubble) window.dispatchEvent(event);
    return event;
  }
  host.emit = emit;
  const failedImages = new WeakSet();
  host.imageFailed = image => failedImages.has(image) && image._loadingSrc === image.src;
  function invalidateImage(image) {
    if (image.isConnected) {
      const layout = host.layout;
      if (layout?.invalidateImage) layout.invalidateImage(image);
      else layout?.invalidate();
    }
  }
  function imageLoaded(image) { invalidateImage(image); emit(image,'load'); }
  function imageError(image, error) {
    failedImages.add(image);
    if (image.isConnected) host.layout?.invalidatePaint?.();
    emit(image, 'error', { error });
  }
  host.loadImage = image => {
    const src = image.getAttribute('src');
    if (!src || disposed) return Promise.resolve();
    if (image._loadingSrc === src) return image._imageReady;
    failedImages.delete(image);
    if(host.loadImageSurface){
      image._loadingSrc=src;image._loaded=false;
      const resolved=resources.resolve(src,baseURL),cached=host.peekImageSurface?.(resolved);
      if(cached){
        image[nativeSurface]=cached;
        image._loaded=true;
        invalidateImage(image);
        image._imageReady=Promise.resolve().then(()=>{
          if(!disposed&&image._loadingSrc===src)emit(image,'load');
        });
        return image._imageReady;
      }
      image._imageReady = host.loadImageSurface(resolved).then(surface => {
        if (disposed || image._loadingSrc !== src) return;
        image[nativeSurface] = surface;
        image._loaded = true;
        imageLoaded(image);
      }, error => {
        if (disposed || image._loadingSrc !== src) return;
        imageError(image, error);
        throw error;
      });
      image._imageReady.catch(()=>{});return image._imageReady;
    }
    const native = api.createImage(); image[nativeSurface] = native; image._loadingSrc = src; image._loaded = false;
    image._imageReady = new Promise((resolve, reject) => {
      const finish = error => {
        pendingImages.delete(cancel); native.onload = native.onerror = null;
        if (disposed || image[nativeSurface] !== native) { resolve(); return; }
        image._loaded = !error;
        if (error) { imageError(image, error); reject(error); }
        else { imageLoaded(image); resolve(); }
      };
      const cancel = () => { native.onload = native.onerror = null; pendingImages.delete(cancel); resolve(); };
      pendingImages.add(cancel);
      native.onload = () => finish(); native.onerror = error => finish(new Error(`图片读取失败：${src} ${error?.errMsg || ''}`));
      native.src = /^(data:|blob:|wxfile:)/.test(src) || src.startsWith(api.env.USER_DATA_PATH) ? src : resources.resolve(src, baseURL);
    });
    // Image.onerror is the browser-compatible delivery path. decode() can
    // additionally await/reject this promise without an unhandled rejection.
    image._imageReady.catch(() => {});
    return image._imageReady;
  };
  const applyMutations = records => {
    if (!records.length) return;
    // A score/text/style update must not walk every portrait in the document.
    // Only new image subtrees and changed sources need to start image loads.
    const images = new Set();
    for (const record of records) {
      if(record.type==='attributes'){
        if(record.oldValue===record.target.getAttribute(record.attributeName))continue;
        if(host.layout?.invalidateAttribute)host.layout.invalidateAttribute(record.target,record.attributeName);
        else host.layout?.invalidate();
      }else host.layout?.invalidate();
      if (record.type === 'attributes' && record.attributeName === 'src' && record.target.tagName === 'IMG') images.add(record.target);
      if (record.type === 'childList') for (const node of record.addedNodes) {
        if (node.nodeType !== 1 || !node.isConnected) continue;
        if (node.tagName === 'IMG' && node.hasAttribute('src')) images.add(node);
        for (const image of node.querySelectorAll('img[src]')) images.add(image);
      }
    }
    for (const image of images) host.loadImage(image);
  };
  const mutations = new window.MutationObserver(applyMutations);
  mutations.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeOldValue:true, characterData: true });
  host.flushMutations = () => applyMutations(mutations.takeRecords());
  class ResizeObserver {
    constructor(callback) { this.callback = callback; this.targets = new Map(); observers.add(this); }
    observe(target) { this.targets.set(target, ''); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); observers.delete(this); }
  }
  host.notifyResize = () => {
    for (const observer of observers) {
      const changes = [];
      for (const [target, old] of observer.targets) {
        const rect = host.layout?.rect(target) || blankRect(), key = `${rect.width}:${rect.height}`;
        if (old !== key) { observer.targets.set(target, key); changes.push({ target, contentRect: rect, borderBoxSize: [{ inlineSize: rect.width, blockSize: rect.height }] }); }
      }
      if (changes.length) observer.callback(changes, observer);
    }
  };
  const storage = { getItem(key) { const v = api.getStorageSync(key); return v === '' || v == null ? null : String(v); }, setItem(key, value) { api.setStorageSync(key, String(value)); }, removeItem(key) { api.removeStorageSync(key); } };
  const location = new URL(baseURL); location.assign = () => { throw new Error('微信页面切换必须通过游戏内导航'); }; location.reload = () => api.restartMiniProgram?.();
  function installProperty(key, value) { properties.set(key, Object.getOwnPropertyDescriptor(globalScope, key)); Object.defineProperty(globalScope, key, { configurable: true, writable: true, value }); }
  function install() {
    // Native wx contexts need not inherit the browser's global constructors.
    // Only contexts actually returned by this adapter receive this brand.
    class WebGLRenderingContext { static [Symbol.hasInstance](value) { return ['webgl','experimental-webgl'].includes(contextTypes.get(value)); } }
    class WebGL2RenderingContext { static [Symbol.hasInstance](value) { return contextTypes.get(value)==='webgl2'; } }
    const exports = { window, self: window, document, location, localStorage: storage, sessionStorage: storage,
      WebGLRenderingContext,WebGL2RenderingContext,
      focus: () => emit(window, 'focus'), blur: () => emit(window, 'blur'),
      innerWidth: width, innerHeight: height, devicePixelRatio: pixelRatio, ResizeObserver,
      Image: function (w, h) { const image = document.createElement('img'); if (w) image.width = w; if (h) image.height = h; return image; },
      getComputedStyle: (node, pseudo) => { host.layout?.update(); return host.layout?.styles.read(node, String(pseudo || '').replace(/^::?/, '')) || node.style; },
      matchMedia: query => ({ media: query, matches: mediaMatches(query, { width, height }), addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
      screen: { width, height, availWidth: width, availHeight: height, orientation: { type: 'portrait-primary' } },
      navigator: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 MicroMessenger MiniGame', appVersion: '5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)', platform: 'WeChat', maxTouchPoints: 5, language: 'zh-CN', onLine:true, clipboard: { writeText: text => new Promise((resolve, reject) => api.setClipboardData({ data: text, success: resolve, fail: reject })) } },
      requestAnimationFrame: host.requestAnimationFrame, cancelAnimationFrame: host.cancelAnimationFrame,
    };
    for (const name of ['HTMLElement', 'Element', 'HTMLCanvasElement', 'HTMLImageElement', 'HTMLVideoElement', 'Node', 'DOMParser', 'MutationObserver', 'Event', 'CustomEvent', 'EventTarget']) exports[name] = window[name];
    for (const [key, value] of Object.entries(exports)) installProperty(key, value);
    if (!globalThis.TextDecoder) installProperty('TextDecoder', class { decode(bytes = new Uint8Array()) { return buf2string(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)); } });
    if (!globalThis.TextEncoder) installProperty('TextEncoder', class { encode(text = '') { return string2buf(text); } });
  }
  const hide = () => { document.hidden = true; document.visibilityState = 'hidden'; for (const [id, target] of host.capture) { emit(target, 'pointercancel', { pointerId: id }); target.releasePointerCapture(id); } emit(document, 'visibilitychange'); emit(window, 'blur'); };
  const show = () => { document.hidden = false; document.visibilityState = 'visible'; emit(document, 'visibilitychange'); emit(window, 'focus'); };
  api.onHide?.(hide); api.onShow?.(show);
  return Object.assign(host, { install, storage,
    dispose() {
      if (disposed) return; disposed = true;
      api.offHide?.(hide); api.offShow?.(show); mutations.disconnect(); observers.clear();
      for (const cancel of [...pendingImages]) cancel();
      for (const canvas of host.canvases) retireCanvas(canvas);
      host.canvases.clear(); host.capture.clear(); environments.delete(document);
      for (const [key, descriptor] of properties) { if (descriptor) Object.defineProperty(globalScope, key, descriptor); else delete globalScope[key]; }
    },
  });
}
