// Compact 2D acid drop; animation and host projectile physics are untouched.
const PREFIX='host://acid-droplet-v1/';
export const isAcidDroplet=b=>b.owner==='player'&&b.familyId===200061&&b.modelId===1000031;
export const isAcidGammaRay=b=>b.owner==='player'&&b.weaponId===200067&&b.modelId===220010;
export function acidDropletPresentation(){
  return {scale:1.2,retireImmediately:false,pose:{overrides:{'Visual/Circle':{
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
  // A compact wet body with a tapered meniscus inside the existing footprint.
  float swell=1.0+0.018*sin(TIME*4.0);
  vec2 p=vec2(q.x/(0.77*swell),q.y/0.79);
  float r=length(p);
  float body=1.0-smoothstep(0.94,1.0,r);
  float dome=sqrt(max(0.0,1.0-r*r));
  float light=clamp(dome*0.80-p.x*0.20-p.y*0.16,0.0,1.0);
  vec3 color=mix(vec3(0.045,0.27,0.09),vec3(0.25,0.88,0.25),light);
  float edge=exp(-abs(r-0.88)*27.0);
  color+=vec3(0.13,0.26,0.055)*edge*(0.40+0.60*max(0.0,p.x));
  vec2 h=(p-vec2(-0.27,-0.31))/vec2(0.30,0.15);
  float reflection=exp(-dot(h,h)*2.2)*body;
  color=mix(color,vec3(0.77,1.08,0.48),reflection*0.88);
  float arc=exp(-abs(length(p-vec2(-0.04,-0.02))-0.73)*48.0)
    *smoothstep(0.15,0.58,p.y)*body;
  color+=vec3(0.24,0.40,0.09)*arc*0.55;
  // Thin liquid neck and two suspended beads, rather than a long luminous wake.
  float neck=exp(-pow((q.x-0.035*sin(TIME*4.5+q.y*7.0))*24.0,2.0))
    *smoothstep(0.60,0.78,q.y)*(1.0-smoothstep(0.89,0.98,q.y));
  vec2 d=q-vec2(0.055*sin(TIME*3.0),0.90);
  float bead=exp(-dot(d,d)*1200.0);
  float halo=exp(-max(0.0,r-0.95)*22.0)*(1.0-body)*0.07;
  float alpha=body*0.91+neck*0.42+bead*0.75+halo;
  COLOR=vec4(mix(vec3(0.20,0.57,0.14),color,body),droplet_alpha*clamp(alpha,0.0,0.97));
}`}}};
}
