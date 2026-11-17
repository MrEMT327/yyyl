// The result outcome and the inventory receipt are different states. Do not
// describe an absent receipt as an empty reward or imply it was already saved.
export function resultRewardStatus(result, debugRun = false) {
  const pending = Boolean(result?.pending), preview = Boolean(debugRun || result?.trial);
  return {
    pending,
    heading: pending ? '奖励待保存' : preview ? '奖励预览' : '获得奖励',
    empty: pending ? '正在保存战斗奖励' : preview ? '本次无预览奖励' : '本次无新增奖励',
    // Returning is also the existing persistence retry path. Keep it available
    // so a failed save cannot strand the player behind a disabled button.
    returnLabel: pending ? '保存并返回航母' : '返回航母',
  };
}
