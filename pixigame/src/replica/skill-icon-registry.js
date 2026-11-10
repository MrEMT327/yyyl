import artwork from './skill-icon-art.json' with {type:'json'};
import {cloudAssetBase} from '../ui/cloud-asset-base.js';

// Icon identity is independent of inventory/weapon appearance identity.
// All active skill surfaces share these files; no weapon-image fallback.
export const SKILL_ICON_ASSETS=Object.freeze(artwork.assets);
export const BATTLE_SKILL_ART_KEYS=Object.freeze(SKILL_ICON_ASSETS
  .filter(row=>row.category==='attack'||row.category==='passive').map(row=>row.key));
const icons=new Map(SKILL_ICON_ASSETS.map(row=>[row.key,
  `${cloudAssetBase}art/${row.pack||'battle-skill-icons-v4'}/${row.file}`]));

export const skillIconUrl=key=>icons.get(String(key))||null;
export function requireSkillIconUrl(key,context=''){
  const url=skillIconUrl(key);
  if(!url)throw new Error(`缺少技能图标：${key}${context?'（'+context+'）':''}`);
  return url;
}
