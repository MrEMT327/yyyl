const tabs = [['shop','商城'],['assembly','装备'],['battle','战役'],['research','天赋'],['supply','补给']];
const navAsset = id => `${import.meta.env?.BASE_URL ?? '/'}art/psd-main-v1/navigation/${id}.png`;

export function lobbyNavigation(activeTab = 'battle') {
  return tabs.map(([id,label],index) => {
    const active = id === activeTab;
    return `<button type="button" class="pl-tab lobby-nav-tab ${active ? 'is-active' : ''}" data-action="tab" data-tab="${id}" aria-label="${label}" aria-current="${active ? 'page' : 'false'}"><img class="psd-nav-icon psd-nav-icon-${id}" src="${navAsset(id)}" alt="" aria-hidden="true" draggable="false"><span>${label}</span>${index<tabs.length-1?'<i class="psd-nav-divider" aria-hidden="true"></i>':''}</button>`;
  }).join('');
}
