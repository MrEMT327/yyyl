import { COMMON_WEAPONS } from '../fixed-parts/common-weapons.js';
import { commonTuning } from '../fixed-parts/common-tunings.js';

const text = value => typeof value === 'string' ? value.trim() : '';
const EVOLUTION_NAMES = ['战术改装','核心增幅','终局解放'];

// Browsing data only. Collection quality never marks an in-run card as equipped.
export function weaponCatalogSkills(weapon) {
  if (!weapon) return [];
  const source = COMMON_WEAPONS[weapon.id || weapon.itemId];
  const mechanic = weapon.mechanic || weapon.mechanism || source?.mechanic;
  const description = text(weapon.description) || text(weapon.normal) || text(source?.normal);
  const rules = Array.isArray(weapon.qualityRules) ? weapon.qualityRules : source?.qualityRules || [];
  const skills = description ? [{key:'base',name:'基础攻击',description,kind:'base'}] : [];
  if (source && mechanic) {
    for (const key of ['power','cadence','coverage']) {
      const tuning = commonTuning(mechanic,key);
      skills.push({key,name:tuning.label,description:tuning.bonus,kind:'tuning',
        ...(key === 'power' ? {} : {note:`最多${key === 'cadence' ? 13 : 10}次，达到上限后改为基础伤害 +18%。`})});
    }
  }
  const effects = [rules.slice(1,4).map(text).filter(Boolean).join(' '),text(rules[4]),text(rules[5])];
  effects.forEach((effect,index) => {
    if (effect) {
      const summary = index === 0 && source?.id === 'aux_cannon'
        ? [text(rules[1]),text(rules[3])].filter(Boolean).join(' ')
        : effect.replace('，延长敌群中的接触时间。','。');
      skills.push({key:`evolve-${index+1}`,name:EVOLUTION_NAMES[index],description:effect,summary,kind:'evolution',stage:index+1});
    }
  });
  return skills;
}
