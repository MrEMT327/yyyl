// Presentation-only weather. Never consumes the simulation RNG or changes a
// projectile, collision, reward, native clock or progression value.
export const BATTLE_WEATHERS=Object.freeze([
  Object.freeze({id:'day',name:'白天',groundTint:0xfff9ed,aircraftTint:0xffffff,rain:0,wind:0}),
  Object.freeze({id:'night',name:'夜晚',groundTint:0x647eac,aircraftTint:0xd7e7ff,rain:0,wind:0}),
  Object.freeze({id:'rain',name:'雨天',groundTint:0xa2bacb,aircraftTint:0xe0edfa,rain:144,wind:-360}),
  Object.freeze({id:'storm',name:'雷雨',groundTint:0x5e738f,aircraftTint:0xcadfff,rain:216,wind:-510}),
]);
function randomWeatherValue(){
  if(globalThis.crypto?.getRandomValues){
    const value=new Uint32Array(1);globalThis.crypto.getRandomValues(value);return value[0]/4294967296;
  }
  return Math.random();
}
const unit=value=>Number.isFinite(value)?Math.max(0,Math.min(1-Number.EPSILON,value)):0;
export function weatherNoise(seed){
  let x=seed|0;x=Math.imul(x^(x>>>16),0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);
  return ((x^(x>>>16))>>>0)/4294967296;
}
const pulse=(age,start,duration)=>age<start||age>start+duration?0:Math.sin((age-start)/duration*Math.PI);

/** One equal-probability choice per actual run. runId=0 is the ready screen.
 * Pause, upgrade, revive and an equal battle clock never roll the weather. */
export function createBattleWeather({random=randomWeatherValue}={}){
  let runId=0,profile=BATTLE_WEATHERS[0],seed=0,revision=0,last=null;
  return {update(frame,reducedMotion=false){
    const run=frame.runId??1;
    if(run!==runId){
      runId=run;revision++;
      if(run===0){profile=BATTLE_WEATHERS[0];seed=0;}
      else{profile=BATTLE_WEATHERS[Math.floor(unit(random())*BATTLE_WEATHERS.length)];seed=Math.floor(unit(random())*4294967296);}
      last=null;
    }
    const rawTime=frame.coastBackgroundTime??frame.time;
    const time=Number.isFinite(rawTime)?Math.max(0,rawTime):0;
    if(last&&last.time===time&&last.reducedMotion===reducedMotion)return last;
    const cycle=Math.floor(time/10),start=4.8+weatherNoise(seed+cycle*199)*2.8;
    const strikeAge=time-cycle*10-start;
    // Two restrained cloud-light pulses, separated by darkness. Reduced-motion
    // keeps the rain/mood but disables lightning and its luminance changes.
    const flash=profile.id==='storm'&&!reducedMotion?
      .28*Math.max(pulse(strikeAge,0,.16),pulse(strikeAge,.24,.16)*.55):0;
    last={profile,seed,revision,time,reducedMotion,cycle,flash,
      bolt:profile.id==='storm'&&!reducedMotion&&strikeAge>=.025&&strikeAge<.16};
    return last;
  }};
}
