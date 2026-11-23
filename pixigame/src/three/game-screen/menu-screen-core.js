import {Color} from 'three';
import {createLobbyPanel} from './lobby-panel.js';
import {chrome,menuNavY} from './menu-art.js';
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
  const staged=Boolean(host.prepareArtwork);
  const saved={color:renderer.getClearColor(new Color()),alpha:renderer.getClearAlpha(),autoClear:renderer.autoClear};
  let state=null,identity='',tab='',revision=0,frame=0,closed=false,pendingScroll=null,guide=null,guideHud=null,guideLoading=false;
  let preview=null,sortOpen=false,lastTick=0,inspect=null;
  let previewRect,previewWidth,previewHeight,previewInset;
  let entering=null,entryBuilt=false,portraitFrame=0,wantsPortrait=false;
  function visible(){return !closed&&host.visible()&&!device.battle&&!device.preview&&!device.cover;}
  const metrics=measureScreen(renderer,'Three 功能页',visible);
  function request(){if(!frame&&visible())frame=host.requestFrame(draw);}
  const portrait=host.openPortrait(refresh,request);
  const scene=createLobbyPanel(device,host.region,'少女航线', (model,w,h,tools)=>{
    if(model.tab==='workshop')workshopMenu(model,w,h,tools);
    else if(isCatalog(model.tab))catalogMenu(model,w,h,tools);
    else{const bars=chrome(model,w,h,tools);menus[model.tab](model,w,h,tools,bars);bars.footer();}
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
    main:true,interactive:()=>entering===null&&interactive(),repaint:staged?request:undefined,
    allows:id=>Boolean(inspect)||!guide?.strong||guide.id===id,
    onScroll(zone,y,anchors,max){
      if(tab!=='shop'||zone!=='base')return;
      const last=anchors.get('coins'),atEnd=max>2&&y>=max-2;
      const id=atEnd?'coins':y>=(last??Infinity)-2?'coins':y>=(anchors.get('daily')??Infinity)-2?'daily':'boxes';
      if(state.shopSection!==id){state.shopSection=id;setSection(id);refresh();}
    }});
  function workshopZone(){const ws=state.workshop;return 'workshop-'+(ws.kind==='gear'?'':ws.mode+'-')+ws.filter;}
  function refresh(){if(state)scene.update(state,++revision,tab);}
  function startEntry(){
    host.cancelFrame(portraitFrame);portraitFrame=0;wantsPortrait=false;portrait.setActive?.(false);
    entering=host.now();entryBuilt=false;scene.stage();request();
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
      previewRect=equipmentLayout(w,menuNavY(w,h,previewInset),state.adaptiveEquipment).preview;
    }
    return previewRect;
  }
  function prepareEntry(){
    if(!entryBuilt){
      const ready=scene.prepare();
      const catalog=isCatalog(tab),wait=host.now()-entering;
      if(wait<900||catalog&&!ready&&wait<2000){
        if(!host.prepareArtwork(scene.artwork())){request();return false;}
        if(preview&&!preview.ready&&interactive()){tickPreview();request();return false;}
        if(!ready){request();return false;}
      }
      entryBuilt=true;
      if(scene.commit({batchLate:!catalog})){
        scene.prepare();request();return false;
      }
    }
    entering=null;
    return true;
  }
  function schedulePortrait(){
    if(!wantsPortrait||portraitFrame||!visible()||!interactive())return;
    portraitFrame=host.requestFrame(()=>{
      portraitFrame=0;
      if(visible()&&interactive()&&entering===null&&tab==='pilot'){wantsPortrait=false;portrait.setActive?.(true);}
    });
  }
  function draw(){
    frame=0;if(!state||!visible())return;
    const enteringPage=entering!==null;
    if(entering!==null&&!prepareEntry())return;
    metrics.draw(drawFrame);device.display.present();
    // Let the still portrait and controls paint before requesting Live2D.
    if(enteringPage&&tab==='pilot')wantsPortrait=true;
    schedulePortrait();
  }
  function drawFrame(){
    if(!host.ownsOutput())host.take();
    const {rect:b,density:ratio}=host.layout();if(!b.width||!b.height)return;
    const w=Math.max(1,Math.round(b.width*ratio)),h=Math.max(1,Math.round(b.height*ratio));
    if(staged){scene.prepare();applyScroll(false);}
    if(tab==='pilot')portrait.paintPose(renderer);
    host.begin(w,h,request);renderer.setClearColor(0,0);renderer.autoClear=false;renderer.clear();
    scene.draw(renderer);
    if(!staged)applyScroll();
    device.panel?.draw(renderer);
    if(guide&&guideHud&&(guide.modal?device.panel:interactive())&&!inspect){
      const target=(guide.modal?device.panel:scene).state().controls.find(c=>c.id===guide.id);
      if(target)guideHud.paintGuide(renderer,host.now()/1000,{...guide,reduced:host.reducedMotion(),target:[(target.x-b.x)*750/b.width,(target.y-b.y)*1624/b.height,target.w*750/b.width,target.h*1624/b.height]},b.width);
    }
    device.feedback?.draw(renderer,b.width,b.height);
    device.toast?.draw(renderer,b.width,b.height);
  }
  const unwatch=host.onLayout(()=>{if(state)state.safeBottom=host.layout().safeBottom;
    portrait.resize();if(preview&&state&&(!staged||visible()))preview.update(state.snapshot,state.catalogView?.plane||state.snapshot.aircraftId);scene.invalidate();request();});
  function ensureGuide(){
    if(guideHud||guideLoading)return;guideLoading=true;
    const load=url=>loadArtwork(optimizeUiAssetUrls(url));
    createHomeHud(load,{},request).then(hud=>{if(closed)hud.dispose();else{guideHud=hud;request();}}).catch(()=>{guideLoading=false;});
  }
  const view={page:host.page,state:scene.state,update(next,key){
    const changed=next.tab!==tab;
    const nextKey=[key,next.tab,next.section,next.shopSection,next.gearSort,next.gearFilter,next.selected,next.fleetReturnKind,JSON.stringify(next.catalog),JSON.stringify(next.workshop)].join('|');
    if(!changed&&identity===nextKey)return;
    identity=nextKey;tab=next.tab;
    if(changed){preview?.close();preview=null;sortOpen=false;inspect=null;if(staged)startEntry();}
    if(host.adaptiveEquipment&&tab==='assembly'&&next.gearFilter!==state?.gearFilter)scene.scroll('warehouse',0,false);
    state={...next,sortOpen,reduced:host.reducedMotion(),safeBottom:host.layout().safeBottom,adaptiveEquipment:host.adaptiveEquipment,windowedCatalog:staged};
    if(isCatalog(tab))state.catalogView=catalogModel(state);
    portrait.select(state.catalogView?.appearance?.id||'');state.portrait=portrait;
    if(tab==='aircraft'&&state.catalogView?.plane){
      preview??=host.openAircraft(scene,refresh,request,()=>visible()&&interactive(),
        {profile:'catalog',rect:catalogAircraftRect,stageModel:staged,acceptOrbit:()=>entering===null});
      state.preview=preview;preview.update(next.snapshot,state.catalogView.plane);
    }
    if(tab==='assembly'){
      preview??=host.openAircraft(scene,refresh,request,()=>visible()&&interactive(),
        {stageModel:staged,acceptOrbit:()=>entering===null,rect:hangarPreview});
      state.preview=preview;preview.update(next.snapshot);
    }
    if(tab==='shop')state.showcases=shopData(next.snapshot);
    if(changed)pendingScroll=tab==='shop'?next.shopSection:tab==='workshop'&&next.workshop.kind==='weapon'&&next.workshop.id?'selected-weapon':null;
    refresh();request();
  },activate(){
    device.menuView=view;device.repaintHome=request;
    if(staged&&state)startEntry();
    if(preview&&state)preview.update(state.snapshot,state.catalogView?.plane||state.snapshot.aircraftId);
    request();
  },park(){
    host.cancelFrame(frame);frame=0;lastTick=0;scene.cancelInput();
    host.cancelFrame(portraitFrame);portraitFrame=0;wantsPortrait=false;portrait.setActive?.(false);
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
  },section(value){pendingScroll=value==='stamina'?'coins':value;if(state&&(!staged||state.shopSection!==pendingScroll)){state.shopSection=pendingScroll;refresh();}request();},
    get safeBottom(){return state?.safeBottom||0;},owns:portrait.owns,setPose:portrait.setPose,forget:portrait.forget,portraitChanged:portrait.changed,
    canGuidePanel(id){return Boolean(device.panel?.state().controls.some(c=>c.id===id&&!c.disabled));},
    setGuide(g){
      device.panel?.setGuideTarget(g?.modal&&g.strong?g.id:null);
      if(guide?.id===g?.id&&guide?.strong===g?.strong&&guide?.text===g?.text&&guide?.modal===g?.modal)return;
      guide=g;if(g)ensureGuide();request();
    },
    tick(){if(entering===null&&preview&&visible())tickPreview();schedulePortrait();
      if(visible()&&(!host.reducedMotion()&&(interactive()&&scene.animated||guide)||!host.ownsOutput()))request();},
    close(){
      if(closed)return;closed=true;metrics.release();host.cancelFrame(frame);host.cancelFrame(portraitFrame);unwatch();preview?.close();portrait.close();scene.close();guideHud?.dispose();
      if(device.menuView===view)device.menuView=null;if(device.repaintHome===request)device.repaintHome=null;
      if(host.ownsOutput()){
        host.release();
        renderer.setClearColor(saved.color,saved.alpha);renderer.autoClear=saved.autoClear;}
    }};
  device.menuView=view;device.repaintHome=request;return view;
}
