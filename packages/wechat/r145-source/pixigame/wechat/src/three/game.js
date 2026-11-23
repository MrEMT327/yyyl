import { setPopupSurfaceFont } from '../../../../../../../pixigame/src/ui/three-surface.js';
import { createWechatThreeRuntime } from './runtime.js';
import { createWechatServices } from './services.js';
import { createWechatPortraits } from './portraits.js';
import { openWechatAffectionVideo } from './video.js';
import { createWechatBattleAudio, wechatMusicTrack } from './battle-audio.js';
import { showWechatSortie } from './sortie-cover.js';
import { createWechatOrbit } from './orbit.js';
import { wrapNativeAudioContext } from '../full/web-audio.js';
import { atob } from '../full/native-base64.js';
import { menuAircraft } from '../../../../../../../pixigame/src/three/game-screen/menu-aircraft.js';
import { mountThreeDeveloperSkills } from '../../../../../../../pixigame/src/three/game-screen/developer-skills.js';
import { createLobbyFeedback, createLobbySoundPlayer } from '../../../../../../../pixigame/src/ui/lobby-audio.js';
import { LOBBY_MUSIC_URL } from '../../../../../../../pixigame/src/lobby-runtime/audio.js';
import { readAudioPreferences, saveAudioPreferences } from '../../../../../../../pixigame/src/audio-preferences.js';
import { diagnosticReport, recordDiagnostic } from '../../../../../../../pixigame/src/diagnostic-log.js';
import { playFreeRewardedAd } from '../../../../../../../pixigame/src/platform/local-rewarded-ad-runtime.js';

export function openWechatGame(api,config){
  let active=null,cubism;
  const loadCubism=()=>cubism??=config.loadCubism().then(createCore=>createCore({console,atob,TextDecoder}));
  async function boot(){
    active?.close();
    const services=createWechatServices(api,config);
    const {baseURL,resources}=services;
    const runtime=createWechatThreeRuntime(api,{resources,baseURL});
    const {platform,device}=runtime;
    const portraits=createWechatPortraits(api,platform,services,device,baseURL,loadCubism);
    const entry={close(){try{runtime.close();}finally{portraits.destroy();services.close();setPopupSurfaceFont(null);}}};
    active=entry;
    const report=error=>{
      if(active!==entry)return;
      recordDiagnostic('微信小游戏启动',error?.message||String(error));
      console.error('[Three 小游戏]',error);
    };
    const startup=runtime.showStartup({bounds:()=>platform.viewport.screen,retry:()=>void boot(),
      copyReport:()=>new Promise((resolve,reject)=>api.setClipboardData({data:diagnosticReport(),success:resolve,fail:reject}))});
    startup.stage(1,'正在读取游戏资源…');
    try{
      const font=api.loadFont&&services.localFile('art/psd-combat-v1/FZY4JW.ttf').then(file=>{
        if(active===entry)setPopupSurfaceFont(api.loadFont(file));
      }).catch(error=>console.warn('[Three 游戏字体]',error));
      const battleServices={...services,
        createBattleAudio:(manifest,battleURL)=>createWechatBattleAudio(api,platform,services,manifest,battleURL),
        showSortieLoading:options=>showWechatSortie(platform,services,options),
        mountDeveloperSkills:(screen,region,sim,audio,ui)=>mountThreeDeveloperSkills(screen,null,sim,audio,ui,{
          region,createRaster:()=>api.createCanvas(),watch:platform.onViewport,
        }),
      };
      const game=await runtime.startLobby({
        portraits,
        openVideo:(screen,region,command)=>openWechatAffectionVideo(api,platform,services,screen,region,command),
        openAircraft:(screen,bounds,panel,refresh,request,available,options)=>{
          const port={bounds,visible:()=>platform.visible&&available(),createRaster:()=>api.createCanvas(),
            loadAircraft:services.loadAircraft,createOrbit:(area,callbacks)=>createWechatOrbit(platform,area,callbacks)};
          return menuAircraft(screen,null,panel,refresh,request,available,{...options,port});
        },
        battleServices,
        readSharedLoadoutJSON:services.readSharedLoadoutJSON,
        createAudio:options=>openLobbySound(api,platform,services,options),
        restart:()=>void boot(),
        playAd:config.playRewardedAd??playFreeRewardedAd,
      });
      await font;
      if(active===entry){
        startup.stage(2,'正在准备大厅…');
        await startup.ready(()=>{game.unlockAudio();game.pixiLobby.startPortraits();device.repaintHome?.();});
      }
    }catch(error){report(error);if(active===entry)startup.fail(error);}
  }
  void boot().catch(error=>{
    console.error('[Three 小游戏]',error);
    api.showModal?.({title:'少女航线',content:String(error.message||error),showCancel:false});
  });
  return {close(){const previous=active;active=null;previous?.close();}};
}

export function openLobbySound(api,platform,services,{game,storage}){
  const preferences=readAudioPreferences(storage);
  let track=null,context=null,unlocked=false,closed=false,returned=false;
  const enabled=()=>!closed&&preferences.effects&&platform.visible&&game.state==='menu';
  function ensureContext(){
    if(!enabled())return null;
    try{return context??=wrapNativeAudioContext(api.createWebAudioContext());}
    catch(error){recordDiagnostic('大厅音效',error?.message||String(error));return null;}
  }
  const sounds=createLobbySoundPlayer({context:ensureContext,enabled,fetchAudio:services.fetchResource,now:platform.now});
  const feedback=createLobbyFeedback({play:key=>void sounds.play(key),stop:sounds.stop,prepare:sounds.prepare,enabled});
  function sync(){
    if(game.state!=='menu'){
      returned=true;const old=track;track=null;old?.destroy();
      if(context){sounds.clear();const previous=context;context=null;void previous.close().catch(()=>{});}
      return;
    }
    if(returned){returned=false;Object.assign(preferences,readAudioPreferences(storage));}
    if(unlocked&&preferences.music&&platform.visible&&!closed&&game.state==='menu'){
      track??=wechatMusicTrack(api,services.resolve(LOBBY_MUSIC_URL),'lobby');
      track.loop=true;track.volume=1;if(track.paused)void track.play().catch(()=>{});
    }else track?.pause();
  }
  function unlock(){unlocked=true;ensureContext()?.resume().catch(()=>{});sync();}
  let previous=platform.visible;
  const stop=platform.onViewport((_bounds,visible)=>{if(previous!==visible){previous=visible;if(!visible)feedback.stop();sync();}});
  return {feedback,unlock,sync,click(){unlock();feedback.click();},
    getSettings:()=>({...preferences}),
    setSetting(key,value){
      if(!['music','effects'].includes(key))return;
      preferences[key]=Boolean(value);saveAudioPreferences(storage,preferences);
      if(!preferences.effects)feedback.stop();
      sync();return {...preferences};
    },
    destroy(){if(closed)return;closed=true;stop();feedback.stop();track?.destroy();context?.close().catch(()=>{});},
  };
}
