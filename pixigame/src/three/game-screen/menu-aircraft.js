import {ACESFilmicToneMapping,Color,DoubleSide,HalfFloatType,ShaderMaterial,SRGBColorSpace,Vector4,WebGLRenderTarget} from 'three';
import {createModelRenderer} from '../../ui/peripheral-models.js';
import {measureScreen} from './screen-metrics.js';

export function equipmentPreviewRect(w,h){
  const u=w/369.453;
  return {x:18.5*u,y:138.5*u,w:339.9*u,h:236.4*u};
}
export function menuAircraft(screen,page,scene,refresh,request,active,{profile='equipment',rect=equipmentPreviewRect}={}){
  const r=screen.three,canvas=screen.display.input,color=new Color(),viewport=new Vector4(),scissor=new Vector4();
  const target=new WebGLRenderTarget(2,2,{type:HalfFloatType,depthBuffer:true,stencilBuffer:false,samples:Math.min(4,r.capabilities.maxSamples)});
  const exposureUniform={value:1.12};
  // Three applies the display transform only on screen. Keep the intermediate
  // HDR and apply the aircraft's own exposure when painting it over the hangar.
  function paint(art,x,y,w,h){
    const mesh=art.image(target.texture,x,y,w,h);
    mesh.material.dispose();
    mesh.material=new ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,transparent:true,side:DoubleSide,forceSinglePass:true,
      uniforms:{aircraft:{value:target.texture},exposure:exposureUniform},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader:`#include <common>
        #define toneMappingExposure exposure
        #include <tonemapping_pars_fragment>
        #undef toneMappingExposure
        varying vec2 vUv;uniform sampler2D aircraft;
        void main(){
          vec4 color=texture2D(aircraft,vUv);
          gl_FragColor=vec4(ACESFilmicToneMapping(color.rgb/max(color.a,0.00001)),color.a);
          #include <colorspace_fragment>
        }`});
  }
  let closed=false,ready=false,fit='';
  const metrics=measureScreen(r,profile==='patrol'?'Three 巡逻战机':'Three 装备战机',()=>!closed&&active(),false);
  function bounds(){const p=page.getBoundingClientRect(),b=rect(p.width,p.height);return {width:b.w,height:b.h,left:p.left+b.x,top:p.top+b.y};}
  const interactive=profile==='equipment'||profile==='catalog';
  const embedded={target,bounds,profile,hit:e=>interactive&&active()&&scene.pick(e)==='aircraft',focused:()=>interactive&&active()&&scene.focused==='aircraft',
    draw(exposure,paint){
      if(closed)return;
      exposureUniform.value=exposure;
      const before=r.getRenderTarget(),clip=r.getScissorTest(),clear=r.autoClear,alpha=r.getClearAlpha(),tone=r.toneMapping,power=r.toneMappingExposure,space=r.outputColorSpace;
      r.getViewport(viewport);r.getScissor(scissor);r.getClearColor(color);
      try{
        r.setRenderTarget(target);r.setViewport(0,0,target.width,target.height);r.setScissorTest(false);r.setClearColor(0,0);
        r.autoClear=true;r.outputColorSpace=SRGBColorSpace;r.toneMapping=ACESFilmicToneMapping;r.toneMappingExposure=exposure;metrics.draw(paint);
      }finally{
        r.setRenderTarget(before);r.setViewport(viewport);r.setScissor(scissor);r.setScissorTest(clip);r.setClearColor(color,alpha);
        r.autoClear=clear;r.toneMapping=tone;r.toneMappingExposure=power;r.outputColorSpace=space;
      }
      if(!ready){ready=true;refresh();}request();
    }};
  const model=createModelRenderer({screen,embedded});
  return {target,paint,get ready(){return ready;},update(snapshot,aircraftId=snapshot.aircraftId){
    const {width,height}=bounds(),next=aircraftId+'-'+width+'-'+height;
    if(fit!==next){ready=false;fit=next;model.attach(page,aircraftId);}
    model.showAircraft(aircraftId,snapshot);
  },tick(dt){model.update(dt,active());},close(){closed=true;metrics.release();model.destroy();target.dispose();
    delete canvas.dataset.modelReady;delete canvas.dataset.aircraftId;delete canvas.dataset.viewProfile;}};
}

