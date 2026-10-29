const MAX_PITCH = Math.PI * .42;
const clampPitch = value => Math.max(-MAX_PITCH, Math.min(MAX_PITCH, value));
const wrapYaw = value => Math.atan2(Math.sin(value), Math.cos(value));

// Keep view state on the canvas, not its host: lobby renders replace the host.
export function createModelOrbitInteraction(canvas, { onChange = () => {}, onDragEnd = () => {} } = {}) {
  let pitch = 0, yaw = 0, pointerId = null, lastX = 0, lastY = 0, interacted = false, disposed = false;
  let yawOnly = false;
  const window = canvas.ownerDocument?.defaultView;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', '战机三维预览');
  canvas.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight ArrowUp ArrowDown Home');
  canvas.style.touchAction = 'none';
  canvas.style.userSelect = 'none';

  function change(nextPitch, nextYaw) {
    pitch = yawOnly ? 0 : clampPitch(nextPitch); yaw = wrapYaw(nextYaw); interacted = true;
    onChange();
  }
  function reset() { if (!disposed) change(0, 0); }
  function finish(event) {
    if (pointerId === null || (event?.pointerId != null && event.pointerId !== pointerId)) return;
    const released = pointerId; pointerId = null;
    canvas.classList.remove('is-dragging');
    try { if (canvas.hasPointerCapture(released)) canvas.releasePointerCapture(released); } catch { /* The browser may already have released it. */ }
    onDragEnd();
  }
  function recapture() {
    if (pointerId === null) return;
    try { canvas.setPointerCapture(pointerId); } catch { finish(); }
  }
  function down(event) {
    if (disposed || pointerId !== null || event.isPrimary === false || event.button !== 0) return;
    pointerId = event.pointerId; lastX = event.clientX; lastY = event.clientY;
    canvas.setAttribute('data-orbit-input', 'pointer');
    canvas.focus({ preventScroll: true });
    canvas.classList.add('is-dragging'); recapture();
    event.preventDefault();
  }
  function move(event) {
    if (event.pointerId !== pointerId || disposed) return;
    if (event.pointerType === 'mouse' && event.buttons === 0) { finish(event); return; }
    const width = Math.max(1, canvas.getBoundingClientRect().width);
    const dx = event.clientX - lastX, dy = event.clientY - lastY;
    lastX = event.clientX; lastY = event.clientY;
    // A drag across the preview turns the aircraft once, independent of DPR.
    change(pitch + dy / width * Math.PI, yaw + dx / width * Math.PI * 2);
    event.preventDefault();
  }
  function keydown(event) {
    if (disposed || event.altKey || event.ctrlKey || event.metaKey) return;
    const step = event.shiftKey ? .3 : .12;
    switch (event.key) {
      case 'ArrowLeft': change(pitch, yaw - step); break;
      case 'ArrowRight': change(pitch, yaw + step); break;
      case 'ArrowUp': if (yawOnly) return; change(pitch - step, yaw); break;
      case 'ArrowDown': if (yawOnly) return; change(pitch + step, yaw); break;
      case 'Home': reset(); break;
      default: return;
    }
    canvas.setAttribute('data-orbit-input', 'keyboard');
    event.preventDefault(); event.stopPropagation();
  }
  function doubleClick(event) { if (event.button === 0) { reset(); event.preventDefault(); } }
  const clearInput = () => canvas.setAttribute('data-orbit-input', '');
  const listeners = { blur: clearInput, pointerdown: down, pointermove: move, pointerup: finish, pointercancel: finish, lostpointercapture: finish, keydown, dblclick: doubleClick };
  for (const [name, handler] of Object.entries(listeners)) canvas.addEventListener(name, handler);
  const blur = () => finish();
  window?.addEventListener('blur', blur);
  return {
    get pitch() { return pitch; },
    get yaw() { return yaw; },
    get dragging() { return pointerId !== null; },
    get interacted() { return interacted; },
    setYawOnly(value) {
      if (disposed || yawOnly === Boolean(value)) return;
      yawOnly = Boolean(value);
      if (yawOnly && pitch !== 0) change(0, yaw);
      canvas.setAttribute('aria-label', '战机三维预览');
      canvas.setAttribute('aria-keyshortcuts', yawOnly ? 'ArrowLeft ArrowRight Home' : 'ArrowLeft ArrowRight ArrowUp ArrowDown Home');
    },
    reset, cancel: finish, reattach: recapture,
    destroy() {
      if (disposed) return; disposed = true; finish();
      for (const [name, handler] of Object.entries(listeners)) canvas.removeEventListener(name, handler);
      window?.removeEventListener('blur', blur);
    },
  };
}
