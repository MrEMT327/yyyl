import {LinearFilter,OrthographicCamera,Scene,SRGBColorSpace} from 'three';
import {artworkTexture} from './image-loading.js';
import {createThreeSurface} from '../../ui/three-surface.js';
import {slicedFrameGeometry} from '../../ui/nine-slice-geometry.js';
import {clamp,words} from './menu-art.js';
import art from './utility-art.json';

export function createLobbyToast(request,{now=()=>performance.now(),reducedMotion}={}){
  let skin=null,message='',entered=0,width=0,skinReady=false,closed=false;
  const camera=new OrthographicCamera(0,1,0,1,-10,10),scene=new Scene(),surface=createThreeSurface();
  const reduced=reducedMotion?{get matches(){return reducedMotion();}}:matchMedia('(prefers-reduced-motion:reduce)');scene.add(surface.group);
  function reset(){surface.clear();surface.group.position.set(0,0,0);surface.group.scale.set(1,1,1);width=0;}
  return {get message(){return message;},show(value){
    if(!value)return;message=String(value);entered=now()/1000;reset();
    if(!skin){skin=artworkTexture(art.toast,()=>{if(closed)return;skinReady=true;request();},()=>{});
      skin.colorSpace=SRGBColorSpace;skin.minFilter=LinearFilter;}
    request();
  },draw(renderer,w,h){
    if(!message||closed||!w||!h)return;
    const phase=(now()/1000-entered)/2.667;
    if(phase>=1){message='';reset();return;}
    if(width!==w){
      reset();width=w;const sw=.9259*w,sz=clamp(.0426*w,12,23),text=words(surface,message,0,0,sz,{align:'center',color:'#fff',maxWidth:sw-.10*w,wrap:true,lineHeight:1.5*sz,weight:600,outline:'#10161a'});
      const height=Math.max(.098*w,text.userData.uiTextLines.length*1.5*sz+.04*w);
      const back=surface.image(skin,-sw/2,-height/2,sw,height);back.geometry.dispose();back.geometry=slicedFrameGeometry(sw,height,2145,200,[48,130,48,130],[8,22,8,22]);back.renderOrder=-1;back.userData.skin=true;
      surface.group.userData.centerY=.46296*w+height/2;
    }
    const scale=reduced.matches?1:phase<.0625?.8+.3*phase/.0625:phase<.125?1.1-.1*(phase-.0625)/.0625:1;
    const progress=reduced.matches?0:clamp((phase-.44375)/(.975-.44375),0,1);
    const opacity=clamp((.975-phase)/(.975-.69375),0,1);
    for(const m of surface.group.children){m.material.opacity=opacity;m.visible=!m.userData.skin||skinReady;}
    surface.group.scale.set(scale,scale,1);surface.group.position.set(w/2,surface.group.userData.centerY-.18519*w*progress,0);
    camera.right=w;camera.bottom=h;camera.updateProjectionMatrix();const clear=renderer.autoClear;renderer.autoClear=false;
    try{renderer.render(scene,camera);}finally{renderer.autoClear=clear;}request();
  },clear(){message='';reset();},close(){closed=true;skin?.dispose();surface.clear();}};
}

