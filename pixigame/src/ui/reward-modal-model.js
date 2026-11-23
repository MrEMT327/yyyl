export const isRewardReceiptModal=modal=>['rewards','shopBoxResult','researchResult'].includes(modal?.type);
export const isRewardLayerModal=modal=>isRewardReceiptModal(modal)||['taskChestPreview','aircraftActivation','processFeedback','boxOpening'].includes(modal?.type);
// Skill inspection retains its source WeaponInfo just like a receipt retains
// its source page. It is still a read-only preview, never a reward receipt.
export const isRetainedModalLayer=modal=>isRewardLayerModal(modal)||(modal?.type==='nativeSkillPreview'&&modal.kind==='guns'&&modal.returnTo?.type==='nativeCollectionDetail');
export const modalIdentity=modal=>modal?`${modal.type}:${modal.id||''}:${modal.view||''}`:'';

export function isCommonReward(modal) {
  return modal?.type==='shopBoxResult' || (modal?.type==='rewards' && !modal.patrol && !modal.recruit && !['pilot','weapon'].includes(modal.recruitPool));
}

export function isRecruitResult(modal) {
  return modal?.type==='rewards' && (modal.recruit===true || ['pilot','weapon'].includes(modal.recruitPool));
}

