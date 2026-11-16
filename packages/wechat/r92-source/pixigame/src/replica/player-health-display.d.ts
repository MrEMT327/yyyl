export const PLAYER_LOW_HEALTH_RATIO: number;
export const PLAYER_LOW_HEALTH_COLOR: number;
export function playerHealthBarColor(ratio:number,hitFlash?:boolean):number;

export const PLAYER_HEAL_BAR_SECONDS: number;
export interface PlayerHealthFrame {
  runId: unknown; hp: number; maxHp: number; time: number; at: number;
  from: number; target: number; value: number; animating: boolean;
}
export function playerHealthFrame(previous:PlayerHealthFrame|null|undefined,hp:number,maxHp:number,time:number,runId?:unknown,quiet?:boolean):PlayerHealthFrame;
