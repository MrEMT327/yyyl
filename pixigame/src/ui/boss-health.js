// APK 1.1.6 Const.HpSpeed / ReduceSpeed after FP.FromString (Q16 rounding).
export const BOSS_HP_TWEEN_SECONDS=5243/65536;
export const BOSS_HP_TRAIL_SECONDS=21627/65536;
const f=Math.fround;
const clamp=value=>Math.max(0,Math.min(1,value));
// StateBarBase.LerpHp uses Math.Round(double), including ties to even.
function roundHp(value){
  const floor=Math.floor(value);
  return value-floor===.5?floor+(floor%2):Math.round(value);
}

/** Read-only counterpart of StateBarBase.SetHP -> UpdateHp -> OnUpdate_Reduce.
 * ratio is real HP for the label; bar and trail are visual values only.
 * now is the battle clock in milliseconds, so pause cannot consume the tween. */
export function updateBossHealth(previous,boss,now,reducedMotion=false){
  const rawMax=Number(boss?.maxHp),rawHp=Number(boss?.hp);
  const valid=Number.isFinite(rawMax)&&rawMax>0&&Number.isFinite(rawHp);
  const maxHp=valid?rawMax:1,hp=valid?Math.max(0,Math.min(maxHp,rawHp)):0,ratio=hp/maxHp;
  now=Number.isFinite(now)?now:previous?.at??0;
  if(!previous||previous.boss!==boss||previous.maxHp!==maxHp||now<previous.at||reducedMotion){
    const bar=f(ratio);
    return {boss,maxHp,hp,ratio,bar,trail:bar,displayHp:hp,fromHp:hp,
      hpTime:BOSS_HP_TWEEN_SECONDS,trailFrom:bar,trailTime:BOSS_HP_TRAIL_SECONDS,
      reduceTarget:bar,reducing:false,animating:false,at:now};
  }
  if(now===previous.at&&hp===previous.hp)return previous;
  const dt=f(Math.max(0,(now-previous.at)/1000));
  let {displayHp,fromHp,hpTime,trail,trailFrom,trailTime,reduceTarget,reducing,bar}=previous;
  if(hp<previous.hp){
    // SetHP restarts from the currently displayed HP, not from the old target.
    fromHp=displayHp;hpTime=0;
    const target=f(ratio);
    if(target!==reduceTarget){reduceTarget=target;trailFrom=trail;trailTime=0;reducing=true;}
  }else if(hp>previous.hp){
    // ForceStopReduce: healing stops the damage trail. UpdateHp still runs.
    reducing=false;reduceTarget=f(ratio);
  }
  if(dt>0&&displayHp!==hp){
    hpTime=Math.max(0,Math.min(BOSS_HP_TWEEN_SECONDS,f(hpTime+dt)));
    const progress=f(hpTime/BOSS_HP_TWEEN_SECONDS);
    displayHp=hpTime>=BOSS_HP_TWEEN_SECONDS?hp:roundHp(fromHp+(hp-fromHp)*progress);
    bar=f(clamp(displayHp/maxHp));
    // Native UpdateHpUI runs before OnUpdate_Reduce and refreshes its target.
    reduceTarget=bar;
  }
  if(dt>0&&reducing){
    if(trail<=reduceTarget){trail=reduceTarget;reducing=false;}
    else{
      trailTime=f(trailTime+dt);
      if(trailTime>=BOSS_HP_TRAIL_SECONDS)trail=reduceTarget;
      else{
        trailTime=Math.max(0,Math.min(BOSS_HP_TRAIL_SECONDS,trailTime));
        const progress=clamp(f(trailTime/BOSS_HP_TRAIL_SECONDS));
        trail=f(trailFrom+f(progress*f(reduceTarget-trailFrom)));
      }
    }
  }
  return {boss,maxHp,hp,ratio,bar,trail,displayHp,fromHp,hpTime,trailFrom,trailTime,
    reduceTarget,reducing,animating:displayHp!==hp||(reducing&&trail>reduceTarget),at:now};
}
