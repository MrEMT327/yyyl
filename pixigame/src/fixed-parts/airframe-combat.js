import { ARSENAL } from './airframe-arsenal.js';
import { createAirframeGrowth,airframeWeaponStats } from './airframe-growth.js';
import { createZbbyCombat } from './zbby-combat.js';
import { createCommonCombat } from './common-combat.js';

const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const polar=(p,a,r)=>({x:p.x+Math.sin(a)*r,y:p.y-Math.cos(a)*r});
function contact(a,b,t,width){const dx=b.x-a.x,dy=b.y-a.y,q=Math.max(0,Math.min(1,((t.x-a.x)*dx+(t.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(t.x-a.x-dx*q,t.y-a.y-dy*q)<=t.radius+width/2;}
let serial=0;
export function createAirframeCombat(loadout,{random=Math.random,catalog=ARSENAL}={}) {
  if(catalog===ARSENAL&&(loadout.common||loadout.weapons.every(w=>ARSENAL[w.itemId]?.common)))return createCommonCombat(loadout,{random});
  const runId=`airframe-${++serial}`,growth=createAirframeGrowth(loadout,runId,Math.floor(random()*0xffffffff),catalog);
  const state={runId,time:0,groups:0,shots:0,hits:0,pulses:0,damage:0,kills:0,effects:{},focus:{},charge:{},byWeapon:Object.fromEntries(loadout.weapons.map(w=>[w.id,{hits:0,damage:0,kills:0}]))};
  let disposed=false,world={targets:[],origin:{x:300,y:1000},height:1300},events=[],traces=[],waves=[],bolts=[],pending=[];
  const groups=new Map(),clocks=loadout.weapons.map(weapon=>({weapon,next:0,round:0})),trait=loadout.identity.trait;
  const scale=()=>world.height/1300;
  const nearest=(p,except)=>world.targets.filter(t=>!t.dead&&t.id!==except).sort((a,b)=>distance(p,a)-distance(p,b))[0];
  let visualSerial=0;
  const zbby=createZbbyCombat({world:()=>world,time:()=>state.time,emit,trace,control:e=>events.push({control:true,...e}),random});
  function trace(points,color,width=4,life=.2,extra={}){
    if(traces.length>=180){
      if(['muzzle','impact'].includes(extra.kind))return;
      const index=traces.findIndex(t=>['muzzle','impact'].includes(t.kind));if(index<0)return;traces.splice(index,1);
    }
    traces.push({kind:'beam',id:`${runId}/fx-${++visualSerial}`,points,color,width,start:state.time,until:state.time+life,...extra});
  }
  function emit(shot,t,damage=shot.damage,extra={}){
    const g=groups.get(shot.source.groupId);if(!g||g.contacts.has(`${shot.source.projectileId}/${t.id}`))return;
    g.contacts.add(`${shot.source.projectileId}/${t.id}`);
    g.lastAt=state.time;
    events.push({rootBeam:true,source:shot.source,targetId:t.id,x:t.x,y:t.y,damage,distance:distance(world.origin,t),angle:0,...extra});
    trace([{x:t.x,y:t.y}],shot.color,shot.width,.16,{kind:'impact',x:t.x,y:t.y});
    if(!g.procced){g.procced=true;
      if(trait==='nova')blast({...shot,source:{...shot.source,projectileId:`${shot.source.projectileId}/innate`}},t,60*scale()*shot.width,damage*.35);
      if(trait==='chain'){const next=nearest(t,t.id);if(next){trace(zigzag(t,next),0xb4f77d,3,.24);emit({...shot,source:{...shot.source,projectileId:`${shot.source.projectileId}/innate`}},next,damage*.4);}}
    }
  }
  function blast(shot,p,r,damage){
    trace([{...p}],shot.color,shot.width,.42,{kind:'blast',x:p.x,y:p.y,radius:r});
    for(const t of world.targets)if(distance(t,p)<=r+t.radius)emit(shot,t,damage);
  }
  function line(shot,a,b,width=5,damage=shot.damage){
    trace([a,b],shot.color,width*shot.width,.3);
    for(const t of world.targets)if(contact(a,b,t,width*shot.width))emit(shot,t,damage);
  }
  function zigzag(a,b){return Array.from({length:9},(_,i)=>({x:a.x+(b.x-a.x)*i/8+(i&&i<8?Math.sin(i*11.4+state.groups)*12*scale():0),y:a.y+(b.y-a.y)*i/8}));}
  function fire(shot,muzzle){
    if(disposed)return;
    const pattern=catalog[shot.itemId].pattern,s=scale(),n=shot.count,base=shot.angle||0;
    state.shots++;
    trace([{...muzzle}],shot.color,shot.width,.08,{kind:'muzzle',x:muzzle.x,y:muzzle.y,angle:base});
    if(pattern==='zbby'){zbby.launch({...shot,pierces:shot.pierces+(trait==='phase'?2:0),hunt:trait==='hunt'},muzzle);return;}
    if(pattern==='chain'){
      let from=muzzle,seen=new Set();
      for(let i=0;i<n;i++){const t=world.targets.filter(t=>!seen.has(t.id)&&distance(from,t)<(i?300:900)*s).sort((a,b)=>distance(from,a)-distance(from,b))[0];if(!t)break;seen.add(t.id);trace(zigzag(from,t),shot.color,4*shot.width,.34);emit(shot,t,shot.damage*(1-i*.05));from=t;}
    }else if(pattern==='beam'){
      for(let i=0;i<n;i++){const angle=base+(i-(n-1)/2)*.15;line({...shot,color:[0xdfa4ff,0x7ae5ff,0xffa6cf][i%3],source:{...shot.source,projectileId:`${shot.source.projectileId}/${i}`}},muzzle,polar(muzzle,angle,world.height*1.2),7*s);}
    }else if(pattern==='pulse'){
      for(let i=0;i<n;i++){
        const a={x:muzzle.x+(i-(n-1)/2)*18*s,y:muzzle.y};
        line({...shot,source:{...shot.source,projectileId:`${shot.source.projectileId}/${i}`}},a,polar(a,base,world.height*1.1),6*s);
      }
    }else if(pattern==='ring'){
      for(let i=0;i<n;i++)if(waves.length<40)waves.push({shot:{...shot,source:{...shot.source,projectileId:`${shot.source.projectileId}/${i}`}},p:{x:world.origin.x,y:muzzle.y},start:state.time+i*.12,r:0});
    }else if(pattern==='orbit'){
      const count=n+1;
      for(let i=0;i<count;i++){const p=polar(world.origin,state.time+i*Math.PI*2/count,(shot.rank>=3?105:75)*s),t=nearest(p);if(t)line({...shot,source:{...shot.source,projectileId:`${shot.source.projectileId}/${i}`}},p,t,4*s);}
    }else{
      const count=pattern==='cross'||pattern==='helix'||pattern==='blade'?n+1:n;
      // Retire a complete old volley under load, never truncate one wing of
      // the new fan just because its projectiles were inserted last.
      while(bolts.length+count>220){const oldest=bolts[0].shot.source.groupId;bolts=bolts.filter(b=>b.shot.source.groupId!==oldest);}
      for(let i=0;i<count;i++){
        const spread=pattern==='slug'?0:pattern==='cannon'?.055:pattern==='siege'||pattern==='rocket'?.10:pattern==='swarm'?.24:.16;
        const angle=base+(i-(count-1)/2)*spread,p={...muzzle};
        if(pattern==='slug')p.x+=(i-(count-1)/2)*22*s;
        bolts.push({shot:{...shot,source:{...shot.source,projectileId:`${shot.source.projectileId}/${i}`}},pattern,p,origin:{...p},angle,age:0,index:i,
          side:Math.sign(i-(count-1)/2),pair:Math.min(i,count-1-i),contacts:0,seen:new Set()});
      }
    }
  }
  function stepBolts(dt){
    const s=scale();
    bolts=bolts.filter(b=>{
      const prev={...b.p};b.age+=dt;let speed=(b.pattern==='slug'?1050:b.pattern==='rocket'?520:b.pattern==='siege'?470:b.pattern==='nova'?420:650)*s;
      if(b.pattern==='helix'&&b.shot.rank>=2)speed*=1.2;
      if(b.pattern==='swarm'||trait==='hunt'){
        const t=nearest(b.p);if(t){const desired=Math.atan2(t.x-b.p.x,b.p.y-t.y),delta=Math.atan2(Math.sin(desired-b.angle),Math.cos(desired-b.angle));b.angle+=Math.max(-dt*3,Math.min(dt*3,delta));}
      }
      if(b.pattern==='blade'){b.angle+=b.side*(b.pair%2?-1:1)*dt*1.7;speed=440*s;}
      b.p=polar(b.p,b.angle,speed*dt);
      if(b.pattern==='helix')b.p.x-=b.side*Math.cos(b.age*12+b.pair*Math.PI*2/(b.shot.count+1))*150*s*dt;
      if(b.pattern==='cross')b.p.x+=Math.sin(b.age*8+b.index*Math.PI)*110*s*dt;
      const radius=(b.pattern==='nova'?12:b.pattern==='siege'?9:b.pattern==='blade'?17:4)*s*b.shot.width;
      for(const t of world.targets){
        if(b.seen.has(t.id)||!contact(prev,b.p,t,radius*2))continue;b.seen.add(t.id);emit(b.shot,t);b.contacts++;
        if(['nova','siege','swarm','rocket'].includes(b.pattern))blast({...b.shot,source:{...b.shot.source,projectileId:`${b.shot.source.projectileId}/blast`}},b.p,(b.pattern==='swarm'?30:65)*s*b.shot.width,b.shot.damage*.6);
        if(b.pattern==='cross'&&b.shot.rank>=5)blast({...b.shot,source:{...b.shot.source,projectileId:`${b.shot.source.projectileId}/starburst`}},b.p,32*s*b.shot.width,b.shot.damage*.3);
        const pierce=(trait==='phase'?2:0)+(b.shot.rank>=3?2:b.shot.rank>=1?1:0)+(b.pattern==='blade'?8:b.pattern==='slug'?3:0);
        if(b.contacts>pierce)return false;
      }
      return b.age<(b.pattern==='scatter'?1.1:2.6)&&b.p.y>-100*s&&b.p.y<world.height+200*s&&b.p.x>-200*s&&b.p.x<800*s;
    });
  }
  function visuals(){
    const out=traces.map(t=>({...t,alpha:Math.max(0,(t.until-state.time)/(t.until-t.start))}));
    for(const b of bolts){
      const model=b.pattern==='slug'?'rail':['swarm','rocket'].includes(b.pattern)?'missile':b.pattern==='nova'?'plasma':b.pattern==='siege'?'siege':b.pattern==='blade'?'blade':'twin';
      out.push({kind:'projectile',id:b.shot.source.projectileId,model,points:[{...b.p}],x:b.p.x,y:b.p.y,angle:b.angle,
        rotation:b.pattern==='blade'?b.age*12:undefined,color:b.shot.color,width:scale()*b.shot.width,alpha:1});
    }
    for(const w of waves)if(state.time>=w.start){const alpha=Math.max(.08,1-w.r/(650*scale()*w.shot.width));out.push({kind:'wave',id:w.shot.source.projectileId,points:[w.p],x:w.p.x,y:w.p.y,radius:w.r,color:w.shot.color,width:scale()*w.shot.width,alpha});}
    for(const clock of clocks)if(catalog[clock.weapon.itemId].pattern==='orbit'){
      const stats=airframeWeaponStats(clock.weapon,growth,catalog),n=stats.count+1;
      const radius=(stats.rank>=3?105:75)*scale();
      for(let i=0;i<n;i++){const p=polar(world.origin,state.time+i*Math.PI*2/n,radius),t=nearest(p);out.push({kind:'projectile',model:'drone',id:`${clock.weapon.id}/drone-${i}`,points:[p],...p,angle:t?Math.atan2(t.x-p.x,p.y-t.y):0,color:stats.color,width:scale(),alpha:1});}
    }
    return out.concat(zbby.visuals());
  }
  return {
    loadout,state,growth,velocity:{x:0,y:0},syncBuild(){},restoreGrowth:s=>growth.restore(s),
    step(dt,{hasTargets,firing=true,paused=false,targets=[],origin=world.origin,height=1300}={}){
      if(disposed||paused||!(dt>0))return [];dt=Math.min(dt,.05);state.time+=dt;world={targets,origin:{x:origin.x,y:origin.y},height};
      traces=traces.filter(t=>t.until>state.time);stepBolts(dt);zbby.step(dt);
      waves=waves.filter(w=>{if(state.time<w.start)return true;const before=w.r;w.r=(state.time-w.start)*380*scale();for(const t of targets){const d=distance(w.p,t),band=2*scale()*w.shot.width;if(d+t.radius+band>=before&&d-t.radius-band<=w.r)emit(w.shot,t);}return w.r<Math.min(world.height*.95,650*scale()*w.shot.width);});
      for(const job of pending.filter(j=>j.at<=state.time))fire(job.shot,job.muzzle);pending=pending.filter(j=>j.at>state.time);
      const shots=[];
      for(const c of clocks){const a=catalog[c.weapon.itemId];if(!firing){c.next=state.time+(a.warmup||0);continue;}
        if(!c.started){c.started=true;c.next=Math.max(c.next,state.time+(a.warmup||0));}
        let catchup=0;while(c.next<=state.time+1e-9&&catchup++<64){
        const stats=airframeWeaponStats(c.weapon,growth,catalog);c.round++;c.next=(a.sourceId?c.next:state.time)+stats.interval*(trait==='rapid'?.8:1);
        const empowered=trait==='siege'&&c.round%4===0,groupId=`${runId}/${++state.groups}`;
        groups.set(groupId,{weaponId:c.weapon.id,at:state.time,contacts:new Set(),accepted:new Set(),resolved:new Set(),procced:false});
        const shot={...stats,itemId:c.weapon.itemId,energy:true,slotId:c.weapon.slots[0],barrel:0,at:state.time,round:c.round,
          visualDamage:stats.damage*(empowered?1.8:1),
          damage:stats.damage*(empowered?1.8:1),width:stats.width*(trait==='tide'?1.3:1)*(empowered?1.5:1),
          source:{runId,groupId,weaponId:c.weapon.id,projectileId:groupId,kind:'root',depth:0}};
        const emitSlots=['ring','orbit'].includes(catalog[c.weapon.itemId].pattern)?c.weapon.slots.slice(0,1):c.weapon.slots;
        for(const slotId of emitSlots)shots.push({...shot,slotId,damage:shot.damage/emitSlots.length,source:{...shot.source,projectileId:`${groupId}/${slotId}`}});
        }
      }
      const activeGroups=zbby.activeGroups();for(const [id,g] of groups)if(state.time-(g.lastAt??g.at)>6&&!activeGroups.has(id))groups.delete(id);
      return shots;
    },
    direction(){return 0;},
    launch(shot,muzzle){
      if(!muzzle||disposed)return;fire(shot,muzzle);
      if(trait==='echo'&&shot.round%3===0){state.pulses++;pending.push({at:state.time+.18,muzzle:{...muzzle},shot:{...shot,damage:shot.damage*.5,source:{...shot.source,projectileId:`${shot.source.projectileId}/echo`}}});}
      if(trait==='prism')fire({...shot,angle:(shot.angle||0)+(/[246]$/.test(shot.slotId)?1:-1)*.28,damage:shot.damage*.35,count:1,source:{...shot.source,projectileId:`${shot.source.projectileId}/prism`}},muzzle);
      if(trait==='star'){const p={x:world.origin.x+60*scale(),y:world.origin.y},t=nearest(p);if(t)line({...shot,source:{...shot.source,projectileId:`${shot.source.projectileId}/star`}},p,t,3*scale(),shot.damage*.25);}
    },
    hit(source,id){const g=groups.get(source?.groupId),key=`${source?.projectileId}/${id}`;if(disposed||source?.runId!==runId||g?.weaponId!==source.weaponId||!g.contacts.has(key)||g.accepted.has(key))return false;g.accepted.add(key);state.hits++;state.byWeapon[g.weaponId].hits++;return true;},
    resolveHit(source,damage,killed,id){const g=groups.get(source?.groupId),key=`${source?.projectileId}/${id}`;if(!g?.accepted.has(key)||g.resolved.has(key))return;g.resolved.add(key);const stats=state.byWeapon[g.weaponId];stats.damage+=Math.max(0,damage);state.damage+=Math.max(0,damage);zbby.resolved(source,damage,id);if(killed){stats.kills++;state.kills++;}},
    effects(){return [];},recordDerived(){},forgetTarget(id){zbby.forget(id);},guides(){return false;},guide(){},advance(){},bend(){},bounce(){},explode(){return false;},chargeFor(){return 0;},
    takeWorldEffects(){const result=events;events=[];return result;},visuals(){return [];},blastVisuals(){return [];},energyVisuals:visuals,
    energyCounts(){return {beams:traces.length,links:bolts.length,zones:waves.length,zbby:zbby.counts()};},
    dispose(){disposed=true;events=[];traces=[];waves=[];bolts=[];pending=[];zbby.dispose();groups.clear();clocks.length=0;growth.end();},
  };
}
