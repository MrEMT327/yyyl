import data from '../public/data/ui-animation.json';
import media from '../public/data/ui-animation-assets.json';
import popup from '../public/data/skill-popup-animation.json';
import tiers from '../public/data/ui-tier-animation.json';
import tierMedia from '../public/data/ui-tier-assets.json';
import wavePresentation from '../public/data/wave-presentation.json';
import { OriginalUiRoll } from './ui-roll';
import { ProjectUpgradeBurst } from './ui-burst';
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
  private tintCanvas?: HTMLCanvasElement;
  private warningCanvas: HTMLCanvasElement | null = null;
  private warningPaintEnabled = true;
  private warning: { type: 2 | 5; started: number; clock: () => number; finish?: () => void } | null = null;
  private roll?: OriginalUiRoll;
  private burst = new ProjectUpgradeBurst();
  private externalBursts = new Set<{stage: HTMLElement; tier: string; revealAt: number}>();
  constructor(private sprites: RecordData) {}
  private image(key: string) {
    let image = this.images.get(key);
    if (image) return image;
    const tierSprites: Record<string, {url: string} | undefined> = tierMedia.sprites;
    const animationSprites: Record<string, {url: string} | undefined> = media.sprites;
    const sprite = tierSprites[key] ?? animationSprites[key] ?? this.sprites[key];
    if (sprite) {
      image = new Image(); image.src = sprite.url; this.images.set(key, image);
    }
    return image;
  }
  private preload(keys: (string | null | undefined)[]) {
    for (const key of keys) if (key) this.image(key);
  }
  dispose() {
    this.stop(); this.clearWarning();
    for (const copy of this.copies) copy.card.remove();
    this.copies = []; this.externalBursts.clear(); this.burst.clear();
    this.images.clear();
    if (this.tintCanvas) this.tintCanvas.width = this.tintCanvas.height = 0;
  }
  start(host: HTMLElement) {
    this.host = host; this.started = performance.now();
    this.cubes = [...host.querySelectorAll<HTMLCanvasElement>('.original-cube')];
    if (this.cubes.length) this.preload(Object.values(tiers.tiers).flatMap(t => t.nodes.map(n => n.sprite)));
    this.update();
  }
  stop() { this.host = null; this.cubes = []; }
  // Cloned Unity card remains alive across the ordinary -> special panel handoff.
  // cloneNode does not copy canvas pixels, so it needs an independent renderer.
  trackCopy(card: HTMLElement, startedAt=performance.now()) {
    this.copies.push({ card, started: startedAt, showAt: Infinity });
    card.querySelectorAll<HTMLCanvasElement>('.original-cube').forEach(c => this.drawCube(c, 0));
  }
  showBreakthrough(card: HTMLElement, showAt=performance.now()) {
    const copy = this.copies.find(c => c.card === card);
    if (copy) copy.showAt = showAt;
  }
  showExternalBreakthrough(root: HTMLElement, tier: string, revealAt: number) {
    const stage = root.closest<HTMLElement>('#stage');
    if (!stage) return;
    const burst = { stage, tier, revealAt };
    this.externalBursts.add(burst);
    return () => { this.externalBursts.delete(burst); this.burst.remove(burst); };
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
  useExternalWarning() {
    this.warningPaintEnabled = false;
    this.releaseWarningCanvas();
  }
  private createWarningCanvas(root: HTMLElement, type: 2 | 5) {
    const canvas = document.createElement('canvas'); canvas.className = 'original-warning';
    canvas.width = 1080; canvas.height = Math.round(1080 * root.clientHeight / root.clientWidth);
    canvas.setAttribute('aria-label', wavePresentation.types[type].text); root.append(canvas);
    this.warningCanvas = canvas;
  }
  private releaseWarningCanvas() {
    if (this.warningCanvas) {
      this.warningCanvas.remove();
      this.warningCanvas.width = this.warningCanvas.height = 0;
      this.warningCanvas = null;
    }
  }
  showWarning(root: HTMLElement, type: 2 | 5 = 2, onFinish?: () => void, clock: () => number = () => performance.now() / 1000) {
    this.releaseWarningCanvas();
    if (this.warningPaintEnabled) {
      const row = wavePresentation.types[type];
      this.preload([...data.warning.map(n => n.sprite),row.bgIcon,row.starIcon,row.centerIcon,row.leftIcon,row.rightIcon]);
      this.roll ??= new OriginalUiRoll();
      this.createWarningCanvas(root, type);
    }
    this.warning = { type, started: clock(), clock, finish: onFinish };
  }
  get warningPresentation() {
    const warning = this.warning;
    return warning ? {type:warning.type,elapsed:warning.clock()-warning.started,duration:wavePresentation.duration} : null;
  }
  clearWarning() { this.releaseWarningCanvas(); this.warning = null; }
  update() {
    if (this.copies.length) {
      this.copies = this.copies.filter(copy => {
        if (!copy.card.isConnected) { this.burst.remove(copy.card); return false; }
        const time = (performance.now() - copy.started) / 1000;
        copy.card.querySelectorAll<HTMLCanvasElement>('.original-cube').forEach(c => this.drawCube(c, time));
        if (Number.isFinite(copy.showAt)) this.drawBreakthrough(copy.card, (performance.now() - copy.showAt) / 1000);
        return true;
      });
    }
    for (const burst of this.externalBursts) {
      const {stage,tier,revealAt} = burst, elapsed = (performance.now() - revealAt) / 1000;
      if (!stage.isConnected || (elapsed >= 0 && !this.burst.draw(burst,stage,tier,elapsed))) {
        this.externalBursts.delete(burst);
        this.burst.remove(burst);
      }
    }
    const warning = this.warning;
    if (warning) {
      const t = warning.clock() - warning.started;
      // AnimatorListen WarningEnd precedes the final transparent clip tail.
      if (t >= wavePresentation.finishEvent.time && warning.finish) { const finish = warning.finish; warning.finish = undefined; finish(); }
      if (this.warning === warning) {
        if (t >= wavePresentation.duration) this.clearWarning();
        else if (this.warningCanvas) this.drawWarning(this.warningCanvas, t, warning.type);
      }
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
    this.burst.draw(card,card.closest<HTMLElement>('#stage'),tier,time);
  }
  private drawWarning(canvas: HTMLCanvasElement, time: number, type: 2 | 5) {
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const clip = data.clips.Anim_UIFX_Warning, values = frame(clip,time);
    const nodes = data.warning.map(n => ({ ...n, position:{...n.position}, scale:{...n.scale}, size:{...n.size}, anchorMin:{...n.anchorMin}, anchorMax:{...n.anchorMax}, color:n.color ? {...n.color} : {r:1,g:1,b:1,a:1} }));
    const presentation = wavePresentation.types[type];
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
      const image = n.sprite ? this.image(n.sprite) : null;
      if (image?.complete && image.naturalWidth && w>0 && h>0) {
        ctx.save(); ctx.globalAlpha *= n.color.a;
        if (n.path.endsWith('/RollImage')) {
          const roll=this.roll?.draw(time);
          if (roll) { ctx.globalCompositeOperation='lighter'; ctx.drawImage(roll,-w*n.pivot.x,-h*(1-n.pivot.y),w,h); }
        } else {
          const tint=this.tintCanvas ??= document.createElement('canvas'); tint.width=image.naturalWidth; tint.height=image.naturalHeight;
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
      const image = n.sprite ? this.image(n.sprite) : null;
      if (image?.complete && image.naturalWidth) {
        const tint = this.tintCanvas ??= document.createElement('canvas'); tint.width = image.naturalWidth; tint.height = image.naturalHeight;
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
