import '../../../src/style.css';
import { startThunderRuntime } from '../../../src/main.js';
import { createStartupScreen } from '../../../src/ui/startup-screen.js';
import { mountDomButtonPress } from '../../../src/ui/dom-button-press.js';
import { installBrowserDiagnostics, recordDiagnostic } from '../../../src/diagnostic-log.js';

export async function startLobbyRuntime({ prepareStartButton } = {}) {
  installBrowserDiagnostics();
  const startup = createStartupScreen(document, {prepareStartButton}), disposePress = mountDomButtonPress();
  startup.stage(0, '正在加载…');
  try {
    const bridge = await startThunderRuntime({deferPortraits:true});
    startup.stage(1, '正在准备主界面…');
    startup.stage(2, '正在确认航线…');
    await new Promise(resolve => requestAnimationFrame(resolve));
    await startup.ready(() => bridge.unlockAudio?.());
    bridge.pixiLobby.startPortraits();
    return { bridge, dispose() { disposePress(); bridge.closeGameSession?.({save:true}); } };
  } catch(error) { recordDiagnostic('微信启动失败', error.message); startup.fail({message:error.message}); throw error; }
}
