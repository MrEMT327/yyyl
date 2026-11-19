import {pilotSkillSummary} from './pilot-skill-summary.js';
import {nativeWeaponDisplayText} from '../replica/native-weapon-display.js';
const plain=value=>nativeWeaponDisplayText(String(value||'').replace(/<[^>]*>/g,''));
export function compactStarSkillDescription(skill) {
  const text=plain(skill.description);
  switch(Number(skill.id)){
    case 3010201:return text==='受伤时，释放全屏伤害的辐射脉冲'?'受伤时释放全屏伤害脉冲':text;
    case 3010202:return text.replace(/^辐射脉冲的伤害提升/,'脉冲伤害+');
    case 3010203:return text==='辐射脉冲会自动拾取屏幕中的维修箱'?'脉冲自动拾取屏内维修箱':text;
    case 3010204:return text.replace(/^距离敌人越近伤害越高，最高提升至/,'越靠近敌人伤害越高，最高+');
    case 3010205:return text.replace(/^生命低于([\d.]+%)时，辐射脉冲会使敌人【腐蚀】$/,'生命<$1时，脉冲使敌人【腐蚀】');
    default:return pilotSkillSummary(skill,text);
  }
}

