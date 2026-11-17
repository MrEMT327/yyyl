import { flightDay } from './flight-rewards.js';
import { replicaChapter } from './chapter-contract.js';

const safe=value=>Number.isSafeInteger(value)&&value>=0;
const count=value=>safe(value)?value:0;
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)
  &&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
const add=(left,right)=>{const sum=left+right;if(!safe(sum))throw Error('成就累计次数超限');return sum;};
const maximumEquipment=state=>Math.max(1,...Object.values(state?.equipment?.levels||{}).map(count));
function activeRun(state){
  const snapshot=state?.replicaInterruptedSortie?.snapshot,chapter=replicaChapter(snapshot?.chapterId);
  return snapshot?.engine==='danke-replica-v1'&&chapter&&snapshot.stageIndex===chapter.stageIndex
    &&typeof snapshot.id==='string'&&snapshot.id?snapshot.id:'';
}
function boxReceipt(state){
  const receipt=state?.replicaEquipmentBoxReceipt;
  return receipt?.version===1&&[3,4].includes(receipt.boxId)&&safe(receipt.count)&&receipt.count>0
    &&safe(receipt.inventoryRevision)&&safe(receipt.gearRevision)?receipt:null;
}
const boxKey=receipt=>receipt?`${receipt.boxId}:${receipt.inventoryRevision}:${receipt.gearRevision}`:'';
export function validateNativeAchievementProgress(raw){
  if(raw===undefined)return {version:1,loginDays:0,mainlineAttempts:0,diamondsSpent:0,equipmentBoxes:0,maxEquipmentLevel:1,
    lastLoginDay:'',lastStartedRunId:'',lastBoxReceiptKey:'',historicalCountsIncomplete:false};
  if(!raw||raw.version!==1||!['loginDays','mainlineAttempts','diamondsSpent','equipmentBoxes','maxEquipmentLevel'].every(key=>safe(raw[key]))
    ||raw.maxEquipmentLevel<1||!(raw.lastLoginDay===''||date(raw.lastLoginDay))
    ||typeof raw.lastStartedRunId!=='string'||typeof raw.lastBoxReceiptKey!=='string'
    ||typeof raw.historicalCountsIncomplete!=='boolean')throw Error('成就累计记录无效，旧存档未覆盖');
  return structuredClone(raw);
}
// Evidence is captured only after successful whole-save writes. It never holds
// references to the mutable working state, so failed saves cannot advance it.
export function captureNativeAchievementEvidence(state){
  const receipt=boxReceipt(state),ready=Boolean(state?.replicaLoadout&&state?.replicaInventory);
  const evidence={ready,diamonds:count(state?.replicaInventory?.items?.[2]),
    progress:structuredClone(state?.replicaAchievementProgress),activeRunId:activeRun(state),
    boxReceiptKey:boxKey(receipt),boxCount:receipt?.count||0,maxEquipmentLevel:maximumEquipment(state)};
  if(!ready||evidence.progress!==undefined)return evidence;
  const results=new Set((state.replicaResults||[]).filter(row=>row.engine==='danke-replica-v1'&&!row.trial&&!row.debugRun
    &&replicaChapter(row.chapterId)&&typeof row.runId==='string'&&row.runId).map(row=>row.runId));
  if(evidence.activeRunId)results.add(evidence.activeRunId);
  const supply=state.pilotSupply||{},flight=state.flightRewards||{};
  const historicalBoxes=add(count(state.equipment?.nativeBoxProgress?.basicDraws),receipt?.boxId===3?receipt.count:0);
  // Only retained receipts with known currency semantics are recoverable. Do
  // not infer lifetime spending from present wallet balance or account level.
  let spent=(supply.history||[]).reduce((sum,row)=>add(sum,count(row.cost)),0);
  if(receipt?.debit?.id===2)spent=add(spent,count(receipt.debit.amount));
  const days=[state.daily?.date,flight.signDay,...(supply.week?.loginDays||[]),...(supply.week?.activeDays||[])].filter(date);
  evidence.seed={loginDates:[...new Set(days)],signCount:count(flight.signCount),signDay:date(flight.signDay)?flight.signDay:'',
    mainlineAttempts:Math.max(results.size,(state.replicaCampaign?.clearedChapterIds||[]).filter(id=>replicaChapter(id)).length,
      count(state.daily?.counters?.sorties),count(state.weekly?.counters?.sorties),count(supply.daily?.battles),count(supply.week?.battles)),
    diamondsSpent:spent,equipmentBoxes:Math.max(historicalBoxes,count(supply.daily?.boxesOpened),count(supply.week?.boxesOpened))};
  return evidence;
}
function initialProgress(evidence,today){
  const seed=evidence.seed||{},dates=(seed.loginDates||[]).filter(day=>day<=today);
  let loginDays=Math.max(1,count(seed.signCount),new Set([...dates,today]).size);
  if(seed.signDay&&seed.signDay<today)loginDays=Math.max(loginDays,add(count(seed.signCount),1));
  return {version:1,loginDays,mainlineAttempts:count(seed.mainlineAttempts),diamondsSpent:count(seed.diamondsSpent),
    equipmentBoxes:count(seed.equipmentBoxes),maxEquipmentLevel:evidence.maxEquipmentLevel,lastLoginDay:today,
    lastStartedRunId:evidence.activeRunId,lastBoxReceiptKey:evidence.boxReceiptKey,
    historicalCountsIncomplete:Boolean(seed.mainlineAttempts||seed.signCount||seed.diamondsSpent||seed.equipmentBoxes)};
}
export function planNativeAchievementProgress(previous,next,time){
  if(!next.replicaLoadout||!next.replicaInventory)return null;
  const today=flightDay(time),current=captureNativeAchievementEvidence(next);
  const baseline=previous?.ready?previous:current;
  const progress=baseline.progress===undefined?initialProgress(baseline,today):validateNativeAchievementProgress(baseline.progress);
  if(today>progress.lastLoginDay){progress.loginDays=add(progress.loginDays,1);progress.lastLoginDay=today;}
  const signCount=count(next.flightRewards?.signCount),signDay=next.flightRewards?.signDay;
  progress.loginDays=Math.max(progress.loginDays,add(signCount,date(signDay)&&signDay<today?1:0));
  if(previous?.ready)progress.diamondsSpent=add(progress.diamondsSpent,Math.max(0,previous.diamonds-current.diamonds));
  if(current.activeRunId&&current.activeRunId!==progress.lastStartedRunId){
    progress.mainlineAttempts=add(progress.mainlineAttempts,1);progress.lastStartedRunId=current.activeRunId;
  }
  if(current.boxReceiptKey&&current.boxReceiptKey!==progress.lastBoxReceiptKey){
    progress.equipmentBoxes=add(progress.equipmentBoxes,current.boxCount);progress.lastBoxReceiptKey=current.boxReceiptKey;
  }
  progress.maxEquipmentLevel=Math.max(progress.maxEquipmentLevel,current.maxEquipmentLevel);
  return validateNativeAchievementProgress(progress);
}
