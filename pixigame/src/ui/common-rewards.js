import './common-rewards.css';
const frameArt=`${import.meta.env?.BASE_URL??'/'}art/psd-popup-v1/primary.png`;
// Nine PSD regions. The vertical edges sample an uninterrupted source strip,
// so the tall panel's decorative breaks do not get squeezed into short receipts.
export const commonRewardFrame=()=>`<div class="common-reward-frame" aria-hidden="true">${[
  [0,0,255,110],[255,0,268,110],[523,0,44,110],
  [0,500,255,1],[255,110,268,549],[523,500,44,1],
  [0,659,255,55],[255,659,268,55],[523,659,44,55],
].map(region=>`<svg viewBox="${region.join(' ')}" preserveAspectRatio="none" focusable="false"><image href="${frameArt}" width="567" height="714"/></svg>`).join('')}</div>`;

export function isCommonReward(modal) {
  return modal?.type==='shopBoxResult' || (modal?.type==='rewards' && !modal.patrol && !modal.recruit && !['pilot','weapon'].includes(modal.recruitPool));
}

// The domain has already granted the receipt. Dismissal never awards it again.
export function commonRewardsDialog({title='获得奖励',content}, {escape:e}) {
  return `<div class="pl-modal-backdrop common-reward-backdrop" data-action="dismiss"><section class="pl-modal common-reward-dialog" data-modal-type="rewards" data-modal-kind="commonRewards" data-psd-popup="primary" role="dialog" aria-modal="true" aria-labelledby="lobby-modal-title" tabindex="-1">${commonRewardFrame()}<header class="pl-modal-heading"><h2 id="lobby-modal-title">${e(title)}</h2></header><div class="pl-modal-content">${content}</div><button type="button" class="common-reward-dismiss" data-action="close">点击空白处关闭</button></section></div>`;
}
