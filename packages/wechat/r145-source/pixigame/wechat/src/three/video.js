import { Camera, DataTexture, LinearFilter, Mesh, NoBlending, NoColorSpace, PlaneGeometry, RawShaderMaterial, RGBAFormat, Scene, SRGBColorSpace, UnsignedByteType, Vector2 } from 'three';
import { PORTRAIT_VERTEX, PORTRAIT_FRAGMENT } from '../../../../../../../pixigame/src/ui/rgba-video-portrait-player.js';
import { affectionVideoLayout } from '../../../../../../../pixigame/src/three/game-screen/affection-video.js';
import { createLobbyPanel } from '../../../../../../../pixigame/src/three/game-screen/lobby-panel.js';
import { pilotAffectionVideo } from '../../../../../../../pixigame/src/peripheral/pilot-affection.js';

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
  let source='',decoder=null,audio=null,closed=false,revision=0,videoTexture=null,duration=0;
  const media={videoWidth:0,videoHeight:0,currentTime:0,paused:true,ended:false,muted:false,error:null,get duration(){return duration;}};
  const panel=createLobbyPanel(screen,host,'专属视频',affectionVideoLayout,command=>{
    if(command.type==='close'){send('close',{},host);return;}
    if(command.type==='mute'){media.muted=!media.muted;if(audio)audio.volume=media.muted?0:1;draw(true);return;}
    if(command.type==='toggle'){
      if(media.paused||media.ended)play(media.ended?0:media.currentTime);
      else {media.paused=true;decoder?.pause();audio?.pause();draw(true);}
    }
  });
  function draw(rebuild=false){
    if(closed)return;
    if(rebuild)panel.update({media,texture:videoTexture,seek,safeBottom:platform.viewport.safeBottom},++revision,source);
    screen.repaintHome?.();
  }
  function play(offset){
    media.paused=false;media.error=null;media.ended=false;
    void decoder.play(source,offset);
    if(audio){audio.seek(offset);audio.play();}
    draw(true);
  }
  function seek(offset){if(Number.isFinite(offset)&&decoder)play(offset);}
  function release(){decoder?.close();decoder=null;audio?.destroy();audio=null;videoTexture?.dispose();videoTexture=null;}
  return {
    host,
    update(_snapshot,modal){
      const file=pilotAffectionVideo(modal.pilotId);
      if(!file)return;
      const path=new URL(file,services.baseURL).href;
      if(path===source)return;
      release();source=path;duration=0;
      media.videoWidth=media.videoHeight=media.currentTime=0;
      decoder=openDecoder(api,platform,services,(bytes,w,h,position)=>{
        const resize=!videoTexture||media.videoWidth!==w||media.videoHeight!==h;
        const newSecond=Math.floor(media.currentTime)!==Math.floor(position);
        if(resize){
          videoTexture?.dispose();videoTexture=new DataTexture(bytes,w,h,RGBAFormat,UnsignedByteType);
          videoTexture.flipY=true;videoTexture.colorSpace=SRGBColorSpace;videoTexture.minFilter=videoTexture.magFilter=LinearFilter;
          media.videoWidth=w;media.videoHeight=h;
        }else videoTexture.image.data=bytes;
        videoTexture.needsUpdate=true;media.currentTime=position;draw(newSecond||resize);
      },position=>{duration=Math.max(duration,position);media.ended=media.paused=true;audio?.pause();draw(true);},
      error=>{media.error=error;media.paused=true;audio?.pause();draw(true);});
      audio=api.createInnerAudioContext();
      audio.src=services.resolve(source);
      audio.volume=media.muted?0:1;
      audio.onCanplay(()=>{if(audio?.duration>0){duration=audio.duration;draw(true);}});
      play(0);
    },
    close(){closed=true;release();panel.close();},
  };
}

