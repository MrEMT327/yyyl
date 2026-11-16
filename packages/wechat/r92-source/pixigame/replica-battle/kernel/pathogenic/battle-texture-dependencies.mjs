import {battleScenePaths} from './pathogenic-routing.mjs';

// Keep every routed weapon, upgrade, enemy, status and warning, not just the
// opening loadout. Follow atlas frames, materials and child scenes transitively.
// Host textures/materials also serve procedural meshes outside scene playback.
export function battleTexturePaths(graph) {
  const textures = new Set(), visited = new Set(), externalResources = new Map();
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
    if (resource) visit(resource);
  }
  function visit(node) {
    if (typeof node === 'string') reference(node);
    else if (node && typeof node === 'object') for (const value of Object.values(node)) visit(value);
  }
  for (const path of battleScenePaths()) reference(path);
  for (const path of Object.keys(graph.textures || {})) if (!path.startsWith('res://')) reference(path);
  for (const path of Object.keys(graph.resources || {})) if (!path.startsWith('res://')) reference(path);
  return textures;
}
