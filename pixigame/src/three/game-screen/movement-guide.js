import {OrthographicCamera,Scene,SRGBColorSpace,LinearFilter} from 'three';
import {artworkTexture} from './image-loading.js';
import {createThreeSurface} from '../../ui/three-surface.js';
import {nineSliceGeometry} from '../../ui/nine-slice-geometry.js';
import {optimizeUiAssetUrls} from '../../ui/ui-image-source.js';
import art from './home-art.json';

// First-sortie movement lesson. Simulation controls when it appears and when input dismisses it.
export function createThreeMovementGuide(renderer,canvas=renderer.domElement,{bounds=()=>canvas.getBoundingClientRect(),now=()=>performance.now(),reducedMotion}={}){
  const scene=new Scene(),camera=new OrthographicCamera(0,1,0,1,-2,2);
  const hint='滑动屏幕，操作飞机';
  const motion=reducedMotion?{get matches(){return reducedMotion();}}:matchMedia('(prefers-reduced-motion: reduce)');
  let visible=false,closed=false,textures=null,surface=null,nodes=null,width=0,height=0,started=0;
  function load(url){const t=artworkTexture(optimizeUiAssetUrls(url),undefined,()=>{});t.colorSpace=SRGBColorSpace;t.minFilter=LinearFilter;t.generateMipmaps=false;return t;}
  function layout(w,h){
    if(surface){surface.destroy();scene.remove(surface.group);}
    surface=createThreeSurface();scene.add(surface.group);
    width=w;height=h;camera.right=w;camera.bottom=h;camera.updateProjectionMatrix();
    const gw=Math.min(360,w*.92),x=(w-gw)/2,y=h*.42,mascot=Math.max(100,Math.min(132,gw*.36));
    const panelW=gw-mascot*.66,by=y+(mascot+12-76)/2,bx=x+mascot*.66;
    // Native source plate uses a 64px border-image slice with 18px corners.
    const bubble=surface.image(textures.bubble,bx,by,panelW,76);
    bubble.geometry.dispose();const im=textures.bubble.image;
    bubble.geometry=nineSliceGeometry(panelW,76,im.width,im.height,64,18);
    const bot=surface.image(textures.bot,x,y+6,mascot,mascot);bot.material.map.repeat.set(.25,1);
    surface.text('滑动屏幕，操作飞机',bx+mascot*.30,by+18+10.85,{size:14,maxWidth:panelW-mascot*.30-18,weight:600,align:'left',color:'#233b53',family:'"Microsoft YaHei",sans-serif',wrap:true,lineHeight:21.7});
    const cy=y+mascot+12+8+16,arrows=[];
    for(let i=0;i<2;i++){
      const img=textures.cue.image,visibleH=Math.min(1,16/40*img.width/img.height);
      const arrow=surface.image(textures.cue,w/2-20,cy-8,40,16,{x:0,y:(1-visibleH)/2,width:1,height:visibleH});
      arrow.rotation.z=-Math.PI/2;arrows.push(arrow);
    }
    nodes={bot,y:y+6+mascot/2,arrows};
  }
  return {
    show(value){
      if(closed||visible===Boolean(value))return;
      visible=Boolean(value);
      if(visible){
        canvas?.setAttribute?.('aria-description',hint);
        started=now()/1000;
        textures??={bot:load('/art/onboarding-assistant-v1/expressions.png'),bubble:load('/art/onboarding-dialogue-v2/panel.webp'),cue:load(art.pointer)};
      }else if(canvas?.getAttribute?.('aria-description')===hint)canvas.removeAttribute('aria-description');
    },
    get visible(){return visible;},
    draw(){
      if(!visible||closed||!Object.values(textures).every(t=>t.image?.width))return;
      const {width:w,height:h}=bounds();if(!w||!h)return;
      if(!nodes||width!==w||height!==h)layout(w,h);
      const elapsed=motion.matches?0:now()/1000-started,phase=elapsed/4.8%1;
      const frame=phase>=.14&&phase<.20||phase>=.28&&phase<.34?3:phase>=.62&&phase<.64||phase>=.67&&phase<.69?1:phase>=.64&&phase<.67?2:0;
      nodes.bot.material.map.offset.x=frame/4;nodes.bot.position.y=nodes.y-1.5*(1-Math.cos(elapsed*2*Math.PI/3));
      const sweep=motion.matches?0:-28*Math.cos(elapsed*2*Math.PI/1.6);
      nodes.arrows.forEach((m,i)=>{m.position.x=w/2+sweep+(i-.5)*16;});
      renderer.render(scene,camera);
    },
    destroy(){
      if(canvas?.getAttribute?.('aria-description')===hint)canvas.removeAttribute('aria-description');
      closed=true;visible=false;surface?.destroy();scene.clear();
      if(textures)for(const t of Object.values(textures))t.dispose();
    },
  };
}

