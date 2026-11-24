import { memoryCheckpoint } from './replica/memory-checkpoints.js';
import { installBrowserDiagnostics, recordDiagnostic } from './diagnostic-log.js';
import {createH5Startup} from './three/game-screen/startup.js';
import './ui/entry-screens.css';
import { installLocalRewardedAd } from './platform/local-rewarded-ad-runtime.js';
import { startGameSession } from './platform/game-session-runtime.js';
// Keep the browser title player-facing; build details remain in the developer panel.
installBrowserDiagnostics();
memoryCheckpoint('host-boot');
let startup;
let activeBridge, loadingRuntime, session;
const requireSession=()=>{
  if(!session?.isCurrent())throw Object.assign(new Error('当前页面已停止运行，请重新进入游戏'),{code:'retired'});
};
if(new URLSearchParams(location.search).get('preview')==='weapons'){
  const gallery=new URL('tools/combat-vfx-gallery.html',document.baseURI);gallery.search=location.search;gallery.hash=location.hash;
  location.replace(gallery);
}else try {
  startup=createH5Startup();
  startup.stage(0,'正在加载…');
  // Acquire before importing main: its dependencies can migrate saved data.
  session=await startGameSession({
    beforeRelease(){
      if(activeBridge)return activeBridge.closeGameSession?.({save:true});
      return loadingRuntime?.then(bridge=>bridge?.closeGameSession?.({save:true}),()=>{});
    },
    onLost(){
      activeBridge?.closeGameSession?.({save:false});
      recordDiagnostic('启动会话结束', '页面已失去存档权限');
      startup.fail({message:'当前页面已停止运行，请重新进入游戏'});
    },
  });
  requireSession();
    installLocalRewardedAd(globalThis,typeof __THUNDER_RELEASE_MODE__==='undefined'?'production':__THUNDER_RELEASE_MODE__);
    loadingRuntime=import('./three/game-screen/h5-runtime.js').then(module=>module.startH5Game(startup));
    const bridge = await loadingRuntime;
    activeBridge=bridge;
    if(!session.isCurrent())bridge?.closeGameSession?.({save:false});
    requireSession();
    if (!bridge) throw new Error('Game runtime did not start');
    memoryCheckpoint('host-runtime-ready');
    startup.stage(1,'正在准备主界面…');
    const { mountPerformancePanel } = await import('./three/game-screen/page-diagnostics.js');
    requireSession();
    bridge.performancePanel=mountPerformancePanel({ bridge });
    bridge.pixiLobby?.update();
    bridge.pixiCombatUi?.update();
    startup.stage(2,'正在确认航线…');
  await new Promise(resolve => requestAnimationFrame(resolve));
  requireSession();
  await startup.ready(()=>{if(session.isCurrent())activeBridge?.unlockAudio?.();},{automatic:!activeBridge||activeBridge.game.state!=='menu'});
  memoryCheckpoint('host-visible');
} catch (error) {
  recordDiagnostic('启动失败', error?.message);
  session?.release();
  if(!['busy','retired'].includes(error.code))console.error('Game bootstrap failed', error);
  if(startup)startup.fail(error.code ? {message:error.message} : undefined);
  else document.getElementById('bootLoading').textContent='无法启动图形设备，请启用 WebGL 后刷新页面';
}
