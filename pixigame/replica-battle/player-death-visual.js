// Presentation-only player-death trial. WeakSet tags never change gameplay fields.
export const PLAYER_DEATH_TRIAL_ENABLED = true;
export const PLAYER_DEATH_TEXTURE = 'pathogenic-player-death-trial';
const playerDeaths = new WeakSet();
export function markPlayerDeathVisual(effect) { playerDeaths.add(effect); }
export function playerDeathFrame(effect) {
  if (!PLAYER_DEATH_TRIAL_ENABLED || !playerDeaths.has(effect) || effect.age < 0 || !(effect.duration > 0)) return null;
  const t = effect.age / Math.min(.7, effect.duration);
  return t >= 1 ? 10 : Math.floor(t * 10);
}
export function preloadPlayerDeathVisual(scene) {
  if (PLAYER_DEATH_TRIAL_ENABLED) scene.load.spritesheet(PLAYER_DEATH_TEXTURE,
    new URL('assets/death-trial/pathogenic-explosion.webp', location.href).href,
    {frameWidth:256,frameHeight:256,endFrame:9});
}
export function drawPlayerDeathVisual(scene, effect, point, px, objects, live) {
  const frame = playerDeathFrame(effect);
  if (frame === null || !scene.textures.exists(PLAYER_DEATH_TEXTURE)) return false;
  if (frame >= 10) return true;
  const key = `player-death-trial:${effect.uid}`;live.add(key);
  let view = objects.get(key);
  if (!view) {view=scene.add.image(0,0,PLAYER_DEATH_TEXTURE).setDepth(40);objects.set(key,view);}
  // Visual footprint only; effect.size, death delay and revive state remain untouched.
  const size=4*px*(effect.originalScale??1);
  view.setFrame(frame).setPosition(point.x,point.y).setDisplaySize(size,size);
  return true;
}
