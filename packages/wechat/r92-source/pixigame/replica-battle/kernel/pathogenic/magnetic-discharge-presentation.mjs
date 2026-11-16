import {VfxMeshBuffer,quadVisible} from './vfx-buffers.mjs';

const ROOT='host://magnetic-discharge-v1/';
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=(a,b,n)=>{const t=clamp((n-a)/(b-a));return t*t*(3-2*t);};
const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
export const MAGNETIC_DISCHARGE_LIMITS=Object.freeze({shots:32,fanSeconds:.42,plasmaSeconds:.16,fanSteps:32,sparks:8});
export const isMagneticDischarge=b=>b.owner==='player'&&b.familyId===200011&&!b.beam
  &&(b.fixedSegments===true&&[1000023,1000052].includes(b.modelId)||b.modelId===1000036);
export const isMagneticFan=b=>isMagneticDischarge(b)&&b.fixedSegments===true&&b.modelId!==1000036;

export function withMagneticDischargeResources(graph){
  const shaders={...graph.shaders},resources={...graph.resources};
  const add=(name,code)=>{shaders[ROOT+name+'-shader']={code};resources[ROOT+name]={type:'ShaderMaterial',properties:{shader:{$external:ROOT+name+'-shader'}}};};
  add('fan',`shader_type canvas_item;render_mode unshaded,blend_add;
uniform float magnetic_age=0.0;
uniform float magnetic_seed=0.0;
uniform float magnetic_radius=1.0;
uniform float magnetic_span=2.0943951;
void fragment(){
 float u=UV.x,r=UV.y,t=magnetic_age;
 float taper=pow(max(0.0,sin(u*3.14159265)),.45);
 float jag=sin(u*59.0+magnetic_seed+t*19.0)*sin(u*23.0+1.3-t*11.0)*.018;
 float edge=.925+jag,d=abs(r-edge);
 float rimMask=.22+.78*smoothstep(.20,.64,.48
  +.30*sin(u*35.0+magnetic_seed-t*14.0)+.20*sin(u*67.0+t*22.0));
 float core=exp(-d*d*38000.0)*rimMask,sheath=exp(-d*d*1050.0)*rimMask;
 float wake=exp(-pow((r-.80)/.16,2.0))*.06;
 // Offset the lanes unequally and travel the kinks outward from the muzzle.
 float lanes=u*43.0+sin(u*14.0+magnetic_seed)*.83+sin(u*27.0-magnetic_seed*.8)*.34;
 float bend=sin(r*24.0-t*46.0+magnetic_seed+u*4.0)*.74
  +sin(r*51.0+t*31.0-u*10.0+magnetic_seed*.55)*.35;
 float mainPhase=lanes+magnetic_seed+smoothstep(.02,.22,r)*bend;
 float lanePhase=atan(sin(mainPhase),cos(mainPhase));
 float laneIndex=floor(mainPhase/6.2831853+.5);
 float laneNoise=fract(sin(laneIndex*12.73+magnetic_seed*3.1)*73.72);
 float forkStart=mix(.24,.60,laneNoise);
 float forkSide=mix(-1.0,1.0,step(.5,laneNoise));
 float forkOffset=forkSide*smoothstep(forkStart,forkStart+.31,r)
  *(1.42+.41*sin(r*18.0-t*39.0+laneIndex*2.3));
 float forkGate=smoothstep(forkStart+.008,forkStart+.085,r);
 // Angular stripes otherwise get wider with radius. Measure their transverse
 // distance in host units so current is thick at the aircraft and fine at its tips.
 float across=max(r,.015)*magnetic_radius*magnetic_span;
 float mainDistance=abs(lanePhase)*across/43.0;
 float forkDistance=abs(lanePhase-forkOffset)*across/43.0;
 float width=mix(.28,.040,pow(clamp(r,0.0,1.0),.78));
 float forkWidth=mix(.115,.018,pow(clamp(r,0.0,1.0),.72));
 float strands=exp(-pow(mainDistance/width,2.0));
 float halo=exp(-pow(mainDistance/(width*1.7),2.0));
 float forks=exp(-pow(forkDistance/forkWidth,2.0))*forkGate;
 // Narrow upgraded fans converge more tightly. Keep their white cores
 // separated while preserving the thick blue current around each core.
 float mainCore=max(.008,min(width*.36,across*6.2831853/43.0*.18));
 float forkCore=max(.004,min(forkWidth*.32,across*6.2831853/43.0*.12));
 float hot=exp(-pow(mainDistance/mainCore,2.0))*.94
  +exp(-pow(forkDistance/forkCore,2.0))*.26*forkGate;
 float reach=mix(.84,1.0,laneNoise);
 float gate=smoothstep(.015,.055,r)*(1.0-smoothstep(reach-.09,reach,r));
 float channels=(strands*.68+halo*.12+forks*.32)*gate;
 float mist=(.012+.012*sin(u*19.0+r*17.0-t*18.0))*smoothstep(.02,.18,r)*(1.0-smoothstep(.75,1.0,r));
 // The outside front stays secondary to the tapered, connected main currents.
 float alpha=(core*.20+sheath*.09+wake+channels+mist)*taper;
 vec3 blue=vec3(.10,.49,1.45);
 vec3 color=mix(blue,vec3(1.85,2.45,2.90),clamp(hot*gate+core*.20,0.0,1.0));
 COLOR=vec4(color,COLOR.a*min(.94,alpha));
}`);
  add('muzzle',`shader_type canvas_item;render_mode unshaded,blend_add;
void fragment(){
 vec2 p=UV*2.0-1.0;float r=length(p);
 float core=exp(-dot(p,p)*34.0);
 float plume=exp(-p.x*p.x*11.0-(p.y+.12)*(p.y+.12)*5.0);
 float cross=exp(-abs(p.x)*22.0-abs(p.y)*3.0)+exp(-abs(p.y)*27.0-abs(p.x)*4.0);
 float halo=exp(-r*r*5.0)*.12;
 vec3 color=mix(vec3(.16,.64,1.60),vec3(2.25,2.75,3.0),clamp(core+cross*.5,0.0,1.0));
 COLOR=vec4(color,COLOR.a*min(.96,core*.85+plume*.37+cross*.30+halo));
}`);
  add('spark',`shader_type canvas_item;render_mode unshaded,blend_add;
void fragment(){
 vec2 p=UV*2.0-1.0;
 float edge=exp(-p.x*p.x*18.0)*pow(max(0.0,1.0-abs(p.y)),.55);
 COLOR=vec4(COLOR.rgb,COLOR.a*edge);
}`);
  return {...graph,resources,shaders};
}

function buffer(shot,key,material,z){let b=shot.buffers.get(key);if(!b){b=new VfxMeshBuffer(key,ROOT+material,z,256);shot.buffers.set(key,b);}b.reset();return b;}
function quadAt(shot,screen,across,ahead,rx,rz,angle){
  const c=Math.cos(angle),s=Math.sin(angle),p=(x,z)=>screen(shot.x+c*x+s*z,shot.z-s*x+c*z);
  return [p(across-rx,ahead-rz),p(across+rx,ahead-rz),p(across+rx,ahead+rz),p(across-rx,ahead+rz)];
}
export function magneticDischargeMeshes(shot,age,screen,viewport){
 const maxAge=shot.fan?MAGNETIC_DISCHARGE_LIMITS.fanSeconds:MAGNETIC_DISCHARGE_LIMITS.plasmaSeconds;
 if(!Number.isFinite(age)||age<0||age>=maxAge)return [];
 const meshes=[],alpha=1-smooth(.12,maxAge,age);
 if(shot.fan&&shot.radius>0){
  const b=buffer(shot,'pressure-front','fan',0),m=b.mesh,steps=MAGNETIC_DISCHARGE_LIMITS.fanSteps;
  for(let row=0;row<4;row++){
   const radius=[0,.45,.80,1][row];
   for(let i=0;i<=steps;i++){
    const u=i/steps,angle=shot.angle+shot.left+(shot.right-shot.left)*u;
    const p=screen(shot.x+Math.sin(angle)*shot.radius*radius,shot.z+Math.cos(angle)*shot.radius*radius);
    b.vertex(p.x,p.y,u,radius,1,1,1,alpha);
    if(row&&i){const n=row*(steps+1)+i;m.indices.push(n-steps-2,n-steps-1,n,n-steps-2,n,n-1);}
   }
  }
  m.materialUniformOverrides={magnetic_age:age,magnetic_seed:hash(shot.uid)*9,magnetic_radius:shot.radius,magnetic_span:shot.right-shot.left};meshes.push(m);
 }
 // The bright impulse is local to the actual birth point and is gone before
 // the fan afterglow, preserving a crisp shot / quiet gap rhythm.
 if(age<.13){
  const flash=buffer(shot,'muzzle-impulse','muzzle',2),size=(.66+smooth(0,.055,age)*.45)*shot.flashScale;
  const points=quadAt(shot,screen,0,.13,size,size*1.20,shot.angle);
  if(quadVisible(points,viewport)){flash.quad(points,1,1,1,(1-smooth(.025,.13,age))*.94);meshes.push(flash.mesh);}
 }
 if(shot.fan&&age>=.065&&age<.34){
  const sparks=buffer(shot,'ion-fragments','spark',1),life=1-smooth(.11,.34,age);
  for(let i=0;i<MAGNETIC_DISCHARGE_LIMITS.sparks;i++){
   const h=hash(shot.uid*11+i),angle=shot.angle+shot.left+(shot.right-shot.left)*((i+.3+h*.4)/MAGNETIC_DISCHARGE_LIMITS.sparks);
   const distance=shot.radius*(.65+h*.26)+Math.max(0,age-.1)*.5;
   const center={...shot,x:shot.x+Math.sin(angle)*distance,z:shot.z+Math.cos(angle)*distance};
   const points=quadAt(center,screen,0,0,.025+h*.018,.16+h*.20,angle);
   if(quadVisible(points,viewport))sparks.quad(points,.55,1.25,2.0,life*.8);
  }
  if(sparks.mesh.indices.length)meshes.push(sparks.mesh);
 }
 return meshes;
}

/** Short, bounded view receipts finish the discharge after the 0.2s damage
 * entity ends. No projectile, collider, cooldown, random stream or hit is owned. */
export class MagneticDischarges{
 constructor(){this.shots=new Map();this.clock=0;this.viewport=undefined;this.screen=undefined;}
 beginFrame(clock,viewport){if(clock<this.clock)this.reset();this.clock=clock;this.viewport=viewport;}
 projectile(b,screen){
  if(!isMagneticDischarge(b))return false;
  const fan=isMagneticFan(b);this.screen=screen;
  if(b.visualHidden){this.shots.delete(b.uid);return fan;}
  if(b.dead||!(b.scale>0)||![b.uid,b.age,b.x,b.z,b.angle??0].every(Number.isFinite)||b.age<0||b.age>=(b.lifetime??Infinity))return fan;
  let shot=this.shots.get(b.uid);
  if(!shot){
   if(b.age>(fan?.2:.10))return fan;
   if(fan&&(!b.segments?.length||!(b.age>0)))return fan;
   if(this.shots.size>=MAGNETIC_DISCHARGE_LIMITS.shots)this.shots.delete(this.shots.keys().next().value);
   const origin=fan?b.segments[0].from:b.birth??{x:b.x-(b.vx??0)*b.age,z:b.z-(b.vz??0)*b.age};
   if(![origin?.x,origin?.z].every(Number.isFinite))return fan;
   shot={uid:b.uid,fan,bornAt:this.clock-b.age,x:origin.x,z:origin.z,angle:b.angle??0,radius:0,left:0,right:0,flashScale:clamp(b.scale,.8,1.35),buffers:new Map()};
   this.shots.set(b.uid,shot);
  }
  if(fan){
   let left=Infinity,right=-Infinity,radius=0;
   for(const ray of b.segments){
    const dx=ray.to.x-ray.from.x,dz=ray.to.z-ray.from.z;if(!Number.isFinite(dx+dz))continue;
    const raw=Math.atan2(dx,dz)-shot.angle,angle=Math.atan2(Math.sin(raw),Math.cos(raw));
    left=Math.min(left,angle);right=Math.max(right,angle);radius=Math.max(radius,Math.hypot(dx,dz));
   }
   if(Number.isFinite(left+right)&&right>left&&radius>0){shot.left=left;shot.right=right;shot.radius=radius;}
  }
  return fan;
 }
 draw(view,depth){
  if(!this.screen)return;
  for(const [uid,shot]of this.shots){
   const age=this.clock-shot.bornAt,life=shot.fan?MAGNETIC_DISCHARGE_LIMITS.fanSeconds:MAGNETIC_DISCHARGE_LIMITS.plasmaSeconds;
   if(age<0||age>=life){this.shots.delete(uid);continue;}
   const meshes=magneticDischargeMeshes(shot,age,this.screen,this.viewport);
   if(meshes.length)view.drawMeshes('magnetic-discharge:'+uid,meshes,undefined,{presentationDepth:depth});
  }
 }
 reset(){this.shots.clear();this.screen=undefined;}
}
