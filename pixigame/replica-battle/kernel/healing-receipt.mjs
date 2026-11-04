// A sidecar for presentation only: no native effect, serial, RNG or HP write.
const receipts=new WeakMap(),medicalPickups=new WeakMap();
export function recordHealingReceipt(owner,amount){
 if(!(amount>0)||!Number.isFinite(amount)||!Number.isFinite(owner.clock))return;
 const previous=receipts.get(owner),same=previous?.runId===owner.runId;
 if(same&&owner.clock>=previous.born&&owner.clock-previous.born<.12){previous.amount+=amount;return;}
 receipts.set(owner,{runId:owner.runId,uid:same?previous.uid-1:-1,born:owner.clock,amount});
}
// This separate, bounded lane keeps a medical pickup visible even at full HP
// or while rapid passive healing receipts are arriving.
export function recordMedicalPickupReceipt(owner){
 if(!Number.isFinite(owner.clock))return;
 const previous=medicalPickups.get(owner),same=previous?.runId===owner.runId;
 if(same&&owner.clock>=previous.born&&owner.clock-previous.born<.12)return;
 medicalPickups.set(owner,{runId:owner.runId,uid:same?previous.uid-1:-1,born:owner.clock});
}
export function sampleHealingReceipt(owner){
 const pickup=medicalPickups.get(owner);
 if(pickup&&pickup.runId===owner.runId){
  const age=owner.clock-pickup.born;
  if(!Number.isFinite(age)||age<0)medicalPickups.delete(owner);
  else if(age<.9&&owner.player.hp>0)return{uid:pickup.uid,kind:'heal',x:owner.player.x,z:owner.player.z,age,duration:.9,size:4.2};
 }
 const r=receipts.get(owner);if(!r||r.runId!==owner.runId)return null;
 const age=owner.clock-r.born;
 if(!Number.isFinite(age)||age<0){receipts.delete(owner);return null;}
 if(age>=.6||!(owner.player.hp>0))return null;
 return{uid:r.uid,kind:'heal',x:owner.player.x,z:owner.player.z,age,duration:.6,size:3};
}
