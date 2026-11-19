import '../../style.css';
import '../../ui/entry-screens.css';
import './h5-shell.css';
import {startLobbySession} from '../../lobby-runtime/host-session.js';
import {mountThreeLobby} from '../../ui/three-peripheral-lobby.js';
import {createReplicaBattleBridge} from '../../replica/battle-session-bridge.js';
import {showThreeSortie} from './sortie-loading.js';
import {setPortraitRendererFactory} from '../../ui/golden-mesh-renderer.js';
import {performanceMonitor} from '../../performance-monitor.js';
import {mountH5Portrait} from './h5-portrait.js';
import {mountVideoPortrait} from './video-portrait.js';
import {mountCubismPortrait} from './cubism-surface.js';
import {createBluePortrait} from './blue-portrait.js';
import {homePresentation} from './home-state.js';
import {mountHomeView} from './home-view.js';
import {mountMenuScreen,supportsMenu} from './menu-screen.js';
import {openBackpack} from './backpack-scene.js';
import {openGearPanel,supportsGearPanel} from './gear-panel.js';
import {openCollectionPanel,supportsCollectionPanel} from './collection-panel.js';
import {openSupplyPanel,supportsSupplyPanel} from './supply-panel.js';
import {openUtilityPanel,supportsUtilityPanel} from './utility-panel.js';
import {createLobbyToast} from './lobby-toast.js';
import {createLobbyFeedback} from './lobby-feedback.js';
import {openFleetPanel,supportsFleetPanel} from './fleet-panels.js';
import {createItemInspection} from './item-inspection.js';
import {openChapterPanel,supportsChapterPanel} from './chapter-panel.js';
import {openRewardReceipt} from './reward-receipt.js';
import {openBoxOpening} from './box-opening.js';
import {openProcessFeedback} from './process-feedback.js';
import {openRecruitPreview} from './recruit-preview.js';
import {openRecruitResults} from './recruit-results.js';
import {openAffection} from './affection.js';
import {openAffectionVideo} from './affection-video.js';
import {openResearchPanel} from './research-panel.js';
import {openLabPanel} from './lab-panel.js';
import {openProfilePanel} from './profile-panel.js';
import {openTaskPanel} from './task-panel.js';
import {openPatrolPanel} from './patrol-panel.js';
import {openShopPanel,supportsShopPanel} from './shop-panels.js';

export async function startH5Game(startup) {
  document.documentElement.dataset.gameRenderer='three';
  const shell=document.getElementById('gameShell');
  const holder=document.createElement('div');
  holder.id='game';
  holder.style.cssText='position:absolute;inset:0;pointer-events:none';
  const three=startup.renderer;
  const homeListeners=new Set();
  const device={three,display:startup.display,home:holder,screen:{width:540,height:960},
    mountHome:(page,send,interactive)=>mountHomeView(device,page,send,interactive),
    supportsMenu,mountMenu:(page,send,interactive,setSection)=>mountMenuScreen(device,page,send,interactive,setSection),
    openBackpack:(host,action)=>openBackpack(device,host,action),
    inspectItems:(container,read)=>createItemInspection(device,container,read),
    lobbyPanelKind:(type,snapshot)=>supportsFleetPanel(type)?'fleet':supportsUtilityPanel(type)?'utility':supportsSupplyPanel(type)?'supply':supportsCollectionPanel(type)?'collection':supportsGearPanel(type)?'gear':['tasks','patrol','quickPatrol','playerInfo','recruitRewards','pilotAffection','pilotAffectionVideo','researchSummary','researchCard','researchResult','nativeLab','nativeStats'].includes(type)||supportsShopPanel(type)||supportsChapterPanel(type,snapshot)?type:null,
    openLobbyPanel(kind,host,send,scrollPositions,sound){
      if(kind==='fleet')return openFleetPanel(device,host,send);
      if(kind==='utility')return openUtilityPanel(device,host,send);
      if(kind==='supply')return openSupplyPanel(device,host,send);
      if(kind==='collection')return openCollectionPanel(device,host,send);
      if(['researchSummary','researchCard','researchResult'].includes(kind))return openResearchPanel(device,host,send,sound);
      if(kind==='nativeLab'||kind==='nativeStats')return openLabPanel(device,host,send);
      if(kind==='gear')return openGearPanel(device,host,send);
      if(kind==='playerInfo')return openProfilePanel(device,host,send);
      if(kind==='recruitRewards')return openRecruitPreview(device,host,send);
      if(kind==='pilotAffection')return openAffection(device,host,send);
      if(kind==='pilotAffectionVideo')return openAffectionVideo(device,host,send);
      if(supportsShopPanel(kind))return openShopPanel(device,host,send,kind);
      if(kind==='tasks')return openTaskPanel(device,host,send,kind,scrollPositions);
      if(kind==='patrol'||kind==='quickPatrol')return openPatrolPanel(device,host,send,kind,scrollPositions);
      return openChapterPanel(device,host,send,kind);
    },
    openRewardReceipt:(host,send,sound)=>openRewardReceipt(device,host,send,sound),
    openBoxOpening:(host,send,sound)=>openBoxOpening(device,host,send,sound),
    openProcessFeedback:(host,send,sound)=>openProcessFeedback(device,host,send,sound),
    openRecruitResults:(host,send,sound)=>openRecruitResults(device,host,send,sound),
    openTaskChestPreview:(host,send)=>openTaskPanel(device,host,send,'taskChestPreview'),
    openPatrolReceipt:(host,send)=>openPatrolPanel(device,host,send,'patrolReceipt'),
    videoSurface:(canvas,manifest,vertex,fragment)=>mountVideoPortrait(canvas,manifest,vertex,fragment,performanceMonitor,device),
    cubismSurface:(canvas,model,images,mipmaps)=>mountCubismPortrait(canvas,model,images,mipmaps,performanceMonitor,device),
    blueSurface:(canvas,options)=>createBluePortrait(canvas,options,performanceMonitor,device),
    subscribeHome(callback){homeListeners.add(callback);return ()=>homeListeners.delete(callback);},
    publishHome(snapshot,chapter,developer){
      const next=homePresentation(snapshot,chapter,developer);
      this.homeState=next;
      for(const listener of homeListeners)listener();
    }};
  device.toast=createLobbyToast(()=>device.repaintHome?.());
  device.feedback=createLobbyFeedback(device);
  startup.attach(device);
  shell.prepend(holder);
  setPortraitRendererFactory((canvas,manifest,textures)=>mountH5Portrait(canvas,manifest,textures,performanceMonitor,device));
  function dispose(){
    device.toast.close();
    device.feedback.close();
    homeListeners.clear();
    setPortraitRendererFactory(null);
    holder.remove();
  }
  try{
    const createBattle=options=>createReplicaBattleBridge({...options,screen:device,showSortieLoading:showThreeSortie,mountBattle:async session=>{
      const {mountH5Battle}=await import('../../../replica-battle/h5-game.js');
      return mountH5Battle({...session,screen:device});
    }});
    const bridge=await startLobbySession({platformKind:'h5',app:{renderer:device},mountLobby:mountThreeLobby,createBattle});
    const close=bridge.closeGameSession;
    let closed=false;
    bridge.closeGameSession=options=>{
      if(closed)return;
      closed=true;
      try{return close(options);}finally{dispose();}
    };
    return bridge;
  }catch(error){dispose();throw error;}
}

