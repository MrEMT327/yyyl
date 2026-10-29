import { drawWeaponAccent } from './weapon-visual-quality.js';
import { SWORD_HIT_TEXTURE } from './sword-hit-visual.js';
import { BLACK_HOLE_HIT_TEXTURE } from './black-hole-hit-visual.js';

// Reuse the already-loaded Pathogenic glow/ring textures. This is a small
// impact accent, not a replacement for the native 13-layer lightning effect.
export function isCriticalLightningVisual(b) {
  return b.owner === 'player' && b.familyId === 200001 && b.modelId === 1000048
    && !b.beam && !b.visualHidden && b.scale > 0 && b.age >= (b.warmup || 0);
}

export function drawCriticalLightningVisual(scene, b, live) {
  if (!isCriticalLightningVisual(b)) return false;
  const age = b.age - (b.warmup || 0), duration = Math.min(.38, b.lifetime);
  if (!(duration > 0) || age >= duration) return false;
  const point = scene.screen(b.x, b.z);
  const fx = { uid: b.uid, age, duration, size: Math.min(1.4, b.scale) };
  drawWeaponAccent(scene, fx, point, scene.px, scene.objects, live, {
    owns: true, texture: SWORD_HIT_TEXTURE, key: 'critical-lightning-glow', tint: 0xbdf5ff,
  });
  drawWeaponAccent(scene, { ...fx, size: fx.size * 1.5 }, point, scene.px, scene.objects, live, {
    owns: true, texture: BLACK_HOLE_HIT_TEXTURE, key: 'critical-lightning-ring', tint: 0x8de9ff,
  });
  // Never suppress the source beam, particles, or detached particle tail.
  return false;
}
