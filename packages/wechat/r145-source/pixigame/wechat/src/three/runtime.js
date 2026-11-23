import { homePresentation } from '../../../../../../../pixigame/src/three/game-screen/home-state.js';
import { openWechatThreeScreen } from './screen-platform.js';
import { mountWechatHome } from './home-surface.js';
import { mountWechatMenu } from './menu-surface.js';
import { showWechatStartup } from './startup.js';
import { openWechatBattleSurface } from './battle-surface.js';
import { startWechatLobbySession } from './session-host.js';
import { createWechatPanelInput } from './panel-input.js';
import { mountWechatLobby } from './lobby.js';
import { createWechatSortieBridge } from './battle.js';

export function createWechatThreeRuntime(api,{resources,baseURL}) {
  const platform=openWechatThreeScreen(api,resources,baseURL);
  const watchers=new Set();
  const device={
    three:platform.renderer,display:platform.display,
    createPanelInput(region){return createWechatPanelInput(api,platform,region);},
    subscribeHome(handler){watchers.add(handler);return ()=>watchers.delete(handler);},
    publishHome(snapshot,chapter,developer){
      device.homeState=homePresentation(snapshot,chapter,developer);
      for(const update of watchers)update();
    },
  };
  let startup=null,session=null,starting=false,closed=false;
  return {
    device,platform,
    showStartup(options) {
      if(closed)throw Error('微信运行时已关闭');
      startup?.close();
      const view=showWechatStartup(platform,{...options,onRelease(){
        if(startup===view){startup=null;device.cover=null;}
        options.onRelease?.();
        device.repaintHome?.();
      }});
      startup=device.cover=view;
      return view;
    },
    async startLobby(options) {
      if(closed||starting||session)throw Error('微信大厅会话已建立或关闭');
      starting=true;
      try{
        const {portraits,openAircraft,openVideo}=options;
        const mountLobby=state=>mountWechatLobby(api,platform,device,{...state,portraits,openAircraft,openVideo,settingsStorage:options.battleServices.storage});
        const createBattle=setup=>createWechatSortieBridge(platform,device,options.battleServices,baseURL,setup);
        const game=await startWechatLobbySession(api,platform,{...options,device,mountLobby,createBattle});
        if(closed){game.closeGameSession({save:false});throw Error('微信大厅会话已关闭');}
        session=game;
        return session;
      }finally{starting=false;}
    },
    mountHome(region,send,interactive){return mountWechatHome(device,platform,region,send,interactive);},
    mountMenu(region,send,interactive,setSection){return mountWechatMenu(device,platform,region,send,interactive,setSection);},
    openBattleSurface(region){return openWechatBattleSurface(device,platform,region);},
    close(){
      if(closed)return;
      closed=true;
      try{session?.closeGameSession();}finally{
        try{startup?.close();}finally{
          watchers.clear();
          platform.close();
        }
      }
    },
  };
}

