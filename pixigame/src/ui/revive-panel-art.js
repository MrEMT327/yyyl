import {TextureLoader, SRGBColorSpace, LinearFilter} from 'three';
import {cloudAssetBase} from './cloud-asset-base.js';
import {projectIconUrl} from './project-ui-art.js';

// Original generated repair illustration; UI labels and actions stay live.
export const REVIVE_ART = Object.freeze({
  x:44,y:512,width:512,height:256,
  countdownX:439.7,countdownY:631.7,countdownRadius:69,
});
const symbols=new Map();
export function paintReviveSymbol(surface,name,x,y,size){
  if(!symbols.has(name)){
    const value=new TextureLoader().load(projectIconUrl(name));
    value.colorSpace=SRGBColorSpace;value.generateMipmaps=false;value.minFilter=LinearFilter;
    symbols.set(name,value);
  }
  return surface.image(symbols.get(name),x,y,size,size);
}
let texture;
export function preloadReviveArt() {
  if(!texture){
    texture=new TextureLoader().load(`${cloudAssetBase}art/revive-repair-v2/repair-diagram.png`);
    texture.colorSpace=SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=LinearFilter;
  }
  return texture;
}
export function paintReviveArt(surface) {
  const {x,y,width,height}=REVIVE_ART;
  return surface.image(preloadReviveArt(),x,y,width,height);
}
