import {backpackUseRule} from '../../replica/native-backpack-use.js';
import {nativeItemPresentation} from '../../replica/native-item-presentation.js';
import {ITEM_USE_BATCH_LIMIT,isItemUseBatchCount} from '../../replica/item-use-batches.js';
import {MAXED_PILOT_FRAGMENT_DIAMONDS} from '../../replica/pilot-supply-reward-policy.js';

// Project the same inventory rules and revision numbers used by peripheralAction.
export function backpackOptions(item,snapshot,state){
  if(!item?.nativeId||!snapshot.nativeAcquisition)return [];
  const rule=backpackUseRule(item.nativeId);
  if(!rule)return [];
  const rows=[],locked=Boolean(snapshot.rewardPending||snapshot.rewardBusy);
  const words=text=>rows.push({kind:'text',text});
  const use=(label,count,operation)=>({id:operation||label,label,action:'use',count,operation,
    disabled:locked||count<1,revision:snapshot.nativeAcquisition.revision,gearRevision:snapshot.equipment.revision});
  const buttons=(...options)=>rows.push({kind:'buttons',options});
  const all=(verb,count,unit)=>({...use(verb+'全部',count),hint:'共 '+count.toLocaleString('zh-CN')+' '+unit});
  function batch(verb){
    const max=Math.min(item.count,ITEM_USE_BATCH_LIMIT),number=Number(state.bagCount??1);
    if(max<=1){buttons({...use(verb,1),disabled:locked||max<1});return;}
    const valid=isItemUseBatchCount(number)&&number<=max&&String(state.bagCount??1).trim()!=='';
    rows.push({kind:'quantity',label:verb+'数量',value:String(state.bagCount??1),max,disabled:locked,valid});
    if(!valid)words('请输入 1～'+max+' 的整数');
    buttons({...use(verb,number),disabled:locked||!valid});
  }
  switch(rule.kind){
    case 'pilotBox':
      batch('开启');words('奖池与使用规则');words('重复获得同名卡，满星后转为积分。');words(snapshot.pilotSupply.candidates.map(r=>r.name).join('、'));break;
    case 'pilotCard':
      if(snapshot.replicaCollection?.pilots.find(r=>r.id===item.nativeId)?.maxed){
        words('驾驶员已满星，每张同名卡可转为 1 积分。');buttons(use('转换 1 张',1),all('转换',item.count,'张'));
      }break;
    case 'exchange':
      words('按 1:1 兑换为 '+nativeItemPresentation(rule.target).name+'。');buttons(use('兑换 1 个',1),all('兑换',item.count,'个'));break;
    case 'pilotCompose':case 'compose':{
      const max=Math.floor(item.count/rule.cost),full=rule.kind==='compose'&&snapshot.replicaCollection?.pilots.find(r=>r.id===rule.target)?.maxed;
      if(rule.kind==='compose')words('每 '+rule.cost+' 个碎片合成 '+nativeItemPresentation(rule.target).name+' ×1'+(full?'，满星后转为 1 积分':'')+'。');
      buttons({...use('合成 1 个',1),disabled:locked||max<1},all('合成',max,'个'));
      const left=item.count%rule.cost;
      if(full&&left){words('剩余 '+left+' 碎片可兑换钻石 ×'+(left*MAXED_PILOT_FRAGMENT_DIAMONDS).toLocaleString('zh-CN')+'。');buttons(use('兑换余量',left,'exchangePilotRemainder'));}
      break;
    }
    case 'equipmentKey': batch('使用');break;
    case 'choice':{
      const options=rule.choices.map(r=>({id:r.id,label:nativeItemPresentation(r.id).name+' ×'+r.count}));
      rows.push({kind:'choice',label:'选择奖励',options,selected:options.find(r=>r.id===state.bagChoice)||options[0]});
      words('每个箱子只获得所选的一项；批量开启均选择同一项。');batch('开启');break;
    }
  }
  if(rows.length&&snapshot.rewardPending)rows.unshift({kind:'text',text:'已有奖励待保存，请先重试。'},{kind:'buttons',options:[{id:'recover',action:'recover',label:'重试保存',disabled:snapshot.rewardBusy}]});
  else if(rows.length&&snapshot.rewardBusy)rows.unshift({kind:'text',text:'奖励正在处理，请稍候。'});
  return rows;
}
