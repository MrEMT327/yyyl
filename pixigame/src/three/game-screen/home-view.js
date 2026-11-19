import {Color,LinearFilter,Vector4,WebGLRenderTarget} from 'three';
import {createHomeStage,homePictures,viewportPixel} from './home-stage.js';
import {createHomeHud} from './three-home-hud.js';
import {homeControls,bindHomeInput} from './home-input.js';
import {PILOT_PORTRAITS} from '../../ui/character-portraits.js';
import {PORTRAIT_FRAMING} from '../../ui/portrait-framing.js';
import {optimizeUiAssetUrls} from '../../ui/ui-image-source.js';
import {loadArtwork} from './image-loading.js';
import {measureScreen} from './screen-metrics.js';

function loadImage(url){return loadArtwork(optimizeUiAssetUrls(url));}
function portraitSize(id,w,h){
  const f=PORTRAIT_FRAMING[id];
  if(!f)return [-w*.125,h*.13,1.25*w,1.25*w*1407/1118];
  const [left,,right]=f.bounds,violet=id==='pilot-08';
  const height=w*1.36/(f.groundY-f.headY);
  const side=id==='pilot-04'?height:Math.min(height,w*(violet ? 1.06 : .98)/(right-left));
  const ground={'pilot-01':.80,'pilot-08':.77,'pilot-10':.755}[id]??.815;
  return [w*(violet ? .49 : .5)-(left+right)/2*side,h*ground-f.groundY*side,side,side];
}
export function mountHomeView(device,page,send,interactive){
  const renderer=device.three,canvas=device.display.input,actor=new Vector4(),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const previous={color:renderer.getClearColor(new Color()),
    alpha:renderer.getClearAlpha(),clear:renderer.autoClear,style:canvas.getAttribute('style'),className:canvas.className,
    label:canvas.getAttribute('aria-label'),role:canvas.getAttribute('role'),tab:canvas.getAttribute('tabindex')};
  let stage=null,hud=null,viewport=null,controls=[],pilot=null,marker=null,generation=0,guide=null,pose=null,target=null,frame=0,closed=false;
  let still=null,scenery=null,active=false;
  function available(){return !closed&&page.isConnected&&!page.closest('[hidden]')&&!device.battle&&!device.cover&&!device.preview&&!document.hidden;}
  const metrics=measureScreen(renderer,'Three 大厅',available);
  function schedule(){if(!frame&&available())frame=requestAnimationFrame(paint);}
  function take(){
    if(canvas.parentElement===page&&active)return;
    page.append(canvas);canvas.className='three-home-screen';
    canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;z-index:1;touch-action:none;pointer-events:auto;outline:0';
    canvas.setAttribute('aria-label','少女航线主界面');canvas.setAttribute('role','application');canvas.tabIndex=0;
    renderer.setPixelRatio(1);renderer.setRenderTarget(null);renderer.setScissorTest(false);renderer.setClearColor(0,0);renderer.autoClear=false;
    active=true;
  }
  function model(){return {...device.homeState,safeBottom:viewport?.safeBottom||0,reduced:reduced.matches};}
  function updateGuide(){
    const control=guide&&controls.find(c=>c.id===guide.id);
    hud?.setGuide(control?{...guide,target:control.box,reduced:reduced.matches}:null);
  }
  function position(){
    const p=page.getBoundingClientRect();if(!p.width||!p.height)return;
    const ratio=devicePixelRatio||1,x0=viewportPixel(p.left,ratio),y0=viewportPixel(p.top,ratio);
    const wNative=viewportPixel(p.right,ratio)-x0,hNative=viewportPixel(p.bottom,ratio)-y0;
    if(!wNative||!hNative)return;
    const safeBottom=parseFloat(getComputedStyle(page).paddingBottom)||0;
    viewport={width:p.width,height:p.height,left:p.left,top:p.top,ratio,wNative,hNative,safeBottom};
    const [x,y,w,h]=portraitSize(pilot,p.width,p.height);
    if(marker)Object.assign(marker.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});
    const ax=viewportPixel(p.x+x,ratio)-x0,ay=viewportPixel(p.y+y,ratio)-y0;
    actor.set(ax*750/wNative,ay*1624/hNative,(viewportPixel(p.x+x+w,ratio)-x0-ax)*750/wNative,(viewportPixel(p.y+y+h,ratio)-y0-ay)*1624/hNative);
    controls=homeControls(model(),viewport,actor.toArray());
    stage?.layout(viewport);hud?.layout(viewport);updateGuide();schedule();
  }
  function selectPilot(id){
    if(id===pilot)return false;
    pilot=id;generation++;pose=null;still=null;scenery=null;
    stage?.setPortraitStill(null);stage?.setPortraitScenery(null);marker?.remove();
    marker=document.createElement('div');marker.className='psd-main-portrait character-portrait';
    marker.dataset.characterPortrait=id;marker.setAttribute('aria-hidden','true');
    marker.style.cssText='position:absolute;pointer-events:none;visibility:hidden';
    page.prepend(marker);
    const config=PILOT_PORTRAITS[id]||{},token=generation;
    function load(url,scene){
      if(url)loadImage(url).then(image=>{
        if(closed||generation!==token)return;
        if(scene){scenery=image;stage?.setPortraitScenery(image);}else{still=image;stage?.setPortraitStill(image);}
        schedule();
      }).catch(e=>{if(!closed&&generation===token)console.error(e);});
    }
    load(config.scene,true);load(config.image||device.homeState.pilotImage,false);
    position();return true;
  }
  function sync(){
    hud?.updateModel(model());stage?.setGrade('patrol',device.homeState.patrolLocked?1:0,device.homeState.patrolLocked ? .65 : 1);
    if(viewport)controls=homeControls(model(),viewport,actor.toArray());
    schedule();
  }
  function paint(){
    frame=0;if(!available()||!viewport)return;
    metrics.draw(drawFrame);device.display.present();
  }
  function drawFrame(){
    take();
    const {wNative,hNative}=viewport;
    renderer.setRenderTarget(null);renderer.autoClear=false;renderer.setScissorTest(false);renderer.setClearColor(0,0);
    if(pose?.dirty){
      if(!target)target=new WebGLRenderTarget(pose.w,pose.h,{depthBuffer:false,stencilBuffer:false,minFilter:LinearFilter});
      else if(target.width!==pose.w||target.height!==pose.h)target.setSize(pose.w,pose.h);
      renderer.setRenderTarget(target);renderer.clear();
      try{pose.paint();pose.dirty=false;}finally{renderer.setRenderTarget(null);}
    }
    device.display.begin(page,wNative,hNative,schedule);renderer.clear();
    if(stage){
      stage.drawBehind(renderer);stage.drawCharacter(renderer,pose&&target?target.texture:null,actor);
      stage.drawInFront(renderer);hud?.paint(renderer,performance.now()/1000);
    }
    device.panel?.draw(renderer);
    device.feedback?.draw(renderer,viewport.width,viewport.height);
    device.toast?.draw(renderer,viewport.width,viewport.height);
    if(stage&&hud)page.dataset.threeHud='ready';
  }
  const unbind=bindHomeInput(canvas,{controls:()=>controls,enabled:()=>available()&&canvas.parentElement===page&&interactive()&&!device.panel&&!!hud,
    guide:()=>guide,activate:c=>send(c.action,c.data,canvas),focus:box=>{hud?.setFocus(box);schedule();},
    scale(id,k){
      const control=controls.find(c=>c.id===id);if(!control)return;
      if(id!=='chapter-title')stage?.setButtonScale(id,k);
      if(['coins','stamina','diamonds'].includes(id))for(const part of ['background','icon','plus'])stage?.setButtonScale(id+'-'+part,k);
      hud?.setPress(id,k,control.box);schedule();
    }});
  const resize=new ResizeObserver(position);resize.observe(page);const removeState=device.subscribeHome(sync);
  reduced.addEventListener('change',position);
  const view={page,selectPilot,owns:surface=>!!marker&&surface.parentElement===marker,
    setPose(surface,w,h,paintPose,changed){
      if(!view.owns(surface))return;
      const dirty=changed||!pose||pose.dirty||w!==pose.w||h!==pose.h;
      pose={surface,w,h,paint:paintPose,dirty};schedule();
    },
    forget(surface){if(pose?.surface===surface){pose=null;schedule();}},
    setGuide(g){
      if(guide?.id===g?.id&&guide?.text===g?.text&&guide?.strong===g?.strong)return;
      guide=g;updateGuide();schedule();
    },
    tick(){if(!reduced.matches&&!device.panel&&interactive()||canvas.parentElement!==page)schedule();},
    controls:()=>controls.map(({id,label,box})=>({id,label,box})),get guide(){return guide;},
    close(){
      if(closed)return;closed=true;metrics.release();cancelAnimationFrame(frame);resize.disconnect();removeState();unbind();reduced.removeEventListener('change',position);
      if(device.homeView===view)device.homeView=null;
      if(device.repaintHome===schedule)device.repaintHome=null;
      delete page.dataset.threeHud;marker?.remove();pose=null;generation++;
      hud?.dispose();stage?.dispose();target?.dispose();
      if(canvas.parentElement===page){
        device.home.append(canvas);canvas.className=previous.className;
        for(const [key,value] of [['style',previous.style],['role',previous.role],['aria-label',previous.label],['tabindex',previous.tab]]){
          if(value===null)canvas.removeAttribute(key);else canvas.setAttribute(key,value);
        }
        renderer.setRenderTarget(null);
        renderer.setClearColor(previous.color,previous.alpha);renderer.autoClear=previous.clear;
      }
    }};
  device.homeView=view;device.repaintHome=schedule;
  selectPilot(device.homeState.pilotId);position();
  if(available())take();
  Promise.all(homePictures.map(async([id,file])=>[id,await loadImage(file.startsWith('/')?file:'/art/psd-main-v1/'+file)]))
    .then(entries=>{if(closed)return;stage=createHomeStage(new Map(entries));stage.setPortraitScenery(scenery);stage.setPortraitStill(still);position();sync();})
    .catch(e=>{if(!closed)console.error(e);});
  createHomeHud(loadImage,model(),schedule).then(result=>{
    if(closed){result.dispose();return;}hud=result;position();sync();
  }).catch(e=>{if(!closed)console.error(e);});
  return view;
}

