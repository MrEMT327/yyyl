// Presentation for the native ice cyclone and stationary lightning strikes.
// These read live projectile positions, radii and ages; they never own damage,
// movement, random state or lifetime. Persistent support weapons are separate.
const PREFIX = 'host://area-weapon-v1/';
const STRIKES = new Map([[200008,1000048],[400046,1000048],[400047,1000065]]);
const kind = b => b.owner !== 'player' ? null
  : b.weaponId === 200039 && b.modelId === 1000043 ? 'cyclone'
  : STRIKES.get(b.weaponId) === b.modelId && STRIKES.has(b.weaponId) ? 'lightning' : null;
export const isAreaWeaponPresentation = b => kind(b) !== null;
const clamp = (n,lo=0,hi=1) => Math.max(lo,Math.min(hi,n));

export function withAreaWeaponResources(graph) {
  const resources = {...graph.resources}, shaders = {...graph.shaders};
  const add = (name,code) => {
    resources[PREFIX+name] = {type:'ShaderMaterial',properties:{shader:{$external:PREFIX+name+'-shader'}}};
    shaders[PREFIX+name+'-shader'] = {code};
  };
  add('cyclone-ground',`shader_type canvas_item;
render_mode unshaded, blend_add;
uniform float area_age = 0.0;
uniform float area_seed = 0.0;
void fragment(){
  vec2 p=UV*2.0-1.0;
  float r=length(p),a=atan(p.y,p.x);
  float spiral=pow(0.5+0.5*sin(a*4.0+r*15.0-area_age*11.0-area_seed),12.0);
  float gate=smoothstep(0.07,0.28,r)*(1.0-smoothstep(0.72,0.98,r));
  float rim=exp(-abs(r-0.78)*55.0)*(0.3+0.7*pow(0.5+0.5*sin(a*7.0-area_age*6.0),3.0));
  float core=exp(-r*r*16.0)*0.12;
  vec3 color=mix(vec3(0.09,0.36,0.72),vec3(0.5,0.92,1.15),spiral);
  COLOR=vec4(color*COLOR.rgb,COLOR.a*(spiral*gate*0.3+rim*0.22+core));
}`);
  add('cyclone-funnel',`shader_type canvas_item;
render_mode unshaded, blend_add;
uniform float area_age = 0.0;
uniform float area_seed = 0.0;
void fragment(){
  float h=1.0-UV.y;
  float width=0.11+0.72*pow(h,0.68);
  float x=(UV.x*2.0-1.0)/width;
  float edge=1.0-smoothstep(0.72,1.0,abs(x));
  float fade=smoothstep(0.0,0.1,h)*(1.0-smoothstep(0.82,1.0,h));
  float side=cos(clamp(x,-1.0,1.0)*1.5707963);
  float band=pow(0.5+0.5*sin(h*43.0+x*3.4-area_age*13.0+area_seed),15.0);
  float veil=(0.05+0.05*sin(h*27.0+x*7.0-area_age*5.0))*edge;
  float chips=pow(max(0.0,sin(h*72.0-area_age*9.0)*sin(x*36.0+h*14.0+area_age*5.0)),22.0);
  float density=fade*edge*(band*(0.35+0.5*side)+veil+chips*0.8);
  vec3 color=mix(vec3(0.09,0.38,0.78),vec3(0.65,1.1,1.25),band*side+chips*0.4);
  COLOR=vec4(color*COLOR.rgb,COLOR.a*clamp(density,0.0,0.85));
}`);
  add('lightning-ground',`shader_type canvas_item;
render_mode unshaded, blend_add;
uniform float area_age = 0.0;
uniform float area_seed = 0.0;
void fragment(){
  vec2 p=UV*2.0-1.0;
  float r=length(p),a=atan(p.y,p.x);
  float edge=1.0-smoothstep(0.82,1.0,r);
  float flicker=0.65+0.35*sin(area_age*83.0+area_seed);
  float arcR=0.52+0.11*sin(a*7.0+area_seed)+0.05*sin(a*15.0+area_age*12.0);
  float arc=exp(-abs(r-arcR)*62.0)*flicker;
  float spokes=pow(0.5+0.5*sin(a*9.0+r*19.0+area_seed),38.0)*smoothstep(0.13,0.32,r);
  float ring=exp(-abs(r-min(0.92,area_age*3.8))*65.0)*exp(-area_age*5.0);
  float core=exp(-r*r*28.0)*exp(-area_age*8.0);
  float brightness=(arc*0.65+spokes*0.22)*exp(-area_age*3.2)+ring*0.6+core;
  COLOR=vec4(mix(COLOR.rgb,vec3(1.25),core*0.65),COLOR.a*edge*clamp(brightness,0.0,1.0));
}`);
  add('lightning-column',`shader_type canvas_item;
render_mode unshaded, blend_add;
uniform float area_age = 0.0;
uniform float area_seed = 0.0;
float bolt(float y,float seed){
  float cell=floor(y*11.0),f=fract(y*11.0);
  float a=sin(cell*13.17+seed)*0.2,b=sin((cell+1.0)*13.17+seed)*0.2;
  return mix(a,b,f)*sin(y*3.14159265);
}
void fragment(){
  float x=UV.x*2.0-1.0,y=UV.y;
  float path=bolt(y,area_seed);
  float d=abs(x-path);
  float core=exp(-d*150.0),glow=exp(-d*16.0);
  float branchX=path+(1.0-y)*0.7;
  float branch=exp(-abs(x-branchX)*95.0)*smoothstep(0.2,0.45,y)*(1.0-smoothstep(0.7,0.9,y));
  float ends=smoothstep(0.0,0.04,y)*(1.0-smoothstep(0.98,1.0,y));
  float flash=exp(-area_age*11.0)*(0.8+0.2*sin(area_age*81.0));
  COLOR=vec4(mix(COLOR.rgb,vec3(1.4),core*0.85),COLOR.a*ends*flash*clamp(core+glow*0.42+branch*0.55,0.0,1.0));
}`);
  return {...graph,resources,shaders};
}

function mesh(key,corners,material,age,seed,color,z) {
  return {key,z,material:{$ref:PREFIX+material},materialUniformOverrides:{area_age:age,area_seed:seed},
    vertices:corners.map((p,i)=>({position:[p.x,p.y],uv:[[0,0],[1,0],[1,1],[0,1]][i],color:[...color]})),
    indices:[0,1,2,0,2,3]};
}
export function areaWeaponScreenMeshes(b,screen) {
  const type=kind(b);
  if(!type||b.dead||b.visualHidden||!(b.scale>0)
    ||![b.age,b.lifetime,b.x,b.z,b.radiusX,b.radiusZ].every(Number.isFinite)
    ||b.age<0||b.age>=b.lifetime||b.age<(b.warmup??0)||b.radiusX<=0||b.radiusZ<=0)return [];
  const age=b.age-(b.warmup??0),yaw=b.angle??0;
  const dx=Math.sin(yaw),dz=Math.cos(yaw);
  const x=b.x+dx*(b.offsetZ??0)+dz*(b.offsetX??0),z=b.z+dz*(b.offsetZ??0)-dx*(b.offsetX??0);
  const point=(a,c)=>screen(x+a,z+c),center=point(0,0);
  const ground=[point(-b.radiusX,b.radiusZ),point(b.radiusX,b.radiusZ),point(b.radiusX,-b.radiusZ),point(-b.radiusX,-b.radiusZ)];
  const px=point(b.radiusX,0),pz=point(0,b.radiusZ);
  const radiusX=Math.hypot(px.x-center.x,px.y-center.y),radiusZ=Math.hypot(pz.x-center.x,pz.y-center.y);
  if(![...ground.flatMap(p=>[p.x,p.y]),radiusX,radiusZ].every(Number.isFinite))return [];
  const seed=((Number(b.uid)||0)*.61803398875)%10;
  // Ground quads match the live collision radii. Upright columns are atmosphere
  // above that footprint, never a new collision shape. Native radii include scale.
  const alpha=type==='cyclone'?clamp(.1+age/.16)*clamp((b.lifetime-b.age)/.4):clamp((b.lifetime-b.age)/.22);
  const color=type==='lightning'&&b.modelId===1000065?[1.25,.77,.16,alpha]:[.32,.72,1.2,alpha];
  const width=radiusX*(type==='cyclone'?1:0.72),height=Math.max(radiusX,radiusZ)*(type==='cyclone'?2.3:4.0);
  const top=center.y-height,bottom=center.y+radiusZ*.16;
  const upright=[{x:center.x-width,y:top},{x:center.x+width,y:top},{x:center.x+width,y:bottom},{x:center.x-width,y:bottom}];
  return [mesh('ground',ground,type+'-ground',age,seed,color,-2),
    mesh(type==='cyclone'?'funnel':'strike',upright,type==='cyclone'?'cyclone-funnel':'lightning-column',age,seed,color,4)];
}
