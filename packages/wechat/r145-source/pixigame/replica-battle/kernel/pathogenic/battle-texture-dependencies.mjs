import {battleScenePaths} from './pathogenic-routing.mjs';
import {MISSILE_ART_KEYS} from './missile-presentation.mjs';
import {ESCORT_SWORD_HILT} from './sword-escort-presentation.mjs';

const iceSlashAtlas = 'res://gfx/player/bullets/dual_blades_attack_white.png';
const chapterOneWeaponAtlases = new Map([
  [200031, [iceSlashAtlas]],
  [200041, MISSILE_ART_KEYS],
  [200101, ['res://gfx/player/bullets/dual_blades_attack.png', ESCORT_SWORD_HILT]],
  [200141, ['res://gfx/player/bullets/pizza_attack_animation.png']],
  [200171, ['res://gfx/player/bullets/bullet_flame.png']],
]);
export const chapterOneBossAtlases = ['res://gfx/enemies/stomp_wave.png', iceSlashAtlas];
export const chapterOneDeferredAtlases = [
  ...new Set([...chapterOneWeaponAtlases.values()].flat().concat(chapterOneBossAtlases)),
  'res://gfx/enemies/flail_enemy2.png',
  'res://gfx/player/bullets/circle_attack_animation2_adjusted.png',
];
export function chapterOneWeaponArt(entityId) {
  return chapterOneWeaponAtlases.get(entityId) ?? [];
}

// Keep every routed weapon, upgrade, enemy, status and warning, not just the
// opening loadout. Follow atlas frames, materials and child scenes transitively.
// Host textures/materials also serve procedural meshes outside scene playback.
export function battleSourceDependencies(graph) {
  const textures = new Set(), gradients = new Set(), materials = new Set();
  const visited = new Set(), externalResources = new Map();
  for (const resource of Object.values(graph.resources || {})) {
    if (resource.source && resource.source === resource.localId) externalResources.set(resource.source, resource);
  }
  function reference(key) {
    if (visited.has(key)) return;
    const texture = graph.textures?.[key];
    const resource = graph.scenes?.[key] || graph.resources?.[key] || externalResources.get(key);
    if (!texture && !resource) return;
    visited.add(key);
    if (texture) textures.add(key);
    if (resource) {
      if (resource.type==='ShaderMaterial'||resource.type==='CanvasItemMaterial') materials.add(resource);
      if (resource.type==='GradientTexture1D'||resource.type==='GradientTexture2D') gradients.add(resource.id??key);
      visit(resource);
    }
  }
  function visit(node) {
    if (typeof node === 'string') reference(node);
    else if (node && typeof node === 'object') for (const value of Object.values(node)) visit(value);
  }
  for (const path of battleScenePaths()) reference(path);
  for (const path of Object.keys(graph.textures || {})) if (!path.startsWith('res://')) reference(path);
  for (const path of Object.keys(graph.resources || {})) if (!path.startsWith('res://')) reference(path);
  return {textures,gradients,materials};
}

export const battleTexturePaths = graph => battleSourceDependencies(graph).textures;
