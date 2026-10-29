import { MISSILE_BRIDGE_NODES } from '../fixed-parts/missile-bridge-nodes.js';
import { ENERGY_NODES } from '../fixed-parts/energy-nodes.js';
import { fixedPartIcon } from '../fixed-parts/parts.js';
// Base equipment is Lv.1. Temporary effects do not increase its level.
const strong = text => ({ text, strong: true });
const cost = text => ({ text, cost: true });
// Item ids can be shared by a hull's innate gun and a separately equipped gun.
// The role and physical seats identify the actual upgrade recipient.
export function fixedWeaponOwnerLabel(weapon) {
  return `${weapon.innate ? '本机专武' : '通用武器'} · ${(weapon.slots || []).join('/')}`;
}
const EFFECTS = {
  ...Object.fromEntries(ENERGY_NODES.map(([part,key,,lines])=>[`${part}-${key}`,lines])),
  ...Object.fromEntries(MISSILE_BRIDGE_NODES.map(([part,key,,lines])=>[`${part}-${key}`,lines])),
  'W01-S1': [['点射间隔 ', strong('1.30秒 → 1.14秒')]],
  'W01-S2': [['子弹速度 ', strong('+20%'), '，射程不变。']],
  'W01-A1': [['连中 ', strong('3轮'), '，下轮首弹', strong('穿透1个敌人'), '。'], ['穿透后的伤害保留 ', strong('65%'), '。']],
  'W01-A2': [['连中3轮后，下轮每发各', strong('穿透2个敌人'), '。'], ['留下穿孔，', strong('1.6秒'), '内再命中会追加伤害。']],
  'W01-B1': [['两根炮管', strong('交叉射击'), '，在前方汇合。']],
  'W01-B2': [['两颗子弹在 ', strong('0.18秒'), '内打中同一敌人，'], [strong('额外造成一次伤害'), '。']],
  'W01-T1': [['开火间隔 ', strong('−20%'), '，单发伤害 ', cost('−15%'), '。']],
  'W01-T2': [['子弹向两侧各散开 ', strong('5°'), '。'], ['穿透后伤害 ', cost('−30%'), '；不穿透或只打 Boss 时，首次伤害 ', cost('−10%'), '。']],
  'W01-T3': [['两管子弹在', strong('更近的位置汇合'), '。'], ['子弹命中范围 ', cost('−20%'), '。']],
  'W01-T4': [['每轮第一发伤害 ', cost('−30%'), '，'], ['最后一发伤害 ', strong('+40%'), '，中间弹不变。']],
  'C02-S': [['过载每秒减少 ',strong('100% → 50%'),'。']],
  'C02-A1': [['每次命中获得的过载 ',strong('10% → 30%'),'。']],
  'C02-A2': [['同一轮累计 ',strong('3次命中'),'，',strong('立即充满过载'),'。'],['每轮只触发一次。']],
  'C02-B1': [['命中后 ',strong('0.6秒'),'内，过载',strong('不再衰减'),'。']],
  'C02-B2': [['衰减速度再降低 ',strong('75%'),'。'],['叠加缓释供能后，每秒只减少 ',strong('12.5%'),'。']],
  'W02-S1': [['基础间隔 ',strong('2.50秒 → 2.20秒'),'。']],
  'W02-S2': [['炮弹宽度 ',strong('+20%'),'，更容易命中。']],
  'W02-A1': [['命中后留下 ',strong('3秒'),'穿孔。'],['同段下一轮命中，每门炮追加 ',strong('5点伤害'),'。']],
  'W02-A2': [['先',strong('穿过4个敌人'),'，再进入重弹碰撞。'],[strong('0.4秒'),'后沿发射方向补一击，造成 ',strong('35%弹伤'),'。']],
  'W02-C1': [['炮弹经过后留痕 ',strong('0.45秒'),'。'],['新穿过的敌人，每门炮造成 ',strong('6点伤害'),'。']],
  'W02-C2': [['保留最近 ',strong('2条'),'弹道，持续 ',strong('1.2秒'),'。'],['敌人首次进入受到 ',strong('35%弹伤'),'；替换原来的留痕。']],
  'W02-T1': [['立刻准备下一发，开火间隔 ',strong('−25%'),'。'],['每发伤害 ',cost('−20%'),'。']],
  'W02-T2': [['炮弹宽度 ',strong('+50%'),'。'],['对远处敌人的伤害 ',cost('−20%'),'。']],
  'W02-T3': [['首个敌人伤害 ',strong('+25%'),'。'],['后续敌人伤害 ',cost('−25%'),'。']],
  'W02-T4': [['碰撞后可继续飞行 ',strong('1次 → 2次'),'。'],['首敌伤害 ',cost('−20%'),'；命中 Boss 后追加一次弱击。']],
  'C03-S': [['追踪力度 ',strong('+25%'),'，子弹转弯更快。']],
  'C03-A1': [[strong('2轮'),'命中同一敌人，留下 ',strong('3秒'),'弱点。'],['下一轮命中追加 ',strong('10%弹伤'),'。']],
  'C03-A2': [['触发弱点后，追踪该敌人力度 ',strong('+40%'),'，持续 ',strong('0.8秒'),'。'],['每第 ',strong('3次'),'弱点，追加伤害 ',strong('10% → 25%'),'。']],
  'C03-B1': [['子弹距离目标超过屏高 ',strong('40%'),'时，'],['追踪力度 ',strong('+50%'),'。']],
  'C03-B2': [['远处首次命中，向前再打出一束',strong('短激光'),'，造成 ',strong('20%弹伤'),'。']],
};

export function fixedUpgradeView(skill, state) {
  if(skill.airframe) {
    const level=1+(state.nodes[skill.ownerId]?.length||0);
    return {lines:[[{text:skill.evolution,strong:true}],[{text:skill.bonus}]],tint:skill.color,ink:0x286899,
      level,nextLevel:level+1,levelText:`Lv.${level} → Lv.${level+1}`,badge:skill.terminal?'觉醒':'进化',
      restriction:skill.restriction,icon:skill.itemId,owner:skill.ownerName,skillName:skill.name};
  }
  const owned = state.nodes[skill.ownerId] || [];
  const level = 1 + owned.length;
  let lines = EFFECTS[`${skill.part}-${skill.key}`];
  if (!lines) throw Error(`缺少固定件卡片效果展示：${skill.id}`);
  if(skill.id==='FP-C04-S'&&skill.sourceItems)lines=lines.filter((_,i)=>skill.sourceItems.includes(i===0?'capacitor':'focus'));
  if(skill.id==='FP-W04-S1'&&state.tactics[skill.ownerId]?.id==='FP-W04-T4')lines=[['基础间隔 ',strong('1.275秒 → 1.088秒'),'。'],['临时效果结束后为 ',strong('1.45秒'),'。']];
  if(skill.id==='FP-W05-S1'){
    const tuning=state.tactics[skill.ownerId]?.id;
    if(tuning==='FP-W05-T3'||tuning==='FP-W05-T4'){
      const m=tuning==='FP-W05-T3'?.75:1.3;
      lines=[['基础间隔 ',strong(`${m.toFixed(3)}秒 → ${(Math.round(.85*m*1000)/1000).toFixed(3)}秒`),'。'],['临时效果结束后为 ',strong('0.85秒'),'。']];
    }
  }
  if(skill.id==='FP-W08-S1'){
    const tuning=state.tactics[skill.ownerId]?.id,m=tuning==='FP-W08-T2'?.8:tuning==='FP-W08-T4'?1.5:1;
    if(m!==1)lines=[['最低单发伤害 ',strong(`${Number((8*m).toFixed(2))} → ${Number((13*m).toFixed(2))}`),'，最高仍为 ',strong(`${Number((24*m).toFixed(2))}`),'。'],['临时效果结束后为 ',strong('13—24'),'。']];
  }
  if (skill.id === 'FP-W01-S1' && state.tactics[skill.ownerId]?.id === 'FP-W01-T1') {
    lines = [['点射间隔 ', strong('1.040秒 → 0.912秒'), '。'], ['临时效果结束后为 ', strong('1.14秒'), '。']];
  }
  if(skill.id==='FP-W02-S1'&&state.tactics[skill.ownerId]?.id==='FP-W02-T1'){
    lines=[['基础间隔 ',strong('1.875秒 → 1.650秒'),'。'],['临时效果结束后为 ',strong('2.20秒'),'。']];
  }
  const connector = skill.part.startsWith('C');
  const alternate=skill.part==='C04'?(skill.branch==='A'?'延迟回波':'接力标记'):skill.part==='C03'?(skill.branch==='A'?'远距聚焦':'定点校准'):(skill.branch==='A'?'余能保留':'快速回能');
  const restriction = skill.temporary ? '替换当前临时效果；有敌人时才计时'
    : skill.terminal ? '本装备只能选一个终局'
    : connector && skill.branch ? `与「${alternate}」二选一` : '';
  return { lines: lines.map(line => line.map(run => typeof run === 'string' ? { text: run } : run)),
    tint: connector ? 0x76dab0 : 0x93caff, ink: connector ? 0x24795e : 0x286899,
    level, nextLevel: level + !skill.temporary,
    levelText: skill.temporary ? `Lv.${level}` : `Lv.${level} → Lv.${level + 1}`,
    badge: skill.temporary ? '30秒' : skill.terminal ? '终局' : '',
    restriction, icon: fixedPartIcon(skill.part),
    owner: skill.ownerName, skillName: skill.name,
  };
}
