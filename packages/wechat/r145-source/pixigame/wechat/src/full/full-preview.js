import { loadYoga } from 'yoga-layout/load';
import { createRuntimeScope } from './runtime-scope.js';
import { createDomEnvironment } from './dom-environment.js';
import { createDomStyles } from './dom-style.js';
import { createDomLayout } from './dom-layout.js';
import { createDomPainter } from './dom-painter.js';
import { createDomAnimations } from './dom-animation.js';
import { attachDomInput } from './dom-input.js';
import { installBattleFrames } from './battle-frame.js';

// Isolated parity harness. Neither localStorage nor the live H5 game is touched.
export async function startFullPreview() {
  const real = globalThis, document = real.document, originalFetch = real.fetch.bind(real);
  const canvas = document.querySelector('canvas'), report = document.querySelector('pre');
  const [presentation, data, {default:createLobby}, {default:createCore}] = await Promise.all([
    originalFetch('./runtime/presentation.json').then(r=>r.json()),originalFetch('./runtime/runtime-data.json').then(r=>r.json()),import('./runtime/lobby.js'),import('./runtime/cubism.js'),
  ]);
  const storage=new Map(),callbacks={},Yoga=await loadYoga();
  await Promise.all(presentation.styles.lobby.fonts.map(async font=>{try{const face=new real.FontFace(font['font-family'].replace(/^["']|["']$/g,''),font.src);await face.load();document.fonts.add(face);}catch(error){console.warn('[parity-font]',error);}}));
  const api={env:{USER_DATA_PATH:'wxfile://preview'},createCanvas:()=>document.createElement('canvas'),createImage:()=>new real.Image(),
    getStorageSync:key=>storage.get(key),setStorageSync:(key,value)=>storage.set(key,value),removeStorageSync:key=>storage.delete(key),
    onTouchStart:fn=>{callbacks.down=fn;},onTouchMove:fn=>{callbacks.move=fn;},onTouchEnd:fn=>{callbacks.up=fn;},onTouchCancel:fn=>{callbacks.cancel=fn;},
    createWebAudioContext:()=>new real.AudioContext(),
    request(options){const abort=new real.AbortController();originalFetch(options.url,{method:options.method,headers:options.header,body:options.data,signal:abort.signal}).then(async r=>options.success({statusCode:r.status,data:await r.arrayBuffer(),header:Object.fromEntries(r.headers)})).catch(error=>options.fail({errMsg:error.message}));return{abort:()=>abort.abort()};},
  };
  const lifetime=createRuntimeScope(real),resources={resolve:(value,base=real.location.origin+'/')=>new real.URL(value,base).href};
  const host=createDomEnvironment(api,{resources,baseURL:real.location.origin+'/',width:393,height:852,pixelRatio:1,screenCanvas:canvas,markup:presentation.lobbyMarkup,globalScope:lifetime.scope});
  host.requestAnimationFrame=lifetime.scope.requestAnimationFrame;host.cancelAnimationFrame=lifetime.scope.cancelAnimationFrame;
  host.layout=createDomLayout(host,createDomStyles(presentation.styles.lobby,{width:393,height:852}),Yoga,api.createCanvas().getContext('2d'));
  host.animations=createDomAnimations();host.install();
  const inputLog=[];
  host.onInputDebug=({stage='hit',target,hit,detail=''})=>{inputLog.push(`${stage}: ${target?.id} → ${hit?.tagName}#${hit?.id} ${detail}`);console.log('[input-check]',inputLog.at(-1));};
  for(const type of ['pointerdown','pointerup','click'])host.document.addEventListener(type,event=>{inputLog.push(`${type}: ${event.target?.tagName}#${event.target?.id || ''}.${event.target?.className || ''}`);if(inputLog.length>5)inputLog.shift();});
  let core;
  Object.assign(lifetime.scope,{__SHARED_JSON__:data,__THUNDER_DEFER_RUNTIME_START__:true,fetch:(url,options)=>originalFetch(new real.URL(String(url),host.document.baseURI),options),
    __THUNDER_RUNTIME_GLOBALS__:{platformKind:'wechat',nativeDocument:true,embeddedBattle:true,yogaPromise:Promise.resolve(Yoga),loadCubismCore:async()=>core ||= createCore(lifetime.scope)},
  });
  const painter=createDomPainter(host,host.layout,canvas);attachDomInput(host);
  const frames=installBattleFrames(host,{Yoga,sheet:presentation.styles.battle,markup:presentation.battleMarkup,
    loadBattle:()=>import('./runtime/battle.js').then(m=>m.default),paintScreen:()=>painter.render(),installMedia:false});
  for(const[event,name]of [['pointerdown','down'],['pointermove','move'],['pointerup','up'],['pointercancel','cancel']])canvas.addEventListener(event,e=>{if(event==='pointerdown')canvas.setPointerCapture(e.pointerId);const box=canvas.getBoundingClientRect();callbacks[name]?.({changedTouches:[{identifier:e.pointerId,clientX:(e.clientX-box.left)/box.width*393,clientY:(e.clientY-box.top)/box.height*852}]});});
  const errors=[];
  const controls=document.createElement('div');document.body.append(controls);controls.style.cssText='position:fixed;right:16px;top:48px;width:180px;display:grid;gap:8px';
  let controlsKey='';
  const syncControls=()=>{const buttons=host.layout.rows.filter(row=>row.element?.tagName==='BUTTON'&&row.element.textContent.trim()&&row.box.width>0&&row.box.height>0);const key=buttons.map(row=>row.element.id+row.element.textContent).join('|');if(key===controlsKey)return;controlsKey=key;controls.replaceChildren();for(const row of buttons){const button=document.createElement('button');button.textContent=row.element.textContent.trim().slice(0,32);button.onclick=()=>{const box=row.element.getBoundingClientRect(),touch={identifier:999,clientX:box.left+box.width/2,clientY:box.top+box.height/2};callbacks.down?.({changedTouches:[touch]});callbacks.up?.({changedTouches:[touch]});};controls.append(button);}};
  real.addEventListener('error',event=>errors.push(event.error?.stack||event.message));
  real.addEventListener('unhandledrejection',event=>errors.push(event.reason?.stack||String(event.reason)));
  const render=()=>{try{const started=real.performance.now();frames.paint(started);syncControls();report.textContent=`当前 H5 全流程 · 微信适配检查\n${host.layout.rows.length} 个界面节点 · 界面绘制 ${Math.round(real.performance.now()-started)} ms\n${inputLog.join('\n')}\n${errors.slice(-4).join('\n')}`;}catch(error){report.textContent=error.stack;return;}real.requestAnimationFrame(render);};render();
  try{const runtime=createLobby(lifetime.scope);await runtime.startLobbyRuntime({prepareStartButton:painter.prepareBorderImage});}
  catch(error){console.error('[parity-start]',error);errors.push(error?.stack||error?.error?.stack||String(error));}
}
