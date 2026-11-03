import type { BattleWeaponElement } from '../replica/battle-weapon-element.js';
export const BATTLE_ELEMENT_BADGE_SIZE: Readonly<{width:number;height:number}>;
export function battleElementBadgeMarkup(element: BattleWeaponElement | null): string;
export function drawBattleElementBadge(surface: any, element: BattleWeaponElement | null, x:number, y:number): {x:number;y:number;width:number;height:number} | null;
