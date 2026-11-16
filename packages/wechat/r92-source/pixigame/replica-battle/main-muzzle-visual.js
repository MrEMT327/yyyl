// Local visual trial using an extracted Pathogenic texture, not its Godot animation.
// Presentation only: no projectile, damage, fire cadence or effect lifetime changes.
export const MAIN_MUZZLE_TRIAL_ENABLED = true;
export const MAIN_MUZZLE_TEXTURE = 'pathogenic-main-muzzle-trial';
export function muzzleTrialProgress(effect) {
  if (!MAIN_MUZZLE_TRIAL_ENABLED || effect.kind !== 'muzzle' || effect.modelId !== 100001 || effect.age < 0 || !(effect.duration > 0)) return null;
  return Math.min(1, effect.age / Math.min(.12, effect.duration));
}
export function preloadMainMuzzleVisual(scene) {
  if (MAIN_MUZZLE_TRIAL_ENABLED) scene.load.image(MAIN_MUZZLE_TEXTURE,
    new URL('assets/muzzle-trial/pathogenic-glow.png', location.href).href);
}
export function drawMainMuzzleVisual(scene, effect, point, px, objects, live) {
  const t = muzzleTrialProgress(effect);
  if (t === null || !scene.textures.exists(MAIN_MUZZLE_TEXTURE)) return false;
  // Suppress the old visual for its remaining lifetime without mutating the effect.
  if (t >= 1) return true;
  const key = `main-muzzle-trial:${effect.uid}`;
  live.add(key);
  let view = objects.get(key);
  if (!view) {
    view = scene.add.image(0, 0, MAIN_MUZZLE_TEXTURE).setDepth(40).setTint(0xa4eaff);
    objects.set(key, view);
  }
  const size = effect.size * px * (.9 - .45 * t) * (effect.originalScale ?? 1);
  view.setPosition(point.x, point.y).setDisplaySize(size, size * 1.6)
    .setRotation(-(effect.angle ?? 0)).setAlpha((1 - t) * .9);
  return true;
}
