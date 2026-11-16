import { splitCss,resolveVariables,expandDeclaration } from './css-values.js';

const camel = name => name.replace(/[A-Z]/g, value => `-${value.toLowerCase()}`);
const numbers = /[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi;
function ease(value, easing) {
  if (!easing || easing === 'linear') return value;
  const steps = /^steps\(\s*(\d+)\s*(?:,\s*(start|end|jump-start|jump-end))?\s*\)$/.exec(easing);
  if (steps) {
    const count = Math.max(1, Number(steps[1]));
    return Math.min(1, (Math.floor(value * count) + (/start/.test(steps[2]) ? 1 : 0)) / count);
  }
  const aliases = { ease: [.25, .1, .25, 1], 'ease-in': [.42, 0, 1, 1], 'ease-out': [0, 0, .58, 1], 'ease-in-out': [.42, 0, .58, 1] };
  const curve = aliases[easing] || (/^cubic-bezier\((.*)\)$/.exec(easing)?.[1].split(',').map(Number));
  if (!curve) return value;
  const bezier = (t, a, b) => 3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3;
  let low = 0, high = 1, t = value;
  for (let i = 0; i < 14; i++) { t = (low + high) / 2; if (bezier(t, curve[0], curve[2]) < value) low = t; else high = t; }
  return bezier(t, curve[1], curve[3]);
}
function interpolate(a, b, t) {
  if (a == null) return b;
  if (b == null) return a;
  a = String(a); b = String(b);
  const av = a.match(numbers)?.map(Number), bv = b.match(numbers)?.map(Number);
  if (a.replace(numbers, '#') !== b.replace(numbers, '#') || !av || av.length !== bv?.length) return t < .5 ? a : b;
  let index = 0; return b.replace(numbers, () => { const i = index++; return String(av[i] + (bv[i] - av[i]) * t); });
}
export function createDomAnimations(now = () => performance.now()) {
  const active = new Set();
  const byElement = new Map();
  let revision=0;
  function add(animation) {
    if(!active.has(animation))revision++;
    active.add(animation);
    let rows = byElement.get(animation.element);
    if (!rows) byElement.set(animation.element, rows = new Set());
    rows.add(animation);
  }
  function remove(animation) {
    if(active.delete(animation))revision++;
    const rows = byElement.get(animation.element); rows?.delete(animation);
    if (!rows?.size) byElement.delete(animation.element);
  }
  const cssRows=new Map();
  function animate(element, source, options = {}) {
    if (typeof options === 'number') options = { duration: options };
    let frames = Array.isArray(source) ? source.map(row => ({ ...row })) : [];
    if (!frames.length) {
      const count = Math.max(2, ...Object.values(source).map(value => Array.isArray(value) ? value.length : 1));
      frames = Array.from({ length: count }, (_, i) => Object.fromEntries(Object.entries(source).map(([key, values]) => [key, Array.isArray(values) ? values[Math.min(i, values.length - 1)] : values])));
    }
    frames.forEach((frame, i) => { frame.offset ??= i / Math.max(1, frames.length - 1); });
    let resolve, reject, currentTime=0;
    const duration = Number(options.duration) || 0, delay = Number(options.delay) || 0, iterations = options.iterations ?? 1;
    const started = now();
    const animation = { id: '', element, frames, options, started, duration, delay, iterations, playState: 'running', playbackRate: 1,
      get currentTime(){return currentTime;},
      set currentTime(value){if(value!==currentTime){currentTime=value;revision++;}},
      finished: new Promise((ok, fail) => { resolve = ok; reject = fail; }),
      cancel() { if (animation.playState === 'idle') return; remove(animation); animation.playState = 'idle'; const error = new Error('Animation cancelled'); error.name = 'AbortError'; reject(error); animation.oncancel?.(); },
      finish() { if (animation.playState !== 'running') return; animation.currentTime = delay + duration * iterations; animation.playState = 'finished'; resolve(animation); animation.onfinish?.(); if (!/forwards|both/.test(options.fill)) remove(animation); },
      pause() { animation.playState = 'paused'; },
      play() { animation.started = now() - animation.currentTime; animation.playState = 'running'; add(animation); },
      commitStyles() { Object.assign(element.style, sampleAnimation(animation)); },
    };
    animation.finished.catch(() => {}); add(animation); return animation;
  }
  function sampleAnimation(animation) {
    const elapsed = animation.currentTime - animation.delay;
    if (elapsed < 0 && !/backwards|both/.test(animation.options.fill)) return {};
    let progress = animation.duration ? Math.max(0, elapsed) / animation.duration : 1;
    const cycle = Math.floor(progress);
    progress = progress >= animation.iterations ? 1 : progress % 1;
    if (animation.options.direction === 'reverse' || animation.options.direction?.startsWith('alternate') && cycle % 2 === (animation.options.direction === 'alternate-reverse' ? 0 : 1)) progress = 1 - progress;
    const frames = animation.frames;
    let a = frames[0], b = frames.at(-1);
    for (let i = 1; i < frames.length; i++) if (progress <= frames[i].offset) { a = frames[i - 1]; b = frames[i]; break; }
    const t = ease(Math.max(0, Math.min(1, (progress - a.offset) / Math.max(.00001, b.offset - a.offset))), a.easing || animation.options.easing);
    const output = {};
    for (const name of new Set([...Object.keys(a), ...Object.keys(b)])) if (!['offset', 'easing', 'composite'].includes(name)) output[camel(name)] = interpolate(a[name], b[name], t);
    return output;
  }
  return {
    animate,
    get revision(){return revision;},
    syncCss(rows,sheet,emit){
      const seen=new Set();
      for(const row of rows){if(row.isText)continue;const {element,style}=row;seen.add(element);
        const names=splitCss(style['animation-name']||''),raw=style.animation||'';
        const signature=raw+'|'+['name','duration','timing-function','delay','iteration-count','direction','fill-mode','play-state'].map(name=>style[`animation-${name}`]||'').join('|');
        const previous=cssRows.get(element);if(previous?.signature===signature)continue;
        for(const animation of previous?.animations||[])animation.cancel();const animations=[];cssRows.set(element,{signature,animations});
        const declarations=raw?splitCss(raw):names;
        declarations.forEach((declaration,index)=>{
          const tokens=splitCss(declaration,' '),times=tokens.filter(token=>/^-?[\d.]+m?s$/.test(token));
          const fallbackName=tokens.find(token=>sheet.keyframes[token]);
          const pick=(property,fallback)=>{const list=splitCss(style[`animation-${property}`]||'');return list.length?list[index%list.length]:fallback;};
          const ms=value=>parseFloat(value||0)*(String(value).endsWith('ms')?1:1000);
          const name=pick('name',fallbackName);if(!name||name==='none'||!sheet.keyframes[name])return;
          const duration=ms(pick('duration',times[0]));if(!duration)return;
          const iteration=pick('iteration-count',tokens.find(token=>token==='infinite'||/^\d+(\.\d+)?$/.test(token))||'1');
          const options={duration,delay:ms(pick('delay',times[1])),easing:pick('timing-function',tokens.find(token=>/^(linear|ease|ease-in|ease-out|ease-in-out|cubic-bezier\(|steps\()/.test(token))||'ease'),iterations:iteration==='infinite'?Infinity:Number(iteration),direction:pick('direction',tokens.find(token=>/^(normal|reverse|alternate|alternate-reverse)$/.test(token))||'normal'),fill:pick('fill-mode',tokens.find(token=>/^(forwards|backwards|both)$/.test(token))||'none')};
          const frames=sheet.keyframes[name].flatMap(frame=>splitCss(frame.at).map(at=>{const values={};for(const [property,value]of frame.declarations)Object.assign(values,expandDeclaration(property,resolveVariables(value,style.variables)));return {...values,offset:at==='from'?0:at==='to'?1:parseFloat(at)/100};})).sort((a,b)=>a.offset-b.offset);
          const properties=new Set(frames.flatMap(frame=>Object.keys(frame).filter(key=>key!=='offset'))),base=()=>Object.fromEntries([...properties].map(key=>[key,style[key]||({'transform':'none','opacity':'1'}[key])||'']));
          if(frames[0]?.offset>0)frames.unshift({...base(),offset:0});if(frames.at(-1)?.offset<1)frames.push({...base(),offset:1});
          const animation=animate(element,frames,options);animation.onfinish=()=>emit?.(element,'animationend',{animationName:name});animations.push(animation);
          if(pick('play-state',tokens.includes('paused')?'paused':'running')==='paused')animation.pause();
        });
      }
      for(const [element,row]of cssRows)if(!seen.has(element)){for(const animation of row.animations)animation.cancel();cssRows.delete(element);}
    },
    tick() {
      const time = now();
      for (const animation of active) if (animation.playState === 'running') {
        animation.currentTime = (time - animation.started) * animation.playbackRate;
        if (animation.currentTime >= animation.delay + animation.duration * animation.iterations) animation.finish();
      }
    },
    sample(element, empty = {}) {
      const animations = byElement.get(element);
      if (!animations) return empty;
      const value = {};
      for (const animation of animations) Object.assign(value, sampleAnimation(animation));
      return value;
    },
    forElement(element, subtree = false) { return subtree ? [...active].filter(animation => animation.element === element || element.contains(animation.element)) : [...(byElement.get(element) || [])]; },
    destroy() { for (const animation of [...active]) animation.cancel();cssRows.clear(); },
  };
}
