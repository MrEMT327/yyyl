import { Camera, DataTexture, LinearFilter, Mesh, NoBlending, NoColorSpace, PlaneGeometry, RawShaderMaterial, RGBAFormat, Scene, UnsignedByteType, Vector2 } from 'three';
import { PORTRAIT_VERTEX, PORTRAIT_FRAGMENT } from '../../../../../../../pixigame/src/ui/rgba-video-portrait-player.js';
import { affectionVideoLayout } from '../../../../../../../pixigame/src/three/game-screen/affection-video.js';
import { createLobbyPanel } from '../../../../../../../pixigame/src/three/game-screen/lobby-panel.js';
import { pilotAffectionVideo } from '../../../../../../../pixigame/src/peripheral/pilot-affection.js';
import { createInlineNativeVideo, retireNativeVideo } from '../full/video-player.js';
import { compactPortraitClip } from './portrait-clip.js';

const decoderWork=new WeakMap();
const compactPilots=new WeakMap();
function queueDecoder(api,run){
  const next=(decoderWork.get(api)??Promise.resolve()).then(run);
  decoderWork.set(api,next.catch(()=>{}));
  return next;
}

export function openWechatPortraitDecoder(api,platform,services,onFrame,onEnd,onError,fps=0){
  let decoder=null;
  let generation=0,frame=0,active=false,closed=false,loaded=false;
  let position=0,source='',nextPoll=-Infinity;
  const interval=fps>0?1000/fps:0;
  function schedule(){if(active&&!closed&&!frame)frame=platform.requestFrame(tick);}
  function tick(now){
    frame=0;
    if(closed||!active)return;
    if(interval&&Number.isFinite(now)){
      if(now+1<nextPoll){schedule();return;}
      // Keep the clip clock on uneven displays and never read missed frames in a burst.
      nextPoll=nextPoll>now-interval?nextPoll+interval:now+interval;
    }
    let stage='frame';
    try{
      const next=decoder.getFrameData();
      const data=next?.data;
      if(data){
        const bytes=ArrayBuffer.isView(data)?new Uint8Array(data.buffer,data.byteOffset,data.byteLength):new Uint8Array(data);
        if(next.width>0&&next.height>0&&bytes.length===next.width*next.height*4){
          position=Math.max(0,Number(next.pkPts)||0)/1000;
          stage='upload';onFrame(bytes,next.width,next.height,position);
        }
      }
    }catch(error){
      cancelPlayback();void queueDecoder(api,release);onError(error,stage);return;
    }
    schedule();
  }
  function createDecoder(){
    const player=api.createVideoDecoder();
    player.on('ended',()=>{if(decoder===player&&active&&!closed){active=false;onEnd(position);}});
    return player;
  }
  async function release(){
    const previous=decoder;decoder=null;loaded=false;
    try{await previous?.remove();}catch{/* A broken decoder is not reused. */}
  }
  async function stop(){
    if(loaded){await decoder.stop();loaded=false;}
  }
  async function play(path=source,time=position){
    const id=++generation;active=false;
    const stale=()=>closed||id!==generation;
    let stage='file';
    try{
      const file=await services.localFile(path);
      if(stale())return;
      await queueDecoder(api,async()=>{
        if(stale())return;
        try{
          stage='stop';
          await stop();
          if(stale())return;
          stage='start';
          decoder??=createDecoder();
          source=path;
          await decoder.start({source:file,mode:0,abortAudio:true});
          loaded=true;
          if(stale())return;
          if(time>0){stage='seek';await decoder.seek(time*1000);}
          if(stale())return;
          position=time;nextPoll=-Infinity;active=true;schedule();
        }catch(error){await release();throw error;}
      });
    }catch(error){if(!stale())onError(error,stage);}
  }
  function cancelPlayback(){
    active=false;generation++;
    if(frame)platform.cancelFrame(frame);frame=0;
  }
  function pause(){
    if(closed)return;
    cancelPlayback();
    const id=generation;
    // Stop native decoding while the portrait is hidden, even without a next play.
    void queueDecoder(api,async()=>{
      if(closed||id!==generation)return;
      try{await stop();}
      catch(error){await release();if(!closed&&id===generation)onError(error,'stop');}
    });
  }
  return {play,pause,get position(){return position;},get active(){return active;},
    close(){if(closed)return;cancelPlayback();closed=true;void queueDecoder(api,release);}};
}

function packedPortraitModel(renderer,manifest){
  const scene=new Scene(),camera=new Camera(),geometry=new PlaneGeometry(2,2);
  const uniforms={frame:{value:null},fit:{value:new Vector2(1,1)},packedSize:{value:new Vector2()},
    repairSourceSize:{value:new Vector2(manifest.packedWidth,manifest.height)},
    repairShirtHoles:{value:manifest.interiorHoleRepair==='blouse-v1'?1:0}};
  const material=new RawShaderMaterial({vertexShader:PORTRAIT_VERTEX,fragmentShader:PORTRAIT_FRAGMENT,uniforms,
    depthTest:false,depthWrite:false,toneMapped:false,blending:NoBlending});
  const mesh=new Mesh(geometry,material);mesh.frustumCulled=false;scene.add(mesh);
  let texture;
  return {
    setFrame(bytes,width,height){
      if(!texture||texture.image.width!==width||texture.image.height!==height){
        texture?.dispose();texture=new DataTexture(bytes,width,height,RGBAFormat,UnsignedByteType);
        texture.flipY=false;texture.colorSpace=NoColorSpace;texture.minFilter=texture.magFilter=LinearFilter;
        // The GPU owns this frame after upload. Release the WeChat bridge buffer.
        texture.onUpdate=uploaded=>{uploaded.image.data=null;};
        uniforms.frame.value=texture;uniforms.packedSize.value.set(width,height);
      }else texture.image.data=bytes;
      texture.needsUpdate=true;
    },
    draw(w,h){
      if(!texture)return;
      const fit=Math.min(w/manifest.width,h/manifest.height);
      uniforms.fit.value.set(manifest.width*fit/w,manifest.height*fit/h);
      renderer.render(scene,camera);
    },
    dispose(){texture?.dispose();geometry.dispose();material.dispose();},
  };
}

export function createWechatVideoPortrait(api,services,device,host,id){
  const path=id==='pilot-02'?'art/engineer-ee76/runtime.json?v=inner-hem-v5':'art/violet-astra-v31/runtime.json';
  const asset=new URL(path,host.baseURL),abort=host.makeAbort();
  let manifest,model,output,decoder,loading,closed=false,visible=true,motion='idle',pausedAt=0,returnToIdle=false;
  let compact=compactPilots.get(api)?.has(id)??false;
  const platform={requestFrame:host.requestFrame,cancelFrame:host.cancelFrame};
  function fit(){if(output){const {width,height}=host.bounds();output.resize(...host.renderSize(width,height));}}
  const unresize=host.watchBounds(fit),unwatch=host.watchVisibility(update);
  function clip(){return manifest?.clips[motion];}
  function fail(error,stage){
    if(closed)return;
    if(!compact&&stage!=='file'&&/insertNativeArrayBuffer failed/i.test(error?.errMsg||error?.message||String(error))){
      compact=true;
      if(!compactPilots.has(api))compactPilots.set(api,new Set());
      compactPilots.get(api).add(id);
      if(stage==='frame'||stage==='upload')pausedAt=decoder.position;
      console.info('[Three 立绘降载]',id,motion,stage);
      if(visible&&!host.hidden())update();
      return;
    }
    decoder?.close();decoder=null;output?.destroy();output=null;model=null;
    console.warn('[Three 立绘]',id,motion,stage,error);
  }
  function update(){
    if(!decoder||closed)return;
    const spec=clip();
    if(visible&&!host.hidden())void decoder.play(new URL(compact?compactPortraitClip(spec.file):spec.file,asset).href,pausedAt);
    else{pausedAt=decoder.position;decoder.pause();}
  }
  async function initialize(){
    const response=await services.fetchResource(asset.href,{signal:abort.signal});
    if(!response.ok)throw Error('动态立绘读取失败 '+response.status);
    manifest=await response.json();
    if(closed)return;
    model=packedPortraitModel(device.three,manifest);output=host.render(model);fit();
    decoder=openWechatPortraitDecoder(api,platform,services,(bytes,w,h)=>{
      const original=w===manifest.packedWidth&&h===manifest.height;
      const scale=compact?4:2;
      if(!(original&&!compact)&&(w*scale!==manifest.packedWidth||h*scale!==manifest.height))throw new Error('视频尺寸不符');
      model.setFrame(bytes,w,h);output.draw();
    },()=>{
      const spec=clip();
      if(spec.loop)pausedAt=(spec.startFrame??0)/manifest.fps;
      else if(returnToIdle){motion='idle';pausedAt=(spec.returnToIdleFrame??clip().startFrame??0)/manifest.fps;}
      else return;
      update();
    },fail,manifest.fps);
    pausedAt=(clip().startFrame??0)/manifest.fps;update();
  }
  return {
    attach(){return loading??=initialize();},
    setVisible(next){if(visible!==Boolean(next)){visible=Boolean(next);update();}},
    async playMotion(name,options){
      try{await loading;}catch{return false;}
      if(closed||!decoder||!manifest?.clips[name])return false;
      motion=name;returnToIdle=options?.returnToIdle===true;pausedAt=(clip().startFrame??0)/manifest.fps;update();return true;
    },
    get playing(){return Boolean(decoder?.active);},get motionName(){return motion;},
    destroy(){closed=true;abort.abort();unresize();unwatch();decoder?.close();output?.destroy();},
  };
}

export function openWechatAffectionVideo(api,platform,services,screen,host,send){
  let source='',player=null,closed=false,loading=false,error=false,revision=0;
  const fullscreenHost={...host,bounds:host.frameBounds};
  const panel=createLobbyPanel(screen,fullscreenHost,'专属视频',affectionVideoLayout,command=>{
    if(command.type==='close')send('close',{},host);
    if(command.type==='retry')void play();
  },{fullscreen:true});

  function bounds(){
    const {x,y,width,height}=platform.viewport.screen;
    return {x,y,width,height};
  }
  const unwatch=platform.onViewport(()=>{
    if(player)for(const [key,value] of Object.entries(bounds())){
      if(player[key]!==value)player[key]=value;
    }
    refresh();
  });

  function refresh(){
    if(closed||!source)return;
    panel.update({native:Boolean(player),loading,error,safeTop:platform.viewport.safeTop},++revision,source);
    screen.repaintHome?.();
  }
  function release(){
    const previous=player;
    player=null;
    if(previous){
      const {width,height}=platform.viewport.screen;
      retireNativeVideo(previous,width,height);
    }
  }
  function fail(reason){
    if(closed)return;
    release();
    error=true;loading=false;
    console.warn('[Three 专属视频]',reason?.errMsg||reason?.message||String(reason));
    refresh();
  }

  async function play(){
    if(closed||!source||player)return;
    loading=true;error=false;refresh();
    let current;
    try {
      if(typeof api.createVideo!=='function')throw Error('当前微信环境不支持专属视频播放');
      current=createInlineNativeVideo(api,{src:services.resolve(source),...bounds(),
        objectFit:'cover',backgroundColor:'#000000',underGameView:true});
      player=current;
      const listen=(name,callback)=>current[name](event=>{if(player===current)callback(event);});
      function ready(){
        if(loading){loading=false;refresh();}
      }
      listen('onPlay',ready);
      listen('onTimeUpdate',ready);
      listen('onWaiting',()=>{if(!loading){loading=true;refresh();}});
      listen('onEnded',ready);
      listen('onError',fail);
      refresh();
      await current.play();
    } catch(reason) {
      if(!current||player===current)fail(reason);
    }
  }
  return {
    host,
    update(_snapshot,modal){
      const file=pilotAffectionVideo(modal.pilotId);
      if(!file||file===source)return;
      release();source=file;void play();
    },
    close(){if(closed)return;closed=true;unwatch();release();panel.close();},
  };
}
