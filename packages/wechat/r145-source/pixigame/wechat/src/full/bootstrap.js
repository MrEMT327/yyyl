import URL from 'core-js-pure/actual/url/index.js';
import URLSearchParams from 'core-js-pure/actual/url-search-params/index.js';
import { buf2string } from 'pako/lib/utils/strings.js';
import { createRuntimeScope,createNativeCrypto } from './runtime-scope.js';
import { createSharedLoadoutReader } from './battle-data-cache.js';
import { createWechatResources } from './resources.js';
import { createNativeNetwork } from './network.js';
import { createAssetCache } from './asset-cache.js';
import { installNativeArt } from './native-art.js';
import { createDomEnvironment } from './dom-environment.js';
import { createDomStyles } from './dom-style.js';
import { createDomLayout } from './dom-layout.js';
import { createDomPainter } from './dom-painter.js';
import { createDomAnimations } from './dom-animation.js';
import { attachDomInput } from './dom-input.js';
import { installNativeMedia } from './media.js';
import { installBattleFrames } from './battle-frame.js';
import { loadYoga } from './yoga-native.js';
import { createBuildIdentity } from './build-identity.js';
import { installNativeViewport } from './native-viewport.js';
import { createStartupData } from './startup-data.js';
import { createDomFramePerformance } from './dom-frame-performance.js';
import { installNativeClock } from './native-clock.js';
import { createBattleDiagnostics } from './battle-diagnostics.js';

const api=wx,root=globalThis,canvas=api.createCanvas(),packages=new Map();
// Cap native surfaces at 2x, matching the portrait renderer. Every nested
// canvas inherits this ratio; 3x multiplies their pixel memory by 2.25.
const info=api.getWindowInfo(),ratio=Math.min(info.pixelRatio||1,2),viewport={width:info.windowWidth,height:info.windowHeight};
canvas.width=Math.round(viewport.width*ratio);canvas.height=Math.round(viewport.height*ratio);
const context=canvas.getContext('2d');
const buildIdentity=createBuildIdentity(typeof __WECHAT_BUILD_IDENTITY__==='undefined'?undefined:__WECHAT_BUILD_IDENTITY__);
const gameGlobal = typeof GameGlobal === 'undefined' ? root : GameGlobal;
const iosPerformanceMode = gameGlobal?.isIOSHighPerformanceModePlus ? 'high-performance-plus'
  : gameGlobal?.isIOSHighPerformanceMode ? 'high-performance' : 'normal';
const startupDetails = { ...buildIdentity.describe(), iosPerformanceMode };
const logs=[JSON.stringify({event:'wechat-build',...startupDetails})];let failure='';
console.info('[wechat-build]',startupDetails);
function status(message){context.setTransform(ratio,0,0,ratio,0,0);context.fillStyle='#071722';context.fillRect(0,0,viewport.width,viewport.height);context.fillStyle='#d8edf8';context.font='18px sans-serif';context.textAlign='center';context.fillText('少女航线',viewport.width/2,viewport.height*.42);context.font='13px sans-serif';const lines=String(message).match(/.{1,25}/g)||[];lines.forEach((line,index)=>context.fillText(line,viewport.width/2,viewport.height*.49+index*22));}
function failed(event){const error=event?.error??event;failure=error?.stack||String(error);const detail=buildIdentity.diagnose(error);logs.push(JSON.stringify(detail));console.error('[wechat-full]',detail);status(`加载失败：${error?.message||error}\n点击屏幕复制诊断日志`);}
api.onError?.(error=>{const detail=buildIdentity.diagnose(error);logs.push(JSON.stringify(detail));console.error('[wechat-full-error]',detail);});
api.onUnhandledRejection?.(event=>{const detail=buildIdentity.diagnose(event.reason);logs.push(JSON.stringify(detail));console.error('[wechat-full-promise]',detail);});
api.onTouchEnd(()=>{if(failure)api.setClipboardData({data:logs.join('\n')});});
Object.assign(root,{URL,URLSearchParams,WebAssembly:root.WXWebAssembly||root.WebAssembly});
installNativeClock(api,root,canvas);
const battleDiagnostics=typeof __WECHAT_BATTLE_DIAGNOSTICS__!=='undefined'&&__WECHAT_BATTLE_DIAGNOSTICS__
  ? createBattleDiagnostics(api,{buildId:startupDetails.buildId,iosPerformanceMode,
    cdnBase:typeof __WECHAT_CDN_BASE__==='undefined'?null:__WECHAT_CDN_BASE__}) : null;
function verifiedRuntime(name,factory){const runtime=buildIdentity.verify(name,factory);const detail=buildIdentity.describe();logs.push(JSON.stringify({event:'wechat-runtime',...detail}));console.info('[wechat-runtime]',detail);return runtime;}
function loadPackage(name) {
  if (!packages.has(name)) {
    const started = battleDiagnostics ? performance.now() : 0;
    battleDiagnostics?.note('subpackage-start', {name});
    packages.set(name, new Promise((resolve,reject) => api.loadSubpackage({name,
      success(result) {
        battleDiagnostics?.note('subpackage-ready', {name, elapsedMs:Math.round(performance.now()-started)});
        resolve(result);
      }, fail:reject,
    })).catch(error => {
      packages.delete(name);
      battleDiagnostics?.note('subpackage-failed', {name, elapsedMs:Math.round(performance.now()-started)});
      throw error;
    }));
  }
  return packages.get(name);
}
async function json(path) {
  const started = battleDiagnostics ? performance.now() : 0;
  const data=await new Promise((resolve,reject)=>api.getFileSystemManager().readCompressedFile({filePath:path,compressionAlgorithm:'br',success:result=>resolve(result.data),fail:reject}));
  const readEnd = battleDiagnostics ? performance.now() : 0;
  const parsed=JSON.parse(buf2string(new Uint8Array(data)));
  battleDiagnostics?.note('package-data-ready',{path,bytes:data.byteLength,readMs:Math.round(readEnd-started),parseMs:Math.round(performance.now()-readEnd)});
  return parsed;
}

async function start(){
  status('正在准备完整游戏…');
  const runtimeData=createStartupData({loadPackage,readJSON:json,splitBattleData:typeof __WECHAT_SPLIT_BATTLE_DATA__!=='undefined'&&__WECHAT_SPLIT_BATTLE_DATA__});
  const openingPackages=typeof __WECHAT_OPENING_PACKAGES__==='undefined'?[]:__WECHAT_OPENING_PACKAGES__;
  const entryReady=Promise.all([runtimeData.loadLobby(),loadPackage('lobby-code'),...openingPackages.map(loadPackage)]);
  // Font downloads and native layout preparation can overlap the larger code
  // and artwork packages. Observe early failures until entryReady is awaited.
  entryReady.catch(()=>{});
  const [presentation,Yoga,crypto]=await Promise.all([
    loadPackage('shared-data').then(()=>json('shared-data/presentation.json.br')),
    loadPackage('native-core').then(()=>loadYoga()),createNativeCrypto(api),
  ]);
  const lifetime=createRuntimeScope(root),scope=lifetime.scope,origin=__WECHAT_ASSET_ORIGIN__;
  Object.assign(root,{AbortController:scope.AbortController,DOMException:scope.DOMException});
  const resources=createWechatResources(api,{assetOrigin:origin,loadPackage}),cache=createAssetCache(api,resources);
  const host=createDomEnvironment(api,{resources,baseURL:origin+'/',...viewport,pixelRatio:ratio,screenCanvas:canvas,markup:presentation.lobbyMarkup,globalScope:scope});
  const sharedLoadout = createSharedLoadoutReader(resources);
  if (sharedLoadout) {
    api.onMemoryWarning?.(sharedLoadout.clear);
    lifetime.onDispose(() => {
      api.offMemoryWarning?.(sharedLoadout.clear);
      sharedLoadout.clear();
    });
  }
  let profile;
  try {
    // The preview build can opt in without adding an in-game overlay.
    if((typeof __WECHAT_COMPAT_PROFILE__!=='undefined' && __WECHAT_COMPAT_PROFILE__) ||
      String(api.getLaunchOptionsSync?.()?.query?.perf)==='1')profile=createDomFramePerformance();
  }
  catch { /* Launch options may be unavailable on older host versions. */ }
  const currentProfile=()=>battleDiagnostics?.profile||profile;
  const measure=(domain,name,run)=>{
    const activeProfile=currentProfile();
    return activeProfile ? activeProfile.measure(domain,name,run) : run();
  };
  if(profile||battleDiagnostics)host.measurePerformance=(name,run)=>measure('host',name,run);
  host.requestAnimationFrame=scope.requestAnimationFrame;host.cancelAnimationFrame=scope.cancelAnimationFrame;host.install();
  const environment=installNativeViewport(host,info);
  const network=createNativeNetwork(api,{baseURL:origin+'/',resolve:source=>resources.resolve(source),decode:resources.decodeBytes,requestAsset:resources.requestAsset,readLocal:resources.readBytes});
  Object.assign(scope,network,{crypto,__SHARED_JSON__:runtimeData.data,__THUNDER_DEFER_RUNTIME_START__:true});
  scope.URL.createObjectURL=blob=>resources.createAssetBytesUrl(blob.bytes,blob.type);
  scope.URL.revokeObjectURL=url=>resources.revokeAssetBytesUrl(url);
  const art=installNativeArt(host,cache);
  const fontFamilies=art.fontFamilies;
  host.fontFamilies=fontFamilies;
  // Let the first screen use the fallback font while the custom font loads.
  const lobbyFontNames=new Set(presentation.styles.lobby.fonts.map(font=>font['font-family'].replace(/^["']|["']$/g,'')));
  const loadFonts=sheets=>art.loadFonts(sheets,{onReady:names=>{
    if(names.some(name=>lobbyFontNames.has(name)))host.layout.invalidateFonts();
  }});
  host.layout=createDomLayout(host,createDomStyles(presentation.styles.lobby,viewport,{fontFamilies,environment}),Yoga,api.createCanvas().getContext('2d'),{
    layoutCacheKey(){
      const lobby=host.document.getElementById('gui-casual-lobby');
      if(lobby?.hidden)host.layout.clearCachedLayouts();
      if(!lobby||lobby.hidden||lobby.dataset.subpage!==''||lobby.querySelector('.pl-modal-host')?.firstChild)return null;
      const tab=lobby.dataset.tab;
      // The bottom tab opens the default shop category. Keep that layout
      // ready even if a visit ended after scrolling to another category.
      if(tab==='shop'&&lobby.querySelector('[data-shop-active]')?.dataset.shopActive!=='boxes')return null;
      return tab;
    },
  });
  const releaseLobbyCache=()=>{
    host.layout.clearCachedLayouts();
    host.emit(host.window,'shnh-memory-warning');
  };
  api.onMemoryWarning?.(releaseLobbyCache);
  lifetime.onDispose(()=>api.offMemoryWarning?.(releaseLobbyCache));
  const lobbyFonts=loadFonts([presentation.styles.lobby]).catch(error=>console.warn('[wechat-lobby-font]',error));
  host.animations=createDomAnimations();const media=installNativeMedia(host),input=attachDomInput(host);
  let core;
  scope.__THUNDER_RUNTIME_GLOBALS__={platformKind:'wechat',nativeDocument:true,embeddedBattle:true,yogaPromise:Promise.resolve(Yoga),
    readSharedLoadoutJSON:sharedLoadout?.read,
    loadImageSurface:host.loadImageSurface,loadCubismCore:async()=>core ||= require('./native-core/cubism.js')(scope),
    createAssetBytesUrl:resources.createAssetBytesUrl,createVerifiedAssetBytesUrl:resources.createVerifiedAssetBytesUrl,revokeAssetBytesUrl:resources.revokeAssetBytesUrl,
    loadPortraitData:typeof __WECHAT_SPLIT_PORTRAIT_DATA__!=='undefined'&&__WECHAT_SPLIT_PORTRAIT_DATA__ ? runtimeData.loadPortrait : undefined,
    performanceStats:()=>({buildId:buildIdentity.describe().buildId,layout:host.layout.stats,paint:painter.stats,canvasCount:host.canvases.size,
      ...(profile?{compatibility:profile.snapshot(),battleTransfers:profile.transfers()}: {})})};
  let battleReady;
  function prepareBattle(){
    if(!battleReady){
      battleReady=Promise.all([runtimeData.loadBattle(),loadPackage('battle-code'),loadPackage('battle-engine'),loadFonts([presentation.styles.battle])])
        .catch(error=>{battleReady=null;throw error;});
      // Queue the required packages first. The normal asset read joins this
      // load or retries it if the speculative download failed.
      void Promise.resolve().then(()=>resources.preloadAssetPackage('combat-art')).catch(()=>{});
    }
    return battleReady;
  }
  // A new portrait is presented as soon as it arrives. While it is advancing,
  // ambient effects ride on that paint instead of copying the same portrait.
  const painter=createDomPainter(host,host.layout,canvas,{skipUnchanged:true,paceAmbient:()=>frames.phase==='lobby'});let active=true;
  let lobbyInteractivePainted = false;
  const paintScreen=()=>{
    if(!active)return false;
    try {
      const painted=painter.render();
      if (painted && battleDiagnostics && !lobbyInteractivePainted) {
        const startButton=host.document.getElementById('bootStart');
        if(startButton && !startButton.hidden && !startButton.disabled){
          lobbyInteractivePainted=true; battleDiagnostics.note('start-button-painted');
        }
      }
      return painted;
    }catch(error){active=false;failed(error);return false;}
  };
  const measureEnabled=Boolean(profile||battleDiagnostics);
  battleDiagnostics?.attach(host,{
    top:Math.max(6,(info.safeArea?.top||0)+4),left:Math.max(8,(info.safeArea?.left||0)+6),
    bottom:info.safeArea?.bottom??host.height,
    getStats:()=>({hostLayout:host.layout.stats,hostPaint:painter.stats,
      hostCanvases:host.canvases.size,cache:{...resources.cacheStats},assetFileCacheBytes:cache.diskBytes,
      heapBytes:performance.memory?.usedJSHeapSize??null}),
  });
  const frames=installBattleFrames(host,{Yoga,sheet:presentation.styles.battle,markup:presentation.battleMarkup,paintScreen,
    battleDiagnostics,
    measurePerformance:measureEnabled ? (name,run)=>measure('battle',name,run) : undefined,
    measureTransfer:measureEnabled ? (name,pixels,run)=>{
      const activeProfile=currentProfile();
      return activeProfile ? activeProfile.measureTransfer(name,pixels,run) : run();
    } : undefined,
    loadBattle:async()=>{await prepareBattle();return verifiedRuntime('battle',require('./battle-code/battle.js'));},
    loadEngine:async()=>{await loadPackage('battle-engine');return verifiedRuntime('engine',require('./battle-engine/phaser.js'));},
  });
  const render=()=>{if(!active)return;try{
    const time=performance.now();
    frames.paint(time);
    const activeProfile=currentProfile();
    if(activeProfile&&!host.document.hidden){
      activeProfile.closeFrame(frames.phase);
      battleDiagnostics?.screenTick(time);
    }
  }catch(error){active=false;failed(error);return;}scope.requestAnimationFrame(render);};render();
  await entryReady;
  const lobby=await verifiedRuntime('lobby',require('./lobby-code/lobby.js'))(scope).startLobbyRuntime({prepareStartButton:painter.prepareBorderImage});
  battleDiagnostics?.lobbyEntered();
  // The 10 MB combat-only font must not gate the first lobby frame. Warm it
  // after the lobby is usable; entering combat joins the same pending load.
  scope.setTimeout(()=>lobbyFonts.then(()=>loadFonts([presentation.styles.battle])).catch(error=>console.warn('[wechat-font-prefetch]',error)),1500);
  root.__SHNH_NATIVE_FULL__={cacheStats:resources.cacheStats,performanceStats:scope.__THUNDER_RUNTIME_GLOBALS__.performanceStats,dispose(){active=false;battleDiagnostics?.destroy();frames.destroy();lobby.dispose();input.destroy();media.destroy();lifetime.dispose();painter.destroy();host.animations.destroy();host.layout.destroy();art.destroy();network.dispose();resources.dispose();host.dispose();}};
}
start().catch(failed);
