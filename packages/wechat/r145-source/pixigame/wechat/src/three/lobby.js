import { createThreeLobbyController } from '../../../../../../../pixigame/src/ui/three-lobby-controller.js';
import { supportsMenu } from '../../../../../../../pixigame/src/three/game-screen/menu-screen-core.js';
import { lobbyPanels } from '../../../../../../../pixigame/src/three/game-screen/lobby-panels.js';
import { createLobbyFeedback } from '../../../../../../../pixigame/src/three/game-screen/lobby-feedback.js';
import { createLobbyToast } from '../../../../../../../pixigame/src/three/game-screen/lobby-toast.js';
import { createLobbyPanel } from '../../../../../../../pixigame/src/three/game-screen/lobby-panel.js';
import { paintItemDetail } from '../../../../../../../pixigame/src/three/game-screen/item-details.js';
import { compactPilotAvatar } from '../../../../../../../pixigame/src/pilot-avatar-icons.js';
import { battleChapterIndex } from '../../../../../../../pixigame/src/ui/battle-chapter-index.js';
import { mountWechatHome } from './home-surface.js';
import { mountWechatMenu } from './menu-surface.js';
import { createWechatTextField } from './text-field.js';
import { createMenuArtworkWarmup, frameWork } from './frame-artwork.js';

const activityKinds=['tasks','carnival'];
const mainTabOrder=['assembly','supply','shop','research'];

export function mountWechatLobby(api, platform, device, { bridge, system, deferPortraits, deferFirstSortieLobby, portraits, openAircraft, openVideo, settingsStorage, releaseBattleCache }) {
  let startupWarmup=null,queueMainMenus=null,queueCatalogs=null,queueWorkshops=null,queueReturnMenus=null;
  let allowEquipmentStill=false,battleCachePending=false;
  let mountSettledEquipment=null,cancelReturnPreparation=null;
  let warmPilotAvatars=null,avatarWarmup=null;
  let firstSortieMenus=false,firstSortieQueued=false,warmupQueued=false,visible=true,memoryPressure=false,location={tab:'battle',subpage:''};
  const full=()=>platform.viewport.screen;
  function bounds(){
    const {screen,safeTop}=platform.viewport;
    return {...screen,y:safeTop,top:safeTop,height:screen.height-safeTop};
  }
  const isVisible=()=>visible&&!device.battle&&!device.cover;
  const warmup=frameWork(platform,()=>platform.visible&&visible&&!firstSortieMenus&&!device.battle&&!device.preview&&
    platform.inputIdle&&!device.menuView?.preparing&&!device.panel?.fullscreen,40);
  function region(priority=0,overlay=false){
    return {bounds,frameBounds:full,visible:isVisible,accepts:isVisible,overlay,priority};
  }
  const modalRoot=region(10),receiptRegion=region(20,true),inspection=region(30,true);
  const activityPreviews=new Map(),prepareActivityArtwork=createMenuArtworkWarmup(platform);
  let activityWarmup=null;
  const home={...region(),stageEntry:true,getBounds:full,openPortrait:id=>portraits.openHome(id,device)};
  const menu={...region(),allowAircraftModel:()=>!memoryPressure,openPortrait:(refresh,paint)=>portraits.openCatalog(device,bounds,refresh,paint),
    openAircraft:(...args)=>openAircraft(device,bounds,...args)};
  const mainPages=new Map(mainTabOrder.map(tab=>[tab,{...menu,main:true,completeEntry:tab==='assembly'||tab==='supply'}]));
  mainPages.get('assembly').allowAircraftStill=()=>allowEquipmentStill;
  const catalogPages=new Map(['weapon','aircraft','pilot'].map(key=>[key,{...menu,catalog:true}]));
  const workshopPages=new Map(['gear','weapon'].map(kind=>[kind,{...menu,workshop:kind}]));
  const retainedViews=new Map();
  const pendingWarmup=new Map(),warmedTabs=[];
  function drop(page,slot){pendingWarmup.delete(page);retainedViews.delete(page);slot.view.close();}
  function retain(page,mount,active=true){
    let slot=retainedViews.get(page);
    if(slot?.view.entryFailed){drop(page,slot);slot=null;}
    if(!slot){
      slot={active,visited:active};
      const shown=()=>slot.active&&page.visible();
      slot.view=mount({...page,visible:shown,accepts:shown});
      slot.controller=Object.assign(Object.create(slot.view),{
        page,
        close(){
          if(page===mainPages.get('assembly'))allowEquipmentStill=true;
          slot.active=false;
          if((!visible||memoryPressure)&&page!==home)drop(page,slot);
          else slot.view.park();
        },
      });
      retainedViews.set(page,slot);
    }else if(active){
      retainedViews.delete(page);retainedViews.set(page,slot);
      slot.active=true;slot.visited=true;slot.view.activate();
    }
    return slot.controller;
  }
  function retainMenu(host,send,interactive,setSection,active=true){
    return retain(host,page=>mountWechatMenu(device,platform,page,send,interactive,setSection,
      {atomicEntry:!active||host.completeEntry||host.catalog||host.workshop,parked:!active,sortieWarmup:!active&&firstSortieMenus}),active);
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
  function queuePilotAvatars(){
    if(firstSortieMenus||memoryPressure||!warmPilotAvatars)return;
    warmup.push(()=>warmPilotAvatars?.({
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
  function activityPanel(kind,host,send,scroll,sound){
    return panels.openLobbyPanel(kind,host,send,scroll,sound,{prepareArtwork:prepareActivityArtwork,backgroundPriority:-2});
  }
  function clearActivityPreviews(){
    for(const slot of activityPreviews.values())slot.view?.close();
    activityPreviews.clear();
  }
  function releaseIdleViews(){
    pendingWarmup.clear();finishStartupWarmup();
    clearActivityPreviews();
    for(const [page,slot] of retainedViews)if(!slot.active&&page!==home)drop(page,slot);
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
          const view=slot.view??=activityPanel(kind,modalRoot,send,scroll);
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
    openLobbyPanel(kind,host,send,scroll,sound){
      if(host!==modalRoot||!activityKinds.includes(kind))return panels.openLobbyPanel(kind,host,send,scroll,sound);
      const slot=activityPreviews.get(kind);
      activityPreviews.delete(kind);
      const view=slot?.view??activityPanel(kind,host,send,scroll,sound);
      view.activate();
      return {...view,close(){view.close();queueActivityPanels();}};
    },
    supportsMenu,
    mountHome(host,send,interactive,active=true){
      const view=retain(host,page=>mountWechatHome(device,platform,page,send,interactive),active);
      view.selectPilot(device.homeState.pilotId);
      return view;
    },
    prepareMenus(read,send,interactive,setSection,{firstSortieRequired=false}={}){
      warmPilotAvatars=signal=>{
        if(!platform.warmArtworkFiles||avatarWarmup||signal.aborted)return;
        const {snapshot}=read('assembly').data;
        const rows=snapshot.pilots??[],selected=rows.find(pilot=>pilot.id===snapshot.pilotId);
        const pilots=[selected,...rows.filter(pilot=>pilot.owned&&pilot!==selected)].filter(Boolean);
        const urls=pilots.map(pilot=>compactPilotAvatar(pilot.avatar||pilot.image).src).filter(Boolean);
        if(urls.length)avatarWarmup=platform.warmArtworkFiles(urls,signal).finally(()=>{avatarWarmup=null;});
      };
      queueMainMenus=()=>queueMenuWarmup(firstSortieMenus?[['assembly',mainPages.get('assembly')]]:mainPages,read,send,interactive,setSection);
      queueReturnMenus=()=>queueMenuWarmup(['assembly','supply'].map(tab=>[tab,mainPages.get(tab)]),read,send,interactive,setSection);
      if(firstSortieRequired){
        firstSortieMenus=true;
        mountSettledEquipment=()=>{
          const {data,key}=read('assembly',true);
          if(data.snapshot.firstSortieRequired)return null;
          const page=mainPages.get('assembly');
          pendingWarmup.delete(page);
          const view=retainMenu(page,send,interactive,setSection,false);
          view.update(data,key);
          let preparingHome;
          if(deferFirstSortieLobby&&!retainedViews.has(home)){
            const {snapshot}=data;
            device.publishHome(snapshot,battleChapterIndex(snapshot),bridge.debugToolsEnabled);
            preparingHome=device.mountHome(home,send,interactive,false).prepareEntry().catch(error=>{
              if(!visible&&device.battle)console.warn('[Three 首战返回大厅预热]',error?.message||error);
            });
          }
          return {view,preparingHome};
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
      const prepared=mountSettledEquipment?.();
      if(!prepared)return;
      const {view,preparingHome}=prepared;
      let homeReady=!preparingHome;
      void preparingHome?.then(()=>{homeReady=true;});
      return new Promise(resolve=>{
        let frame=null;
        const timer=setTimeout(finish,8000);
        function finish(){
          clearTimeout(timer);
          if(frame!==null)platform.cancelFrame(frame);
          if(cancelReturnPreparation===finish)cancelReturnPreparation=null;
          resolve();
        }
        function step(){
          frame=null;
          if(visible||memoryPressure||!isCurrent()){finish();return;}
          if(platform.visible&&!device.cover){
            try{
              if(view.prepareOffscreen(1)&&homeReady){
                platform.debugLog?.info('结算时装备首屏已准备');
                finish();return;
              }
            }catch(error){
              const page=mainPages.get('assembly'),slot=retainedViews.get(page);
              if(slot?.controller===view)drop(page,slot);
              console.warn('[Three 装备首屏预热]',error?.message||error);
              finish();return;
            }
          }
          frame=platform.requestFrame(step);
        }
        cancelReturnPreparation=finish;
        frame=platform.requestFrame(step);
      });
    },
    warmFirstSortieMenus(signal){
      if(!firstSortieMenus||cancelReturnPreparation||memoryPressure||visible||signal.aborted||!platform.visible||device.cover)return false;
      if(!firstSortieQueued){firstSortieQueued=true;queueMainMenus?.();warmPilotAvatars?.(signal);}
      if(pendingWarmup.size)warmNextMenu(1);
      return pendingWarmup.size>0;
    },
    prepareCatalogs(read,send,interactive,setSection){
      queueCatalogs=()=>queueMenuWarmup(catalogPages,read,send,interactive,setSection);
      queueCatalogs();queuePilotAvatars();
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
      return mountWechatMenu(device,platform,host,send,interactive,setSection);
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
      const portraitPage=location.tab==='battle'&&!location.subpage||location.subpage==='pilot';
      portraits.setVisible(value&&portraitPage,{...options,leavePage:!portraitPage});
    }},settingsStorage,
    hidden:()=>!visible||!platform.visible,
    busy(){},
    setVisible(value){
      const returning=value&&!visible;
      visible=value;
      if(!value&&!firstSortieMenus){
        releaseIdleViews();
        for(const slot of retainedViews.values())if(slot.active)slot.view.trimAircraft?.();
      }
      else if(returning){
        cancelReturnPreparation?.();
        allowEquipmentStill=true;battleCachePending=true;
        if(!firstSortieMenus){queueReturnMenus?.();queueActivityPanels();queueWorkshops?.();queueCatalogs?.();}
      }
      device.repaintHome?.();
    },
    blockPage(){},
    clearModal(){},
    retainModal:()=>({overlay:receiptRegion,restore(){}}),
    async copyReport(_host,report){device.toast.show(await copyText(report)?'已复制':'复制失败');},
    showPage({tab,subpage,nativeHome,workshopKind}){
      if(visible&&battleCachePending&&(mainPages.has(tab)||catalogPages.has(subpage)||subpage==='workshop')){
        battleCachePending=false;releaseBattleCache?.();
      }
      if(subpage==='pilot'&&location.subpage!=='pilot')queuePilotAvatars();
      location={tab,subpage};device.lobbyLocation=location;
      if(subpage==='workshop')return workshopPages.get(workshopKind)??menu;
      return nativeHome?home:subpage?(catalogPages.get(subpage)??menu):mainPages.get(tab)??menu;
    },
    requestFrame:platform.requestFrame,cancelFrame:platform.cancelFrame,
    close(){
      cancelReturnPreparation?.();mountSettledEquipment=warmPilotAvatars=null;
      pendingWarmup.clear();finishStartupWarmup();warmup.close();
      clearActivityPreviews();activityWarmup=null;
      queueMainMenus=queueWorkshops=queueCatalogs=queueReturnMenus=null;
      firstSortieMenus=false;
      visible=false;for(const [page,slot] of retainedViews)drop(page,slot);
      device.feedback.close();device.toast.close();
    },
  };
  try{
    const controller=createThreeLobbyController({bridge,system,presentation,deferPortraits,deferFirstSortieLobby});
    controller.trimMemory=()=>{
      memoryPressure=true;cancelReturnPreparation?.();releaseIdleViews();
      for(const slot of retainedViews.values())if(slot.active)slot.view.trimAircraft?.();
    };
    const update=controller.update.bind(controller);
    controller.update=step=>{
      const result=update(step);
      if(firstSortieMenus&&visible&&!controller.snapshot?.firstSortieRequired){
        firstSortieMenus=false;mountSettledEquipment=null;
        queuePilotAvatars();queueMainMenus?.();queueActivityPanels();queueWorkshops?.();queueCatalogs?.();
      }
      warmup.resume();return result;
    };
    return controller;
  }
  catch(error){presentation.close();throw error;}
}
