import {VfxMeshBuffer,boundsVisible} from './vfx-buffers.mjs';
import {WEAPON_SKIN_FAMILIES,weaponSkinMatches} from '../weapon-skin-identity.mjs';
export {withWeaponSkinResources} from './weapon-skin-materials.mjs';

// Two pooled batches for the entire skin, rather than an emitter per bullet.
// All animation is a pure sample of the host's real position, age and segments.
const ROOT='host://weapon-skin-v1/';
export const WEAPON_SKIN_VFX_LIMITS=Object.freeze({projectiles:80,effects:28,vertices:2048,indices:6144,trails:80,trailPoints:9});
const TAU=Math.PI*2,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const fract=v=>v-Math.floor(v),hash=v=>fract(Math.sin(v*127.1+311.7)*43758.5453);
const WHITE=[1.26,1.2,1.12],GOLD=[1.15,.67,.13],PINK=[1.12,.23,.61],CYAN=[.18,.91,1.16],PURPLE=[.64,.32,1.18],MINT=[.26,1.06,.69];
const THEMES={20102:GOLD,20202:PINK,20302:PURPLE,20402:MINT,20502:CYAN,20602:PURPLE,20702:PINK,20802:PURPLE,20902:CYAN,21002:PINK,21102:PURPLE};
const COLORS=[PINK,CYAN,GOLD,PURPLE,MINT];
class Brush{
  constructor(){this.solid=new VfxMeshBuffer('solid',ROOT+'solid',1);this.light=new VfxMeshBuffer('light',ROOT+'light',2);}
  reset(){this.solid.reset();this.light.reset();}
  quad(points,color,alpha=1,mode=0,layer='light'){
    const b=this[layer],m=b.mesh;if(m.vertices.length+4>WEAPON_SKIN_VFX_LIMITS.vertices||m.indices.length+6>WEAPON_SKIN_VFX_LIMITS.indices)return;
    const base=m.vertices.length;
    for(let i=0;i<4;i++){const c=Array.isArray(color[0])?color[i]:color,p=points[i];
      b.vertex(p[0],p[1],mode*2+(i===1||i===2?1:0),i>=2?1:0,c[0],c[1],c[2],clamp((Array.isArray(alpha)?alpha[i]:alpha)*(c[3]??1)));}
    m.indices.push(base,base+1,base+2,base,base+2,base+3);
  }
  sprite(x,y,rx,ry,color,alpha,mode,layer='light',angle=0){
    const c=Math.cos(angle),s=Math.sin(angle),p=(a,b)=>[x+c*a-s*b,y+s*a+c*b];
    this.quad([p(-rx,-ry),p(rx,-ry),p(rx,ry),p(-rx,ry)],color,alpha,mode,layer);
  }
  ribbon(points,width,color,alpha=1,profile=2){
    const n=points.length,b=this.light,m=b.mesh;if(n<2||n>96||m.vertices.length+n*2>WEAPON_SKIN_VFX_LIMITS.vertices||m.indices.length+(n-1)*6>WEAPON_SKIN_VFX_LIMITS.indices)return;
    const start=m.vertices.length;
    for(let i=0;i<n;i++){const p=points[i],a=points[Math.max(0,i-1)],z=points[Math.min(n-1,i+1)],dx=z[0]-a[0],dy=z[1]-a[1],d=Math.max(.001,Math.hypot(dx,dy));
      const w=(Array.isArray(width)?width[i]:width)*.5,c=Array.isArray(color[0])?color[i]:color,opacity=clamp(Array.isArray(alpha)?alpha[i]:alpha);
      b.vertex(p[0]-dy/d*w,p[1]+dx/d*w,profile*2+i/(n-1),0,c[0],c[1],c[2],opacity);
      b.vertex(p[0]+dy/d*w,p[1]-dx/d*w,profile*2+i/(n-1),1,c[0],c[1],c[2],opacity);
      if(i){const k=start+i*2;m.indices.push(k-2,k-1,k,k-1,k+1,k);}
    }
  }
  poly(points,color,alpha=1,layer='light'){
    const b=this[layer],m=b.mesh,n=points.length;
    if(n<3||m.vertices.length+n>WEAPON_SKIN_VFX_LIMITS.vertices||m.indices.length+(n-2)*3>WEAPON_SKIN_VFX_LIMITS.indices)return;
    const start=m.vertices.length;
    for(let i=0;i<n;i++){const p=points[i],c=Array.isArray(color[0])?color[i]:color;
      b.vertex(p[0],p[1],.5,.5,c[0],c[1],c[2],clamp((Array.isArray(alpha)?alpha[i]:alpha)*(c[3]??1)));}
    for(let i=1;i<n-1;i++)m.indices.push(start,start+i,start+i+1);
  }
  line(a,b,width,color,alpha=1,layer='light'){
    const x=b[0]-a[0],y=b[1]-a[1],l=Math.hypot(x,y);if(l<.01)return;
    const nx=-y/l*width/2,ny=x/l*width/2;
    this.quad([[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]],color,Array.isArray(alpha)?[alpha[0],alpha[1],alpha[1],alpha[0]]:alpha,layer==='light'?2:0,layer);
  }
  disk(x,y,rx,ry,color,alpha=1,soft=false,layer='light'){
    if(soft){this.sprite(x,y,rx,ry,color,alpha,1,layer);return;}
    const n=12,points=[[x,y]],a=[alpha];
    for(let i=0;i<=n;i++){const t=i/n*TAU;points.push([x+Math.cos(t)*rx,y+Math.sin(t)*ry]);a.push(soft?0:alpha);}
    this.poly(points,color,a,layer);
  }
  arc(x,y,rx,ry,start,end,width,color,alpha=1){
    const n=Math.min(24,Math.max(3,Math.ceil(Math.abs(end-start)*3)));
    const points=[];for(let i=0;i<=n;i++){const t=start+(end-start)*i/n;points.push([x+Math.cos(t)*rx,y+Math.sin(t)*ry]);}this.ribbon(points,width,color,alpha);
  }
  star(x,y,r,color,alpha=1,angle=0){
    this.sprite(x,y,r,r,color,alpha,3,'light',angle);
  }
  ring(x,y,rx,ry,color,alpha=1){this.sprite(x,y,rx/.74,ry/.74,color,alpha,4);}
  note(x,y,size,color,alpha=1){
    this.disk(x-size*.18,y+size*.30,size*.28,size*.18,color,alpha);
    this.line([x+size*.05,y+size*.28],[x+size*.05,y-size*.62],size*.13,color,alpha);
    this.line([x+size*.05,y-size*.62],[x+size*.48,y-size*.40],size*.17,color,alpha);
  }
  meshes(){return[this.solid.mesh,this.light.mesh].filter(m=>m.indices.length);}
}

export class WeaponSkinVfx{
  constructor(){this.brush=new Brush();this.trails=new Map();this.lastTime=-Infinity;this.reset();}
  reset(){this.trails.clear();this.lastTime=-Infinity;this.beginFrame(0,0);}
  beginFrame(skinId,time,viewport){
    if(skinId!==this.skinId||time<this.lastTime-1e-6||time-this.lastTime>.6)this.trails.clear();
    this.skinId=Number(skinId)||0;this.lastTime=time;this.time=time;this.viewport=viewport;this.projectiles=0;this.effects=0;this.brush.reset();
    for(const [id,trail]of this.trails)if(time-trail.lastSeen>trail.life)this.trails.delete(id);
  }
  rememberTrail(b,x,z,width,color,life=.22,length=40){
    if(!this.active||!Number.isFinite(this.time))return;
    let t=this.trails.get(b.uid);
    if(t&&(b.age<t.age||Math.hypot(x-t.x,z-t.z)>6)){this.trails.delete(b.uid);t=undefined;}
    if(!t){if(this.trails.size>=WEAPON_SKIN_VFX_LIMITS.trails)this.trails.delete(this.trails.keys().next().value);
      t={x,z,age:b.age,lastSeen:this.time,nextAt:this.time,width,color,life,points:[]};this.trails.set(b.uid,t);}
    if(this.time>=t.nextAt&&(!t.points.length||Math.hypot(x-t.points.at(-1).x,z-t.points.at(-1).z)>.035)){
      t.points.push({x,z,at:this.time});t.nextAt=this.time+.025;
      if(t.points.length>WEAPON_SKIN_VFX_LIMITS.trailPoints)t.points.shift();
    }
    t.x=x;t.z=z;t.age=b.age;t.lastSeen=this.time;t.width=width;t.color=color;t.life=life;t.length=length;
  }
  drawTrails(){
    if(!this.screen)return;
    for(const [uid,t]of this.trails){
      const samples=t.points.filter(p=>this.time-p.at<t.life),points=[],width=[],alpha=[];
      if(this.time-t.lastSeen<.06&&samples.length)samples.push({x:t.x,z:t.z,at:this.time});
      const projected=samples.map(s=>({...this.screen(s.x,s.z),at:s.at}));let distance=0;
      const clipped=[];for(let i=projected.length-1;i>=0;i--){const p=projected[i],last=clipped.at(-1);
        if(last){const segment=Math.hypot(last.x-p.x,last.y-p.y);if(distance+segment>t.length){const amount=(t.length-distance)/Math.max(.001,segment);clipped.push({x:last.x+(p.x-last.x)*amount,y:last.y+(p.y-last.y)*amount,at:last.at+(p.at-last.at)*amount});break;}distance+=segment;}
        clipped.push(p);
      }clipped.reverse();
      for(let i=0;i<clipped.length;i++){const s=clipped[i],fade=clamp(1-(this.time-s.at)/t.life),along=i/Math.max(1,clipped.length-1);points.push([s.x,s.y]);width.push(t.width*(.18+fade*.82));alpha.push(fade*fade*.50*along);}
      if(points.length>1){this.brush.ribbon(points,width,t.color,alpha,5);
        for(let i=0;i<2;i++){const k=Math.floor((i+.35)/2*(points.length-1)),p=points[k],next=points[Math.min(k+1,points.length-1)],dx=next[0]-p[0],dy=next[1]-p[1],d=Math.max(.001,Math.hypot(dx,dy)),drift=Math.sin(this.time*5+uid+i*2.1)*(3+i*2);
          this.brush.sprite(p[0]-dy/d*drift,p[1]+dx/d*drift,2.4+i,2.4+i,t.color,(alpha[k]??0)*.35,1);}
      }
    }
  }
  get active(){return Boolean(WEAPON_SKIN_FAMILIES[this.skinId]);}
  valid(b){return weaponSkinMatches(this.skinId,b)&&b.modelId>0&&!b.dead&&!b.visualHidden&&b.scale>0
    &&[b.x,b.z,b.age,b.scale,b.radiusX,b.radiusZ,b.angle??0,b.offsetX??0,b.offsetZ??0,b.visualAngle??0,b.warmup??0].every(Number.isFinite)
    &&b.age>=Math.max(0,b.warmup??0)&&b.age<b.lifetime;}
  effectMatches(f){return this.active&&f.weaponSkinFamily===WEAPON_SKIN_FAMILIES[this.skinId]
    &&(f.kind==='hit'||f.kind==='explosion'||[210016,220005,220017].includes(f.modelId))
    &&[f.x,f.z,f.age,f.duration,f.size,f.originalScale??1,f.angle??0,f.originalSpeed??1].every(Number.isFinite)
    &&f.age>=0&&f.age<f.duration;}
  visible(p,r=80){return boundsVisible(p.x-r,p.y-r,p.x+r,p.y+r,this.viewport);}
  projectile(b,screen){
    if(!this.valid(b)||this.projectiles>=WEAPON_SKIN_VFX_LIMITS.projectiles||this.brush.light.mesh.vertices.length>1700)return false;
    // Host owns beam origins, ends and hit events; no synthetic damaging rays.
    if(b.beam||b.trajectory==='Thunder'&&b.segments?.length){if(!b.segments?.length||b.collisionDisabled)return false;this.projectiles++;this.beam(b,screen);return true;}
    this.screen=screen;const p=screen(b.x,b.z),u=screen(b.x+1,b.z),px=Math.hypot(u.x-p.x,u.y-p.y);
    if(![p.x,p.y,px].every(Number.isFinite)||px<=0||!this.visible(p))return false;
    const yaw=b.visualAngle??(Math.hypot(b.vx??0,b.vz??0)>.001?Math.atan2(b.vx,b.vz):b.angle??0);
    const q=screen(b.x+Math.sin(yaw),b.z+Math.cos(yaw)),len=Math.hypot(q.x-p.x,q.y-p.y);if(!(len>.001))return false;
    const dx=(q.x-p.x)/len,dy=(q.y-p.y)/len;
    const base=b.angle??0,ox=(b.offsetX??0)*Math.cos(base)+(b.offsetZ??0)*Math.sin(base),oz=-(b.offsetX??0)*Math.sin(base)+(b.offsetZ??0)*Math.cos(base),origin=screen(b.x+ox,b.z+oz);
    const point=(x,y)=>[origin.x-dy*x+dx*y,origin.y+dx*x+dy*y];
    const rx=clamp(b.radiusX*px,2.5,22),rz=clamp(b.radiusZ*px,5,30),a=clamp(b.age/.055)*clamp((b.lifetime-b.age)/.08),id=this.skinId;
    if(![350001,350002,350003,350004,400025].includes(b.weaponId)&&id!==21102)
      this.rememberTrail(b,b.x+ox,b.z+oz,id===20102?5:id===20202?9:id===20402?20:id===20502?11:id===20902?10:8,THEMES[id],id===20102?.12:.26,id===20102?24:id===20202?45:id===20402?28:id===20902?34:40);
    this.projectiles++;
    if([350001,350002,350003,350004].includes(b.weaponId))this.musicStrike(b,origin,a);
    else if(id===20102)this.cannon(b,point,rx,rz,a);
    else if(id===20202)this.firework(b,point,rx,rz,a);
    else if(id===20402)this.slime(b,point,rx,rz,a);
    else if(id===20502)this.butterfly(b,point,rx,rz,a);
    else if(id===20602)this.musicOrb(b,point,rx,rz,a);
    else if(id===20802)this.starBlade(b,point,rx,rz,a);
    else if(id===20902)this.thorn(b,point,rx,rz,a);
    else if(id===21102)this.blackHole(b,p,Math.max(b.radiusX,b.radiusZ)*px,a);
    else this.starBlade(b,point,rx,rz,a);
    return true;
  }
  cannon(b,p,rx,rz,a){const g=this.brush,w=clamp(rx,.0,5.5),h=clamp(rz,8,19);
    g.quad([p(-w,-h*.6),p(w,-h*.6),p(w,h),p(-w,h)],GOLD,a,6,'solid');
    g.line(p(0,-h*.42),p(0,h*.72),2.8,[1.42,1.16,.68],a*.82);
    g.line(p(0,-h*.65),p(0,-h-20),7,GOLD,[a*.6,0]);
    const q=p(0,h*.45);g.sprite(q[0],q[1],w*1.8,h*.45,GOLD,a*.27,1);
  }
  firework(b,p,rx,rz,a){const g=this.brush,w=clamp(rx,4.5,8),h=clamp(rz,12,22);
    for(const s of [-1,1])g.poly([p(s*w*.72,-h*.40),p(s*w*1.42,-h*.78),p(s*w*.88,-h*.92),p(s*w*.5,-h*.62)],[[.70,.42,.09],[1,.77,.34],[.28,.16,.04],[.85,.55,.13]],a,'solid');
    g.quad([p(-w,-h*.85),p(w,-h*.85),p(w,h),p(-w,h)],[1,1,1],a,5,'solid');
    const emblem=p(0,h*.04);g.star(emblem[0],emblem[1],w*.43,GOLD,a*.64,b.visualAngle??b.angle??0);
    const nozzle=p(0,-h*.75);g.sprite(nozzle[0],nozzle[1],w*2.5,w*2.5,[1.45,.72,.16],a*.55,1);
    const plume=24+3*Math.sin(b.age*27+b.uid);g.line(p(0,-h*.7),p(0,-h-plume),w*1.9,[1.35,.57,.10],[a*.9,0]);
    g.line(p(0,-h*.7),p(0,-h-10),w*.65,WHITE,[a*.85,0]);
    for(let i=0;i<3;i++){const t=fract(b.age*2.4+i/3),q=p(Math.sin(i*2.4+t*4)*(2+t*6),-h-6-t*32);g.star(q[0],q[1],3.3*(1-t),i===1?PINK:GOLD,a*(1-t)*.66,.4+i);}
  }
  slime(b,p,rx,rz,a){const g=this.brush,r=clamp(Math.max(rx,rz*.65),7,20),s=1+.08*Math.sin(b.age*11);
    const q=p(0,0);g.sprite(q[0],q[1],r*1.45,r*1.35,MINT,a*.16,1);
    g.sprite(q[0],q[1],r*s,r/s,MINT,a,1,'solid');
    for(let i=0;i<3;i++){const t=fract(b.age*2+i/3),u=p(Math.sin(i*2.4+b.age)*r*.40,-r*.7-t*26),small=r*(.28-t*.12);
      g.sprite(u[0],u[1],small,small,MINT,a*(1-t)*.65,1,'solid');}
  }
  butterfly(b,p,rx,rz,a){const g=this.brush,w=clamp(Math.max(rx,rz*.65),10,24),flap=.63+.37*Math.abs(Math.sin(b.age*13+b.uid)),phase=b.age*2;
    for(const s of [-1,1]){
      g.quad([p(0,-3),p(s*w*.76*flap,-rz*.12),p(s*w*1.06*flap,rz*.86),p(s*w*.17,rz*.65)],CYAN,a*.94,2,'solid');
      g.quad([p(0,-rz*.18),p(s*w*.66*flap,-rz*.77),p(s*w*.9*flap,-rz*.10),p(s*w*.1,rz*.1)],[.53,.54,1.12],a*.78,2,'solid');
      g.ribbon([p(0,-1),p(s*w*.32*flap,rz*.18),p(s*w*.72*flap,rz*.52)],[2,2.7,.5],CYAN,[a*.1,a*.50,0]);
    }
    g.line(p(0,-rz*.38),p(0,rz*.65),3.3,WHITE,a*.78);
    const center=p(0,rz*.12);g.sprite(center[0],center[1],w*.75,rz*.6,CYAN,a*.25,1);
    for(let i=0;i<2;i++){const t=fract(b.age*1.7+i*.5),q=p(Math.sin(i*2.3+t*3+phase)*6,-rz-4-t*30);g.star(q[0],q[1],3.5*(1-t),i?PURPLE:CYAN,a*(1-t)*.60,b.age);}
  }
  musicOrb(b,p,rx,rz,a){const g=this.brush,r=clamp(Math.max(rx,rz*.6),9,19),q=p(0,0);
    g.sprite(q[0],q[1],r*1.55,r*1.55,PURPLE,a*.20,1);
    g.sprite(q[0],q[1],r,r,[.54,.28,1.0],a,1,'solid');
    g.arc(q[0],q[1],r*1.03,r*.76,b.age*2,b.age*2+TAU*.65,3,PINK,a*.6);g.note(q[0],q[1],r*.8,CYAN,a*.9);
    for(let i=0;i<2;i++){const t=fract(b.age*1.5+i*.5),u=p((i?1:-1)*(3+t*7),-r-5-t*24);g.note(u[0],u[1],5,i?PURPLE:CYAN,a*(1-t)*.5);}
  }
  musicStrike(b,p,a){const g=this.brush,neon=this.skinId===21002,height=82*clamp(b.scale,.8,1.4),fade=a*clamp((.85-b.age)/.22),color=neon?PINK:CYAN;
    const points=[];for(let i=0;i<=12;i++){const k=i/12,offset=Math.sin(k*Math.PI)*(Math.sin(i*2.9+b.uid+b.age*21)*5+Math.sin(i*1.3-b.age*17)*2.5);points.push([p.x+offset,p.y-height*(1-k)]);}
    g.ribbon(points,12,color,fade*.19);g.ribbon(points,3.6,color,fade*.86);g.ribbon(points,1.3,WHITE,fade*.64);
    g.sprite(p.x,p.y,23,12,color,fade*.30,1);g.star(p.x,p.y,10,WHITE,fade*.75,b.age*2);
    g.note(p.x+12,p.y-9,8.5,neon?CYAN:PINK,fade*.7);g.ring(p.x,p.y,14,5,color,fade*.55);
  }
  starBlade(b,p,rx,rz,a){const g=this.brush,w=clamp(rx,4,11),h=clamp(rz,10,30);
    g.quad([p(-w,-h*.75),p(w,-h*.75),p(w,h),p(-w,h)],PURPLE,a*.85,3,'solid');
    g.line(p(0,-h*.55),p(0,h*.80),3.1,[1.22,.93,1.5],a*.80);
    g.line(p(0,-h*.55),p(0,-h-24),w*1.5,PURPLE,[a*.5,0]);
    const q=p(0,h*.20);g.star(q[0],q[1],w*1.3,GOLD,a*.7,b.age*.4);
  }
  iceNeedle(b,p,rx,rz,a){const g=this.brush,w=clamp(rx*.48,2.5,6),h=clamp(rz*1.1,12,24);
    g.quad([p(-w,-h*.65),p(w,-h*.65),p(w,h),p(-w,h)],CYAN,a*.78,3,'solid');
    g.line(p(0,-h*.55),p(0,h*.8),2.2,WHITE,a*.75);
    const q=p(-w*.5,-h*.7);g.star(q[0],q[1],3.4,CYAN,a*.48,b.age*.5);
  }
  thorn(b,p,rx,rz,a){if(b.weaponId===400026){this.iceNeedle(b,p,rx,rz,a);return;}const g=this.brush,r=clamp(Math.max(rx,rz*.85),12,29),q=p(0,0),t=b.age*2.1;
    g.sprite(q[0],q[1],r*1.5,r*1.5,CYAN,a*.15,1);g.sprite(q[0],q[1],r*.83,r*.83,[.10,.60,.95],a*.9,3,'solid');
    for(let i=0;i<6;i++){const angle=t+i/6*TAU,c=Math.cos(angle),s=Math.sin(angle),point=(x,y)=>[q[0]+c*x-s*y,q[1]+s*x+c*y];
      g.poly([point(r*.55,-r*.15),point(r*1.16,0),point(r*.55,r*.15),point(r*.72,0)],[[.15,.42,.62],WHITE,CYAN,[.12,.42,.69]],a*.9,'solid');
      g.line(point(r*.37,0),point(r*.95,0),2.4,CYAN,a*.60);
    }
    g.arc(q[0],q[1],r*.61,r*.61,-t,-t+TAU*.72,3.3,CYAN,a*.62);g.star(q[0],q[1],r*.36,WHITE,a*.58,-t);
    for(let i=0;i<2;i++){const angle=-t+i*Math.PI;g.star(q[0]+Math.cos(angle)*r*1.21,q[1]+Math.sin(angle)*r*1.21,4,CYAN,a*.6,t);}
  }
  blackHole(b,p,worldRadius,a){const g=this.brush,pulse=b.weaponId===400025,r=clamp(worldRadius,18,pulse?170:52),t=b.age;
    if(pulse){const f=clamp(t/Math.min(.65,b.lifetime)),ring=r*(.18+f*.88),fade=a*(1-f);g.ring(p.x,p.y,ring,ring,PURPLE,fade*.75);g.ring(p.x,p.y,ring*.93,ring*.93,[1.12,.41,.65],fade*.30);return;}
    g.sprite(p.x,p.y,r*1.40,r*1.10,PURPLE,a*.17,1);
    g.sprite(p.x,p.y,r*1.12,r*.94,[.80,.25,1.30],a,4,'solid');
    g.arc(p.x,p.y,r*.66,r*.25,-t*.7,-t*.7+Math.PI*1.5,7,[1.12,.36,.67],a*.55);
    for(let i=0;i<4;i++){const f=fract(t*.45+i*.25),angle=i*2.4-t*1.4,d=r*(1.45-f*.9);g.star(p.x+Math.cos(angle)*d,p.y+Math.sin(angle)*d*.72,3.5*(1-f*.5),i%2?CYAN:GOLD,a*(1-f)*.66,angle);}
  }
  beam(b,screen){const g=this.brush,id=this.skinId,color=THEMES[id],segments=b.segments||[],electric=[20602,21002].includes(id),fan=segments.length>12;
    for(let j=0;j<segments.length;j++){
      if(fan&&j%3&&j!==segments.length-1)continue;
      const seg=segments[j],a=screen(seg.from.x,seg.from.z),z=screen(seg.to.x,seg.to.z),dx=z.x-a.x,dy=z.y-a.y,len=Math.hypot(dx,dy);
      if(![a.x,a.y,z.x,z.y,len].every(Number.isFinite)||len<.1||!boundsVisible(Math.min(a.x,z.x)-20,Math.min(a.y,z.y)-20,Math.max(a.x,z.x)+20,Math.max(a.y,z.y)+20,this.viewport))continue;
      const span=screen(b.x+b.radiusX,b.z),origin=screen(b.x,b.z),halfWidth=Math.hypot(span.x-origin.x,span.y-origin.y);
      const nx=-dy/len,ny=dx/len,point=(f,off=0)=>[a.x+dx*f+nx*off,a.y+dy*f+ny*off],width=electric?2.1:clamp(halfWidth*.7,id===20702?4:2.5,id===20702?12:8);
      g.line(point(0),point(1),width*4.2,color,.15);g.line(point(0),point(1),width*1.75,color,.80);g.line(point(0),point(1),Math.max(1,width*.27),WHITE,.7);
      if(electric){
        const n=Math.min(16,Math.max(3,Math.ceil(len/24))),points=[];
        for(let i=0;i<=n;i++){const f=i/n,offset=Math.sin(f*Math.PI)*(Math.sin(i*2.7+b.uid+b.age*19)*4+Math.sin(i*1.3-b.age*13)*2);points.push(point(f,offset));}
        g.ribbon(points,7,id===21002?CYAN:PINK,.18);g.ribbon(points,2.4,id===21002?CYAN:PINK,.82);
        if(j%2===0){const p=point(.67,10);g.note(p[0],p[1],7.5,id===21002?PINK:CYAN,.74);}
        if(id===21002){for(let i=0;i<3;i++){const p=point(.25+i*.22,8);g.line([p[0]-nx*3,p[1]-ny*3],[p[0]+nx*(5+3*Math.sin(b.age*24+i)),p[1]+ny*(5+3*Math.sin(b.age*24+i))],1.3,CYAN,.66);}}
      }else{
        for(let i=0;i<2;i++){const f=fract(b.age*(id===20702?1.1:.7)+i*.5),p=point(f,Math.sin(f*TAU+b.age*3)*2);g.star(p[0],p[1],id===20702?7:6.5,i?GOLD:CYAN,.72,Math.atan2(dy,dx));}
        g.line(point(0,width*.75),point(1,width*.75),1.6,id===20702?GOLD:PINK,.40);
      }
    }
  }
  effect(f,screen,scale=1){
    if(!this.effectMatches(f))return false;
    if(this.effects>=WEAPON_SKIN_VFX_LIMITS.effects)return true;
    const p=screen(f.x,f.z);if(![p.x,p.y].every(Number.isFinite)||!this.visible(p,110))return true;
    this.effects++;const id=this.skinId,g=this.brush,t=f.age,life=Math.min(f.duration,id===20202?.68:.44),u=clamp(t/life),fade=(1-u)**1.3,color=THEMES[id];
    if(!fade)return true;
    const unit=screen(f.x+1,f.z),px=Math.hypot(unit.x-p.x,unit.y-p.y);
    const impact=f.kind==='explosion'||f.modelId===210016,r=impact?clamp(px*3*(f.originalScale??1)*scale,24,85):clamp(12*(f.originalScale??1)*scale,8,35);
    if(id===20202){
      // A brief flash opens into staggered, decelerating comets. Their curved
      // fading tails and gravity are sampled analytically, with no RNG or timers.
      const flash=clamp(1-t/.105);g.sprite(p.x,p.y,r*.95,r*.95,[1.65,.95,.35],flash*.7,1);g.star(p.x,p.y,r*.60,WHITE,flash*.75,.35);
      g.ring(p.x,p.y,r*(.16+u*.78),r*(.16+u*.78),GOLD,clamp(1-t/.23)*.22);
      g.sprite(p.x,p.y,r*.6,r*.6,[1.4,.48,.56],fade*.10,1);
      const brightFade=Math.pow(1-u,.78);
      const n=impact?14:7,palette=[[2.25,1.22,.38],[2.18,.49,.91],[.52,1.58,2.16],[1.55,.84,2.20]];
      for(let i=0;i<n;i++){
        const elapsed=t-hash(f.uid+i*7)*.028;if(elapsed<=0)continue;
        const angle=i/n*TAU+hash(f.uid)*.45,speed=.68+hash(f.uid+i)*.38,c=palette[i%4],points=[];
        const at=age=>{const d=r*(.10+(1-Math.exp(-Math.max(0,age)*4.2))*1.24)*speed;return[p.x+Math.cos(angle)*d,p.y+Math.sin(angle)*d+age*age*44];};
        for(let j=0;j<4;j++)points.push(at(Math.max(0,elapsed-(3-j)*.028)));
        g.ribbon(points,[3.0,6.0,11.0,7.0],c,[0,brightFade*.12,brightFade*.26,brightFade*.22],5);
        g.ribbon(points,[1.5,3.2,5.2,3.8],c,[0,brightFade*.45,brightFade*.95,brightFade]);
        const tip=points.at(-1);g.sprite(tip[0],tip[1],3.7,3.7,c,brightFade,1);
        if(i%2===0)g.star(tip[0],tip[1],7.4*(1-u*.45),c,brightFade*.95,.4+i);
        if(i%3===0&&elapsed>.08){const q=at(elapsed*.73);g.sprite(q[0]+3,q[1]+5,2.6,2.6,c,fade*.43,1);}
      }
      for(let i=0;i<6;i++){const age=t-.045-hash(f.uid+i)*.025;if(age<0)continue;const angle=i/6*TAU+.47,dist=r*(1-Math.exp(-age*5))*(.35+hash(i+f.uid)*.24),c=i%2?[1.6,.60,.42]:[1.6,1.02,.43];g.sprite(p.x+Math.cos(angle)*dist,p.y+Math.sin(angle)*dist+age*age*22,3.0,3.0,c,fade*.55,1);}
      return true;
    }
    if(id===20402){g.ring(p.x,p.y,r*(.25+u*.8),r*(.18+u*.5),MINT,fade*.30);for(let i=0;i<5;i++){const angle=i/5*TAU,d=r*(.2+u*.85),q=[p.x+Math.cos(angle)*d,p.y+Math.sin(angle)*d-u*10],size=(3+hash(i+f.uid)*4)*(1-u*.45);g.sprite(q[0],q[1],size,size,MINT,fade*.82,1,'solid');}return true;}
    if([20602,21002].includes(id)){g.ring(p.x,p.y,r*(.3+u),r*(.13+u*.45),color,fade*.3);for(let i=0;i<3;i++){const angle=i/3*TAU+f.uid,x=p.x+Math.cos(angle)*r*u,y=p.y+Math.sin(angle)*r*u-8*u;g.note(x,y,6.5, i%2?CYAN:PINK,fade*.8);}g.star(p.x,p.y,r*.8,WHITE,clamp(1-t/.14)*.75,t);return true;}
    if(id===21102){g.ring(p.x,p.y,r*(.5+u),r*(.5+u)*.7,PURPLE,fade*.5);for(let i=0;i<4;i++){const angle=i/4*TAU-u*3,d=r*(1-u*.7);g.star(p.x+Math.cos(angle)*d,p.y+Math.sin(angle)*d,4,CYAN,fade*.7);}return true;}
    const count=id===20102?7:6;
    for(let i=0;i<count;i++){const angle=i/count*TAU+hash(f.uid)*TAU,d=r*(.15+u),x=p.x+Math.cos(angle)*d,y=p.y+Math.sin(angle)*d;
      if(id===20502){g.line([x-Math.cos(angle)*6,y-Math.sin(angle)*6],[x,y+u*u*5],2.8,i%2?CYAN:PURPLE,[0,fade*.72]);g.sprite(x,y,3.2,3.2,CYAN,fade*.5,1);}
      else if(id===20902)g.sprite(x,y,2.4,5.2,CYAN,fade*.85,3,'solid',angle);
      else{g.line([x-Math.cos(angle)*7,y-Math.sin(angle)*7],[x,y],2.4,i%2?color:GOLD,[0,fade*.8]);if(i%2===0)g.star(x,y,(id===20702?5.7:4)*(1-u*.4),i%2?color:GOLD,fade*.75,angle+t);}
    }
    g.star(p.x,p.y,r*.6,WHITE,clamp(1-t/.12)*.8,t);return true;
  }
  sword(f,meshes){
    if(!this.effectMatches(f))return false;if(this.effects++>=WEAPON_SKIN_VFX_LIMITS.effects)return true;
    const g=this.brush;let edge=[],alpha=0;
    // Native blade meshes include a wide shader-masked interior. Read only the
    // outer UV edge, never fill that interior with an untextured bright fan.
    for(const m of meshes){const vertices=m.vertices.filter(v=>v.uv[1]<=.015&&v.color[3]>.02).sort((a,b)=>a.uv[0]-b.uv[0]);
      const weight=Math.max(0,...vertices.map(v=>v.color[3]));if(vertices.length>1&&weight>alpha){edge=vertices;alpha=weight;}}
    const points=edge.map(v=>v.position),width=edge.map((_,i)=>6+Math.sin(i/Math.max(1,edge.length-1)*Math.PI)*10);
    const colors=edge.map((_,i)=>{const t=i/Math.max(1,edge.length-1);return[.60+t*.72,.40-t*.13,1.38-t*.38];});
    g.ribbon(points,width,PURPLE,alpha*.30);g.ribbon(points,8.5,colors,alpha*.85);g.ribbon(points,1.4,WHITE,alpha*.68);
    for(let i=0;i<Math.min(4,edge.length);i++){const k=Math.floor((i+.35)/4*edge.length),p=edge[k].position;g.star(p[0],p[1],5.4,i%2?CYAN:GOLD,alpha*.75,f.age*2+i);}
    return true;
  }
  draw(source,depth){this.drawTrails();const meshes=this.brush.meshes();if(meshes.length)source.drawMeshes('weapon-skin',meshes,undefined,{presentationDepth:depth});}
}
