import { cloudAssetBase } from './cloud-asset-base.js';
import { loadCombatUiTexture } from './combat-art.js';

// Separate category artwork; never inferred from an equipped weapon or upgrade.
const paths = Object.freeze({
  weapons: 'project-battle-passives-v2/pause-weapons.webp',
  upgrades: 'pause-category-v3/enhancement-flat.png',
});
const textures = new Map();
export function pauseCategoryIconUrl(kind) {
  return paths[kind] ? `${cloudAssetBase}art/${paths[kind]}` : null;
}
export function paintPauseCategoryIcon(surface, kind, x, y, size) {
  const url = pauseCategoryIconUrl(kind);
  if (!url) throw new Error('Unknown pause category: ' + kind);
  if (!textures.has(kind) || textures.get(kind).userData.artworkFailed) {
    textures.get(kind)?.dispose();
    textures.set(kind, loadCombatUiTexture(url));
  }
  const mesh = surface.image(textures.get(kind), x, y, size, size);
  mesh.material.toneMapped = false;
  return mesh;
}
