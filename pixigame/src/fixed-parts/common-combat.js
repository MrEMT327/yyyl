import { COMMON_WEAPONS, commonWeaponStats } from './common-weapons.js';
import { createAirframeGrowth } from './airframe-growth.js';
import { movingCircleHitTime, movingCapsuleHitTime } from '../combat-collision.js';
import { commonCannonShape } from './common-cannon-shape.js';

const TAU=Math.PI*2, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const DRONE_LIMIT=12, DRONE_OVERFLOW_MAX=10, DRONE_OVERFLOW_DAMAGE=.05;
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const aim=(a,b)=>Math.atan2(b.x-a.x,a.y-b.y);
const point=(p,a,r)=>({x:p.x+Math.sin(a)*r,y:p.y-Math.cos(a)*r});
function segmentDistance(a,b,p){const x=b.x-a.x,y=b.y-a.y,t=clamp(((p.x-a.x)*x+(p.y-a.y)*y)/(x*x+y*y||1),0,1);return Math.hypot(p.x-a.x-x*t,p.y-a.y-y*t);}
let runs=0;

export function createCommonCombat(loadout,{random=Math.random}={}){
  const runId=`common-${++runs}`,growth=createAirframeGrowth(loadout,runId,Math.floor(random()*0xffffffff));
  const state={runId,time:0,groups:0,shots:0,hits:0,damage:0,kills:0,pulses:0,effects:{},focus:{},charge:{},
    byWeapon:Object.fromEntries(loadout.weapons.map(w=>[w.id,{hits:0,damage:0,kills:0}]))};
  let world={origin:{x:300,y:1000},height:1300,width:600,top:0,targets:[],hostiles:[]},velocity={x:0,y:0},lastOrigin=null;
  let events=[],fx=[],projectiles=[],fields=[],drones=[],jobs=[],disposed=false,seq=0,speedUntil=0;
  const receipts=new Map(),statuses=new Map(),dead=new Set();
  const clocks=loadout.weapons.map(w=>({weapon:w,next:0,round:0,held:0,lock:null,stacks:0,lockTime:0,retainUntil:0,nextMove:0,lastAngle:null,cloudAt:0}));
  const now=()=>state.time,s=()=>world.height/1300,uid=()=>`${runId}/${++seq}`;
  const aircraftAbilities=loadout.statModifiers?.aircraftAbilities||[];
  const directSkill=aircraftAbilities.map(x=>x.ability).filter(a=>a?.type==='minimum-direct-shots').sort((a,b)=>b.minimumShots-a.minimumShots||b.damageRatio-a.damageRatio)[0];
  const sideSkill=aircraftAbilities.map(x=>x.ability).find(a=>a?.type==='side-shot');
  const carrier=clocks.find(c=>c.weapon.innate)||clocks[0];
  const skillMissiles=aircraftAbilities.filter(x=>x.ability?.type==='missile').map(x=>({...x,next:x.ability.interval}));
  state.aircraftSkillCasts={};
  function forwardProjectiles(q,p,options={}) {
    const count=directSkill?.minimumShots||1;
    if(count<=1){addProjectile(q,p,0,options);return;}
    for(let i=0;i<count;i++)addProjectile({...q,damage:q.damage*directSkill.damageRatio},
      {x:p.x+(i-(count-1)/2)*9*s(),y:p.y},(i-(count-1)/2)*directSkill.spread,options);
  }
  function aircraftSideShots(q,p) {
    if(!sideSkill||q.weaponId!==carrier?.weapon.id)return;
    const stats=commonWeaponStats({...carrier.weapon,itemId:'aux_sidegun',level:1,qualityRank:0},[]);
    const shot={...q,...stats,weaponId:q.weaponId,itemId:'aux_sidegun',groupId:q.groupId+'/side-skill',rank:0,damage:q.damage*sideSkill.damage};
    for(const side of [-1,1]){muzzle(shot,{x:p.x+side*18*s(),y:p.y});addProjectile(shot,p,side*Math.PI/2,{pierce:2,side,secondary:true});}
  }
  function stepAircraftMissiles(firing) {
    if(!carrier)return;
    for(const entry of skillMissiles) {
      const a=entry.ability;
      if(!firing){entry.next=now()+a.interval;continue;}
      if(now()+1e-9<entry.next)continue;
      entry.next=now()+a.interval;
      const base=commonWeaponStats({...carrier.weapon,itemId:'aux_rocket',level:1,qualityRank:0},[]);
      const q={...base,weaponId:carrier.weapon.id,itemId:'aux_rocket',groupId:`${runId}/aircraft-${entry.id}-${++state.groups}`,rank:0,round:0,held:0,overload:false,damage:a.damage,radius:a.explosionRadius};
      muzzle(q,world.origin);state.shots++;state.aircraftSkillCasts[entry.id]=(state.aircraftSkillCasts[entry.id]||0)+1;
      for(let i=0;i<a.count;i++)addProjectile(q,{x:world.origin.x+(i-(a.count-1)/2)*13*s(),y:world.origin.y-18*s()},(i-(a.count-1)/2)*.16,{homing:true,main:true});
    }
  }

  const living=()=>world.targets.filter(t=>!t.dead&&!dead.has(t.id));
  const nearest=(p,{exclude,range=Infinity,front=false}={})=>{
    let best, distance=Infinity;
    for(const t of world.targets){
      if(t.dead||dead.has(t.id)||exclude?.has(t.id)||(front&&t.y>world.origin.y))continue;
      const dx=p.x-t.x,dy=p.y-t.y,d=dx*dx+dy*dy,limit=range+(t.radius||0);
      if(limit<0||d>limit*limit)continue;
      if(d<distance||d===distance&&(!best||String(t.id).localeCompare(String(best.id))<0)){best=t;distance=d;}
    }return best;
  };
  const emptyNodes=[];
  const stats=c=>{
    const nodes=growth.state.nodes[c.weapon.id]||emptyNodes,w=c.weapon;
    if(c.statsVersion!==growth.state.buildVersion||c.statsNodes!==nodes||c.statsLength!==nodes.length
      ||c.statsItem!==w.itemId||c.statsLevel!==w.level||c.statsQuality!==w.qualityRank){
      c.statsValue=commonWeaponStats(w,nodes);c.statsVersion=growth.state.buildVersion;
      c.statsNodes=nodes;c.statsLength=nodes.length;c.statsItem=w.itemId;c.statsLevel=w.level;c.statsQuality=w.qualityRank;
    }return c.statsValue;
  };
  const status=t=>{if(!statuses.has(t.id))statuses.set(t.id,{freeze:0,frozenUntil:0});return statuses.get(t.id);};
  function trace(points,color,width=3,life=.2,extra={}){
    const v={id:uid(),common:true,kind:'beam',points,color,highlight:color,width,alpha:1,start:now(),until:now()+life,...extra};fx.push(v);return v;
  }
  function glyph(p,r,color,shape,extra={}){return {id:extra.id||uid(),kind:'glyph',points:[{...p}],x:p.x,y:p.y,radius:r,color,alpha:1,shape,...extra};}
  const style=q=>({common:true,mechanic:q.mechanic,rank:q.rank,color:q.color,highlight:q.highlight,shadow:q.shadow,unit:s()});
  function effect(q,p,shape,r=12*s(),life=.2,extra={}){
    if(extra.id)fx=fx.filter(v=>v.id!==extra.id);
    return trace([{...p}],q.color,1,life,{...glyph(p,r,q.color,shape),...style(q),...extra});
  }
  function corner(q,b){effect(q,b.p,'corner',15*s(),.2,{angle:b.angle,from:b.prev});}
  function arc(q,a,b,color,width=3,life=.2){
    // Preserve the established simulation random stream; GPU noise animates
    // the arc and no longer generates a CPU polyline from these samples.
    for(let i=0;i<7;i++)random();
    effect(q,a,'lightning',width*8,life,{end:{...b},color,secondary:color===q.shadow});
  }
  function source(q,key=uid()){return {runId,groupId:q.groupId,weaponId:q.weaponId,projectileId:key,kind:'root',depth:0};}
  function hit(q,t,damage=q.damage,meta={}){
    if(!t||dead.has(t.id)||t.dead)return;
    const impact=meta.impact||t;
    const st=status(t),src=source(q),bonus=st.frozenUntil>now()&&st.freezeShot?.rank>=3?1.15:1;
    const e={rootBeam:true,source:src,targetId:t.id,x:impact.x,y:impact.y,damage:damage*bonus,distance:dist(world.origin,t),angle:aim(world.origin,t),presentation:{hit:true,death:st.frozenUntil>now()&&st.freezeShot?.rank>=4,mechanic:q.mechanic,angle:meta.projectile?.angle??aim(world.origin,t)}};
    receipts.set(src.projectileId,{q,t:{...t},meta,event:e,at:now(),accepted:false,resolved:false});events.push(e);
    effect(q,impact,'hit',8*s(),.16,{angle:meta.projectile?.angle??e.angle});
    if(st.frozenUntil>now()&&st.freezeShot?.rank>=3)effect(st.freezeShot,t,'ice-flash',(t.radius||16)+6*s(),.12);
  }
  function explosion(q,p,r,damage=q.damage,meta={}){
    effect(q,p,meta.shatter?'shatter':meta.discharge?'discharge':meta.slash?'ring-slash':'blast',r,.38);
    const ids=new Set();for(const t of living())if(dist(p,t)<=r+(t.radius||0)){ids.add(t.id);hit(q,t,damage,meta);}return ids;
  }
  function beam(q,a,b,width,damage=q.damage,meta={},color=q.color){
    const pulse=q.mechanic==='laser',gain=meta.secondary?.55:1,drawWidth=width*(meta.side?.65:1);
    trace([a,b],color,drawWidth,pulse?.055:.13,{...style(q),color,collisionWidth:width,alpha:gain,visualEvent:meta.side?'side-pulse':'pulse'});
    const ids=new Set();for(const t of living())if(segmentDistance(a,b,t)<=width/2+(t.radius||0)){ids.add(t.id);hit(q,t,damage,meta);}return ids;
  }
  function schedule(delay,fn){jobs.push({at:now()+delay,fn});}
  function addProjectile(q,p,angle,options={}){
    const b={id:uid(),q,p:{...p},prev:{...p},origin:{...p},angle,speed:q.speed*s(),radius:q.radius*s()*q.width,life:q.life,age:0,
      seen:new Set(),ticks:new Map(),contacts:0,bounces:0,trail:[],...options};projectiles.push(b);return b;
  }
  function addField(q,p,type,options={}){
    if(type==='toxin'){
      const overlapping=fields.filter(f=>f.type==='toxin'&&f.q.weaponId===q.weaponId&&dist(p,f.p)<Math.min(f.radius,options.radius||COMMON_WEAPONS.aux_toxin.radius*s())*.6);
      if(overlapping.length>=(q.rank>=3?3:1)){const oldest=overlapping[0];fields=fields.filter(f=>f!==oldest);}
    }
    const f={id:uid(),q,p:{...p},type,age:0,life:3,radius:55*s()*q.width,next:now(),seen:new Set(),...options};fields.push(f);return f;
  }
  function muzzle(q,p,extra={}){effect(q,p,'muzzle',8*s(),.085,extra);}
  function reflect(q,b,p){
    b.blocked=true;events.push({control:true,hostileId:b.id,block:true});
    const t=nearest(p),a=t?aim(p,t):Math.atan2(-b.vx,b.vy);
    effect(q,p,'reflect',14*s(),.18,{angle:a});
    addProjectile({...q,mechanic:'reflected',damage:q.damage,speed:1000,life:1.4,radius:3},p,a,{color:q.color});
  }
  function block(q,p,r,{reflectOrdinary=false,reflectEnhanced=false,disk=null}={}){
    if(disk&&disk.durability<=0)return;
    for(const b of world.hostiles){if(b.blocked||dist(p,b)>r+(b.radius||3))continue;
      if(reflectOrdinary&&!b.enhanced||reflectEnhanced&&b.enhanced)reflect(q,b,p);
      else {b.blocked=true;events.push({control:true,hostileId:b.id,block:true});effect(q,b,'block',12*s(),.18,{angle:aim(p,b)});}
      if(disk&&--disk.durability<=0){disk.life=disk.age;break;}
    }
  }
  function tail(q,p,extra=false){
    const target=living().filter(t=>t.y>world.origin.y+10*s()&&dist(t,world.origin)<750*s()).sort((a,b)=>dist(a,world.origin)-dist(b,world.origin))[0];
    const center=target?Math.PI+clamp(Math.atan2(Math.sin(aim(world.origin,target)-Math.PI),Math.cos(aim(world.origin,target)-Math.PI)),-.9,.9):Math.PI;
    const spread=q.rank>=3?.7:.55;
    muzzle(q,point(p,Math.PI,18*s()),{angle:Math.PI});
    for(let i=0;i<q.count;i++)schedule(i*.02,()=>{
      // Interleave aimed rounds and a rear fan, preserving a useful central burst.
      const a=i%2===0?center:center+(i/(q.count-1)-.5)*spread*2;
      addProjectile(q,point(world.origin,Math.PI,18*s()),a,{pierce:q.rank>=4?1:0});
      if(extra&&q.rank>=5)for(const side of [-1,1])addProjectile({...q,damage:q.damage*.6},point(world.origin,Math.PI,18*s()),a+side*.42,{pierce:1,secondary:true});
    });
    if(extra)effect(q,p,'compression',48*s(),.2);
  }
  function slash(q,p){
    const cross=q.rank>=3&&q.round%3===0,r=q.radius*s()*q.width*(q.rank>=2?1.2:1),side=q.round%2?1:-1;
    effect(q,p,'slash',r,.24,{cross,side});
    if(cross)schedule(.045,()=>effect(q,p,'slash',r,.24,{cross,side:-side}));
    if(q.rank>=1)for(const side of [-1,1])effect(q,{x:p.x+side*24*s(),y:p.y},'hilt',8*s(),.18);
    const targets=living().filter(t=>dist(p,t)<=r+(t.radius||0)&&t.y<p.y+15*s());
    for(const t of targets)hit(q,t,q.damage*(cross?3:1));
    if(cross&&q.rank>=4){for(const b of world.hostiles)if(b.y<p.y+15*s()&&dist(p,b)<=r+(b.radius||3))block(q,b,0,{reflectEnhanced:true});}
    if(cross&&q.rank>=5&&targets.length>=5)schedule(.12,()=>explosion(q,p,r*1.3,q.damage*1.5,{slash:true}));
  }
  function gravity(q,p,secondary=false){
    const r=q.radius*s()*q.width*(q.rank>=2?1.2:1),hits=[];
    effect(q,p,'gravity',r,.35,{secondary});
    for(const t of living())if(dist(p,t)<=r+(t.radius||0)&&(secondary||t.y<p.y&&Math.abs(aim(p,t))<1.12)){
      const mult=q.rank>=3?1+.5*(1-clamp(dist(p,t)/r,0,1)):1;
      hit(q,t,q.damage*(secondary?.5:1)*mult);
      const push=(secondary?24:65)*s()*(q.rank>=2?1.25:1)*mult,a=aim(p,t),dest=point(t,a,push);
      events.push({control:true,targetId:t.id,dx:dest.x-t.x,dy:dest.y-t.y});
      trace([t,dest],q.color,(q.rank>=2?5:3)*s(),.22,{...style(q),alpha:.35});
      hits.push({t,dest});
    }
    if(q.rank>=4){const pairs=new Set();for(const {t,dest} of hits)for(const other of living()){
      const key=[String(t.id),String(other.id)].sort().join('/');if(t.id===other.id||pairs.has(key))continue;
      if(segmentDistance(t,dest,other)<(t.radius||15)+(other.radius||15)){pairs.add(key);hit(q,t,q.damage*.3);hit(q,other,q.damage*.3);effect(q,t,'collision',18*s(),.2);effect(q,other,'collision',18*s(),.2);}
    }}
    if(q.rank>=5&&!secondary)schedule(.25,()=>gravity(q,{...world.origin},true));
  }
  function lightning(q,p){
    const seen=new Set(),range=180*s()*(q.rank>=2?1.25:1)*q.chainMultiplier,max=5;
    let from=p;
    for(let i=0;i<max;i++){
      const t=nearest(from,{exclude:seen,range:i?range:800*s()});if(!t)break;
      seen.add(t.id);arc(q,from,t,q.color,3*s(),.11);const node={...t};if(q.rank>=2)schedule(i*.015,()=>effect(q,node,'node',6*s(),.1));hit(q,t,q.damage,{lightning:true});
      if(q.rank>=3||random()<(q.rank>=2?.23:.13)){
        const branch=nearest(t,{exclude:seen,range});if(branch){seen.add(branch.id);arc(q,t,branch,q.shadow,1.8*s(),.13);hit(q,branch,q.damage,{lightning:true});}
      }from=t;
    }
    if(q.rank>=5&&q.round%5===0){
      const ts=living().sort((a,b)=>dist(p,a)-dist(p,b)).slice(0,6);
      ts.forEach((t,i)=>{const cloud={x:t.x,y:t.y-100*s()};effect(q,cloud,'storm-cloud',32*s(),.4);for(let j=0;j<7;j++)random();schedule(i*.025,()=>{effect(q,cloud,'lightning',20*s(),.12,{end:{...t}});effect(q,t,'node',8*s(),.1);});hit({...q,groupId:q.groupId+'/storm'},t,q.damage,{lightning:true});});
    }
  }
  function spawnDrone(q,p,generation=0,life=q.life*(q.rank>=2?1.25:1),mother=false){
    const active=drones.filter(d=>d.age<d.life&&d.hp>0);
    // One shared small-drone budget, with a separate single mother slot.
    if(mother?active.some(d=>d.mother):active.filter(d=>!d.mother).length>=DRONE_LIMIT){
      // Overflow strengthens surviving drones from this weapon only. The bonus
      // expires with each drone, never compounds into offspring or refreshes life.
      for(const d of active)if(d.q.weaponId===q.weaponId)d.overflow=Math.min(DRONE_OVERFLOW_MAX,d.overflow+1);
      return false;
    }
    drones.push({id:uid(),q,p:{...p},age:0,life,next:now(),generation,mother,overflow:0,slot:seq,hp:(q.rank>=2?2:1)*(mother?4:1)});return true;
  }
  function fire(q,p){
    if(!['sidegun','tail','toxin','beam','freeze'].includes(q.mechanic))muzzle(q,p);state.shots++;
    aircraftSideShots(q,p);
    switch(q.mechanic){
      case 'cannon': {
        const a=0; // Main and auxiliary barrels share the same forward direction.
        forwardProjectiles(q,p,{pierce:q.rank>=4&&q.overload?1:0});
        if(q.rank>=2&&q.held>=1)effect(q,p,'heat',16*s(),.11,{held:q.held,overload:q.overload});
        if(q.rank>=5&&q.overload)for(const side of [-1,1]){const sideP={x:p.x+side*22*s(),y:p.y};muzzle(q,sideP,{secondary:true});addProjectile({...q,damage:q.damage*.4},sideP,a,{pierce:1,secondary:true});}break;
      }
      case 'rail': forwardProjectiles(q,p,{pierce:3+(q.rank>=2?1:0)});break;
      case 'rocket': {const n=q.rank>=5&&q.round%3===0?3:1;for(let i=0;i<n;i++)addProjectile({...q,damage:q.damage*(n===3?.7:1)},{x:p.x+(i-(n-1)/2)*20*s(),y:p.y+(i===1&&n===3?-12:0)*s()},(i-(n-1)/2)*.2,{homing:true,main:true});break;}
      case 'laser': {
        const a={...p},b=point(a,0,world.height*1.1),width=q.radius*s()*q.width*(q.rank>=2?1.2:1);
        const first=beam(q,a,b,width);
        if(q.rank>=3){schedule(.2,()=>{
          const second=beam(q,a,b,width,q.damage*.5,{secondary:true});
          if(q.rank>=4)for(const t of living())if(first.has(t.id)&&second.has(t.id)){hit(q,t,q.damage*.3);effect(q,t,'focus',12*s(),.16);}
          if(q.rank>=5)for(const side of [-1,1])beam(q,{x:a.x+side*24*s(),y:a.y},{x:b.x+side*24*s(),y:b.y},width,q.damage*.3,{side:true,secondary:true});
        });}break;
      }
      case 'scatter': {
        const groupHits=new Set();for(let i=0;i<q.count;i++)addProjectile(q,p,(i/(q.count-1)-.5)*Math.PI/3,{outer:i===0||i===q.count-1,groupHits});
        if(q.rank>=5&&q.round%3===0)schedule(.25,()=>{const origin={...p},groupHits=new Set();for(let i=0;i<q.count;i++){const x=(i/(q.count-1)-.5)*160*s();const start={x:origin.x+x,y:origin.y};addProjectile({...q,damage:q.damage*.6},start,aim(start,{x:origin.x,y:origin.y-330*s()}),{outer:false,groupHits,secondary:true});}});break;
      }
      case 'sidegun':for(const side of [-1,1]){const angle=side*(q.round%3===0?.1:1.05);muzzle(q,{x:p.x+side*28*s(),y:p.y},{angle});addProjectile(q,p,angle,{speed:q.speed*s()*(q.rank>=2?1.2:1),life:q.life*(q.rank>=2?1.25/1.2:1),side});}
        if(q.rank>=5)schedule(.08,()=>{for(const side of [-1,1])addProjectile({...q,damage:q.damage*.6},p,side*Math.PI*.72,{side,extra:true});});break;
      case 'grenade': {const heavy=q.rank>=5&&q.round%3===0;addProjectile({...q,damage:q.damage*(heavy?1.5:1)},p,0,{heavy,maxBounces:2+(q.rank>=2?1:0),nextBounce:.45,radius:q.radius*s()*(heavy?1.5:1),landing:point(p,0,q.speed*s()*q.life)});break;}
      case 'mine':addField(q,{...world.origin},'mine',{life:5,radius:70*s()*q.width*(q.rank>=2?1.2:1),triggerRadius:42*s()*(q.rank>=2?1.2:1),armed:now()+.35,core:q.rank>=5&&q.round%5===0,arcAt:now()+.5});break;
      case 'beam':case 'freeze':break; // Persistent attacks use the shared fixed tick clock below.
      case 'lightning':lightning(q,p);break;
      case 'orb':addProjectile(q,p,0,{life:q.life*(q.rank>=2?1.25:1),radius:q.radius*s()*q.width*(q.rank>=2?1.2:1),counts:new Map()});break;
      case 'toxin':if(Math.hypot(velocity.x,velocity.y)>4*s())addField(q,world.origin,'toxin',{life:q.life*(q.rank>=2?1.25:1),radius:q.radius*s()*q.width*(q.rank>=2?1.2:1)});break;
      case 'blades':slash(q,world.origin);break;
      case 'gravity':gravity(q,world.origin);break;
      case 'lightmine':addProjectile(q,p,0,{life:.6,landing:point(p,0,230*s())});break;
      case 'pyro':{const target=nearest(p,{front:true,range:1000*s()});addProjectile(q,p,target?clamp(aim(p,target),-.8,.8):.18,{radius:q.radius*s()*q.width,nextBounce:1.1});break;}
      case 'shield':{const n=q.rank>=5?2:1;for(let i=0;i<n;i++)addProjectile({...q,damage:q.damage*(n===2?.7:1)},p,n===2?(i?1:-1)*.3:0,{color:q.color,darker:n===2&&i===1,durability:Math.ceil(16*(q.rank>=2?1.3:1)),returning:false});break;}
      case 'tail':tail(q,p);break;
      case 'drone':if(drones.filter(d=>!d.mother&&d.age<d.life&&d.hp>0).length>=DRONE_LIMIT&&q.rank>=5)spawnDrone(q,p,0,8*q.durationMultiplier,true);else spawnDrone(q,p);break;
    }
  }
  function rocketEnd(b){
    const q=b.q,r=75*s()*q.width*(q.rank>=2?1.2:1)*(b.main?1:.5),hitIds=explosion(q,b.p,r);
    if(q.rank>=3&&b.main)for(let i=0;i<3;i++)addProjectile({...q,damage:q.damage*.25,radius:4,speed:620,life:1.8},b.p,(i-1)*.7,{homing:true,main:false,avoid:q.rank>=4?hitIds:new Set()});
  }
  function grenadeEnd(b){
    const q=b.q;explosion(q,b.p,105*s()*q.width*(b.heavy?1.5:1));
    if(b.heavy)effect(q,b.p,'contact-ripple',135*s()*q.width,.45,{color:q.highlight,layers:2});
    if(q.rank>=4&&!b.mini)for(let i=0;i<3;i++)addProjectile({...q,damage:q.damage*.2,life:.45,speed:220},b.p,i*TAU/3,{mini:true,maxBounces:0,nextBounce:Infinity,radius:5*s()});
  }
  function mineEnd(f){
    if(f.triggered)return;f.triggered=true;f.age=f.life;
    explosion(f.q,f.p,f.radius,f.q.damage);
    if(f.q.rank>=3&&!f.mini){let index=0;for(const n of fields.filter(n=>n.type==='mine'&&!n.triggered&&!n.queued&&n!==f&&dist(n.p,f.p)<180*s()).sort((a,b)=>dist(a.p,f.p)-dist(b.p,f.p))){n.queued=true;const delay=.12*++index;schedule(Math.max(0,delay-.1),()=>effect(f.q,f.p,'mine-link',1,.12,{end:{...n.p}}));schedule(delay,()=>mineEnd(n));}}
    if(f.q.rank>=4&&!f.mini)for(const side of [-1,1])addField({...f.q,damage:f.q.damage*.35},{x:f.p.x+side*26*s(),y:f.p.y},'mine',{mini:true,life:3,radius:f.radius*.55,triggerRadius:28*s(),armed:now()+.3});
  }
  function pyroEnd(b){const r=140*s()*b.q.width*(b.q.rank>=3?1+.1*Math.min(5,b.bounces):1);const ids=explosion(b.q,b.p,r,b.q.damage*14,{burn:true});for(const t of living())if(ids.has(t.id))burning(b.q,t);if(b.q.rank>=5)addField(b.q,b.p,'fire',{life:4,radius:r,next:now()});}
  function burning(q,t,damage=q.damage){
    const st=status(t),active=st.burn?.until>now()?st.burn:null;
    // Contact refreshes duration, never postpones the next DOT tick or lets an
    // ember overwrite a stronger active burn with its reduced fragment damage.
    st.burn={q:active&&active.damage>damage?active.q:q,damage:Math.max(damage,active?.damage||0),until:Math.max(active?.until||0,now()+2*(q.rank>=2?1.25:1)),next:active?.next??now()+.25};
  }
  function freeze(q,t,amount){
    const st=status(t),resistant=t.boss||t.elite;
    // Target-wide protection covers all beams and propagated frost. It starts
    // at the trigger, so another weapon cannot refresh control in the same tick.
    if(resistant&&st.freezeImmuneUntil>now()){st.freeze=0;return;}
    st.freezeShot=q;st.frostAt=now();st.freeze=Math.min(1,st.freeze+amount);
    if(st.freeze>=1){
      const duration=t.boss?.12:t.elite?.25:.35;
      st.frozenUntil=now()+duration;st.freeze=0;
      if(resistant)st.freezeImmuneUntil=st.frozenUntil+(t.boss?4:2);
      events.push({control:true,targetId:t.id,freeze:duration});effect(q,t,'ice-flash',(t.radius||16)+6*s(),Math.min(.25,duration));
    }
  }
  function stepProjectiles(dt){
    const existing=projectiles;projectiles=[];
    for(const b of existing){let q=b.q;const k=q.mechanic;b.age+=dt;b.prev={...b.p};
      if(b.homing){const target=nearest(b.p,{exclude:b.avoid||new Set()})||nearest(b.p);if(target){const da=Math.atan2(Math.sin(aim(b.p,target)-b.angle),Math.cos(aim(b.p,target)-b.angle));b.angle+=clamp(da,-3.5*dt,3.5*dt);if(q.rank>=4&&!b.main&&Math.abs(da)>.08){effect(q,b.p,'guidance',36*s(),.08,{angle:b.angle,end:point(b.p,aim(b.p,target),Math.min(55*s(),dist(b.p,target)))});effect(q,target,'lock',6*s(),.08);}}}
      if(k==='orb'){const crowded=q.rank>=3&&living().filter(t=>dist(b.p,t)<150*s()).length>=5;b.crowded=crowded;b.radius=q.radius*s()*q.width*(q.rank>=2?1.2:1)*(crowded?1.4:1)*(b.small?.55:1);b.speed=q.speed*s()*(crowded?.65:1);}
      if(k==='shield'&&q.rank>=3){if(!b.returning&&dist(b.origin,b.p)>400*s()){b.returning=true;b.seen.clear();}if(b.returning)b.angle=aim(b.p,world.origin);}
      b.p=point(b.p,b.angle,b.speed*dt);
      if(k==='rail'&&q.rank>=5){let f=fields.find(f=>f.id===b.id+'/rift');if(!f){f=addField(q,b.prev,'rift',{life:1,segments:[],seen:new Set(),radius:8*s()});f.id=b.id+'/rift';}f.segments.push({a:b.prev,b:b.p,until:now()+1});f.age=0;}
      const wall=b.p.x<b.radius||b.p.x>world.width-b.radius||b.p.y<world.top+b.radius||b.p.y>world.height-b.radius;
      if(k==='sidegun'&&q.rank>=3&&wall&&!b.refracted){b.refracted=true;q=b.q={...q,damage:q.damage*.65};b.angle=0;b.life=b.age+.6;if(q.rank>=4){const t=nearest(b.p);if(t){b.angle=aim(b.p,t);trace([b.p,point(b.p,b.angle,Math.min(55*s(),dist(b.p,t)))],q.highlight,1.5*s(),.15);}}corner(q,b);}
      if(k==='pyro'&&(wall||b.age>=b.nextBounce)){if(wall){if(b.p.x<b.radius||b.p.x>world.width-b.radius)b.angle=-b.angle;else b.angle=Math.PI-b.angle;b.p.x=clamp(b.p.x,b.radius,world.width-b.radius);b.p.y=clamp(b.p.y,world.top+b.radius,world.height-b.radius);}b.nextBounce=b.age+1.1;b.bounces++;
        if(q.rank>=3)b.radius=q.radius*s()*q.width*(1+.1*Math.min(5,b.bounces));
        effect(q,b.p,'bounce',b.radius,.22,{bounces:b.bounces});if(q.rank>=4)for(let i=0;i<3;i++)addProjectile({...q,mechanic:'ember',damage:q.damage*.3,speed:340,life:.7,radius:4},b.p,b.angle+(i-1)*.65);
      }
      if(k==='grenade'&&b.age>=b.nextBounce&&b.bounces<b.maxBounces){b.bounces++;b.nextBounce+=.45;effect(q,b.p,'bounce',20*s(),.25);if(q.rank>=3)explosion(q,b.p,45*s()*q.width,q.damage*.3);}
      let gone=false;
      // Sweep both bodies over the same frame. Sorting actual contact times
      // also handles crossing enemies and different target sizes correctly.
      const axis={x:Math.sin(b.angle),y:-Math.cos(b.angle)};
      const shape=k==='cannon'?commonCannonShape({unit:s(),rank:q.rank,width:q.width,secondary:b.secondary,radius:b.radius}):null;
      const contacts=living().map(t=>{
        const start={x:t.previousX??t.x,y:t.previousY??t.y};
        const fraction=shape?movingCapsuleHitTime(b.prev,b.p,start,t,axis,shape,t.radius||0)
          :movingCircleHitTime(b.prev,b.p,start,t,b.radius+(t.radius||0));
        return {t,start,fraction};
      }).filter(contact=>contact.fraction!==null).sort((a,z)=>a.fraction-z.fraction);
      for(const {t,start,fraction} of contacts){
        if(k==='orb'||k==='pyro'){
          if((b.ticks.get(t.id)||0)>now())continue;b.ticks.set(t.id,now()+(k==='orb'?.6:.1));
          if(k==='orb'){const previous=b.counts.get(t.id),n=previous&&now()-previous.at<.7?previous.count:0;hit(q,t,q.damage*(q.rank>=4?1+Math.min(5,n)*.1:1));b.counts.set(t.id,{count:n+1,at:now()});effect(q,t,'contact-ripple',12*s(),.24,{layers:q.rank>=4?Math.min(5,n)+1:1});}
          else {hit(q,t,q.damage*.2);burning(q,t);b.life=Math.min(b.life,b.age+.45);}continue;
        }
        if(['grenade','lightmine'].includes(k)||b.seen.has(t.id))continue;
        if(k==='rocket'){rocketEnd(b);gone=true;break;}
        b.seen.add(t.id);
        const mult=k==='rail'&&q.rank>=3?1+.15*Math.min(4,b.contacts):1;
        let impact;
        if(shape){
          const center={x:b.prev.x+(b.p.x-b.prev.x)*fraction,y:b.prev.y+(b.p.y-b.prev.y)*fraction};
          const target={x:start.x+(t.x-start.x)*fraction,y:start.y+(t.y-start.y)*fraction};
          const along=clamp((target.x-center.x)*axis.x+(target.y-center.y)*axis.y,-shape.back,shape.front);
          const spine={x:center.x+axis.x*along,y:center.y+axis.y*along};
          const dx=target.x-spine.x,dy=target.y-spine.y,d=Math.hypot(dx,dy),reach=Math.min(shape.radius,d);
          impact={x:spine.x+(d?dx/d*reach:0),y:spine.y+(d?dy/d*reach:0)};
        }
        hit(q,t,q.damage*mult,{projectile:b,rail:k==='rail',tail:k==='tail',impact});b.contacts++;
        if(k==='ember')burning(q,t,q.damage);
        if(k==='rail'){effect(q,t,'penetration',12*s(),.2,{angle:b.angle});if(q.rank>=3)b.radius=q.radius*s()*q.width*(1+.1*Math.min(4,b.contacts));}
        if(k==='cannon'&&q.rank>=4&&q.overload)trace([point(t,b.angle+Math.PI,6*s()),point(t,b.angle,9*s())],q.highlight,1.5*s(),.14);
        if(k==='scatter'&&q.rank>=3&&dist(b.origin,t)<220*s()&&!b.groupHits.has(t.id)){b.groupHits.add(t.id);explosion(q,t,25*s(),q.damage*.3);}
        if(k==='scatter'&&q.rank>=4&&b.outer&&!b.refracted){b.refracted=true;b.angle=0;b.life=b.age+.5;corner(q,b);continue;}
        if(k==='sidegun'&&q.rank>=3&&!b.refracted){b.refracted=true;q=b.q={...q,damage:q.damage*.65};b.angle=0;b.life=b.age+.6;if(q.rank>=4){const target=nearest(b.p,{exclude:b.seen});if(target){b.angle=aim(b.p,target);trace([b.p,point(b.p,b.angle,Math.min(55*s(),dist(b.p,target)))],q.highlight,1.5*s(),.2);}}corner(q,b);continue;}
        if(k==='shield'){if(--b.durability<=0){gone=true;break;}continue;}
        if(b.contacts>(b.pierce||0)){gone=true;break;}
      }
      if(k==='shield'&&!gone)block(q,b.p,b.radius,{reflectOrdinary:q.rank>=4,disk:b});
      if(k==='shield'&&b.returning&&dist(b.p,world.origin)<24*s())gone=true;
      // Release children while the parent is still on the battlefield, not
      // after its long travel has already carried it beyond useful targets.
      if(k==='orb'&&q.rank>=5&&!b.small&&!b.split&&b.age>=Math.min(4,b.life)){
        b.split=true;effect(q,b.p,'orb-fade',b.radius,.25);
        for(const side of [-1,1])addProjectile({...q,damage:q.damage*.5},b.p,side*.3,{life:2,small:true,counts:new Map()});
      }
      if(b.age>=b.life){if(k==='rocket')rocketEnd(b);if(k==='grenade')grenadeEnd(b);if(k==='pyro')pyroEnd(b);
        if(k==='lightmine')addField(q,b.p,'lightmine',{life:q.life*(q.rank>=2?1.25:1),radius:300*s(),refract:new Map()});
        gone=true;
      }
      b.trail.push({...b.p,time:now()});while(b.trail.length>2&&now()-b.trail[0].time>.22)b.trail.shift();
      if(!gone&&b.p.x>-150*s()&&b.p.x<world.width+150*s()&&b.p.y>world.top-150*s()&&b.p.y<world.height+150*s())projectiles.push(b);
    }
  }
  function lightmineRays(f){
    const rays=Array.from({length:4},(_,i)=>({angle:i*TAU/4,multiplier:1,secondary:false}));
    if(f.q.rank<3)return rays;
    const final=f.q.rank>=5&&f.life-f.age<.4,count=final?8:4;
    const angle=Math.min(1,f.age/f.life)*Math.PI/2+(final?(1-(f.life-f.age)/.4)*TAU:0);
    for(let i=0;i<count;i++)rays.push({angle:angle+i*TAU/count,multiplier:final?.6:.45,secondary:true});
    return rays;
  }
  function stepFields(dt){
    const poisonHits=new Map();const existing=[...fields];
    for(const f of existing){f.age+=dt;const q=f.q;
      if(f.type==='mine'){
        if(f.core&&now()>=f.arcAt&&!f.triggered){f.arcAt=now()+.5;const t=nearest(f.p,{range:160*s()});if(t){arc(q,f.p,t,q.color,3*s());hit(q,t,q.damage*.15);}}
        if(now()>=f.armed&&!f.queued&&living().some(t=>dist(t,f.p)<f.triggerRadius+(t.radius||0)))mineEnd(f);
      }else if(f.type==='rift'){
        f.segments=f.segments.filter(seg=>seg.until>now());for(const t of living())if(!f.seen.has(t.id)&&f.segments.some(seg=>segmentDistance(seg.a,seg.b,t)<=f.radius+(t.radius||0))){f.seen.add(t.id);hit(q,t,q.damage*.25);}
      }else if(f.type==='lightmine'){
        const final=q.rank>=5&&f.life-f.age<.4,angle=(q.rank>=3?Math.min(1,f.age/f.life)*Math.PI/2:0)+(final?(1-(f.life-f.age)/.4)*TAU:0),count=final?8:4;
        f.angle=angle;f.count=count;
        if(now()>=f.next){f.next+=.1;const seen=new Set();
          // Fixed full-damage rays are checked first. Overlapping sweep rays
          // never multiply damage on the same target within a single tick.
          for(const ray of lightmineRays(f)){const end=point(f.p,ray.angle,f.radius);
            for(const t of living())if(!seen.has(t.id)&&segmentDistance(f.p,end,t)<(t.radius||0)+q.radius*s()/2){seen.add(t.id);hit(q,t,q.damage*ray.multiplier);
              if(q.rank>=4&&(f.refract.get(t.id)||0)<=now()){f.refract.set(t.id,now()+.5);beam(q,point(t,ray.angle-Math.PI/2,40*s()),point(t,ray.angle+Math.PI/2,40*s()),4*s(),q.damage,{side:true});}
            }
          }
        }
      }else if(now()>=f.next){f.next+=.5;
        const r=f.radius*(f.cloud?1+f.age*.2:1);for(const t of living())if(dist(t,f.p)<=r+(t.radius||0)){
          if(f.type==='toxin'){const key=`${q.weaponId}/${t.id}`,n=poisonHits.get(key)||0;if(n>=(q.rank>=3?3:1))continue;poisonHits.set(key,n+1);status(t).poison={q,until:now()+1};}
          if(f.type==='fire')burning(q,t);hit(q,t);
        }
      }
    }fields=fields.filter(f=>f.age<f.life&&!f.triggered&&(f.type!=='rift'||f.segments.length));
  }
  function stepDrones(dt){
    for(const d of drones){d.age+=dt;if(d.age>=d.life||d.hp<=0)continue;
      const t=nearest(d.p),slotAngle=d.slot*2.39996,desired=t?point(t,slotAngle,90*s()):point(world.origin,slotAngle,70*s());
      const a=aim(d.p,desired),move=Math.min(dist(d.p,desired),220*s()*dt);d.p=point(d.p,a,move);d.angle=t?aim(d.p,t):0;
      for(const other of drones)if(d!==other&&dist(d.p,other.p)<24*s()){const a=aim(other.p,d.p);d.p=point(d.p,a,20*s()*dt);}
      for(const b of world.hostiles)if(!b.blocked&&dist(d.p,b)<(d.mother?26:12)*s()+(b.radius||3)){
        b.blocked=true;events.push({control:true,hostileId:b.id,block:true});
        effect(d.q,b,'block',12*s(),.18,{angle:aim(d.p,b)});
        d.hp--;if(d.hp<=0){d.age=d.life;break;}
      }
      if(d.hp<=0)continue;
      if(now()>=d.next){d.next=now()+d.q.droneInterval;const targets=living().sort((a,b)=>dist(d.p,a)-dist(d.p,b)).slice(0,d.mother?3:1);
        for(const [i,target] of targets.entries()){const start=d.mother?{x:d.p.x+(i-1)*17*s(),y:d.p.y-20*s()}:d.p;trace([start,target],d.q.color,2*s(),.1,{...style(d.q)});muzzle(d.q,start);hit(d.q,target,d.q.damage*(1+d.overflow*DRONE_OVERFLOW_DAMAGE),{droneGeneration:d.generation});
          if(d.q.rank>=3&&(d.generation===0||d.q.rank>=4&&d.generation===1))status(target).mark={q:d.q,generation:d.generation,until:now()+1};}
      }
    }drones=drones.filter(d=>d.age<d.life&&d.hp>0);
  }
  function persistent(c,q,dt,active){
    if(!active){c.lock=null;c.stacks=0;c.lockTime=0;c.next=now();return;}
    const old=c.lock,t=living().find(t=>t.id===old&&t.y<=world.origin.y)||nearest(world.origin,{front:true,range:900*s()});
    if(c.retainUntil&&now()>=c.retainUntil){c.stacks=c.freshStacks||0;c.retainUntil=0;}
    if(!t){c.next=now();return;}
    if(old!==t.id){const retained=q.mechanic==='beam'&&q.rank>=4&&dead.has(old)&&now()<c.retainUntil;if(retained){c.freshStacks=0;trace([c.visualTarget||world.origin,t],q.color,2*s(),.16,{visualEvent:'retarget'});}else{c.stacks=0;c.retainUntil=0;}c.lock=t.id;c.lockTime=0;c.acquire=now()+(retained?0:q.mechanic==='beam'&&q.rank>=2?.05:.15)*q.lockMultiplier;c.next=Math.max(c.next,c.acquire);}
    if(now()<c.acquire)return;c.lockTime+=dt;
    if(q.mechanic==='beam'&&q.rank>=3&&c.lockTime>=.5){const n=Math.floor(c.lockTime/.5);c.lockTime-=n*.5;if(c.retainUntil)c.freshStacks=Math.min(5,(c.freshStacks||0)+n);c.stacks=Math.min(5,c.stacks+n);}
    const width=q.radius*s()*q.width*(q.mechanic==='beam'&&q.rank>=2?1.2:1)*(1+c.stacks*.08);
    const last=c.visualTarget||t,mix=q.mechanic==='beam'?Math.min(1,dt*24):1;
    c.visualTarget={x:last.x+(t.x-last.x)*mix,y:last.y+(t.y-last.y)*mix};
    effect(q,point(world.origin,0,24*s()),q.mechanic==='freeze'?'frost-ray':'cut-ray',width,.08,{id:q.weaponId+'/held-ray',end:{...c.visualTarget},stacks:c.stacks});
    if(q.mechanic==='freeze')freeze(q,t,dt/.15*(q.rank>=2?1.25:1)*q.freezeMultiplier);
    let ticks=0;while(now()+1e-9>=c.next&&ticks++<8){c.next+=q.interval;
      hit(q,t,q.damage*(1+c.stacks*.1));
      if(q.mechanic==='beam'&&q.rank>=5&&c.stacks===5){const other=nearest(t,{exclude:new Set([t.id]),range:500*s()});if(other){beam(q,world.origin,other,width*.7,q.damage*1.5*.5,{secondary:true});effect(q,world.origin,'cut-ray',width*.65,.11,{end:{...other},secondary:true,stacks:0});}}
    }
  }
  function makeShot(c){const q=stats(c);return {...q,weaponId:c.weapon.id,itemId:c.weapon.itemId,groupId:`${runId}/group-${++state.groups}`,round:c.round,held:c.held,overload:q.rank>=3&&c.held>=2,
    energy:true,slotId:c.weapon.slots[0],slots:c.weapon.slots,barrel:0,at:now()};}
  function killed(rec){
    const {q,t,meta}=rec,st=status(t);dead.add(t.id);
    for(const c of clocks)if(c.lock===t.id&&stats(c).mechanic==='beam'&&stats(c).rank>=4){c.retainUntil=now()+2;c.freshStacks=0;}
    if(meta.rail&&q.rank>=4&&meta.projectile){const b=meta.projectile;b.speed*=1.25;b.life=Math.min(q.life+1.2,b.life+.3);b.boostUntil=now()+.3;effect(q,t,'sonic',20*s(),.2,{angle:b.angle});}
    if(meta.lightning&&q.rank>=4)explosion(q,t,85*s(),q.damage*.4,{discharge:true});
    if(st.frozenUntil>now()&&st.freezeShot?.rank>=4){const fq=st.freezeShot;explosion(fq,t,100*s(),fq.damage*2/fq.interval,{shatter:true});if(fq.rank>=5){effect(fq,t,'frost-wave',100*s(),.4);for(const other of living())if(dist(t,other)<100*s()){freeze(fq,other,.5);effect(fq,other,'frost',(other.radius||16)+5*s(),.3,{progress:.5});}}}
    if(st.poison?.until>now()&&st.poison.q.rank>=4){addField(st.poison.q,t,'toxin',{life:2.5,radius:39.0625*s()});effect(st.poison.q,t,'poison-collapse',39.0625*s(),.3);}
    if(st.mark?.until>now()){const m=st.mark,n=Math.min(3,Math.max(1,Math.round((t.reward||2)*.8)));for(let i=0;i<n;i++){const p=point(t,i*TAU/n,18*s());if(spawnDrone(m.q,p,m.generation+1,10*m.q.durationMultiplier)){trace([t,p],m.q.color,1.4*s(),.25,{...style(m.q)});effect(m.q,p,'assembly',15*s(),.3,{generation:m.generation+1});}}}
  }
  function visuals(){
    const out=fx.map(v=>({...v,age:now()-v.start,progress:clamp((now()-v.start)/(v.until-v.start),0,1),alpha:(v.alpha??1)*clamp((v.until-now())/Math.min(.15,v.until-v.start),0,1)}));
    for(const b of projectiles){const q=b.q,k=q.mechanic;
      const p={...b.p};
      // Render-only offsets never move collision centers or change range.
      if(k==='sidegun'&&!b.refracted)p.x+=b.side*28*s()*Math.max(0,1-b.age/.08);
      if(k==='grenade')p.y-=Math.abs(Math.sin(b.age*Math.PI/.45))*22*s();
      out.push(glyph(p,b.radius,q.color,k,{...style(q),model:k==='reflected'?'cannon':k,width:q.width,kind:['orb','pyro','shield'].includes(k)?'glyph':'projectile',id:b.id,angle:b.angle,returning:b.returning,durability:b.durability,maxDurability:Math.ceil(16*(q.rank>=2?1.3:1)),darker:b.darker,
        age:b.age,life:b.life,rotation:now()*2,trail:b.trail,contacts:b.contacts,boost:b.boostUntil>now(),bounces:b.bounces,crowded:b.crowded,small:b.small,heavy:b.heavy,mini:b.mini,secondary:b.secondary||b.extra,main:b.main}));
      if(k==='grenade')out.push(glyph(b.p,(b.mini?12:b.heavy?52.5:35)*s(),q.color,'landing',{...style(q),id:b.id+'/landing',alpha:.45}));
      if(k==='lightmine')out.push(glyph(b.landing||b.p,6*s(),q.color,'landing',{...style(q),id:b.id+'/landing',alpha:.45}));
    }
    for(const f of fields){const q=f.q;if(f.type==='rift'){for(let i=0;i<f.segments.length;i++){const seg=f.segments[i];out.push(glyph(seg.a,3*s(),q.color,'rift',{...style(q),id:`${f.id}/${i}`,end:seg.b,alpha:clamp(seg.until-now(),0,1)}));}continue;}
      // Continuous light must not fade between the independent 0.1-second damage ticks.
      if(f.type==='lightmine')for(const [i,ray] of lightmineRays(f).entries()){
        const angle=ray.angle,points=[f.p,point(f.p,angle,f.radius*Math.min(1,f.age/.12))];
        out.push({...style(q),id:`${f.id}/ray/${i}`,kind:'beam',points,width:q.radius*s()*q.width*(ray.secondary?1:1.2),color:q.color,alpha:ray.secondary?.42:.8});
        if(q.rank>=2&&!ray.secondary)out.push(glyph(points[1],8*s(),q.color,'duration-ticks',{...style(q),id:`${f.id}/ticks/${i}`,angle,remaining:1-f.age/f.life,alpha:.6}));
      }
      const layers=f.type==='toxin'?Math.min(3,fields.filter(other=>other.type==='toxin'&&dist(f.p,other.p)<f.radius).length):1;
      const alert=f.type==='mine'&&living().some(t=>dist(t,f.p)<f.triggerRadius*1.8+(t.radius||0));
      out.push(glyph(f.p,f.radius*(f.cloud?1+f.age*.2:1),q.color,f.type,{...style(q),id:f.id,core:f.core,mini:f.mini,alert,queued:f.queued,cloud:f.cloud,layers,rotation:f.type==='lightmine'?(f.angle||0):now(),alpha:Math.min(1,(f.life-f.age)*2),age:f.age,triggerRadius:f.triggerRadius}));
    }
    for(const d of drones)out.push(glyph(d.p,(d.mother?30:12)*(d.generation? .88:1)*s(),d.q.color,'drone',{...style(d.q),id:d.id,angle:d.angle,hp:d.hp,mother:d.mother,generation:d.generation,age:d.age}));
    for(const t of living()){const st=statuses.get(t.id);if(!st)continue;
      const frostFade=clamp(1-(now()-(st.frostAt||0))/.5,0,1);
      if(st.freezeShot&&(st.freeze>0||st.frozenUntil>now()))out.push(glyph(t,(t.radius||16)+5*s(),st.freezeShot.color,'frost',{...style(st.freezeShot),id:`freeze/${t.id}`,frozen:st.frozenUntil>now(),progress:st.frozenUntil>now()?1:st.freeze,alpha:st.frozenUntil>now()?1:frostFade,shedding:frostFade<.8}));
      if(st.burn?.until>now())out.push(glyph(t,(t.radius||16)*.8,st.burn.q.color,'fire',{...style(st.burn.q),id:`burn/${t.id}`,age:now(),attached:true}));
      if(st.mark?.until>now())out.push(glyph(t,(t.radius||16)+8*s(),st.mark.q.color,'lock',{...style(st.mark.q),id:`mark/${t.id}`,alpha:.7}));
    }return out;
  }
  return {
    loadout,state,growth,get velocity(){return velocity;},get speedMultiplier(){return now()<speedUntil?1.15:1;},
    syncBuild(){
      // Apply basic drone tuning immediately; do not retrofit evolution forms.
      const updates=new Map(clocks.map(c=>[c.weapon.id,stats(c)]));
      const refresh=q=>{const next=updates.get(q.weaponId);if(!next)return q;return {...q,damage:next.damage,droneInterval:next.droneInterval,durationMultiplier:next.durationMultiplier};};
      for(const d of drones){const q=refresh(d.q);d.life*=q.durationMultiplier/d.q.durationMultiplier;d.next=Math.min(d.next,now()+q.droneInterval);d.q=q;}
      for(const st of statuses.values())if(st.mark)st.mark.q=refresh(st.mark.q);
    },restoreGrowth:x=>growth.restore(x),
    step(dt,{paused=false,firing=true,hasTargets=true,targets=[],origin=world.origin,height=1300,width=600,top=0,hostiles=[]}={}){
      if(disposed||paused||!(dt>0))return [];dt=Math.min(dt,.05);state.time+=dt;
      velocity=lastOrigin?{x:(origin.x-lastOrigin.x)/dt,y:(origin.y-lastOrigin.y)/dt}:{x:0,y:0};lastOrigin={x:origin.x,y:origin.y};world={targets,origin:lastOrigin,height,width,top,hostiles};
      fx=fx.filter(f=>f.until>now());const due=jobs.filter(j=>j.at<=now());jobs=jobs.filter(j=>j.at>now());for(const job of due)job.fn();
      stepAircraftMissiles(firing);
      stepProjectiles(dt);stepFields(dt);stepDrones(dt);
      for(const t of living()){const st=statuses.get(t.id);if(st?.burn&&st.burn.until>now()&&st.burn.next<=now()){st.burn.next+=.25;hit(st.burn.q,t,st.burn.damage);}}
      const shots=[];
      // Empty waves are not a trigger release: forward fire and overload continue.
      // Target-locked rays still require an enemy; pause freezes the entire simulation.
      for(const c of clocks){const a=stats(c);c.held=firing?c.held+dt:0;
        if(['beam','freeze'].includes(a.mechanic)){persistent(c,makeShot(c),dt,firing&&hasTargets);continue;}
        if(!firing){c.next=now();continue;}
        const movement=Math.hypot(velocity.x,velocity.y),angle=Math.atan2(velocity.y,velocity.x),turn=c.lastAngle===null?0:Math.abs(Math.atan2(Math.sin(angle-c.lastAngle),Math.cos(angle-c.lastAngle)));
        if(a.mechanic==='tail'&&a.rank>=3&&now()>=c.nextMove&&(movement>180*s()||movement>60*s()&&turn>Math.PI/3)){c.nextMove=now()+1.5;c.round++;const q=makeShot(c);tail(q,world.origin,true);}
        if(movement>60*s())c.lastAngle=angle;
        if(a.mechanic==='toxin'&&a.rank>=5&&movement>4*s()&&now()>=c.cloudAt){c.cloudAt=now()+2;addField(makeShot(c),world.origin,'toxin',{life:4.6875,radius:93.75*s(),cloud:true});}
        let catchup=0;while(now()+1e-9>=c.next&&catchup++<8){c.round++;const q=makeShot(c);c.next+=q.interval/(q.overload?1.3:1);shots.push(q);}
      }
      for(const [id,r] of receipts)if(now()-r.at>10)receipts.delete(id);
      const targetIds=new Set(targets.map(t=>t.id));for(const [id,st] of statuses)if(!targetIds.has(id)&&!(st.freezeImmuneUntil>now()))statuses.delete(id);
      return shots;
    },
    // A slot controls equipment placement, not the firing pattern's lateral bias.
    // Keep every volley on the aircraft centerline, including single-slot weapons.
    // Preserve the authored count, angles, damage and muzzle height.
    launch(q,muzzlePoint){if(disposed||!muzzlePoint)return;const p={x:world.origin.x,y:muzzlePoint.y};fire(q,p);},direction(){return 0;},
    hit(src,id){const r=receipts.get(src?.projectileId);if(disposed||src?.runId!==runId||!r||r.event.targetId!==id||r.accepted)return false;r.accepted=true;state.hits++;state.byWeapon[src.weaponId].hits++;return true;},
    resolveHit(src,damage,isDead,id){const r=receipts.get(src?.projectileId);if(!r?.accepted||r.resolved||r.event.targetId!==id)return;r.resolved=true;state.damage+=Math.max(0,damage);state.byWeapon[src.weaponId].damage+=Math.max(0,damage);
      // Repeated contacts refresh one wake; stacking identical light surfaces
      // can wash out the aircraft while the speed-buff timing stays unchanged.
      if(r.meta.tail&&r.q.rank>=4){speedUntil=now()+1;effect(r.q,world.origin,'slipstream',40*s(),.3,{id:r.q.weaponId+'/slipstream'});}
      if(isDead&&!dead.has(id)){state.kills++;state.byWeapon[src.weaponId].kills++;killed(r);}
    },
    effects(){return [];},recordDerived(){},forgetTarget(id){dead.add(id);},guides(){return false;},guide(){},advance(){},bend(){},bounce(){},explode(){return false;},chargeFor(){return 0;},
    takeWorldEffects(){const out=events;events=[];return out;},visuals(){return [];},blastVisuals(){return [];},energyVisuals:visuals,
    energyCounts(){return {projectiles:projectiles.length,zones:fields.length,drones:drones.length,effects:fx.length,pending:jobs.length};},
    snapshot(){return {projectiles:projectiles.map(b=>({id:b.id,mechanic:b.q.mechanic,damage:b.q.damage,rank:b.q.rank,p:{...b.p},angle:b.angle,seen:[...b.seen],age:b.age,life:b.life,bounces:b.bounces})),fields:fields.map(f=>({type:f.type,p:f.p,life:f.life,core:f.core})),drones:drones.map(d=>({generation:d.generation,mother:d.mother,life:d.life})),statuses:[...statuses].map(([id,st])=>({id,freeze:st.freeze,frozenUntil:st.frozenUntil})),clocks:clocks.map(c=>({round:c.round,stacks:c.stacks,held:c.held}))};},
    dispose(){disposed=true;events=[];fx=[];projectiles=[];fields=[];drones=[];jobs=[];receipts.clear();statuses.clear();growth.end();},
  };
}
