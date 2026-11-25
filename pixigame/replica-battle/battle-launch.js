export const BATTLE_LAUNCH_SECONDS=1.25;
export function launchProgress(seconds){
  const t=Math.max(0,Math.min(1,seconds/BATTLE_LAUNCH_SECONDS));
  return t<.5?2*t*t:1-2*(1-t)*(1-t);
}

// Presentation owns no simulation tick: entry.ts explicitly holds the original
// logic loop until this movement completes, then releases the actual player.
export function createFlightLaunch({player,bounds,clearInput,onVisual,onComplete,reducedMotion=()=>false,onPhase=()=>{}}) {
  let active=false,revealed=false,elapsed=0,startZ=0,targetZ=0,targetX=0;
  const position=value=>{const p=player();p.x=p.oldX=targetX;p.z=p.oldZ=value;};
  const finish=()=>{
    position(targetZ);active=false;revealed=false;clearInput();onVisual(null);
    onPhase('complete');onComplete();
  };
  return {
    get active(){return active;},
    begin(){
      const b=bounds();targetX=(b.left+b.right)/2;targetZ=(b.top+b.bottom)/2;
      startZ=b.bottom-Math.max(3,(b.top-b.bottom)*.1);
      active=true;revealed=false;elapsed=0;position(startZ);clearInput();onVisual({time:0,thrust:0,fromZ:startZ});
      onPhase('waiting');
    },
    reveal(){if(!active||revealed)return;revealed=true;onPhase('flying');if(reducedMotion())finish();},
    update(delta){
      if(!active||!revealed)return;
      elapsed+=Math.max(0,Math.min(.08,Number(delta)||0));
      const t=Math.min(1,elapsed/BATTLE_LAUNCH_SECONDS),distance=launchProgress(elapsed);
      position(startZ+(targetZ-startZ)*distance);
      onVisual({time:elapsed,thrust:Math.sin(Math.PI*t),fromZ:startZ});
      if(t>=1)finish();
    },
    destroy(){active=false;onPhase(null);onVisual(null);},
  };
}

export function createBattleLaunch({stage,...options}) {
  const flight=createFlightLaunch({...options,onPhase(phase){
    if(phase==='waiting'||phase==='flying')stage.dataset.launch=phase;else stage.removeAttribute('data-launch');
    if(phase)stage.dataset.launchState=phase;
  }});
  const view=stage.ownerDocument.defaultView;
  const block=event=>{if(flight.active){event.preventDefault();event.stopImmediatePropagation();}};
  const pointerEvents=['pointerdown','pointermove','pointerup','click'];
  for(const type of pointerEvents)stage.addEventListener(type,block,true);
  for(const type of ['keydown','keyup'])view.addEventListener(type,block,true);
  return {get active(){return flight.active;},begin:flight.begin,reveal:flight.reveal,update:flight.update,destroy(){
    flight.destroy();for(const type of pointerEvents)stage.removeEventListener(type,block,true);
    for(const type of ['keydown','keyup'])view.removeEventListener(type,block,true);
  }};
}
