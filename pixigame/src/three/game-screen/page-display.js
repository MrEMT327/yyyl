import {Color,Vector2,Vector4} from 'three';

// One physical backbuffer. Each view provides its design resolution and an input
// region in CSS pixels. Letterboxing and the diagnostics use the same renderer.
export function createPageDisplay(renderer){
  const canvas=renderer.domElement,input=document.createElement('div'),viewport=new Vector4(),size=new Vector2(),color=new Color();
  canvas.className='three-page-output';canvas.setAttribute('aria-hidden','true');
  canvas.style.cssText='position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;display:block;pointer-events:none;z-index:2147483647';
  document.body.append(canvas);
  const gl=renderer.getContext(),limits=gl.getParameter(gl.MAX_VIEWPORT_DIMS);
  let width=1,height=1,request=null,diagnostics=null,covered=true;
  const display={
    input,canvas,
    begin(region,w,h,refresh,cover=false){
      const b=region.getBoundingClientRect(),page=canvas.getBoundingClientRect();
      if(!b.width||!b.height||!page.width||!page.height)return viewport.set(0,0,0,0);
      width=page.width;height=page.height;request=refresh;covered=cover;
      const sx=Math.min(w/b.width,limits[0]/width),sy=Math.min(h/b.height,limits[1]/height);
      const bw=Math.max(1,Math.round(width*sx)),bh=Math.max(1,Math.round(height*sy));
      if(renderer.getPixelRatio()!==1)renderer.setPixelRatio(1);
      if(canvas.width!==bw||canvas.height!==bh)renderer.setSize(bw,bh,false);
      const x=v=>Math.round((v-page.x)*bw/width),y=v=>bh-Math.round((v-page.y)*bh/height);
      viewport.set(x(b.left),y(b.bottom),x(b.right)-x(b.left),y(b.top)-y(b.bottom));
      renderer.setRenderTarget(null);renderer.setScissorTest(false);
      renderer.getClearColor(color);const alpha=renderer.getClearAlpha();renderer.setClearColor(0,0);renderer.clear();renderer.setClearColor(color,alpha);
      renderer.setViewport(viewport);renderer.setScissor(viewport);renderer.setScissorTest(true);
      return viewport;
    },
    present(){
      if(!diagnostics||covered)return;
      const clear=renderer.autoClear;renderer.autoClear=false;
      renderer.getSize(size);renderer.setViewport(0,0,size.x,size.y);renderer.setScissorTest(false);
      try{diagnostics.draw(width,height,size.x,size.y);}
      finally{renderer.setViewport(viewport);renderer.setScissor(viewport);renderer.setScissorTest(true);renderer.autoClear=clear;}
    },
    refresh(){request?.();},attach(view){diagnostics=view;request?.();},
    close(){diagnostics?.destroy();canvas.remove();input.remove();request=diagnostics=null;}
  };
  return display;
}
