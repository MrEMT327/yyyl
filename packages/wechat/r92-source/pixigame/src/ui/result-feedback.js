const shown = new WeakSet();

// A receipt gets one reveal, including when the result UI rebuilds for ads.
export function revealResult(panel, receipt, stars, rewardNodes) {
  if (!receipt || shown.has(receipt)) return;
  shown.add(receipt);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const marks = stars?.children || [];
  const started = performance.now();
  const frame = now => {
    if (panel.destroyed || !panel.parent) return;
    const elapsed = now - started;
    marks.forEach((mark, index) => {
      const t = Math.max(0, Math.min(1, (elapsed - index * 120) / 260));
      mark.alpha = t;
      mark.scale.set(.75 + .25 * t + .13 * Math.sin(Math.PI * t));
    });
    const progress = Math.max(0, Math.min(1, (elapsed - 300) / 260));
    rewardNodes.forEach(node => { node.alpha = progress; });
    if (elapsed < 600) requestAnimationFrame(frame);
  };
  frame(started);
}
