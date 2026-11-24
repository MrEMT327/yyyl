import { createThreeLobbyController } from '../../../../../../../pixigame/src/ui/three-lobby-controller.js';
import { supportsMenu } from '../../../../../../../pixigame/src/three/game-screen/menu-screen-core.js';
import { lobbyPanels } from '../../../../../../../pixigame/src/three/game-screen/lobby-panels.js';
import { createLobbyFeedback } from '../../../../../../../pixigame/src/three/game-screen/lobby-feedback.js';
import { createLobbyToast } from '../../../../../../../pixigame/src/three/game-screen/lobby-toast.js';
import { createLobbyPanel } from '../../../../../../../pixigame/src/three/game-screen/lobby-panel.js';
import { paintItemDetail } from '../../../../../../../pixigame/src/three/game-screen/item-details.js';
import { mountWechatHome } from './home-surface.js';
import { mountWechatMenu } from './menu-surface.js';
import { createWechatTextField } from './text-field.js';
import { createMenuArtworkWarmup, frameWork } from './frame-artwork.js';

const activityKinds=['tasks','carnival'];

export function mountWechatLobby(api, platform, device, { bridge, system, deferPortraits, portraits, openAircraft, openVideo, settingsStorage }) {
  let startupWarmup=null,queueCatalogs=null,queueWorkshops=null,queueRecruit=null,warmupQueued=false,visible=true,location={tab:'battle',subpage:''};
  const full=()=>platform.viewport.screen;
  function bounds(){
    const {screen,safeTop}=platform.viewport;
    return {...screen,y:safeTop,top:safeTop,height:screen.height-safeTop};
  }
  const isVisible=()=>visible&&!device.battle&&!device.cover;
  const warmup=frameWork(platform,()=>platform.visible&&visible&&!device.battle&&!device.preview&&
    platform.inputIdle&&!device.panel?.fullscreen,40);
  function region(priority=0,overlay=false){
    return {bounds,frameBounds:full,visible:isVisible,overlay,priority};
  }
  const modalRoot=region(10),receiptRegion=region(20,true),inspection=region(30,true);
  const activityPreviews=new Map(),prepareActivityArtwork=createMenuArtworkWarmup(platform);
  let activityWarmup=null;
  const home={...region(),stageEntry:true,getBounds:full,openPortrait:id=>portraits.openHome(id,device)};
  const menu={...region(),openPortrait:(refresh,paint)=>portraits.openCatalog(device,bounds,refresh,paint),
    openAircraft:(...args)=>openAircraft(device,bounds,...args)};
  const mainPages=new Map(['supply','assembly','shop','research'].map(tab=>[tab,{...menu,main:true,recruit:tab==='supply'}]));
  const catalogPages=new Map(['weapon','aircraft','pilot'].map(key=>[key,{...menu,catalog:true}]));
  const workshopPages=new Map(['gear','weapon'].map(kind=>[kind,{...menu,workshop:kind}]));
  const retainedViews=new Map();
  const pendingWarmup=new Map(),warmedTabs=[];
  function drop(page,slot){slot.view.close();retainedViews.delete(page);}
  function retain(page,mount,active=true){
    let slot=retainedViews.get(page);
    if(!slot){
      slot={active};
      const shown=()=>slot.active&&page.visible();
      slot.view=mount({...page,visible:shown,accepts:shown});
      slot.controller=Object.assign(Object.create(slot.view),{
        page,
        close(){slot.active=false;slot.view.park();if(!visible&&page!==home)drop(page,slot);},
      });
      retainedViews.set(page,slot);
    }else if(active){
      retainedViews.delete(page);retainedViews.set(page,slot);
      slot.active=true;slot.view.activate();
    }
    return slot.controller;
  }
  function retainMenu(host,send,interactive,setSection,active=true){
    return retain(host,page=>mountWechatMenu(device,platform,page,send,interactive,setSection,
      {atomicEntry:!active||host.catalog||host.recruit||host.workshop,parked:!active}),active);
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
    for(const [tab,host] of pages){
      if(retainedViews.has(host)||pendingWarmup.has(host))continue;
      pendingWarmup.set(host,{tab,mount(){
        const {data,key}=read(tab);
        const view=retainMenu(host,send,interactive,setSection,false);
        view.update(data,key);
        return view;
      }});
    }
    resumeWarmup();
  }
  function warmNextMenu(){
    const next=pendingWarmup.entries().next().value;
    if(!next)return;
    const [host,job]=next;
    pendingWarmup.delete(host);
    try{
      const view=job.view??=job.mount();
      if(!view.prepareOffscreen())pendingWarmup.set(host,job);
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
  function queueActivityPanels(){
    if(!visible||!activityWarmup)return;
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
    mountHome(host,send,interactive){
      const view=retain(host,page=>mountWechatHome(device,platform,page,send,interactive));
      view.selectPilot(device.homeState.pilotId);
      return view;
    },
    prepareMenus(read,send,interactive,setSection){
      queueRecruit=()=>queueMenuWarmup([['supply',mainPages.get('supply')]],read,send,interactive,setSection);
      return new Promise(resolve=>{
        const timer=setTimeout(finishStartupWarmup,1600);
        startupWarmup={resolve,timer};
        queueMenuWarmup(mainPages,read,send,interactive,setSection);
        if(!pendingWarmup.size)finishStartupWarmup();
      });
    },
    prepareCatalogs(read,send,interactive,setSection){
      queueCatalogs=()=>queueMenuWarmup(catalogPages,read,send,interactive,setSection);
      queueCatalogs();
    },
    prepareWorkshops(read,send,interactive,setSection){
      queueWorkshops=()=>queueMenuWarmup(workshopPages,read,send,interactive,setSection);
      queueWorkshops();
    },
    mountMenu(host,send,interactive,setSection){
      if(host.main||host.catalog||host.workshop){
        pendingWarmup.delete(host);
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
      portraits.setVisible(value&&(location.tab==='battle'&&!location.subpage||location.subpage==='pilot'),options);
    }},settingsStorage,
    hidden:()=>!visible||!platform.visible,
    busy(){},
    setVisible(value){
      const returning=value&&!visible;
      visible=value;
      // Parked pages only live for the current lobby visit.
      if(!value){
        pendingWarmup.clear();finishStartupWarmup();
        clearActivityPreviews();
        for(const [page,slot] of retainedViews)if(!slot.active&&page!==home)drop(page,slot);
      }else if(returning){
        queueRecruit?.();queueActivityPanels();queueWorkshops?.();queueCatalogs?.();
      }
      device.repaintHome?.();
    },
    blockPage(){},
    clearModal(){},
    retainModal:()=>({overlay:receiptRegion,restore(){}}),
    async copyReport(_host,report){device.toast.show(await copyText(report)?'已复制':'复制失败');},
    showPage({tab,subpage,nativeHome,workshopKind}){
      location={tab,subpage};device.lobbyLocation=location;
      if(subpage==='workshop')return workshopPages.get(workshopKind)??menu;
      return nativeHome?home:subpage?(catalogPages.get(subpage)??menu):mainPages.get(tab)??menu;
    },
    requestFrame:platform.requestFrame,cancelFrame:platform.cancelFrame,
    close(){
      pendingWarmup.clear();finishStartupWarmup();warmup.close();
      clearActivityPreviews();activityWarmup=null;
      queueWorkshops=queueCatalogs=queueRecruit=null;
      visible=false;for(const [page,slot] of retainedViews)drop(page,slot);
      device.feedback.close();device.toast.close();
    },
  };
  try{
    const controller=createThreeLobbyController({bridge,system,presentation,deferPortraits});
    const update=controller.update.bind(controller);
    controller.update=step=>{
      const result=update(step);
      warmup.resume();return result;
    };
    return controller;
  }
  catch(error){presentation.close();throw error;}
}
