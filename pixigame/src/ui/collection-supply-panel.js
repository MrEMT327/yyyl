import { supplyChoice } from './supply-choice.js';
const button=(action,label,attrs='',disabled=false)=>`<button type="button" class="wc-button" data-action="${action}" ${attrs}${disabled?' disabled':''}>${label}</button>`;

export function collectionSupplyEntry(kind,s,h,{compact=false}={}) {
  const view=s.pilotSupply?.collection?.[kind];
  if(!view)return '';
  const blocked=s.rewardPending||s.rewardBusy;
  const claimed=view.candidates.find(row=>row.id===view.claimedId);
  if(compact){
    const status=view.claimed?'已领取':view.canClaim?'可领取':'未达成';
    return `<section class="su-card su-supply-entry"><header class="su-card-heading"><h3>${kind==='guns'?'每日机炮':'每周飞机'}自选</h3><span>${status}</span></header>
      <p class="su-condition">${kind==='guns'?'每日100活跃':'每周活跃5天'} · 剩余 ${view.remaining}/${view.limit}</p>
      <p>${view.complete?'材料补给':`自选${h.escape(view.name)}卡 ×1`}</p>
      ${button('collectionSupplyOpen',view.claimed?'已领取 · 查看':view.canClaim?'选择领取':'查看奖励',`data-kind="${kind}"`,blocked)}
      </section>`;
  }
  return `<section class="cs-entry"><h3>${kind==='guns'?'每日机炮':'每周飞机'}自选补给</h3>
    <p>${h.escape(view.allowanceNote)} 本期已用 ${view.claimedCount}/${view.limit} 个名额。</p><p>${h.escape(view.requirement)}。${view.complete?'该类收藏已满星或同名卡充足，后续补给改为装备材料。':'自选1张卡，可用于激活或升星；重复卡存入背包。'}</p>
    ${view.claimedCount?`<p>最近领取${claimed?'：'+h.escape(claimed.name)+' ×1':view.claimedId===0?'：材料补给':''}</p>`:''}
    ${button('collectionSupplyOpen',view.claimed?'查看本期补给':view.canClaim?'选择并领取':'查看可选内容',`data-kind="${kind}"`,blocked)}
  </section>`;
}

export function collectionSupplyDialog(s,state,h) {
  const view=s.pilotSupply?.collection?.[state.kind],e=h.escape;
  if(!view)return {title:'收藏补给',content:'<p>补给内容不存在，请返回。</p>'};
  const materialMode=view.claimed?view.claimedId===0:view.complete;
  const selected=view.claimed?view.candidates.find(row=>row.id===view.claimedId):view.candidates.find(row=>row.id===state.choiceId)||view.candidates.find(row=>row.selectable);
  const blocked=s.rewardPending||s.rewardBusy;
  const status=row=>row.maxed?'已满星':row.stocked?'同名卡已足够':row.owned?`${row.star}星 · 同名卡 ${h.number(row.copies)}`:'未激活';
  const reward=materialMode?`<div class="su-choice-rewards">${view.fallback.map(row=>`<span class="ps-resource">${h.img(row.image,'','ps-item-art')}${e(row.name)} ×${row.count}</span>`).join('')}</div>`:
    supplyChoice({id:'collection-supply-options',label:`选择${view.name}卡`,attribute:'data-collection-choice',rows:view.candidates,selected,disabled:blocked||view.claimed,status,count:1},h);
  const id=materialMode?0:selected?.id;
  return {title:view.name+'自选补给',content:`<div class="pilot-supply-panel supply-ui su-selection cs-dialog">
    <div class="su-selection-intro"><span>${state.kind==='guns'?'每日满活跃后领取':'每周活跃5天后领取'}</span><b>剩余 ${view.remaining}/${view.limit}</b></div>
    <section class="su-card"><header class="su-card-heading"><h3>${materialMode?'材料补给':`选择${e(view.name)}`}</h3><span>${view.claimed?'本期已领取':materialMode?'收藏已满': '自选 ×1'}</span></header>
      ${reward}<p class="su-choice-hint">${materialMode?'该类卡片已足够，改领装备材料。':'点选卡片切换 · 领取后存入背包'}</p>
      <div class="su-selection-claim su-primary-wrap">${button('collectionSupplyClaim',view.claimed?'本期已领取':!view.reached?'条件未达成':view.complete?'领取材料':`领取${e(view.name)}卡`,`data-primary="true" data-id="${id??''}" data-revision="${s.pilotSupply.revision}"`,blocked||!view.canClaim||!view.complete&&!selected?.selectable)}</div>
    </section>
    <details class="su-details"><summary>领取规则</summary><p>${e(view.requirement)}。</p><p>${e(view.allowanceNote)}</p><p>北京时间00:00刷新，每周补给周一刷新。卡片用于激活或升星。</p></details>
    <div class="su-footer-actions">${selected?button('collectionSupplyDetail','前往养成',`data-id="${selected.id}" data-kind="${state.kind}"`):''}${button('close','返回')}</div>
  </div>`};
}
