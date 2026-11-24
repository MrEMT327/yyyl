import * as T from 'three';
import {createPortraitSurface} from './three-portrait-surface.js';
export function mountH5Portrait(canvas,manifest,textures,monitor,device) {
  return mountPortraitSurface(canvas,monitor,device,renderer=>createPortraitSurface(renderer,manifest,textures));
}

// Animated meshes and decoded video frames share the lobby compositor, viewport and screen.
export function mountPortraitSurface(canvas,monitor,device,createSurface) {
  const renderer=device.three;
  let surface=null,home=null,pose=null,closed=false;
  let pixelsWide=canvas.width,pixelsHigh=canvas.height;
  function prepare(){
    const next=device.homeView?.owns(canvas)?device.homeView:device.menuView?.owns?.(canvas)?device.menuView:null;
    if(next!==home){home?.forget(canvas);home=next;}
    if(closed||!home)return false;
    canvas.style.display='none';
    surface??=createSurface(renderer);
    return true;
  }
  function draw(newPose=false){
    if(!pose||!prepare())return;
    home.setPose(canvas,pixelsWide,pixelsHigh,()=>surface.draw(...pose,pixelsWide,pixelsHigh),newPose);
    canvas[Symbol.for('shnh.ownedCanvasFrame')]?.();
  }
  return {
    get canvas(){return renderer.domElement;},
    draw(...frame){
      pose=frame;draw(true);
    },
    resize(w,h){
      w=Math.max(1,Math.round(w));h=Math.max(1,Math.round(h));
      prepare();
      if(w===pixelsWide&&h===pixelsHigh)return false;
      pixelsWide=w;pixelsHigh=h;return true;
    },
    captureFrame(size){
      if(!Number.isFinite(size)||size<1)throw RangeError('导出尺寸必须是正数');
      if(!pose||!surface)return null;
      const side=Math.round(size),pixels=new Uint8Array(side*side*4);
      const target=new T.WebGLRenderTarget(side,side,{depthBuffer:false,stencilBuffer:false});
      const old=renderer.getRenderTarget(),oldColor=renderer.getClearColor(new T.Color()),oldAlpha=renderer.getClearAlpha();
      try{
        renderer.setRenderTarget(target);renderer.setClearColor(0,0);renderer.clear();
        surface.draw(...pose,side,side);
        renderer.readRenderTargetPixels(target,0,0,side,side,pixels);
      }finally{renderer.setRenderTarget(old);renderer.setClearColor(oldColor,oldAlpha);target.dispose();}
      // PNG encoding is an explicit export. The game never reads a framebuffer
      // to composite the character or draws a frame using a 2D canvas.
      const bitmap=document.createElement('canvas');bitmap.width=bitmap.height=side;
      const ctx=bitmap.getContext('2d'),image=ctx.createImageData(side,side);
      for(let y=0;y<side;y++)for(let x=0;x<side;x++){
        const from=((side-y-1)*side+x)*4,to=(y*side+x)*4,alpha=pixels[from+3];
        if(alpha)for(let c=0;c<3;c++)image.data[to+c]=pixels[from+c]*255/alpha;
        image.data[to+3]=alpha;
      }
      ctx.putImageData(image,0,0);return bitmap.toDataURL('image/png');
    },
    destroy(){
      closed=true;pose=null;
      home?.forget(canvas);home=null;surface?.dispose();
      delete canvas.dataset.threePortrait;
    }
  };
}
