import { cloudAssetBase } from './cloud-asset-base.js';
import { TextureLoader, SRGBColorSpace, LinearFilter } from 'three';

const frames = {
  primary: { width: 567, height: 714, slices: [110, 44, 55, 255] },
  secondary: { width: 487, height: 351, slices: [48, 38, 38, 220] },
};
const textures = new Map();
function texture(name) {
  if (!textures.has(name)) {
    const value = new TextureLoader().load(`${cloudAssetBase}art/psd-popup-v1/${name}.png`);
    value.colorSpace = SRGBColorSpace; value.generateMipmaps = false; value.minFilter = LinearFilter;
    textures.set(name, value);
  }
  return textures.get(name);
}
// Shared with CSS border-image: retain native corner proportions; stretch only
// the middle spans. Cached textures outlive individual dialog surface meshes.
export function paintPsdPopup(surface, kind, x, y, width, height) {
  const frame = frames[kind] || frames.primary;
  const [top, right, bottom, left] = frame.slices;
  const scale = Math.min(width / frame.width, height / (top + bottom));
  const widths = [left * scale, width - (left + right) * scale, right * scale];
  const heights = [top * scale, height - (top + bottom) * scale, bottom * scale];
  let dy = y;
  for (let row = 0; row < 3; row++) {
    let dx = x;
    for (let col = 0; col < 3; col++) {
      surface.image(texture(`${kind}-${row}-${col}`), dx, dy, widths[col], heights[row]);
      dx += widths[col];
    }
    dy += heights[row];
  }
}
