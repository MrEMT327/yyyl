import { supplyChoice } from './supply-choice.js';
import { nativeItemArt, nativeItemPresentation } from '../replica/native-item-presentation.js';
import { projectIconUrl } from './project-ui-art.js';
const extras=(view,h)=>(view.extraRewards||[]).map(reward=>`<span class="ps-resource">${h.img(reward.image,'','ps-item-art')}${h.escape(reward.name)} ×${reward.count}</span>`).join('、');
const button=(action,label,attrs='',disabled=false)=>`<button type="button" class="wc-button" data-action="${action}" ${attrs} ${disabled?'disabled':''}>${label}</button>`;
export function growthSupplyEntry(period,s,h,{compact=false}={}) {
  const view=s.pilotSupply?.growth?.[period];if(!view)return '';
  const e=h.escape,blocked=s.rewardPending||s.rewardBusy;
  if(compact){
    const tile=r=>`<span class="su-reward" title="${e(r.name)} ×${h.number(r.count)}" aria-label="${e(r.name)} ×${h.number(r.count)}">${h.img(r.image||(r.id===135?projectIconUrl('technology-core'):null),'','su-item-art')}<b>×${h.number(r.count)}</b>${r.id===135?'<small>星核</small>':''}</span>`;
    const rewards=view.supplemental?view.extraRewards:[view.box,...(view.complete?[view.fallback]:[]),...(view.extraRewards||[])];
    const status=view.supplemental?'可补领':view.claimed?'已领取':view.canClaim?'可领取':'未达成';
    return `<section class="su-card su-supply-entry"><header class="su-card-heading"><h3>${e(view.name)}</h3><span>${status}</span></header>
      <p class="su-condition">${period==='week'?`通关第${view.chapter}章 · 活跃${view.days}天`:'每日100活跃'}</p>
      <div class="su-rewards">${rewards.map(tile).join('')}${!view.supplemental&&!view.complete?`<span class="su-fragment-choice">自选碎片 <b>×${view.fragments}</b></span>`:''}</div>
      ${button('growthSupplyOpen',view.supplemental?'补领星核':view.claimed?'已领取 · 查看':view.canClaim?'选择领取':'查看奖励',`data-period="${period}"`,blocked)}
      </section>`;
  }
  return `<section class="growth-supply-entry"><h3>${e(view.name)}</h3><p>${e(view.requirement)}。</p>
    <p><span class="ps-resource">${h.img(view.box.image,'','ps-item-art')}${e(view.box.name)} ×${view.box.count}</span>${view.extraRewards?.length?'，'+extras(view,h):''} · 驾驶员碎片 ×${view.fragments}。</p>
    ${button('growthSupplyOpen',view.supplemental?'补领本期星核':view.claimed?'查看本期领取':view.canClaim?'选择并领取':'查看奖励',`data-period="${period}"`,blocked)}</section>`;
}
export function growthSupplyDialog(s,state,h) {
  const p=s.pilotSupply,view=p?.growth?.[state.period],e=h.escape;
  if(!view)return {title:'成长补给',content:'<p>补给内容不存在，请返回。</p>'};
  const blocked=s.rewardPending||s.rewardBusy,materialMode=view.claimed?view.claimedId===0:view.complete;
  const selected=view.claimed?view.candidates.find(row=>row.id===view.claimedId):
    view.candidates.find(row=>row.id===state.choiceId)||view.candidates.find(row=>row.selectable);
  const selectedId=materialMode?0:selected?.id;
  const status=row=>!row.owned?'未拥有':row.maxed?'已满星':row.stocked?'升星材料已足够':`${row.star}星 · 碎片 ${h.number(row.fragments)}`;
  const choice=materialMode?`<div class="su-choice-rewards"><span class="ps-resource">${h.img(view.fallback.image,'','ps-item-art')}${e(view.fallback.name)} ×${view.fallback.count}</span></div>`:
    supplyChoice({id:'growth-supply-options',label:'选择驾驶员碎片',attribute:'data-growth-choice',rows:view.candidates,selected,disabled:blocked||view.claimed,status,image:row=>nativeItemArt(row.fragmentId),count:view.fragments},h);
  return {title:view.name,content:`<div class="pilot-supply-panel supply-ui su-selection cs-dialog">
    <div class="su-selection-intro"><span>${state.period==='week'?`第${view.chapter}章 · 活跃${view.days}天`:'每日满活跃后领取'}</span><b>${view.claimed?'已领取':view.canClaim?'可领取':'未达成'}</b></div>
    <section class="su-card"><header class="su-card-heading"><h3>${view.supplemental?'星核补领':materialMode?'材料补给':'选择驾驶员碎片'}</h3></header>
      <div class="su-choice-rewards">${view.supplemental?'':`<span class="ps-resource">${h.img(view.box.image,'','ps-item-art')}${e(view.box.name)} ×${view.box.count}</span>`}${extras(view,h)}</div>
      ${view.supplemental?'<p class="su-choice-status">仅补发本期新增星核。</p>':choice}
      <p class="su-choice-hint">${!view.supplemental&&!materialMode&&selected?`${selected.cost}碎片合成同名卡 · 领取后存入背包`:'奖励存入背包'}</p>
      <div class="su-selection-claim">${button('growthSupplyClaim',view.supplemental?'补领星核':view.claimed?'本期已领取':!view.reached?'条件未达成':'领取补给',`data-primary="true" data-id="${selectedId??''}" data-revision="${p.revision}"`,blocked||!view.canClaim||!view.supplemental&&!materialMode&&!selected?.selectable)}</div>
    </section>
    <details class="su-details"><summary>领取规则</summary><p>${e(view.requirement)}。</p><p>${e(view.coreIncomeNote)}</p><p>北京时间00:00刷新，每周补给周一刷新。碎片可选已拥有且仍需升星的驾驶员。</p></details>
    <div class="su-footer-actions">${button('bagOpen','打开宝箱',`data-id="${view.boxId}"`,!(s.nativeAcquisition.materials.some(row=>row.id===view.boxId&&row.count>0)))}
    ${!view.supplemental&&!materialMode&&selected?button('bagOpen','合成碎片',`data-id="${selected.fragmentId}"`,selected.fragments<1):''}${button('close','返回')}</div>
  </div>`};
}
