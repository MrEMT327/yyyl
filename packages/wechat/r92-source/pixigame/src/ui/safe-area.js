// Insets are viewport-relative; a centered game frame may already avoid them.
export function frameSafeInsets({ top = 0, bottom, height, viewportHeight, safeTop = 0, safeBottom = 0, topGap = 0 }) {
  const insetTop = Math.min(Math.max(0, height - 1), Math.max(0, safeTop - top) + Math.max(0, topGap));
  const insetBottom = Math.min(Math.max(0, height - insetTop - 1), Math.max(0, bottom - (viewportHeight - safeBottom)));
  return { top: insetTop, bottom: insetBottom };
}
