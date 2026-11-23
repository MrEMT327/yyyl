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
import {createLobbyToast} from './lobby-toast.js';
import {createLobbyFeedback} from './lobby-feedback.js';
import {openAffectionVideo} from './affection-video.js';
import {lobbyPanels} from './lobby-panels.js';

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
    videoSurface:(canvas,manifest,vertex,fragment)=>mountVideoPortrait(canvas,manifest,vertex,fragment,performanceMonitor,device),
    cubismSurface:(canvas,model,images,mipmaps)=>mountCubismPortrait(canvas,model,images,mipmaps,performanceMonitor,device),
    blueSurface:(canvas,options)=>createBluePortrait(canvas,options,performanceMonitor,device),
    subscribeHome(callback){homeListeners.add(callback);return ()=>homeListeners.delete(callback);},
    publishHome(snapshot,chapter,developer){
      const next=homePresentation(snapshot,chapter,developer);
      this.homeState=next;
      for(const listener of homeListeners)listener();
    }};
  Object.assign(device,lobbyPanels(device,{openVideo:(host,send)=>openAffectionVideo(device,host,send)}));
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

