import { drawWeaponAccent } from './weapon-visual-quality.js';

// Hit accent only. Native sword pose, swing, particles and trails still render.
export const SWORD_HIT_TEXTURE = 'pathogenic-sword-hit-glow';
const hits = new WeakSet();
export function markSwordHitVisual(fx, bullet) {
  if (bullet.owner === 'player' && bullet.familyId === 200101 && fx.modelId === 210062) hits.add(fx);
  return fx;
}
export function preloadSwordHitVisual(scene) {
  scene.load.image(SWORD_HIT_TEXTURE, new URL('assets/sword-hit/pathogenic-glow.png', location.href).href);
}
export function drawSwordHitVisual(scene, fx, point, px, objects, live) {
  return drawWeaponAccent(scene, fx, point, px, objects, live, {
    owns: hits.has(fx), texture: SWORD_HIT_TEXTURE, key: 'sword-hit', tint: 0x9cfff5,
  });
}
