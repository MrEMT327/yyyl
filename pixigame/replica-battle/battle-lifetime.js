import { releaseOwnedCanvas } from '../src/ui/release-owned-canvas.js';

// Own resources created by the integration; the copied simulation is unchanged.
export const DISPOSE_BATTLE_EVENT = 'shnh-dispose-replica-battle';
export function createBattleLifetime(events = window,makeAbort=()=>new AbortController()) {
  const controller = makeAbort(), callbacks = [];
  let disposed = false;
  const add = cleanup => { if (disposed) cleanup(); else callbacks.push(cleanup); };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
    for (const cleanup of callbacks.reverse()) {
      try { cleanup(); } catch (error) { console.error('[replica cleanup]', error); }
    }
    callbacks.length = 0;
  };
  events?.addEventListener(DISPOSE_BATTLE_EVENT, dispose, {signal:controller.signal});
  events?.addEventListener('pagehide', dispose, {signal:controller.signal});
  return {add, dispose, signal:controller.signal, get disposed() {return disposed;}};
}

export function disposeNativeAudio(audio) {
  audio.dispose?.();
  audio.pause();
  audio.enabled = false;
  if (audio.music) {audio.music.removeAttribute('src'); audio.music.load();}
  for (const source of audio.sources) {source.onended = null; source.disconnect();}
  audio.sources.clear(); audio.buffers.clear(); audio.voices.clear();
  audio.master?.disconnect();
  if (audio.context && audio.context.state !== 'closed') void audio.context.close().catch(() => {});
}

export function disposeNativeGame(game, releaseVisuals = () => {}) {
  const gl = game.renderer?.gl;
  const canvas = game.canvas;
  try {
    game.loop.stop();
    try { releaseVisuals(); }
    finally {
      game.destroy(true, false);
      // Phaser 3.90 defers destroy until step(). A detached frame has no next
      // RAF. Before texturesReady, Phaser has not created its system scene or
      // renderer masks yet; its normal destroy path assumes they exist.
      if (game.isRunning) game.step(0, 0);
      else {
        game.events.removeAllListeners();
        game.textures?.removeAllListeners();
        for (const key of Object.keys(game.textures?.list || {})) game.textures.remove(key);
        game.loop.destroy();
      }
    }
  } finally {
    try { if (!gl?.isContextLost?.()) gl?.getExtension('WEBGL_lose_context')?.loseContext(); }
    finally { releaseOwnedCanvas(canvas); }
  }
}
