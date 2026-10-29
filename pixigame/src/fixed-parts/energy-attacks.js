import { segmentCircleHit } from './runtime.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const direction=a=>({x:Math.sin(a),y:-Math.cos(a)});
const forward=(p,a,d)=>{const v=direction(a);return{x:p.x+v.x*d,y:p.y+v.y*d};};
const nearest=(p,targets,range,exclude=new Set())=>targets.filter(t=>!t.dead&&!exclude.has(t.id)&&distance(p,t)<=range).sort((a,b)=>distance(p,a)-distance(p,b));

// Original homing's Beam-specific path builder; this is not projectile steering.
export function traceEnergyPath(origin,angle,range,targets,power=0,scale=1,width=0){
 let p={...origin},v=direction(angle),points=[p],hit=[],seen=new Set();v={x:v.x*400*scale,y:v.y*400*scale};
 const count=power?Math.min(50,Math.floor(range/scale/50)):1;
 for(let i=0;i<count;i++){
  if(power){const t=nearest(p,targets.slice(0,50),Infinity,seen)[0];if(t){const d=distance(p,t)||1;v.x=(v.x+(t.x-p.x)/d*power/4*scale)*.8;v.y=(v.y+(t.y-p.y)/d*power/4*scale)*.8;}}
  const next=power?{x:p.x+v.x,y:p.y+v.y}:forward(p,angle,range);
  const contacts=targets.filter(t=>!t.dead&&!seen.has(t.id)).map(t=>({t,f:segmentCircleHit(p.x,p.y,next.x,next.y,t.x,t.y,(t.radius||0)+(power?0:width/2))})).filter(c=>c.f!==null).sort((a,b)=>a.f-b.f);
  for(const c of power?contacts.slice(0,1):contacts){seen.add(c.t.id);hit.push({targetId:c.t.id,x:p.x+(next.x-p.x)*c.f,y:p.y+(next.y-p.y)*c.f,distance:distance(origin,c.t)});}
  points.push(next);p=next;
 }
 return {points,hit};
}

export function createEnergyAttacks({derived,random=Math.random,onEmit=()=>{}}){
 let beams=[],links=[],zones=[],serial=0;
 const shots=new Map(),rounds=new Map(),focus=new Map(),charge=new Map(),powered=new Map(),lastPoints=new Map();
 function addBeam(shot,origin,angle,time,{module=null,range=shot.range,damage=shot.damage,power=0,depth=0,tree={count:0},fork=false}={}){
  if(beams.length>=80||tree.count>=12||depth>3)return null;tree.count++;
  const source=fork?{...shot.source,projectileId:`${shot.source.projectileId}/fork-${++serial}`,nativeFork:true}:shot.source;
  const life=shot.itemId==='prism'?.4:.6;
  const beam={shot,source,origin:{...origin},angle,range,damage,power,module,depth,tree,start:time,hitAt:time+2/60,until:time+life,settled:false,points:null};
  beams.push(beam);shots.set(source.projectileId,{shot,until:time+5});return beam;
 }
 function derivedHit(source,module,targetId,damage,time,point){
  const e=derived.create(source,module,targetId,damage,damage,time);return e?{...e,targetId,...point}:null;
 }
 function link(source,module,from,target,damage,at,liveTargets){
  links.push({source,module,from:{x:from.x,y:from.y},targetId:target.id,to:{x:target.x,y:target.y},damage,at,until:at+.22,settled:false});
 }
 function rootDamage(b,contact,index){
  if(b.shot.itemId!=='prism')return b.damage;
  const key=`${b.source.groupId}/${contact.targetId}`;
  if(!powered.has(key)){
   const f=focus.get(`${b.source.weaponId}/${contact.targetId}`);
   powered.set(key,{active:!!(b.shot.a1&&f?.count>=2&&f.round===b.shot.round-1),until:b.start+5});
  }
  return b.damage*(powered.get(key).active?(b.shot.a2?1.8:1.3):1)*(b.shot.a2?1+Math.min(.6,index*.15):1);
 }
 function makeZigzag(points,scale){
  const result=[points[0]];
  for(let k=1;k<points.length;k++){
   const a=points[k-1],b=points[k],d=distance(a,b),n=Math.max(1,Math.floor(d/(200*scale))),step=d/n,angle=Math.atan2(b.x-a.x,a.y-b.y);
   for(let i=0;i<n-1;i++)result.push(forward(forward(a,angle,step*i),angle+(random()*2-1)*Math.PI/8,step*(.5+random())));
   result.push(b);
  }return result;
 }
 return {
  launch(shot,origin,angle,time,power=0){
   addBeam(shot,origin,angle,time,{power});
   if(shot.itemId==='prism'&&shot.b1){
    const angles=shot.b2?[-20,-10,10,20]:[-10,10];
    angles.forEach((offset,i)=>addBeam(shot,origin,angle+offset*Math.PI/180,time+(shot.b2?i*.08:0),{module:`energy-prism-fan/${shot.slotId}/${i}`,damage:shot.damage*.35}));
   }
  },
  step(time,targets){
   const events=[];
   // A fixed snapshot prevents a newly scheduled child from firing recursively
   // during its parent's step; every child has a positive delay as well.
   for(const b of [...beams]){
    if(time<b.start)continue;
    if(!b.points){const path=traceEnergyPath(b.origin,b.angle,b.range,targets,b.power,b.shot.height/4600,b.shot.hitWidth);b.points=path.points;
     if(b.shot.itemId==='tesla'&&!b.power){
      b.points=makeZigzag(path.points,b.shot.height/4600);
      if(!b.module&&b.shot.splitChance&&b.depth<3){
       let chance=b.shot.splitChance;const n=Math.max(1,Math.floor(b.range/(200*b.shot.height/4600)));
       for(let i=0;i<n-1;i++)if(random()<chance){chance*=.7;const offset=b.range*i/n;
        const child={...b.shot,source:b.source,splitChance:chance};
        addBeam(child,b.points[i+1],b.angle+(random()*2-1)*Math.PI/2,b.start+.08+random()*.17,{range:b.range-offset,damage:b.damage,depth:b.depth+1,tree:b.tree,fork:true});
       }
      }
     }
    }
    if(b.settled||time+1e-9<b.hitAt)continue;b.settled=true;
    const path=traceEnergyPath(b.origin,b.angle,b.range,targets,b.power,b.shot.height/4600,b.shot.hitWidth);
    // Guided collision follows exactly the line shown at its hit frame.
    if(b.power)b.points=path.points;
    if(!b.module)onEmit(b.source);
    path.hit.forEach((contact,i)=>{
     const damage=b.module?b.damage:rootDamage(b,contact,i);
     const e=b.module?derivedHit(b.source,b.module,contact.targetId,damage,time,contact)
      :{source:{...b.source,contactId:'beam'},...contact,damage,rootBeam:true,angle:b.angle};
     if(e)events.push(e);
    });
   }
   for(const l of links){if(l.settled||time+1e-9<l.at)continue;l.settled=true;
    const target=targets.find(t=>t.id===l.targetId&&!t.dead);if(!target)continue;
    l.to={x:target.x,y:target.y};const e=derivedHit(l.source,l.module,l.targetId,l.damage,time,l.to);if(e)events.push(e);
   }
   for(const z of zones)if(time<=z.until){
    for(const t of targets){if(t.dead||z.seen.has(t.id))continue;
     if(segmentCircleHit(z.a.x,z.a.y,z.b.x,z.b.y,t.x,t.y,(t.radius||0)+z.width/2)===null)continue;
     z.seen.add(t.id);const e=derivedHit(z.source,z.module,t.id,z.damage,time,t);if(e)events.push(e);
    }
   }
   beams=beams.filter(b=>time<b.until);links=links.filter(l=>time<l.until);zones=zones.filter(z=>time<z.until);
   for(const map of [shots,powered,rounds])for(const [key,v] of map)if(time>v.until)map.delete(key);
   for(const map of [focus,charge])for(const [key,v] of map)if(time-v.time>5||!targets.some(t=>key.endsWith(`/${t.id}`)))map.delete(key);
   return events;
  },
  onHit(source,targetId,details,time,targets){
   const shot=shots.get(source.projectileId)?.shot;
   if(!shot||source.nativeFork)return [];
   const events=[],key=`${source.weaponId}/${targetId}`,p={x:details.x,y:details.y},h=shot.height,damage=shot.damage;
   if(shot.itemId==='prism'){
    const f=focus.get(key);if(f?.groupId!==source.groupId)focus.set(key,{groupId:source.groupId,round:shot.round,time,count:powered.get(`${source.groupId}/${targetId}`)?.active?0:f?.round===shot.round-1?f.count+1:1});
   }
   if(shot.itemId==='tesla'&&shot.b1){
    let c=charge.get(key);if(!c)c={hits:[],groupId:null,time};
    if(c.groupId!==source.groupId){c.hits=c.hits.filter(at=>time-at<=3);c.hits.push(time);c.groupId=source.groupId;c.time=time;charge.set(key,c);
     if(c.hits.length>=(shot.b2?2:3)){c.hits=[];const e=derivedHit(source,'energy-tesla-discharge',targetId,damage*.8,time,p);if(e)events.push(e);
      if(shot.b2)for(let i=0;i<4;i++)addBeam(shot,p,i*Math.PI/2,time,{module:'energy-tesla-burst',range:h*.15,damage:damage*.4});
     }
    }
   }
   const roundKey=source.groupId;if(rounds.has(roundKey))return events;rounds.set(roundKey,{until:time+5});
   if(shot.itemId==='prism'&&shot.c1){
    const side=nearest(p,targets,h*.18,new Set([targetId])).slice(0,shot.c2?2:1);
    for(const t of side)link(source,'energy-prism-refract',p,t,damage*.3,time+.04);
    if(!side.length&&shot.c2)link(source,'energy-prism-solitary',p,{id:targetId,...p},damage*.2,time+.04);
   }
   if(shot.itemId==='tesla'&&shot.a1){
    const seen=new Set([targetId]),chain=[{id:targetId,...p}];let last=p;
    for(let i=0;i<(shot.a2?4:2);i++){const t=nearest(last,targets,h*.16,seen)[0];if(!t)break;seen.add(t.id);chain.push(t);
     link(source,'energy-tesla-chain',last,t,damage*.5**(i+1),time+.05*(i+1));last=t;
    }
    if(shot.a2)chain.reverse().forEach((t,i)=>link(source,'energy-tesla-return',i?chain[i-1]:last,t,damage*.2,time+.25+i*.05));
   }
   if(shot.itemId==='tesla'&&shot.c1){
    const previous=lastPoints.get(source.weaponId),circuit=shot.c2&&previous&&time-previous.time<=3&&distance(previous,p)<=h*.6;
    const a=circuit?previous:p,b=shot.c2?p:forward(p,details.angle||0,h*.12),module=shot.c2?'energy-tesla-circuit':'energy-tesla-trail';
    const seen=new Set(targets.filter(t=>segmentCircleHit(a.x,a.y,b.x,b.y,t.x,t.y,(t.radius||0)+3)!==null).map(t=>t.id));
    const z={source,module,a:{x:a.x,y:a.y},b:{x:b.x,y:b.y},damage:damage*(shot.c2?.4:.25),until:time+(shot.c2?1.6:.8),seen,width:6};
    zones.push(z);lastPoints.set(source.weaponId,{...p,time});
    const same=zones.filter(z=>z.source.weaponId===source.weaponId);if(same.length>2)zones=zones.filter(z=>!same.slice(0,-2).includes(z));
   }
   return events;
  },
  visuals(time){
   return [...beams.filter(b=>b.points&&time>=b.start).map(b=>({points:b.points,width:b.shot.width*(b.module?.includes('fan')?.6:1)*Math.min(1,(time-b.start)/(b.shot.itemId==='prism'?.2:.1)),
    color:b.power?0xb988ff:b.shot.itemId==='prism'?0xffb766:0x8bcfff,alpha:Math.max(0,Math.min(1,(b.until-time)/(b.shot.itemId==='prism'?.2:.5))),kind:b.shot.itemId,source:b.source})),
    ...links.filter(l=>time>=l.at).map(l=>({points:[l.from,l.to],width:3,color:0xb8ddff,alpha:Math.max(0,(l.until-time)/.22),kind:'link',source:l.source})),
    ...zones.map(z=>({points:[z.a,z.b],width:z.width,color:0x6dbeff,alpha:Math.min(.7,(z.until-time)*2),kind:'circuit',source:z.source}))];
  },
  counts(){return{beams:beams.length,links:links.length,zones:zones.length};},
  clear(){beams=[];links=[];zones=[];for(const m of [shots,rounds,focus,charge,powered,lastPoints])m.clear();},
 };
}
