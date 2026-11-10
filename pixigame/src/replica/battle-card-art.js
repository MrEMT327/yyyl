import correspondence from '../../replica-battle/weapon-skin-correspondence.json' with {type:'json'};
import { battleSkillIconUrl } from '../ui/battle-skill-art.js';

export function battleCardIconUrl(card) {
  if(!card.id&&!card.icon&&!card.group)return null;
  const record = correspondence.branches[card.id] || correspondence.stages[card.id];
  const familyId = card.group || /^project-weapon\/(\d+)\//.exec(card.icon || '')?.[1];
  const family = correspondence.families[familyId];
  const icon=battleSkillIconUrl(record?.icon || family?.icon || card.icon);
  if(!icon)throw new Error(`缺少技能图标：${card.id||card.icon||card.group}`);
  return icon;
}
