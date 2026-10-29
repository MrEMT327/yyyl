import { ZBBY_ARSENAL, ZBBY_VIEW_HEIGHT } from './zbby-arsenal.js';

const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const along=(p,a,r)=>({x:p.x+Math.sin(a)*r,y:p.y-Math.cos(a)*r});
const turn=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
// First capsule contact, sorted along the swept path rather than enemy array order.
export function zbbyContact(a,b,t,r){
  const dx=b.x-a.x,dy=b.y-a.y,ox=a.x-t.x,oy=a.y-t.y,rr=(t.radius||0)+r,A=dx*dx+dy*dy;
  if(ox*ox+oy*oy<=rr*rr)return 0;
  if(A<1e-12)return null;
  const B=2*(ox*dx+oy*dy),C=ox*ox+oy*oy-rr*rr,D=B*B-4*A*C;
  if(D<0)return null;const q=(-B-Math.sqrt(D))/(2*A);return q>=0&&q<=1?q:null;
}

export function createZbbyCombat({world,time,emit,trace,control,random=Math.random}){
  const bodies=[],jobs=[],channels=[],links=[],burns=new Map(),holds=new Map(),aims=new Map(),lastWhip=new Map();
  let serial=0;
  const scale=()=>world().height/ZBBY_VIEW_HEIGHT;
  const live=()=>world().targets.filter(t=>!t.dead);
  const target=id=>live().find(t=>t.id===id);
  const child=(shot,suffix)=>({...shot,source:{...shot.source,projectileId:`${shot.source.projectileId}/${suffix}`}});
  const unique=(shot,label)=>child(shot,`${label}-${++serial}`);
  const normal=()=>Math.sqrt(-2*Math.log(Math.max(1e-9,random())))*Math.cos(2*Math.PI*random());
  function burn(shot,t,amount){
    const prior=burns.get(t.id);if(prior){prior.damage+=amount;prior.shot=shot;}
    else burns.set(t.id,{shot,damage:amount,next:time()+1});
  }
  function hit(shot,t,damage=shot.damage,extra={}){emit(shot,t,damage,extra);}
  function explosion(b){
    const s=scale(),a=b.a,shot=unique(b.shot,'blast'),radius=(a.pyro?400:b.shot.blast)*s*b.shot.width;
    const damage=a.pyro?(400+200*b.shot.rank)*b.shot.damage/(25+10*b.shot.rank):b.shot.damage;
    trace([b.p],shot.color,shot.width,.42,{kind:'blast',x:b.p.x,y:b.p.y,radius});
    for(const t of live())if(dist(b.p,t)<radius+t.radius){hit(shot,t,damage);if(a.pyro)burn(shot,t,damage);}
  }
  function spawn(shot,p,angle,index=0){
    const a=ZBBY_ARSENAL[shot.itemId],s=scale();
    const velocity=Math.max(0,a.speed+(a.variance?normal()*a.variance:0))*s;
    const b={shot:child(shot,index),a,p:{...p},vx:Math.sin(angle)*velocity,vy:-Math.cos(angle)*velocity,
      angle,age:0,hitSerial:0,pierces:shot.pierces,bounces:a.bounces||0,lastHit:new Map(),nextTick:a.tick||0,dead:false};
    if(a.whip){const key=`${shot.source.weaponId}/${shot.slotId}`,prev=lastWhip.get(key);if(prev&&!prev.dead&&time()-prev.created<.25)b.follow=prev;b.created=time();lastWhip.set(key,b);}
    bodies.push(b);
  }
  function launch(shot,muzzle){
    const a=ZBBY_ARSENAL[shot.itemId];if(!a)return false;
    if(a.beam){
      channels.push({shot:{...shot,life:a.channel?shot.life:Math.min(.1,shot.interval)},a,p:{...muzzle},offset:{x:muzzle.x-world().origin.x,y:muzzle.y-world().origin.y},age:0,next:a.channel?.36666667:0,angle:shot.angle||0});return true;
    }
    for(let i=0;i<shot.count;i++){
      let angle=shot.angle||0;
      if(a.fan)angle+=(i/(shot.count-1)-.5)*a.fan*Math.PI/180;
      if(a.side)angle+=(i===0?-1:1)*Math.PI/2.3;
      angle+=(random()*2-1)*(a.spread||0)*Math.PI/180;
      if(a.gap&&i)jobs.push({at:time()+i*a.gap,shot,p:{...muzzle},angle,index:i});
      else spawn(shot,muzzle,angle,i);
    }
    return true;
  }
  function beam(c,dt){
    const s=scale(),a=c.a,shot=c.shot;
    if(!c.fixed)c.p={x:world().origin.x+c.offset.x,y:world().origin.y+c.offset.y};
    if(!c.fixed&&!a.channel){
      const near=live().filter(t=>t.y<c.p.y).sort((x,y)=>dist(c.p,x)-dist(c.p,y))[0];
      const key=`${shot.source.weaponId}/${shot.slotId}`,old=aims.get(key)??c.angle;
      const want=near?Math.atan2(near.x-c.p.x,c.p.y-near.y):0;
      c.angle=old+Math.max(-3*dt,Math.min(3*dt,turn(old,want)));aims.set(key,c.angle);
    }
    const end=along(c.p,c.angle,(c.fixed?10000:shot.range)*s),radius=(c.fixed?60:shot.radius)*s*shot.width;
    const touching=live().filter(t=>zbbyContact(c.p,end,t,radius)!==null);
    if(a.channel&&c.age<.36666667){trace([c.p,end],shot.color,1,.03);return;}
    trace([c.p,end],shot.color,radius*2*(a.damage?Math.pow(shot.damage/a.damage,.7):1),.055,{kind:'beam'});
    if(a.freeze){
      const key=`${shot.source.weaponId}/${shot.slotId}`;let hold=holds.get(key);if(!hold){hold=new Map();holds.set(key,hold);}
      hold.lastAt=time();
      const threshold=Math.max(.05,.15-.05*shot.rank),duration=.2+.4*shot.rank;
      for(const t of touching){let value=(hold.get(t.id)||0)+dt;if(value+1e-9>=threshold){control({source:shot.source,targetId:t.id,freeze:duration});value=threshold-Math.max(.03,Math.min(.25,duration*.5));}hold.set(t.id,value);}
      for(const [id,v] of hold)if(!touching.some(t=>t.id===id)){if(v<=dt*2)hold.delete(id);else hold.set(id,v-dt*2);}
    }
    while(c.next<=c.age+1e-9){
      const pulse=unique(shot,'tick');for(const t of touching)hit(pulse,t);
      c.next+=.1;
    }
  }
  function expire(b){
    b.dead=true;
    if(b.a.blast||b.a.pyro)explosion(b);
    if(b.a.crossLaser)for(let i=0;i<4;i++)channels.push({shot:{...child(b.shot,`cross-${i}`),damage:35*b.shot.damage,life:1.5},a:{},p:{...b.p},fixed:true,age:0,next:0,angle:i*Math.PI/2});
  }
  function addLink(b,t){
    const prev=target(b.previousTarget);b.previousTarget=t.id;
    if(!prev||dist(prev,t)>2500*scale())return;
    links.push({shot:b.shot,a:prev.id,b:t.id,length:dist(prev,t),until:time()+(b.a.electric&&(t.boss||prev.boss)?8/3:8),electric:b.a.electric});
  }
  function stepBody(b,dt){
    const s=scale(),prev={...b.p};b.age+=dt;
    if(b.shot.hunt){const t=live().sort((x,y)=>dist(b.p,x)-dist(b.p,y))[0];if(t){const angle=b.angle+Math.max(-3*dt,Math.min(3*dt,turn(b.angle,Math.atan2(t.x-b.p.x,b.p.y-t.y)))),speed=Math.hypot(b.vx,b.vy);b.vx=Math.sin(angle)*speed;b.vy=-Math.cos(angle)*speed;}}
    if(b.a.whip&&b.follow&&!b.follow.dead&&b.follow.follow&&!b.follow.follow.dead){
      const dx=b.follow.p.x-b.p.x,dy=b.follow.p.y-b.p.y,d=Math.hypot(dx,dy)||1,impulse=5000/.05*s*dt;
      b.vx+=dx/d*impulse;b.vy+=dy/d*impulse;b.follow.vx-=dx/d*impulse;b.follow.vy-=dy/d*impulse;
    }
    const damp=Math.max(0,1-(b.a.drag||0)*dt);b.vx*=damp;b.vy*=damp;b.p.x+=b.vx*dt;b.p.y+=b.vy*dt;
    b.angle=Math.atan2(b.vx,-b.vy);
    const r=b.shot.radius*s*b.shot.width;
    if(b.a.tick){
      while(b.nextTick<=b.age+1e-9){
        const shot=unique(b.shot,'area');
        for(const t of live())if(dist(b.p,t)<=r+t.radius){hit(shot,t,b.shot.damage*(b.a.pyro?.2:1));if(b.a.pyro)burn(shot,t,b.shot.damage);}
        b.nextTick+=b.a.tick;
      }
    }else{
      const contacts=live().map(t=>({t,q:zbbyContact(prev,b.p,t,r)})).filter(c=>c.q!==null).sort((a,b)=>a.q-b.q);
      for(const {t,q} of contacts){
        if(b.lastHit.has(t.id)&&(b.a.harpoon||b.age-b.lastHit.get(t.id)<(b.pierces>0?.6:.15)))continue;
        b.lastHit.set(t.id,b.age);
        if(b.a.harpoon)addLink(b,t);
        const shot=unique(b.shot,'contact');hit(shot,t,b.a.blast?1:b.shot.damage);
        if(b.a.burn&&!b.burned){b.burned=true;burn(shot,t,1+b.shot.rank);}
        if(b.pierces>0){b.pierces--;continue;}
        b.p={x:prev.x+(b.p.x-prev.x)*q,y:prev.y+(b.p.y-prev.y)*q};
        if(b.bounces>0||b.a.crossLaser){
          b.bounces--;const dx=b.p.x-t.x,dy=b.p.y-t.y,d=Math.hypot(dx,dy)||1,nx=dx/d,ny=dy/d,dot=b.vx*nx+b.vy*ny;
          b.vx-=2*dot*nx;b.vy-=2*dot*ny;b.p.x+=nx*.05;b.p.y+=ny*.05;break;
        }
        expire(b);break;
      }
    }
    if(!b.dead&&b.age+1e-9>=b.shot.life)expire(b);
    // Leaving an open sky isn't a wall collision. Long-lived fields finish their
    // fuse offscreen and never invent screen-edge ricochets.
  }
  function step(dt){
    for(let i=jobs.length-1;i>=0;i--)if(jobs[i].at<=time()+1e-9){const j=jobs.splice(i,1)[0];spawn(j.shot,j.p,j.angle,j.index);}
    let left=dt;while(left>1e-9){const tick=Math.min(left,1/120);left-=tick;for(const b of bodies)if(!b.dead)stepBody(b,tick);}
    for(let i=bodies.length-1;i>=0;i--)if(bodies[i].dead)bodies.splice(i,1);
    for(let i=channels.length-1;i>=0;i--){const c=channels[i];beam(c,Math.min(dt,Math.max(0,c.shot.life-c.age)));c.age+=dt;if(c.age+1e-9>=c.shot.life)channels.splice(i,1);}
    for(let i=links.length-1;i>=0;i--){const l=links[i],a=target(l.a),b=target(l.b);if(!a||!b||time()>=l.until||Math.abs(dist(a,b)-l.length)>1000*scale()){links.splice(i,1);continue;}
      const d=dist(a,b)||1,correction=(d-l.length)*Math.min(.5,dt*4);
      for(const [from,to,sign] of [[a,b,1],[b,a,1]])if(!from.boss)control({source:l.shot.source,targetId:from.id,dx:(to.x-from.x)/d*correction*sign,dy:(to.y-from.y)/d*correction*sign});
    }
    for(const [id,b] of burns){const t=target(id);if(!t){burns.delete(id);continue;}if(time()+1e-9>=b.next){hit(unique(b.shot,'burn'),t,b.damage);b.damage/=2;b.next+=1;if(b.damage<5)burns.delete(id);}}
    for(const [key,b] of lastWhip)if(b.dead)lastWhip.delete(key);
    for(const [key,h] of holds)if(time()-h.lastAt>.15)holds.delete(key);
  }
  function resolved(source,damage,id){
    if(source.chainTransfer||damage<=0)return;
    for(const l of links){if(!l.electric||time()>=l.until||l.a!==id&&l.b!==id)continue;const t=target(l.a===id?l.b:l.a),from=target(id);if(!t||!from)continue;
      // zbby shares the received damage with the other endpoint; the rarity
      // multiplier applies to the lightning path, whose endpoints are excluded.
      const shot=unique(l.shot,'shared');shot.source.chainTransfer=true;hit(shot,t,damage);
      for(const other of live())if(other.id!==l.a&&other.id!==l.b&&zbbyContact(from,t,other,12*scale())!==null)hit(shot,other,damage*(.7+.2*l.shot.rank));
      trace([from,t],l.shot.color,4,.15);
    }
  }
  function visuals(){
    const result=[],s=world().height/1300;
    for(const b of bodies){
      const width=s*b.shot.width*Math.sqrt((b.shot.visualDamage??b.shot.damage)/b.a.damage)*(b.a.pyro?3*(1+.2*b.shot.rank):b.a.sourceId==='orb_gun'?4:b.a.sourceId==='mine_launcher'?1.7:1);
      result.push({kind:'projectile',id:b.shot.source.projectileId,model:`zb_${b.a.sourceId}`,points:[b.p],...b.p,angle:b.angle,rotation:b.a.crossLaser?b.age*3:b.a.sourceId==='mine_launcher'?b.age*.6:undefined,color:b.shot.color,width,fieldRadius:b.a.tick?b.shot.radius*scale()*b.shot.width:0,alpha:1});
      if(b.a.whip&&b.follow&&!b.follow.dead)result.push({kind:'link',id:`${b.shot.source.projectileId}/thread`,points:[b.p,b.follow.p],color:b.shot.color,width:3*s*b.shot.width,alpha:.7});
    }
    for(const l of links){const a=target(l.a),b=target(l.b);if(a&&b)result.push({kind:'link',id:`${l.shot.source.projectileId}/${l.a}/${l.b}`,points:[a,b],color:l.electric?0xb1ffe3:0x94b4cb,width:l.electric?3:1.5,alpha:Math.min(1,(l.until-time())/.3)});}
    return result;
  }
  return {launch,step,visuals,resolved,
    activeGroups(){return new Set([...bodies,...jobs,...channels,...links,...burns.values()].map(v=>v.shot.source.groupId));},
    counts(){return {bodies:bodies.length,channels:channels.length,links:links.length,burns:burns.size,jobs:jobs.length};},
    forget(id){burns.delete(id);for(let i=links.length-1;i>=0;i--)if(links[i].a===id||links[i].b===id)links.splice(i,1);for(const h of holds.values())h.delete(id);},
    dispose(){bodies.length=jobs.length=channels.length=links.length=0;burns.clear();holds.clear();aims.clear();lastWhip.clear();}};
}
