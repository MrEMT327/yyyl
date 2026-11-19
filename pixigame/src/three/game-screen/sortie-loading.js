import {loadFighterPackages} from '../../three/aircraft/fighter-packages.js';
import {currentAircraftId} from '../../three/aircraft/aircraft-roster.js';
import {createSortieHangarScene} from '../../ui/sortie-hangar-scene.js';
import {HANGAR_VISUAL_TIMEOUT_MS} from '../../ui/sortie-hangar-motion.js';
import {createSortieView} from './sortie-view.js';

// CSS ease uses (0.25, 0.1, 0.25, 1). Match the authored title and screen fades.
function ease(progress){
  if(progress<=0)return 0;if(progress>=1)return 1;
  let low=0,high=1;
  for(let i=0;i<12;i++){
    const t=(low+high)/2,s=1-t;
    if(3*s*t*.25+t*t*t<progress)low=t;else high=t;
  }
  const t=(low+high)/2,s=1-t;return 3*s*s*t*.1+3*s*t*t+t*t*t;
}

export function showThreeSortie({screen,stageName='作战区域',aircraftId,resourceCount=5,onDismiss}){
  const aircraft=currentAircraftId(aircraftId),canvas=screen.display.input;
  const previous=document.activeElement,root=document.createElement('div');
  root.className='sortie-loading three-sortie-loading';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','出击准备');
  root.style.cssText='position:fixed;inset:0;z-index:2147483000;margin:0;padding:0;border:0;display:block;background:transparent;touch-action:none;overscroll-behavior:contain';
  document.body.append(root);document.documentElement.classList.add('sortie-loading-active');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),events=new AbortController(),options={signal:events.signal};
  const state={reduced:reduced.matches,failed:false,retry:false,model:null,modelSeconds:0,seconds:0,
    titleOpacity:1,reveal:0,focus:null,keyboard:false,message:'',progress:0};
  let started=performance.now(),idleSince=null,frozenTime=null,modelSince=0,pendingModel=null,allowModel=!reduced.matches;
  let frame=0,titleTimer=0,disposed=false,closePromise=null,closingAt=null,finish=null,closeTimer=0,tryAgain=null,press=null,lastBattleFrame=-Infinity;
  const view=createSortieView(screen,root,aircraft,stageName,redraw);
  const observer=new ResizeObserver(()=>redraw());observer.observe(root);
  function elapsed(now){return Math.max(0,((frozenTime??idleSince??now)-started)/1000);}
  function render(now){
    state.seconds=elapsed(now);state.modelSeconds=Math.max(0,state.seconds-modelSince);
    state.titleOpacity=state.failed?1:!state.reduced?1-ease((state.seconds-1.6)/.5):Number(state.seconds<1.6);
    state.reveal=closingAt===null?0:state.reduced?1:ease((now-closingAt)/300);
    view.paint(state);
    if(closingAt!==null&&state.reveal>=1)finish?.();
  }
  function tick(now){
    frame=0;if(disposed||document.hidden)return;
    // In combat the last pass of each frame presents the cover. Continue its fade even if combat pauses.
    if(now-lastBattleFrame>20)render(now);
    if(!disposed&&(closingAt!==null||!state.reduced&&!state.failed))request();
  }
  function request(){if(!disposed&&!frame&&!document.hidden)frame=requestAnimationFrame(tick);}
  function redraw(battle=false){
    if(disposed)return;
    if(battle){lastBattleFrame=performance.now();render(lastBattleFrame);}
    else request();
  }
  function visible(){
    const now=performance.now();
    if(document.hidden){if(idleSince===null)idleSince=now;cancelAnimationFrame(frame);frame=0;}
    else{if(idleSince!==null&&frozenTime===null)started+=now-idleSince;idleSince=null;request();}
  }
  function modeChange(){state.reduced=reduced.matches;request();}
  async function prepareModel(){
    if(!allowModel)return;
    try{
      await loadFighterPackages({pilotIds:[aircraft]});if(!allowModel||disposed)return;
      const model=createSortieHangarScene(screen.three,aircraft);pendingModel=model;
      await model.warmup();
      if(!allowModel||disposed||state.failed)return;
      state.model=model;pendingModel=null;modelSince=elapsed(performance.now());
      root.dataset.hangar='model';request();
    }catch(error){if(!disposed&&allowModel)console.warn('[sortie presentation] using aircraft image',error);}
    finally{if(pendingModel){pendingModel.dispose();pendingModel=null;}}
  }
  const timeout=setTimeout(()=>{allowModel=false;},HANGAR_VISUAL_TIMEOUT_MS);
  function stopModelLoad(){allowModel=false;clearTimeout(timeout);}
  function describe(){canvas.setAttribute('aria-label',state.failed?state.message+'，'+(state.focus==='retry'?'重试':'返回'):stageName+'，'+(state.message||'出击准备'));}
  function freeze(){
    if(frozenTime===null)frozenTime=idleSince??performance.now();
    stopModelLoad();request();
  }
  function release(restoreFocus){
    if(disposed)return;disposed=true;stopModelLoad();clearTimeout(closeTimer);clearTimeout(titleTimer);cancelAnimationFrame(frame);
    events.abort();observer.disconnect();state.model?.dispose();state.model=null;
    view.close();root.remove();
    if(!document.querySelector('.sortie-loading'))document.documentElement.classList.remove('sortie-loading-active');
    if(restoreFocus&&previous?.isConnected)previous.focus({preventScroll:true});
  }
  function close({restoreFocus=true,keepMotion=false}={}){
    if(closePromise)return closePromise;
    let resolve;closePromise=new Promise(done=>{resolve=done;});
    if(!keepMotion)freeze();else stopModelLoad();
    closingAt=performance.now();
    finish=()=>{if(disposed)return;release(restoreFocus);resolve();};
    if(state.reduced)finish();
    else{closeTimer=setTimeout(finish,350);request();}
    return closePromise;
  }
  function choose(id){
    if(!state.failed||closingAt!==null)return;
    if(id==='back')void close().then(()=>onDismiss?.());
    else if(id==='retry'&&tryAgain)void close().then(tryAgain);
  }
  function keys(e){
    e.stopImmediatePropagation();e.preventDefault();
    if(e.type!=='keydown'||e.repeat||!state.failed)return;
    state.keyboard=true;
    if(e.key==='Tab'){state.focus=state.retry&&state.focus==='back'?'retry':'back';describe();request();}
    else if(e.key==='Escape')choose('back');
    else if(e.key===' '||e.key==='Enter')choose(state.focus);
  }
  for(const k of ['keydown','keyup'])window.addEventListener(k,keys,{...options,capture:true});
  for(const k of ['click','pointerdown','pointerup','pointermove'])root.addEventListener(k,e=>e.stopPropagation(),options);
  canvas.addEventListener('pointerdown',e=>{state.keyboard=false;press=view.hit(e.clientX,e.clientY);canvas.setPointerCapture(e.pointerId);request();},options);
  canvas.addEventListener('pointerup',e=>{const id=press;press=null;if(id&&id===view.hit(e.clientX,e.clientY))choose(id);},options);
  canvas.addEventListener('pointercancel',()=>{press=null;},options);
  screen.three.domElement.addEventListener('webglcontextrestored',request,options);document.addEventListener('visibilitychange',visible,options);
  reduced.addEventListener('change',modeChange,options);
  root.dataset.hangar='image';canvas.focus({preventScroll:true});describe();
  titleTimer=setTimeout(request,1605);request();void prepareModel();
  document.fonts?.load('16px PsdPopup').then(request,()=>{});
  const max=resourceCount+2;
  return {
    update(value,message){if(closingAt!==null||state.failed||!Number.isFinite(value))return;
      state.progress=Math.max(state.progress,Math.max(0,Math.min(1,value))*max);if(message){state.message=message;describe();}},
    resource(){if(closingAt===null&&!state.failed)state.progress=Math.min(resourceCount,state.progress+1);},
    stage(index){if(closingAt!==null||state.failed)return;
      state.progress=Math.max(state.progress,resourceCount+Math.max(0,index));
      state.message=['作战资源已就绪','正在准备战场…','出击中…'][index]||'正在准备出击…';describe();},
    fail({onRetry,message}={}){
      if(closingAt!==null)return;freeze();state.failed=true;tryAgain=onRetry;state.retry=!!onRetry;
      state.focus=state.retry?'retry':'back';state.message=message||(onRetry?'准备失败':'准备未完成，请返回');
      root.dataset.sortieState='failed';canvas.focus({preventScroll:true});describe();request();
    },
    close
  };
}

