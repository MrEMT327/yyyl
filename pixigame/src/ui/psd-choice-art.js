import { cloudAssetBase } from './cloud-asset-base.js';
import { TextureLoader, SRGBColorSpace, LinearFilter } from 'three';

const assets = new Map();
export function paintPsdChoiceArt(surface, name, x, y, width, height) {
  if (!assets.has(name)) {
    const texture = new TextureLoader().load(`${cloudAssetBase}art/psd-choice-v1/${name}.png`);
    texture.colorSpace = SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    assets.set(name, texture);
  }
  return surface.image(assets.get(name), x, y, width, height);
}
