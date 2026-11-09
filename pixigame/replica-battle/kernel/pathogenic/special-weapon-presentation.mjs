import {VfxMeshBuffer} from './vfx-buffers.mjs';
const ROOT='host://special-weapon-feedback-v1/';
const clamp=v=>Math.max(0,Math.min(1,v));
const hash=n=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
export const isCounterRay=b=>b.owner==='player'&&b.weaponId===200178&&b.modelId===1000000;
export function withSpecialWeaponResources(graph){
 const resources={...graph.resources},shaders={...graph.shaders};
 for(const[name,shape]of Object.entries({
  glow:'float r2=dot(p,p);float a=(exp(-r2*14.0)+exp(-r2*4.5)*0.18)*(1.0-smoothstep(0.45,1.0,r2));',
  edge:'float core=exp(-p.y*p.y*42.0);float shoulder=exp(-p.y*p.y*9.0);float fringe=exp(-p.y*p.y*2.5);float a=(core*0.90+shoulder*0.30+fringe*0.035)*(1.0-smoothstep(0.50,1.0,abs(p.x)));float peak=max(COLOR.r,max(COLOR.g,COLOR.b));COLOR.rgb=mix(COLOR.rgb,vec3(peak)*vec3(1.0,0.98,0.94),core*0.52);',
 })){
  resources[ROOT+name]={type:'ShaderMaterial',properties:{shader:{$external:ROOT+name+'-shader'}}};
  shaders[ROOT+name+'-shader']={code:`shader_type canvas_item;render_mode unshaded,blend_add;void fragment(){vec2 p=UV*2.0-1.0;${shape}COLOR=vec4(COLOR.rgb,COLOR.a*a);}`};
 }
 return{...graph,resources,shaders};
}
function geometry(screen,buffers){
 for(const b of buffers.values())b.reset();
 const buffer=name=>{let b=buffers.get(name);if(!b){b=new VfxMeshBuffer(name,ROOT+name,2);buffers.set(name,b);}return b;};
 const quad=(name,x,z,rx,rz,yaw,color,alpha)=>{
  const c=Math.cos(yaw),s=Math.sin(yaw),points=[];
  for(let i=0;i<4;i++){const u=i===1||i===2?rx:-rx,v=i<2?rz:-rz;points.push(screen(x+c*u-s*v,z+s*u+c*v));}
  buffer(name).quad(points,...color,alpha);
 };
 const line=(a,b,width,color,alpha)=>{
  const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);if(length<1e-6)return;
  quad('edge',(a.x+b.x)/2,(a.z+b.z)/2,length*.60,width,Math.atan2(dz,dx),color,alpha);
 };
 return{quad,line,meshes:()=>[...buffers.values()].map(b=>b.mesh).filter(m=>m.indices.length)};
}
export function counterRayScreenMeshes(b,screen,buffers=new Map()){
 if(!isCounterRay(b)||b.dead||b.visualHidden||![b.x,b.z,b.angle].every(Number.isFinite))return [];
 const g=geometry(screen,buffers),yaw=Math.PI/2-b.angle;
 // RayChaser owns age and travel. A direct mesh is visible even at held age 0.
 // A single HDR core feeds the existing bloom chain; the local shoulder stays
 // colored. Avoid stacking two overexposed solid cores at the same position.
 g.quad('glow',b.x,b.z,.25,.64,yaw-Math.PI/2,[1.55,.78,.16],.25);
 g.quad('edge',b.x,b.z,.57,.11,yaw,[2.35,1.35,.28],.95);
 return g.meshes();
}
export function specialWeaponFeedbackMeshes(f,screen,buffers=new Map()){
 if(!['transport-in','transport-out','intercept'].includes(f.specialFeedback)||
  ![f.x,f.z,f.age,f.duration,f.size].every(Number.isFinite)||f.age<0||f.age>=f.duration||f.duration<=0)return [];
 const g=geometry(screen,buffers),t=clamp(f.age/f.duration),fade=(1-t)**1.2;
 if(f.specialFeedback==='intercept'){
  const ice=f.weaponSkinFamily===200141,color=ice?[.45,1.05,1.6]:[.24,.58,1.6],size=f.size;
  g.quad('glow',f.x,f.z,size*.65,size*.65,0,color,.75*Math.exp(-t*8));
  for(let i=0;i<4;i++){
   const a=hash(f.uid*7+i)*Math.PI*2,d=size*(.14+.95*(1-Math.exp(-t*4)));
   const end={x:f.x+Math.cos(a)*d,z:f.z+Math.sin(a)*d},start={x:f.x+Math.cos(a)*d*.48,z:f.z+Math.sin(a)*d*.48};
   g.line(start,end,.065,color.map(v=>v*1.35+.22),fade*.9);
  }
 }else{
  const entry=f.specialFeedback==='transport-in',r=f.size*(entry?1-.85*t:.22+.83*(1-Math.exp(-t*7)));
  const color=[.38,1.25,.19];
  for(let arc=0;arc<3;arc++)for(let j=0;j<12;j++){
   const a=arc*Math.PI*2/3+j/12*1.35+(entry?-t:t)*.9,b=a+1.35/12;
   g.line({x:f.x+Math.cos(a)*r,z:f.z+Math.sin(a)*r*.70},
    {x:f.x+Math.cos(b)*r,z:f.z+Math.sin(b)*r*.70},.065,color.map(v=>v*1.25),fade*.85);
  }
  for(let i=0;i<6;i++){
   const a=i*Math.PI/3+(entry?-t:t)*1.5,d=r*(.55+hash(f.uid+i)*.65);
   const p={x:f.x+Math.cos(a)*d,z:f.z+Math.sin(a)*d*.7};
   g.quad('glow',p.x,p.z,.095,.095,0,[.8,1.6,.45],fade*.72);
   g.line(p,{x:p.x+Math.cos(a)*.13,z:p.z+Math.sin(a)*.09},.035,[1.1,1.8,.7],fade*.72);
  }
  g.quad('glow',f.x,f.z,r*.50,r*.38,0,[.35,.9,.15],fade*.23);
 }
 return g.meshes();
}
