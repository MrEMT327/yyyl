import { WebGLRenderer } from '../src/three/display.js';
import { releaseOwnedCanvas } from '../src/ui/release-owned-canvas.js';
import {bindCombatHud} from './combat-hud-bindings.js';
import './cloud-combat.css';

export async function mountCloudCombat(options){
  const {stage,sim,onGraphicsContext}=options;
  const canvas=document.createElement('canvas');canvas.className='cloud-combat-canvas';
  canvas.setAttribute('aria-label','战斗界面');
  const context=canvas.getContext('webgl2',{alpha:true,antialias:true});
  if(!context){releaseOwnedCanvas(canvas);throw new Error('无法初始化云端战斗界面');}
  const renderer=new WebGLRenderer();
  const pixelRatio=Math.min(devicePixelRatio||1,2);
  const nativeDisplay=Boolean(globalThis.__THUNDER_RUNTIME_GLOBALS__?.nativeDocument);
  const nativeHudTiles=nativeDisplay?document.createElement('div'):null;
  if(nativeHudTiles){
    nativeHudTiles.className='cloud-combat-hud-tiles';
    nativeHudTiles.style.cssText='position:absolute;inset:0;z-index:20;pointer-events:none';
    nativeHudTiles.hidden=true;
  }
  try{await renderer.init({canvas,context,uiOnly:true,width:600,height:1300,resolution:nativeDisplay?1:pixelRatio});}
  catch(error){releaseOwnedCanvas(canvas);throw error;}
  const disposeRenderer=()=>{
    renderer.destroy(true);
    renderer.three.forceContextLoss();
    releaseOwnedCanvas(canvas);
  };
  onGraphicsContext?.(canvas,context);renderer.three.setClearColor(0,0);renderer.setBloomEnabled(false);
  let usingTiles=false;
  return bindCombatHud(options,{canvas,renderer,nativeHudTiles,pixelRatio:nativeDisplay?pixelRatio:undefined,
    mount(){stage.append(canvas);if(nativeHudTiles)stage.append(nativeHudTiles);},
    setPhase(phase,showingResult){
      stage.classList.toggle('cloud-result-visible',showingResult);
      stage.classList.toggle('cloud-pause-visible',phase==='paused');
      stage.classList.toggle('cloud-upgrade-visible',phase==='upgrade');
      stage.classList.toggle('cloud-supply-visible',phase==='treasure');
      stage.classList.toggle('cloud-revive-visible',phase==='revive');
      stage.classList.toggle('cloud-defeat-visible',phase==='lost');
      stage.classList.toggle('cloud-victory-visible',phase==='won');
    },
    draw(scene,cloud,selectionLayer){
    const showTiles=Boolean(nativeHudTiles&&!stage.hasAttribute('data-awaiting-start')&&!stage.hasAttribute('data-launch')&&
      scene.children.length===2&&selectionLayer.mount.children.length===0&&cloud.showNativeHud());
    if(showTiles!==usingTiles){
      usingTiles=showTiles;
      nativeHudTiles.hidden=!showTiles;
      canvas.style.visibility=showTiles?'hidden':'';
    }
    if(!showTiles)renderer.render({container:scene});
    },
    disposeRenderer(){stage.classList.remove('cloud-result-visible','cloud-pause-visible','cloud-upgrade-visible','cloud-supply-visible','cloud-revive-visible','cloud-defeat-visible','cloud-victory-visible');nativeHudTiles?.remove();disposeRenderer();}
  });
}
