import { developerSkillsEnabled } from '../developer-battle-settings.js';
import { DEVELOPER_CURRENCY_GRANTS } from '../developer-tools.js';

export function developerToolsDialog(snapshot, modal, { escape, number }) {
  const revision = snapshot.nativeAcquisition.revision;
  const busy = snapshot.rewardBusy;
  const pending = snapshot.rewardPending;
  const currencyButtons = Object.entries(DEVELOPER_CURRENCY_GRANTS).map(([currency, grant]) =>
    `<button type="button" class="wc-button" data-action="developerCurrency" data-currency="${currency}" data-revision="${revision}" ${busy || pending ? 'disabled' : ''}>${grant.name} +${number(grant.amount)}</button>`).join('');
  return {
    title: '开发工具',
    content: `<div class="pl-developer-panel">
      <p>开发资源按需领取，局内技能可单独开启。下方领取的资源会写入当前存档，正常消费。</p>
      <div class="pl-developer-balance"><span>金币 ${number(snapshot.wallet.coins)}</span><span>钻石 ${number(snapshot.wallet.diamonds)}</span></div>
      ${currencyButtons}
      <button type="button" class="wc-button" data-action="developerSkills" aria-pressed="${developerSkillsEnabled()}">局内全部技能：${developerSkillsEnabled() ? '已开启' : '未开启'}</button>
      <p>开启后，下次出击可直接选择全部武器、升级、驾驶员和飞机技能；仅影响局内体验。</p>
      ${busy || pending ? '<p role="status">请先完成当前操作或保存奖励，再领取开发资源。</p>' : ''}
      <div class="pl-developer-reset">
        <strong>一键清档 · 恢复新手档</strong>
        <p>删除本网址的全部游戏进度、资源、装备、领取记录及旧档备份，然后重新开始。不会删除其他网站或其他应用的数据。</p>
        <button type="button" class="wc-button pl-developer-danger" data-action="debugClear" ${busy ? 'disabled' : ''}>${modal.clearArmed ? '确认清档并重新开始' : '一键清档，重建新手档'}</button>
        ${modal.clearArmed ? '<p role="alert">此操作无法撤销；再次点击确认。关闭面板即可取消。</p>' : ''}
      </div>
      ${modal.error ? `<p class="pl-developer-error" role="alert">${escape(modal.error)}</p>` : ''}
    </div>`,
  };
}
