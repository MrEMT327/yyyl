import { drawWeaponAccent } from './weapon-visual-quality.js';

// Presentation-only ownership. Keep the native hit, black-hole body and trails.
export const BLACK_HOLE_HIT_TEXTURE = 'pathogenic-black-hole-hit-ring';
const hits = new WeakSet();
export function markBlackHoleHitVisual(fx, bullet) {
  if (bullet.owner === 'player' && bullet.familyId === 200091 && fx.modelId === 210065) hits.add(fx);
  return fx;
}
export function preloadBlackHoleHitVisual(scene) {
  scene.load.image(BLACK_HOLE_HIT_TEXTURE, new URL('assets/black-hole-hit/pathogenic-ring.png', location.href).href);
}
export function drawBlackHoleHitVisual(scene, fx, point, px, objects, live) {
  return drawWeaponAccent(scene, fx, point, px, objects, live, {
    owns: hits.has(fx), texture: BLACK_HOLE_HIT_TEXTURE, key: 'black-hole-hit', tint: 0x8dffad,
  });
}
