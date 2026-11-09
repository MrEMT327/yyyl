// Ground-locked rain circles. This function is used only by water materials or
// an existing painted-water mask; terrain and props are drawn over it normally.
export const rainRippleShader=`
vec2 rainHash(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
vec3 applyRainRipples(vec3 color,vec2 world,float time,float amount){
  if(amount<.001)return color;
  vec2 grid=world/42.,cell=floor(grid),p=fract(grid),random=rainHash(cell);
  float clock=time*.92+random.x,age=fract(clock);
  vec2 center=.29+.42*rainHash(cell+floor(clock)*13.71);
  float coverage=step(random.y,.07+.13*amount);
  float distanceToDrop=length(p-center),radius=.014+age*.255;
  float edge=max(fwidth(distanceToDrop)*.72,.008);
  float ring=1.-smoothstep(edge,edge*2.,abs(distanceToDrop-radius));
  float inner=(1.-smoothstep(edge,edge*2.,abs(distanceToDrop-radius*.66)))*.3;
  float envelope=smoothstep(0.,.07,age)*pow(1.-age,1.8);
  float touch=(1.-smoothstep(.012,.035,distanceToDrop))*(1.-smoothstep(.01,.09,age));
  float light=(ring+inner)*envelope+touch*.7;
  color*=1.-ring*envelope*coverage*amount*.06;
  return mix(color,vec3(.29,.48,.55),clamp(light*coverage*amount*.58,0.,.42));
}
`;
