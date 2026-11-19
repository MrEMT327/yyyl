import {Color} from 'three';
import {createLobbyPanel} from './lobby-panel.js';
import {chrome} from './menu-art.js';
import {shopMenu,shopData} from './menu-shop.js';
import {researchMenu} from './menu-research.js';
import {equipmentMenu} from './menu-equipment.js';
import {menuAircraft} from './menu-aircraft.js';
import {recruitMenu} from './menu-recruit.js';
import {createHomeHud} from './three-home-hud.js';
import {optimizeUiAssetUrls} from '../../ui/ui-image-source.js';
import {loadArtwork} from './image-loading.js';
import {measureScreen} from './screen-metrics.js';
import {paintItemDetail} from './item-details.js';
import {catalogModel,catalogAircraftRect,isCatalog} from './catalog-model.js';
import {catalogMenu} from './menu-catalog.js';
import {workshopMenu} from './menu-workshop.js';
import {catalogPortrait} from './catalog-portrait.js';

const menus={shop:shopMenu,research:researchMenu,assembly:equipmentMenu,supply:recruitMenu};
export function supportsMenu(tab,subpage){return subpage?isCatalog(subpage)||subpage==='workshop':Object.hasOwn(menus,tab);}
export function mountMenuScreen(device,page,send,interactive,setSection){
  const renderer=device.three,canvas=device.display.input;
  const saved={className:canvas.className,attrs:Object.fromEntries(['style','role','aria-label','aria-modal','tabindex'].map(k=>[k,canvas.getAttribute(k)])),
    color:renderer.getClearColor(new Color()),alpha:renderer.getClearAlpha(),autoClear:renderer.autoClear};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let state=null,identity='',tab='',revision=0,frame=0,closed=false,pendingScroll=null,guide=null,guideHud=null,guideLoading=false;
  let preview=null,sortOpen=false,lastTick=0,inspect=null;
  function visible(){return !closed&&page.isConnected&&!page.closest('[hidden]')&&!document.hidden&&!device.battle&&!device.preview&&!device.cover;}
  const metrics=measureScreen(renderer,'Three 功能页',visible);
  function request(){if(!frame&&visible())frame=requestAnimationFrame(draw);}
  const portrait=catalogPortrait(device,page,refresh,request);
  const scene=createLobbyPanel(device,page,'少女航线', (model,w,h,tools)=>{
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
      if(command.data?.value)send('gearSort',{value:command.data.value},canvas);
    }else if(command.type==='close'&&sortOpen){sortOpen=false;state.sortOpen=false;refresh();}
    else if(command.type==='workshopChoose'){scene.scroll(workshopZone(),0);canvas.focus({preventScroll:true});}
    else if(command.type==='close'&&tab==='workshop')send('catalogBack',{},canvas);
    else if(command.type==='close'&&isCatalog(tab)){
      if(tab==='weapon'&&state.catalogView?.slot!=null)send('nativeWeaponSkillBrowse',{id:state.catalogView.skillWeapon.id},canvas);
      else send('catalogBack',{},canvas);
    }else if(!['close','orbit'].includes(command.type))send(command.type,command.data||{},canvas);
  },{
    main:true,interactive,allows:id=>Boolean(inspect)||!guide?.strong||guide.id===id,
    onScroll(zone,y,anchors,max){
      if(tab!=='shop'||zone!=='base')return;
      const last=anchors.get('coins'),atEnd=max>2&&y>=max-2;
      const id=atEnd?'coins':y>=(last??Infinity)-2?'coins':y>=(anchors.get('daily')??Infinity)-2?'daily':'boxes';
      if(state.shopSection!==id){state.shopSection=id;setSection(id);refresh();}
    }});
  function workshopZone(){const ws=state.workshop;return 'workshop-'+(ws.kind==='gear'?'':ws.mode+'-')+ws.filter;}
  function refresh(){if(state)scene.update(state,++revision,tab);}
  function draw(){
    frame=0;if(!state||!visible())return;
    metrics.draw(drawFrame);device.display.present();
  }
  function drawFrame(){
    if(canvas.parentElement!==page){page.append(canvas);canvas.className='three-menu-screen';canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;pointer-events:auto;outline:0';}
    const b=page.getBoundingClientRect();if(!b.width||!b.height)return;
    const ratio=devicePixelRatio||1,w=Math.max(1,Math.round(b.width*ratio)),h=Math.max(1,Math.round(b.height*ratio));
    if(tab==='pilot')portrait.paintPose(renderer);
    device.display.begin(page,w,h,request);renderer.setClearColor(0,0);renderer.autoClear=false;renderer.clear();
    scene.draw(renderer);
    if(pendingScroll!==null){const value=pendingScroll;pendingScroll=null;scene.scroll(tab==='workshop'?workshopZone():'base',value);}
    device.panel?.draw(renderer);
    if(guide&&guideHud&&(guide.modal?device.panel:interactive())&&!inspect){
      const target=(guide.modal?device.panel:scene).state().controls.find(c=>c.id===guide.id);
      if(target)guideHud.paintGuide(renderer,performance.now()/1000,{...guide,reduced:reduced.matches,target:[(target.x-b.x)*750/b.width,(target.y-b.y)*1624/b.height,target.w*750/b.width,target.h*1624/b.height]},b.width);
    }
    device.feedback?.draw(renderer,b.width,b.height);
    device.toast?.draw(renderer,b.width,b.height);
  }
  const resize=new ResizeObserver(()=>{portrait.resize();if(preview&&state)preview.update(state.snapshot,state.catalogView?.plane||state.snapshot.aircraftId);scene.invalidate();request();});resize.observe(page);
  function ensureGuide(){
    if(guideHud||guideLoading)return;guideLoading=true;
    const load=url=>loadArtwork(optimizeUiAssetUrls(url));
    createHomeHud(load,{},request).then(hud=>{if(closed)hud.dispose();else{guideHud=hud;request();}}).catch(()=>{guideLoading=false;});
  }
  const view={page,state:scene.state,update(next,key){
    const changed=next.tab!==tab;
    const nextKey=[key,next.tab,next.section,next.shopSection,next.gearSort,next.gearFilter,next.selected,next.fleetReturnKind,JSON.stringify(next.catalog),JSON.stringify(next.workshop)].join('|');
    if(!changed&&identity===nextKey)return;
    identity=nextKey;tab=next.tab;
    if(changed){preview?.close();preview=null;sortOpen=false;inspect=null;}
    state={...next,sortOpen,reduced:reduced.matches,safeBottom:parseFloat(getComputedStyle(page).paddingBottom)||0};
    if(isCatalog(tab))state.catalogView=catalogModel(state);
    portrait.select(state.catalogView?.appearance?.id||'');state.portrait=portrait;
    if(tab==='aircraft'&&state.catalogView?.plane){
      preview??=menuAircraft(device,page,scene,refresh,request,()=>visible()&&interactive(),{profile:'catalog',rect:catalogAircraftRect});
      state.preview=preview;preview.update(next.snapshot,state.catalogView.plane);
    }
    if(tab==='assembly'){
      preview??=menuAircraft(device,page,scene,refresh,request,()=>visible()&&interactive());
      state.preview=preview;preview.update(next.snapshot);
    }
    if(tab==='shop')state.showcases=shopData(next.snapshot);
    if(changed)pendingScroll=tab==='shop'?next.shopSection:tab==='workshop'&&next.workshop.kind==='weapon'&&next.workshop.id?'selected-weapon':null;
    refresh();request();
  },clock(time){
    if(tab!=='shop'||!state||!Number.isFinite(time)||Math.floor((state.time||0)/1000)===Math.floor(time/1000))return;
    state.time=time;
    const hasTimer=state.snapshot.nativeAcquisition?.equipmentBoxes?.some(row=>row.compatibility?.nextFreeAt>time);
    if(hasTimer||Math.floor(time/60000)!==state.shownMinute){state.shownMinute=Math.floor(time/60000);refresh();}
  },section(value){pendingScroll=value==='stamina'?'coins':value;if(state){state.shopSection=pendingScroll;refresh();}request();},
    get safeBottom(){return state?.safeBottom||0;},owns:portrait.owns,setPose:portrait.setPose,forget:portrait.forget,portraitChanged:portrait.changed,
    canGuidePanel(id){return Boolean(device.panel?.state().controls.some(c=>c.id===id&&!c.disabled));},
    setGuide(g){
      device.panel?.setGuideTarget(g?.modal&&g.strong?g.id:null);
      if(guide?.id===g?.id&&guide?.strong===g?.strong&&guide?.text===g?.text&&guide?.modal===g?.modal)return;
      guide=g;if(g)ensureGuide();request();
    },
    tick(){const now=performance.now();if(preview&&visible())preview.tick(lastTick?(now-lastTick)/1000:0);lastTick=now;
      if(visible()&&(!reduced.matches&&(interactive()&&scene.animated||guide)||canvas.parentElement!==page))request();},
    close(){
      if(closed)return;closed=true;metrics.release();cancelAnimationFrame(frame);resize.disconnect();preview?.close();portrait.close();scene.close();guideHud?.dispose();
      if(device.menuView===view)device.menuView=null;if(device.repaintHome===request)device.repaintHome=null;
      if(canvas.parentElement===page){device.home.append(canvas);canvas.className=saved.className;
        for(const [k,v] of Object.entries(saved.attrs)){if(v===null)canvas.removeAttribute(k);else canvas.setAttribute(k,v);}
        renderer.setClearColor(saved.color,saved.alpha);renderer.autoClear=saved.autoClear;}
    }};
  device.menuView=view;device.repaintHome=request;return view;
}

