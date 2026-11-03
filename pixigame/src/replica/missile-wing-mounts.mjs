// Presentation only. Native preparation, release, collision and damage are
// untouched; only stored rocket arrangement and its visual handoff are sampled.
const MODELS=new Set([1000012,1000013,1000014,1000059,200234]);
const rocket=b=>b.owner==='player'&&MODELS.has(b.modelId)&&!b.beam&&!b.dead&&!b.visualHidden;
export class MissileWingMounts {
  constructor(){this.records=new Map();this.run=null;this.clock=-Infinity;this.mounts=null;}
  beginFrame(clock,run,projectiles,mounts){
    const reset=run!==this.run||clock<this.clock;
    if(reset)this.records.clear();
    const dt=reset?0:Math.max(0,clock-this.clock);
    this.run=run;this.clock=clock;
    this.mounts=mounts?.length===2&&mounts.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z))?mounts:null;
    if(!this.mounts){this.records.clear();return;}
    const held=[],waiting=[],ids=new Set();
    for(const b of projectiles)if(rocket(b)&&b.held){held.push(b);ids.add(b.uid);if(!(b.targetUid>0))waiting.push(b);}
    for(const uid of this.records.keys())if(!ids.has(uid))this.records.delete(uid);
    const center={x:(mounts[0].x+mounts[1].x)/2,z:(mounts[0].z+mounts[1].z)/2};
    const span=Math.abs(mounts[1].x-mounts[0].x)/2;
    const scale=held.reduce((max,b)=>Math.max(max,b.scale||1),1);
    const spacing=Math.max(.9,scale*.4),rowSpacing=Math.max(2.4,scale*1.1);
    const blend=1-Math.exp(-32*dt);
    const layout=(index,count)=>{
      const odd=count%2,middle=odd&&index===0,pairIndex=index-odd;
      const pair=Math.floor(pairIndex/2),side=pairIndex%2===0?-1:1;
      return {dx:middle?0:side*(span+(pair%8)*spacing),
        dz:middle?Math.max(1.8,scale*.75):Math.floor(pair/8)*rowSpacing};
    };
    held.sort((a,b)=>a.uid-b.uid);waiting.sort((a,b)=>a.uid-b.uid);
    for(let i=0;i<held.length;i++){
      const b=held[i];
      // A native tick may already have started preparing the first round before
      // its first rendered frame. Give the complete new batch distinct seats.
      if(!this.records.has(b.uid))this.records.set(b.uid,{preparingAt:null,offset:null,...layout(i,held.length),view:{}});
      const record=this.records.get(b.uid);
      record.point={x:center.x+(record.dx??(b.x<center.x?-span:span)),z:center.z+(record.dz??0)};
    }
    for(let i=0;i<waiting.length;i++){
      const record=this.records.get(waiting[i].uid);
      // Mirror pairs across the fuselage. An odd round stays ahead of the nose,
      // rather than adding another rocket to one wing or duplicating ammunition.
      const {dx,dz}=layout(i,waiting.length);
      record.dx=record.dx===null?dx:record.dx+(dx-record.dx)*blend;
      record.dz=record.dz===null?dz:record.dz+(dz-record.dz)*blend;
      record.point={x:center.x+record.dx,z:center.z+record.dz};
    }
  }
  projectile(source){
    const record=this.records.get(source.uid);
    if(!record||!this.mounts||!rocket(source)||!source.held)return source;
    let offsetX=record.point.x-source.x,offsetZ=record.point.z-source.z;
    if(source.targetUid>0){
      if(record.preparingAt===null){record.preparingAt=this.clock;record.offset={x:offsetX,z:offsetZ};}
      const t=Math.min(1,Math.max(0,(this.clock-record.preparingAt)/.3));
      const weight=1-t*t*(3-2*t);
      offsetX=record.offset.x*weight;offsetZ=record.offset.z*weight;
    }else{record.preparingAt=null;record.offset=null;}
    for(const key of Object.keys(record.view))if(!Object.hasOwn(source,key))delete record.view[key];
    Object.assign(record.view,source,{x:source.x+offsetX,z:source.z+offsetZ});
    return record.view;
  }
}
