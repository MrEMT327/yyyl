import * as T from 'three';

// UnrealBloomPass halves this again before its first blur. A 256-pixel floor
// keeps narrow, low-level shots from disappearing on a small battle viewport.
// The upper bound is independent of canvas DPR, including 2x/3x phones.
export function combatBloomSize(width,height){
  const w=Math.min(512,Math.max(256,Math.round(width*.75)));
  return {width:w,height:Math.max(1,Math.round(height*w/Math.max(1,width)))};
}

export function createCombatBloomComposite(texture){
  return new T.ShaderMaterial({
    transparent:true,depthTest:false,depthWrite:false,toneMapped:false,
    blending:T.CustomBlending,blendEquation:T.AddEquation,
    blendSrc:T.OneMinusDstColorFactor,blendDst:T.OneFactor,
    uniforms:{bloomTexture:{value:texture}},
    vertexShader:`varying vec2 vUv;
      void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,
    fragmentShader:`uniform sampler2D bloomTexture;varying vec2 vUv;
      void main(){
        vec3 radiance=max(vec3(0.),texture2D(bloomTexture,vUv).rgb);
        // Encode hue separately from light coverage. Encoding tiny radiance
        // directly as sRGB lifts the faint blur into a detached, milky cloud.
        // Coverage fades continuously to zero and saturates for dense volleys.
        float peak=max(radiance.r,max(radiance.g,radiance.b));
        gl_FragColor=vec4(radiance/max(peak,.00001),1.);
        #include <colorspace_fragment>
        gl_FragColor.rgb*=.55*(1.-exp(-peak*1.6));
      }`,
  });
}
