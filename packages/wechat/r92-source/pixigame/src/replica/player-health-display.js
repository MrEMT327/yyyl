export const PLAYER_LOW_HEALTH_RATIO=.25;
export const PLAYER_LOW_HEALTH_COLOR=0xff4b55;
export function playerHealthBarColor(ratio,hitFlash=false){
  return ratio<=PLAYER_LOW_HEALTH_RATIO?PLAYER_LOW_HEALTH_COLOR:hitFlash?0xff7777:0x3ee4a1;
}


// Render-only HP interpolation. Combat HP is never written or delayed.
export const PLAYER_HEAL_BAR_SECONDS=.45;
export function playerHealthFrame(previous,hp,maxHp,time,runId=0,quiet=false){
  maxHp=Number.isFinite(maxHp)?Math.max(1,maxHp):1;
  hp=Number.isFinite(hp)?Math.max(0,Math.min(maxHp,hp)):0;
  time=Number.isFinite(time)?Math.max(0,time):0;
  const target=hp/maxHp;
  if(!previous||previous.runId!==runId||previous.maxHp!==maxHp||time<previous.time
    ||hp<=0||previous.hp<=0||hp<previous.hp||quiet){
    return{runId,hp,maxHp,time,at:time,from:target,target,value:target,animating:false};
  }
  const progress=Math.max(0,Math.min(1,(time-previous.at)/PLAYER_HEAL_BAR_SECONDS));
  const ease=progress*progress*(3-2*progress);
  const current=previous.from+(previous.target-previous.from)*ease;
  if(hp>previous.hp)return{runId,hp,maxHp,time,at:time,from:current,target,value:current,animating:current<target};
  return{...previous,time,value:progress>=1?target:current,animating:progress<1&&previous.from<target};
}
