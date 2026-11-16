// Authored kinetic silhouettes replace only the view. Collision, motion and
// lifetime remain host-owned; elemental shader TIME stops with simulation.
const PREFIX='host://player-flight-v1/';
// Warm energy bodies share one material. Core, sheath and tapered wake fit
// inside the existing quad; no additional sprite, emitter or full-screen pass.
const GOLD_KINDS={1000000:'regular',1000063:'regular',1000049:'piercing',1000050:'heavy'};
const BODY_PREFIX='host://warm-energy-shots-v2/';
const KINDS={1000064:'piercing',1000023:'electric',1000052:'electric',1000036:'energy'};
export function playerShotMaterialPose(b){
  const body=b.owner==='player'&&!b.beam&&GOLD_KINDS[b.modelId];
  if(body)return {overrides:{Visual:{modulate:[1,1,1,1]},'Visual/Circle':{
    position:[0,0],offset:[0,0],scale:[1.18,1.06],self_modulate:[1,1,1,1],modulate:[1,1,1,1],
    texture:{$external:BODY_PREFIX+body},material:{$ref:BODY_PREFIX+'material'},
  }}};
  const kind=b.owner==='player'&&!b.beam&&KINDS[b.modelId];
  return kind?{overrides:{'Visual/Circle':{self_modulate:[1,1,1,1],material:{$ref:PREFIX+kind}}}}:undefined;
}
export function withPlayerShotMaterials(graph){
  const resources={...graph.resources},shaders={...graph.shaders},textures={...graph.textures};
  for(const [name,width,height] of [['regular',64,136],['piercing',64,224],['heavy',112,160]])
    textures[BODY_PREFIX+name]={width,height,url:'assets/light-volume-shots-v1/'+name+'.png'};
  resources[BODY_PREFIX+'material']={type:'ShaderMaterial',properties:{shader:{$external:BODY_PREFIX+'pulse-shader'}}};
  shaders[BODY_PREFIX+'pulse-shader']={code:`shader_type canvas_item;
render_mode unshaded, blend_add;
varying float shot_alpha;
void vertex(){shot_alpha=COLOR.a;}
void fragment(){
  // The old texture supplies quad dimensions only. Its metallic silhouette and
  // collar must not clip the soft light; retain the real vertex/lifecycle alpha.
  vec2 q=UV*2.0-1.0;
  float head=exp(-pow((UV.y-.29)*4.6,2.0));
  float width=.10+.40*head;
  float core=exp(-pow(q.x/(width*.62+.015),2.0)*2.0);
  float sheath=exp(-pow(q.x/(width+.055),2.0)*1.6);
  float envelope=smoothstep(.02,.15,UV.y)*(1.0-smoothstep(.44,.98,UV.y));
  float warmCore=clamp(core*head,0.0,1.0);
  vec3 light=mix(vec3(1.12,.61,.15),vec3(2.30,2.12,1.72),warmCore);
  COLOR=vec4(light,shot_alpha*sheath*envelope);
}`};
  for(const kind of new Set(Object.values(KINDS))){
    const core=(kind==='energy'||kind==='electric')?'exp(-pow((q.x+sin(q.y*8.0+TIME*10.0)*0.10)*5.5,2.0))':'exp(-q.x*q.x*42.0)';
    const flow='pow(0.5+0.5*sin(q.y*11.0+TIME*9.0),7.0)';
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
  vec3 tint=${kind==='electric'?'vec3(0.46,0.28,1.0)':kind==='energy'?'vec3(0.08,0.30,1.0)':'vec3(1.0,0.64,0.10)'};
  COLOR=vec4(mix(tint,vec3(1.0),core*0.85)*value,COLOR.a);
}`};
  }
  return {...graph,resources,shaders,textures};
}
