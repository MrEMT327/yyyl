import { cloudAssetBase } from './cloud-asset-base.js';
import { projectIconUrl } from './project-ui-art.js';
import { createSkillIconSprites } from './battle-skill-art.js';
import { projectItemIcon } from './project-item-icons.js';

const own = name => `${cloudAssetBase}art/project-supplement-icons-v1/${name}.png`;
const psd = name => `${cloudAssetBase}art/psd-combat-v1/${name}.png`;
const symbols = Object.freeze({
  tracking:'skill-explosive', up:'upgrade-arrow', physics:'skill-ballistic',
  thunder:'skill-lightning', laser:'skill-laser', penetrating:'skill-rail',
  arrow:'chevron-right', ballistic:'skill-ballistic', energy:'skill-beam',
  xian:'skill-beam', distance:'skill-rail', down:'chevron-right',
  di:'skill-tab', poison:'skill-toxin', ice:'skill-freeze', fire:'skill-beam',
  monsterdi:'skill-tab',
});

export function projectBattleInterfaceIcon(key) {
  const rank = /^Choose_skills_([SML])\d?_normal_(yellow|red|multicolor|grey|white)$/.exec(key);
  if (rank) return own(`rank-${rank[1]}-${rank[2]}`);
  const ability = key.replace(/^ui_stg_ability_/, '');
  if (symbols[ability]) return projectIconUrl(symbols[ability]);
  const icons = {
    Pause:psd('pause'), Pause_1:psd('pause'),
    ui_coin:projectIconUrl('credits-token'), ui_kill:own('target'),
    Currency_HeroExp:projectItemIcon(3),
    stg_pause_activeSkillIcon:projectIconUrl('skill-tab'),
    stg_pause_passiveSkillIcon:projectIconUrl('upgrade-arrow'),
    stg_pause_hurt:psd('stats'), stg_pause_hurt_down:psd('stats'),
    stg_pause_setting:own('settings'), stg_pause_main:own('home'), stg_pause_main_down:own('home'),
    stg_pause_soundOpen:own('sound'), stg_pause_soundClose:own('muted'),
    stg_pause_resume:`${cloudAssetBase}art/psd-equipment-v1/button-gold.png`,
    stg_pause_resume_1:`${cloudAssetBase}art/psd-equipment-v1/button-gold.png`,
    damage_close:projectIconUrl('close'), stg_Pos:projectIconUrl('upgrade-arrow'),
  };
  if (/^bossProgress_icon/.test(key)) return own('boss');
  return icons[key] || null;
}

export function createProjectInterfaceSprites(sprites) {
  const presentation = createSkillIconSprites(sprites);
  for (const [key, sprite] of Object.entries(sprites)) {
    const url = projectBattleInterfaceIcon(key);
    if (url) presentation[key] = {...sprite, url};
  }
  return presentation;
}
