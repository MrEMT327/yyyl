import { ORIGINAL_WEAPONS, PHYSICS_STEP, hitChargeGain, hitChargeDecay, homingPower, weaponStats, applyOriginalHoming, collideBodies } from '../fixed-parts/pathogenic-rules.js';
export { ORIGINAL_WEAPONS, PHYSICS_STEP, hitChargeGain, hitChargeDecay, homingPower, weaponStats, applyOriginalHoming, collideBodies };
const unit=v=>{const d=Math.hypot(v.x,v.y);return d?{x:v.x/d,y:v.y/d}:{x:0,y:0};};
const lerp=(a,b,t)=>a+(b-a)*t;
function circleContact(b,t,dt){
  const dx=b.vx*dt,dy=b.vy*dt,ox=b.x-t.x,oy=b.y-t.y,r=b.radius+t.radius;
  const c=ox*ox+oy*oy-r*r;if(c<=0)return 0;
  const a=dx*dx+dy*dy;if(a===0)return null;
  const q=2*(ox*dx+oy*dy),disc=q*q-4*a*c;if(disc<0)return null;
  const f=(-q-Math.sqrt(disc))/(2*a);return f>=0&&f<=1?f:null;
}
export function createPathogenicRange({weapon='twin',rarity=0,hitCharge=false,homing=false,seed=7231}={}){
  const config={weapon,rarity,hitCharge,homing,firing:true,movingTargets:false};
  const state={time:0,width:4000,height:4600,charge:0,shots:0,hits:0,damage:0,collisions:0,bursts:0,
    player:{x:2000,y:3800,vx:0,vy:0},aim:{x:2000,y:1200},bullets:[],targets:[],events:[],history:[],barrel:[]};
  let elapsed=1,accumulator=0,queue=[],recoil=0,serial=0,rng=seed,origin={...state.player};
  const random=()=>{rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;return (rng>>>0)/4294967296;};
  function emit(type,data){const e={type,time:state.time,...data};state.events.push(e);state.history.push(e);if(state.history.length>400)state.history.shift();}
  function resetBarrel(){const p=ORIGINAL_WEAPONS[config.weapon];state.barrel=Array.from({length:p.segments},(_,i)=>({x:i*p.segmentLength,y:0}));origin={...state.player};}
  function targets(){state.targets=[
    {id:'left',x:1050,y:1700,radius:190,mass:.8},
    {id:'front',x:2000,y:1950,radius:180,mass:.8},
    {id:'back',x:2150,y:1080,radius:210,mass:.8},
    {id:'right',x:2990,y:1500,radius:190,mass:.8},
  ].map(t=>({...t,homeX:t.x,homeY:t.y,vx:0,vy:0,hp:3000,maxHp:3000,flash:0,restitution:0,shouldTrigger:true,respawnAt:0}));}
  function barrelTick(){
    const p=ORIGINAL_WEAPONS[config.weapon],dir=unit({x:state.player.y-state.aim.y,y:state.aim.x-state.player.x});
    const points=state.barrel;let last=points[0],lastDir={x:1,y:0};
    const moved={x:state.player.y-origin.y,y:origin.x-state.player.x};
    for(let i=1;i<p.segments;i++){
      const wanted={x:last.x+lerp(lastDir.x,dir.x,i/p.segments)*p.segmentLength-dir.x*recoil,
        y:last.y+lerp(lastDir.y,dir.y,i/p.segments)*p.segmentLength-dir.y*recoil};
      const previous={x:points[i].x+moved.x,y:points[i].y+moved.y};
      const position={x:lerp(lerp(points[i].x,previous.x,.2),wanted.x,.7),y:lerp(lerp(points[i].y,previous.y,.2),wanted.y,.7)};
      lastDir=unit({x:position.x-last.x,y:position.y-last.y});
      points[i]={x:last.x+lastDir.x*p.segmentLength,y:last.y+lastDir.y*p.segmentLength};last=points[i];
    }
    origin={...state.player};recoil*=.15;
  }
  function muzzle(){const head=state.barrel.at(-1);return{x:state.player.x+head.y,y:state.player.y-head.x};}
  function fire(shot){
    const p=weaponStats(config.weapon,config.rarity,state.charge),angle=shot.angle+(random()*2-1)*p.spread*Math.PI/180;
    const dir={x:Math.sin(angle),y:-Math.cos(angle)},v=p.speed+Math.max(0,state.player.vx*dir.x+state.player.vy*dir.y),pos=muzzle();
    const b={id:++serial,weapon:config.weapon,x:pos.x,y:pos.y,vx:dir.x*v,vy:dir.y*v,damage:p.damage,
      radius:p.radius,mass:p.mass,restitution:p.restitution,speed:p.speed,life:p.life,age:0,bounces:p.bounces,
      homing:config.homing,hitCharge:config.hitCharge,contacts:new Set(),ignoreUntil:-1,normalizeNext:false,path:[pos],dead:false,bornAt:state.time};
    state.bullets.push(b);state.shots++;recoil=p.recoil;
    emit('shot',{id:b.id,burst:shot.burst,scheduledAt:shot.at,angle,damage:b.damage,charge:state.charge});
  }
  function flight(b,dt){
    if(b.normalizeNext){const d=unit({x:b.vx,y:b.vy});b.vx=d.x*b.speed;b.vy=d.y*b.speed;b.normalizeNext=false;}
    if(b.homing){
      const candidates=state.targets.filter(t=>!t.dead).slice(0,50);
      const closest=candidates.sort((a,c)=>(a.x-b.x)**2+(a.y-b.y)**2-(c.x-b.x)**2-(c.y-b.y)**2)[0];
      if(closest)applyOriginalHoming(b,closest,config.rarity,config.hitCharge?state.charge:0);
      else b.homing=false; // The source removes bullets without a target from its tracking list.
    }
    for(const id of b.contacts){const t=state.targets.find(t=>t.id===id);if(!t||Math.hypot(b.x-t.x,b.y-t.y)>b.radius+t.radius+1)b.contacts.delete(id);}
    let remaining=Math.min(dt,b.life-b.age);
    for(let i=0;i<8&&remaining>1e-9&&!b.dead;i++){
      let first=null;
      for(const t of state.targets){if(t.dead||b.contacts.has(t.id))continue;const f=circleContact(b,t,remaining);if(f!==null&&(!first||f<first.f))first={f,t};}
      const bounds=[{axis:'x',value:b.radius,nx:1,ny:0},{axis:'x',value:state.width-b.radius,nx:-1,ny:0},
        {axis:'y',value:b.radius,nx:0,ny:1},{axis:'y',value:state.height-b.radius,nx:0,ny:-1}];
      for(const wall of bounds){const velocity=wall.axis==='x'?b.vx:b.vy;if((wall.nx||wall.ny)*velocity>=0)continue;
        const f=(wall.value-b[wall.axis])/(velocity*remaining);if(f>=0&&f<=1&&(!first||f<first.f))first={f,wall};}
      const f=first?.f??1;b.x+=b.vx*remaining*f;b.y+=b.vy*remaining*f;remaining*=1-f;
      if(!first)break;
      const t=first.t||{static:true,vx:0,vy:0,restitution:0};
      const n=first.wall?{x:first.wall.nx,y:first.wall.ny}:unit({x:b.x-t.x,y:b.y-t.y});
      collideBodies(b,t,n.x,n.y);b.normalizeNext=true;
      if(first.t)b.contacts.add(t.id);
      if(state.time>=b.ignoreUntil){
        state.collisions++;
        if(first.t){
          const actual=Math.min(t.hp,b.damage);t.hp-=actual;t.flash=.15;state.hits++;state.damage+=actual;
          if(b.hitCharge&&t.shouldTrigger)state.charge=Math.min(1,state.charge+hitChargeGain(config.rarity));
          emit('hit',{bulletId:b.id,targetId:t.id,damage:actual,charge:state.charge});
          if(t.hp<=0){t.dead=true;t.respawnAt=state.time+1.5;}
        }
        if(b.bounces>0){b.bounces--;if(first.t)b.ignoreUntil=state.time+.15;emit('collision-survived',{id:b.id,vx:b.vx,vy:b.vy});}
        else b.dead=true;
      }
      // A zero-restitution head-on wall hit stops; it must not loop at t=0.
      if(first.wall){b.x+=n.x*.01;b.y+=n.y*.01;}
    }
    b.age+=dt;if(b.age>=b.life-1e-9)b.dead=true;
    b.path.push({x:b.x,y:b.y});if(b.path.length>25)b.path.shift();
  }
  function tick(dt){
    state.time+=dt;
    state.charge=config.hitCharge?Math.max(0,state.charge-hitChargeDecay(config.rarity)*dt):0;
    barrelTick();elapsed+=dt;
    const stats=weaponStats(config.weapon,config.rarity,state.charge);
    if(config.firing&&elapsed+1e-9>=stats.interval){
      elapsed=0;const burst=++state.bursts,angle=Math.atan2(state.aim.x-state.player.x,state.player.y-state.aim.y);
      queue.push({at:state.time,angle,burst,remaining:stats.shots});
      emit('burst',{burst,shots:stats.shots,charge:state.charge,interval:stats.interval});
    }
    // Each awaited 0.06 s timer starts at the previous actual shot. Our 60 Hz
    // clock quantizes that wait, instead of catching up a whole burst at once.
    const ready=queue.filter(q=>q.at<=state.time+1e-9);queue=queue.filter(q=>q.at>state.time+1e-9);
    for(const q of ready){fire(q);if(q.remaining>1)queue.push({...q,remaining:q.remaining-1,at:state.time+.06});}
    let tracked=0;
    for(const b of state.bullets){if(b.homing&&++tracked>100)b.homing=false;if(b.bornAt<state.time)flight(b,dt);}
    for(const b of state.bullets)if(b.dead)emit('expired',{bullet:{weapon:b.weapon,x:b.x,y:b.y,vx:b.vx,vy:b.vy,damage:b.damage,radius:b.radius,homing:b.homing,age:b.age}});
    state.bullets=state.bullets.filter(b=>!b.dead);
    for(const t of state.targets){
      t.flash=Math.max(0,t.flash-dt);
      if(t.dead){if(state.time>=t.respawnAt)Object.assign(t,{dead:false,hp:t.maxHp,x:t.homeX,y:t.homeY,vx:0,vy:0});continue;}
      t.x+=t.vx*dt;t.y+=t.vy*dt;t.vx*=.91;t.vy*=.91; // Range dummy tether, not an original enemy AI.
      if(config.movingTargets){t.x+=Math.sin(state.time*1.3+t.homeX)*1200*dt;}
      t.vx+=(t.homeX-t.x)*dt*1.2;t.vy+=(t.homeY-t.y)*dt*1.2;
      t.x=Math.max(t.radius,Math.min(state.width-t.radius,t.x));t.y=Math.max(t.radius,Math.min(state.height-t.radius,t.y));
    }
  }
  resetBarrel();targets();
  return {state,config,muzzle,
    advance(dt){accumulator+=Math.min(.25,Math.max(0,dt));while(accumulator+1e-9>=PHYSICS_STEP){tick(PHYSICS_STEP);accumulator-=PHYSICS_STEP;}},
    aim(x,y){state.aim={x,y};},
    configure(next){if(next.weapon&&!ORIGINAL_WEAPONS[next.weapon])throw Error('未支持武器');Object.assign(config,next);config.rarity=Math.max(0,Math.min(5,Math.round(config.rarity)));
      state.bullets=[];queue=[];state.charge=0;elapsed=1;recoil=0;resetBarrel();},
    reset(){state.time=0;state.charge=0;state.shots=0;state.hits=0;state.damage=0;state.bursts=0;state.collisions=0;
      state.bullets=[];state.events=[];state.history=[];queue=[];elapsed=1;accumulator=0;recoil=0;rng=seed;serial=0;targets();resetBarrel();},
    takeEvents(){const e=state.events;state.events=[];return e;},
  };
}
