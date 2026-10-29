import { cloudAssetBase } from './cloud-asset-base.js';

// Presentation identities only: inventory IDs, family IDs and legacy aliases
// are distinct. Second-series weapons must not alias first-series artwork.
export const WEAPON_THEME_IDS = Object.freeze(Array.from({length:11},(_,i)=>[20101+i*100,20102+i*100]).flat());
const ids=new Set(WEAPON_THEME_IDS);
export const weaponThemeArt=id=>ids.has(Number(id))?
  cloudAssetBase+'art/project-weapon-themes-v1/'+Number(id)+'.webp':null;
const families=Object.freeze({'10000101':20101,'10000701':20201,'10001501':20301,
  '10000201':20401,'10000601':20501,'10000401':20601,'10001701':20701,
  '10001101':20801,'10001601':20901,'10000301':21001,'10000901':21101});
export const weaponFamilyThemeArt=key=>weaponThemeArt(families[String(key)]);
const slots=Object.freeze([null,20201,20501,20401,20701,20901,21001,20301,20101,20601,21101,20801,
  20102,20202,20502,20702,20802,20902,20302,20402,20602,21002,21102]);
export const weaponCatalogThemeArt=slot=>weaponThemeArt(slots[Number(slot)]);
const legacy=Object.freeze({aux_cannon:20101,aux_rocket:20201,aux_laser:20301,aux_scatter:20601,aux_lightning:21001});
export const legacyWeaponThemeArt=id=>weaponThemeArt(legacy[id]);
