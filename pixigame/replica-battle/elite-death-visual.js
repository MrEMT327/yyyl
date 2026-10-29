// User-approved elite death visual trial. Reuses extracted Pathogenic frames.
export const ELITE_DEATH_TRIAL_ENABLED = true;
export const ELITE_DEATH_TEXTURE = 'pathogenic-elite-death-trial';
const eliteDeaths = new WeakSet();
export function markEliteDeathVisual(effect, enemy) {
  if (enemy.elite && !enemy.boss) eliteDeaths.add(effect);
}
export function eliteDeathFrame(effect) {
  if (!ELITE_DEATH_TRIAL_ENABLED || !eliteDeaths.has(effect) || effect.age < 0 || !(effect.duration > 0)) return null;
  const t = effect.age / Math.min(.7, effect.duration);
  return t >= 1 ? 10 : Math.floor(t * 10);
}
export function preloadEliteDeathVisual(scene) {
  if (ELITE_DEATH_TRIAL_ENABLED) scene.load.spritesheet(ELITE_DEATH_TEXTURE,
    new URL('assets/death-trial/pathogenic-explosion.webp', location.href).href,
    {frameWidth:256,frameHeight:256,endFrame:9});
}
export function drawEliteDeathVisual(scene, effect, point, px, objects, live) {
  const frame = eliteDeathFrame(effect);
  if (frame === null || !scene.textures.exists(ELITE_DEATH_TEXTURE)) return false;
  if (frame >= 10) return true;
  const key = `elite-death-trial:${effect.uid}`;
  live.add(key);
  let view = objects.get(key);
  if (!view) {view=scene.add.image(0,0,ELITE_DEATH_TEXTURE).setDepth(40);objects.set(key,view);}
  view.setFrame(frame).setPosition(point.x,point.y).setDisplaySize(effect.size*px,effect.size*px);
  return true;
}
