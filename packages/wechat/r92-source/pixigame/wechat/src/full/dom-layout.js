import { cssLength, splitCss, cssEdges, cssObjectViewBox } from './css-values.js';
import { cssTransformMatrix, hasCssTransform, multiplyMatrix } from './css-transform.js';

const sides = ['top', 'right', 'bottom', 'left'];
const edgeKeys = ['EDGE_TOP', 'EDGE_RIGHT', 'EDGE_BOTTOM', 'EDGE_LEFT'];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const liveTags=new Set(['CANVAS','VIDEO','IFRAME','INPUT','TEXTAREA']);
const blockedControlHit = Symbol('unpainted control');
const maxCachedRows = 2200;
const maxLayoutIdentity = 18000;

export function createDomLayout(host, styles, Yoga, measureContext, {layoutCacheKey} = {}) {
  let dirty = true, running = false, root, records = new WeakMap(), rows = [], generation = 0, deferred = [];
  let paintRevision=0,hasLiveContent=false;
  const pseudoNodes=new WeakMap(), selectLabels=new WeakMap();
  const containerMetrics=new WeakMap();
  const paintChanges = new Set(), textCache = new Map(), glyphCache = new Map();
  const stackingOrders = new WeakMap();
  const cachedLayouts = new Map();
  let activeLayoutKey, fullLayouts = 0, restoredLayouts = 0;
  const measure=host.measurePerformance;
  let layoutMs=0,maximumLayoutMs=0,ignoredDataChanges=0;
  function retain(cache, key, value, limit) {
    if (cache.size >= limit) cache.delete(cache.keys().next().value);
    cache.set(key, value); return value;
  }
  const yogaConfig=Yoga.Config.create();yogaConfig.setPointScaleFactor(0);
  const viewport = { width: host.width, height: host.height };
  const length = (value, style, percent, container = viewport.width) => cssLength(value, { ...viewport, percent, containerWidth: container, fontSize: style.fontSize });
  const font = style => `${style['font-style'] || 'normal'} ${style['font-weight'] || '400'} ${style.fontSize}px ${style['font-family'] || 'sans-serif'}`;
  function glyphWidth(typeface, char) {
    const key = typeface + '\0' + char;
    if (glyphCache.has(key)) return glyphCache.get(key);
    measureContext.font = typeface;
    return retain(glyphCache, key, measureContext.measureText(char).width, 4096);
  }
  function wrapText(text, style, width = Infinity) {
    const typeface = font(style);
    const lineHeight = /^\d*\.?\d+$/.test(style['line-height']) ? Number(style['line-height']) * style.fontSize : length(style['line-height'], style, style.fontSize) || style.fontSize * 1.2;
    const spacing = length(style['letter-spacing'], style, style.fontSize) || 0;
    const nowrap = /nowrap|pre$/.test(style['white-space']);
    const preserve = /pre/.test(style['white-space']);
    const key = JSON.stringify([typeface,lineHeight,spacing,nowrap,preserve,width,text]);
    if (textCache.has(key)) return textCache.get(key);
    const source = preserve ? text : text.replace(/\s+/g, ' ');
    // Yoga stores measured widths as floats. Compare line ends at the same
    // precision, or an exactly fitted label can wrap its final character.
    const layoutWidth = Math.fround(width);
    const lines = []; let current = '', currentWidth = 0;
    for (const paragraph of source.split('\n')) {
      current = ''; currentWidth = 0;
      for (const char of paragraph) {
        const advance = glyphWidth(typeface, char) + spacing;
        if (!nowrap && current && Math.fround(currentWidth + advance) > layoutWidth) { lines.push({ text: current, width: currentWidth }); current = ''; currentWidth = 0; }
        current += char; currentWidth += advance;
      }
      lines.push({ text: current, width: currentWidth });
    }
    const result = { lines, width: Math.max(0, ...lines.map(line => line.width)), height: lines.length * lineHeight, lineHeight, spacing };
    return text.length <= 2048 ? retain(textCache,key,result,512) : result;
  }
  function setDimension(node, method, value, style, basis, container) {
    if (value == null || value === '') return;
    if (value === 'auto') { node[`${method}Auto`]?.(); return; }
    if (/^-?[\d.]+%$/.test(value) && node[`${method}Percent`]) { node[`${method}Percent`](parseFloat(value)); return; }
    const n = length(value, style, basis, container); if (n != null) node[method](n);
  }
  function deferLength(record, value, axis, setter, positioned = false, resolvePercent = false) {
    if (!value || !/[()%]|cq[wh]/.test(value) || !resolvePercent && /^-?[\d.]+%$/.test(value)) return;
    deferred.push(() => {
      let parent = record.parent;
      if (positioned && ['absolute', 'fixed'].includes(record.style.position)) {
        while (parent?.parent && parent.style.position === 'static') parent = parent.parent;
      }
      let size = parent?.box?.[axis] ?? viewport[axis];
      if (!['absolute', 'fixed'].includes(record.style.position)) {
        const padding = parent?.padding || [0,0,0,0];
        size -= axis === 'width' ? padding[1] + padding[3] : padding[0] + padding[2];
      }
      const container = containerSize(record);
      const result = cssLength(value, { ...viewport, percent: size, containerWidth: container.width, containerHeight: container.height, fontSize: record.style.fontSize });
      if (result != null) setter(result);
    });
  }
  function trackSizes(value, available, gap, count, containerWidth = viewport.width) {
    let tokens = splitCss(value || '', ' ');
    if (!tokens.length || value === 'none') return [];
    tokens = tokens.flatMap(token => {
      const repeat = /^repeat\((.*)\)$/.exec(token); if (!repeat) return [token];
      const [number, tracks] = splitCss(repeat[1]);
      if (/^\d+$/.test(number)) return Array(Number(number)).fill(splitCss(tracks, ' ')).flat();
      const min = /minmax\(([^,]+),/.exec(tracks)?.[1], minimum = cssLength(min, {...viewport,containerWidth}, available);
      return Array(clamp(Math.floor((available + gap) / (minimum + gap)), 1, Math.max(1, count))).fill(tracks);
    });
    let fixed = 0, fractions = 0;
    const tracks = tokens.map(token => {
      const minmax = /^minmax\((.*)\)$/.exec(token);
      if (minmax) token = splitCss(minmax[1])[1];
      if (/fr$/.test(token)) { const fraction = parseFloat(token) || 1; fractions += fraction; return { fraction }; }
      if (token === 'auto' || token === 'max-content') return { auto: true };
      const size = cssLength(token, { ...viewport, containerWidth, percent: available }, 0); fixed += size; return { size };
    });
    const remainder = Math.max(0, available - fixed - Math.max(0, tokens.length - 1) * gap);
    for (const track of tracks) if (track.fraction) track.size = remainder * track.fraction / fractions;
    return tracks;
  }
  function containerSize(record) {
    let width, height;
    for (let parent = record.parent; parent; parent = parent.parent) {
      const kind = parent.style['container-type'];
      if (width == null && /size/.test(kind || '')) width = parent.box?.width;
      if (height == null && kind === 'size') height = parent.box?.height;
    }
    return { width: width ?? viewport.width, height: height ?? viewport.height };
  }
  function anonymous(parent, direction) {
    const element = host.document.createElement('div'), node = Yoga.Node.createWithConfig(yogaConfig);
    const record = { element, node, parent, children: [], anonymous: true, style: { display: 'flex', position: 'static', opacity: '1', 'pointer-events': 'none' } };
    node.setFlexDirection(direction); node.setFlexShrink(0); node.setAlignItems(Yoga.ALIGN_STRETCH); node.setPositionType(Yoga.POSITION_TYPE_STATIC);
    records.set(element, record); rows.push(record);
    return record;
  }
  function grid(record, flow, contextWidth, contextHeight, initialContainerWidth) {
    if (!flow.length) return;
    const { node, style } = record;
    const initialColumns = trackSizes(style['grid-template-columns'], contextWidth, 0, flow.length, initialContainerWidth);
    const columnCount = Math.max(1, initialColumns.length);
    const cells = [], occupied = new Set();
    const placement = (value, count) => {
      const [start, end] = splitCss(value || '', '/');
      const line = /^\d+$/.test(start) ? Number(start) - 1 : null;
      const span = /span\s+(\d+)/.exec(end || start || '')?.[1];
      return { start: line, span: span ? Number(span) : end === '-1' && line != null ? count - line : /^\d+$/.test(end) && line != null ? Number(end) - line - 1 : 1 };
    };
    // Explicit grid rows remain in place even when an earlier header is hidden.
    const ordered = [...flow].sort((a, b) => Number(!/\d/.test(a.style['grid-row'] || '')) - Number(!/\d/.test(b.style['grid-row'] || '')));
    let lastRow = 0;
    for (const child of ordered) {
      const column = placement(child.style['grid-column'], columnCount), row = placement(child.style['grid-row'], 1);
      const span = Math.max(1, Math.min(columnCount, column.span));
      let r = row.start ?? 0, c = column.start ?? 0;
      while (c + span > columnCount || Array.from({ length: span }, (_, i) => occupied.has(`${r}:${c + i}`)).some(Boolean)) {
        if (column.start != null || c + span >= columnCount) { r++; c = column.start ?? 0; } else c++;
      }
      for (let i = 0; i < span; i++) occupied.add(`${r}:${c + i}`);
      cells.push({ child, row: r, column: c, span }); lastRow = Math.max(lastRow, r);
    }
    const initialRows = trackSizes(style['grid-template-rows'], contextHeight, 0, lastRow + 1, initialContainerWidth);
    const count = Math.max(lastRow + 1, initialRows.length);
    const rowRecords = Array.from({ length: count }, () => anonymous(record, Yoga.FLEX_DIRECTION_ROW));
    const align = { center: Yoga.ALIGN_CENTER, end: Yoga.ALIGN_FLEX_END, 'flex-end': Yoga.ALIGN_FLEX_END, start: Yoga.ALIGN_FLEX_START, 'flex-start': Yoga.ALIGN_FLEX_START, stretch: Yoga.ALIGN_STRETCH };
    const justify = { center: Yoga.JUSTIFY_CENTER, end: Yoga.JUSTIFY_FLEX_END, 'flex-end': Yoga.JUSTIFY_FLEX_END, start: Yoga.JUSTIFY_FLEX_START, 'flex-start': Yoga.JUSTIFY_FLEX_START };
    for (const cell of cells) {
      const row = rowRecords[cell.row], slot = anonymous(row, Yoga.FLEX_DIRECTION_COLUMN), child = cell.child;
      cell.slot = slot; slot.children.push(child); child.parent = slot;
      slot.node.setAlignItems(align[child.style['justify-self'] || style['justify-items']] ?? (/^(max-content|fit-content)$/.test(child.style.width)?Yoga.ALIGN_FLEX_START:Yoga.ALIGN_STRETCH));
      const vertical = child.style['align-self'] && child.style['align-self'] !== 'auto' ? child.style['align-self'] : style['align-items'];
      slot.node.setJustifyContent(justify[vertical] ?? Yoga.JUSTIFY_FLEX_START);
      child.node.setFlexBasisAuto();child.node.setFlexShrink(1); child.node.setFlexGrow(!vertical || /normal|stretch/.test(vertical) ? 1 : 0);
      // Grid alignment is handled by the cell, not by Yoga's flex align-self.
      child.node.setAlignSelf(Yoga.ALIGN_AUTO);
      slot.node.insertChild(child.node, 0); row.children.push(slot);
    }
    for (let r = 0; r < rowRecords.length; r++) {
      const row = rowRecords[r], members = cells.filter(cell => cell.row === r).sort((a, b) => a.column - b.column);
      row.children = members.map(cell => cell.slot);
      row.children.forEach((slot, i) => row.node.insertChild(slot.node, i));
      row.node.setWidthPercent(100);
    }
    record.children = [...record.children.filter(child => !flow.includes(child)), ...rowRecords];
    node.setFlexDirection(Yoga.FLEX_DIRECTION_COLUMN); node.setFlexWrap(Yoga.WRAP_NO_WRAP); node.setAlignItems(Yoga.ALIGN_STRETCH);
    node.setJustifyContent(Yoga.JUSTIFY_FLEX_START);
    const sizeTracks = () => {
      const padding = record.padding || [0, 0, 0, 0];
      const width = Math.max(0, (record.box?.width ?? contextWidth) - padding[1] - padding[3]);
      const height = Math.max(0, (record.box?.height ?? contextHeight) - padding[0] - padding[2]);
      const container = record.box ? containerSize(record) : { width: initialContainerWidth };
      const colGap = length(style['column-gap'], style, width, container.width) || 0;
      const rowGap = length(style['row-gap'], style, height, container.width) || 0;
      const columns = trackSizes(style['grid-template-columns'], width, colGap, flow.length, container.width);
      if (!columns.length) columns.push({ size: width });
      if(columns.some(col=>col.fraction)){
        // An intrinsic text column takes its space before flexible tracks.
        // Otherwise a 1fr seek bar consumes the time label's entire column.
        columns.forEach((col,index)=>{
          if(!col.auto)return;
          const textCells=cells.filter(cell=>cell.column===index&&cell.span===1&&cell.child.element.childElementCount===0&&cell.child.element.textContent.trim());
          if(textCells.length)col.size=Math.max(...textCells.map(({child})=>{
            const padding=child.padding||[0,0,0,0];return wrapText(child.element.textContent,child.style).width+padding[1]+padding[3];
          }));
        });
        const fractionSpace=Math.max(0,width-columns.reduce((n,col)=>n+(col.fraction?0:col.size||0),0)-colGap*(columnCount-1));
        const fractions=columns.reduce((n,col)=>n+(col.fraction||0),0);
        for(const col of columns)if(col.fraction)col.size=fractionSpace*col.fraction/fractions;
      }
      const unspecified = columns.filter(col => col.size == null).length;
      const remaining = Math.max(0, width - columns.reduce((n, col) => n + (col.size || 0), 0) - colGap * (columnCount - 1));
      for (const col of columns) if (col.size == null) col.size = remaining / Math.max(1, unspecified);
      const tracks = trackSizes(style['grid-template-rows'], height, rowGap, count, container.width);
      const implicit = trackSizes(style['grid-auto-rows'], height, rowGap, count, container.width)[0];
      node.setGap(Yoga.GUTTER_ROW, rowGap); node.setGap(Yoga.GUTTER_COLUMN, 0);
      for (let r = 0; r < count; r++) {
        const row = rowRecords[r], track = tracks[r] || implicit;
        row.node.setGap(Yoga.GUTTER_COLUMN, colGap);
        if (track?.fraction) { row.node.setFlexGrow(track.fraction); row.node.setFlexBasis(0); }
        else if (track?.size != null) row.node.setHeight(track.size);
        else row.node.setFlexGrow(!tracks.some(track => track.fraction) && !implicit?.fraction && (!style['align-content'] || /normal|stretch/.test(style['align-content'])) ? 1 : 0);
      }
      for (const cell of cells) {
        cell.slot.node.setWidth(columns.slice(cell.column, cell.column + cell.span).reduce((n, col) => n + col.size, 0) + colGap * (cell.span - 1));
        const siblings = cells.filter(other => other.row === cell.row && other.column < cell.column);
        const previousEnd = siblings.length ? Math.max(...siblings.map(other => other.column + other.span)) : 0;
        const skipped = cell.column - previousEnd;
        cell.slot.node.setMargin(Yoga.EDGE_LEFT, skipped > 0 ? columns.slice(previousEnd, cell.column).reduce((n, col) => n + col.size, 0) + colGap * skipped : 0);
      }
    };
    sizeTracks(); deferred.push(sizeTracks);
  }
  function build(element, parentStyle, parentWidth, parentHeight, containerWidth, override, containerHeight=viewport.height, hasContainer=false) {
    const isText = element.nodeType === 3;
    const style = override || (isText ? { ...parentStyle, position: 'static', transform: 'none', translate: '', rotate: '', scale: '', opacity: '1', filter: 'none', 'clip-path': 'none', 'mix-blend-mode': 'normal' } : styles.read(element,'',{containerWidth,containerHeight,hasContainer}));
    if (!isText && style.display === 'none') return null;
    if (isText && !element.textContent.trim()) return null;
    if (!isText && liveTags.has(element.tagName) &&
        !(element.tagName === 'CANVAS' && host.isFrameManagedCanvas?.(element))) hasLiveContent=true;
    const node = Yoga.Node.createWithConfig(yogaConfig), record = { element, node, style, children: [], isText, containerWidth, containerHeight, hasContainer };
    records.set(element, record); rows.push(record);
    node.setBoxSizing?.(style['box-sizing'] === 'border-box' ? Yoga.BOX_SIZING_BORDER_BOX : Yoga.BOX_SIZING_CONTENT_BOX);
    if (isText) {
      record.text = element.textContent;
      node.setMeasureFunc((width, mode) => {
        const measured = wrapText(record.text, style, mode === Yoga.MEASURE_MODE_UNDEFINED ? Infinity : width);
        return { width: measured.width, height: measured.height };
      });
      node.setFlexShrink(1);
      return record;
    }
    const contextWidth = length(style.width, style, parentWidth, containerWidth) ?? parentWidth;
    const contextHeight = length(style.height, style, parentHeight, containerWidth) ?? parentHeight;
    if (style['container-type'] && style['container-type'] !== 'normal') {
      containerWidth=containerMetrics.get(element)?.width??contextWidth;hasContainer=true;
      if(style['container-type']==='size')containerHeight=containerMetrics.get(element)?.height??contextHeight;
    }
    node.setPositionType(({ absolute: Yoga.POSITION_TYPE_ABSOLUTE, fixed: Yoga.POSITION_TYPE_ABSOLUTE, relative: Yoga.POSITION_TYPE_RELATIVE, sticky: Yoga.POSITION_TYPE_RELATIVE })[style.position] ?? Yoga.POSITION_TYPE_STATIC);
    node.setFlexDirection(style.display.includes('flex') ? (style['flex-direction'] === 'column' ? Yoga.FLEX_DIRECTION_COLUMN : style['flex-direction'] === 'column-reverse' ? Yoga.FLEX_DIRECTION_COLUMN_REVERSE : style['flex-direction'] === 'row-reverse' ? Yoga.FLEX_DIRECTION_ROW_REVERSE : Yoga.FLEX_DIRECTION_ROW) : Yoga.FLEX_DIRECTION_COLUMN);
    if (style['flex-wrap'] === 'wrap') node.setFlexWrap(Yoga.WRAP_WRAP);
    if (style['flex-wrap'] === 'wrap-reverse') node.setFlexWrap(Yoga.WRAP_WRAP_REVERSE);
    const align = { start: Yoga.ALIGN_FLEX_START, 'flex-start': Yoga.ALIGN_FLEX_START, end: Yoga.ALIGN_FLEX_END, 'flex-end': Yoga.ALIGN_FLEX_END, center: Yoga.ALIGN_CENTER, stretch: Yoga.ALIGN_STRETCH, baseline: Yoga.ALIGN_BASELINE, 'space-between': Yoga.ALIGN_SPACE_BETWEEN, 'space-around': Yoga.ALIGN_SPACE_AROUND, auto: Yoga.ALIGN_AUTO };
    if (style['align-items'] in align) node.setAlignItems(align[style['align-items']]);
    if (style['align-self'] in align) node.setAlignSelf(align[style['align-self']]);
    else if(/^(max-content|fit-content)$/.test(style.width)&&!parentStyle?.display?.includes('flex'))node.setAlignSelf(Yoga.ALIGN_FLEX_START);
    if(parentStyle&&!parentStyle.display.includes('flex')&&parentStyle.display!=='grid'&&style['justify-self'] in align)node.setAlignSelf(align[style['justify-self']]);
    if (style['align-content'] in align) node.setAlignContent(align[style['align-content']]);
    const justify = { start: Yoga.JUSTIFY_FLEX_START, 'flex-start': Yoga.JUSTIFY_FLEX_START, end: Yoga.JUSTIFY_FLEX_END, 'flex-end': Yoga.JUSTIFY_FLEX_END, center: Yoga.JUSTIFY_CENTER, 'space-between': Yoga.JUSTIFY_SPACE_BETWEEN, 'space-around': Yoga.JUSTIFY_SPACE_AROUND, 'space-evenly': Yoga.JUSTIFY_SPACE_EVENLY };
    if (style['justify-content'] in justify) node.setJustifyContent(justify[style['justify-content']]);
    for (const [property, method, basis] of [['width', 'setWidth', parentWidth], ['height', 'setHeight', parentHeight], ['min-width', 'setMinWidth', parentWidth], ['min-height', 'setMinHeight', parentHeight], ['max-width', 'setMaxWidth', parentWidth], ['max-height', 'setMaxHeight', parentHeight], ['flex-basis', 'setFlexBasis', parentWidth]]) {
      if (property === 'flex-basis' && !parentStyle?.display?.includes('flex')) continue;
      if (property === 'flex-basis' && /^-?[\d.]+%$/.test(style[property]) && parentStyle?.['flex-direction']?.startsWith('column') && (!parentStyle.height || parentStyle.height === 'auto')) {
        // A percentage basis is content-sized when the container's main size
        // is indefinite. Yoga otherwise resolves 0% to zero and folds dialogs.
        node.setFlexBasisAuto();continue;
      }
      setDimension(node, method, style[property], style, basis, containerWidth);
      const axis = property.includes('height') || property === 'flex-basis' && parentStyle?.['flex-direction']?.startsWith('column') ? 'height' : 'width';
      deferLength(record, style[property], axis, value => node[method](value), false, property === 'min-height');
    }
    for (const [property, method] of [['flex-grow', 'setFlexGrow'], ['flex-shrink', 'setFlexShrink']]) {
      const value=style[property],fallback=property==='flex-shrink'&&parentStyle?.display?.includes('flex')?1:0;
      // The style proxy returns an empty string for omitted properties. Yoga's
      // default is zero, whereas a CSS flex item shrinks unless explicitly disabled.
      node[method](value==null||value===''?fallback:Number(value));
    }
    const ratio = splitCss(style['aspect-ratio'], '/').map(Number);
    if (ratio[0] > 0 && (ratio.length === 1 || ratio[1] > 0)) node.setAspectRatio(ratio[0] / (ratio[1] || 1));
    for (let i = 0; i < sides.length; i++) {
      const edge = Yoga[edgeKeys[i]], side = sides[i];
      for (const [kind, method] of [['padding', 'setPadding'], ['margin', 'setMargin']]) {
        const value = style[`${kind}-${side}`] || cssEdges(style[kind])[i];
        if (value === 'auto' && kind === 'margin') node.setMarginAuto(edge);
        else if (/^-?[\d.]+%$/.test(value)) node[method + 'Percent'](edge, parseFloat(value));
        else { const px = length(value, style, parentWidth, containerWidth); if (px != null) node[method](edge, px); }
      }
      const border = style[`border-${side}-style`] === 'none' ? 0 : length(style[`border-${side}-width`], style, parentWidth, containerWidth);
      if (border != null) node.setBorder(edge, border);
      const position = style[side];
      if (/^-?[\d.]+%$/.test(position)) node.setPositionPercent(edge, parseFloat(position));
      else { const px = length(position, style, i % 2 ? parentWidth : parentHeight, containerWidth); if (px != null) node.setPosition(edge, px); }
      deferLength(record, position, i % 2 ? 'width' : 'height', value => node.setPosition(edge, value), true);
    }
    if (['absolute','fixed'].includes(style.position)) {
      for (const [axis, first, last, edgeA, edgeB] of [['width','left','right',Yoga.EDGE_LEFT,Yoga.EDGE_RIGHT],['height','top','bottom',Yoga.EDGE_TOP,Yoga.EDGE_BOTTOM]]) {
        const a=style[`margin-${first}`]==='auto',b=style[`margin-${last}`]==='auto';
        if((!a&&!b)||style[first]==null||style[last]==null||style[first]==='auto'||style[last]==='auto')continue;
        deferred.push(()=>{
          let parent=record.parent;while(parent?.parent&&parent.style.position==='static')parent=parent.parent;
          const size=(parent?.box?.[axis]??viewport[axis])-(parent?.node.getComputedBorder(edgeA)||0)-(parent?.node.getComputedBorder(edgeB)||0);
          const available=Math.max(0,size-(record.box?.[axis]||0)-(length(style[first],style,size)||0)-(length(style[last],style,size)||0));
          if(a)node.setMargin(edgeA,available/(a&&b?2:1));if(b)node.setMargin(edgeB,available/(a&&b?2:1));
        });
      }
    }
    const rowGap = length(style['row-gap'], style, contextHeight, containerWidth) || 0;
    const columnGap = length(style['column-gap'], style, contextWidth, containerWidth) || 0;
    node.setGap(Yoga.GUTTER_ROW, rowGap); node.setGap(Yoga.GUTTER_COLUMN, columnGap);
    if (/auto|scroll|hidden|clip/.test(style.overflow || style['overflow-y'])) node.setOverflow(Yoga.OVERFLOW_HIDDEN);
    if (['INPUT', 'TEXTAREA'].includes(element.tagName)) {
      record.replaced=true;
      node.setMeasureFunc((width,wMode,height,hMode)=>{
        const line=wrapText('M',style).lineHeight,multiple=element.tagName==='TEXTAREA';
        const desiredWidth=(Number(element.getAttribute(multiple?'cols':'size'))||20)*style.fontSize*.6;
        const desiredHeight=line*(multiple?Number(element.getAttribute('rows'))||2:1);
        return {width:wMode===Yoga.MEASURE_MODE_EXACTLY?width:Math.min(desiredWidth,wMode===Yoga.MEASURE_MODE_AT_MOST?width:Infinity),height:hMode===Yoga.MEASURE_MODE_EXACTLY?height:Math.min(desiredHeight,hMode===Yoga.MEASURE_MODE_AT_MOST?height:Infinity)};
      });
      return record;
    }
    if (['IMG', 'CANVAS', 'IFRAME', 'VIDEO', 'SVG', 'PROGRESS'].includes(element.tagName)) {
      record.replaced = true;
      node.setMeasureFunc((width, wMode, height, hMode) => {
        let naturalWidth = element.naturalWidth || Number(element.getAttribute('width')) || (element.tagName === 'CANVAS' ? element.width : 0) || 24;
        let naturalHeight = element.naturalHeight || Number(element.getAttribute('height')) || (element.tagName === 'CANVAS' ? element.height : 0) || 24;
        if (element.tagName === 'IMG') {
          if (wMode !== Yoga.MEASURE_MODE_EXACTLY || hMode !== Yoga.MEASURE_MODE_EXACTLY) {
            record.usesIntrinsicImageSize = true;
          }
          const view = cssObjectViewBox(style['object-view-box'], naturalWidth, naturalHeight, { width: host.width, height: host.height, fontSize: style.fontSize, containerWidth });
          naturalWidth = view.width || 1; naturalHeight = view.height || 1;
        }
        let w = wMode === Yoga.MEASURE_MODE_EXACTLY ? width : Math.min(naturalWidth, wMode === Yoga.MEASURE_MODE_AT_MOST ? width : Infinity);
        let h = hMode === Yoga.MEASURE_MODE_EXACTLY ? height : w / naturalWidth * naturalHeight;
        if (hMode === Yoga.MEASURE_MODE_AT_MOST && h > height) { h = height; if (wMode !== Yoga.MEASURE_MODE_EXACTLY) w = h / naturalHeight * naturalWidth; }
        return { width: w, height: h };
      });
      return record;
    }
    if (element.tagName === 'SELECT') {
      let label = selectLabels.get(element);
      if (!label) { label = host.document.createTextNode(''); selectLabels.set(element, label); }
      label.textContent = element.options[element.selectedIndex]?.textContent || '';
      const child = build(label, style, contextWidth, contextHeight, containerWidth, undefined, containerHeight, hasContainer);
      node.setJustifyContent(Yoga.JUSTIFY_CENTER);
      if (child) { child.parent = record; record.children.push(child); node.insertChild(child.node, 0); }
      return record;
    }
    const pseudo = kind => {
      if (override) return null;
      const appearance = styles.readGenerated(element, kind, {containerWidth,containerHeight,hasContainer});
      if (!appearance?.content || ['none', 'normal'].includes(appearance.content) || appearance.display === 'none') return null;
      let nodes=pseudoNodes.get(element);if(!nodes){nodes={};pseudoNodes.set(element,nodes);}
      const node = nodes[kind] ||= host.document.createElement('span');
      const attribute = /^attr\((.*?)\)$/.exec(appearance.content);
      const content = attribute ? element.getAttribute(attribute[1]) || '' : appearance.content.replace(/^['"]|['"]$/g, '').replace(/\\([a-f\d]{1,6})\s?/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
      if (node.textContent!==content) node.textContent = content;
      return { node, appearance };
    };
    const before = pseudo('before'), after = pseudo('after');
    const childNodes = [...(before ? [before.node] : []), ...element.childNodes, ...(after ? [after.node] : [])];
    for (const child of childNodes) {
      if (child.nodeType !== 1 && child.nodeType !== 3) continue;
      const built = build(child, style, contextWidth, contextHeight, containerWidth, child === before?.node ? before.appearance : child === after?.node ? after.appearance : undefined, containerHeight, hasContainer);
      if (built && (child === before?.node || child === after?.node)) { built.pseudo = true; built.pseudoOwner = element; built.pseudoKind = child === before?.node ? 'before' : 'after'; }
      if (built) { built.parent = record; record.children.push(built); }
    }
    const flow = record.children.filter(child => !['absolute', 'fixed'].includes(child.style.position));
    if (!style.display.includes('flex') && style.display !== 'grid' && flow.length && flow.every(child => child.isText || child.style.display.startsWith('inline'))) {
      node.setFlexDirection(Yoga.FLEX_DIRECTION_ROW); node.setFlexWrap(Yoga.WRAP_WRAP); node.setAlignItems(Yoga.ALIGN_BASELINE);
      if (style['text-align'] === 'center') node.setJustifyContent(Yoga.JUSTIFY_CENTER);
      else if (style['text-align'] === 'right') node.setJustifyContent(Yoga.JUSTIFY_FLEX_END);
      // Native HTML buttons center their inline formatting context vertically.
      if (element.tagName === 'BUTTON') { node.setAlignItems(Yoga.ALIGN_CENTER); node.setAlignContent(Yoga.ALIGN_CENTER); }
    }
    if (style.display === 'grid') grid(record, flow, contextWidth, contextHeight, containerWidth);
    record.children.sort((a, b) => Number(a.style.order || 0) - Number(b.style.order || 0));
    record.children.forEach((child, i) => node.insertChild(child.node, i));
    return record;
  }
  function collect(record, x = 0, y = 0) {
    const computed = record.node.getComputedLayout();
    record.box = { x: computed.left, y: computed.top, left: x + computed.left, top: y + computed.top, width: computed.width, height: computed.height };
    record.box.right = record.box.left + record.box.width; record.box.bottom = record.box.top + record.box.height;
    const padding = sides.map((_, i) => record.node.getComputedPadding(Yoga[edgeKeys[i]]) + record.node.getComputedBorder(Yoga[edgeKeys[i]]));
    record.padding = padding;
    if (record.isText) record.textLayout = wrapText(record.text, record.style, computed.width);
    let scrollWidth=computed.width,scrollHeight=computed.height;
    for (const child of record.children) {
      collect(child, record.box.left, record.box.top);
      scrollWidth=Math.max(scrollWidth,child.box.x+child.box.width+padding[1]);
      scrollHeight=Math.max(scrollHeight,child.box.y+child.box.height+padding[2]);
    }
    record.box.scrollWidth=scrollWidth;record.box.scrollHeight=scrollHeight;
  }
  function layoutIdentity() {
    // Keep node identity as well as layout inputs. An equal string from a
    // different element would point hit testing at a detached control.
    const focused=host.document.activeElement;
    const identity=[focused?.isConnected?focused:null];
    function visit(node, inSvg = false) {
      if(node.nodeType===3){identity.push(node,node.data);return;}
      if(node.nodeType!==1)return;
      identity.push(node);
      const tag=node.tagName;
      inSvg ||= tag==='SVG'||tag==='svg';
      for(const {name,value} of node.attributes) {
        if(!inSvg&&name.startsWith('data-')&&!styles.affectsAttribute(name))continue;
        identity.push(name,value);
      }
      if(tag==='SELECT')identity.push(node.selectedIndex);
      if(tag==='CANVAS')identity.push(node.width,node.height,host.isFrameManagedCanvas?.(node));
      identity.push(null);
      for(let child=node.firstChild;child&&identity.length<=maxLayoutIdentity;child=child.nextSibling)visit(child,inSvg);
    }
    visit(host.document.documentElement);
    return identity.length<=maxLayoutIdentity?identity:null;
  }
  function releaseYoga() {
    if(root?.node){
      root.node.freeRecursive();
      for(const record of rows)record.node=null;
    }
    deferred=[];
  }
  function restoreLayout(key, identity) {
    const saved=cachedLayouts.get(key);
    if(!saved||saved.sheet!==styles.sheet||!identity||identity.length!==saved.identity.length
        ||!identity.every((value,index)=>value===saved.identity[index])
        ||!saved.images.every(([image,width,height])=>image.naturalWidth===width&&image.naturalHeight===height))return false;
    releaseYoga();
    ({root,rows,records,hasLiveContent}=saved);
    styles.restoreComputedStyles(saved.computedStyles);
    cachedLayouts.delete(key);
    cachedLayouts.set(key,saved);
    restoredLayouts++;
    return true;
  }
  function saveLayout(key, identity) {
    if(!identity||rows.length>maxCachedRows)return;
    // Store computed geometry and styles. The Yoga tree is only used while
    // computing layout, and can be released before the page is detached.
    releaseYoga();
    const images=rows.filter(record=>record.usesIntrinsicImageSize)
      .map(({element})=>[element,element.naturalWidth,element.naturalHeight]);
    cachedLayouts.delete(key);
    cachedLayouts.set(key,{identity,root,rows,records,hasLiveContent,images,sheet:styles.sheet,computedStyles:styles.computedStyles});
    let retainedRows=0;
    for(const saved of cachedLayouts.values())retainedRows+=saved.rows.length;
    while(cachedLayouts.size>5||retainedRows>maxCachedRows){
      const oldest=cachedLayouts.keys().next().value;
      retainedRows-=cachedLayouts.get(oldest).rows.length;
      cachedLayouts.delete(oldest);
    }
  }
  function update() {
    if(measure)return measure('layout',updateLayout);
    return updateLayout();
  }
  function updateLayout() {
    host.flushMutations?.();
    if (!dirty && paintChanges.size && !running) {
      if(cachedLayouts.get(activeLayoutKey)?.root===root)cachedLayouts.delete(activeLayoutKey);
      const invalidateSubtree = record => {
        if (!record.isText && !record.anonymous) styles.invalidate(record.pseudoOwner || record.element);
        for (const child of record.children) invalidateSubtree(child);
      };
      const refresh = record => {
        if (!record.isText && !record.anonymous) {
          const next = styles.read(record.pseudoOwner || record.element,record.pseudoKind || '',{containerWidth:record.containerWidth,containerHeight:record.containerHeight,hasContainer:record.hasContainer});
          for (const key of new Set([...Object.keys(record.style),...Object.keys(next)])) {
            if (key !== 'variables' && key !== 'getPropertyValue' && !styles.isPaintProperty(key) && next[key] !== record.style[key]) dirty = true;
          }
          record.style = next;
        }
        for (const child of record.children) refresh(child);
      };
      // A changed ancestor already refreshes its children. Avoid running the
      // same selector and inheritance work again for each changed descendant.
      const affected=new Set([...paintChanges].map(element=>records.get(element)).filter(Boolean));
      for (const record of affected) {
        let ancestor=record.parent;
        while(ancestor && !affected.has(ancestor))ancestor=ancestor.parent;
        if (!ancestor) { invalidateSubtree(record); refresh(record); }
      }
      paintChanges.clear();
      paintRevision++;
    }
    if (!dirty || running) return;
    paintChanges.clear();
    running = true; dirty = false; generation++; paintRevision++;
    const started=performance.now();
    try {
      styles.syncDocument?.(host.document,host.baseURL || host.scope.location?.href || 'https://wechat.invalid/');
      activeLayoutKey=layoutCacheKey?.();
      const identity=cachedLayouts.has(activeLayoutKey)?layoutIdentity():null;
      if(!activeLayoutKey||!restoreLayout(activeLayoutKey,identity)) {
        fullLayouts++;
        styles.beginLayout();
        let settled=false;
        for(let containerPass=0;containerPass<4;containerPass++){
          releaseYoga();
          root=null; records=new WeakMap(); rows=[]; hasLiveContent=false; styles.invalidate();
          root=build(host.document.documentElement,null,viewport.width,viewport.height,viewport.width);
          root.node.setWidth(viewport.width); root.node.setHeight(viewport.height); root.node.setPositionType(Yoga.POSITION_TYPE_RELATIVE);
          root.node.calculateLayout(viewport.width,viewport.height,Yoga.DIRECTION_LTR); collect(root);
          // Grid tracks can change the bases of nested calc() lengths. Iterate to
          // stable geometry instead of leaving deeper descendants one frame behind.
          let lengthsSettled=deferred.length===0;
          for(let pass=0;pass<16&&!lengthsSettled;pass++){
            const before=rows.map(record=>[record.box.x,record.box.y,record.box.width,record.box.height]);
            for(const apply of deferred)apply();
            root.node.calculateLayout(viewport.width,viewport.height,Yoga.DIRECTION_LTR); collect(root);
            lengthsSettled=rows.every((record,index)=>[record.box.x,record.box.y,record.box.width,record.box.height]
              .every((value,axis)=>Math.abs(value-before[index][axis])<.01));
          }
          let resized=false;
          for(const record of rows){
            if(!record.style['container-type']||record.style['container-type']==='normal')continue;
            const width=Math.max(0,record.box.width-record.padding[1]-record.padding[3]),height=Math.max(0,record.box.height-record.padding[0]-record.padding[2]),previous=containerMetrics.get(record.element);
            if(!previous||Math.abs(previous.width-width)>.01||Math.abs(previous.height-height)>.01){containerMetrics.set(record.element,{width,height});resized=true;}
          }
          if(!resized){settled=lengthsSettled;break;}
        }
        if(activeLayoutKey&&settled)saveLayout(activeLayoutKey,identity||layoutIdentity());
      }
    } finally { styles.endLayout(); const elapsed=performance.now()-started;layoutMs+=elapsed;maximumLayoutMs=Math.max(maximumLayoutMs,elapsed);running = false; }
    host.notifyResize();
    host.animations?.syncCss?.(rows,styles.sheet,host.emit);
  }
  function offsetRect(box, scrollX, scrollY) {
    const x=box.left-scrollX,y=box.top-scrollY;
    return { x, y, left: x, top: y, width: box.width, height: box.height, right: x + box.width, bottom: y + box.height };
  }
  function visibleRect(record) {
    if (!record) return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0, x: 0, y: 0 };
    let scrollX=0,scrollY=0;
    for (let p=record.parent;p;p=p.parent){scrollX+=p.element.scrollLeft||0;scrollY+=p.element.scrollTop||0;}
    return offsetRect(record.box,scrollX,scrollY);
  }
  function bounds(box,matrix) {
    if(!matrix)return box;
    const [a,b,c,d,x,y]=matrix,left=a*box.left+c*box.top+x,top=b*box.left+d*box.top+y;
    const ax=a*box.width,cx=c*box.height,by=b*box.width,dy=d*box.height;
    const minX=left+Math.min(0,ax)+Math.min(0,cx),maxX=left+Math.max(0,ax)+Math.max(0,cx);
    const minY=top+Math.min(0,by)+Math.min(0,dy),maxY=top+Math.max(0,by)+Math.max(0,dy);
    return {x:minX,y:minY,left:minX,top:minY,right:maxX,bottom:maxY,width:maxX-minX,height:maxY-minY};
  }
  function visualStyle(record, base = record.style) {
    const animation=host.animations?.sample(record.element,null);
    const factor=host.buttonPressScales?.get(record.element);
    if(factor===undefined)return animation?{...base,...animation}:base;
    const style={...base,...animation};
    const axes=splitCss(style.scale,' ').map(Number);
    style.scale=axes.length&&axes.every(Number.isFinite)?axes.map(value=>value*factor).join(' '):String(factor);
    return style;
  }
  function composedTransform(style,box,ancestor) {
    if(!hasCssTransform(style))return ancestor;
    const own=cssTransformMatrix(style,box,viewport);
    return ancestor ? multiplyMatrix(ancestor,own) : own;
  }
  function transformedRect(record) {
    if (!record) return visibleRect(null);
    const path=[];for(let node=record;node;node=node.parent)path.push(node);
    let matrix=null,box,scrollX=0,scrollY=0;
    for(let i=path.length-1;i>=0;i--){
      const node=path[i];
      box=offsetRect(node.box,scrollX,scrollY);
      matrix=composedTransform(visualStyle(node),box,matrix);
      if(i>0){scrollX+=node.element.scrollLeft||0;scrollY+=node.element.scrollTop||0;}
    }
    return bounds(box,matrix);
  }
  function paintOrder(record) {
    let children=stackingOrders.get(record);
    if(!children){
      // Stable sort: auto has stack level zero, with ties in paint order.
      children=record.children.length<2?record.children:[...record.children].sort((a,b)=>(Number(a.style['z-index'])||0)-(Number(b.style['z-index'])||0));
      stackingOrders.set(record,children);
    }
    return children;
  }
  return {
    styles, font, glyphWidth, wrapText, update, get generation() { return generation; },
    get paintRevision() { return paintRevision; },
    get hasLiveContent() { return hasLiveContent; },
    invalidatePaint() { paintRevision++; },
    get stats(){return {fullLayouts,restoredLayouts,nodes:rows.length,totalMs:Math.round(layoutMs),meanMs:Math.round(layoutMs/Math.max(1,generation)*100)/100,maxMs:Math.round(maximumLayoutMs*100)/100,ignoredDataChanges};},
    get tree() { update(); return root; }, get rows() { update(); return rows; },
    invalidate() { dirty = true; },
    invalidateImage(element) {
      // Only images whose natural size was used by Yoga need fresh layout.
      // A hidden image will be measured when its container becomes visible.
      if (records.get(element)?.usesIntrinsicImageSize) dirty = true;
      else paintRevision++;
    },
    invalidateFonts() {
      textCache.clear();
      glyphCache.clear();
      cachedLayouts.clear();
      dirty = true;
    },
    clearCachedLayouts() { cachedLayouts.clear(); },
    invalidateAttribute(element, name) {
      if(!element.isConnected)return;
      // data-* has no intrinsic box behavior. Keep CSS-dependent state, but
      // do not rebuild the entire Yoga tree for a portrait's playback clock.
      if(name?.startsWith('data-') && styles.affectsAttribute && !styles.affectsAttribute(name) && !element.closest('svg')){ignoredDataChanges++;return;}
      // The painter reads these values live. Only a matching attribute
      // selector/attr() rule can make a progress value affect box geometry.
      if(element.tagName==='PROGRESS' && (name==='value'||name==='max') && styles.affectsAttribute && !styles.affectsAttribute(name)){paintRevision++;return;}
      dirty=true;
    },
    invalidateStyle(element, property) {
      const name = typeof property === 'string' ? property.replace(/[A-Z]/g, value => '-' + value.toLowerCase()) : '';
      const record = records.get(element);
      // Restyle the affected subtree; update() falls back to Yoga if any
      // geometric property changes. Attribute selectors retain full cascade.
      if (!dirty && record && styles.canRefreshPaint && styles.isPaintProperty?.(name)) paintChanges.add(element);
      else dirty = true;
    },
    paintRect: visibleRect,
    visualStyle,
    offsetRect,
    paintOrder,
    box(element) { update(); return records.get(element)?.box; },
    rect(element) { update(); return transformedRect(records.get(element)); },
    rawRect(element) { update(); return visibleRect(records.get(element)); },
    record(element) { update(); return records.get(element); },
    hit(x, y, blockedTarget = null, excludedSubtree = null) {
      update();
      const canHitControl = this.canHitControl;
      function find(record, clip, scrollX, scrollY, parentMatrix) {
        if (record.isText || record.pseudo || record.element === excludedSubtree) return null;
        const style=visualStyle(record);
        if(style.visibility==='hidden'||style.visibility==='collapse'||Number(style.opacity)===0)return null;
        const raw=offsetRect(record.box,scrollX,scrollY),matrix=composedTransform(style,raw,parentMatrix);
        const box=bounds(raw,matrix);
        const inBounds=x>=box.left&&x<=box.right&&y>=box.top&&y<=box.bottom;
        if (/hidden|clip|scroll|auto/.test(record.style.overflow || record.style['overflow-y'])) {
          if(!inBounds)return null;
          clip={left:Math.max(clip.left,box.left),top:Math.max(clip.top,box.top),right:Math.min(clip.right,box.right),bottom:Math.min(clip.bottom,box.bottom)};
        }
        const hittable = inBounds && record.style['pointer-events'] !== 'none' && x < box.right && y < box.bottom;
        if (record.element.tagName === 'BUTTON' && canHitControl && !canHitControl(record)) {
          return hittable ? blockedControlHit : null;
        }
        const children=paintOrder(record);
        if(children.length){
          const dx=scrollX+(record.element.scrollLeft||0),dy=scrollY+(record.element.scrollTop||0);
          for(let i=children.length-1;i>=0;i--){const result=find(children[i],clip,dx,dy,matrix);if(result)return result;}
        }
        return hittable ? record.element : null;
      }
      const hit = root&&x>=0&&x<=viewport.width&&y>=0&&y<=viewport.height
        ? find(root,{left:0,top:0,right:viewport.width,bottom:viewport.height},0,0,null) : null;
      return hit === blockedControlHit ? blockedTarget : hit;
    },
    scrollIntoView(element, options = {}) {
      update(); const record = records.get(element); if (!record) return;
      if (typeof options === 'boolean') options = { block: options ? 'start' : 'end' };
      for (let p = record.parent; p; p = p.parent) {
        for (const [axis, position, first, last, extent, mode] of [
          ['x','scrollLeft','left','right','width',options.inline || 'nearest'],
          ['y','scrollTop','top','bottom','height',options.block || 'start'],
        ]) {
          if (!/auto|scroll/.test(p.style['overflow-' + axis] || p.style.overflow)) continue;
          const box=visibleRect(record), parent=visibleRect(p), scroll=p.element[position];
          let delta=0;
          if(mode==='center')delta=(box[first]+box[last]-parent[first]-parent[last])/2;
          else if(mode==='start')delta=box[first]-parent[first];
          else if(mode==='end')delta=box[last]-parent[last];
          else if(box[first]<parent[first]&&box[last]<=parent[last])delta=box[first]-parent[first];
          else if(box[last]>parent[last]&&box[first]>=parent[first])delta=box[last]-parent[last];
          const max=Math.max(0,p.box[axis==='x'?'scrollWidth':'scrollHeight']-parent[extent]);
          p.element[position]=Math.max(0,Math.min(max,scroll+delta));
        }
      }
    },
    destroy() { releaseYoga(); yogaConfig.free(); root = null; rows = []; cachedLayouts.clear(); paintChanges.clear();textCache.clear();glyphCache.clear(); },
  };
}
