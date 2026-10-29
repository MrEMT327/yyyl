// Compact 2D acid drop; animation and host projectile physics are untouched.
const PREFIX='host://acid-droplet-v1/';
export const isAcidDroplet=b=>b.owner==='player'&&b.familyId===200061&&b.modelId===1000031;
export const isAcidGammaRay=b=>b.owner==='player'&&b.weaponId===200067&&b.modelId===220010;
export function acidDropletPresentation(){
  return {scale:.65,retireImmediately:false,pose:{overrides:{'Visual/Circle':{
    self_modulate:[1,1,1,1],offset:[0,0],scale:[.465*156/74,.465],material:{$ref:PREFIX+'material'},
  }}}};
}
export function withAcidDropletResources(graph){
  return {...graph,resources:{...graph.resources,[PREFIX+'material']:{
    id:PREFIX+'material',type:'ShaderMaterial',properties:{shader:{$external:PREFIX+'shader'}},
  }},shaders:{...graph.shaders,[PREFIX+'shader']:{code:`shader_type canvas_item;
render_mode unshaded, blend_mix;
varying float droplet_alpha;
void vertex(){droplet_alpha=COLOR.a;}
void fragment(){
  vec2 q=UV*2.0-1.0;
  // Smooth round silhouette; illustrated reflections, not 3D lighting.
  float r=length(q);
  float body=1.0-smoothstep(0.82,0.85,r);
  float fill=1.0-smoothstep(0.75,0.79,r);
  vec3 color=mix(vec3(0.035,0.28,0.12),vec3(0.13,0.7,0.22),fill);
  // A broad, quiet second paint tone instead of a central stripe or noisy veins.
  float paint=(1.0-smoothstep(0.5,0.62,length(q-vec2(-0.08,-0.16))))*fill;
  color=mix(color,vec3(0.22,0.81,0.27),paint*0.7);
  vec2 h=q-vec2(0.28+0.025*sin(TIME*3.0),-0.34+0.02*cos(TIME*2.7));
  vec2 oval=vec2(h.x*0.86-h.y*0.5,h.x*0.5+h.y*0.86)/vec2(0.23,0.13);
  float reflection=1.0-smoothstep(0.85,1.0,length(oval));
  color=mix(color,vec3(0.81,0.99,0.48),reflection*fill);
  float arcRadius=0.63+0.018*sin(TIME*2.8);
  float arc=(1.0-smoothstep(0.025,0.052,abs(length(q-vec2(0.0,-0.035))-arcRadius)))
    *smoothstep(-0.08,0.24,q.y)*fill;
  color=mix(color,vec3(0.69,0.96,0.36),arc*0.9);
  float halo=exp(-max(0.0,r-0.8)*22.0)*(1.0-body)*0.14;
  COLOR=vec4(mix(vec3(0.16,0.56,0.13),color,body),droplet_alpha*(body*0.96+halo));
}`}}};
}
