import type Phaser from 'phaser';
import type { RecordData } from './kernel/model';
import { hasPlayerSpineLayer, preloadPlayerSpine } from './kernel/spine-player';

/** Try to load the selected skeletons. The 3D body can use its base pose when
 * the animated appearance is unavailable. */
export async function ensureBattlePlayerAssets(scene: Phaser.Scene, layers: RecordData[], signal: AbortSignal) {
  if (signal.aborted) throw signal.reason ?? new DOMException('Battle closed', 'AbortError');
  const missing = layers.filter(layer => !hasPlayerSpineLayer(scene, layer.key));
  if (!missing.length) return;

  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      scene.load.off('complete', complete);
      signal.removeEventListener('abort', abort);
    };
    const complete = () => {
      cleanup();
      resolve();
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
