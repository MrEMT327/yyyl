import elements from './native-weapon-element-art.json' with {type:'json'};
import fleet from './native-fleet-skill-art.json' with {type:'json'};
import {cloudAssetBase} from '../ui/cloud-asset-base.js';

// Read the primary combat element, never infer it from illustration colors.
const byFile=new Map([...elements.assets.map(row=>[`${row.pack||elements.pack}/${row.file}`,row.element]),...fleet.assets.map(row=>[`${fleet.pack}/${row.file}`,row.element])]);
export const SKILL_BACKGROUND_ELEMENTS=Object.freeze([...new Set(byFile.values())]);
export function skillIconElement(url){
  const path=String(url||'').split(/[?#]/)[0];
  return byFile.get(path.split('/').slice(-2).join('/'))||null;
}
export function skillElementBackgroundArt(element){
  return SKILL_BACKGROUND_ELEMENTS.includes(element)?`${cloudAssetBase}art/skill-element-backgrounds-v1/${element}.webp`:null;
}
export const skillIconBackgroundArt=url=>skillElementBackgroundArt(skillIconElement(url));
