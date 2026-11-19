import './tap-feedback.css';

// Independent of the combat clock: feedback also plays over paused menus.
export function mountTapFeedback(surface) {
  if (!surface) return () => {};
  const layer = document.createElement('div');
  layer.className = 'tap-feedback-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  const active = new Map();
  const remove = (node) => {
    clearTimeout(active.get(node));
    active.delete(node);
    node.remove();
  };
  const onDown = (event) => {
    if (event.button !== 0) return;
    const rect = surface.getBoundingClientRect();
    const { clientX: x, clientY: y } = event;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return;
    // Bound the transient DOM work even during rapid multi-touch input.
    if (active.size >= 8) remove(active.keys().next().value);
    const pulse = document.createElement('span');
    pulse.className = 'tap-feedback-pulse';
    pulse.style.left = `${x}px`;
    pulse.style.top = `${y}px`;
    pulse.style.setProperty('--tap-size', `${Math.max(38, Math.min(54, rect.width * .112))}px`);
    layer.appendChild(pulse);
    active.set(pulse, setTimeout(() => remove(pulse), 520));
  };
  // Capture sees both canvas and DOM controls without consuming their input.
  document.addEventListener('pointerdown', onDown, { capture: true, passive: true });
  const dispose = () => {
    document.removeEventListener('pointerdown', onDown, true);
    for (const node of active.keys()) remove(node);
    layer.remove();
  };
  if (import.meta.hot) import.meta.hot.dispose(dispose);
  return dispose;
}
