// Source-script visual lifecycle adapter. Host collision/damage stays external.
// This module consumes recorded events; it does not invent hits, raycasts or RNG.
import {resource,godotEase,transformPoint,IDENTITY} from './source-scene-sampler.mjs';
const clamp=x=>Math.max(0,Math.min(1,x));
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const basename=p=>p.split('/').at(-1).replace(/\.tscn$/,'');
const SOURCE_ROOT='res://scn/player/projectiles/';
export const LIFECYCLE_SOURCES=Object.freeze({
  laser:'scn/player/projectiles/laser_beam.gd',
  lightning:'scn/player/projectiles/lightning_beam.gd',
  shield:'scn/player/projectiles/operculum_shield.gd',
  magnetic:'scn/player/projectiles/magnetic_pull_area.gd',
});

function animations(graph,node){
  const result={};
  for(const [key,value]of Object.entries(node?.properties||{})){
    if(!key.startsWith('libraries/'))continue;
    const lib=resource(graph,value),prefix=key.slice(10);
    for(const [name,ref]of Object.entries(lib?.properties._data||{})){
      const a=resource(graph,ref);if(a)result[(prefix?prefix+'/':'')+name]=a.properties;
    }
  }
  return result;
}
function addOverride(context,path,props){context.overrides[path]={...context.overrides[path],...props};}
function mergeContext(context,extra){
  for(const key of ['overrides','linePoints','animationNames','animationTimes']){
    for(const [path,value]of Object.entries(extra?.[key]||{})){
      if(key==='overrides')addOverride(context,path,value);else context[key][path]=structuredClone(value);
    }
  }
}

/** Exact loop/random-call ordering from lightning_beam.gd:update_raycast.
 * randomValues must be a stable recorded or caller-generated stream of [0,1).
 * Branches are visual spawn descriptions; no host combat entity is created.
 */
export function buildLightningPath({endpoint,randomValues,playerBulletCount,splitOffChance=.13,maxDistance=2000,rootTransform=IDENTITY,globalRotation=0}){
  if(!Array.isArray(endpoint)||endpoint.length!==2||!endpoint.every(finite))throw Error('lightning endpoint required');
  const length=Math.hypot(...endpoint),splits=Math.floor(length/200),points=[[0,0]],branches=[];
  if(splits<=1)return {points:[...points,endpoint],branches,randomUsed:0,nextSplitOffChance:splitOffChance};
  if(!Array.isArray(randomValues))throw Error('lightning randomValues required for original random path');
  if(!Number.isInteger(playerBulletCount)||playerBulletCount<0)throw Error('lightning playerBulletCount required for original branch gate');
  const dir=endpoint.map(v=>v/length),segmentLength=length/splits;let cursor=0,chance=splitOffChance;
  const random=()=>{const v=randomValues[cursor++];if(!finite(v)||v<0||v>=1)throw Error('lightning randomValues exhausted or outside [0,1)');return v;};
  const range=(a,b)=>a+(b-a)*random();
  for(let i=0;i<splits-1;i++){
    const angle=range(-Math.PI/8,Math.PI/8),distance=segmentLength*range(.5,1.5),co=Math.cos(angle),si=Math.sin(angle);
    const point=[dir[0]*segmentLength*i+(dir[0]*co-dir[1]*si)*distance,dir[1]*segmentLength*i+(dir[0]*si+dir[1]*co)*distance];points.push(point);
    if(playerBulletCount<80&&random()<chance){
      chance*=.7;
      const angleOffset=range(-Math.PI/2,Math.PI/2),rotation=globalRotation+angleOffset;
      branches.push({scenePath:SOURCE_ROOT+'lightning_beam.tscn',localPosition:point,worldPosition:transformPoint(rootTransform,point),direction:[-Math.sin(rotation),Math.cos(rotation)],globalRotation:rotation,maxDistance:maxDistance-i*segmentLength,splitOffChance:chance,delay:range(.08,.25),sourceIteration:i});
    }
  }
  points.push(endpoint);return {points,branches,randomUsed:cursor,nextSplitOffChance:chance};
}

function laserPhase(available,input){
  const age=input.age,exitAt=finite(input.exitAt)?input.exitAt:finite(input.duration)?input.duration:null;
  const preMult=input.prefireTimeMultiplier??1,fireMult=input.fireTimeMultiplier??1;
  if(!(preMult>0&&fireMult>0))throw Error('laser time multipliers must be positive');
  const duration=name=>available[name]?.length??1;
  if(exitAt!==null&&age>=exitAt&&available.explode)return {name:'explode',time:age-exitAt,completed:age-exitAt>=duration('explode'),start:exitAt,origin:'host-exit-event'};
  if(available.prefire&&available.fire){
    const pre=input.skipPrefire?0:duration('prefire')*preMult;
    if(age+1e-7<pre)return {name:'prefire',time:age/preMult,start:0,origin:'source-queue'};
    if(available.fire.loop_mode||input.held===true)return {name:'fire',time:Math.max(0,age-pre)/fireMult,start:pre,origin:'source-queue'};
    const fire=duration('fire')*fireMult;
    if(age+1e-7<pre+fire)return {name:'fire',time:Math.max(0,age-pre)/fireMult,start:pre,origin:'source-queue'};
    return {name:'explode',time:Math.max(0,age-pre-fire),start:pre+fire,completed:age-pre-fire>=duration('explode'),origin:'source-queue'};
  }
  if(available.spawn){
    const spawn=duration('spawn');
    if(age+1e-7<spawn)return {name:'spawn',time:age,start:0,origin:'source-autoplay'};
    // continuous_laser_beam/freeze_ray_beam have a self.play("fire") key.
    if(available.fire)return {name:'fire',time:Math.max(0,age-spawn),start:spawn,origin:'source-method-play'};
    if(input.awaitHostExit)return {name:'spawn',time:spawn,start:0,origin:'host-held-body'};
    if(available.explode)return {name:'explode',time:Math.max(0,age-spawn),start:spawn,completed:age-spawn>=duration('explode'),origin:'source-queue'};
  }
  return {name:null,time:age,start:0,origin:'no-animation'};
}

/** Build source visual ctx plus explicit requests the host still owns.
 * `duration` means a host-supplied active-life limit; `exitAt` is an actual exit
 * event time. Neither changes source fade/linger duration.
 */
export function createLifecycleContext(graph,scenePath,input={}){
  const scene=graph.scenes[scenePath];if(!scene)throw Error('Unknown lifecycle scene '+scenePath);
  const age=input.age??input.time??0;if(!finite(age)||age<0)throw Error('age must be finite and nonnegative');
  input={...input,age};
  const root=scene.nodes.find(n=>n.path==='.'),props=root?.properties||{},name=basename(scenePath);
  const context={time:age,rootTransform:input.rootTransform||IDENTITY,overrides:{},linePoints:{},animationNames:{},animationTimes:{},captureProperties:input.captureProperties,damageRatio:input.damageRatio??1,widthGrow:input.widthGrow};
  const result={context,phase:'active',completed:false,childScenes:[],hostEvents:[],unsupported:[],provenance:[],sourceState:{}};
  const issue=(code,detail)=>result.unsupported.push({code,scenePath,detail});
  const host=(event,at,detail)=>result.hostEvents.push({event,at,owner:'host',detail});
  let exitAt=finite(input.exitAt)?input.exitAt:finite(input.duration)?input.duration:null;
  const player=scene.nodes.find(n=>n.path==='AnimationPlayer'&&n.type==='AnimationPlayer'),available=animations(graph,player);
  const script=props.script?.$external||'';
  const isBullet=['/bullet.gd','/rocket.gd','/grenade.gd','/harpoon_bullet.gd','/plasma_whip_bullet.gd','/orb.gd'].some(s=>script.endsWith(s));
  if(isBullet&&exitAt===null&&!input.awaitHostExit)exitAt=props.lifetime??1;
  if(script.endsWith('/explosion.gd'))exitAt=finite(input.explodeAt)?input.explodeAt:null;
  const isLaser=script.endsWith('/laser_beam.gd'),isLightning=script.endsWith('/lightning_beam.gd');
  if(isLaser||isLightning){
    result.provenance.push(LIFECYCLE_SOURCES.laser);
    const endpoint=input.localEndpoint||(finite(input.beamLength)?[0,input.beamLength]:null);
    if(endpoint){
      for(const node of scene.nodes.filter(n=>n.type==='Line2D')){
        if(node.properties.unique_name_in_owner){const first=node.properties.points?.[0]||[0,0];context.linePoints[node.path]=[first,endpoint];}
      }
    }else issue('raycast-endpoint-required','Pass localEndpoint or beamLength from actual host raycast; stored negative-Y point is editor data.');
    host('collision-and-damage',null,'Source hit/raycast/reflect logic is not executed by visual sampling.');
    host('laser-impact-sparks',null,'Spawn only from actual visible impact events; source interval .045s, reference width 120.');
  }
  if(isLaser){
    let phase;
    try{phase=laserPhase(available,input);}catch(e){issue('laser-phase',e.message);phase={name:null,time:age};}
    result.phase=phase.name||'active';result.completed=!!phase.completed;result.sourceState.animationOrigin=phase.origin;
    if(phase.name&&available[phase.name]){context.animationNames.AnimationPlayer=phase.name;context.animationTimes.AnimationPlayer=phase.time;}
    if(phase.name==='fire'&&available.spawn){
      // Preserve the completed width tween from spawn after self.play(fire).
      if(props.base_width)addOverride(context,'Visual/Line2D',{width:Math.max(5,props.base_width*Math.pow(input.damageRatio??1,.7))});
    }
    // Root _ready always sets this, independent of the editor-saved value.
    const visual=scene.nodes.find(n=>n.path==='Visual');
    if(visual)addOverride(context,'Visual',{scale:[visual.properties.scale?.[0]??1,1]});
  }else if(isLightning){
    result.provenance.push(LIFECYCLE_SOURCES.lightning);
    const naturalExit=.1,start=exitAt===null?naturalExit:Math.min(naturalExit,exitAt);
    const t=age<start?age/.1:(age-start)/.5;
    const from=age<start?[2.454227,2.454227,2.454227,1]:[2.0284429,2.454227,3.2944162,1];
    const to=age<start?[8.774323,10.5787325,14.139331,1]:[3.294,3.294,3.294,0];
    addOverride(context,'Visual/Line2D',{modulate:mix(from,to,godotEase(t,age<start?.61557305:.25000015)),width:Math.max(5,(props.base_width||37.5)*Math.pow(input.damageRatio??1,.7))});
    result.phase=age<start?'spawn':'explode';result.completed=age>=start+.5;
    if(input.linePoints?.['Visual/Line2D'])context.linePoints['Visual/Line2D']=input.linePoints['Visual/Line2D'];
    else if(input.localEndpoint||finite(input.beamLength)){
      try{
        const path=buildLightningPath({endpoint:input.localEndpoint||[0,input.beamLength],randomValues:input.randomValues,playerBulletCount:input.playerBulletCount,splitOffChance:input.splitOffChance??.13,maxDistance:input.maxDistance??props.max_dist??10000,rootTransform:context.rootTransform,globalRotation:input.globalRotation??Math.atan2(context.rootTransform[1],context.rootTransform[0])});
        context.linePoints['Visual/Line2D']=path.points;result.childScenes=path.branches;result.sourceState.randomUsed=path.randomUsed;result.sourceState.splitOffChance=path.nextSplitOffChance;
      }catch(e){issue('lightning-random-path',e.message);}
    }
    host('lightning-hit',.0333333,'Source schedules hit; caller uses actual host combat event.');
  }else if(name==='operculum_shield'){
    result.provenance.push(LIFECYCLE_SOURCES.shield);
    const size=input.sizeScale??props.size_scale??1,grow=.15+.85*(1-(1-clamp(age/.3))**3);
    addOverride(context,'Visual',{scale:[size*grow,size*grow]});
    result.phase=age<.3?'spawn':'active';
    const hits=(input.hitEvents||[]).filter(h=>finite(h.at)&&h.at<=age).sort((a,b)=>a.at-b.at);
    if(hits.length){
      const event=hits.at(-1),elapsed=age-event.at;
      const prior=event.modulateBefore??[1,1,1,1];
      if(elapsed<.04)addOverride(context,'Visual',{modulate:mix(prior,[2,2,2,1],elapsed/.04)});
      else if(elapsed<.16)addOverride(context,'Visual',{modulate:mix([2,2,2,1],[1,1,1,1],(elapsed-.04)/.12)});
      if(hits.length>1&&hits.at(-2).at>event.at-.16&&!event.modulateBefore)issue('shield-overlapping-hit-tweens','Original starts overlapping tweens without killing prior; provide modulateBefore/overrides captured by host for exact overlap.');
    }
    const breakAt=input.breakAt,sourceExpiry=input.lifetime??props.lifetime??14;
    const end=[exitAt,breakAt,sourceExpiry].filter(finite).reduce((a,b)=>Math.min(a,b),Infinity);
    if(age>=end){result.phase='exit';const alpha=(input.exitAlpha??1)*(1-clamp((age-end)/.3));addOverride(context,'.',{modulate:[...(props.modulate||[1,1,1,1]).slice(0,3),alpha]});result.completed=age>=end+.3;}
    host('shield-hits-and-reflections',null,'Hit events and max-hit break originate from host; adapter never invents hits.');
  }else if(name==='magnetic_pull_area'){
    result.provenance.push(LIFECYCLE_SOURCES.magnetic);
    const lingerAt=finite(input.lingerAt)?input.lingerAt:exitAt;
    if(lingerAt!==null){
      const t=age-lingerAt;
      if(t>=0)result.phase=t<1.2?'linger':'fade';
      if(t>=1.2){addOverride(context,'Visual/particle_pull',{emitting:false});addOverride(context,'.',{modulate:[1,1,1,1-clamp((t-1.2)/.3)]});result.sourceState.particleStopAge=lingerAt+1.2;}
      result.completed=t>=1.5;
    }
    host('magnetic-follow-position',null,'Source follows source_attack.global_position while valid; supply rootTransform from actual tracked source.');
    host('magnetic-collision-and-timer',null,'Timer .5s clears hit_enemies and queries overlaps; visual adapter does not apply damage.');
  }else{
    const selected=input.animationName||player?.properties.autoplay;
    if(input.event==='explode'&&available.explode){context.animationNames.AnimationPlayer='explode';context.animationTimes.AnimationPlayer=age;result.phase='explode';result.completed=age>=(available.explode.length??1);}
    else if(exitAt!==null&&age>=exitAt&&available.explode){context.animationNames.AnimationPlayer='explode';context.animationTimes.AnimationPlayer=age-exitAt;result.phase='explode';result.completed=age-exitAt>=(available.explode.length??1);}
    else if(selected){context.animationNames.AnimationPlayer=selected;context.animationTimes.AnimationPlayer=age;result.phase=selected;}
    else if(available.explode){issue('explicit-source-event-required','Scene has no autoplay; pass event=explode or animationName after the host actually triggers it.');}
    const known=['/bullet.gd','/rocket.gd','/grenade.gd','/harpoon_bullet.gd','/plasma_whip_bullet.gd','/orb.gd','/slash.gd','/dual_blades_attack.gd','/spear_active.gd','/player_toxin.gd','/burn_trail.gd','/explosion.gd'];
    if(script&&!known.some(s=>script.endsWith(s)))issue('unported-script-lifecycle',script);
  }
  // Script setters and _ready are executed by Godot before scene animations.
  // These overrides reproduce only script-owned properties (never reset tracks).
  const frames=(elapsed,explicit)=>Number.isInteger(explicit)?explicit:finite(input.physicsFps)?Math.floor(Math.max(0,elapsed)*input.physicsFps):null;
  if(isBullet){
    result.provenance.push('scn/player/projectiles/bullet.gd');
    const count=frames(age,input.physicsFrames);
    if(count===null)issue('physics-frame-state-required','Bullet _ready hides until first physics frame; pass physicsFrames or physicsFps.');
    addOverride(context,'.',{visible:count===null?false:count>=1});
    const size=Math.sqrt(input.damageRatio??((props.damage??1)/(props.base_damage??1)*(props.scale_mult??1)))*(input.visualZoomMultiplier??1);
    // Spawn animation is authoritative for scale where it has a scale track.
    const anim=available[context.animationNames.AnimationPlayer];
    if(!script.endsWith('/orb.gd')&&!Object.entries(anim||{}).some(([k,v])=>k.endsWith('/path')&&['Visual:scale','%Visual:scale'].includes(v)))addOverride(context,'Visual',{scale:[size,size]});
    if(input.visualRotation!==undefined)addOverride(context,'Visual',{rotation:input.visualRotation});
    host('bullet-velocity-direction',null,'Host rootTransform/visualRotation supplies shoot/fix_visual_dir orientation and momentum; collision events stay host-owned.');
  }
  if(script.endsWith('/harpoon_bullet.gd')){
    const end=input.harpoonEndpoint;addOverride(context,'Line2D',{visible:Array.isArray(end)&&Math.hypot(...end)<2500});
    if(end)context.linePoints.Line2D=[[0,0],end];
    host('harpoon-connect-bodies',null,'Pass harpoonEndpoint from tracked last_body; new persistent chains require actual connect_bodies events.');
  }
  if(script.endsWith('/plasma_whip_bullet.gd')){
    if(Array.isArray(input.followTargetPosition)&&Array.isArray(input.trailerPosition)){
      const direction=input.followTargetPosition.map((v,i)=>v-input.trailerPosition[i]);
      if(Math.hypot(...direction)>1)addOverride(context,'Visual',{rotation:Math.atan2(direction[1],direction[0])+Math.PI/2-Math.atan2(context.rootTransform[1],context.rootTransform[0])-(props.rotation||0)});
    }
    host('plasma-whip-follow-physics',null,'Host supplies followTargetPosition/trailerPosition for visual orientation and owns pull impulses.');
    result.provenance.push('scn/player/projectiles/plasma_whip_bullet.gd');
  }
  if(script.endsWith('/orb.gd')){
    if(input.growMultiplier!==undefined){
      if(!finite(input.growMultiplier)||input.growMultiplier<=0)issue('invalid-orb-grow','growMultiplier must be positive.');
      else addOverride(context,'Visual',{scale:(scene.nodes.find(n=>n.path==='Visual').properties.scale||[1,1]).map(x=>x*input.growMultiplier)});
    }
    if(result.phase==='explode'&&!input.captureProperties)issue('orb-capture-state-required','Pass Visual/Circle scale and modulate at explode entry; original UPDATE_CAPTURE blends from actual state.');
    host('orb-piercing-timer',null,'Host .2-second timer owns overlap collisions; update_size is intentionally empty and grow applies only to children.');
    result.provenance.push('scn/player/projectiles/orb.gd');
  }
  if(script.endsWith('/dual_blades_attack.gd')){
    const selected='attack'+((input.combo??props.combo??0)+1);
    context.animationNames.AnimationPlayer=selected;context.animationTimes.AnimationPlayer=age;result.phase=selected;
    if(!available[selected])issue('invalid-combo-animation',selected);
  }
  if(script.endsWith('/spear_active.gd'))host('spear-orientation',null,'Host rootTransform must preserve original shoot rotation throughout the attack.');
  if(script.endsWith('/player_toxin.gd')||script.endsWith('/burn_trail.gd')){
    const toxin=script.endsWith('/player_toxin.gd'),lifetime=input.lifetime??props.lifetime??(toxin?3:2.5);
    const speed=(toxin?8:3)/lifetime;
    context.animationTimes.AnimationPlayer=age*speed;
    const random=input.randomValues;
    if(!Array.isArray(random)||random.length<3||!random.slice(0,3).every(x=>finite(x)&&x>=0&&x<1))issue('source-random-initialization-required','Pass three [0,1) values: global rotation, scale, relative 8s linear rotation tween.');
    else{
      const size=.9+.2*random[1],globalAngle=random[0]*Math.PI*2+(-2+4*random[2])*clamp(age/8);
      const parentAngle=Math.atan2(context.rootTransform[1],context.rootTransform[0]);
      addOverride(context,'.',{rotation:globalAngle-parentAngle,scale:(props.scale||[1,1]).map(x=>x*size)});
      result.sourceState.randomUsed=3;
    }
    result.provenance.push(script.replace('res://',''));
    host('area-overlap-damage',null,'Actual overlaps/timer ticks own damage and burn-status spawning.');
  }
  // Explosion._ready hides the entire scene. Child explosions reparent to world
  // when triggered, so return a detached child description instead of tying its
  // half-second animation to the bullet's shorter queue_free animation.
  for(const node of scene.nodes.filter(n=>n.properties.script?.$external?.endsWith('/explosion.gd'))){
    const path=node.path,p=node.properties,isRoot=path==='.';
    const eventAt=isRoot?(input.event==='explode'?0:exitAt):exitAt;
    const triggered=eventAt!==null&&age>=eventAt;
    const prefix=isRoot?'':path+'/';
    addOverride(context,path,{visible:false,scale:[(p.radius??500)/500,(p.radius??500)/500]});
    context.animationNames[prefix+'AnimationPlayer']='';
    if(triggered&&!isRoot){
      const sourcePath=node.origins.find(o=>o.node==='.')?.scene;
      result.childScenes.push({kind:'detached-explosion',scenePath:sourcePath,sourceNodePath:path,sourceProperties:p,at:eventAt,age:age-eventAt,input:{event:'explode',age:age-eventAt,physicsFps:input.physicsFps,explosionPhysicsFrames:input.explosionPhysicsFrames,explosionRotation:input.explosionRotation,rootTransform:context.rootTransform,overrides:{'.':{scale:[(p.radius??500)/500,(p.radius??500)/500]}}}});
    }else if(triggered){
      const elapsed=age-eventAt,count=frames(elapsed,input.explosionPhysicsFrames);
      if(count===null)issue('explosion-physics-frame-state-required','Explosion becomes visible after two physics frames; pass explosionPhysicsFrames or physicsFps.');
      addOverride(context,path,{visible:count!==null&&count>=2});
      context.animationNames[prefix+'AnimationPlayer']='explode';context.animationTimes[prefix+'AnimationPlayer']=elapsed;
      if(!finite(input.explosionRotation))issue('explosion-random-rotation-required','Provide actual random global rotation from Explosion.explode.');
      else addOverride(context,path,{rotation:input.explosionRotation-Math.atan2(context.rootTransform[1],context.rootTransform[0])});
      host('explosion-overlap-damage',eventAt,'Original damage begins after four physics frames; actual collision/combat stays host-owned.');
    }else{
      const pre=scene.nodes.find(n=>n.path===prefix+'PreexplodeVisual');
      const preDuration=isRoot?(input.preexplodeDuration??p.preexplode_on_ready??0):(props.lifetime??1)-.01;
      if(pre?.properties.visible!==false&&preDuration>0){
        const count=frames(age,input.physicsFrames),wait=isRoot?1:2;
        if(count===null)issue('preexplode-physics-frame-state-required','Preexplode becomes visible after source physics-frame delay; pass physicsFrames or physicsFps.');
        addOverride(context,path,{visible:count!==null&&count>=wait});
        const callAt=isRoot?0:(input.firstPhysicsAt??(finite(input.physicsFps)?1/input.physicsFps:0));
        context.animationNames[prefix+'AnimationPlayer']='preexplode';context.animationTimes[prefix+'AnimationPlayer']=Math.max(0,age-callAt)/preDuration;
        if(!isRoot&&!finite(input.firstPhysicsAt)&&!finite(input.physicsFps))issue('first-physics-time-required','Pass firstPhysicsAt or physicsFps to position nested preexplode animation precisely.');
      }
    }
    result.provenance.push('scn/environ/explosion.gd');
  }
  mergeContext(context,input);
  // A host projectile can die before a source-only area/attack clip ends.
  // Remove its damaging body immediately; keep particle nodes alive so stopAge
  // can finish already emitted tails. Explicit explode animations still own
  // their authored exit and are deliberately excluded.
  if(input.hostProjectileLifetime&&exitAt!==null&&age>=exitAt&&!available.explode){
    for(const node of scene.nodes)if(['Sprite2D','AnimatedSprite2D','Line2D','Polygon2D'].includes(node.type))
      addOverride(context,node.path,{visible:false});
    result.phase='exit';
  }
  if(result.completed)addOverride(context,'.',{visible:false});
  const acceptedHostMethods=new Set(['hit','_on_hit','enemy_hit','missed_hit','_on_body_entered','clear_hit_enemies']);
  context.methodHandler=(event,state)=>{
    if(acceptedHostMethods.has(event.method)){host(event.method,event.at,{nodePath:event.nodePath,animation:event.animation,source:'animation-method-track'});return true;}
    return input.methodHandler?.(event,state)===true;
  };
  return result;
}
