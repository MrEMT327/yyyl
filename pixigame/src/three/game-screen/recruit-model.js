import {cloudNativeRecruitSnapshot} from '../../replica/recruit-snapshot.js';
import {nativeRewardPresentation} from '../../replica/native-item-presentation.js';
import {nativePilotDisplayQuality} from '../../replica/native-pilot-quality.js';
import {rewardItemModel} from '../../ui/reward-item-model.js';
import {supplyPool} from '../../ui/supply-pools.js';
import {recruitBoxItems} from '../../ui/recruit-selection.js';
import {portraitPresentation} from '../../ui/character-portraits.js';
import {qualityDisplayLabel} from '../../ui/quality-display-label.js';
import {pilotCardQuality} from '../../ui/pilot-card-quality.js';

export function recruitPreviewModel(snapshot){
  const s=cloudNativeRecruitSnapshot(snapshot),info=supplyPool(s,'pilot');
  if(info.direct){
    const pilots=recruitBoxItems(s).map(p=>{const art=portraitPresentation(p);
      return {name:p.name.replace('·','\n'),detail:qualityDisplayLabel(p.rarity,p.qualityKnown),image:art.avatar||art.image};});
    const resources=(info.resources||[]).map(r=>({name:r.name==='随机装备图纸'?'随机\n装备图纸':r.name,detail:'×'+r.amount,image:r.image}));
    const heading=info.tenPilotSummary||'驾驶员';
    return {title:'招募奖励',direct:true,sections:[{heading,rows:pilots},{heading:'资源',rows:resources}]};
  }
  const short={1:'金币',112:'高级箱券',113:'普通箱券',blueprint:'随机图纸'};
  const rows=Object.entries(info.probabilities||{}).filter(([id,n])=>!['925','926'].includes(id)&&!/角色箱/.test(info.probabilityLabels?.[id]||'')&&Number.isFinite(Number(n))).map(([id])=>{
    const label=info.probabilityLabels?.[id]||id,m=/^(.*?)\s*×\s*(\d+)$/.exec(label);
    return {name:short[id]||m?.[1]||label,detail:m?'×'+Number(m[2]):'',image:nativeRewardPresentation({id:id==='blueprint'?10010007:Number(id)}).image};
  });
  return {title:'奖励预览',direct:false,sections:[{rows}]};
}
export function recruitResultsModel(snapshot,modal){
  const pilots=cloudNativeRecruitSnapshot(snapshot).pilots;
  return modal.rewards.map(reward=>{
    const nativeId=Number(reward.nativeId??reward.nativeItemId);
    const base=modal.recruit&&((nativeId>0&&pilots.find(p=>Number(p.nativeId)===nativeId))||pilots.find(p=>p.id===(reward.pilotId||reward.id)));
    if(!base)return {item:rewardItemModel(reward,snapshot),raw:reward};
    const quality=nativeId>0&&nativePilotDisplayQuality({nativeId});
    const pilot=quality?.qualityKnown?{...base,...quality}:base.rarity==='UR'?{...base,rarity:'SSR'}:base;
    const known=pilot.qualityKnown!==false;
    const rank=known?({2:'R',3:'SR',4:'SSR'}[pilot.qualityRank]||(!Number.isInteger(pilot.qualityRank)&&pilot.rarity)||'未标注'):'未标注';
    const note=reward.nativeRecruit?(reward.creditsAdded?'积分 +'+reward.creditsAdded:reward.isNew?'':'同名卡 ×'+(reward.copiesAdded??reward.amount??1)):reward.copiesAdded?'同名卡 ×'+reward.copiesAdded:reward.isNew?'':reward.type==='pilot'?reward.beforeStars+' → '+reward.stars+' 星':'碎片 ×'+reward.amount;
    return {pilot:{...pilot,stars:reward.stars??pilot.stars},raw:reward,grade:pilotCardQuality(rank,pilot.qualityRank,known),rarity:qualityDisplayLabel(rank,known),note};
  });
}
