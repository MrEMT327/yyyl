export type WeaponCollection = {id:number;active:boolean;equipped?:boolean};
export type NativeWeaponLoadout = {playerLevel:number;useWeaponMap:Record<string,number>;weaponSkillMap:Record<string,number[]>;weaponSkillMigration?:{version:1;legacySlots:number[]}};
export const WEAPON_SLOT_PREOPEN_LEVEL:number;
export const WEAPON_SLOT_UNLOCK_LEVEL:number;
export function nativeWeaponType(id:number):number;
export function weaponDeploymentGate(level:number):{showSecond:boolean;secondUnlocked:boolean;unlockLevel:number};
export function normalizeNativeWeaponLoadout(value:object,guns:WeaponCollection[]):NativeWeaponLoadout;
export function battleWeaponSkillSources(value:object,guns:WeaponCollection[]):number[];
export function selectNativeWeapon(value:NativeWeaponLoadout & {guns:WeaponCollection[]},id:number,slot?:number):Record<string,number>;
