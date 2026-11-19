// A reused or parked surface keeps its pixels. Only the owner of a finished
// renderer calls this, after disposing its textures and render targets.
export const RELEASE_OWNED_CANVAS = Symbol.for('shnh.releaseOwnedCanvas');
export const OWNED_CANVAS_FRAME = Symbol.for('shnh.ownedCanvasFrame');

// A retained drawing buffer can opt out of polling by publishing each draw.
export function notifyOwnedCanvasFrame(canvas) {
  canvas?.[OWNED_CANVAS_FRAME]?.();
}

export function releaseOwnedCanvas(canvas) {
  if (!canvas) return;
  canvas.remove?.();
  if (canvas[RELEASE_OWNED_CANVAS]) canvas[RELEASE_OWNED_CANVAS]();
  else canvas.width = canvas.height = 0;
}
