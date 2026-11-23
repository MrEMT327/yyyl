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
import { prewarmLobbyArtwork } from './frame-artwork.js';

export function mountWechatLobby(api, platform, device, { bridge, system, deferPortraits, portraits, openAircraft, openVideo, settingsStorage }) {
  let visible=true,location={tab:'battle',subpage:''};
  const full=()=>platform.viewport.screen;
  function bounds(){
    const {screen,safeTop}=platform.viewport;
    return {...screen,y:safeTop,top:safeTop,height:screen.height-safeTop};
  }
  const isVisible=()=>visible&&!device.battle&&!device.cover;
  const warming=prewarmLobbyArtwork(platform,device,()=>platform.visible&&isVisible()&&location.tab==='battle'&&!location.subpage&&!device.panel);
  function region(priority=0,overlay=false){
    return {bounds,frameBounds:full,visible:isVisible,overlay,priority};
  }
  const modalRoot=region(10),receiptRegion=region(20,true),inspection=region(30,true);
  const home={...region(),stageEntry:true,getBounds:full,openPortrait:id=>portraits.openHome(id,device)};
  const menu={...region(),openPortrait:(refresh,paint)=>portraits.openCatalog(device,bounds,refresh,paint),
    openAircraft:(...args)=>openAircraft(device,bounds,...args)};
  const equipment={...menu},shop={...menu},features={...menu};
  const catalogPages=new Map(['weapon','aircraft','pilot'].map(key=>[key,{...menu,catalog:true}]));
  const retainedViews=new Map();
  function drop(page,slot){slot.view.close();retainedViews.delete(page);}
  function retain(page,mount){
    let slot=retainedViews.get(page);
    if(!slot){
      slot={active:true};
      const visible=()=>slot.active&&page.visible();
      slot.view=mount({...page,visible,accepts:visible});
      slot.controller=Object.assign(Object.create(slot.view),{
        page,
        close(){slot.active=false;slot.view.park();if(!visible&&page!==home)drop(page,slot);},
      });
      retainedViews.set(page,slot);
    }else{
      retainedViews.delete(page);retainedViews.set(page,slot);
      slot.active=true;slot.view.activate();
    }
    return slot.controller;
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
  Object.assign(device,lobbyPanels(device,{inspectItems,openVideo:(host,send)=>openVideo(device,host,send)}),{
    supportsMenu,
    mountHome(host,send,interactive){
      const view=retain(host,page=>mountWechatHome(device,platform,page,send,interactive));
      view.selectPilot(device.homeState.pilotId);
      return view;
    },
    mountMenu(host,send,interactive,setSection){
      if(host===equipment||host===shop||host.catalog){
        // Keep the last two catalogs for quick returns without retaining every
        // first-entry material, text canvas and 3D target for the whole lobby.
        if(host.catalog&&!retainedViews.has(host)){
          const parked=[...retainedViews].filter(([page,slot])=>page.catalog&&!slot.active);
          if(parked.length>=2)drop(...parked[0]);
        }
        return retain(host,page=>mountWechatMenu(device,platform,page,send,interactive,setSection,
          {stageEntry:true,progressiveEntry:!host.catalog}));
      }
      return mountWechatMenu(device,platform,host,send,interactive,setSection,{stageEntry:true});
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
      visible=value;
      // Keep fast back-and-forth navigation within the lobby, but don't carry
      // a parked shop or 3D hangar into the battle's GPU budget.
      if(!value)for(const [page,slot] of retainedViews)if(!slot.active&&page!==home)drop(page,slot);
      device.repaintHome?.();
    },
    blockPage(){},
    clearModal(){},
    retainModal:()=>({overlay:receiptRegion,restore(){}}),
    async copyReport(_host,report){device.toast.show(await copyText(report)?'已复制':'复制失败');},
    showPage({tab,subpage,nativeHome}){
      location={tab,subpage};device.lobbyLocation=location;
      return nativeHome?home:subpage?(catalogPages.get(subpage)??menu):tab==='assembly'?equipment:tab==='shop'?shop:features;
    },
    requestFrame:platform.requestFrame,cancelFrame:platform.cancelFrame,
    close(){
      visible=false;for(const [page,slot] of retainedViews)drop(page,slot);
      warming.close();device.feedback.close();device.toast.close();
    },
  };
  try{
    const controller=createThreeLobbyController({bridge,system,presentation,deferPortraits});
    const update=controller.update.bind(controller);
    controller.update=step=>{const result=update(step);warming.tick();return result;};
    return controller;
  }
  catch(error){presentation.close();throw error;}
}
