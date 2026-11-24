import { openThreeBattleSurface } from '../../../../../../../pixigame/src/three/game-screen/h5-battle-screen.js';
import { fullBattleFrame } from '../../../../../../../pixigame/src/three/game-screen/battle-frame-layout.js';

export function openWechatBattleSurface(device,platform,region){
  return openThreeBattleSurface(device,{
    input:platform.display.canvas,
    bounds:()=>region.bounds(),
    attach:()=>region.enter(),
    detach:()=>region.leave(),
    frame:()=>fullBattleFrame(region.bounds()),
    smoothEnemyMinification:true,
    outputScale:4/3,
    begin:({width,height})=>platform.display.begin(region.bounds(),width,height,null),
  });
}
