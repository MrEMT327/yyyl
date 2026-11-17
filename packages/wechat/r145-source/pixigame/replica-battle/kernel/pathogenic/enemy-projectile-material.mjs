// A light spine for the existing shard texture; source alpha owns the complete
// silhouette. No geometry, scale, simulation time or collision is changed.
const PREFIX='host://layered-enemy-shot-v1/';
const SHARDS=new Set([1100007,1100008,1100018]);
export function enemyProjectileMaterialPose(b){
  if(b.owner!=='enemy'||b.beam||!SHARDS.has(b.modelId))return {};
  return {overrides:{'Visual/Circle':{material:{$ref:PREFIX+'shard'}}}};
}
export function withEnemyProjectileMaterialResources(graph){
  return {...graph,resources:{...graph.resources,[PREFIX+'shard']:{type:'ShaderMaterial',properties:{shader:{$external:PREFIX+'shard-shader'}}}},
    shaders:{...graph.shaders,[PREFIX+'shard-shader']:{code:`shader_type canvas_item;
render_mode unshaded;
void fragment(){
  vec2 q=UV*2.0-1.0;
  float spine=exp(-pow((q.x+q.y*0.12)*7.0,2.0));
  float ends=smoothstep(-0.85,-0.42,q.y)*(1.0-smoothstep(0.42,0.90,q.y));
  float core=spine*ends;
  float shoulder=exp(-pow((q.x+0.14)*2.8,2.0))*ends;
  vec3 color=mix(vec3(0.24,0.008,0.025),vec3(1.0,0.12,0.18),shoulder);
  color=mix(color,vec3(1.0,0.97,0.89),core);
  COLOR=vec4(color,COLOR.a);
}`}}};
}
