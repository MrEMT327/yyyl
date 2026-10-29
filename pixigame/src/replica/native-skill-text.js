import { nativeSkillDescription } from './native-skill-description.js';

const researchNames = Object.freeze({
  10201503: '暴击过载',
  10201703: '暴击点燃',
  10201704: '折射强化',
  10201705: '熔点聚焦强化',
  10201707: '过载增伤',
  10200706: '偏转暴击',
  10200703: '飞行距离增伤',
  10200708: '燃烧刷新与爆炸增伤',
  10200303: '暴击触发电流',
  10200306: '连线伤害强化',
  10200305: '无弹射增伤',
  10200307: '腐蚀触发酸液爆炸',
  10200906: '次级黑洞与粒子首领增伤',
  10200903: '吸收黑洞体型强化',
  10200907: '燃烧目标增伤',
});

export function nativeDisplayText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return !text || /\b(?:SkillName|SkillDesc|ItemName|ItemDesc)_[\w]+\b|\uFFFD|锟斤拷/.test(text) ? fallback : text;
}

export function nativeSkillText(skill) {
  return {
    ...skill,
    name: nativeDisplayText(skill.name, researchNames[skill.id] || '技能效果'),
    description: nativeDisplayText(nativeSkillDescription(skill), '暂无技能说明'),
  };
}
