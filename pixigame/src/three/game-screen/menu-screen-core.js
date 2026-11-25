import {Color} from 'three';
import {createLobbyPanel} from './lobby-panel.js';
import {chrome} from './menu-art.js';
import {bottomNavigation} from './home-navigation.js';
import {shopMenu,shopData} from './menu-shop.js';
import {researchMenu} from './menu-research.js';
import {equipmentMenu} from './menu-equipment.js';
import {recruitMenu} from './menu-recruit.js';
import {createHomeHud} from './three-home-hud.js';
import {optimizeUiAssetUrls} from '../../ui/ui-image-source.js';
import {loadArtwork} from './image-loading.js';
import {measureScreen} from './screen-metrics.js';
import {paintItemDetail} from './item-details.js';
import {catalogModel,catalogAircraftRect,isCatalog} from './catalog-model.js';
import {catalogMenu} from './menu-catalog.js';
import {workshopMenu} from './menu-workshop.js';
import {equipmentLayout} from './equipment-layout.js';

const menus={shop:shopMenu,research:researchMenu,assembly:equipmentMenu,supply:recruitMenu};
export function supportsMenu(tab,subpage){return subpage?isCatalog(subpage)||subpage==='workshop':Object.hasOwn(menus,tab);}
export function mountThreeMenu(device,host,send,interactive,setSection){
  const renderer=device.three;
  const {prepareArtwork}=host;
  const completeEntry=Boolean(prepareArtwork&&host.region.completeEntry);
  const staged=prepareArtwork&&(!host.region.main||completeEntry);
  const progressive=Boolean(host.progressiveEntry);
  const mountedAt=host.beginEntryTrace?host.now():undefined;
  const saved={color:renderer.getClearColor(new Color()),alpha:renderer.getClearAlpha(),autoClear:renderer.autoClear};
  let state=null,identity='',tab='',revision=0,frame=0,closed=false,pendingScroll=null,guide=null,guideHud=null,guideLoading=false;
  let preview=null,sortOpen=false,lastTick=0,inspect=null;
  let previewRect,previewWidth,previewHeight,previewInset;
  let entering=null,entryBuilt=false,entryFailed=false,preparingModel=false;
  let portraitFrame=0,wantsPortrait=false;
  let presented=false,entryTrace=null,parked=host.parked;
  function visible(){return !closed&&host.visible()&&!device.battle&&!device.preview&&!device.cover;}
  const metrics=measureScreen(renderer,'Three 功能页',visible);
  function request(){if(!frame&&visible())frame=host.requestFrame(draw);}
  const portrait=host.openPortrait(refresh,request);
  const scene=createLobbyPanel(device,host.region,'少女航线', (model,w,h,tools)=>{
    if(model.tab==='workshop')workshopMenu(model,w,h,tools);
    else if(isCatalog(model.tab))catalogMenu(model,w,h,tools);
    else{
      const bars=chrome(model,w,h,tools);
      const section=progressive&&model.tab==='shop'?pendingScroll:null;
      menus[model.tab](model,w,h,tools,bars,section);
      if(section!==null)pendingScroll=null;
      bars.footer();
    }
    if(inspect){paintItemDetail({...model,inspect},w,h,tools);return 'inspect';}
    return 'base';
  },command=>{
    if(command.type==='inspect'){
      inspect=command.data;scene.scroll('inspect',0);refresh();
    }else if(command.type==='close'&&inspect){inspect=null;refresh();}
    else if(command.type==='sortGear'){
      sortOpen=!sortOpen&&!command.data?.value;state.sortOpen=sortOpen;refresh();
      if(command.data?.value)send('gearSort',{value:command.data.value},host.anchor);
    }else if(command.type==='close'&&sortOpen){sortOpen=false;state.sortOpen=false;refresh();}
    else if(command.type==='workshopChoose'){scene.scroll(workshopZone(),0);host.focus?.();}
    else if(command.type==='close'&&tab==='workshop')send('catalogBack',{},host.anchor);
    else if(command.type==='close'&&isCatalog(tab)){
      if(tab==='weapon'&&state.catalogView?.slot!=null)send('nativeWeaponSkillBrowse',{id:state.catalogView.skillWeapon.id},host.anchor);
      else send('catalogBack',{},host.anchor);
    }else if(!['close','orbit'].includes(command.type))send(command.type,command.data||{},host.anchor);
  },{
    main:true,deferInput:host.parked,interactive:()=>(canUsePage()||completeEntry&&entering!==null)&&interactive(),
    repaint:progressive?request:undefined,progressive,artworkVisible:visible,backgroundPriority:host.backgroundPriority,
    allows:id=>(!completeEntry||entering===null||id.startsWith('nav-'))&&(Boolean(inspect)||!guide?.strong||guide.id===id),
    onScroll(zone,y,anchors,max){
      if(tab!=='shop'||zone!=='base')return;
      const last=anchors.get('coins'),atEnd=max>2&&y>=max-2;
      const id=atEnd?'coins':y>=(last??Infinity)-2?'coins':y>=(anchors.get('daily')??Infinity)-2?'daily':'boxes';
      if(state.shopSection!==id){state.shopSection=id;setSection(id);refresh();}
    }});
  function workshopZone(){const ws=state.workshop;return 'workshop-'+(ws.kind==='gear'?'':ws.mode+'-')+ws.filter;}
  const workshopOpeningScroll=()=>state.workshop.kind==='weapon'&&state.workshop.id?'selected-weapon':0;
  function refresh(){if(state)scene.update(state,++revision,tab);}
  function canUsePage(){return entering===null&&(!progressive||presented);}
  function pausePortrait(){
    host.cancelFrame(portraitFrame);portraitFrame=0;wantsPortrait=false;portrait.setActive?.(false);
  }
  function startEntry(){
    entering=host.now();entryBuilt=false;scene.stage();request();
  }
  function waitForEntry(){request();return false;}
  function needsAircraft(){return tab==='assembly'&&preview?.prepare&&!preview.ready&&!preview.usingStill;}
  function failEntry(offscreen){
    if(offscreen)throw Error('首屏贴图未加载');
    entryFailed=true;finishEntryTrace('贴图加载失败');
    device.toast?.show('界面资源加载失败，请重新进入');
    send('tab',{tab:'battle'},host.anchor);
    return false;
  }
  function finishEntryTrace(status){
    entryTrace?.stop(status);
    entryTrace=null;
  }
  function prepareScene(offscreen=false){
    if(!entryTrace)return scene.prepare(offscreen);
    const start=host.now(),ready=scene.prepare(offscreen);
    entryTrace.prepare(host.now()-start);
    return ready;
  }
  function applyScroll(notify){
    if(pendingScroll===null)return;
    const value=pendingScroll;pendingScroll=null;scene.scroll(tab==='workshop'?workshopZone():'base',value,notify);
  }
  function tickPreview(){
    const now=host.now();preview?.tick(lastTick?(now-lastTick)/1000:0);lastTick=now;
  }
  function hangarPreview(w,h){
    if(w!==previewWidth||h!==previewHeight||state.safeBottom!==previewInset){
      previewWidth=w;previewHeight=h;previewInset=state.safeBottom;
      const nav=bottomNavigation(w,h,previewInset,state.native);
      previewRect=equipmentLayout(w,nav.top,state.native).preview;
    }
    return previewRect;
  }
  function prepareEntry(offscreen=false,maxUploads,withAircraft=!offscreen){
    if(!entryBuilt){
      let ready=prepareScene(offscreen);
      if(tab==='workshop'&&pendingScroll!==null){applyScroll(false);ready=prepareScene(offscreen);}
      const artwork=scene.artwork(),elapsed=host.now()-entering;
      if(completeEntry&&(ready&&[...artwork].some(texture=>texture.userData.failed)||!offscreen&&elapsed>=12000&&!ready))
        return failEntry(offscreen);
      if((offscreen||completeEntry||elapsed<(host.entryWaitMs??900))&&(!prepareArtwork(artwork,maxUploads)||!ready))
        return waitForEntry();
      if(completeEntry&&withAircraft&&needsAircraft()&&(offscreen||!host.region.allowAircraftStill?.())){
        preparingModel=true;
        try{if(!preview.prepare(host.now()))return waitForEntry();}
        finally{preparingModel=false;}
      }
      entryBuilt=true;
      if(scene.commit({batchLate:!completeEntry,groupLate:true})){
        prepareScene();request();return false;
      }
    }
    entering=null;
    return true;
  }
  function schedulePortrait(){
    if(!wantsPortrait||portraitFrame||!visible()||!interactive())return;
    portraitFrame=host.requestFrame(()=>{
      portraitFrame=0;
      if(visible()&&interactive()&&presented&&tab==='pilot'){wantsPortrait=false;portrait.setActive?.(true);}
    });
  }
  function draw(){
    frame=0;if(!state||!visible()||entryFailed)return;
    const firstPaint=!presented;
    if(entering!==null&&!prepareEntry())return;
    const start=entryTrace?host.now():0;
    const painted=metrics.draw(drawFrame);
    if(!device.panel?.fullscreen)device.display.present();
    if(painted&&entryTrace&&!entryTrace.paint(scene.artwork(),preview?.usingStill?undefined:preview?.ready,tab==='shop'?state.shopSection:undefined,host.now()-start)){
      entryTrace=null;
    }
    // Let the still portrait and controls paint before requesting Live2D.
    if(progressive&&painted&&firstPaint&&tab==='pilot')wantsPortrait=true;
    schedulePortrait();
  }
  function drawFrame(){
    if(!host.ownsOutput())host.take();
    const {rect:b,density:ratio}=host.layout();if(!b.width||!b.height)return;
    const w=Math.max(1,Math.round(b.width*ratio)),h=Math.max(1,Math.round(b.height*ratio));
    const panel=device.panel;
    if(panel?.fullscreen){
      host.begin(w,h,request);
      panel.draw(renderer);
      return;
    }
    if(progressive){prepareScene();applyScroll(false);}
    if(tab==='pilot')portrait.paintPose(renderer);
    host.begin(w,h,request);renderer.setClearColor(0,0);renderer.autoClear=false;renderer.clear();
    scene.draw(renderer);
    if(!progressive)applyScroll();
    device.panel?.draw(renderer);
    if(guide&&guideHud&&(guide.modal?device.panel:interactive())&&!inspect){
      const target=(guide.modal?device.panel:scene).state().controls.find(c=>c.id===guide.id);
      if(target)guideHud.paintGuide(renderer,host.now()/1000,{...guide,reduced:host.reducedMotion(),target:[(target.x-b.x)*750/b.width,(target.y-b.y)*1624/b.height,target.w*750/b.width,target.h*1624/b.height]},b);
    }
    device.feedback?.draw(renderer,b.width,b.height);
    device.toast?.draw(renderer,b.width,b.height);
    presented=true;
    return true;
  }
  const unwatch=host.onLayout((_viewport,foreground)=>{if(foreground===false)finishEntryTrace('切到后台');
    if(state){state.safeBottom=host.layout().safeBottom;if(completeEntry&&foreground!==false&&visible())startEntry();}
    portrait.resize();if(preview&&state&&(!progressive||visible()))preview.update(state.snapshot,state.catalogView?.plane||state.snapshot.aircraftId);scene.invalidate();request();});
  function ensureGuide(){
    if(guideHud||guideLoading)return;guideLoading=true;
    const load=url=>loadArtwork(optimizeUiAssetUrls(url));
    createHomeHud(load,{},request).then(hud=>{if(closed)hud.dispose();else{guideHud=hud;request();}}).catch(()=>{guideLoading=false;});
  }
  const view={page:host.page,state:scene.state,get preparing(){return completeEntry&&entering!==null&&!entryFailed;},get entryFailed(){return entryFailed;},update(next,key){
    const changed=next.tab!==tab;
    const nextKey=[key,next.tab,next.section,next.shopSection,next.gearSort,next.gearFilter,next.selected,next.fleetReturnKind,JSON.stringify(next.catalog),JSON.stringify(next.workshop)].join('|');
    if(!changed&&identity===nextKey){
      if(tab==='shop')view.clock(next.time);
      return;
    }
    if(changed&&host.beginEntryTrace&&!parked){
      finishEntryTrace('切页');
      entryTrace=host.beginEntryTrace(next.tab,false,tab?undefined:mountedAt);
    }
    identity=nextKey;tab=next.tab;
    if(changed){
      preview?.close();preview=null;presented=false;sortOpen=false;inspect=null;
      if(progressive)pausePortrait();
      if(staged)startEntry();
    }else if(staged&&(completeEntry&&entering===null||!presented&&(tab==='workshop'||isCatalog(tab)&&entering===null)))startEntry();
    if(host.native&&tab==='assembly'&&next.gearFilter!==state?.gearFilter)scene.scroll('warehouse',0,false);
    state={...next,sortOpen,reduced:host.reducedMotion(),safeBottom:host.layout().safeBottom,
      native:host.native,windowedCatalog:progressive,progressive,
      prioritizedArtwork:progressive&&(tab!=='research'||next.section!=='lab')};
    if(isCatalog(tab))state.catalogView=catalogModel(state);
    portrait.select(state.catalogView?.appearance?.id||'');state.portrait=portrait;
    if(tab==='aircraft'&&state.catalogView?.plane){
      preview??=host.openAircraft(scene,refresh,request,()=>visible()&&interactive(),
        {profile:'catalog',rect:catalogAircraftRect,stageModel:progressive,prefetchModel:!progressive,acceptOrbit:canUsePage});
      state.preview=preview;preview.update(next.snapshot,state.catalogView.plane);
    }
    if(tab==='assembly'){
      preview??=host.openAircraft(scene,refresh,request,()=>preparingModel||visible()&&interactive(),
        {stageModel:progressive,prefetchModel:!progressive,acceptOrbit:canUsePage,rect:hangarPreview});
      state.preview=preview;preview.update(next.snapshot);
    }
    if(tab==='shop'){
      state.showcases=shopData(next.snapshot);
      state.shownMinute=Math.floor(next.time/60000);
    }
    if(changed||tab==='workshop'&&!presented)pendingScroll=tab==='shop'?(next.shopSection==='stamina'?'coins':next.shopSection):
      tab==='workshop'?workshopOpeningScroll():null;
    refresh();request();
  },prepareOffscreen(maxUploads,withAircraft=false){
    if(closed||!state)return false;
    let ready;
    if(prepareArtwork&&!staged){
      // Warm main tabs offscreen without holding their visible first frame.
      const prepared=prepareScene(true);
      ready=prepareArtwork(scene.artwork(),maxUploads)&&prepared;
    }else{
      if(withAircraft&&entering===null&&needsAircraft())startEntry();
      ready=entering===null||prepareEntry(true,maxUploads,withAircraft);
    }
    return ready&&(!host.native||!host.region.main||scene.warmPrograms(renderer));
  },activate(){
    scene.bindInput();
    device.menuView=view;device.repaintHome=request;
    if(state&&host.beginEntryTrace)entryTrace=host.beginEntryTrace(tab,!parked);
    parked=false;
    if(completeEntry&&state&&(needsAircraft()||entering!==null||!scene.state().ready))startEntry();
    if(staged&&tab==='workshop'&&pendingScroll!==null&&entering===null)startEntry();
    if(preview&&state)preview.update(state.snapshot,state.catalogView?.plane||state.snapshot.aircraftId);
    request();
  },trimAircraft(){preview?.releaseModel?.();},park(){
    finishEntryTrace('离开页面');
    host.cancelFrame(frame);frame=0;lastTick=0;presented=false;scene.cancelInput();
    if(tab==='workshop')pendingScroll=workshopOpeningScroll();
    pausePortrait();
    if(host.ownsOutput())host.release();
    if(sortOpen||inspect){sortOpen=false;inspect=null;state.sortOpen=false;refresh();}
    preview?.pause?.();
    if(device.menuView===view)device.menuView=null;
    if(device.repaintHome===request)device.repaintHome=null;
  },clock(time){
    if(tab!=='shop'||!state||!Number.isFinite(time)||Math.floor((state.time||0)/1000)===Math.floor(time/1000))return;
    state.time=time;
    const hasTimer=state.snapshot.nativeAcquisition?.equipmentBoxes?.some(row=>row.compatibility?.nextFreeAt>time);
    if(hasTimer||Math.floor(time/60000)!==state.shownMinute){state.shownMinute=Math.floor(time/60000);refresh();}
  },section(value){
    pendingScroll=value==='stamina'?'coins':value;
    if(state&&state.shopSection!==pendingScroll){state.shopSection=pendingScroll;refresh();}
    request();
  },
    get safeBottom(){return state?.safeBottom||0;},owns:portrait.owns,setPose:portrait.setPose,forget:portrait.forget,portraitChanged:portrait.changed,
    canGuidePanel(id){return Boolean(device.panel?.state().controls.some(c=>c.id===id&&!c.disabled));},
    setGuide(g){
      device.panel?.setGuideTarget(g?.modal&&g.strong?g.id:null);
      if(guide?.id===g?.id&&guide?.strong===g?.strong&&guide?.text===g?.text&&guide?.modal===g?.modal)return;
      guide=g;if(g)ensureGuide();request();
    },
    tick(){if(preview&&visible()&&canUsePage()){
        if(needsAircraft()&&host.region.allowAircraftStill?.())preview.prepare(host.now());
        else tickPreview();
      }
      schedulePortrait();
      if(visible()&&(!host.reducedMotion()&&(interactive()&&scene.animated||guide)||!host.ownsOutput()))request();},
    close(){
      if(closed)return;closed=true;finishEntryTrace('离开页面');metrics.release();host.cancelFrame(frame);host.cancelFrame(portraitFrame);unwatch();preview?.close();portrait.close();scene.close();guideHud?.dispose();
      if(device.menuView===view)device.menuView=null;if(device.repaintHome===request)device.repaintHome=null;
      if(host.ownsOutput()){
        host.release();
        renderer.setClearColor(saved.color,saved.alpha);renderer.autoClear=saved.autoClear;}
    }};
  if(!parked){device.menuView=view;device.repaintHome=request;}
  return view;
}
