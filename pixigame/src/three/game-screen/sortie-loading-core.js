import {currentAircraftId} from '../../three/aircraft/aircraft-roster.js';
import {createSortieHangarScene} from '../../ui/sortie-hangar-scene.js';
import {HANGAR_VISUAL_TIMEOUT_MS} from '../../ui/sortie-hangar-motion.js';

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

export function showSortieOnOutput({screen,stageName='作战区域',aircraftId,resourceCount=5,onDismiss,host}){
  const aircraft=currentAircraftId(aircraftId),reduced=host.motionPreference;
  const state={reduced:reduced.matches,failed:false,retry:false,model:null,modelSeconds:0,seconds:0,
    titleOpacity:1,reveal:0,focus:null,keyboard:false,message:'',progress:0,animatePlaceholder:host.keepModelLoading};
  const motionStep=(host.motionStepMs??Infinity)/1000;
  const motionTiming=host.motionTiming?{frames:0,slowFrames:0,maxGapMs:0,maxGapAtMs:0,drawCpuBeforeMaxGapMs:0,firstPaintMs:0,firstTwoSecondsMaxGapMs:0}:null;
  let lastMotionMs=null,lastDrawCpuMs=0;
  let started=host.now(),idleSince=null,frozenTime=null,modelSince=0,modelClock=0,pendingModel=null,allowModel=!reduced.matches;
  let cancelModelStart=null;
  let frame=0,titleTimer=0,disposed=false,closePromise=null,closingAt=null,finish=null,closeTimer=0,tryAgain=null,press=null,lastBattleFrame=-Infinity;
  const view=host.view(screen,aircraft,stageName,redraw);
  if(allowModel&&host.hangarOptions?.createPreviewAircraft){
    state.model=createSortieHangarScene(screen.three,aircraft,host.hangarOptions);
    host.setModel?.();
  }
  function elapsed(now){return Math.max(0,((frozenTime??idleSince??now)-started)/1000);}
  function render(now){
    state.seconds=elapsed(now);
    if(state.model){
      const time=Math.max(0,state.seconds-modelSince),delta=Math.max(0,time-modelClock);
      // A slow frame should not advance the aircraft through several unseen angles.
      state.modelSeconds+=Math.min(delta,motionStep);modelClock=time;
    }
    if(motionTiming&&frozenTime===null&&!state.reduced){
      const at=state.seconds*1000;
      if(lastMotionMs===null)motionTiming.firstPaintMs=Math.round(at);
      else if(at>lastMotionMs){
        const ms=Math.round(at-lastMotionMs);
        motionTiming.frames++;
        if(ms>45)motionTiming.slowFrames++;
        if(ms>motionTiming.maxGapMs){
          motionTiming.maxGapMs=ms;
          motionTiming.maxGapAtMs=Math.round(lastMotionMs);
          motionTiming.drawCpuBeforeMaxGapMs=lastDrawCpuMs;
        }
        if(lastMotionMs<2000)motionTiming.firstTwoSecondsMaxGapMs=Math.max(motionTiming.firstTwoSecondsMaxGapMs,ms);
      }
      lastMotionMs=at;
    }
    state.titleOpacity=state.failed?1:!state.reduced?1-ease((state.seconds-1.6)/.5):Number(state.seconds<1.6);
    state.reveal=closingAt===null?0:state.reduced?1:ease((now-closingAt)/300);
    const drawAt=motionTiming?host.now():0;
    view.paint(state);
    if(motionTiming)lastDrawCpuMs=Math.round(host.now()-drawAt);
    if(closingAt!==null&&state.reveal>=1)finish?.();
  }
  function tick(now){
    frame=0;if(disposed||host.hidden())return;
    // In combat the last pass of each frame presents the cover. Continue its fade even if combat pauses.
    if(now-lastBattleFrame>20)render(now);
    if(!disposed&&(closingAt!==null||!state.reduced&&!state.failed))request();
  }
  function request(){if(!disposed&&!frame&&!host.hidden())frame=host.requestFrame(tick);}
  function redraw(battle=false){
    if(disposed)return;
    if(battle){lastBattleFrame=host.now();render(lastBattleFrame);}
    else request();
  }
  function visible(){
    const now=host.now();
    if(host.hidden()){if(idleSince===null)idleSince=now;host.cancelFrame(frame);frame=0;}
    else{if(idleSince!==null&&frozenTime===null)started+=now-idleSince;idleSince=null;request();}
  }
  function modeChange(){state.reduced=reduced.matches;request();}
  function afterCoverFrame(){
    return new Promise(resolve=>{
      function done(){cancelModelStart=null;resolve();}
      let handle=host.requestFrame(()=>{handle=host.requestFrame(done);});
      cancelModelStart=()=>{host.cancelFrame(handle);done();};
    });
  }
  async function prepareModel(){
    if(!allowModel||state.model)return;
    try{
      await host.loadAircraft(aircraft);if(!allowModel||disposed)return;
      if(host.deferModel){
        await afterCoverFrame();
        if(!allowModel||disposed)return;
      }
      const model=createSortieHangarScene(screen.three,aircraft,host.hangarOptions);pendingModel=model;
      if(host.deferModel){
        await afterCoverFrame();
        if(!allowModel||disposed)return;
      }
      await model.warmup();
      if(!allowModel||disposed||state.failed)return;
      state.model=model;pendingModel=null;modelSince=elapsed(host.now());
      host.setModel?.();request();
    }catch(error){if(!disposed&&allowModel)console.warn('[sortie presentation] using aircraft image',error);}
    finally{if(pendingModel){pendingModel.dispose();pendingModel=null;}}
  }
  const timeout=host.keepModelLoading?null:setTimeout(stopModelLoad,HANGAR_VISUAL_TIMEOUT_MS);
  function stopModelLoad(){
    allowModel=false;clearTimeout(timeout);cancelModelStart?.();
    pendingModel?.dispose();pendingModel=null;
  }
  function describe(){host.describe?.(state.failed?state.message+'，'+(state.focus==='retry'?'重试':'返回'):stageName+'，'+(state.message||'出击准备'));}
  function freeze(){
    if(frozenTime===null)frozenTime=idleSince??host.now();
    stopModelLoad();request();
  }
  function release(restoreFocus){
    if(disposed)return;disposed=true;stopModelLoad();clearTimeout(closeTimer);clearTimeout(titleTimer);host.cancelFrame(frame);
    unbind();state.model?.dispose();state.model=null;
    view.close();host.close(restoreFocus);
    if(motionTiming?.frames)host.motionTiming(motionTiming);
  }
  function close({restoreFocus=true,keepMotion=false}={}){
    if(closePromise)return closePromise;
    let resolve;closePromise=new Promise(done=>{resolve=done;});
    if(!keepMotion)freeze();else if(!host.keepModelLoading)stopModelLoad();
    closingAt=host.now();
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
  const unbind=host.bind({keys,visible,modeChange,redraw,start(x,y){state.keyboard=false;press=view.hit(x,y);request();},
    end(x,y){const id=press;press=null;if(id&&id===view.hit(x,y))choose(id);},cancel(){press=null;}});
  describe();titleTimer=setTimeout(request,1605);request();void prepareModel();
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
      host.failed?.();describe();request();
    },
    close
  };
}

