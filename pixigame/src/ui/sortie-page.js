import * as THREE from 'three';
import { createThreeSurface } from './three-surface.js';
import { createFighterInput } from './fighter-input.js';
import { createSortieFighter } from './sortie-fighter.js';
import { renderSortieLayout } from './sortie-layout.js';

export function createSortiePage({ bridge, actions }) {
  const surface=createThreeSurface(),{group}=surface;
  group.name='sortie-native-three';
  const fighter=createSortieFighter({renderer:bridge.app.renderer,pilotId:bridge.getActivePilot().id,appearance:bridge.getAssemblyAppearance()});
  const input=createFighterInput(surface.controls,fighter);
  const loader=new THREE.TextureLoader(),art=new Map(),requests=new Map();
  const reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
  let disposed=false,active=false,launchPending=false,animationFrame=0,lastTime=0;

  function loadArt(id,path) {
    if(requests.get(id)?.path===path)return;
    const request={path};requests.set(id,request);
    loader.load(`${import.meta.env.BASE_URL}${path.replace(/^\.\//,'')}`,texture=>{
      if(disposed||requests.get(id)!==request){texture.dispose();return;}
      texture.colorSpace=THREE.SRGBColorSpace;art.get(id)?.dispose();art.set(id,texture);refresh();
    },undefined,error=>{if(!disposed)console.warn(`[sortie-art:${id}] 素材未能加载`,error);});
  }
  function update(ticker) {
    if(active)fighter.update(Math.min(.05,Math.max(0,(ticker?.deltaMS||16.67)/1000)),reducedMotion);
  }
  // Legacy menus stop the game ticker. The visible page drives the same
  // renderer while idle, and never double-renders when combat owns the ticker.
  function schedule() {
    if(animationFrame||disposed||!active||globalThis.document?.hidden)return;
    animationFrame=requestAnimationFrame(now=>{
      animationFrame=0;
      if(disposed||!active||globalThis.document?.hidden)return;
      if(!bridge.app.ticker.started){actions.update({deltaMS:lastTime?now-lastTime:16.67});bridge.app.renderer.render({container:bridge.app.stage});}
      lastTime=now;schedule();
    });
  }
  function onVisibility() {
    lastTime=0;
    if(globalThis.document?.hidden){cancelAnimationFrame(animationFrame);animationFrame=0;input.cancel();}else schedule();
  }
  globalThis.document?.addEventListener('visibilitychange',onVisibility);
  function launch() {
    if(launchPending||!bridge.isStageUnlocked(bridge.selectedStageIndex)||!bridge.isDifficultyUnlocked(bridge.selectedStageIndex,bridge.selectedDifficultyId))return;
    launchPending=true;
    try{bridge.startGame();}finally{if(bridge.game.state==='menu')launchPending=false;}
  }
  function refresh() {
    if(disposed)return;
    input.cancel();surface.clear();
    const pilot=bridge.getActivePilot();
    loadArt('pilot',pilot.avatar || pilot.image);
    fighter.setPilot(pilot.id,bridge.getAssemblyAppearance());
    renderSortieLayout({surface,bridge,art,fighter,actions,launch});
  }
  loadArt('background','assets/ui/sortie/hangar-opening-v1.webp');
  loadArt('icons','assets/ui/sortie/nav-icons-v2.webp');
  loadArt('daily','assets/ui/daily-login-icon.png');
  refresh();
  return {
    group,refresh,
    get state(){return {camera:fighter.state,fixedParts:fighter.fixedParts};},
    get controls(){return surface.controls.map(({id,label,x,y,width,height,disabled})=>({id,label,x,y,width,height,disabled}));},
    setVisible(value,interactive=value){
      group.visible=value;fighter.setVisible(value&&interactive);
      if(active&&!interactive)input.cancel();
      if(!value)launchPending=false;active=interactive;
      if(active)schedule();else{cancelAnimationFrame(animationFrame);animationFrame=0;lastTime=0;}
    },
    handlePointer(event){return active?input.handle(event):false;},
    activateAt(x,y){const control=active&&input.hit(x,y);if(!control)return false;control.onPress();return true;},
    update,
    destroy(){
      disposed=true;cancelAnimationFrame(animationFrame);globalThis.document?.removeEventListener('visibilitychange',onVisibility);
      input.cancel();fighter.destroy();surface.destroy();art.forEach(texture=>texture.dispose());art.clear();
    },
  };
}
