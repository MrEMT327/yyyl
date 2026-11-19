import {fmt} from './menu-art.js';
import {actions,headingValue,hit,label,meter,rewards} from './supply-cards.js';
const viewRewards=v=>(v.supplemental?v.extraRewards:[v.box,v.material,...(v.extraRewards||[])]).filter(Boolean);
export function growthChoice(r,d){
  const {snapshot:s,modal:m}=d,p=s.pilotSupply,v=p?.growth?.[m.period];
  if(!v){r.text('补给内容不存在，请返回。');return;}
  headingValue(r,m.period==='week'?'第'+v.chapter+'章 · 活跃'+v.days+'天':'每日满活跃后领取',v.claimed?'已领取':v.canClaim?'可领取':'未达成');
  r.block(c=>{label(c,v.supplemental?'星核补领':'星核补给');rewards(c,viewRewards(v),'growth');c.text('奖励存入背包',{size:13});
    actions(c,[hit('claim',v.supplemental?'补领星核':v.claimed?'本期已领取':!v.reached?'条件未达成':'领取补给','growthSupplyClaim',{id:0,revision:p.revision},s.rewardPending||s.rewardBusy||!v.canClaim,true)]);});
  r.gap(8);label(r,'领取规则');r.text(v.requirement+'。');r.text(v.coreIncomeNote||'');r.text('北京时间00:00刷新，每周补给周一刷新。');r.gap(8);
  actions(r,[...(v.box?[hit('bag-box','打开宝箱','bagOpen',{id:v.boxId},!s.nativeAcquisition.materials.some(row=>row.id===v.boxId&&row.count>0))]:[]),hit('return','返回','close')]);
}
function growthEntry(r,s,period){
  const v=s.pilotSupply?.growth?.[period];if(!v||v.available===false)return;
  r.block(c=>{headingValue(c,v.name,v.supplemental?'可补领':v.claimed?'已领取':v.canClaim?'可领取':'未达成');
    c.text(period==='week'?'通关第'+v.chapter+'章 · 活跃'+v.days+'天':'每日100活跃');
    rewards(c,viewRewards(v).map(it=>({...it,label:it.id===135?'星核':''})),'entry');
    actions(c,[hit('growth',v.supplemental?'补领星核':v.claimed?'已领取 · 查看':v.canClaim?'领取补给':'查看奖励','growthSupplyOpen',{period},s.rewardBusy||s.rewardPending)]);});r.gap(9);
}
export function supplyTasks(r,d){
  const s=d.snapshot,p=s.pilotSupply,week=d.modal.period==='week',period=week?'week':'daily',v=week?p.week:p.activity;
  const blocked=s.rewardPending||s.rewardBusy,revision=p.revision,cmd=(id,label,operation,extra,disabled)=>hit(id,label,'pilotSupply',{operation,revision,...extra},disabled||blocked);
  actions(r,[hit('daily','每日','pilotSupplyTab',{period:'daily'},false,!week),hit('weekly','每周','pilotSupplyTab',{period:'week'},false,week)]);
  r.text((week?'周一':'每日')+' 00:00 刷新',{size:13,color:'#516e81',align:'right'});
  r.block(c=>{headingValue(c,week?'每周活跃':'每日活跃',fmt(v.points)+' / 100');meter(c,v.points);rewards(c,v.rewards,'activity');
    actions(c,[cmd('activity',v.claimed?'已领取':v.canClaim?'领取':'未达成',week?'weekly':'activity',{},!v.canClaim)]);});r.gap(8);
  if(!week)for(const task of p.tasks){r.block(c=>{headingValue(c,task.name,task.target?fmt(task.progress)+'/'+fmt(task.target):'');
    rewards(c,task.rewards,'reward-'+task.id);c.text('活跃 +'+task.points,{size:13});if(task.starterName)c.text('首次解锁 '+task.starterName,{size:13});
    if(task.introRewards?.length){label(c,'首次奖励');rewards(c,task.introRewards,'intro-'+task.id);}
    actions(c,[cmd('task-'+task.id,task.claimed?'已领取':task.canClaim?'领取':'未完成','task',{id:task.id},!task.canClaim)]);});r.gap(8);}
  growthEntry(r,s,period);
  if(!week){
    const f=s.flightRewards;if(f?.ad)r.block(c=>{headingValue(c,'每日特惠','每日1次');rewards(c,f.ad.rewards,'daily-ad');
      actions(c,[hit('ad-flight',f.adPending?'重试保存':f.adBusy?'广告播放中':!f.ad.canClaim?'已领取':!f.adAvailable?'广告暂不可用':'看广告领取',f.adPending?'recoverDailyRewards':'flightReward',{operation:'ad',revision:f.revision},f.adBusy||!f.adPending&&(blocked||!f.ad.canClaim||!f.adAvailable))]);});r.gap(8);
    r.block(c=>{headingValue(c,'广告补给',fmt(p.ad.count)+' / '+fmt(p.ad.limit)+'次');rewards(c,p.ad.rewards,'ad');
      actions(c,[cmd('ad',p.adPending?'重试保存':p.adBusy?'广告播放中':!p.ad.canClaim?'已领完':!p.adAvailable?'广告暂不可用':'看广告领取','ad',{},p.adBusy||!p.adPending&&(!p.ad.canClaim||!p.adAvailable)),
        ...(p.development?[cmd('dev-ad','开发领取','devAd',{},!p.ad.canClaim||p.adBusy||p.adPending)]:[])]);});r.gap(8);
  }
  label(r,'任务规则');r.text('北京时间刷新，完成出击后计入进度，中途退出不计。');r.text('完整观看广告后领取奖励。');
  if(week)r.text('完成每周任务积累活跃，满100可领取奖励。');const view=p.growth?.[period];
  if(view){r.text(view.requirement+'。');if(view.allowanceNote)r.text(view.allowanceNote);if(view.coreIncomeNote)r.text(view.coreIncomeNote);}r.gap(8);
  actions(r,[hit('exchange','积分兑换','pilotSupplyBoxes')]);
}
export function supplyBoxes(r,d){
  const s=d.snapshot,p=s.pilotSupply,b=p.box,blocked=s.rewardPending||s.rewardBusy,need=b.required??50;
  if(b.count)r.block(c=>{headingValue(c,'角色箱','×'+fmt(b.count));rewards(c,[{id:925,count:b.count}],'box');c.text('开启获得驾驶员');
    c.text(b.missing?'再开 '+b.remaining+' 箱内必得新驾驶员':'奖池驾驶员已集齐');actions(c,[hit('open','前往开启','bagOpen',{id:925})]);});r.gap(7);
  if(b.fragments)r.block(c=>{headingValue(c,'角色箱碎片',b.fragments+' / '+need);rewards(c,[{id:926,count:b.fragments}],'fragment');c.text(need+'碎片合成1箱');meter(c,b.fragments,need);
    actions(c,[hit('compose','前往合成','bagOpen',{id:926})]);});r.gap(7);
  headingValue(r,'积分兑换','拥有 '+fmt(b.credits));r.text(p.creditCost+' 积分／次'+(p.development?' · 开发免费':''));
  for(const it of p.exchanges){
    const description=it.owned?it.maxed?'已满星':'同名卡 '+fmt(it.copies):'未拥有',disabled=blocked||it.maxed||!p.development&&b.credits<p.creditCost;
    r.grid([it],1,(a,rect)=>{a.quad(rect.x,rect.y+rect.h-1,rect.w,1,'#8ba5b6',.55);
      a.text(it.name,rect.x,rect.y+14,{size:15,color:'#233f53',maxWidth:rect.w*.59});a.text(description,rect.x,rect.y+33,{size:12,color:'#526e82'});
      return null;},{height:46});
    actions(r,[hit('exchange-'+it.id,p.development?'开发兑换':it.maxed?'已满星':it.owned?'兑换':'解锁','pilotSupply',{operation:'exchange',revision:p.revision,id:it.id},disabled)]);
  }
  rewards(r,[{id:112,count:1,label:'高级装备箱券'}],'key');r.text(p.creditCost+' 积分');
  actions(r,[hit('exchange-key',p.development?'开发兑换':'兑换箱券','pilotSupply',{operation:'exchangeKey',revision:p.revision},blocked||!p.development&&b.credits<p.creditCost)]);
  if(b.count){label(r,'开箱规则');for(const line of ['基础概率：每人12.5%。','前2箱优先未拥有；此后连续4次重复，第5次必得未拥有。','获得新人重置保底，集齐后停止保底。','每箱独立结算，单开和批量共享进度。','新驾驶员解锁；重复转同名卡，满星后转积分。'])r.text(line);}
}

