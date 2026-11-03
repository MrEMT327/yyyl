import {damageTextPresentation} from './combat-hit-presentation.mjs';
// Presentation only. These values never enter simulation or collision data.
export const COMBAT_LAYERS=Object.freeze({area:30,playerShot:32,impact:34,player:37,status:38,text:42,enemyShot:44,warning:47});
export function playerVisibility(clock,invincible,phantom=false){
  return (invincible>0?.76+.24*Math.abs(Math.sin(clock*8)):1)*(phantom?.68:1);
}
export function damageTextPose(fx){return damageTextPresentation(fx);}
// Decide once at birth. Rejected contacts never appear later in their life.
// Two different contact families may share a small area; later decorative
// contacts wait for a new real hit. Explosions and essential cues are untouched.
const CONTACT_MODELS=new Set([0,110001,110008,110011,120001,210001,210012,210013,210014,210047,210050,210059,210060,210062,110030,110039,120006,210048,220029,210049,210065,210051,210035,220022]);
const COLD_CONTACTS=new Set([210035,210051,220022]),ACID_CONTACTS=new Set([210049,210065]),ELECTRIC_CONTACTS=new Set([110030,110039,120006,210047,210048,210062,220029]);
const contactFamily=id=>COLD_CONTACTS.has(id)?'cold':ACID_CONTACTS.has(id)?'acid':ELECTRIC_CONTACTS.has(id)?'electric':'metal';
const SPARK_RADIUS=32,SPARK_INTERVAL=.065;
export class HitSparkAdmission {
  constructor(){this.events=new Map();this.cells=new Map();this.clock=-Infinity;}
  beginFrame(clock){
    if(clock<this.clock)this.reset();this.clock=clock;
    for(const [id,e]of this.events)if(clock>e.until)this.events.delete(id);
    for(const [key,rows]of this.cells){const live=rows.filter(r=>clock-r.at<=SPARK_INTERVAL);if(live.length)this.cells.set(key,live);else this.cells.delete(key);}
  }
  accepts(fx,point){
    if(fx.kind!=='hit'||!CONTACT_MODELS.has(fx.modelId??0))return true;
    const known=this.events.get(fx.uid);if(known)return known.allowed;
    const valid=Number.isFinite(point.x)&&Number.isFinite(point.y),family=contactFamily(fx.modelId??0);
    const cx=Math.floor(point.x/SPARK_RADIUS),cy=Math.floor(point.y/SPARK_RADIUS);let nearby=0,same=false;
    if(valid)for(let x=cx-1;x<=cx+1;x++)for(let y=cy-1;y<=cy+1;y++)for(const row of this.cells.get(x+':'+y)||[]){
      if(this.clock-row.at<SPARK_INTERVAL&&(row.x-point.x)**2+(row.y-point.y)**2<=SPARK_RADIUS**2){nearby++;if(row.family===family)same=true;}
    }
    const allowed=valid&&!same&&nearby<2;
    if(allowed){const key=cx+':'+cy,rows=this.cells.get(key)||[];rows.push({at:this.clock,x:point.x,y:point.y,family});this.cells.set(key,rows);}
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
