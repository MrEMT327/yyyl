import data from '../public/data/ui-animation.json';
import media from '../public/data/ui-animation-assets.json';
import popup from '../public/data/skill-popup-animation.json';
import tiers from '../public/data/ui-tier-animation.json';
import tierMedia from '../public/data/ui-tier-assets.json';
import wavePresentation from '../public/data/wave-presentation.json';
import { OriginalUiRoll } from './ui-roll';
import { OriginalUiBurst } from './ui-burst';
import type { RecordData } from './model';

type Clip = typeof data.clips.Anim_UIFX_STG_SkillSelection;
// Frames retain the original 60 Hz clip samples, rather than replacing Unity curves with CSS easing.
function frame(clip: Clip, time: number) {
  return clip.frames[Math.min(clip.frames.length - 1, Math.max(0, Math.floor(time * clip.fps)))];
}

export class OriginalUpgradeAnimation {
  private started = 0;
  private host: HTMLElement | null = null;
  private images = new Map<string, HTMLImageElement>();
  private cubes: HTMLCanvasElement[] = [];
  private copies: { card: HTMLElement; started: number; showAt: number }[] = [];
  private tintCanvas = document.createElement('canvas');
  private warningCanvas: HTMLCanvasElement | null = null;
  private warningStarted = 0;
  private warningType: 2 | 5 = 2;
  private warningFinish?: () => void;
  private warningClock: () => number = () => performance.now() / 1000;
  private roll = new OriginalUiRoll();
  private burst = new OriginalUiBurst();
  constructor(private sprites: RecordData) {
    this.sprites = { ...sprites, ...media.sprites, ...tierMedia.sprites };
    for (const n of [...Object.values(tiers.tiers).flatMap(t => t.nodes), ...data.warning]) if (n.sprite && this.sprites[n.sprite]) {
      const image = new Image(); image.src = this.sprites[n.sprite].url; this.images.set(n.sprite, image);
    }
    for (const row of Object.values(wavePresentation.types)) for (const key of [row.bgIcon, row.starIcon, row.centerIcon, row.leftIcon, row.rightIcon]) {
      if (!this.images.has(key) && this.sprites[key]) { const image = new Image(); image.src = this.sprites[key].url; this.images.set(key, image); }
    }
  }
  start(host: HTMLElement) {
    this.host = host; this.started = performance.now();
    this.cubes = [...host.querySelectorAll<HTMLCanvasElement>('.original-cube')];
    this.update();
  }
  stop() { this.host = null; this.cubes = []; }
  // Cloned Unity card remains alive across the ordinary -> special panel handoff.
  // cloneNode does not copy canvas pixels, so it needs an independent renderer.
  trackCopy(card: HTMLElement) {
    this.copies.push({ card, started: performance.now(), showAt: Infinity });
    card.querySelectorAll<HTMLCanvasElement>('.original-cube').forEach(c => this.drawCube(c, 0));
  }
  showBreakthrough(card: HTMLElement) {
    const copy = this.copies.find(c => c.card === card);
    if (copy) copy.showAt = performance.now();
  }
  pressCard(card: HTMLElement) {
    const clip = popup.clips.Anim_skillSelectItemPressEnd;
    const scale = clip.bindings.find(b => !b.path && b.attribute === 'scale')!;
    const alpha = clip.bindings.find(b => !b.path && b.attribute === 'm_Alpha')!;
    const y = clip.bindings.find(b => !b.path && b.attribute === 'm_AnchoredPosition.y')!;
    // Unity UI uses 1080 reference pixels; sample the shipped packed curve.
    const unit = (card.closest('#ui') as HTMLElement).clientWidth / 1080;
    card.animate(clip.frames.map((values, i) => ({
      offset: i / (clip.frames.length - 1),
      transform: `translateY(${-values[y.index] * unit}px) scale(${values[scale.index]},${values[scale.index + 1]})`,
      opacity: values[alpha.index],
    })), { duration: clip.duration * 1000, fill: 'forwards', easing: 'linear' });
  }
  showWarning(root: HTMLElement, type: 2 | 5 = 2, onFinish?: () => void, clock: () => number = () => performance.now() / 1000) {
    this.warningCanvas?.remove();
    const canvas = document.createElement('canvas'); canvas.className = 'original-warning';
    canvas.width = 1080; canvas.height = Math.round(1080 * root.clientHeight / root.clientWidth);
    canvas.setAttribute('aria-label', wavePresentation.types[type].text); root.append(canvas);
    this.warningType = type; this.warningFinish = onFinish;
    this.warningClock = clock;
    this.warningCanvas = canvas; this.warningStarted = clock();
  }
  clearWarning() { this.warningCanvas?.remove(); this.warningCanvas = null; this.warningFinish = undefined; }
  update() {
    this.copies = this.copies.filter(copy => copy.card.isConnected);
    this.burst.prune(this.copies.map(copy => copy.card));
    for (const copy of this.copies) {
      const time = (performance.now() - copy.started) / 1000;
      copy.card.querySelectorAll<HTMLCanvasElement>('.original-cube').forEach(c => this.drawCube(c, time));
      if (Number.isFinite(copy.showAt)) this.drawBreakthrough(copy.card, (performance.now() - copy.showAt) / 1000);
    }
    if (this.warningCanvas) {
      const t = this.warningClock() - this.warningStarted;
      // AnimatorListen WarningEnd precedes the final transparent clip tail.
      if (t >= wavePresentation.finishEvent.time && this.warningFinish) { const finish = this.warningFinish; this.warningFinish = undefined; finish(); }
      if (t >= data.clips.Anim_UIFX_Warning.duration) this.clearWarning();
      else this.drawWarning(this.warningCanvas, t);
    }
    if (!this.host) return;
    const time = (performance.now() - this.started) / 1000;
    const clip = data.clips.Anim_UIFX_STG_SkillSelection;
    const values = frame(clip, time);
    const cards = this.host.querySelectorAll<HTMLElement>('.upgrade-card');
    for (const b of clip.bindings) {
      const index = /DankeSelectSkillItem_(\d)$/.exec(b.path);
      const target = b.path.endsWith('/TitleBG') ? this.host.querySelector<HTMLElement>('.upgrade-title') : index ? cards[Number(index[1]) - 1] : null;
      if (!target) continue;
      const v = values[b.index];
      if (b.attribute === 'scale') target.style.transform = `scale(${v},${values[b.index + 1]})`;
      if (b.attribute === 'm_Alpha') target.style.opacity = String(v);
      if (b.attribute === 'm_IsActive') target.style.visibility = v >= .5 ? 'visible' : 'hidden';
    }
    // Keep hidden cards from receiving an accidental choice during their authored reveal.
    cards.forEach(card => { card.style.pointerEvents = Number(card.style.opacity) < .99 ? 'none' : ''; });
    for (const canvas of this.cubes) this.drawCube(canvas, time);
  }
  private drawBreakthrough(card: HTMLElement, time: number) {
    const tier = card.dataset.tier || 'y';
    const clip = tier === 'r' ? popup.clips.Anim_UIFX_SanXuanYi_Red : tier === 'c' ? popup.clips.Anim_UIFX_SanXuanYi_MulColor : popup.clips.Anim_UIFX_SanXuanYi_Golden;
    const values = frame(clip, time), face = card.querySelector<HTMLElement>('.card-face');
    if (!face) return;
    const unit = card.clientWidth / 328;
    const value = (attribute: string) => values[clip.bindings.find(b => b.path === '' && b.attribute === attribute)!.index];
    // Native fg is stretched to its parent. SizeDelta values are authored offsets,
    // not an absolute width/height; preserve its 328x804 reference card size.
    face.style.transform = `translate(${value('m_AnchoredPosition.x') * unit}px,${-value('m_AnchoredPosition.y') * unit}px)`;
    const dx = value('m_SizeDelta.x') * unit, dy = value('m_SizeDelta.y') * unit;
    face.style.width = `calc(100% + ${dx}px)`; face.style.height = `calc(100% + ${dy}px)`;
    face.style.left = `${-dx / 2}px`; face.style.top = `${-dy / 2}px`;
    const active = clip.bindings.find(b => b.path === 'GameObject' && b.attribute === 'm_IsActive')!;
    face.style.visibility = values[active.index] >= .5 ? 'visible' : 'hidden';
    // effectParent is a sibling of GameObject in the APK: hiding the card face
    // must not suppress the later burst during the special-choice handoff.
    this.burst.draw(card, time, value('m_AnchoredPosition.x'), value('m_AnchoredPosition.y'));
  }
  private drawWarning(canvas: HTMLCanvasElement, time: number) {
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const clip = data.clips.Anim_UIFX_Warning, values = frame(clip,time);
    const nodes = data.warning.map(n => ({ ...n, position:{...n.position}, scale:{...n.scale}, size:{...n.size}, anchorMin:{...n.anchorMin}, anchorMax:{...n.anchorMax}, color:n.color ? {...n.color} : {r:1,g:1,b:1,a:1} }));
    const presentation = wavePresentation.types[this.warningType];
    const spriteOverrides: Record<string, string> = {
      'newTweenParent/Image_d_1': presentation.bgIcon,
      'newTweenParent/Image_d_1/Image_4': presentation.starIcon,
      'newTweenParent/Image_1': presentation.centerIcon,
      'newTweenParent/Text_frame/Image_3': presentation.leftIcon,
      'newTweenParent/Text_frame/Image_2': presentation.rightIcon,
    };
    for (const node of nodes) if (spriteOverrides[node.path]) node.sprite = spriteOverrides[node.path];
    for (const b of clip.bindings) {
      const n = nodes.find(n=>n.path===b.path); if (!n) continue;
      const v = values[b.index];
      if (b.attribute==='scale') n.scale = {x:v,y:values[b.index+1],z:values[b.index+2]};
      if (b.attribute==='m_Alpha') n.alpha = v;
      if (b.attribute==='m_IsActive') n.active = v>=.5;
      if (b.attribute==='m_Color.a') n.color.a = v;
      const prop = b.attribute.split('.');
      const vector = ({m_AnchoredPosition:n.position,m_SizeDelta:n.size,m_AnchorMin:n.anchorMin,m_AnchorMax:n.anchorMax} as Record<string,{x:number;y:number}>)[prop[0]];
      if (vector && (prop[1]==='x'||prop[1]==='y')) vector[prop[1]] = v;
    }
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save(); ctx.translate(canvas.width/2,canvas.height/2);
    const draw = (n:typeof nodes[number],parentW:number,parentH:number,parentPivot:{x:number;y:number}) => {
      if (!n.active) return;
      const isRoot = !n.path;
      const w = isRoot ? canvas.width : n.size.x+(n.anchorMax.x-n.anchorMin.x)*parentW;
      const h = isRoot ? canvas.height : n.size.y+(n.anchorMax.y-n.anchorMin.y)*parentH;
      const x = isRoot ? 0 : n.position.x+(n.anchorMin.x+(n.anchorMax.x-n.anchorMin.x)*n.pivot.x-parentPivot.x)*parentW;
      const y = isRoot ? 0 : n.position.y+(n.anchorMin.y+(n.anchorMax.y-n.anchorMin.y)*n.pivot.y-parentPivot.y)*parentH;
      ctx.save(); ctx.translate(x,-y); ctx.rotate(-n.rotation.z*Math.PI/180); ctx.scale(n.scale.x,n.scale.y); ctx.globalAlpha *= n.alpha;
      const image = n.sprite ? this.images.get(n.sprite) : null;
      if (image?.complete && image.naturalWidth && w>0 && h>0) {
        ctx.save(); ctx.globalAlpha *= n.color.a;
        if (n.path.endsWith('/RollImage')) {
          const roll=this.roll.draw(time);
          if (roll) { ctx.globalCompositeOperation='lighter'; ctx.drawImage(roll,-w*n.pivot.x,-h*(1-n.pivot.y),w,h); }
        } else {
          const tint=this.tintCanvas; tint.width=image.naturalWidth; tint.height=image.naturalHeight;
          const tc=tint.getContext('2d')!; tc.drawImage(image,0,0);
          tc.globalCompositeOperation='multiply'; tc.fillStyle=`rgb(${n.color.r*255},${n.color.g*255},${n.color.b*255})`; tc.fillRect(0,0,tint.width,tint.height);
          tc.globalCompositeOperation='destination-in'; tc.drawImage(image,0,0);
          ctx.drawImage(tint,-w*n.pivot.x,-h*(1-n.pivot.y),w,h);
        }
        ctx.restore();
      }
      if (n.text) {
        ctx.save(); ctx.globalAlpha *= n.color.a; ctx.fillStyle = '#fff'; ctx.font = `${n.fontSize}px DankeUI`; ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(presentation.text,0,0); ctx.restore();
      }
      for (const child of nodes.filter(c=>c.path&&c.path.slice(0,Math.max(0,c.path.lastIndexOf('/')))===n.path).sort((a,b)=>a.order-b.order)) draw(child,w,h,n.pivot);
      ctx.restore();
    };
    const root = nodes.find(n=>!n.path); if (root) draw(root,canvas.width,canvas.height,{x:.5,y:.5});
    ctx.restore();
  }
  private drawCube(canvas: HTMLCanvasElement, time: number) {
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const tier = canvas.dataset.tier === 'r' ? tiers.tiers.r : canvas.dataset.tier === 'c' ? tiers.tiers.c : tiers.tiers.y;
    const clip = tier.clip;
    const values = frame(clip, time % clip.duration);
    const nodes = tier.nodes.map(n => ({ ...n, position: { ...n.position }, scale: { ...n.scale }, rotation: { ...n.rotation }, color: n.color ? { ...n.color } : { r: 1, g: 1, b: 1, a: 1 } }));
    for (const b of clip.bindings) {
      const n = nodes.find(n => n.path === b.path); if (!n) continue;
      const v = values[b.index];
      if (b.attribute === 'scale') n.scale = { x: v, y: values[b.index+1], z: values[b.index+2] };
      if (b.attribute === 'euler') n.rotation = { x: v, y: values[b.index+1], z: values[b.index+2] };
      if (b.attribute === 'm_AnchoredPosition.x') n.position.x = v;
      if (b.attribute === 'm_AnchoredPosition.y') n.position.y = v;
      if (b.attribute === 'm_IsActive') n.active = v >= .5;
      if (b.attribute.startsWith('m_Color.')) n.color[b.attribute.slice(-1) as 'r'|'g'|'b'|'a'] = v;
    }
    ctx.clearRect(0,0,328,804);
    ctx.save(); ctx.translate(164,402);
    const draw = (n: typeof nodes[number], parentW: number, parentH: number, parentPivot: { x: number; y: number }) => {
      if (!n.active) return;
      // anchoredPosition is relative to the parent's anchor reference, not its
      // pivot. The hinged cube face has pivot (-.03,.65), so its children need
      // this offset or the inner faces separate from their outlines.
      const w = n.size.x + (n.anchorMax.x - n.anchorMin.x) * parentW;
      const h = n.size.y + (n.anchorMax.y - n.anchorMin.y) * parentH;
      const x = n.position.x + (n.anchorMin.x + (n.anchorMax.x - n.anchorMin.x) * n.pivot.x - parentPivot.x) * parentW;
      const y = n.position.y + (n.anchorMin.y + (n.anchorMax.y - n.anchorMin.y) * n.pivot.y - parentPivot.y) * parentH;
      ctx.save(); ctx.translate(x,-y); ctx.rotate(-n.rotation.z*Math.PI/180); ctx.scale(n.scale.x,n.scale.y);
      const image = n.sprite ? this.images.get(n.sprite) : null;
      if (image?.complete && image.naturalWidth) {
        const tint = this.tintCanvas; tint.width = image.naturalWidth; tint.height = image.naturalHeight;
        const tc = tint.getContext('2d')!; tc.drawImage(image,0,0);
        tc.globalCompositeOperation = 'multiply'; tc.fillStyle = `rgb(${n.color.r*255},${n.color.g*255},${n.color.b*255})`; tc.fillRect(0,0,tint.width,tint.height);
        tc.globalCompositeOperation = 'destination-in'; tc.drawImage(image,0,0); tc.globalCompositeOperation = 'source-over';
        ctx.globalAlpha *= n.color.a;
        ctx.drawImage(tint,-w*n.pivot.x,-h*(1-n.pivot.y),w,h);
      }
      for (const child of nodes.filter(c => c.path && c.path.slice(0,Math.max(0,c.path.lastIndexOf('/'))) === n.path).sort((a,b)=>a.order-b.order)) draw(child,w,h,n.pivot);
      ctx.restore();
    };
    const root = nodes.find(n=>!n.path); if (root) draw(root,328,804,{x:.5,y:.5});
    ctx.restore();
  }
}
