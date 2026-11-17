// Fixture positions stay on the original architecture. Light cast onto the
// separate clearing belongs to its ground material, below the same clouds.
const housing={
  b:'forestRect(forestUv,vec2(.388,.476),vec2(.0064,.0112))+forestRect(forestUv,vec2(.568,.523),vec2(.0064,.0112))',
  landmark:'0.',
};
const fixtures={
  b:`forestWarmLamp(forestUv,vec2(.388,.476),vec2(.0064,.0112),vec2(.040,.038))+
    forestWarmLamp(forestUv,vec2(.568,.523),vec2(.0064,.0112),vec2(.040,.038))`,
  landmark:`forestRelayPane(forestUv,vec2(.5562,.3025),vec2(.014,.0033))+
    forestRelayPane(forestUv,vec2(.4149,.6034),vec2(.0128,.003))+
    forestRelayPane(forestUv,vec2(.4449,.640),vec2(.011,.0028))`,
};
const ground={
  b:`vec3(.68,.30,.046)*(forestGlow(forestUv,vec2(.389,.565),vec2(.074,.046))+
    forestGlow(forestUv,vec2(.573,.606),vec2(.074,.046)))`,
  landmark:`vec3(.045,.29,.43)*(forestGlow(forestUv,vec2(.557,.340),vec2(.060,.035))+
    forestGlow(forestUv,vec2(.415,.640),vec2(.060,.035))+
    forestGlow(forestUv,vec2(.445,.674),vec2(.060,.035)))`,
};
export function forestNightLighting(shader,night,time,asset){
  const onGround=asset.startsWith('clearing-'),source=onGround?asset.slice('clearing-'.length):asset;
  shader.uniforms.forestNight=night;shader.uniforms.forestLightTime=time;
  shader.fragmentShader=`uniform float forestNight;uniform float forestLightTime;
float forestRect(vec2 p,vec2 center,vec2 halfSize){vec2 q=abs(p-center)/halfSize;return 1.-smoothstep(.76,1.,max(q.x,q.y));}
float forestGlow(vec2 p,vec2 center,vec2 radius){vec2 q=(p-center)/radius;return exp(-2.*dot(q,q));}
vec3 forestWarmLamp(vec2 p,vec2 center,vec2 halfSize,vec2 glowRadius){
  return vec3(1.45,1.05,.42)*forestRect(p,center,halfSize*.67)+vec3(.28,.14,.022)*forestGlow(p,center,glowRadius);
}
vec3 forestRelayPane(vec2 p,vec2 center,vec2 halfSize){
  return vec3(.32,1.12,1.5)*forestRect(p,center,halfSize)+vec3(.045,.20,.32)*forestGlow(p,center,vec2(.045,.025));
}
`+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>',`#include <colorspace_fragment>
    vec2 forestUv=vec2(vMapUv.x,1.-vMapUv.y);
    gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.075,.080,.065),clamp(forestNight*(${onGround?'0.':housing[source]}),0.,1.));
    float forestShimmer=.97+.02*sin(forestLightTime*1.6)+.01*sin(forestLightTime*4.1);
    gl_FragColor.rgb+=forestNight*forestShimmer*(${onGround?ground[source]:fixtures[source]});`);
  return '';
}
