// Local Pathogenic texture trial; presentation only, not original Godot playback.
export const LEVEL_PULSE_TRIAL_ENABLED = true;
export const LEVEL_PULSE_TEXTURE = 'pathogenic-level-pulse-trial';
export function levelPulseProgress(effect) {
  if (!LEVEL_PULSE_TRIAL_ENABLED || effect.kind !== 'level' || effect.modelId || effect.age < 0 || !(effect.duration > 0)) return null;
  return Math.min(1, effect.age / effect.duration);
}
export function preloadLevelPulseVisual(scene) {
  if (LEVEL_PULSE_TRIAL_ENABLED) scene.load.image(LEVEL_PULSE_TEXTURE,
    new URL('assets/level-trial/pathogenic-soft-ring.png', location.href).href);
}
export function drawLevelPulseVisual(scene, effect, point, px, objects, live) {
  const t = levelPulseProgress(effect);
  if (t === null || !scene.textures.exists(LEVEL_PULSE_TEXTURE)) return false;
  if (t >= 1) return true;
  const key = `level-pulse-trial:${effect.uid}`;
  live.add(key);
  let view = objects.get(key);
  if (!view) {
    view = scene.add.image(0, 0, LEVEL_PULSE_TEXTURE).setDepth(40).setTint(0x83e8ff);
    objects.set(key, view);
  }
  // Keep the old ring's outer diameter; only the texture/softness changes.
  const size = effect.size * px * (.6 + 1.2 * t);
  view.setPosition(point.x, point.y).setDisplaySize(size, size).setAlpha(.65 * (1 - t));
  return true;
}
