import { developerSkillsEnabled } from '../../../../../../../pixigame/src/developer-battle-settings.js';
import { mountSharedBattleSession } from '../../../../../../../pixigame/replica-battle/battle-session-core';
import { createBattleLifetime } from '../../../../../../../pixigame/replica-battle/battle-lifetime.js';
import { createFlightLaunch } from '../../../../../../../pixigame/replica-battle/battle-launch.js';
import { BattleControls } from '../../../../../../../pixigame/replica-battle/kernel/input';
import { CombatView } from '../../../../../../../pixigame/src/three/game-screen/combat-view.js';
import { createH5Presentation } from '../../../../../../../pixigame/src/replica/h5-project-presentation.js';
import { mountThreeCombatHud } from '../../../../../../../pixigame/src/three/game-screen/battle-hud-scene.js';
import { createThreeMovementGuide } from '../../../../../../../pixigame/src/three/game-screen/movement-guide.js';
import { createThreeBreakthrough } from '../../../../../../../pixigame/src/three/game-screen/breakthrough.js';
import { createBattleOverlays } from '../../../../../../../pixigame/src/three/game-screen/battle-overlays.js';
import { artworkTexture } from '../../../../../../../pixigame/src/three/game-screen/image-loading.js';
import { createSortieController } from '../../../../../../../pixigame/src/replica/sortie-controller.js';
import { openWechatBattleSurface } from './battle-surface.js';
import { createNativeBattleRenderBudget } from '../../../../../../../pixigame/src/replica/native-battle-render-budget.js';
import { memoryMiB, readJsHeapMemory } from '../../../../../../../pixigame/src/replica/memory-checkpoints.js';
import { battleWidth,battleHeight,fullBattleFrame } from '../../../../../../../pixigame/src/three/game-screen/battle-frame-layout.js';
import { paceSortieData, prewarmBattleArtwork } from './frame-artwork.js';

function createBattleTouch(platform,bounds,isTakingOff) {
  let hud,controls,canMove=()=>false,unlock=null,owner=null;
  const unbind=platform.bindTouches(touch=>{
    const {phase,x,y,pointerId}=touch,b=bounds();
    if(owner&&owner.id!==pointerId)return;
    if(phase==='start'){
      if(x<b.left||x>=b.right||y<b.top||y>=b.bottom)return;
      unlock?.();
      if(isTakingOff())return;
    }else if(!owner)return;
    if(hud&&(phase==='start'||owner?.kind==='hud')){
      const screen=hud.getScreen();
      const point={x:(x-b.left)*screen.width/b.width,y:(y-b.top)*screen.height/b.height,phase};
      if(hud.handlePointer(point)&&phase==='start'){owner={kind:'hud',id:pointerId};return;}
      if(owner?.kind==='hud'){
        if(phase==='end'||phase==='cancel')owner=null;
        return;
      }
    }
    if(!controls)return;
    if(phase==='start'){
      if(canMove()&&controls.begin(pointerId,x,y))owner={kind:'flight',id:pointerId};
    }else if(phase==='move'){
      if(canMove()){
        const {scale}=fullBattleFrame(b);
        controls.move(pointerId,x,y,{width:battleWidth*scale,height:battleHeight*scale});
      }else controls.clear();
    }else{controls.end(pointerId);owner=null;}
  },5);
  return {
    setUnlock(callback){unlock=callback;},
    controls(ready){canMove=ready;return controls=new BattleControls();},
    bindInput(next){hud=next;return {destroy(){if(hud===next){hud=null;if(owner?.kind==='hud')owner=null;}}};},
    close(){unbind();controls?.clear();hud=null;unlock=null;owner=null;},
  };
}

function watchVisibility(platform,change){
  let visible=platform.visible;
  return platform.onViewport((_viewport,foreground)=>{
    if(visible===foreground)return;
    visible=foreground;change();
  });
}

function createActivity(platform,{suspend,refresh,blocked,signal}){
  let closed=false,reset=!platform.visible;
  function enforce(){
    if(closed)return false;
    if(platform.visible&&!blocked())return true;
    reset=true;suspend();return false;
  }
  const stop=watchVisibility(platform,()=>{reset=true;if(!platform.visible){enforce();refresh();}});
  function destroy(){if(!closed){closed=true;stop();signal.removeEventListener('abort',destroy);}}
  signal.addEventListener('abort',destroy,{once:true});
  return {enforce,destroy,frameDelta(raw){
    if(!enforce())return 0;
    if(reset){reset=false;return 0;}
    return Number.isFinite(raw)?Math.max(0,raw):0;
  }};
}

export function mountWechatBattle({platform,device,services,id,chapterId,emit,baseURL,onResultVisible}){
  const bounds=()=>platform.viewport.screen;
  const region={bounds,enter(){},leave(){device.repaintHome?.();}};
  const battleAddress=new URL('replica-battle/index.html',baseURL);
  const battleURL=battleAddress.href;
  const reducedMotion=()=>false;
  const lifetime=createBattleLifetime(null,services.makeAbort);
  let battleAudio;
  function readResources(){
    const pcm=battleAudio?.readPcmStats();
    return {...platform.readMemoryResources(),battleAudioBuffers:pcm?.buffers??0,
      battleAudioPcmMiB:pcm?memoryMiB(pcm.bytes):0};
  }
  const readMemory=()=>({...readJsHeapMemory(),resources:readResources()});
  // This callback runs after the battle's other cleanup callbacks.
  if(platform.debugLog)lifetime.add(()=>platform.debugLog.info('战斗释放后内存',{chapter:chapterId,...readMemory()}));
  const warmTextures=prewarmBattleArtwork(platform);
  lifetime.add(warmTextures.close);
  const endSortieLoad=services.beginSortieLoad?.();
  if(endSortieLoad)lifetime.add(endSortieLoad);
  let launchActive=false;
  const firstSortie=Boolean(device.cover?.firstSortieLoading);
  let warmHome=firstSortie?device.warmFirstSortieHomeFiles:null;
  const loadingFrame=(frames=firstSortie?1:2)=>{
    if(!device.cover||!platform.visible||lifetime.disposed)return;
    return new Promise(resolve=>{
      let frame=platform.requestFrame(frames===1?done:()=>{frame=platform.requestFrame(done);});
      function done(){
        platform.cancelFrame(frame);lifetime.signal.removeEventListener('abort',done);resolve();
      }
      lifetime.signal.addEventListener('abort',done,{once:true});
    });
  };
  const paceDataWork=paceSortieData(loadingFrame,lifetime.signal);
  const touch=createBattleTouch(platform,bounds,()=>launchActive||Boolean(device.cover));
  lifetime.add(()=>touch.close());
  const visualHost={bounds,now:platform.now,reducedMotion,active:()=>!lifetime.disposed};
  const guide=createThreeMovementGuide(device.three,null,visualHost);
  lifetime.add(()=>guide.destroy());
  const burst=createThreeBreakthrough(device.three,null,visualHost);
  lifetime.add(()=>burst.clear());
  const overlays=createBattleOverlays(device.three,{...visualHost,region:null,launching:()=>launchActive,
    density:()=>platform.viewport.density});
  lifetime.add(()=>overlays.destroy());
  const draws=platform.debugLog?{terrain:0,aircraft:0,hud:0}:null;
  const resultTrace=platform.debugLog?.beginResult?.(chapterId,platform.now);
  if(resultTrace)lifetime.add(()=>resultTrace.close());
  let readResultPanel,drawBase=0,triangleBase=0;
  const skinHost={
    baseURL,battleAssetBase:battleURL,staggerPresentation:true,loadingFrame,
    draws,createRenderBudget(worldWidth){
      const {screen,density}=platform.viewport;
      return createNativeBattleRenderBudget({...screen,pixelRatio:density},worldWidth,{adaptive:true,phoneTerrainWidth:504,
        onPressureChange:limited=>platform.debugLog?.info('战斗绘制预算',{chapter:chapterId,mode:limited?'降载':'常规'}),
        onSustainedLoadChange:limited=>platform.debugLog?.info('持续低帧降载',{chapter:chapterId,mode:limited?'启用':'恢复'})});
    },
    aircraftCoverageStrength:.5,compactAircraftGlass:true,
    loadAircraft:services.loadAircraft,readFighterFile:services.readFighterFile,objectLoader:services.objectLoader,assetBytes:services.assetBytes,
    openBattleSurface:budget=>openWechatBattleSurface(device,platform,region,budget),
    textureLoader:{load(path,loaded,_progress,failed){return artworkTexture(path,loaded,failed);}},
  };
  const hudHost={bounds,watchResize:platform.onViewport,bindInput:options=>touch.bindInput(options),
    playingHudInterval:50,now:platform.now,draws,resultTrace,
    queueResultWarmup:warmTextures.push,resultRaysUrl:'/art/victory-result-v1/reveal-rays.png',
    bindResultPanel:read=>{readResultPanel=read;},
    safeInsets:()=>{
      const {safeTop:top,safeBottom:bottom,menuButton}=platform.viewport;
      return {top,bottom,menuButton};
    },
    loadImageSurface:platform.loadArtwork,
    warmPanelTexture:texture=>{if(!lifetime.disposed)warmTextures.add('combat-ui',texture,true);},
    preparePanelTextures:textures=>lifetime.disposed||warmTextures.prepare(textures)};
  let skills;
  const rendering={
    mountCombatHud:mountThreeCombatHud,
    mountDeveloperSkills:(_stage,...args)=>skills=services.mountDeveloperSkills(device,region,...args),
    createChoiceBurst:()=>burst,
    createAppearance:(content,appearance,onError,onGraphicsContext,onProgress,onFlightRoll,host,aircraftReady)=>
      createH5Presentation({content,appearance,onError,onGraphicsContext,onProgress,onFlightRoll,host,aircraftReady}),
    createView(content,sim,ready,skin){
      const view=new CombatView(content,sim,ready,skin);
      const frameSummary=platform.debugLog?.beginBattle?.(chapterId,draws,()=>{
        const {width,height,samples}=view.stage.ground.userData.binding.texture.renderTarget;
        const {outputSize:output,worldSize:world}=view.stage.glow;
        return {terrain:[width,height],output:[output.width,output.height],world:[world.width,world.height],terrainSamples:samples};
      },readMemory);
      let lastReport=-Infinity,reports=0;
      view.profileClock=draws?platform.now:undefined;
      view.reportSlowFrame=stats=>{
        if(launchActive||device.cover||!platform.visible){frameSummary?.reset();return;}
        const now=platform.now(),cpu=stats.logic+stats.terrainAndPlane+stats.entitiesAndEffects+stats.draw;
        if(sim.phase==='won'||sim.phase==='lost')frameSummary?.finish?.(sim.runId);
        if(sim.phase!=='playing'||sim.victoryDeparturePresentation){frameSummary?.reset();return;}
        const info=platform.renderer?.info;
        if(info?.render){
          stats.drawCalls=info.render.calls-drawBase;stats.triangles=info.render.triangles-triangleBase;
          stats.textures=info.memory.textures;stats.geometries=info.memory.geometries;
          stats.enemies=sim.enemies.length;stats.projectiles=sim.projectiles.length;stats.pickups=sim.pickups.length;
        }
        frameSummary?.sample(stats.interval,sim.wave,stats,sim.runId,view.frameDelivery);
        if(reports>=16||now-lastReport<3000||(stats.interval<48&&cpu<28))return;
        reports++;lastReport=now;
        const timings=Object.fromEntries(Object.entries(stats).map(([key,value])=>[key,Math.round(value)]));
        console.info('[Three 局内慢帧]',JSON.stringify({...timings,chapter:chapterId,wave:sim.wave,
          enemies:sim.enemies.length,projectiles:sim.projectiles.length,pickups:sim.pickups.length}));
      };
      view.stage.drawMovementGuide=guide.draw;
      view.stage.drawBreakthrough=burst.paint;
      view.stage.setModalPhase=overlays.phaseChange;
      view.stage.drawBackdrop=overlays.drawBackdrop;
      view.stage.drawNotice=overlays.drawNotice;
      view.stage.drawDeveloperSkills=()=>skills?.draw();
      skin.screen.session.snapshot=()=>({wave:sim.wave,phase:sim.phase,enemies:sim.enemies.length,frames:view.frameCount||0});
      return view;
    },
    rawDelta:view=>view.rawDelta,
    preparePlayer(){},
    installPace({scene,controls,isPlaying}){
      scene.scaledDelta=raw=>isPlaying()?Math.min(raw,100)*(controls.held?1:.25):raw;
      return {destroy(){scene.scaledDelta=null;}};
    },
    start({scene,lifetime,reportLoading,renderedFrame,fail}){
      // Hold the startup artwork while configuration is still pending.
      const canPaint=()=>scene.sim.phase!=='ready'||!device.cover?.firstSortieLoading;
      const info=draws&&platform.renderer?.info;
      let paintStarted;
      scene.paintFrame=update=>{
        if(!canPaint())return;
        paintStarted=platform.now();
        if(!info?.render)return update();
        const auto=info.autoReset;if(auto)info.reset();info.autoReset=false;
        drawBase=info.render.calls;triangleBase=info.render.triangles;
        try{return update();}finally{info.autoReset=auto;}
      };
      let width=0,height=0,worldWidth=0;
      const stop=scene.start(progress=>reportLoading('textures',progress),()=>{
        if(!canPaint())return;
        if(!scene.frameCount)endSortieLoad?.();
        scene.frameCount=(scene.frameCount||0)+1;renderedFrame();
        if(draws&&!device.cover&&platform.visible){
          const {outputSize:size,worldSize:world}=scene.stage.glow;
          if(width!==size.width||height!==size.height||worldWidth!==world.width){
            width=size.width;height=size.height;worldWidth=world.width;
            platform.debugLog.info('战场分辨率',{chapter:chapterId,width,height,world:[worldWidth,world.height]});
          }
          if(scene.sim.phase==='playing'&&scene.sim.victoryDeparturePresentation)resultTrace?.departure(scene.sim.runId);
        }
        const ending=scene.sim.phase==='won'||scene.sim.phase==='lost';
        const panel=ending&&!device.cover&&platform.visible?readResultPanel?.():null;
        if(panel){resultTrace?.painted(panel);if(panel.motion.ready){onResultVisible?.();onResultVisible=null;}}
        if(warmHome&&scene.sim.phase==='playing'&&!device.cover&&platform.visible&&scene.rawDelta<32&&platform.now()-paintStarted<12){
          warmHome(lifetime.signal);warmHome=null;
        }
        if(!device.cover)warmTextures.afterPaint(scene.rawDelta,platform.now()-paintStarted,scene.sim.phase==='playing');
      },fail,{...platform,warmTextures,isVisible:()=>platform.visible,watchVisibility:fn=>watchVisibility(platform,fn)});
      lifetime.add(stop);
    },
  };
  const bindings={
    id,chapterId,baseURL,battleURL,playable:true,emit,reducedMotion,developerEnabled:()=>developerSkillsEnabled(services.storage),
    hidden:()=>!platform.visible,now:platform.now,
    createLifetime:()=>lifetime,
    bind(){},
    createGuide:()=>guide,
    createAudio:manifest=>(battleAudio=services.createBattleAudio(manifest,battleURL)),
    prepareAudio:audio=>{void audio.unlock(true).catch(error=>console.warn('[Three 战斗音效]',error?.message||error));},
    disposeAudio(audio){
      try{audio.dispose();}finally{battleAudio=undefined;}
    },
    createLaunch:options=>createFlightLaunch({...options,onPhase(phase){launchActive=phase==='waiting'||phase==='flying';}}),
    createControls:ready=>touch.controls(ready),
    onActivity:options=>createActivity(platform,options),
    unlockOnPointer:unlock=>touch.setUnlock(unlock),
    watchVisibility:change=>watchVisibility(platform,change),
  };
  const fetchResource=(path,options)=>services.fetchResource(new URL(path,battleURL).href,{
    ...options,signal:options?.signal??lifetime.signal,paceDataWork,
  });
  // Shared loadout reads can also belong to the lobby. A sortie closing
  // releases the frame wait without invalidating the shared result.
  const paceSharedData=(size,work)=>paceDataWork(size,work,{shared:true});
  try{return mountSharedBattleSession({bindings,hudHost,skinHost,fetchResource,
    canvas:platform.display.canvas,
    readSharedLoadoutJSON:services.readSharedLoadoutJSON&&
      (name=>services.readSharedLoadoutJSON(name,paceSharedData)),
    loadBattleData:services.loadBattleData&&((id,signal,prepare)=>services.loadBattleData(id,signal,prepare,{
      loadingFrame:()=>loadingFrame(1),now:platform.now,
    })),
    warmBattleTerrain:platform.warmArtworkFiles,loadingFrame,
    warmBattleImages:(urls,signal)=>platform.warmArtworkFiles(urls.slice(0,24),signal,3),
    memoryContext:{page:battleAddress.pathname,chapter:chapterId,canvases:Number(Boolean(platform.display.canvas)),
      storage:services.storage,readResources},
    setNotice:overlays.notice,setLoadingMessage:overlays.notice},rendering);}
  catch(error){lifetime.dispose();throw error;}
}

export function createWechatSortieBridge(platform,device,services,baseURL,options){
  let sequence=0,waitForResult;
  const host={
    baseURL,now:platform.now,hidden:()=>!platform.visible,
    async prepareResultReturn(isCurrent){
      await waitForResult?.();
      if(isCurrent())return device.prepareFirstSortieEquipment?.(isCurrent);
    },
    makeSessionId:()=>Date.now().toString(36)+'-'+(++sequence).toString(36),
    setLaunching(){},
    bind({visibility}){return watchVisibility(platform,visibility);},
    createSurface(){
      let finish;
      return {show(){},close(){finish?.();},mount(request){
        finish?.();
        let shown=false,release;
        finish=()=>{shown=true;release?.();};
        waitForResult=()=>shown?undefined:new Promise(resolve=>{
          const done=()=>{clearTimeout(timer);release=null;resolve();};
          const timer=setTimeout(done,450);release=done;
        });
        return mountWechatBattle({...request,platform,device,services,baseURL,onResultVisible:finish});
      }};
    },
  };
  return createSortieController({...options,screen:device,host,showSortieLoading:services.showSortieLoading});
}
