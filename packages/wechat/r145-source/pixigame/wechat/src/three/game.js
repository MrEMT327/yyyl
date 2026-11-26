import { setPopupSurfaceFont } from '../../../../../../../pixigame/src/ui/three-surface.js';
import { createWechatThreeRuntime } from './runtime.js';
import { createWechatDebugLog, rememberMemoryWarning, reportPreviousMemoryWarning } from './debug-log.js';
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
import { readJsHeapMemory } from '../../../../../../../pixigame/src/replica/memory-checkpoints.js';
import { playFreeRewardedAd } from '../../../../../../../pixigame/src/platform/local-rewarded-ad-runtime.js';

export function openWechatGame(api,config){
  let active=null;
  reportPreviousMemoryWarning(api);
  const loadCubism=()=>config.loadCubism().then(createCore=>createCore({console,atob,TextDecoder}));
  async function boot(){
    active?.close();
    const debugLog=createWechatDebugLog(api,config.buildId);
    const services=createWechatServices(api,config);
    const {baseURL,resources,files}=services;
    const runtime=createWechatThreeRuntime(api,{resources,baseURL,debugLog,files});
    const {platform,device}=runtime;
    const startTime=debugLog?platform.now():0;
    const portraits=createWechatPortraits(api,platform,services,device,baseURL,loadCubism);
    let game,trimOnLobbyStart=false;
    const readMemory=()=>({...readJsHeapMemory(),resources:platform.readMemoryResources()});
    function memoryWarning(event){
      if(active!==entry)return;
      const memoryBefore=readMemory();
      const warning={buildId:config.buildId,at:Date.now(),level:event?.level??null,state:game?.game.state,
        page:device.lobbyLocation,modal:game?.pixiLobby.state.modal,pilot:portraits.pilotId,
        texturesBefore:memoryBefore.resources.textures,geometriesBefore:memoryBefore.resources.geometries,memoryBefore};
      rememberMemoryWarning(api,warning);
      if(game)game.pixiLobby.trimMemory();else trimOnLobbyStart=true;
      portraits.trimMemory();
      if(game?.game.state==='menu'&&!device.cover)services.releaseBattleCache();
      else services.clearBattleData();
      platform.loadArtwork.clearDecoded();
      files.clearMemory();
      const memoryAfter=readMemory();
      const detail=JSON.stringify({...warning,textures:memoryAfter.resources.textures,
        geometries:memoryAfter.resources.geometries,memoryAfter});
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
    const openStartup=()=>runtime.showStartup(startupOptions);
    const startup=openStartup();
    const firstSortieStartup=()=>device.cover?.firstSortieLoading?device.cover:openStartup();
    function showFirstSortieRetry(message){
      if(active!==entry)return;
      firstSortieStartup().fail({message:message||'首战尚未完成，请重试'});
    }
    startup.stage(1,'正在读取游戏资源…');
    try{
      const font=api.loadFont&&services.localFile('art/psd-combat-v1/FZY4JW.ttf').then(file=>{
        if(active===entry)setPopupSurfaceFont(api.loadFont(file));
      }).catch(error=>console.warn('[Three 游戏字体]',error));
      const battleServices={...services,
        createBattleAudio:(manifest,battleURL)=>createWechatBattleAudio(api,platform,services,manifest,battleURL),
        showSortieLoading:options=>showWechatSortie(platform,services,options,firstSortieStartup),
        mountDeveloperSkills:(screen,region,sim,audio,ui)=>mountThreeDeveloperSkills(screen,null,sim,audio,ui,{
          region,createRaster:()=>api.createCanvas(),watch:platform.onViewport,
        }),
      };
      game=await runtime.startLobby({
        portraits,
        openVideo:(screen,region,command)=>openWechatAffectionVideo(api,platform,services,screen,region,command),
        openAircraft:(screen,bounds,panel,refresh,request,available,options)=>{
          const aircraft=services.createAircraftSelection();
          const port={bounds,visible:()=>platform.visible&&available(),createRaster:()=>api.createCanvas(),
            loadAircraft:aircraft.load,releaseAircraft:aircraft.release,createOrbit:(area,callbacks)=>createWechatOrbit(platform,area,callbacks)};
          return menuAircraft(screen,null,panel,refresh,request,available,{...options,port});
        },
        battleServices,
        readSharedLoadoutJSON:services.readSharedLoadoutJSON,
        createAudio:options=>openLobbySound(api,platform,services,{...options,
          idle:()=>!device.cover&&!device.menuView?.preparing&&!device.panel?.preparing&&platform.inputIdle,
        }),
        restart:()=>void boot(),showFirstSortieRetry,
        playAd:config.playRewardedAd??playFreeRewardedAd,
      });
      if(active!==entry)return;
      const lobby=game.pixiLobby;
      if(trimOnLobbyStart)lobby.trimMemory();
      function prepareEquipmentPages(){
        lobby.prepareWorkshops();lobby.prepareCatalogs();
      }
      if(lobby.snapshot.firstSortieRequired){
        // Register return-screen preparation before the battle starts.
        lobby.prepareMenus();
        lobby.prepareActivityPanels();prepareEquipmentPages();
        startup.stage(2,'正在准备第一关…');
        startup.startFirstSortie(()=>{
          if(active!==entry)return;
          void Promise.resolve().then(()=>game.peripheralAction('start',{index:0})).then(result=>{
            if(!result?.ok&&game.game.state==='menu')showFirstSortieRetry(result?.message);
          }).catch(error=>{report(error);showFirstSortieRetry(error.message);});
        });
        return;
      }
      await font;
      if(active!==entry)return;
      startup.stage(2,'正在准备大厅界面…');
      const preparing=platform.now();
      const home=device.homeView;
      if(!home)throw Error('无法打开大厅，请重试');
      // Warm likely destinations behind the startup cover while the home view prepares.
      void Promise.resolve(lobby.prepareMenus()).then(ready=>{
        if(active===entry)debugLog?.info('大厅功能页预热',{ready,elapsedMs:Math.round(platform.now()-preparing)});
      }).catch(error=>{
        if(active===entry)console.warn('[Three 大厅功能页预热]',error?.message||error);
      });
      lobby.prepareActivityPanels();
      await home.prepareEntry();
      if(active!==entry)return;
      debugLog?.info('大厅就绪',{loadMs:Math.round(platform.now()-startTime),memory:readMemory()});
      prepareEquipmentPages();
      await startup.ready(()=>{home.paintNow();game.unlockAudio();lobby.startPortraits();});
    }catch(error){report(error);if(active===entry)startup.fail(error);}
  }
  void boot().catch(error=>{
    console.error('[Three 小游戏]',error);
    api.showModal?.({title:'少女航线',content:String(error.message||error),showCancel:false});
  });
  return {close(){const previous=active;active=null;previous?.close();}};
}

export function openLobbySound(api,platform,services,{game,storage,idle=()=>platform.inputIdle!==false}){
  const preferences=readAudioPreferences(storage);
  let track=null,musicLoad=null,retryMusicAt=0,context=null,unlocked=false,closed=false,returned=false;
  const wantsMusic=()=>unlocked&&preferences.music&&platform.visible&&!closed&&game.state==='menu';
  const enabled=()=>!closed&&preferences.effects&&platform.visible&&game.state==='menu';
  const preload=services.battleMusic?.preloadInLobby({idle,
    loaded:(track,bytes)=>platform.debugLog?.info('战斗音乐已缓存',{track,bytes}),
    failed:(track,error)=>platform.debugLog?.info('战斗音乐缓存失败',{track,status:error?.statusCode,reason:error?.message}),
  });
  function ensureContext(){
    if(!enabled())return null;
    try{return context??=wrapNativeAudioContext(api.createWebAudioContext());}
    catch(error){recordDiagnostic('大厅音效',error?.message||String(error));return null;}
  }
  const sounds=createLobbySoundPlayer({context:ensureContext,enabled,fetchAudio:services.fetchResource,now:platform.now});
  const feedback=createLobbyFeedback({play:key=>void sounds.play(key),stop:sounds.stop,prepare:sounds.prepare,enabled});
  function sync(){
    if(game.state!=='menu'){
      preload?.setActive(false);
      returned=true;const old=track;track=null;old?.destroy();
      if(context){sounds.clear();const previous=context;context=null;void previous.close().catch(()=>{});}
      return;
    }
    if(returned){returned=false;Object.assign(preferences,readAudioPreferences(storage));}
    const active=wantsMusic();preload?.setActive(active);
    if(!active){track?.pause();return;}
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
    destroy(){if(closed)return;closed=true;preload?.setActive(false);stop();feedback.stop();track?.destroy();context?.close().catch(()=>{});},
  };
}
