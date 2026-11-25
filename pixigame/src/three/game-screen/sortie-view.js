import {
  ACESFilmicToneMapping,Camera,Color,LinearFilter,LinearMipmapLinearFilter,Mesh,NoColorSpace,
  OrthographicCamera,PlaneGeometry,RawShaderMaterial,Scene,SRGBColorSpace,Vector2,Vector4,WebGLRenderTarget
} from 'three';
import {artworkTexture} from './image-loading.js';
import {createThreeSurface} from '../../ui/three-surface.js';
import {nineSliceGeometry} from '../../ui/nine-slice-geometry.js';
import {sortieAircraftImageLayout,sortieAircraftImageUrl} from '../../ui/sortie-aircraft-image.js';
import {hangarPose} from '../../ui/sortie-hangar-motion.js';
import {AIRCRAFT_RENDER_STYLE} from '../../three/aircraft/aircraft-lighting.js';

const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const fullVertex=`attribute vec3 position;attribute vec2 uv;varying vec2 screenUV;
void main(){screenUV=vec2(uv.x,1.0-uv.y);gl_Position=vec4(position.xy,0.,1.);}`;
const shaftFragment=`precision highp float;
varying vec2 screenUV;uniform sampler2D shaft;uniform vec2 panel,sourceSize;
uniform float seconds,still,available;
vec3 strip(vec3 base,float phase){
  float y=still>0.5?0.:1.6*panel.y*(-.375+.375*phase);
  vec2 frame=vec2(panel.x,1.6*panel.y),size=sourceSize*max(frame.x/sourceSize.x,frame.y/sourceSize.y);
  vec2 p=screenUV*panel;
  vec2 uv=(p-vec2(0.,y)-(frame-size)*vec2(.52,.5))/size;
  float alpha=still>0.5?.8:clamp(phase*10.,0.,1.)*(1.-clamp((phase-.5)*10.,0.,1.));
  vec3 tex=texture2D(shaft,vec2(uv.x,1.-uv.y)).rgb;
  return mix(base,tex,alpha*available*step(y,p.y)*step(p.y,y+frame.y));
}
void main(){
  vec3 c=vec3(18.,43.,61.)/255.;
  c=strip(c,fract(seconds/12.+.5));c=strip(c,fract(seconds/12.));
  float shade=(1.-clamp(screenUV.y/.28,0.,1.))*170./255.+clamp((screenUV.y-.72)/.28,0.,1.)*179./255.;
  gl_FragColor=vec4(mix(c,vec3(7.,21.,32.)/255.,shade),1.);
}`;
const revealFragment=`precision highp float;varying vec2 screenUV;uniform sampler2D frame;uniform vec4 rect;uniform float opacity,hasFrame;
void main(){
  vec2 uv=(screenUV-rect.xy)/rect.zw;
  vec3 pixels=vec3(5.,12.,18.)/255.;
  if(hasFrame>.5&&all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.))))pixels=texture2D(frame,vec2(uv.x,1.-uv.y)).rgb;
  gl_FragColor=vec4(pixels,opacity);
}`;
function screenPass(fragmentShader,uniforms,transparent=false){
  const material=new RawShaderMaterial({vertexShader:fullVertex,fragmentShader,uniforms,depthTest:false,depthWrite:false,transparent});
  const mesh=new Mesh(new PlaneGeometry(2,2),material),scene=new Scene();mesh.frustumCulled=false;scene.add(mesh);
  return {scene,dispose(){mesh.geometry.dispose();material.dispose();}};
}
function layout(w,h,stageName,failed){
  const wide=w>h&&h<=500,pw=wide?Math.min(w,850):Math.min(w,h*.4626);
  const panel={x:(w-pw)/2,y:0,w:pw,h};
  const hangar=wide?{x:pw*.48,y:h*.15,w:pw*.50,h:h*.58}:{x:0,y:h*(failed?.23:.20),w:pw,h:h*(failed?.30:.54)};
  const text=wide?{x:pw*.06,w:pw*.40,top:h*.18,bottom:h*.80}:{x:pw*.09,w:pw*.82,top:h*.13,bottom:h*.85};
  return {panel,hangar,text,title:stageName};
}

export function createSortieViewForOutput(device,outputHost,aircraftId,stageName,redraw){
  const r=device.three,textures=new Map();
  const screenCamera=new Camera(),camera=new OrthographicCamera(0,1,0,1,-1,1);
  const platform=createThreeSurface(),labels=createThreeSurface(),front=new Scene(),equipment=new Scene();
  equipment.add(platform.group);front.add(labels.group);
  const shaft={shaft:{value:null},panel:{value:new Vector2()},sourceSize:{value:new Vector2(1,1)},seconds:{value:0},still:{value:0},available:{value:0}};
  const reveal={frame:{value:null},rect:{value:new Vector4(0,0,1,1)},opacity:{value:0},hasFrame:{value:0}};
  const environment=screenPass(shaftFragment,shaft),transition=screenPass(revealFragment,reveal,true);
  const oldVp=new Vector4(),oldSc=new Vector4(),oldColor=new Color(),output=new Vector4();
  let width=0,height=0,wPixels=0,hPixels=0,sceneLayout=null,key='',controls=[],titleNode=null;
  let deck=null,plane=null,planeY=0,disposed=false,artVersion=0,combatTarget=null,battleVisible=false;
  let hangarStart=null;

  function load(key,url,raw=false,fallbackUrl){
    const texture=artworkTexture(url,()=>{
      if(disposed)return;
      if(key==='shaft'){shaft.shaft.value=texture;shaft.sourceSize.value.set(texture.image.width,texture.image.height);}
      artVersion++;redraw();
    },()=>{if(!disposed&&fallbackUrl){texture.dispose();load(key,fallbackUrl,raw);}},key==='shaft'||key==='deck'?2:undefined);
    texture.colorSpace=raw?NoColorSpace:SRGBColorSpace;texture.minFilter=LinearMipmapLinearFilter;texture.magFilter=LinearFilter;
    textures.set(key,texture);
  }
  const base=import.meta.env.BASE_URL+'art/';
  load('shaft',base+'sortie-hangar-v1/shaft-section.webp',true,base+'psd-main-v1/main-background.png');
  load('deck',base+'sortie-hangar-v1/lift-front.webp');
  function paintButton(label,b,focus){
    const tex=textures.get(label==='返回'?'blue':'gold');
    if(tex?.image){
      const mesh=labels.image(tex,b.x,b.y,b.w,b.h);mesh.geometry.dispose();
      mesh.geometry=nineSliceGeometry(b.w,b.h,tex.image.width,tex.image.height,18,label==='返回'?13:9);
      if(focus)mesh.material.color.multiplyScalar(1.45);
    }
    const size=clamp(sceneLayout.panel.w*.04,14,18);
    labels.text(label,b.x+b.w/2,b.y+b.h/2,{size,family:'PsdPopup,"Microsoft YaHei",sans-serif',weight:400,color:'#fff',
      tracking:size*.03,align:'center',shadow:{color:label==='返回'?'#172a3c':'#81500a',y:label==='返回'?1:2,blur:label==='返回'?0:3}});
  }
  function rebuild(state){
    sceneLayout=layout(width,height,stageName,state.failed);
    const {panel,hangar,text}=sceneLayout,pw=panel.w;
    camera.right=pw;camera.bottom=height;camera.updateProjectionMatrix();
    shaft.panel.value.set(pw,height);labels.clear();platform.clear();controls=[];
    const deckWidth=hangar.w*.86,im=textures.get('deck').image;
    const deckHeight=deckWidth*(im?im.height/im.width:1/3);
    sceneLayout.deckHeight=deckHeight;const deckX=hangar.x+hangar.w*.07,hangarBottom=hangar.y+hangar.h;
    deck=im?platform.image(textures.get('deck'),deckX,hangarBottom-deckHeight,deckWidth,deckHeight):null;
    const p=sortieAircraftImageLayout(aircraftId,{width:hangar.w,height:hangar.h,deckHeight});
    if(!state.model&&!textures.has('plane'))load('plane',sortieAircraftImageUrl(aircraftId));
    const fallback=textures.get('plane');
    plane=!state.model&&fallback?.image?platform.image(fallback,hangar.x+p.left-p.width/2,hangarBottom-p.bottom-p.height,p.width,p.height):null;
    planeY=plane?.position.y??0;
    state.model?.resize(hangar.w,hangar.h,deckHeight,false);
    const size=clamp(pw*.055,19,26);
    titleNode=labels.text(stageName,text.x+text.w/2,text.top+9+size*.675,{size,weight:700,family:'"PingFang SC","Microsoft YaHei",sans-serif',
      color:'#f5fdff',align:'center',maxWidth:text.w,shadow:{color:'#071a28',y:2,blur:4}});
    if(state.failed){
      if(!textures.has('blue')){load('blue',base+'psd-buttons-v1/button-blue.png');load('gold',base+'psd-equipment-v1/button-gold.png');}
      const rowY=text.bottom-12-48,gap=10,bw=state.retry?(text.w-gap)/2:text.w;
      const status=labels.text(state.message,text.x+text.w/2,0,{size:16,weight:400,family:'"PingFang SC","Microsoft YaHei",sans-serif',
        color:'#ffd2c8',align:'center',wrap:true,maxWidth:text.w,lineHeight:21.6});
      status.position.y=rowY-22-status.userData.uiTextLines.length*10.8;
      const ids=state.retry?['back','retry']:['back'];
      controls=ids.map((id,index)=>({id,x:text.x+index*(bw+gap),y:rowY,w:bw,h:48}));
      for(const b of controls)paintButton(b.id==='back'?'返回':'重试',b,state.keyboard&&state.focus===b.id);
    }
    for(const surface of [platform,labels])surface.group.children.forEach((node,index)=>{node.renderOrder=index;});
  }
  function viewport(x,y,w,h){
    const scaleX=output.z/width,scaleY=output.w/height;
    const left=Math.round(x*scaleX),right=Math.round((x+w)*scaleX),bottom=Math.round((height-y-h)*scaleY),top=Math.round((height-y)*scaleY);
    r.setViewport(output.x+left,output.y+bottom,right-left,top-bottom);
  }
  function paint(state){
    if(disposed||device.cover!==view)return;
    const rect=outputHost.bounds();if(!rect.width||!rect.height)return;
    width=rect.width;height=rect.height;
    const ratio=Math.min(outputHost.density(),Math.max(1,(outputHost.maxRenderHeight??1672)/height));
    wPixels=Math.max(540,Math.round(width*ratio));hPixels=Math.max(960,Math.round(height*ratio));
    const signature=[width,height,state.failed,state.message&&state.failed?state.message:'',state.retry,state.focus,state.keyboard,!!state.model,artVersion].join('|');
    if(signature!==key){key=signature;rebuild(state);}
    const {panel,hangar,deckHeight}=sceneLayout;
    const hangarReady=Boolean(deck&&textures.get('shaft')?.image);
    if(hangarReady&&!hangarStart)hangarStart={seconds:state.seconds,modelSeconds:state.modelSeconds};
    const seconds=hangarStart?Math.max(0,state.seconds-hangarStart.seconds):0;
    const modelSeconds=hangarStart?Math.max(0,state.modelSeconds-hangarStart.modelSeconds):0;
    const target=r.getRenderTarget(),clipped=r.getScissorTest(),clear=r.autoClear,alpha=r.getClearAlpha(),tone=r.toneMapping,exposure=r.toneMappingExposure;
    r.getViewport(oldVp);r.getScissor(oldSc);r.getClearColor(oldColor);
    try{
      output.copy(outputHost.begin(wPixels,hPixels,redraw));
      r.autoClear=false;r.setClearColor(0x071520,1);r.clear();
      viewport(panel.x,0,panel.w,height);shaft.still.value=Number(state.reduced);shaft.seconds.value=seconds;
      shaft.available.value=Number(hangarReady);
      r.render(environment.scene,screenCamera);
      const pose=hangarPose(state.animatePlaceholder?seconds:modelSeconds,state.reduced);
      const distance=state.model||state.animatePlaceholder?hangar.h*.325*pose.lift:0;
      if(deck)deck.position.y=hangar.y+hangar.h-deckHeight/2-distance;
      if(plane){
        plane.visible=!state.model;
        plane.position.y=planeY-distance;
        if(state.animatePlaceholder&&!state.reduced)plane.rotation.y=.38*Math.sin(pose.yaw*2);
      }
      if(hangarReady)r.render(equipment,camera);
      if(hangarReady&&state.model){
        viewport(panel.x+hangar.x,hangar.y-distance,hangar.w,hangar.h);
        r.clearDepth();r.toneMapping=ACESFilmicToneMapping;r.toneMappingExposure=AIRCRAFT_RENDER_STYLE.exposure;
        state.model.draw(modelSeconds,state.reduced);
        viewport(panel.x,0,panel.w,height);
      }
      titleNode.material.opacity=hangarReady?state.titleOpacity:1;r.render(front,camera);
      if(state.reveal>0){
        const b=device.battle?.bounds?.();
        if(b)reveal.rect.value.set((b.x-rect.x)/width,(b.y-rect.y)/height,b.width/width,b.height/height);
        reveal.frame.value=combatTarget?.texture||null;reveal.hasFrame.value=Number(battleVisible&&!!b&&b.width>0&&b.height>0);
        reveal.opacity.value=state.reveal;viewport(0,0,width,height);r.render(transition.scene,screenCamera);
      }
    }finally{
      r.setRenderTarget(target);r.setViewport(oldVp);r.setScissor(oldSc);r.setScissorTest(clipped);r.setClearColor(oldColor,alpha);
      r.autoClear=clear;r.toneMapping=tone;r.toneMappingExposure=exposure;
    }
  }
  const view={
    paint,hit(x,y){const b=outputHost.bounds();x-=b.x+(sceneLayout?.panel.x||0);y-=b.y;
      return controls.find(c=>x>=c.x&&y>=c.y&&x<=c.x+c.w&&y<=c.y+c.h)?.id;},
    get battleTarget(){return combatTarget??=new WebGLRenderTarget(540,960,{minFilter:LinearFilter,magFilter:LinearFilter,depthBuffer:true});},
    present(){battleVisible=true;redraw(true);},
    close(){
      if(disposed)return;disposed=true;
      for(const t of textures.values())t.dispose();platform.clear();labels.clear();environment.dispose();transition.dispose();combatTarget?.dispose();
      if(device.cover!==view)return;device.cover=null;
      outputHost.release();
      if(device.battle)device.battle.show();else device.repaintHome?.();
    }
  };
  device.cover=view;return view;
}


export function createSortieView(device,host,aircraftId,stageName,redraw){
  const canvas=device.display.input;
  const css=canvas.getAttribute('style'),className=canvas.className;
  const attrNames=['role','aria-label','aria-description','tabindex'];
  const attrs=attrNames.map(k=>canvas.getAttribute(k));
  host.append(canvas);canvas.className='three-sortie-canvas';canvas.style.cssText='position:absolute;inset:0;display:block;width:100%;height:100%;outline:none;touch-action:none;pointer-events:auto';
  canvas.tabIndex=0;canvas.setAttribute('role','application');canvas.setAttribute('aria-label','出击准备');
  const outputHost={bounds:()=>host.getBoundingClientRect(),density:()=>globalThis.devicePixelRatio||1,
    begin:(w,h,request)=>device.display.begin(host,w,h,request,true),
    release(){
      for(let i=0;i<attrNames.length;i++){if(attrs[i]===null)canvas.removeAttribute(attrNames[i]);else canvas.setAttribute(attrNames[i],attrs[i]);}
      canvas.className=className;if(css===null)canvas.removeAttribute('style');else canvas.setAttribute('style',css);
      if(!device.battle)device.home.append(canvas);
    }};
  return createSortieViewForOutput(device,outputHost,aircraftId,stageName,redraw);
}
