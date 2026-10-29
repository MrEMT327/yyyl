// Presentation only: status snapshots have age/duration/remaining and position,
// but no actor dimensions or protective collision radius. The extents below are
// decorative source-prefab sizes, never gameplay shield or damage boundaries.
const PREFIX='host://corrected-status-v1/';
const MODELS=new Set([210031,170013,210021,160006]);
export const isCorrectedStatus=b=>MODELS.has(b.modelId);

export function withCorrectedStatusResources(graph){
  const resources={...graph.resources},shaders={...graph.shaders};
  const add=(name,code)=>{
    resources[PREFIX+name]={type:'ShaderMaterial',properties:{shader:{$external:PREFIX+name+'-shader'}}};
    shaders[PREFIX+name+'-shader']={code};
  };
  add('shield',`shader_type canvas_item;
render_mode unshaded, blend_mix;
uniform float status_age = 0.0;
void fragment(){
  vec2 q=UV*2.0-1.0;
  float r=length(q),a=atan(q.y,q.x);
  float rim=1.0-smoothstep(0.009,0.035,abs(r-0.88));
  float glow=exp(-abs(r-0.86)*22.0);
  float stream=pow(0.5+0.5*cos(a*3.0-status_age*2.2),10.0);
  float inner=(1.0-smoothstep(0.006,0.016,abs(r-0.72)))*stream;
  float film=smoothstep(0.3,0.9,r)*0.025;
  float alpha=clamp(rim*0.62+glow*0.12+inner*0.24+film,0.0,0.72)*(1.0-smoothstep(0.94,1.0,r));
  vec3 light=mix(COLOR.rgb,vec3(0.91,0.98,1.0),rim*(0.2+0.5*stream));
  COLOR=vec4(light,COLOR.a*alpha);
}`);
  add('rage',`shader_type canvas_item;
render_mode unshaded, blend_mix;
uniform float status_age = 0.0;
void fragment(){
  vec2 q=UV*2.0-1.0;
  float r=length(q),a=atan(q.y,q.x);
  float tendril=0.66+0.075*sin(a*7.0-status_age*11.0)+0.025*sin(a*17.0+status_age*16.0);
  float energy=exp(-abs(r-tendril)*43.0);
  float flicker=0.5+0.5*pow(0.5+0.5*sin(a*11.0-status_age*7.0),2.0);
  float shards=(1.0-smoothstep(0.012,0.04,abs(r-(0.78+0.09*sin(a*9.0+status_age*8.0)))))*pow(0.5+0.5*cos(a*13.0-status_age*5.0),14.0);
  float glow=exp(-abs(r-tendril)*10.0)*0.09;
  float alpha=clamp(energy*flicker*0.65+shards*0.65+glow,0.0,0.74)*(1.0-smoothstep(0.93,1.0,r));
  vec3 light=mix(vec3(0.82,0.08,0.04),vec3(1.0,0.62,0.22),energy*0.72+shards*0.28);
  COLOR=vec4(light,COLOR.a*alpha);
}`);
  add('armor-break',`shader_type canvas_item;
render_mode unshaded, blend_mix;
uniform float status_age = 0.0;
float status_segment(vec2 p,vec2 a,vec2 b){vec2 v=b-a;return length(p-a-v*clamp(dot(p-a,v)/dot(v,v),0.0,1.0));}
void fragment(){
  vec2 q=UV*2.0-1.0;
  float separation=0.055+0.016*sin(status_age*4.0);
  vec2 left=q+vec2(separation,0.0),right=q-vec2(separation,0.0);
  float outline=min(status_segment(left,vec2(-0.55,-0.48),vec2(-0.55,0.18)),status_segment(left,vec2(-0.55,0.18),vec2(-0.13,0.65)));
  outline=min(outline,status_segment(left,vec2(-0.55,-0.48),vec2(-0.12,-0.62)));
  outline=min(outline,status_segment(right,vec2(0.12,-0.62),vec2(0.55,-0.48)));
  outline=min(outline,status_segment(right,vec2(0.55,-0.48),vec2(0.55,0.18)));
  outline=min(outline,status_segment(right,vec2(0.55,0.18),vec2(0.13,0.65)));
  float crack=min(status_segment(q,vec2(0.02,-0.55),vec2(-0.16,-0.12)),status_segment(q,vec2(-0.16,-0.12),vec2(0.16,0.02)));
  crack=min(crack,status_segment(q,vec2(0.16,0.02),vec2(-0.04,0.5)));
  float fragments=min(status_segment(q,vec2(-0.82,-0.08),vec2(-0.7,0.12)),status_segment(q,vec2(0.76,-0.24),vec2(0.86,-0.02)));
  float edge=1.0-smoothstep(0.016,0.045,outline);
  float fracture=1.0-smoothstep(0.009,0.029,crack);
  float chips=1.0-smoothstep(0.01,0.035,fragments);
  vec3 color=mix(vec3(1.0,0.52,0.2),vec3(1.0,0.91,0.66),fracture);
  COLOR=vec4(color,COLOR.a*clamp(edge*0.78+fracture*0.9+chips*0.68,0.0,0.9));
}`);
  return {...graph,resources,shaders};
}

export function correctedStatusScreenMeshes(buff,screen){
  if(!isCorrectedStatus(buff)||buff.dead||buff.visualHidden
    ||![buff.age,buff.x,buff.z].every(Number.isFinite)||buff.age<0)return [];
  const duration=buff.duration??(Number.isFinite(buff.remaining)?buff.age+buff.remaining:buff.remaining);
  const remaining=buff.remaining??(Number.isFinite(duration)?duration-buff.age:duration);
  if(!(duration>0)||!(remaining>0)||(Number.isFinite(duration)&&buff.age>=duration))return [];
  const fade=Math.min(1,.15+buff.age/.12)*Math.min(1,remaining/.18);
  let radius,material,color;
  if(buff.modelId===210021||buff.modelId===160006){
    // Original FX_Buff_HuDun/LiZi perimeter: ShapeModule.radius=.67, matrix
    // scale 3 (Stg_Buff_HuDun_Blue) or 4 (ShieldYellowSkill). Visual units only.
    radius=.67*(buff.modelId===210021?3:4);material='shield';
    color=buff.modelId===210021?[.15,.62,1]:[1,.76,.12];
  }else if(buff.modelId===210031){
    // stg_Rage_Red/.../07 has sphere emission radius 1 and matrix scale 2.5.
    radius=2.5;material='rage';color=[1,1,1];
  }else{
    // MFX_PoJiaDeBuff_001 sprites: startSize 1, matrix scale 2.5 => half 1.25.
    radius=1.25;material='armor-break';color=[1,1,1];
  }
  const vertices=[[-1,-1,0,1],[1,-1,1,1],[1,1,1,0],[-1,1,0,0]].map(([sx,sz,u,v])=>{
    const p=screen(buff.x+sx*radius,buff.z+sz*radius);
    return {position:[p.x,p.y],uv:[u,v],color:[...color,fade]};
  });
  return [{key:material,z:2,material:{$ref:PREFIX+material},
    materialUniformOverrides:{status_age:buff.age},vertices,indices:[0,1,2,0,2,3]}];
}
