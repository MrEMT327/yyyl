import { LOCAL_ECONOMY_POLICY } from '../replica/local-economy-policy.js';
import './equipment-box-rules.css';

export function equipmentBoxRules(box,h) {
  const advanced=box.id===3;
  const hours=box.compatibility?.freeHours??LOCAL_ECONOMY_POLICY.boxFreeHours[box.id];
  const lines=[`免费开启：每${hours}小时1次，不叠加。`,
    `每${LOCAL_ECONOMY_POLICY.boxQualityPity[box.id]}件装备至少1件${advanced?'史诗':'优秀'}。`];
  if(advanced)lines.push(`每${LOCAL_ECONOMY_POLICY.advancedSPity}件装备至少1件S级史诗装备。`,'武器和驾驶员不计入装备保底。','随机武器概率10%，命中后11种基础武器等概率；首次解锁，重复用于升星。');
  else lines.push('每开启20次可领高级装备箱券 ×1。');
  return `<div class="equipment-box-rules">${lines.map(line=>`<p>${h.escape(line)}</p>`).join('')}</div>`;
}
