import {MusicDirector} from '../music-director.js';
import {readAudioPreferences,saveAudioPreferences} from '../audio-preferences.js';
import {createLobbyFeedback,createLobbySoundPlayer} from '../ui/lobby-audio.js';
import {recordDiagnostic} from '../diagnostic-log.js';

// Lobby music and UI feedback need no legacy combat sound pools or synthesizer.
export const LOBBY_MUSIC_URL=new URL('../../assets/audio/sfx/music/skin_calm.mp3',import.meta.url).href;
export function createLobbyAudio({game,storage,windowRef=window,documentRef=document,disabled=false}){
  const preferences=readAudioPreferences(storage);
  let context,closed=false,retryContextAt=0;
  const music=new MusicDirector({lobby:LOBBY_MUSIC_URL,fights:[],boss:'',volume:1,disabled});
  music.muted=!preferences.music;
  const enabled=()=>!closed&&!disabled&&preferences.effects&&!documentRef.hidden&&game.state==='menu';
  const reportAudioError=(event,error)=>recordDiagnostic(event,error?.message||error?.errMsg||String(error));
  const ensureContext=()=>{
    if(closed||disabled||!preferences.effects)return null;
    if(context)return context;
    const now=performance.now();
    if(now<retryContextAt)return null;
    try {
      const AudioContextClass=windowRef.AudioContext||windowRef.webkitAudioContext;
      return AudioContextClass ? (context=new AudioContextClass()) : null;
    } catch(error) {
      // Audio may temporarily be unavailable on the device. Retry on a later
      // gesture; never let audio creation consume the current navigation tap.
      retryContextAt=now+2000;
      reportAudioError('大厅音效未启用',error);
      return null;
    }
  };
  const sound=createLobbySoundPlayer({context:ensureContext,enabled});
  const feedback=createLobbyFeedback({play:key=>void sound.play(key),stop:()=>sound.stop(),prepare:()=>sound.prepare(),enabled});
  const updateMusic=work=>{
    try { work(); } catch(error) {
      music.key=null;
      reportAudioError('大厅音乐未启用',error);
    }
  };
  const sync=()=>updateMusic(()=>music.update(game,documentRef.hidden||closed));
  const unlock=()=>{
    if(closed||disabled)return;
    const ctx=ensureContext();
    if(ctx?.state==='suspended')ctx.resume().catch(()=>{});
    updateMusic(()=>music.unlock(game,documentRef.hidden));
  };
  const gesture=()=>{unlock();sound.prepare();};
  const visibility=()=>{if(documentRef.hidden)feedback.stop();sync();};
  for(const name of ['pointerdown','keydown'])windowRef.addEventListener(name,gesture,{passive:true});
  documentRef.addEventListener('visibilitychange',visibility);
  sync();
  return {feedback,unlock,sync,
    click(){unlock();feedback.click();},
    getSettings:()=>({...preferences}),
    setSetting(key,value){
      if(!['music','effects'].includes(key))return;
      preferences[key]=Boolean(value);saveAudioPreferences(storage,preferences);
      music.setMuted(!preferences.music,game,documentRef.hidden);
      if(!preferences.effects){feedback.stop();context?.suspend?.().catch?.(()=>{});}
      return {...preferences};
    },
    destroy(){if(closed)return;closed=true;feedback.stop();music.update({state:'replica-battle'},true);music.stopFade();
      for(const entry of music.players.values()){entry.audio.pause();entry.audio.src='';}music.players.clear();
      context?.close?.().catch?.(()=>{});
      for(const name of ['pointerdown','keydown'])windowRef.removeEventListener(name,gesture);
      documentRef.removeEventListener('visibilitychange',visibility);
    },
  };
}
