import {LinearFilter,SRGBColorSpace,VideoTexture} from 'three';
import {area,box,pic,words} from './menu-art.js';
import {createLobbyPanel} from './lobby-panel.js';
import {recordDiagnostic} from '../../diagnostic-log.js';
import {releaseOwnedVideo} from '../../ui/release-owned-video.js';
import {pilotAffectionVideo} from '../../peripheral/pilot-affection.js';

export function affectionVideoLayout(data,w,h,t){
  const {media,texture,native,loading,error,safeTop=0}=data;
  const film=t.layer('affection-film').art;
  if(!native)film.quad(0,0,w,h,'#000');
  if(texture&&media.videoWidth&&media.videoHeight){
    const scale=Math.max(w/media.videoWidth,h/media.videoHeight);
    const width=scale*media.videoWidth,height=scale*media.videoHeight;
    film.image(texture,(w-width)/2,(h-height)/2,width,height);
    if(!media.paused&&!media.ended&&!media.requestVideoFrameCallback)t.animate(()=>!media.paused&&!media.ended);
  }

  const actions=t.layer('film-actions').art;
  const close=box(w-56,safeTop+12,44,44);
  pic(actions,t,'/art/psd-popup-v1/close.png',close,true);
  area(t,'close','关闭视频',close,'close');
  if(error){
    words(actions,'视频加载失败，点击重试',w/2,h/2,16,{align:'center',color:'#fff',weight:600});
    area(t,'retry','重试播放',box(w*.12,h/2-26,w*.76,52),'retry');
  }else if(loading){
    words(actions,'加载中…',w/2,h/2,16,{align:'center',color:'#fff',weight:600});
  }
}

export function openAffectionVideo(screen,host,send){
  const media=host.ownerDocument.createElement('video');
  media.playsInline=true;media.autoplay=true;media.controls=false;
  media.disablePictureInPicture=true;media.disableRemotePlayback=true;
  const texture=new VideoTexture(media);
  texture.colorSpace=SRGBColorSpace;texture.minFilter=LinearFilter;
  const abort=new AbortController(),options={signal:abort.signal};
  let closed=false,source='',callback=null,loading=false,error=false,revision=0;
  const panel=createLobbyPanel(screen,host,'专属视频',affectionVideoLayout,command=>{
    if(command.type==='close')send('close',{},host);
    if(command.type==='retry')play(true);
  },{fullscreen:true});

  function refresh(){
    if(closed)return;
    panel.update({media,texture,loading,error},++revision,source);
    screen.repaintHome?.();
  }
  function frame(){
    if(closed||callback!==null||media.paused||media.ended||!media.requestVideoFrameCallback)return;
    callback=media.requestVideoFrameCallback(()=>{
      callback=null;
      if(closed)return;
      screen.repaintHome?.();
      frame();
    });
  }
  function fail(reason){
    if(closed||error)return;
    loading=false;error=true;
    recordDiagnostic('专属视频加载失败',reason?.code??reason?.message);
    refresh();
  }
  function play(retry=false){
    loading=true;error=false;
    if(retry)media.load();
    refresh();
    const current=source;
    void media.play().catch(reason=>{if(source===current)fail(reason);});
  }
  media.addEventListener('loadeddata',()=>{loading=false;refresh();},options);
  media.addEventListener('playing',()=>{
    loading=false;refresh();frame();
    recordDiagnostic('专属视频开始播放');
  },options);
  media.addEventListener('ended',()=>{refresh();recordDiagnostic('专属视频播放结束');},options);
  media.addEventListener('error',()=>fail(media.error),options);
  return {host,
    update(_snapshot,modal){
      const file=pilotAffectionVideo(modal.pilotId);
      if(!file||file===source)return;
      source=file;media.src=import.meta.env.BASE_URL+file;play();
    },
    close(){
      if(closed)return;
      closed=true;abort.abort();
      if(callback!==null)media.cancelVideoFrameCallback?.(callback);
      releaseOwnedVideo(media);texture.dispose();panel.close();
    },
  };
}
