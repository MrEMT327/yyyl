import { TextureLoader, SRGBColorSpace, LinearFilter } from 'three';
import { cloudAssetBase } from './cloud-asset-base.js';

// Separate category artwork; never inferred from an equipped weapon or upgrade.
const names = Object.freeze({ weapons: 'pause-weapons', upgrades: 'pause-upgrades' });
const textures = new Map();
export function pauseCategoryIconUrl(kind) {
  return names[kind] ? `${cloudAssetBase}art/project-battle-passives-v2/${names[kind]}.webp` : null;
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
