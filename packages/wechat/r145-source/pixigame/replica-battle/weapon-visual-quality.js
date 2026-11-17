// The captured native renderer owns weapon bodies, beams, trails and timing.
// Pathogenic art is now an optional, restrained impact overlay, not a substitute
// for the native animation/material pipeline. No simulation fields are written.
export const WEAPON_VISUAL_MODE = 'native-motion-with-pathogenic-accents';
export const RESTORED_WEAPON_MODELS = new Set([1000012,1000013,1000014,200249,1000048,1000051,1000031,1000032,1000006,1000043,1000023,1000052,1000036]);
export function restoredSequenceOwnsSprite(modelId,hierarchy,assets){
 return RESTORED_WEAPON_MODELS.has(modelId)&&(assets.originalEffects.effects[modelId]?.sequences||[])
  .some(s=>s.active!==false&&s.frames?.length&&s.hierarchy?.join('/')===hierarchy?.join('/'));
}
export function nativeWeaponBody(){return false;}
// Unity's maximum live-particle count: new births are suppressed while full.
// Replaying accepted lifetimes (rather than truncating the visible list) keeps
// particle age/colour/size continuous when an emitter has a very high rate.
export function admitParticleBirths(births,limit,lifeAt){
 if(!Number.isFinite(limit))return births;
 const deaths=[],accepted=[];for(const birth of [...births].sort((a,b)=>a.at-b.at)){
  for(let i=deaths.length-1;i>=0;i--)if(deaths[i]<=birth.at+1e-9)deaths.splice(i,1);
  if(deaths.length>=Math.max(0,Math.floor(limit)))continue;
  const life=lifeAt(birth);if(!(life>0))continue;accepted.push(birth);deaths.push(birth.at+life);
 }return accepted;
}
export function accentSample(age,duration,frames=1){
 if(!Number.isFinite(age)||age<0||!Number.isFinite(duration)||duration<=0||age>=duration)return null;
 const t=age/duration,position=t*Math.max(0,frames-1),frame=Math.floor(position);
 const smooth=x=>x*x*(3-2*x);
 return {frame,next:Math.min(frames-1,frame+1),mix:position-frame,
  alpha:.32*smooth(Math.min(1,t/.12))*(1-smooth(Math.max(0,(t-.25)/.75))),scale:1+.35*smooth(t)};
}
export function drawWeaponAccent(scene,fx,point,px,objects,live,{owns,texture,key,frames=1,tint=0xffffff}){
 if(!owns||!scene.textures.exists(texture))return false;
 const sample=accentSample(fx.age,Math.min(fx.duration,.55),frames);if(!sample)return false;
 // Local visual footprint, not the damage/collision radius. Bound large native
 // scale values so auxiliary art cannot obscure the original explosion.
 const size=Math.min(px*3,Math.max(px*.35,fx.size*px*1.3))*sample.scale;
 for(let i=0;i<(frames>1?2:1);i++){
  const id=`quality-${key}:${fx.uid}:${i}`;live.add(id);let view=objects.get(id);
  if(!view){view=scene.add.image(0,0,texture).setDepth(41).setTint(tint).setBlendMode(1);objects.set(id,view);}
  view.setPosition(point.x,point.y).setDisplaySize(size,size)
   .setAlpha(sample.alpha*(frames>1?(i?sample.mix:1-sample.mix):1));
  if(frames>1)view.setFrame(i?sample.next:sample.frame);
 }
 // Let the native hit/explosion keep rendering underneath this accent.
 return false;
}
