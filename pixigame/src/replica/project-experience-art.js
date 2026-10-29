import { cloudAssetBase } from '../ui/cloud-asset-base.js';

export function projectExperienceContent(content) {
  const sprites = {...content.assets.sprites};
  for (const [key, sprite] of Object.entries(sprites)) {
    if (/^exp_\d+$/.test(key)) sprites[key] = {...sprite, url:`${cloudAssetBase}art/project-supplement-icons-v1/${key}.png`};
  }
  // Display-only URLs: keep the source bar geometry, timing and enemy rules.
  if(sprites.UrgencyTip)sprites.UrgencyTip={...sprites.UrgencyTip,url:    `${cloudAssetBase}art/project-enemy-markers-v1/warning.svg`};
  const health=content.assets.enemyHealthBars;
  const healthSprites={...health?.sprites};
  for(const [key,sprite] of Object.entries(healthSprites))if(key==='original_hp_progress_icon_EliteMonster')
    healthSprites[key]={...sprite,url:`${cloudAssetBase}art/project-enemy-markers-v1/elite.png`};
  return {...content, assets:{...content.assets, sprites,
    ...(health?{enemyHealthBars:{...health,sprites:healthSprites}}:{})}};
}
