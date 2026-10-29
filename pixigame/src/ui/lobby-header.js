import './lobby-header.css';
import { lobbyResources } from './lobby-resources.js';
import { guiIcon, LOBBY_GUI_ICONS } from './gui-casual.js';

// A page label shares its proportions with the home identity strip.
export function lobbyPageHeading({ helpers: h, title, icon = '', action = '', label = title }) {
  const e = h.escape;
  const packIcon = LOBBY_GUI_ICONS[title];
  const headingIcon = packIcon ? guiIcon(packIcon) : icon;
  const content = `${headingIcon ? `<span class="lobby-heading-icon" aria-hidden="true">${headingIcon}</span>` : ''}<span class="lobby-heading-text">${e(title)}</span>`;
  return action
    ? `<button type="button" class="lobby-page-heading lobby-page-title" data-action="${e(action)}" aria-label="${e(label)}">${content}</button>`
    : `<h1 class="lobby-page-heading lobby-page-title">${content}</h1>`;
}

export function lobbyHeader({ snapshot: s, helpers: h }, playerName, pageTitle = '') {
  const { escape: e, number: n, img } = h;
  const pilot = s.pilots.find(p => p.id === s.pilotId);
  const identity = pageTitle ? lobbyPageHeading({ helpers: h, title: pageTitle }) : `<div class="lobby-profile"><div class="lobby-avatar">${img(pilot?.avatar || pilot?.image, pilot?.name, '')}</div><div class="lobby-profile-copy"><strong>${e(playerName || pilot?.name || '指挥官')}</strong><span class="lobby-power"><small>战力</small><b>${Number.isFinite(s.power)?n(s.power):'—'}</b></span></div></div>`;
  return `${identity}${lobbyResources({snapshot:s,helpers:h})}`;
}
