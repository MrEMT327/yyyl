import { LOCAL_ECONOMY_POLICY } from '../replica/local-economy-policy.js';
import './equipment-box-rules.css';

export function equipmentBoxRules(box,h) {
  const advanced=box.id===3;
  const hours=box.compatibility?.freeHours??LOCAL_ECONOMY_POLICY.boxFreeHours[box.id];
  const lines=[`免费开启：每${hours}小时1次，不叠加。`,
    `每${LOCAL_ECONOMY_POLICY.boxQualityPity[box.id]}件装备至少1件${advanced?'史诗':'优秀'}。`];
  if(advanced)lines.push(`每${LOCAL_ECONOMY_POLICY.advancedSPity}件装备至少1件圣环。`,
    `变体只从已激活基础武器的对应变体中抽取，当前${box.variantCount??0}种；十连逐次更新候选。`);
  else lines.push('每开启20次可领高级装备箱券 ×1。','普通箱只含基础武器，不含武器变体。');
  lines.push(`基础武器共${box.baseWeaponCount??11}种，同组等概率获得；首次解锁，重复获得同名卡用于升星。`,
    `飞机共${box.aircraftCount??(advanced?8:2)}架，等概率获得；首次解锁，重复获得同名卡用于升星。`,
    '武器与飞机不累计或消耗装备保底。');
  return `<div class="equipment-box-rules">${lines.map(line=>`<p>${h.escape(line)}</p>`).join('')}</div>`;
}
