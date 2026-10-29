// Lobby-only presentation. The peripheral domain still owns every reward and action.
export const PAPER_MODAL_TYPES = new Set([
  'gearDetail','gearMerge','gearMergeList','gearAttributes','gearSources','gearMaterialInfo','gearDowngrade','gearBatch',
  'tasks', 'patrol', 'signin', 'shopConfirm', 'shopWeaponConfirm',
  'shopWeaponPreview', 'shopRules', 'researchCard', 'researchSummary',
  'researchResult', 'rewards', 'weapon', 'pilotInfo', 'aircraftInfo',
  'fleetOperation', 'fleetSkill', 'innateInfo', 'stamina', 'recruitRewards', 'recruitHistory',
]);

export function signInPanel(snapshot, { escape: e, number: n, icon, thumbnail, button }) {
  const signin = snapshot.signIn || {}, days = signin.days || [];
  return `<div class="paper-signin-summary"><strong>每日登录好礼</strong><span>本轮已签到 <b>${n(signin.streak ?? signin.day ?? 0)}</b> 天</span></div>
    <div class="pl-signin-grid">${days.map((d, i) => `<div class="pl-signin-day ${d.claimed ? 'is-claimed' : ''} ${d.today && signin.claimable !== false ? 'is-today' : ''}"><span>第 ${d.day || i + 1} 天${d.today && signin.claimable !== false ? ' · 今日' : ''}</span><div class="paper-signin-art">${thumbnail(d.itemId?.split(':')[1]) || icon(({diamonds:'diamond',weaponParts:'parts',aircraftShards:'shard',weapon:'weapon',aircraft:'plane'})[d.type] || 'coin')}</div><b>${d.type === 'coins' ? n(d.amount) : e(d.shortTitle || d.title || n(d.amount))}</b>${d.claimed ? '<i>已领取</i>' : ''}</div>`).join('')}</div>
    ${button('claimSignIn', signin.claimable === false ? '今日已领取' : '领取签到奖励', 'pl-primary pl-wide', '', signin.claimable === false)}`;
}
