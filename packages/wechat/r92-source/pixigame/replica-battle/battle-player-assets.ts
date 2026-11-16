import type Phaser from 'phaser';
import type { RecordData } from './kernel/model';
import { preloadPlayerSpine } from './kernel/spine-player';

/** The initial load already has the equipped skeletons. A retry or an older
 * lobby can supply a different selection, which must load before start is sent. */
export async function ensureBattlePlayerAssets(scene: Phaser.Scene, layers: RecordData[], signal: AbortSignal) {
  if (signal.aborted) throw signal.reason ?? new DOMException('Battle closed', 'AbortError');
  const hasLayer = (layer: RecordData) => scene.cache.json.has(layer.key) && scene.cache.custom.spine?.has(layer.key);
  const missing = layers.filter(layer => !hasLayer(layer));
  if (!missing.length) return;

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      scene.load.off('complete', complete);
      signal.removeEventListener('abort', abort);
    };
    const complete = () => {
      cleanup();
      const unavailable = missing.find(layer => !hasLayer(layer));
      if (unavailable) reject(new Error(`战机外观资源加载失败：${unavailable.key}`));
      else resolve();
    };
    const abort = () => {
      cleanup();
      reject(signal.reason ?? new DOMException('Battle closed', 'AbortError'));
    };
    scene.load.once('complete', complete);
    signal.addEventListener('abort', abort, {once:true});
    try {
      preloadPlayerSpine(scene, missing);
      scene.load.start();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
