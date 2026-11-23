import { createSortieViewForOutput } from '../../../../../../../pixigame/src/three/game-screen/sortie-view.js';
import { showSortieOnOutput } from '../../../../../../../pixigame/src/three/game-screen/sortie-loading-core.js';

export function showWechatSortie(platform,services,options){
  const bounds=()=>platform.viewport.screen;
  const host={
    motionPreference:{matches:false},
    now:platform.now,requestFrame:platform.requestFrame,cancelFrame:platform.cancelFrame,
    hidden:()=>!platform.visible,loadAircraft:services.loadAircraft,
    view:(device,id,label,redraw)=>createSortieViewForOutput(device,{
      bounds,density:()=>platform.viewport.density,
      begin:(w,h,request)=>platform.display.begin(bounds(),w,h,request,true),
      release(){},
    },id,label,redraw),
    bind({visible,redraw,start,end,cancel}){
      const stopViewport=platform.onViewport(()=>{visible();redraw();});
      const stopTouch=platform.bindTouches(({phase,x,y})=>{
        if(phase==='start')start(x,y);
        else if(phase==='end')end(x,y);
        else if(phase==='cancel')cancel();
      },40);
      return ()=>{stopViewport();stopTouch();};
    },
    close(){},
  };
  return showSortieOnOutput({...options,host});
}

