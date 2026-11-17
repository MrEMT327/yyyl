import { cssLength, splitCss } from './css-values.js';

// CSS and JavaScript must see the same touch-screen viewport.
export function mediaMatches(query, viewport) {
  return splitCss(query).some(branch => {
    const negate = /^\s*not\b/i.test(branch);
    let matches = !/\bprint\b/.test(branch);
    for (const part of branch.matchAll(/\(([^()]*)\)/g)) {
      const [feature, raw = ''] = part[1].split(':').map(value => value.trim().toLowerCase());
      const dimension = /^(min-|max-)?(width|height|aspect-ratio)$/.exec(feature);
      if (dimension) {
        const actual = dimension[2] === 'aspect-ratio' ? viewport.width / viewport.height : viewport[dimension[2]];
        const ratio = raw.split('/').map(Number);
        const expected = dimension[2] === 'aspect-ratio' ? ratio[0] / (ratio[1] || 1) : cssLength(raw, viewport);
        matches &&= expected != null && (dimension[1] === 'min-' ? actual >= expected : dimension[1] === 'max-' ? actual <= expected : actual === expected);
      } else if (feature === 'orientation') matches &&= raw === (viewport.height >= viewport.width ? 'portrait' : 'landscape');
      else if (/^(any-)?pointer$/.test(feature)) matches &&= raw === 'coarse';
      else if (/^(any-)?hover$/.test(feature)) matches &&= raw === 'none';
      else if (feature === 'prefers-reduced-motion') matches &&= raw === 'no-preference';
      else if (feature === 'prefers-color-scheme') matches &&= raw === 'light';
      else matches = false;
    }
    return negate ? !matches : matches;
  });
}
