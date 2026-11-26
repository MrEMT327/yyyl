import { createHomePointer } from '../../../../../../../pixigame/src/three/game-screen/home-input.js';
import { mountThreeHome } from '../../../../../../../pixigame/src/three/game-screen/home-view.js';

// The session chooses the game bounds and owns the portrait player. WeChat
// touches use those bounds directly for the existing Three lobby's controls.
export function mountWechatHome(device, platform, region, send, interactive) {
  const { getBounds, openPortrait, onReady, reducedMotion = () => false } = region;
  const clock = { request: platform.requestFrame, cancel: platform.cancelFrame, now: platform.now, hidden: () => !platform.visible };
  let claimed = false, ready = false;
  const host = {
    page:region,stageEntry:region.stageEntry,now: platform.now, requestFrame: platform.requestFrame, cancelFrame: platform.cancelFrame,
    visible: () => platform.visible&&region.visible(), reducedMotion, idleHudInterval:1000/30,
    layout: () => ({ rect: getBounds(), density: platform.viewport.density, safeTop: platform.viewport.safeTop,
      safeBottom: platform.viewport.safeBottom, safeContentTop: platform.viewport.safeContentTop, menuButton: platform.viewport.menuButton }),
    onLayout: platform.onViewport,
    claim() { claimed = true; },
    release() { claimed = false; },
    ownsOutput: () => claimed,
    newPortrait: openPortrait,
    movePortrait: (portrait, x, y, width, height) => portrait.layout({x, y, width, height}),
    dropPortrait: portrait => portrait.close(),
    ownsPortrait: (portrait, surface) => portrait.surface === surface,
    bindInput(handlers) {
      const input = createHomePointer({ ...handlers, bounds: getBounds, immediateTabs: true }, clock);
      const unsubscribe = platform.bindTouches(({phase, x, y, pointerId}) => {
        if (phase === 'start') input.start(x, y, pointerId);
        else if (phase === 'move') input.move(x, y, pointerId);
        else if (phase === 'end') {
          const control = input.end(x, y, pointerId);
          if (control) handlers.activate(control);
        } else input.cancel();
      },region.priority,region.accepts);
      return Object.assign(() => { unsubscribe(); input.close(); },{cancel:input.cancel});
    },
    begin(w,h,refresh) {
      if(!device.panel)platform.debugLog?.markMenuVisible?.('battle');
      return platform.display.begin(getBounds(),w,h,refresh);
    },
    ready(value) {
      if (value === ready) return;
      ready = value;
      onReady?.(value);
    },
  };
  return mountThreeHome(device,host,send,interactive);
}
