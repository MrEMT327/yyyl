import { bindDragScrolling } from './drag-scrolling.js';
const mountedScrollViews = new WeakMap();

// Legacy callers keep their axis, notifications and wheel API, while sharing
// the same gesture/physics controller with new pages and dynamically added dialogs.
export function createScrollView(element, options = {}) {
  if (!element) return null;
  const axis = ['x', 'y', 'both'].includes(options.axis) ? options.axis : 'y';
  const wheelToAxis = options.wheelToAxis ?? axis === 'x';
  const release = bindDragScrolling(element.ownerDocument);
  element.classList.add('scroll-view', `scroll-view-${axis}`);
  const notify = () => options.onScroll?.({ left: element.scrollLeft, top: element.scrollTop,
    maxLeft: Math.max(0, element.scrollWidth - element.clientWidth),
    maxTop: Math.max(0, element.scrollHeight - element.clientHeight), element });
  const onWheel = event => {
    if (axis === 'y' || !wheelToAxis) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    const max = Math.max(0, element.scrollWidth - element.clientWidth);
    if (!delta || (delta < 0 ? element.scrollLeft <= 0 : element.scrollLeft >= max)) return;
    element.scrollTo({ left: element.scrollLeft + delta, behavior: 'instant' });
    event.preventDefault();
  };
  element.addEventListener('wheel', onWheel, { passive: false });
  element.addEventListener('scroll', notify, { passive: true });
  notify();
  let disposed = false;
  return {
    element, axis, refresh: notify,
    scrollTo({ left = element.scrollLeft, top = element.scrollTop, behavior = 'smooth' } = {}) {
      element.scrollTo({ left, top, behavior });
    },
    destroy() {
      if (disposed) return; disposed = true;
      release();
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('scroll', notify);
      element.classList.remove('scroll-view', 'scroll-view-x', 'scroll-view-y', 'scroll-view-both');
      if (mountedScrollViews.get(element) === this) mountedScrollViews.delete(element);
    },
  };
}
export function mountScrollView(element, options = {}) {
  if (!element) return null;
  mountedScrollViews.get(element)?.destroy();
  const scrollView = createScrollView(element, options);
  mountedScrollViews.set(element, scrollView);
  return scrollView;
}
export function unmountScrollView(element) { mountedScrollViews.get(element)?.destroy(); }
