import * as T from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';

// Preview-only temporal coverage. During a locked deployment pose every hull
// part follows the same outer orbit, so depth reconstructs its exact old UV.
// Articulating/dragging frames never reuse history. No extra model draw is needed.
export function createAircraftPreviewHistory(renderer){
  const targets=[0,1].map(()=>{
    // Keep reprojected depth in a color attachment. Writing gl_FragDepth into
    // a sampled depth attachment can discard the entire resolve on resize.
    const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,count:2,depthBuffer:false});
    Object.assign(target.textures[1],{type:T.UnsignedByteType,minFilter:T.NearestFilter,magFilter:T.NearestFilter,generateMipmaps:false});
    return target;
  });
  const material=new T.ShaderMaterial({
    glslVersion:T.GLSL3,depthTest:false,depthWrite:false,blending:T.NoBlending,toneMapped:false,
    uniforms:{current:{value:null},currentDepth:{value:null},history:{value:null},historyDepth:{value:null},
      texel:{value:new T.Vector2(1,1)},reprojection:{value:new T.Matrix4()},historyWeight:{value:0}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D current,currentDepth,history,historyDepth;
      layout(location=0) out vec4 resolvedColor;layout(location=1) out vec4 resolvedDepth;
      #include <packing>
      uniform vec2 texel;uniform mat4 reprojection;uniform float historyWeight;varying vec2 vUv;
      void main(){
        vec4 center=texture2D(current,vUv),low=center,high=center;
        vec4 color=center*.140625;
        // Bilinear taps reconstruct a normalized 5x5 binomial footprint.
        // Uniform paint is unchanged; thin high-contrast seams get continuous coverage.
        for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
          if(x==0&&y==0)continue;
          vec4 sampleColor=texture2D(current,vUv+vec2(float(x),float(y))*texel*1.2);
          color+=sampleColor*((x==0||y==0)?.1171875:.09765625);
          low=min(low,sampleColor);high=max(high,sampleColor);
        }
        float depth=texture2D(currentDepth,vUv).r;
        if(historyWeight>0.&&depth<.999999){
          vec4 oldClip=reprojection*vec4(vUv*2.-1.,depth*2.-1.,1.);
          vec3 oldNdc=oldClip.xyz/oldClip.w;vec2 oldUv=oldNdc.xy*.5+.5;
          if(all(greaterThanEqual(oldUv,vec2(0.)))&&all(lessThanEqual(oldUv,vec2(1.)))
            &&max(abs(oldUv.x-vUv.x),abs(oldUv.y-vUv.y))<.01){
            float oldDepth=unpackRGBAToDepth(texture2D(historyDepth,oldUv));
            // Reject disocclusions, including a different face appearing in front.
            if(abs(oldDepth-(oldNdc.z*.5+.5))<.00015){
              vec4 oldColor=clamp(texture2D(history,oldUv),low,high);
              color=mix(color,oldColor,historyWeight);
            }
          }
        }
        resolvedColor=color;resolvedDepth=packDepthToRGBA(depth);
      }`,
  });
  const quad=new FullScreenQuad(material),previousVP=new T.Matrix4(),previousRoot=new T.Matrix4(),
    currentVP=new T.Matrix4(),inverseRoot=new T.Matrix4(),inverseVP=new T.Matrix4();
  let width=1,height=1,read=0,valid=false,previousStable=false,previousCamera,previousObject,previousPose,samples=0;
  function reset(){valid=false;previousStable=false;samples=0;}
  return {
    reset,get samples(){return samples;},
    resolve(source,context,nextWidth,nextHeight){
      if(!context?.camera||!context.object||!context.depth){reset();return null;}
      if(width!==nextWidth||height!==nextHeight){
        width=nextWidth;height=nextHeight;for(const target of targets)target.setSize(width,height);
        material.uniforms.texel.value.set(1/width,1/height);reset();
      }
      const {camera,object,allowHistory,pose}=context;
      const reuse=valid&&previousStable&&allowHistory&&pose===previousPose&&camera===previousCamera&&object===previousObject;
      currentVP.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      inverseVP.copy(currentVP).invert();inverseRoot.copy(object.matrixWorld).invert();
      material.uniforms.reprojection.value.copy(previousVP).multiply(previousRoot).multiply(inverseRoot).multiply(inverseVP);
      material.uniforms.current.value=source;material.uniforms.currentDepth.value=context.depth;
      material.uniforms.history.value=targets[read].texture;material.uniforms.historyDepth.value=targets[read].textures[1];
      material.uniforms.historyWeight.value=reuse ? .75 : 0;
      const write=1-read;
      try{renderer.setRenderTarget(targets[write]);renderer.clear();quad.render(renderer);}
      catch(error){reset();throw error;}
      read=write;previousVP.copy(currentVP);previousRoot.copy(object.matrixWorld);
      previousCamera=camera;previousObject=object;previousPose=pose;valid=true;previousStable=Boolean(allowHistory);
      samples=reuse?Math.min(4,samples+1):1;
      return targets[read].texture;
    },
    dispose(){for(const target of targets)target.dispose();material.dispose();quad.dispose();reset();},
  };
}
