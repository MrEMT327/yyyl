export {openBattleScreen} from './h5-battle-screen.js';
export {NativeBattleView} from './three-battle-view.js';
export {BattleEffectsView} from './three-battle-effects-view.js';
export {nativeWeather} from './three-combat-weather.js';
export {NativeIceTrail} from './three-ice-trail.js';

export function installCombatPace(scene,controls,isPlaying,signal){
  const movement=new Set(),keys=new Set(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d']);
  const down=event=>{const k=event.key.toLowerCase();if(keys.has(k))movement.add(k);};
  const up=event=>movement.delete(event.key.toLowerCase());
  window.addEventListener('keydown',down,{signal});window.addEventListener('keyup',up,{signal});
  window.addEventListener('blur',()=>movement.clear(),{signal});
  scene.scaledDelta=raw=>isPlaying()?Math.min(raw,100)*(controls.held||movement.size?1:.25):raw;
  return {destroy(){movement.clear();scene.scaledDelta=null;}};
}

