// Authored game visuals. Original client resources inform the circular field,
// emitter layers and element identity; no competitor texture is used here.
const PREFIX='host://energy-fields-v1/';
const MODELS=new Set([200249,1000036,1000054]);
export const isEnergyFieldProjectile=b=>MODELS.has(b.modelId)&&(b.modelId===1000054?b.owner==='enemy':b.owner==='player');
const shaders={
 shield:`shader_type canvas_item;
render_mode unshaded, blend_add;
uniform float field_age=0.0;
uniform float field_seed=0.0;
void fragment(){
 vec2 p=UV*2.0-1.0;float r=length(p),a=atan(p.y,p.x),t=field_age;
 float radius=0.79;
 float rim=exp(-abs(r-radius)*100.0);
 float halo=exp(-abs(r-radius)*27.0)*0.16;
 float jag=radius+0.012*sin(a*11.0+t*13.0+field_seed)+0.009*sin(a*23.0-t*17.0);
 float lane=pow(0.5+0.5*sin(a*3.0-t*2.4+field_seed),8.0);
 float electric=exp(-abs(r-jag)*145.0)*lane;
 float inner=exp(-abs(r-(radius-0.085))*90.0)*0.12;
 float sparks=pow(0.5+0.5*cos(a*12.0-t*5.0),48.0)*exp(-abs(r-radius)*42.0);
 float center=(1.0-smoothstep(0.45,0.78,r))*0.012;
 float amount=rim*0.35+halo+electric*0.75+inner+sparks*0.38+center;
 vec3 color=mix(vec3(0.16,0.42,0.46),vec3(0.60,0.94,0.96),clamp(rim*0.4+electric+sparks,0.0,1.0));
 float rimEmission=clamp(rim*.65+electric*.45+sparks*.60,0.0,1.0);
 color+=vec3(.45,1.80,2.10)*rimEmission;
 COLOR=vec4(color*COLOR.rgb,COLOR.a*clamp(amount*0.84,0.0,0.78));
}`,
 plasma:`shader_type canvas_item;
render_mode unshaded, blend_add;
uniform float field_age=0.0;
uniform float field_seed=0.0;
void fragment(){
 vec2 p=UV*2.0-1.0;float r=length(p),a=atan(p.y,p.x),t=field_age;
 float core=exp(-dot(p,p)*10.0);
 float shell=exp(-abs(r-0.52)*24.0);
 float arc=exp(-abs(r-(0.62+0.055*sin(a*7.0+t*15.0+field_seed)))*70.0);
 float scan=pow(0.5+0.5*sin(a*4.0-t*8.0),5.0);
 float halo=exp(-dot(p,p)*3.3)*0.12;
 float amount=core*0.75+shell*0.32+arc*scan*0.75+halo;
 vec3 color=mix(vec3(0.045,0.18,0.95),vec3(0.50,0.70,1.25),clamp(core+arc*scan,0.0,1.0));
 COLOR=vec4(color*COLOR.rgb,COLOR.a*clamp(amount,0.0,0.95)*(1.0-smoothstep(0.83,1.0,r)));
}`,
 fire:`shader_type canvas_item;
render_mode unshaded, blend_add;
uniform float field_age=0.0;
uniform float field_seed=0.0;
void fragment(){
 vec2 p=UV*2.0-1.0;float t=field_age;
 float swirl=0.06*sin(p.x*9.0+p.y*7.0-t*5.0+field_seed)+0.035*sin(p.y*17.0+t*7.0);
 float r=length(p)+swirl;
 float body=1.0-smoothstep(0.48,0.90,r);
 float core=exp(-dot(p,p)*5.0);
 float folds=0.5+0.5*sin(p.x*13.0+p.y*8.0-t*6.0+field_seed);
 float rim=exp(-abs(r-0.72)*24.0);
 float hot=clamp(core*0.72+folds*body*0.34,0.0,1.0);
 vec3 color=mix(vec3(0.88,0.055,0.015),vec3(1.32,0.64,0.13),hot);
 float amount=body*(0.72+folds*0.18)+rim*0.18;
 COLOR=vec4(color*COLOR.rgb,COLOR.a*clamp(amount,0.0,0.92));
}`,
};
export function withEnergyFieldResources(graph){
 const resources={...graph.resources},programs={...graph.shaders};
 for(const [name,code]of Object.entries(shaders)){
  resources[PREFIX+name]={type:'ShaderMaterial',properties:{shader:{$external:PREFIX+name+'-shader'}}};
  programs[PREFIX+name+'-shader']={code};
 }
 return {...graph,resources,shaders:programs};
}
export function energyFieldProjectileMeshes(b,screen){
 if(!isEnergyFieldProjectile(b)||b.dead||b.visualHidden
  ||![b.age,b.x,b.z,b.scale].every(Number.isFinite)||b.age<0||b.scale<=0
  ||!(b.lifetime>0)||b.age>=b.lifetime||b.age<(b.warmup??0))return [];
 const age=b.age-(b.warmup??0),type=b.modelId===200249?'shield':b.modelId===1000036?'plasma':'fire';
 const fallback=type==='shield'?2.1:type==='plasma'?.48:2.4;
 // Collider radii already contain the native scale. Never multiply them again.
 const rx=Number.isFinite(b.radiusX)&&b.radiusX>0?b.radiusX:fallback*b.scale;
 const rz=Number.isFinite(b.radiusZ)&&b.radiusZ>0?b.radiusZ:fallback*b.scale;
 const extent=type==='shield'?1.08:type==='plasma'?1.24:1.07;
 const angle=type==='shield'?0:(b.visualAngle??b.angle??0),dx=Math.sin(angle),dz=Math.cos(angle);
 const x=b.x+dz*(b.offsetX??0)+dx*(b.offsetZ??0),z=b.z-dx*(b.offsetX??0)+dz*(b.offsetZ??0);
 if(![angle,x,z].every(Number.isFinite))return [];
 const fade=Math.min(1,.15+age/.13)*(Number.isFinite(b.lifetime)?Math.min(1,(b.lifetime-b.age)/.18):1);
 const vertices=[[-1,1,0,0],[1,1,1,0],[1,-1,1,1],[-1,-1,0,1]].map(([sx,sz,u,v])=>{
  const across=sx*rx*extent,forward=sz*rz*extent,p=screen(x+dz*across+dx*forward,z-dx*across+dz*forward);
  return {position:[p.x,p.y],uv:[u,v],color:[1,1,1,fade]};
 });
 if(vertices.some(v=>!v.position.every(Number.isFinite)))return [];
 return [{key:'energy-'+type,z:type==='fire'?0:2,material:{$ref:PREFIX+type},materialUniformOverrides:{field_age:age,field_seed:((Number(b.uid)||0)*.61803398875)%10},vertices,indices:[0,1,2,0,2,3]}];
}
