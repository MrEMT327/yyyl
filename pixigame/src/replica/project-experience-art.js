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
  // Independently authored vectors exported to PNG; native geometry/tweens stay intact.
  const healthArt={
    original_hp_progress_bg_black3:'normal-track',
    original_hp_progress_fg_white:'normal-fill',
    original_hp_progress_EliteMonster_di:'elite-track',
    original_hp_progress_EliteMonster_white:'elite-fill',
  };
  for(const [key,name] of Object.entries(healthArt))if(healthSprites[key])
    healthSprites[key]={...healthSprites[key],url:`${cloudAssetBase}art/project-enemy-health-v1/${name}.png`};
  for(const [key,sprite] of Object.entries(healthSprites))if(key==='original_hp_progress_icon_EliteMonster')
    healthSprites[key]={...sprite,url:`${cloudAssetBase}art/project-enemy-markers-v1/elite.png`};
  return {...content, assets:{...content.assets, sprites,
    ...(health?{enemyHealthBars:{...health,sprites:healthSprites}}:{})}};
}
