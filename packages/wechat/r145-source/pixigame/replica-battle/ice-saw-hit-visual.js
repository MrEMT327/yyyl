import { drawWeaponAccent } from './weapon-visual-quality.js';

// Keep native orbit/return motion and all particle/trail layers authoritative.
export const ICE_SAW_HIT_TEXTURE = 'pathogenic-ice-saw-hit-ring';
const hits = new WeakSet();
export function markIceSawHitVisual(fx, bullet) {
  if (bullet.owner === 'player' && bullet.familyId === 200141 && fx.modelId === 210051) hits.add(fx);
  return fx;
}
export function preloadIceSawHitVisual(scene) {
  scene.load.image(ICE_SAW_HIT_TEXTURE, new URL('assets/ice-saw-hit/pathogenic-ring.png', location.href).href);
}
export function drawIceSawHitVisual(scene, fx, point, px, objects, live) {
  return drawWeaponAccent(scene, fx, point, px, objects, live, {
    owns: hits.has(fx), texture: ICE_SAW_HIT_TEXTURE, key: 'ice-saw-hit', tint: 0x8bdcff,
  });
}
