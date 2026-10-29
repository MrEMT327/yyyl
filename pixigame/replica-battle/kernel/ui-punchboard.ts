import data from '../public/data/punchboard-ui.json';
import type { Choice, RecordData } from './model';

type Node = RecordData;
type Clip = { duration: number; fps: number; bindings: {path: string; attribute: string; index: number}[]; frames: number[][] };

/** Original UI_Punchboard geometry and clips. Presentation never rerolls rewards. */
export class OriginalPunchboard {
  private canvas: HTMLCanvasElement | null = null;
  private button: HTMLButtonElement | null = null;
  private stage: 'idle' | 'rolling' | 'result' = 'idle';
  private started = 0;
  private phaseStarted = 0;
  private rewards: Choice[] = [];
  private slots: {icon: string; name: string}[] = [];
  private stops: number[] = [];
  private steps: {at: number; slot: number; reward: number}[] = [];
  private images = new Map<string, HTMLImageElement>();
  private tinted = new Map<string, HTMLCanvasElement>();
  private soundStep=-1;
  constructor(private sprites: RecordData, private feedback: (key:'wheelTick'|'wheelResult')=>void = () => {}) {}
  private image(key: string) {
    if (!this.images.has(key) && this.sprites[key]) {
      const image = new Image(); image.src = this.sprites[key].url; this.images.set(key,image);
    }
    return this.images.get(key);
  }
  mount(host: HTMLElement, rewards: Choice[], pool: {icon: string; name: string}[]) {
    this.stop(); this.rewards = rewards; this.stage = rewards.length ? 'idle' : 'result';
    this.started = this.phaseStarted = performance.now();
    const choices = pool.length ? pool : rewards;
    this.slots = Array.from({length:16},(_,i)=>choices[i % Math.max(1,choices.length)] || {icon:'10000101',name:'速射机炮'});
    this.stops = rewards.map((_,i)=>Math.floor((i+.5)*16/rewards.length));
    this.stops.forEach((slot,i)=>this.slots[slot]=rewards[i]);
    host.innerHTML = '<section class="punchboard-screen" role="dialog" aria-modal="true" aria-label="战斗补给"><canvas class="punchboard-canvas" aria-hidden="true"></canvas><button class="punchboard-confirm" data-action="punchboard"><span>开始</span></button><div class="punchboard-accessible" aria-live="polite"></div></section>';
    this.canvas = host.querySelector('canvas'); this.button = host.querySelector('button');
    this.button!.style.backgroundImage = `url("${this.sprites.stg_pause_resume.url}")`;
    for (const n of [...data.board,...data.slot,...data.result]) if (n.sprite) this.image(n.sprite);
    for (const c of [...this.slots,...rewards]) this.image(c.icon);
    for (const size of ['S1','S2','M1','M2','L1','L2']) for (const color of ['yellow','red','multicolor','grey']) this.image(`Choose_skills_${size}_normal_${color}`);
    this.update();
  }
  stop() { this.canvas = null; this.button = null; this.steps = []; }
  /** true means close the existing result, not award it a second time. */
  activate(): boolean {
    if (!this.button || this.button.disabled) return false;
    if (this.stage === 'result') return true;
    this.phaseStarted = performance.now();
    if (this.stage === 'rolling') { this.showResult(); return false; }
    this.stage = 'rolling'; this.steps=[];this.soundStep=-1;
    // Native fast/multiple intervals and Select clip. Landing deceleration is
    // adapted to the local skill pool; it is not a full native state-machine port.
    let at=0,slot=-1;
    const step=(interval:number,reward=-1)=>{at+=interval;slot=(slot+1)%16;this.steps.push({at,slot,reward});};
    if(this.rewards.length>1) for(let i=0;i<16;i++) step(.07);
    for(let i=0;i<96;i++) step(.03);
    this.stops.forEach((stop,reward)=>{
      const distance=(stop-slot+16)%16 || 16;
      for(let i=0;i<distance;i++) step(.05 + .02*i);
      this.steps[this.steps.length-1].reward=reward;
      at+=.6;
    });
    this.steps.push({at:at+.1,slot,reward:-2});
    return false;
  }
  private showResult() {
    this.stage='result';this.phaseStarted=performance.now();
    if(this.rewards.length)this.feedback('wheelResult');
    const live=this.canvas?.parentElement?.querySelector('.punchboard-accessible');
    if(live) live.textContent=this.rewards.map(c=>c.name).join('、') || '当前武器已无可用强化';
  }
  private nodes(source: readonly unknown[]): Node[] { return source.map(n=>structuredClone(n)) as Node[]; }
  private animate(nodes: Node[],clip: Clip,time: number,prefix='',loop=false) {
    const t=loop&&clip.duration?time%clip.duration:time;
    const values=clip.frames[Math.min(clip.frames.length-1,Math.max(0,Math.floor(t*clip.fps)))];
    for(const b of clip.bindings) for(const n of nodes.filter(n=>n.path===(prefix?prefix+(b.path?'/':''):'')+b.path)) {
      const v=values[b.index];
      if(b.attribute==='scale') n.scale={x:v,y:values[b.index+1],z:values[b.index+2]};
      else if(b.attribute==='euler') n.rotation=values[b.index+2];
      else if(b.attribute==='m_IsActive') n.active=v>=.5;
      else if(b.attribute==='m_Alpha') n.alpha=v;
      else if(b.attribute.startsWith('m_Color.')) n.color[b.attribute.slice(-1)]=v;
      else if(b.attribute==='m_AnchoredPosition.x') n.position.x=v;
      else if(b.attribute==='m_AnchoredPosition.y') n.position.y=v;
    }
  }
  private draw(ctx: CanvasRenderingContext2D,nodes: Node[],pw: number,ph: number) {
    const visit=(n:Node,parentW:number,parentH:number,pivot:{x:number;y:number})=>{
      if(!n.active) return;
      const w=n.size.x+(n.anchorMax.x-n.anchorMin.x)*parentW,h=n.size.y+(n.anchorMax.y-n.anchorMin.y)*parentH;
      const x=n.position.x+(n.anchorMin.x+(n.anchorMax.x-n.anchorMin.x)*n.pivot.x-pivot.x)*parentW;
      const y=n.position.y+(n.anchorMin.y+(n.anchorMax.y-n.anchorMin.y)*n.pivot.y-pivot.y)*parentH;
      ctx.save();ctx.translate(x,-y);ctx.rotate(-n.rotation*Math.PI/180);ctx.scale(n.scale.x,n.scale.y);ctx.globalAlpha*=Math.max(0,Math.min(1,n.alpha));
      const image=n.sprite?this.image(n.sprite):null;
      if(image?.complete&&image.naturalWidth) {
        ctx.save();ctx.globalAlpha*=Math.max(0,Math.min(1,n.color.a));
        let surface:CanvasImageSource=image;
        if(n.color.r<.999||n.color.g<.999||n.color.b<.999) {
          const rgb=[n.color.r,n.color.g,n.color.b].map(v=>Math.round(v*255));
          const key=n.sprite+rgb.join(',');let tint=this.tinted.get(key);
          if(!tint){tint=document.createElement('canvas');tint.width=image.naturalWidth;tint.height=image.naturalHeight;const tc=tint.getContext('2d')!;tc.drawImage(image,0,0);tc.globalCompositeOperation='multiply';tc.fillStyle=`rgb(${rgb})`;tc.fillRect(0,0,tint.width,tint.height);tc.globalCompositeOperation='destination-in';tc.drawImage(image,0,0);if(this.tinted.size>128)this.tinted.clear();this.tinted.set(key,tint);}
          surface=tint;
        }
        ctx.drawImage(surface,-w*n.pivot.x,-h*(1-n.pivot.y),w,h);ctx.restore();
      }
      if(n.text) {
        ctx.save();ctx.globalAlpha*=n.color.a;ctx.fillStyle='#fff';ctx.strokeStyle='#171717';ctx.lineWidth=n.fontSize*.12;ctx.lineJoin='round';ctx.font=`${n.fontSize}px DankeUI`;ctx.textAlign='center';ctx.textBaseline='middle';
        const lines:string[]=[];let line='';
        for(const char of n.text){if(char==='\n'||(line&&ctx.measureText(line+char).width>w)){lines.push(line);line=char==='\n'?'':char;}else line+=char;}if(line)lines.push(line);
        lines.forEach((text,i)=>{const yy=(i-(lines.length-1)/2)*n.fontSize*1.2;ctx.strokeText(text,0,yy);ctx.fillText(text,0,yy);});ctx.restore();
      }
      for(const child of nodes.filter(c=>c.parent===n.id).sort((a,b)=>a.order-b.order))visit(child,w,h,n.pivot);
      ctx.restore();
    };
    const root=nodes.find(n=>!n.parent);if(root)visit(root,pw,ph,{x:.5,y:.5});
  }
  update() {
    const canvas=this.canvas,button=this.button;if(!canvas||!button)return;
    const now=performance.now(),elapsed=(now-this.phaseStarted)/1000,time=(now-this.started)/1000;
    if(this.stage==='rolling'&&elapsed>=(this.steps.at(-1)?.at??Infinity)){this.showResult();this.update();return;}
    if(this.stage==='rolling'){
      let step=this.steps.length-1;while(step>=0&&this.steps[step].at>elapsed)step--;
      if(step!==this.soundStep&&step>=0){this.soundStep=step;this.feedback('wheelTick');}
    }
    const host=canvas.parentElement!;
    const height=1080*host.clientHeight/Math.max(1,host.clientWidth);
    if(canvas.width!==1080||canvas.height!==Math.round(height)){canvas.width=1080;canvas.height=Math.round(height);}
    const ctx=canvas.getContext('2d')!;ctx.clearRect(0,0,1080,height);
    const fit=Math.min(1,height/1800);
    button.style.width=`${458*fit/1080*100}%`;button.style.height=`${178*fit/1080*host.clientWidth}px`;
    button.style.top=`${50+(747.1-89)*fit/height*100}%`;
    button.hidden=this.stage==='rolling'&&elapsed<.5;
    button.disabled=(this.stage==='idle'&&time<.617)||(this.stage==='result'&&elapsed<1+this.rewards.length*.2);
    button.querySelector('span')!.textContent=this.stage==='idle'?'开始':this.stage==='rolling'?'跳过':'确定';
    const born=data.clips.PunchboardResultItem_Born;
    const entrance=born.frames[Math.min(born.frames.length-1,Math.floor(time*born.fps))];
    button.style.opacity=String(entrance[7]);
    button.style.transform=`translateX(-50%) scale(${entrance[3]},${entrance[4]})`;
    ctx.save();ctx.translate(540,height/2);ctx.scale(fit,fit);
    if(this.stage==='result') {
      // Original VerticalLayoutGroup: 239.1 high items, spacing 35, top -64.
      const gap=274.1;
      this.rewards.forEach((card,i)=>{
        const nodes=this.nodes(data.result),root=nodes.find(n=>!n.parent)!;
        root.anchorMin=root.anchorMax={x:.5,y:.5};root.position={x:0,y:154+(this.rewards.length-1)*gap/2-i*gap};
        root.alpha=Math.max(0,Math.min(1,(elapsed-i*.2)/.2));
        nodes.find(n=>n.path==='img_icon')!.sprite=card.icon;
        nodes.find(n=>n.path==='titleName')!.text=card.name;
        nodes.find(n=>n.path==='text_skillDesc')!.text=card.description || '武器强化';
        this.draw(ctx,nodes,1080,height/fit);
        const passive=card.id>=11000000;
        const tier=passive?0:Math.min(2,Math.floor((Math.max(1,card.star)-1)/3)),lit=passive?card.star:(Math.max(1,card.star)-1)%3+1;
        const count=passive?Math.max(card.star,card.raw?.MaxStar||2):3;
        ctx.save();ctx.globalAlpha=root.alpha;
        for(let j=0;j<count;j++){const image=this.image(`Choose_skills_${['S','M','L'][tier]}${!passive&&j===2?2:1}_normal_${j<lit?['yellow','red','multicolor'][tier]:'grey'}`);if(image?.complete&&image.naturalWidth)ctx.drawImage(image,-192+j*43,-root.position.y-70,30,30);}
        ctx.restore();
      });
      if(!this.rewards.length){ctx.fillStyle='#fff';ctx.font='40px DankeUI';ctx.textAlign='center';ctx.fillText('当前武器已无可用强化',0,0);}
    } else {
      const board=this.nodes(data.board);
      this.animate(board,data.clips.PunchboardPlaneCat_Idle,time,'Bg_m',true);
      const root=board.find(n=>!n.parent)!;
      root.scale={x:entrance[0],y:entrance[1],z:entrance[2]};root.alpha=entrance[6];
      this.draw(ctx,board,1080,height/fit);
      ctx.save();ctx.translate(root.position.x,-root.position.y);ctx.scale(root.scale.x,root.scale.y);ctx.globalAlpha*=root.alpha;
      const step=[...this.steps].reverse().find(s=>s.at<=elapsed);
      for(let i=0;i<16;i++) {
        const slot=this.nodes(data.slot),node=slot.find(n=>!n.parent)!;
        const col=i<=4?i:i<=8?4:i<=12?12-i:0,row=i<=4?0:i<=8?i-4:i<=12?4:16-i;
        node.position={x:-372.5+col*187,y:356.4-row*187};
        slot.find(n=>n.path==='img_skillIcon')!.sprite=this.slots[i].icon;
        this.animate(slot,data.clips.PunchboardRandomItem_Idle,0);
        const won=this.steps.find(s=>s.slot===i&&s.reward>=0&&s.at<=elapsed);
        if(this.stage==='rolling'&&won)this.animate(slot,data.clips.PunchboardRandomItem_Select,Math.min(.5,elapsed-won.at));
        else if(this.stage==='rolling'&&step?.slot===i)this.animate(slot,data.clips.PunchboardRandomItem_Random,elapsed-step.at);
        this.draw(ctx,slot,100,100);
      }
      ctx.restore();
    }
    ctx.restore();
  }
}
