// Same short, non-restarting hit-state timing observed in APK 1.1.6.
// Motion is authored procedurally for our PSD HUD; no original animation asset
// or exported curve is loaded. Offsets are fractions of the displayed bar width.
export const BOSS_HIT_MOTION_MS=1000/3;
const still={active:false,x:0,y:0,iconX:0,iconY:0};

/** Cosmetic snapshot only. The battle clock freezes on pause/background;
 * repeated hits cannot rewind an active recoil or accumulate a displacement. */
export function updateBossHitMotion(previous,boss,now,reducedMotion=false){
  const maxHp=Number(boss?.maxHp),rawHp=Number(boss?.hp);
  const valid=!!boss&&!boss.dead&&Number.isFinite(maxHp)&&maxHp>0&&Number.isFinite(rawHp)&&rawHp>0;
  const hp=valid?Math.min(maxHp,rawHp):0;
  now=Number.isFinite(now)?now:previous?.at??0;
  if(!valid||!previous||previous.boss!==boss||previous.maxHp!==maxHp||now<previous.at||reducedMotion){
    return {boss,maxHp,hp,at:now,started:null,...still};
  }
  if(now===previous.at&&hp===previous.hp)return previous;
  let started=previous.started;
  const running=started!==null&&now-started<BOSS_HIT_MOTION_MS;
  if(hp<previous.hp&&!running)started=now;
  const elapsed=started===null?BOSS_HIT_MOTION_MS:now-started;
  if(elapsed>=BOSS_HIT_MOTION_MS)return {boss,maxHp,hp,at:now,started:null,...still};
  const u=Math.max(0,elapsed/BOSS_HIT_MOTION_MS),decay=(1-u)**2;
  return {boss,maxHp,hp,at:now,started,active:true,
    x:-.032*Math.sin(u*Math.PI*5)*decay,
    y:.006*Math.sin(u*Math.PI*3)*decay,
    iconX:-.023*Math.sin(u*Math.PI)*(.72+.28*Math.cos(u*Math.PI*8)),
    iconY:.014*Math.sin(u*Math.PI*6)*Math.sin(u*Math.PI)*(1-u)};
}
