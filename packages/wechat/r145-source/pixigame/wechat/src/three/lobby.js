import { createThreeLobbyController } from '../../../../../../../pixigame/src/ui/three-lobby-controller.js';
import { lobbyMenuArtwork, supportsMenu } from '../../../../../../../pixigame/src/three/game-screen/menu-screen-core.js';
import { lobbyPanels } from '../../../../../../../pixigame/src/three/game-screen/lobby-panels.js';
import { createLobbyFeedback } from '../../../../../../../pixigame/src/three/game-screen/lobby-feedback.js';
import { createLobbyToast } from '../../../../../../../pixigame/src/three/game-screen/lobby-toast.js';
import { createLobbyPanel } from '../../../../../../../pixigame/src/three/game-screen/lobby-panel.js';
import { paintItemDetail } from '../../../../../../../pixigame/src/three/game-screen/item-details.js';
import { compactPilotAvatar } from '../../../../../../../pixigame/src/pilot-avatar-icons.js';
import { battleChapterIndex } from '../../../../../../../pixigame/src/ui/battle-chapter-index.js';
import { nextLobbyGuide } from '../../../../../../../pixigame/src/peripheral/onboarding.js';
import { mountWechatHome } from './home-surface.js';
import { homeEntryFiles } from '../../../../../../../pixigame/src/three/game-screen/home-view.js';
import { createLobbyNavigationMotion } from '../../../../../../../pixigame/src/three/game-screen/lobby-navigation-motion.js';
import { mountWechatMenu } from './menu-surface.js';
import { createWechatTextField } from './text-field.js';
import { createMenuArtworkWarmup, frameWork } from './frame-artwork.js';

const activityKinds=['tasks','carnival'];
const mainTabOrder=['assembly','shop','supply','research'];
const sortieMenuPixelLimit=2400000;

export function mountWechatLobby(api, platform, device, { bridge, system, deferPortraits, deferFirstSortieLobby, portraits, openAircraft, openVideo, settingsStorage, releaseBattleCache }) {
  const navigation=device.lobbyNavigation=createLobbyNavigationMotion(platform.debugLog?
    sample=>platform.debugLog.info('底栏切换耗时',sample):undefined);
  let startupWarmup=null,queueMainMenus=null,queueCatalogs=null,queueWorkshops=null;
  let battleCachePending=false;
  let mountSettledEquipment=null,cancelReturnPreparation=null;
  let warmLobbyArtworkFiles=null,fileWarmup=null,homeFiles=null;
  let firstSortieMenus=false,warmupQueued=false,visible=true,memoryPressure=false,location={tab:'battle',subpage:''};
  let switchStarted=null,parkedAircraft=null,portraitWanted=false;
  const full=()=>platform.viewport.screen;
  function bounds(){
    const {screen,safeTop}=platform.viewport;
    return {...screen,y:safeTop,top:safeTop,height:screen.height-safeTop};
  }
  const isVisible=()=>visible&&!device.battle&&!device.cover;
  const warmup=frameWork(platform,()=>platform.visible&&visible&&!firstSortieMenus&&!device.battle&&!device.preview&&
    platform.inputIdle&&switchStarted===null&&!device.menuView?.preparing&&!device.panel?.preparing&&!device.panel?.fullscreen,40,()=>Boolean(device.cover));
  function region(priority=0,overlay=false){
    return {bounds,frameBounds:full,visible:isVisible,accepts:isVisible,overlay,priority};
  }
  const modalRoot=region(10),receiptRegion=region(20,true),inspection=region(30,true);
  const activityPreviews=new Map(),preparePanelArtwork=createMenuArtworkWarmup(platform);
  let activityWarmup=null,gearDetailPreview=null;
  let homePainted=false,returnStarted=null,loadingTimer=null,loadingShown=false;
  function endReturn(){
    clearTimeout(loadingTimer);loadingTimer=null;returnStarted=null;
    if(loadingShown){loadingShown=false;api.hideLoading?.();}
  }
  const home={...region(),stageEntry:true,getBounds:full,openPortrait:id=>portraits.openHome(id,device),onReady(ready){
    homePainted=ready;
    if(ready&&returnStarted!==null){
      platform.debugLog?.info('首战返回大厅首帧',{ms:Math.round(platform.now()-returnStarted)});
      endReturn();
    }
  }};
  const menu={...region(),allowAircraftModel:()=>!memoryPressure,openPortrait:(refresh,paint)=>portraits.openCatalog(device,bounds,refresh,paint),
    openAircraft:(...args)=>openAircraft(device,bounds,...args)};
  const mainPages=new Map(mainTabOrder.map(tab=>[tab,{...menu,main:true}]));
  mainPages.get('assembly').allowAircraftStill=()=>true;
  mainPages.get('assembly').canTickAircraft=()=>switchStarted===null&&!device.panel;
  const catalogPages=new Map(['weapon','aircraft','pilot'].map(key=>[key,{...menu,catalog:true}]));
  const workshopPages=new Map(['gear','weapon'].map(kind=>[kind,{...menu,workshop:kind}]));
  const retainedViews=new Map();
  const pendingWarmup=new Map(),warmedTabs=[];
  function releaseParkedAircraft(){
    if(!parkedAircraft)return;
    parkedAircraft.trimAircraft();parkedAircraft=null;
  }
  function showPortrait(value,options){
    const homePage=location.tab==='battle'&&!location.subpage;
    const pilotPage=location.subpage==='pilot';
    const switching=switchStarted!==null;
    const deferHomePortrait=deferFirstSortieLobby&&firstSortieMenus;
    portraits.setVisible(value&&(pilotPage||homePage&&!switching&&!deferHomePortrait),{...options,
      leavePage:!homePage&&!pilotPage&&!(switching&&location.tab==='assembly')});
  }
  function endSwitch(){
    switchStarted=null;releaseParkedAircraft();
  }
  const watchSwitch=platform.onViewport((_viewport,foreground)=>{
    if(foreground===false){
      endReturn();
      const pending=switchStarted!==null;
      endSwitch();navigation.resetTiming();
      if(pending)showPortrait(portraitWanted);
    }
  });
  function drop(page,slot){
    if(parkedAircraft===slot.view)parkedAircraft=null;
    pendingWarmup.delete(page);retainedViews.delete(page);slot.view.close();
  }
  function retain(page,mount,active=true){
    let slot=retainedViews.get(page);
    if(slot?.view.entryFailed){drop(page,slot);slot=null;}
    if(!slot){
      slot={active,visited:active};
      const shown=()=>slot.active&&page.visible();
      slot.view=mount({...page,visible:shown,accepts:shown});
      slot.controller=Object.assign(Object.create(slot.view),{
        page,
        close({returningHome=false}={}){
          slot.active=false;
          if((!visible||memoryPressure)&&page!==home)drop(page,slot);
          else{
            const holdAircraft=returningHome&&page===mainPages.get('assembly')&&platform.visible&&isVisible();
            if(slot.view.park({holdAircraft}))parkedAircraft=slot.view;
          }
        },
      });
      retainedViews.set(page,slot);
    }else if(active){
      if(parkedAircraft===slot.view)parkedAircraft=null;
      retainedViews.delete(page);retainedViews.set(page,slot);
      slot.active=true;slot.visited=true;slot.view.activate();
    }
    return slot.controller;
  }
  function retainMenu(host,send,interactive,setSection,active=true){
    return retain(host,page=>mountWechatMenu(device,platform,page,send,interactive,setSection,
      {atomicEntry:true,parked:!active,sortieWarmup:!active&&firstSortieMenus}),active);
  }
  function finishStartupWarmup(){
    if(!startupWarmup)return;
    const {resolve,timer}=startupWarmup;
    startupWarmup=null;
    clearTimeout(timer);resolve([...warmedTabs]);
  }
  function resumeWarmup(){
    if(warmupQueued||!pendingWarmup.size)return;
    warmupQueued=true;
    warmup.push(()=>{
      warmupQueued=false;
      warmNextMenu();
    });
  }
  function queueMenuWarmup(pages,read,send,interactive,setSection){
    if(memoryPressure)return;
    for(const [tab,host] of pages){
      if(firstSortieMenus&&!host.main||retainedViews.has(host)||pendingWarmup.has(host))continue;
      pendingWarmup.set(host,{tab,mount(){
        const {data,key}=read(tab);
        const view=retainMenu(host,send,interactive,setSection,false);
        view.update(data,key);
        return view;
      }});
    }
    resumeWarmup();
  }
  function warmNextMenu(maxUploads){
    const next=pendingWarmup.entries().next().value;
    if(!next)return;
    const [host,job]=next;
    pendingWarmup.delete(host);
    try{
      const view=job.view??=job.mount();
      if(!view.prepareOffscreen(maxUploads))pendingWarmup.set(host,job);
      else if(host.workshop)platform.debugLog?.info('改装间首屏预热',{kind:host.workshop});
      else if(host.catalog)platform.debugLog?.info('目录首屏预热',{page:job.tab});
      else warmedTabs.push(job.tab);
    }catch(error){
      const slot=retainedViews.get(host);
      if(slot)drop(host,slot);
      console.warn('[Three 首屏预热]',job.tab,error?.message||error);
    }
    if(pendingWarmup.size)resumeWarmup();
    else finishStartupWarmup();
  }
  function queueLobbyArtworkFiles(){
    if(firstSortieMenus||memoryPressure||!warmLobbyArtworkFiles)return;
    warmup.push(()=>warmLobbyArtworkFiles?.({
      get aborted(){return memoryPressure||!platform.visible||!isVisible();}
    }));
  }
  const copyText=text=>new Promise(resolve=>{
    api.setClipboardData({data:String(text),success:()=>resolve(true),fail:()=>resolve(false)});
  });
  function inspectItems(_container,read){
    let panel=null;
    function close(){panel?.close();panel=null;device.repaintHome?.();}
    function open(item){
      close();
      panel=createLobbyPanel(device,inspection,'道具详情',(data,w,h,t)=>{paintItemDetail(data,w,h,t);return 'inspect';},
        command=>{if(command.type==='close')close();},{overlay:true});
      panel.update({inspect:item,snapshot:read()},'item','item');
    }
    return {open,close,destroy:close};
  }
  const panels=lobbyPanels(device,{inspectItems,openVideo:(host,send)=>openVideo(device,host,send)});
  function stagedPanel(kind,host,send,scroll,sound){
    const debug=platform.debugLog;
    return panels.openLobbyPanel(kind,host,send,scroll,sound,{prepareArtwork:preparePanelArtwork,completeEntry:true,backgroundPriority:-2,
      beginEntryTrace:debug?(section,prepared,retained)=>debug.beginMenu(platform.now,kind,retained,undefined,{section,prepared}):undefined});
  }
  function clearActivityPreviews(){
    for(const slot of activityPreviews.values())slot.view?.close();
    activityPreviews.clear();
  }
  function clearGearDetailPreview(){
    gearDetailPreview?.view.close();gearDetailPreview=null;
  }
  function releaseIdleViews(keepRecentMain=false){
    pendingWarmup.clear();finishStartupWarmup();
    clearActivityPreviews();clearGearDetailPreview();
    // Keep one recently used 2D screen if its artwork fits the sortie budget.
    const keep=keepRecentMain&&!memoryPressure&&Array.from(retainedViews).reverse().find(([page,slot])=>
      page.main&&!slot.active&&slot.visited&&slot.view.canRetainForSortie(sortieMenuPixelLimit))?.[0];
    for(const [page,slot] of retainedViews)if(!slot.active&&page!==home&&page!==keep)drop(page,slot);
  }
  function queueActivityPanels(){
    if(!visible||memoryPressure||firstSortieMenus||!activityWarmup)return;
    const {read,send,scroll}=activityWarmup;
    for(const kind of activityKinds){
      if(activityPreviews.has(kind)||!read(kind))continue;
      const slot={view:null};
      activityPreviews.set(kind,slot);
      function prepare(){
        if(activityPreviews.get(kind)!==slot)return;
        try{
          const entry=read(kind);
          if(!entry){slot.view?.close();activityPreviews.delete(kind);return;}
          const view=slot.view??=stagedPanel(kind,modalRoot,send,scroll);
          view.update(entry.snapshot,entry.modal,entry.signature);
          if(!view.prepareOffscreen())warmup.push(prepare);
          else platform.debugLog?.info('大厅活动首屏预热',{panel:kind});
        }catch(error){
          slot.view?.close();activityPreviews.delete(kind);
          console.warn('[Three 活动界面预热]',kind,error?.message||error);
        }
      }
      warmup.push(prepare);
    }
  }
  Object.assign(device,panels,{
    prepareActivityPanels(read,send,scroll){
      activityWarmup={read,send,scroll};
      queueActivityPanels();
    },
    openLobbyPanel(kind,host,send,scroll,sound,entry){
      if(kind==='gearDetail'){
        const slot=host===modalRoot?gearDetailPreview:null;
        if(slot)gearDetailPreview=null;
        const view=slot?.view??stagedPanel(kind,host,send,scroll,sound);
        if(entry)view.update(entry.snapshot,entry.modal,entry.signature);
        view.activate(slot?.retained);
        if(host!==modalRoot)return view;
        let released=false;
        return {...view,close(){
          if(released)return;
          released=true;
          if(!visible||memoryPressure||location.tab!=='assembly'||location.subpage||!view.park()){
            view.close();return;
          }
          clearGearDetailPreview();
          gearDetailPreview={view,retained:true};
        }};
      }
      if(host!==modalRoot||!activityKinds.includes(kind))return panels.openLobbyPanel(kind,host,send,scroll,sound);
      const slot=activityPreviews.get(kind);
      activityPreviews.delete(kind);
      const view=slot?.view??stagedPanel(kind,host,send,scroll,sound);
      if(slot?.view&&entry)view.update(entry.snapshot,entry.modal,entry.signature);
      view.activate();
      return {...view,close(){view.close();queueActivityPanels();}};
    },
    supportsMenu,
    mountHome(host,send,interactive,active=true){
      const view=retain(host,page=>mountWechatHome(device,platform,page,send,interactive),active);
      view.selectPilot(device.homeState.pilotId);
      return view;
    },
    prepareMenus(read,send,interactive,setSection,{firstSortieRequired=false,sendPanel}={}){
      warmLobbyArtworkFiles=signal=>{
        if(!platform.warmArtworkFiles||fileWarmup||signal.aborted)return;
        const {snapshot}=read('assembly').data;
        const rows=snapshot.pilots??[],selected=rows.find(pilot=>pilot.id===snapshot.pilotId);
        const pilots=[selected,...rows.filter(pilot=>pilot.owned&&pilot!==selected)].filter(Boolean);
        const urls=pilots.map(pilot=>compactPilotAvatar(pilot.avatar||pilot.image).src).filter(Boolean);
        const supply=read('supply').data;
        urls.push(...lobbyMenuArtwork(supply.snapshot,supply.selected));
        fileWarmup=platform.warmArtworkFiles(urls,signal).finally(()=>{fileWarmup=null;});
      };
      queueMainMenus=()=>queueMenuWarmup(firstSortieMenus?[['assembly',mainPages.get('assembly')]]:mainPages,read,send,interactive,setSection);
      if(firstSortieRequired){
        firstSortieMenus=true;
        homeFiles=homeEntryFiles(read('assembly').data.snapshot.pilotId);
        mountSettledEquipment=()=>{
          const {data,key}=read('assembly',true);
          if(data.snapshot.firstSortieRequired)return null;
          const {snapshot}=data;
          if(deferFirstSortieLobby&&!retainedViews.has(home)){
            device.publishHome(snapshot,battleChapterIndex(snapshot),bridge.debugToolsEnabled);
            device.mountHome(home,send,interactive,false);
          }
          const page=mainPages.get('assembly');
          pendingWarmup.delete(page);
          const view=retainMenu(page,send,interactive,setSection,false);
          view.update(data,key);
          const guide=nextLobbyGuide(snapshot);
          clearGearDetailPreview();
          if(guide?.group===9&&sendPanel){
            const detail=stagedPanel('gearDetail',modalRoot,sendPanel);
            detail.update(snapshot,{type:'gearDetail',id:guide.uid,detailOrigin:'warehouse',revision:snapshot.equipment.revision},key);
            gearDetailPreview={uid:guide.uid,view:detail};
          }
          return view;
        };
        return [];
      }
      return new Promise(resolve=>{
        const timer=setTimeout(finishStartupWarmup,1600);
        startupWarmup={resolve,timer};
        queueMainMenus();
        if(!pendingWarmup.size)finishStartupWarmup();
      });
    },
    prepareFirstSortieEquipment(isCurrent){
      if(!firstSortieMenus||memoryPressure||visible||!isCurrent())return;
      cancelReturnPreparation?.();
      const view=mountSettledEquipment?.();
      if(!view)return;
      let equipmentReady=false,detailReady=!gearDetailPreview;
      let frame=null;
      const timer=setTimeout(finish,8000);
      function finish(){
        clearTimeout(timer);
        if(frame!==null)platform.cancelFrame(frame);
        if(cancelReturnPreparation===finish)cancelReturnPreparation=null;
      }
      function step(){
        frame=null;
        if(visible||memoryPressure||!isCurrent()){finish();return;}
        if(platform.visible&&!device.cover){
          const guideReady=!gearDetailPreview||view.prepareGuideArtwork();
          // Give the first gear screen the upload budget before the detail dialog.
          if(equipmentReady&&!detailReady){
            try{
              detailReady=gearDetailPreview.view.prepareOffscreen(1);
              if(detailReady)platform.debugLog?.info('结算时装备详情已准备',{id:gearDetailPreview.uid});
            }catch(error){
              clearGearDetailPreview();detailReady=true;
              console.warn('[Three 装备详情预热]',error?.message||error);
            }
          }
          try{equipmentReady||=view.prepareOffscreen(1);}catch(error){
            const page=mainPages.get('assembly'),slot=retainedViews.get(page);
            if(slot?.controller===view)drop(page,slot);
            console.warn('[Three 装备首屏预热]',error?.message||error);
            finish();return;
          }
          if(equipmentReady&&detailReady&&guideReady){
            platform.debugLog?.info('结算时装备首屏已准备');
            finish();return;
          }
        }
        frame=platform.requestFrame(step);
      }
      cancelReturnPreparation=finish;
      frame=platform.requestFrame(step);
    },
    warmFirstSortieHomeFiles(signal){
      if(!homeFiles||memoryPressure||visible||signal.aborted||!platform.visible||device.cover)return;
      void platform.warmArtworkFiles?.(homeFiles,{
        get aborted(){return signal.aborted||memoryPressure||visible||!platform.visible;}
      });
    },
    prepareCatalogs(read,send,interactive,setSection){
      queueCatalogs=()=>queueMenuWarmup(catalogPages,read,send,interactive,setSection);
      queueCatalogs();queueLobbyArtworkFiles();
    },
    prepareWorkshops(read,send,interactive,setSection){
      queueWorkshops=()=>queueMenuWarmup(workshopPages,read,send,interactive,setSection);
      queueWorkshops();
    },
    mountMenu(host,send,interactive,setSection){
      if(host.main||host.catalog||host.workshop){
        pendingWarmup.delete(host);
        if(host.catalog||host.workshop){
          // Unvisited pages keep their prepared first screen. Only the last visited
          // equipment subpage keeps its scene after browsing or changing selections.
          for(const [page,slot] of retainedViews){
            if(page!==host&&(page.catalog||page.workshop)&&slot.visited&&!slot.active)drop(page,slot);
          }
        }
        return retainMenu(host,send,interactive,setSection);
      }
      return mountWechatMenu(device,platform,host,send,interactive,setSection,{atomicEntry:true});
    },
    safeBottom:()=>platform.viewport.safeBottom,
    viewportHeight:()=>platform.viewport.screen.height,
    reducedMotion:()=>false,
    openPatrolAircraft:(host,...args)=>openAircraft(device,host.bounds,...args),
    createTextField:(_surface,...args)=>createWechatTextField(api,...args),
    copyText,
  });
  device.toast=createLobbyToast(()=>device.repaintHome?.(),{now:platform.now,reducedMotion:device.reducedMotion});
  device.feedback=createLobbyFeedback(device,{now:platform.now,requestFrame:platform.requestFrame,cancelFrame:platform.cancelFrame,
    reducedMotion:device.reducedMotion,layout:()=>({...location,bounds:full(),hidden:!isVisible()})});
  const presentation={
    modalRoot,inspection,portraitPlayer:{...portraits,setVisible(value,options){
      portraitWanted=value;showPortrait(value,options);
    }},settingsStorage,
    hidden:()=>!visible||!platform.visible,
    busy(){},
    setVisible(value){
      const returning=value&&!visible;
      visible=value;
      if(!value){endReturn();endSwitch();navigation.select(location.tab,false,false);}
      else if(returning)navigation.select(location.tab,location.tab==='battle'&&!location.subpage,!device.reducedMotion());
      if(!value&&!firstSortieMenus){
        releaseIdleViews(true);
        for(const slot of retainedViews.values())if(slot.active)slot.view.trimAircraft?.();
      }
      else if(returning){
        cancelReturnPreparation?.();
        if(firstSortieMenus&&!homePainted&&deferFirstSortieLobby){
          returnStarted=platform.now();
          loadingTimer=setTimeout(()=>{
            if(isVisible()&&platform.visible&&api.showLoading){
              loadingShown=true;api.showLoading({title:'正在进入大厅',mask:false});
            }
          },150);
        }
        battleCachePending=true;
        if(!firstSortieMenus){queueMainMenus?.();queueActivityPanels();queueWorkshops?.();queueCatalogs?.();}
      }
      device.repaintHome?.();
    },
    blockPage(){},
    clearModal(){},
    retainModal:()=>({overlay:receiptRegion,restore(){}}),
    async copyReport(_host,report){device.toast.show(await copyText(report)?'已复制':'复制失败');},
    showPage({tab,subpage,nativeHome,workshopKind}){
      if(returnStarted!==null&&!nativeHome)endReturn();
      if(tab!==location.tab||subpage!==location.subpage){
        if(!subpage&&!location.subpage&&visible&&platform.visible&&!memoryPressure&&!device.battle&&!device.cover&&
          (tab==='assembly'&&location.tab==='battle'&&retainedViews.get(mainPages.get('assembly'))?.visited||
            tab==='battle'&&location.tab==='assembly')){
          // Hold only the ready outgoing model while the footer moves. The stills
          // remain interactive, and a quick reversal reuses the same GPU objects.
          switchStarted=platform.now();portraits.setVisible(false);
        }else endSwitch();
      }
      navigation.select(tab,Boolean(nativeHome&&visible),visible&&!device.reducedMotion(),platform.now());
      if(visible&&battleCachePending&&(mainPages.has(tab)||catalogPages.has(subpage)||subpage==='workshop')){
        battleCachePending=false;releaseBattleCache?.();
      }
      if(subpage==='pilot'&&location.subpage!=='pilot')queueLobbyArtworkFiles();
      if(location.tab==='assembly'&&(tab!=='assembly'||subpage))clearGearDetailPreview();
      location={tab,subpage};device.lobbyLocation=location;
      if(subpage==='workshop')return workshopPages.get(workshopKind)??menu;
      return nativeHome?home:subpage?(catalogPages.get(subpage)??menu):mainPages.get(tab)??menu;
    },
    requestFrame:platform.requestFrame,cancelFrame:platform.cancelFrame,
    close(){
      endReturn();watchSwitch();switchStarted=null;parkedAircraft=null;
      cancelReturnPreparation?.();mountSettledEquipment=warmLobbyArtworkFiles=null;
      pendingWarmup.clear();finishStartupWarmup();warmup.close();
      clearActivityPreviews();clearGearDetailPreview();activityWarmup=null;
      queueMainMenus=queueWorkshops=queueCatalogs=null;
      firstSortieMenus=false;
      visible=false;for(const [page,slot] of retainedViews)drop(page,slot);
      if(device.lobbyNavigation===navigation)delete device.lobbyNavigation;
      device.feedback.close();device.toast.close();
    },
  };
  try{
    const controller=createThreeLobbyController({bridge,system,presentation,deferPortraits,deferFirstSortieLobby});
    controller.trimMemory=()=>{
      memoryPressure=true;endSwitch();cancelReturnPreparation?.();releaseIdleViews();
      for(const slot of retainedViews.values())if(slot.active)slot.view.trimAircraft?.();
    };
    const update=controller.update.bind(controller);
    controller.update=step=>{
      if(switchStarted!==null){
        const elapsed=platform.now()-switchStarted;
        if(elapsed>=500&&(!navigation.pose.navMoving&&!navigation.pose.dockMoving||elapsed>=1000)){
          endSwitch();showPortrait(portraitWanted);
        }
      }
      const result=update(step);
      if(firstSortieMenus&&visible&&!controller.snapshot?.firstSortieRequired&&(homePainted||location.tab!=='battle'||location.subpage)){
        firstSortieMenus=false;mountSettledEquipment=homeFiles=null;
        if(location.tab==='battle'&&!location.subpage)showPortrait(portraitWanted);
        queueLobbyArtworkFiles();queueMainMenus?.();queueActivityPanels();queueWorkshops?.();queueCatalogs?.();
      }
      warmup.resume();return result;
    };
    return controller;
  }
  catch(error){presentation.close();throw error;}
}
