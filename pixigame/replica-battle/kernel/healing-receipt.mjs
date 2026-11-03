// A sidecar for presentation only: no native effect, serial, RNG or HP write.
const receipts=new WeakMap();
export function recordHealingReceipt(owner,amount){
 if(!(amount>0)||!Number.isFinite(amount)||!Number.isFinite(owner.clock))return;
 const previous=receipts.get(owner),same=previous?.runId===owner.runId;
 if(same&&owner.clock>=previous.born&&owner.clock-previous.born<.12){previous.amount+=amount;return;}
 receipts.set(owner,{runId:owner.runId,uid:same?previous.uid-1:-1,born:owner.clock,amount});
}
export function sampleHealingReceipt(owner){
 const r=receipts.get(owner);if(!r||r.runId!==owner.runId)return null;
 const age=owner.clock-r.born;
 if(!Number.isFinite(age)||age<0){receipts.delete(owner);return null;}
 if(age>=.6||!(owner.player.hp>0))return null;
 return{uid:r.uid,kind:'heal',x:owner.player.x,z:owner.player.z,age,duration:.6,size:3};
}
