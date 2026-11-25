const maxWechatPixels = 840_000;

export function isWechatPortrait() {
  return globalThis.__THUNDER_RUNTIME_GLOBALS__?.platformKind === 'wechat';
}

export function portraitRenderSize(width, height, ratio = 2) {
  const density = isWechatPortrait()
    ? Math.min(ratio, Math.sqrt(maxWechatPixels / Math.max(1, width * height)))
    : ratio;
  return [Math.max(1, Math.round(width * density)), Math.max(1, Math.round(height * density))];
}

// The motion clock continues at its authored rate when a render is skipped.
export function createPortraitPaintGate(fps = isWechatPortrait() ? 30 : 0) {
  const interval = fps > 0 ? 1000/fps - 1 : 0;
  let lastPaint = -Infinity;
  return now => {
    if (now - lastPaint < interval) return false;
    lastPaint = now;
    return true;
  };
}
