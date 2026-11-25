import {ACESFilmicToneMapping,Color,DoubleSide,HalfFloatType,ShaderMaterial,SRGBColorSpace,Vector4,WebGLRenderTarget} from 'three';
import {createModelRenderer} from '../../ui/peripheral-models.js';
import {measureScreen} from './screen-metrics.js';
import {equipmentLayout} from './equipment-layout.js';
import {peripheralModelLoadout,peripheralModelLoadoutKey} from '../../ui/peripheral-model-loadout.js';

export function menuAircraft(screen,page,scene,refresh,request,active,{profile='equipment',rect=w=>equipmentLayout(w,0).preview,
  port=null,stageModel=false,prefetchModel=true,acceptOrbit=()=>true}={}){
  const r=screen.three,canvas=screen.display.input,color=new Color(),viewport=new Vector4(),scissor=new Vector4();
  const target=new WebGLRenderTarget(2,2,{type:HalfFloatType,depthBuffer:true,stencilBuffer:false,samples:port?0:Math.min(4,r.capabilities.maxSamples)});
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
  let closed=false,ready=false,fit='',model,wanted,settledFrames=0,queuedAircraft='',queuedFit='';
  let prepareStarted=null,showStill=false;
  const metrics=measureScreen(r,profile==='patrol'?'Three 巡逻战机':'Three 装备战机',()=>!closed&&active(),false);
  function bounds(){const p=port?port.bounds():page.getBoundingClientRect(),b=rect(p.width,p.height);return {width:b.w,height:b.h,left:p.left+b.x,top:p.top+b.y};}
  const interactive=profile==='equipment'||profile==='catalog';
  const embedded={target,bounds,profile,port,stageModel,hit:e=>interactive&&active()&&acceptOrbit()&&scene.pick(e)==='aircraft',focused:()=>interactive&&active()&&scene.focused==='aircraft',
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
  function configure(snapshot,aircraftId){
    const {width,height}=bounds(),next=aircraftId+'-'+width+'-'+height;
    if(fit!==next){ready=false;fit=next;model.attach(port??page,aircraftId);}
    model.showAircraft(aircraftId,snapshot);
  }
  if(!port)model=createModelRenderer({screen,embedded});
  const view={target,paint,get ready(){return ready;},get usingStill(){return showStill;},update(snapshot,aircraftId=snapshot.aircraftId){
    if(stageModel&&port&&profile==='equipment'){
      const {width,height}=bounds();
      const key=aircraftId+':'+width+':'+height+':'+peripheralModelLoadoutKey(peripheralModelLoadout(aircraftId,snapshot));
      if(key!==queuedFit){queuedFit=key;ready=false;showStill=false;prepareStarted=null;}
    }
    if(model&&!stageModel){wanted=null;configure(snapshot,aircraftId);}
    else{
      wanted=[snapshot,aircraftId];
      if(stageModel&&port&&aircraftId&&queuedAircraft!==aircraftId){
        ready=false;
        queuedAircraft=aircraftId;
        // Equipment prepares its first render only while opening the visible hangar.
        if(prefetchModel)void port.loadAircraft(aircraftId).catch(()=>{});
      }
    }
  },prepare(now){
    if(ready||showStill)return true;
    prepareStarted??=now;
    if(now-prepareStarted<4500){
      try{view.tick(0);if(model?.available!==false)return ready;}
      catch(error){console.warn('[Three 装备战机]',error?.message||error);}
    }
    // A finished still is used for this visit if the preview cannot be drawn.
    model?.destroy();model=null;fit='';settledFrames=0;ready=false;showStill=true;return true;
  },tick(dt){
    if(showStill)return;
    const visible=active();
    // Give the menu artwork its own frames before building the studio.
    if(!model){
      if(!visible||!wanted||++settledFrames<3)return;
      model=createModelRenderer({screen,embedded});return;
    }
    if(visible&&wanted){const next=wanted;wanted=null;configure(...next);}
    model.update(dt,visible);
  },pause(){model?.update(0,false);showStill=false;prepareStarted=null;
  },releaseModel(){
    model?.destroy();model=null;target.setSize(2,2);
    fit='';settledFrames=0;ready=false;showStill=false;prepareStarted=null;
  },close(){closed=true;metrics.release();model?.destroy();target.dispose();
    if(canvas){delete canvas.dataset.modelReady;delete canvas.dataset.aircraftId;delete canvas.dataset.viewProfile;}}};
  return view;
}
