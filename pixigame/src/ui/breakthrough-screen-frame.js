import {Container} from '../three/display.js';
import {EDGE_PALETTES,buildEdgeArcFrames,edgeFrameIndex,edgeBaseMask,edgeFlashPath,edgeFlashSample,edgeBasePulse,sampleEdgeMainPath} from './breakthrough-edge-profile.js';
let nextFrame=0;
const NS='http://www.w3.org/2000/svg';
const clamp=n=>Math.max(0,Math.min(1,n));

/** Full battle viewport, independently of the narrower card canvas. The
 * existing display loop drives discrete arc frames and bounded short flashes. */
export function attachViewportBreakthroughFrame(panel,{viewport,revealAt=0,tier='y'}={}){
  const doc=viewport.ownerDocument,palette=EDGE_PALETTES[tier]||EDGE_PALETTES.y,id='project-breakthrough-edge-'+(++nextFrame);
  const make=(tag,attrs={})=>{const e=doc.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
  const svg=make('svg',{'aria-hidden':'true',focusable:'false',preserveAspectRatio:'none','data-edge-tier':tier});
  svg.classList.add('project-breakthrough-screen-frame');
  svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:19;pointer-events:none;overflow:hidden;opacity:0;mix-blend-mode:plus-lighter';
  const defs=make('defs');svg.append(defs);
  const filters=[['aura',8],['bloom',4.2],['near',1.0]].map(([name,blur])=>{
    const filter=make('filter',{id:id+'-'+name,filterUnits:'userSpaceOnUse',x:0,y:0,'color-interpolation-filters':'sRGB'});
    const gaussian=make('feGaussianBlur',{stdDeviation:blur});filter.append(gaussian);defs.append(filter);return{filter,gaussian,blur};
  });
  const mask=make('mask',{id:id+'-base-mask',maskUnits:'userSpaceOnUse'}),maskPath=make('path',{fill:'white','fill-rule':'evenodd'});
  mask.append(maskPath);defs.append(mask);
  const gradient=make('linearGradient',{id:id+'-arc-color',x1:0,y1:0,x2:1,y2:1});
  for(const[offset,color]of [[0,palette.near],[.32,palette.other],[.65,palette.near],[1,palette.other]])gradient.append(make('stop',{offset,'stop-color':color}));
  defs.append(gradient);
  const base=make('g',{'data-edge-layer':'masked-base',mask:'url(#'+id+'-base-mask)'});svg.append(base);
  const sides=[['top',0,0,0,1],['right',1,0,0,0],['bottom',0,1,0,0],['left',0,0,1,0]];
  const baseRects=sides.map(([side,x1,y1,x2,y2])=>{
    const g=make('linearGradient',{id:id+'-'+side,x1,y1,x2,y2});
    for(const[offset,alpha]of [[0,.34],[.24,.20],[.65,.07],[1,0]])g.append(make('stop',{offset,'stop-color':palette.base,'stop-opacity':alpha}));
    defs.append(g);const rect=make('rect',{fill:'url(#'+id+'-'+side+')'});base.append(rect);return{side,rect};
  });
  const paths={};
  for(const name of ['main','branches','echo']){paths[name]=make('path',{id:id+'-'+name,fill:'none'});defs.append(paths[name]);}
  const traces=[];
  const trace=(name,layer,stroke,width,opacity,filter)=>{
    const node=make('use',{href:'#'+paths[name].id,fill:'none',stroke,'stroke-width':width,opacity,
      'stroke-linejoin':'miter','stroke-miterlimit':2,'stroke-linecap':'butt',...(filter?{filter:'url(#'+id+'-'+filter+')'}:{})});
    layer.append(node);traces.push({node,width});return node;
  };
  const aura=make('g',{'data-edge-layer':'arc-aura'});svg.append(aura);
  trace('main',aura,palette.far,36,.24,'aura');
  const bloom=make('g',{'data-edge-layer':'arc-bloom'});svg.append(bloom);
  trace('main',bloom,'url(#'+id+'-arc-color)',22,.60,'bloom');
  trace('branches',bloom,palette.far,12,.46,'bloom');
  const near=make('g',{'data-edge-layer':'arc-near'});svg.append(near);
  trace('main',near,'url(#'+id+'-arc-color)',8.5,.94,'near');
  trace('branches',near,palette.near,4.5,.78,'near');
  const core=make('g',{'data-edge-layer':'arc-core'});svg.append(core);
  trace('main',core,palette.core,2.35,1);
  trace('branches',core,palette.core,1.05,.83);
  trace('echo',core,palette.other,.8,.52);

  const flashPath=make('path',{id:id+'-flash',fill:'none'});defs.append(flashPath);
  // Flash geometry is normalized before its group is scaled. Its blur must
  // use that same local space, independently of viewport-sized arc filters.
  for(const[name,blur]of [['flash-bloom',.055],['flash-near',.018]]){
    const filter=make('filter',{id:id+'-'+name,filterUnits:'userSpaceOnUse',x:-1,y:-1,width:2,height:2,'color-interpolation-filters':'sRGB'});
    filter.append(make('feGaussianBlur',{stdDeviation:blur}));defs.append(filter);
  }
  const flash=make('g',{'data-edge-layer':'local-discharge',opacity:0});svg.append(flash);
  for(const[stroke,width,opacity,filter]of [[palette.far,.16,.36,'flash-bloom'],[palette.near,.065,.87,'flash-near'],[palette.core,.024,1,null]]){
    flash.append(make('use',{href:'#'+flashPath.id,fill:'none',stroke,'stroke-width':width,opacity,'stroke-linejoin':'miter',
      'stroke-linecap':'butt',...(filter?{filter:'url(#'+id+'-'+filter+')'}:{})}));
  }
  viewport.append(svg);
  let frames=[],lastSize='',width=1,height=1,lastFrame=-1,lastTick=-1,lastOpacity=-1,lastSlot=-1,stoppedAt=null,disposed=false;
  function setFrame(index){
    const f=frames[index];if(!f)return;
    for(const name of ['main','branches','echo'])paths[name].setAttribute('d',f[name]);
    svg.setAttribute('data-edge-frame',index);lastFrame=index;
  }
  function resize(){
    if(disposed)return;
    const b=viewport.getBoundingClientRect();width=Math.max(1,b.width);height=Math.max(1,b.height);
    const key=width+'x'+height;if(key===lastSize)return;lastSize=key;
    const scale=Math.min(width/600,height/1300),spread=Math.max(14,Math.min(34,35*scale));
    svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    mask.setAttribute('width',width);mask.setAttribute('height',height);maskPath.setAttribute('d',edgeBaseMask(width,height));
    for(const{filter,gaussian,blur}of filters){filter.setAttribute('width',width);filter.setAttribute('height',height);gaussian.setAttribute('stdDeviation',Math.max(.45,blur*scale));}
    for(const{node,width:w}of traces)node.setAttribute('stroke-width',Math.max(.65,w*scale));
    for(const{side,rect}of baseRects){const vertical=side==='left'||side==='right';
      rect.setAttribute('x',side==='right'?width-spread:0);rect.setAttribute('y',side==='bottom'?height-spread:0);
      rect.setAttribute('width',vertical?spread:width);rect.setAttribute('height',vertical?height:spread);
    }
    frames=buildEdgeArcFrames(width,height);setFrame(Math.max(0,lastFrame));lastTick=-1;
  }
  resize();const observer=globalThis.ResizeObserver?new ResizeObserver(resize):null;observer?.observe(viewport);
  const node=new Container({label:'breakthrough-choice-screen-frame'});node.eventMode='none';node.interactiveChildren=false;panel.addChild(node);
  const born=Math.max(performance.now(),revealAt),reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
  node._prepare=()=>{
    if(disposed)return;const now=performance.now();if(node.__entryCancelled&&stoppedAt===null)stoppedAt=now;
    const age=Math.max(0,(stoppedAt??now)-born),seconds=age/1000,entrance=reduced?1:clamp(age/200),fade=stoppedAt===null?1:clamp(1-(now-stoppedAt)/180);
    let opacity=entrance*fade*(reduced?.38:1);for(let a=node;a;a=a.parent){if(!a.visible||!a.renderable){opacity=0;break;}opacity*=a.alpha;}
    if(opacity!==lastOpacity){svg.style.opacity=String(opacity);lastOpacity=opacity;}
    const tick=reduced?0:Math.floor(age*.03);if(tick===lastTick)return;lastTick=tick;
    const index=reduced?0:edgeFrameIndex(seconds);if(index!==lastFrame)setFrame(index);
    paths.main.setAttribute('d',sampleEdgeMainPath(frames,reduced?0:seconds));
    base.setAttribute('opacity',reduced?1:edgeBasePulse(seconds));
    if(reduced){flash.setAttribute('opacity',0);return;}
    let sample=edgeFlashSample(width,height,seconds);
    // At low frame rates, show one readable discharge frame for each newly
    // observed slot instead of losing a40ms flash between UI samples.
    if(sample.slot!==lastSlot&&!sample.visible)sample=edgeFlashSample(width,height,sample.slot*.1+.009);
    lastSlot=sample.slot;
    if(sample.visible){
      flashPath.setAttribute('d',edgeFlashPath(sample.index));
      const size=sample.size*sample.scale;
      flash.setAttribute('transform',`translate(${sample.x.toFixed(2)} ${sample.y.toFixed(2)}) rotate(${sample.angle.toFixed(2)}) scale(${size.toFixed(3)})`);
      flash.setAttribute('opacity',sample.alpha);flash.setAttribute('data-flash-slot',sample.slot);
    }else flash.setAttribute('opacity',0);
  };
  node._disposeVisuals=()=>{if(disposed)return;disposed=true;observer?.disconnect();frames.length=0;svg.remove();};
  return node;
}
