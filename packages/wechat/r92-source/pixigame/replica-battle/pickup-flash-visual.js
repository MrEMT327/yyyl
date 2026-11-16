// Local texture adaptation; no pickup rules or original effect state changes.
export const PICKUP_FLASH_TRIAL_ENABLED = true;
export const PICKUP_FLASH_TEXTURE = 'pathogenic-pickup-flash-trial';
export function pickupFlashProgress(effect) {
  if (!PICKUP_FLASH_TRIAL_ENABLED || effect.kind !== 'muzzle' || effect.modelId !== 140014 || !effect.followPlayer || effect.age < 0 || !(effect.duration > 0)) return null;
  return Math.min(1, effect.age / Math.min(.35, effect.duration));
}
export function preloadPickupFlashVisual(scene) {
  if (PICKUP_FLASH_TRIAL_ENABLED) scene.load.image(PICKUP_FLASH_TEXTURE,
    new URL('assets/pickup-trial/pathogenic-ring.png', location.href).href);
}
export function drawPickupFlashVisual(scene, effect, point, px, objects, live) {
  const t = pickupFlashProgress(effect);
  if (t === null || !scene.textures.exists(PICKUP_FLASH_TEXTURE)) return false;
  if (t >= 1) return true;
  const key = `pickup-flash-trial:${effect.uid}`;
  live.add(key);
  let view = objects.get(key);
  if (!view) {
    view = scene.add.image(0, 0, PICKUP_FLASH_TEXTURE).setDepth(40).setTint(0xffdf88);
    objects.set(key, view);
  }
  const size = effect.size * px * (2.2 - 1.4 * t) * (effect.originalScale ?? 1);
  view.setPosition(point.x, point.y).setDisplaySize(size, size).setAlpha(.6 * (1 - t));
  return true;
}
