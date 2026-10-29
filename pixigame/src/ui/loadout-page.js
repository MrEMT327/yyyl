import * as T from 'three';
import { AIRCRAFTS, AIRCRAFT_MAP } from '../pilots.js';
import { createThreeSurface } from './three-surface.js';
import { createFighterInput } from './fighter-input.js';
import { createSortieFighter } from './sortie-fighter.js';
import { renderLoadoutLayout } from './loadout-layout.js';

export function createLoadoutPage({ bridge, actions: lobbyActions }) {
  const surface = createThreeSurface(), { group } = surface; group.name = 'loadout-native-three';
  const art = new Map(), requests = new Map(), loader = new T.TextureLoader();
  const ownedTextures = new Set();
  const state = { previewId: bridge.getActivePilot().id, modal: null };
  const fighter = createSortieFighter({ renderer: bridge.app.renderer, pilotId: state.previewId, appearance: bridge.getAssemblyAppearance() });
  const input = createFighterInput(surface.controls, fighter);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let active = false, disposed = false, animationFrame = 0, lastTime = 0, swipe = null;
  const actions = {
    ...lobbyActions,
    preview(id) { if (!AIRCRAFT_MAP.has(id)) return; state.previewId = id; refresh(); },
    step(direction) { const index = AIRCRAFTS.findIndex(p => p.id === state.previewId); actions.preview(AIRCRAFTS[(index + direction + AIRCRAFTS.length) % AIRCRAFTS.length].id); },
    modal(value) { state.modal = value; refresh(); },
    deploy() {
      if (!bridge.getPilotState().owned.includes(state.previewId) || bridge.getActivePilot().id === state.previewId) return;
      if (bridge.selectPilot(state.previewId)) { refresh(); lobbyActions.changed(); }
    },
  };
  function loadArt(id, path) {
    if (requests.get(id)?.path === path) return;
    const request = { path }; requests.set(id, request);
    loader.load(`${import.meta.env.BASE_URL}${path.replace(/^\.\//, '')}`, texture => {
      if (disposed || requests.get(id) !== request) { texture.dispose(); return; }
      texture.colorSpace = T.SRGBColorSpace;
      if (ownedTextures.has(art.get(id))) { ownedTextures.delete(art.get(id)); art.get(id).dispose(); }
      ownedTextures.add(texture); art.set(id, texture); refresh();
    }, undefined, error => { if (!disposed) console.warn(`[loadout-art:${id}] 素材未能加载`, error); });
  }
  function refresh() {
    if (disposed) return;
    input.cancel(); swipe = null; surface.clear();
    const activePilotId = bridge.getActivePilot().id;
    art.set('pilot', art.get(`${activePilotId}:avatar`) || art.get(activePilotId));
    fighter.setPilot(state.previewId, bridge.getAssemblyAppearance());
    renderLoadoutLayout({ surface, bridge, art, fighter, state, actions });
  }
  function update(ticker) { if (active) fighter.update((ticker?.deltaMS || 16.67) / 1000, reducedMotion); }
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
    if (document.hidden) { cancelAnimationFrame(animationFrame); animationFrame = 0; input.cancel(); swipe = null; } else schedule();
  }
  document.addEventListener('visibilitychange', onVisibility);
  loadArt('background', 'assets/ui/sortie/hangar-opening-v1.webp'); loadArt('icons', 'assets/ui/sortie/nav-icons-v2.webp');
  AIRCRAFTS.forEach(pilot => {
    // Borrow the game's preloaded Three textures across the adapter boundary.
    // Ten full illustrations must not be uploaded again for this tab.
    const portrait = bridge.resolvePilotTexture(pilot.id)?.source?._texture;
    const avatar = bridge.resolvePilotAvatarTexture?.(pilot.id)?.source?._texture;
    if (portrait?.image) art.set(pilot.id, portrait); else loadArt(pilot.id, pilot.image);
    if (avatar?.image) art.set(`${pilot.id}:avatar`, avatar);
    else if (pilot.avatar) loadArt(`${pilot.id}:avatar`, pilot.avatar);
  }); refresh();
  return {
    group, refresh, update,
    get state() { return { ...state, camera: fighter.state, fixedParts: fighter.fixedParts, activePilotId: bridge.getActivePilot().id,
      loadedPortraits: AIRCRAFTS.filter(p => art.has(p.id)).length,
      loadedAvatars: AIRCRAFTS.filter(p => art.has(`${p.id}:avatar`)).length }; },
    get controls() { return surface.controls.map(({ id, label, x, y, width, height, disabled }) => ({ id, label, x, y, width, height, disabled })); },
    handlePointer(event) {
      if (!active) return false;
      if (event.phase === 'start' && !swipe && !state.modal && event.x > 75 && event.x < 525 && event.y > 245 && event.y < 493) swipe = { x: event.x, y: event.y, pointerId: event.pointerId };
      if (event.phase === 'end' && swipe?.pointerId === event.pointerId) {
        const dx = event.x - swipe.x, dy = event.y - swipe.y; swipe = null;
        if (Math.abs(dx) > 65 && Math.abs(dy) < 80) { input.cancel(); actions.step(dx < 0 ? 1 : -1); return true; }
      }
      if (event.phase === 'cancel') swipe = null;
      return input.handle(event);
    },
    activateAt(x, y) { const control = active && input.hit(x, y); if (!control) return false; control.onPress(); return true; },
    setVisible(value, interactive = value) {
      if (value && !group.visible) { state.previewId = bridge.getActivePilot().id; state.modal = null; refresh(); }
      group.visible = value; fighter.setVisible(value && interactive);
      if (active && !interactive) { input.cancel(); swipe = null; }
      active = interactive;
      if (active) schedule(); else { cancelAnimationFrame(animationFrame); animationFrame = 0; lastTime = 0; }
    },
    destroy() {
      disposed = true; cancelAnimationFrame(animationFrame); document.removeEventListener('visibilitychange', onVisibility);
      input.cancel(); fighter.destroy(); surface.destroy(); ownedTextures.forEach(texture => texture.dispose()); ownedTextures.clear(); art.clear();
    },
  };
}
