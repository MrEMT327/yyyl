// A scene-local replacement for the orb's baked lime ring. The original
// animation still owns growth, opacity and exit; host physics is untouched.
const PREFIX = 'host://acid-vortex-v1/';

export const isAcidVortex = b => b.owner === 'player' && b.familyId === 200091
  && [1000029, 1000030].includes(b.modelId);

export function acidVortexPresentation() {
  return {scale: .28, retireImmediately: false, pose: {overrides: {
    'Visual/Circle': {material: {$ref: PREFIX + 'material'}, offset: [0, 0]},
  }}};
}

export function withAcidVortexResources(graph) {
  return {...graph, resources: {...graph.resources, [PREFIX + 'material']: {
    id: PREFIX + 'material', type: 'ShaderMaterial',
    properties: {shader: {$external: PREFIX + 'shader'}},
  }}, shaders: {...graph.shaders, [PREFIX + 'shader']: {code: `shader_type canvas_item;
render_mode unshaded, blend_mix;
varying float vortex_alpha;
void vertex(){vortex_alpha=COLOR.a;}
void fragment(){
  vec2 q=UV*2.0-1.0;
  float r=length(q);
  float a=atan(q.y,q.x);
  float t=TIME;
  float edge=1.0-smoothstep(0.84,0.97,r);
  float band=smoothstep(0.22,0.39,r)*(1.0-smoothstep(0.72,0.91,r));
  float flow=0.5+0.5*cos(a*3.0+r*15.0-t*2.4);
  float strands=pow(flow,28.0)*band;
  float haze=pow(flow,5.0)*band;
  float innerRadius=0.275+0.012*sin(a*3.0+t*1.7);
  float inner=exp(-abs(r-innerRadius)*90.0)*(0.45+0.55*flow);
  float rimRadius=0.78+0.022*sin(a*3.0-t*1.1);
  float rim=exp(-abs(r-rimRadius)*120.0)*smoothstep(-0.25,0.65,sin(a*3.0-t*1.9));
  float particles=0.0;
  // Fixed-cost inward flecks: no emitter objects, random spawning or trails
  // accumulating after pause. TIME is the simulation clock supplied by the view.
  for(int i=0;i<12;i++){
    float seed=float(i)*0.61803399;
    float cycle=fract(t*(0.38+0.07*fract(seed))+seed);
    float pr=mix(0.87,0.25,cycle);
    float pa=seed*6.2831853+cycle*4.1+t*0.12;
    vec2 p=vec2(cos(pa),sin(pa))*pr;
    vec2 d=q-p;
    float along=dot(d,vec2(-sin(pa),cos(pa)));
    float across=dot(d,vec2(cos(pa),sin(pa)));
    float fleck=exp(-(along*along*1800.0+across*across*6200.0));
    particles+=fleck*smoothstep(0.0,0.14,cycle)*(1.0-smoothstep(0.78,1.0,cycle));
  }
  float core=1.0-smoothstep(0.19,0.34,r);
  float light=clamp(strands*0.75+inner*0.65+rim*0.38+particles,0.0,1.0);
  vec3 color=mix(vec3(0.015,0.07,0.027),vec3(0.32,0.72,0.075),clamp(haze*0.7+light,0.0,1.0));
  color=mix(color,vec3(0.7,0.94,0.27),clamp(particles*0.8+strands*0.25,0.0,0.9));
  color=mix(color,vec3(0.004,0.016,0.011),core);
  float alpha=clamp(core*0.88+band*0.07+haze*0.1+strands*0.62+inner*0.46+rim*0.27+particles*0.8,0.0,0.94);
  // Capture vertex alpha before the source texture is sampled. This keeps the
  // source fade while replacing both its solid green center and thick rim.
  COLOR=vec4(color,alpha*edge*vortex_alpha);
}`}}};
}
