import {createLobbyPanel} from './lobby-panel.js';
import {detailSheet,sheetMetrics} from './detail-sheet.js';
import {paintItemDetail} from './item-details.js';
import {fmt,box,words} from './menu-art.js';
import {normalFit} from './catalog-art.js';
import {actions,headingValue,hit,label,notice} from './supply-cards.js';
import {supplyTasks,supplyBoxes,growthChoice} from './supply-tasks.js';
import {nativeItemArt} from '../../replica/native-item-presentation.js';
import {rewardDisplayQuality} from '../../replica/item-display-quality.js';
import {paintRewardItemSlot} from '../../ui/reward-item-art.js';
import {equipmentBoxRuleLines} from '../../ui/equipment-box-rule-lines.js';

const titles={nativeEquipmentBoxes:'装备箱说明',nativeRecruitInfo:'积分兑换',pilotSupplyBoxes:'积分兑换',pilotSupplyTasks:'补给任务',growthSupplyChoice:'成长补给',shopSpecials:'特惠'};
export const supportsSupplyPanel=k=>Object.hasOwn(titles,k);
const rate=n=>Number((n/1000).toFixed(4))+'%';
function boxGuide(r,d){
  const s=d.snapshot;
  for(const b of s.nativeAcquisition.equipmentBoxes){
    const c=b.compatibility,hours=Math.ceil(Math.max(0,c.nextFreeAt-Date.now())/3600000);
    headingValue(r,b.name,'箱券 ×'+fmt(b.keys));r.text(c.freeAvailable?'免费开启可用':'免费开启 · '+fmt(hours)+'小时后',{weight:700});
    r.text((b.id===3?'史诗':'优秀')+'保底 '+fmt(c.qualityRemaining)+'件'+(c.sRemaining?'   圣环保底 '+fmt(c.sRemaining)+'件':''));
    r.text(b.quotes.map(q=>(q.count===1?'单次 ':'十次 ')+(q.payment==='free'?'免费':(q.payment==='key'?'箱券':'钻石')+' ×'+(q.amount==null?'—':fmt(q.amount)))).join(' · '));
    if(!b.canDraw)r.text(b.unavailableReason);label(r,'概率与规则');
    for(const g of b.rates){
      headingValue(r,g.name,rate(g.weight));
      r.grid(g.items,1,(a,rect,it,visible)=>{
        if(visible){normalFit(a,r.t,nativeItemArt(it.id),box(rect.x,rect.y+8,32,32));words(a,it.name+' ×'+it.count,rect.x+40,rect.y+24,14,{align:'left',color:'#20394d',maxWidth:rect.w-98});
          words(a,rate(it.weight),rect.x+rect.w,rect.y+24,14,{align:'right',weight:700,color:'#304f65'});}
        return hit('rate-'+b.id+'-'+it.id,it.name,'inspect',{itemId:it.id});},{height:48,gap:0});
    }
    label(r,'开启规则');for(const line of equipmentBoxRuleLines(b))r.text(line);
    r.text('免费优先；十连箱券不足时，整单使用钻石。');if(b.id===4)r.text('累计 '+fmt(s.equipment.draws)+' 次 · 高级券可领 '+fmt(s.equipment.basicRewardAvailable)+' 次');
    r.line();r.gap(10);
  }
  actions(r,[hit('shop','前往商城','equipmentShop',{section:'boxes'})]);
  actions(r,[...(s.equipmentBoxReceipt?[hit('last','上次结果','nativeEquipmentBoxLast')]:[]),hit('bag','打开背包','nativeMaterials')]);
}
const specialTabs=[
  ['daily','每日','每日 00:00 刷新'],
  ['weekly','每周','周一 00:00 刷新'],
  ['monthly','每月','每月 1 日 00:00 刷新'],
];
function shopSpecials(r,{snapshot:s,modal}){
  const period=modal.period;
  const flight=s.flightRewards,offer=flight?.adOffers?.[period];
  if(!offer)return;
  const [,title,reset]=specialTabs.find(([id])=>id===period);
  actions(r,specialTabs.map(([id,name])=>hit('special-'+id,name,'shopSpecialPeriod',{period:id},false,id===period)));
  r.text('北京时间 '+reset,{size:13,color:'#516e81',align:'right'});
  r.block(c=>{
    headingValue(c,title+'特惠','剩余 '+(offer.canClaim?'1 / 1':'0 / 1'));
    c.grid(offer.rewards,offer.rewards.length,(a,b,reward,show)=>{
      if(show){
        const size=Math.min(60,b.w-6),center=b.x+b.w/2;
        paintRewardItemSlot(a,{...reward,...rewardDisplayQuality(reward)},{x:center-size/2,y:b.y,size},c.t.image);
        words(a,reward.name,center,b.y+size+12,11,{color:'#385d76',maxWidth:b.w-2});
      }
      return hit('special-reward-'+reward.id,reward.title,'inspect',{itemId:reward.id});
    },{height:84});
    const label=flight.adBusy?'广告播放中':offer.clockRollback?'设备日期异常':!offer.canClaim?'本期已领取':!flight.adAvailable?'广告暂不可用':'看广告领取';
    actions(c,[hit('claim-special',label,'flightReward',{operation:'ad',period,revision:flight.revision},
      s.rewardBusy||s.rewardPending||!offer.canClaim||!flight.adAvailable,true)]);
  });
}
export function openSupplyPanel(screen,host,send){
  let latest,key,identity,inspect=null;const metrics=sheetMetrics();
  function refresh(){panel.update({...latest,inspect},key+'|'+identity+'|'+(inspect?.itemId||''),identity);}
  const panel=createLobbyPanel(screen,host,'补给',(d,w,h,t)=>{
    const type=d.modal.type,title=type==='growthSupplyChoice'?d.snapshot.pilotSupply?.growth?.[d.modal.period]?.name||titles[type]:titles[type];
    detailSheet(t,d,w,h,{title,width:.92*w,minHeight:type==='shopSpecials'?0:h*.84,maxHeight:h*.84,build:r=>{
      notice(r,d.snapshot);if(type==='nativeEquipmentBoxes')boxGuide(r,d);
      else if(type==='shopSpecials')shopSpecials(r,d);
      else if(type==='pilotSupplyTasks')supplyTasks(r,d);else if(type==='growthSupplyChoice')growthChoice(r,d);else supplyBoxes(r,d);
    }});
    if(inspect){paintItemDetail(d,w,h,t);return 'inspect';}return 'base';
  },cmd=>{if(cmd.type==='inspect'){inspect=cmd.data;panel.scroll('inspect',0);refresh();}
    else if(cmd.type==='close'&&inspect){inspect=null;refresh();}else if(cmd.type!=='none')send(cmd.type,cmd.data||{},host);});
  return {host,close:panel.close,update(snapshot,modal,signature){const id=modal.type+'|'+modal.period;if(id!==identity){inspect=null;panel.scroll('base',0);}identity=id;
    latest={snapshot,modal,sheetMetrics:metrics,safeBottom:screen.menuView?.safeBottom||0};key=[signature,snapshot.rewardPending,snapshot.rewardBusy,snapshot.pilotSupply?.revision].join('|');refresh();}};
}

