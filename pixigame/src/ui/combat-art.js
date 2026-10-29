import { cloudAssetBase } from './cloud-asset-base.js';
import { TextureLoader, SRGBColorSpace, LinearFilter } from 'three';
import { nineSliceGeometry } from './nine-slice-geometry.js';

// Combat uses the same original metal controls as the current project UI.
export const COMBAT_ART_PATHS = Object.freeze({
  primary: 'psd-equipment-v1/button-gold.png',
  secondary: 'psd-buttons-v1/button-gray.png',
  pressed: 'psd-buttons-v1/button-gray.png',
  disabled: 'psd-buttons-v1/button-gray.png',
  card: 'weapon-catalog-psd-v1/plate-blue-clean.png',
  slot: 'psd-equipment-v1/frame-empty.png',
});
const textures = new Map();
const frames={primary:[198,67,18],secondary:[182,92,32],card:[224,562,24],slot:[128,128,18]};
function texture(kind) {
  if (!COMBAT_ART_PATHS[kind]) throw new Error(`Unknown combat art: ${kind}`);
  if (!textures.has(kind)) {
    const value = new TextureLoader().load(`${cloudAssetBase}art/${COMBAT_ART_PATHS[kind]}`);
    value.colorSpace = SRGBColorSpace; value.generateMipmaps = false; value.minFilter = LinearFilter;
    textures.set(kind,value);
  }
  return textures.get(kind);
}
export function setCombatArt(mesh,kind) {
  const state=mesh.userData.psdCombatArt;
  if(!state)throw new Error('Combat art must be created with paintCombatArt');
  if(kind!=='pressed'&&kind!=='disabled')state.base=kind;
  const [sw,sh,slice]=frames[state.base];
  mesh.geometry.dispose();
  mesh.geometry=nineSliceGeometry(state.width,state.height,sw,sh,slice,state.corner);
  mesh.material.map=texture(state.base);
  mesh.material.color.setHex(kind==='disabled'?0x87939e:kind==='pressed'?0xc4e5f0:0xffffff);
  mesh.material.needsUpdate=true;
}
export function paintCombatArt(surface,kind,x,y,width,height) {
  const base=kind==='disabled'||kind==='pressed'?'secondary':kind;
  const mesh=surface.image(texture(base),x,y,width,height);
  mesh.userData.psdCombatArt={base,width,height,corner:Math.min(20,height/3,width/3)};
  setCombatArt(mesh,kind);
  return mesh;
}
