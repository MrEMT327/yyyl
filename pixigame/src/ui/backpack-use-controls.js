import { backpackItemSources } from './backpack-item-sources.js';
import { ITEM_USE_BATCH_LIMIT, isItemUseBatchCount } from '../replica/item-use-batches.js';
import { backpackUseRule } from '../replica/native-backpack-use.js';
import { nativeItemPresentation } from '../replica/native-item-presentation.js';
import { GEAR_PARTS } from '../peripheral/equipment-system.js';

export function backpackUseControls(item,s,state,h) {
  const e=h.escape,id=item.nativeId,rule=backpackUseRule(id),blocked=s.rewardPending||s.rewardBusy;
  const button=(label,attrs,disabled=false)=>`<button type="button" class="wc-button bag-use-button" ${attrs} ${disabled?'disabled':''}>${e(label)}</button>`;
  const use=(label,count,disabled=false,description='')=>button(label,`${count==='selected'?'data-bag-use-selected':''} data-action="bagUse" data-id="${id}" data-count="${count}" data-revision="${s.nativeAcquisition.revision}" data-gear-revision="${s.equipment.revision}" ${description?`aria-label="${e(description)}"`:''}`,blocked||disabled);
  const all=(verb,count,unit)=>`<div class="bag-batch-action">${use(verb+'全部',count,count<1,`${verb}全部，共${h.number(count)}${unit}`)}<small>共 ${h.number(count)} ${unit}</small></div>`;
  const go=(label,kind,target='')=>button(label,`data-action="bagGo" data-kind="${kind}" data-id="${target}"`);
  const recovery=s.rewardPending?`<p role="status">已有奖励待保存，请先重试。</p>${button('重试保存','data-action="recoverDailyRewards"',s.rewardBusy)}`:s.rewardBusy?'<p role="status">奖励正在处理，请稍候。</p>':'';
  const batch=(verb,unit)=>{
    const max=Math.min(item.count,ITEM_USE_BATCH_LIMIT),draft=state.bagCount??1,count=Number(draft);
    const valid=isItemUseBatchCount(count)&&count<=max&&String(draft).trim()!=='';
    return `<div class="bag-use-actions">${use(`${verb} 1 ${unit}`,1,item.count<1)}${use(`${verb} 10 ${unit}`,10,item.count<10)}</div>
      <details class="bag-batch-details"><summary>自定数量</summary><div class="bag-use-quantity"><label for="bag-use-count">${verb}数量</label><div class="bag-quantity-row">
      ${button('−','data-action="bagQuantity" data-step="-1" aria-label="减少数量"',blocked||max<1||valid&&count<=1)}
      <input id="bag-use-count" data-bag-quantity type="number" inputmode="numeric" min="1" max="${max}" step="1" value="${e(String(draft))}" aria-label="${verb}数量" aria-describedby="bag-use-count-hint" ${blocked||max<1?'disabled':''}>
      ${button('+','data-action="bagQuantity" data-step="1" aria-label="增加数量"',blocked||max<1||valid&&count>=max)}
      ${button('最大','data-action="bagQuantity" data-max="true"',blocked||max<1||valid&&count===max)}</div>
      <p id="bag-use-count-hint" data-bag-quantity-hint aria-live="polite">${valid?`本次${verb} ${count} ${unit}，每批最多 ${ITEM_USE_BATCH_LIMIT} ${unit}`:`请输入 1～${max} 的整数`}</p>
      ${use(`按所选数量${verb}`,'selected',!valid)}</div></details>`;
  };
  let content='';
  if(rule?.kind==='pilotBox')content=`<p>每箱获得一名驾驶员。</p>${batch('开启','个')}<details><summary>奖池与使用规则</summary><p>重复获得同名卡，满星后转为积分。</p><p>${s.pilotSupply.candidates.map(row=>e(row.name)).join('、')}</p></details>`;
  else if(rule?.kind==='pilotCard'){
    const pilot=s.replicaCollection?.pilots.find(row=>row.id===id);
    content=go('前往激活／升星','pilots',id)+(pilot?.maxed?`<p>驾驶员已满星，每张同名卡可转为 1 个满星重复积分。</p><div class="bag-use-actions">${use('转换 1 张',1,item.count<1)}${all('转换',item.count,'张')}</div>`:'<p>同名卡用于激活或升星；满星后可在此转换积分。</p>');
  }
  else if(rule?.kind==='exchange')content=`<p>按 1:1 兑换为 ${e(nativeItemPresentation(rule.target).name)}，${[112,113].includes(rule.target)?'兑换后可直接开启对应装备箱':'用于对应的成长系统'}。</p><div class="bag-use-actions">${use('兑换 1 个',1,item.count<1)}${all('兑换',item.count,'个')}</div>`;
  else if(['pilotCompose','compose'].includes(rule?.kind)) {
    const max=Math.floor(item.count/rule.cost),name=nativeItemPresentation(rule.target).name;
    const full=rule.kind==='compose'&&s.replicaCollection?.pilots.find(row=>row.id===rule.target)?.maxed;
    content=`<p>每 ${rule.cost} 个碎片合成 ${e(name)} ×1${rule.kind==='compose'?full?' 对应同名卡；该驾驶员已满星，合成后转为 1 个满星重复积分':' 同名卡；合成后用于激活或升星':'；合成后再开启'}。</p><div class="bag-use-actions">${use('合成 1 个',1,max<1)}${all('合成',max,'个')}</div>`;
    const remainder=item.count%rule.cost;
    if(full&&remainder>0)content+=`<p>满星后剩余 ${remainder} 个专属碎片可按 1:1 换为角色箱碎片。整组 ${rule.cost} 个仍可合成为积分。</p><div class="bag-use-actions">${button('兑换余量',`aria-label="兑换余量 ${remainder} 个，获得角色箱碎片 ${remainder} 个" data-action="bagUse" data-use-operation="exchangePilotRemainder" data-id="${id}" data-count="${remainder}" data-revision="${s.nativeAcquisition.revision}" data-gear-revision="${s.equipment.revision}"`,blocked)}</div>`;
  } else if(rule?.kind==='equipmentKey')content=`<p>每张券开启对应装备箱 1 次，只消耗箱券。券不足时不会改用钻石。</p>${batch('使用','张')}`;
  else if(rule?.kind==='choice') {
    const selected=rule.choices.some(row=>row.id===state.bagChoice)?state.bagChoice:rule.choices[0].id;
    content=`<label class="bag-use-choice">选择奖励<select data-bag-choice aria-label="自选箱奖励">${rule.choices.map(row=>`<option value="${row.id}" ${row.id===selected?'selected':''}>${e(nativeItemPresentation(row.id).name)} ×${row.count}</option>`).join('')}</select></label><p>每个箱子只获得所选的一项；批量开启均选择同一项。</p>${batch('开启','个')}`;
  } else {
    const part=GEAR_PARTS.find(row=>row.blueprintId===id);
    const lab=s.replicaCollection?.labs.find(row=>row.levels.some(level=>level.costs.some(cost=>cost.id===id&&id>=801&&id<=811)));
    const group=['guns','skins','pilots'].find(kind=>s.replicaCollection?.[kind]?.some(row=>row.id===id));
    if(part)content=go('前往装备强化','equipment',part.type);
    else if(lab)content=go('前往对应科研','lab',lab.id);
    else if(group)content=go('前往激活／升星',group,id);
    else if(id===135)content='<p>星核在天赋王牌觉醒时消耗。</p>'+go('前往天赋','talent');
    else if(id===1)content=go('前往装备强化','equipment');
    else if(id===2)content=go('前往商城','shop');
    else if(item.id==='stamina'||id===4)content='<p>出击和快速巡逻时自动消耗，无需在背包使用。</p>';
    else content='<p>此道具对应的使用功能暂未开放，数量保留。</p>';
  }
  return `<section class="bag-use-controls" aria-label="道具使用">${recovery}${content}${backpackItemSources(item,s,rule,h,go)}</section>`;
}
