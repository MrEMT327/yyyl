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
  float edge=1.0-smoothstep(0.88,0.99,r);
  float band=smoothstep(0.18,0.33,r)*(1.0-smoothstep(0.77,0.96,r));
  float phase=a*3.0+r*15.0-t*2.4+0.12*sin(r*11.0-t*3.0);
  float flow=0.5+0.5*cos(phase);
  float strands=pow(flow,18.0)*band;
  float haze=pow(flow,3.0)*band;
  float underflow=pow(0.5+0.5*cos(a*4.0-r*18.0+t*1.7),7.0)*band;
  float innerRadius=0.265+0.013*sin(a*3.0+t*1.7);
  float inner=exp(-abs(r-innerRadius)*72.0)*(0.50+0.50*flow);
  float rimRadius=0.80+0.018*sin(a*3.0-t*1.1);
  float rim=exp(-abs(r-rimRadius)*85.0)*smoothstep(-0.30,0.65,sin(a*3.0-t*1.9));
  float particles=0.0;
  // Twelve inward-moving flecks share the body draw and simulation clock.
  for(int i=0;i<12;i++){
    float seed=float(i)*0.61803399;
    float cycle=fract(t*(0.38+0.07*fract(seed))+seed);
    float pr=mix(0.91,0.22,cycle);
    float pa=seed*6.2831853+cycle*4.1+t*0.12;
    vec2 p=vec2(cos(pa),sin(pa))*pr;
    vec2 d=q-p;
    float along=dot(d,vec2(-sin(pa),cos(pa)));
    float across=dot(d,vec2(cos(pa),sin(pa)));
    particles+=exp(-(along*along*1150.0+across*across*4500.0))
      *smoothstep(0.0,0.14,cycle)*(1.0-smoothstep(0.78,1.0,cycle));
  }
  float core=1.0-smoothstep(0.16,0.30,r);
  float depth=clamp((0.65-q.y)*0.48+strands*0.65,0.0,1.0);
  vec3 color=mix(vec3(0.025,0.12,0.055),vec3(0.24,0.62,0.14),depth);
  color=mix(color,vec3(0.14,0.39,0.18),underflow*0.38);
  color=mix(color,vec3(0.51,0.89,0.24),clamp(strands*0.60+inner*0.50+rim*0.35,0.0,0.9));
  color+=vec3(0.65,1.05,0.30)*particles*0.65;
  // Fine hot filaments spiral around an opaque dark core, with no extra draws.
  float filament=pow(flow,34.0)*band;
  float movingGlint=pow(0.5+0.5*cos(a*2.0-r*8.0+t*3.7),8.0);
  float emission=clamp(filament*(0.72+0.30*movingGlint)+inner*0.82+rim*0.38+particles*0.65,0.0,1.25);
  color+=vec3(0.24,1.48,0.46)*emission*(1.0-core);
  color=mix(color,vec3(0.003,0.013,0.010),core);
  float atmosphere=exp(-r*r*2.6)*(1.0-core);
  float alpha=clamp(core*0.95+atmosphere*0.20+band*0.10+haze*0.20+underflow*0.12
    +strands*0.58+inner*0.54+rim*0.30+particles*0.78,0.0,0.96);
  // Capture vertex alpha before the source texture is sampled. This keeps the
  // source fade while replacing both its solid green center and thick rim.
  COLOR=vec4(color,alpha*edge*vortex_alpha);
}`}}};
}
