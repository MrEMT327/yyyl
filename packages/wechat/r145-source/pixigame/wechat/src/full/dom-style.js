import { cssLength, expandDeclaration, resolveVariables, resolveEnvironment, splitCss } from './css-values.js';
import { compile } from 'css-select';
import { parse as parseSelector } from 'css-what';
import { mediaMatches } from './media-query.js';
import { compileSharedCss } from './css-compile.js';

const selectorAdapter = {
  isTag: node=>node.nodeType===1,
  getChildren: node=>node.childNodes,
  getParent: node=>node.parentNode,
  getName: node=>node.localName,
  getSiblings: node=>node.parentNode?.childNodes || [node],
  getAttributeValue:(node,name)=>node.getAttribute(name),
  hasAttrib:(node,name)=>node.hasAttribute(name),
  getText:node=>node.textContent,
  existsOne(test,nodes){return nodes.some(node=>node.nodeType===1&&(test(node)||selectorAdapter.existsOne(test,node.childNodes)));},
};

const inherited = ['color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-shadow', 'white-space', 'visibility', 'pointer-events'];
const blockTags = new Set('HTML BODY MAIN SECTION HEADER FOOTER NAV ASIDE DIV P H1 H2 H3 H4 UL OL LI DL DT DD FORM ARTICLE FIGURE FIGCAPTION DETAILS SUMMARY'.split(' '));
const defaults = { display: 'inline', position: 'static', 'box-sizing': 'content-box', color: '#000', 'font-family': 'sans-serif', 'font-size': '16px', 'font-weight': '400', 'line-height': 'normal', visibility: 'visible', opacity: '1', 'pointer-events': 'auto' };
const emptyVariables = Object.freeze({});
const combinators = new Set(['descendant', 'child', 'sibling', 'adjacent', 'parent', 'column-combinator']);

// Each alternative must have a required key before it is safe to omit the
// rule from the universal list. Ancestors, :not() and :has() are not keys.
function selectorIndexKeys(branches) {
  const keys = new Set();
  for (const branch of branches) {
    let start = branch.length;
    while (start > 0 && !combinators.has(branch[start - 1].type)) start--;
    const tail = branch.slice(start);
    const id = tail.find(token => token.type === 'attribute' && token.name === 'id' && token.action === 'equals' && token.ignoreCase !== true);
    const cls = tail.find(token => token.type === 'attribute' && token.name === 'class' && token.action === 'element' && token.ignoreCase !== true);
    const tag = tail.find(token => token.type === 'tag');
    if (id || cls || tag) {
      keys.add(id ? `#${id.value}` : cls ? `.${cls.value}` : tag.name.toLowerCase());
      continue;
    }
    let alternatives = [];
    for (const token of tail) {
      if (token.type !== 'pseudo' || !['is', 'where'].includes(token.name) || !Array.isArray(token.data)) continue;
      alternatives = selectorIndexKeys(token.data);
      if (alternatives.length) break;
    }
    if (!alternatives.length) return [];
    for (const key of alternatives) keys.add(key);
  }
  return [...keys];
}

export function createDomStyles(sheet, viewport, { report = () => {}, fontFamilies = new Map(), environment = {} } = {}) {
  let cache = new WeakMap();
  const declarationExpansions = new Map();
  let layoutStyles, layoutClasses, sharedStyles;
  const adapter = { ...selectorAdapter, getAttributeValue(node, name) {
    if (name !== 'class' || !layoutClasses) return node.getAttribute(name);
    if (!layoutClasses.has(node)) layoutClasses.set(node, node.getAttribute(name));
    return layoutClasses.get(node);
  } };
  const unsupported = new Set();
  const staticSheet=sheet; let documentCss='';
  const ruleGroups = new Map();
  const attributeDependencies = new Set();
  let escapedAttributeDependencies = false;
  let canRefreshPaint = true;
  const paintProperties = new Set(['transform','transform-origin','translate','rotate','scale','opacity','filter','clip-path','mix-blend-mode']);
  function indexRules() {
  ruleGroups.clear();
  attributeDependencies.clear(); escapedAttributeDependencies=false;
  // Animation players publish diagnostics through data-* every frame. Only
  // attributes used by selectors or CSS attr() can change this stylesheet.
  // Use the same parser as selector matching, including nested :is/:has and
  // escaped names. Escapes in attribute VALUES do not affect unrelated keys.
  const collectAttributes=groups=>{for(const group of groups)for(const token of group){
    if(token.type==='attribute')attributeDependencies.add(token.name.toLowerCase());
    if(Array.isArray(token.data))collectAttributes(token.data);
  }};
  const selectorTokens=new Map();
  for(const rule of sheet.rules){
    try{const tokens=parseSelector(rule.selector);selectorTokens.set(rule,tokens);collectAttributes(tokens);}catch{escapedAttributeDependencies=true;}
    for(const [,value]of rule.declarations){
      if(/\battr\(/i.test(value)&&value.includes('\\'))escapedAttributeDependencies=true;
      for(const match of value.matchAll(/\battr\(\s*([\w-]+)/gi))attributeDependencies.add(match[1].toLowerCase());
    }
  }
  // Attribute selectors and explicit inheritance can make a paint-only inline
  // edit affect siblings/descendants. Keep the full cascade in those sheets.
  canRefreshPaint = !sheet.rules.some(rule => /\[\s*style\b/i.test(rule.selector)
    || rule.declarations.some(([key,value]) => key === 'all' || paintProperties.has(key) && /\binherit\b/.test(value)));
  const rules = sheet.rules.filter(rule => (rule.media || []).every(media => mediaMatches(media, viewport))).map((rule,index)=>{
    const tokens = selectorTokens.get(rule), keys = tokens ? selectorIndexKeys(tokens) : [];
    let matches;try{matches=rule.selector.includes(':scope')?node=>node.matches(rule.selector):compile(tokens||rule.selector,{adapter,xmlMode:false,cacheResults:false});}catch{report('selector',rule.selector);matches=()=>false;}
    return {...rule,matches,keys,index,hasContent:rule.declarations.some(([property])=>property==='content')};
  });
  for (const rule of rules) {
    const pseudo=rule.pseudo||'';
    let group=ruleGroups.get(pseudo);
    if(!group){group={indexes:new Map(),universal:[]};ruleGroups.set(pseudo,group);}
    if(rule.hasContent)group.hasContent=true;
    if (!rule.keys.length) group.universal.push(rule);
    for (const key of rule.keys) {
      const rows = group.indexes.get(key) || [];
      rows.push(rule);
      group.indexes.set(key, rows);
    }
  }
  cache=new WeakMap();
  }
  indexRules();
  function syncDocument(document,baseURL) {
    const source=[...document.querySelectorAll('style')].filter(node=>!node.disabled&&(!node.media||mediaMatches(node.media,viewport))).map(node=>node.textContent).join('\n');
    if(source===documentCss)return;
    const dynamic=compileSharedCss(source,{baseURL});
    documentCss=source;
    const offset=Math.max(0,...staticSheet.rules.map(rule=>rule.order+1));
    sheet={...staticSheet,rules:[...staticSheet.rules,...dynamic.rules.map(rule=>({...rule,order:rule.order+offset}))],keyframes:{...staticSheet.keyframes,...dynamic.keyframes}};
    indexRules();
  }
  function candidates(node, pseudo) {
    const group=ruleGroups.get(pseudo);
    if(!group)return [];
    const {indexes,universal}=group;
    return [...universal, ...(indexes.get(node.localName.toLowerCase()) || []), ...(indexes.get(`#${node.id}`) || []),
      ...[...node.classList].flatMap(name => indexes.get(`.${name}`) || [])];
  }
  function matchingRules(node,pseudo,metrics) {
    const matches=[];
    let seen;
    for(const rule of candidates(node,pseudo)){
      if (rule.keys.length > 1) {
        seen ||= new Set();
        if (seen.has(rule)) continue;
        seen.add(rule);
      }
      if(rule.containers?.length&&(!metrics.hasContainer||!rule.containers.every(query=>mediaMatches(query,{width:metrics.containerWidth,height:metrics.containerHeight}))))continue;
      try { if(rule.matches(node))matches.push(rule); }
      catch { if(!unsupported.has(rule.selector)){unsupported.add(rule.selector);report('selector',rule.selector);} }
    }
    return matches;
  }
  function expandedDeclaration(property, value) {
    const key = property + '\0' + value;
    let parts = declarationExpansions.get(key);
    if (!parts) {
      // Many cards share the same computed padding, borders and gap. Keep
      // the expansion after resolving variables and the device safe area.
      parts = Object.entries(expandDeclaration(property, value));
      if (key.length <= 512) {
        if (declarationExpansions.size >= 1024) declarationExpansions.delete(declarationExpansions.keys().next().value);
        declarationExpansions.set(key, parts);
      }
    }
    return parts;
  }
  function read(node, pseudo = '', metrics = {}, generated = false) {
    let entries = cache.get(node);
    if (!entries) { entries = new Map(); cache.set(node, entries); }
    if (entries.has(pseudo)) return entries.get(pseudo);
    const parent = pseudo ? read(node) : node.parentElement && read(node.parentElement);
    // Container sizes can require more than one layout pass over the same DOM.
    // An unchanged containing box and inherited style yield the same cascade.
    const passEntries=layoutStyles?.get(node);
    const previous=passEntries?.get(pseudo);
    const {containerWidth,containerHeight,hasContainer}=metrics;
    if(previous&&previous.parent===parent&&previous.containerWidth===containerWidth
        &&previous.containerHeight===containerHeight&&previous.hasContainer===hasContainer){
      entries.set(pseudo,previous.value);
      return previous.value;
    }
    const rules=matchingRules(node,pseudo,metrics);
    if(generated&&!rules.some(rule=>rule.hasContent))return null;
    const inlineStyle = !pseudo && node.hasAttribute('style') ? node.style : null;
    const hidden = node.hidden;
    let siblings, styleKey;
    if (sharedStyles && !inlineStyle) {
      // Repeated cards still match selectors individually. When their rules,
      // inherited style and containing box agree, resolve the cascade once.
      siblings = sharedStyles.get(parent);
      if (!siblings) sharedStyles.set(parent, siblings = new Map());
      styleKey = JSON.stringify([node.tagName, pseudo, hidden, containerWidth, containerHeight,
        hasContainer, rules.map(rule => rule.index)]);
      const shared = siblings.get(styleKey);
      if (shared) { entries.set(pseudo, shared); return shared; }
    }
    const inheritedVariables = parent?.variables ?? emptyVariables;
    let variables = inheritedVariables;
    const properties = { ...defaults };
    for (const name of inherited) if (parent?.[name] != null) properties[name] = parent[name];
    if (!pseudo && blockTags.has(node.tagName)) properties.display = 'block';
    if (node.tagName === 'BUTTON') Object.assign(properties, { display: 'inline-block', 'text-align': 'center', 'font-family': 'sans-serif', 'font-size': '13px', padding: '2px 6px', border: '2px solid #888' });
    if (['IMG', 'CANVAS', 'IFRAME', 'VIDEO', 'INPUT', 'SELECT', 'TEXTAREA', 'PROGRESS', 'SVG'].includes(node.tagName)) properties.display = 'inline-block';
    if (['STRONG', 'B', 'H1', 'H2', 'H3', 'H4'].includes(node.tagName)) properties['font-weight'] = '700';
    if (['H1', 'H2', 'H3', 'H4'].includes(node.tagName)) properties['font-size'] = `${({ H1: 2, H2: 1.5, H3: 1.17, H4: 1 })[node.tagName]}em`;
    if (node.tagName === 'SMALL') properties['font-size'] = '.833333em';
    const winners = new Map();
    const apply = (property, value, important, rank, order) => {
      const old = winners.get(property), score = [important ? 1 : 0, rank, order];
      if (!old || score[0] > old.score[0] || score[0] === old.score[0] && (score[1] > old.score[1] || score[1] === old.score[1] && score[2] >= old.score[2])) winners.set(property, { value, score });
    };
    for(const rule of rules)
      rule.declarations.forEach(([property,value,important],index)=>apply(property,value,important,rule.specificity,rule.order*10000+index));
    if (inlineStyle) for (let i = 0; i < inlineStyle.length; i++) {
      const name = inlineStyle[i], raw = String(inlineStyle.getPropertyValue(name) ?? '');
      apply(name, raw.replace(/\s*!important\s*$/, ''), /!important\s*$/.test(raw), 1e7, i);
    }
    for (const [key, { value }] of winners) if (key.startsWith('--')) {
      if (variables === inheritedVariables) variables = { ...inheritedVariables };
      variables[key] = resolveEnvironment(value, environment);
    }
    // Resolve shorthands before comparing longhand priority. A late shorthand
    // must replace earlier longhands, and an !important longhand must survive.
    const expanded = new Map();
    for (const [key, entry] of winners) {
      if (key.startsWith('--')) continue;
      const value = resolveEnvironment(resolveVariables(entry.value, variables), environment);
      if (!value) continue;
      for (const [name, part] of expandedDeclaration(key, value)) {
        const old = expanded.get(name);
        const [a, b, c] = entry.score, [x, y, z] = old?.score || [-1, -1, -1];
        if (a > x || a === x && (b > y || b === y && c >= z)) expanded.set(name, { value: part, score: entry.score });
      }
    }
    for (const [key, { value }] of expanded) properties[key] = value === 'inherit' || value === 'unset' && inherited.includes(key) ? parent?.[key] ?? defaults[key] : value === 'initial' ? defaults[key] : value;
    if (hidden || ['STYLE', 'SCRIPT', 'LINK', 'META', 'HEAD', 'TEMPLATE'].includes(node.tagName)) properties.display = 'none';
    const parentFont = parent?.fontSize ?? 16;
    const fontSize = cssLength(properties['font-size'], { ...viewport, ...metrics, fontSize: parentFont, percent: parentFont }, parentFont);
    properties['font-size'] = `${fontSize}px`;
    properties.fontSize = fontSize;
    properties.opacity=String(Math.max(0,Math.min(1,cssLength(properties.opacity,{percent:1},1))));
    properties['font-family'] = splitCss(properties['font-family']).map(name=>{const key=name.replace(/^["']|["']$/g,'');return fontFamilies.has(key)?`"${fontFamilies.get(key)}"`:name;}).join(',');
    properties.variables = variables;
    properties.getPropertyValue = name => name.startsWith('--') ? variables[name] || '' : properties[name] || '';
    const value = new Proxy(properties, { get(target, key) { if (typeof key !== 'string' || key in target) return target[key]; return target[key.replace(/[A-Z]/g, x => `-${x.toLowerCase()}`)] || ''; } });
    entries.set(pseudo, value);
    siblings?.set(styleKey, value);
    if(layoutStyles){
      const results=passEntries||new Map();
      results.set(pseudo,{parent,containerWidth,containerHeight,hasContainer,value});
      if(!passEntries)layoutStyles.set(node,results);
    }
    return value;
  }
  return { read, viewport, get sheet(){return sheet;}, get canRefreshPaint(){return canRefreshPaint;},
    readGenerated(node,pseudo,metrics){return ruleGroups.get(pseudo)?.hasContent ? read(node,pseudo,metrics,true) : null;},
    beginLayout(){layoutStyles=new WeakMap();layoutClasses=new WeakMap();sharedStyles=new Map();},
    endLayout(){layoutStyles=layoutClasses=sharedStyles=null;},
    get computedStyles(){return cache;},
    restoreComputedStyles(styles){cache=styles;},
    affectsAttribute: name => escapedAttributeDependencies || attributeDependencies.has(String(name).toLowerCase()),
    isPaintProperty: name => paintProperties.has(name), syncDocument,
    invalidate(node) { if (node) cache.delete(node); else cache = new WeakMap(); } };
}
