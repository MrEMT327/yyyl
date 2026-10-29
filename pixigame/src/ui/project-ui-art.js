import { cloudAssetBase } from './cloud-asset-base.js';
// Original imagegen assets and supplied PSD symbols. Source prompts, full size
// outputs and export hashes live in the corresponding art/project-* directories.
const base = cloudAssetBase;
const own = name => `${base}art/project-ui-icons-v1/${name}.png`;
const resource = name => `${base}art/project-resource-icons-v2/${name}.png`;
const task = name => `${base}art/project-task-icons-v1/${name}.png`;
const names = [
  'star','lock','check','info','plus','chevron-right','upgrade-arrow','ad-play',
  'skill-tab','task-log','mail','chapter-map','skill-explosive','skill-freeze',
  'skill-toxin','skill-beam','skill-shield','skill-lightning','skill-laser',
  'skill-ballistic','skill-rail','skill-gravity','skill-blades','skill-drone'];
export const PROJECT_UI_ART = Object.freeze({
  ...Object.fromEntries(names.map(name => [name, own(name)])),
  // HD originals follow the user PSD identities and glossy cut-face style.
  'credits-token': resource('coins'), 'credits-stack': resource('credits-stack'),
  diamonds: resource('diamonds'), stamina: resource('stamina'),
  close: `${base}art/psd-popup-v1/close.png`,
  // Reuse supplied PSD symbols when an identity already exists; do not invent
  // a second symbol for the same destination. The bottom navigation is intact.
  'nav-shop': `${base}art/psd-main-v1/navigation/shop.png`,
  'nav-equipment': `${base}art/psd-main-v1/navigation/assembly.png`,
  'nav-battle': `${base}art/psd-main-v1/navigation/battle.png`,
  'nav-research': `${base}art/psd-main-v1/navigation/research.png`,
  'nav-recruit': `${base}art/psd-main-v1/navigation/supply.png`,
  'weapon-parts': resource('weapon-parts'),
  'aircraft-shard': resource('aircraft-shard'),
  'technology-core': resource('technology-core'),
  'chest-closed': task('chest-closed'), 'chest-open': task('chest-open'),
  'activity-medal': task('activity-medal'),
});
export function projectIconUrl(name) {
  const url = PROJECT_UI_ART[name];
  if (!url) throw new Error(`Unknown original UI icon: ${name}`);
  return url;
}
export function projectIcon(name, cls = '') {
  return `<img class="project-ui-icon ${cls}" data-project-icon="${name}" src="${projectIconUrl(name)}" alt="" aria-hidden="true" draggable="false">`;
}
