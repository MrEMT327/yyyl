export function createInlineNativeVideo(api, options) {
  return api.createVideo({autoplay:false,controls:false,showCenterPlayBtn:false,
    enablePlayGesture:false,enableProgressGesture:false,objectFit:'contain',
    autoPauseIfNavigate:true,autoPauseIfOpenNative:true,...options});
}

export function retireNativeVideo(video, width, height) {
  // Clear the native layer before waiting for stop to release its last frame.
  try {
    video.x=width+1;video.y=height+1;
    video.width=video.height=1;video.muted=true;
  } catch (error) { console.warn('[wechat-video-hide]',error); }
  const destroy=()=>{try{video.destroy();}catch(error){console.warn('[wechat-video-dispose]',error);}};
  let stopping;
  try { stopping=video.stop?.(); } catch { destroy();return; }
  if(!stopping?.then){destroy();return;}
  let released=false;
  const timer=setTimeout(finish,250);
  function finish(){if(released)return;released=true;clearTimeout(timer);destroy();}
  void Promise.resolve(stopping).then(finish,finish);
}

// Visible movies use the native player. RGBA portrait videos still need the
// decoder surface because their frames are sampled by the game renderer.
export function attachNativeVideoPlayer(host,element,onDispose) {
  const {api,scope,emit}=host;
  let player=null,source='',paused=true,ended=false,seeking=false,time=0,duration=NaN,ready=0,error=null,muted=element.hasAttribute('muted'),frameId=0,disposed=false,playPromise;
  const finite=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
  function fail(reason){
    if(disposed)return;
    const message=reason?.errMsg||reason?.message||String(reason);
    error={code:/NETWORK/.test(message)?2:3,message};paused=true;
    console.error('[wechat-video]',message);emit(element,'pause');emit(element,'error',{error});
  }
  function position(){
    if(!player||disposed)return;
    const rect=element.getBoundingClientRect(),container=element.closest('.bc-affection-player');
    const close=container?.querySelector('.bc-affection-player-close')?.getBoundingClientRect();
    const controls=container?.querySelector('.bc-affection-video-controls')?.getBoundingClientRect();
    // Native video sits above the canvas. Leave both canvas control areas
    // uncovered so closing, seeking and muting remain reachable.
    const top=close?.height>0?Math.max(rect.top,close.bottom+4):rect.top;
    const bottom=controls?.height>0?Math.min(rect.bottom,controls.top):rect.bottom;
    const bounds={x:rect.left,y:top,width:rect.width,height:Math.max(0,bottom-top)};
    for(const[key,value]of Object.entries(bounds))if(player[key]!==value)player[key]=value;
  }
  function track(){
    frameId=0;
    if(disposed||!player)return;
    if(!element.isConnected){dispose();return;}
    position();frameId=scope.requestAnimationFrame(track);
  }
  function destroyPlayer(){
    if(frameId)scope.cancelAnimationFrame(frameId);frameId=0;
    const old=player;player=null;seeking=false;
    if(old)retireNativeVideo(old,scope.innerWidth,scope.innerHeight);
  }
  function dispose(){
    if(disposed)return;
    disposed=true;paused=true;destroyPlayer();onDispose(record);
  }
  function ensurePlayer(){
    if(player)return player;
    const current=createInlineNativeVideo(api,{src:host.resources.resolve(source,host.document.baseURI),
      x:0,y:0,width:1,height:1,muted,loop:element.loop});
    player=current;
    const listen=(name,fn)=>current[name](data=>{if(!disposed&&player===current)fn(data);});
    listen('onPlay',()=>{paused=false;ended=false;emit(element,'play');emit(element,'playing');});
    listen('onPause',()=>{paused=true;emit(element,'pause');});
    listen('onEnded',()=>{paused=true;ended=true;emit(element,'ended');});
    listen('onWaiting',()=>emit(element,'waiting'));
    listen('onError',fail);
    listen('onTimeUpdate',value=>{
      time=finite(value.position);
      const next=finite(value.duration),first=ready===0;
      if(next>0&&next!==duration){duration=next;emit(element,'durationchange');}
      ready=4;
      if(first){emit(element,'loadedmetadata');emit(element,'loadeddata');emit(element,'canplay');}
      emit(element,'timeupdate');
    });
    position();frameId=scope.requestAnimationFrame(track);return current;
  }
  async function load(){
    if(disposed||!element.isConnected)return;
    const next=element.getAttribute('src')||'';
    if(!next){destroyPlayer();source='';paused=true;ready=0;time=0;duration=NaN;error=null;return;}
    if(next!==source||error){destroyPlayer();source=next;time=0;duration=NaN;ready=0;ended=false;error=null;}
    return ensurePlayer();
  }
  async function seek(value){
    const current=player;
    if(!current)return;
    seeking=true;ended=false;emit(element,'seeking');
    try{await current.seek(finite(value));if(player===current){time=finite(value);emit(element,'timeupdate');}}
    catch(reason){if(player===current)fail(reason);}
    finally{if(player===current){seeking=false;emit(element,'seeked');}}
  }
  Object.defineProperties(element,{
    src:{configurable:true,get:()=>element.getAttribute('src')||'',set:value=>element.setAttribute('src',String(value||''))},
    currentTime:{configurable:true,get:()=>time,set:value=>{void seek(value);}},
    duration:{configurable:true,get:()=>duration},paused:{configurable:true,get:()=>paused},ended:{configurable:true,get:()=>ended},
    readyState:{configurable:true,get:()=>ready},seeking:{configurable:true,get:()=>seeking},error:{configurable:true,get:()=>error},
    muted:{configurable:true,get:()=>muted,set:value=>{muted=Boolean(value);if(player)player.muted=muted;emit(element,'volumechange');}},
    loop:{configurable:true,get:()=>element.hasAttribute('loop'),set:value=>{element.toggleAttribute('loop',Boolean(value));if(player)player.loop=Boolean(value);}},
    autoplay:{configurable:true,get:()=>element.hasAttribute('autoplay'),set:value=>element.toggleAttribute('autoplay',Boolean(value))},
  });
  element.load=load;
  element.play=()=>playPromise ||= (async()=>{
    let current;
    try{
      current=await load();if(!current||player!==current||!element.isConnected)return;
      if(ended)await seek(0);
      if(player===current&&element.isConnected)await current.play();
    }
    catch(reason){if(disposed||!element.isConnected||(current&&player!==current))return;fail(reason);throw reason;}
    finally{playPromise=null;}
  })();
  element.pause=()=>{paused=true;if(player)Promise.resolve(player.pause()).catch(fail);emit(element,'pause');};
  element.canPlayType=type=>/video\/mp4/.test(type)?'probably':'';
  const record={element,kind:'player',get player(){return player;},dispose};
  element._nativeVideo=record;return record;
}
