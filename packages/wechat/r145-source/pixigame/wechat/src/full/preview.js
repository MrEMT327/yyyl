// Development-only parity surface: renders the CURRENT H5 lobby through the
// Mini Game layout/compositor. It never reads or writes the player's save.
import '../../../src/style.css';
import { loadYoga } from 'yoga-layout/load';
import { createPeripheralSystem } from '../../../src/peripheral/system.js';
import { CAMPAIGN } from '../../../src/campaign.js';
import { tuneMainlineCampaign } from '../../../src/peripheral/balance-tuning.js';
import { mountPeripheralLobby } from '../../../src/ui/peripheral-lobby.js';
import { createDomEnvironment } from './dom-environment.js';
import { createDomStyles } from './dom-style.js';
import { createDomLayout } from './dom-layout.js';
import { createDomPainter } from './dom-painter.js';
import { createDomAnimations } from './dom-animation.js';
import { attachDomInput } from './dom-input.js';

export async function startPreview() {
  const browser = globalThis.window, realDocument = document, RealImage = Image, originalFetch = fetch.bind(browser);
  const raf = requestAnimationFrame.bind(browser), cancel = cancelAnimationFrame.bind(browser);
  const canvas = realDocument.querySelector('canvas'), log = realDocument.querySelector('pre');
  const sheet = await originalFetch('./shared-style.json').then(response => response.json());
  const store = new Map(), callbacks = {};
  const api = {
    env: { USER_DATA_PATH: 'wxfile://preview' },
    createCanvas: () => realDocument.createElement('canvas'), createImage: () => new RealImage(),
    getStorageSync: key => store.get(key), setStorageSync: (key, value) => store.set(key, value), removeStorageSync: key => store.delete(key),
    onTouchStart: fn => { callbacks.down = fn; }, onTouchMove: fn => { callbacks.move = fn; }, onTouchEnd: fn => { callbacks.up = fn; }, onTouchCancel: fn => { callbacks.cancel = fn; },
    showActionSheet: value => { log.textContent = JSON.stringify(value.itemList); },
  };
  const host = createDomEnvironment(api, { resources: { resolve: value => new URL(value, browser.location.origin).href },
    baseURL: browser.location.origin + '/', width: 393, height: 852, pixelRatio: 1, screenCanvas: canvas,
    markup: '<html><head></head><body><section class="game-shell" id="gameShell"></section></body></html>',
  });
  host.requestAnimationFrame = raf; host.cancelAnimationFrame = cancel;
  const styles = createDomStyles(sheet, { width: 393, height: 852 });
  host.layout = createDomLayout(host, styles, await loadYoga(), api.createCanvas().getContext('2d'));
  host.animations = createDomAnimations(); host.install();
  const painter = createDomPainter(host, host.layout, canvas); attachDomInput(host);
  const profile = { playerName: '逐星旅人', coins: 600, diamonds: 0, fighterLevel: 1, gearLevel: 1, techLevel: 1, supplyOpened: 0, lastFreeSupply: '' };
  let selected = 0, lobby;
  const system = createPeripheralSystem({ storage: host.storage, profile, stages: tuneMainlineCampaign(CAMPAIGN),
    getCampaign: () => ({ results: {} }), saveProfile() {}, getSelectedStage: () => selected, selectStage: index => { selected = index; }, onChange: () => lobby?.refresh() });
  const bridge = { platformKind: 'wechat', profileState: profile, game: { state: 'menu' }, debugToolsEnabled: true,
    getPeripheralSnapshot: () => system.snapshot(), peripheralAction: (action, payload) => system.action(action, payload),
  };
  lobby = mountPeripheralLobby({ bridge, system, parent: host.document.getElementById('gameShell') });
  globalThis.__WECHAT_PARITY_PREVIEW__ = { host, lobby, system };
  for (const [event, name] of [['pointerdown', 'down'], ['pointermove', 'move'], ['pointerup', 'up'], ['pointercancel', 'cancel']]) {
    canvas.addEventListener(event, e => { if (event === 'pointerdown') canvas.setPointerCapture(e.pointerId); const r = canvas.getBoundingClientRect(); callbacks[name]?.({ changedTouches: [{ identifier: e.pointerId, clientX: (e.clientX - r.left) / r.width * 393, clientY: (e.clientY - r.top) / r.height * 852 }] }); });
  }
  let previous = performance.now();
  const update = time => {
    try { lobby.update((time - previous) / 1000); previous = time; painter.render();
      const details = ['.battle-psd-main','.psd-main-portrait','.character-portrait-fallback','.wc-bottom-nav','.lobby-onboarding-bubble'].map(selector => {
        const element = host.document.querySelector(selector); if (!element) return selector + ': absent';
        const record = host.layout.record(element); if (!record) return selector + ': hidden';
        return selector + ' ' + JSON.stringify({ box: host.layout.rawRect(element), css: Object.fromEntries(['left','top','width','height','transform','font-size','color'].map(key => [key,record.style[key]])) });
      });
      log.textContent = `当前 H5 界面 · 原生画布适配检查\n${lobby.tab} · ${host.layout.rows.length} 个布局节点\n` + details.join('\n'); }
    catch (error) { log.textContent = error.stack; return; }
    raf(update);
  };
  raf(update);
}
