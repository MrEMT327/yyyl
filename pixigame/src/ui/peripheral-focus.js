// Keep logical focus through snapshot-driven DOM replacement without relying on labels.
const controls = 'button,select,input,a[href],[tabindex]';
export function captureFocus(root, element = root.ownerDocument.activeElement) {
  if (!element || !root.contains(element)) return null;
  const attributes = [...element.attributes]
    .filter(a => a.name.startsWith('data-') || a.name === 'aria-label')
    .map(a => [a.name, a.value]);
  if (!attributes.length) return null;
  return { tag: element.tagName, attributes };
}
export function restoreFocus(root, token) {
  if (!token) return false;
  // Values in aria-labels can change after a purchase. Stable data attributes win.
  const data = token.attributes.filter(([name]) => name.startsWith('data-'));
  const attributes = data.length ? data : token.attributes;
  // In the canvas UI a bounds read can run a full layout. Read bounds only for a logical match.
  const match = [...root.querySelectorAll(controls)].find(el =>
    el.tagName === token.tag && !el.disabled && attributes.every(([name, value]) => el.getAttribute(name) === value)
    && !el.closest('[inert]') && el.getClientRects().length);
  if (match && match!==root.ownerDocument.activeElement) match.focus({ preventScroll: true });
  return Boolean(match);
}
export function trapModalTab(event, dialog) {
  if (event.key !== 'Tab' || !dialog) return;
  const items = [...dialog.querySelectorAll(controls)].filter(el =>
    !el.disabled && el.tabIndex >= 0 && el.getClientRects().length);
  const active = dialog.ownerDocument.activeElement;
  if (!items.length) { event.preventDefault(); dialog.focus(); return; }
  if (!items.includes(active) || (event.shiftKey ? active === items[0] : active === items.at(-1))) {
    event.preventDefault();
    (event.shiftKey ? items.at(-1) : items[0]).focus({ preventScroll: true });
  }
}
