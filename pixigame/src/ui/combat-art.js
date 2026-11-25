import { cloudAssetBase } from './cloud-asset-base.js';
import { SRGBColorSpace, LinearFilter, LinearMipmapLinearFilter, PlaneGeometry, Texture } from 'three';
import {loadArtwork} from '../three/game-screen/image-loading.js';
import { nineSliceGeometry } from './nine-slice-geometry.js';

// Combat uses the same original metal controls as the current project UI.
export const COMBAT_ART_PATHS = Object.freeze({
  primary: 'psd-equipment-v1/button-gold.png',
  secondary: 'psd-buttons-v1/button-blue.png',
  pressed: 'psd-buttons-v1/button-blue.png',
  disabled: 'psd-buttons-v1/button-blue.png',
  card: 'weapon-catalog-psd-v1/plate-blue-clean.png',
  slot: 'psd-equipment-v1/frame-empty.png',
  utility: 'psd-utility-controls-v1/backpack-frame.png',
  statsControl: 'psd-utility-controls-v1/backpack-frame.png',
  pauseSlot: 'psd-equipment-v1/frame-gray.png',
  audioOn: 'audio-switch-v2/track-on.png',
  audioOff: 'audio-switch-v2/track-off.png',
  audioThumb: 'audio-switch-v2/thumb.png',
});
const textures = new Map();
const frames={primary:[198,67,18],secondary:[219,85,18],card:[224,562,24],slot:[128,128,18],utility:[182,92,32],statsControl:[182,92,32],pauseSlot:[128,128,18],audioOn:[348,152,0],audioOff:[348,152,0],audioThumb:[120,120,0]};
const isAudioSwitch=kind=>['audioOn','audioOff','audioThumb'].includes(kind);
function readCombatArtwork(art, priority, onReady) {
  art.userData.artworkFailed = false;
  loadArtwork(art.userData.artworkUrl, priority).then(image => {
    art.image = image;
    art.needsUpdate = true;
    onReady?.(art);
  }, () => { art.userData.artworkFailed = true; });
}
export function loadCombatUiTexture(url, mipmaps = false, priority, onReady) {
  const art = new Texture();
  art.userData.artworkUrl = url;
  readCombatArtwork(art, priority,onReady);
  art.colorSpace = SRGBColorSpace;
  art.generateMipmaps = mipmaps;
  art.minFilter = mipmaps ? LinearMipmapLinearFilter : LinearFilter;
  art.magFilter = LinearFilter;
  return art;
}
export function retryCombatArtwork(art, priority, onReady) {
  if (!art?.userData.artworkFailed || !art.userData.artworkUrl) return false;
  readCombatArtwork(art, priority, onReady);
  return true;
}
function texture(kind, priority) {
  if (!COMBAT_ART_PATHS[kind]) throw new Error(`Unknown combat art: ${kind}`);
  if (!textures.has(kind)) {
    textures.set(kind,loadCombatUiTexture(`${cloudAssetBase}art/${COMBAT_ART_PATHS[kind]}`,isAudioSwitch(kind),priority));
  }
  return textures.get(kind);
}
export {texture as combatArtTexture};

export function combatArtworkSettled(art) {
  return art.image?.width > 0 || art.userData.artworkFailed === true;
}
export const combatArtworkReady = art => art?.image?.width > 0 && art.image.height > 0 && !art.userData.artworkFailed;

// Take one snapshot for the whole panel. A damaged or stalled asset can fall
// back with its group, while late responses never patch a visible panel.
export function createCombatArtworkBatch(textures, prepareTextures, timeout = 1500) {
  const required = new Set(textures);
  const ready = new Set(), retried = new Set();
  let startedAt, complete = false;
  return now => {
    if (complete) return ready;
    startedAt ??= now;
    const waiting = now - startedAt < timeout;
    let pending = false;
    for (const texture of required) {
      if (ready.has(texture)) continue;
      if (combatArtworkReady(texture)) ready.add(texture);
      else if (texture && waiting) {
        if (texture.userData.artworkFailed && !retried.has(texture)) {
          retried.add(texture);
          retryCombatArtwork(texture, 2);
        }
        if (!texture.userData.artworkFailed) pending = true;
      }
    }
    const uploaded = prepareTextures?.(ready) ?? true;
    if (pending || !uploaded) return null;
    complete = true;
    return ready;
  };
}

export function prepareCombatButtonArt(kind) {
  return combatArtworkSettled(texture(kind));
}
export function bindCombatButtonArt(button, skin, texture, { showWhileLoading = false } = {}) {
  const fallback = button.children[0];
  button.renderable = showWhileLoading;
  if (showWhileLoading) skin.renderable = false;
  // Resolve during the UI update before rendering. Controls with a pending
  // fallback keep their layout, entrance timing and touch target.
  button.prepareButtonArt = () => {
    if (!combatArtworkSettled(texture)) return false;
    const ready = texture.image?.width > 0;
    skin.renderable = ready;
    fallback.visible = !ready;
    button.renderable = true;
    button.prepareButtonArt = null;
    return true;
  };
}
export function setCombatArt(mesh,kind) {
  const state=mesh.userData.psdCombatArt;
  if(!state)throw new Error('Combat art must be created with paintCombatArt');
  if(kind!=='pressed'&&kind!=='disabled')state.base=kind;
  const [sw,sh,slice]=frames[state.base];
  mesh.geometry.dispose();
  // Switch sprites already match their fixed display ratio. A second slicing
  // pass introduces seams through the one-pixel rim and rounded thumb.
  mesh.geometry=isAudioSwitch(state.base)?new PlaneGeometry(1,1):nineSliceGeometry(state.width,state.height,sw,sh,slice,state.corner);
  mesh.material.map=texture(state.base);
  mesh.material.color.setHex(kind==='disabled'?0x87939e:kind==='pressed'?0xc4e5f0:state.base==='pauseSlot'?0x758e9f:0xffffff);
  mesh.material.needsUpdate=true;
}
export function paintCombatArt(surface,kind,x,y,width,height,{corner}={}) {
  const base=kind==='disabled'||kind==='pressed'?'secondary':kind;
  const mesh=surface.image(texture(base),x,y,width,height);
  mesh.userData.psdCombatArt={base,width,height,corner:corner??Math.min(20,height/3,width/3)};
  setCombatArt(mesh,kind);
  return mesh;
}
