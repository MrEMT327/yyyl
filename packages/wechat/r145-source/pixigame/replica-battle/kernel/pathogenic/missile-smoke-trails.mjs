import {VfxMeshBuffer,quadVisible} from './vfx-buffers.mjs';
const MATERIAL='host://missile-smoke-v1/material',SHADER='host://missile-smoke-v1/shader';
const MODELS=new Set([1000012,1000013,1000014,1000059,200234]);
export const MISSILE_SMOKE_LIMIT=192;
export function withMissileSmokeResources(graph){
 return {...graph,resources:{...graph.resources,[MATERIAL]:{type:'ShaderMaterial',properties:{shader:{$external:SHADER}}}},shaders:{...graph.shaders,[SHADER]:{code:`shader_type canvas_item;render_mode unshaded,blend_mix;
float puffNoise(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float puffField(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(puffNoise(i),puffNoise(i+vec2(1,0)),f.x),mix(puffNoise(i+vec2(0,1)),puffNoise(i+vec2(1,1)),f.x),f.y);}
void fragment(){float t=clamp((COLOR.a-.1)/.8,0.0,1.0);vec2 p=UV*2.0-1.0;
 float n=puffField(p*3.4+vec2(t*.8,-t*.6));float body=1.0-smoothstep(.18,.91,length(p)+(n-.5)*.20);
 float fade=(1.0-smoothstep(.08,1.0,t));vec3 soot=mix(vec3(.20,.25,.29),vec3(.55,.58,.60),n);
 COLOR=vec4(soot,body*fade*.24);
}`}}};
}
// World-space puffs outlive the solid missile. Neither impacts nor paused
// frames manufacture new particles, and no gameplay RNG/serial is consumed.
export class MissileSmokeTrails{
 constructor(){this.buffer=new VfxMeshBuffer('missile-smoke',MATERIAL,0);this.puffs=[];this.free=[];this.emitters=new Map();this.points=Array.from({length:4},()=>({x:0,y:0}));this.clock=-Infinity;}
 beginFrame(clock,viewport){
  if(clock<this.clock)this.reset();this.clock=clock;this.viewport=viewport;this.buffer.reset();
  let keep=0;for(const puff of this.puffs){if(clock-puff.at<puff.life)this.puffs[keep++]=puff;else this.free.push(puff);}this.puffs.length=keep;
  for(const [id,e]of this.emitters)if(clock-e.seen>.5)this.emitters.delete(id);
 }
 projectile(b,screen,sprite){
  if(b.owner!=='player'||!MODELS.has(b.modelId)||b.dead||b.held||b.damageDisabled||b.visualHidden||b.age<(b.warmup??0)||Math.hypot(b.vx??0,b.vz??0)<.05||!Number.isFinite(this.clock))return;
  const m=sprite?.matrix,r=sprite?.localRect;if(!m||!r||![...m,...r].every(Number.isFinite)||(sprite.color?.[3]??1)<=0)return;
  // Emit from the rendered exhaust tip, including its animation and rotation.
  const sx=m[0]*(r[0]+r[2]/2)+m[2]*(r[1]+r[3]) +m[4],sy=m[1]*(r[0]+r[2]/2)+m[3]*(r[1]+r[3])+m[5];
  const zero=screen(0,0),a=screen(1,0),c=screen(0,1),ax=a.x-zero.x,ay=a.y-zero.y,cx=c.x-zero.x,cy=c.y-zero.y,det=ax*cy-ay*cx;
  if(!Number.isFinite(det)||Math.abs(det)<1e-8)return;
  const dx=sx-zero.x,dy=sy-zero.y,x=(dx*cy-dy*cx)/det,z=(dy*ax-dx*ay)/det;
  if(!Number.isFinite(x+z))return;
  let emitter=this.emitters.get(b.uid);
  if(!emitter){if(this.emitters.size>=48)return;emitter={at:this.clock-.025,seen:this.clock,x,z};this.emitters.set(b.uid,emitter);}
  const previousTime=emitter.seen,previousX=emitter.x,previousZ=emitter.z;
  emitter.seen=this.clock;emitter.x=x;emitter.z=z;
  const elapsed=this.clock-emitter.at;if(elapsed<.025-1e-8)return;
  const upgraded=b.modelId===1000012||b.modelId===1000014,life=upgraded?.42:.32;
  const radius=Math.max(.06,Math.min(.48,(upgraded?.16:.125)*(b.scale??1)));
  const steps=Math.min(4,Math.floor((elapsed+1e-8)/.025)),continuous=this.clock-previousTime<=.15&&Math.hypot(x-previousX,z-previousZ)<4;
  for(let i=0;i<steps&&this.puffs.length<MISSILE_SMOKE_LIMIT;i++){
   const at=continuous?emitter.at+.025*(i+1):this.clock;
   const blend=continuous&&this.clock>previousTime?Math.max(0,Math.min(1,(at-previousTime)/(this.clock-previousTime))):1;
   const phase=b.uid*2.399963+at*17,puff=this.free.pop()||{};
   Object.assign(puff,{x:previousX+(x-previousX)*blend,z:previousZ+(z-previousZ)*blend,at,life,radius,angle:phase,driftX:Math.cos(phase)*.08,driftZ:Math.sin(phase)*.06});this.puffs.push(puff);
   if(!continuous)break;
  }
  emitter.at=continuous&&elapsed<.125?emitter.at+steps*.025:this.clock;
 }
 draw(view,screen){
  for(const p of this.puffs){
   const t=(this.clock-p.at)/p.life;if(t<0||t>=1)continue;
   const size=p.radius*(.75+t*1.15),x=p.x+p.driftX*t,z=p.z+p.driftZ*t,c=Math.cos(p.angle),s=Math.sin(p.angle);
   for(let i=0;i<4;i++){const a=i===1||i===2?size:-size,b=i<2?size:-size,q=screen(x+c*a+s*b,z-s*a+c*b);this.points[i].x=q.x;this.points[i].y=q.y;}
   if(quadVisible(this.points,this.viewport))this.buffer.quad(this.points,1,1,1,.1+.8*t);
  }
  if(this.buffer.mesh.indices.length)view.drawMeshes('missile-smoke',[this.buffer.mesh],undefined,{presentationDepth:31.5});
 }
 reset(){this.puffs.length=0;this.free.length=0;this.emitters.clear();this.buffer.reset();this.clock=-Infinity;}
}
