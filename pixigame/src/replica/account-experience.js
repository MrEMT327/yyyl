import source from './native-account-level-source.json' with {type:'json'};
import equipment from '../peripheral/equipment-reference-data.json' with {type:'json'};
import {validateReplicaProgression} from './native-progression.js';
import {validateReplicaInventory} from './native-economy.js';
import {replicaChapter} from './chapter-contract.js';
import {gearName} from '../peripheral/equipment-system.js';

// Original screenshots verify 10 account EXP on chapter 1/5 repeats, chapter
// 2/6 victories, a chapter 7 defeat at wave 12/15, and chapter 7 wave-1 exits.
// Other chapter/progress combinations use the same explicit local fallback.
// First-clear bonus EXP is unknown and is not invented here.
export const ACCOUNT_EXPERIENCE_POLICY=Object.freeze({id:'project-mainline-account-exp-v3',clearExperience:10,defeatExperience:10,quitExperience:10,verifiedChapters:Object.freeze([1,2,5,6]),verifiedDefeats:Object.freeze([Object.freeze({chapter:7,wave:12})]),verifiedQuits:Object.freeze([Object.freeze({chapter:7,wave:1,kills:0})]),firstClearBonus:0});
const levels=new Map(source.rows.map(row=>[row.id,row]));
const maxLevel=Math.max(...levels.keys());
function ledger(raw,level){
  if(!Number.isSafeInteger(level)||level<1)throw Error('账号等级无效');
  if(raw===undefined)return {version:1,experience:0,totalExperience:0,rewardedThroughLevel:level,pendingRewards:[],defeatExperienceRestored:false,quitExperienceRestored:false};
  if(!raw||raw.version!==1||!Number.isSafeInteger(raw.experience)||raw.experience<0
    ||raw.defeatExperienceRestored!==undefined&&typeof raw.defeatExperienceRestored!=='boolean'
    ||raw.quitExperienceRestored!==undefined&&typeof raw.quitExperienceRestored!=='boolean'
    ||!Number.isSafeInteger(raw.totalExperience)||raw.totalExperience<0
    ||!Number.isSafeInteger(raw.rewardedThroughLevel)||raw.rewardedThroughLevel<1||raw.rewardedThroughLevel>level
    ||!Array.isArray(raw.pendingRewards)||raw.pendingRewards.some(row=>!Number.isSafeInteger(row.level)||row.level<2||row.level>level||row.id!==2016||row.count!==1)
    ||levels.has(level)&&level<maxLevel&&raw.experience>=levels.get(level).exp)
    throw Error('账号经验记录无效，旧存档未覆盖');
  return structuredClone(raw);
}
export const createAccountExperience=progression=>({...ledger(undefined,progression.playerLevel??1),defeatExperienceRestored:true,quitExperienceRestored:true});
export function accountExperienceSnapshot(progression,raw){
  const level=progression.playerLevel??1,account=ledger(raw,level);
  return {level,experience:account.experience,requiredExperience:level>=maxLevel?null:levels.get(level)?.exp??null,
    totalExperience:account.totalExperience,pendingRewards:account.pendingRewards};
}
function validBattle(result){
  const chapter=replicaChapter(result.chapterId);
  const outcome=result.won===true?result.wave===chapter?.waveCount&&result.endReason!=='defeat'&&result.endReason!=='quit'
    :result.won===false&&['defeat','quit'].includes(result.endReason);
  return Boolean(chapter&&Number.isInteger(result.wave)&&result.wave>=1&&result.wave<=chapter.waveCount&&outcome
    &&typeof result.runId==='string'&&result.runId&&!result.trial&&!result.debugRun&&!result.abandoned);
}
const validClear=result=>result.won===true&&validBattle(result);
function grantExperience(rawProgression,rawInventory,rawGear,rawAccount,earned){
  const progression=validateReplicaProgression(rawProgression),inventory=validateReplicaInventory(rawInventory);
  const account=ledger(rawAccount,progression.playerLevel),fromLevel=progression.playerLevel;
  let gear=rawGear;
  if(!Number.isSafeInteger(earned)||earned<1||!Number.isSafeInteger(account.totalExperience+earned)||!Number.isSafeInteger(account.experience+earned))throw Error('账号经验数量超限');
  account.experience+=earned;account.totalExperience+=earned;account.policyId=ACCOUNT_EXPERIENCE_POLICY.id;account.defeatExperienceRestored=true;account.quitExperienceRestored=true;
  const rewards=[{type:'native-item',id:3,name:'账号经验',amount:earned,accountExperience:true}],deferredRewards=[];
  while(progression.playerLevel<maxLevel&&account.experience>=levels.get(progression.playerLevel).exp){
    account.experience-=levels.get(progression.playerLevel).exp;
    const level=++progression.playerLevel;
    for(const[id,amount]of levels.get(level).reward){
      const row=equipment.equip.find(row=>row.ID===id);
      if(row){
        if(gear===rawGear)gear=structuredClone(rawGear);
        if(gear?.version!==2||!Array.isArray(gear.items)||!Number.isSafeInteger(gear.serial)||gear.serial<0||!Number.isSafeInteger(gear.revision)||gear.items.length+amount>10000)throw Error('装备库存无法接收升级奖励');
        const uids=[];
        for(let i=0;i<amount;i++){
          const serial=gear.serial+1,uid='gear-'+serial;
          if(!Number.isSafeInteger(serial)||gear.items.some(item=>item.uid===uid))throw Error('装备序号无效');
          gear.serial=serial;gear.items.push({uid,family:id-row.quality,quality:row.quality,locked:false});uids.push(uid);
        }
        gear.revision++;if(!Number.isSafeInteger(gear.revision))throw Error('装备版本超限');
        rewards.push({type:'equipment',id,name:gearName({family:id-row.quality,quality:row.quality}),amount,uids,accountLevelReward:level});
      }else if(id===2016){
        // Original level 9 gives a three-day benefit card. That system is absent;
        // retain the entitlement once, instead of granting an unusable item.
        const pending={level,id,count:amount};account.pendingRewards.push(pending);deferredRewards.push(pending);
      }else{
        if(![1,2].includes(id)||!Number.isSafeInteger(amount)||amount<1)throw Error('账号升级奖励配置无效');
        const total=(inventory.items[id]||0)+amount;if(!Number.isSafeInteger(total))throw Error('升级奖励超出库存范围');inventory.items[id]=total;
        rewards.push({type:id===1?'coins':'diamonds',id,name:id===1?'升级奖励 · 金币':'升级奖励 · 钻石',amount,accountLevelReward:level});
      }
    }
    account.rewardedThroughLevel=level;
  }
  if(progression.playerLevel>=maxLevel)account.experience=0;
  inventory.revision++;
  return {progression:validateReplicaProgression(progression),inventory:validateReplicaInventory(inventory),gear,account,rewards,
    transition:{fromLevel,toLevel:progression.playerLevel,experience:earned,remainingExperience:account.experience,deferredRewards}};
}
export function planAccountBattleExperience(progression,inventory,gear,account,result){
  if(!validBattle(result)||account?.lastRunId===result.runId)return null;
  const plan=grantExperience(progression,inventory,gear,account,result.won?ACCOUNT_EXPERIENCE_POLICY.clearExperience:result.endReason==='quit'?ACCOUNT_EXPERIENCE_POLICY.quitExperience:ACCOUNT_EXPERIENCE_POLICY.defeatExperience);
  plan.account.lastRunId=result.runId;return plan;
}
export function planAccountExperienceRepair(progression,inventory,gear,account,campaign={},results=[]){
  if(account?.defeatExperienceRestored===true&&account?.quitExperienceRestored===true)return null;
  const baseline=ledger(account,progression.playerLevel),legacy=account===undefined;
  // Previously levelled imported accounts may already include historical EXP.
  // V1/V2 accounts restore only unpaid outcomes introduced after their policy.
  const eligible=legacy?(progression.playerLevel===1?results.filter(validBattle):[]):
    results.filter(row=>validBattle(row)&&row.won===false&&!row.accountExperience?.experience
      &&(row.endReason==='defeat'&&!baseline.defeatExperienceRestored||row.endReason==='quit'&&!baseline.quitExperienceRestored));
  const runs=new Map(eligible.map(row=>[row.runId,row]));
  if(legacy&&progression.playerLevel===1&&(campaign.clearedChapterIds||[]).includes(1)
    &&!eligible.some(row=>row.chapterId===1&&validClear(row)))runs.set('legacy-first-chapter',{chapterId:1,won:true});
  if(!runs.size)return {progression:validateReplicaProgression(progression),inventory:validateReplicaInventory(inventory),gear,
    account:{...baseline,defeatExperienceRestored:true,quitExperienceRestored:true},rewards:[],transition:{fromLevel:progression.playerLevel,toLevel:progression.playerLevel,experience:0,remainingExperience:baseline.experience,deferredRewards:[]}};
  const plan=grantExperience(progression,inventory,gear,baseline,runs.size*ACCOUNT_EXPERIENCE_POLICY.clearExperience);
  plan.account.recoveredRunCount=(baseline.recoveredRunCount||0)+runs.size;
  plan.account.recoveredDefeatCount=(baseline.recoveredDefeatCount||0)+eligible.filter(row=>row.endReason==='defeat').length;
  plan.account.recoveredQuitCount=(baseline.recoveredQuitCount||0)+eligible.filter(row=>row.endReason==='quit').length;
  plan.account.lastRunId=[...runs.keys()].at(-1);return plan;
}
