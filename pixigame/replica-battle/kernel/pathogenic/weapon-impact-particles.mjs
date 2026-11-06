import {VfxMeshBuffer,boundsVisible} from './vfx-buffers.mjs';
import {weaponImpactStyle} from '../weapon-impact-style.mjs';
import {impactWeaponSource} from '../impact-direction.mjs';

const ROOT='host://weapon-impact-particles-v1/';
const PARTICLE_SIZE_GAIN=1.4;
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
export const WEAPON_IMPACT_LIMITS=Object.freeze({total:48,perStyle:12});
const profiles={
 ice:{life:.38,count:7,spread:1.10,color:[.27,.85,1.28]},
 acid:{life:.40,count:7,spread:.97,color:[.34,1.10,.13]},
 electric:{life:.34,count:5,spread:.91,color:[.20,.66,1.65]},
 energy:{life:.36,count:7,spread:1.07,color:[.12,.73,1.55]},
 heat:{life:.40,count:8,spread:1.12,color:[1.50,.48,.075]},
};
const shaders={
 glow:`shader_type canvas_item;render_mode unshaded,blend_add;
void fragment(){vec2 p=UV*2.0-1.0;float r=dot(p,p);float a=exp(-r*17.0)+exp(-r*4.5)*.075;COLOR=vec4(COLOR.rgb,a*COLOR.a);}`,
 streak:`shader_type canvas_item;render_mode unshaded,blend_add;
void fragment(){vec2 p=UV*2.0-1.0;float a=exp(-p.y*p.y*7.0)*(1.0-smoothstep(.35,1.0,abs(p.x)));COLOR=vec4(COLOR.rgb,a*COLOR.a);}`,
 crystal:`shader_type canvas_item;render_mode unshaded,blend_mix;
void fragment(){vec2 p=UV*2.0-1.0;float d=abs(p.x)*.80+abs(p.y)*1.35;float edge=1.0-smoothstep(.83,1.0,d);float facet=smoothstep(-.13,.08,p.x-p.y*.45);vec3 c=mix(COLOR.rgb*.56,mix(COLOR.rgb,vec3(1.50,1.85,2.05),.67),facet);COLOR=vec4(c,edge*COLOR.a);}`,
 droplet:`shader_type canvas_item;render_mode unshaded,blend_mix;
void fragment(){vec2 p=UV*2.0-1.0;float r=length(vec2(p.x*.83,p.y));float a=1.0-smoothstep(.69,.96,r);float rim=exp(-abs(r-.69)*25.0);float shine=exp(-dot(p-vec2(-.22,-.25),p-vec2(-.22,-.25))*31.0);vec3 c=COLOR.rgb*(.55+rim*.45)+vec3(.90,1.15,.65)*shine;COLOR=vec4(c,a*COLOR.a);}`,
};
export function withWeaponImpactResources(graph){
 const resources={...graph.resources},programs={...graph.shaders};
 for(const [name,code]of Object.entries(shaders)){
  resources[ROOT+name]={type:'ShaderMaterial',properties:{shader:{$external:ROOT+name+'-shader'}}};
  programs[ROOT+name+'-shader']={code};
 }
 return {...graph,resources,shaders:programs};
}

// Each chip/drop is an independently moving quad, not a star painted inside
// one expanding square. All samples read the existing hit's position and age.
export class WeaponImpactParticles{
 constructor(){this.buffers=new Map();this.points=Array.from({length:4},()=>({x:0,y:0}));this.beginFrame();}
 beginFrame(viewport){this.viewport=viewport;this.count=0;this.counts={};this.seen=new Set();for(const b of this.buffers.values())b.reset();}
 matches(f){return weaponImpactStyle(f)!==undefined;}
 buffer(name){let b=this.buffers.get(name);if(!b){b=new VfxMeshBuffer(name,ROOT+name,name==='droplet'||name==='crystal'?1:2);this.buffers.set(name,b);}return b;}
 quad(name,x,z,rx,rz,angle,color,alpha,screen){
  if(alpha<=.001)return;
  rx*=PARTICLE_SIZE_GAIN;rz*=PARTICLE_SIZE_GAIN;
  const c=Math.cos(angle),s=Math.sin(angle);
  for(let i=0;i<4;i++){const u=i===1||i===2?rx:-rx,v=i<2?rz:-rz,p=screen(x+c*u-s*v,z+s*u+c*v);this.points[i].x=p.x;this.points[i].y=p.y;}
  const light=name==='glow'?1.15:1;
  this.buffer(name).quad(this.points,color[0]*light,color[1]*light,color[2]*light,alpha);
 }
 line(a,b,width,color,alpha,screen){
  const p=screen(a.x,a.z),q=screen(b.x,b.z),dx=q.x-p.x,dy=q.y-p.y,length=Math.hypot(dx,dy);
  if(length<.01||alpha<=.001)return;
  const w=Math.max(1.55,width*1.4),nx=-dy/length*w/2,ny=dx/length*w/2;
  const pts=this.points;pts[0].x=p.x+nx;pts[0].y=p.y+ny;pts[1].x=q.x+nx;pts[1].y=q.y+ny;
  pts[2].x=q.x-nx;pts[2].y=q.y-ny;pts[3].x=p.x-nx;pts[3].y=p.y-ny;
  this.buffer('streak').quad(pts,color[0],color[1],color[2],alpha);
 }
 effect(f,screen,visualScale=1,age=f.age){
  const style=weaponImpactStyle(f);if(!style)return false;
  const p=profiles[style];
  if(![f.x,f.z,age,f.duration,f.size,visualScale,f.originalScale??1].every(Number.isFinite)||age<0||!(f.duration>0&&f.size>0&&visualScale>0&&(f.originalScale??1)>0))return true;
  const life=Math.min(f.duration,p.life);if(age>=life||this.seen.has(f.uid))return true;
  const o=screen(f.x,f.z),unit=screen(f.x+1,f.z),px=Math.hypot(unit.x-o.x,unit.y-o.y);
  if(![o.x,o.y,px].every(Number.isFinite)||px<=0)return true;
  const scale=clamp(f.size/.8*visualScale*(f.originalScale??1),.65,1.65),extent=px*scale*1.6;
  if(!boundsVisible(o.x-extent,o.y-extent,o.x+extent,o.y+extent,this.viewport))return true;
  if(this.count>=WEAPON_IMPACT_LIMITS.total||(this.counts[style]??0)>=WEAPON_IMPACT_LIMITS.perStyle)return true;
  this.count++;this.counts[style]=(this.counts[style]??0)+1;this.seen.add(f.uid);
  const t=age/life,seed=(f.uid??0)*.754877666,dir=f.impactDirection;
  const yaw=dir?Math.atan2(dir.z,dir.x):Math.PI/2;
  const source=impactWeaponSource(f),color=style==='electric'&&source.familyId===200011?[.61,.35,1.55]:style==='energy'&&source.familyId===200101?[.22,.46,1.65]:p.color;
  const fade=(1-t)**(style==='ice'||style==='acid'?.95:.75);
  this.quad('glow',f.x,f.z,.36*scale,.36*scale,0,color.map(v=>v*1.8),Math.exp(-t*7.5)*.88,screen);
  for(let i=0;i<p.count;i++){
   const h=hash(seed+i*2.37),angle=yaw+Math.PI+(h-.5)*4.6;
   const speed=.63+hash(seed+i*7.13)*.55,spread=p.spread*scale;
   const distance=spread*(.06+(1-Math.exp(-t*3.5))*speed);
   const dx=Math.cos(angle),dz=Math.sin(angle),bend=(style==='acid'?-.19:style==='heat'?.17:-.07)*t*t*scale;
   const x=f.x+dx*distance,z=f.z+dz*distance+bend;
   const prior=spread*(.06+(1-Math.exp(-Math.max(0,t-.20)*3.5))*speed);
   const start={x:f.x+dx*prior,z:f.z+dz*prior+bend};
   if(style==='ice'){
    this.quad('crystal',x,z,scale*(.064+h*.028),scale*(.031+h*.016),angle+t*(i%2?3:-3),color,fade*.96,screen);
    this.line(start,{x,z},px*.018*scale,color.map(v=>v*1.3),fade*.40,screen);
    if(i<3)this.quad('glow',x,z,.065*scale,.065*scale,0,[1.55,2.05,2.45],fade*.66,screen);
   }else if(style==='acid'){
    this.quad('droplet',x,z,scale*(.047+h*.026),scale*(.037+h*.016),angle,color.map(v=>v*1.25),fade*.94,screen);
    if(i<2)this.quad('glow',x,z,.065*scale,.065*scale,0,[.82,1.85,.40],fade*.46,screen);
    this.line(start,{x,z},px*.025*scale,color,fade*.46,screen);
   }else{
    this.line(start,{x,z},px*(style==='energy'?.027:.021)*scale,color.map(v=>v*1.7+.35),fade*.94,screen);
    this.quad('glow',x,z,(style==='heat'?.085:.075)*scale,.075*scale,0,color.map(v=>v*1.8+.65),fade*.88,screen);
   }
  }
  if(style==='electric')for(let branch=0;branch<3;branch++){
   const angle=yaw+Math.PI+(branch-1)*1.08+(hash(seed+branch)-.5)*.4,reach=scale*(.28+.47*(1-Math.exp(-t*6)));
   let prev={x:f.x,z:f.z};
   for(let j=1;j<=4;j++){
    const along=reach*j/4,kink=(hash(seed+branch*13+j*3+Math.floor(t*5))-.5)*scale*.13;
    const next={x:f.x+Math.cos(angle)*along-Math.sin(angle)*kink,z:f.z+Math.sin(angle)*along+Math.cos(angle)*kink};
    this.line(prev,next,px*.055*scale,color,fade*.38,screen);
    this.line(prev,next,px*.022*scale,color.map(v=>v*2.2+.55),fade*.94,screen);
    if(j===3){const tip={x:next.x+Math.cos(angle+.65)*reach*.24,z:next.z+Math.sin(angle+.65)*reach*.24};this.line(next,tip,px*.016*scale,color.map(v=>v*1.7),fade*.62,screen);}
    prev=next;
   }
  }
  return true;
 }
 draw(view,depth=34){for(const name of ['droplet','crystal','glow','streak']){const b=this.buffers.get(name);if(b?.mesh.indices.length)view.drawMeshes('weapon-impact:'+name,[b.mesh],undefined,{presentationDepth:depth});}}
 reset(){this.beginFrame(this.viewport);this.buffers.clear();}
}
