// Cosmetic receipts use their own IDs and never consume combat RNG or serials.
const runs=new WeakMap();
export const SPECIAL_FEEDBACK_LIMIT=40;
function lane(owner){
 let q=runs.get(owner);
 if(!q||q.run!==owner.runId||owner.clock<q.clock){q={run:owner.runId,clock:owner.clock,serial:0,items:[]};runs.set(owner,q);}
 q.clock=owner.clock;q.items=q.items.filter(f=>owner.clock-f.born<f.duration);
 return q;
}
function add(q,owner,point,type,size,familyId,weaponId){
 const f={uid:--q.serial,kind:'hit',specialFeedback:type,x:point.x,z:point.z,born:owner.clock,
  age:0,duration:type==='intercept'?.23:.36,size,weaponSkinFamily:familyId,weaponSkinWeapon:weaponId};
 q.items.push(f);return f;
}
export function recordTransportFeedback(owner,from,to,radius,familyId,weaponId){
 const q=lane(owner),size=Math.max(.55,Math.min(1.4,radius*1.2));
 if(q.items.length>SPECIAL_FEEDBACK_LIMIT-2)q.items.splice(0,q.items.length-(SPECIAL_FEEDBACK_LIMIT-2));
 add(q,owner,from,'transport-in',size,familyId,weaponId);add(q,owner,to,'transport-out',size,familyId,weaponId);
}
export function recordInterceptionFeedback(owner,source,target){
 const q=lane(owner);
 // Nearby simultaneous erasures share one small contact flash.
 if(q.items.length>=SPECIAL_FEEDBACK_LIMIT-8||q.items.some(f=>f.specialFeedback==='intercept'&&owner.clock-f.born<.06&&Math.hypot(f.x-target.x,f.z-target.z)<.45))return;
 add(q,owner,target,'intercept',.45,source.familyId,source.weaponId);
}
export function sampleSpecialWeaponFeedback(owner){
 const q=lane(owner);
 if(owner.player?.hp<=0||['won','lost'].includes(owner.phase))return [];
 return q.items.map(f=>({...f,age:owner.clock-f.born}));
}
