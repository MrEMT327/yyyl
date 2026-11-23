import { Camera, DataTexture, LinearFilter, Mesh, NoBlending, NoColorSpace, PlaneGeometry, RawShaderMaterial, RGBAFormat, Scene, UnsignedByteType, Vector2 } from 'three';
import { PORTRAIT_VERTEX, PORTRAIT_FRAGMENT } from '../../../../../../../pixigame/src/ui/rgba-video-portrait-player.js';
import { affectionVideoLayout } from '../../../../../../../pixigame/src/three/game-screen/affection-video.js';
import { createLobbyPanel } from '../../../../../../../pixigame/src/three/game-screen/lobby-panel.js';
import { pilotAffectionVideo } from '../../../../../../../pixigame/src/peripheral/pilot-affection.js';
import { createInlineNativeVideo, retireNativeVideo } from '../full/video-player.js';

function openDecoder(api,platform,services,onFrame,onEnd,onError){
  const decoder=api.createVideoDecoder();
  let generation=0,frame=0,active=false,closed=false,loaded=false;
  let position=0,source='';
  function schedule(){if(active&&!closed&&!frame)frame=platform.requestFrame(tick);}
  function tick(){
    frame=0;
    if(closed||!active)return;
    const next=decoder.getFrameData();
    if(next?.data&&next.width>0&&next.height>0){
      const bytes=new Uint8Array(next.data);
      if(bytes.length===next.width*next.height*4){
        position=Math.max(0,Number(next.pkPts)||0)/1000;
        onFrame(bytes,next.width,next.height,position);
      }
    }
    schedule();
  }
  decoder.on('ended',()=>{if(active&&!closed){active=false;onEnd(position);}});
  async function play(path=source,time=position){
    const id=++generation;active=false;
    try{
      if(loaded){loaded=false;await decoder.stop();}
      const file=await services.localFile(path);
      if(closed||id!==generation)return;
      source=path;await decoder.start({source:file,mode:0,abortAudio:true});
      if(closed||id!==generation)return;
      loaded=true;
      if(time>0)await decoder.seek(time*1000);
      if(closed||id!==generation)return;
      position=time;active=true;schedule();
    }catch(error){if(!closed&&id===generation)onError(error);}
  }
  function pause(){
    active=false;generation++;
    if(frame)platform.cancelFrame(frame);frame=0;
  }
  return {play,pause,get position(){return position;},get active(){return active;},
    close(){if(closed)return;pause();closed=true;Promise.resolve(decoder.remove()).catch(()=>{});}};
}

function packedPortraitModel(renderer,manifest){
  const scene=new Scene(),camera=new Camera(),geometry=new PlaneGeometry(2,2);
  const uniforms={frame:{value:null},fit:{value:new Vector2(1,1)},packedSize:{value:new Vector2()},
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
  const platform={requestFrame:host.requestFrame,cancelFrame:host.cancelFrame};
  function fit(){if(output){const {width,height}=host.bounds();output.resize(...host.renderSize(width,height));}}
  const unresize=host.watchBounds(fit),unwatch=host.watchVisibility(update);
  function clip(){return manifest?.clips[motion];}
  function update(){
    if(!decoder||closed)return;
    const spec=clip();
    if(visible&&!host.hidden())void decoder.play(new URL(spec.file,asset).href,pausedAt);
    else{pausedAt=decoder.position;decoder.pause();}
  }
  async function initialize(){
    const response=await services.fetchResource(asset.href,{signal:abort.signal});
    if(!response.ok)throw Error('动态立绘读取失败 '+response.status);
    manifest=await response.json();
    if(closed)return;
    model=packedPortraitModel(device.three,manifest);output=host.render(model);fit();
    decoder=openDecoder(api,platform,services,(bytes,w,h)=>{
      if(w!==manifest.packedWidth||h!==manifest.height){decoder.pause();console.warn('[Three 立绘] 视频尺寸不符');return;}
      model.setFrame(bytes,w,h);output.draw();
    },()=>{
      const spec=clip();
      if(spec.loop)pausedAt=(spec.startFrame??0)/manifest.fps;
      else if(returnToIdle){motion='idle';pausedAt=(spec.returnToIdleFrame??clip().startFrame??0)/manifest.fps;}
      else return;
      update();
    },error=>console.warn('[Three 立绘]',error));
    pausedAt=(clip().startFrame??0)/manifest.fps;update();
  }
  return {
    attach(){return loading??=initialize();},
    setVisible(next){if(visible!==Boolean(next)){visible=Boolean(next);update();}},
    async playMotion(name,options){
      try{await loading;}catch{return false;}
      if(closed||!manifest?.clips[name])return false;
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
