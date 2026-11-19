const MOVEMENT_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];

// Preserve the former manual-control pacing independently of progression.
export function combatTimeScale(game) {
  const controlling = game.pointerActive || game.relativeDragActive
    || MOVEMENT_KEYS.some(key => game.keys.has(key));
  return game.state === 'playing' && !controlling ? 0.25 : 1;
}

export function combatDelta(milliseconds, game) {
  const frameDelta = Math.min(0.033, Math.max(0, milliseconds / 1000));
  return frameDelta * combatTimeScale(game);
}
