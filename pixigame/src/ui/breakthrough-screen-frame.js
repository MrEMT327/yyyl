import {Container} from '../three/display.js';

let nextFrame=0;
const NS='http://www.w3.org/2000/svg';
const clamp=n=>Math.max(0,Math.min(1,n));

function wirePath(width,height,time,inset=3.8){
  const w=width-inset*2,h=height-inset*2,scale=Math.min(width/600,height/1300),points=[];
  let travelled=0;
  for(const [side,length]of [[0,w],[1,h],[2,w],[3,h]]){
    const steps=Math.max(2,Math.ceil(length/4));
    for(let i=0;i<=steps;i++){
      const at=length*i/steps,s=(travelled+at)/scale;
      const end=clamp(Math.min(at,length-at)/12),taper=end*end*(3-2*end);
      const bend=(Math.sin(s*.028+time*4.8+Math.sin(s*.019-time*2.4)*1.8)*3.6
        +Math.sin(s*.147-time*13.4)*1.4+Math.sin(s*.371+time*17.5)*.8)*scale*taper;
      const point=side===0?[inset+at,inset+bend]:side===1?[width-inset-bend,inset+at]:
        side===2?[width-inset-at,height-inset-bend]:[inset+bend,height-inset-at];
      points.push(point.map(v=>v.toFixed(2)).join(','));
    }
    travelled+=length;
  }
  return 'M'+points.join(' L')+' Z';
}

/** Mount the screen light on the full battle viewport, outside the narrow HUD.
 * Native SVG animation is sampled by the existing render loop; no extra RAF. */
export function attachViewportBreakthroughFrame(panel,{viewport,revealAt=0}){
  const doc=viewport.ownerDocument;
  const make=(tag,attributes={})=>{
    const element=doc.createElementNS(NS,tag);
    for(const[key,value]of Object.entries(attributes))element.setAttribute(key,String(value));
    return element;
  };
  const animate=(parent,attributes)=>parent.append(make('animate',{repeatCount:'indefinite',...attributes}));
  const id='project-breakthrough-edge-'+(++nextFrame);
  const svg=make('svg',{'aria-hidden':'true',focusable:'false',preserveAspectRatio:'none'});
  svg.classList.add('project-breakthrough-screen-frame');
  svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;z-index:19;pointer-events:none;overflow:hidden;opacity:0';
  const defs=make('defs');svg.append(defs);
  const filters=[['bloom',5.5],['near',1.5]].map(([name,blur])=>{
    const filter=make('filter',{id:id+'-'+name,filterUnits:'userSpaceOnUse',x:0,y:0,'color-interpolation-filters':'sRGB'});
    filter.append(make('feGaussianBlur',{stdDeviation:blur}));defs.append(filter);return filter;
  });
  const paths=[3.8,9].map((inset,index)=>{
    const path=make('path',{id:id+'-path'+(index||''),pathLength:1000,fill:'none'});
    const morph=make('animate',{attributeName:'d',dur:index?'1.05s':'1.35s',repeatCount:'indefinite',calcMode:'linear'});
    path.append(morph);defs.append(path);return{path,morph,inset,index};
  });

  // The inward gradients give the border a broad halo without a full-screen blur.
  const halo=make('g',{'data-edge-layer':'halo'});svg.append(halo);
  const sides=[['top',0,0,0,1],['right',1,0,0,0],['bottom',0,1,0,0],['left',0,0,1,0]];
  const haloRects=sides.map(([side,x1,y1,x2,y2])=>{
    const gradient=make('linearGradient',{id:id+'-'+side,x1,y1,x2,y2});
    for(const[offset,opacity]of [[0,.47],[.14,.35],[.48,.14],[1,0]])gradient.append(make('stop',{offset,'stop-color':'#ffbf43','stop-opacity':opacity}));
    defs.append(gradient);
    const rect=make('rect',{fill:'url(#'+id+'-'+side+')'});halo.append(rect);return{side,rect};
  });
  animate(halo,{attributeName:'opacity',values:'.72;1;.78;.94;.72',dur:'2.2s',calcMode:'spline',keyTimes:'0;.28;.55;.8;1',keySplines:'.4 0 .6 1;.4 0 .6 1;.4 0 .6 1;.4 0 .6 1'});
  const use=(parent,attributes,pathIndex=0)=>{
    const node=make('use',{href:'#'+paths[pathIndex].path.id,fill:'none','stroke-linejoin':'round','stroke-linecap':'round',...attributes});parent.append(node);return node;
  };
  use(halo,{stroke:'#ffbd42','stroke-width':28,opacity:.48,filter:'url(#'+id+'-bloom)'});
  use(halo,{stroke:'#ffd476','stroke-width':10,opacity:.66,filter:'url(#'+id+'-near)'});
  use(svg,{stroke:'#ffefbd','stroke-width':1.6,opacity:.93});

  const travelling=make('g',{'data-edge-layer':'travelling-light'});svg.append(travelling);
  for(const attributes of [
    {stroke:'#ffc04b','stroke-width':35,opacity:.75,'stroke-dasharray':'50 283.333333',filter:'url(#'+id+'-bloom)'},
    {stroke:'#ffdf8b','stroke-width':8,opacity:.9,'stroke-dasharray':'35 298.333333',filter:'url(#'+id+'-near)'},
    {stroke:'#fff9df','stroke-width':3,opacity:1,'stroke-dasharray':'13 320.333333'}
  ])animate(use(travelling,attributes),{attributeName:'stroke-dashoffset',from:1000,to:0,dur:'7.2s'});
  const filaments=use(svg,{stroke:'#ffdf87','stroke-width':1.1,opacity:.65,'stroke-dasharray':'16 137 6 174.333333','data-edge-layer':'filaments'},1);
  animate(filaments,{attributeName:'stroke-dashoffset',from:0,to:1000,dur:'5.4s'});
  animate(filaments,{attributeName:'opacity',values:'.08;.68;.2;.8;.12;.55;.08',dur:'.94s'});

  viewport.append(svg);svg.pauseAnimations?.();
  let lastSize='',disposed=false,stoppedAt=null,lastTime=-1,lastOpacity=-1;
  function resize(){
    const bounds=viewport.getBoundingClientRect(),width=Math.max(1,bounds.width),height=Math.max(1,bounds.height),key=width+'x'+height;
    if(key===lastSize)return;lastSize=key;svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
    for(const filter of filters){filter.setAttribute('width',width);filter.setAttribute('height',height);}
    const spread=Math.max(24,Math.min(38,width*.105));
    for(const{side,rect}of haloRects){
      const vertical=side==='left'||side==='right';
      rect.setAttribute('x',side==='right'?width-spread:0);rect.setAttribute('y',side==='bottom'?height-spread:0);
      rect.setAttribute('width',vertical?spread:width);rect.setAttribute('height',vertical?height:spread);
    }
    for(const{path,morph,inset,index}of paths){
      const frames=Array.from({length:13},(_,i)=>wirePath(width,height,i===12?index*.43:i*.113+index*.43,inset));
      path.setAttribute('d',frames[0]);morph.setAttribute('values',frames.join(';'));
    }
    svg.setCurrentTime?.(Math.max(0,lastTime));
  }
  resize();const observer=globalThis.ResizeObserver?new ResizeObserver(resize):null;observer?.observe(viewport);
  const node=new Container({label:'breakthrough-choice-screen-frame'});node.eventMode='none';node.interactiveChildren=false;panel.addChild(node);
  const born=Math.max(performance.now(),revealAt),reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
  node._prepare=()=>{
    if(disposed)return;const now=performance.now();if(node.__entryCancelled&&stoppedAt===null)stoppedAt=now;
    const age=Math.max(0,(stoppedAt??now)-born),entrance=reduced?1:clamp(age/200),fade=stoppedAt===null?1:clamp(1-(now-stoppedAt)/180);
    let opacity=entrance*fade*(reduced?.38:1);for(let ancestor=node;ancestor;ancestor=ancestor.parent){if(!ancestor.visible||!ancestor.renderable){opacity=0;break;}opacity*=ancestor.alpha;}
    if(opacity!==lastOpacity){svg.style.opacity=String(opacity);lastOpacity=opacity;}
    // Thirty samples per second keep the electric flicker lively and bound SVG work.
    const time=reduced?0:Math.floor(age*.03)/30;
    if(time!==lastTime){svg.setCurrentTime?.(time);lastTime=time;}
  };
  node._disposeVisuals=()=>{if(disposed)return;disposed=true;observer?.disconnect();svg.pauseAnimations?.();svg.remove();};
  return node;
}
