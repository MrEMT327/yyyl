import {createLobbyPanel} from './lobby-panel.js';
import {detailSheet} from './detail-sheet.js';
import {paintResearchDraw} from './research-draw-scene.js';
import {qualityFrame,titleFont} from './menu-art.js';
import {researchArt,researchCardQuality} from '../../ui/research-art.js';
import {drawPresentationPlan,initialDrawPresentation,advanceDrawPresentation,RESEARCH_DRAW_TIMINGS} from '../../ui/draw-presentation-plan.js';

const heading={size:16,lineHeight:24,color:'#65547d',family:titleFont};
const copy={size:16,lineHeight:26.4};
function effect(row,text){row.text(text,{...copy,pad:8});}
export function researchSheet(t,data,w,h){
  const {modal:m,snapshot:{research:r}}=data,c=data.card,receipt=m.result,summary=m.type==='researchSummary';
  const title=summary?'科技总加成':c?.owned?c.name:receipt?.earnedCore?'星核研制完成':receipt?.refining?'星核研制':'科技';
  detailSheet(t,data,w,h,{title,secondary:!summary,build:row=>{
    if(!r){row.text('科技暂不可用');return;}
    if(summary){row.block(()=>{
      row.text('已觉醒 '+r.owned+'/'+r.cards.length,copy);row.gap(5);
      if(!r.effects.length)row.text('尚未觉醒科技',copy);
      else r.effects.forEach((v,i)=>{if(i)row.gap(5);effect(row,v);});row.gap(5);
    });return;}
    if(!c){
      if(receipt?.earnedCore){row.gap(15);row.art(researchArt('technology-core'),80,80);row.gap(12);
        row.text('星核 ×'+receipt.earnedCore,{size:18,align:'center',weight:700});row.gap(14);row.action('confirm','收下','close');return;}
      if(receipt?.refining){row.gap(12);row.text('研制进度 '+receipt.refineProgress+'/'+receipt.refineSteps,{size:18,align:'center',weight:700});
        row.gap(12);row.a.quad(row.x,row.y+4,row.width,10,'#94a4ad');row.a.quad(row.x,row.y+4,row.width*receipt.refineProgress/receipt.refineSteps,10,'#247ab2');
        row.gap(32);row.action('confirm','继续','close');return;}
    }
    if(!c?.owned){row.text('未觉醒科技');return;}
    row.art(researchArt(c.icon),120,160,{frame:qualityFrame(researchCardQuality(c.quality)),scale:.9});
    row.gap(10);row.text(c.level+' / '+c.maxLevel+'级 · '+(c.pool==='normal'?'常规':'王牌')+'觉醒',{size:13,align:'center',color:'#304b65'});row.gap(5);
    row.block(()=>{row.text('当前效果',heading);row.gap(6);c.effects.forEach((v,i)=>{if(i)row.gap(5);effect(row,v);});
      if(!c.maxed){row.gap(14);row.text('下一级',heading);row.gap(6);c.nextEffects.forEach((v,i)=>{if(i)row.gap(5);row.text(v,copy);});}
      row.gap(5);
    });row.gap(14);row.action('confirm','返回天赋','close');
  }});
}
export function openResearchPanel(screen,host,send,sound){
  const pref=(screen.reducedMotion ? {get matches(){return screen.reducedMotion();}} : matchMedia('(prefers-reduced-motion: reduce)')),cues=new Set();
  let model,receipt,signature,flow,timer=0,chargeStart=null,entered=0,guard=0,version=0,closed=false;
  const panel=createLobbyPanel(screen,host,'科技', (data,w,h,t)=>{
    if(data.plan)paintResearchDraw(data,w,h,t,screen.viewportHeight?.()??globalThis.window?.innerHeight??h);
    else researchSheet(t,data,w,h);
  },command=>{
    if(command.type==='none')return;
    if(!model?.plan){if(command.type==='close')send('close',{},host);return;}
    if(flow.phase==='spotlight'&&performance.now()<guard&&command.via!=='keyboard')return;
    if(flow.phase==='opening'&&command.via!=='keyboard')guard=performance.now()+300;
    switchPhase(command.type==='skip'||command.type==='close'?'skip':'next');
  });
  function cue(key){if(!cues.has(key)){cues.add(key);sound?.(key);}}
  function refresh(){if(!closed)panel.update({...model,flow,entered,startCharge,safeBottom:screen.menuView?.safeBottom||0},++version,model.modal.type);}
  function enter(){clearTimeout(timer);chargeStart=null;entered=performance.now()/1000;
    if(flow.phase==='summary'){send('close',{},host);return;}
    if(flow.phase==='spotlight')cue('drawReveal');refresh();}
  function switchPhase(cmd){flow=advanceDrawPresentation(flow,cmd,model.plan);enter();}
  function startCharge(failed){if(chargeStart==null){chargeStart=performance.now()/1000;
    if(!failed)cue('drawCharge');
    timer=setTimeout(()=>{if(closed||flow.phase!=='opening')return;switchPhase(failed?'skip':'next');},failed?0:RESEARCH_DRAW_TIMINGS[model.rank].reveal);
  }return chargeStart;}
  function preference(){if(pref.matches&&flow?.phase==='opening')switchPhase('skip');}
  pref.addEventListener?.('change',preference);
  return {host,close(){closed=true;clearTimeout(timer);pref.removeEventListener?.('change',preference);if(cues.size)sound?.(null);panel.close();},
    update(snapshot,modal,key){if(receipt===modal&&signature===key)return;
      const plan=drawPresentationPlan(modal,snapshot),card=snapshot.research?.cards.find(c=>c.id===(modal.result?.cardId||modal.id));
      const first=modal!==receipt;receipt=modal;signature=key;model={snapshot,modal,card,plan,rank:Math.max(0,Math.min(4,plan?.entries[0].rank??0))};
      if(first&&plan){cues.clear();guard=0;flow=initialDrawPresentation(plan,pref.matches);enter();}else refresh();
    }};
}
