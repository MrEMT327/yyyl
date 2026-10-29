import correspondence from '../../replica-battle/weapon-skin-correspondence.json';
import { battleSkillIconUrl } from '../ui/battle-skill-art.js';

export function battleCardIconUrl(card) {
  const record = correspondence.branches[card.id] || correspondence.stages[card.id];
  const familyId = card.group || /^project-weapon\/(\d+)\//.exec(card.icon || '')?.[1];
  const family = correspondence.families[familyId];
  return battleSkillIconUrl(record?.icon || family?.icon || card.icon);
}
