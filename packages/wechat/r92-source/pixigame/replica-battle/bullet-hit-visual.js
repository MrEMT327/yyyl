// User-requested local texture trial; timing/tint are adapted, not Godot playback.
export const BULLET_HIT_TRIAL_ENABLED = true;
export const BULLET_HIT_TEXTURE = 'pathogenic-bullet-hit-trial';
export function bulletHitProgress(effect) {
  if (!BULLET_HIT_TRIAL_ENABLED || effect.kind !== 'hit' || effect.modelId !== 210012 || effect.age < 0 || !(effect.duration > 0)) return null;
  return Math.min(1, effect.age / effect.duration);
}
export function preloadBulletHitVisual(scene) {
  if (BULLET_HIT_TRIAL_ENABLED) scene.load.image(BULLET_HIT_TEXTURE,
    new URL('assets/hit-trial/pathogenic-ring.png', location.href).href);
}
export function drawBulletHitVisual(scene, effect, point, px, objects, live) {
  const t = bulletHitProgress(effect);
  if (t === null || !scene.textures.exists(BULLET_HIT_TEXTURE)) return false;
  if (t >= 1) return true;
  const key = `bullet-hit-trial:${effect.uid}`;
  live.add(key);
  let view = objects.get(key);
  if (!view) {
    view = scene.add.image(0, 0, BULLET_HIT_TEXTURE).setDepth(40).setTint(0xacecff);
    objects.set(key, view);
  }
  const size = effect.size * px * (.45 + .65 * t);
  view.setPosition(point.x, point.y).setDisplaySize(size, size).setAlpha((1 - t) * .95);
  return true;
}
