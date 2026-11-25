import {artworkSize,loadArtwork} from './image-loading.js';
import {OrthographicCamera,Scene,Texture,Vector4,SRGBColorSpace,LinearFilter,LinearMipmapLinearFilter} from 'three';
import {createSurfaceTextCache,createThreeSurface} from '../../ui/three-surface.js';
import {optimizeUiAssetUrls} from '../../ui/ui-image-source.js';

const panelSources=new WeakMap();
// Keep small icons available for back navigation without retaining whole screens of portraits.
const unusedArtworkPixels=512*1024;
const inside=(r,x,y)=>r&&x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;
const limit=(n,min,max)=>Math.max(min,Math.min(max,n));
function intersection(a,b){
  const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y);
  return {x,y,w:Math.max(0,Math.min(a.x+a.w,b.x+b.w)-x),h:Math.max(0,Math.min(a.y+a.h,b.y+b.h)-y)};
}

function browserPanelInput(screen,host,name,main) {
  const surface=main?screen.display.input:document.createElement('div');
  const abort=new AbortController(),signal=abort.signal,options={signal};
  surface.tabIndex=0;surface.setAttribute('role',main?'application':'dialog');
  if(!main)surface.setAttribute('aria-modal','true');
  surface.setAttribute('aria-label',name);
  surface.style.cssText='position:absolute;inset:0;pointer-events:auto;touch-action:none;outline:none';
  if(main){surface.className='three-menu-screen';Object.assign(surface.style,{width:'100%',height:'100%',display:'block'});}
  host.replaceChildren(surface);
  return {
    surface, overlay:host.dataset.rewardLayer==='overlay',
    bounds:()=>surface.getBoundingClientRect(),
    frameBounds:()=>screen.display.input.getBoundingClientRect(),
    requestFrame:fn=>requestAnimationFrame(fn),cancelFrame:id=>cancelAnimationFrame(id),now:()=>performance.now(),
    focus:()=>surface.focus({preventScroll:true}),label:value=>surface.setAttribute('aria-label',value),
    bind({begin,move,end,commit,cancel,wheel,key}){
      surface.addEventListener('pointerdown',event=>{
        if(event.button>0||event.target?.tagName==='INPUT'||!begin(event.clientX,event.clientY,event.pointerId))return;
        surface.focus({preventScroll:true});surface.setPointerCapture(event.pointerId);event.preventDefault();
      },options);
      surface.addEventListener('pointermove',event=>move(event.clientX,event.clientY,event.pointerId),options);
      surface.addEventListener('pointerup',event=>end(event.clientX,event.clientY,event.pointerId),options);
      surface.addEventListener('click',event=>{if(commit())event.stopPropagation();},options);
      surface.addEventListener('pointercancel',cancel,options);
      surface.addEventListener('wheel',wheel,{passive:false,signal});
      surface.addEventListener('keydown',key,options);
    },
    watch(update){
      const observer=new ResizeObserver(update);observer.observe(surface);
      document.fonts?.load('16px PsdPopup').then(update).catch(()=>{});
      return ()=>observer.disconnect();
    },
    editNumber(action,update){
      const field=document.createElement('input');field.type='text';field.inputMode='numeric';field.pattern='[0-9]*';
      field.value=String(action.value);field.setAttribute('aria-label',action.label);
      field.style.cssText='position:absolute;width:1px;height:1px;opacity:0;pointer-events:none';
      surface.append(field);field.focus();field.select();
      field.addEventListener('input',()=>update(field.value),options);
      field.addEventListener('blur',()=>field.remove(),{once:true,signal});
      field.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key==='Escape'){event.stopPropagation();event.preventDefault();surface.focus();}
      },options);
      return ()=>field.remove();
    },
    close(){abort.abort();if(!main)surface.remove();},
  };
}

// A panel paints above the retained lobby scene on the same Three device.
// Its transparent H5 focus target only delivers pointer, wheel and IME input.
export function createLobbyPanel(screen,host,name,layout,onAction,{main=false,overlay=false,battle=false,fullscreen=false,onScroll,repaint,
  prepareArtwork,entryWaitMs=120,deferInput=false,progressive=Boolean(prepareArtwork),artworkVisible,backgroundPriority=-1,interactive=()=>true,allows=()=>true,handlesKey=()=>true}={}){
  const nativeInput=screen.createPanelInput?.(host,name,{main,overlay,battle});
  const input=nativeInput||browserPanelInput(screen,host,name,main);
  const underlay=overlay||input.overlay?screen.panel:null;
  const surface=input.surface,camera=new OrthographicCamera(0,1,0,1,-10,10),textures=new Map();
  const layers=[],controls=[],animations=[],frameEffects=[],pressEffects=[],regions=new Map(),activeRegions=new Set(),anchors=new Map(),scissor=new Vector4(),viewport=new Vector4();
  let data=null,dirty=true,closed=false,redraw=0,press=null,clickTarget=null,focusId=null,keyboard=false,field=null;
  let pendingArt=false,prevW=0,prevH=0,prevFrame=null,activeScope='base',identity='',artBatch=null;
  let compiledLayers=0;
  let parked=Boolean(prepareArtwork),entering=null,staging=parked,artChanged=false,groupLateArtwork=false;
  const tracksArtwork=Boolean(repaint||prepareArtwork);
  const currentArtwork=new Set(),deferredArtwork=new Set(),decodedArtwork=new Map();
  const layoutArtwork=new Set(),imageUpdates=new Map(),artworkPriorities=new Map();
  const canUpdateImage=texture=>imageUpdates.has(texture)&&!layoutArtwork.has(texture);
  const batchesArtwork=()=>!staging&&(progressive||data?.prioritizedArtwork);
  const mayInstall=t=>currentArtwork.has(t)&&!deferredArtwork.has(t)&&(dirty||artBatch===null||canUpdateImage(t));
  const textCache=progressive?createSurfaceTextCache():null;
  const textureReady=t=>Boolean(t.image||t.userData.failed);
  let guideTarget=null;
  const allowed=id=>allows(id)&&(!guideTarget||guideTarget===id);
  function request(rebuild=false){
    if(closed)return;
    dirty=dirty||rebuild;
    if(parked)return;
    if(repaint)repaint();
    else if(!battle&&!redraw)redraw=input.requestFrame(()=>{redraw=0;if(!closed)screen.repaintHome?.();});
  }
  function layer(key,clip=null,index=layers.length){
    const scene=new Scene(),art=createThreeSurface({textCache}),p={key,scene,art,clip};
    scene.add(art.group);layers.splice(index,0,p);return p;
  }
  function region(key,rect,length,axis='y',{parent=null,initial=0,redrawStep=0,scrollTo}={}){
    activeRegions.add(key);
    const prev=regions.get(key);
    const row={rect,axis,parent,redrawStep,max:Math.max(0,length-(axis==='x'?rect.w:rect.h)),offset:scrollTo??prev?.offset??initial};
    row.offset=limit(row.offset,0,row.max);regions.set(key,row);
  }
  function scrollWindow(key){
    const {rect,axis,offset,redrawStep}=regions.get(key);
    if(!redrawStep)return null;
    // Draw through the end of this scroll step so a drag can reuse the scene.
    const start=Math.floor(offset/redrawStep)*redrawStep;
    if(axis==='x'){
      const left=rect.x+start;
      return {left,right:left+rect.w+redrawStep};
    }
    const top=rect.y+start;
    return {top,bottom:top+rect.h+redrawStep};
  }
  function placement(zone){
    if(!zone)return {dx:0,dy:0,clip:null};
    const parent=placement(regions.get(zone.parent)),rect={...zone.rect,x:zone.rect.x-parent.dx,y:zone.rect.y-parent.dy};
    return {dx:parent.dx+(zone.axis==='x'?zone.offset:0),dy:parent.dy+(zone.axis==='y'?zone.offset:0),
      clip:parent.clip?intersection(parent.clip,rect):rect};
  }
  function control(id,label,rect,action,{zone=null,scope='base',disabled=false,trackPointer=false,onPoint,onKey}={}){
    controls.push({id,label,...rect,action,zone,scope,disabled,trackPointer,onPoint,onKey});
  }
  function installImage(t,image,inPlace=false){
    if(image){
      const shared=panelSources.get(image);
      // Mark the new texture before sharing the source so an already uploaded
      // image keeps its version. Three owns the GPU reference counts.
      t.needsUpdate=true;
      if(shared)t.source=shared;
      else{t.image=image;panelSources.set(image,t.source);}
    }else t.userData.failed=true;
    if(inPlace){
      const updates=imageUpdates.get(t);
      imageUpdates.delete(t);
      if(image)for(const update of updates)update(image);
    }
  }
  function installDecodedArtwork(){
    let layoutChanged=false,uploads=0,pixels=0;
    const batched=batchesArtwork();
    for(const [t,image] of decodedArtwork){
      if(deferredArtwork.has(t))continue;
      if(batched){
        if(!mayInstall(t))continue;
        if(image){
          const [w,h]=artworkSize(image),area=w*h;
          // Let a large background paint on its own frame.
          if(uploads>=4||(uploads>0&&pixels+area>400000))break;
          uploads++;pixels+=area;
        }
      }
      const inPlace=canUpdateImage(t);
      installImage(t,image,inPlace);decodedArtwork.delete(t);
      if(!inPlace)layoutChanged=true;
    }
    return layoutChanged;
  }
  function releaseDeferredArtwork(){
    if(!deferredArtwork.size||![...deferredArtwork].every(t=>textureReady(t)||decodedArtwork.has(t)))return;
    if(groupLateArtwork){
      for(const t of deferredArtwork)if(decodedArtwork.has(t)){
        installImage(t,decodedArtwork.get(t),canUpdateImage(t));decodedArtwork.delete(t);
      }
      groupLateArtwork=false;
    }
    deferredArtwork.clear();request(true);
  }
  function texture(url,layoutDependent=true,priority=1){
    const key=optimizeUiAssetUrls(url);
    const prioritized=Boolean(prepareArtwork||data.prioritizedArtwork);
    let t=textures.get(key);
    if(!t){
      t=new Texture();
      const done=image=>{
        if(closed||textures.get(key)!==t)return;
        const inPlace=canUpdateImage(t)&&!deferredArtwork.has(t);
        if(inPlace&&!batchesArtwork()){
          installImage(t,image,true);request();
          return;
        }
        if(staging){
          // A staging scene is offscreen. Expose its textures for pre-upload.
          installImage(t,image);
          if(currentArtwork.has(t)){artChanged=true;request();}
          return;
        }
        // Animated/scrolling panels can paint before their batched rebuild.
        // Keep new pixels off the old mesh until UVs and aspect are rebuilt.
        decodedArtwork.set(t,image);
        if(inPlace){request();return;}
        if(deferredArtwork.has(t)){releaseDeferredArtwork();return;}
        if(!nativeInput){request(true);return;}
        if((tracksArtwork&&!currentArtwork.has(t))||artBatch!==null)return;
        artBatch=setTimeout(()=>{artBatch=null;request(true);},55);
      };
      t.colorSpace=SRGBColorSpace;t.generateMipmaps=true;t.minFilter=LinearMipmapLinearFilter;t.magFilter=LinearFilter;textures.set(key,t);
      const rank=prioritized?()=>{
        if(closed||textures.get(key)!==t)return -Infinity;
        return (artworkVisible?.()??!parked)?artworkPriorities.get(t)??-1:backgroundPriority;
      }:undefined;
      loadArtwork(key,rank,progressive).then(image=>{
        const [w,h]=artworkSize(image);done(w>0&&h>0?image:null);
      },()=>done(null));
    }else if(nativeInput&&progressive&&!currentArtwork.has(t)){
      // Map iteration now visits the least recently displayed textures first.
      textures.delete(key);textures.set(key,t);
    }
    if(tracksArtwork)currentArtwork.add(t);
    if(prioritized)artworkPriorities.set(t,Math.max(priority,artworkPriorities.get(t)??0));
    if(layoutDependent)layoutArtwork.add(t);
    return t;
  }
  function imageRect(url,source,x,y,w,h,contain){
    if(!contain)return {x,y,w,h};
    const [iw,ih]=artworkSize(source);
    if(!iw||!ih)return {x,y,w,h};
    // Hangar artwork already uses the live model's camera framing.
    const aircraftIcon=url.includes('/aircraft-ui-v1/')&&!url.endsWith('-hangar.webp');
    const scale=Math.min(w/iw,h/ih)*(aircraftIcon?1.45:1);
    const width=iw*scale,height=ih*scale;
    return {x:x+(w-width)/2,y:y+(h-height)/2,w:width,h:height};
  }
  function image(art,url,x,y,w,h,contain=true,{updateInPlace=false,onImage,priority,keepUnused=true}={}){
    if(!url)return art.quad(x,y,w,h,'#ffffff',0);
    const tex=texture(url,!updateInPlace,priority);
    if(!keepUnused)tex.userData.keepUnused=false;
    if(tex.image&&!deferredArtwork.has(tex)){
      const rect=imageRect(url,tex.image,x,y,w,h,contain);
      const mesh=art.image(tex,rect.x,rect.y,rect.w,rect.h);
      onImage?.(mesh);
      return mesh;
    }
    const mesh=art.image(tex,x,y,w,h);
    mesh.visible=false;
    if(updateInPlace&&!textureReady(tex)){
      // The card already owns its mesh and hit area. Fit late pixels without rebuilding the page.
      let updates=imageUpdates.get(tex);
      if(!updates){updates=[];imageUpdates.set(tex,updates);}
      updates.push(source=>{
        const rect=imageRect(url,source,x,y,w,h,contain);
        mesh.position.x=rect.x+rect.w/2;
        mesh.position.y=rect.y+rect.h/2;
        mesh.scale.x=rect.w;
        // Keep the screen-space quad's Y direction when the texture arrives.
        mesh.scale.y=-rect.h;
        onImage?.(mesh);
        mesh.visible=true;
      });
    }
    return mesh;
  }
  function pruneArtwork(){
    for(const t of deferredArtwork)if(!currentArtwork.has(t))deferredArtwork.delete(t);
    const limited=nativeInput&&progressive;
    let idlePixels=0;
    for(const [key,t] of textures){
      if(currentArtwork.has(t))continue;
      const [w,h]=artworkSize(t.image||decodedArtwork.get(t));
      const pixels=w*h;
      if(t.userData.keepUnused===false||(limited&&(!pixels||pixels>unusedArtworkPixels))){
        textures.delete(key);decodedArtwork.delete(t);t.dispose();
      }else idlePixels+=pixels;
    }
    for(const [key,t] of textures){
      if(textures.size<=96&&(!limited||idlePixels<=unusedArtworkPixels))break;
      if(currentArtwork.has(t))continue;
      const [w,h]=artworkSize(t.image||decodedArtwork.get(t));idlePixels-=w*h;
      textures.delete(key);decodedArtwork.delete(t);t.dispose();
    }
  }
  function build(box,c){
    const x=c.x-box.x,y=c.y-box.y,w=c.width,h=c.height;
    if(dirty||box.width!==prevW||box.height!==prevH||prevFrame?.x!==x||prevFrame?.y!==y||prevFrame?.w!==w||prevFrame?.h!==h){
      clearTimeout(artBatch);artBatch=null;
      if(!batchesArtwork())installDecodedArtwork();
      currentArtwork.clear();artworkPriorities.clear();layoutArtwork.clear();imageUpdates.clear();artChanged=false;
      for(const p of layers)p.art.clear();layers.length=0;controls.length=0;animations.length=0;frameEffects.length=0;pressEffects.length=0;anchors.clear();activeRegions.clear();pendingArt=false;
      compiledLayers=0;
      const frameRect={x,y,w,h};
      function backdrop(art,alpha,color='#000'){
        const index=layers.findIndex(layer=>layer.art===art);
        // Keep the shade outside a dialog's content clip and below that dialog.
        const shade=layers[index]?.clip?layer('backdrop',null,index).art:art;
        return shade.quad(x,y,w,h,color,alpha);
      }
      const tools={layer,region,scrollWindow,control,image,texture,frameRect,backdrop,stagedArtwork:Boolean(prepareArtwork),
        viewport:input.viewport?.(),topBleed:Math.max(0,-y),animate:fn=>animations.push(fn),anchor:(key,value)=>anchors.set(key,value),
        frame:fn=>frameEffects.push(fn),pressEffect:fn=>pressEffects.push(fn),offset:key=>regions.get(key)?.offset||0,waitForArt:()=>{pendingArt=true;},keyFocus:keyboard?focusId:null};
      activeScope=layout(data,box.width,box.height,tools)||'base';
      textCache?.prune();
      if(tracksArtwork)pruneArtwork();
      dirty=false;prevW=box.width;prevH=box.height;prevFrame=frameRect;
      releaseDeferredArtwork();
    }
  }
  function paint(r){
    if(closed||!data)return;
    const box=input.bounds(),c=input.frameBounds();
    if(!box.width||!c.width||!c.height)return;
    build(box,c);
    camera.left=c.x-box.x;camera.top=c.y-box.y;camera.right=camera.left+c.width;camera.bottom=camera.top+c.height;camera.updateProjectionMatrix();
    r.getScissor(scissor);r.getViewport(viewport);
    const clipped=r.getScissorTest(),clear=r.autoClear,sx=viewport.z/c.width,sy=viewport.w/c.height;
    r.autoClear=false;
    try{
      const time=input.now()/1000;
      for(let i=animations.length-1;i>=0;i--)if(animations[i](time)===false)animations.splice(i,1);
      const heldControl=press?.drag?null:press?.hit;
      for(const effect of frameEffects)effect(time,heldControl);
      for(const effect of pressEffects)effect(pressedControl(),time);
      for(const p of layers){
        const zone=p.clip&&regions.get(p.clip);
        if(zone){const {dx,dy,clip:g}=placement(zone);
          p.art.group.position.set(-dx,-dy,0);
          const x0=Math.max(viewport.x,viewport.x+Math.round((g.x-camera.left)*sx));
          const x1=Math.min(viewport.x+viewport.z,viewport.x+Math.round((g.x+g.w-camera.left)*sx));
          const y0=Math.max(viewport.y,viewport.y+Math.round((camera.bottom-g.y-g.h)*sy));
          const y1=Math.min(viewport.y+viewport.w,viewport.y+Math.round((camera.bottom-g.y)*sy));
          r.setScissor(x0,y0,Math.max(0,x1-x0),Math.max(0,y1-y0));r.setScissorTest(true);
        }else{r.setScissor(viewport);r.setScissorTest(true);}
        r.render(p.scene,camera);
      }
    }finally{r.setScissor(scissor);r.setScissorTest(clipped);r.autoClear=clear;}
    if(pendingArt)request(true);
    else if(batchesArtwork()&&[...decodedArtwork.keys()].some(mayInstall)||!main&&animations.length)request();
  }
  function pos(x,y){const r=input.bounds();return {x:x-r.x,y:y-r.y};}
  function hit(x,y){
    return controls.findLast(c=>{const z=placement(regions.get(c.zone));
      return allowed(c.id)&&c.scope===activeScope&&(!z.clip||inside(z.clip,x,y))&&inside(c,x+z.dx,y+z.dy);});
  }
  function pressedControl(){
    if(!press||press.drag||!press.hit)return null;
    const c=press.hit,z=placement(regions.get(c.zone));
    return {id:c.id,x:limit((press.px-c.x+z.dx)/c.w,0,1),
      y:limit((press.py-c.y+z.dy)/c.h,0,1),start:press.start};
  }
  function setOffset(k,n,notify=true){const z=regions.get(k);if(z){const old=z.offset,next=limit(n,0,z.max);if(old===next)return;z.offset=next;
    if(notify)onScroll?.(k,next,anchors,z.max);
    request(z.redrawStep>0&&Math.floor(old/z.redrawStep)!==Math.floor(next/z.redrawStep));}}
  function scrolling(x,y,axis){
    const zones=[...regions].reverse().filter(([key,z])=>activeRegions.has(key)&&(main&&activeScope==='base'||key===activeScope||z.parent===activeScope)&&inside(placement(z).clip,x,y));
    return zones.find(([,z])=>z.max&&(!axis||z.axis===axis))||zones.find(([,z])=>z.max)||zones[0];
  }
  function editNumber(action){field?.();field=input.editNumber(action,value=>onAction({type:'quantity',value}));}
  function activate(c){
    if(!c||c.disabled)return;
    focusId=c.id;input.label?.(name+'，'+c.label);
    if(c.action.type==='editNumber'){editNumber(c.action);return;}
    onAction(c.action);
  }
  function begin(screenX,screenY,pointerId){
    if(!interactive()||press||entering!==null)return false;
    const {x,y}=pos(screenX,screenY),z=scrolling(x,y);keyboard=false;clickTarget=null;
    press={id:pointerId,x,y,px:x,py:y,start:input.now()/1000,hit:hit(x,y),zone:z?.[0],scroll:z?.[1].offset??0,drag:false};request();
    if(press.hit?.onPoint&&!press.hit.disabled){focusId=press.hit.id;press.hit.onPoint(pressedControl());}
    return true;
  }
  function move(screenX,screenY,pointerId){
    if(press?.id!==pointerId)return;
    const p=pos(screenX,screenY);press.px=p.x;press.py=p.y;
    const tabPress=nativeInput&&press.hit?.action.type==='tab';
    if(!press.drag&&Math.hypot(p.x-press.x,p.y-press.y)>(tabPress?10:6)){
      const axis=Math.abs(p.x-press.x)>Math.abs(p.y-press.y)?'x':'y',z=scrolling(press.x,press.y,axis);
      if(!press.hit?.trackPointer||z?.[1].max>0&&z[1].axis===axis){
        press.drag=true;press.zone=z?.[0];press.scroll=z?.[1].offset??0;
        if(tabPress)request();
      }
    }
    if(pressEffects.length)request();
    if(!press.drag&&press.hit?.onPoint&&!press.hit.disabled)press.hit.onPoint(pressedControl());
    if(press.drag&&press.zone)setOffset(press.zone,press.scroll+(regions.get(press.zone)?.axis==='x'?press.x-p.x:press.y-p.y));
  }
  function end(screenX,screenY,pointerId){
    if(press?.id!==pointerId)return;
    const old=press;press=null;request();const p=pos(screenX,screenY),selected=hit(p.x,p.y);
    if(!old.drag&&selected&&selected.id===old.hit?.id&&selected.scope===old.hit.scope)clickTarget=selected;
  }
  function commit(){
    const control=clickTarget;clickTarget=null;
    if(!control||!interactive())return false;
    activate(control);
    return true;
  }
  function cancel(){press=null;clickTarget=null;request();}
  function wheel(e){const p=pos(e.clientX,e.clientY),z=scrolling(p.x,p.y,Math.abs(e.deltaX)>Math.abs(e.deltaY)?'x':'y');
    if(z&&interactive()){const d=z[1].axis==='x'?(e.deltaX||e.deltaY):e.deltaY;setOffset(z[0],z[1].offset+d*(e.deltaMode===1?16:e.deltaMode===2?z[1].rect.h:1));e.preventDefault();}
  }
  function key(e){
    if(!interactive()||!handlesKey(e.key)||e.target?.tagName==='INPUT'||e.altKey||e.metaKey||e.ctrlKey)return;
    const list=controls.filter(c=>allowed(c.id)&&c.scope===activeScope&&!c.disabled&&c.id!=='outside'&&c.action.type!=='none');
    const index=list.findIndex(c=>c.id===focusId);
    if(list[index]?.onKey?.(e.key)){e.preventDefault();e.stopPropagation();return;}
    if(main&&focusId==='aircraft'&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home'].includes(e.key))return;
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!guideTarget)onAction({type:'close',via:'keyboard'});return;}
    if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(list[index<0?0:index]);return;}
    if(!['Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageDown','PageUp'].includes(e.key)||!list.length)return;
    e.preventDefault();e.stopPropagation();keyboard=true;
    if(e.key.startsWith('Page')){
      const key=activeRegions.has(activeScope)?activeScope:[...activeRegions].find(k=>regions.get(k)?.parent===activeScope&&regions.get(k).axis==='y');
      const z=regions.get(key);if(z)setOffset(key,z.offset+(e.key==='PageDown'?1:-1)*(z.axis==='x'?z.rect.w:z.rect.h));return;
    }
    const step=e.key==='Tab'?(e.shiftKey?-1:1):e.key==='ArrowUp'?-5:e.key==='ArrowDown'?5:e.key==='ArrowLeft'?-1:1;
    const next=list[e.key==='Home'?0:e.key==='End'?list.length-1:(index+step+list.length*5)%list.length];
    focusId=next.id;input.label?.(name+'，'+next.label);
    const z=regions.get(next.zone);
    if(z){
      const a=z.axis,m=a==='x'?'w':'h';
      if(next[a]-z.offset<z.rect[a])setOffset(next.zone,next[a]-z.rect[a]);
      else if(next[a]+next[m]-z.offset>z.rect[a]+z.rect[m])setOffset(next.zone,next[a]+next[m]-z.rect[a]-z.rect[m]);
    }
    request(true);
  }
  function prepare(offscreen=false){
    const b=input.bounds(),c=input.frameBounds();
    if(closed||!data||!b.width||!c.width||!c.height)return false;
    if(offscreen&&artBatch!==null){clearTimeout(artBatch);artBatch=null;dirty=true;}
    if(batchesArtwork()&&installDecodedArtwork())dirty=true;
    if(prepareArtwork&&artChanged&&[...currentArtwork].every(textureReady))dirty=true;
    build(b,c);
    const artwork=tracksArtwork?currentArtwork:textures.values();
    return !pendingArt&&[...artwork].every(textureReady);
  }
  function prepareFirstFrame(){
    const ready=prepare(),textures=new Set(currentArtwork);
    for(const {art} of layers)for(const mesh of art.group.children){
      const texture=mesh.material.map;
      if(mesh.visible&&texture?.image)textures.add(texture);
    }
    return prepareArtwork(textures)&&ready;
  }
  const actions={begin,move,end,commit,cancel,wheel,key};
  let inputBound=false;
  function bindInput(){if(!inputBound){inputBound=true;input.bind(actions);}}
  if(!parked&&!deferInput)bindInput();
  const unwatch=input.watch(()=>request(true));
  const view={surface,bounds:input.bounds,name,fullscreen,draw(r){
    if(closed||parked)return;
    if(entering!==null){
      if(!prepareFirstFrame()&&input.now()-entering<entryWaitMs){request();return;}
      entering=null;view.commit({groupLate:true});
    }
    // Drain artwork requested by later dialog pages before painting.
    if(prepareArtwork&&decodedArtwork.size)prepare();
    underlay?.draw(r);paint(r);
  },get closed(){return closed;},
    get animated(){return underlay?.animated||animations.length>0||Boolean(pressEffects.length&&press?.hit&&!press.drag);},invalidate:()=>request(true),
    stage(){
      staging=true;
      if(deferredArtwork.size){deferredArtwork.clear();dirty=true;}
      groupLateArtwork=false;
      clearTimeout(artBatch);artBatch=null;
      if(installDecodedArtwork())artChanged=true;
    },
    prepare,
    prepareOffscreen(){return parked&&!closed&&prepareFirstFrame();},
    activate(){
      if(closed||!parked)return;
      parked=false;entering=input.now();
      bindInput();screen.panel=view;input.focus?.();request();
    },
    artwork:()=>currentArtwork,
    warmPrograms(r){
      if(typeof r.compile!=='function'||r.getContext().isContextLost())return true;
      const layer=layers[compiledLayers];
      if(!layer)return true;
      r.compile(layer.scene,camera);
      return ++compiledLayers>=layers.length;
    },
    commit({batchLate=true,groupLate=false}={}){
      staging=false;groupLateArtwork=groupLate;
      const rebuild=artChanged||pendingArt;
      // If the CDN is slow, hold late art as one batch instead of having it
      // appear one image at a time in an already interactive page.
      if(batchLate)for(const t of currentArtwork)if(!textureReady(t)&&(groupLate||!canUpdateImage(t)))deferredArtwork.add(t);
      if(rebuild||deferredArtwork.size)dirty=true;
      return dirty;
    },
    bindInput,cancelInput:cancel,
    setGuideTarget(id){guideTarget=id;},
    pick(e){if(staging)return;const p=pos(e.clientX,e.clientY);return hit(p.x,p.y)?.id;},get focused(){return focusId;},
    scroll:(zone,value,notify)=>setOffset(zone,typeof value==='number'?value:anchors.get(value)??0,notify),
    update(next,key,detailKey){
    if(closed)return;
    if(identity!==detailKey){regions.delete('detail');identity=detailKey;focusId=null;keyboard=false;}
    if(data?.key===key)return;
    data={...next,key};request(true);
  },state(){
    const b=input.bounds();
     return {ready:!staging&&!dirty&&!pendingArt&&[...(tracksArtwork?currentArtwork:textures.values())].every(textureReady),items:data?.items?.length,detail:data?.item?.name,controls:controls.filter(c=>c.scope===activeScope&&c.action.type!=='none').map(c=>{
      const z=placement(regions.get(c.zone));return {id:c.id,label:c.label,x:b.x+c.x-z.dx,y:b.y+c.y-z.dy,w:c.w,h:c.h,disabled:c.disabled};
    })};
  },close(){
    if(closed)return;closed=true;clearTimeout(artBatch);input.cancelFrame(redraw);unwatch();field?.();input.close();
    if(screen.panel===view)screen.panel=underlay&&!underlay.closed?underlay:null;
    for(const p of layers)p.art.clear();for(const t of textures.values())t.dispose();
    textCache?.clear();
    textures.clear();currentArtwork.clear();deferredArtwork.clear();
    decodedArtwork.clear();artworkPriorities.clear();layoutArtwork.clear();imageUpdates.clear();
    layers.length=controls.length=animations.length=frameEffects.length=pressEffects.length=0;
    regions.clear();activeRegions.clear();anchors.clear();press=clickTarget=data=null;
    if(!battle&&!parked)screen.repaintHome?.();
  }};
  if(!main&&!battle&&!parked){screen.panel=view;input.focus?.();}
  return view;
}
