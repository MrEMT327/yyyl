import {equipmentBoxRuleLines} from './equipment-box-rule-lines.js';
import './equipment-box-rules.css';

export function equipmentBoxRules(box,h) {
  const lines=equipmentBoxRuleLines(box);
  return `<div class="equipment-box-rules">${lines.map(line=>`<p>${h.escape(line)}</p>`).join('')}</div>`;
}
