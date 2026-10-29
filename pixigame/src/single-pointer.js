import { traceFlightInput } from './flight-input-diagnostics.js';

const installedGuards = new WeakMap();

const TOUCH_END_EVENTS = new Set(['pointerup', 'pointercancel', 'lostpointercapture']);

function isTouchPointer(event) {
  return event?.pointerType === 'touch';
}

function blockTouchEvent(event) {
  traceFlightInput('guard-block', { type: event.type, pointerId: event.pointerId, primary: event.isPrimary });
  event.preventDefault?.();
  event.stopImmediatePropagation?.();
  event.stopPropagation?.();
}

/**
 * Keep one touch pointer as the owner of the whole browser game surface.
 * Additional fingers are ignored until every pointer from that gesture ends;
 * this prevents a second finger from activating a button or moving the ship.
 */
export function installSinglePointerGuard(target = globalThis, { allowMultiple = () => false } = {}) {
  if (!target || typeof target.addEventListener !== 'function') return () => {};
  const previous = installedGuards.get(target);
  if (previous) return previous;

  let activePointerId = null;
  const blockedPointerIds = new Set();
  let blockedGesture = false;
  let multiGesture = false;
  const multiPointerIds = new Set();

  const reset = () => {
    activePointerId = null;
    blockedPointerIds.clear();
    blockedGesture = false;
    multiGesture = false;
    multiPointerIds.clear();
  };

  const handlePointer = (event) => {
    if (event.type !== 'pointermove') traceFlightInput('raw-pointer', {
      type: event.type, pointerId: event.pointerId, pointerType: event.pointerType,
      primary: event.isPrimary, buttons: event.buttons, owner: activePointerId,
      target: event.target?.tagName, blocked: [...blockedPointerIds],
    });
    if (!isTouchPointer(event)) return;
    const pointerId = event.pointerId;

    // A new primary touch means the browser has ended the previous gesture,
    // even if DevTools/device switching dropped its final up/cancel event.
    // A secondary finger is never allowed to clear the single-pointer lock.
    if (event.type === 'pointerdown' && event.isPrimary === true) {
      reset();
    }

    // An explicitly opted-in preview owns its entire gesture. If it closes,
    // consume remaining fingers until release instead of promoting one into
    // a fresh combat/menu press.
    if (multiGesture) {
      if (event.type === 'pointerdown') multiPointerIds.add(pointerId);
      if (!allowMultiple(event)) blockTouchEvent(event);
      if (TOUCH_END_EVENTS.has(event.type)) multiPointerIds.delete(pointerId);
      if (!multiPointerIds.size) multiGesture = false;
      return;
    }
    if (event.type === 'pointerdown' && activePointerId === null && !blockedPointerIds.size && !blockedGesture && allowMultiple(event)) {
      multiGesture = true;
      multiPointerIds.add(pointerId);
      return;
    }

    if (event.type === 'pointerdown') {
      if (activePointerId === null && blockedPointerIds.size === 0 && !blockedGesture) {
        activePointerId = pointerId;
        return;
      }
      if (pointerId === activePointerId) return;
      blockedPointerIds.add(pointerId);
      blockedGesture = true;
      blockTouchEvent(event);
      return;
    }

    if (pointerId === activePointerId) {
      if (TOUCH_END_EVENTS.has(event.type)) activePointerId = null;
      if (activePointerId === null && blockedPointerIds.size === 0) blockedGesture = false;
      return;
    }

    const shouldBlock = blockedPointerIds.has(pointerId)
      || activePointerId !== null
      || blockedGesture;
    if (!shouldBlock) return;
    if (TOUCH_END_EVENTS.has(event.type)) blockedPointerIds.delete(pointerId);
    blockTouchEvent(event);
    if (activePointerId === null && blockedPointerIds.size === 0) blockedGesture = false;
  };

  const eventTypes = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture'];
  eventTypes.forEach((type) => target.addEventListener(type, handlePointer, {
    capture: true,
    passive: false,
  }));
  target.addEventListener('blur', reset);

  const cleanup = () => {
    eventTypes.forEach((type) => target.removeEventListener(type, handlePointer, true));
    target.removeEventListener('blur', reset);
    reset();
    installedGuards.delete(target);
  };
  installedGuards.set(target, cleanup);
  return cleanup;
}
