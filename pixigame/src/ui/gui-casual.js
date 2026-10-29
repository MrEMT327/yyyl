import { projectIconUrl } from './project-ui-art.js';
// Existing licensed frames remain separate from the original project icon set.
const base = `${import.meta.env?.BASE_URL ?? '/'}art/gui-casual/`;
const iconNames={coin:'credits-token',diamond:'diamonds',energy:'stamina',shop:'nav-shop',backpack:'chest-closed',research:'nav-research',chest:'chest-closed',task:'task-log',mail:'mail',plane:'nav-battle',equipment:'nav-equipment',recruit:'nav-recruit','nav-equipment':'nav-equipment','nav-battle':'nav-battle','nav-research':'nav-research','nav-recruit':'nav-recruit',map:'chapter-map',star:'star',close:'close'};
// Page headings and navigation share the same artwork for each destination.
export const LOBBY_GUI_ICONS = Object.freeze({
  商城: 'shop',
  装备: 'nav-equipment',
  战役: 'nav-battle',
  天赋: 'nav-research',
  招募: 'nav-recruit',
});
export const guiAsset = name => name.startsWith('icon-') ? projectIconUrl(iconNames[name.slice(5)]) : `${base}${name}.png`;
export function guiIcon(name, className = '') {
  return `<img class="gui-icon ${className}" src="${guiAsset(`icon-${name}`)}" alt="" aria-hidden="true" draggable="false">`;
}

// Mirror one source for both directions; its optical inset is handled by the skin.
export function guiChevron() {
  return `<img class="gui-chevron" src="${projectIconUrl('chevron-right')}" alt="" aria-hidden="true" draggable="false">`;
}
