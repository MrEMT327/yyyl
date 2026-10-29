import source from './native-failure-protection-source.json' with {type:'json'};
// User-approved 2026-10-26 offline substitute for server DefeatCount lifecycle.
// Normal defeat +1, victory resets, quit/abandon/trial ignored. Not an assertion
// about the live original server. Never reconstruct old counts from 50-row history.
export const LOCAL_FAILURE_PROTECTION_VERSION=1;
function ledger(raw){
 if(raw===undefined)return {version:1,counts:{}};
 if(raw?.version!==1||!raw.counts||Array.isArray(raw.counts)||typeof raw.counts!=='object')throw Error('失败保护记录无效，旧记录未覆盖');
 for(const[id,count]of Object.entries(raw.counts))if(!source.chapters[id]||!Number.isSafeInteger(count)||count<0)throw Error('失败保护次数无效，旧记录未覆盖');
 return structuredClone(raw);
}
export function localFailureCount(raw,chapterId){if(!source.chapters[chapterId])throw Error('失败保护关卡未核实');return ledger(raw).counts[chapterId]||0;}
export function recordLocalFailureProtection(raw,result){
 const next=ledger(raw);
 if(result.failureProtectionPolicyVersion!==LOCAL_FAILURE_PROTECTION_VERSION||result.trial||result.abandoned||result.endReason==='quit')return next;
 if(!source.chapters[result.chapterId])throw Error('失败保护结算关卡无效');
 if(result.won)next.counts[result.chapterId]=0;
 else if(result.endReason==='defeat'){
  const count=(next.counts[result.chapterId]||0)+1;
  if(!Number.isSafeInteger(count))throw Error('失败保护次数超限');next.counts[result.chapterId]=count;
 }
 return next;
}
