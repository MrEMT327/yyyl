// Authored kinetic silhouettes replace only the view. Collision, motion and
// lifetime remain host-owned; elemental shader TIME stops with simulation.
const PREFIX='host://player-flight-v1/';
// Original compact bodies share one material; no animated scanline or trail.
const GOLD_KINDS={1000000:'regular',1000063:'regular',1000049:'piercing',1000050:'heavy'};
const BODY_PREFIX='host://light-volume-shots-v1/';
const KINDS={1000064:'piercing',1000023:'electric',1000052:'electric',1000036:'energy'};
export function playerShotMaterialPose(b){
  const body=b.owner==='player'&&!b.beam&&GOLD_KINDS[b.modelId];
  if(body)return {overrides:{Visual:{modulate:[1,1,1,1]},'Visual/Circle':{
    position:[0,0],offset:[0,0],scale:[.65,.65],self_modulate:[1,1,1,1],modulate:[1,1,1,1],
    texture:{$external:BODY_PREFIX+body},material:{$ref:BODY_PREFIX+'material'},
  }}};
  const kind=b.owner==='player'&&!b.beam&&KINDS[b.modelId];
  return kind?{overrides:{'Visual/Circle':{self_modulate:[1,1,1,1],material:{$ref:PREFIX+kind}}}}:undefined;
}
export function withPlayerShotMaterials(graph){
  const resources={...graph.resources},shaders={...graph.shaders},textures={...graph.textures};
  for(const [name,width,height] of [['regular',64,136],['piercing',64,224],['heavy',112,160]])
    textures[BODY_PREFIX+name]={width,height,url:'assets/light-volume-shots-v1/'+name+'.png'};
  resources[BODY_PREFIX+'material']={type:'ShaderMaterial',properties:{shader:{$external:BODY_PREFIX+'brass-shader'}}};
  shaders[BODY_PREFIX+'brass-shader']={code:`shader_type canvas_item;
render_mode unshaded, blend_mix;
void fragment(){
  // Preserve the authored compact silhouette; light comes from a narrow bevel.
  vec2 q=UV*2.0-1.0;
  float face=sqrt(max(0.0,1.0-q.x*q.x));
  float bevel=exp(-pow((q.x+0.32)*8.0,2.0));
  float head=1.0-smoothstep(0.10,0.32,UV.y);
  float collar=exp(-abs(UV.y-0.66)*100.0);
  float heel=smoothstep(0.80,0.96,UV.y);
  vec3 brass=mix(vec3(0.40,0.21,0.065),vec3(1.02,0.73,0.28),face);
  brass=mix(brass,vec3(1.10,0.88,0.48),head*0.48);
  brass*=1.0-collar*0.32-heel*0.20;
  brass+=vec3(0.25,0.24,0.16)*bevel*(0.75+head*0.25);
  COLOR=vec4(brass,COLOR.a);
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
