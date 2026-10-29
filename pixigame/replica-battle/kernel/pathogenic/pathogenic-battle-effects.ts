import {isLegendaryIceShard,legendaryIceShardMeshes,withLegendaryIceShardResources} from './ice-shard-presentation.mjs';
import type {Effect,Projectile} from '../model';
import {COMBAT_LAYERS,HitSparkAdmission} from '../combat-readability.mjs';
import {ProjectileMotionAccents,withProjectileMotionResources} from './projectile-motion-accents.mjs';
import {projectilePalette} from './projectile-palette.mjs';
import {bossBallVisualScale} from './boss-ball-presentation.mjs';
import {enemySpriteFootprint} from './enemy-sprite-footprint.mjs';
import {IceWeaponTrails} from './ice-weapon-trails.mjs';
import {SwordEnergyTrails} from './sword-energy-trails.mjs';
import {IaidoVfx} from './iaido-vfx.mjs';
import {isAcidRainCloud,acidCloudScreenMeshes} from './acid-cloud-presentation.mjs';
import {isAreaWeaponPresentation,areaWeaponScreenMeshes} from './area-weapon-presentation.mjs';
import {isAircraftPulse,aircraftPulseScreenMeshes} from './aircraft-pulse-presentation.mjs';
import {isDimensionSword,dimensionSwordScreenMeshes} from './dimension-sword-presentation.mjs';
import {isConstructWeapon,constructWeaponScreenMeshes} from './construct-weapon-presentation.mjs';
import {isCorrectedStatus,correctedStatusScreenMeshes} from './status-presentation.mjs';
import {isCorrectedEnemyProjectile,correctedEnemyProjectileMeshes} from './enemy-projectile-presentation.mjs';
import {PathogenicSceneView,SourceCoverageError} from './pathogenic-scene-view';
import {createLifecycleContext} from './pathogenic-lifecycle.mjs';
import {sampleScene,resource} from './source-scene-sampler.mjs';
import {projectileScene,effectScene,statusScene,ENEMY_ROUND_BULLET_SCENE} from './pathogenic-routing.mjs';
import {godotRandom,gradientSample} from './pathogenic-particles.mjs';
import {projectilePresentation,effectPresentation,withScorchPresentationResources} from './pathogenic-host-presentation.mjs';
import {isNativeSwordSwing,nativeSwordScreenMeshes} from './native-sword-footprint';
type Row=Record<string,any>;
export type ScreenPoint={x:number;y:number};
export type BeamQuery={origin:ScreenPoint;direction:ScreenPoint;maxDistance:number;sourceId:string;scenePath:string;seed:number;birthTime:number};
export type BeamResult={endpoint:ScreenPoint;hit?:boolean;normal?:ScreenPoint};
export type BattleEffectsHost={playerBulletCount?:()=>number;raycastBeam?:(query:BeamQuery)=>BeamResult;screenPointVisible?:(point:ScreenPoint)=>boolean;physicsFps?:number;view?:any;nativeSwordEffects?:Row};
type Entry={path:string;age:number;bornAt:number;lastSeen:number;seenRevision:number;lastDraw:number;exitAt?:number;pose:Row;poseCamera:[number,number];randomValues:number[];seed:number;duration?:number;retention:number;independent?:boolean;retireImmediately?:boolean;capture?:Row;children:Set<string>;lightningPoints?:number[][];scheduled?:Row;hitEvents:Row[];stopAge?:number;seenHits?:Map<number,number>;sparkCooldown?:number;sparkTime?:number;sparkCount?:number};
const PREFIRE='res://scn/player/projectiles/staurolaser_beam.tscn';
const finite=(x:any)=>typeof x==='number'&&Number.isFinite(x);
const graphRoot=(graph:Row,path:string)=>graph.scenes[path].nodes.find((n:Row)=>n.path==='.');
const rootProps=(graph:Row,path:string)=>graph.scenes[path].nodes.find((n:Row)=>n.path==='.').properties;
/** Combat/raycast stay in the host; sourcePixelScale converts source pixels to screen pixels. */
export class PathogenicBattleEffects {
  private hitAdmission=new HitSparkAdmission();
  private motionAccents=new ProjectileMotionAccents();
  private entries=new Map<string,Entry>();private run=-1;private clock=0;private revision=0;private frameCount?:number;private host:BattleEffectsHost;private camera:[number,number]=[0,0];
  readonly source:PathogenicSceneView;
  readonly iceTrails:IceWeaponTrails;
  readonly swordTrails:SwordEnergyTrails;
  readonly iaido:IaidoVfx;
  readonly audit={draws:0,legacyDraws:0,scenes:new Set<string>(),issues:[] as any[],events:[] as any[]};
  constructor(readonly scene:any,readonly graph:Row,readonly sourcePixelScale=.25,host:BattleEffectsHost={}){this.host=host;this.graph=withLegendaryIceShardResources(withProjectileMotionResources(withScorchPresentationResources(graph)));this.source=host.view??new PathogenicSceneView(scene,this.graph);this.iceTrails=new IceWeaponTrails(scene,sourcePixelScale);this.swordTrails=new SwordEnergyTrails(this.source);this.iaido=new IaidoVfx(this.source);}
  setCameraOffset(x:number,y:number){this.camera=[x,y];this.source.setCameraOffset(x,y);}
  configureHost(host:BattleEffectsHost){this.host={...this.host,...host};}
  preload(urlFor:(p:string,t:Row)=>string){this.source.preload(urlFor);}
  beginFrame(clock:number,run:number,frame:{playerBulletCount?:number}={}){if(run!==this.run||clock<this.clock){this.reset();this.run=run;}this.revision++;this.clock=clock;this.hitAdmission.beginFrame(clock);this.motionAccents.beginFrame();this.frameCount=frame.playerBulletCount;this.source.beginFrame(clock);this.iceTrails.beginFrame(clock,this.camera);this.swordTrails.beginFrame(clock,this.camera);this.iaido.beginFrame(clock,this.camera);}
  private fail(code:string,detail:any):never{const issue={code,detail};this.audit.issues.push(issue);throw new SourceCoverageError([issue]);}
  private pose(point:ScreenPoint,angle:number,scale:number){const s=this.sourcePixelScale*scale,c=Math.cos(angle),n=Math.sin(angle);return[c*s,n*s,-n*s,c*s,point.x,point.y];}
  private make(path:string,age:number,seed:number,pose:Row,duration?:number):Entry{
    const random=godotRandom(seed),tails=this.graph.scenes[path].nodes.filter((n:Row)=>n.type==='GPUParticles2D').map((n:Row)=>{
      const p={...n.properties,...pose.overrides?.[n.path]},speed=p.speed_scale??1;
      return speed>0?((p.lifetime??1)+(p.trail_enabled?(p.trail_lifetime??.3):0))/speed:Infinity;
    });
    const retention=Math.max(8,...tails)+1/(this.host.physicsFps??60);
    return{path,age,bornAt:this.clock-age,lastSeen:this.clock,seenRevision:this.revision,lastDraw:-Infinity,pose:structuredClone(pose),poseCamera:[...this.camera],seed,randomValues:Array.from({length:2048},()=>Math.min(1-Number.EPSILON,random())),duration,retention,children:new Set(),hitEvents:[]};
  }
  private emit(id:string,path:string,age:number,seed:number,pose:Row,duration?:number,retireImmediately=false){
    pose={...pose,hostOwnsEvents:true,splitOffChance:0};
    let entry=this.entries.get(id);if(!entry||entry.path!==path||age<entry.age-1e-7){entry=this.make(path,age,seed,pose,duration);this.entries.set(id,entry);}
    entry.age=age;entry.lastSeen=this.clock;entry.seenRevision=this.revision;entry.exitAt=undefined;entry.stopAge=undefined;entry.pose=structuredClone(pose);entry.poseCamera=[...this.camera];entry.duration=finite(duration)?duration:undefined;entry.retireImmediately=retireImmediately;return this.draw(id,entry);
  }
  private playerCount(){
    const count=this.frameCount??this.host.playerBulletCount?.();if(!Number.isInteger(count)||(count as number)<0)this.fail('host-player-bullet-count-required',count);
    let generated=0;for(const e of this.entries.values())if(e.independent&&e.path.endsWith('/lightning_beam.tscn')&&e.bornAt<=this.clock&&this.clock-e.bornAt<.6)generated++;
    return (count as number)+generated;
  }
  private input(entry:Entry,age=entry.age):Row{
    const input:Row={age,duration:entry.duration,lifetime:entry.duration,exitAt:entry.exitAt,physicsFps:this.host.physicsFps??60,explosionRotation:entry.randomValues[10]*Math.PI*2,randomValues:entry.randomValues,...entry.pose};
    if(input.rootTransform){input.rootTransform=[...input.rootTransform];input.rootTransform[4]+=this.camera[0]-entry.poseCamera[0];input.rootTransform[5]+=this.camera[1]-entry.poseCamera[1];}
    if(entry.path.endsWith('/lightning_beam.tscn')){input.playerBulletCount=this.playerCount();if(entry.lightningPoints)input.linePoints={'Visual/Line2D':entry.lightningPoints};}
    if(entry.capture)input.captureProperties=entry.capture;if(entry.hitEvents.length)input.hitEvents=entry.hitEvents;return input;
  }
  private captureExit(entry:Entry){
    if(entry.capture||!entry.path.endsWith('/orb.tscn'))return;
    const at=entry.exitAt??entry.duration??(entry.pose.awaitHostExit?Infinity:rootProps(this.graph,entry.path).lifetime??1);if(entry.age<at)return;
    // Select outgoing phase just before the transition, evaluate its exact exit time.
    const before=this.input(entry,Math.max(0,at-1e-8));delete before.exitAt;delete before.duration;
    before.animationNames={AnimationPlayer:'spawn'};before.animationTimes={AnimationPlayer:at};
    const life=createLifecycleContext(this.graph,entry.path,before),sample:any=sampleScene(this.graph,entry.path,life.context),node=sample.nodes.find((n:Row)=>n.path==='Visual/Circle');
    if(!node)this.fail('orb-capture-node-missing',entry.path);
    entry.capture={'Visual/Circle':{scale:structuredClone(node.properties.scale),modulate:structuredClone(node.properties.modulate)}};
  }
  private spawnChildren(id:string,entry:Entry,life:Row){
    if(entry.pose.hostOwnsEvents)return;
    for(const [i,child]of life.childScenes.entries()){
      const key=`${id}:child:${i}`;if(entry.children.has(key))continue;entry.children.add(key);if(!child.scenePath)this.fail('child-scene-descriptor',child);
      let copy:Entry;
      if(child.kind==='detached-explosion'){
        const pose={...child.input,projectilePalette:entry.pose.projectilePalette};delete pose.age;delete pose.physicsFps;
        // Source rocket explosions also exist independently of host hit FX.
        // Shrink the four basis coefficients, preserving the impact position.
        if(entry.path.endsWith('/rocket.tscn')&&pose.rootTransform){
          const impact={scale:.18,palette:entry.pose.projectilePalette};
          pose.rootTransform=pose.rootTransform.map((value:number,index:number)=>index<4?value*impact.scale:value);
          pose.projectilePalette=impact.palette;
        }
        const born=entry.bornAt+child.at;copy=this.make(child.scenePath,Math.max(0,this.clock-born),entry.seed+i+1,pose);copy.bornAt=born;
      }else{copy=this.make(child.scenePath,0,(entry.seed*1664525+i+1013904223)>>>0,{projectilePalette:entry.pose.projectilePalette});copy.bornAt=entry.bornAt+child.delay;copy.scheduled=structuredClone(child);}
      copy.independent=true;this.entries.set(key,copy);
    }
  }
  private activateBranch(id:string,entry:Entry){
    const child=entry.scheduled;if(!child)return;if(!this.host.raycastBeam)this.fail('host-branch-raycast-required',{sourceId:id,child});
    const direction={x:child.direction[0],y:child.direction[1]},origin={x:child.worldPosition[0]+this.camera[0]-entry.poseCamera[0],y:child.worldPosition[1]+this.camera[1]-entry.poseCamera[1]},scale=child.sourceScale??this.sourcePixelScale;
    const query={origin,direction,maxDistance:Math.max(0,child.maxDistance)*scale,sourceId:id,scenePath:entry.path,seed:entry.seed,birthTime:entry.bornAt},ray=this.host.raycastBeam!(query);
    if(!ray?.endpoint||![ray.endpoint.x,ray.endpoint.y].every(finite))this.fail('invalid-host-branch-raycast',ray);
    const dx=ray.endpoint.x-origin.x,dy=ray.endpoint.y-origin.y,distance=Math.hypot(dx,dy);if(distance>query.maxDistance+1e-4)this.fail('branch-raycast-out-of-range',{query,ray});
    const angle=child.globalRotation,c=Math.cos(angle),s=Math.sin(angle);
    entry.pose={projectilePalette:entry.pose.projectilePalette,rootTransform:[c*scale,s*scale,-s*scale,c*scale,origin.x,origin.y],localEndpoint:[(dx*c+dy*s)/scale,(-dx*s+dy*c)/scale],maxDistance:child.maxDistance,splitOffChance:child.splitOffChance,globalRotation:angle,impactProbe:query};
    entry.poseCamera=[...this.camera];entry.scheduled=undefined;this.audit.events.push({type:'source-lightning-branch',id,at:entry.bornAt,query,hit:ray.hit??false});
  }
  private impactSparks(id:string,entry:Entry,life:Row,sample:Row){
    if(entry.pose.hostOwnsEvents)return;
    const probe=entry.pose.impactProbe,props=rootProps(this.graph,entry.path),script=props.script?.$external||'';
    if(!probe||!['/laser_beam.gd','/lightning_beam.gd'].some(s=>script.endsWith(s))||props.impact_sparks===false||!['spawn','fire'].includes(life.phase))return;
    if(!props.update_each_frame&&!props.continuous_hit&&(entry.sparkCount??0)>0)return;
    if(!this.host.raycastBeam)this.fail('host-impact-raycast-required',{id,probe});
    const query={...probe,origin:{x:probe.origin.x+this.camera[0]-entry.poseCamera[0],y:probe.origin.y+this.camera[1]-entry.poseCamera[1]},sourceId:id,scenePath:entry.path,seed:entry.seed,birthTime:entry.bornAt},hit=this.host.raycastBeam!(query);
    const delta=entry.sparkTime===undefined?1/(this.host.physicsFps??60):Math.max(0,this.clock-entry.sparkTime);entry.sparkTime=this.clock;
    if(!hit?.hit)return;
    entry.sparkCooldown=(entry.sparkCooldown??0)-delta;if(entry.sparkCooldown>1e-9)return;entry.sparkCooldown=entry.pose.compactImpact?.075:.045;
    const point=hit.endpoint,w=this.scene.scale?.width,h=this.scene.scale?.height;
    const visible=this.host.screenPointVisible?.(point)??(!finite(w)||!finite(h)||(point.x>=0&&point.y>=0&&point.x<w&&point.y<h));if(!visible)return;
    const line=sample.lines.find((n:Row)=>n.nodePath==='Visual/Line2D'),node=sample.nodes.find((n:Row)=>n.path==='Visual/Line2D');if(!line||!node)return;
    const width=line.width*Math.abs(node.properties.scale?.[0]??1),factor=Math.max(.5,Math.min(5.5,width/120))*(entry.pose.compactImpact?.35:1);
    const texture=resource(this.graph,node.properties.texture);let color=texture?.type==='GradientTexture2D'?gradientSample(this.graph,texture.properties.gradient,.5):[1,1,1,1];
    color=color.map((v:number,i:number)=>v*node.selfColor[i]);const peak=Math.max(...color.slice(0,3));if(peak>1.4)color=color.map((v:number)=>v*1.4/peak);color[3]=1;
    const sparkPath='res://scn/particles/laser_spark_particle.tscn',spark=graphRoot(this.graph,sparkPath),material=resource(this.graph,spark.properties.process_material);
    const normal=hit.normal&&Math.hypot(hit.normal.x,hit.normal.y)>0?hit.normal:{x:-probe.direction.x,y:-probe.direction.y},angle=Math.atan2(normal.y,normal.x),scale=Math.hypot(entry.pose.rootTransform[0],entry.pose.rootTransform[1])*.2;
    const c=Math.cos(angle),s=Math.sin(angle),count=entry.sparkCount??0,key=`${id}:spark:${count}`;
    const child=this.make(sparkPath,0,(entry.seed+count+104729)>>>0,{projectilePalette:entry.pose.projectilePalette,rootTransform:[c*scale,s*scale,-s*scale,c*scale,point.x,point.y],overrides:{'.':{emitting:true,modulate:color,process_material:{...material,properties:{...material.properties,scale_min:.12*factor,scale_max:.24*factor,emission_box_extents:[4,width*.5,1]}}}}});
    child.independent=true;this.entries.set(key,child);entry.sparkCount=count+1;this.audit.events.push({type:'source-laser-impact-spark',id,at:this.clock,point,width,normal});
  }
  private observeHits(b:Row){
    const entry=this.entries.get(`projectile:${b.uid}`);if(!entry||!(b.hitTimes instanceof Map))return;
    entry.seenHits??=new Map();
    for(const[target,at]of b.hitTimes){if(!finite(at)||at<0||entry.seenHits.get(target)===at)continue;entry.seenHits.set(target,at);this.projectileHit(b.uid,at,{targetUid:target,source:'host-hitTimes'});}
  }
  private draw(id:string,entry:Entry){
    if(entry.bornAt>this.clock||entry.lastDraw===this.revision)return;this.activateBranch(id,entry);this.captureExit(entry);
    const input=this.input(entry);
    const life:any=createLifecycleContext(this.graph,entry.path,input);if(life.unsupported.length){this.audit.issues.push(...life.unsupported);throw new SourceCoverageError(life.unsupported);}
    if(entry.path.endsWith('/lightning_beam.tscn')&&!entry.lightningPoints){if(!entry.pose.refreshLightningPath)entry.lightningPoints=structuredClone(life.context.linePoints['Visual/Line2D']);const m=entry.pose.rootTransform,scale=Math.hypot(m[0],m[1]);for(const c of life.childScenes)c.sourceScale=scale;}
    this.spawnChildren(id,entry,life);const stop=entry.path.endsWith('/magnetic_pull_area.tscn')?life.sourceState.particleStopAge:(life.sourceState.particleStopAge??entry.stopAge??entry.exitAt);
    let result:Row|undefined;
    if(!life.completed){const sampled=this.source.draw(id,entry.path,{...life.context,projectilePalette:entry.pose.projectilePalette,presentationDepth:entry.pose.presentationDepth,presentationOpacity:entry.pose.presentationOpacity,seed:entry.seed,stopAge:stop});result=sampled;this.impactSparks(id,entry,life,sampled);}
    entry.lastDraw=this.revision;this.audit.draws++;this.audit.scenes.add(entry.path);return result;
  }
  projectile(b:Projectile&Row,screen:(x:number,z:number)=>ScreenPoint,element=0){
    if(b.dead||b.visualHidden)return;
    if(isLegendaryIceShard(b)){
      const meshes=legendaryIceShardMeshes(b,screen);
      if(meshes.length){this.source.drawMeshes(`projectile:${b.uid}:ice-shard`,meshes,undefined,{presentationDepth:COMBAT_LAYERS.playerShot});this.audit.draws++;this.audit.scenes.add('host:legendary-ice-shard');}
      return;
    }
    if(this.iaido.projectile(b,screen))return;
    if(b.owner==='enemy')this.motionAccents.projectile(b,screen,element);
    if(isConstructWeapon(b)||isCorrectedEnemyProjectile(b)){
      const category=isConstructWeapon(b)?'construct':'enemy-projectile';
      const meshes=isConstructWeapon(b)?constructWeaponScreenMeshes(b,screen):correctedEnemyProjectileMeshes(b,screen);
      if(meshes.length){this.source.drawMeshes(`projectile:${b.uid}:${category}`,meshes,category==='enemy-projectile'?projectilePalette(b,element):undefined,{presentationDepth:category==='enemy-projectile'?COMBAT_LAYERS.enemyShot:COMBAT_LAYERS.playerShot});this.audit.draws++;this.audit.scenes.add(`host:${category}`);}
      return;
    }
    if(isAreaWeaponPresentation(b)||isAircraftPulse(b)||isDimensionSword(b)){
      const category=isAircraftPulse(b)?'aircraft-pulse':isDimensionSword(b)?'dimension-sword':'area-weapon';
      const meshes=isAircraftPulse(b)?aircraftPulseScreenMeshes(b,screen):isDimensionSword(b)?dimensionSwordScreenMeshes(b,screen):areaWeaponScreenMeshes(b,screen);
      if(meshes.length){this.source.drawMeshes(`projectile:${b.uid}:${category}`,meshes,undefined,{presentationDepth:COMBAT_LAYERS.area,presentationOpacity:.82});this.audit.draws++;this.audit.scenes.add(`host:${category}`);}
      return;
    }
    if(isAcidRainCloud(b)){
      const meshes=acidCloudScreenMeshes(b,screen);
      if(meshes.length){this.source.drawMeshes(`projectile:${b.uid}:acid-cloud`,meshes,undefined,{presentationDepth:COMBAT_LAYERS.area,presentationOpacity:.76});this.audit.draws++;this.audit.scenes.add('host:acid-rain-cloud');}
      return;
    }
    const palette=projectilePalette(b,element),presentationDepth=b.owner==='enemy'?COMBAT_LAYERS.enemyShot:COMBAT_LAYERS.playerShot;
    this.iceTrails.projectile(b,screen);
    const path=projectileScene(b);if(!path)return;const presentation=projectilePresentation(b),scale=b.owner==='enemy'&&b.modelId===1100005&&!b.beam
      ?bossBallVisualScale(b,screen,this.sourcePixelScale)
      :(b.scale??1)*(path===ENEMY_ROUND_BULLET_SCENE?.16:1)*presentation.scale,warmup=Math.max(0,b.warmup??0),warming=b.age<warmup,segments=b.segments??[];
    // Empty segments mean the host has not fired; do not manufacture editor rays.
    const sector=b.owner==='player'&&b.familyId===200011&&b.trajectory==='SectorSpreadMod';
    const beam=b.beam||(path.endsWith('/lightning_beam.tscn')&&segments.length>0);
    if((b.beam||sector)&&!segments.length)return;
    if(beam){for(const [i,segment]of segments.entries()){
      // Sample both collision edges and eight visible rays across the fan.
      if(sector&&i%3!==0&&i!==segments.length-1)continue;
      const a=screen(segment.from.x,segment.from.z),end=screen(segment.to.x,segment.to.z),dx=end.x-a.x,dy=end.y-a.y,length=Math.hypot(dx,dy)/(this.sourcePixelScale*scale);
      const pose:Row={rootTransform:this.pose(a,Math.atan2(dy,dx)-Math.PI/2,scale),beamLength:length,localEndpoint:[0,length],skipPrefire:true,held:true,awaitHostExit:true,...presentation.pose,presentationDepth,projectilePalette:palette,impactProbe:i===segments.length-1?{origin:a,direction:{x:dx/Math.max(.0001,Math.hypot(dx,dy)),y:dy/Math.max(.0001,Math.hypot(dx,dy))},maxDistance:Math.hypot(dx,dy)}:undefined};
      if(sector){pose.splitOffChance=0;pose.refreshLightningPath=true;pose.impactProbe=undefined;pose.overrides={Visual:{position:[0,0]},'Visual/Line2D':{width:36,modulate:[1.15,2.2,3,1]}};}
      if(warming){this.prefire(`projectile:${b.uid}:${i}:warmup`,b.uid,b.age,warmup,pose);continue;}
      this.emit(`projectile:${b.uid}:${i}`,path,b.age-warmup,b.uid+i,pose,Math.max(0,b.lifetime-warmup),sector);
    }}else{
      const origin=screen(b.x,b.z),yaw=b.visualAngle??b.angle??0,target=Math.hypot(b.vx??0,b.vz??0)>.001&&b.visualAngle===undefined?screen(b.x+b.vx,b.z+b.vz):screen(b.x+Math.sin(yaw),b.z+Math.cos(yaw));
      const pose:Row={rootTransform:this.pose(origin,Math.atan2(target.y-origin.y,target.x-origin.x)+Math.PI/2,scale)},script=rootProps(this.graph,path).script?.$external||'';
      pose.rootTransform=enemySpriteFootprint(b,screen,pose.rootTransform);
      // This routed model is the host's spawned explosion body itself. Its
      // actual projectile creation is the explicit source explode event.
      if(script.endsWith('/explosion.gd'))pose.event='explode';
      if(script.endsWith('/laser_beam.gd')||script.endsWith('/lightning_beam.gd')){
        pose.held=true;pose.skipPrefire=true;
        if(!(b.beamLength>0))this.fail('host-beam-endpoint-required',{uid:b.uid,path,modelId:b.modelId,weaponId:b.weaponId,trajectory:b.trajectory});
        const end=screen(b.x+Math.sin(yaw)*b.beamLength,b.z+Math.cos(yaw)*b.beamLength),dx=end.x-origin.x,dy=end.y-origin.y;
        pose.rootTransform=this.pose(origin,Math.atan2(dy,dx)-Math.PI/2,scale);pose.beamLength=Math.hypot(dx,dy)/(this.sourcePixelScale*scale);
      }
      const key=`projectile:${b.uid}`,previous=this.entries.get(key);
      const playerRocket=b.owner==='player'&&script.endsWith('/rocket.gd');
      const age=playerRocket&&previous?Math.max(b.age,this.clock-previous.bornAt):b.age;
      const duration=playerRocket&&finite(b.lifetime)?b.lifetime+age-b.age:b.lifetime;
      pose.awaitHostExit=true;
      pose.hostProjectileLifetime=true;
      this.observeHits(b);const drawn=this.emit(key,path,age,b.uid,{...pose,...presentation.pose,presentationDepth,projectilePalette:palette},duration,presentation.retireImmediately);
      if(b.owner==='player'){const sprite=drawn?.sprites?.find((s:Row)=>s.nodePath==='Visual/Circle');if(sprite)this.motionAccents.projectile(b,screen,element,sprite);}
    }
  }
  effect(fx:Effect&Row,screen:(x:number,z:number)=>ScreenPoint,visualScale=1){
    if(isNativeSwordSwing(fx)){
      if(fx.age<0||fx.age>=fx.duration)return;
      const meshes=nativeSwordScreenMeshes(this.host.nativeSwordEffects!,fx,screen,visualScale);
      if(meshes.length){this.swordTrails.effect(fx,meshes);this.source.drawMeshes(`effect:${fx.uid}`,meshes);this.audit.draws++;this.audit.scenes.add(`native-sword:${fx.modelId}`);}
      return;
    }
    if(fx.age<0||fx.kind==='text')return;const path=effectScene(fx);if(!path)return;
    if(!this.hitAdmission.accepts(fx,screen(fx.x,fx.z)))return;const explosion=rootProps(this.graph,path).script?.$external?.endsWith('/explosion.gd');
    const presentation=effectPresentation(fx),root=graphRoot(this.graph,path),overrides:Row={...(root.type==='GPUParticles2D'&&root.properties.one_shot?{'.':{emitting:true}}:{}),...presentation.overrides};
    const displayScale=(fx.originalScale??1)*visualScale*presentation.scale;
    // World-space Godot particles inherit emission positions/velocity, but
    // their sprite scale is independent of the emitter transform. Apply the
    // requested display factor to the material too; leave source data intact.
    for(const node of this.graph.scenes[path].nodes)if(node.type==='GPUParticles2D'&&!node.properties.local_coords&&displayScale!==1){
      const material=resource(this.graph,node.properties.process_material);if(!material)continue;
      overrides[node.path]={...overrides[node.path],process_material:{...material,properties:{...material.properties,scale_min:(material.properties.scale_min??1)*displayScale,scale_max:(material.properties.scale_max??1)*displayScale}}};
    }
    this.emit(`effect:${fx.uid}`,path,fx.age,fx.uid,{rootTransform:this.pose(screen(fx.x,fx.z),fx.angle??0,displayScale),event:explosion?'explode':undefined,overrides,projectilePalette:presentation.palette,presentationDepth:fx.modelId===220014?COMBAT_LAYERS.warning:COMBAT_LAYERS.impact,presentationOpacity:fx.kind==='hit'?.85:1},fx.duration);
  }
  status(buff:Row,screen:(x:number,z:number)=>ScreenPoint){
    if(isCorrectedStatus(buff)){
      const meshes=correctedStatusScreenMeshes(buff,screen);
      if(meshes.length){this.source.drawMeshes(`status:${buff.targetUid}:${buff.buffId}:corrected`,meshes,undefined,{presentationDepth:COMBAT_LAYERS.status});this.audit.draws++;this.audit.scenes.add('host:corrected-status');}
      return;
    }
    const path=statusScene(buff.modelId),duration=buff.duration??(finite(buff.remaining)?buff.age+buff.remaining:undefined),pose:Row={rootTransform:this.pose(screen(buff.x,buff.z),0,1),presentationDepth:COMBAT_LAYERS.status};
    if(path.endsWith('/player_toxin.tscn')||path.endsWith('/operculum_shield.tscn')){
      if(!(finite(duration)&&duration>0)&&duration!==Infinity)this.fail('host-status-duration-required',{modelId:buff.modelId,buffId:buff.buffId,duration});
      pose.lifetime=duration;
    }
    if(path.endsWith('/burn_status_effect.tscn')){
      if(!finite(buff.damage))this.fail('host-burn-damage-required',{modelId:buff.modelId,buffId:buff.buffId});
      pose.overrides={'.':{amount_ratio:Math.max(.3,Math.min(1,buff.damage/200))}};
    }
    this.emit(`status:${buff.targetUid}:${buff.buffId}`,path,buff.age,buff.targetUid*65537+buff.buffId,pose,duration);
  }
  /** Explicit hit callback; visual sampling never invents a collision. */
  projectileHit(uid:number,age:number,detail:Row={}){
    const entry=this.entries.get(`projectile:${uid}`);if(!entry)return;
    if(entry.path.endsWith('/operculum_shield.tscn')){const before=createLifecycleContext(this.graph,entry.path,this.input(entry,age)),sample:any=sampleScene(this.graph,entry.path,before.context),visual=sample.nodes.find((n:Row)=>n.path==='Visual');entry.hitEvents.push({at:age,modulateBefore:visual?.properties.modulate??[1,1,1,1],...detail});}
    this.audit.events.push({type:'host-hit',uid,age,...detail});
  }
  private prefire(id:string,seed:number,age:number,total:number,pose:Row){
    const player=this.graph.scenes[PREFIRE].nodes.find((n:Row)=>n.path==='AnimationPlayer'),lib=resource(this.graph,player.properties['libraries/']),duration=resource(this.graph,lib.properties._data.prefire).properties.length??1;
    // The source scene carries a 12px editor muzzle offset. Host endpoints
    // already include the actual muzzle, so do not add that offset again.
    pose={...pose,overrides:{...pose.overrides,Visual:{...pose.overrides?.Visual,position:[0,0]}},linePoints:{...pose.linePoints,
      'Visual/PrefireLine2D':[[0,0],[0,pose.beamLength]],'Visual/Line2D':[[0,0],[0,pose.beamLength]]}};
    this.emit(id,PREFIRE,age,seed,{...pose,presentationDepth:COMBAT_LAYERS.warning,skipPrefire:false,prefireTimeMultiplier:Math.max(.001,total)/duration,animationNames:{AnimationPlayer:'prefire'},animationTimes:{AnimationPlayer:Math.min(duration,age/Math.max(.001,total)*duration)}},undefined,true);
  }
  warning(uid:number,index:number,remaining:number,from:ScreenPoint,to:ScreenPoint){const id=`warning:${uid}:${index}`,old=this.entries.get(id),age=old?old.age+this.clock-old.lastSeen:0,dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy)/this.sourcePixelScale;this.prefire(id,uid,age,age+Math.max(0,remaining),{rootTransform:this.pose(from,Math.atan2(dy,dx)-Math.PI/2,1),beamLength:length,localEndpoint:[0,length]});}
  endFrame(){
    // Iteration includes newly appended children in original generation order.
    for(const[id,entry]of this.entries){
      if(entry.independent){entry.age=this.clock-entry.bornAt;if(entry.age<0)continue;}
      else if(entry.seenRevision!==this.revision){if(entry.retireImmediately){this.entries.delete(id);continue;}if(entry.exitAt===undefined){entry.exitAt=entry.age;entry.stopAge=entry.exitAt;}entry.age=this.clock-entry.bornAt;}
      if((entry.independent||entry.exitAt!==undefined)&&entry.age-(entry.exitAt??entry.duration??0)>entry.retention){this.entries.delete(id);continue;}this.draw(id,entry);
    }
    this.swordTrails.endFrame();this.iaido.endFrame();this.motionAccents.draw(this.source,{player:COMBAT_LAYERS.playerShot,enemy:COMBAT_LAYERS.enemyShot});this.source.endFrame();this.iceTrails.endFrame();
  }
  reset(){this.motionAccents.reset();this.hitAdmission.reset();this.entries.clear();this.source.reset();this.iceTrails.reset();this.swordTrails.reset();this.iaido.reset();}
  destroy(){this.reset();this.source.destroy();}
}

