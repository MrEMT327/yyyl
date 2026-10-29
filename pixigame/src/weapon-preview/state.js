import { COMMON_WEAPONS } from '../fixed-parts/common-weapons.js';

export const PREVIEW_DEFAULTS = Object.freeze({
  weapon: 'aux_cannon', quality: 0, level: 1, scene: 'cluster',
  speed: 1, moving: true, bullets: true, paused: false,
});
export const PREVIEW_SCENES = ['cluster', 'single', 'kills', 'empty'];
export const PREVIEW_SPEEDS = [.25, .5, 1, 2];

function integer(value, fallback, min, max) {
  const number = value == null || value === '' ? NaN : Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.floor(number))) : fallback;
}
function boolean(value, fallback) {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return fallback;
}
export function normalizePreviewState(value = {}) {
  const defaults = PREVIEW_DEFAULTS;
  return {
    weapon: Object.hasOwn(COMMON_WEAPONS, value.weapon) ? value.weapon : defaults.weapon,
    quality: integer(value.quality, defaults.quality, 0, 5),
    level: integer(value.level, defaults.level, 1, 100),
    scene: PREVIEW_SCENES.includes(value.scene) ? value.scene : defaults.scene,
    speed: PREVIEW_SPEEDS.includes(Number(value.speed)) ? Number(value.speed) : defaults.speed,
    moving: boolean(value.moving, defaults.moving),
    bullets: boolean(value.bullets, defaults.bullets),
    paused: boolean(value.paused, defaults.paused),
  };
}
export function readPreviewState(search) {
  return normalizePreviewState(Object.fromEntries(new URLSearchParams(search)));
}
export function previewUrl(href, state) {
  const url = new URL(href);
  url.searchParams.set('preview', 'weapons');
  for (const [key, value] of Object.entries(normalizePreviewState(state))) {
    url.searchParams.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
  }
  return url;
}
export function gameUrl(href) {
  const url = new URL(href);
  for (const key of ['preview', ...Object.keys(PREVIEW_DEFAULTS)]) url.searchParams.delete(key);
  return url;
}
