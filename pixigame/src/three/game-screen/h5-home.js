import {createHomeStage,homePictures,viewportPixel} from './home-stage.js';
import {WebGLRenderTarget,Vector4,LinearFilter} from 'three';
import {createHomeHud} from './three-home-hud.js';
import {optimizeUiAssetUrls} from '../../ui/ui-image-source.js';

export function bindH5Home(canvas,renderer,redraw,device) {
  const host=canvas.closest('.psd-main-portrait[data-character-portrait]');
  const page=host?.closest('.psd-main-page');
  if(!page)return null;
  const images=new Map(),nodes=new Map(),listeners=new AbortController();
  let stage=null,hud=null,removeStateListener=null,guideObserver=null,obs=null,style=null,released=false,queued=0,viewport=null,target=null;
  const masked=new Set(),shell=page.closest('.pl-shell');
  const actorBox=new Vector4();
  const schedule=()=>{if(!released&&!queued)queued=requestAnimationFrame(()=>{queued=0;redraw();});};
  const position=()=>{
    const p=page.getBoundingClientRect(),h=host.getBoundingClientRect();
    if(!p.width||!p.height||!h.width||!h.height)return;
    const ratio=window.devicePixelRatio||1,x0=viewportPixel(p.x,ratio),y0=viewportPixel(p.y,ratio);
    const wNative=viewportPixel(p.right,ratio)-x0,hNative=viewportPixel(p.bottom,ratio)-y0;
    if(!wNative||!hNative)return;
    viewport={width:p.width,height:p.height,left:p.left,top:p.top,ratio,wNative,hNative};
    const x=viewportPixel(h.x,ratio),r=viewportPixel(h.right,ratio),y=viewportPixel(h.y,ratio),b=viewportPixel(h.bottom,ratio);
    actorBox.set((x-x0)*750/wNative,(y-y0)*1624/hNative,(r-x)*750/wNative,(b-y)*1624/hNative);
    if(!stage)return;
    stage.layout(viewport);
    hud?.layout(viewport);
    Object.assign(canvas.style,{left:(x0/ratio-h.x)+'px',top:(y0/ratio-h.y)+'px',right:'auto',bottom:'auto',
      width:(wNative/ratio)+'px',height:(hNative/ratio)+'px',objectFit:'fill'});
  };
  function loadImage(url){
    return new Promise((resolve,reject)=>{
      const image=new Image();image.onload=()=>resolve(image);
      image.onerror=()=>reject(Error('大厅美术加载失败 '+url));image.src=url;
    });
  }
  const artReady=Promise.all(homePictures.map(async ([id,file,,,authoredSelector])=>{
    const path=file.startsWith('/')?file:'/art/psd-main-v1/'+file;
    const selector=authoredSelector||(id==='background'?'.psd-main-composite:not(.psd-main-shades)':id==='shade'?'.psd-main-shades':id==='chapter-title'?'.psd-main-chapter-frame, .psd-hit-chapter-title .psd-main-face-art':'.psd-hit-'+id+' .psd-main-face-art');
    const oldPicture=page.querySelector(selector);
    if(oldPicture)nodes.set(id,oldPicture);
    const image=await loadImage(optimizeUiAssetUrls(path));
    if(!released)images.set(id,image);
  }));
  const sizeWatch=new ResizeObserver(()=>{position();schedule();});sizeWatch.observe(page);sizeWatch.observe(host);
  function state(){
    const nav=shell?.querySelector('.pl-nav');
    return {...device.homeState,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,
      safeBottom:nav?parseFloat(getComputedStyle(nav).paddingBottom)||0:0};
  }
  const mask=node=>{if(node&&!masked.has(node)){node.setAttribute('data-three-home-hud','');masked.add(node);}};
  function syncHud(){
    if(!hud||!page.isConnected)return;
    hud.updateModel(state());
    for(const node of page.querySelectorAll('.psd-main-avatar,.psd-main-identity,.psd-main-chapter-copy,.psd-main-star-total,.psd-main-star-chest,.psd-main-affection,.psd-main-developer,[data-patrol-clock="home"],.lobby-resource-amount'))mask(node);
    mask(shell?.querySelector('.pl-nav'));
    for(const node of shell?.querySelectorAll('.lobby-resource-amount')||[])mask(node);
    schedule();
  }
  let guideLayer=null;
  function syncGuide(){
    if(!hud||!viewport||!guideLayer)return;
    const show=guideLayer.isConnected&&!guideLayer.hidden&&!guideLayer.classList.contains('is-strong');
    const label=guideLayer.querySelector('.guide-message')?.textContent,start=page.querySelector('.psd-hit-start');
    if(show&&label&&start){
      const b=start.getBoundingClientRect(),v=viewport;
      hud.setGuide({text:label,target:[(b.x-v.left)*750/v.width,(b.y-v.top)*1624/v.height,b.width*750/v.width,b.height*1624/v.height],reduced:matchMedia('(prefers-reduced-motion: reduce)').matches});
      mask(guideLayer);
    }else{
      hud.setGuide(null);if(masked.delete(guideLayer))guideLayer.removeAttribute('data-three-home-hud');
    }
  }
  async function attachHud(){
    const result=await createHomeHud(loadImage,state(),schedule);
    if(released||!page.isConnected){result.dispose();return;}
    hud=result;if(viewport)hud.layout(viewport);syncHud();
    removeStateListener=device.subscribeHome(syncHud);
    guideLayer=document.querySelector('.lobby-guide');
    if(guideLayer){guideObserver=new MutationObserver(()=>{syncGuide();schedule();});guideObserver.observe(guideLayer,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','hidden','data-group']});syncGuide();}
    page.dataset.threeHud='ready';schedule();
  }
  function scaleFor(face){
    // Old and new H5 controllers animate the same authored scalar.
    const value=parseFloat(face.style.scale||'1');
    if(Number.isFinite(value)&&value!==1)return value;
    const match=/scale\(([\d.]+)\)/.exec(face.style.transform);
    return match?Number(match[1]):1;
  }
  function mount(){
    if(released||stage||!page.isConnected)return;
    stage=createHomeStage(images);
    host.dataset.threeHome='active';
    const scenery=host.querySelector('.character-portrait-scene');
    if(scenery){
      const attach=()=>{if(released||!scenery.naturalWidth)return;stage.setPortraitScenery(scenery);mask(scenery);schedule();};
      if(scenery.complete)attach();else scenery.addEventListener('load',attach,{once:true,signal:listeners.signal});
    }
    // Opacity preserves semantic bounds, onboarding anchors and focus; it also
    // prevents the old images being composited over the newly drawn textures.
    for(const node of nodes.values())node.setAttribute('data-three-home-picture','');
    style=document.createElement('style');
    style.textContent='[data-three-home="active"]{overflow:visible!important}[data-three-home-picture],[data-three-home-hud]{opacity:0!important}';
    host.appendChild(style);
    const faces=new Map();
    function syncFace(face){
      const scale=scaleFor(face),brightness=/brightness\(([\d.]+)\)/.exec(getComputedStyle(face).filter);
      for(const id of faces.get(face)){
        stage.setButtonScale(id,scale);
        const locked=id==='patrol'&&!!face.closest('[data-chapter-locked]');
        stage.setGrade(id,locked?1:0,(locked ? 0.65 : 1)*(brightness?Number(brightness[1]):1));
      }
    }
    for(const [id,node] of nodes){
      const face=node.closest('.psd-main-face,.lobby-resource-bar');
      if(face){
        const ids=faces.get(face)||[];ids.push(id);faces.set(face,ids);
      }
    }
    obs=new MutationObserver(rows=>{for(const row of rows){if(faces.has(row.target))syncFace(row.target);}schedule();});
    for(const face of faces.keys()){
      syncFace(face);obs.observe(face,{attributes:true,attributeFilter:['style']});
      if(face.matches('.lobby-resource-bar'))for(const event of ['pointerdown','pointerup','pointercancel','pointerleave']){
        face.parentElement.addEventListener(event,()=>{requestAnimationFrame(()=>{if(!released){syncFace(face);schedule();}});},{signal:listeners.signal,passive:true});
      }
    }
    position();schedule();attachHud().catch(e=>{if(!released)console.error(e);});
  }
  artReady.then(mount).catch(error=>{if(!released)console.error(error);});
  position();
  return {
    owns:()=>host.contains(canvas)&&page.isConnected,
    position,
    get ready(){return !!stage&&!!viewport;},
    draw(pixelsWide,pixelsHigh,paint,newPose){
      const {wNative,hNative}=viewport;
      if(canvas.width!==wNative||canvas.height!==hNative)renderer.setSize(wNative,hNative,false);
      if(!target){target=new WebGLRenderTarget(pixelsWide,pixelsHigh,{depthBuffer:false,stencilBuffer:false,minFilter:LinearFilter});newPose=true;}
      else if(target.width!==pixelsWide||target.height!==pixelsHigh){target.setSize(pixelsWide,pixelsHigh);newPose=true;}
      if(newPose){
        renderer.setRenderTarget(target);renderer.clear();
        try{paint();}finally{renderer.setRenderTarget(null);}
      }
      renderer.setViewport(0,0,wNative,hNative);renderer.clear();stage.drawBehind(renderer);
      stage.drawCharacter(renderer,target.texture,actorBox);stage.drawInFront(renderer);
      if(hud){hud.paint(renderer,performance.now()/1000);}
    },
    dispose(){
      released=true;cancelAnimationFrame(queued);listeners.abort();sizeWatch.disconnect();obs?.disconnect();removeStateListener?.();guideObserver?.disconnect();
      for(const node of masked)node.removeAttribute('data-three-home-hud');masked.clear();hud?.dispose();delete page.dataset.threeHud;
      for(const node of nodes.values())node.removeAttribute('data-three-home-picture');
      delete host.dataset.threeHome;
      style?.remove();stage?.dispose();target?.dispose();
      if(host.contains(canvas))Object.assign(canvas.style,{left:'0',top:'0',right:'0',bottom:'0',width:'100%',height:'100%'});
    }
  };
}
