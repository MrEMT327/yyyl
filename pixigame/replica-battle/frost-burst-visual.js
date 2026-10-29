import { accentSample } from './weapon-visual-quality.js';

export const FROST_BURST_TEXTURE = 'pathogenic-frost-burst';
const bursts = new WeakSet();
// Tag only the ice upgrade's detached explosion, not other users of 210035.
export function markFrostBurstVisual(fx, shot) {
  if (shot.owner === 'player' && shot.familyId === 200031 && shot.weaponId === 200034 && fx.modelId === 210035) bursts.add(fx);
}
export function preloadFrostBurstVisual(scene) {
  scene.load.image(FROST_BURST_TEXTURE, new URL('assets/frost-burst/pathogenic-freeze-circle.png', location.href).href);
}
export function frostBurstSample(fx) {
  if (!bursts.has(fx)) return null;
  const sample = accentSample(fx.age, fx.duration);
  if (!sample) return null;
  // Decorative inner ring, not a damage-radius indicator. Follow the native
  // effect lifetime so the .2-second invisible damage carrier cannot cut it off.
  const scale = Number.isFinite(fx.originalScale) ? Math.max(0, fx.originalScale) : 1;
  return { alpha: sample.alpha, diameter: Math.min(6, 3 * scale) * sample.scale };
}
export function drawFrostBurstVisual(scene, fx, point, px, objects, live) {
  const sample = frostBurstSample(fx);
  if (!sample || !scene.textures.exists(FROST_BURST_TEXTURE)) return false;
  const key = `frost-burst:${fx.uid}`;
  let view = objects.get(key);
  if (!view) { view = scene.add.image(0, 0, FROST_BURST_TEXTURE).setDepth(41).setBlendMode(1); objects.set(key, view); }
  live.add(key);
  view.setPosition(point.x, point.y).setDisplaySize(sample.diameter * px, sample.diameter * px).setAlpha(sample.alpha);
  // Native ice particles and their tails must still render.
  return false;
}
