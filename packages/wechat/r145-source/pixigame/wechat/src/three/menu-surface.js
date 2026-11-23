import { mountThreeMenu } from '../../../../../../../pixigame/src/three/game-screen/menu-screen-core.js';
import { createMenuArtworkWarmup } from './frame-artwork.js';

export function mountWechatMenu(device,platform,region,send,interactive,setSection,{stageEntry=false,progressiveEntry=false}={}){
  const {bounds,openPortrait,openAircraft,reducedMotion=()=>false}=region;
  const debugLog=stageEntry?platform.debugLog:null;
  let active=false;
  return mountThreeMenu(device,{
    region,page:region,
    visible:()=>platform.visible&&region.visible(),
    ownsOutput:()=>active,
    layout:()=>({rect:platform.viewport.screen,density:platform.viewport.density,safeBottom:platform.viewport.safeBottom}),
    reducedMotion,now:platform.now,requestFrame:platform.requestFrame,cancelFrame:platform.cancelFrame,
    onLayout:platform.onViewport,
    prepareArtwork:stageEntry&&!progressiveEntry?createMenuArtworkWarmup(platform):undefined,
    progressiveEntry,adaptiveEquipment:true,
    beginEntryTrace:debugLog?(tab,retained,startedAt)=>debugLog.beginMenu(platform.now,tab,retained,startedAt):undefined,
    take(){active=true;},
    release(){active=false;},
    begin:(w,h,refresh)=>platform.display.begin(platform.viewport.screen,w,h,refresh),
    openPortrait,openAircraft,
  },send,interactive,setSection);
}
