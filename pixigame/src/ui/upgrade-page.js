import * as T from 'three';
import { createThreeSurface } from './three-surface.js';
import { createFighterInput } from './fighter-input.js';
import { createSortieFighter } from './sortie-fighter.js';
import { renderUpgradeLayout, upgradeCards } from './upgrade-layout.js';

export function createUpgradePage({ bridge, actions: lobbyActions }) {
  const surface = createThreeSurface(), { group } = surface; group.name = 'upgrade-native-three';
  const art = new Map(), requests = new Map(), ownedTextures = new Set();
  const loader = new T.TextureLoader(), state = { feedback: '' };
  const fighter = createSortieFighter({ renderer: bridge.app.renderer, pilotId: bridge.getActivePilot().id, appearance: bridge.getAssemblyAppearance() });
  const input = createFighterInput(surface.controls, fighter);
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let active = false, disposed = false, animationFrame = 0, lastTime = 0;
  const actions = {
    ...lobbyActions,
    upgrade(type) {
      const card = upgradeCards(bridge).find(card => card.id === type);
      if (!card?.affordable) return;
      const beforePower = bridge.profilePower();
      bridge.upgradeProfile(type);
      const level = bridge.profileState[`${type}Level`];
      if (level > card.level) {
        const gain = Math.round(bridge.profilePower() - beforePower);
        state.feedback = `${card.title}  Lv.${level}${gain > 0 ? `  ·  战力 +${gain}` : '  ·  强化完成'}`;
      }
      lobbyActions.changed();
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
    }, undefined, error => { if (!disposed) console.warn(`[upgrade-art:${id}] 素材未能加载`, error); });
  }
  function refresh() {
    if (disposed) return;
    const pilot = bridge.getActivePilot();
    const avatar = bridge.resolvePilotAvatarTexture?.(pilot.id)?.source?._texture;
    if (avatar?.image) art.set('pilot', avatar); else loadArt('pilot', pilot.avatar || pilot.image);
    fighter.setPilot(pilot.id, bridge.getAssemblyAppearance());
    input.cancel(); surface.clear();
    renderUpgradeLayout({ surface, bridge, art, fighter, state, actions });
  }
  function update(ticker) { if (active) fighter.update((ticker?.deltaMS || 16.67) / 1000, reducedMotion); }
  function schedule() {
    if (animationFrame || disposed || !active || document.hidden) return;
    animationFrame = requestAnimationFrame(now => {
      animationFrame = 0; if (disposed || !active || document.hidden) return;
      if (!bridge.app.ticker.started) {
        lobbyActions.update({ deltaMS: lastTime ? now - lastTime : 16.67 });
        bridge.app.renderer.render({ container: bridge.app.stage });
      }
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
  loadArt('materials', 'assets/ui/upgrade/materials-v1.webp'); refresh();
  return {
    group, refresh, update,
    get state() { return { ...state, camera: fighter.state, fixedParts: fighter.fixedParts, pilotId: bridge.getActivePilot().id, power: bridge.profilePower(), artReady: art.has('materials'),
      cards: upgradeCards(bridge).map(({ id, level, maxed, cost, affordable, stats }) => ({ id, level, maxed, cost, affordable, stats })) }; },
    get controls() { return surface.controls.map(({ id, label, x, y, width, height, disabled }) => ({ id, label, x, y, width, height, disabled })); },
    handlePointer(event) { return active ? input.handle(event) : false; },
    activateAt(x, y) { const control = active && input.hit(x, y); if (!control) return false; control.onPress(); return true; },
    setVisible(value, interactive = value) {
      if (value && !group.visible) { state.feedback = ''; refresh(); }
      group.visible = value; fighter.setVisible(value && interactive);
      if (active && !interactive) input.cancel();
      active = interactive;
      if (active) schedule(); else { cancelAnimationFrame(animationFrame); animationFrame = 0; lastTime = 0; }
    },
    destroy() {
      disposed = true; cancelAnimationFrame(animationFrame); document.removeEventListener('visibilitychange', onVisibility);
      input.cancel(); fighter.destroy(); surface.destroy(); ownedTextures.forEach(texture => texture.dispose()); ownedTextures.clear(); art.clear();
    },
  };
}
