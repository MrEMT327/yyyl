import { mountThreeMenu } from '../../../../../../../pixigame/src/three/game-screen/menu-screen-core.js';
import { createMenuArtworkWarmup } from './frame-artwork.js';

export function mountWechatMenu(device,platform,region,send,interactive,setSection,{atomicEntry=false,parked=false,sortieWarmup=false}={}){
  const {bounds,openPortrait,openAircraft,reducedMotion=()=>false}=region;
  const debugLog=platform.debugLog;
  let active=false;
  return mountThreeMenu(device,{
    region,page:region,
    visible:()=>platform.visible&&region.visible(),
    ownsOutput:()=>active,
    layout:()=>({rect:platform.viewport.screen,density:platform.viewport.density,safeBottom:platform.viewport.safeBottom}),
    reducedMotion,now:platform.now,requestFrame:platform.requestFrame,cancelFrame:platform.cancelFrame,
    onLayout:platform.onViewport,
    prepareArtwork:atomicEntry?createMenuArtworkWarmup(platform):undefined,
    entryWaitMs:region.catalog||region.workshop?120:900,
    backgroundPriority:sortieWarmup||region.catalog||region.workshop?-2:-1,
    progressiveEntry:true,parked,native:true,
    beginEntryTrace:debugLog?(tab,retained,startedAt)=>debugLog.beginMenu(platform.now,tab,retained,startedAt):undefined,
    take(){active=true;},
    release(){active=false;},
    begin:(w,h,refresh)=>platform.display.begin(platform.viewport.screen,w,h,refresh),
    openPortrait,openAircraft,
  },send,interactive,setSection);
}
