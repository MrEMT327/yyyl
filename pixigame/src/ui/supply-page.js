import * as T from 'three';
import { AIRCRAFTS } from '../pilots.js';
import { GACHA_ITEM_MAP, GACHA_POOLS } from '../gacha-config.js';
import { createThreeSurface, createSurfaceInput } from './three-surface.js';
import { renderSupplyLayout, poolItems, SUPPLY_WEAPONS } from './supply-layout.js';
import { acquireCommonWeaponThumbnails } from './common-weapon-thumbnails.js';

export function createSupplyPage({ bridge, actions: lobbyActions }) {
  const surface = createThreeSurface(), { group } = surface; group.name = 'supply-native-three';
  const input = createSurfaceInput(surface.controls), art = new Map(), ownedTextures = new Set(), loader = new T.TextureLoader();
  const state = { previewId: bridge.getActivePilot().id, weaponId: SUPPLY_WEAPONS[0].id, modal: null, catalogPage: 0, receipts: [], detailId: null, detailReceipt: null, detailReturn: null };
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let active = false, disposed = false, animationFrame = 0, lastTime = 0, revealElapsed = 0, reveal = null, drawing = false;
  const weaponArt=acquireCommonWeaponThumbnails(bridge.app.renderer,()=>refresh());
  const actions = {
    ...lobbyActions,
    pool(id) { if (state.modal || id !== 'aircraft_permanent') return; bridge.selectGachaPool(id); state.catalogPage = 0; lobbyActions.changed(); },
    preview(id) {
      const item = GACHA_ITEM_MAP.get(id); if (!item || state.modal) return;
      if (item.type === 'aircraft') state.previewId = item.refId; else state.weaponId = item.id;
      refresh();
    },
    modal(value) { if (state.receipts.length) return; state.modal = value; if (value === 'catalog') state.catalogPage = 0; refresh(); },
    catalogStep(step) { state.catalogPage = Math.max(0, Math.min(Math.ceil(poolItems(bridge.selectedGachaPoolId).length / 8) - 1, state.catalogPage + step)); refresh(); },
    detail(id) { if (!GACHA_ITEM_MAP.has(id)) return; state.detailReturn = state.modal; state.detailReceipt = null; state.detailId = id; state.modal = 'detail'; refresh(); },
    receiptDetail(index) {
      const receipt = state.receipts[index]; if (!receipt) return;
      state.detailId = receipt.itemId; state.detailReceipt = receipt; state.detailReturn = 'results'; state.modal = 'detail'; refresh();
    },
    backDetail() { state.modal = state.detailReturn; state.detailId = null; state.detailReceipt = null; refresh(); },
    equip(id) { if (bridge.equipGachaWeapon(id)) lobbyActions.changed(); },
    draw(action) {
      if (drawing || state.modal || !['single', 'ten'].includes(action)) return;
      if (bridge.profileState.diamonds < (action === 'ten' ? 180 : 20)) return;
      drawing = true;
      try {
        // The existing bridge settles and saves rewards exactly once. Reveal
        // and confirmation only present those receipts, never draw again.
        bridge.selectGachaPool('aircraft_permanent');
        const receipts = bridge.claimSupply(action);
        if (!receipts?.length) return;
        state.receipts = receipts; revealElapsed = 0; state.modal = reducedMotion ? 'results' : 'reveal';
        lobbyActions.changed();
      } finally { drawing = false; }
    },
    revealDone() { if (state.modal !== 'reveal') return; state.modal = 'results'; refresh(); },
    closeResults() { if (state.modal !== 'results') return; state.receipts = []; state.modal = null; state.detailReceipt = null; lobbyActions.changed(); },
  };
  function loadArt(id, path) {
    loader.load(`${import.meta.env.BASE_URL}${path.replace(/^\.\//, '')}`, texture => {
      if (disposed) { texture.dispose(); return; }
      texture.colorSpace = T.SRGBColorSpace; art.set(id, texture); ownedTextures.add(texture); refresh();
    }, undefined, error => { if (!disposed) console.warn(`[supply-art:${id}] 素材未能加载`, error); });
  }
  function refresh() {
    if (disposed) return;
    if(bridge.selectedGachaPoolId!=='aircraft_permanent')bridge.selectGachaPool('aircraft_permanent');
    input.cancel(); surface.clear();
    const progress=bridge.getGachaState().weaponProgress;
    for(const item of SUPPLY_WEAPONS)art.set(item.refId,weaponArt.textures.get(item.refId+'/'+(progress?.weapons?.[item.refId]?.qualityRank||0)));
    art.set('pilot', art.get(`${bridge.getActivePilot().id}:avatar`) || art.get(bridge.getActivePilot().id));
    reveal = renderSupplyLayout({ surface, bridge, art, state, actions });
  }
  function update(ticker) {
    if (!active || state.modal !== 'reveal') return;
    revealElapsed += Math.max(0, Math.min(.05, (ticker?.deltaMS || 16.67) / 1000));
    const t = revealElapsed / 1.45;
    if (t >= 1) { actions.revealDone(); return; }
    if (reveal?.pod) { reveal.pod.position.y = 584 - Math.sin(t * Math.PI) * 40; reveal.pod.rotation.z = Math.sin(t * 18) * .012 * t; }
    reveal?.rings.forEach((ring, i) => { const s = 1 + Math.sin(t * Math.PI + i) * .09; ring.scale.setScalar(s); });
    if (reveal?.flash) reveal.flash.material.opacity = reveal.flash.material.userData.baseOpacity = t > .8 ? (t - .8) * 3 : 0;
  }
  function schedule() {
    if (animationFrame || disposed || !active || document.hidden) return;
    animationFrame = requestAnimationFrame(now => {
      animationFrame = 0; if (disposed || !active || document.hidden) return;
      if (!bridge.app.ticker.started) { lobbyActions.update({ deltaMS: lastTime ? now - lastTime : 16.67 }); bridge.app.renderer.render({ container: bridge.app.stage }); }
      lastTime = now; schedule();
    });
  }
  function onVisibility() {
    lastTime = 0;
    if (document.hidden) { cancelAnimationFrame(animationFrame); animationFrame = 0; input.cancel(); } else schedule();
  }
  document.addEventListener('visibilitychange', onVisibility);
  loadArt('background', 'assets/ui/sortie/hangar-opening-v1.webp');
  loadArt('icons', 'assets/ui/sortie/nav-icons-v2.webp');
  loadArt('equipment', 'assets/ui/supply/equipment-v1.webp');
  AIRCRAFTS.forEach(pilot => {
    const portrait = bridge.resolvePilotTexture(pilot.id)?.source?._texture;
    const avatar = bridge.resolvePilotAvatarTexture?.(pilot.id)?.source?._texture;
    if (portrait?.image) art.set(pilot.id, portrait); else loadArt(pilot.id, pilot.image);
    if (avatar?.image) art.set(`${pilot.id}:avatar`, avatar); else loadArt(`${pilot.id}:avatar`, pilot.avatar || pilot.image);
  }); refresh();
  return {
    group, refresh, update,
    get state() { return { ...state, poolId: bridge.selectedGachaPoolId, pool: bridge.getGachaState().pools[bridge.selectedGachaPoolId], artReady: art.has('equipment') && art.has('icons') && weaponArt.ready, weaponArtReady:weaponArt.ready, weaponArtCount:weaponArt.textures.size, loadedPortraits: AIRCRAFTS.filter(p => art.has(p.id)).length }; },
    get controls() { return surface.controls.map(({ id, label, x, y, width, height, disabled }) => ({ id, label, x, y, width, height, disabled })); },
    handlePointer(event) { return active ? input.handle(event) : false; },
    activateAt(x, y) { const control = active && input.hit(x, y); if (!control) return false; control.onPress(); return true; },
    setVisible(value, interactive = value) {
      if (value && !group.visible) refresh();
      group.visible = value;
      if (active && !interactive) input.cancel(); active = interactive;
      if (active) schedule(); else { cancelAnimationFrame(animationFrame); animationFrame = 0; lastTime = 0; }
    },
    destroy() {
      disposed = true; cancelAnimationFrame(animationFrame); document.removeEventListener('visibilitychange', onVisibility);
      input.cancel(); surface.destroy();weaponArt.release(); ownedTextures.forEach(texture => texture.dispose()); ownedTextures.clear(); art.clear();
    },
  };
}
