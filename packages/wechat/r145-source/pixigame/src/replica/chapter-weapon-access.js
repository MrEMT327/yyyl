import source from './chapter-weapon-source.json' with { type: 'json' };
import { replicaChapter, replicaChapterForStage, replicaCampaignProgress } from './chapter-contract.js';

// Transport cleared native chapters, never the preview chapter selector or a
// caller-supplied highestUnlocked. Missing legacy configuration starts at chapter 1.
export function normalizeWeaponChapterProgress(value) {
  if (value === undefined) return { clearedChapterIds: [] };
  if (!value || !Array.isArray(value.clearedChapterIds)
    || value.clearedChapterIds.some(id => !replicaChapter(id))) {
    throw Error('武器解锁的原版章节记录无效');
  }
  return { clearedChapterIds: [...new Set(value.clearedChapterIds)].sort((a, b) => a - b) };
}

export function chapterWeaponBanSkillIds(progress, labs) {
  const campaign = replicaCampaignProgress([], normalizeWeaponChapterProgress(progress));
  const unlockedChapter = replicaChapterForStage(campaign.highestUnlocked)?.id ?? 1;
  // The local product opens selection permission on unlocking the configured
  // chapter. Native server record-creation timing remains unknown. Do not create
  // lab levels, NeedActive flags, collection ownership or milestone skills here.
  const knownLabs = new Set(labs.filter(row => row.active).map(row => row.id));
  return source.labs
    .filter(row => row.unlockChapter > unlockedChapter && !knownLabs.has(row.ID))
    .map(row => row.unlockSkill);
}
