// Dark Blade's native radiation pulse is a circular clearing wave. Read the
// host's expanding collider directly; never animate or resize its damage area.
const PREFIX = 'host://aircraft-radiation-pulse-v1/';
export const isAircraftPulse = b => b.owner === 'player'
  && (b.weaponId === 400017 || b.weaponId === 400018) && b.modelId === 1200005;

export function withAircraftPulseResources(graph) {
  return {...graph, resources: {...graph.resources, [PREFIX + 'material']: {
    type: 'ShaderMaterial', properties: {shader: {$external: PREFIX + 'shader'}}}},
    shaders: {...graph.shaders, [PREFIX + 'shader']: {code: `shader_type canvas_item;
render_mode unshaded, blend_mix;
uniform float pulse_age = 0.0;
void fragment(){
  vec2 q=UV*2.0-1.0;
  float r=length(q);
  float angle=atan(q.y,q.x);
  float outer=1.0-smoothstep(0.008,0.026,abs(r-0.955));
  float inner=1.0-smoothstep(0.006,0.022,abs(r-0.77));
  float wake=exp(-abs(r-0.91)*28.0)*(1.0-smoothstep(0.94,1.0,r));
  float flow=0.55+0.45*pow(0.5+0.5*sin(angle*14.0-pulse_age*23.0),3.0);
  float traces=(1.0-smoothstep(0.02,0.06,abs(r-0.58)))*flow;
  float boundary=1.0-smoothstep(0.98,1.0,r);
  // A clear center and restrained alpha keep enemies and hostile shots legible.
  float alpha=clamp(outer*0.58+inner*0.22+wake*0.12+traces*0.09,0.0,0.62)*boundary;
  vec3 color=mix(vec3(0.12,0.72,0.28),vec3(0.76,1.0,0.63),outer);
  COLOR=vec4(color,COLOR.a*alpha);
}`}}};
}

export function aircraftPulseScreenMeshes(b, screen) {
  if (!isAircraftPulse(b) || b.dead || b.visualHidden || !(b.scale > 0)
    || ![b.age,b.lifetime,b.x,b.z,b.radiusX,b.radiusZ].every(Number.isFinite)
    || b.age < 0 || b.age >= b.lifetime || b.radiusX <= 0 || b.radiusZ <= 0) return [];
  const angle = b.angle ?? 0, dx = Math.sin(angle), dz = Math.cos(angle);
  const x = b.x + dx * (b.offsetZ ?? 0) + dz * (b.offsetX ?? 0);
  const z = b.z + dz * (b.offsetZ ?? 0) - dx * (b.offsetX ?? 0);
  const phase = b.age / b.lifetime;
  const alpha = Math.min(1,.12+phase/.1) * Math.min(1,(1-phase)/.28);
  // NativeColliderScale has already applied the true 1 -> 50 growth to these
  // radii. A single projected quad carries all rings without object history.
  const vertices = [[-1,-1,0,0],[1,-1,1,0],[1,1,1,1],[-1,1,0,1]].map(([sx,sz,u,v]) => {
    const across=sx*b.radiusX, along=sz*b.radiusZ;
    const p=screen(x+dz*across+dx*along,z-dx*across+dz*along);
    return {position:[p.x,p.y],uv:[u,v],color:[1,1,1,alpha]};
  });
  return [{key:'radiation-wave',z:1,material:{$ref:PREFIX+'material'},
    materialUniformOverrides:{pulse_age:b.age},vertices,indices:[0,1,2,0,2,3]}];
}
