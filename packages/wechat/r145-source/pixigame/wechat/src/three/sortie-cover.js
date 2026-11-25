import { createSortieViewForOutput } from '../../../../../../../pixigame/src/three/game-screen/sortie-view.js';
import { showSortieOnOutput } from '../../../../../../../pixigame/src/three/game-screen/sortie-loading-core.js';
import { createSortieStarterAircraft } from '../../../../../../../pixigame/src/ui/sortie-starter-aircraft.js';

export function showWechatSortie(platform,services,options,firstSortieStartup){
  if(options.firstSortie)return firstSortieStartup().firstSortieLoading(options.onDismiss);
  const bounds=()=>platform.viewport.screen;
  const starterPreview=options.chapterId===1&&options.aircraftId==='pilot-01';
  const host={
    motionPreference:{matches:false},
    now:platform.now,requestFrame:platform.requestFrame,cancelFrame:platform.cancelFrame,
    hidden:()=>!platform.visible,
    loadAircraft:id=>services.loadAircraft(id),
    motionStepMs:1000/30,deferModel:true,
    hangarOptions:{environmentSize:128,startYaw:options.chapterId===1?Math.PI/5:0,
      createPreviewAircraft:starterPreview?createSortieStarterAircraft:undefined},
    motionTiming:platform.debugLog?stats=>platform.debugLog.info('出击转台',stats):undefined,
    view:(device,id,label,redraw)=>createSortieViewForOutput(device,{
      bounds,density:()=>platform.viewport.density,maxRenderHeight:1152,
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

