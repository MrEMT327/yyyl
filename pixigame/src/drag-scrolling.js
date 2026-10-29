import { advanceScroll, dragPosition } from './scroll-physics.js';
const scrollableOverflow = /^(auto|scroll|overlay)$/;
const excluded = 'canvas,input,textarea,select,[contenteditable]:not([contenteditable="false"]),[data-drag-scroll="off"]';
const bindings = new WeakMap();

// One controller for all current and future scrollports. Keep native layout and
// scroll offsets; translate content only for elastic overscroll, never the viewport.
export function bindDragScrolling(root) {
  const existing = bindings.get(root);
  if (existing) { existing.users++; return existing.release; }
  const view = root.ownerDocument?.defaultView || root.defaultView;
  const document = root.ownerDocument || root;
  let gesture = null, motion = null, surface = null, frame = 0, blockedClick = null;
  const now = () => view.performance.now();
  const connected = element => element.isConnected && root.contains(element);
  const reducedMotion = () => view.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function restoreSurface() {
    if (!surface) return;
    const { element, styles, layers } = surface;
    element.classList.remove('drag-scroll-active');
    for (const { node, translate, priority } of layers) {
      if (translate) node.style.setProperty('translate', translate, priority);
      else node.style.removeProperty('translate');
    }
    for (const [name, value, priority] of styles) {
      if (value) element.style.setProperty(name, value, priority); else element.style.removeProperty(name);
    }
    surface = null;
  }
  function stopMotion() {
    if (frame) view.cancelAnimationFrame(frame);
    frame = 0; motion = null;
  }
  function releasePointer() {
    const previous = gesture; gesture = null;

    if (previous?.element && previous.kind === 'mouse') {
      try { if (previous.element.hasPointerCapture(previous.id)) previous.element.releasePointerCapture(previous.id); } catch { /* Removed node. */ }
    }
    return previous;
  }
  function cancel() { releasePointer(); stopMotion(); restoreSurface(); }
  function activate(element, axis) {
    // Read geometry before invalidating styles, not during the first elastic frame.
    const x = axis === 'x', property = x ? 'scrollLeft' : 'scrollTop';
    const max = Math.max(0, x ? element.scrollWidth - element.clientWidth : element.scrollHeight - element.clientHeight);
    const extent = x ? element.clientWidth : element.clientHeight, scroll = element[property];
    const layers = Array.from(element.children, node => ({ node,
      translate: node.style.getPropertyValue('translate'), priority: node.style.getPropertyPriority('translate') }));
    const styles = ['scroll-behavior', 'scroll-snap-type', 'overflow-anchor'].map(name =>
      [name, element.style.getPropertyValue(name), element.style.getPropertyPriority(name)]);
    element.style.setProperty('scroll-behavior', 'auto', 'important');
    element.style.setProperty('scroll-snap-type', 'none', 'important');
    element.style.setProperty('overflow-anchor', 'none');
    element.classList.add('drag-scroll-active');
    surface = { element, axis, styles, layers, property, max, extent, scroll, bounce: 0 };
  }
  function paint(position) {
    if (!surface || !connected(surface.element)) { cancel(); return; }
    const clamped = Math.max(0, Math.min(surface.max, position));
    // Overscroll stays at the same native offset: avoid redundant layout flushes.
    if (clamped !== surface.scroll) {
      surface.element.scrollTo(surface.axis === 'x' ? { left: clamped, behavior: 'instant' } : { top: clamped, behavior: 'instant' });
      surface.scroll = clamped;
    }
    const bounce = clamped - position;
    if (bounce !== surface.bounce) {
      const translate = surface.axis === 'x' ? `${bounce}px 0px` : `0px ${bounce}px`;
      // Non-inherited compositor property; no custom variable invalidating descendants.
      for (const { node } of surface.layers) node.style.translate = translate;
      surface.bounce = bounce;
    }
  }
  function schedule() { if (!frame) frame = view.requestAnimationFrame(tick); }
  function tick(time) {
    frame = 0;
    if (gesture?.element) { paint(gesture.position); return; }
    if (!motion || !surface) return;
    motion = { ...advanceScroll(motion, Math.min(64, Math.max(0, time - motion.time)), surface.max), time };
    paint(motion.position);
    if (!motion) return;
    const settled = motion.target === null ? Math.abs(motion.velocity) < .015
      : Math.abs(motion.position - motion.target) < .2 && Math.abs(motion.velocity) < .015;
    if (settled) { paint(motion.target ?? motion.position); stopMotion(); restoreSurface(); }
    else schedule();
  }
  function candidatesFor(target, event) {
    const candidates = [];
    for (let element = target; element && element !== root; element = element.parentElement) {
      const style = view.getComputedStyle(element);
      const x = scrollableOverflow.test(style.overflowX) && element.scrollWidth > element.clientWidth + 1;
      const y = scrollableOverflow.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
      if (!x && !y) continue;
      const rect = element.getBoundingClientRect(), left = rect.left + element.clientLeft, top = rect.top + element.clientTop;
      // Leave scrollbar gutters to the browser.
      if (event.clientX < left || event.clientX >= left + element.clientWidth || event.clientY < top || event.clientY >= top + element.clientHeight) return [];
      candidates.push({ element, x, y });
    }
    return candidates;
  }
  function begin(event, point, kind, id) {
    if (gesture) return;
    blockedClick = null;
    const resumed = surface && connected(surface.element) && surface.element.contains(event.target)
      ? { element: surface.element, axis: surface.axis, position: motion?.position ?? surface.element[surface.property] } : null;
    stopMotion();
    if (!resumed) restoreSurface();
    if (event.defaultPrevented || event.target.closest?.(excluded)) { restoreSurface(); return; }
    const candidates = candidatesFor(event.target, point);
    if (!candidates.length) { restoreSurface(); return; }
    gesture = { id, kind, candidates, resumed, startX: point.clientX, startY: point.clientY, time: now(), samples: [] };
  }
  function down(event) {
    if (event.pointerType !== 'mouse' || event.isPrimary === false || event.button !== 0) return;
    begin(event, event, 'mouse', event.pointerId);
  }
  function movePoint(event, point) {
    if (!gesture) return;
    const dx = point.clientX - gesture.startX, dy = point.clientY - gesture.startY;
    if (!gesture.element) {
      if (Math.hypot(dx, dy) < 4) return;
      const axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      // Nearest scrollport owns this axis even at an edge, so it can stretch.
      const candidate = gesture.candidates.find(item => item[axis] && connected(item.element));
      if (!candidate) return;
      const resumed = gesture.resumed?.element === candidate.element && gesture.resumed.axis === axis ? gesture.resumed.position : null;
      if (surface?.element !== candidate.element || surface.axis !== axis) { restoreSurface(); activate(candidate.element, axis); }
      gesture.element = candidate.element; gesture.axis = axis;
      gesture.start = resumed ?? surface.scroll;
      gesture.samples = [{ value: 0, time: gesture.time }];

      view.getSelection()?.removeAllRanges();
      if (gesture.kind === 'mouse') {
        try { candidate.element.setPointerCapture(gesture.id); } catch { /* Window listeners retain the drag. */ }
      }
    }
    if (!connected(gesture.element)) { cancel(); return; }
    const delta = gesture.axis === 'x' ? dx : dy, time = now();
    // Re-grabbing an elastic offset starts from its visible position, without a jump.
    const startEdge = Math.max(0, Math.min(surface.max, gesture.start));
    const overshoot = gesture.start - startEdge;
    const rawStart = overshoot === 0 ? gesture.start : startEdge + inverseRubber(overshoot, surface.extent);
    gesture.position = dragPosition(rawStart - delta, surface.max, surface.extent);
    gesture.samples.push({ value: -delta, time });
    while (gesture.samples.length > 2 && gesture.samples[1].time < time - 100) gesture.samples.shift();
    gesture.time = time;
    if (event.cancelable) event.preventDefault();
    schedule();
  }
  function inverseRubber(value, extent) {
    const limit = Math.max(24, Math.min(120, extent * .35));
    const distance = Math.min(Math.abs(value), limit - .01);
    return Math.sign(value) * distance / (.55 * (1 - distance / limit));
  }
  function move(event) {
    if (gesture?.kind !== 'mouse' || event.pointerId !== gesture.id) return;
    if (event.buttons !== 1) { cancel(); return; }
    movePoint(event, event);
  }
  function finish() {
    const ended = releasePointer();
    if (!ended?.element) { if (surface) settleSurface(); return; }
    if (frame) view.cancelAnimationFrame(frame); frame = 0;
    paint(ended.position);
    if (!surface) return;
    blockedClick = { element: ended.element, until: now() + 600 };
    const first = ended.samples[0], last = ended.samples.at(-1);
    let velocity = now() - ended.time > 100 ? 0 : Math.max(-3, Math.min(3, (last.value - first.value) / Math.max(16, last.time - first.time)));
    const target = ended.position < 0 ? 0 : ended.position > surface.max ? surface.max : null;
    if (target !== null) velocity *= .35;
    motion = { position: ended.position, velocity: reducedMotion() ? 0 : velocity, target, time: now() };
    if (reducedMotion()) { paint(target ?? ended.position); stopMotion(); restoreSurface(); }
    else schedule();
  }
  function settleSurface() {
    const position = surface.element[surface.property] - surface.bounce;
    motion = { position, velocity: 0, target: Math.max(0, Math.min(surface.max, position)), time: now() };
    schedule();
  }
  function up(event) { if (gesture?.kind === 'mouse' && gesture.id === event.pointerId) finish(); }
  function cancelled(event) { if (gesture?.kind === 'mouse' && gesture.id === event.pointerId) cancel(); }
  function lostCapture(event) { if (gesture?.element === event.target) cancelled(event); }
  // Cancel native panning before it starts, without touch-action:none on whole
  // pages (which would disable zoom and nested-axis arbitration).
  function touchstart(event) {
    if (event.touches.length !== 1) { cancel(); return; }
    begin(event, event.touches[0], 'touch', event.touches[0].identifier);
  }
  function touchmove(event) {
    if (gesture?.kind !== 'touch') return;
    const point = Array.from(event.touches).find(t => t.identifier === gesture.id);
    if (point && event.cancelable) movePoint(event, point);
    else cancel();
  }
  function touchend(event) {
    if (gesture?.kind === 'touch' && Array.from(event.changedTouches).some(t => t.identifier === gesture.id)) finish();
  }
  function click(event) {
    if (!blockedClick || now() > blockedClick.until || event.detail === 0 || !blockedClick.element.contains(event.target)) return;
    blockedClick = null; event.preventDefault(); event.stopImmediatePropagation();
  }
  function dragstart(event) { if (gesture) event.preventDefault(); }
  function wheel() { if (!gesture) { stopMotion(); restoreSurface(); } }
  function visibility() { if (document.hidden) cancel(); }
  const listeners = [
    [root, 'pointerdown', down], [root, 'click', click, true], [root, 'dragstart', dragstart], [root, 'wheel', wheel, { passive: true }],
    [view, 'pointermove', move, { passive: false, capture: true }], [view, 'pointerup', up],
    [view, 'pointercancel', cancelled], [view, 'lostpointercapture', lostCapture], [view, 'blur', cancel],
    [root, 'touchstart', touchstart, { passive: true, capture: true }],
    [root, 'touchmove', touchmove, { passive: false, capture: true }],
    [root, 'touchend', touchend, true], [root, 'touchcancel', cancel, true], [document, 'visibilitychange', visibility],
  ];
  for (const [target, type, handler, options] of listeners) target.addEventListener(type, handler, options);
  const binding = { users: 1, release() {
    if (--binding.users > 0) return;
    cancel(); blockedClick = null;
    for (const [target, type, handler, options] of listeners) target.removeEventListener(type, handler, options);
    bindings.delete(root);
  } };
  bindings.set(root, binding);
  return binding.release;
}
