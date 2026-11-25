import { setPopupSurfaceFont } from '../../../../../../../pixigame/src/ui/three-surface.js';
import { createWechatThreeRuntime } from './runtime.js';
import { createWechatDebugLog } from './debug-log.js';
import { createWechatServices } from './services.js';
import { createWechatPortraits } from './portraits.js';
import { trimUnusedNativeCubismCore } from '../../../../../../../pixigame/src/ui/cubism-portrait-player.js';
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
  let active=null;
  const loadCubism=()=>config.loadCubism().then(createCore=>createCore({console,atob,TextDecoder}));
  async function boot(){
    active?.close();
    const debugLog=createWechatDebugLog(api,config.buildId);
    const services=createWechatServices(api,config);
    const {baseURL,resources}=services;
    const runtime=createWechatThreeRuntime(api,{resources,baseURL,debugLog});
    const {platform,device}=runtime;
    const startTime=debugLog?platform.now():0;
    const portraits=createWechatPortraits(api,platform,services,device,baseURL,loadCubism);
    let game,trimOnLobbyStart=false;
    function memoryWarning(event){
      if(active!==entry)return;
      const memory=platform.renderer.info.memory,texturesBefore=memory.textures;
      if(game)game.pixiLobby.trimMemory();else trimOnLobbyStart=true;
      portraits.releaseHidden();
      trimUnusedNativeCubismCore();
      services.clearBattleData();platform.loadArtwork.clearDecoded();
      const detail=JSON.stringify({level:event?.level,state:game?.game.state,page:device.lobbyLocation,
        pilot:portraits.pilotId,texturesBefore,textures:memory.textures});
      recordDiagnostic('微信内存告警',detail);console.warn('[Three 内存告警]',detail);
    }
    const entry={close(){
      api.offMemoryWarning?.(memoryWarning);
      try{runtime.close();}finally{portraits.destroy();services.close();setPopupSurfaceFont(null);}
    }};
    active=entry;api.onMemoryWarning?.(memoryWarning);
    const report=error=>{
      if(active!==entry)return;
      recordDiagnostic('微信小游戏启动',error?.message||String(error));
      console.error('[Three 小游戏]',error);
    };
    const startupOptions={bounds:()=>platform.viewport.screen,retry:()=>void boot(),
      copyReport:()=>new Promise((resolve,reject)=>api.setClipboardData({data:diagnosticReport(),success:resolve,fail:reject}))};
    const startup=runtime.showStartup(startupOptions);
    let firstSortieRetry;
    function showFirstSortieRetry(message){
      if(active!==entry)return;
      firstSortieRetry??=runtime.showStartup(startupOptions);
      firstSortieRetry.fail({message:message||'首战尚未完成，请重试'});
    }
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
      game=await runtime.startLobby({
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
        restart:()=>void boot(),showFirstSortieRetry,
        playAd:config.playRewardedAd??playFreeRewardedAd,
      });
      if(active!==entry)return;
      const lobby=game.pixiLobby;
      if(trimOnLobbyStart)lobby.trimMemory();
      function prepareLaterMenus(){
        lobby.prepareActivityPanels();lobby.prepareWorkshops();lobby.prepareCatalogs();
      }
      if(lobby.snapshot.firstSortieRequired){
        // Register return-screen preparation before the battle starts.
        lobby.prepareMenus();
        prepareLaterMenus();
        startup.stage(2,'正在准备第一关…');
        await startup.ready(()=>{
          if(active!==entry)return;
          void Promise.resolve().then(()=>game.peripheralAction('start',{index:0})).then(result=>{
            if(!result?.ok&&game.game.state==='menu')showFirstSortieRetry(result?.message);
          }).catch(error=>{report(error);showFirstSortieRetry(error.message);});
        },{automatic:true});
        return;
      }
      await font;
      if(active!==entry)return;
      startup.stage(2,'正在准备大厅界面…');
      const preparing=platform.now();
      const home=device.homeView;
      if(!home)throw Error('无法打开大厅，请重试');
      const [,ready]=await Promise.all([home.prepareEntry(),lobby.prepareMenus()]);
      if(active!==entry)return;
      debugLog?.info('大厅首屏预热',{ready,elapsedMs:Math.round(platform.now()-preparing)});
      debugLog?.info('大厅就绪',{loadMs:Math.round(platform.now()-startTime)});
      prepareLaterMenus();
      await startup.ready(()=>{home.paintNow();game.unlockAudio();lobby.startPortraits();});
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
  let track=null,musicLoad=null,retryMusicAt=0,context=null,unlocked=false,closed=false,returned=false;
  const wantsMusic=()=>unlocked&&preferences.music&&platform.visible&&!closed&&game.state==='menu';
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
    if(!wantsMusic()){track?.pause();return;}
    if(track){if(track.paused)void track.play().catch(()=>{});return;}
    if(musicLoad||platform.now()<retryMusicAt)return;
    musicLoad=Promise.resolve().then(()=>services.localFile(LOBBY_MUSIC_URL)).then(file=>{
      if(!wantsMusic())return;
      track=wechatMusicTrack(api,file,'lobby');
      track.loop=true;track.volume=1;void track.play().catch(()=>{});
    }).catch(error=>{
      if(closed)return;
      retryMusicAt=platform.now()+2000;
      console.warn('[Three 大厅音乐]',error?.message||error);
    }).finally(()=>musicLoad=null);
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
