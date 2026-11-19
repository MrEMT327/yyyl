import {LinearFilter,SRGBColorSpace,VideoTexture} from 'three';
import {area,box,clamp,pic,words} from './menu-art.js';
import {createLobbyPanel} from './lobby-panel.js';
import {recordDiagnostic} from '../../diagnostic-log.js';
import {releaseOwnedVideo} from '../../ui/release-owned-video.js';
import {pilotAffectionVideo} from '../../peripheral/pilot-affection.js';

const clock=value=>{const seconds=Math.floor(Number.isFinite(value)?value:0);return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');};
function layout(data,w,h,t){
  const {media,texture,seek}=data,a=t.layer('affection-film').art;
  a.quad(0,0,w,h,'#000');
  if(media.videoWidth&&media.videoHeight){
    const k=Math.min(w/media.videoWidth,h/media.videoHeight),iw=k*media.videoWidth,ih=k*media.videoHeight;
    a.image(texture,(w-iw)/2,(h-ih)/2,iw,ih);
  }
  const controls=t.layer('film-controls').art,gap=6,footer=50+Math.max(6,data.safeBottom),cy=h-footer+28,time=media.error?'加载失败':clock(media.currentTime)+' / '+clock(media.duration);
  controls.quad(0,h-footer,w,footer,'#0a1725',.93);
  const text=words(controls,time,w-58+2,cy,12,{align:'right',color:'#e3f7ff',weight:600}),timeWidth=text.scale.x-4;
  const trackX=8+44+gap,trackW=Math.max(10,w-8-44-gap-timeWidth-gap-trackX),start=trackX+8,end=trackX+trackW-8;
  const b=box(trackX,cy-22,trackW,44),duration=Number.isFinite(media.duration)?media.duration:0;
  controls.panel(start,cy-3.5,Math.max(1,end-start),7,{radius:3.5,fill:'#3b3b3b',stroke:'#858585',opacity:1});
  const progress=controls.quad(start,cy-2.5,1,5,'#80d9ee'),thumb=controls.panel(-7.5,-7.5,15,15,{fill:'#80d9ee',stroke:null,radius:7.5,opacity:1});
  function position(){const f=duration?clamp(media.currentTime/duration,0,1):0,n=Math.max(0,(end-start)*f);
    progress.visible=n>0;progress.scale.x=n;progress.position.x=start+n/2;thumb.position.set(start+n,cy,0);}
  position();t.frame(position);
  const onPoint=p=>{if(p)seek(clamp((p.x*trackW-8)/(trackW-16),0,1)*duration);};
  const onKey=key=>{const step={ArrowLeft:-1,ArrowDown:-1,ArrowRight:1,ArrowUp:1,PageDown:-10,PageUp:10}[key];
    if(step==null&&!['End','Home'].includes(key))return false;seek(key==='Home'?0:key==='End'?duration:media.currentTime+step);return true;};
  t.control('seek','播放进度',b,{type:'seek'},{trackPointer:true,disabled:!duration,onPoint,onKey});
  const playing=!media.paused&&!media.ended;
  if(playing){controls.quad(23,cy-8,5,16,'#e3f7ff');controls.quad(32,cy-8,5,16,'#e3f7ff');}
  else controls.polygon([[23,cy-8],[37,cy],[23,cy+8]],'#e3f7ff');
  area(t,'toggle',media.error?'重试播放':playing?'暂停':media.ended?'重播':'播放',box(8,cy-22,44,44),'toggle');
  const mute=box(w-52,cy-22,44,44);pic(controls,t,'/art/project-supplement-icons-v1/'+(media.muted?'muted.svg':'sound.svg'),box(mute.x+10,cy-12,24,24),true);
  area(t,'mute',media.muted?'取消静音':'静音',mute,'mute');
  const close=box(w-56,12,44,44);pic(controls,t,'/art/psd-popup-v1/close.png',close,true);area(t,'close','关闭视频',close,'close');
  if(playing&&!media.requestVideoFrameCallback)t.animate(()=>!media.paused&&!media.ended);
}
export function openAffectionVideo(screen,host,send){
  const media=host.ownerDocument.createElement('video');media.playsInline=true;media.autoplay=true;media.preload='metadata';media.controls=false;
  media.disablePictureInPicture=true;media.disableRemotePlayback=true;
  const texture=new VideoTexture(media);texture.colorSpace=SRGBColorSpace;texture.minFilter=LinearFilter;
  const abort=new AbortController(),opts={signal:abort.signal},panel=createLobbyPanel(screen,host,'专属视频',layout,c=>{
    if(c.type==='close'){send('close',{},host);return;}
    if(c.type==='mute'){media.muted=!media.muted;return;}
    if(c.type==='toggle'){if(media.paused||media.ended){if(media.error)media.load();media.play().catch(refresh);}else media.pause();}
  });
  let closed=false,source='',callback=null,localUrl=null,loadingLocal=false,restorePosition=null;
  async function seek(value){
    if(!Number.isFinite(value))return;
    if(loadingLocal){restorePosition=value;return;}
    if(!Number.isFinite(media.duration))return;
    const target=clamp(value,0,media.duration),ranges=media.seekable;
    if(localUrl||target===0||Array.from({length:ranges.length},(_,i)=>target>=ranges.start(i)&&target<=ranges.end(i)).some(Boolean)){
      media.currentTime=target;return;
    }
    // The local acceptance server serves complete MP4s without byte ranges.
    // Keep streaming normally and materialize this clip only if seeking needs it.
    loadingLocal=true;restorePosition=target;
    try{
      const file=await fetch(media.currentSrc||media.src,{signal:abort.signal});
      if(!file.ok)throw Error(String(file.status));
      const blob=await file.blob();
      if(closed)return;
      localUrl=URL.createObjectURL(blob.type==='video/mp4'?blob:blob.slice(0,blob.size,'video/mp4'));
      const resume=!media.paused&&!media.ended;
      media.addEventListener('loadedmetadata',()=>{
        loadingLocal=false;media.currentTime=clamp(restorePosition,0,media.duration);
        if(resume)media.play().catch(refresh);
      },{once:true,...opts});
      media.autoplay=false;media.src=localUrl;
    }catch{loadingLocal=false;if(!closed)refresh();}
  }
  function refresh(){
    if(closed)return;
    panel.update({media,texture,seek,safeBottom:screen.menuView?.safeBottom||0},JSON.stringify([source,media.videoWidth,media.videoHeight,
      media.duration,Math.floor(media.currentTime||0),media.paused,media.ended,media.muted,media.error?.code]),source);
    screen.repaintHome?.();
  }
  function nextFrame(){
    if(closed||!media.requestVideoFrameCallback)return;
    callback=media.requestVideoFrameCallback(()=>{refresh();nextFrame();});
  }
  for(const event of ['loadedmetadata','loadeddata','durationchange','timeupdate','seeked','play','pause','ended','volumechange'])media.addEventListener(event,refresh,opts);
  media.addEventListener('playing',()=>recordDiagnostic('专属视频开始播放'),{once:true,...opts});
  media.addEventListener('ended',()=>recordDiagnostic('专属视频播放结束'),opts);
  media.addEventListener('error',()=>{recordDiagnostic('专属视频加载失败',media.error?.code);refresh();},opts);
  return {host,close(){closed=true;abort.abort();if(callback!=null)media.cancelVideoFrameCallback?.(callback);releaseOwnedVideo(media);if(localUrl)URL.revokeObjectURL(localUrl);texture.dispose();panel.close();},
    update(_s,m){const file=pilotAffectionVideo(m.pilotId);if(!file||file===source)return;
      source=file;media.src=import.meta.env.BASE_URL+file;media.play().catch(refresh);nextFrame();refresh();}};
}
