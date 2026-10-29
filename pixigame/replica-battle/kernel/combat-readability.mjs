// Presentation only. These values never enter simulation or collision data.
export const COMBAT_LAYERS=Object.freeze({area:30,playerShot:32,impact:34,player:37,status:38,text:42,enemyShot:44,warning:47});
export function playerVisibility(clock,invincible,phantom=false){
  return (invincible>0?.76+.24*Math.abs(Math.sin(clock*8)):1)*(phantom?.68:1);
}
export function damageTextPose(fx){
  const t=Math.max(0,Math.min(1,fx.duration>0?fx.age/fx.duration:1));
  const hurt=String(fx.value??'').startsWith('−'),strong=hurt||fx.critical;
  const lane=((fx.uid%5)+5)%5-2;
  const spacing=Math.max(44,Math.min(72,String(fx.value??'').length*9+10));
  return {x:lane*spacing,y:-8-(Math.floor(fx.uid/5)%3)*24-t*36,
    alpha:(strong?1:.78)*Math.pow(1-t,.8),fontSize:hurt?21:fx.critical?21:15,
    color:hurt?'#ff7277':fx.critical?'#ffed91':'#d9e4e8',depth:COMBAT_LAYERS.text};
}
// Decide once per event, so throttled sparks cannot appear late on another frame.
// Explosions, warning cues, status effects and damage numbers are never throttled.
const CONTACT_MODELS=new Set([0,110001,110008,210001,210012,210013,210014,210047,210050,210062,110030,110039,120006,210048,220029,210049,210065,210051,210035]);
export class HitSparkAdmission {
  constructor(){this.events=new Map();this.cells=new Map();this.clock=-Infinity;}
  beginFrame(clock){
    if(clock<this.clock)this.reset();this.clock=clock;
    for(const [id,e]of this.events)if(clock>e.until)this.events.delete(id);
    for(const [key,at]of this.cells)if(clock-at>.2)this.cells.delete(key);
  }
  accepts(fx,point){
    if(fx.kind!=='hit'||!CONTACT_MODELS.has(fx.modelId??0))return true;
    const known=this.events.get(fx.uid);if(known)return known.allowed;
    const key=`${fx.modelId??0}:${Math.floor(point.x/36)}:${Math.floor(point.y/36)}`;
    const allowed=this.clock-(this.cells.get(key)??-Infinity)>=.065;
    if(allowed)this.cells.set(key,this.clock);
    this.events.set(fx.uid,{allowed,until:this.clock+Math.max(0,(fx.duration??0)-(fx.age??0))+.2});
    return allowed;
  }
  reset(){this.events.clear();this.cells.clear();this.clock=-Infinity;}
}
// Keep all emitter transforms that living particles can still sample, plus the
// preceding sample for exact interpolation at the retained boundary.
export function trimEmitterHistory(history,age,properties){
  const speed=properties.speed_scale??1;
  if(!(speed>0))return;
  const horizon=((properties.lifetime??1)+(properties.trail_lifetime??.3))/speed+.1;
  const boundary=age-horizon;let remove=0;
  while(remove+1<history.length&&history[remove+1].age<boundary)remove++;
  if(remove)history.splice(0,remove);
}
export class VisualMeshPool {
  constructor(limit=128){this.limit=limit;this.free=[];this.created=0;this.reused=0;}
  acquire(create){if(this.free.length){this.reused++;return this.free.pop();}this.created++;return create();}
  release(view){view.setVisible(false);if(this.free.length<this.limit)this.free.push(view);else view.destroy();}
  clear(){for(const v of this.free)v.destroy();this.free.length=0;}
}
