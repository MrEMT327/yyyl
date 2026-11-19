import {combatTimeScale} from '../src/combat-time.js';

const MOVEMENT_KEYS=new Map([
  ['arrowup','ArrowUp'],['arrowdown','ArrowDown'],['arrowleft','ArrowLeft'],['arrowright','ArrowRight'],
  ['w','KeyW'],['a','KeyA'],['s','KeyS'],['d','KeyD'],
]);

/** Restore the project's original released-control pace at the scene boundary.
 * Native simulation steps stay fixed; every scene consumer gets the same delta.
 * Menus, launch, movement onboarding and revive use the caller's playing gate. */
export function installReleaseSlowMotion({scene,controls,isPlaying,host=window,signal}){
  const keys=new Set(),systems=scene.sys,originalStep=systems.step,originalClear=controls.clear;
  let disposed=false,virtualTime=null,tweens=null,tweenBase=1,lastTweenScale=null;
  const state={keys,relativeDragActive:false,
    get state(){return isPlaying()?'playing':'paused';},
    get pointerActive(){return controls.held;},
  };
  const scale=()=>disposed?1:combatTimeScale(state);
  function keydown(event){
    if(event.target?.closest?.('input, textarea, select, [contenteditable="true"]'))return;
    const key=MOVEMENT_KEYS.get(String(event.key).toLowerCase());if(key)keys.add(key);
  }
  function keyup(event){
    const key=MOVEMENT_KEYS.get(String(event.key).toLowerCase());if(key)keys.delete(key);
  }
  function clear(...args){keys.clear();return originalClear.apply(this,args);}
  function restoreTweens(){
    if(tweens&&tweens.timeScale===lastTweenScale)tweens.timeScale=tweenBase;
    tweens=null;lastTweenScale=null;
  }
  function syncTweens(value){
    // Phaser's TweenManager samples its own wall clock instead of scene delta.
    // Scale it once here; timers, particles and animations use the scene delta.
    if(scene.tweens!==tweens){
      restoreTweens();tweens=scene.tweens;
      tweenBase=Number.isFinite(tweens?.timeScale)?tweens.timeScale:1;
    }
    if(tweens){lastTweenScale=tweenBase*value;tweens.timeScale=lastTweenScale;}
  }
  function step(time,delta){
    const raw=Number.isFinite(delta)?Math.max(0,delta):0,value=scale();
    // Match the existing battle accumulator's 100ms stall bound before
    // scaling. Non-combat clocks retain their full real-time delta.
    const elapsed=(isPlaying()?Math.min(raw,100):raw)*value;
    if(virtualTime===null)virtualTime=(Number.isFinite(time)?time:0)-raw;
    virtualTime+=elapsed;syncTweens(value);
    const result=originalStep.call(this,virtualTime,elapsed);
    syncTweens(scale());return result;
  }
  function destroy(){
    if(disposed)return;disposed=true;
    host.removeEventListener('keydown',keydown);host.removeEventListener('keyup',keyup);
    signal?.removeEventListener('abort',destroy);
    if(systems.step===step)systems.step=originalStep;
    if(controls.clear===clear)controls.clear=originalClear;
    restoreTweens();keys.clear();
  }
  if(!signal?.aborted){
    controls.clear=clear;systems.step=step;
    host.addEventListener('keydown',keydown);host.addEventListener('keyup',keyup);
    signal?.addEventListener('abort',destroy,{once:true});
  }else disposed=true;
  return {get scale(){return scale();},destroy};
}

