// Scheduled radial hits use simulation time, not timers. Each blast samples
// living targets once; derived blasts cannot call back into this scheduler.
export function createFixedBlasts(derived) {
 let pending=[],visible=[];const fired=new Map();
 return {
  add(source,{key,x,y,radius,damage,at,root=false,color=0x98ffad}){
   if(source?.kind!=='root'||fired.has(`${source.projectileId}/${key}`))return false;
   fired.set(`${source.projectileId}/${key}`,at);
   pending.push({source,key,x,y,radius,damage,at,root,color});return true;
  },
  step(time,targets){
   const events=[];
   for(const b of pending.filter(b=>b.at<=time+1e-9)){
    visible.push({...b,until:time+.32});const seen=new Set();
    for(const t of targets){if(t.dead||seen.has(t.id)||Math.hypot(t.x-b.x,t.y-b.y)>b.radius+(t.radius||0))continue;seen.add(t.id);
     if(b.root)events.push({source:{...b.source,contactId:'explosion'},targetId:t.id,damage:b.damage,rootBlast:true,x:b.x,y:b.y});
     else {const e=derived.create(b.source,b.key,t.id,b.damage,b.damage,time);if(e)events.push({...e,targetId:t.id});}
    }
   }
   pending=pending.filter(b=>b.at>time+1e-9);visible=visible.filter(b=>b.until>time);
   for(const [key,at] of fired)if(time-at>5)fired.delete(key);
   return events;
  },
  visuals(time){return visible.map(b=>({...b,alpha:(b.until-time)/.32}));},
  clear(){pending=[];visible=[];fired.clear();},
 };
}
