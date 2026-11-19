import {VfxMeshBuffer,quadVisible} from './vfx-buffers.mjs';

const ROOT='host://escort-warm-light-sword-v2/',TEXTURE=ROOT+'hilt';
export const ESCORT_SWORD_LIMIT=24;
export const ESCORT_SWORD_ART=Object.freeze({width:2021,height:778,region:Object.freeze([235,142,1606,507]),url:'assets/escort-light-sword-v2/hilt-v2.png'});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const isStoredEscortSword=b=>Boolean(b&&b.owner==='player'&&b.familyId===200101&&b.modelId>0&&b.held&&b.collisionDisabled&&!b.dead&&!b.visualHidden);

export function withSwordEscortResources(graph){
 return {...graph,textures:{...graph.textures,[TEXTURE]:{width:ESCORT_SWORD_ART.width,height:ESCORT_SWORD_ART.height,url:ESCORT_SWORD_ART.url,file:'hilt-v2.png'}},
  resources:{...graph.resources,[ROOT+'metal']:{type:'CanvasItemMaterial',properties:{blend_mode:0,light_mode:1}},
   [ROOT+'blade']:{type:'ShaderMaterial',properties:{shader:{$external:ROOT+'blade-shader'}}}},
  shaders:{...graph.shaders,[ROOT+'blade-shader']:{code:`shader_type canvas_item;render_mode unshaded,blend_add;
void fragment(){
 vec2 p=UV*2.0-1.0;
 float cap=smoothstep(-1.0,-.87,p.x)*(1.0-smoothstep(.93,1.0,p.x));
 float width=.22+.11*smoothstep(-.85,-.55,p.x);
 float r=abs(p.y)/width;
 float core=exp(-r*r*3.4);
 float sheath=1.0-smoothstep(.72,1.2,r);
 float glow=exp(-p.y*p.y*11.0)*.14;
 vec3 light=mix(vec3(1.30,.91,.40),vec3(2.15,2.04,1.78),core);
 COLOR=vec4(light,COLOR.a*cap*clamp(sheath*.90+glow,0.0,1.0));
}`}}};
}

// These are display poses for real stored swords. No combat object, attack
// timer, collision shape, random stream or projectile serial is written.
export class SwordEscortPresentation{
 constructor(){
  this.records=new Map();this.current=new Map();this.buffers=new Map();this.points=Array.from({length:4},()=>({x:0,y:0}));
  this.clock=-Infinity;this.logicClock=-Infinity;this.run=null;this.anchor=null;this.enabled=false;
 }
 beginFrame(clock,run,projectiles,player,visualClock=clock,viewport){
  const time=Number.isFinite(visualClock)?Math.min(clock,visualClock):clock;
  if(run!==this.run||clock<this.logicClock||time<this.clock)this.reset();
  const dt=Number.isFinite(this.clock)?Math.max(0,time-this.clock):0;
  this.clock=time;this.logicClock=clock;this.run=run;this.viewport=viewport;
  for(const buffer of this.buffers.values())buffer.reset();this.current.clear();
  this.enabled=Array.isArray(projectiles)&&player&&Number.isFinite(player.x+player.z)&&(player.hp===undefined||player.hp>0);
  if(!this.enabled){this.records.clear();this.anchor=null;return;}
  if(!this.anchor||Math.hypot(player.x-this.anchor.x,player.z-this.anchor.z)>5)this.anchor={x:player.x,z:player.z};
  else{const follow=1-Math.exp(-Math.min(dt,.1)*18);this.anchor.x+=(player.x-this.anchor.x)*follow;this.anchor.z+=(player.z-this.anchor.z)*follow;}
  for(const b of projectiles)if(b.owner==='player'&&b.familyId===200101)this.current.set(b.uid,b);
  for(const [uid,record]of this.records){
   const source=this.current.get(uid);
   if(isStoredEscortSword(source)){record.source=source;continue;}
   if(record.departAt===null){
    if(source&&!source.dead&&source.visualHidden&&record.pose){record.departAt=time;record.from={...record.pose};record.source=source;}
    else{this.records.delete(uid);continue;}
   }
   if(time-record.departAt>=.14)this.records.delete(uid);
  }
  const used=new Set();for(const record of this.records.values())used.add(record.slot);
  for(const source of this.current.values()){
   if(!isStoredEscortSword(source)||this.records.has(source.uid)||this.records.size>=ESCORT_SWORD_LIMIT)continue;
   let slot=0;while(used.has(slot))slot++;used.add(slot);
   this.records.set(source.uid,{slot,bornAt:time,source,departAt:null,pose:null});
  }
 }
 handles(b){return this.enabled&&isStoredEscortSword(b);}
 pose(record){
  if(record.departAt!==null){
   const t=clamp((this.clock-record.departAt)/.14,0,1),eased=t*t;
   const source=this.current.get(record.source.uid)||record.source,from=record.from;
   let dx=source.x-from.x,dz=source.z-from.z;const distance=Math.hypot(dx,dz);if(distance>3){dx*=3/distance;dz*=3/distance;}
   return{x:from.x+dx*eased,z:from.z+dz*eased,angle:from.angle+t*.20,scale:from.scale*(1-t*.13),alpha:from.alpha*(1-t)*(1-t),front:true,departing:true};
  }
  const ring=Math.floor(record.slot/10),phase=this.clock*.62+record.slot*2.3999632297+.35;
  const near=(1-Math.sin(phase))*.5,rx=2.35+ring*.42,rz=1.05+ring*.16;
  return{x:this.anchor.x+Math.cos(phase)*rx,z:this.anchor.z+Math.sin(phase)*rz+Math.sin(this.clock*1.7+record.slot)*.055,
   angle:Math.PI/2+Math.sin(phase*.8+record.slot)*.065,scale:.90+near*.10,
   alpha:(.25+.75*clamp((this.clock-record.bornAt)/.13,0,1))*(.86+near*.14),front:Math.sin(phase)<0,departing:false};
 }
 buffer(key,blade){
  let buffer=this.buffers.get(key);if(!buffer){buffer=new VfxMeshBuffer(key,ROOT+(blade?'blade':'metal'),0);if(!blade)buffer.mesh.texture={$external:TEXTURE};this.buffers.set(key,buffer);}return buffer;
 }
 quad(buffer,center,rx,ry,angle,alpha,blade=false){
  const c=Math.cos(angle),s=Math.sin(angle);
  for(let i=0;i<4;i++){const x=i===1||i===2?rx:-rx,y=i>=2?ry:-ry;this.points[i].x=center.x+x*c-y*s;this.points[i].y=center.y+x*s+y*c;}
  if(!quadVisible(this.points,this.viewport))return;
  const start=buffer.mesh.vertices.length,[left,top,width,height]=ESCORT_SWORD_ART.region;
  for(let i=0;i<4;i++){
   const right=i===1||i===2,bottom=i>=2;
   buffer.vertex(this.points[i].x,this.points[i].y,blade?(right?1:0):(left+(right?width:0))/ESCORT_SWORD_ART.width,
    blade?(bottom?1:0):(top+(bottom?height:0))/ESCORT_SWORD_ART.height,1,1,1,alpha);
  }
  buffer.mesh.indices.push(start,start+1,start+2,start,start+2,start+3);
 }
 draw(view,screen){
  if(!this.enabled||!this.anchor)return;
  const origin=screen(this.anchor.x,this.anchor.z),unit=screen(this.anchor.x+1,this.anchor.z),px=Math.hypot(unit.x-origin.x,unit.y-origin.y);
  if(!(px>0&&Number.isFinite(px)))return;
  for(const record of this.records.values()){
   const pose=this.pose(record);if(record.departAt===null)record.pose=pose;
   if(!(pose.alpha>0)||!Number.isFinite(pose.x+pose.z))continue;
   const point=screen(pose.x,pose.z),length=clamp(px*2.05,34,74)*pose.scale,c=Math.cos(pose.angle),s=Math.sin(pose.angle);
   const side=pose.front?'front':'back';
   // Local -X is the blade tip. Upright rotation keeps it toward the enemy.
   // The HDR core feeds the existing bloom; its soft sheath needs no extra pass.
   const blade={x:point.x-c*length*.13,y:point.y-s*length*.13};
   const hilt={x:point.x+c*length*.365,y:point.y+s*length*.365};
   this.quad(this.buffer('blade-'+side,true),blade,length*.38,length*.12,pose.angle,pose.alpha,true);
   this.quad(this.buffer('body-'+side,false),hilt,length*.135,length*.135*ESCORT_SWORD_ART.region[3]/ESCORT_SWORD_ART.region[2],pose.angle,pose.alpha);
  }
  for(const side of ['back','front'])for(const kind of ['blade','body']){
   const mesh=this.buffers.get(kind+'-'+side)?.mesh;if(mesh?.indices.length)view.drawMeshes('escort-sword:'+kind+'-'+side,[mesh],undefined,{presentationDepth:side==='back'?36.5:37.8});
  }
 }
 reset(){this.records.clear();this.current.clear();for(const buffer of this.buffers.values())buffer.reset();this.anchor=null;this.enabled=false;this.clock=-Infinity;this.logicClock=-Infinity;}
}
