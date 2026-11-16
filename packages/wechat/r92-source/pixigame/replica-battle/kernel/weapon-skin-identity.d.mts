type Row=Record<string,any>;
export const WEAPON_SKIN_FAMILIES:Readonly<Record<number,number>>;
export function weaponSkinMatches(skinId:number,source:Row,defaultFamily?:number):boolean;
export function markWeaponSkinEffect<T extends Row>(effect:T,source:Row,defaultFamily?:number):T;
