import {commonWeaponFragmentShader as fragmentShader} from './common-weapon-shader.js';
import * as T from 'three';
import {CommonWeaponModels,commonModelAssets} from './common-weapon-models.js';
import {commonWeaponPresentation,commonEffectScale} from './common-weapon-presentation.js';
import {grenadeHop,toxinShapeSeed} from './common-weapon-motion.js';
import {commonCannonShape} from '../fixed-parts/common-cannon-shape.js';
import {DroneSpriteModels} from './drone-sprite-models.js';
import {hitFeedbackProfile,hitFeedbackPriority} from './enemy-hit-feedback.js';

// One GPU surface per effect. Common weapons never use Canvas, line paths,
// polygon silhouettes, or CPU-tessellated circles.
export const EFFECTS={beam:0,lightning:1,'frost-ray':2,'cut-ray':3,exhaust:4,smoke:5,toxin:6,fire:7,gravity:8,frost:9,'frost-wave':10,blast:11,hit:12,scan:13,'mine-link':14,slash:15,'ring-slash':16,heat:17,compression:18,slipstream:19,'duration-ticks':20,'storm-cloud':21,'contact-ripple':22,penetration:23,sonic:24,focus:25,muzzle:26,landing:27,guidance:28,rift:29,lock:30,'poison-collapse':31,bounce:32,collision:33,block:34,reflect:35,'ice-flash':36,node:37,hilt:38,corner:39,discharge:40,'orb-fade':41,hp:42,'orb-core':43,'molten-projectile':44};
export const SOLIDS={cannon:'cannon',rail:'rail',rocket:'rocket',scatter:'scatter',sidegun:'sidegun',grenade:'grenade',mine:'mine',lightmine:'lightmine',pyro:'pyro',ember:'ember',orb:'orb',shield:'shield',drone:'drone',assembly:'drone',blades:'blade',reflected:'reflected',tail:'tail'};
EFFECTS['lightmine-ray']=45;
const READABILITY_EFFECTS=new Set(['beam','cut-ray','frost-ray','lightmine-ray','toxin','fire','smoke','storm-cloud','orb-core','contact-ripple'].map(key=>EFFECTS[key]));

class EnergySurfaces{
 constructor(root,soft=false,capacity=4096){
   this.capacity=capacity;this.count=0;this.color=new T.Color();this.hot=new T.Color();
   this.overlapGrid=new Float32Array(12*24);this.overlapHistory=new Float32Array(12*24);this.overlapBounds=new Int16Array(capacity*4);
   const quad=new T.PlaneGeometry(1,1),g=this.geometry=new T.InstancedBufferGeometry();g.index=quad.index;g.attributes.position=quad.attributes.position;g.attributes.uv=quad.attributes.uv;
   for(const [key,size] of [['placement',4],['dimensions',2],['tint',4],['highlight',3],['meta',4],['flags',4]])g.setAttribute(key,new T.InstancedBufferAttribute(new Float32Array(capacity*size),size).setUsage(T.DynamicDrawUsage));
   this.material=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:false,side:T.DoubleSide,blending:soft?T.NormalBlending:T.AdditiveBlending,uniforms:{clock:{value:0}},
     vertexShader:`attribute vec4 placement;attribute vec2 dimensions;attribute vec4 tint;attribute vec3 highlight;attribute vec4 meta;attribute vec4 flags;
       varying vec2 vUv;varying vec4 vColor;varying vec3 vHot;varying vec4 vMeta;varying vec4 vFlags;varying vec2 vSize;
       void main(){vUv=uv;vColor=tint;vHot=highlight;vMeta=meta;vFlags=flags;vSize=dimensions;
       vec2 p=position.xy*dimensions;float c=cos(placement.z),s=sin(placement.z);vec2 xy=mat2(c,s,-s,c)*p+placement.xy;
       gl_Position=projectionMatrix*modelViewMatrix*vec4(xy,placement.w,1.);}`,fragmentShader});
   this.mesh=new T.Mesh(g,this.material);this.mesh.name=soft?'Common GPU mist and liquid':'Common GPU energy';this.mesh.frustumCulled=false;this.mesh.userData.bloom=!soft;root.add(this.mesh);
 }
 begin(time){
   const reset=this.overlapTime===undefined||time<this.overlapTime;
   if(reset)this.overlapHistory.fill(0);
   this.overlapBlend=reset?1:1-Math.exp(-12*Math.max(0,time-this.overlapTime));
   this.overlapTime=time;this.count=0;this.material.uniforms.clock.value=time;
 }
 add(type,v,width,height=width,angle=v.angle||0,extra=0,flag=0){
   if(this.count>=this.capacity)return;const i=this.count++,a=this.geometry.attributes;
   a.placement.setXYZW(i,v.x,v.y,angle,6);a.dimensions.setXY(i,Math.max(.01,width),Math.max(.01,height));
   this.color.set(v.color);this.hot.set(v.highlight??v.color);a.tint.setXYZW(i,this.color.r,this.color.g,this.color.b,v.alpha??1);a.highlight.setXYZ(i,this.hot.r,this.hot.g,this.hot.b);
   a.meta.setXYZW(i,EFFECTS[type],v.rank||0,v.progress||0,extra);
   a.flags.setXYZW(i,flag,type==='toxin'||type==='poison-collapse'?toxinShapeSeed(v):0,0,0);
 }
 attenuateOverlap(){
   // Coarse world-space coverage, not all-pairs comparison. Reuse fixed arrays;
   // never alter a weapon's radius or the simulation's visual snapshot.
   const a=this.geometry.attributes,grid=this.overlapGrid,bounds=this.overlapBounds;
   grid.fill(0);
   for(let i=0;i<this.count;i++){
     const base=i*4;bounds[base]=-1;
     if(!READABILITY_EFFECTS.has(a.meta.getX(i)))continue;
     const angle=a.placement.getZ(i),c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
     const w=a.dimensions.getX(i),h=a.dimensions.getY(i),rx=(w*c+h*s)/2,ry=(w*s+h*c)/2;
     const x=a.placement.getX(i),y=a.placement.getY(i);
     const left=Math.max(0,Math.floor((x-rx)/128)+3),right=Math.min(11,Math.floor((x+rx)/128)+3);
     const top=Math.max(0,Math.floor((y-ry)/128)+8),bottom=Math.min(23,Math.floor((y+ry)/128)+8);
     if(left>right||top>bottom)continue;
     bounds[base]=left;bounds[base+1]=right;bounds[base+2]=top;bounds[base+3]=bottom;
     for(let gy=top;gy<=bottom;gy++)for(let gx=left;gx<=right;gx++)grid[gy*12+gx]+=Math.min(1,a.tint.getW(i));
   }
   // Ease changes as effects cross cell boundaries instead of flickering.
   for(let i=0;i<grid.length;i++)this.overlapHistory[i]+=(grid[i]-this.overlapHistory[i])*this.overlapBlend;
   for(let i=0;i<this.count;i++){
     const base=i*4,left=bounds[base];if(left<0)continue;
     let density=1;
     for(let y=bounds[base+2];y<=bounds[base+3];y++)for(let x=left;x<=bounds[base+1];x++)density=Math.max(density,this.overlapHistory[y*12+x]);
     a.tint.setW(i,a.tint.getW(i)*Math.max(.42,1/Math.sqrt(Math.max(1,density*.65))));
   }
 }
 finish(){this.attenuateOverlap();this.geometry.instanceCount=this.count;this.mesh.visible=this.count>0;for(const a of Object.values(this.geometry.attributes)){if(!a.isInstancedBufferAttribute)continue;a.clearUpdateRanges();a.addUpdateRange(0,this.count*a.itemSize);a.needsUpdate=true;}}
 dispose(){this.mesh.removeFromParent();this.geometry.dispose();this.material.dispose();}
}

export class CommonWeaponRenderer{
 constructor(root){this.soft=new EnergySurfaces(root,true,2048);this.models=new CommonWeaponModels(root);this.droneSprites=new DroneSpriteModels(root);this.light=new EnergySurfaces(root);this.impactDecisions=new Map();this.recentImpacts=[];}
 begin(time){
   if(time===0||time<this.time){this.impactDecisions.clear();this.recentImpacts=[];}
   this.time=time;
   for(const [id,entry] of this.impactDecisions)if(time-entry.seenAt>1)this.impactDecisions.delete(id);
   this.recentImpacts=this.recentImpacts.filter(entry=>time-entry.at<.16);
   this.soft.begin(time);this.models.begin(time);this.droneSprites.begin(time);this.light.begin(time);
 }
 admitImpact(v){
   if(!v.id)return true;
   const previous=this.impactDecisions.get(v.id);
   if(previous){previous.seenAt=this.time;return previous.allowed;}
   const priority=v.shape==='blast'?3:hitFeedbackPriority(hitFeedbackProfile(v.mechanic));
   const interval=priority===3?.045:priority===2?.065:priority===1?.08:.14;
   const radius=(priority===3?18:30)*(v.unit||1);
   const nearby=this.recentImpacts.filter(entry=>this.time-entry.at<interval
     &&(entry.x-v.x)**2+(entry.y-v.y)**2<radius*radius);
   const allowed=!nearby.some(entry=>entry.priority>=priority);
   const decision={allowed,seenAt:this.time};this.impactDecisions.set(v.id,decision);
   if(allowed){
     // Keep each decision through the effect's lifetime; rejected old flashes
     // must not reappear later. Heavy impacts can replace a weaker contact.
     for(const entry of nearby)if(entry.priority<priority)entry.decision.allowed=false;
     this.recentImpacts.push({x:v.x,y:v.y,at:this.time,priority,decision});
   }
   return allowed;
 }
 segment(type,v,start,end,width,alpha=1){
   const dx=end.x-start.x,dy=end.y-start.y,p=commonWeaponPresentation(v);
   // Sustained beams retain a solid colored core but no additive white-out.
   const sustained=['beam','cut-ray','frost-ray'].includes(type),batch=sustained?this.soft:this.light;
   batch.add(type,{...v,x:(start.x+end.x)/2,y:(start.y+end.y)/2,alpha:(v.alpha??1)*alpha*(sustained?.85:1)},width*p.beam*(1+(v.rank||0)*.04),Math.hypot(dx,dy),Math.atan2(-dx,dy),v.stacks||0);
 }
 add(v){
   let k=v.shape;const r=v.radius||8,u=v.unit||1,rank=v.rank||0,presentation=commonWeaponPresentation(v),grade=1+rank*.035;
   // The actual offspring is already in this same snapshot. Its sprite handles
   // deployment; the old assembly glyph would draw a second overlapping hull.
   if(k==='assembly')return;
   if((k==='hit'||k==='blast')&&!this.admitImpact(v))return;
   if(!k&&v.points?.length>1&&v.mechanic==='laser'){
     const start=v.points[0],end=v.points.at(-1),dx=end.x-start.x,dy=end.y-start.y;
     // Flag 1 gives this pulse a core at the collision width and a faint halo.
     // Rank and presentation scale no longer multiply its damaging-looking width.
     this.soft.add('beam',{...v,x:(start.x+end.x)/2,y:(start.y+end.y)/2},
       Math.max(.01,v.collisionWidth??v.width)*2,Math.hypot(dx,dy),Math.atan2(-dx,dy),0,1);return;
   }
   if(!k&&v.points?.length>1&&v.mechanic==='lightmine'){
     const start=v.points[0],end=v.points.at(-1),dx=end.x-start.x,dy=end.y-start.y;
     // Solid neutral-white core, not a low-opacity grey line. Keep normal
     // blending so crossing rays cannot bloom into a screen-covering flash.
     this.soft.add('lightmine-ray',{...v,color:0xe8e8e8,highlight:0xffffff,alpha:Math.min(1,(v.alpha??1)*1.22),x:(start.x+end.x)/2,y:(start.y+end.y)/2},Math.max(6,v.width*2),Math.hypot(dx,dy),Math.atan2(-dx,dy));return;
   }
   if(!k&&v.points?.length>1){this.segment(v.lightning?'lightning':'beam',v,v.points[0],v.points.at(-1),Math.max(3,v.width*3));return;}
   // Energy and molten projectiles are not manufactured weapon-body models.
   if(k==='pyro'||k==='ember'){
     const size=r*2,a=v.angle||0;
     this.models.add(k,v,r/(k==='ember'?4.5*.87:22*.87),a);
     const trail=v.trail||[];
     for(let i=0;i<Math.min(trail.length,18);i+=3){
       const fade=1-i/Math.max(1,trail.length);
       this.soft.add('molten-projectile',{...v,...trail[i],alpha:(v.alpha??1)*fade*.38},size*(.1+fade*.16),size*(.12+fade*.2),a);
     }
     // Short hot wake, not a translucent bubble enveloping the projectile.
     const tail={...v,x:v.x-Math.sin(a)*r*.65,y:v.y+Math.cos(a)*r*.65};
     this.light.add('exhaust',{...tail,color:0xe84b08,highlight:0xffb538,alpha:(v.alpha??1)*.35},r*.9,r*2.5,a);
     return;
   }
   if(k==='grenade'){
     const hop=grenadeHop(v.age||0),groundY=v.y+Math.abs(Math.sin((v.age||0)*Math.PI/.45))*22*u;
     this.soft.add('landing',{...v,y:groundY,color:0x111923,alpha:.32-hop*.12},r*(2.4-hop*.6),r*1.8);
     this.models.add('grenade',{...v,y:groundY-hop*22*u},r/9*1.4,v.angle||0);return;
   }
   if(k==='landing'&&v.mechanic==='grenade')return;
   if(k==='lightmine'){
     // Flight uses a smaller closed node; the live field exposes its four arms.
     const deployment=v.kind==='projectile'?.7:.7+.3*Math.min(1,(v.age||0)/.16);
     this.models.add('lightmine',v,u*1.45*deployment,v.rotation||0);return;
   }
   if(k==='bounce'&&['grenade','pyro'].includes(v.mechanic)){
     const molten=v.mechanic==='pyro';
     this.soft.add('bounce',{...v,color:molten?0xa54b23:0xb3a28b,highlight:molten?0xff8425:0xe1bf82,alpha:.55},r*1.8,r*(molten?1.4:.9),0,0,4);
     return;
   }
   if(SOLIDS[k]){
     let id=SOLIDS[k],scale=u;
     if(k==='mine'){id=v.core?'mine_core':'mine';scale*=v.mini?.5:v.queued?.82:1;this.light.add('scan',v,(v.triggerRadius||r)*2,(v.triggerRadius||r)*2,0,v.alert||v.queued?1:0,v.core?1:0);}
     else if(k==='orb'||k==='pyro'||k==='shield')scale=r/({orb:32,pyro:22,shield:27}[k]);
     else if(k==='grenade')scale=r/9;
     else if(k==='drone'||k==='assembly'){id=v.mother?'mother':'drone';scale=r/14;}
     else if(k==='rocket')scale=Math.max(.5,r/(v.main?5:7));
     else if(k==='ember')scale=Math.max(.5,r/4.5);
     if(v.secondary)scale*=.7;
     scale*=presentation.model*grade;
     if(k==='cannon')scale=commonCannonShape(v).modelScale;
     if(v.mini)v={...v,alpha:(v.alpha??1)*.65};
     if(['sidegun','tail'].includes(k)&&v.life)v={...v,alpha:(v.alpha??1)*Math.min(1,(v.life-v.age)*6)};
     if(k==='rocket'&&v.main===false)v={...v,alpha:(v.alpha??1)*.7};
     const modelAngle=k==='lightmine'?v.rotation||0:k==='pyro'||k==='orb'?this.time*.25:v.angle||0;
     if(k!=='drone'||!this.droneSprites.add(v,scale,modelAngle))this.models.add(id,v,scale,modelAngle);
     if(k==='rail')for(const side of [-1,1]){const a=v.angle||0,p={x:v.x+Math.cos(a)*side*5*u,y:v.y+Math.sin(a)*side*5*u},length=(v.boost?75:40)*u*presentation.trail;this.segment('exhaust',v,p,{x:p.x-Math.sin(a)*length,y:p.y+Math.cos(a)*length},7*u,.85);}
     if(['cannon','tail','sidegun','scatter','reflected','ember'].includes(k)){const a=v.angle||0,length=(k==='sidegun'&&rank>=2?26:15)*u*presentation.trail;this.segment('exhaust',v,v,{x:v.x-Math.sin(a)*length,y:v.y+Math.cos(a)*length},(v.secondary?3:5)*u,.8);}
     if(k==='rocket'){
       const a=v.angle||0,tail=29*scale,p={...v,x:v.x-Math.sin(a)*tail,y:v.y+Math.cos(a)*tail};
       this.light.add('exhaust',p,14*scale,30*scale*presentation.trail,a);
     }
     if(['rocket','grenade','pyro'].includes(k))for(let i=0;i<(v.trail||[]).length;i+=3){this.soft.add('smoke',{...v,...v.trail[i],color:v.shadow,alpha:(v.alpha??1)*.7},(k==='pyro'?24:18)*u*presentation.trail);}
     if(k==='pyro'){
       this.light.add('fire',{...v,alpha:(v.alpha??1)*.85},r*3.8,r*3.8,0,v.bounces||0);
       const count=3+(rank>=3?Math.min(5,v.bounces||0):0);
       for(let i=0;i<count;i++){const t=(this.time*1.8+i*.271)%1,a=i*2.39996;this.light.add('node',{...v,x:v.x+Math.sin(a)*r*(1.4+t*.8),y:v.y+Math.cos(a)*r*(1.4+t*.8),alpha:(1-t)*.8,progress:t},9*u);}
     }
     if(k==='orb'){
       this.light.add('orb-core',v,r*2.5*grade,r*2.5*grade,this.time*.15,v.contacts||0);
       this.light.add('contact-ripple',{...v,progress:.68,alpha:(v.alpha??1)*(v.crowded?.65:.28)},r*3.6,r*3.6,this.time*.2,v.crowded?3:1);
     }
     if(k==='shield')this.light.add('slipstream',{...v,color:v.highlight,alpha:(v.alpha??1)*(v.returning?.7:.35)},r*3,r*4,v.angle);
     if(k==='grenade')this.light.add('node',{...v,progress:.05,alpha:(v.alpha??1)*.75},14*u,14*u,0,rank);
     if(k==='drone'&&rank>=2)this.light.add('hp',{...v,y:v.y+r*2.3},8*u,Math.max(1,Math.min(8,v.hp))*7*u,Math.PI/2,v.hp);
     return;
   }
   if(k==='slash'){
     const p=v.progress||0,side=v.side||1;
     const sweep=side*(-.35+p*.7);
     this.light.add('slash',v,r*2.5,r*2.5,sweep);
     if(v.cross)this.light.add('slash',{...v,alpha:(v.alpha??1)*.85},r*2.5,r*2.5,-sweep+side*1.05);
     return;
   }
   if(k==='orb-fade'){this.models.add('orb',{...v,alpha:(v.alpha??1)*(1-(v.progress||0))},r/32*presentation.model*grade,this.time*.25);return;}
   if(k==='frost'&&v.frozen&&rank>=3)for(let i=0;i<6;i++){const a=i*Math.PI/3;this.models.add('ice',{...v,x:v.x+Math.sin(a)*r*.8,y:v.y-Math.cos(a)*r*.8},u*.7,a);}
   if(k==='shatter'){
     for(let i=0;i<9;i++){const a=i*2.39996,d=r*(.12+(v.progress||0)*.65);this.models.add('ice',{...v,x:v.x+Math.sin(a)*d,y:v.y-Math.cos(a)*d},u*1.2,a+this.time);}
     this.soft.add('smoke',{...v,alpha:.6},r*2.1);this.light.add('frost-wave',v,r*2.2);return;
   }
   if(['frost-ray','cut-ray','rift','guidance','mine-link','lightning'].includes(k)){
     this.segment(k,v,v,v.end,Math.max(k==='lightning'?25*u:k==='frost-ray'?r*2:r*1.4,3*u),v.secondary?.55:1);
     if(k==='cut-ray'){
       for(let i=0;i<(v.stacks||0);i++)this.segment('beam',{...v,color:v.highlight},{x:v.end.x-5*u,y:v.end.y+(i-2)*3*u},{x:v.end.x+5*u,y:v.end.y+(i-2)*3*u-2*u},1.8*u,.7);
     }
     if(k==='frost-ray'){
       this.soft.add('smoke',{...v,...v.end,alpha:.55},45*u);
       this.light.add('frost',{...v,...v.end,progress:.5,alpha:.6},36*u,36*u,0,.5);
     }return;
   }
   if(EFFECTS[k]===undefined)throw new Error('Unmapped common weapon visual: '+k);
   const batch=['toxin','poison-collapse','fire','storm-cloud','landing'].includes(k)?this.soft:this.light;
   let extra=0,flag=0;
   if(k==='frost')extra=v.frozen?1:v.progress||0;
   if(k==='gravity'){
     extra=v.secondary?1:0;
     if(!v.secondary)this.models.add('gravity_lens',{...v,y:v.y-r*.24,alpha:(v.alpha??1)*.85},r*.26/32*presentation.model);
   }
   if(k==='toxin'){extra=v.layers||1;flag=v.cloud?1:0;}
   if(k==='duration-ticks')extra=(v.remaining||0)*4;
   if(k==='heat'){extra=v.held||1;flag=v.overload?1:0;}
   if(k==='contact-ripple')extra=v.layers||1;
   if(k==='muzzle')extra=v.mechanic==='laser'?1:v.mechanic==='scatter'?2:0;
   if(k==='blast')flag=v.mechanic==='pyro'?1:v.mechanic==='scatter'?2:v.mechanic==='mine'?3:0;
   const size=r*2*(k==='toxin'?1:commonEffectScale(k,presentation));
   batch.add(k,v,size,size,v.angle||0,extra,flag);
   // A restrained emissive pass makes liquid/fire edges survive the sea texture.
   if(k==='poison-collapse'||k==='fire')this.light.add(k,{...v,alpha:(v.alpha??1)*(k==='fire'?.32:.12)},size,size,v.angle||0,extra,flag);
 }
 finish(){this.soft.finish();this.models.finish();this.droneSprites.finish();this.light.finish();}
 snapshot(){return {commonModels:this.models.count+this.droneSprites.count,commonSurfaces:this.soft.count+this.light.count,commonAssets:{...commonModelAssets},commonDrones:this.droneSprites.snapshot(),commonLimits:{modelsPerKind:this.models.capacity,drones:this.droneSprites.capacity,soft:this.soft.capacity,energy:this.light.capacity},commonBatches:[...this.models.batches.values()].flat().filter(m=>m.count>0).length+this.droneSprites.meshes.filter(m=>m.visible).length};}
 dispose(){this.impactDecisions.clear();this.recentImpacts=[];this.soft.dispose();this.models.dispose();this.droneSprites.dispose();this.light.dispose();}
}
