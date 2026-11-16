import { createBattleFramePresenter } from './battle-frame-presenter.js';
import { createNativeFrameCapture } from './frame-capture.js';
import { createRuntimeScope } from './runtime-scope.js';
import { createDomEnvironment, nativeSurface } from './dom-environment.js';
import { createDomStyles } from './dom-style.js';
import { createDomLayout } from './dom-layout.js';
import { createDomPainter } from './dom-painter.js';
import { createDomAnimations } from './dom-animation.js';
import { createNativeNetwork } from './network.js';
import { installNativeMedia } from './media.js';
import { attachDomInput } from './dom-input.js';
import { createBattleDataFetch } from './battle-data-fetch.js';
import { createBattleDataCache } from './battle-data-cache.js';

// Preserve the original bridge's message identity, start/configure handshake,
// settlement and retry protocol. Only the browser iframe is substituted.
export function installBattleFrames(parentHost, { Yoga, sheet, markup, loadBattle, loadEngine, paintScreen, installMedia = true, measurePerformance, measureTransfer }) {
  const createElement = parentHost.document.createElement.bind(parentHost.document);
  const attached = new WeakMap(), connected = new Set();
  const battleData = createBattleDataCache();
  parentHost.api.onMemoryWarning?.(battleData.clear);
  const paintEmbeddedFrame=new WeakMap();
  parentHost.paintEmbeddedFrame=paintEmbeddedFrame;
  let screenOwner=null;
  let destroyed = false;
  function connect(state) {
    if (destroyed || !state.hasSource() || !state.frame.isConnected) return;
    connected.add(state);
    void state.mount();
  }
  function attach(frame) {
    let source = '', generation = 0, failedGeneration = -1, child = null, mounting = false;
    const hasSource = () => Boolean(source && source !== 'about:blank');
    const state = { frame, dispose, mount, hasSource, tick: time=>child?.presenter.tick(time), get phase(){
      if(!frame.isConnected)return 'lobby';
      return !child || child.host.document.getElementById('stage')?.hasAttribute('data-awaiting-start') ? 'loading' : 'battle';
    }};
    attached.set(frame,state);
    function release(value) {
      if (!value) return;
      const { host, lifetime, painter, runtime } = value;
      for (const cleanup of [
        () => host?.emit(host.window,'shnh-dispose-replica-battle'),
        () => runtime?.dispose(), () => lifetime.dispose(), () => painter?.destroy(),
        () => host?.animations?.destroy(), () => host?.layout?.destroy(), () => host?.dispose(),
      ]) try { cleanup(); } catch(error) { console.warn('[wechat-battle-dispose]',error); }
    }
    function unmount() {
      const previous = child; child = null;
      paintEmbeddedFrame.delete(frame);
      if(screenOwner===state)screenOwner=null;
      if(previous)parentHost.layout.invalidatePaint();
      release(previous);
    }
    function dispose() { generation++;unmount(); }
    async function mount() {
      if (destroyed || mounting || child || failedGeneration === generation || !frame.isConnected || !source || source === 'about:blank') return;
      mounting = true; const ticket = generation; let owned;
      try {
        // Loading code and the engine must finish before allocating a child
        // surface. A cancelled sortie cannot resume into a disposed host.
        const [createBattle, createEngine] = await Promise.all([loadBattle(), loadEngine?.()]);
        if (destroyed || ticket !== generation || !frame.isConnected) return;
        const rect = frame.getBoundingClientRect(), width = rect.width || parentHost.width, height = rect.height || parentHost.height;
        const lifetime = createRuntimeScope(parentHost.scope);
        owned = { lifetime };
        const fighterTextures = parentHost.resources.createTextureScope?.();
        if(fighterTextures)lifetime.onDispose(fighterTextures.dispose);
        const host = createDomEnvironment(parentHost.api, { resources: parentHost.resources, baseURL: source, width, height, pixelRatio: parentHost.pixelRatio, markup, globalScope: lifetime.scope });
        if(measurePerformance)host.measurePerformance=measurePerformance;
        owned.host = host;
        host.loadImageSurface=parentHost.loadImageSurface;host.fontFamilies=parentHost.fontFamilies;
        host.requestAnimationFrame = lifetime.scope.requestAnimationFrame; host.cancelAnimationFrame = lifetime.scope.cancelAnimationFrame;
        const measureCanvas = parentHost.api.createCanvas();
        lifetime.onDispose(() => { measureCanvas.width = measureCanvas.height = 0; });
        host.layout = createDomLayout(host, createDomStyles(sheet,{width,height},{fontFamilies:host.fontFamilies}), Yoga, measureCanvas.getContext('2d'));
        host.animations = createDomAnimations(); host.install();
        const network = createNativeNetwork(parentHost.api,{baseURL:source,resolve:value=>parentHost.resources.resolve(value,source),decode:parentHost.resources.decodeBytes,requestAsset:parentHost.resources.requestAsset,readLocal:parentHost.resources.readBytes});
        Object.assign(lifetime.scope,network,{__THUNDER_RUNTIME_GLOBALS__:{...parentHost.scope.__THUNDER_RUNTIME_GLOBALS__,embeddedBattle:true,nativeDocument:true},__THUNDER_DEFER_RUNTIME_START__:true});
        const parent = new Proxy(parentHost.window,{get(target,key){if(key==='postMessage')return (data,origin)=>{
          if(origin!=='*'&&origin!==parentHost.scope.location.origin)return;
          parentHost.scope.setTimeout(()=>{if(child?.host===host)parentHost.emit(parentHost.window,'message',{data,origin:host.scope.location.origin,source:host.window});},0);
        };return target[key];}});
        host.scope.parent = parent; host.scope.top = parentHost.window;
        host.scope.postMessage = (data,origin) => {
          if(origin!=='*'&&origin!==host.scope.location.origin)return;
          host.scope.setTimeout(()=>host.emit(host.window,'message',{data,origin:parentHost.scope.location.origin,source:parent}),0);
        };
        const media = installMedia ? installNativeMedia(host) : null; lifetime.onDispose(()=>media?.destroy()); lifetime.onDispose(()=>network.dispose());
        const capture = createNativeFrameCapture(parentHost.api,measureTransfer); lifetime.onDispose(() => capture.dispose());
        const painter = createDomPainter(host,host.layout);
        owned.painter = painter;
        const presenter = createBattleFramePresenter({paint:paintScreen,
          isActive:()=>!destroyed&&child?.host===host&&frame.isConnected&&screenOwner===state});
        lifetime.onDispose(()=>presenter.destroy());
        const input = attachDomInput(host, { listen: false }); lifetime.onDispose(() => input.destroy());
        child = Object.assign(owned, {input,presenter,runtime:null});
        let isolatedCanvas;
        const paintFrame=(context,left,top,drawWidth,drawHeight)=>{
          // Iframe opacity, filter or blend applies to its whole flattened image.
          // The normal battle path is opaque, unfiltered and draws in place.
          if(context.globalAlpha===1 && (context.globalCompositeOperation||'source-over')==='source-over' &&
              (!context.filter||context.filter==='none')){
            painter.render(context,left,top,drawWidth,drawHeight);
            return;
          }
          if(!isolatedCanvas){
            isolatedCanvas=parentHost.api.createCanvas();
            isolatedCanvas.width=Math.round(width*host.pixelRatio);isolatedCanvas.height=Math.round(height*host.pixelRatio);
            lifetime.onDispose(()=>{isolatedCanvas.width=isolatedCanvas.height=0;});
          }
          const isolated=isolatedCanvas.getContext('2d');
          isolated.setTransform(host.pixelRatio,0,0,host.pixelRatio,0,0);isolated.clearRect(0,0,width,height);
          painter.render(isolated);
          if(measureTransfer)measureTransfer('isolatedFrameCopy',isolatedCanvas.width*isolatedCanvas.height,()=>context.drawImage(isolatedCanvas,left,top,drawWidth,drawHeight));
          else context.drawImage(isolatedCanvas,left,top,drawWidth,drawHeight);
        };
        paintEmbeddedFrame.set(frame,{width,height,paint:paintFrame});
        screenOwner=state;
        parentHost.layout.invalidatePaint();
        const battleCanvas = host.document.createElement('canvas'); host.document.getElementById('canvas').append(battleCanvas);
        host.battleCanvas=battleCanvas;host.measureTransfer=measureTransfer;
        let frozenCanvas, frozenContext, snapshotDisabled = false;
        lifetime.onDispose(() => {
          host.frozenBattleSurface = undefined;
          if (frozenCanvas) frozenCanvas.width = frozenCanvas.height = 0;
        });
        const frozenFrame = {
          capture() {
            const source = battleCanvas[nativeSurface];
            if (snapshotDisabled || !source?.width || !source.height || host.document.hidden) return false;
            try {
              if (!frozenCanvas) frozenCanvas = parentHost.api.createCanvas();
              if (frozenCanvas.width !== source.width) frozenCanvas.width = source.width;
              if (frozenCanvas.height !== source.height) frozenCanvas.height = source.height;
              frozenContext ||= frozenCanvas.getContext('2d');
              frozenContext.clearRect(0, 0, source.width, source.height);
              if (measureTransfer) measureTransfer('battleSnapshot', source.width * source.height, () => frozenContext.drawImage(source, 0, 0));
              else frozenContext.drawImage(source, 0, 0);
              host.frozenBattleSurface = frozenCanvas;
              return true;
            } catch (error) {
              snapshotDisabled = true;
              console.warn('[wechat-frozen-battle]',error);
              return false;
            }
          },
          present() { if (host.frozenBattleSurface) presenter.present(performance.now()); },
        };
        const presentFrame = () => {
          // Keep showing the snapshot through the first live update and its
          // framebuffer clear. Switch sources only on a completed render.
          const snapshot = host.frozenBattleSurface;
          host.frozenBattleSurface = undefined;
          let presented = false;
          try {
            presented = presenter.present(performance.now());
            return presented;
          } finally {
            if (!presented) host.frozenBattleSurface = snapshot;
          }
        };
        if(createEngine) host.scope.__PHASER_ENGINE__ = createEngine(host.scope).default;
        const exports = createBattle(lifetime.scope);
        const fetchResource = createBattleDataFetch(network.fetch, parentHost.resources, source);
        const baseURL = host.scope.location.href;
        const loadBattleData = parentHost.resources.isVersionedBattleData?.('data/chapters.json', baseURL)
          ? (chapterId, signal, prepare) => battleData.load(`${new URL('.', baseURL).href}\n${chapterId}`, signal, prepare)
          : undefined;
        child.runtime = exports.mountReplicaBattlePage({window:host.window,document:host.document,location:host.scope.location,parent,canvas:battleCanvas,fetchResource,
          readSharedLoadoutJSON:parentHost.scope.__THUNDER_RUNTIME_GLOBALS__?.readSharedLoadoutJSON,
          warmBattleImages:parentHost.warmBattleImages,
          loadBattleData,presentFrame,frozenFrame,skinHost:{aircraftCapture:capture,measureTransfer,assetBytes:fighterTextures,
            viewport:{width,height,pixelRatio:parentHost.pixelRatio}}});
        presenter.tick(performance.now());
        parentHost.emit(frame,'load');
      } catch(error) {
        if (child === owned) unmount(); else release(owned);
        if (!destroyed && ticket === generation && frame.isConnected) {
          failedGeneration = ticket;
          console.error('[wechat-battle-frame]',error); parentHost.emit(frame,'error',{error});
        }
      } finally {
        mounting = false;
        // A new src set while the old package request was pending must not
        // lose its mount just because that older attempt held this flag.
        if (!destroyed && ticket !== generation && hasSource() && frame.isConnected)
          parentHost.scope.setTimeout(()=>connect(state),0);
      }
    }
    Object.defineProperties(frame,{
      src:{configurable:true,get:()=>source,set:value=>{
        dispose();source=String(value);frame.setAttribute('src',source);
        if(!hasSource())connected.delete(state);
        else if(!destroyed)parentHost.scope.setTimeout(()=>connect(state),0);
      }},
      contentWindow:{configurable:true,get:()=>child?.host.window},contentDocument:{configurable:true,get:()=>child?.host.document},
    });
    for(const name of ['pointerdown','pointermove','pointerup','pointercancel'])frame.addEventListener(name,event=>{
      if(!child)return;const host=child.host,rect=frame.getBoundingClientRect();
      const x=(event.clientX-rect.left)/rect.width*host.width,y=(event.clientY-rect.top)/rect.height*host.height;
      const method = {pointerdown:'start',pointermove:'move',pointerup:'end',pointercancel:'cancel'}[name];
      child.input[method]({changedTouches:[{identifier:event.pointerId,clientX:x,clientY:y}]});
    });
    return frame;
  }
  const createFrameElement=(name,...args)=>{const node=createElement(name,...args);return !destroyed&&name.toLowerCase()==='iframe'?attach(node):node;};
  parentHost.document.createElement=createFrameElement;
  const observer=new parentHost.scope.MutationObserver(records=>{
    if(destroyed)return;
    // No historical frame is held by the document. Reparenting in one batch
    // preserves a live child; a detached frame can mount again if reinserted.
    if(connected.size && records.some(record=>record.type==='childList'&&record.removedNodes.length)){
      for(const state of connected)if(!state.frame.isConnected){connected.delete(state);state.dispose();}
    }
    for(const record of records)if(record.type==='childList')for(const node of record.addedNodes){
      if(node.nodeType!==1||!node.isConnected)continue;
      // The bridge adds its frame either directly or in its sortie section.
      // Unrelated tab contents and text changes never walk a subtree here.
      const nodes=node.tagName==='IFRAME'?[node]:
        node.classList?.contains('replica-battle-host')?node.getElementsByTagName('iframe'):[];
      for(const frame of nodes){const state=attached.get(frame);if(state)connect(state);}
    }
  });
  observer.observe(parentHost.document.documentElement,{childList:true,subtree:true});
  return {paint(time){if(screenOwner)screenOwner.tick(time);else paintScreen();},get phase(){
    for(const row of connected){const phase=row.phase;if(phase!=='lobby')return phase;}
    return 'lobby';
  },destroy(){
    if(destroyed)return;
    destroyed=true;observer.disconnect();
    parentHost.api.offMemoryWarning?.(battleData.clear);
    battleData.clear();
    if(parentHost.document.createElement===createFrameElement)parentHost.document.createElement=createElement;
    for(const row of connected)row.dispose();
    connected.clear();delete parentHost.paintEmbeddedFrame;
  }};
}

