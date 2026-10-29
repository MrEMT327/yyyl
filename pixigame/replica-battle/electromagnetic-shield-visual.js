// Pathogenic's decoded particle7_bubble texture, adapted as a thin membrane.
// Native shield particles, collision radius and kill-bullet rule remain owned
// by the existing simulation and particle renderer.
export const SHIELD_MEMBRANE_TEXTURE = 'pathogenic-electromagnetic-membrane';
export function preloadElectromagneticShieldVisual(scene) {
  scene.load.image(SHIELD_MEMBRANE_TEXTURE, new URL('assets/electromagnetic-shield/pathogenic-bubble.png', location.href).href);
}
export function shieldMembraneSample(b) {
  if (b.owner !== 'player' || b.familyId !== 200001 || b.modelId !== 200249
    || b.beam || b.visualHidden || !(b.scale > 0) || !Number.isFinite(b.radiusX)
    || !(b.radiusX > 0) || !Number.isFinite(b.age) || b.age < (b.warmup || 0) || b.dead) return null;
  const age = b.age - (b.warmup || 0), t = Math.min(1, age / .16);
  // Subtle breathing only changes opacity, never suggests a changing radius.
  return { diameter: b.radiusX * 2, alpha: t * t * (3 - 2 * t) * (.19 + .025 * Math.sin(age * Math.PI * 2)), rotation: age * .18 };
}
export function drawElectromagneticShieldVisual(scene, b, live) {
  const sample = shieldMembraneSample(b);
  if (!sample || !scene.textures.exists(SHIELD_MEMBRANE_TEXTURE)) return false;
  const key = `electromagnetic-membrane:${b.uid}`;
  let view = scene.objects.get(key);
  if (!view) { view = scene.add.image(0, 0, SHIELD_MEMBRANE_TEXTURE).setDepth(28).setTint(0x84e7ff).setBlendMode(1); scene.objects.set(key, view); }
  const point = scene.screen(b.x, b.z);live.add(key);
  view.setPosition(point.x, point.y).setDisplaySize(sample.diameter * scene.px, sample.diameter * scene.px)
    .setRotation(sample.rotation).setAlpha(sample.alpha);
  // The native eight textured layers and their particle tails still render.
  return false;
}
