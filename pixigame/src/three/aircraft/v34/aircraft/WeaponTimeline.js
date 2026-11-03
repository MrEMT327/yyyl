/** Pure simulation clock: no Three.js objects, timers, DOM, or random state.
 * F is a cycling presentation trigger, not ammo/damage/game balance logic.
 */
export class WeaponTimeline {
 constructor(definitions){
  this.channels=definitions.map((spec,index)=>({spec,index,next:Infinity,last:-Infinity,count:0}));
  this.lastTime=null;this.enabled=false;this.started=null;this.serial=0;
 }
 reset(){this.lastTime=null;this.enabled=false;this.started=null;this.serial=0;for(const c of this.channels){c.next=Infinity;c.last=-Infinity;c.count=0;}}
 step(time,{ready=false,firing=false}={}){
  if(!Number.isFinite(time))throw new Error('Weapon timeline requires a finite time');
  if(this.lastTime!==null&&time<this.lastTime-1e-6)this.reset();
  const enabled=Boolean(ready&&firing),events=[];
  if(enabled&&!this.enabled){this.started=time;for(const c of this.channels){c.next=time+Math.max(0,c.spec.offset||0);c.last=-Infinity;}}
  if(!enabled){for(const c of this.channels)c.next=Infinity;}
  if(enabled)for(const c of this.channels){
   const period=Math.max(.08,c.spec.cycle||1.5);
   // At most one recent event per channel after a long seek. Never release a
   // backlog of hundreds of projectiles when a tab resumes after being hidden.
   if(time>=c.next){
    const missed=Math.max(0,Math.floor((time-c.next)/period));const at=c.next+missed*period;
    c.next=at+period;c.last=at;c.count++;events.push({id:++this.serial,index:c.index,time:at,kind:c.spec.kind});
   }
  }
  this.enabled=enabled;this.lastTime=time;return events;
 }
 snapshot(){return {enabled:this.enabled,shots:this.channels.reduce((n,c)=>n+c.count,0),kinds:[...new Set(this.channels.map(c=>c.spec.kind))],byKind:Object.fromEntries([...new Set(this.channels.map(c=>c.spec.kind))].map(k=>[k,this.channels.filter(c=>c.spec.kind===k).reduce((n,c)=>n+c.count,0)]))};}
}
