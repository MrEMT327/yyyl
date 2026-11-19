import { mountDeveloperSkills } from './developer-skills-ui';
import { installReleaseSlowMotion } from './battle-release-time.js';
import { installSafeTouchCancel } from './safe-touch-cancel.js';
import { BattleView, makeGame } from './kernel/renderer';
import { mountCloudCombat } from './cloud-combat.js';
import { createAppearance } from './appearance';
import { ensureBattlePlayerAssets } from './battle-player-assets';
import {ProjectUpgradeBurst} from './kernel/ui-burst';
import {disposeNativeGame} from './battle-lifetime.js';
import {mountBattleSession,type BattlePlatform} from './battle-session';
import type {BattleRendering} from './battle-rendering';
const rendering:BattleRendering={
  mountDeveloperSkills,mountCombatHud:mountCloudCombat,
  createChoiceBurst:()=>new ProjectUpgradeBurst(),
  createAppearance,
  createView:(content,sim,ready,skin,_render,plan,optimize,native)=>new BattleView(content,sim,ready,skin,undefined,plan,optimize,native),
  ready(scene,_skin,watch){
    installSafeTouchCancel(scene.game.input);watch(scene.game.canvas,scene.game.renderer.gl);
  },
  rawDelta:scene=>scene.game.loop.rawDelta,installPace:installReleaseSlowMotion,preparePlayer:ensureBattlePlayerAssets,
  start({scene,platform,lifetime,frameReuse,graphics,battlePerformance,reportLoading,renderedFrame}){
  // Attach before Phaser starts preload; its loader reports completed assets.
  const preload=scene.preload.bind(scene);
  scene.preload=()=>{
    // Static same-origin textures can decode directly without an XHR blob copy.
    scene.load.imageLoadType = 'HTMLImageElement';
    reportLoading('textures',0);
    scene.load.on('progress',(value:number)=>reportLoading('textures',value));
    preload();
  };
  const game = makeGame(scene,platform.canvas,frameReuse?.install);
  lifetime.add(() => {
    scene.onFrame = undefined;
    disposeNativeGame(game, () => scene.releaseBattleVisuals());
  });
  // Phaser's create callback means textures exist, not that the configured
  // sortie has rendered. Acknowledge after drawing under the loading cover.
  game.events.on('postrender', (renderer: unknown) => {
    if(!renderer || lifetime.disposed || document.hidden || graphics.blocked())return;
    if(platform.presentFrame?.()!==false)frameReuse?.presented();
    renderedFrame();
  });
  battlePerformance.attach(game);
  },
};
export function mountReplicaBattlePage(platform:BattlePlatform){
  const doc=platform.document;
  return mountBattleSession({...platform,setNotice(text){
    const node=doc.getElementById('battle-notice');if(node){node.textContent=text;node.hidden=!text;}
  },setLoadingMessage(text){const node=doc.getElementById('loading');if(node)node.textContent=text;}},rendering);
}
