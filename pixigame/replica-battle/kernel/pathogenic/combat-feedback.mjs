import {impactDirectionYaw} from '../impact-direction.mjs';
import {coinPickupFeedback,COIN_FEEDBACK_SECONDS,COIN_GLOW_COLOR,sampleCoinPickupGlow} from '../coin-pickup-feedback.mjs';
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
 if(f.kind==='heal'||f.kind==='level')return'restore';
 if(coinPickupFeedback(f))return'coin-collect';
 if(COLLECT.has(f.modelId))return'collect';
 if(f.kind==='explosion')return'blast';
 if(f.kind==='hit'&&(!f.modelId||CONTACT.has(f.modelId)))return'contact';
 if(f.kind==='muzzle'&&f.modelId===100001&&Number.isFinite(f.duration))return'muzzle';
 return null;
}
export const isOrdinaryContact=f=>feedbackKind(f)==='contact'&&!COLD.has(f.modelId)&&!ACID.has(f.modelId)&&!ELECTRIC.has(f.modelId);
function palette(f){
 if(coinPickupFeedback(f))return COIN_GLOW_COLOR;
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
 float x=UV.x*2.0-1.0,travel=UV.y;
 // Host-age UVs keep reflected segments continuous and freeze with combat.
 float packet=exp(-pow((fract(travel)-.52)/.14,2.0));
 float core=exp(-x*x*180.0),halo=exp(-x*x*24.0);
 float weave=.22*sin(travel*11.3)+.045*sin(travel*27.0);
 float thread=exp(-pow((x-weave)*23.0,2.0));
 float left=exp(-pow((x+.39+sin(travel*9.0)*.035)*37.0,2.0));
 float right=exp(-pow((x-.39+sin(travel*7.0+2.4)*.03)*37.0,2.0));
 float sideGate=pow(.5+.5*sin(travel*13.0),4.0);
 float tip=exp(-pow((fract(travel)-.61)/.037,2.0));
 float a=core*(.075+packet*.08)+packet*(thread*.52+halo*.07)
  +left*sideGate*.14+right*(1.0-sideGate)*.09+tip*core*.30;
 COLOR=vec4(mix(COLOR.rgb*1.55,vec3(2.05),tip*.28),min(a*COLOR.a,.76));
}
`,
 'blast-body':`shader_type canvas_item;render_mode unshaded,blend_mix;
${cloud}
void fragment(){${phase}
 float n=fbNoise(p*4.0+vec2(t*3.0,-t*2.0))*0.65+fbNoise(p*8.5-vec2(t*2.0))*0.35;
 float radius=0.20+0.64*sin(min(1.0,t*1.6)*1.5707963);
 float angle=atan(p.y,p.x);
 float lobes=sin(angle*5.0+t*4.0)*0.045+sin(angle*9.0-t*7.0)*0.022;
 float body=1.0-smoothstep(radius-0.20,radius+0.08,r+(n-0.5)*0.20+lobes);
 float fire=(1.0-smoothstep(0.16,0.68,t));
 float smoke=smoothstep(0.08,0.30,t)*(1.0-smoothstep(0.52,1.0,t));
 float hot=exp(-r*r*10.0/(0.3+t))*fire;
 float folds=0.28+0.72*n;
 float warm=step(COLOR.g+0.05,COLOR.r);
 vec3 flame=mix(COLOR.rgb*0.30,COLOR.rgb*1.35+vec3(0.35),folds);
 flame=mix(flame,mix(vec3(0.35,0.055,0.014),vec3(1.65,0.49,0.055),folds),warm);
 float foldsHot=smoothstep(0.32,0.76,n)*hot;
 vec3 hotColor=mix(COLOR.rgb*1.15+vec3(0.25),vec3(2.0,1.08,0.26),warm);
 flame=mix(flame,hotColor,clamp(hot*0.55+foldsHot*0.42,0.0,0.93));
 vec3 soot=mix(vec3(0.035,0.055,0.065),vec3(0.26,0.30,0.31),n*0.55+(0.4-p.y)*0.18);
 vec3 color=mix(soot,flame,fire);
 float alpha=body*(fire*0.78+smoke*0.44)*(1.0-smoothstep(0.80,1.0,t));
 COLOR=vec4(color,alpha);
}`,
 'blast-light':`shader_type canvas_item;render_mode unshaded,blend_add;
void fragment(){${phase}
 float core=exp(-r*r*28.0/(0.13+t))*exp(-t*12.0);
 float ringR=length(vec2(p.x,p.y*1.35));
 float wave=exp(-abs(ringR-(0.12+t*1.12))*70.0)*exp(-t*7.0);
 float a=atan(p.y,p.x),spark=pow(max(0.0,cos(a*9.0+r*8.0)),34.0);
 spark*=smoothstep(t*0.8,t*0.8+0.10,r)*(1.0-smoothstep(t*0.8+0.22,t*0.8+0.30,r))*exp(-t*7.0);
 COLOR=vec4(mix(COLOR.rgb*2.8,vec3(3.4,2.75,1.45),core),clamp(core*0.62+wave*0.28+spark*0.72,0.0,1.0));
}`,
 contact:`shader_type canvas_item;render_mode unshaded,blend_add;
uniform float feedback_family=0.0;
void fragment(){
 float t=clamp((COLOR.a-.1)/.8,0.0,1.0),seed=floor(UV.x+.00001);
 float directed=step(1.5,UV.y);
 vec2 p=vec2(UV.x-seed,UV.y-directed*2.0)*2.0-1.0;float r=length(p),a=atan(p.y,p.x),highlight=0.0,emission=0.0;
 float core=exp(-r*r*65.0)*exp(-t*10.0);
 float inner=.06+t*.62,outer=inner+.20;
 float rays=pow(max(0.0,cos(a*7.0+t)),20.0);
 float detail=rays*smoothstep(inner,inner+.04,r)*(1.0-smoothstep(outer,outer+.10,r))*pow(1.0-t,1.6);
 if(feedback_family>.5)core=exp(-r*r*140.0)*exp(-t*16.0);
 if(feedback_family>2.5){
  detail=0.0;
  for(int i=0;i<3;i++){
   float k=float(i),turn=mix(seed*.61+k*2.0944+.31*sin(seed+k*3.1),-1.5707963+(k-1.0)*.91+.14*sin(seed+k),directed);
   vec2 axis=vec2(cos(turn),sin(turn)),crossAxis=vec2(-axis.y,axis.x);
   float along=dot(p,axis),side=dot(p,crossAxis);
   float reach=.22+.47*(1.0-exp(-t*6.0));
   float kink=(abs(fract(along*(5.5+k*.7)+seed*.11+floor(t*4.0)*.173)-.5)*4.0-1.0)*(.034+k*.009);
   kink+=sin(along*28.0+seed+t*8.0)*.009;
   float line=exp(-pow((side-kink)*65.0,2.0));
   float fineCore=exp(-pow((side-kink)*126.0,2.0)),sheath=exp(-pow((side-kink)*29.0,2.0));
   float envelope=smoothstep(.018,.065,along)*(1.0-smoothstep(reach-.075,reach+.015,along));
   float branchSide=kink+(along-reach*.48)*(.43+.12*k);
   float branch=exp(-pow((side-branchSide)*85.0,2.0))*smoothstep(reach*.4,reach*.55,along)*(1.0-smoothstep(reach*.80,reach*.94,along));
   float terminal=exp(-pow((along-reach)*42.0,2.0)-pow((side-kink)*48.0,2.0));
   float pulse=.72+.28*sin(t*18.0+seed+k*2.3);
   float fade=pow(max(0.0,1.0-t*(1.12+k*.08)),1.7);
   detail+=((line*.94+sheath*.085)*envelope+branch*.40+terminal*.52)*pulse*fade;highlight+=terminal*fade;
   emission+=(fineCore*envelope*.72+terminal*.85)*pulse*fade;
   emission+=exp(-r*r*300.0)*exp(-t*6.0)*0.28;
  }
 }else if(feedback_family>1.5){
  detail=0.0;
  for(int i=0;i<4;i++){
   float k=float(i),turn=mix(seed*.73+k*2.39996+.32*sin(seed+k*2.7),-1.5707963+(k-1.5)*.58+.16*sin(seed+k*2.7),directed);
   vec2 axis=vec2(cos(turn),sin(turn)),crossAxis=vec2(-axis.y,axis.x);
   float travel=.045+(1.0-exp(-t*(3.4+k*.3)))*(.52+k*.045);
   vec2 q=p-axis*travel-crossAxis*(.11*t*t*sin(seed+k));
   float along=dot(q,axis),side=dot(q,crossAxis);
   float ellipse=length(vec2(along*(8.0+t*4.0),side*(13.0-t*2.0)));
   float body=1.0-smoothstep(.58,.94,ellipse),wet=exp(-abs(ellipse-.71)*24.0);
   float shine=exp(-pow((along-.018)*43.0,2.0)-pow((side+.022)*60.0,2.0));
   float tail=exp(-side*side*2100.0)*smoothstep(-.25,-.15,along)*(1.0-smoothstep(-.055,0.0,along));
   float pin=exp(-pow((along+.19)*54.0,2.0)-pow((side-.035*sin(k+seed))*70.0,2.0));
   float fade=pow(max(0.0,1.0-t*(1.03+k*.07)),1.65);
   detail+=(body*.24+wet*.44+shine*.74+tail*.22+pin*.24)*fade;highlight+=shine*fade;
   emission+=(shine*.32+wet*.055)*fade;
  }
 }else if(feedback_family>.5){
  detail=0.0;
  for(int i=0;i<4;i++){
   float k=float(i),turn=mix(seed*.57+k*2.39996+.26*sin(seed+k),-1.5707963+(k-1.5)*.49+.14*sin(seed+k),directed);
   vec2 axis=vec2(cos(turn),sin(turn));
   float travel=.045+(1.0-exp(-t*3.8))*(.47+k*.055);
   vec2 q=p-axis*travel;
   float spin=seed*.39+k*.8+t*(2.7-k*1.48),c=cos(spin),s=sin(spin);
   vec2 local=vec2(c*q.x+s*q.y,-s*q.x+c*q.y);
   float diamond=abs(local.x)*1.05+abs(local.y)*2.65,size=.094+.016*k;
   float body=1.0-smoothstep(size*.65,size,diamond),edge=exp(-abs(diamond-size*.79)*120.0);
   float facet=smoothstep(-.02,.025,local.x-local.y*.4),glint=pow(max(0.0,cos(spin*3.0+k)),12.0);
   float along=dot(q,axis),side=dot(q,vec2(-axis.y,axis.x));
   float trail=exp(-side*side*2200.0)*smoothstep(-.23,-.13,along)*(1.0-smoothstep(-.045,0.0,along));
   float fade=pow(max(0.0,1.0-t*(1.03+k*.055)),1.35);
   detail+=(body*(.45+facet*.30+glint*.60)+edge*.42+trail*.23)*fade;highlight+=body*glint*fade;
   emission+=(body*glint*.70+edge*.42)*fade;
  }
 }
 float rim=exp(-abs(r-(.08+t*.52))*65.0)*exp(-t*10.0);
 float halo=feedback_family>.5?exp(-r*r*32.0)*exp(-t*17.0)*.025:0.0;
 vec3 hot=mix(COLOR.rgb,vec3(1.0),.26)*3.4;
 float ringGain=feedback_family>.5?.035:.16;
 float gain=feedback_family>.5?3.05:2.6;
 // Only the narrow cores/specular facets exceed the existing HDR threshold.
 vec3 color=mix(COLOR.rgb*gain,hot,clamp(core+highlight*.48,0.0,1.0));
 color+=mix(COLOR.rgb,vec3(1.0),.55)*min(emission,1.15)*8.0;
 COLOR=vec4(color,clamp(core*.90+detail*(feedback_family>.5?.92:.85)+rim*ringGain+halo,0.0,1.0));
}
`,
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
 float healing=step(COLOR.b,COLOR.g);
 float ringRadius=.19+.65*(1.0-pow(1.0-t,2.2));
 float ring=exp(-abs(r-ringRadius)*72.0)*pow(1.0-t,2.2);
 float sheen=exp(-r*r*17.0)*exp(-t*14.0);
 float particles=0.0;
 for(int i=0;i<6;i++){
  float k=float(i),life=clamp((t-k*.047)/.72,0.0,1.0);
  float x=sin(k*2.4)*(.24+.042*k),y=.40-life*.92+k*.035;
  vec2 q=p-vec2(x,y);
  // Solid medical crosses stay readable at phone size, with a soft green halo.
  float arm=.065+.035*(1.0-step(.5,k)),width=arm*.34;
  vec2 v=abs(q);
  float d=min(max(v.x-width,v.y-arm),max(v.x-arm,v.y-width));
  float body=1.0-smoothstep(-.006,.008,d);
  float cross=body+exp(-max(0.0,d)*48.0)*(1.0-body)*.22;
  float crystal=1.0-smoothstep(.018,.036,abs(q.x)+abs(q.y)*.62);
  float fade=smoothstep(0.0,.12,life)*(1.0-smoothstep(.45,1.0,life));
  particles+=mix(crystal,cross,healing)*fade;
 }
 vec3 color=COLOR.rgb*(2.5+ring*6.8)+vec3(.15)+mix(COLOR.rgb,vec3(1.0),.35)*particles*1.1;
 COLOR=vec4(color,clamp(ring*mix(.22,.13,healing)+sheen*.16+particles*mix(.62,.82,healing),0.0,1.0));
}
`,
 'coin-collect':`shader_type canvas_item;render_mode unshaded,blend_add;
void fragment(){
 vec2 p=UV*2.0-1.0;float r2=dot(p,p);
 float body=exp(-r2*4.4)*(1.0-smoothstep(.72,1.0,sqrt(r2)));
 float core=exp(-r2*25.0);
 vec3 warm=mix(COLOR.rgb,vec3(1.0,.98,.78),core*.25);
 COLOR=vec4(warm*(body+core*.10),COLOR.a);
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
 float facets=pow(max(0.0,cos(a*7.0+status_seed*.37+r*4.0)),9.0)*smoothstep(.42,.64,r)*(1.0-smoothstep(.80,.97,r));
 float edgeRadius=.75+.026*sin(a*8.0+status_seed);
 float edge=exp(-abs(r-edgeRadius)*68.0)*(.28+.55*n);
 float glass=(1.0-smoothstep(.40,.85,r))*n*.035;
 float shine=pow(max(0.0,cos(a*5.0+status_seed*1.9)),28.0)*edge;
 vec3 color=mix(vec3(.19,.45,.62),vec3(1.15,1.68,1.85),clamp(facets*.8+shine,0.0,1.0));
 COLOR=vec4(color,COLOR.a*(facets*.39+edge*.30+shine*.30+glass));`,
 burn:`${cloud}
 vec2 p=UV*2.0-1.0;float y=p.y,t=status_age;
 float fire=0.0,filaments=0.0,embers=0.0;
 for(int i=0;i<4;i++){
  float k=float(i),drift=sin(y*6.0-t*3.8+k*1.7+status_seed);
  float center=-.60+k*.40+.065*drift;
  float width=.060+.028*(.5+.5*sin(t*4.0+k*2.0+status_seed));
  float x=(p.x-center)/width;
  float height=.02+.22*sin(t*3.2+k*2.3+status_seed);
  float flame=exp(-x*x)*smoothstep(-.84,-.52,y)*(1.0-smoothstep(-.20,height,y));
  fire+=flame;
  filaments+=exp(-pow((p.x-center+.025)*65.0,2.0))*flame;
  float travel=fract(t*(.47+k*.041)+k*.237+status_seed*.13);
  vec2 q=p-vec2(center+.045*sin(travel*8.0+k),-.47+travel*1.02);
  embers+=exp(-q.x*q.x*6000.0-q.y*q.y*1900.0)*sin(travel*3.14159265);
 }
 float n=fbNoise(p*4.0+vec2(status_seed+t*.08,-t*.85));
 float smoke=(1.0-smoothstep(.25,.9,length(p+vec2(0.0,.15))))*n*.045;
 float core=clamp(fire*(.66+.34*n),0.0,1.0);
 vec3 color=mix(vec3(.35,.065,.025),vec3(1.85,.69,.095),core);
 color+=vec3(.74,.41,.12)*clamp(filaments+embers,0.0,1.0);
 COLOR=vec4(color,COLOR.a*clamp(core*.48+smoke+embers*.46,0.0,.76));`,
 disrupt:`
 vec2 p=UV*2.0-1.0;float r=length(p),a=atan(p.y,p.x),t=status_age;
 float orbit=pow(max(0.0,cos(a*4.0-t*2.1+status_seed)),24.0)*exp(-abs(r-.75)*59.0);
 float gate=smoothstep(.16,.34,fract(a*1.90986+t*.12+status_seed));
 float circuit=exp(-abs(r-.67)*92.0)*gate*.19;
 vec2 q=p*7.0,cell=floor(q);float jitter=sin(cell.y*2.3+t*3.0+status_seed);
 float scan=exp(-pow((fract(q.x)-.5)*23.0,2.0))*exp(-pow((fract(q.y)-.5)*9.0,2.0));
 scan*=smoothstep(.55,.87,jitter)*(1.0-smoothstep(.56,.88,r))*.20;
 float mote=exp(-dot(p,p)*5.0)*.012;
 COLOR=vec4(mix(vec3(.48,.23,.79),vec3(1.0,.66,1.46),orbit),COLOR.a*(orbit*.57+circuit+scan+mote));`,

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
 beginFrame(viewport){for(const name of this.batches.keys())this.pool.get(name).reset();this.batches.clear();this.beams.beginFrame(viewport);this.contactCount=0;this.count=0;this.normalCount=0;this.restoreCounts={heal:0,level:0};this.coinCount=0;this.pickups=0;this.statuses=0;this.culled=0;this.statusGroups.length=0;this.statusLatest.clear();this.submittedStatuses=0;this.viewport=viewport;this.frame++;
  // Old age buckets must not accumulate through long or repeated battles.
  for(const [key,buffer]of this.pool)if(this.frame-buffer.lastUsed>120)this.pool.delete(key);
 }
 buffer(name,material=name,base){let buffer=this.pool.get(name);if(!buffer){buffer=new VfxMeshBuffer(name,ROOT+material,name.endsWith('body')?0:2);this.pool.set(name,buffer);}
  buffer.lastUsed=this.frame;this.batches.set(name,buffer.mesh);if(base!==undefined){buffer.mesh.materialUniformOverrides??={status_age_base:base};buffer.mesh.materialUniformOverrides.status_age_base=base;}return buffer;
 }
 corners(x,z,rx,rz,yaw,screen){const c=Math.cos(yaw),s=Math.sin(yaw);for(let i=0;i<4;i++){const a=i===1||i===2?rx:-rx,f=i<2?rz:-rz,p=screen(x+c*a+s*f,z-s*a+c*f);this.points[i].x=p.x;this.points[i].y=p.y;}return this.points;}
 visible(){if(quadVisible(this.points,this.viewport))return true;this.culled++;return false;}
 queue(name,points,color,t,family=0,seed=0,directed=false){
  const contact=name==='contact',buffer=this.buffer(contact&&family?name+'-'+family:name,contact?'contact':name);
  if(contact){buffer.mesh.materialUniformOverrides??={feedback_family:0};buffer.mesh.materialUniformOverrides.feedback_family=family;}
  const first=buffer.mesh.vertices.length;buffer.quad(points,color[0],color[1],color[2],.1+.8*clamp(t));
  // Integer UV offset carries a deterministic per-hit variant without material
  // instances or extra draw calls. Fractional UVs remain local to this quad.
  if(contact&&family)for(let i=first;i<first+4;i++){buffer.mesh.vertices[i].uv[0]+=seed;if(directed)buffer.mesh.vertices[i].uv[1]+=2;}
 }
 // Keep eight shared-budget slots for essential receipts, four of each kind.
 admitNativeContact(){if(this.normalCount>=112||this.contactCount>=96)return false;this.count++;this.normalCount++;this.contactCount++;return true;}
 beam(projectile,screen){this.beams.projectile(projectile,screen);}
 effect(f,screen,visualScale=1,age=f.age){
  const kind=feedbackKind(f);if(!kind)return false;
  const coin=kind==='coin-collect';if(coin&&!coinPickupFeedback(f).admitted)return true;
  if(!Number.isFinite(f.x)||!Number.isFinite(f.z)||!Number.isFinite(age)||!Number.isFinite(f.size)||!Number.isFinite(visualScale)||!(f.duration>0)||age<0||age>=f.duration)return true;
  const lifetime=Math.min(f.duration,coin?COIN_FEEDBACK_SECONDS:kind==='muzzle'?.12:kind==='contact'?.26:kind==='blast'?1.05:f.kind==='heal'?.95:.7);if(age>=lifetime||(coin?this.coinCount>=3:kind==='restore'?this.restoreCounts[f.kind]>=4:this.normalCount>=112)||(kind==='contact'&&this.contactCount>=96))return true;
  if(coin){
   const pulse=sampleCoinPickupGlow(age),r=clamp(f.size*visualScale,.5,1.5)*pulse.size;
   if(pulse.alpha<=0)return true;
   const color=palette(f);let visible=false;
   // Two filled glows, the second lifted by0.5 native units. Shared batch,
   // real pickup time and body position; no hollow rings or drifting sparks.
   for(const lift of [0,.5]){
    this.corners(f.x,f.z+lift*visualScale,r,r,0,screen);if(!this.visible())continue;
    this.buffer('coin-collect').quad(this.points,color[0],color[1],color[2],pulse.alpha);visible=true;
   }
   if(visible){this.count++;this.coinCount++;}return true;
  }
  const radius=clamp(f.size*(kind==='muzzle'?.65:.5)*visualScale,.12,6),extent=kind==='blast'?1.55:kind==='contact'?1.55:1;
  const family=COLD.has(f.modelId)?1:ACID.has(f.modelId)?2:ELECTRIC.has(f.modelId)?3:0;
  const yaw=kind==='contact'&&family?impactDirectionYaw(f):undefined;
  this.corners(f.x,f.z,radius*(kind==='muzzle'?.7:1)*extent,radius*(kind==='muzzle'?1.4:1)*extent,yaw??f.angle??0,screen);if(!this.visible())return true;this.count++;if(kind==='contact')this.contactCount++;
  if(coin)this.coinCount++;else if(kind==='restore')this.restoreCounts[f.kind]++;else this.normalCount++;
  const color=palette(f),t=age/lifetime;if(kind==='blast'){this.queue('blast-body',this.points,color,t);this.queue('blast-light',this.points,color,t);}else this.queue(kind,this.points,color,t,family,(Math.imul((f.uid??0)|0,1664525)>>>0)%32,yaw!==undefined);return true;
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
 draw(view){this.beams.draw(view);for(const [name,mesh]of this.batches)if(mesh.indices.length&&(!name.startsWith('status:')||this.pool.get(name).statusOrder>=this.submittedStatuses))view.drawMeshes('combat-feedback:'+name,[mesh],undefined,{presentationDepth:name==='pickup'?18.8:name==='restore'||name==='coin-collect'?39:name.startsWith('status:')?38:34});}
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
