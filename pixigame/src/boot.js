// The HTML loading screen precedes module/CSS/image loading. Never expose the
// legacy DOM while the renderer and the shared UI are still being constructed.
import { memoryCheckpoint } from './replica/memory-checkpoints.js';
import { mountBuildIdentity } from './build-info.js';
import './build-info.css';
import { createStartupScreen } from './ui/startup-screen.js';
import { installLocalRewardedAd } from './platform/local-rewarded-ad-runtime.js';
import { startGameSession } from './platform/game-session-runtime.js';
// Keep the browser title player-facing; build details remain in the developer panel.
const playerFacingTitle=document.title;
mountBuildIdentity();
document.title=playerFacingTitle;
memoryCheckpoint('host-boot');
const startup=createStartupScreen();
let activeBridge, loadingRuntime, session;
const requireSession=()=>{
  if(!session?.isCurrent())throw Object.assign(new Error('当前页面已停止运行，请重新进入游戏'),{code:'retired'});
};
try {
  startup.stage(0,'正在加载…');
  // Acquire before importing main: its dependencies can migrate saved data.
  session=await startGameSession({
    beforeRelease(){
      if(activeBridge)return activeBridge.closeGameSession?.({save:true});
      return loadingRuntime?.then(bridge=>bridge?.closeGameSession?.({save:true}),()=>{});
    },
    onLost(){
      activeBridge?.closeGameSession?.({save:false});
      startup.fail({message:'当前页面已停止运行，请重新进入游戏'});
    },
  });
  requireSession();
  if (new URLSearchParams(location.search).get('preview') === 'weapons') {
    const { mountWeaponPreview } = await import('./weapon-preview/page.js');
    await mountWeaponPreview();
  } else {
    installLocalRewardedAd(globalThis,typeof __THUNDER_RELEASE_MODE__==='undefined'?'production':__THUNDER_RELEASE_MODE__);
    loadingRuntime=import('./main.js').then(module=>module.thunderRuntimeReady);
    const bridge = await loadingRuntime;
    activeBridge=bridge;
    if(!session.isCurrent())bridge?.closeGameSession?.({save:false});
    requireSession();
    if (!bridge) throw new Error('Game runtime did not start');
    memoryCheckpoint('host-runtime-ready');
    startup.stage(1,'正在准备主界面…');
    // The DOM lobby fully covers the combat canvas. UI refreshes must not
    // submit that hidden world; combat resumes its existing render path as
    // soon as the lobby hides. Native canvas-only previews keep rendering.
    if(document.getElementById('gui-casual-lobby')?.classList.contains('peripheral-lobby')){
      const render=bridge.app.renderer.render;
      bridge.app.renderer.render=function(...args){if(bridge.pixiLobby?.state?.visible)return;return render.apply(this,args);};
    }
    const { mountPerformancePanel } = await import('./ui/performance-panel.js');
    requireSession();
    bridge.performancePanel=mountPerformancePanel({ bridge });
    const { mountReplicaResearchTool } = await import('./replica/research-tool.js');
    requireSession();
    bridge.replicaResearchTool = mountReplicaResearchTool({ bridge });
    bridge.pixiLobby?.update();
    bridge.pixiCombatUi?.update();
    bridge.app.renderer.render({ container: bridge.app.stage });
    startup.stage(2,'正在确认航线…');
  }
  await new Promise(resolve => requestAnimationFrame(resolve));
  requireSession();
  await startup.ready(()=>{if(session.isCurrent())activeBridge?.unlockAudio?.();},{automatic:!activeBridge||activeBridge.game.state!=='menu'});
  memoryCheckpoint('host-visible');
} catch (error) {
  session?.release();
  if(!['busy','retired'].includes(error.code))console.error('Game bootstrap failed', error);
  startup.fail(error.code ? {message:error.message} : undefined);
}
