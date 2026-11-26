import { GameAudio } from '../../../../../../../pixigame/replica-battle/kernel/audio';
import { wrapNativeAudioContext } from '../full/web-audio.js';
import { resolveBattleMusic } from './battle-music-cache.js';

export function wechatMusicSource(path,services,baseURL){
  return resolveBattleMusic(path,services,baseURL).source;
}

export function wechatMusicTrack(api,source,channel='battle',gain=1){
  const track=api.createInnerAudioContext();
  let wanted=false,disposed=false,reported=false,failed=false,requestedAt=-Infinity;
  const asset=source.split(/[?#]/,1)[0].split('/').at(-1);
  function reportError(error){
    if(disposed)return;
    wanted=false;
    if(/runningState=background/.test(error?.errMsg||error?.message||''))return;
    if(failed)return;
    failed=true;
    console.warn('[Three 音乐播放失败]',channel,asset,error?.errCode,error?.errMsg||error?.message);
  }
  track.autoplay=false;
  track.onPlay?.(()=>{
    if(disposed)return;
    if(!wanted){track.pause();return;}
    if(!reported){reported=true;console.info('[Three 音乐]',channel,asset);}
  });
  track.onError?.(reportError);
  track.src=source;
  return {
    get paused(){return !wanted||track.paused;},
    set loop(value){if(!disposed)track.loop=Boolean(value);},
    set volume(value){if(!disposed)track.volume=Math.min(1,value*gain);},
    set currentTime(value){
      if(!disposed)try{
        if(!Number.isFinite(track.currentTime)||Math.abs(track.currentTime-value)>.02)track.seek(value);
      }catch(error){reportError(error);}
    },
    play(){
      if(disposed)return Promise.resolve();
      const now=performance.now();
      if(wanted&&now-requestedAt<400)return Promise.resolve();
      requestedAt=now;
      wanted=true;
      try{return Promise.resolve(track.play()).catch(error=>{reportError(error);throw error;});}
      catch(error){reportError(error);return Promise.reject(error);}
    },
    pause(){wanted=false;if(!disposed)track.pause();},
    destroy(){
      if(disposed)return;disposed=true;wanted=false;
      try{track.stop?.();}catch{/* Destroy even if the source was never ready. */}
      track.destroy();
    },
  };
}

export function createWechatBattleAudio(api,platform,services,manifest,battleURL){
  const logged=new Set();
  const audio=new GameAudio(manifest,{
    hidden:()=>!platform.visible,storage:services.storage,baseURL:battleURL,
    fetchResource:(path,options)=>services.fetchResource(new URL(path,battleURL).href,options),
    makeAbort:services.makeAbort,
    createContext:()=>wrapNativeAudioContext(api.createWebAudioContext(),{openingPcm:true,decodeTimeout:6000}),
    createTrack:path=>{
      const {source,gain}=resolveBattleMusic(path,services,battleURL);
      platform.debugLog?.info('战斗音乐选曲',{track:path.split('/').at(-1),file:source.split('/').at(-1)});
      return wechatMusicTrack(api,source,'battle',gain);
    },
    audioDiagnostic(state,detail){
      const message=detail?.errMsg||detail?.message||detail;
      const key=state+':'+String(message??'');
      if(logged.has(key)||logged.size>=8)return;logged.add(key);
      (state.endsWith('-failed')?console.warn:console.info)('[Three 战斗音效]',state,message??'');
    },
  });
  const ios=(api.getDeviceInfo?.()?.platform??'').toLowerCase()==='ios';
  let suspended=!platform.visible;
  const stop=platform.onViewport?.((_view,visible)=>{
    if(!visible){suspended=true;return;}
    if(!suspended)return;suspended=false;
    if(ios)audio.resetEffectsContext();
    void audio.unlock().catch(error=>console.warn('[Three 战斗音效]',error?.message||error));
  });
  const dispose=audio.dispose.bind(audio);
  audio.dispose=()=>{stop?.();dispose();};
  return audio;
}
