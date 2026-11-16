// Original painted doorway in top-left image coordinates. Emit after ambient
// grading, below the existing 3D cloud stack, so a lamp can stay visibly bright.
export function desertNightLighting(shader,night,time){
  shader.uniforms.desertNight=night;shader.uniforms.desertLightTime=time;
  shader.fragmentShader=`uniform float desertNight;uniform float desertLightTime;
float desertDoorEdge(vec2 p,vec2 a,vec2 b){
  vec2 e=b-a;return smoothstep(-.001,.001,(e.x*(p.y-a.y)-e.y*(p.x-a.x))/length(e));
}
vec3 desertLampEmission(vec2 entryUv){
  float aperture=desertDoorEdge(entryUv,vec2(355.,683.)/1024.,vec2(378.,695.)/1024.)*
    desertDoorEdge(entryUv,vec2(378.,695.)/1024.,vec2(373.,716.)/1024.)*
    desertDoorEdge(entryUv,vec2(373.,716.)/1024.,vec2(345.,703.)/1024.)*
    desertDoorEdge(entryUv,vec2(345.,703.)/1024.,vec2(355.,683.)/1024.);
  vec2 sand=entryUv-vec2(343.,746.)/1024.;
  sand=mat2(.887,-.462,.462,.887)*sand/vec2(.12,.066);
  float spill=exp(-dot(sand,sand)*2.)*smoothstep(-.008,.022,entryUv.y-697./1024.);
  vec2 jamb=(entryUv-vec2(363.,700.)/1024.)/vec2(.047,.040);
  float glow=exp(-dot(jamb,jamb)*2.);
  float shimmer=.96+.025*sin(desertLightTime*1.9)+.015*sin(desertLightTime*4.7);
  return desertNight*shimmer*(vec3(1.45,1.02,.42)*aperture+
    vec3(.78,.36,.065)*spill+vec3(.34,.15,.022)*glow);
}
`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>',
    '#include <colorspace_fragment>\ngl_FragColor.rgb+=desertLampEmission(vec2(vMapUv.x,1.-vMapUv.y));');
  return '';
}
