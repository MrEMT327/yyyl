import {DataTexture,RGBAFormat,UnsignedByteType,LinearFilter,ClampToEdgeWrapping,NoColorSpace} from 'three';
import {LAVA_RIVER_GUIDE_HEIGHT,LAVA_RIVER_GUIDE_RGBA} from './lava-river-guide.js';

const fract=value=>value-Math.floor(value);
export function sampleLavaRiverPhase(time,reducedMotion=false){
  return reducedMotion?0:fract(Math.max(0,Number.isFinite(time)?time:0)*.14);
}

const declarations=`
#ifdef USE_MAP
uniform sampler2D lavaRiverGuide;
uniform float lavaRiverPhase;
float riverMolten(vec4 c){
 return c.a*smoothstep(.015,.12,c.r-max(c.g,c.b))*smoothstep(.015,.10,c.r-1.60*c.b)*smoothstep(.004,.045,c.r-2.10*c.g);
}
vec2 riverUpstream(vec2 uv,vec2 localShape,float phase){
 float y=clamp(uv.y+phase*.070,0.,1.);
 vec2 upstream=texture2D(lavaRiverGuide,vec2(.5,y)).rg;
 float crossChannel=(uv.x-localShape.x)/max(.03,localShape.y);
 return vec2(clamp(upstream.x+crossChannel*max(.03,upstream.y),0.,1.),y);
}
#endif
`;
const surface=`
#ifdef USE_MAP
 float molten=riverMolten(diffuseColor);
 if(molten>.001){
  vec2 shape=texture2D(lavaRiverGuide,vec2(.5,vMapUv.y)).rg;
  float secondPhase=fract(lavaRiverPhase+.5);
  vec4 currentA=texture2D(map,riverUpstream(vMapUv,shape,lavaRiverPhase));
  vec4 currentB=texture2D(map,riverUpstream(vMapUv,shape,secondPhase));
  vec3 a=mix(diffuseColor.rgb,currentA.rgb,riverMolten(currentA));
  vec3 b=mix(diffuseColor.rgb,currentB.rgb,riverMolten(currentB));
  float blend=abs(lavaRiverPhase-.5)*2.;
  float ends=smoothstep(.08,.19,vMapUv.y)*smoothstep(.08,.19,1.-vMapUv.y);
  diffuseColor.rgb=mix(diffuseColor.rgb,mix(a,b,blend),molten*ends*.78);
 }
#endif
`;

/** Advect only molten texture along its measured curved channel. The alpha,
 * banks and cooling rocks remain the exact authored, stationary artwork.
 * Two overlapping flow phases prevent a reset at the end of each cycle. */
export function installLavaRiverFlow(material){
  if(material.userData.lavaRiverFlow)return;
  const guide=new DataTexture(LAVA_RIVER_GUIDE_RGBA,1,LAVA_RIVER_GUIDE_HEIGHT,RGBAFormat,UnsignedByteType);
  guide.name='volcano-river-flow-guide';guide.colorSpace=NoColorSpace;
  guide.minFilter=guide.magFilter=LinearFilter;guide.wrapS=guide.wrapT=ClampToEdgeWrapping;
  guide.generateMipmaps=false;guide.needsUpdate=true;
  const phase={value:0},reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  material.userData.lavaRiverFlow={guide,phase,reducedMotion};
  const compile=material.onBeforeCompile,cacheKey=material.customProgramCacheKey;
  material.onBeforeCompile=function(shader,renderer){
    compile.call(this,shader,renderer);
    shader.uniforms.lavaRiverGuide={value:guide};shader.uniforms.lavaRiverPhase=phase;
    shader.fragmentShader=declarations+shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+surface);
  };
  material.customProgramCacheKey=function(){return cacheKey.call(this)+'-lava-river-flow-v1';};
  const release=()=>{guide.dispose();material.removeEventListener('dispose',release);};
  material.addEventListener('dispose',release);
}

export function syncLavaRiverFlow(material,time){
  const state=material.userData.lavaRiverFlow;
  if(state)state.phase.value=sampleLavaRiverPhase(time,state.reducedMotion?.matches??false);
}
