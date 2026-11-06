import { nativeItemPresentation } from './native-item-presentation.js';
import { replicaChapter } from './chapter-contract.js';

// User-approved local approximation, not extracted server probabilities.
// Counts and failure/exit eligibility follow supplied screenshots; probabilities
// and the research opening chapter are explicit, replaceable local choices.
export const BATTLE_MATERIAL_POLICY=Object.freeze({
  version:7,id:'project-repeat-materials-v1',label:'章节材料近似结算',
  equipmentCountsAtEntry:Object.freeze([0.35,0.30,0.35,0,0]),
  equipmentCountsAtClear:Object.freeze([0.05,0.15,0.25,0.30,0.25]),
  researchFirstChapter:5,researchChanceAtEntry:0.25,researchChanceAtClear:0.60,
  basicVoucherFirstChapter:1,basicVoucherChanceAtEntry:0.05,basicVoucherChanceAtClear:0.10,
  advancedVoucherFirstChapter:5,advancedVoucherChanceAtEntry:0.02,advancedVoucherChanceAtClear:0.05,
});
const equipmentIds=Object.freeze([105,106,107,108,109]);
const researchIds=Object.freeze([801,802,803,804,805,806,807,808,809,810,811]);
function validBattle(result){
  const chapter=replicaChapter(result?.chapterId);
  const outcome=result?.won===true?result.wave===chapter?.waveCount&&!['quit','defeat'].includes(result.endReason)
    :result?.won===false&&['quit','defeat'].includes(result.endReason);
  return chapter&&result.engine==='danke-replica-v1'&&result.stageIndex===chapter.stageIndex
    &&typeof result.runId==='string'&&result.runId.length>0
    &&Number.isInteger(result.wave)&&result.wave>=1&&result.wave<=chapter.waveCount
    &&outcome&&!result.trial&&!result.debugRun&&!result.abandoned?chapter:null;
}
function runRandom(runId,chapterId){
  let state=2166136261;
  for(const character of `${BATTLE_MATERIAL_POLICY.id}:${chapterId}:${runId}`)
    state=Math.imul(state^character.charCodeAt(0),16777619)>>>0;
  // Independent of combat RNG. Retrying even the first failed receipt write
  // with the same sortie/outcome produces the same material draw.
  return ()=>{
    state=(state+0x6d2b79f5)>>>0;
    let value=state;value=Math.imul(value^(value>>>15),value|1);
    value^=value+Math.imul(value^(value>>>7),value|61);
    return ((value^(value>>>14))>>>0)/4294967296;
  };
}
const interpolate=(from,to,progress)=>from+(to-from)*progress;
export function prepareBattleMaterialRewards(result,random){
  const chapter=validBattle(result);
  if(result?.materialPolicyVersion!==7||!chapter)return [];
  const rng=random??runRandom(result.runId,chapter.id),policy=BATTLE_MATERIAL_POLICY;
  const draw=()=>{const value=rng();if(!Number.isFinite(value)||value<0||value>=1)throw Error('战斗材料抽取失败');return value;};
  const progress=(result.won?result.wave:result.wave-1)/chapter.waveCount;
  const totals=new Map(),add=id=>totals.set(id,(totals.get(id)||0)+1);
  let roll=draw(),count=4;
  for(let index=0;index<5;index++){
    roll-=interpolate(policy.equipmentCountsAtEntry[index],policy.equipmentCountsAtClear[index],progress);
    if(roll<0){count=index;break;}
  }
  for(let index=0;index<count;index++)add(equipmentIds[Math.floor(draw()*equipmentIds.length)]);
  if(chapter.id>=policy.researchFirstChapter
    &&draw()<interpolate(policy.researchChanceAtEntry,policy.researchChanceAtClear,progress))
    add(researchIds[Math.floor(draw()*researchIds.length)]);
  const advanced=chapter.id>=policy.advancedVoucherFirstChapter
    ?interpolate(policy.advancedVoucherChanceAtEntry,policy.advancedVoucherChanceAtClear,progress):0;
  const basic=chapter.id>=policy.basicVoucherFirstChapter
    ?interpolate(policy.basicVoucherChanceAtEntry,policy.basicVoucherChanceAtClear,progress):0;
  const voucher=draw();
  if(voucher<advanced)add(112);else if(voucher<advanced+basic)add(113);
  return [...totals].sort(([left],[right])=>left-right);
}
function ledger(raw){
  const result=structuredClone(raw??{version:1,victories:0,researchSheets:0});
  if(result.version!==1||![result.victories,result.researchSheets].every(n=>Number.isSafeInteger(n)&&n>=0))
    throw Error('战斗材料历史记录无效，旧记录已保留');
  return result;
}
export function battleMaterialSnapshot(raw){
  ledger(raw);
  return {nativeSettlementPending:false,compatibility:false,sampleBased:true,
    policyId:BATTLE_MATERIAL_POLICY.id,policyVersion:BATTLE_MATERIAL_POLICY.version};
}
function validatePairs(pairs,legacy,result){
  if(!Array.isArray(pairs))throw Error('战斗材料凭据无效');
  const totals=new Map();
  for(const pair of pairs){
    if(!Array.isArray(pair)||pair.length!==2)throw Error('战斗材料凭据无效');
    const [id,count]=pair;
    if(![...equipmentIds,...researchIds,113,...(legacy?[]:[112])].includes(id)
      ||!Number.isSafeInteger(count)||count<=0)throw Error('战斗材料凭据无效');
    const sum=(totals.get(id)||0)+count;
    if(!Number.isSafeInteger(sum))throw Error('战斗材料数量超限');
    totals.set(id,sum);
  }
  if(!legacy){
    const count=ids=>ids.reduce((sum,id)=>sum+(totals.get(id)||0),0);
    if(count(equipmentIds)>4||count(researchIds)>1||count([112,113])>1
      ||result.chapterId<BATTLE_MATERIAL_POLICY.researchFirstChapter&&count(researchIds)>0
      ||result.chapterId<BATTLE_MATERIAL_POLICY.advancedVoucherFirstChapter&&totals.has(112))
      throw Error('战斗材料凭据超出当前规则');
  }
  return totals;
}
export function grantBattleMaterials(inventory,rewards,raw,result){
  // Old v4/v5/v6 receipts retain their existing meaning. Only new v7 sorties
  // generate the approximation; recovery pays concrete pairs without rerolling.
  const next=ledger(raw),legacy=[4,5].includes(result.materialPolicyVersion);
  if(!legacy&&result.materialPolicyVersion!==7||result.trial||result.abandoned
    ||legacy&&result.endReason==='quit'||!legacy&&!validBattle(result))return next;
  const pairs=structuredClone(result.localMaterialRewards||[]);
  if(legacy){
    next.compatibilityVictories??=0;
    if(!Number.isSafeInteger(next.compatibilityVictories)||next.compatibilityVictories<0)throw Error('材料兼容胜利记录无效');
    if(result.won){
      next.compatibilityVictories++;
      if(!Number.isSafeInteger(next.compatibilityVictories))throw Error('材料胜利计数超限');
      if(next.compatibilityVictories%3===0)pairs.push([113,1]);
    }
  }
  const totals=validatePairs(pairs,legacy,result);
  const planned=[...totals].map(([id,amount])=>{
    const total=(inventory.items[id]||0)+amount;
    if(!Number.isSafeInteger(total))throw Error('战斗材料数量超限');
    return {id,total,reward:{type:'native-item',id,amount,...nativeItemPresentation(id),
      ...(legacy?{compatibility:true}:{sampleBased:true})}};
  });
  for(const item of planned){inventory.items[item.id]=item.total;rewards.push(item.reward);}
  return next;
}
