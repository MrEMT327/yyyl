import postcss from 'postcss';
import { parse } from 'css-what';
import { splitCss } from './css-values.js';

function specificity(tokens) {
  let score = 0;
  for (const token of tokens) {
    if (token.type === 'attribute') score += token.name === 'id' && token.action === 'equals' ? 1e4 : 100;
    else if (token.type === 'tag' || token.type === 'pseudo-element') score++;
    else if (token.type === 'pseudo') {
      if (token.name === 'where') continue;
      score += ['is', 'not', 'has'].includes(token.name) && Array.isArray(token.data) ? Math.max(0, ...token.data.map(specificity)) : 100;
    }
  }
  return score;
}

export function compileSharedCss(source, { baseURL }) {
  const css = postcss.parse(source), rules = [], fonts = [], keyframes = {};
  let order = 0;
  const declarations = node => (node.nodes || []).filter(child => child.type === 'decl').map(child => [child.prop, child.value.replace(/url\((['"]?)(.*?)\1\)/g, (_, _quote, path) => `url("${/^(data:|wxfile:)/.test(path) ? path : new URL(path, baseURL).href}")`), Boolean(child.important)]);
  function visit(node, media = [], containers = []) {
    for (const child of node.nodes || []) {
      if (child.type === 'rule') {
        for (const raw of splitCss(child.selector)) {
          const pseudo = /::?(before|after|-webkit-progress-value|-webkit-progress-bar|-moz-progress-bar)$/.exec(raw)?.[1] || '';
          if (/::/.test(raw) && !pseudo) continue;
          const selector = pseudo ? raw.replace(/::?(before|after|-webkit-progress-value|-webkit-progress-bar|-moz-progress-bar)$/, '') : raw;
          // Touch devices have no hover state. These rules cannot win cascade.
          if (/:hover\b|:focus-visible\b/.test(selector)) continue;
          const parsed = parse(selector), rank = Math.max(...parsed.map(specificity));
          const compound = [];for(const token of parsed[0]) { if(['descendant','child','sibling','adjacent','parent'].includes(token.type))compound.length=0;else compound.push(token); }
          const id=compound.find(token=>token.type==='attribute'&&token.name==='id'&&token.action==='equals');
          const cls=compound.find(token=>token.type==='attribute'&&token.name==='class'&&token.action==='element');
          const tag=compound.find(token=>token.type==='tag');
          const indexKey=id?`#${id.value}`:cls?`.${cls.value}`:tag?.name || '';
          rules.push({ selector, indexKey, pseudo, specificity: rank, order: order++, media, containers, declarations: declarations(child) });
        }
      } else if (child.type === 'atrule') {
        if (child.name === 'media') visit(child, [...media, child.params], containers);
        else if (child.name === 'container') visit(child, media, [...containers,child.params]);
        else if (child.name === 'font-face') fonts.push(Object.fromEntries(declarations(child).map(([a, b]) => [a, b])));
        else if (child.name.endsWith('keyframes')) keyframes[child.params] = (child.nodes || []).map(frame => ({ at: frame.selector, declarations: declarations(frame) }));
        else if (['supports', 'layer'].includes(child.name)) visit(child, media, containers);
      }
    }
  }
  visit(css);
  return { rules, fonts, keyframes };
}
