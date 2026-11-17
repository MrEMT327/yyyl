import { createButtonPressMotion } from './button-press-motion.js';

export const DRAW_BUTTON_PRESS_SCALE = Symbol.for('shnh.ui.draw-button-press-scale');
const selector = 'button, [role="button"], [role="tab"], [role="menuitemradio"]';

export function mountDomButtonPress(doc = document) {
  const view = doc.defaultView;
  const cleanup = new AbortController();
  const options = { capture: true, passive: true, signal: cleanup.signal };
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const originalScale = new WeakMap();
  const motion = createButtonPressMotion((node, scale) => {
    if(node[DRAW_BUTTON_PRESS_SCALE]){
      node[DRAW_BUTTON_PRESS_SCALE](scale);
      return;
    }
    if (scale === 1) {
      const original = originalScale.get(node);
      if (original?.value) node.style.setProperty('scale', original.value, original.priority);
      else if (original) node.style.removeProperty('scale');
      originalScale.delete(node);
      return;
    }
    if (!originalScale.has(node)) {
      const computedScale = view.getComputedStyle(node).scale || '';
      // The WeChat document returns an empty string for unset properties.
      // Number('') is zero, which collapses the button before touchend.
      const base = computedScale.split(/\s+/).filter(Boolean).map(Number);
      originalScale.set(node, {
        value: node.style.getPropertyValue('scale'),
        priority: node.style.getPropertyPriority('scale'),
        base: base.every(Number.isFinite) ? base : [],
      });
    }
    const { base } = originalScale.get(node);
    node.style.scale = base.length ? base.map(value => value * scale).join(' ') : String(scale);
  }, node => node.isConnected && !node.closest('[hidden], [inert], :disabled, [aria-disabled="true"]'));
  let press;
  const controlFor = event => {
    const control = event.target.closest?.(selector);
    return control && !control.closest('[hidden], [inert], :disabled, [aria-disabled="true"], [aria-busy="true"], [data-button-press="off"]')
      && !event.target.closest('input, select, textarea, [draggable="true"]') ? control : null;
  };
  const facesFor = control => {
    const faces = [...control.querySelectorAll(':scope > [data-button-visual], :scope > .lobby-resource-bar')];
    return faces.length ? faces : [control];
  };

  function finish(event, cancel = false) {
    if (!press || event && event.pointerId !== press.id) return;
    const { control, faces, id, captured } = press;
    press = null;
    if (cancel) {
      for (const face of faces) motion.cancel(face);
      if (captured && control.hasPointerCapture(id)) control.releasePointerCapture(id);
    } else for (const face of faces) motion.release(face);
  }
  function clear() { finish(null, true); motion.clear(); }
  doc.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary || press || reduced.matches) return;
    const control = controlFor(event);
    if (!control) return;
    const faces = facesFor(control), bounds = control.getBoundingClientRect();
    let captured = false;
    // A mouse release on the original edge still belongs to this button.
    // Dedicated faces keep their own hitbox, and touch has implicit capture.
    if (faces[0] === control && event.pointerType === 'mouse' && event.isTrusted) {
      control.setPointerCapture(event.pointerId);
      captured = true;
    }
    press = { id: event.pointerId, control, faces, x: event.clientX, y: event.clientY, bounds, captured };
    for (const face of faces) motion.start(face);
  }, options);
  doc.addEventListener('pointermove', event => {
    if (press?.id !== event.pointerId) return;
    const { x, y, bounds } = press;
    if (Math.hypot(event.clientX - x, event.clientY - y) > 10 ||
        event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) finish(event, true);
  }, options);
  doc.addEventListener('pointerup', event => finish(event), options);
  doc.addEventListener('pointercancel', event => finish(event, true), options);
  doc.addEventListener('lostpointercapture', event => finish(event, true), options);
  doc.addEventListener('click', event => {
    if (event.detail || !event.isTrusted) return;
    const control = controlFor(event);
    if (!control) return;
    for (const face of facesFor(control)) {
      motion.start(face);
      motion.release(face);
    }
  }, options);
  view.addEventListener('blur', clear, { signal: cleanup.signal });
  doc.addEventListener('visibilitychange', clear, options);
  reduced.addEventListener('change', clear, options);
  return () => { cleanup.abort(); clear(); };
}
