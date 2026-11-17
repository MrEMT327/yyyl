// CSS values used by the shared lobby. Parsing is deliberate: Mini Games do
// not allow eval/new Function, including for calc() or generated layout code.
export function splitCss(value, separator = ',') {
  const result = []; let start = 0, depth = 0, quote = '';
  value = String(value ?? '');
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (quote) { if (c === quote && value[i - 1] !== '\\') quote = ''; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '(' || c === '[') depth++;
    if (c === ')' || c === ']') depth--;
    if (!depth && (separator === ' ' ? /\s/.test(c) : c === separator)) {
      const part = value.slice(start, i).trim(); if (part) result.push(part);
      start = i + 1;
    }
  }
  const last = value.slice(start).trim(); if (last) result.push(last);
  return result;
}

// The authored crop changes the image's natural size before object-fit applies.
export function cssObjectViewBox(value, width, height, context = {}) {
  const full = { x: 0, y: 0, width, height };
  const match = /^inset\((.*)\)$/.exec(String(value || '').trim());
  if (!match || /\bround\b/.test(match[1])) return full;
  const edges = cssEdges(match[1]).map((part, index) => cssLength(part, { ...context, percent: index % 2 ? width : height }, NaN));
  if (edges.some(value => !Number.isFinite(value))) return full;
  const [top, right, bottom, left] = edges;
  return { x: left, y: top, width: Math.max(0, width - left - right), height: Math.max(0, height - top - bottom) };
}

export function resolveVariables(value, variables, seen) {
  value = String(value ?? '');
  let start;
  while ((start = value.indexOf('var(')) >= 0) {
    let end = start + 4, depth = 1;
    for (; end < value.length && depth; end++) {
      if (value[end] === '(') depth++;
      if (value[end] === ')') depth--;
    }
    if (depth) return '';
    const [key, ...fallback] = splitCss(value.slice(start + 4, end - 1));
    const source = seen?.has(key) ? undefined : variables[key];
    const replacement = source == null ? fallback.join(',') : source;
    if (replacement == null || replacement === '') return '';
    value = value.slice(0, start) + resolveVariables(replacement, variables, new Set(seen).add(key)) + value.slice(end);
  }
  return value;
}

// Resolve native viewport insets before layout and painting consume a value.
// Custom properties and env() must see the same device geometry.
export function resolveEnvironment(value, environment = {}) {
  value=String(value ?? '');
  let start;
  while((start=value.indexOf('env('))>=0){
    let end=start+4,depth=1;
    for(;end<value.length&&depth;end++){if(value[end]==='(')depth++;if(value[end]===')')depth--;}
    if(depth)return '';
    const [name,...fallback]=splitCss(value.slice(start+4,end-1));
    const number=environment[name];
    const replacement=Number.isFinite(number)?`${number}px`:resolveEnvironment(fallback.join(',')||'0px',environment);
    value=value.slice(0,start)+replacement+value.slice(end);
  }
  return value;
}

const lengthTokens = new Map();
const simpleLength = /^([+-]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?)(px|%|rem|em|vw|vh|svh|dvh|vmin|vmax|cqw|cqh)?$/;

function resolveLengthUnit(number, unit, context) {
  switch (unit) {
    case '': case 'px': return number;
    case '%': return number * ((context.percent ?? 0) / 100);
    case 'em': return number * (context.fontSize ?? 16);
    case 'rem': return number * (context.rootFontSize ?? 16);
    case 'vw': return number * ((context.width ?? 0) / 100);
    case 'vh': case 'svh': case 'dvh': return number * ((context.height ?? 0) / 100);
    case 'cqw': return number * ((context.containerWidth ?? context.width ?? 0) / 100);
    case 'cqh': return number * ((context.containerHeight ?? context.height ?? 0) / 100);
    case 'vmin': return number * (Math.min(context.width ?? 0, context.height ?? 0) / 100);
    case 'vmax': return number * (Math.max(context.width ?? 0, context.height ?? 0) / 100);
    default: return NaN;
  }
}

export function cssLength(value, context = {}, fallback = undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  const source = String(value ?? '').trim().toLowerCase();
  const simple = simpleLength.exec(source);
  if (simple) {
    const number = resolveLengthUnit(Number(simple[1]), simple[2] ?? '', context);
    return Number.isFinite(number) ? number : fallback;
  }
  if (!source || /^(auto|none|normal|inherit|initial|unset|fit-content|max-content|min-content)$/.test(source)) return fallback;
  let tokens = lengthTokens.get(source);
  if (!tokens) {
    tokens = source.match(/(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?(?:px|%|rem|em|vw|vh|svh|dvh|vmin|vmax|cqw|cqh)?|[a-z_-]+|[()+*/,\-]/g) || [];
    if (source.length <= 256) {
      if (lengthTokens.size >= 1024) lengthTokens.delete(lengthTokens.keys().next().value);
      lengthTokens.set(source, tokens);
    }
  }
  let index = 0;
  const unitValue = token => {
    const match = /^(\d*\.?\d+(?:e[-+]?\d+)?)(.*)$/.exec(token);
    if (!match) return NaN;
    return resolveLengthUnit(Number(match[1]), match[2], context);
  };
  const atom = () => {
    const token = tokens[index++];
    if (token === '-') return -atom();
    if (token === '+') return atom();
    if (token === '(') { const n = sum(); if (tokens[index++] !== ')') return NaN; return n; }
    if (['calc', 'min', 'max', 'clamp', 'env'].includes(token)) {
      if (tokens[index++] !== '(') return NaN;
      if (token === 'env') {
        const name = tokens[index++]; let n = context.env?.[name];
        if (tokens[index] === ',') { index++; const alternative = sum(); n ??= alternative; }
        if (tokens[index++] !== ')') return NaN;
        return n ?? 0;
      }
      const args = [sum()];
      while (tokens[index] === ',') { index++; args.push(sum()); }
      if (tokens[index++] !== ')') return NaN;
      if (token === 'min') return Math.min(...args);
      if (token === 'max') return Math.max(...args);
      if (token === 'clamp') return args.length === 3 ? Math.max(args[0], Math.min(args[2], args[1])) : NaN;
      return args.length === 1 ? args[0] : NaN;
    }
    return unitValue(token || '');
  };
  const product = () => {
    let n = atom();
    while (tokens[index] === '*' || tokens[index] === '/') { const op = tokens[index++], b = atom(); n = op === '*' ? n * b : n / b; }
    return n;
  };
  const sum = () => {
    let n = product();
    while (tokens[index] === '+' || tokens[index] === '-') { const op = tokens[index++], b = product(); n = op === '+' ? n + b : n - b; }
    return n;
  };
  const result = sum();
  return index === tokens.length && Number.isFinite(result) ? result : fallback;
}

export function cssEdges(value) {
  const [a = '0', b = a, c = a, d = b] = splitCss(value, ' ');
  return [a, b, c, d];
}

export function cssBackgroundPosition(value, width, height, imageWidth, imageHeight, context = {}) {
  const parts=splitCss(value||'0% 0%',' '), space=[width-imageWidth,height-imageHeight];
  const keyword=token=>/^(left|right|top|bottom|center)$/.test(token);
  const offset=(token,axis)=>token==='center'?space[axis]/2:/^(right|bottom)$/.test(token)?space[axis]:/^(left|top)$/.test(token)?0:cssLength(token,{...context,percent:space[axis]},0);
  if(parts.length<3){
    let [x='center',y='center']=parts;
    if(/^(top|bottom)$/.test(x)||x==='center'&&/^(left|right)$/.test(y))[x,y]=[y,x];
    return [offset(x,0),offset(y,1)];
  }
  const result=[null,null];
  for(let i=0;i<parts.length;i++){
    const edge=parts[i];if(edge==='center')continue;
    const axis=/^(top|bottom)$/.test(edge)?1:0;
    const distance=!keyword(parts[i+1]||'center')?cssLength(parts[++i],{...context,percent:space[axis]},0):0;
    result[axis]=/^(right|bottom)$/.test(edge)?space[axis]-distance:distance;
  }
  return result.map((position,axis)=>position??space[axis]/2);
}

export function expandDeclaration(property, value) {
  const output = { [property]: value };
  if (['padding', 'margin', 'inset', 'border-width', 'border-color', 'border-style'].includes(property)) {
    const prefix = property.startsWith('border-') ? 'border-' : property === 'inset' ? '' : `${property}-`;
    const suffix = property.startsWith('border-') ? `-${property.slice(7)}` : '';
    cssEdges(value).forEach((part, i) => { output[`${prefix}${['top', 'right', 'bottom', 'left'][i]}${suffix}`] = part; });
  } else if (property === 'gap') {
    const [row, column = row] = splitCss(value, ' '); output['row-gap'] = row; output['column-gap'] = column;
  } else if (/^(padding|margin|inset)-(block|inline)$/.test(property)) {
    const [prefix, axis] = property.split('-'), [first, second = first] = splitCss(value, ' ');
    const stem=prefix==='inset'?'':prefix+'-';
    output[`${stem}${axis === 'block' ? 'top' : 'left'}`] = first;
    output[`${stem}${axis === 'block' ? 'bottom' : 'right'}`] = second;
  } else if (/^(padding|margin|inset)-(block|inline)-(start|end)$/.test(property)) {
    const [prefix,axis,end]=property.split('-');
    output[(prefix==='inset'?'':prefix+'-')+(axis==='block'?(end==='start'?'top':'bottom'):(end==='start'?'left':'right'))]=value;
  } else if (/^border(?:-(top|right|bottom|left))?$/.test(property)) {
    const parts = splitCss(value, ' ');
    for (const side of property === 'border' ? ['top', 'right', 'bottom', 'left'] : [property.slice(7)]) {
      output[`border-${side}-width`] = parts.find(x => /^\d|^(thin|medium|thick)$/.test(x)) || (value === 'none' ? '0' : '3px');
      output[`border-${side}-style`] = parts.find(x => /^(solid|dashed|dotted|double|none)$/.test(x)) || 'none';
      output[`border-${side}-color`] = parts.find(x => /^#|^rgba?\(|^hsla?\(|^(transparent|currentcolor)$/i.test(x)) || 'currentColor';
    }
  } else if (property === 'font') {
    const names = ['font-style','font-weight','font-variant','font-stretch','font-size','line-height','font-family'];
    if (/^(inherit|initial|unset)$/.test(value)) for (const name of names) output[name] = value;
    else {
      const parts = splitCss(value, ' '), sizeIndex = parts.findIndex(part => /^(?:[\d.]+(?:px|em|rem|vw|vh|cqw|cqh|%)|(?:calc|min|max|clamp)\(|(?:xx-small|x-small|small|medium|large|x-large|xx-large)\b)/.test(part));
      if (sizeIndex >= 0) {
        const before = parts.slice(0,sizeIndex), size = splitCss(parts[sizeIndex], '/');
        output['font-size'] = size[0]; output['line-height'] = size[1] || 'normal';
        let familyStart = sizeIndex + 1;
        if (parts[familyStart] === '/') { output['line-height'] = parts[familyStart + 1]; familyStart += 2; }
        output['font-family'] = parts.slice(familyStart).join(' ');
        output['font-weight'] = before.find(part => /^(?:[1-9]\d{0,3}|bold|bolder|lighter)$/.test(part)) || '400';
        output['font-style'] = before.find(part => /^(italic|oblique)$/.test(part)) || 'normal';
      }
    }
  } else if (property === 'flex') {
    const parts = splitCss(value, ' ');
    if (value === 'none') Object.assign(output, { 'flex-grow': '0', 'flex-shrink': '0', 'flex-basis': 'auto' });
    else if (value === 'auto') Object.assign(output, { 'flex-grow': '1', 'flex-shrink': '1', 'flex-basis': 'auto' });
    else Object.assign(output, { 'flex-grow': parts[0], 'flex-shrink': parts[1] || '1', 'flex-basis': parts[2] || '0%' });
  } else if (property === 'place-items') {
    const [a, b = a] = splitCss(value, ' '); output['align-items'] = a; output['justify-items'] = b;
  } else if (property === 'mask' || property === '-webkit-mask') {
    const background=expandDeclaration('background',value);
    for(const name of ['image','position','size','repeat'])output[`mask-${name}`]=background[`background-${name}`];
    const boxes=splitCss(value).map(layer=>splitCss(layer,' ').filter(token=>/^(border|padding|content)-box$/.test(token)));
    output['mask-origin']=boxes.map(parts=>parts[0]||'border-box').join(',');
    output['mask-clip']=boxes.map(parts=>parts.at(-1)||'border-box').join(',');
    output['mask-composite']='add';
  } else if (property === 'background') {
    const images = [], positions = [], sizes = [], repeats = [];
    output['background-color'] = 'transparent';
    for (const layer of splitCss(value)) {
      const [before, after = ''] = splitCss(layer, '/');
      const position = [], size = [], repeat = [];
      let source = 'none';
      for (const [tokens, destination] of [[splitCss(before, ' '), position], [splitCss(after, ' '), size]]) {
        for (const token of tokens) {
          if (/^(?:url|(?:repeating-)?(?:linear|radial|conic)-gradient)\(/.test(token) || token === 'none') source = token;
          else if (/^#|^rgba?\(|^hsla?\(|^color-mix\(|^(transparent|currentcolor|black|white)$/i.test(token)) output['background-color'] = token;
          else if (/^(no-repeat|repeat(?:-x|-y)?|round|space)$/.test(token)) repeat.push(token);
          else if (!/^(scroll|fixed|local|border-box|padding-box|content-box)$/.test(token)) destination.push(token);
        }
      }
      images.push(source); positions.push(position.join(' ') || '0% 0%'); sizes.push(size.join(' ') || 'auto'); repeats.push(repeat.join(' ') || 'repeat');
    }
    output['background-image'] = images.join(','); output['background-position'] = positions.join(',');
    output['background-size'] = sizes.join(','); output['background-repeat'] = repeats.join(',');
  }
  return output;
}
