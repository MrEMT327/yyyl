import { pilotHoloCard } from './pilot-holo-card.js';

// Legacy recruitment surface shares the pilot-only entry.
export function referenceSupplyPage({ snapshot: s, helpers, pool = 'pilot', browsePilot, weaponCard }) {
  const { escape: e, number: n, icon, img, thumbnail, button, asset } = helpers;
  pool='pilot';
  const isPilot = true, info = s.pools?.[pool] || {};
  const featured = isPilot ? s.pilots.find(p => p.id === browsePilot) || s.pilots[0] : s.weapons.find(w => !w.owned) || s.weapons[0];
  const items = isPilot ? s.pilots : s.weapons;
  const singleCost = info.singleCost ?? info.cost, tenCost = info.tenCost;
  return `<section class="pl-supply-page ref-supply">
    <div class="ref-pool-tabs" aria-label="招募类型">
      ${button('pool', `${icon('pilot')} 战姬招募`, isPilot ? 'is-active' : '', 'data-pool="pilot"')}
    </div>
    <div class="ref-recruit-showcase" style="--recruit-scene:url('${asset('hangar')}')">
      <div class="ref-recruit-copy"><small>${isPilot ? '战姬与专属座驾' : '武装补给'}</small><h1>${e(featured?.name)}</h1><p>${isPilot ? '首次获得解锁人物与专属战机' : '招募武器，装配你的战机'}</p>
      ${button(isPilot ? 'pilotInfo' : 'weaponInfo', isPilot ? '查看典藏' : '查看武器', 'pl-secondary', `data-id="${e(featured?.id)}"`)}</div>
      <div class="ref-recruit-art ${isPilot ? 'is-pilot' : 'is-weapon'}">${isPilot ? img(featured?.image, featured?.name) : thumbnail(featured?.id) || icon('weapon')}</div>
    </div>
    <div class="ref-divider ref-recruit-heading"><strong>${isPilot ? '战姬图鉴' : '武器图鉴'}</strong><span>已拥有 ${items.filter(x => x.owned).length} / ${items.length}</span></div>
    <div class="ref-recruit-scroll"><div class="${isPilot ? 'pl-pilot-collection' : 'pl-weapon-grid'}">${isPilot ? s.pilots.map(p => `<button type="button" class="pl-collection-card ${p.owned ? 'is-owned' : ''}" data-action="pilotInfo" data-id="${e(p.id)}" aria-label="查看${e(p.name)}卡牌">${pilotHoloCard(p, { compact: true, status: p.owned ? '已拥有' : '' })}</button>`).join('') : s.weapons.map(w => weaponCard(w, false, 'weaponInfo')).join('')}</div></div>
    <footer class="ref-recruit-footer"><p class="ref-recruit-guarantee">${icon('medal')}${e(info.guaranteeText)}<small>已招募 ${n(info.totalPulls || 0)} 次</small></p>
      <div class="pl-recruit-actions">${button('recruit', `<strong>招募 1 次</strong><span>${icon('diamond')} ${n(singleCost)}</span>`, 'pl-secondary', 'data-count="1"', singleCost == null || s.wallet.diamonds < singleCost)}${button('recruit', `<strong>招募 10 次</strong><span>${icon('diamond')} ${n(tenCost)}</span>`, 'pl-primary', 'data-count="10"', tenCost == null || s.wallet.diamonds < tenCost)}</div>
    </footer>
  </section>`;
}
