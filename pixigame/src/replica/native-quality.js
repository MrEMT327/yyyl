// Collection Quality uses 10..60. Skill Quality is a separate 0..6 enum.
// Zero/missing means unspecified, never a rarity inferred from level or stars.
export function collectionQualityRank(quality) {
  return [10,20,30,40,50,60].includes(quality) ? quality / 10 - 1 : 0;
}
export function battleSkillPresentation(card) {
  const quality=Number(card.raw?.Quality ?? card.quality ?? 0);
  const qualityKnown=Number.isInteger(quality)&&quality>=1&&quality<=6;
  const level=Number.isSafeInteger(card.star)&&card.star>0?card.star:1;
  const instant=Number(card.raw?.SkillType)===99;
  return {qualityRank:qualityKnown?quality-1:0,qualityKnown,
    level:instant?0:level-1,nextLevel:instant?0:level,label:instant?'立即生效':card.opensBreakthrough?'突破':`Lv.${level} · 技能强化`,
    ...(instant?{instant:true}:{}),
    evolving:Boolean(card.opensBreakthrough)};
}
