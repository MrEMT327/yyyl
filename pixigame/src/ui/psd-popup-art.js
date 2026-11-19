import { cloudAssetBase } from './cloud-asset-base.js';
import { combatArtworkSettled, loadCombatUiTexture } from './combat-art.js';

const frames = {
  primary: { width: 567, height: 714, slices: [110, 44, 55, 255] },
  secondary: { width: 487, height: 351, slices: [48, 38, 38, 220] },
};
const popupTextures = new Map();
function texturesFor(kind) {
  if (!popupTextures.has(kind)) {
    const tiles = [];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      tiles.push(loadCombatUiTexture(`${cloudAssetBase}art/psd-popup-v1/${kind}-${row}-${col}.png`));
    }
    popupTextures.set(kind, tiles);
  }
  return popupTextures.get(kind);
}
export function preparePsdPopupArt(kind) {
  return texturesFor(kind).every(combatArtworkSettled);
}
// Shared with CSS border-image: retain native corner proportions; stretch only
// the middle spans. Cached textures outlive individual dialog surface meshes.
export function paintPsdPopup(surface, kind, x, y, width, height, cornerScale) {
  if (!frames[kind]) kind = 'primary';
  const textures = texturesFor(kind);
  if (textures.some(art => art.userData.artworkFailed)) {
    surface.panel(x, y, width, height, {fill:'#d6e4ec',stroke:'#547e9e',opacity:1,radius:8});
    if (kind === 'primary') surface.quad(x, y, width, Math.min(78, height), '#243c55');
    return;
  }
  const frame = frames[kind];
  const [top, right, bottom, left] = frame.slices;
  const scale = Math.min(cornerScale ?? width / frame.width, width / (left + right), height / (top + bottom));
  const widths = [left * scale, width - (left + right) * scale, right * scale];
  const heights = [top * scale, height - (top + bottom) * scale, bottom * scale];
  let dy = y;
  for (let row = 0; row < 3; row++) {
    let dx = x;
    for (let col = 0; col < 3; col++) {
      surface.image(textures[row * 3 + col], dx, dy, widths[col], heights[row]);
      dx += widths[col];
    }
    dy += heights[row];
  }
}
