import { guideMarkup, positionGuide } from './guide-presentation.js';
import {nextLobbyGuide, guideFinished, reachedGuideProgress} from '../peripheral/onboarding.js';
import './lobby-onboarding.css';
import './guide-presentation.css';

// DOM adapter: targets are re-resolved after every lobby/modal render.
export function createLobbyOnboarding({root,context,mark,home}) {
  const layer=document.createElement('div');layer.className='lobby-guide';layer.hidden=true;
  layer.innerHTML=guideMarkup();
  document.body.append(layer);
  const ring=layer.querySelector('.guide-ring');
  let active=null,target=null,lastKey='',placementKey='',idle=0,weakChapter=null,marking=false;
  function hide(){home?.()?.setGuide(null);if(!layer.hidden)layer.hidden=true;target=null;placementKey='';}
  const select=(action,attrs='')=>`[data-action="${action}"]${attrs}`;
  const tab=name=>select('tab',`[data-tab="${name}"]`);
  const item=(action,uid)=>select(action,`[data-id="${CSS.escape(String(uid))}"]`);
  function destination(c){
    const g=active.group,m=c.modal;
    if(g===8&&m?.type==='shopBoxResult')return ['.common-reward-dismiss','点击空白处关闭','close'];
    if(m){
      if(g===8&&m.type==='shopBoxConfirm'&&m.pool===active.pool&&m.count===1)return [select('shopBoxOpen'),'开启宝箱','open-box'];
      if((g===9||g===14)&&m.type==='gearDetail'&&m.id===active.uid){
        if(g===14&&m.detailOrigin!=='slot')return [select('close'),'返回装备槽升级','close'];
        return [item(g===9?'gearEquip':'gearUpgrade',active.uid),g===9?'装配这件装备':'升级已装配的装备',g===9?'gearEquip':'gearUpgrade'];
      }
      return null;
    }
    if(c.subpage)return null;
    if(g===8){
      if(c.tab!=='shop')return [tab('shop'),'进入商城','nav-shop'];
      if(c.shopSection!=='boxes')return [select('shopSection','[data-section="boxes"]'),'查看装备宝箱','section-boxes'];
      return [select('shopBoxConfirm',`[data-pool="${active.pool}"][data-count="1"]`),'开启1次','open-'+active.pool+'-1'];
    }
    if(c.tab!=='assembly')return [tab('assembly'),'进入装备页','nav-assembly'];
    if(c.gearFilter!=='all')return [select('gearClearFilter'),'查看全部装备','clear-filter'];
    return [item('gearDetail',active.uid)+(g===14?'[data-gear-origin="slot"]':''),g===9?'查看这件装备':'点击已装配的装备','gear-'+active.uid];
  }
  function usable(node){return node&&!node.disabled&&!node.closest('[hidden],[aria-hidden="true"]')&&node.getClientRects().length>0;}
  function show(selector,label,strong,controlId){
    const view=home?.();
    const modalGuide=Boolean(context().modal);
    if(view&&controlId&&(!modalGuide||view.canGuidePanel?.(controlId))){
      layer.hidden=true;target=null;placementKey='';
      view.setGuide({id:controlId,text:label,strong,modal:modalGuide});return true;
    }
    view?.setGuide(null);
    const host=context().modal?root.querySelector('.pl-modal-host'):root;
    const candidates=[...(host?.querySelectorAll(selector)||[])];
    const node=candidates.find(usable);
    if(!node){hide();return false;}
    const key=`${active?.group||0}:${selector}`;
    if(lastKey!==key){node.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});lastKey=key;}
    const r=node.getBoundingClientRect(),bounds=root.getBoundingClientRect();
    if(r.width<4||r.height<4||r.bottom<=Math.max(0,bounds.top)||r.top>=Math.min(innerHeight,bounds.bottom)){hide();return false;}
    // Ignore the guide's own scrollable caption without changing the tree
    // while checking whether an unrelated overlay covers the real target.
    const x=Math.max(1,Math.min(innerWidth-1,r.x+r.width/2)),y=Math.max(1,Math.min(innerHeight-1,r.y+r.height/2));
    const hit=document.elementsFromPoint
      ?document.elementsFromPoint(x,y).find(element=>!layer.contains(element))
      :document.elementFromPoint(x,y,layer);
    if(!hit||!(hit===node||node.contains(hit))){hide();return false;}
    const group=String(active?.group||0);
    const nextPlacement=[r.x,r.y,r.width,r.height,bounds.x,bounds.y,bounds.width,bounds.height,innerWidth,innerHeight,label,strong,group].join('|');
    if(!layer.hidden&&target===node&&placementKey===nextPlacement)return true;
    if(layer.hidden)layer.hidden=false;
    if(layer.classList.contains('is-strong')!==strong)layer.classList.toggle('is-strong',strong);
    if(layer.dataset.group!==group)layer.dataset.group=group;
    Object.assign(ring.style,{left:`${r.x-4}px`,top:`${r.y-4}px`,width:`${r.width+8}px`,height:`${r.height+8}px`});
    if(!positionGuide(layer,{target:r,bounds,label,strong})){hide();return false;}
    target=node;placementKey=nextPlacement;
    return true;
  }
  const guard=e=>{
    if(layer.hidden||!active||!target)return;
    if(e.type==='keydown'&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();return;}
    if(layer.contains(e.target))return;
    if(e.type==='keydown'&&e.key==='Tab'){e.preventDefault();target.focus({preventScroll:true});return;}
    if(e.type==='keydown'&&!['Enter',' '].includes(e.key))return;
    if(e.target!==target&&!target.contains(e.target)){e.preventDefault();e.stopImmediatePropagation();}
  };
  root.addEventListener('click',guard,true);root.addEventListener('pointerdown',guard,true);window.addEventListener('keydown',guard,true);
  return {
    hide,
    hideWeakHint(){if(!active)hide();},
    tick(dt=0){
      const c=context(),s=c.snapshot;
      if(!s||!c.visible||c.busy||document.hidden||root.hidden){hide();return;}
      if(active&&guideFinished(s,active.group)&&active.group!==14&&!(active.group===8&&c.modal?.type==='shopBoxResult'))active=null;
      if(active&&(active.group===9||active.group===14)&&!s.equipment?.items?.some(i=>i.uid===active.uid&&(active.group===9?!i.equipped:i.equipped&&i.canUpgrade)))active=null;
      if(!active&&!c.modal&&!c.subpage)active=nextLobbyGuide(s);
      if(active){
        const dest=destination(c);
        if(!dest){hide();return;}
        if(show(dest[0],dest[1],true,dest[2])&&active.group===14&&!guideFinished(s,14)&&!marking){
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
        show(select('start'),'点击出战',false,'start');return;
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
