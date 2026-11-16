// Gold shares native effect IDs with other supplies. Keep its identity and
// burst coalescing outside gameplay snapshots, serials and random streams.
const effects=new WeakMap(),collectors=new WeakMap(),receipts=new WeakMap();
// Original140014: two soft additive glows, one burst each,0.2s life.
// Project code recreates the glow; no original image or sound is installed.
export const COIN_FEEDBACK_SECONDS=.2;
export const COIN_FEEDBACK_INTERVAL=.07;
export const COIN_GLOW_COLOR=Object.freeze([1,.9279966950416565,.18396228551864624]);
export function sampleCoinPickupGlow(age){
 if(!Number.isFinite(age)||age<0||age>=COIN_FEEDBACK_SECONDS)return{size:1,alpha:0};
 const t=age/COIN_FEEDBACK_SECONDS,peak=5135/65535;
 const alpha=.9278350472450256*(t<peak?t/peak:(1-t)/(1-peak));
 // Hermite size keys0.682727->1, with original endpoint tangents0.825097/0.
 const start=.6827269792556763,slope=.8250970244407654;
 const size=(2*t*t*t-3*t*t+1)*start+(t*t*t-2*t*t+t)*slope+(-2*t*t*t+3*t*t);
 return{size,alpha};
}
export function markCoinPickupEffect(effect,owner){
 const old=collectors.get(owner),time=owner.clock;
 const admitted=Number.isFinite(time)&&(!old||old.runId!==owner.runId||time<old.at||time-old.at>=COIN_FEEDBACK_INTERVAL-1e-8);
 effects.set(effect,{admitted});
 if(admitted)collectors.set(owner,{runId:owner.runId,at:time});
 return effect;
}
export function coinPickupFeedback(effect){return effects.get(effect);}

// The display receipt is created on successful absorption, independently of
// native item collectEffectId and its original particle lifetime.
export function recordCoinPickupReceipt(owner){
 const old=collectors.get(owner),time=owner.clock;
 if(!Number.isFinite(time)||owner.player.hp<=0)return;
 if(old&&old.runId===owner.runId&&time>=old.at&&time-old.at<COIN_FEEDBACK_INTERVAL-1e-8)return;
 const previous=receipts.get(owner),uid=previous?.runId===owner.runId?previous.effect.uid-1:-1;
 const effect={uid,kind:'muzzle',modelId:140014,x:owner.player.x,z:owner.player.z,age:0,duration:COIN_FEEDBACK_SECONDS,size:1};
 markCoinPickupEffect(effect,owner);receipts.set(owner,{runId:owner.runId,at:time,effect});
}
export function sampleCoinPickupReceipt(owner){
 const receipt=receipts.get(owner);if(!receipt)return null;
 const age=owner.clock-receipt.at;
 if(receipt.runId!==owner.runId||!Number.isFinite(age)||age<0||age>=COIN_FEEDBACK_SECONDS||owner.player.hp<=0){receipts.delete(owner);return null;}
 const effect=receipt.effect;effect.age=age;effect.x=owner.player.x;effect.z=owner.player.z;return effect;
}
