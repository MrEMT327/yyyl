import * as T from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {CombatBloomPass} from '../combat-bloom-pass.js';
import {aircraftFxBudget} from './aircraft-fx-budget.js';
import {createAircraftPreviewHistory} from './aircraft-preview-history.js';

// HDR light is composed with its own coverage, retaining transparent hangar
// backgrounds. Only the aircraft texture is graded, never the surrounding UI.
export function createAircraftFxRenderer(renderer,{samples=0,stableCoverage=false,temporalCoverage=false,compactBloom=false}={}) {
  // Canvas antialiasing does not reach this offscreen HDR pass. UI previews
  // opt in explicitly; small combat textures retain their existing budget.
  const source=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,samples:Math.min(samples,renderer.capabilities?.maxSamples??0)});
  const bloom=compactBloom?null:new CombatBloomPass(new T.Vector2(1,1),.55,0,4.2);
  if(bloom){
    bloom.activeMips=aircraftFxBudget(256).bloomMips;
    bloom.compositeMaterial.uniforms.bloomFactors.value=[1,.35,0,0,0];
  }
  const material=new T.ShaderMaterial({
    depthTest:false,depthWrite:false,blending:T.NoBlending,premultipliedAlpha:true,
    defines:{...(stableCoverage&&{STABLE_COVERAGE:1}),...(compactBloom&&{COMPACT_BLOOM:1})},
    uniforms:{source:{value:source.texture},halo:{value:bloom?.renderTargetsHorizontal[0].texture},haloTint:{value:new T.Color('#66d7f0')},
      texel:{value:new T.Vector2(1,1)},reconstruct:{value:1},glowThreshold:{value:4.2},glowStrength:{value:.55}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D source,halo;uniform vec3 haloTint;uniform vec2 texel;uniform float reconstruct;varying vec2 vUv;
      #ifdef COMPACT_BLOOM
      uniform float glowThreshold,glowStrength;
      vec3 bright(vec3 color){
        return color*smoothstep(glowThreshold,glowThreshold+.1,dot(color,vec3(.2126,.7152,.0722)));
      }
      #endif
      void main(){
        vec4 base=texture2D(source,vUv);
        #ifdef STABLE_COVERAGE
          // A half-texel footprint smooths subpixel panel coverage. Filter in
          // premultiplied linear light, before grading: no dark alpha fringes,
          // temporal history, motion lag or changes to uniform paint regions.
          if(reconstruct>.5){vec2 d=texel*.5;
          base=base*.5+.125*(texture2D(source,vUv+d)+texture2D(source,vUv-d)
            +texture2D(source,vUv+vec2(d.x,-d.y))+texture2D(source,vUv+vec2(-d.x,d.y)));}
        #endif
        #ifdef COMPACT_BLOOM
          // Resolve the small aircraft halo together with the HDR hull.
          vec2 radius=texel*2.;
          vec3 light=(bright(base.rgb)*4.+bright(texture2D(source,vUv+vec2(radius.x,0.)).rgb)
            +bright(texture2D(source,vUv-vec2(radius.x,0.)).rgb)+bright(texture2D(source,vUv+vec2(0.,radius.y)).rgb)
            +bright(texture2D(source,vUv-vec2(0.,radius.y)).rgb))*(glowStrength/8.);
        #else
          vec3 light=max(vec3(0.),texture2D(halo,vUv).rgb);
        #endif
        float peak=max(light.r,max(light.g,light.b));
        vec3 tint=haloTint/max(.00001,max(haloTint.r,max(haloTint.g,haloTint.b)));
        light=mix(light,tint*peak,.45);
        float coverage=1.-exp(-peak*1.4);
        float alpha=base.a+coverage*(1.-base.a);
        gl_FragColor=vec4((base.rgb+light)/max(alpha,.00001),alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <premultiplied_alpha_fragment>
      }`,
  });
  const quad=new FullScreenQuad(material),viewport=new T.Vector4(),scissor=new T.Vector4(),color=new T.Color();
  const history=temporalCoverage?createAircraftPreviewHistory(renderer):null;
  let width=1,height=1,night=false;
  return {
    setColor(value){material.uniforms.haloTint.value.set(value);history?.reset();},
    setNight(value){
      const next=Boolean(value);if(next===night)return;night=next;
      const strength=night?.88:.55,threshold=night?3.4:4.2;
      material.uniforms.glowStrength.value=strength;material.uniforms.glowThreshold.value=threshold;
      if(bloom){
        bloom.strength=strength;bloom.threshold=threshold;
        bloom.compositeMaterial.uniforms.bloomFactors.value[1]=night?.55:.35;
      }
    },
    resetHistory(){history?.reset();},
    get historySamples(){return history?.samples||0;},
    render(draw,nextWidth,nextHeight,context){
      if(width!==nextWidth||height!==nextHeight){
        width=nextWidth;height=nextHeight;source.setSize(width,height);material.uniforms.texel.value.set(1/width,1/height);
        if(bloom){const w=aircraftFxBudget(width).bloomWidth,h=Math.max(1,Math.round(height*w/width));bloom.setSize(w,h);}
      }
      const target=renderer.getRenderTarget(),scissorTest=renderer.getScissorTest(),autoClear=renderer.autoClear,
        alpha=renderer.getClearAlpha(),toneMapping=renderer.toneMapping;
      renderer.getViewport(viewport);renderer.getScissor(scissor);renderer.getClearColor(color);
      const info=renderer.info,infoAutoReset=info?.autoReset;
      if(info){info.autoReset=false;info.reset();}
      try{
        renderer.autoClear=false;renderer.setScissorTest(false);renderer.setClearColor(0,0);
        renderer.toneMapping=T.NoToneMapping;renderer.setRenderTarget(source);renderer.clear();draw();
        const resolved=history?.resolve(source.texture,context,width,height);
        material.uniforms.source.value=resolved||source.texture;material.uniforms.reconstruct.value=resolved?0:1;
        bloom?.render(renderer,null,source,0,false);
        renderer.toneMapping=toneMapping;renderer.setRenderTarget(target);
        renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
        quad.render(renderer);
      }catch(error){history?.reset();throw error;}finally{
        renderer.toneMapping=toneMapping;renderer.autoClear=autoClear;renderer.setRenderTarget(target);
        renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.setClearColor(color,alpha);
        if(info)info.autoReset=infoAutoReset;
      }
    },
    dispose(){history?.dispose();source.dispose();bloom?.dispose();material.dispose();quad.dispose();},
  };
}
