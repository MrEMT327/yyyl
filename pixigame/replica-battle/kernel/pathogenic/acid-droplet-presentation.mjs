// Compact 2D acid drop; animation and host projectile physics are untouched.
const PREFIX='host://acid-droplet-v1/';
export const isAcidDroplet=b=>b.owner==='player'&&b.familyId===200061&&b.modelId===1000031;
export const isAcidGammaRay=b=>b.owner==='player'&&b.weaponId===200067&&b.modelId===220010;
export function acidDropletPresentation(){
  return {scale:1.2,retireImmediately:false,pose:{overrides:{'Visual/Circle':{
    self_modulate:[1,1,1,1],offset:[0,0],rotation:0,scale:[.465*156/74,.465],material:{$ref:PREFIX+'material'},
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
  float swell=1.0+0.025*sin(TIME*5.0);
  float taper=mix(1.0,0.56,smoothstep(0.08,0.88,q.y));
  vec2 p=vec2((q.x-0.018*sin(TIME*4.0+q.y*3.0))/(0.75*swell*taper),(q.y+0.08)/0.83);
  float r=length(p);
  float body=1.0-smoothstep(0.94,1.0,r);
  float dome=sqrt(max(0.0,1.0-r*r));
  float light=clamp(dome*0.80-p.x*0.20-p.y*0.16,0.0,1.0);
  vec3 color=mix(vec3(0.025,0.19,0.055),vec3(0.30,0.87,0.17),light);
  float edge=exp(-abs(r-0.88)*27.0);
  color+=vec3(0.13,0.26,0.055)*edge*(0.40+0.60*max(0.0,p.x));
  vec2 h=(p-vec2(-0.27+0.028*sin(TIME*3.7),-0.31))/vec2(0.25,0.13);
  float reflection=exp(-dot(h,h)*2.2)*body;
  color=mix(color,vec3(0.80,1.48,0.46),reflection*0.86);
  float meniscus=exp(-abs(r-0.86)*44.0)*smoothstep(0.08,0.76,-p.y-p.x*0.40)*body;
  color+=vec3(0.26,0.94,0.12)*meniscus;
  // A small moving specular feeds bloom; the green liquid body stays readable.
  color+=vec3(0.55,0.88,0.34)*pow(reflection,2.0);
  vec2 bubble=p-vec2(0.25+0.025*sin(TIME*3.1),0.18+0.06*sin(TIME*2.6));
  float bubbleR=length(bubble/vec2(0.14,0.17));
  color+=vec3(0.10,0.29,0.06)*exp(-abs(bubbleR-0.78)*12.0)*body;
  float arc=exp(-abs(length(p-vec2(-0.04,-0.02))-0.73)*48.0)
    *smoothstep(0.15,0.58,p.y)*body;
  color+=vec3(0.24,0.40,0.09)*arc*0.55;
  // Thin liquid neck and two suspended beads, rather than a long luminous wake.
  float neck=exp(-pow((q.x-0.035*sin(TIME*4.5+q.y*7.0))*24.0,2.0))
    *smoothstep(0.48,0.71,q.y)*(1.0-smoothstep(0.89,0.98,q.y));
  vec2 d=q-vec2(0.055*sin(TIME*3.0),0.90);
  float bead=exp(-dot(d,d)*1200.0);
  float halo=exp(-max(0.0,r-0.95)*22.0)*(1.0-body)*0.07;
  float alpha=body*0.91+neck*0.42+bead*0.75+halo;
  COLOR=vec4(mix(vec3(0.20,0.57,0.14),color,body),droplet_alpha*clamp(alpha,0.0,0.97));
}`}}};
}
