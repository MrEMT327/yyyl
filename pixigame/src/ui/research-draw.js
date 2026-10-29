import {RESEARCH_DRAW_TIMINGS} from './draw-presentation-plan.js';
import './research-draw.css';

const base=`${import.meta.env?.BASE_URL??'/'}art/project-research-draw-reference-v5/`;
export const RESEARCH_DRAW_ART=Object.freeze({charge:`${base}card-aura.png`,burst:`${base}reveal-rays.png`,back:`${import.meta.env?.BASE_URL??'/'}art/research-comic-v1/question.svg`});
const readiness=new WeakMap();
export function prepareResearchDraw(document){
  if(!readiness.has(document))readiness.set(document,Promise.all(Object.values(RESEARCH_DRAW_ART).map(src=>new Promise(resolve=>{
    const image=document.createElement('img');
    const timeout=setTimeout(()=>finish(false),2500);
    const finish=ok=>{clearTimeout(timeout);image.onload=image.onerror=null;resolve(ok);};
    image.onload=()=>finish(true);image.onerror=()=>finish(false);image.src=src;
  }))).then(results=>{const loaded=results.every(Boolean);if(!loaded)readiness.delete(document);return loaded;}));
  return readiness.get(document);
}
function texture(document,src,cls){
  const image=document.createElement('img');image.src=src;image.className=cls;image.alt='';image.draggable=false;image.setAttribute('aria-hidden','true');return image;
}

export function researchDrawTiming(rank) {
  return RESEARCH_DRAW_TIMINGS[Math.max(0,Math.min(4,Math.floor(Number(rank)||0)))];
}

function light(document,src,cls){
  const node=document.createElement('span');node.className=cls;node.style.setProperty('--light-texture',`url("${new URL(src,document.baseURI).href}")`);node.setAttribute('aria-hidden','true');return node;
}
function mysteryCard(document,cls){
  const card=document.createElement('div');card.className=cls;card.dataset.psdQuality='0';
  card.append(texture(document,RESEARCH_DRAW_ART.back,'research-draw-question'));return card;
}

// Reference structure: three incoming cards, mystery card, rarity charge, turn.
// Original PSD plates and generated light masks; no APK art ships here.
export function createResearchCharge(document,rank) {
  const timing=researchDrawTiming(rank),charge=document.createElement('div');
  charge.className='research-draw-charge';charge.setAttribute('aria-hidden','true');
  charge.style.setProperty('--charge-duration',`${timing.reveal}ms`);
  charge.style.setProperty('--charge-start',`${[1350,1350,1817,2200,2567][Math.min(rank,4)]}ms`);
  for(let i=0;i<3;i++){
    const echo=mysteryCard(document,'research-draw-echo');echo.style.setProperty('--echo-x',`${(i-1)*85}%`);echo.style.setProperty('--echo-y',`${i===1?-85:30}%`);echo.style.setProperty('--echo-angle',`${(i-1)*24}deg`);charge.append(echo);
  }
  charge.append(light(document,RESEARCH_DRAW_ART.charge,'research-draw-flow'));
  const back=mysteryCard(document,'research-draw-back');charge.append(back);
  for(const time of timing.pulses){
    const pulse=light(document,RESEARCH_DRAW_ART.charge,'research-draw-pulse');
    pulse.style.animationDelay=`${time}ms`;charge.append(pulse);
  }
  return charge;
}

export function startResearchCharge(charge,rank){
  if(!charge.animate)return [];
  const timing=researchDrawTiming(rank),back=charge.querySelector('.research-draw-back');
  const motions=[],turnStart=[1350,1350,1433,1817,2200][Math.min(rank,4)],turns=[1,1,2,3,3][Math.min(rank,4)];
  const motion=(node,keys,options)=>motions.push(node.animate(keys,{fill:'both',...options}));
  // Source curves compress to .85, rebound to 1.0708 and tilt 6 degrees.
  const shake=[{offset:0,transform:'none'}];
  for(const time of timing.pulses){
    for(const [dt,transform] of [[0,'none'],[67,'translateY(12%) rotate(-6deg) scale(.85)'],[117,'translateY(-1%) rotate(2.8deg) scale(1.0708)'],[167,'rotate(-1.59deg) scale(1.0155)'],[300,'none']])shake.push({offset:(time+dt)/timing.reveal,transform});
  }
  shake.push({offset:1,transform:'none'});motion(charge,shake,{duration:timing.reveal,easing:'linear'});
  motion(back,[{opacity:0,transform:'scale(.7)',offset:0,easing:'ease-out'},{opacity:1,transform:'scale(1)',offset:350/timing.reveal},{transform:'perspective(700px) rotateY(0deg)',offset:turnStart/timing.reveal,easing:'ease-in'},{transform:`perspective(700px) rotateY(${turns*360}deg) scale(1.12)`,offset:1}],{duration:timing.reveal,easing:'linear'});
  const plates=['gray','green','blue','purple','gold'];
  const frameKeys=[{offset:0,borderImageSource:`url('/art/psd-equipment-v1/frame-gray.png')`}];
  const steps=timing.pulses.length?timing.pulses:[1350];
  steps.forEach((time,i)=>frameKeys.push({offset:time/timing.reveal,borderImageSource:`url('/art/psd-equipment-v1/frame-${plates[Math.round((i+1)*Math.min(rank,4)/steps.length)]}.png')`}));
  motion(back,frameKeys.map(key=>({...key,easing:'steps(1,end)'})),{duration:timing.reveal,easing:'linear'});
  return motions;
}

export function revealResearchCard(card,{instant=false,rank=0,origin=null}={}) {
  if(instant || !card.animate)return [];
  const motions=[],settle=researchDrawTiming(rank).settle;
  const animate=(node,keys,options)=>{if(node)motions.push(node.animate(keys,{fill:'backwards',easing:'cubic-bezier(.16,1,.3,1)',...options}));};
  const emblem=card.querySelector('.research-result-emblem');
  if(emblem){
    const document=card.ownerDocument,anchor=document.createElement('div');anchor.className='research-draw-reveal-anchor';
    const burst=light(document,RESEARCH_DRAW_ART.burst,'research-draw-burst');
    const residue=light(document,RESEARCH_DRAW_ART.charge,'research-draw-residue');
    emblem.replaceWith(anchor);anchor.append(residue,burst,emblem);
    const strength=rank>=3?.32:.16;
    animate(burst,[{opacity:0,transform:'scale(.65)'},{opacity:strength,transform:'scale(.94)',offset:.16},{opacity:strength*.45,offset:.48},{opacity:0,transform:'scale(1.12)'}],{duration:460,fill:'forwards',easing:'linear'});
    animate(residue,[{opacity:.5,transform:'scale(.98)'},{opacity:0,transform:'scale(1.04)'}],{duration:620,fill:'forwards',easing:'ease-out'});
  }
  const target=emblem?.getBoundingClientRect();
  const dx=origin&&target?origin.x+origin.width/2-target.x-target.width/2:0;
  const dy=origin&&target?origin.y+origin.height/2-target.y-target.height/2:0;
  animate(emblem,[
    {opacity:0,transform:`perspective(700px) translate(${dx}px,${dy}px) rotateY(-65deg) scale(.92)`},
    {opacity:1,transform:'perspective(700px) rotateY(0deg) scale(1.045)',offset:.7},
    {opacity:1,transform:'none'},
  ],{duration:settle});
  const details=card.querySelectorAll('.research-result-name,.research-result-level,.research-result-stat,.research-result-core');
  details.forEach((node,index)=>animate(node,[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'none'}],{duration:280,delay:Math.min(index,6)*70+170}));
  return motions;
}
