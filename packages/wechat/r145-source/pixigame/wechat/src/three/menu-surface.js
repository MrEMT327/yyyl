import { mountThreeMenu } from '../../../../../../../pixigame/src/three/game-screen/menu-screen-core.js';
import { createMenuArtworkWarmup } from './frame-artwork.js';

export function mountWechatMenu(device,platform,region,send,interactive,setSection,{stageEntry=false}={}){
  const {bounds,openPortrait,openAircraft,reducedMotion=()=>false}=region;
  let active=false;
  return mountThreeMenu(device,{
    region,page:region,
    visible:()=>platform.visible&&region.visible(),
    ownsOutput:()=>active,
    layout:()=>({rect:platform.viewport.screen,density:platform.viewport.density,safeBottom:platform.viewport.safeBottom}),
    reducedMotion,now:platform.now,requestFrame:platform.requestFrame,cancelFrame:platform.cancelFrame,
    onLayout:platform.onViewport,
    prepareArtwork:stageEntry?createMenuArtworkWarmup(platform):undefined,adaptiveEquipment:true,
    take(){active=true;},
    release(){active=false;},
    begin:(w,h,refresh)=>platform.display.begin(platform.viewport.screen,w,h,refresh),
    openPortrait,openAircraft,
  },send,interactive,setSection);
}
