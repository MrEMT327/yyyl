import { createSurfaceInput } from './three-surface.js';

// The pointer which starts on the preview owns the whole drag. Releasing over
// another button cannot launch, upgrade, dismiss a modal, or change characters.
export function createFighterInput(controls, fighter) {
  const buttons = createSurfaceInput(controls);
  let drag = null, buttonPointerId = null;
  return {
    hit: buttons.hit,
    cancel() { drag = null; buttonPointerId = null; buttons.cancel(); },
    handle(event) {
      const { x, y, phase, pointerId = 1 } = event;
      if (phase === 'start') {
        if (drag || buttonPointerId !== null) return true;
        if (buttons.hit(x, y)?.id !== 'fighter-orbit') { buttonPointerId = pointerId; return buttons.handle(event); }
        buttons.cancel(); drag = { pointerId, startX: x, startY: y, x, y, moved: false }; return true;
      }
      if (!drag) {
        if (buttonPointerId !== null && buttonPointerId !== pointerId) return true;
        if (phase === 'end' || phase === 'cancel') buttonPointerId = null;
        return buttons.handle(event);
      }
      if (drag.pointerId !== pointerId) return true;
      if (phase === 'cancel') { drag = null; return true; }
      if (!drag.moved && Math.hypot(x - drag.startX, y - drag.startY) > 8) drag.moved = true;
      if (drag.moved) { fighter.rotate(x - drag.x, y - drag.y); drag.x = x; drag.y = y; }
      if (phase === 'end') drag = null;
      return true;
    },
  };
}
