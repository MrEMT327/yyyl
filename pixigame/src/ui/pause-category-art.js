import { TextureLoader, SRGBColorSpace, LinearFilter } from 'three';
import { cloudAssetBase } from './cloud-asset-base.js';

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
  if (!textures.has(kind)) {
    const texture = new TextureLoader().load(url);
    texture.colorSpace = SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    textures.set(kind, texture);
  }
  const mesh = surface.image(textures.get(kind), x, y, size, size);
  mesh.material.toneMapped = false;
  return mesh;
}
