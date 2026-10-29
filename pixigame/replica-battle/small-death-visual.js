import { markEliteDeathVisual } from './elite-death-visual.js';
import { markBossDeathVisual } from './boss-death-visual.js';
// Local visual trial explicitly requested by the user. No gameplay fields change.
// Set false to restore the native ordinary-enemy death particles.
export const SMALL_DEATH_TRIAL_ENABLED = true;
export const SMALL_DEATH_TEXTURE = 'pathogenic-small-death-trial';
export const SMALL_DEATH_FRAME_COUNT = 10;
const ordinaryDeaths = new WeakSet();
export function isOrdinaryDeathVisual(effect) { return ordinaryDeaths.has(effect); }
export function markOrdinaryDeathVisual(effect, enemy) {
  markEliteDeathVisual(effect, enemy);
  markBossDeathVisual(effect, enemy);
  if (!enemy.boss && !enemy.elite) ordinaryDeaths.add(effect);
  return effect;
}
export function smallDeathFrame(effect) {
  if (!SMALL_DEATH_TRIAL_ENABLED || !ordinaryDeaths.has(effect) || effect.age < 0) return null;
  const duration = Math.min(.55, effect.duration);
  if (!(duration > 0)) return null;
  return Math.min(SMALL_DEATH_FRAME_COUNT - 1, Math.floor(effect.age / duration * SMALL_DEATH_FRAME_COUNT));
}
export function preloadSmallDeathVisual(scene) {
  if (SMALL_DEATH_TRIAL_ENABLED) scene.load.spritesheet(SMALL_DEATH_TEXTURE,
    new URL('assets/death-trial/pathogenic-explosion.webp', location.href).href,
    { frameWidth: 256, frameHeight: 256, endFrame: SMALL_DEATH_FRAME_COUNT - 1 });
}
export function drawSmallDeathVisual(scene, effect, point, px, objects, live) {
  const frame = smallDeathFrame(effect);
  if (frame === null || !scene.textures.exists(SMALL_DEATH_TEXTURE)) return false;
  const key = `small-death-trial:${effect.uid}`;
  live.add(key);
  let view = objects.get(key);
  if (!view) { view = scene.add.image(0, 0, SMALL_DEATH_TEXTURE).setDepth(40); objects.set(key, view); }
  view.setFrame(frame).setPosition(point.x, point.y).setDisplaySize(effect.size * px * 1.25, effect.size * px * 1.25);
  return true;
}
