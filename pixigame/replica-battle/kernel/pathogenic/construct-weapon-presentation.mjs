// Persistent support constructs are not ordinary bullets. Source visual sizes:
// effects-original-chapters 419001: Glow_di 17.5 * matrix .2 = 3.5 diameter;
// Dianhu_quan 22 * .2 = 4.4 diameter. Model 419005 prism: ZiDan_Dark body
// startSize X=1.6,Y=1.3; halo X=2.4,Y=4. Native core collider radius is zero;
// these source-derived dimensions are presentation only, not attack ranges.
const PREFIX='host://construct-weapon-v1/';
const typeOf=b=>b.owner!=='player'?null:b.weaponId===360012&&b.modelId===419001?'core'
  :b.weaponId===360016&&b.modelId===419005?'prism':null;
export const isConstructWeapon=b=>typeOf(b)!==null;
const clamp=n=>Math.max(0,Math.min(1,n));
export function withConstructWeaponResources(graph){
  const resources={...graph.resources},shaders={...graph.shaders};
  const add=(name,code)=>{
    resources[PREFIX+name]={type:'ShaderMaterial',properties:{shader:{$external:PREFIX+name+'-shader'}}};
    shaders[PREFIX+name+'-shader']={code};
  };
  add('core',`shader_type canvas_item;
render_mode unshaded, blend_add;
uniform float construct_age = 0.0;
uniform float construct_seed = 0.0;
void fragment(){
  vec2 q=UV*2.0-1.0;
  float r=length(q),a=atan(q.y,q.x);
  float innerR=0.62+0.025*sin(a*7.0+construct_age*9.0+construct_seed);
  float outerR=0.79+0.025*sin(a*11.0-construct_age*11.0);
  float inner=exp(-abs(r-innerR)*95.0),outer=exp(-abs(r-outerR)*75.0);
  float spin=pow(0.5+0.5*sin(a*3.0-construct_age*3.0),5.0);
  float rim=(inner+outer*0.65)*(0.35+0.65*spin);
  float gap=exp(-abs(r-0.71)*23.0)*0.12;
  float wave=0.5+0.5*sin(a*6.0+r*8.0+construct_age*5.0+construct_seed);
  float spokes=pow(wave,35.0)*smoothstep(0.43,0.59,r)*(1.0-smoothstep(0.78,0.9,r));
  float core=exp(-r*r*15.0)*(0.25+0.06*sin(construct_age*4.0));
  float bound=1.0-smoothstep(0.9,1.0,r);
  vec3 color=mix(vec3(0.06,0.35,0.9),vec3(0.6,1.12,1.4),clamp(rim+spokes,0.0,1.0));
  COLOR=vec4(color,COLOR.a*bound*clamp(rim+gap+spokes*0.7+core,0.0,0.95));
}`);
  add('halo',`shader_type canvas_item;
render_mode unshaded, blend_add;
uniform float construct_age = 0.0;
void fragment(){
  vec2 p=UV*2.0-1.0;
  float glow=exp(-dot(p,p)*5.5)*(1.0-smoothstep(0.72,1.0,length(p)));
  float wave=0.82+0.18*sin(construct_age*2.7);
  COLOR=vec4(COLOR.rgb,COLOR.a*glow*wave*0.2);
}`);
  add('facet',`shader_type canvas_item;
render_mode unshaded, blend_mix;
uniform float construct_age = 0.0;
void fragment(){
  float distance=fract(UV.y*0.5-construct_age*0.2)-0.5;
  float band=exp(-distance*distance*180.0);
  COLOR=vec4(COLOR.rgb+vec3(0.08,0.12,0.15)*band,COLOR.a);
}`);
  add('edge',`shader_type canvas_item;
render_mode unshaded, blend_add;
uniform float construct_age = 0.0;
void fragment(){
  float distance=UV.y*2.0-1.0;
  float core=exp(-distance*distance*16.0);
  float flow=0.65+0.35*pow(0.5+0.5*sin(UV.x*12.0-construct_age*4.0),3.0);
  COLOR=vec4(COLOR.rgb,COLOR.a*core*flow);
}`);
  return {...graph,resources,shaders};
}
const vertex=(p,uv,color)=>({position:[p.x,p.y],uv,color});
function quad(key,point,rx,rz,material,alpha,age,seed,color=[1,1,1]){
  return{key,z:material==='core'?3:1,material:{$ref:PREFIX+material},
    materialUniformOverrides:{construct_age:age,construct_seed:seed},
    vertices:[[-1,1,0,0],[1,1,1,0],[1,-1,1,1],[-1,-1,0,1]].map(([x,z,u,v])=>vertex(point(x*rx,z*rz),[u,v],[...color,alpha])),indices:[0,1,2,0,2,3]};
}
export function constructWeaponScreenMeshes(b,screen){
  const type=typeOf(b);
  if(!type||b.dead||b.visualHidden||![b.age,b.lifetime,b.x,b.z,b.scale].every(Number.isFinite)
    ||b.age<0||b.age>=b.lifetime||b.age<(b.warmup??0)||b.scale<=0)return [];
  const age=b.age-(b.warmup??0),yaw=b.angle??0,dx=Math.sin(yaw),dz=Math.cos(yaw);
  const x=b.x+dx*(b.offsetZ??0)+dz*(b.offsetX??0),z=b.z+dz*(b.offsetZ??0)-dx*(b.offsetX??0);
  const point=(across,forward)=>screen(x+dz*across+dx*forward,z-dx*across+dz*forward);
  const center=point(0,0);if(![center.x,center.y].every(Number.isFinite))return [];
  const alpha=clamp(.1+age/.15)*clamp((b.lifetime-b.age)/.35),seed=((Number(b.uid)||0)*.61803398875)%10;
  // Active collision radii are already scaled. A construct with no damage
  // collider still has visible art, so only its presentation falls back to the
  // source prefab's size. collisionDisabled is not a visual-hidden flag.
  if(type==='core'){
    const radius=Number.isFinite(b.radiusX)&&b.radiusX>0?b.radiusX:2.2*b.scale;
    return[quad('electromagnetic-ring',point,radius,radius,'core',alpha,age,seed)];
  }
  const radius=Number.isFinite(b.radiusX)&&b.radiusX>0?b.radiusX:.8*b.scale;
  const ratio=radius/.8;
  const meshes=[quad('prism-glow',point,1.2*ratio,2*ratio,'halo',alpha,age,seed,[.14,.45,1.1])];
  // The source sprite is a three-faced triangular prism, not a round pellet.
  const top=[0,.65*ratio],left=[-.8*ratio,-.65*ratio],right=[.8*ratio,-.65*ratio],middle=[0,-.1*ratio];
  const positions=[top,left,middle,top,middle,right,left,right,middle];
  // Rotate only the visible facets and edges; the construct and ray origins stay fixed.
  const spin=age*1.5,c=Math.cos(spin),s=Math.sin(spin);
  const prismPoint=(across,forward)=>point(across*c-forward*s,across*s+forward*c);
  const colors=[[.35,.89,1.05],[.065,.28,.8],[.09,.63,.8]];
  meshes.push({key:'prism-body',z:3,material:{$ref:PREFIX+'facet'},materialUniformOverrides:{construct_age:age},
    vertices:positions.map((p,i)=>vertex(prismPoint(...p),[(p[0]/radius+1)/2,(p[1]/(.65*ratio)+1)/2],[...colors[Math.floor(i/3)],alpha*.96])),indices:[0,1,2,3,4,5,6,7,8]});
  const vertices=[],indices=[];
  for(const[a,bp]of [[top,left],[left,right],[right,top],[top,middle],[left,middle],[right,middle]]){
    const vx=bp[0]-a[0],vz=bp[1]-a[1],length=Math.hypot(vx,vz),nx=-vz/length*.018*ratio,nz=vx/length*.018*ratio;
    const start=vertices.length;
    for(const[p,u,v]of [[[a[0]-nx,a[1]-nz],0,0],[[bp[0]-nx,bp[1]-nz],1,0],[[bp[0]+nx,bp[1]+nz],1,1],[[a[0]+nx,a[1]+nz],0,1]]){
      vertices.push(vertex(prismPoint(...p),[u,v],[.68,1.15,1.35,alpha*.8]));
    }
    indices.push(start,start+1,start+2,start,start+2,start+3);
  }
  meshes.push({key:'prism-edges',z:4,material:{$ref:PREFIX+'edge'},materialUniformOverrides:{construct_age:age},vertices,indices});
  return meshes;
}
