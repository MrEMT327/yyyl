export type WeaponCollection = {id:number;active:boolean;equipped?:boolean};
export type NativeWeaponLoadout = {playerLevel:number;useWeaponMap:{0:number;1:0};weaponSkillMap:Record<string,number[]>;weaponSkillMigration?:{version:1;legacySlots:number[]}};
export function nativeWeaponType(id:number):number;
export function normalizeNativeWeaponLoadout(value:object,guns:WeaponCollection[]):NativeWeaponLoadout;
export function battleWeaponSkillSources(value:object,guns:WeaponCollection[]):number[];
export function selectNativeWeapon(value:{guns:WeaponCollection[]},id:number,slot?:number):NativeWeaponLoadout['useWeaponMap'];
