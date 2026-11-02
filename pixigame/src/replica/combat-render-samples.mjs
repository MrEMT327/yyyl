// Display samples only. Never feeds movement, collision, RNG or event dispatch.
const STEP=2184/65536,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const MOVING=new Set(['MoveStraight','MoveSnake','MoveDiffusion']);
export class CombatRenderSamples {
  constructor(){this.run=null;this.clock=null;this.phase=null;this.time=0;this.alpha=1;this.revision=0;this.records=new WeakMap();}
  beginFrame(clock,run,phase,delta){
    const reset=this.run!==run||this.clock===null||clock<this.clock||clock-this.clock>.25;
    if(reset){this.records=new WeakMap();this.time=clock;this.alpha=1;}
    else if(phase==='playing')this.time=Math.min(clock,Math.max(this.time,clock-STEP)+clamp(Number.isFinite(delta)?delta:0,0,.1));
    if(reset||clock!==this.clock||phase!==this.phase)this.revision++;
    this.run=run;this.clock=clock;this.phase=phase;this.alpha=clamp(1-(clock-this.time)/STEP,0,1);
    return this.time;
  }
  age(value){return value<0?value:Math.max(0,value-Math.max(0,this.clock-this.time));}
  record(source){
    let record=this.records.get(source);
    if(!record){record={revision:-1,view:{},point:null};this.records.set(source,record);}
    if(record.revision!==this.revision){
      // Optional fields can disappear at a native state transition.
      for(const key of Object.keys(record.view))if(!Object.hasOwn(source,key))delete record.view[key];
      Object.assign(record.view,source);record.revision=this.revision;
    }
    return record;
  }
  projectile(source,defaultFamily){
    const moving=!source.dead&&!source.visualHidden&&!source.beam&&!source.held&&!source.fixedSegments
      &&!(source.reflections>0)&&!(source.bounce>0)&&(!source.trajectory||MOVING.has(source.trajectory))
      &&[source.x,source.z,source.oldX,source.oldZ].every(Number.isFinite);
    const family=source.owner==='player'&&!source.familyId?defaultFamily:source.familyId;
    if(!moving&&family===source.familyId)return source;
    const view=this.record(source).view;
    view.x=moving?source.oldX+(source.x-source.oldX)*this.alpha:source.x;
    view.z=moving?source.oldZ+(source.z-source.oldZ)*this.alpha:source.z;
    view.familyId=family;
    return view;
  }
  pickup(source){
    const record=this.record(source),last=record.point;
    if(!last||last.clock!==this.clock){
      const dt=last?this.clock-last.clock:0;
      const continuous=last&&dt>0&&dt<STEP*1.5&&last.state===source.state&&source.age>=source.delay
        &&Math.hypot(source.x-last.x,source.z-last.z)<=Math.max(8,(source.speed||0)*dt*1.5);
      record.from=continuous?{x:last.x,z:last.z}:{x:source.x,z:source.z};
      record.point={clock:this.clock,x:source.x,z:source.z,state:source.state};
    }
    const view=record.view;
    view.x=record.from.x+(source.x-record.from.x)*this.alpha;
    view.z=record.from.z+(source.z-record.from.z)*this.alpha;
    view.age=this.age(source.age);
    return view;
  }
}

// One authoritative status snapshot per rendered frame, shared by every enemy.
export class CombatStatusIndex {
  constructor(){this.frozen=new Set();this.targets=new Map();this.visuals=[];}
  update(sim){
    this.frozen.clear();this.targets.clear();this.visuals=sim.activeBuffVisuals;
    for(const buff of this.visuals)if(buff.modelId===170001||buff.modelId===170012)this.frozen.add(buff.targetUid);
    if(this.visuals.length)for(const enemy of sim.enemies)if(!enemy.dead&&!Number.isNaN(enemy.uid)&&!this.targets.has(enemy.uid))this.targets.set(enemy.uid,enemy);
    return this;
  }
}
