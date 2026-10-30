import {createPerformanceMonitor} from '../performance-monitor.js';
import {trackWebGLRenderer} from '../renderer-metrics.js';

export const BATTLE_PERFORMANCE_CHANNEL='shnh-battle-performance-v1';
const finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const statistics=s=>s&&Number.isInteger(s.count)&&s.count>=0&&s.count<=180&&['mean','p95','max'].every(k=>finite(s[k]));
function validMetrics(m){
  const frame=m?.frames?.battle,r=m?.rendering;
  return Boolean(frame&&statistics(frame)&&typeof frame.active==='boolean'&&Array.isArray(frame.samples)&&frame.samples.length<=60&&frame.samples.every(finite)
    &&r&&typeof r.available==='boolean'&&finite(r.calls)&&finite(r.triangles)&&finite(r.frame)
    &&['update','render','frame'].every(k=>statistics(m.costs?.[k]))&&Array.isArray(m.contexts)&&m.contexts.length<=16
    &&m.contexts.every(c=>['Phaser','场景3D','界面3D'].includes(c.name)&&typeof c.available==='boolean'));
}

// A separate diagnostic protocol cannot start, settle or mutate a battle.
// Parent and iframe clocks have different time origins: freshness uses only
// the parent's receive time; rendering cadence is measured entirely in child.
export function createBattlePerformanceSource({documentRef=document,windowRef=window,now=()=>performance.now()}={}){
  let frame=null,session=null,epoch=0,enabled=false,receivedAt=-Infinity,metrics=null,destroyed=false;
  const send=value=>{if(!frame?.contentWindow)return;try{frame.contentWindow.postMessage({channel:BATTLE_PERFORMANCE_CHANNEL,type:'sampling',session,epoch,enabled:value},windowRef.location.origin);}catch{ /* A removed frame cannot receive. */ }};
  const sync=()=>{
    const next=documentRef.querySelector('.replica-battle-frame');
    if(next!==frame){send(false);frame=next;metrics=null;receivedAt=-Infinity;epoch++;
      session=frame?new URL(frame.src,documentRef.baseURI).searchParams.get('session'):null;
    }
    if(enabled)send(true);
  };
  const receive=event=>{
    if(!enabled||destroyed||!frame?.isConnected||event.origin!==windowRef.location.origin||event.source!==frame.contentWindow)return;
    const data=event.data;
    if(data?.channel!==BATTLE_PERFORMANCE_CHANNEL||data.type!=='sample'||data.session!==session||data.epoch!==epoch||!validMetrics(data.metrics))return;
    metrics=data.metrics;receivedAt=now();
  };
  windowRef.addEventListener('message',receive);
  return {
    setEnabled(value){if(destroyed)return;value=Boolean(value);if(value===enabled)return;enabled=value;epoch++;metrics=null;receivedAt=-Infinity;if(enabled)sync();else send(false);},
    reset(){if(destroyed)return;epoch++;metrics=null;receivedAt=-Infinity;if(enabled)sync();},
    snapshot(){if(destroyed)return {present:false,metrics:null};sync();return {present:Boolean(frame),metrics:enabled&&!documentRef.hidden&&now()-receivedAt<1200?metrics:null};},
    get present(){return Boolean(frame?.isConnected);},
    destroy(){if(destroyed)return;send(false);destroyed=true;enabled=false;metrics=null;frame=null;windowRef.removeEventListener('message',receive);},
  };
}

export function createBattlePerformanceReporter({windowRef=window,documentRef=document,session,now=()=>performance.now(),post}={}){
  const monitor=createPerformanceMonitor({now}),surfaces=new Map();
  let game=null,requested=false,epoch=0,started=false,destroyed=false,trackers=[],frameStart=0,updateEnd=0,lastPublish=-Infinity,frameNumber=0;
  const send=payload=>{if(post)post(payload);else windowRef.parent.postMessage(payload,windowRef.location.origin);};
  const publish=force=>{
    if(!requested||destroyed||!game)return;
    const time=now();if(!force&&time-lastPublish<400)return;lastPublish=time;
    const snapshot=monitor.snapshot(),empty={count:0,mean:0,p95:0,max:0};
    const frame=snapshot.frames.battle??{...empty,active:false,samples:[]};
    if(game.renderer?.gl?.isContextLost())frame.active=false;
    send({channel:BATTLE_PERFORMANCE_CHANNEL,type:'sample',session,epoch,metrics:{
      frames:{battle:frame},
      costs:Object.fromEntries(['update','render','frame'].map(k=>[k,snapshot.costs[k]??empty])),
      rendering:{available:trackers.length>0&&trackers.every(t=>t.metrics&&!t.gl.isContextLost()),frame:frameNumber,calls:snapshot.costs.calls?.mean??0,triangles:snapshot.costs.triangles?.mean??0},
      contexts:trackers.map(t=>({name:t.canvas===game.canvas?'Phaser':t.canvas.classList?.contains('cloud-combat-canvas')?'界面3D':'场景3D',available:Boolean(t.metrics&&!t.gl.isContextLost())})),
    }});
  };
  const pre=()=>{frameStart=now();updateEnd=frameStart;};
  const updated=()=>{updateEnd=now();monitor.record('update',updateEnd-frameStart);};
  const rendered=()=>{
    const time=now();monitor.frame('battle',time);monitor.record('render',time-updateEnd);monitor.record('frame',time-frameStart);
    let calls=0,triangles=0;for(const t of trackers){const s=t.metrics?.snapshot();calls+=s?.calls??0;triangles+=s?.triangles??0;}
    monitor.record('calls',calls);monitor.record('triangles',triangles);frameNumber++;publish(false);
    // Include UI submissions made between engine steps in the next completed
    // frame interval; a pre-step reset would silently lose those submissions.
    for(const t of trackers)t.metrics?.beginFrame();
  };
  const stop=()=>{
    if(!started)return;started=false;
    game?.events.off('prestep',pre);game?.events.off('poststep',updated);game?.events.off('postrender',rendered);
    for(const t of trackers)t.metrics?.destroy();trackers=[];monitor.setEnabled(false);
  };
  const start=()=>{
    if(started||!requested||!game||destroyed||documentRef.hidden)return;
    monitor.reset();monitor.setEnabled(true);frameNumber=0;lastPublish=-Infinity;
    trackers=[...surfaces].map(([canvas,gl],i)=>{
      // Diagnostics must not abort a sortie if a browser/extension prevents
      // WebGL method instrumentation. Report the unavailable scope explicitly.
      let metrics=null;try{metrics=trackWebGLRenderer(gl,monitor,`battle-${i}`,()=>!documentRef.hidden&&!gl.isContextLost());}catch{}
      return {canvas,gl,metrics};
    });
    for(const t of trackers)t.metrics?.beginFrame();
    game.events.on('prestep',pre);game.events.on('poststep',updated);game.events.on('postrender',rendered);started=true;
  };
  const receive=event=>{
    if(destroyed||event.source!==windowRef.parent||event.origin!==windowRef.location.origin)return;
    const data=event.data;if(data?.channel!==BATTLE_PERFORMANCE_CHANNEL||data.type!=='sampling'||data.session!==session||!Number.isSafeInteger(data.epoch)||typeof data.enabled!=='boolean')return;
    if(epoch!==data.epoch||requested!==data.enabled){stop();epoch=data.epoch;requested=data.enabled;monitor.reset();}
    if(requested){start();publish(true);}else stop();
  };
  const visibility=()=>{stop();if(!documentRef.hidden)start();};
  const detach=()=>{stop();game=null;surfaces.clear();};
  windowRef.addEventListener('message',receive);documentRef.addEventListener('visibilitychange',visibility);
  return {
    watch(canvas,gl){if(destroyed||!gl||surfaces.has(canvas))return;const restart=started;if(restart)stop();surfaces.set(canvas,gl);if(restart)start();},
    attach(next){if(destroyed)return;if(game){game.events.off('destroy',detach);stop();}game=next;if(game.renderer?.gl&&!surfaces.has(game.canvas))surfaces.set(game.canvas,game.renderer.gl);game.events.once('destroy',detach);start();},
    destroy(){if(destroyed)return;stop();game?.events.off('destroy',detach);destroyed=true;game=null;surfaces.clear();windowRef.removeEventListener('message',receive);documentRef.removeEventListener('visibilitychange',visibility);},
  };
}
