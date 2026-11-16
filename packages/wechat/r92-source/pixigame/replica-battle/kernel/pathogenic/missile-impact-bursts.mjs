import {VfxMeshBuffer,boundsVisible} from './vfx-buffers.mjs';

const ROOT='host://missile-impact-v1/';
const phase='float t=clamp((COLOR.a-.1)/.8,0.0,1.0);vec2 p=UV*2.0-1.0;float r=length(p);';
const noise=`float impactHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float impactField(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(impactHash(i),impactHash(i+vec2(1,0)),f.x),mix(impactHash(i+vec2(0,1)),impactHash(i+vec2(1,1)),f.x),f.y);}`;
// Project-authored shaders: no competitor textures or per-impact emitters.
// The original's timing separates short flashes, staggered fire and late smoke.
const shaders={
 fire:`shader_type canvas_item;render_mode unshaded,blend_mix;${noise}
void fragment(){${phase}
 float n=impactField(p*3.8+vec2(t*1.1,-t*1.7))*.72+impactField(p*7.2-t*.8)*.28;
 float lobe=sin(atan(p.y,p.x)*5.0+t*1.3)*.035;
 float body=1.0-smoothstep(.48,.87,r+(n-.5)*.18+lobe);
 float fold=smoothstep(.20,.84,n);
 float core=exp(-r*r*8.0)*(1.0-smoothstep(.05,.50,t));
 vec3 fire=mix(vec3(.32,.035,.008),vec3(1.08,.36,.035),fold);
 fire=mix(fire,vec3(1.48,1.13,.57),clamp(core*.86+fold*.12*(1.0-t),0.0,.93));
 fire*=1.0-smoothstep(.36,1.0,t)*.66;
 float fade=1.0-smoothstep(.60,1.0,t);
 COLOR=vec4(fire*COLOR.rgb,body*fade*.70);
}`,
 smoke:`shader_type canvas_item;render_mode unshaded,blend_mix;${noise}
void fragment(){${phase}
 float n=impactField(p*3.2+vec2(t*.35,-t*.5))*.73+impactField(p*6.2+t*.3)*.27;
 float body=1.0-smoothstep(.40,.93,r+(n-.5)*.23);
 float fade=smoothstep(0.0,.074,t)*(1.0-smoothstep(.30,1.0,t));
 vec3 smoke=mix(vec3(.075,.057,.045),vec3(.29,.24,.19),n);
 smoke=mix(smoke,vec3(.45,.22,.065),.23*(1.0-t));
 COLOR=vec4(smoke,body*fade*.43);
}`,
 light:`shader_type canvas_item;render_mode unshaded,blend_add;
void fragment(){${phase}
 float core=exp(-r*r*29.0),halo=exp(-r*r*7.0)*.075;
 float fade=1.0-smoothstep(.10,1.0,t);
 COLOR=vec4(COLOR.rgb*(1.1+core*.35),(core*.64+halo)*fade);
}`,
 ring:`shader_type canvas_item;render_mode unshaded,blend_add;
void fragment(){${phase}
 float ring=exp(-abs(r-(.18+.62*t))*80.0);
 float fade=1.0-smoothstep(0.0,1.0,t);
 COLOR=vec4(COLOR.rgb,ring*fade*.23);
}`,
 spark:`shader_type canvas_item;render_mode unshaded,blend_add;
void fragment(){${phase}
 float body=1.0-smoothstep(.36,.76,abs(p.x)*2.8+abs(p.y)*.8);
 COLOR=vec4(COLOR.rgb*1.3,body*(1.0-t)*(1.0-t)*.86);
}`,
};
export function withMissileImpactResources(graph){
 const resources={...graph.resources},programs={...graph.shaders};
 for(const [name,code]of Object.entries(shaders)){
  resources[ROOT+name]={type:'ShaderMaterial',properties:{shader:{$external:ROOT+name+'-shader'}}};
  programs[ROOT+name+'-shader']={code};
 }
 return {...graph,resources,shaders:programs};
}
export const isMissileImpact=f=>f.modelId===210016&&(f.kind==='muzzle'||f.kind==='explosion');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const WHITE=[1.2,1.05,.75],WARM=[1,1,1],GOLD=[1.2,.62,.17];

// Stateless samples of existing host impacts. Expiry, pause and scene reset
// cannot produce another explosion, consume RNG or change combat data.
export class MissileImpactBursts{
 constructor(){this.buffers=new Map();this.points=Array.from({length:4},()=>({x:0,y:0}));this.beginFrame();}
 beginFrame(viewport){this.viewport=viewport;for(const b of this.buffers.values())b.reset();}
 quad(name,x,z,rx,rz,angle,color,t,screen){
  if(!(rx>0&&rz>0)||t<0||t>=1)return;
  const c=Math.cos(angle),s=Math.sin(angle);
  for(let i=0;i<4;i++){const a=i===1||i===2?rx:-rx,b=i<2?rz:-rz,p=screen(x+c*a+s*b,z-s*a+c*b);this.points[i].x=p.x;this.points[i].y=p.y;}
  let buffer=this.buffers.get(name);
  if(!buffer){buffer=new VfxMeshBuffer(name,ROOT+name,0);this.buffers.set(name,buffer);}
  buffer.quad(this.points,color[0],color[1],color[2],.1+.8*t);
 }
 fire(f,age,at,life,r,side,scale,seed,screen){
  const t=(age-at)/life;if(t<0||t>=1)return;
  const a=seed+side*2.399963,travel=r*(.055+t*.24),x=f.x+Math.cos(a)*travel,z=f.z+Math.sin(a)*travel;
  const grow=t<.212?.4+.6*Math.sin(t/.212*Math.PI/2):t<.433?1:1-(t-.433)/.567*.574;
  const size=r*scale*grow;
  this.quad('fire',x,z,size,size*.94,a+t*.24,WARM,t,screen);
 }
 effect(f,screen,visualScale=1,age=f.age){
  if(!isMissileImpact(f))return false;
  const scale=f.originalScale??1;
  if(![f.x,f.z,age,f.duration,scale,visualScale].every(Number.isFinite)||age<0||age>=f.duration||scale<=0||visualScale<=0)return true;
  // Preserve the existing impact footprint: basic/flying scale 1, airdrop 2.
  // This factor is display-only and never uses or writes the damage radius.
  const r=2.2*scale*visualScale,p=screen(f.x,f.z),ex=screen(f.x+r*1.4,f.z),ez=screen(f.x,f.z+r*1.4);
  const extentX=Math.abs(ex.x-p.x)+Math.abs(ez.x-p.x),extentY=Math.abs(ex.y-p.y)+Math.abs(ez.y-p.y);
  if(!boundsVisible(p.x-extentX,p.y-extentY,p.x+extentX,p.y+extentY,this.viewport))return true;
  const seed=((f.uid??0)>>>0)*2.399963;
  // A compact initial body replaces the original sequence's first frame;
  // it is visible on the real collision frame, ahead of the 40 ms flash.
  this.fire(f,age,0,.22,r,0,.53,seed,screen);
  if(age<.045)this.quad('light',f.x,f.z,r*.40,r*.40,0,WHITE,age/.045,screen);
  if(age>=.04&&age<.14)this.quad('light',f.x,f.z,r*1.10,r*1.10,0,WHITE,(age-.04)/.1,screen);
  if(age>=.05&&age<.45)this.quad('light',f.x,f.z,r*1.28,r*1.28,0,[.70,.34,.10],(age-.05)/.4,screen);
  if(age>=.05&&age<.40)this.quad('ring',f.x,f.z,r*1.28,r*1.06,0,GOLD,(age-.05)/.35,screen);
  // Original primary fire cadence: ten short puffs, one every 40 ms.
  for(let i=0;i<10;i++)this.fire(f,age,.06+i*.04,.30+(i%3)*.025,r,i,.58+(i%3)*.055,seed,screen);
  for(let i=0;i<3;i++)this.fire(f,age,.15+i*.04,.5+i*.1,r,i+10,.52+i*.035,seed,screen);
  // Two late, translucent puffs. Rotation, drift and shrink avoid a flat disk.
  for(let i=0;i<2;i++){
   const t=(age-.15)/(1+i*.4);if(t<0||t>=1)continue;
   const a=seed+i*Math.PI,travel=r*(.11+.27*(1-Math.exp(-t*3))),size=r*(.70+i*.05)*(1-.532*t);
   this.quad('smoke',f.x+Math.cos(a)*travel,f.z+Math.sin(a)*travel+r*t*.10,size,size*.91,a+t*.65,WARM,t,screen);
  }
  const sparkAge=age-.07,life=.37,t=sparkAge/life;
  if(t>=0&&t<1)for(let i=0;i<5;i++){
   const a=seed+i*2.399963,travel=r*(.15+.85*t),size=r*(.055-i%2*.01);
   this.quad('spark',f.x+Math.cos(a)*travel,f.z+Math.sin(a)*travel-r*t*t*.08,size,size*2.3,a+Math.PI/2,GOLD,t,screen);
  }
  return true;
 }
 draw(view,depth=34){
  for(const [i,name]of ['smoke','fire','ring','light','spark'].entries()){
   const mesh=this.buffers.get(name)?.mesh;
   if(mesh?.indices.length)view.drawMeshes('missile-impact:'+name,[mesh],undefined,{presentationDepth:depth+i*.001});
  }
 }
 reset(){this.buffers.clear();}
}
