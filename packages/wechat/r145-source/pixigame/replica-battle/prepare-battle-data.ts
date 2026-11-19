import { replicaChapter } from '../src/replica/chapter-contract';
import { chapterPresentationForStage } from '../src/replica/chapter-presentation.js';
import { loadContent } from './kernel/content';
import { loadLoadoutCatalog, type LoadoutCatalog } from './kernel/loadout-state';
import type { GameContent } from './kernel/model';
import type {ReadSharedLoadoutJSON} from './kernel/loadout-resources';
import {rewriteBattleUrls} from './rewrite-battle-urls';

export interface PreparedBattleData {
  content: GameContent;
  catalog: LoadoutCatalog;
}

export async function prepareBattleData({
  chapterId, baseURL, fetchResource, signal, onProgress, loadCatalog = loadLoadoutCatalog, readSharedLoadoutJSON, canLoadArt,
}: {
  chapterId: number;
  baseURL: string;
  fetchResource: typeof fetch;
  signal: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
  loadCatalog?: typeof loadLoadoutCatalog;
  readSharedLoadoutJSON?: ReadSharedLoadoutJSON;
  canLoadArt?: (path: string) => boolean;
}): Promise<PreparedBattleData> {
  const requested = replicaChapter(chapterId);
  if (!requested) throw new Error('出击关卡不存在');
  const [content, catalog] = await Promise.all([
    loadContent(onProgress, { chapterId, fetchResource, readSharedLoadoutJSON, canLoadArt }),
    loadCatalog(fetchResource, readSharedLoadoutJSON),
  ]);
  if (signal.aborted) throw signal.reason ?? new DOMException('Battle closed', 'AbortError');
  if (Number(content.chapter.chapter.id) !== chapterId) throw new Error('关卡与出击请求不一致');
  // Prepare the display name and resource URLs once for this chapter and host.
  content.chapter.chapter.name = chapterPresentationForStage(requested.stageIndex).name;
  for (const row of content.chapter.catalog) {
    const chapter = replicaChapter(Number(row.id));
    if (chapter) row.name = chapterPresentationForStage(chapter.stageIndex).name;
  }
  rewriteBattleUrls(content, value => /^\/?assets\//.test(value)
    ? new URL(value.replace(/^\//, ''), baseURL).href : value);
  return { content, catalog };
}

export function createBattleRunContent(template: GameContent): GameContent {
  // applyStudyLoadout writes these records. Everything else describes the
  // stage and can be read directly from the shared prepared data.
  return {
    ...template,
    chapter: { ...template.chapter, player: { ...template.chapter.player } },
    combat: {
      ...template.combat,
      fixedEntryPreset: { ...template.combat.fixedEntryPreset },
      skillRows: { ...template.combat.skillRows },
    },
  };
}
