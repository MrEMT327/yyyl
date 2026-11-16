import * as T from 'three';

// Match the road ports, then blend the two actual neighboring edges. Reflecting
// a narrow edge strip avoids stretching a whole block or painting a cover bar.
const helpers=`
uniform sampler2D cityBelow;
uniform sampler2D cityAbove;
uniform vec4 cityPorts;
uniform vec4 cityBelowPorts;
uniform vec4 cityAbovePorts;
vec2 cityAlignedUv(vec2 uv,vec4 ports){
  float bottom=1.-smoothstep(0.,.065,uv.y);
  float top=1.-smoothstep(0.,.065,1.-uv.y);
  float alignedBottom=ports.x+(uv.x-.5)*ports.y;
  float alignedTop=ports.z+(uv.x-.5)*ports.w;
  uv.x+=bottom*(alignedBottom-uv.x)+top*(alignedTop-uv.x);
  return clamp(uv,0.,1.);
}
`;
const sample=`
#ifdef USE_MAP
  vec4 tileColor=texture2D(map,cityAlignedUv(vMapUv,cityPorts));
  float bottomMix=.5*(1.-smoothstep(0.,.035,vMapUv.y));
  float topMix=.5*(1.-smoothstep(0.,.035,1.-vMapUv.y));
  if(bottomMix>0.)tileColor=mix(tileColor,texture2D(cityBelow,cityAlignedUv(vec2(vMapUv.x,1.-vMapUv.y),cityBelowPorts)),bottomMix);
  if(topMix>0.)tileColor=mix(tileColor,texture2D(cityAbove,cityAlignedUv(vec2(vMapUv.x,1.-vMapUv.y),cityAbovePorts)),topMix);
  diffuseColor*=tileColor;
#endif
`;

export function createCityGroundMaterial(row,color){
  const {below,above,ports,belowPorts,abovePorts}=row.groundBlend;
  const uniforms={cityBelow:{value:null},cityAbove:{value:null},
    cityPorts:{value:new T.Vector4(...ports)},cityBelowPorts:{value:new T.Vector4(...belowPorts)},
    cityAbovePorts:{value:new T.Vector4(...abovePorts)}};
  const material=new T.MeshBasicMaterial({color,depthWrite:false,toneMapped:false,transparent:true});
  material.userData.cityGround={source:row.asset,below,above,uniforms};
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.fragmentShader=helpers+shader.fragmentShader.replace('#include <map_fragment>',sample);
  };
  material.customProgramCacheKey=()=> 'city-ground-edge-blend-v1';
  return material;
}

export function syncCityGroundNeighbors(material,textures,sceneId){
  const info=material.userData.cityGround;if(!info)return;
  info.uniforms.cityBelow.value=textures.get(`${sceneId}/${info.below}`)??material.map;
  info.uniforms.cityAbove.value=textures.get(`${sceneId}/${info.above}`)??material.map;
}
