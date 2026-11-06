export type WeaponImpactStyle='ice'|'acid'|'electric'|'energy'|'heat';
export function weaponImpactStyle(effect:object & {kind?:string}):WeaponImpactStyle|undefined;
