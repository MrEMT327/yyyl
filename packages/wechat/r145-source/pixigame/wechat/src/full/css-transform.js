import { cssLength, splitCss } from './css-values.js';

export const identityMatrix = () => [1, 0, 0, 1, 0, 0];
export const hasCssTransform = style => Boolean(style.translate || style.rotate || style.scale || style.transform && style.transform !== 'none');
export function multiplyMatrix(a, b) {
  return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
}
export function transformPoint(matrix, x, y) { return { x: matrix[0]*x+matrix[2]*y+matrix[4], y: matrix[1]*x+matrix[3]*y+matrix[5] }; }
export function cssTransformMatrix(style, box, viewport) {
  const length = (value, percent) => cssLength(value, { ...viewport, percent, fontSize: style.fontSize }, 0);
  let source = style.transform || '';
  if (style.scale) source = `scale(${splitCss(style.scale, ' ').join(',')}) ${source}`;
  if (style.rotate) source = `rotate(${style.rotate}) ${source}`;
  if (style.translate) source = `translate(${splitCss(style.translate, ' ').join(',')}) ${source}`;
  if (!source || source === 'none') return identityMatrix();
  const origins = splitCss(style['transform-origin'] || '50% 50%', ' ').map(value => ({ left: '0%', top: '0%', center: '50%', right: '100%', bottom: '100%' })[value] || value);
  const ox = box.left + length(origins[0], box.width), oy = box.top + length(origins[1] || '50%', box.height);
  let matrix = [1,0,0,1,ox,oy];
  for (const match of source.matchAll(/(matrix|translate(?:X|Y|3d)?|scale(?:X|Y)?|rotate|skew(?:X|Y)?)\(([^)]*)\)/g)) {
    const [name, args] = [match[1], splitCss(match[2])]; let next = identityMatrix();
    if (name === 'matrix' && args.length === 6) next = args.map(Number);
    else if (name.startsWith('translate')) { next[4] = name === 'translateY' ? 0 : length(args[0], box.width); next[5] = name === 'translateX' ? 0 : length(name === 'translateY' ? args[0] : args[1] || '0', box.height); }
    else if (name.startsWith('scale')) { next[0] = name === 'scaleY' ? 1 : Number(args[0]); next[3] = name === 'scaleX' ? 1 : Number(args[1] ?? args[0]); }
    else { const angle = parseFloat(args[0]) * (args[0].endsWith('rad') ? 1 : args[0].endsWith('turn') ? Math.PI * 2 : Math.PI / 180); if (name === 'rotate') next = [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]; else if (name === 'skewY') next[1] = Math.tan(angle); else next[2] = Math.tan(angle); }
    matrix = multiplyMatrix(matrix, next);
  }
  return multiplyMatrix(matrix, [1,0,0,1,-ox,-oy]);
}
