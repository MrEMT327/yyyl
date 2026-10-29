// Shared pilot card uses the in-battle 三选一.psd skin. Portraits stay unfiltered.
import {pilotCardQuality} from './pilot-card-quality.js';
const RARITIES = new Set(['R', 'SR', 'SSR', 'UR']);
const BASE_URL = import.meta.env?.BASE_URL || '/';
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

// Coordinates follow the triangles already printed in the PSD's centre slice.
// The overlay stretches with that slice; only reflected light moves.
const PRISMS = [
  '133,383 186,405 143,442', '73,416 184,458 89,534',
  '180,425 222,443 191,495', '10,414 63,435 24,466',
  '0,468 73,491 18,547', '158,488 224,510 174,554',
];
function prismLayer(){
 return `<div class="phc-depth" aria-hidden="true"><svg viewBox="24 24 176 514" preserveAspectRatio="none" focusable="false">${PRISMS.map((points,i)=>{const [a,b,c]=points.split(' ');return `<g class="phc-prism" style="--shard-delay:${-i*1.17}s"><polygon class="phc-facet-fill" points="${points}"/><polyline class="phc-facet-recess" points="${b} ${c} ${a}"/><polyline class="phc-facet-bevel" points="${a} ${b}"/><polygon class="phc-facet-trace" points="${points}" pathLength="100"/></g>`;}).join('')}</svg></div>`;
}

function radianceLayer(){
 return `<div class="phc-radiance" aria-hidden="true"><div class="phc-corona"></div><div class="phc-orbit"></div></div><div class="phc-sparks" aria-hidden="true">${Array.from({length:12},(_,i)=>`<i style="--spark-x:${[6,92,12,85,3,95,18,77,9,89,32,68][i]}%;--spark-y:${17+(i*19)%76}%;--spark-size:${i%3===0?7:3}px;--spark-delay:${-i*.61}s;--spark-duration:${3.8+i%4*.7}s"></i>`).join('')}</div><div class="phc-edge-light" aria-hidden="true"></div>`;
}

/** Self-contained card markup. Wrap compact cards in the caller's action button.
 * `interactive` makes a standalone card focusable, with arrow-key lighting.
 * It does not select/recruit a pilot or mutate any game state.
 */
export function pilotHoloCard(pilot, {
  compact = false,
  interactive = false,
  selected = false,
  status = '',
  reveal = false,
  rarity = pilot?.rarity,
  serial = '',
  loading = 'eager',
} = {}) {
  if (!pilot) return '';
  const rank = RARITIES.has(rarity) ? rarity : 'R';
  const quality=pilotCardQuality(rank);
  const framePath=`${BASE_URL}art/psd-choice-v1/${quality.choiceFrame}`;
  const frame=globalThis.document?.baseURI?new URL(framePath,globalThis.document.baseURI).href:framePath;

  const classes = ['pilot-holo-card', compact && 'phc-compact', selected && 'phc-selected', reveal && 'phc-reveal'].filter(Boolean).join(' ');
  const focusX = clamp(Number(pilot.portraitFocus?.x) || 50, 25, 75);
  const portrait = String(pilot.image || '').replace(/^\.\/assets\//, `${BASE_URL}assets/`);
  return `<article class="${classes}" data-holo-card data-holo-rarity="${rank}" data-pilot-id="${escape(pilot.id)}"${interactive ? ' data-holo-interactive tabindex="0"' : ''} aria-label="${escape(`${rank} ${pilot.name} · ${pilot.title || '驾驶员'}${status ? ` · ${status}` : ''}`)}" style="--phc-art-x:${focusX}%;--phc-frame:url('${escape(frame)}');--phc-frame-filter:${quality.frameFilter};--phc-metal:${quality.color};--phc-metal-light:${quality.light};--phc-ink:${quality.ink};--phc-foil-idle:${quality.foil};--phc-foil-active:${quality.foilActive};--phc-glitter-opacity:${quality.glitter};">
    <div class="phc-face">
      ${radianceLayer()}
      ${prismLayer()}
      <div class="phc-art"><img src="${escape(portrait)}" alt="${escape(pilot.name)}" loading="${loading === 'lazy' ? 'lazy' : 'eager'}" decoding="async" draggable="false" /></div>
      <div class="phc-foil" aria-hidden="true"></div>
      <div class="phc-glitter" aria-hidden="true"></div>
      <div class="phc-gloss" aria-hidden="true"></div>
      <div class="phc-lightpass" aria-hidden="true"></div>
      <header class="phc-header"><strong class="phc-heading-name">${escape(pilot.name)}</strong><span class="phc-rarity">${rank}</span></header>
      <div class="phc-caption"><small class="phc-role">驾驶员</small><strong class="phc-title">${escape(pilot.title || '驾驶员')}</strong><strong class="phc-name">${escape(pilot.name)}</strong></div>
      <span class="phc-metadata">${Number.isFinite(pilot.stars) ? `<span aria-label="${pilot.stars} 星">${pilot.stars} 星</span>` : ''}${pilot.skillName ? ' · '+escape(pilot.skillName) : ''}</span>
      ${status ? `<span class="phc-status">${escape(status)}</span>` : ''}
    </div>
  </article>`;
}

/** Delegated interactions survive the lobby replacing page/modal markup. */
export function bindPilotHoloCards(root) {
  if (!root?.addEventListener) return () => {};
  const view = root.ownerDocument?.defaultView || globalThis;
  const motion = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  const requestFrame = view.requestAnimationFrame?.bind(view) || (callback => view.setTimeout(callback, 16));
  const cancelFrame = view.cancelAnimationFrame?.bind(view) || view.clearTimeout.bind(view);
  let active = null;
  let pointerId = null;
  let pending = null;
  let frame = null;
  let captured = null;
  let disposed = false;
  const cardFor = target => {
    const card = target?.closest?.('[data-holo-card]');
    return card && root.contains(card) ? card : null;
  };
  function reset() {
    if (frame !== null) cancelFrame(frame);
    frame = null;
    pending = null;
    if (active) {
      active.classList.remove('is-holo-active');
      for (const property of ['--phc-rx', '--phc-ry', '--phc-px', '--phc-py', '--phc-mx', '--phc-my', '--phc-bg-x', '--phc-bg-y']) active.style.removeProperty(property);
    }
    if (captured && pointerId !== null) {
      try { if (captured.hasPointerCapture?.(pointerId)) captured.releasePointerCapture(pointerId); } catch { /* Card may have been removed by a page change. */ }
    }
    active = null;
    captured = null;
    pointerId = null;
  }
  function update(card, x, y) {
    if (motion?.matches || disposed) return;
    if (active !== card) { reset(); active = card; }
    pending = { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
    if (frame !== null) return;
    frame = requestFrame(() => {
      frame = null;
      if (!active || !pending || !root.contains(active)) { reset(); return; }
      const { x: px, y: py } = pending;
      active.classList.add('is-holo-active');
      const values = {
        '--phc-rx': `${((.5 - py) * 17).toFixed(2)}deg`,
        '--phc-ry': `${((px - .5) * 21).toFixed(2)}deg`,
        '--phc-px': `${(px * 100).toFixed(2)}%`,
        '--phc-py': `${(py * 100).toFixed(2)}%`,
        '--phc-mx': `${((px - .5) * -7).toFixed(2)}px`,
        '--phc-my': `${((py - .5) * -7).toFixed(2)}px`,
        '--phc-bg-x': `${(25 + px * 50).toFixed(2)}%`,
        '--phc-bg-y': `${(25 + py * 50).toFixed(2)}%`,
      };
      for (const [property, value] of Object.entries(values)) active.style.setProperty(property, value);
    });
  }
  function point(card, event) {
    const rect = card.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    update(card, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  }
  const move = event => {
    if (active?.closest?.('.drag-scroll-active') || event.target?.closest?.('.drag-scroll-active')) { reset(); return; }
    if (event.pointerType === 'touch' && event.pointerId !== pointerId) return;
    const card = pointerId === event.pointerId && active ? active : cardFor(event.target);
    if (card) point(card, event);
  };
  const down = event => {
    if (event.isPrimary === false || (event.button !== undefined && event.button !== 0) || motion?.matches) return;
    const card = cardFor(event.target);
    if (!card) return;
    point(card, event);
    pointerId = event.pointerId;
    // Capture only the standalone hero. Collection buttons keep native click
    // targets, and pan-y keeps vertical scrolling on touch devices unchanged.
    if (card.hasAttribute('data-holo-interactive')) {
      try { card.setPointerCapture?.(pointerId); captured = card; } catch { /* Synthetic pointer or removed node. */ }
    }
  };
  const up = event => { if (pointerId === event.pointerId) reset(); };
  const out = event => { if (pointerId === null && active && !active.contains(event.relatedTarget)) reset(); };
  const focus = event => { const card = cardFor(event.target); if (card) update(card, .67, .32); };
  const blur = event => { if (active && !active.contains(event.relatedTarget)) reset(); };
  const key = event => {
    const card = cardFor(event.target);
    if (!card?.hasAttribute('data-holo-interactive') || motion?.matches) return;
    const directions = { ArrowLeft: [.14, .5], ArrowRight: [.86, .5], ArrowUp: [.5, .14], ArrowDown: [.5, .86], Home: [.5, .5] };
    if (event.key === 'Escape') { reset(); return; }
    if (!directions[event.key]) return;
    event.preventDefault();
    update(card, ...directions[event.key]);
  };
  const listeners = { pointermove: move, pointerdown: down, pointerup: up, pointercancel: up, pointerout: out, focusin: focus, focusout: blur, keydown: key };
  for (const [name, listener] of Object.entries(listeners)) root.addEventListener(name, listener);
  // A release outside the root (or a touch scroll cancellation) must not leave
  // the card lit indefinitely. No permanent animation loop is created.
  view.addEventListener?.('pointerup', up);
  view.addEventListener?.('blur', reset);
  motion?.addEventListener?.('change', reset);
  return () => {
    disposed = true;
    reset();
    for (const [name, listener] of Object.entries(listeners)) root.removeEventListener(name, listener);
    view.removeEventListener?.('pointerup', up);
    view.removeEventListener?.('blur', reset);
    motion?.removeEventListener?.('change', reset);
  };
}
