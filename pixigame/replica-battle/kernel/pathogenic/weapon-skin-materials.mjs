export const SKIN_MATERIAL_ROOT='host://weapon-skin-v1/';
// Shape profiles share the same two batches. The profile occupies a disjoint
// UV interval; normal polygons keep profile zero and need no extra material.
const common=`
float roundedMask(float d){return 1.0-smoothstep(0.92,1.0,d);}
float shine(vec2 p,vec2 c,float k){vec2 d=p-c;return exp(-dot(d,d)*k);}
`;
const light=`shader_type canvas_item;
render_mode unshaded,blend_add;
${common}
void fragment(){
  float mode=floor(UV.x*0.5);
  vec2 uv=vec2(UV.x-mode*2.0,UV.y);
  vec2 q=uv*2.0-1.0;
  vec4 tint=COLOR;
  if(mode<0.5){COLOR=tint;}
  else if(mode<1.5){
    float r2=dot(q,q),r=sqrt(r2);
    float glow=exp(-r2*4.5)*roundedMask(r);
    float core=exp(-r2*30.0);
    COLOR=vec4(tint.rgb*(0.7+core*0.25),tint.a*glow);
  }else if(mode<2.5){
    float edge=exp(-q.y*q.y*4.0);
    float core=exp(-q.y*q.y*65.0);
    float fiber=pow(0.5+0.5*sin(uv.x*29.0-TIME*8.0+q.y*5.0),6.0);
    float ends=smoothstep(0.0,0.045,uv.x)*(1.0-smoothstep(0.955,1.0,uv.x));
    COLOR=vec4(tint.rgb*(0.75+core*0.35+fiber*0.10)+vec3(core*0.20),tint.a*edge*ends);
  }else if(mode<3.5){
    vec2 a=abs(q);
    float core=exp(-dot(q,q)*20.0);
    float rays=exp(-a.x*16.0)*pow(max(0.0,1.0-a.y),1.8)+exp(-a.y*16.0)*pow(max(0.0,1.0-a.x),1.8);
    float glow=exp(-dot(q,q)*6.0)*0.14;
    COLOR=vec4(tint.rgb+vec3(core*0.35),tint.a*clamp(core+rays+glow,0.0,1.0));
  }else if(mode<4.5){
    float r=length(q),angle=atan(q.y,q.x);
    float radius=0.74+0.009*sin(angle*9.0-TIME*5.0);
    float band=exp(-pow((r-radius)*48.0,2.0));
    float halo=exp(-pow((r-radius)*15.0,2.0))*0.18;
    float flow=0.72+0.28*sin(angle*3.0+TIME*4.0);
    COLOR=vec4(tint.rgb*(0.8+band*0.3),tint.a*(band+halo)*flow);
  }else{
    float mist=exp(-q.y*q.y*4.0);
    float ends=smoothstep(0.0,0.07,uv.x)*(1.0-smoothstep(0.94,1.0,uv.x));
    COLOR=vec4(tint.rgb*0.82,tint.a*mist*ends*0.70);
  }
}`;
const solid=`shader_type canvas_item;
render_mode unshaded,blend_mix;
${common}
void fragment(){
  float mode=floor(UV.x*0.5);
  vec2 uv=vec2(UV.x-mode*2.0,UV.y);
  vec2 q=uv*2.0-1.0;
  vec4 tint=COLOR;
  if(mode<0.5){COLOR=tint;}
  else if(mode<1.5){
    float r=length(q),z=sqrt(max(0.0,1.0-r*r));
    float fresnel=pow(clamp(r,0.0,1.0),5.5);
    float lit=max(0.0,dot(vec3(q,z),vec3(-0.32,-0.48,0.78)));
    float spec=shine(q,vec2(-0.31,-0.40),78.0)+shine(q,vec2(0.38,0.36),110.0)*0.3;
    float rim=exp(-pow((r-0.91)*40.0,2.0));
    vec3 color=tint.rgb*(0.23+lit*0.66+fresnel*0.22)+vec3(0.80,0.96,1.0)*(spec*0.95+rim*0.42);
    COLOR=vec4(color,tint.a*clamp(0.43+fresnel*0.30+rim*0.25+spec*0.6,0.0,1.0)*roundedMask(r));
  }else if(mode<2.5){
    float v=clamp(uv.y,0.0,1.0);
    float width=pow(max(0.0001,sin(v*3.14159265)),0.62)*(0.80+v*0.20);
    float d=abs(q.x)/max(width,0.01);
    float edge=roundedMask(d)*smoothstep(0.0,0.05,v)*(1.0-smoothstep(0.94,1.0,v));
    float vein=pow(0.5+0.5*sin(q.x*13.0+v*8.0),18.0)*0.16;
    float pearl=pow(clamp(d,0.0,1.0),5.0)*0.45+shine(q,vec2(-0.22,0.18),12.0)*0.28;
    vec3 color=mix(tint.rgb*0.22,tint.rgb*0.87,smoothstep(0.0,0.65,v))+vec3(0.63,0.72,0.93)*(pearl+vein);
    COLOR=vec4(color,tint.a*edge*(0.46+pearl*0.75));
  }else if(mode<3.5){
    vec2 a=abs(q);
    float d=max(a.y,dot(a,vec2(0.8660254,0.5)));
    float angle=atan(q.y,q.x);
    float facet=0.5+0.5*cos(angle*6.0);
    float rim=exp(-pow((d-0.88)*27.0,2.0));
    float spec=shine(q,vec2(-0.28,-0.40),24.0);
    COLOR=vec4(tint.rgb*(0.18+facet*0.35)+vec3(0.65,0.89,1.0)*(rim*0.50+spec*0.9),tint.a*roundedMask(d)*0.84);
  }else if(mode<4.5){
    float r=length(q),angle=atan(q.y,q.x);
    float phase=angle*3.0+log(max(r,0.055))*8.0-TIME*2.3;
    float stream=pow(0.5+0.5*sin(phase),5.0);
    float rim=exp(-pow((r-0.56)*25.0,2.0));
    float gas=(stream*0.75+0.10)*smoothstep(0.27,0.52,r)*(1.0-smoothstep(0.63,1.0,r));
    vec3 color=vec3(0.009,0.007,0.025)+tint.rgb*(gas+rim*0.70)+vec3(0.7,0.38,0.65)*rim*0.35;
    float alpha=mix(0.97,clamp(gas*1.8+rim,0.0,0.9),smoothstep(0.42,0.55,r));
    COLOR=vec4(color,tint.a*alpha*roundedMask(r));
  }else if(mode<5.5){
    float width=1.0-smoothstep(0.25,0.95,q.y)*0.96;
    float mask=roundedMask(abs(q.x)/max(width,0.025))*smoothstep(-1.0,-0.84,q.y);
    float shade=pow(max(0.0,1.0-abs(q.x+0.24)),2.3);
    float seam=exp(-pow((q.x+0.56)*25.0,2.0));
    vec3 red=mix(vec3(0.20,0.015,0.045),vec3(0.91,0.13,0.25),shade);
    float band=smoothstep(-0.19,-0.15,q.y)*(1.0-smoothstep(-0.02,0.02,q.y));
    float cap=smoothstep(0.28,0.34,q.y);
    vec3 gold=mix(vec3(0.35,0.15,0.035),vec3(1.10,0.80,0.30),shade);
    vec3 color=mix(mix(red,vec3(0.87,0.83,0.64)*(0.45+shade*0.65),band),gold,cap)+vec3(seam*0.28);
    COLOR=vec4(color*tint.rgb,tint.a*mask);
  }else{
    float width=1.0-smoothstep(0.25,0.97,q.y)*0.94;
    float mask=roundedMask(abs(q.x)/max(0.025,width));
    float shade=pow(max(0.0,1.0-abs(q.x+0.20)),2.5);
    float edge=exp(-pow((abs(q.x)-0.74)*22.0,2.0));
    vec3 color=mix(vec3(0.08,0.055,0.025),tint.rgb,shade*0.82)+vec3(0.93,0.77,0.43)*edge*0.55;
    COLOR=vec4(color,tint.a*mask);
  }
}`;
export function withWeaponSkinResources(graph){
  const resources={...graph.resources},shaders={...graph.shaders};
  for(const [name,code]of Object.entries({solid,light})){
    const key=SKIN_MATERIAL_ROOT+name,shader=key+'-polish-v2';
    resources[key]={type:'ShaderMaterial',properties:{shader:{$external:shader}}};
    shaders[shader]={code};
  }
  return{...graph,resources,shaders};
}
