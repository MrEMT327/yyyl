// Boss-only local visual trial. Extracted texture; playback is locally adapted.
export const BOSS_DEATH_TRIAL_ENABLED = true;
export const BOSS_DEATH_TEXTURE = 'pathogenic-boss-death-trial';
const bossDeaths = new WeakSet();
export function markBossDeathVisual(effect, enemy) {
  if (enemy.boss) bossDeaths.add(effect);
}
export function bossDeathFrame(effect) {
  if (!BOSS_DEATH_TRIAL_ENABLED || !bossDeaths.has(effect) || effect.age < 0 || !(effect.duration > 0)) return null;
  const t=effect.age/Math.min(.9,effect.duration);
  return t>=1 ? 10 : Math.floor(t*10);
}
export function preloadBossDeathVisual(scene) {
  if (BOSS_DEATH_TRIAL_ENABLED) scene.load.spritesheet(BOSS_DEATH_TEXTURE,
    new URL('assets/death-trial/pathogenic-explosion.webp',location.href).href,
    {frameWidth:256,frameHeight:256,endFrame:9});
}
export function drawBossDeathVisual(scene,effect,point,px,objects,live) {
  const frame=bossDeathFrame(effect);
  if(frame===null || !scene.textures.exists(BOSS_DEATH_TEXTURE))return false;
  if(frame>=10)return true;
  const key=`boss-death-trial:${effect.uid}`;live.add(key);
  let view=objects.get(key);
  if(!view){view=scene.add.image(0,0,BOSS_DEATH_TEXTURE).setDepth(40);objects.set(key,view);}
  view.setFrame(frame).setPosition(point.x,point.y).setDisplaySize(effect.size*px,effect.size*px);
  return true;
}
