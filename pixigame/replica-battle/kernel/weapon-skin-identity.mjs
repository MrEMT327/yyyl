// Cosmetic identity only. Selecting a skin never changes combat fields.
export const WEAPON_SKIN_FAMILIES=Object.freeze({
  20102:200151,20202:200041,20302:200121,20402:200061,20502:200031,
  20602:200011,20702:200171,20802:200101,20902:200141,21002:200001,21102:200091,
});
const EXTRA=new Map([[200121,new Set([400027])],[200061,new Set([400020,400021,400022])],
  [200031,new Set([400023])],[200011,new Set([350003,350004])],[200141,new Set([400026])],
  [200001,new Set([350001,350002])],[200091,new Set([400024,400025])]]);
const FAMILIES=new Set(Object.values(WEAPON_SKIN_FAMILIES));
const skinnable=(source,family)=>Boolean(FAMILIES.has(family)&&
  (source.weaponId>=200000&&source.weaponId<201000||EXTRA.get(family)?.has(source.weaponId)));
export function weaponSkinMatches(skinId,source,defaultFamily=0){
  return source?.owner==='player'&&Boolean(WEAPON_SKIN_FAMILIES[skinId])
    &&(source.familyId||defaultFamily)===WEAPON_SKIN_FAMILIES[skinId]
    &&skinnable(source,source.familyId||defaultFamily);
}
/** Record the emitting weapon, not a guessed shared effect/model identity. */
export function markWeaponSkinEffect(effect,source,defaultFamily=0){
  const family=source?.familyId||defaultFamily;
  if(source?.owner==='player'&&skinnable(source,family)){
    effect.weaponSkinFamily=family;effect.weaponSkinWeapon=source.weaponId;
  }
  return effect;
}
