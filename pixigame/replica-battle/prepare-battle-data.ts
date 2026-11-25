import { replicaChapter } from '../src/replica/chapter-contract';
import { chapterPresentationForStage } from '../src/replica/chapter-presentation.js';
import { installEnemyFireEffects } from './enemy-fire-effects';
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
  chapterId, baseURL, fetchResource, signal, onProgress, loadCatalog = loadLoadoutCatalog, readSharedLoadoutJSON, loadingFrame,
}: {
  chapterId: number;
  baseURL: string;
  fetchResource: typeof fetch;
  signal: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
  loadCatalog?: typeof loadLoadoutCatalog;
  readSharedLoadoutJSON?: ReadSharedLoadoutJSON;
  loadingFrame?: () => Promise<void> | void;
}): Promise<PreparedBattleData> {
  const requested = replicaChapter(chapterId);
  if (!requested) throw new Error('出击关卡不存在');
  const checkActive = () => {
    if (signal.aborted) throw signal.reason ?? new DOMException('Battle closed', 'AbortError');
  };
  const nextFrame = loadingFrame && (async () => {
    await loadingFrame();
    checkActive();
  });
  const [content, catalog] = await Promise.all([
    loadContent(onProgress, { chapterId, fetchResource, readSharedLoadoutJSON, loadingFrame: nextFrame }),
    loadCatalog(fetchResource, readSharedLoadoutJSON),
  ]);
  checkActive();
  if (nextFrame) await nextFrame();
  if (Number(content.chapter.chapter.id) !== chapterId) throw new Error('关卡与出击请求不一致');
  // Prepare the display name and resource URLs once for this chapter and host.
  content.chapter.chapter.name = chapterPresentationForStage(requested.stageIndex).name;
  for (const row of content.chapter.catalog) {
    const chapter = replicaChapter(Number(row.id));
    if (chapter) row.name = chapterPresentationForStage(chapter.stageIndex).name;
  }
  installEnemyFireEffects(content);
  if (nextFrame) await nextFrame();
  const resolvedAssets = new Map<string, string>();
  rewriteBattleUrls(content, value => {
    if (!/^\/?assets\//.test(value)) return value;
    let resolved = resolvedAssets.get(value);
    if (resolved === undefined) {
      resolved = new URL(value.replace(/^\//, ''), baseURL).href;
      resolvedAssets.set(value, resolved);
    }
    return resolved;
  });
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
