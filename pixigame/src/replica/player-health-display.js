export const PLAYER_LOW_HEALTH_RATIO=.25;
export const PLAYER_LOW_HEALTH_COLOR=0xff4b55;
export function playerHealthBarColor(ratio,hitFlash=false){
  return ratio<=PLAYER_LOW_HEALTH_RATIO?PLAYER_LOW_HEALTH_COLOR:hitFlash?0xff7777:0x3ee4a1;
}
