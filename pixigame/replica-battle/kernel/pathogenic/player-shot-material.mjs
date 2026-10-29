// Preserve the original sprite alpha, geometry and lifetime. Only the fill is
// shaded; simulation TIME is supplied by PathogenicSceneView and stops on pause.
const PREFIX='host://player-flight-v1/';
// Basic and side shots keep their earlier source-scene material.
const KINDS={1000049:'piercing',1000050:'cannon',1000064:'piercing',1000023:'energy',1000052:'energy',1000036:'energy'};
export function playerShotMaterialPose(b){
  const kind=b.owner==='player'&&!b.beam&&KINDS[b.modelId];
  return kind?{overrides:{'Visual/Circle':{self_modulate:[1,1,1,1],material:{$ref:PREFIX+kind}}}}:undefined;
}
export function withPlayerShotMaterials(graph){
  const resources={...graph.resources},shaders={...graph.shaders};
  for(const kind of new Set(Object.values(KINDS))){
    const core=kind==='cannon'?'exp(-dot(q,q)*5.0)':kind==='energy'?'exp(-pow((q.x+sin(q.y*8.0+TIME*10.0)*0.10)*5.5,2.0))':`exp(-q.x*q.x*${kind==='piercing'?'42.0':'22.0'})`;
    const flow=kind==='cannon'?'pow(0.5+0.5*sin(length(q)*17.0-TIME*7.0),5.0)':'pow(0.5+0.5*sin(q.y*11.0+TIME*9.0),7.0)';
    resources[PREFIX+kind]={type:'ShaderMaterial',properties:{shader:{$external:PREFIX+kind+'-shader'}}};
    shaders[PREFIX+kind+'-shader']={code:`shader_type canvas_item;
render_mode unshaded, blend_mix;
void fragment(){
  vec2 q=UV*2.0-1.0;
  float core=${core};
  float flow=${flow};
  float shoulder=exp(-q.x*q.x*3.0);
  float value=0.22+0.30*shoulder+0.48*core+0.12*flow*shoulder;
  // The faction/element palette still owns the final hue. A neutral bright
  // center and darker shoulder remain readable over both sea and snow maps.
  vec3 tint=${kind==='energy'?'vec3(0.16,0.65,1.0)':'vec3(1.0,0.64,0.10)'};
  COLOR=vec4(mix(tint,vec3(1.0),core*0.85)*value,COLOR.a);
}`};
  }
  return {...graph,resources,shaders};
}
