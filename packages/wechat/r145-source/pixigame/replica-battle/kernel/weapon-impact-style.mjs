import {impactWeaponSource} from './impact-direction.mjs';

const families=new Map([
 [200031,'ice'],[200141,'ice'],[200061,'acid'],[200091,'acid'],
 [200001,'electric'],[200011,'electric'],[200101,'energy'],[200121,'energy'],[200171,'heat'],
]);
// Actual collision ownership disambiguates shared hit-prefab IDs. In
// particular, the sword's 210062 is not automatically another lightning hit.
export function weaponImpactStyle(effect){
 if(effect.kind!=='hit')return undefined;
 const source=impactWeaponSource(effect);
 if(!source)return undefined;
 return families.get(source.familyId);
}
