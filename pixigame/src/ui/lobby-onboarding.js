import { projectIcon } from './project-ui-art.js';
import {nextLobbyGuide, guideFinished, reachedGuideProgress} from '../peripheral/onboarding.js';
import './lobby-onboarding.css';
import './guide-presentation.css';

// DOM adapter: targets are re-resolved after every lobby/modal render.
export function createLobbyOnboarding({root,context,mark}) {
  const layer=document.createElement('div');layer.className='lobby-guide';layer.hidden=true;
  layer.innerHTML=`<div class="guide-ring"></div><span class="guide-hand" aria-hidden="true">${projectIcon('upgrade-arrow','guide-pointer-art')}</span><div class="guide-caption psd-guide-panel" role="status" aria-live="polite"><span></span><button type="button">稍后</button></div>`;
  document.body.append(layer);
  const ring=layer.querySelector('.guide-ring'),hand=layer.querySelector('.guide-hand'),caption=layer.querySelector('.guide-caption'),text=caption.querySelector('span'),later=caption.querySelector('button');
  let active=null,target=null,lastKey='',idle=0,weakChapter=null,marking=false;
  const dismissed=new Set();
  function hide(){layer.hidden=true;target=null;}
  function suspend(){if(active)dismissed.add(active.group);active=null;hide();}
  later.onclick=suspend;
  const select=(action,attrs='')=>`[data-action="${action}"]${attrs}`;
  const tab=name=>select('tab',`[data-tab="${name}"]`);
  const item=(action,uid)=>select(action,`[data-id="${CSS.escape(String(uid))}"]`);
  function destination(c){
    const g=active.group,m=c.modal;
    if(g===8&&m?.type==='shopBoxResult')return ['.common-reward-dismiss','收下装备，继续提升战力'];
    if(m){
      if(g===8&&m.type==='shopBoxConfirm'&&m.pool===active.pool&&m.count===1)return [select('shopBoxOpen'),'确认本次单抽'];
      if((g===9||g===14)&&m.type==='gearDetail'&&m.id===active.uid)return [item(g===9?'gearEquip':'gearUpgrade',active.uid),g===9?'装配这件装备':'强化已装配的装备'];
      return null;
    }
    if(c.subpage)return null;
    if(g===8){
      if(c.tab!=='shop')return [tab('shop'),'进入商城，获取装备'];
      if(c.shopSection!=='boxes')return [select('shopSection','[data-section="boxes"]'),'查看装备宝箱'];
      return [select('shopBoxConfirm',`[data-pool="${active.pool}"][data-count="1"]`),'开启一次装备箱'];
    }
    if(c.tab!=='assembly')return [tab('assembly'),g===9?'进入装备页，装配新装备':'进入装备页，强化装备'];
    if(c.gearFilter!=='all')return [select('gearClearFilter'),'查看全部装备'];
    return [item('gearDetail',active.uid),g===9?'查看这件装备':'查看可强化的装备'];
  }
  function usable(node){return node&&!node.disabled&&!node.closest('[hidden],[aria-hidden="true"]')&&node.getClientRects().length>0;}
  function show(selector,label,strong){
    const host=context().modal?root.querySelector('.pl-modal-host'):root;
    const candidates=[...(host?.querySelectorAll(selector)||[])];
    const node=candidates.find(usable);
    if(!node){hide();return false;}
    const key=`${active?.group||0}:${selector}`;
    if(lastKey!==key){node.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});lastKey=key;}
    const r=node.getBoundingClientRect(),bounds=root.getBoundingClientRect();
    if(r.width<4||r.height<4||r.bottom<=Math.max(0,bounds.top)||r.top>=Math.min(innerHeight,bounds.bottom)){hide();return false;}
    // Don't point through unrelated overlays. The guide itself never intercepts
    // the highlighted control; its own caption/hand are ignored by hit-testing.
    layer.hidden=true;
    const hit=document.elementFromPoint(Math.max(1,Math.min(innerWidth-1,r.x+r.width/2)),Math.max(1,Math.min(innerHeight-1,r.y+r.height/2)));
    if(!hit||!(hit===node||node.contains(hit))){hide();return false;}
    target=node;layer.hidden=false;layer.classList.toggle('is-strong',strong);layer.dataset.group=String(active?.group||0);
    Object.assign(ring.style,{left:`${r.x-4}px`,top:`${r.y-4}px`,width:`${r.width+8}px`,height:`${r.height+8}px`});
    const center=Math.max(30,Math.min(innerWidth-30,r.x+r.width/2));
    const handBelow=r.y<100;hand.classList.toggle('points-up',handBelow);
    Object.assign(hand.style,{left:`${center}px`,top:`${handBelow?r.bottom+2:r.y-34}px`});
    const width=Math.min(270,Math.max(180,bounds.width-24));
    Object.assign(caption.style,{width:`${width}px`,left:`${Math.max(8,Math.min(innerWidth-width-8,center-width/2))}px`,top:`${Math.max(8,Math.min(innerHeight-72,handBelow?r.bottom+48:r.y-96))}px`});
    text.textContent=label;later.hidden=!strong;
    return true;
  }
  const guard=e=>{
    if(layer.hidden||!active||!target)return;
    if(layer.contains(e.target))return;
    if(e.type==='keydown'&&e.key==='Escape'){suspend();return;}
    if(e.type==='keydown'&&e.key==='Tab'){e.preventDefault();target.focus({preventScroll:true});return;}
    if(e.type==='keydown'&&!['Enter',' '].includes(e.key))return;
    if(e.target!==target&&!target.contains(e.target)){e.preventDefault();e.stopImmediatePropagation();}
  };
  root.addEventListener('click',guard,true);root.addEventListener('pointerdown',guard,true);window.addEventListener('keydown',guard,true);
  return {
    hide,
    tick(dt=0){
      const c=context(),s=c.snapshot;
      if(!s||!c.visible||c.busy||document.hidden||root.hidden){hide();return;}
      if(active&&guideFinished(s,active.group)&&active.group!==14&&!(active.group===8&&c.modal?.type==='shopBoxResult'))active=null;
      if(active&&(active.group===9||active.group===14)&&!s.equipment?.items?.some(i=>i.uid===active.uid&&(active.group===9?!i.equipped:i.equipped&&i.canUpgrade)))active=null;
      if(!active&&!c.modal&&!c.subpage)active=nextLobbyGuide(s,[...dismissed]);
      if(active){
        const dest=destination(c);
        if(!dest){hide();return;}
        if(show(...dest,true)&&active.group===14&&!guideFinished(s,14)&&!marking){
          // Native group 14 is consumed when it starts, while this session
          // keeps the remaining target/upgrade steps alive.
          marking=true;Promise.resolve(mark(14,active.uid)).finally(()=>{marking=false;});
        }
        return;
      }
      const chapter=(c.chapterIndex??s.selectedStageIndex??0)+1;
      if(weakChapter!==chapter){weakChapter=chapter;idle=0;}idle+=Math.max(0,dt);
      if(!c.modal&&!c.subpage&&c.tab==='battle'&&chapter<=3&&!reachedGuideProgress(s.replicaCampaign,4)
        &&(chapter===1&&!guideFinished(s,1)||idle>=60)&&!s.rewardPending&&!s.rewardBusy){
        show(select('start'),'点击出战',false);return;
      }
      hide();
    },
    result(action,payload,result){
      if(!result?.ok||!active)return;
      if(active.group===8&&action==='gearSupply'&&Number(payload.count)===1)active={...active,receipt:true};
      if(active.group===14&&action==='gearUpgrade'&&String(payload.id||payload.uid)===active.uid){active=null;hide();}
    },
    destroy(){layer.remove();root.removeEventListener('click',guard,true);root.removeEventListener('pointerdown',guard,true);window.removeEventListener('keydown',guard,true);}
  };
}
