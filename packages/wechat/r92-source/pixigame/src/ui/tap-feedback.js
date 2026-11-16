import './tap-feedback.css';

const TAP_SLOP = 10;
const MAX_ACTIVE_PULSES = 8;
const PULSE_DURATION = 440;
const CORE_DURATION = 220;
const PARTICLE_DURATION = 420;
const REDUCED_DURATION = 120;
const EFFECT_PADDING = 50;
const TRIANGLE_ANGLES = [0, 54, 118, 173, 235, 303].map(degrees => degrees * Math.PI / 180);

function containsPoint(rect, { clientX, clientY }) {
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function movedPastSlop(event, start) {
  return Math.hypot(event.clientX - start.clientX, event.clientY - start.clientY) > TAP_SLOP;
}

function makeSprite(doc, size, paint) {
  const sprite = doc.createElement('canvas');
  sprite.width = sprite.height = size;
  const context = sprite.getContext('2d');
  context.translate(size / 2, size / 2);
  paint(context);
  return sprite;
}

function makeSprites(doc) {
  const ring = makeSprite(doc, 96, context => {
    context.strokeStyle = '#91dbff';
    context.lineWidth = 2.4;
    context.shadowColor = '#35a8ff';
    context.shadowBlur = 10;
    context.beginPath();
    context.arc(0, 0, 32, 0, 2 * Math.PI);
    context.stroke();
  });
  const core = makeSprite(doc, 64, context => {
    const glow = context.createRadialGradient(0, 0, 0, 0, 0, 32);
    glow.addColorStop(0, '#def8ffb3');
    glow.addColorStop(.22, '#7bdaff66');
    glow.addColorStop(.68, '#7bdaff00');
    context.fillStyle = glow;
    context.fillRect(-32, -32, 64, 64);
  });
  const triangle = makeSprite(doc, 16, context => {
    const color = context.createLinearGradient(-3, -8, 4, 6);
    color.addColorStop(0, '#d8faff');
    color.addColorStop(.78, '#49b5ff');
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(0, -8);
    context.lineTo(8, 8);
    context.lineTo(-8, 6.4);
    context.closePath();
    context.fill();
  });
  return { ring, core, triangle };
}

const easeOut = progress => 1 - (1 - progress) ** 3;

function drawSprite(context, sprite, size, opacity, y = 0) {
  context.globalAlpha = opacity;
  context.drawImage(sprite, -size / 2, y - size / 2, size, size);
}

function paintPulse(context, sprites, pulse, age, reduced) {
  const progress = age / (reduced ? REDUCED_DURATION : PULSE_DURATION);
  if (reduced) {
    drawSprite(context, sprites.ring, pulse.size * .75, .7 * (1 - progress));
    return;
  }
  const ringSize = pulse.size * 1.5 * (.26 + .74 * easeOut(progress));
  const ringOpacity = progress < .4 ? 1 - .15 * progress / .4 : .85 * (1 - progress) / .6;
  drawSprite(context, sprites.ring, ringSize, ringOpacity);

  if (age < CORE_DURATION) {
    const coreProgress = easeOut(age / CORE_DURATION);
    drawSprite(context, sprites.core, pulse.size * (.4 + .35 * coreProgress), 1 - coreProgress);
  }
  if (age >= PARTICLE_DURATION) return;
  const particleProgress = age / PARTICLE_DURATION;
  const spread = easeOut(particleProgress);
  const opacity = particleProgress < .25 ? .18 + .77 * particleProgress / .25
    : .95 * (1 - particleProgress) / .75;
  TRIANGLE_ANGLES.forEach((angle, index) => {
    const targetDistance = pulse.size * (.58 + (index % 3) * .06);
    const distance = 4 + (targetDistance - 4) * spread;
    const size = (5 + index % 3) * (.45 + .2 * spread);
    context.save();
    context.rotate(pulse.rotation + angle);
    drawSprite(context, sprites.triangle, size, opacity, -distance);
    context.restore();
  });
}

// The feedback layer only schedules frames while a pulse is visible.
export function mountTapFeedback(surface) {
  if (!surface) return () => {};
  const doc = surface.ownerDocument ?? document;
  const view = doc.defaultView ?? globalThis;
  const layer = doc.createElement('canvas');
  const context = layer.getContext?.('2d');
  if (!context) return () => {};
  layer.className = 'tap-feedback-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.width = layer.height = 1;
  doc.body.appendChild(layer);

  const motion = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  const active = [];
  let pendingTap = null;
  let bounds = null;
  let sprites = null;
  let dirty = null;
  let frame = null;

  const clearFrame = () => {
    if (!dirty) return;
    const { left, top, right, bottom } = dirty;
    context.clearRect(left, top, right - left, bottom - top);
    dirty = null;
  };

  const updateBounds = (x, y) => {
    const left = Math.min(bounds?.left ?? Infinity, Math.floor(x - EFFECT_PADDING));
    const top = Math.min(bounds?.top ?? Infinity, Math.floor(y - EFFECT_PADDING));
    const right = Math.max(bounds?.right ?? -Infinity, Math.ceil(x + EFFECT_PADDING));
    const bottom = Math.max(bounds?.bottom ?? -Infinity, Math.ceil(y + EFFECT_PADDING));
    const scale = Math.min(2, view.devicePixelRatio || 1);
    if (bounds?.left === left && bounds.top === top && bounds.right === right &&
        bounds.bottom === bottom && bounds.scale === scale) return;

    bounds = { left, top, right, bottom, scale };
    const width = right - left;
    const height = bottom - top;
    layer.style.left = `${left}px`;
    layer.style.top = `${top}px`;
    layer.style.width = `${width}px`;
    layer.style.height = `${height}px`;
    layer.width = Math.ceil(width * scale);
    layer.height = Math.ceil(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
    dirty = null;
  };

  const resetBounds = () => {
    if (!bounds) return;
    bounds = dirty = null;
    layer.style.width = layer.style.height = '1px';
    layer.width = layer.height = 1;
  };

  const paint = now => {
    frame = null;
    const reduced = motion?.matches;
    const duration = reduced ? REDUCED_DURATION : PULSE_DURATION;
    while (active.length && now - active[0].start >= duration) active.shift();
    if (!active.length) {
      resetBounds();
      return;
    }

    clearFrame();
    for (const pulse of active) {
      const x = pulse.x - bounds.left;
      const y = pulse.y - bounds.top;
      context.save();
      context.translate(x, y);
      paintPulse(context, sprites, pulse, Math.max(0, now - pulse.start), reduced);
      context.restore();
      const left = x - EFFECT_PADDING, top = y - EFFECT_PADDING;
      const right = x + EFFECT_PADDING, bottom = y + EFFECT_PADDING;
      if (!dirty) dirty = { left, top, right, bottom };
      else {
        dirty.left = Math.min(dirty.left, left);
        dirty.top = Math.min(dirty.top, top);
        dirty.right = Math.max(dirty.right, right);
        dirty.bottom = Math.max(dirty.bottom, bottom);
      }
    }
    frame = view.requestAnimationFrame(paint);
  };

  const clearEffects = () => {
    if (frame !== null) view.cancelAnimationFrame(frame);
    frame = null;
    active.length = 0;
    resetBounds();
  };

  const playPulse = (x, y, rect) => {
    updateBounds(x, y);
    sprites ??= makeSprites(doc);
    if (active.length >= MAX_ACTIVE_PULSES) active.shift();
    const size = Math.max(42, Math.min(60, rect.width * .13));
    active.push({ x, y, size, rotation: Math.random() * 2 * Math.PI, start: view.performance.now() });
    if (frame === null) frame = view.requestAnimationFrame(paint);
  };

  const clearTap = () => { pendingTap = null; };
  const onDown = event => {
    if (event.button !== 0) return;
    if (event.isPrimary === false) {
      if (event.pointerType === 'touch') clearTap();
      return;
    }
    const { pointerId, clientX, clientY } = event;
    pendingTap = containsPoint(surface.getBoundingClientRect(), event) ? { pointerId, clientX, clientY } : null;
  };
  const onMove = event => {
    if (pendingTap && event.pointerId === pendingTap.pointerId && movedPastSlop(event, pendingTap)) clearTap();
  };
  const onCancel = event => {
    if (pendingTap?.pointerId === event.pointerId) clearTap();
  };
  const onUp = event => {
    if (!pendingTap || event.pointerId !== pendingTap.pointerId) return;
    const start = pendingTap;
    clearTap();
    if (event.button !== 0 || movedPastSlop(event, start)) return;
    const rect = surface.getBoundingClientRect();
    if (containsPoint(rect, event)) playPulse(event.clientX, event.clientY, rect);
  };
  const onVisibilityChange = () => {
    clearTap();
    if (doc.hidden) clearEffects();
  };

  const options = { capture: true, passive: true };
  const listeners = {
    pointerdown: onDown,
    pointermove: onMove,
    pointerup: onUp,
    pointercancel: onCancel,
    lostpointercapture: onCancel,
    visibilitychange: onVisibilityChange,
  };
  for (const [type, handler] of Object.entries(listeners)) doc.addEventListener(type, handler, options);
  view.addEventListener?.('blur', clearTap);
  const dispose = () => {
    for (const [type, handler] of Object.entries(listeners)) doc.removeEventListener(type, handler, true);
    view.removeEventListener?.('blur', clearTap);
    clearTap();
    clearEffects();
    layer.remove();
  };
  if (import.meta.hot) import.meta.hot.dispose(dispose);
  return dispose;
}
