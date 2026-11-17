// Native acid rain cloud (MFX_Fog_Poison_01) is an area of fog, not a bullet.
// Read only the simulation's position, collider and lifespan. Motion, damage,
// spawning at the camera's top edge and the native 20s lifetime stay host-owned.
const PREFIX = 'host://acid-cloud-v1/';
export const isAcidRainCloud = b => b.owner === 'player'
  && b.weaponId === 200062 && b.modelId === 1000034;

export function withAcidCloudResources(graph) {
  return {...graph, resources: {...graph.resources, [PREFIX + 'material']: {
    type: 'ShaderMaterial', properties: {shader: {$external: PREFIX + 'shader'}}}},
    shaders: {...graph.shaders, [PREFIX + 'shader']: {code: `shader_type canvas_item;
render_mode unshaded, blend_mix;
uniform float cloud_age = 0.0;
uniform float cloud_seed = 0.0;
float acid_hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float acid_noise(vec2 p){
  vec2 cell=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
  return mix(mix(acid_hash(cell),acid_hash(cell+vec2(1.0,0.0)),f.x),mix(acid_hash(cell+vec2(0.0,1.0)),acid_hash(cell+vec2(1.0,1.0)),f.x),f.y);
}
void fragment(){
  vec2 q=UV*2.0-1.0;
  float r=length(q);
  float turn=cloud_age*0.14+cloud_seed;
  vec2 spin=vec2(q.x*cos(turn)-q.y*sin(turn),q.x*sin(turn)+q.y*cos(turn));
  vec2 drift=vec2(cloud_age*0.19,-cloud_age*0.13)+vec2(cloud_seed);
  float broad=acid_noise(spin*3.2+drift);
  float detail=acid_noise(spin*7.0-drift*1.4);
  float fog=broad*0.7+detail*0.3;
  float boundary=1.0-smoothstep(0.63+0.16*broad,0.98,r);
  float hollow=0.65+0.35*smoothstep(0.05,0.58,r);
  float curls=smoothstep(0.37,0.67,fog)*(1.0-smoothstep(0.75,0.95,fog));
  // Small moving bubbles, kept inside the same soft circular footprint.
  vec2 bubbleUV=UV*5.0+vec2(cloud_seed,cloud_age*0.17);
  vec2 cell=floor(bubbleUV),local=fract(bubbleUV)-0.5;
  float seed=acid_hash(cell+vec2(cloud_seed));
  float cycle=fract(cloud_age*0.45+seed);
  float radius=0.055+cycle*0.13;
  float bubbles=(1.0-smoothstep(0.012,0.035,abs(length(local)-radius)))*sin(cycle*3.14159265)*step(0.62,seed);
  float rim=(1.0-smoothstep(0.012,0.055,abs(r-(0.84+0.025*broad))))*(0.2+0.8*detail);
  vec3 fogColor=mix(vec3(0.055,0.2,0.065),vec3(0.37,0.73,0.12),curls);
  vec3 color=mix(fogColor,vec3(0.76,0.98,0.28),clamp(bubbles*0.8+rim*0.35,0.0,1.0));
  float density=(0.17+0.34*curls)*hollow+bubbles*0.32+rim*0.15;
  COLOR=vec4(color,COLOR.a*boundary*clamp(density,0.0,0.65));
}`}}};
}

export function acidCloudScreenMeshes(b, screen) {
  if (!isAcidRainCloud(b) || b.dead || b.visualHidden || !(b.scale > 0)
    || ![b.age,b.lifetime,b.x,b.z,b.radiusX,b.radiusZ].every(Number.isFinite)
    || b.age < 0 || b.age >= b.lifetime || b.radiusX <= 0 || b.radiusZ <= 0) return [];
  const yaw = b.angle ?? 0, dx = Math.sin(yaw), dz = Math.cos(yaw);
  const x = b.x + dx * (b.offsetZ ?? 0) + dz * (b.offsetX ?? 0);
  const z = b.z + dz * (b.offsetZ ?? 0) - dx * (b.offsetX ?? 0);
  const alpha = Math.min(1, .12 + b.age / .12) * Math.min(1, (b.lifetime - b.age) / .65);
  // radiusX/Z already include ScaleAnimMod and all native radius modifiers.
  // The circle is world-aligned and follows the host's slow drift and camera.
  const vertices = [[-1,-1,0,0],[1,-1,1,0],[1,1,1,1],[-1,1,0,1]].map(([sx,sz,u,v]) => {
    const p = screen(x + sx*b.radiusX, z + sz*b.radiusZ);
    return {position: [p.x,p.y], uv: [u,v], color: [1,1,1,alpha]};
  });
  return [{key:'fog',z:-3,material:{$ref:PREFIX+'material'},
    materialUniformOverrides:{cloud_age:b.age,cloud_seed:((Number(b.uid)||0)*.61803398875)%10},
    vertices,indices:[0,1,2,0,2,3]}];
}
