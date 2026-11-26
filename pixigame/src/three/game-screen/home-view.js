import {Color,LinearFilter,Vector4,WebGLRenderTarget} from 'three';
import {createHomeStage,homePictures,viewportPixel} from './home-stage.js';
import {createHomeHud,homeGuideFiles} from './three-home-hud.js';
import {homeControls,bindHomeInput} from './home-input.js';
import {campaignButtons,homeInsets,navTabs} from './home-navigation.js';
import {PILOT_PORTRAITS} from '../../ui/character-portraits.js';
import {PORTRAIT_FRAMING} from '../../ui/portrait-framing.js';
import {optimizeUiAssetUrls} from '../../ui/ui-image-source.js';
import {loadArtwork} from './image-loading.js';
import {measureScreen} from './screen-metrics.js';

const chapterRewardsBox=homePictures.find(([id])=>id==='star-rewards')[2];
const homePictureUrl=file=>file.startsWith('/')?file:'/art/psd-main-v1/'+file;

export function homeEntryFiles(pilotId){
  const pilot=PILOT_PORTRAITS[pilotId]||{};
  const stage=homePictures.map(([,file])=>homePictureUrl(file));
  return [stage[0],pilot.image,...homeGuideFiles,pilot.scene,...stage.slice(1)].filter(Boolean).map(optimizeUiAssetUrls);
}

function loadImage(url,priority){return loadArtwork(optimizeUiAssetUrls(url),priority,true);}
export function homePortraitSize(id,view){
  const {width:w,height:h}=view;
  const [,rewardY,,rewardHeight]=chapterRewardsBox;
  const minimumTop=(rewardY+rewardHeight+20+homeInsets(view).top)*h/1624;
  const f=PORTRAIT_FRAMING[id];
  if(!f)return [-w*.125,Math.max(h*.13,minimumTop),1.25*w,1.25*w*1407/1118];
  const [left,top,right]=f.bounds,violet=id==='pilot-08';
  const height=w*1.36/(f.groundY-f.headY);
  const side=id==='pilot-04'?height:Math.min(height,w*(violet ? 1.06 : .98)/(right-left));
  const ground={'pilot-01':.80,'pilot-08':.77,'pilot-10':.755}[id]??.815;
  // The measured top includes movement above the resting head position.
  const y=Math.max(h*ground-f.groundY*side,minimumTop-top*side);
  return [w*(violet ? .49 : .5)-(left+right)/2*side,y,side,side];
}
function browserHomeHost(device,page){
  const canvas=device.display.input,reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const attrs=['style','aria-label','role','tabindex'],previous=attrs.map(name=>[name,canvas.getAttribute(name)]),className=canvas.className;
  return {page,anchor:canvas,
    ownsOutput:()=>canvas.parentElement===page,
    visible:()=>page.isConnected&&!page.closest('[hidden]')&&!document.hidden,
    reducedMotion:()=>reduced.matches,now:()=>performance.now(),
    requestFrame:callback=>requestAnimationFrame(callback),cancelFrame:id=>cancelAnimationFrame(id),
    layout:()=>({rect:page.getBoundingClientRect(),density:devicePixelRatio||1,safeBottom:parseFloat(getComputedStyle(page).paddingBottom)||0}),
    onLayout(update){const observer=new ResizeObserver(update);observer.observe(page);reduced.addEventListener('change',update);
      return ()=>{observer.disconnect();reduced.removeEventListener('change',update);};},
    claim(){page.append(canvas);canvas.className='three-home-screen';
      canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;z-index:1;touch-action:none;pointer-events:auto;outline:0';
      canvas.setAttribute('aria-label','少女航线主界面');canvas.setAttribute('role','application');canvas.tabIndex=0;},
    release(){device.home.append(canvas);canvas.className=className;
      for(const [key,value] of previous){if(value===null)canvas.removeAttribute(key);else canvas.setAttribute(key,value);}},
    newPortrait(id){const marker=document.createElement('div');marker.className='psd-main-portrait character-portrait';
      marker.dataset.characterPortrait=id;marker.setAttribute('aria-hidden','true');marker.style.cssText='position:absolute;pointer-events:none;visibility:hidden';
      page.prepend(marker);return marker;},
    movePortrait(marker,x,y,w,h){Object.assign(marker.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'});},
    dropPortrait:marker=>marker.remove(),ownsPortrait:(marker,surface)=>surface.parentElement===marker,
    bindInput:handlers=>bindHomeInput(canvas,handlers),
    begin:(w,h,refresh)=>device.display.begin(page,w,h,refresh),
    ready:value=>{if(value)page.dataset.threeHud='ready';else delete page.dataset.threeHud;},
  };
}

export function mountHomeView(device,page,send,interactive){
  return mountThreeHome(device,browserHomeHost(device,page),send,interactive);
}

export function mountThreeHome(device,host,send,interactive){
  const renderer=device.three,actor=new Vector4();
  const previous={color:renderer.getClearColor(new Color()),alpha:renderer.getClearAlpha(),clear:renderer.autoClear};
  let stage=null,hud=null,viewport=null,controls=[],pilot=null,marker=null,generation=0,guide=null,pose=null,target=null,frame=0,closed=false;
  let still=null,scenery=null,active=false,portraitReady,stageComplete=false;
  let entryFrame=null,cancelEntry=null,lastHomePaint=-Infinity,portraitSettled=false,painted=false;
  const mountedAt=host.now();
  const guideFace=[0,0,0,0];
  let hudGuide=null;
  const navigation=device.lobbyNavigation;
  const dockOffset=pose=>pose?(1-pose.dock)*166:0;
  function positionControls(pose,offset){
    const top=homeInsets(viewport).nav;
    for(const control of controls){
      const box=control.box;
      if(campaignButtons.includes(control.id)){
        control.dockY??=box[1];control.dockH??=box[3];
        box[1]=control.dockY+offset;
        box[3]=Math.max(0,Math.min(control.dockH,top-box[1]));
      }else if(control.id.startsWith('nav-')){
        const i=navTabs.indexOf(control.data.tab);
        box[0]=pose.edges[i];box[2]=pose.edges[i+1]-box[0];
      }
    }
  }
  const homeArtwork={
    navigation:(renderer,pose,pressed)=>hud?.paintNavigation(renderer,pose,pressed),
    dock(renderer,pose){
      if(!stage||!viewport)return;
      const offset=dockOffset(pose);
      stage.setDockOffset(offset);stage.drawDock(renderer);hud?.paintDockLabel(renderer,offset);
    },
  };
  if(navigation)navigation.homeArtwork=homeArtwork;
  const load=(url,priority)=>loadImage(url,priority??(host.stageEntry?1:undefined));
  function releasePose(){pose=null;target?.dispose();target=null;}
  function available(){return !closed&&host.visible()&&!device.battle&&!device.cover&&!device.preview;}
  const metrics=measureScreen(renderer,'Three 大厅',available);
  function schedule(){if(!frame&&available())frame=host.requestFrame(paint);}
  function take(){
    if(host.ownsOutput()&&active)return;
    host.claim();
    renderer.setPixelRatio(1);renderer.setRenderTarget(null);renderer.setScissorTest(false);renderer.setClearColor(0,0);renderer.autoClear=false;
    active=true;
  }
  function model(){return {...device.homeState,safeBottom:viewport?.safeBottom||0,reduced:host.reducedMotion()};}
  function updateGuide(){
    const control=guide&&controls.find(c=>c.id===guide.id);
    hudGuide=control?{...guide,target:campaignButtons.includes(control.id)?guideFace:control.box,reduced:host.reducedMotion()}:null;
  }
  function presentedGuide(panel){
    if(!hudGuide||panel)return null;
    if(hudGuide.target!==guideFace)return hudGuide;
    // The touch area stays generous while pressing. Follow the actual painted
    // face for the ring and arrows, including the dock slide and the press scale.
    if(!stage?.readButtonFace(hudGuide.id,guideFace))return null;
    const padding=4*750/viewport.width;
    return guideFace[1]+guideFace[3]+padding<=homeInsets(viewport).nav?hudGuide:null;
  }
  function position(){
    const {rect:p,density:ratio,safeBottom,safeTop,safeContentTop,menuButton}=host.layout();if(!p.width||!p.height)return;
    const x0=viewportPixel(p.left,ratio),y0=viewportPixel(p.top,ratio);
    const wNative=viewportPixel(p.right,ratio)-x0,hNative=viewportPixel(p.bottom,ratio)-y0;
    if(!wNative||!hNative)return;
    viewport={width:p.width,height:p.height,left:p.left,top:p.top,ratio,wNative,hNative,safeBottom,safeTop,safeContentTop,menuButton};
    const [x,y,w,h]=homePortraitSize(pilot,viewport);
    if(marker)host.movePortrait(marker,x,y,w,h);
    const ax=viewportPixel(p.x+x,ratio)-x0,ay=viewportPixel(p.y+y,ratio)-y0;
    actor.set(ax*750/wNative,ay*1624/hNative,(viewportPixel(p.x+x+w,ratio)-x0-ax)*750/wNative,(viewportPixel(p.y+y+h,ratio)-y0-ay)*1624/hNative);
    controls=homeControls(model(),viewport,actor.toArray());
    if(navigation)positionControls(navigation.pose,dockOffset(navigation.pose));
    stage?.layout(viewport);hud?.layout(viewport);updateGuide();schedule();
  }
  function selectPilot(id){
    if(id===pilot){
      if(!marker?.closed)return false;
      pose=null;marker=host.newPortrait(id);position();return true;
    }
    pilot=id;generation++;pose=null;still=null;scenery=null;portraitSettled=false;
    stage?.setPortraitStill(null);stage?.setPortraitScenery(null);
    if(marker)host.dropPortrait(marker);marker=host.newPortrait(id);
    const config=PILOT_PORTRAITS[id]||{},token=generation;
    function loadPortrait(url,scene){
      if(!url)return;
      return load(url).then(image=>{
        if(closed||generation!==token)return;
        if(scene){scenery=image;stage?.setPortraitScenery(image);}else{still=image;stage?.setPortraitStill(image);}
        schedule();
      });
    }
    portraitReady=Promise.all([loadPortrait(config.scene,true),loadPortrait(config.image||device.homeState.pilotImage,false)]);
    function settlePortrait(){if(!closed&&generation===token){portraitSettled=true;schedule();}}
    void portraitReady.then(settlePortrait,error=>{if(!closed&&generation===token)console.error(error);settlePortrait();});
    position();return true;
  }
  function sync(){
    hud?.updateModel(model());stage?.setGrade('patrol',device.homeState.patrolLocked?1:0,device.homeState.patrolLocked ? .65 : 1);
    if(viewport){
      controls=homeControls(model(),viewport,actor.toArray());
      if(navigation)positionControls(navigation.pose,dockOffset(navigation.pose));
      updateGuide();
    }
    schedule();
  }
  function paint(){
    frame=0;if(!available()||!viewport)return;
    if(device.panel||!interactive())unbind.cancel?.();
    if(!painted&&host.stageEntry&&!device.panel&&(!stage||!hud))return;
    if(!host.stageEntry&&!painted&&(!stageComplete||!hud?.ready()||!portraitSettled)&&host.now()-mountedAt<12000){schedule();return;}
    if(device.panel?.prepareFrame?.()===false)return;
    metrics.draw(drawFrame);painted=true;
    if(!device.panel?.fullscreen&&!device.homeState.firstSortieRequired)device.display.present();
  }
  function drawFrame(){
    take();
    const {wNative,hNative}=viewport;
    const panel=device.panel;
    if(panel?.fullscreen){
      host.begin(wNative,hNative,schedule);
      panel.draw(renderer);
      return;
    }
    renderer.setRenderTarget(null);renderer.autoClear=false;renderer.setScissorTest(false);renderer.setClearColor(0,0);
    if(pose?.dirty){
      if(!target)target=new WebGLRenderTarget(pose.w,pose.h,{depthBuffer:false,stencilBuffer:false,minFilter:LinearFilter});
      else if(target.width!==pose.w||target.height!==pose.h)target.setSize(pose.w,pose.h);
      renderer.setRenderTarget(target);renderer.clear();
      try{pose.paint();pose.dirty=false;}finally{renderer.setRenderTarget(null);}
    }
    host.begin(wNative,hNative,schedule);renderer.clear();
    lastHomePaint=host.now();
    const motion=navigation?.frame(lastHomePaint);
    if(motion)positionControls(motion,dockOffset(motion));
    drawContents(panel,pose&&target?target.texture:null,lastHomePaint,motion);
    if(motion?.navMoving||motion?.dockMoving)schedule();
    device.feedback?.draw(renderer,viewport.width,viewport.height);
    device.toast?.draw(renderer,viewport.width,viewport.height);
    if(stage&&hud)host.ready(true);
  }
  function drawContents(panel,portrait=null,time=host.now(),motion){
    const offset=dockOffset(motion);
    if(stage){
      stage.setDockOffset(offset);
      stage.drawBehind(renderer);stage.drawCharacter(renderer,portrait,actor);
      stage.drawInFront(renderer,device.homeState.firstSortieRequired,device.homeState.showTasks);
    }
    if(hud){hud.setGuide(presentedGuide(panel));hud.paint(renderer,time/1000,motion,offset);}
    panel?.draw(renderer);
  }
  function warmEntry(panel){
    // Warm the exact lobby layers without touching the startup drawing buffer.
    const output=renderer.getRenderTarget(),clip=renderer.getScissorTest(),clear=renderer.autoClear;
    const oldViewport=new Vector4(),scissor=new Vector4();
    renderer.getViewport(oldViewport);renderer.getScissor(scissor);
    const buffer=new WebGLRenderTarget(1,1,{depthBuffer:false,stencilBuffer:false});
    try{
      renderer.setRenderTarget(buffer);renderer.setViewport(0,0,1,1);renderer.setScissorTest(false);
      renderer.autoClear=false;
      drawContents(panel);
    }finally{
      renderer.setRenderTarget(output);renderer.setViewport(oldViewport);renderer.setScissor(scissor);
      renderer.setScissorTest(clip);renderer.autoClear=clear;buffer.dispose();
    }
  }
  async function prepareEntry(){
    await Promise.all([stageReady,hudReady]);
    let portrait;
    do{portrait=portraitReady;await portrait;}while(!closed&&portrait!==portraitReady);
    if(closed)throw Error('大厅已关闭');
    return new Promise((resolve,reject)=>{
      function finish(error){
        if(entryFrame!==null)host.cancelFrame(entryFrame);
        entryFrame=cancelEntry=null;
        if(error)reject(error);else resolve();
      }
      function prepare(){
        entryFrame=null;
        try{
          const panel=device.panel;
          if(viewport&&!renderer.getContext().isContextLost()&&hud.ready()&&(!panel||panel.prepare(true))){
            warmEntry(panel);finish();return;
          }
          entryFrame=host.requestFrame(prepare);
        }catch(error){finish(error);}
      }
      cancelEntry=()=>finish(Error('大厅已关闭'));
      entryFrame=host.requestFrame(prepare);
    });
  }
  const unbind=host.bindInput({controls:()=>controls,enabled:()=>available()&&host.ownsOutput()&&interactive()&&!device.panel&&!!hud&&painted,
    guide:()=>guide,activate:c=>send(c.action,c.data,host.anchor),focus:box=>{hud?.setFocus(box);schedule();},
    scale(id,k){
      const control=controls.find(c=>c.id===id);if(!control)return;
      if(id!=='chapter-title')stage?.setButtonScale(id,k);
      if(['coins','stamina','diamonds'].includes(id))for(const part of ['background','icon','plus'])stage?.setButtonScale(id+'-'+part,k);
      hud?.setPress(id,k,control.box);schedule();
    }});
  const removeLayout=host.onLayout((_view,foreground)=>{if(foreground===false)unbind.cancel?.();position();});
  const removeState=device.subscribeHome(sync);
  const view={page:host.page,selectPilot,prepareEntry,owns:surface=>!!marker&&host.ownsPortrait(marker,surface),
    paintNow(){host.cancelFrame(frame);paint();},
    activate(){device.homeView=view;device.repaintHome=schedule;schedule();},
    park(){
      unbind.cancel?.();
      host.cancelFrame(frame);frame=0;active=false;host.release();
      if(device.homeView===view)device.homeView=null;
      if(device.repaintHome===schedule)device.repaintHome=null;
    },
    setPose(surface,w,h,paintPose,changed){
      if(!view.owns(surface))return;
      const dirty=changed||!pose||pose.dirty||w!==pose.w||h!==pose.h;
      pose={surface,w,h,paint:paintPose,dirty};schedule();
    },
    forget(surface){if(view.owns(surface)||pose?.surface===surface){releasePose();schedule();}},
    setGuide(g){
      if(guide?.id===g?.id&&guide?.text===g?.text&&guide?.strong===g?.strong)return;
      guide=g;updateGuide();schedule();
    },
    tick(){
      if(!host.ownsOutput()){schedule();return;}
      if(host.reducedMotion()||device.panel||!interactive())return;
      if(!host.idleHudInterval){schedule();return;}
      const now=host.now();
      if(now-lastHomePaint>=host.idleHudInterval-1&&hud?.animationDue(lastHomePaint/1000,now/1000))schedule();
    },
    controls:()=>controls.map(({id,label,box})=>({id,label,box})),get guide(){return guide;},
    close(){
      if(closed)return;closed=true;cancelEntry?.();metrics.release();host.cancelFrame(frame);removeLayout();removeState();unbind();
      if(navigation?.homeArtwork===homeArtwork)navigation.homeArtwork=null;
      if(device.homeView===view)device.homeView=null;
      if(device.repaintHome===schedule)device.repaintHome=null;
      host.ready(false);if(marker)host.dropPortrait(marker);releasePose();generation++;
      hud?.dispose();stage?.dispose();
      if(host.ownsOutput()){
        host.release();
        renderer.setRenderTarget(null);
        renderer.setClearColor(previous.color,previous.alpha);renderer.autoClear=previous.clear;
      }
    }};
  device.homeView=view;device.repaintHome=schedule;
  selectPilot(device.homeState.pilotId);position();
  if(available())take();
  const initialImages=new Map();
  const stageReady=Promise.all(homePictures.map(async([id,file])=>{
    let image;
    try{image=await load(homePictureUrl(file),id==='background'&&host.stageEntry?2:undefined);}
    catch(error){if(!closed)console.warn('[Three 大厅贴图]',file,error?.message||error);}
    if(closed)return;
    if(stage){
      if(image){stage.setArtwork(id,image);schedule();}
      return;
    }
    if(image)initialImages.set(id,image);
    if(id==='background'){
      stage=createHomeStage(initialImages);initialImages.clear();
      stage.setPortraitScenery(scenery);stage.setPortraitStill(still);position();sync();
    }
  })).then(()=>{stageComplete=true;schedule();});
  const hudReady=createHomeHud(load,model(),schedule).then(result=>{
    if(closed){result.dispose();return;}hud=result;position();sync();
  });
  for(const work of [stageReady,hudReady])work.catch(error=>{if(!closed)console.error(error);});
  return view;
}
