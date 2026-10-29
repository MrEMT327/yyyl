// Timing is authored for this game. The competitor evidence establishes state
// hierarchy, not a measured frame-for-frame timeline.
export const UI_MOTION = Object.freeze({press:85,release:160,page:260,dialog:260,exit:150,stagger:28,maxItems:12,maxEffects:24});
export const UI_EASE = 'cubic-bezier(.16,1,.3,1)';
export const QUALITY_LIGHT = ['#c9e5ef','#82e7aa','#76d9ff','#c7a1ff','#ffe18a','#ff9b90'];
const major = new Set(['gearMerge','gearBatch','gearSupply','synthesizeWeapon','synthesizeAll','fleetStarUp','fleetActivate']);
const minor = new Set(['gearEquip','gearUnequip','gearUpgrade','gearDowngrade','equipWeapon','unequipWeapon','upgradeWeapon','upgradeAircraft','fleetSkillEquip','fleetSkillRemove','selectPilot','selectAircraft']);
export function uiActionPlan(action,result,before,after,payload={}) {
  if(!result?.ok||(!major.has(action)&&!minor.has(action)))return null;
  const gear=action.startsWith('gear');
  const items=gear?after?.equipment?.items:action.startsWith('fleet')?payload.kind==='aircraft'?after?.aircraft:after?.pilots:action==='upgradeAircraft'?after?.aircraft:after?.weapons;
  const item=items?.find(i=>(i.uid||i.id)===payload.id);
  const rank=Math.max(0,Math.min(5,Number(item?.qualityRank??({R:0,SR:2,SSR:3,UR:4}[item?.rarity]))||0));
  return {action,gear,id:payload.id,kind:payload.kind,slot:payload.slot,major:major.has(action),rank,
    color:major.has(action)?QUALITY_LIGHT[rank]:'#9ceaff',
    powerGain:Math.max(0,Number(after?.power)-Number(before?.power)||0)};
}
