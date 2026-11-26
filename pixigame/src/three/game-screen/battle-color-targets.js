import {ACESFilmicToneMapping,Color,LinearFilter,LinearMipmapLinearFilter,Material,Vector4,WebGLRenderTarget} from 'three';

// The battle's sprite shaders blend display-encoded premultiplied colours.
// Write those exact values into the two attachments when the 3D artwork is
// rasterized, including the hull's authored ACES exposure and exhaust bloom.
const attachments=new WeakSet(),prepared=new WeakMap();
export function usesOnlyBattleColorTransform(material){return prepared.get(material)===material.onBeforeCompile;}
export function prepareBattleColorMaterial(material){
  if(!material||material.isRawShaderMaterial||prepared.has(material))return;
  const compile=material.onBeforeCompile,draw=material.onBeforeRender;
  const oldKey=material.customProgramCacheKey===Object.getPrototypeOf(material).customProgramCacheKey?()=>compile.toString():material.customProgramCacheKey.bind(material);
  const encode={value:0},exposure={value:1};
  material.onBeforeRender=function(renderer,...rest){
    draw.call(this,renderer,...rest);
    const next=attachments.has(renderer.getRenderTarget())?(this.toneMapped&&renderer.toneMapping===ACESFilmicToneMapping?2:1):0;
    if(this.isShaderMaterial&&(encode.value!==next||exposure.value!==renderer.toneMappingExposure))this.uniformsNeedUpdate=true;
    encode.value=next;exposure.value=renderer.toneMappingExposure;
  };
  material.onBeforeCompile=function(shader,renderer){
    compile.call(this,shader,renderer);if(!shader.fragmentShader.includes('#include <colorspace_fragment>'))return;
    shader.uniforms.battleColorMode=encode;shader.uniforms.battleColorExposure=exposure;
    shader.fragmentShader='uniform float battleColorMode;\n#ifndef TONE_MAPPING\n#define toneMappingExposure battleColorExposure\n#include <tonemapping_pars_fragment>\n#undef toneMappingExposure\n#endif\n'+shader.fragmentShader
      .replace('#include <tonemapping_fragment>','#ifdef TONE_MAPPING\n#include <tonemapping_fragment>\n#else\nif(battleColorMode>1.5)gl_FragColor.rgb=ACESFilmicToneMapping(gl_FragColor.rgb);\n#endif')
      .replace('#include <colorspace_fragment>','if(battleColorMode>.5){gl_FragColor=sRGBTransferOETF(gl_FragColor);}\nelse{\n#include <colorspace_fragment>\n}');
  };
  prepared.set(material,compile===Material.prototype.onBeforeCompile?material.onBeforeCompile:null);
  material.customProgramCacheKey=()=>oldKey()+'|battle-output';material.needsUpdate=true;
}
function prepareScene(scene){
  scene.traverseVisible(node=>{if(Array.isArray(node.material))node.material.forEach(prepareBattleColorMaterial);else prepareBattleColorMaterial(node.material);});
}
export function createBattleColorTargets(renderer,w,h,hullSize,{multisampleGround=true,compactHull=false}={}){
  const gl=renderer.getContext(),samples=Math.min(renderer.capabilities.maxSamples,gl.getParameter(gl.SAMPLES));
  const make=(w,h,sampleCount,mipmaps=false)=>{const target=new WebGLRenderTarget(w,h,{
    minFilter:mipmaps?LinearMipmapLinearFilter:LinearFilter,magFilter:LinearFilter,
    samples:sampleCount,depthBuffer:true,stencilBuffer:false,generateMipmaps:mipmaps});attachments.add(target);return target;};
  const ground=make(w,h,multisampleGround?samples:0),hull=make(hullSize,hullSize,samples,true),vp=new Vector4(),sc=new Vector4(),color=new Color(),background=new Color();
  function withTarget(target,draw){
    const previous=renderer.getRenderTarget(),clip=renderer.getScissorTest();
    renderer.getViewport(vp);renderer.getScissor(sc);
    try{
      renderer.setRenderTarget(target);renderer.setViewport(0,0,target.width,target.height);renderer.setScissorTest(false);
      return draw();
    }finally{
      renderer.setRenderTarget(previous);renderer.setViewport(vp);renderer.setScissor(sc);renderer.setScissorTest(clip);
    }
  }
  function paint(target,scene,clearColor,alpha,draw){
    prepareScene(scene);
    return withTarget(target,()=>{
      const autoClear=renderer.autoClear,a=renderer.getClearAlpha();
      renderer.getClearColor(color);
      try{
        // The ground pass clears explicitly. The hull callback also draws
        // depth and exhaust passes that manage their own clearing.
        if(target===ground)renderer.autoClear=false;
        renderer.setClearColor(background.set(clearColor).convertLinearToSRGB(),alpha);renderer.clear();draw();
      }finally{
        renderer.autoClear=autoClear;renderer.setClearColor(color,a);
      }
    });
  }
  return {ground:ground.texture,hull:hull.texture,
    resizeGround(w,h){ground.setSize(w,h);},
    warmGround(scene,warm){prepareScene(scene);return withTarget(ground,warm);},
    drawGround(scene,camera,backdrop){paint(ground,scene,backdrop,1,()=>renderer.render(scene,camera));},
    drawHull(scene,draw,fullscreenComposite=false){
      const composite=compactHull&&fullscreenComposite;
      if(hull.depthBuffer===composite){
        hull.dispose();
        hull.depthBuffer=!composite;
        hull.samples=composite?0:samples;
      }
      // The HDR renderer's final quad overwrites every pixel with no depth
      // test. Resolve and clear only for models rendered directly to hull.
      if(composite)withTarget(hull,draw);
      else paint(hull,scene,0,0,draw);
    },
    dispose(){ground.dispose();hull.dispose();}};
}
