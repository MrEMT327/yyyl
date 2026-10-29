// Presentation only: affordability and mutations remain owned by the domain.
// Unknown balances get neutral styling, never an invented "insufficient" state.
export function lobbyCost(helpers, { label, icon, amount, available, showAvailable = false }) {
  const { escape: e, number: n, icon: glyph } = helpers;
  const known = available != null && !Number.isNaN(Number(available));
  const short = known && Number(available) < Number(amount);
  const description = `${label}，需要 ${n(amount)}${known ? `，持有 ${n(available)}` : ''}${short ? '，不足' : ''}`;
  return `<span class="lobby-cost" data-cost-resource="${e(icon)}" data-cost-state="${short ? 'short' : 'normal'}" title="${e(description)}" aria-label="${e(description)}">${glyph(icon)}<b>${e(n(showAvailable && known ? available : amount))}</b>${showAvailable && known ? `<em>/${e(n(amount))}</em>` : ''}</span>`;
}
