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
import { battleWidth,battleHeight,fullBattleFrame } from '../../../../../../../pixigame/src/three/game-screen/battle-frame-layout.js';
import { prewarmBattleArtwork } from './frame-artwork.js';

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

export function mountWechatBattle({platform,device,services,id,chapterId,emit,baseURL}){
  const bounds=()=>platform.viewport.screen;
  const region={bounds,enter(){},leave(){device.repaintHome?.();}};
  const battleAddress=new URL('replica-battle/index.html',baseURL);
  const battleURL=battleAddress.href;
  const reducedMotion=()=>false;
  const lifetime=createBattleLifetime(null,services.makeAbort);
  const endSortieLoad=services.beginSortieLoad?.();
  if(endSortieLoad)lifetime.add(endSortieLoad);
  let launchActive=false;
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
  const skinHost={
    baseURL,battleAssetBase:battleURL,staggerPresentation:true,
    readFighterFile:services.readFighterFile,objectLoader:services.objectLoader,assetBytes:services.assetBytes,
    openBattleSurface:()=>openWechatBattleSurface(device,platform,region),
    textureLoader:{load(path,loaded,_progress,failed){return artworkTexture(path,loaded,failed);}},
  };
  const hudHost={bounds,watchResize:platform.onViewport,bindInput:options=>touch.bindInput(options),
    safeInsets:()=>({top:platform.viewport.safeTop,bottom:platform.viewport.safeBottom}),
    loadImageSurface:platform.loadArtwork};
  let skills;
  const rendering={
    mountCombatHud:mountThreeCombatHud,
    mountDeveloperSkills:(_stage,...args)=>skills=services.mountDeveloperSkills(device,region,...args),
    createChoiceBurst:()=>burst,
    createAppearance:(content,appearance,onError,onGraphicsContext,onProgress,onFlightRoll,host,aircraftReady)=>
      createH5Presentation({content,appearance,onError,onGraphicsContext,onProgress,onFlightRoll,host,aircraftReady}),
    createView(content,sim,ready,skin){
      const view=new CombatView(content,sim,ready,skin);
      let lastReport=-Infinity,reports=0;
      view.profileClock=platform.now;
      view.reportSlowFrame=stats=>{
        const now=platform.now(),cpu=stats.logic+stats.terrainAndPlane+stats.entitiesAndEffects+stats.draw;
        if(sim.phase!=='playing'||launchActive||device.cover||reports>=16||now-lastReport<3000||
          (stats.interval<48&&cpu<28))return;
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
      const stop=scene.start(progress=>reportLoading('textures',progress),()=>{
        if(!scene.frameCount)endSortieLoad?.();
        scene.frameCount=(scene.frameCount||0)+1;renderedFrame();
      },fail,{...platform,warmTextures:prewarmBattleArtwork(platform)});
      lifetime.add(stop);
    },
  };
  const bindings={
    id,chapterId,baseURL,battleURL,playable:true,emit,reducedMotion,developerEnabled:()=>developerSkillsEnabled(services.storage),
    hidden:()=>!platform.visible,now:platform.now,
    createLifetime:()=>lifetime,
    bind(){},
    createGuide:()=>guide,
    createAudio:manifest=>services.createBattleAudio(manifest,battleURL),
    prepareAudio:audio=>{void audio.unlock(true).catch(error=>console.warn('[Three 战斗音效]',error?.message||error));},
    disposeAudio:audio=>audio.dispose(),
    createLaunch:options=>createFlightLaunch({...options,onPhase(phase){launchActive=phase==='waiting'||phase==='flying';}}),
    createControls:ready=>touch.controls(ready),
    onActivity:options=>createActivity(platform,options),
    unlockOnPointer:unlock=>touch.setUnlock(unlock),
    watchVisibility:change=>watchVisibility(platform,change),
  };
  const fetchResource=(path,options)=>services.fetchResource(new URL(path,battleURL).href,options);
  try{return mountSharedBattleSession({bindings,hudHost,skinHost,fetchResource,
    canvas:platform.display.canvas,readSharedLoadoutJSON:services.readSharedLoadoutJSON,loadBattleData:services.loadBattleData,
    memoryContext:{page:battleAddress.pathname,canvases:Number(Boolean(platform.display.canvas)),storage:services.storage},
    setNotice:overlays.notice,setLoadingMessage:overlays.notice},rendering);}
  catch(error){lifetime.dispose();throw error;}
}

export function createWechatSortieBridge(platform,device,services,baseURL,options){
  let sequence=0;
  const host={
    baseURL,now:platform.now,hidden:()=>!platform.visible,
    makeSessionId:()=>Date.now().toString(36)+'-'+(++sequence).toString(36),
    setLaunching(){},
    bind({visibility}){return watchVisibility(platform,visibility);},
    createSurface(){
      return {show(){},close(){},mount(request){
        return mountWechatBattle({...request,platform,device,services,baseURL});
      }};
    },
  };
  return createSortieController({...options,screen:device,host,showSortieLoading:services.showSortieLoading});
}
