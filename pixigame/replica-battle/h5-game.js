import {mountBattleSession} from './battle-session';
import {CombatView} from '../src/three/game-screen/combat-view.js';
import {createH5Presentation} from '../src/replica/h5-project-presentation.js';
import {installCombatPace} from '../src/three/game-screen/h5-battle.js';
import {performanceMonitor} from '../src/performance-monitor.js';
import {mountThreeCombatHud} from '../src/three/game-screen/battle-hud-scene.js';
import {createThreeMovementGuide} from '../src/three/game-screen/movement-guide.js';
import {createThreeBreakthrough} from '../src/three/game-screen/breakthrough.js';
import {createBattleOverlays} from '../src/three/game-screen/battle-overlays.js';
import {mountThreeDeveloperSkills} from '../src/three/game-screen/developer-skills.js';

const rendering={mountCombatHud:mountThreeCombatHud,
  createAppearance:(content,appearance,onError,onGraphicsContext,onProgress,onFlightRoll,host,aircraftReady)=>
    createH5Presentation({content,appearance,onError,onGraphicsContext,onProgress,onFlightRoll,host,aircraftReady}),
  createView(content,sim,ready,skin){
    const view=new CombatView(content,sim,ready,skin);
    skin.screen.session.snapshot=()=>({wave:sim.wave,phase:sim.phase,enemies:sim.enemies.length,
      projectiles:sim.projectiles.length,elapsed:sim.time,frames:view.frameCount||0});
    return view;
  },
  rawDelta:view=>view.rawDelta,
  installPace:({scene,controls,isPlaying,signal})=>installCombatPace(scene,controls,isPlaying,signal),
  // CombatView preloads the loadout and authored battle textures before ready.
  preparePlayer(){},
  start({scene,lifetime,reportLoading,renderedFrame,fail}){
    const info=scene.stage.renderer.info;
    const totals={calls:0,triangles:0};
    scene.paintFrame=update=>{
      if(!performanceMonitor.enabled)return update();
      const previous=info.autoReset;
      info.reset();info.autoReset=false;
      try{return performanceMonitor.measure('render',update);}
      finally{totals.calls=info.render.calls;totals.triangles=info.render.triangles;info.autoReset=previous;}
    };
    const remove=performanceMonitor.registerRenderer('Three 战斗',()=>({active:!lifetime.disposed,
      frame:scene.frameCount||0,...totals,...info.memory}));
    const stop=scene.start(progress=>reportLoading('textures',progress),()=>{
      scene.frameCount=(scene.frameCount||0)+1;
      performanceMonitor.frame('combat',performance.now());renderedFrame();
    },fail);
    lifetime.add(()=>{remove();stop();});
  },
};
export function mountH5Battle({stage,url,screen,emit,checkpointTarget}){
  stage.setAttribute('data-awaiting-start','');
  const slot=document.createElement('div');slot.id='canvas';
  stage.replaceChildren(slot);
  const fetchResource=(path,options)=>fetch(typeof path==='string'?new URL(path,url):path,options);
  const guide=createThreeMovementGuide(screen.three,slot);
  const burst=createThreeBreakthrough(screen.three,slot);
  const overlays=createBattleOverlays(screen.three,{region:slot,noticeHost:stage,launching:()=>stage.hasAttribute('data-launch')});
  let skills;
  const sessionRendering={...rendering,mountDeveloperSkills(...args){
    skills=mountThreeDeveloperSkills(screen,...args);return skills;
  },createChoiceBurst:()=>burst,createView(...args){
    const view=rendering.createView(...args);view.stage.drawMovementGuide=guide.draw;
    view.stage.drawBreakthrough=burst.paint;
    view.stage.setModalPhase=overlays.phaseChange;view.stage.drawBackdrop=overlays.drawBackdrop;view.stage.drawNotice=overlays.drawNotice;
    view.stage.drawDeveloperSkills=()=>skills?.draw();
    return view;
  }};
  const session=mountBattleSession({window,document,parent:window,location:url,canvas:screen.three.domElement,skinHost:{screen,stage,events:window,baseURL:document.baseURI,battleAssetBase:url.href},
    movementGuide:guide,setNotice:overlays.notice,setLoadingMessage:overlays.notice,fetchResource,checkpointTarget,emit},sessionRendering);
  return {receive:session.receive,dispose(){try{session.dispose();}finally{overlays.destroy();}}};
}

