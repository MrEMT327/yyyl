import {artworkTexture} from './image-loading.js';
import {OrthographicCamera,Scene,Vector4,SRGBColorSpace,LinearFilter,LinearMipmapLinearFilter} from 'three';
import {createThreeSurface} from '../../ui/three-surface.js';
import {optimizeUiAssetUrls} from '../../ui/ui-image-source.js';

const inside=(r,x,y)=>r&&x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;
const limit=(n,min,max)=>Math.max(min,Math.min(max,n));
function intersection(a,b){
  const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y);
  return {x,y,w:Math.max(0,Math.min(a.x+a.w,b.x+b.w)-x),h:Math.max(0,Math.min(a.y+a.h,b.y+b.h)-y)};
}

// A panel paints above the retained lobby scene on the same Three device.
// Its transparent H5 focus target only delivers pointer, wheel and IME input.
export function createLobbyPanel(screen,host,name,layout,onAction,{main=false,overlay=false,battle=false,onScroll,interactive=()=>true,allows=()=>true,handlesKey=()=>true}={}){
  const underlay=overlay||host.dataset.rewardLayer==='overlay'?screen.panel:null;
  const surface=main?screen.display.input:document.createElement('div');
  surface.tabIndex=0;surface.setAttribute('role',main?'application':'dialog');if(!main)surface.setAttribute('aria-modal','true');surface.setAttribute('aria-label',name);
  surface.style.cssText='position:absolute;inset:0;pointer-events:auto;touch-action:none;outline:none';
  if(main){surface.className='three-menu-screen';Object.assign(surface.style,{width:'100%',height:'100%',display:'block'});}
  host.replaceChildren(surface);
  const renderer=screen.three,canvas=screen.display.input,camera=new OrthographicCamera(0,1,0,1,-10,10);
  const textures=new Map(),abort=new AbortController(),options={signal:abort.signal};
  const layers=[],controls=[],animations=[],frameEffects=[],pressEffects=[],regions=new Map(),activeRegions=new Set(),anchors=new Map(),scissor=new Vector4(),viewport=new Vector4();
  let data=null,dirty=true,closed=false,redraw=0,press=null,clickTarget=null,focusId=null,keyboard=false,field=null;
  let pendingArt=false,prevW=0,prevH=0,activeScope='base',identity='';
  let guideTarget=null;
  const allowed=id=>allows(id)&&(!guideTarget||guideTarget===id);
  function request(rebuild=false){
    if(closed)return;
    dirty=dirty||rebuild;
    if(!battle&&!redraw)redraw=requestAnimationFrame(()=>{redraw=0;if(!closed)screen.repaintHome?.();});
  }
  function layer(key,clip=null){
    const scene=new Scene(),art=createThreeSurface(),p={key,scene,art,clip};
    scene.add(art.group);layers.push(p);return p;
  }
  function region(key,rect,length,axis='y',{parent=null,initial=0,redrawStep=0}={}){
    activeRegions.add(key);
    const prev=regions.get(key);
    const row={rect,axis,parent,redrawStep,max:Math.max(0,length-(axis==='x'?rect.w:rect.h)),offset:prev?.offset??initial};
    row.offset=limit(row.offset,0,row.max);regions.set(key,row);
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
  function texture(url){
    const key=optimizeUiAssetUrls(url);
    if(!textures.has(key)){
      const t=artworkTexture(key,()=>request(true),()=>{t.userData.failed=true;request(true);});
      t.colorSpace=SRGBColorSpace;t.generateMipmaps=true;t.minFilter=LinearMipmapLinearFilter;t.magFilter=LinearFilter;textures.set(key,t);
    }
    return textures.get(key);
  }
  function image(art,url,x,y,w,h,contain=true){
    if(!url)return art.quad(x,y,w,h,'#ffffff',0);
    const tex=texture(url),im=tex.image;
    if(tex.userData.failed)return art.quad(x,y,w,h,'#ffffff',0);
    if(contain&&im?.width&&im.height){
      const multiplier=url.includes('/aircraft-ui-v1/')?1.45:1,k=Math.min(w/im.width,h/im.height)*multiplier;
      const nw=im.width*k,nh=im.height*k;x+=(w-nw)/2;y+=(h-nh)/2;w=nw;h=nh;
    }
    return art.image(tex,x,y,w,h);
  }
  function paint(r){
    if(closed||!data)return;
    const box=surface.getBoundingClientRect(),c=canvas.getBoundingClientRect();
    if(!box.width||!c.width||!c.height)return;
    if(dirty||box.width!==prevW||box.height!==prevH){
      for(const p of layers)p.art.clear();layers.length=0;controls.length=0;animations.length=0;frameEffects.length=0;pressEffects.length=0;anchors.clear();activeRegions.clear();pendingArt=false;
      const tools={layer,region,control,image,texture,animate:fn=>animations.push(fn),anchor:(key,value)=>anchors.set(key,value),
        frame:fn=>frameEffects.push(fn),pressEffect:fn=>pressEffects.push(fn),offset:key=>regions.get(key)?.offset||0,waitForArt:()=>{pendingArt=true;},keyFocus:keyboard?focusId:null};
      activeScope=layout(data,box.width,box.height,tools)||'base';
      dirty=false;prevW=box.width;prevH=box.height;
    }
    camera.left=c.x-box.x;camera.top=c.y-box.y;camera.right=camera.left+c.width;camera.bottom=camera.top+c.height;camera.updateProjectionMatrix();
    r.getScissor(scissor);r.getViewport(viewport);
    const clipped=r.getScissorTest(),clear=r.autoClear,sx=viewport.z/c.width,sy=viewport.w/c.height;
    r.autoClear=false;
    try{
      const time=performance.now()/1000;
      for(let i=animations.length-1;i>=0;i--)if(animations[i](time)===false)animations.splice(i,1);
      for(const effect of frameEffects)effect(time);
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
    else if(!main&&animations.length)request();
  }
  function pos(event){const r=surface.getBoundingClientRect();return {x:event.clientX-r.x,y:event.clientY-r.y};}
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
  function setOffset(k,n){const z=regions.get(k);if(z){const old=z.offset,next=limit(n,0,z.max);if(old===next)return;z.offset=next;
    onScroll?.(k,next,anchors,z.max);request(z.redrawStep>0&&Math.floor(old/z.redrawStep)!==Math.floor(next/z.redrawStep));}}
  function scrolling(x,y,axis){
    const zones=[...regions].reverse().filter(([key,z])=>activeRegions.has(key)&&(main&&activeScope==='base'||key===activeScope||z.parent===activeScope)&&inside(placement(z).clip,x,y));
    return zones.find(([,z])=>z.max&&(!axis||z.axis===axis))||zones.find(([,z])=>z.max)||zones[0];
  }
  function editNumber(action){
    field?.remove();field=document.createElement('input');field.type='text';field.inputMode='numeric';field.pattern='[0-9]*';
    field.value=String(action.value);field.setAttribute('aria-label',action.label);field.style.cssText='position:absolute;width:1px;height:1px;opacity:0;pointer-events:none';
    surface.append(field);field.focus();field.select();
    field.addEventListener('input',()=>onAction({type:'quantity',value:field.value}),options);
    field.addEventListener('blur',()=>{field?.remove();field=null;},{once:true,signal:abort.signal});
    field.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key==='Escape'){e.stopPropagation();e.preventDefault();surface.focus();}},options);
  }
  function activate(c){
    if(!c||c.disabled)return;
    focusId=c.id;surface.setAttribute('aria-label',name+'，'+c.label);
    if(c.action.type==='editNumber'){editNumber(c.action);return;}
    const b=surface.getBoundingClientRect(),z=placement(regions.get(c.zone));
    screen.feedback?.capture({x:b.x+c.x-z.dx,y:b.y+c.y-z.dy,w:c.w,h:c.h});
    onAction(c.action);
  }
  surface.addEventListener('pointerdown',e=>{
    if(!interactive()||press||e.button>0||e.target?.tagName==='INPUT')return;
    surface.focus({preventScroll:true});
    const {x,y}=pos(e),z=scrolling(x,y);keyboard=false;clickTarget=null;
    press={id:e.pointerId,x,y,px:x,py:y,start:performance.now()/1000,hit:hit(x,y),zone:z?.[0],scroll:z?.[1].offset??0,drag:false};request();
    if(press.hit?.onPoint&&!press.hit.disabled){focusId=press.hit.id;press.hit.onPoint(pressedControl());}
    surface.setPointerCapture(e.pointerId);e.preventDefault();
  },options);
  surface.addEventListener('pointermove',e=>{if(press?.id!==e.pointerId)return;const p=pos(e);
    press.px=p.x;press.py=p.y;
    if(!press.drag&&Math.hypot(p.x-press.x,p.y-press.y)>6){
      const axis=Math.abs(p.x-press.x)>Math.abs(p.y-press.y)?'x':'y',z=scrolling(press.x,press.y,axis);
      if(!press.hit?.trackPointer||z?.[1].max>0&&z[1].axis===axis){
        press.drag=true;press.zone=z?.[0];press.scroll=z?.[1].offset??0;
      }
    }
    if(pressEffects.length)request();
    if(!press.drag&&press.hit?.onPoint&&!press.hit.disabled)press.hit.onPoint(pressedControl());
    if(press.drag&&press.zone)setOffset(press.zone,press.scroll+(regions.get(press.zone)?.axis==='x'?press.x-p.x:press.y-p.y));
  },options);
  surface.addEventListener('pointerup',e=>{if(press?.id!==e.pointerId)return;
    const old=press;press=null;request();const p=pos(e),selected=hit(p.x,p.y);
    if(!old.drag&&selected&&selected.id===old.hit?.id&&selected.scope===old.hit.scope)clickTarget=selected;
  },options);
  surface.addEventListener('click',e=>{
    const control=clickTarget;clickTarget=null;
    if(control&&interactive()){e.stopPropagation();activate(control);}
  },options);
  surface.addEventListener('pointercancel',()=>{press=null;clickTarget=null;request();},options);
  surface.addEventListener('wheel',e=>{const p=pos(e),z=scrolling(p.x,p.y,Math.abs(e.deltaX)>Math.abs(e.deltaY)?'x':'y');
    if(z&&interactive()){const d=z[1].axis==='x'?(e.deltaX||e.deltaY):e.deltaY;setOffset(z[0],z[1].offset+d*(e.deltaMode===1?16:e.deltaMode===2?z[1].rect.h:1));e.preventDefault();}
  },{passive:false,signal:abort.signal});
  surface.addEventListener('keydown',e=>{
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
    focusId=next.id;surface.setAttribute('aria-label',name+'，'+next.label);
    const z=regions.get(next.zone);
    if(z){
      const a=z.axis,m=a==='x'?'w':'h';
      if(next[a]-z.offset<z.rect[a])setOffset(next.zone,next[a]-z.rect[a]);
      else if(next[a]+next[m]-z.offset>z.rect[a]+z.rect[m])setOffset(next.zone,next[a]+next[m]-z.rect[a]-z.rect[m]);
    }
    request(true);
  },options);
  const resize=new ResizeObserver(()=>request(true));resize.observe(surface);
  const view={surface,draw(r){underlay?.draw(r);paint(r);},get closed(){return closed;},
    get animated(){return underlay?.animated||animations.length>0||Boolean(pressEffects.length&&press?.hit&&!press.drag);},invalidate:()=>request(true),
    setGuideTarget(id){guideTarget=id;},
    pick(e){const p=pos(e);return hit(p.x,p.y)?.id;},get focused(){return focusId;},
    scroll:(zone,value)=>setOffset(zone,typeof value==='number'?value:anchors.get(value)??0),
    update(next,key,detailKey){
    if(identity!==detailKey){regions.delete('detail');identity=detailKey;focusId=null;keyboard=false;}
    if(data?.key===key)return;
    data={...next,key};request(true);
  },state(){
    const b=surface.getBoundingClientRect();
    return {ready:!dirty&&!pendingArt&&[...textures.values()].every(t=>t.image?.width||t.userData.failed),items:data?.items?.length,detail:data?.item?.name,controls:controls.filter(c=>c.scope===activeScope&&c.action.type!=='none').map(c=>{
      const z=placement(regions.get(c.zone));return {id:c.id,label:c.label,x:b.x+c.x-z.dx,y:b.y+c.y-z.dy,w:c.w,h:c.h,disabled:c.disabled};
    })};
  },close(){
    if(closed)return;closed=true;cancelAnimationFrame(redraw);resize.disconnect();abort.abort();field?.remove();
    if(screen.panel===view)screen.panel=underlay&&!underlay.closed?underlay:null;
    for(const p of layers)p.art.clear();for(const t of textures.values())t.dispose();
    if(!main)surface.remove();if(!battle)screen.repaintHome?.();
  }};
  if(!main&&!battle){screen.panel=view;surface.focus({preventScroll:true});}
  document.fonts?.load('16px PsdPopup').then(()=>request(true)).catch(()=>{});
  return view;
}
