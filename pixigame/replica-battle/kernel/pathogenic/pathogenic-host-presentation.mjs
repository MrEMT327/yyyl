// Explicit host-game visual adaptations requested in screenshot feedback.
// These never mutate simulation scale, radius, velocity, lifetime or damage.
const ENEMY_SHOT_MODELS=new Set([1100001,1100002,1100003,1100004,1100005,1100007,1100008,1100012,1100015,1100016,1100017,1100018,1100023]);
import {missilePresentation,withMissilePresentationResources} from './missile-presentation.mjs';
import {missileExplosionFrame} from '../../missile-weapon-visual.js';
import {withIaidoResources} from './iaido-vfx.mjs';
import {withAcidCloudResources} from './acid-cloud-presentation.mjs';
import {withAreaWeaponResources} from './area-weapon-presentation.mjs';
import {withAircraftPulseResources} from './aircraft-pulse-presentation.mjs';
import {withConstructWeaponResources} from './construct-weapon-presentation.mjs';
import {withCorrectedStatusResources} from './status-presentation.mjs';
import {withCorrectedEnemyResources} from './enemy-projectile-presentation.mjs';
import {enemyProjectileMaterialPose,withEnemyProjectileMaterialResources} from './enemy-projectile-material.mjs';
import {isAcidVortex,acidVortexPresentation,withAcidVortexResources} from './acid-vortex-presentation.mjs';
import {isAcidDroplet,isAcidGammaRay,acidDropletPresentation,withAcidDropletResources} from './acid-droplet-presentation.mjs';
import {playerShotMaterialPose,withPlayerShotMaterials} from './player-shot-material.mjs';
export function projectilePresentation(b){
  const flightPose=playerShotMaterialPose(b);
  if(flightPose)return{scale:1,retireImmediately:false,pose:flightPose};
  // Route by the actual rocket model: families can change for upgrades and pilot skills.
  if(b.owner==='player'&&[1000012,1000013,1000014,1000059,200234].includes(b.modelId))return missilePresentation(b);
  // Readability only: preserve source colors and gameplay collision shapes.
  if(b.owner==='enemy'&&!b.beam&&ENEMY_SHOT_MODELS.has(b.modelId))return{scale:1.3,retireImmediately:false,pose:enemyProjectileMaterialPose(b)};
  if(b.owner==='player'&&b.familyId===200121&&b.modelId===220009)return{
    scale:1,retireImmediately:false,pose:{overrides:{
      Visual:{position:[0,0]},
      'Visual/Line2D':{scale:[1,1],texture:{$ref:LASER+'texture'},material:{$ref:LASER+'material'}},
    }},
  };
  // Compact the whole sword swing, including upgraded final strikes. Host
  // collision/damage and native animation timing remain unchanged.
  if(b.owner==='player'&&b.familyId===200101)return{scale:.55,retireImmediately:true,pose:{overrides:{
    Visual:{modulate:[1,1,1,1]},'Visual/AnimatedSprite2D':{scale:[.4875,.25],material:{$ref:SWORD+'material'}},
  }}};
  // Beam endpoints are rebuilt in local space by the bridge, so this narrows
  // only the rendered ray; range, reflection and collision remain host-owned.
  if(b.owner==='player'&&b.familyId===200171&&b.modelId===221001)return{
    scale:.08*Math.min(1,4.5/Math.max(.01,b.scale??1)),retireImmediately:false,
    // Host warmup and lifetime own visibility. Do not replay a second hollow
    // prefire after damage starts, or expire while an upgraded beam is held.
    pose:{held:true,skipPrefire:true,compactImpact:true,
      fireTimeMultiplier:Math.min(1,Math.max(.08,((b.lifetime??3)-(b.warmup??0))/.8)),overrides:{
      Visual:{position:[0,0]},
      'Visual/Line2D':{texture:{$ref:SCORCH+'fire-texture'},material:{$ref:SCORCH+'flow'},begin_cap_mode:2,end_cap_mode:2},
      'Visual/PrefireLine2D':{width:48,texture:{$ref:SCORCH+'charge-texture'},material:{$ref:SCORCH+'flow'}},
    }},
  };
  if(b.owner==='player'&&b.familyId===200031&&[1000032,1000006].includes(b.modelId))return{
    scale:1.15,retireImmediately:true,
    // Body stays aligned to flight; independent world-space particles own tails.
    pose:{animationNames:{AnimationPlayer:'attack1'},animationTimes:{AnimationPlayer:Math.min(.1,b.age)},overrides:{
      Visual:{modulate:[1,1,1,1]},'Visual/AnimatedSprite2D':{
        position:[0,0],offset:[0,0],rotation:0,scale:[.16,.16],frame:0,speed_scale:0,
        sprite_frames:{$ref:ICE+'blade-frames'},material:{$ref:ICE+'material'},
      },
    }},
  };
  if(b.owner==='player'&&b.familyId===200141&&b.modelId===1000009)return{
    scale:.8,retireImmediately:true,
    // Hold the source lifecycle, but draw the solid ice body for the full host
    // projectile lifetime. Rotation is continuous, including the spawn phase.
    pose:{animationNames:{AnimationPlayer:'spawn'},animationTimes:{AnimationPlayer:Math.min(.3,b.age)},overrides:{
      Visual:{modulate:[1,1,1,1]},'Visual/DrillAttack':{
        position:[0,0],offset:[0,0],modulate:[1,1,1,1],scale:[.12,.12],
        frame:0,speed_scale:0,rotation:-b.age*Math.PI*4,
        sprite_frames:{$ref:ICE+'saw-frames'},material:{$ref:ICE+'material'},
      },
    }},
  };
  if(isAcidDroplet(b))return acidDropletPresentation(b);
  // Compress perpendicular to the ray only; keep both endpoints and source Y scale.
  if(isAcidGammaRay(b))return{scale:1,retireImmediately:false,pose:{overrides:{
    'Visual/Line2D':{scale:[.5,1.0099999904632568],modulate:[.6,.6,.6,1]},
  }}};
  if(isAcidVortex(b))return acidVortexPresentation(b);
  return{scale:1,retireImmediately:false,pose:{}};
}

export function effectPresentation(fx){
  // Concentrated acid blast: display size only; keep projectile radius and damage.
  if(fx.modelId===210043)return{scale:.5,overrides:{}};
  // The marked missile impact is warm, independently of poison and other explosions.
  if(missileExplosionFrame(fx)!==null)return{scale:.32,overrides:{},palette:[1,.38,.035,1]};
  if(fx.modelId===210016)return{scale:.32,overrides:{}};
  if(fx.kind==='hit'&&fx.modelId===210062)return{scale:.065,overrides:{},palette:[.025,.4,1,1]};
  // Keep authored spark/splash silhouettes, with a compact contact footprint.
  if(fx.kind==='hit'&&[110030,110039,120006,210048,220029].includes(fx.modelId))return{scale:.075,overrides:{}};
  if(fx.kind==='muzzle'&&[120005,120007].includes(fx.modelId))return{scale:.12,overrides:{}};
  if([210049,210065].includes(fx.modelId))return{scale:fx.kind==='hit'?.12:.16,overrides:{}};
  if(fx.kind==='hit')return{scale:.1,overrides:{}};
  if([210003,210008,210011,210016,210017,210061].includes(fx.modelId))return{scale:.18,overrides:{}};
  if(fx.kind==='explosion')return{scale:.3,overrides:{}};
  return{scale:1,overrides:{}};
}


const SWORD='host://slim-blue-sword-v1/';
const SCORCH='host://scorch-refined-v1/';
const ICE='host://ice-weapons-v2/';
const LASER='host://stable-blue-laser-v1/';
/** Scene-local resources: original shared gradients/shaders stay untouched. */
export function withScorchPresentationResources(graph){
  const resources={...graph.resources};
  const add=(name,type,properties)=>{const id=SCORCH+name;resources[id]={id,type,properties};return {$ref:id};};
  const offsets=[0,.16,.36,.46,.54,.64,.84,1];
  const fire=add('fire-gradient','Gradient',{offsets,colors:[
    [1,.12,.01,0],[1.3,.22,.015,.35],[1.6,.6,.06,.92],
    [2.2,1.65,.6,1],[2.2,1.65,.6,1],[1.6,.6,.06,.92],[1.3,.22,.015,.35],[1,.12,.01,0],
  ]});
  const charge=add('charge-gradient','Gradient',{offsets:[0,.3,.5,.7,1],colors:[
    [1,.25,.02,0],[1,.4,.05,.2],[1.4,.85,.25,.75],[1,.4,.05,.2],[1,.25,.02,0],
  ]});
  for(const[name,gradient]of[['fire',fire],['charge',charge]])add(name+'-texture','GradientTexture2D',{gradient,use_hdr:true,width:32,height:128,fill_from:[0,1],fill_to:[0,0]});
  const source=graph.resources['res://scn/shaders/laser_energy_flow.tres#0'];
  add('flow','ShaderMaterial',{...source.properties,
    'shader_parameter/body_width':.65,'shader_parameter/spiral_pitch':900,
    'shader_parameter/scroll_speed':1800,'shader_parameter/line_thickness':.055,
    'shader_parameter/line_boost':.65,'shader_parameter/line_alpha':.18,
    'shader_parameter/prefire_dim':.2,
  });
  const laserAdd=(name,type,properties)=>{const id=LASER+name;resources[id]={id,type,properties};return {$ref:id};};
  const laserGradient=laserAdd('gradient','Gradient',{offsets:[0,.2,.42,.5,.58,.8,1],colors:[
    [.025,.3,1,0],[.04,.45,1,.4],[.2,.7,1,.9],[.7,.94,1,1],
    [.2,.7,1,.9],[.04,.45,1,.4],[.025,.3,1,0],
  ]});
  laserAdd('texture','GradientTexture2D',{gradient:laserGradient,use_hdr:true,width:32,height:128,fill_from:[0,1],fill_to:[0,0]});
  laserAdd('material','CanvasItemMaterial',{blend_mode:0,light_mode:1});
  const textures={...graph.textures};
  const iceAdd=(name,type,properties)=>{const id=ICE+name;resources[id]={id,type,properties};return {$ref:id};};
  for(const [name,file] of [['blade','ice-crescent-v2.png'],['saw','ice-saw-v2.png']]){
    textures[ICE+name]={width:1254,height:1254,file,url:'assets/ice-weapons-v2/'+file};
    const frame=iceAdd(name+'-frame','AtlasTexture',{atlas:{$external:ICE+name},region:[0,0,1254,1254]});
    iceAdd(name+'-frames','SpriteFrames',{animations:[{name:'default',speed:1,loop:true,frames:[{texture:frame,duration:1}]}]});
  }
  for(const [name,file] of [['trace','trace_01.png'],['chips','dirt_01.png']])textures['host://ice-particles-v2/'+name]={width:512,height:512,file,url:'assets/ice-weapons-v2/'+file};
  iceAdd('material','CanvasItemMaterial',{blend_mode:0,light_mode:1});
  // A narrow luminous edge with a faint translucent wake, instead of an
  // opaque recolored fan. The source alpha still owns the animated silhouette.
  resources[SWORD+'material']={id:SWORD+'material',type:'ShaderMaterial',properties:{shader:{$external:SWORD+'shader'}}};
  const shaders={...graph.shaders,[SWORD+'shader']:{code:`shader_type canvas_item;
render_mode unshaded, blend_add;
void fragment(){
  float mask=texture(TEXTURE,UV).a;
  vec2 stepUV=TEXTURE_PIXEL_SIZE*4.0;
  float inner=min(min(texture(TEXTURE,UV+vec2(stepUV.x,0.0)).a,texture(TEXTURE,UV-vec2(stepUV.x,0.0)).a),min(texture(TEXTURE,UV+vec2(0.0,stepUV.y)).a,texture(TEXTURE,UV-vec2(0.0,stepUV.y)).a));
  float edge=clamp((mask-inner)*3.0,0.0,1.0);
  stepUV=TEXTURE_PIXEL_SIZE*9.0;
  float softInner=min(min(texture(TEXTURE,UV+vec2(stepUV.x,0.0)).a,texture(TEXTURE,UV-vec2(stepUV.x,0.0)).a),min(texture(TEXTURE,UV+vec2(0.0,stepUV.y)).a,texture(TEXTURE,UV-vec2(0.0,stepUV.y)).a));
  float glow=clamp((mask-softInner)*2.0,0.0,1.0);
  COLOR=vec4(mix(vec3(0.03,0.38,1.0),vec3(0.65,0.9,1.0),edge),COLOR.a*(0.075+0.75*edge+0.22*glow));
}`}};
  const continuousSword='host://continuous-blue-sword-v1/';
  resources[continuousSword+'material']={id:continuousSword+'material',type:'ShaderMaterial',properties:{shader:{$external:continuousSword+'shader'}}};
  // Original mesh motion supplies the swing; only light layers flow within it.
  shaders[continuousSword+'shader']={code:`shader_type canvas_item;
render_mode unshaded, blend_add;
uniform float swing_age = 0.0;
uniform float layer_strength = 1.0;
void fragment(){
  float sweep=smoothstep(0.0,0.055,UV.x)*(1.0-smoothstep(0.92,1.0,UV.x));
  float d=max(0.0,UV.y);
  float core=exp(-d*100.0);
  float rim=exp(-d*25.0);
  float flow=pow(0.5+0.5*sin(UV.x*44.0-swing_age*32.0),3.0);
  float wake=exp(-d*7.5)*(0.045+0.09*flow);
  float veinAt=0.105+0.014*sin(UV.x*23.0-swing_age*17.0);
  float vein=(1.0-smoothstep(0.002,0.014,abs(d-veinAt)))*(0.12+0.25*flow);
  float secondAt=0.21+0.019*sin(UV.x*31.0-swing_age*13.0);
  float thread=(1.0-smoothstep(0.002,0.009,abs(d-secondAt)))*flow*0.1;
  vec3 energy=mix(vec3(0.025,0.38,1.0),vec3(0.22,0.78,1.2),rim);
  energy=mix(energy,vec3(1.05,1.3,1.4),core);
  float alpha=clamp(core*0.9+rim*0.38+wake+vein+thread,0.0,1.0);
  COLOR=vec4(energy,COLOR.a*sweep*alpha*layer_strength);
}`};
  const sparks='host://sword-energy-v2/';
  resources[sparks+'sparks']={id:sparks+'sparks',type:'ShaderMaterial',properties:{shader:{$external:sparks+'shader'}}};
  shaders[sparks+'shader']={code:`shader_type canvas_item;
render_mode unshaded, blend_add;
void fragment(){
  vec2 q=UV*2.0-1.0;
  float tip=1.0-smoothstep(0.55,1.0,abs(q.x));
  float halo=exp(-q.y*q.y*5.0)*tip;
  float core=exp(-q.y*q.y*40.0)*tip;
  COLOR=vec4(mix(COLOR.rgb,vec3(1.1,1.3,1.4),core),COLOR.a*(core*0.8+halo*0.2));
}`};
  return [withPlayerShotMaterials,withMissilePresentationResources,withIaidoResources,withAcidCloudResources,withAcidVortexResources,withAcidDropletResources,withAreaWeaponResources,withAircraftPulseResources,withConstructWeaponResources,withCorrectedStatusResources,withCorrectedEnemyResources,withEnemyProjectileMaterialResources].reduce((g,adapt)=>adapt(g),{...graph,resources,textures,shaders});
}
