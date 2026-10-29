import catalog from './chapter-correspondence.json' with { type: 'json' };
import { preserveReplicaStars } from './native-battle-rating.js';
import { UNLOCK_ALL_CONTENT } from '../development-resources.js';

// Developer access opens every chapter. Normal progression requires an
// explicit preview opt-in; access never rewrites actual clear records.
export const PREVIEW_CHAPTERS_UNLOCKED = UNLOCK_ALL_CONTENT || Boolean(import.meta.env) && import.meta.env.VITE_UNLOCK_CHAPTERS === 'true';

export function replicaStageAccessible(index, highestUnlocked) {
  return Boolean(replicaChapterForStage(index) && (PREVIEW_CHAPTERS_UNLOCKED || index <= highestUnlocked));
}

export function replicaChapter(chapterId) {
  if (!Number.isInteger(chapterId)) return undefined;
  return catalog.chapters.find(row => row.id === chapterId);
}

export function replicaChapterForStage(stageIndex) {
  if (!Number.isInteger(stageIndex)) return undefined;
  return catalog.chapters.find(row => row.stageIndex === stageIndex);
}

// Native progress is independent of legacy cloud completions and debug access.
// Preserve cleared IDs even after the bounded detailed-result history rolls over.
export function replicaCampaignProgress(results, previous = {}) {
  const passedWaves = {}, starMasks = {};
  for(const [id,mask] of Object.entries(previous.starMasks||{}))
    if(replicaChapter(Number(id))&&Number.isInteger(mask)&&mask>=0&&mask<=7)starMasks[id]=mask;
  for(const [id,wave] of Object.entries(previous.passedWaves||{})) {
    const chapter=replicaChapter(Number(id));
    if(chapter&&Number.isInteger(wave)&&wave>=0&&wave<=chapter.waveCount)passedWaves[id]=wave;
  }
  const cleared = new Set((previous.clearedChapterIds || []).filter(id => replicaChapter(id)));
  for (const result of results) {
    if (result.abandoned || result.trial) continue;
    const chapter = replicaChapter(result.chapterId ?? 1);
    if(!chapter)continue;
    // SinglePlayerBattleEndEvent.SetPassWave 0x6e9beec: success uses the
    // displayed wave; failure uses max(0, displayed wave - 1).
    if(result.won){cleared.add(chapter.id);starMasks[chapter.id]=preserveReplicaStars(starMasks[chapter.id],result);}
    if(Number.isInteger(result.wave)&&result.wave>=1&&result.wave<=chapter.waveCount){
      const passed=result.won?result.wave:Math.max(0,result.wave-1);
      passedWaves[chapter.id]=Math.max(passedWaves[chapter.id]||0,passed);
    }
  }
  for(const id of cleared)passedWaves[id]=replicaChapter(id).waveCount;
  const clearedChapterIds = [...cleared].sort((a, b) => a - b);
  const highestCleared = Math.max(-1, ...clearedChapterIds.map(id => replicaChapter(id).stageIndex));
  const finalStage = Math.max(...catalog.chapters.map(row => row.stageIndex));
  return { version: 2, passedWaves, starMasks, clearedChapterIds, highestCleared, highestUnlocked: Math.min(finalStage, highestCleared + 1) };
}
