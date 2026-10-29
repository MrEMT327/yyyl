import { createThreeSurface } from './three-surface.js';

// Reuses the preloaded character texture and the game's existing renderer.
// This visual has no hit regions and never owns flight input.
export function createPilotSkillCutIn(bridge) {
  const surface = createThreeSurface(), { group } = surface;
  group.name = 'pilot-skill-cutin-native-three';
  group.visible = false;
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let startedAt = 0, pilotId = null;
  const now = () => globalThis.performance?.now?.() ?? Date.now();
  function clear() {
    group.visible = false; pilotId = null; surface.clear();
  }
  function show(pilot, skillName = pilot.skillName) {
    clear();
    if (bridge.game.state !== 'playing') return;
    const texture = bridge.resolvePilotTexture(pilot.id)?.source?._texture;
    if (!texture?.image) return;
    pilotId = pilot.id; startedAt = now();
    surface.polygon([[0, 376], [570, 416], [542, 567], [0, 548]], '#0c1b30', .91);
    surface.polygon([[0, 372], [570, 412], [566, 416], [0, 376]], pilot.color, .9);
    surface.image(texture, -12, 194, 330, 495);
    surface.text(pilot.rarity, 312, 430, { size: 18, weight: 900, color: pilot.accent });
    surface.text(pilot.name, 310, 461, { size: 25, weight: 800, maxWidth: 245 });
    surface.text(skillName, 310, 505, { size: 32, weight: 900, color: pilot.accent, maxWidth: 252 });
    surface.line([[311, 533], [529, 548]], pilot.color, .7, 2);
    group.traverse(node => { if (node.material) node.material.userData.cutInOpacity = node.material.opacity; });
    update();
  }
  function update() {
    if (!pilotId) return;
    if (bridge.game.state !== 'playing') { clear(); return; }
    const age = now() - startedAt;
    if (age >= 1000) { clear(); return; }
    const enter = Math.min(1, age / 140), leave = Math.max(0, (age - 760) / 240);
    const opacity = Math.min(enter, 1 - leave);
    group.visible = true;
    group.position.x = reducedMotion ? 0 : -90 * (1 - enter) ** 3 + 40 * leave ** 2;
    group.traverse(node => {
      if (node.material) node.material.opacity = node.material.userData.baseOpacity = node.material.userData.cutInOpacity * opacity;
    });
  }
  return { group, show, update, clear, destroy: clear,
    get state() { return { visible: group.visible, pilotId }; },
  };
}
