import {VfxMeshBuffer,quadVisible} from './vfx-buffers.mjs';
import {enemyDeathVisualKind} from '../../small-death-visual.js';
import {playerDeathFootprint} from '../../player-death-visual.js';

const ROOT='host://layered-combat-bursts-v1/';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const phase='float t=clamp((COLOR.a-.1)/.8,0.0,1.0);vec2 p=UV*2.0-1.0;float r=length(p);';
const noise=`float nHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float nField(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(nHash(i),nHash(i+vec2(1,0)),f.x),mix(nHash(i+vec2(0,1)),nHash(i+vec2(1,1)),f.x),f.y);}`;
const shaders={
 debris:`shader_type canvas_item;render_mode unshaded,blend_mix;
void fragment(){${phase}
 float shape=abs(p.x)*.80+abs(p.y)*1.55;
 float edge=1.0-smoothstep(.48,.65,shape);
 vec3 metal=mix(vec3(.10,.14,.18),vec3(.52,.60,.64),clamp(p.x*.6+.5,0.0,1.0));
 metal=mix(metal,vec3(1.05,.39,.08),exp(-t*9.0)*.65);
 COLOR=vec4(metal,edge*(1.0-smoothstep(.40,1.0,t)));
}`,
 muzzle:`shader_type canvas_item;render_mode unshaded,blend_add;
void fragment(){${phase}
 float fade=1.0-smoothstep(.18,1.0,t);
 float stem=1.0-smoothstep(.58,.96,abs(p.x)*2.6+abs(p.y+.18)*.90);
 float wings=1.0-smoothstep(.48,.78,abs(p.x)*.90+abs(p.y-.18)*3.8);
 float core=exp(-p.x*p.x*18.0-(p.y+.08)*(p.y+.08)*5.0);
 float halo=exp(-r*r*5.5)*.065;
 vec3 color=mix(COLOR.rgb,vec3(1.5,1.42,1.18),core*.88);
 COLOR=vec4(color,min(.95,(max(stem,wings*.62)*.88+halo)*fade));
}`,
 fire:`shader_type canvas_item;render_mode unshaded,blend_mix;${noise}
void fragment(){${phase}
 float n=nField(p*4.2+vec2(t*2.0,-t*2.7))*.68+nField(p*8.5-vec2(t*1.8))*.32;
 float radius=.26+.53*sin(min(t*1.65,1.0)*1.5707963);
 float lobes=sin(atan(p.y,p.x)*5.0+t*3.0)*.04;
 float body=1.0-smoothstep(radius-.20,radius+.04,r+(n-.5)*.20+lobes);
 float heat=(1.0-smoothstep(.13,.84,t));
 float core=exp(-r*r*13.0)*exp(-t*8.0);
 vec3 fire=mix(COLOR.rgb*.46,COLOR.rgb*1.35,clamp(n*1.1,0.0,1.0));
 fire=mix(fire,vec3(1.65,1.07,.48),clamp(core*.86,0.0,1.0));
 COLOR=vec4(fire,body*heat*.87*(1.0-smoothstep(.68,1.0,t)));
}`,
 smoke:`shader_type canvas_item;render_mode unshaded,blend_mix;${noise}
void fragment(){${phase}
 float n=nField(p*3.4+vec2(t*.65,-t*1.1))*.65+nField(p*7.0-t*.8)*.35;
 float radius=.37+t*.39;
 float body=1.0-smoothstep(radius-.22,radius+.09,r+(n-.5)*.22);
 float fade=smoothstep(0.0,.12,t)*(1.0-smoothstep(.38,1.0,t));
 vec3 soot=mix(vec3(.06,.08,.10),vec3(.29,.31,.32),n);
 soot=mix(soot,COLOR.rgb,.13*(1.0-t));
 COLOR=vec4(soot,body*fade*.42);
}`,
 light:`shader_type canvas_item;render_mode unshaded,blend_add;
void fragment(){${phase}
 float core=exp(-r*r*26.0)*exp(-t*10.0);
 float halo=exp(-r*r*7.0)*exp(-t*8.0)*.13;
 COLOR=vec4(COLOR.rgb*(1.15+core*.55),min(.75,core*.62+halo));
}`,
 ring:`shader_type canvas_item;render_mode unshaded,blend_add;
void fragment(){${phase}
 float radius=.14+t*.68;
 float ring=exp(-abs(r-radius)*67.0)*(1.0-smoothstep(.10,.95,t));
 float breakUp=.77+.23*sin(atan(p.y,p.x)*9.0+t*5.0);
 COLOR=vec4(COLOR.rgb*1.12,ring*breakUp*.33);
}`,
 fragment:`shader_type canvas_item;render_mode unshaded,blend_add;
void fragment(){${phase}
 float shard=abs(p.x)*.75+abs(p.y)*2.2;
 float body=1.0-smoothstep(.38,.72,shard);
 float edge=exp(-shard*10.0)*.4;
 COLOR=vec4(COLOR.rgb*1.5,(body*.72+edge)*(1.0-t)*(1.0-t));
}`,
};
export function withLayeredBurstResources(graph){
 const resources={...graph.resources},programs={...graph.shaders};
 for(const [name,code]of Object.entries(shaders)){
  resources[ROOT+name]={type:'ShaderMaterial',properties:{shader:{$external:ROOT+name+'-shader'}}};
  programs[ROOT+name+'-shader']={code};
 }
 return {...graph,resources,shaders:programs};
}

// Time and positions come only from existing effects. No extra simulation events.
export class LayeredCombatBursts{
 constructor(){this.buffers=new Map();this.meshes=new Map();this.points=Array.from({length:4},()=>({x:0,y:0}));this.beginFrame();}
 beginFrame(viewport){this.viewport=viewport;for(const b of this.buffers.values())b.reset();this.meshes.clear();this.counts={ordinary:0,elite:0,boss:0,muzzle:0,player:0};}
 quad(name,x,z,rx,rz,angle,color,t,screen){
  if(!(rx>0&&rz>0)||t<0||t>=1)return;
  const c=Math.cos(angle),s=Math.sin(angle);
  for(let i=0;i<4;i++){const a=i===1||i===2?rx:-rx,b=i<2?rz:-rz,p=screen(x+c*a+s*b,z-s*a+c*b);this.points[i].x=p.x;this.points[i].y=p.y;}
  if(!quadVisible(this.points,this.viewport))return;
  let buffer=this.buffers.get(name);
  if(!buffer){buffer=new VfxMeshBuffer(name,ROOT+name,name==='smoke'?0:name==='fire'?1:3);this.buffers.set(name,buffer);}
  buffer.quad(this.points,color[0],color[1],color[2],.1+.8*t);this.meshes.set(name,buffer.mesh);
 }
 burst(f,screen,r,x,z,at,duration,scale=1){
  const age=f.age-at;if(age<0||age>=duration)return;
  const t=age/duration,c=[1,.43,.12],size=r*scale;
  this.quad('fire',x,z,size,size,0,c,t,screen);
  if(age<.12)this.quad('light',x,z,size*1.28,size*1.28,0,[1.35,.91,.45],age/.12,screen);
 }
 sparks(f,screen,r,count,life=.36){
  const age=f.age-.025;if(age<0||age>=life)return;
  const t=age/life,seed=(f.uid??0)*2.399963;
  for(let i=0;i<count;i++){
   const a=seed+i*2.399963,travel=r*(.16+t*(.75+(i%3)*.18));
   const x=f.x+Math.cos(a)*travel,z=f.z+Math.sin(a)*travel-.12*t*t;
   const s=r*(.075+(i%2)*.026)*(1-t*.45);
   this.quad('fragment',x,z,s,s*.78,a+t*(i%2?2:-2),[1.25,.77,.32],t,screen);
  }
 }
 playerDeath(f,screen,footprint){
  // A dedicated, deterministic receipt: independent of all ordinary hit/death
  // budgets, with no simulation serials or random-number consumption.
  const age=f.age,r=clamp(footprint*1.55,.95,3.4),seed=(f.uid??0)*2.399963;
  this.burst(f,screen,r,f.x,f.z,0,.68,1);
  for(let i=0;i<3;i++){
   const a=seed+i*2.094395,at=.055+i*.035;
   this.burst(f,screen,r,f.x+Math.cos(a)*r*.28,f.z+Math.sin(a)*r*.25,at,.72,.48);
  }
  if(age<.15)this.quad('light',f.x,f.z,r*1.38,r*1.38,0,[1.4,1.04,.64],age/.15,screen);
  if(age>=.02&&age<.47)this.quad('ring',f.x,f.z,r*1.7,r*1.28,0,[1.15,.77,.36],(age-.02)/.45,screen);
  for(let i=0;i<6;i++){
   const at=.04+i*.022,life=1.75+(i%3)*.15,t=(age-at)/life;
   if(t<0||t>=1)continue;
   const a=seed+i*2.399963,drift=.16+t*.48;
   const x=f.x+Math.cos(a)*r*drift,z=f.z+Math.sin(a)*r*drift+r*t*.24;
   const s=r*(.45+(i%2)*.11);
   this.quad('smoke',x,z,s,s*.91,a*.15,[.50,.30,.17],t,screen);
  }
  for(let i=0;i<20;i++){
   const life=.48+(i%5)*.10,t=(age-.025)/life;
   if(t<0||t>=1)continue;
   const a=seed+i*2.399963,speed=.65+(i%4)*.26;
   const x=f.x+Math.cos(a)*r*(.12+speed*(1-Math.exp(-t*2.4))),z=f.z+Math.sin(a)*r*(.12+speed*(1-Math.exp(-t*2.4)))-r*.22*t*t;
   const s=r*(i<8?.065:.022);
   this.quad(i<8?'debris':'fragment',x,z,s,s*(i<8?.78:1.9),a+t*(i%2?3:-3),[1.25,.76,.29],t,screen);
  }
 }
 effect(f,screen,visualScale=1,age=f.age){
  const footprint=playerDeathFootprint(f),kind=footprint!==undefined?'player':enemyDeathVisualKind(f),muzzle=f.kind==='muzzle'&&f.modelId===100001;
  if(!kind&&!muzzle)return false;
  if(age!==f.age)f={...f,age};
  if(![f.x,f.z,f.age,f.size,f.duration,visualScale].every(Number.isFinite)||f.age<0||f.age>=f.duration||f.size<=0)return true;
  if(kind==='player'){
   if(this.counts.player++<2)this.playerDeath(f,screen,footprint);
   return true;
  }
  if(muzzle){
   if(f.age>=.12||this.counts.muzzle++>=40)return true;
   // Give a 30 Hz shot several visible frames. Keep this dedicated flash
   // separate from explosion lights, whose tiny core fades much faster.
   const r=clamp(f.size*.92*visualScale*(f.originalScale??1),.28,.65),a=f.angle??0,dx=Math.sin(a),dz=Math.cos(a);
   this.quad('muzzle',f.x+dx*r*.30,f.z+dz*r*.30,r*.85,r*1.15,a,[1.25,.93,.39],f.age/.12,screen);
   if(f.age>=.025){const t=(f.age-.025)/.095;for(const side of [-1,1]){
    const turn=a+side*.65,travel=r*(.18+t*.75);
    this.quad('fragment',f.x+Math.sin(turn)*travel,f.z+Math.cos(turn)*travel,r*.07,r*.12,turn,[1.2,.96,.60],t,screen);
   }}
   return true;
  }
  const cap=kind==='boss'?3:kind==='elite'?8:28;
  if(this.counts[kind]++>=cap)return true;
  const r=clamp(f.size*visualScale*.5,.2,4.5),duration=f.duration;
  if(kind==='boss'){
   this.burst(f,screen,r,f.x,f.z,0,.7,.72);
   const points=[[-.46,-.24,.30],[.40,.23,.40],[-.32,.36,.55],[.43,-.30,.60],[.03,.03,.50]];
   points.forEach(([x,z,at],i)=>this.burst(f,screen,r,f.x+x*r,f.z+z*r,at,.4,.34+(i%2)*.07));
   for(const [at,stretch]of [[.10,1],[.15,1.26]])if(f.age>=at&&f.age<at+.65)this.quad('ring',f.x,f.z,r*1.55*stretch,r*1.05*stretch,0,[1,.65,.27],(f.age-at)/.65,screen);
   if(f.age>=.08)this.quad('smoke',f.x,f.z+r*.09,r*1.05,r*.95,0,[.8,.42,.20],(f.age-.08)/Math.max(.01,duration-.08),screen);
   this.sparks(f,screen,r,9,.55);
  }else{
   const elite=kind==='elite',mainLife=Math.min(duration,elite?.56:.43);
   this.burst(f,screen,r,f.x,f.z,0,mainLife,elite?.90:.84);
   if(elite){this.burst(f,screen,r,f.x-r*.28,f.z+r*.22,.09,.31,.42);this.burst(f,screen,r,f.x+r*.25,f.z-r*.15,.18,.28,.35);}
   const smokeAt=f.modelId===210002?.03:.055;
   if(f.age>=smokeAt)this.quad('smoke',f.x+r*.06,f.z+r*(.06+f.age*.15),r*(elite?1.05:.94),r*(elite?.9:.82),0,[.65,.32,.16],(f.age-smokeAt)/Math.max(.01,duration-smokeAt),screen);
   if(f.age>=.025&&f.age<.37)this.quad('ring',f.x,f.z,r*1.22,r*.76,0,[.92,.57,.22],(f.age-.025)/.345,screen);
   this.sparks(f,screen,r,elite?6:3,elite?.43:.34);
  }
  return true;
 }
 draw(view){for(const name of ['smoke','fire','debris','ring','light','muzzle','fragment']){const mesh=this.meshes.get(name);if(mesh?.indices.length)view.drawMeshes('layered-bursts:'+name,[mesh],undefined,{presentationDepth:34});}}
 reset(){this.beginFrame(this.viewport);this.buffers.clear();}
}
