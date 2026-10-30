import './common-rewards.css';

export function isCommonReward(modal) {
  return modal?.type==='shopBoxResult' || (modal?.type==='rewards' && !modal.patrol && !modal.recruit && !['pilot','weapon'].includes(modal.recruitPool));
}

// The domain has already granted the receipt. Dismissal never awards it again.
export function commonRewardsDialog({title='获得奖励',content}, {escape:e}) {
  return `<div class="pl-modal-backdrop common-reward-backdrop" data-action="dismiss"><section class="pl-modal common-reward-dialog" data-modal-type="rewards" data-modal-kind="commonRewards" data-psd-popup="primary" role="dialog" aria-modal="true" aria-labelledby="lobby-modal-title" tabindex="-1"><header class="pl-modal-heading"><h2 id="lobby-modal-title">${e(title)}</h2></header><div class="pl-modal-content">${content}</div><button type="button" class="common-reward-dismiss" data-action="close">点击空白处关闭</button></section></div>`;
}
