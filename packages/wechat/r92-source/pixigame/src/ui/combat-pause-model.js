import { fixedPartName } from '../fixed-parts/parts.js';
import { SKILL_MAP } from '../roguelite.js';

const tuning = {power:['伤害强化','power'],cadence:['射速强化','cadence'],coverage:['范围强化','coverage'],evolve:['武器进化','star']};
export function combatPauseModel(bridge) {
  const game=bridge.game, nodes=game.fixedGrowth?.state?.nodes||{};
  const nativeWeapons=bridge.presentation?.weapons;
  // Native itemId is a texture key (sometimes a URL), never a fixed-part ID.
  const weapons=Array.isArray(nativeWeapons)?nativeWeapons.map(w=>({...w,
    name:w.name||'武器',level:w.level||1,canFocus:false,
  })):game.fixedPartsMode ? (game.fixedLoadout?.weapons||[]).map(w=>({
    id:w.id,itemId:w.itemId,name:fixedPartName(w.itemId),level:1+(nodes[w.id]?.length||0),
    innate:!!w.innate,selected:game.fixedGrowth?.state?.focus===w.id,canFocus:typeof bridge.focusFixedWeapon==='function',
  })) : (game.activeWeapons||[]).map(w=>({id:w.id,itemId:w.itemId||w.id,name:w.name||fixedPartName(w.id),level:w.level||1}));
  const nativeUpgrades=bridge.presentation?.upgrades;
  // An empty native list is authoritative, not a reason to invent weapon nodes.
  const hasNativeUpgrades=Array.isArray(nativeUpgrades);
  const upgrades=hasNativeUpgrades?nativeUpgrades:[];
  if(!hasNativeUpgrades&&game.fixedPartsMode) {
    for(const weapon of weapons) {
      const groups=new Map();
      for(const id of nodes[weapon.id]||[]) {
        const key=id.includes('-evolve-')?'evolve':id.split('-').at(-1);
        const entry=groups.get(key)||{id:weapon.id+':'+key,itemId:weapon.itemId,owner:weapon.name,
          name:tuning[key]?.[0]||bridge.fixedNodeName?.(id)||id,symbol:tuning[key]?.[1]||'up',level:0};
        entry.level++;groups.set(key,entry);
      }
      upgrades.push(...groups.values());
    }
  } else if(!hasNativeUpgrades) for(const [id,level] of Object.entries(game.skills||{})) {
    if(level>0) upgrades.push({id,name:SKILL_MAP.get(id)?.name||id,symbol:'up',level});
  }
  const seconds=Math.max(0,Math.floor(game.elapsed||0));
  return {weapons,upgrades,damage:bridge.presentation?.damage,stats:[
    ['作战时间',String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0')],
    ['击破数量',String(Math.floor(game.kills||0))],['本局得分',String(Math.floor(game.score||0))],
    ['当前等级',String(game.fixedGrowth?.state?.level||game.level||1)],
    ['当前耐久',Math.ceil(Math.max(0,game.hp||0))+' / '+Math.ceil(bridge.runStats?.maxHp||100)],
    ['已选强化',String(upgrades.reduce((sum,item)=>sum+item.level,0))],
  ]};
}
