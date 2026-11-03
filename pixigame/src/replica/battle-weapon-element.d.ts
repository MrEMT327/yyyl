export interface BattleWeaponElement {
  readonly id: number;
  readonly key: string;
  readonly label: string;
  readonly color: string;
}
export const BATTLE_ELEMENTS: Readonly<Record<number, BattleWeaponElement>>;
export function battleChoiceElement(card: {group?: number} | undefined, combat: Record<string, any> | undefined): BattleWeaponElement | null;
