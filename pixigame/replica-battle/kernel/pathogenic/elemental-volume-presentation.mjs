import {boundsVisible,quadVisible,VfxMeshBuffer} from './vfx-buffers.mjs';
// Render-only layers. Positions, collision radii, ages and expiry belong to combat.
const ROOT='host://elemental-volume-v1/';
const bufferOwners=new WeakMap();
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const hash=x=>{const v=Math.sin(x*127.1+311.7)*43758.5453;return v-Math.floor(v);};
export const isLayeredCorrosion=b=>b.modelId===170002;
export const isLayeredIceCyclone=b=>b.owner==='player'&&b.weaponId===200039&&b.modelId===1000043;
const noise=`
float element_hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float element_noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(element_hash(i),element_hash(i+vec2(1.0,0.0)),f.x),mix(element_hash(i+vec2(0.0,1.0)),element_hash(i+vec2(1.0,1.0)),f.x),f.y);}
float element_cloud(vec2 p){return element_noise(p)*0.58+element_noise(p*2.1+vec2(7.2))*0.28+element_noise(p*4.3-vec2(3.1))*0.14;}
`;
const shaders={
 'corrosion-surface':`shader_type canvas_item;
render_mode unshaded, blend_mix;
uniform float element_age=0.0;
uniform float element_seed=0.0;
${noise}
void fragment(){
 vec2 p=UV*2.0-1.0;float r=length(p),t=element_age;
 vec2 q=p*2.7+vec2(element_seed,t*0.10);
 float density=element_cloud(q);
 vec2 a=(p-vec2(-0.48,0.06))*vec2(2.6,3.6),b=(p-vec2(0.43,0.22))*vec2(3.1,3.2);
 vec2 c=(p-vec2(0.02,-0.42))*vec2(3.0,3.7),d=(p-vec2(-0.10,0.44))*vec2(3.5,3.4);
 float fa=exp(-dot(a,a)),fb=exp(-dot(b,b)),fc=exp(-dot(c,c)),fd=exp(-dot(d,d));
 float field=fa+fb+fc+fd;
 float shape=field+(density-0.5)*0.24;
 float coating=smoothstep(0.22,0.54,shape)*(1.0-smoothstep(0.86,1.0,r));
 float center=0.34+0.66*smoothstep(0.20,0.55,r);
 float rim=exp(-abs(shape-0.35)*32.0);
 vec2 slope=-2.0*(a*vec2(2.6,3.6)*fa+b*vec2(3.1,3.2)*fb+c*vec2(3.0,3.7)*fc+d*vec2(3.5,3.4)*fd);
 vec3 normal=normalize(vec3(-slope*0.28,0.75));
 float light=clamp(dot(normal,normalize(vec3(-0.5,-0.6,1.0))),0.0,1.0);
 vec3 color=mix(vec3(0.025,0.10,0.035),vec3(0.43,0.63,0.17),light);
 float wet=pow(max(0.0,dot(normal,normalize(vec3(-0.28,-0.35,1.0)))),22.0);
 color+=vec3(0.47,0.56,0.28)*(rim*0.26+wet*0.52);
 float alpha=coating*center*(0.63+rim*0.13);
 COLOR=vec4(color*COLOR.rgb,COLOR.a*alpha);
}`,
 'corrosion-mist':`shader_type canvas_item;
render_mode unshaded, blend_mix;
uniform float element_age=0.0;
uniform float element_seed=0.0;
${noise}
void fragment(){
 vec2 p=UV*2.0-1.0;
 float n=element_cloud(p*3.0+vec2(element_seed,element_age*0.45));
 float envelope=(1.0-smoothstep(0.30,0.97,length(p)))*smoothstep(0.30,0.72,n);
 float wisps=pow(max(0.0,n*1.4-0.35),2.0);
 vec3 color=mix(vec3(0.10,0.19,0.085),vec3(0.49,0.62,0.23),n);
 COLOR=vec4(color*COLOR.rgb,COLOR.a*envelope*wisps*0.36);
}`,
 bubble:`shader_type canvas_item;
render_mode unshaded, blend_mix;
void fragment(){
 vec2 p=UV*2.0-1.0;float r=length(p);
 float face=sqrt(max(0.0,1.0-r*r));
 float edge=1.0-smoothstep(0.83,1.0,r);
 float rim=exp(-abs(r-0.79)*24.0);
 vec2 spot=p-vec2(-0.30,-0.32);float glint=exp(-dot(spot,spot)*42.0);
 vec3 color=mix(vec3(0.055,0.17,0.045),vec3(0.43,0.66,0.15),face*0.8);
 color+=vec3(0.45,0.53,0.28)*(rim*0.38+glint*0.85);
 // Only the tiny reflective highlight emits; coating and vapor stay dark.
 color+=vec3(0.90,4.00,0.50)*glint*1.35;
 COLOR=vec4(color*COLOR.rgb,COLOR.a*edge*(0.42+rim*0.25+glint*0.23));
}`,
 'cyclone-ground':`shader_type canvas_item;
render_mode unshaded, blend_mix;
uniform float element_age=0.0;
uniform float element_seed=0.0;
${noise}
void fragment(){
 vec2 p=UV*2.0-1.0;float r=length(p),a=atan(p.y,p.x),t=element_age;
 float n=element_cloud(p*4.0+vec2(t*0.18,element_seed));
 float flow=pow(0.5+0.5*sin(a*3.0+r*10.0-t*4.3),3.0);
 float edge=1.0-smoothstep(0.64,1.0,r);
 float mist=(0.12+n*0.24+flow*0.24)*edge;
 vec3 color=mix(vec3(0.13,0.29,0.33),vec3(0.61,0.79,0.81),flow*0.65+n*0.2);
 COLOR=vec4(color*COLOR.rgb,COLOR.a*mist*0.55);
}`,
 'cyclone-body':`shader_type canvas_item;
render_mode unshaded, blend_mix;
uniform float element_age=0.0;
uniform float element_seed=0.0;
${noise}
void fragment(){
 float h=1.0-UV.y,t=element_age;
 float width=0.14+0.70*pow(h,0.72);
 float x=(UV.x*2.0-1.0)/width;
 float edge=1.0-smoothstep(0.72,1.0,abs(x));
 float ends=smoothstep(0.0,0.08,h)*(1.0-smoothstep(0.88,1.0,h));
 float side=sqrt(max(0.0,1.0-x*x));
 float n=element_cloud(vec2(x*2.7+h*4.0,h*7.0-t*1.0+element_seed));
 float bands=pow(0.5+0.5*sin(h*25.0+x*3.8-t*6.0),3.0);
 float density=(0.12+n*0.26+bands*0.15)*edge*ends;
 float light=clamp(side*0.65+(0.3-x)*0.18+bands*0.18,0.0,1.0);
 vec3 color=mix(vec3(0.16,0.34,0.41),vec3(0.70,0.86,0.89),light);
 COLOR=vec4(color*COLOR.rgb,COLOR.a*density);
}`,
 'cyclone-band':`shader_type canvas_item;
render_mode unshaded, blend_mix;
uniform float element_age=0.0;
uniform float element_seed=0.0;
${noise}
void fragment(){
 float across=UV.y*2.0-1.0;
 float edge=1.0-smoothstep(0.50,1.0,abs(across));
 float ridges=0.5+0.5*sin(UV.x*42.0-across*3.0-element_age*5.0);
 float grain=element_noise(vec2(UV.x*18.0-element_age*2.0,UV.y*5.0+element_seed));
 vec3 color=COLOR.rgb*(0.76+0.24*ridges)+vec3(0.12,0.16,0.18)*exp(-abs(across+0.25)*9.0);
 float hot=exp(-(across+0.20)*(across+0.20)*25.0)*(0.65+0.35*ridges);
 color+=vec3(0.75,1.20,1.40)*hot;
 COLOR=vec4(color,COLOR.a*edge*(0.58+grain*0.32));
}`,
 facet:`shader_type canvas_item;
render_mode unshaded, blend_mix;
void fragment(){float glint=pow(clamp((COLOR.r-0.55)/0.45,0.0,1.0),5.0);COLOR.rgb+=vec3(0.48,0.82,0.94)*glint;}`,
};
export function withElementalVolumeResources(graph){
 const resources={...graph.resources},programs={...graph.shaders};
 for(const [name,code]of Object.entries(shaders)){
  resources[ROOT+name]={type:'ShaderMaterial',properties:{shader:{$external:ROOT+name+'-shader'}}};
  programs[ROOT+name+'-shader']={code};
 }
 return {...graph,resources,shaders:programs};
}
function batch(key,material,age,seed,z,cache){
 if(!cache)return{key,z,material:{$ref:ROOT+material},materialUniformOverrides:{element_age:age,element_seed:seed},vertices:[],indices:[]};
 let buffer=cache.get(key);if(!buffer){buffer=new VfxMeshBuffer(key,ROOT+material,z);cache.set(key,buffer);bufferOwners.set(buffer.mesh,buffer);}
 buffer.reset();const mesh=buffer.mesh;mesh.materialUniformOverrides??={element_age:age,element_seed:seed};mesh.materialUniformOverrides.element_age=age;mesh.materialUniformOverrides.element_seed=seed;return mesh;
}
function polygon(mesh,points,colors,uvs){
 const start=mesh.vertices.length;
 const buffer=bufferOwners.get(mesh);for(let i=0;i<points.length;i++){const p=points[i],uv=uvs?.[i],color=Array.isArray(colors[0])?colors[i]:colors;if(buffer)buffer.vertex(p.x,p.y,uv?.[0]??.5,uv?.[1]??.5,color[0],color[1],color[2],color[3]);else mesh.vertices.push({position:[p.x,p.y],uv:uv??[.5,.5],color:[...color]});}
 for(let i=1;i<points.length-1;i++)mesh.indices.push(start,start+i,start+i+1);
}
function quad(key,material,age,seed,z,point,rx,rz,alpha,cache){
 const m=batch(key,material,age,seed,z,cache);
 polygon(m,[point(-rx,rz),point(rx,rz),point(rx,-rz),point(-rx,-rz)],[1,1,1,alpha],[[0,0],[1,0],[1,1],[0,1]]);return m;
}
const complete=meshes=>{for(const m of meshes)for(const v of m.vertices)if(!Number.isFinite(v.position[0])||!Number.isFinite(v.position[1])||!Number.isFinite(v.uv[0])||!Number.isFinite(v.uv[1])||!Number.isFinite(v.color[0])||!Number.isFinite(v.color[1])||!Number.isFinite(v.color[2])||!Number.isFinite(v.color[3]))return false;return true;};
export function corrosionStatusMeshes(buff,screen,viewport,cache){
 if(!isLayeredCorrosion(buff)||buff.dead||buff.visualHidden||![buff.age,buff.x,buff.z].every(Number.isFinite)||buff.age<0)return[];
 const remaining=buff.remaining??(buff.duration-buff.age);
 if(!(remaining>0)||(buff.duration!==undefined&&(!(buff.duration>0)||buff.age>=buff.duration)))return[];
 // These are decorative target extents supplied by the renderer, not damage radii.
 const rx=clamp(Number.isFinite(buff.visualRadiusX)&&buff.visualRadiusX>0?buff.visualRadiusX*1.08+.20:1.35,.7,5);
 const rz=clamp(Number.isFinite(buff.visualRadiusZ)&&buff.visualRadiusZ>0?buff.visualRadiusZ*1.08+.20:1.2,.7,5);
 if(viewport){const p=[screen(buff.x-rx*1.12,buff.z+rz*1.65),screen(buff.x+rx*1.12,buff.z+rz*1.65),screen(buff.x+rx*1.12,buff.z-rz*1.1),screen(buff.x-rx*1.12,buff.z-rz*1.1)];if(!quadVisible(p,viewport))return[];}
 const age=buff.age,seed=hash((Number(buff.targetUid)||0)*13+Number(buff.buffId))*10;
 const alpha=clamp(.08+age/.18)*clamp(remaining/.30),point=(x,z)=>screen(buff.x+x,buff.z+z);
 const result=[quad('corrosion-patches','corrosion-surface',age,seed,0,point,rx,rz,alpha,cache),
  quad('corrosion-vapor','corrosion-mist',age,seed,1,(x,z)=>point(x,z+rz*.30),rx*1.12,rz*1.35,alpha,cache)];
 const bubbles=batch('corrosion-bubbles','bubble',age,seed,2,cache);
 for(let i=0;i<7;i++){
  const phase=(age*(.28+hash(i+seed)*.08)+hash(i*7+seed))%1;
  const a=i*Math.PI*2/7+seed+age*.12;
  const x=Math.cos(a)*rx*.65,z=Math.sin(a)*rz*.53+phase*rz*.43;
  const r=Math.min(rx,rz)*(.06+hash(i+seed+11)*.045)*(.7+phase*.45);
  const fade=Math.sin(phase*Math.PI)*alpha;
  polygon(bubbles,[point(x-r,z+r),point(x+r,z+r),point(x+r,z-r),point(x-r,z-r)],[1,1,1,fade],[[0,0],[1,0],[1,1],[0,1]]);
 }
 result.push(bubbles);return complete(result)?result:[];
}
export function iceCycloneMeshes(b,screen,viewport,cache){
 if(!isLayeredIceCyclone(b)||b.dead||b.visualHidden||!(b.scale>0)||!(b.lifetime>0)
  ||![b.age,b.x,b.z,b.radiusX,b.radiusZ].every(Number.isFinite)||b.age<Math.max(0,b.warmup??0)
  ||b.age>=b.lifetime||b.radiusX<=0||b.radiusZ<=0)return[];
 const age=b.age-(b.warmup??0),yaw=b.angle??0,c=Math.cos(yaw),s=Math.sin(yaw);
 const x=b.x+c*(b.offsetX??0)+s*(b.offsetZ??0),z=b.z-s*(b.offsetX??0)+c*(b.offsetZ??0);
 const point=(a,f)=>screen(x+a,z+f),center=point(0,0),px=point(b.radiusX,0),pz=point(0,b.radiusZ);
 const rx=Math.hypot(px.x-center.x,px.y-center.y),rz=Math.hypot(pz.x-center.x,pz.y-center.y),height=Math.max(rx,rz)*2.15;
 if(![rx,rz,height,center.x,center.y].every(Number.isFinite))return[];
 if(!boundsVisible(center.x-rx*1.15,center.y-height*1.12-rz*.2,center.x+rx*1.15,center.y+Math.max(rz,height*.05),viewport))return[];
 const alpha=clamp(.08+age/.19)*clamp((b.lifetime-b.age)/.4),seed=hash(Number(b.uid)||0)*10;
 const screenPoint=(a,h)=>({x:center.x+a,y:center.y-h});
 const ground=quad('cyclone-footprint','cyclone-ground',age,seed,-3,point,b.radiusX,b.radiusZ,alpha,cache);
 const back=batch('cyclone-rear-wind','cyclone-band',age,seed,-2,cache),front=batch('cyclone-front-wind','cyclone-band',age,seed,2,cache);
 const iceBack=batch('cyclone-rear-ice','facet',age,seed,-1,cache),iceFront=batch('cyclone-front-ice','facet',age,seed,3,cache);
 const body=quad('cyclone-volume','cyclone-body',age,seed,0,(a,f)=>screenPoint(a,f+height*.48),rx,height*.52,alpha,cache);
 const at=(u,k)=>{
  const a=age*5.3+k*Math.PI*2/3+u*10.5+seed,rad=.14+.68*Math.pow(u,.72);
  return{p:screenPoint(Math.sin(a)*rx*rad,height*u+Math.cos(a)*rz*rad*.15),front:Math.cos(a)>0,u};
 };
 for(let k=0;k<3;k++){let previous=at(0,k);for(let i=0;i<32;i++){
  const a=previous,d=at((i+1)/32,k),dx=d.p.x-a.p.x,dy=d.p.y-a.p.y,len=Math.hypot(dx,dy);previous=d;
  if(len<1e-6)continue;
  const u=(i+.5)/32,width=height*(.013+.012*u),nx=-dy/len*width,ny=dx/len*width;
  const foreground=a.front,mesh=foreground?front:back;
  const opacity=alpha*Math.sin(u*Math.PI)* (foreground?.72:.33),color=foreground?[.64,.85,.91,opacity]:[.20,.43,.57,opacity];
  polygon(mesh,[{x:a.p.x+nx,y:a.p.y+ny},{x:d.p.x+nx,y:d.p.y+ny},{x:d.p.x-nx,y:d.p.y-ny},{x:a.p.x-nx,y:a.p.y-ny}],color,[[i/32,0],[(i+1)/32,0],[(i+1)/32,1],[i/32,1]]);
 }
 }
 for(let i=0;i<11;i++){
  const u=(age*(.17+hash(i+seed)*.05)+hash(i*11+seed))%1,a=age*4.1+i*2.4+seed;
  const rad=(.20+.68*u),cx=Math.sin(a)*rx*rad,cy=height*u+Math.cos(a)*rz*.15;
  const size=Math.min(rx,rz)*(.038+hash(i+seed+2)*.026),angle=a*.65,co=Math.cos(angle),si=Math.sin(angle);
  const p=(lx,ly)=>screenPoint(cx+co*lx-si*ly,cy+si*lx+co*ly),mesh=Math.cos(a)>0?iceFront:iceBack;
  const fade=alpha*Math.sin(u*Math.PI)*.85;
  polygon(mesh,[p(0,size*1.8),p(-size*.7,0),p(0,-size),p(size*.7,0)],[[.83,.96,1,fade],[.27,.55,.70,fade],[.46,.75,.86,fade],[.72,.91,.97,fade]]);
  polygon(mesh,[p(0,size*1.8),p(0,-size),p(size*.7,0)],[.92,.98,1,fade*.72]);
 }
 const result=[ground,back,iceBack,body,front,iceFront].filter(m=>m.indices.length);
 return complete(result)?result:[];
}
