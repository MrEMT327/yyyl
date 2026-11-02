import {BeamFootprints} from './beam-footprint.mjs';
import {VfxMeshBuffer,quadVisible,packedScalar} from './vfx-buffers.mjs';
// Transient feedback reads snapshots only. Eight bounded batches replace many
// tiny emitters; particle positions and lifetime never feed back into combat.
const ROOT='host://combat-feedback-v1/';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const CONTACT=new Set([110001,110008,110011,120001,210001,210012,210013,210014,210047,210050,210059,210060,210062,110030,110039,120006,210048,220029,210049,210065,210051,210035,220022]);
const COLLECT=new Set([140003,140014,140024,140025,140026,140027,140028,140029,170007]);
const COLD=new Set([210035,210051,220022]),ACID=new Set([210043,210049,210065,210039]),ELECTRIC=new Set([110030,110039,120006,210047,210048,210062,220029]);
export function feedbackKind(f){
 if(f.kind==='text')return null;
 if(COLLECT.has(f.modelId))return'collect';
 if(f.kind==='heal'||f.kind==='level')return'restore';
 if(f.kind==='explosion')return'blast';
 if(f.kind==='hit'&&(!f.modelId||CONTACT.has(f.modelId)))return'contact';
 if(f.kind==='muzzle'&&f.modelId===100001&&Number.isFinite(f.duration))return'muzzle';
 return null;
}
export const isOrdinaryContact=f=>feedbackKind(f)==='contact'&&!COLD.has(f.modelId)&&!ACID.has(f.modelId)&&!ELECTRIC.has(f.modelId);
function palette(f){
 if(ACID.has(f.modelId))return[.32,.86,.14];
 if(COLD.has(f.modelId))return[.20,.72,1];
 if(f.modelId===220029)return[1,.72,.18];
 if(ELECTRIC.has(f.modelId))return[.10,.62,1];
 if(f.kind==='heal')return[.16,.94,.40];
 if(f.kind==='level')return[.12,.72,1];
 if(COLLECT.has(f.modelId))return[.50,.83,1];
 return[1,.49,.11];
}
const cloud=`float fbHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float fbNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(fbHash(i),fbHash(i+vec2(1.0,0.0)),f.x),mix(fbHash(i+vec2(0.0,1.0)),fbHash(i+vec2(1.0)),f.x),f.y);}`;
const phase='float t=clamp((COLOR.a-0.1)/0.8,0.0,1.0);vec2 p=UV*2.0-1.0;float r=length(p);';
const shaders={
 'beam-footprint':'shader_type canvas_item;render_mode unshaded,blend_mix;void fragment(){}',
 'beam-flow':`shader_type canvas_item;render_mode unshaded,blend_add;
void fragment(){
 float x=UV.x*2.0-1.0;
 // Distance UVs are advanced by host age, never by wall-clock shader TIME.
 float travel=UV.y,packet=exp(-pow((fract(travel)-.48)/.105,2.0));
 float weave=.24*sin(travel*11.3)+.04*sin(travel*27.0);
 float thread=exp(-pow((x-weave)*18.0,2.0));
 float core=exp(-x*x*150.0),halo=exp(-x*x*22.0);
 float edge=exp(-pow((x+.35+sin(travel*16.0)*.035)*30.0,2.0));
 float a=core*.015+packet*(thread*.68+halo*.11)+edge*packet*.18;
 COLOR=vec4(mix(COLOR.rgb*1.45,vec3(1.85),packet*.24),min(a*COLOR.a,.72));
}`,
 'blast-body':`shader_type canvas_item;render_mode unshaded,blend_mix;
${cloud}
void fragment(){${phase}
 float n=fbNoise(p*4.0+vec2(t*3.0,-t*2.0))*0.65+fbNoise(p*8.5-vec2(t*2.0))*0.35;
 float radius=0.20+0.64*sin(min(1.0,t*1.6)*1.5707963);
 float body=1.0-smoothstep(radius-0.20,radius+0.08,r+(n-0.5)*0.20);
 float fire=(1.0-smoothstep(0.16,0.68,t));
 float smoke=smoothstep(0.08,0.30,t)*(1.0-smoothstep(0.52,1.0,t));
 float hot=exp(-r*r*10.0/(0.3+t))*fire;
 float folds=0.28+0.72*n;
 vec3 flame=mix(COLOR.rgb*0.30,COLOR.rgb*1.35+vec3(0.35),folds);
 flame=mix(flame,vec3(1.5,1.24,0.74),hot*0.70);
 vec3 soot=mix(vec3(0.035,0.055,0.065),vec3(0.26,0.30,0.31),n*0.55+(0.4-p.y)*0.18);
 vec3 color=mix(soot,flame,fire);
 float alpha=body*(fire*0.78+smoke*0.44)*(1.0-smoothstep(0.80,1.0,t));
 COLOR=vec4(color,alpha);
}`,
 'blast-light':`shader_type canvas_item;render_mode unshaded,blend_add;
void fragment(){${phase}
 float core=exp(-r*r*28.0/(0.13+t))*exp(-t*12.0);
 float wave=exp(-abs(r-(0.12+t*1.12))*70.0)*exp(-t*7.0);
 float a=atan(p.y,p.x),spark=pow(max(0.0,cos(a*9.0+r*8.0)),34.0);
 spark*=smoothstep(t*0.8,t*0.8+0.10,r)*(1.0-smoothstep(t*0.8+0.22,t*0.8+0.30,r))*exp(-t*7.0);
 COLOR=vec4(mix(COLOR.rgb*3.2,vec3(4.0,3.4,2.2),core),clamp(core*0.75+wave*0.35+spark*0.65,0.0,1.0));
}`,
 contact:`shader_type canvas_item;render_mode unshaded,blend_add;
uniform float feedback_family=0.0;
void fragment(){
 float t=clamp((COLOR.a-.1)/.8,0.0,1.0);
 float contact_seed=floor(UV.x+.00001);
 vec2 p=vec2(UV.x-contact_seed,UV.y)*2.0-1.0;float r=length(p);
 float a=atan(p.y,p.x),core=exp(-r*r*65.0)*exp(-t*10.0);
 float inner=.06+t*.62,outer=inner+.20;
 float rays=pow(max(0.0,cos(a*7.0+t)),20.0);
 float detail=rays*smoothstep(inner,inner+.04,r)*(1.0-smoothstep(outer,outer+.10,r))*pow(1.0-t,1.6);
 if(feedback_family>.5)core=exp(-r*r*125.0)*exp(-t*17.0);
 if(feedback_family>2.5){
  detail=0.0;
  for(int i=0;i<3;i++){
   float k=float(i),turn=contact_seed*.61+k*2.0944+.24*sin(contact_seed+k*3.1);
   vec2 axis=vec2(cos(turn),sin(turn));
   float along=dot(p,axis),side=dot(p,vec2(-axis.y,axis.x));
   float epoch=floor(t*5.0+k*.37);
   float kink=(abs(fract(along*(5.5+k*.7)+contact_seed*.11+epoch*.19)-.5)*4.0-1.0)*(.035+k*.009);
   float line=1.0-smoothstep(.008,.027,abs(side-kink));
   float gap=smoothstep(.04,.13,fract(along*8.0+contact_seed*.13+epoch*.23));
   float reach=.27+.42*(1.0-exp(-t*4.0));
   float spark=.55+.45*pow(.5+.5*sin(t*21.0+k*2.3+contact_seed),2.0);
   detail+=line*gap*smoothstep(.025,.07,along)*(1.0-smoothstep(reach-.08,reach+.04,along))*spark*pow(max(0.0,1.0-t*(1.05+k*.09)),1.6);
  }
 }else if(feedback_family>1.5){
  detail=0.0;
  for(int i=0;i<4;i++){
   float k=float(i),turn=contact_seed*.73+k*1.5708+.29*sin(contact_seed+k*2.7);
   vec2 axis=vec2(cos(turn),sin(turn)),crossAxis=vec2(-axis.y,axis.x);
   float travel=.07+t*(.46+k*.055)*(1.0-.32*t);
   vec2 q=p-axis*travel-crossAxis*(.13*t*t*sin(contact_seed+k));
   float along=dot(q,axis),side=dot(q,crossAxis),ellipse=length(vec2(along*8.0,side*13.0));
   float body=1.0-smoothstep(.58,.94,ellipse),wet=exp(-abs(ellipse-.68)*15.0);
   float shine=exp(-pow((along-.028)*28.0,2.0)-pow((side+.018)*48.0,2.0));
   float tail=exp(-side*side*1200.0)*smoothstep(-.24,-.13,along)*(1.0-smoothstep(-.07,0.0,along));
   detail+=(body*.28+wet*.40+shine*.42+tail*.10)*pow(max(0.0,1.0-t*(1.0+k*.07)),1.7);
  }
 }else if(feedback_family>.5){
  detail=0.0;
  for(int i=0;i<4;i++){
   float k=float(i),turn=contact_seed*.57+k*2.39996+.19*sin(contact_seed+k);
   vec2 axis=vec2(cos(turn),sin(turn));
   vec2 q=p-axis*(.06+t*(.42+k*.055)*(1.0-.18*t));
   float spin=contact_seed*.39+k*.8+t*(2.4-k*1.35),c=cos(spin),s=sin(spin);
   vec2 local=vec2(c*q.x+s*q.y,-s*q.x+c*q.y);
   float diamond=abs(local.x)*1.25+abs(local.y)*2.25,size=.075+.013*k;
   float body=1.0-smoothstep(size*.65,size,diamond),edge=exp(-abs(diamond-size*.78)*100.0);
   float glint=pow(max(0.0,cos(spin*3.0+k)),8.0);
   float along=dot(q,axis),side=dot(q,vec2(-axis.y,axis.x));
   float trail=exp(-side*side*1600.0)*smoothstep(-.23,-.12,along)*(1.0-smoothstep(-.045,0.0,along));
   detail+=(body*(.27+.62*glint)+edge*.22+trail*.08)*pow(max(0.0,1.0-t*(1.0+k*.055)),1.4);
  }
 }
 float rim=exp(-abs(r-(.08+t*.52))*65.0)*exp(-t*10.0);
 float halo=feedback_family>.5?exp(-r*r*26.0)*exp(-t*15.0)*.035:0.0;
 vec3 hot=mix(COLOR.rgb,vec3(1.0),.26)*3.4;
 COLOR=vec4(mix(COLOR.rgb*2.6,hot,core),clamp(core*.90+detail*.85+rim*.16+halo,0.0,1.0));
}`,
 muzzle:`shader_type canvas_item;render_mode unshaded,blend_add;
void fragment(){${phase}
 float hot=exp(-(p.x*p.x*35.0+p.y*p.y*9.0));
 float petal=exp(-abs(p.x)*17.0)*exp(-abs(p.y)*3.6);
 float wings=exp(-abs(p.y)*28.0)*exp(-abs(p.x)*4.0);
 float fade=pow(1.0-t,2.5);
 COLOR=vec4(mix(COLOR.rgb*2.7,vec3(4.0,3.4,2.4),hot),(hot*.85+petal*.28+wings*.18)*fade);
}`,
 restore:`shader_type canvas_item;render_mode unshaded,blend_add;
void fragment(){${phase}
 float ring=exp(-abs(r-(0.35+t*0.52))*55.0)*pow(1.0-t,1.6);
 vec2 q=vec2(p.x*5.0,p.y*3.0+t*2.0);vec2 cell=floor(q),local=fract(q)-0.5;
 float crystal=1.0-smoothstep(0.05,0.13,abs(local.x)+abs(local.y)*.65);
 float gate=step(0.68,fract(sin(dot(cell,vec2(12.9,78.2)))*43758.5));
 float particles=crystal*gate*(1.0-smoothstep(.15,.95,r))*sin(t*3.14159265);
 COLOR=vec4(COLOR.rgb*2.8+vec3(.2),ring*.26+particles*.65);
}`,
 collect:`shader_type canvas_item;render_mode unshaded,blend_add;
void fragment(){${phase}
 float a=atan(p.y,p.x),rays=pow(max(0.0,cos(a*4.0+t*1.8)),20.0);
 float radius=.18+.52*(1.0-t);
 float sheen=exp(-abs(r-radius)*36.0)*pow(1.0-t,1.4);
 float core=exp(-r*r*22.0)*sin(t*3.14159265);
 COLOR=vec4(COLOR.rgb*2.4+vec3(.15),sheen*.23+rays*exp(-r*4.0)*pow(1.0-t,2.0)*.30+core*.08);
}`,
 pickup:`shader_type canvas_item;render_mode unshaded,blend_add;
void fragment(){${phase}
 float glow=exp(-dot(p,p)*5.0)*.06;
 float stem=exp(-p.x*p.x*180.0)*exp(-p.y*p.y*3.0);
 float glint=pow(max(0.0,sin(t*6.2831853)),12.0)*(exp(-p.x*p.x*75.0-p.y*p.y*12.0)+exp(-p.y*p.y*75.0-p.x*p.x*12.0));
 COLOR=vec4(COLOR.rgb*2.3,glow+stem*.045+glint*.30);
}`,
};
const statusShaders={
 frost:`${cloud}
 vec2 p=UV*2.0-1.0;float r=length(p),a=atan(p.y,p.x);
 float n=fbNoise(p*5.0+vec2(status_seed));
 float fragments=pow(max(0.0,cos(a*7.0+r*5.0)),6.0)*smoothstep(.38,.62,r)*(1.0-smoothstep(.77,.96,r));
 float edges=exp(-abs(r-(.72+.04*sin(a*8.0)))*50.0)*(0.25+0.75*n);
 float frost=(1.0-smoothstep(.45,.9,r))*n*.07;
 COLOR=vec4(mix(vec3(.20,.49,.68),vec3(1.2,1.75,2.0),fragments),COLOR.a*(fragments*.35+edges*.30+frost));`,
 burn:`${cloud}
 vec2 p=UV*2.0-1.0;float y=p.y,t=status_age;
 float fire=0.0;
 for(int i=0;i<4;i++){float seed=float(i);float center=-.63+seed*.42+.065*sin(y*7.0-t*5.0+seed);
 float width=.08+.05*(.5+.5*sin(t*4.0+seed*2.0));float x=(p.x-center)/width;
 float height=.10+.20*sin(t*3.7+seed*2.3);
 fire+=exp(-x*x)*smoothstep(-.85,-.48,y)*(1.0-smoothstep(-.15,height,y));}
 float n=fbNoise(p*4.0+vec2(t*.1,-t*1.1));
 float smoke=(1.0-smoothstep(.25,.9,length(p+vec2(0.0,.15))))*n*.06;
 float core=clamp(fire*(.6+.4*n),0.0,1.0);
 COLOR=vec4(mix(vec3(.42,.07,.02),vec3(2.5,1.2,.18),core),COLOR.a*(core*.58+smoke));`,
 disrupt:`
 vec2 p=UV*2.0-1.0;float r=length(p),a=atan(p.y,p.x);
 float orbit=pow(max(0.0,cos(a*4.0-status_age*2.6)),20.0)*exp(-abs(r-.73)*40.0);
 float mote=exp(-dot(p,p)*4.0)*.025;
 COLOR=vec4(vec3(.85,.42,1.3),COLOR.a*(orbit*.65+mote));`,
};
export function withCombatFeedbackResources(graph){
 const resources={...graph.resources},programs={...graph.shaders};
 for(const [name,code]of Object.entries(shaders)){resources[ROOT+name]={type:'ShaderMaterial',properties:{shader:{$external:ROOT+name+'-shader'}}};programs[ROOT+name+'-shader']={code};}
 for(const [name,body]of Object.entries(statusShaders)){
  const functions=name==='frost'||name==='burn'?cloud:'';
  const fragment=functions?body.replace(cloud,''):body;
  const code=`shader_type canvas_item;render_mode unshaded,blend_mix;uniform float status_age=0.0;uniform float status_seed=0.0;${functions}void fragment(){${fragment}}`;
  resources[ROOT+name]={type:'ShaderMaterial',properties:{shader:{$external:ROOT+name+'-shader'}}};programs[ROOT+name+'-shader']={code};
 }
 for(const [name,body]of Object.entries(statusShaders)){
  const functions=name==='frost'||name==='burn'?cloud:'';const fragment=functions?body.replace(cloud,''):body;
  const decode='vec3 fbBytes=floor(COLOR.rgb*255.0+0.5);float fbValue=dot(fbBytes,vec3(65536.0,256.0,1.0))/16777215.0;';
  const code=`shader_type canvas_item;render_mode unshaded,blend_mix;uniform float status_age_base=0.0;${functions}void fragment(){${decode}float status_age=fbValue*64.0+status_age_base;float status_seed=fbValue*10.0;${fragment}}`;
  resources[ROOT+name+'-batched']={type:'ShaderMaterial',properties:{shader:{$external:ROOT+name+'-batched-shader'}}};programs[ROOT+name+'-batched-shader']={code};
 }
 return {...graph,resources,shaders:programs};
}
function batch(name){return{key:name,z:name.endsWith('body')?0:2,material:{$ref:ROOT+name},vertices:[],indices:[]};}
function append(mesh,points,color,t){const start=mesh.vertices.length;points.forEach((p,i)=>mesh.vertices.push({position:[p.x,p.y],uv:[[0,0],[1,0],[1,1],[0,1]][i],color:[...color,.1+.8*clamp(t)]}));mesh.indices.push(start,start+1,start+2,start,start+2,start+3);}
export class CombatFeedback{
 constructor(){this.beams=new BeamFootprints(ROOT+'beam-footprint',ROOT+'beam-flow');this.batches=new Map();this.pool=new Map();this.points=Array.from({length:4},()=>({x:0,y:0}));this.packed=[0,0,0];this.frame=0;this.statusGroups=[];this.statusLatest=new Map();this.beginFrame();}
 beginFrame(viewport){for(const name of this.batches.keys())this.pool.get(name).reset();this.batches.clear();this.beams.beginFrame(viewport);this.contactCount=0;this.count=0;this.pickups=0;this.statuses=0;this.culled=0;this.statusGroups.length=0;this.statusLatest.clear();this.submittedStatuses=0;this.viewport=viewport;this.frame++;
  // Old age buckets must not accumulate through long or repeated battles.
  for(const [key,buffer]of this.pool)if(this.frame-buffer.lastUsed>120)this.pool.delete(key);
 }
 buffer(name,material=name,base){let buffer=this.pool.get(name);if(!buffer){buffer=new VfxMeshBuffer(name,ROOT+material,name.endsWith('body')?0:2);this.pool.set(name,buffer);}
  buffer.lastUsed=this.frame;this.batches.set(name,buffer.mesh);if(base!==undefined){buffer.mesh.materialUniformOverrides??={status_age_base:base};buffer.mesh.materialUniformOverrides.status_age_base=base;}return buffer;
 }
 corners(x,z,rx,rz,yaw,screen){const c=Math.cos(yaw),s=Math.sin(yaw);for(let i=0;i<4;i++){const a=i===1||i===2?rx:-rx,f=i<2?rz:-rz,p=screen(x+c*a+s*f,z-s*a+c*f);this.points[i].x=p.x;this.points[i].y=p.y;}return this.points;}
 visible(){if(quadVisible(this.points,this.viewport))return true;this.culled++;return false;}
 queue(name,points,color,t,family=0,seed=0){
  const contact=name==='contact',buffer=this.buffer(contact&&family?name+'-'+family:name,contact?'contact':name);
  if(contact){buffer.mesh.materialUniformOverrides??={feedback_family:0};buffer.mesh.materialUniformOverrides.feedback_family=family;}
  const first=buffer.mesh.vertices.length;buffer.quad(points,color[0],color[1],color[2],.1+.8*clamp(t));
  // Integer UV offset carries a deterministic per-hit variant without material
  // instances or extra draw calls. Fractional UVs remain local to this quad.
  if(contact&&family)for(let i=first;i<first+4;i++)buffer.mesh.vertices[i].uv[0]+=seed;
 }
 beam(projectile,screen){this.beams.projectile(projectile,screen);}
 effect(f,screen,visualScale=1){
  const kind=feedbackKind(f);if(!kind)return false;
  if(!Number.isFinite(f.x)||!Number.isFinite(f.z)||!Number.isFinite(f.age)||!Number.isFinite(f.size)||!Number.isFinite(visualScale)||!(f.duration>0)||f.age<0||f.age>=f.duration)return true;
  const lifetime=Math.min(f.duration,kind==='muzzle'?.12:kind==='contact'?.26:kind==='blast'?1.05:.7);if(f.age>=lifetime||this.count>=120||(kind==='contact'&&this.contactCount>=96))return true;
  const radius=clamp(f.size*(kind==='muzzle'?.65:.5)*visualScale,.12,6),extent=kind==='blast'?1.55:kind==='contact'?1.55:1;
  this.corners(f.x,f.z,radius*(kind==='muzzle'?.7:1)*extent,radius*(kind==='muzzle'?1.4:1)*extent,f.angle??0,screen);if(!this.visible())return true;this.count++;if(kind==='contact')this.contactCount++;
  const color=palette(f),t=f.age/lifetime;if(kind==='blast'){this.queue('blast-body',this.points,color,t);this.queue('blast-light',this.points,color,t);}else this.queue(kind,this.points,color,t,COLD.has(f.modelId)?1:ACID.has(f.modelId)?2:ELECTRIC.has(f.modelId)?3:0,(Math.imul((f.uid??0)|0,1664525)>>>0)%32);return true;
 }
 pickup(p,screen){
  if(this.pickups>=64||p.age<p.delay||!Number.isFinite(p.x)||!Number.isFinite(p.z)||!Number.isFinite(p.age))return;
  const r=p.kind==='exp'?.28:p.kind==='gold'?.45:.58;this.corners(p.x,p.z,r,r,0,screen);if(!this.visible())return;this.pickups++;
  const color=p.kind==='gold'?[1,.67,.12]:p.kind==='heart'?[.18,1,.43]:[.10,.64,1];this.queue('pickup',this.points,color,(Math.max(0,p.age-p.delay)*.7+p.uid*.173)%1);
 }
 status(b,screen){
  if(!isRefinedBasicStatus(b))return false;
  if(b.dead||b.visualHidden||!Number.isFinite(b.x)||!Number.isFinite(b.z)||!Number.isFinite(b.age)||b.age<0)return true;
  const remaining=b.remaining??(b.duration-b.age);if(!(remaining>0)||(b.duration!==undefined&&b.age>=b.duration))return true;
  const kind=b.modelId===170004?'burn':b.modelId===170000?'disrupt':'frost';
  if(kind==='burn'&&(!Number.isFinite(b.damage)||b.damage<0))throw new Error('Burn particle density requires a finite non-negative damage snapshot');
  const rx=clamp((b.visualRadiusX||1)*1.08+.16,.65,5),rz=clamp((b.visualRadiusZ||1)*1.08+.16,.65,5)*(kind==='burn'?1.35:1);
  this.corners(b.x,b.z,rx,rz,0,screen);if(!this.visible())return true;
  const density=kind==='burn'?clamp(b.damage/200,.3,1):1,alpha=clamp(.1+b.age/.18)*clamp(remaining/.25)*density;
  const base=kind==='frost'?0:Math.floor(b.age/64)*64,value=kind==='frost'?((b.targetUid||0)*.618)%10:b.age-base,range=kind==='frost'?10:64;
  const key=kind+':'+base,left=Math.min(this.points[0].x,this.points[1].x,this.points[2].x,this.points[3].x),right=Math.max(this.points[0].x,this.points[1].x,this.points[2].x,this.points[3].x),top=Math.min(this.points[0].y,this.points[1].y,this.points[2].y,this.points[3].y),bottom=Math.max(this.points[0].y,this.points[1].y,this.points[2].y,this.points[3].y);
  let buffer=this.statusLatest.get(key),conflict=false;
  // Transparent bodies may join an earlier material only if doing so cannot
  // move them across an intersecting, differently shaded body.
  if(buffer)for(let i=buffer.statusOrder+1;i<this.statusGroups.length&&!conflict;i++){const group=this.statusGroups[i];for(let j=0;j<group.rectCount;j++){const r=group.rects[j];if(left<r[2]&&right>r[0]&&top<r[3]&&bottom>r[1]){conflict=true;break;}}}
  if(!buffer||conflict){buffer=this.buffer('status:'+key+':'+this.statusGroups.length,kind+'-batched',base);buffer.statusOrder=this.statusGroups.length;buffer.rects??=[];buffer.rectCount=0;this.statusGroups.push(buffer);this.statusLatest.set(key,buffer);}
  const rect=buffer.rects[buffer.rectCount]??(buffer.rects[buffer.rectCount]=[0,0,0,0]);rect[0]=left;rect[1]=top;rect[2]=right;rect[3]=bottom;buffer.rectCount++;
  packedScalar(value,range,this.packed);buffer.quad(this.points,this.packed[0],this.packed[1],this.packed[2],alpha);this.statuses++;return true;
 }
 flushStatuses(view){while(this.submittedStatuses<this.statusGroups.length){const buffer=this.statusGroups[this.submittedStatuses++];view.drawMeshes('combat-feedback:'+buffer.mesh.key,[buffer.mesh],undefined,{presentationDepth:38});}this.statusLatest.clear();}
 draw(view){this.beams.draw(view);for(const [name,mesh]of this.batches)if(mesh.indices.length&&(!name.startsWith('status:')||this.pool.get(name).statusOrder>=this.submittedStatuses))view.drawMeshes('combat-feedback:'+name,[mesh],undefined,{presentationDepth:name==='pickup'?18.8:name.startsWith('status:')?38:34});}
 reset(){this.beginFrame(this.viewport);this.beams.reset();this.pool.clear();}
}
export const isRefinedBasicStatus=b=>[170001,170004,170012,220022,170000].includes(b.modelId);
export function refinedBasicStatusMeshes(b,screen){
 if(!isRefinedBasicStatus(b)||b.dead||b.visualHidden||![b.x,b.z,b.age].every(Number.isFinite)||b.age<0)return[];
 const remaining=b.remaining??(b.duration-b.age);if(!(remaining>0)||(b.duration!==undefined&&b.age>=b.duration))return[];
 const kind=b.modelId===170004?'burn':b.modelId===170000?'disrupt':'frost';
 const rx=clamp((b.visualRadiusX||1.0)*1.08+.16,.65,5),rz=clamp((b.visualRadiusZ||1.0)*1.08+.16,.65,5)*(kind==='burn'?1.35:1);
 if(kind==='burn'&&(!Number.isFinite(b.damage)||b.damage<0))throw new Error('Burn particle density requires a finite non-negative damage snapshot');
 const density=kind==='burn'?clamp(b.damage/200,.3,1):1;
 const alpha=clamp(.1+b.age/.18)*clamp(remaining/.25)*density,m=batch(kind),points=[screen(b.x-rx,b.z+rz),screen(b.x+rx,b.z+rz),screen(b.x+rx,b.z-rz),screen(b.x-rx,b.z-rz)];
 append(m,points,[1,1,1],0);m.vertices.forEach(v=>v.color[3]=alpha);m.materialUniformOverrides={status_age:b.age,status_seed:((b.targetUid||0)*.618)%10};return[m];
}
