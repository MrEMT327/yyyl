import { ITEM_USE_BATCH_LIMIT, isItemUseBatchCount } from '../replica/item-use-batches.js';
import { backpackUseRule } from '../replica/native-backpack-use.js';
import { nativeItemPresentation } from '../replica/native-item-presentation.js';
import { MAXED_PILOT_FRAGMENT_DIAMONDS } from '../replica/pilot-supply-reward-policy.js';

export function backpackUseControls(item,s,state,h) {
  const e=h.escape,id=item.nativeId,rule=backpackUseRule(id),blocked=s.rewardPending||s.rewardBusy;
  const button=(label,attrs,disabled=false)=>`<button type="button" class="wc-button bag-use-button" ${attrs} ${disabled?'disabled':''}>${e(label)}</button>`;
  const use=(label,count,disabled=false,description='')=>button(label,`${count==='selected'?'data-bag-use-selected':''} data-action="bagUse" data-id="${id}" data-count="${count}" data-revision="${s.nativeAcquisition.revision}" data-gear-revision="${s.equipment.revision}" ${description?`aria-label="${e(description)}"`:''}`,blocked||disabled);
  const all=(verb,count,unit)=>`<div class="bag-batch-action">${use(verb+'全部',count,count<1,`${verb}全部，共${h.number(count)}${unit}`)}<small>共 ${h.number(count)} ${unit}</small></div>`;
  const recovery=s.rewardPending?`<p role="status">已有奖励待保存，请先重试。</p>${button('重试保存','data-action="recoverDailyRewards"',s.rewardBusy)}`:s.rewardBusy?'<p role="status">奖励正在处理，请稍候。</p>':'';
  const batch=verb=>{
    const max=Math.min(item.count,ITEM_USE_BATCH_LIMIT),draft=state.bagCount??1,count=Number(draft);
    const valid=isItemUseBatchCount(count)&&count<=max&&String(draft).trim()!=='';
    if(max<=1)return use(verb,1,max<1);
    return `<div class="bag-use-quantity"><label for="bag-use-count">${verb}数量</label><div class="bag-quantity-row">
      ${button('−','data-action="bagQuantity" data-step="-1" aria-label="减少数量"',blocked||max<1||valid&&count<=1)}
      <input id="bag-use-count" data-bag-quantity type="number" inputmode="numeric" min="1" max="${max}" step="1" value="${e(String(draft))}" aria-label="${verb}数量" aria-describedby="bag-use-count-hint" ${blocked||max<1?'disabled':''}>
      ${button('+','data-action="bagQuantity" data-step="1" aria-label="增加数量"',blocked||max<1||valid&&count>=max)}
      ${button('最大','data-action="bagQuantity" data-max="true"',blocked||max<1||valid&&count===max)}</div>
      <p id="bag-use-count-hint" data-bag-quantity-hint aria-live="polite">${valid?'':`请输入 1～${max} 的整数`}</p>
      ${use(verb,'selected',!valid)}</div>`;
  };
  let content='';
  if(rule?.kind==='pilotBox')content=`${batch('开启')}<details><summary>奖池与使用规则</summary><p>重复获得同名卡，满星后转为积分。</p><p>${s.pilotSupply.candidates.map(row=>e(row.name)).join('、')}</p></details>`;
  else if(rule?.kind==='pilotCard'){
    const pilot=s.replicaCollection?.pilots.find(row=>row.id===id);
    if(pilot?.maxed)content=`<p>驾驶员已满星，每张同名卡可转为 1 积分。</p><div class="bag-use-actions">${use('转换 1 张',1,item.count<1)}${all('转换',item.count,'张')}</div>`;
  }
  else if(rule?.kind==='exchange')content=`<p>按 1:1 兑换为 ${e(nativeItemPresentation(rule.target).name)}。</p><div class="bag-use-actions">${use('兑换 1 个',1,item.count<1)}${all('兑换',item.count,'个')}</div>`;
  else if(['pilotCompose','compose'].includes(rule?.kind)) {
    const max=Math.floor(item.count/rule.cost),name=nativeItemPresentation(rule.target).name;
    const full=rule.kind==='compose'&&s.replicaCollection?.pilots.find(row=>row.id===rule.target)?.maxed;
    const explanation=rule.kind==='compose'?`<p>每 ${rule.cost} 个碎片合成 ${e(name)} ×1${full?'，满星后转为 1 积分':''}。</p>`:'';
    content=`${explanation}<div class="bag-use-actions">${use('合成 1 个',1,max<1)}${all('合成',max,'个')}</div>`;
    const remainder=item.count%rule.cost;
    if(full&&remainder>0)content+=`<p>剩余 ${remainder} 碎片可兑换钻石 ×${h.number(remainder*MAXED_PILOT_FRAGMENT_DIAMONDS)}。</p><div class="bag-use-actions">${button('兑换余量',`aria-label="兑换余量 ${remainder} 个，获得钻石 ${h.number(remainder*MAXED_PILOT_FRAGMENT_DIAMONDS)} 个" data-action="bagUse" data-use-operation="exchangePilotRemainder" data-id="${id}" data-count="${remainder}" data-revision="${s.nativeAcquisition.revision}" data-gear-revision="${s.equipment.revision}"`,blocked)}</div>`;
  } else if(rule?.kind==='equipmentKey')content=batch('使用');
  else if(rule?.kind==='choice') {
    const selected=rule.choices.some(row=>row.id===state.bagChoice)?state.bagChoice:rule.choices[0].id;
    content=`<label class="bag-use-choice">选择奖励<select data-bag-choice aria-label="自选箱奖励">${rule.choices.map(row=>`<option value="${row.id}" ${row.id===selected?'selected':''}>${e(nativeItemPresentation(row.id).name)} ×${row.count}</option>`).join('')}</select></label><p>每个箱子只获得所选的一项；批量开启均选择同一项。</p>${batch('开启')}`;
  }
  return content?`<section class="bag-use-controls" aria-label="道具使用">${recovery}${content}</section>`:'';
}
