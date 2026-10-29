// Source values: supplied Pathogenic scripts.json and resources.json.
// The simulation uses original world units. Only the camera scales the image.
export const ORIGINAL_WEAPONS = Object.freeze({
  twin: Object.freeze({ original:'assault_rifle', name:'脉冲腺', interval:1.3, damage:35,
    speed:4500, life:.9, radius:13, mass:.2, restitution:1, bounces:0,
    spread:2, segments:16, segmentLength:10, recoil:8 }),
  rail: Object.freeze({ original:'sniper', name:'高压棘刺', interval:2.5, damage:140,
    speed:6000, life:1.7, radius:48, mass:30, restitution:0, bounces:1,
    spread:0, segments:16, segmentLength:16, recoil:100 }),
});
export const PHYSICS_STEP=1/60;
const length=v=>Math.hypot(v.x,v.y);
const unit=v=>{const d=length(v);return d?{x:v.x/d,y:v.y/d}:{x:0,y:0};};
export const hitChargeGain=r=>(1+.8*r)/(10-r);
export const hitChargeDecay=r=>1/(1+.8*r);
export const homingPower=(r,charge)=>110*(1+.6*r+charge*(.5+.25*r));
export function weaponStats(id,rarity,charge=0){
  const p=ORIGINAL_WEAPONS[id];
  return {...p,shots:id==='twin'?3+rarity+Math.round(charge*(1+Math.ceil(rarity/3))):1,
    damage:p.damage*(1+rarity*(id==='twin'?.15:.4)),
    interval:id==='twin'?p.interval:p.interval*Math.max(.1,1-.1*rarity)/(1+.3*charge)};
}
export function applyOriginalHoming(b,target,rarity,charge,multiplier=1){
  const power=homingPower(rarity,charge)*multiplier,drag=Math.max(.9,1.01-.01*power/40),dir=unit({x:target.x-b.x,y:target.y-b.y});
  const impulse=power*1.6*Math.min(6,b.mass)/b.mass;
  b.vx=b.vx*drag+dir.x*impulse;b.vy=b.vy*drag+dir.y*impulse;
}
// Circular target fixture with the source material coefficients and masses.
// This does not substitute an elastic reflection for num_bounces.
export function collideBodies(b,t,nx,ny){
  const invB=1/b.mass,invT=t.static?0:1/t.mass;
  const approach=(b.vx-(t.vx||0))*nx+(b.vy-(t.vy||0))*ny;
  if(approach>=0)return;
  const restitution=Math.min(1,b.restitution+(t.restitution||0));
  const impulse=-(1+restitution)*approach/(invB+invT);
  b.vx+=impulse*nx*invB;b.vy+=impulse*ny*invB;
  if(!t.static){t.vx=(t.vx||0)-impulse*nx*invT;t.vy=(t.vy||0)-impulse*ny*invT;}
}
