// Translucent ordinary ice. Texture alpha and source lifecycle still own shape.
const ICE='host://ice-weapons-v2/';
export function withOrdinaryIceMaterials(graph){
 const resources={...graph.resources},shaders={...graph.shaders};
 for(const [name,code]of Object.entries({
  'blade-flight':`shader_type canvas_item;
render_mode unshaded, blend_mix;
varying float blade_alpha;
void vertex(){blade_alpha=COLOR.a;}
void fragment(){
 // A smooth thin crescent inside the existing frame. Capture vertex alpha so
 // the old faceted texture cannot break this surface into transparent cracks.
 float x=UV.x*2.0-1.0;
 float arch=sqrt(max(0.0,1.0-pow(x/0.91,2.0)));
 float front=0.61-0.37*arch;
 float width=0.016+0.155*pow(arch,1.05);
 float d=(UV.y-front)/width;
 float ends=1.0-smoothstep(0.89,0.925,abs(x));
 float mask=smoothstep(-0.065,0.045,d)*(1.0-smoothstep(0.74,1.02,d))*ends;
 float depth=clamp(d,0.0,1.0);
 float edge=exp(-pow((depth-0.10)*18.0,2.0));
 float bevel=exp(-pow((depth-0.28)*5.5,2.0));
 float frost=0.5+0.5*sin(x*15.0+sin(x*5.0)*1.4+depth*2.4-TIME*2.1);
 float flow=pow(0.5+0.5*cos(abs(x)*22.0-TIME*5.0),5.0);
 vec3 color=mix(vec3(0.08,0.54,1.08),vec3(0.38,1.20,1.65),bevel*0.74+frost*0.10);
 color=mix(color,vec3(0.96,1.58,1.90),edge*0.90);
 color=mix(color,vec3(0.04,0.22,0.50),smoothstep(0.78,0.98,depth)*0.62);
 color+=vec3(0.06,0.12,0.15)*flow*bevel;
 // Keep the approved body/alpha intact; a narrow cutting edge feeds HDR bloom.
 float edgeEmission=pow(edge,2.0)*(0.48+0.52*smoothstep(0.48,0.87,abs(x)));
 color+=vec3(0.22,0.68,1.02)*edgeEmission;
 float alpha=mask*(0.93+bevel*0.05+edge*0.02)*(1.0-depth*0.08);
 COLOR=vec4(color,blade_alpha*alpha);
}`,
  material:`shader_type canvas_item;
render_mode unshaded, blend_mix;
void fragment(){
 vec3 ice=texture(TEXTURE,UV).rgb;
 vec2 q=UV*2.0-1.0;
 float r=length(q);
 float face=dot(ice,vec3(0.2126,0.7152,0.0722));
 float glint=smoothstep(0.54,0.94,face);
 float rim=smoothstep(0.48,0.80,r);
 float hub=1.0-smoothstep(0.10,0.25,r);
 float flow=pow(0.5+0.5*cos(atan(q.y,q.x)*7.0+r*15.0-TIME*2.8),10.0);
 vec3 color=mix(vec3(0.06,0.26,0.43),vec3(0.36,0.78,0.96),face);
 color+=vec3(0.30,0.42,0.45)*glint*rim;
 color+=vec3(0.22,0.88,1.32)*pow(glint,2.0)*rim;
 color+=vec3(0.08,0.13,0.15)*flow*rim;
 float alpha=0.30+rim*0.29+glint*0.16+hub*0.14;
 COLOR=vec4(color,COLOR.a*alpha);
}`,
 })){const shader=ICE+name+'-refined-shader';resources[ICE+name]={id:ICE+name,type:'ShaderMaterial',properties:{shader:{$external:shader}}};shaders[shader]={code};}
 return {...graph,resources,shaders};
}
