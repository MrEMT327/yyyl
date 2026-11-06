const ROOT='host://sword-wave-v1/';
export const isSwordWave=b=>b.owner==='player'&&b.familyId===200101&&[200102,200103].includes(b.weaponId)&&b.modelId===1000040;
export function withSwordWaveResources(graph){
  return {...graph,resources:{...graph.resources,[ROOT+'edge']:{type:'ShaderMaterial',properties:{shader:{$external:ROOT+'shader'}}}},
    shaders:{...graph.shaders,[ROOT+'shader']:{code:`shader_type canvas_item;
render_mode unshaded, blend_add;
uniform float wave_wake = 0.0;
void fragment(){
  float taper=pow(max(0.0,sin(UV.x*3.14159265)),0.48);
  float d=abs(UV.y-0.5);
  float core=exp(-d*d*680.0), body=exp(-d*d*45.0), glow=exp(-d*d*9.0)*0.10;
  vec3 light=mix(vec3(0.10,0.50,1.25),vec3(1.30,1.55,1.75),core);
  float alpha=mix(core*0.95+body*0.62+glow,exp(-d*d*5.0)*0.12,wave_wake);
  COLOR=vec4(light,COLOR.a*taper*alpha);
}`}}};
}
export function swordWaveScreenMeshes(b,screen){
  if(!isSwordWave(b)||b.dead||b.visualHidden||![b.x,b.z,b.age,b.lifetime,b.radiusX,b.radiusZ].every(Number.isFinite)||
    b.age<0||b.age>=b.lifetime||b.radiusX<=0||b.radiusZ<=0)return [];
  const yaw=b.visualAngle??(Math.hypot(b.vx??0,b.vz??0)>.001?Math.atan2(b.vx,b.vz):b.angle??0);
  const ox=b.offsetX??0,oz=b.offsetZ??0;if(![yaw,ox,oz].every(Number.isFinite))return [];
  const c=Math.cos(yaw),s=Math.sin(yaw),x=b.x+c*ox+s*oz,z=b.z-s*ox+c*oz;
  const alpha=Math.min(1,.65+b.age/.04)*Math.min(1,(b.lifetime-b.age)/.10);
  const point=(across,ahead)=>screen(x+c*across+s*ahead,z-s*across+c*ahead);
  const make=(wake)=>{
    const vertices=[],indices=[],steps=28;
    for(let i=0;i<=steps;i++){
      const u=i/steps,t=u*2-1,round=Math.sqrt(Math.max(0,1-t*t));
      const ahead=b.radiusZ*(.60*(1-t*t)-.24)-(wake?b.radiusZ*.28:0);
      const thickness=b.radiusZ*(wake?.34:.13)*round;
      for(const v of [0,1]){const p=point(t*b.radiusX*.82,ahead+(v-.5)*thickness*2);
        vertices.push({position:[p.x,p.y],uv:[u,v],color:[1,1,1,alpha]});}
      if(i){const n=i*2;indices.push(n-2,n-1,n,n,n-1,n+1);}
    }
    return {key:wake?'wake':'edge',material:{$ref:ROOT+'edge'},materialUniformOverrides:{wave_wake:wake?1:0},z:wake?0:1,vertices,indices};
  };
  return [make(true),make(false)];
}
