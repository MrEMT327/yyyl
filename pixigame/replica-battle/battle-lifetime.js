// Own resources created by the integration; the copied simulation is unchanged.
export const DISPOSE_BATTLE_EVENT = 'shnh-dispose-replica-battle';
export function createBattleLifetime() {
  const controller = new AbortController(), callbacks = [];
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
  window.addEventListener(DISPOSE_BATTLE_EVENT, dispose, {signal:controller.signal});
  window.addEventListener('pagehide', dispose, {signal:controller.signal});
  return {add, dispose, signal:controller.signal, get disposed() {return disposed;}};
}

export function disposeNativeUi(ui) {
  // These are TypeScript-private fields, not ECMAScript #private slots.
  // Access is confined to teardown, just like the existing presentation adapter.
  for (const timer of ui.selectionTimers) clearTimeout(timer);
  ui.selectionTimers.length = 0;
  ui.upgradeAnimation.stop(); ui.upgradeAnimation.clearWarning(); ui.punchboard.stop();
  ui.update = () => {};
  ui.root.replaceChildren();
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

export function disposeNativeGame(game) {
  const gl = game.renderer?.gl;
  game.loop.stop();
  game.destroy(true, false);
  // Phaser 3.90 defers destroy until step(). A detached iframe has no next RAF.
  // The pendingDestroy branch returns before any simulation or rendering work.
  if (game.isRunning) game.step(0, 0);
  gl?.getExtension('WEBGL_lose_context')?.loseContext();
}
