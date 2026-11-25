import { cloudAssetBase } from './cloud-asset-base.js';
import { combatArtworkSettled, loadCombatUiTexture } from './combat-art.js';

const frames = {
  primary: { width: 567, height: 714, slices: [110, 44, 55, 255] },
  secondary: { width: 487, height: 351, slices: [48, 38, 38, 220] },
};
const popupTextures = new Map();
const tileUrl = (kind,row,col) => `${cloudAssetBase}art/psd-popup-v1/${kind}-${row}-${col}.png`;
export function psdPopupArtTextures(kind, priority) {
  if (!popupTextures.has(kind)) {
    const tiles = [];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      tiles.push(loadCombatUiTexture(tileUrl(kind,row,col), false, priority));
    }
    popupTextures.set(kind, tiles);
  }
  return popupTextures.get(kind);
}
export function preparePsdPopupArt(kind, priority) {
  return psdPopupArtTextures(kind, priority).every(combatArtworkSettled);
}
export function paintPsdPopupFallback(surface,kind,x,y,width,height) {
  surface.panel(x,y,width,height,{fill:'#d6e4ec',stroke:'#547e9e',opacity:1,radius:8});
  if(kind==='primary')surface.quad(x,y,width,Math.min(78,height),'#243c55');
}
// Shared with CSS border-image: retain native corner proportions; stretch only
// the middle spans. Cached textures outlive individual dialog surface meshes.
export function paintPsdPopup(surface, kind, x, y, width, height, cornerScale, paintImage) {
  if (!frames[kind]) kind = 'primary';
  const textures = paintImage ? null : psdPopupArtTextures(kind);
  if (textures?.some(art => art.userData.artworkFailed)) {
    paintPsdPopupFallback(surface,kind,x,y,width,height);
    return;
  }
  const frame = frames[kind];
  const [top, right, bottom, left] = frame.slices;
  const scale = Math.min(cornerScale ?? width / frame.width, width / (left + right), height / (top + bottom));
  const widths = [left * scale, width - (left + right) * scale, right * scale];
  const heights = [top * scale, height - (top + bottom) * scale, bottom * scale];
  const tiles=[];
  let dy = y;
  for (let row = 0; row < 3; row++) {
    let dx = x;
    for (let col = 0; col < 3; col++) {
      if(paintImage)tiles.push(paintImage(surface,tileUrl(kind,row,col),dx,dy,widths[col],heights[row],false));
      else surface.image(textures[row * 3 + col], dx, dy, widths[col], heights[row]);
      dx += widths[col];
    }
    dy += heights[row];
  }
  if(tiles.some(tile=>!tile.visible)){
    for(const tile of tiles)tile.visible=false;
    paintPsdPopupFallback(surface,kind,x,y,width,height);
  }
}
