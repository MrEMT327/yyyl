// Phaser clears its framebuffer before rendering any scene. Reuse has to
// bypass that whole step, while its TimeStep still drives the separate HUD.
export function createBattleFrameReuse({getRunId, canFreeze, capture, updateOverlay}) {
  let renderedRunId = '';
  let holding = false;

  return {
    install(game) {
      const step = game.step;
      game.step = function stepWithFrozenBattle(time, delta) {
        if (!this.pendingDestroy && !this.isPaused && renderedRunId && renderedRunId === getRunId() && canFreeze()) {
          if (!holding) holding = capture();
          if (holding) {
            updateOverlay(delta);
            return;
          }
        }
        return step.call(this, time, delta);
      };
    },
    presented() {
      renderedRunId = getRunId();
      holding = false;
    },
    invalidate() {
      renderedRunId = '';
      holding = false;
    },
  };
}
