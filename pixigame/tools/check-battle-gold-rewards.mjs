import assert from 'node:assert/strict';
import {BATTLE_GOLD_CURVE_POLICY,BATTLE_GOLD_CURVE_POLICIES,SAMPLED_BATTLE_GOLD_CURVE_POLICIES,prepareBattleGoldSettlement} from '../src/replica/battle-gold-rewards.js';

// Synthetic storage only. Never reads or writes the player's browser save.
globalThis.document={baseURI:'http://localhost/',querySelector:()=>null};
globalThis.localStorage={getItem:()=>null,setItem:()=>{throw Error('Unexpected global save');}};
const {createPeripheralSystem}=await import('../src/peripheral/system.js');
const {createInitialGachaState}=await import('../src/gacha-engine.js');
const {PERIPHERAL_STORAGE_KEY}=await import('../src/peripheral/config.js');
const {REPLICA_WALLET_SOURCE}=await import('../src/replica/native-resource-wallet.js');
const {replicaChapter}=await import('../src/replica/chapter-contract.js');
const engine='danke-replica-v1';
const base={runId:'curve-unit',engine,chapterId:7,stageIndex:6,wave:1,gold:0,won:false,endReason:'quit'};
const expected=new Map([[1,430],[5,1257],[10,1775],[12,1948],[15,2184]]);
for(const [wave,amount]of expected){
  const raw={...base,wave,gold:100.9},plan=prepareBattleGoldSettlement(raw);
  assert.equal(plan.collectedGold,100);assert.equal(plan.gold,100+amount);
  assert.deepEqual(plan.progressGoldReward,{policyId:BATTLE_GOLD_CURVE_POLICY.id,displayedWave:wave,amount});
  assert.equal(raw.gold,100.9,'planner must not mutate the battle payload');
}
let last=0;
for(let wave=1;wave<=15;wave++){
  const amount=prepareBattleGoldSettlement({...base,wave}).gold;
  assert(amount>last);last=amount;
}
for(const extra of [
  {chapterId:0,stageIndex:-1},{chapterId:61,stageIndex:60},
  {engine:'legacy'},{stageIndex:0},{runId:''},{wave:0},{wave:16},{wave:1.5},
  {won:true,wave:5,endReason:'victory'},{won:false,endReason:'unknown'},
  {won:true,wave:15,endReason:'defeat'},{trial:true},{debugRun:true},{abandoned:true},
]){
  const plan=prepareBattleGoldSettlement({...base,gold:101,...extra});
  assert.equal(plan.gold,101,JSON.stringify(extra));assert.equal(plan.progressGoldReward,null);
}
for(const gold of [-1,Infinity,NaN,Number.MAX_SAFE_INTEGER])assert.throws(()=>prepareBattleGoldSettlement({...base,gold}));

// Paired screenshot fits, with deterministic amounts independent of kills/time.
assert.deepEqual(SAMPLED_BATTLE_GOLD_CURVE_POLICIES.map(row=>row.chapterId),[1,5,7]);
for(const [chapterId,points]of [[1,[[1,400],[5,1298],[15,1959]]],[5,[[1,380],[10,1875]]]]){
  const chapter=replicaChapter(chapterId);
  let previous=0;
  for(let wave=1;wave<=chapter.waveCount;wave++){
    const raw={...base,chapterId,stageIndex:chapterId-1,wave};
    const amount=prepareBattleGoldSettlement(raw).gold;
    assert(amount>previous);previous=amount;
    assert.equal(prepareBattleGoldSettlement({...raw,kills:99999,clock:99999}).gold,amount);
  }
  for(const [wave,bonus]of points){
    const raw={...base,chapterId,stageIndex:chapterId-1,wave,gold:256.9};
    assert.equal(prepareBattleGoldSettlement(raw).gold,256+bonus);
    assert.equal(prepareBattleGoldSettlement({...raw,won:true,endReason:'victory'}).progressGoldReward!==null,wave===chapter.waveCount);
  }
  for(const extra of [{trial:true},{debugRun:true},{abandoned:true},{wave:chapter.waveCount+1},{stageIndex:99}])
    assert.equal(prepareBattleGoldSettlement({...base,chapterId,stageIndex:chapterId-1,gold:10,...extra}).gold,10);
}

// Coverage comes from the actual chapter contract, including every 10-wave map.
const {default:chapterContract}=await import('../src/replica/chapter-correspondence.json',{with:{type:'json'}});
assert.equal(BATTLE_GOLD_CURVE_POLICIES.length,60);
assert.deepEqual(BATTLE_GOLD_CURVE_POLICIES.map(row=>row.chapterId),chapterContract.chapters.map(row=>row.id));
for(const chapter of chapterContract.chapters){
  const policy=BATTLE_GOLD_CURVE_POLICIES.find(row=>row.chapterId===chapter.id);
  assert.equal(policy.waveCount,chapter.waveCount);assert.equal(policy.stageIndex,chapter.stageIndex);
  const references=SAMPLED_BATTLE_GOLD_CURVE_POLICIES.filter(row=>policy.referenceChapterIds.includes(row.chapterId));
  assert(references.length>0&&references.every(row=>row.waveCount===chapter.waveCount));
  let previous=0;
  for(let wave=1;wave<=chapter.waveCount;wave++){
    const raw={...base,chapterId:chapter.id,stageIndex:chapter.stageIndex,wave,gold:101};
    const plan=prepareBattleGoldSettlement(raw),bonus=plan.progressGoldReward.amount;
    assert(bonus>previous,`chapter ${chapter.id} wave ${wave}`);previous=bonus;
    assert.equal(plan.gold,101+bonus);
    assert.equal(prepareBattleGoldSettlement({...raw,kills:100000,clock:100000}).gold,plan.gold);
    assert.equal(prepareBattleGoldSettlement({...raw,endReason:'defeat'}).gold,plan.gold);
    assert.equal(prepareBattleGoldSettlement({...raw,won:true,endReason:'victory'}).progressGoldReward!==null,wave===chapter.waveCount);
    const referenceAmounts=references.map(row=>Math.round(row.baseGold+row.waveGold*(wave-1)**row.power));
    assert(bonus>=Math.min(...referenceAmounts)-2&&bonus<=Math.max(...referenceAmounts)+2);
  }
  for(const extra of [{trial:true},{debugRun:true},{abandoned:true},{wave:0},{wave:chapter.waveCount+1},{stageIndex:999}])
    assert.equal(prepareBattleGoldSettlement({...base,chapterId:chapter.id,stageIndex:chapter.stageIndex,gold:101,...extra}).gold,101);
}

function fixture(clearedThrough=6){
  const saved=new Map(),flags={failReceipt:false,failFinal:false},profile={coins:5000,diamonds:500};
  const storage={getItem:key=>saved.get(key)??null,setItem(key,value){
    const state=key===PERIPHERAL_STORAGE_KEY?JSON.parse(value):null;
    if(flags.failReceipt&&state?.replicaPendingSettlement)throw Error('Receipt write failed');
    if(flags.failFinal&&!state?.replicaPendingSettlement&&state?.processedRuns?.length)throw Error('Final write failed');
    saved.set(key,value);
  }};
  const pilot={selected:'pilot-01',persistentSelected:'pilot-01',temporaryUnlocked:[],owned:['pilot-01'],resonance:{}};
  let collection=createInitialGachaState();
  const options={storage,profile,now:()=>Date.UTC(2026,10,6,6),getCampaign:()=>({highestCleared:-1}),
    stages:Array.from({length:60},(_,i)=>({id:'stage-'+i,name:'第'+(i+1)+'章'})),
    pilotApi:{get:()=>structuredClone(pilot),grant(id){if(!pilot.owned.includes(id))pilot.owned.push(id);return[{storagePersisted:true}];},select(id){pilot.selected=pilot.persistentSelected=id;return true;}},
    collectionApi:{get:()=>structuredClone(collection),transact(update){const next=structuredClone(collection),result=update(next);if(result.ok)collection=next;return result;}}};
  let system=createPeripheralSystem(options);
  const f={flags,profile,get system(){return system;},reload(){system=createPeripheralSystem(options);},
    edit(update){const state=system.state;update(state);storage.setItem(PERIPHERAL_STORAGE_KEY,JSON.stringify(state));this.reload();}};
  f.edit(state=>{state.replicaCampaign={clearedChapterIds:Array.from({length:clearedThrough},(_,index)=>index+1)};
    state.replicaLoadout.playerLevel=9;
    Object.assign(state.replicaAccountExperience,{experience:0,totalExperience:0,rewardedThroughLevel:9});});
  return f;
}
function start(f,{chapterId=7,trial=false}={}){
  const run=f.system.prepareSortie({engine,chapterId,trial,replicaConfiguration:f.system.replicaConfiguration()});
  assert.equal(run.ok,true,run.message);return run;
}
function result(run,extra={}){
  const chapter=replicaChapter(run.snapshot.chapterId);
  return {...base,runId:run.snapshot.id,chapterId:chapter.id,stageIndex:chapter.stageIndex,
    hp:0,maxHp:960,kills:0,clock:0,...extra};
}
for(const extra of [
  {wave:1,gold:0,endReason:'quit'},
  {wave:1,gold:37,kills:35,endReason:'quit'},
  {wave:5,gold:174,kills:122,endReason:'defeat'},
  {wave:12,gold:539,kills:518,endReason:'defeat'},
  {wave:15,gold:865,kills:973,won:true,hp:960,endReason:'victory'},
]){
  const f=fixture(),run=start(f),raw=result(run,extra),before=f.system.state;
  // Posted reward fields cannot set the authoritative amount.
  const receipt=f.system.recordSortie({...raw,collectedGold:999999,progressGoldReward:{amount:999999},battleGoldBonus:999999});
  assert.equal(receipt.ok,true,receipt.message);
  const bonus=expected.get(raw.wave),total=raw.gold+bonus;
  assert.equal(receipt.replica.collectedGold,raw.gold);
  assert.equal(receipt.replica.gold,total);assert.equal(receipt.replica.progressGoldReward.amount,bonus);
  assert.equal(receipt.replica.battleGoldBonus,undefined);
  assert.equal(f.system.state.replicaInventory.items[1]-(before.replicaInventory.items[1]||0),total);
  assert.equal(receipt.rewards.filter(row=>row.type==='coins').reduce((sum,row)=>sum+row.amount,0),total);
  assert.equal(receipt.replica.accountExperience.experience,10);
  assert.equal(f.profile.coins,5000,'native rewards must not also pay the legacy wallet');
  assert.deepEqual(f.system.state.equipment,before.equipment);
  const paid=f.system.state;
  assert.equal(f.system.recordSortie(raw).ok,false);f.reload();f.system.snapshot();
  assert.deepEqual(f.system.state.replicaInventory,paid.replicaInventory);
}
// Chapter 1/5 grants travel through the real persisted settlement transaction.
for(const [chapterId,wave,pickups,bonus,won]of [
  [1,1,0,400,false],[1,5,256,1298,false],[1,15,978,1959,true],
  [5,1,0,380,false],[5,10,989,1875,true],
]){
  const f=fixture(),run=start(f,{chapterId}),before=f.system.state;
  const raw=result(run,{wave,gold:pickups,won,endReason:won?'victory':'quit'});
  const receipt=f.system.recordSortie({...raw,progressGoldReward:{amount:999999}});
  assert.equal(receipt.ok,true,receipt.message);
  assert.equal(receipt.replica.collectedGold,pickups);
  assert.equal(receipt.replica.gold,pickups+bonus);
  assert.equal(receipt.replica.progressGoldReward.amount,bonus);
  assert.equal(receipt.replica.accountExperience.experience,10);
  assert.equal(f.system.state.replicaInventory.items[1]-(before.replicaInventory.items[1]||0),pickups+bonus);
  const paid=f.system.state;assert.equal(f.system.recordSortie(raw).ok,false);f.reload();f.system.snapshot();
  assert.deepEqual(f.system.state.replicaInventory,paid.replicaInventory);
}
for(const [chapterId,bonus]of [[1,400],[5,380]])for(const phase of ['failReceipt','failFinal']){
  const f=fixture(),run=start(f,{chapterId}),before=f.system.state,raw=result(run);
  f.flags[phase]=true;assert.equal(f.system.recordSortie(raw).ok,false);
  assert.deepEqual(f.system.state.replicaInventory,before.replicaInventory);
  f.flags[phase]=false;
  if(phase==='failReceipt')assert.equal(f.system.recordSortie(raw).ok,true);
  else {f.reload();f.system.snapshot();}
  assert.equal(f.system.state.replicaInventory.items[1]-(before.replicaInventory.items[1]||0),bonus);
  const paid=f.system.state;f.reload();f.system.snapshot();assert.deepEqual(f.system.state.replicaInventory,paid.replicaInventory);
}

for(const mode of ['trial','debug','abandoned']){
  const f=fixture(),run=start(f,{chapterId:7,trial:mode==='trial'}),before=f.system.state;
  const receipt=f.system.recordSortie(result(run,{gold:101,trial:false,progressGoldReward:{amount:999999},
    ...(mode==='debug'?{debugRun:true}:mode==='abandoned'?{abandoned:true}:{})}));
  assert.equal(receipt.ok,true,receipt.message);assert.equal(receipt.replica.progressGoldReward,undefined);
  const delta=(f.system.state.replicaInventory.items[1]||0)-(before.replicaInventory.items[1]||0);
  assert.equal(delta,0,mode);
}// Real transactions for every normal chapter: zero-kill exit, defeat and clear.
for(const chapter of chapterContract.chapters)for(const outcome of ['quit','defeat','victory']){
  const f=fixture(chapter.id-1),run=start(f,{chapterId:chapter.id}),before=f.system.state;
  const wave=outcome==='victory'?chapter.waveCount:outcome==='defeat'?Math.ceil(chapter.waveCount/2):1;
  const raw=result(run,{wave,gold:outcome==='quit'?0:101,won:outcome==='victory',endReason:outcome});
  const expected=prepareBattleGoldSettlement(raw),receipt=f.system.recordSortie({...raw,progressGoldReward:{amount:999999}});
  assert.equal(receipt.ok,true,receipt.message);
  assert.deepEqual(receipt.replica.progressGoldReward,expected.progressGoldReward);
  assert.equal(receipt.replica.gold,expected.gold);
  assert.equal(f.system.state.replicaInventory.items[1]-(before.replicaInventory.items[1]||0),expected.gold);
  assert.equal(receipt.replica.accountExperience.experience,10);
  const paid=f.system.state;f.reload();f.system.snapshot();assert.deepEqual(f.system.state.replicaInventory,paid.replicaInventory);
  assert.equal(f.system.recordSortie(raw).ok,false);
}
for(const chapterId of [2,15,60])for(const phase of ['failReceipt','failFinal']){
  const f=fixture(chapterId-1),run=start(f,{chapterId}),raw=result(run),before=f.system.state;
  const expected=prepareBattleGoldSettlement(raw).gold;
  f.flags[phase]=true;assert.equal(f.system.recordSortie(raw).ok,false);
  assert.deepEqual(f.system.state.replicaInventory,before.replicaInventory);
  f.flags[phase]=false;
  if(phase==='failReceipt')assert.equal(f.system.recordSortie(raw).ok,true);
  else {f.reload();f.system.snapshot();}
  assert.equal(f.system.state.replicaInventory.items[1]-(before.replicaInventory.items[1]||0),expected);
  const paid=f.system.state;f.reload();f.system.snapshot();assert.deepEqual(f.system.state.replicaInventory,paid.replicaInventory);
}
// Unpaid receipts created before the fallback retain the literal stored gold.
for(const chapterId of [2,15,60]){
  const f=fixture(chapterId-1),before=f.system.state;
  f.edit(state=>{state.replicaPendingSettlement={walletSource:REPLICA_WALLET_SOURCE,
    result:{...base,runId:'old-unmeasured-'+chapterId,chapterId,stageIndex:chapterId-1,gold:174,collectedGold:174}};});
  f.system.snapshot();
  assert.equal(f.system.state.replicaInventory.items[1]-(before.replicaInventory.items[1]||0),174);
  const saved=f.system.state;f.reload();f.system.snapshot();assert.deepEqual(f.system.state.replicaInventory,saved.replicaInventory);
}


for(const phase of ['failReceipt','failFinal']){
  const f=fixture(),run=start(f),raw=result(run,{wave:5,gold:174,endReason:'defeat'}),before=f.system.state;
  f.flags[phase]=true;assert.equal(f.system.recordSortie(raw).ok,false);
  assert.deepEqual(f.system.state.replicaInventory,before.replicaInventory);
  f.flags[phase]=false;
  if(phase==='failReceipt'){
    assert.equal(f.system.recordSortie(raw).ok,true);
  }else{
    assert.equal(f.system.state.replicaPendingSettlement.result.progressGoldReward.amount,1257);
    f.system.snapshot();
    const recovered=f.system.state;
    const acknowledgement=f.system.recordSortie({...raw,gold:999999,wave:15,won:true});
    assert.equal(acknowledgement.ok,true);assert.equal(acknowledgement.replica.gold,1431);
    assert.deepEqual(f.system.state.replicaInventory,recovered.replicaInventory);
  }
  assert.equal(f.system.state.replicaInventory.items[1]-(before.replicaInventory.items[1]||0),1431);
  const paid=f.system.state;f.reload();f.system.snapshot();assert.deepEqual(f.system.state.replicaInventory,paid.replicaInventory);
}
const reloadFailure=fixture(),reloadRun=start(reloadFailure),reloadBefore=reloadFailure.system.state;
reloadFailure.flags.failFinal=true;
assert.equal(reloadFailure.system.recordSortie(result(reloadRun,{wave:12,gold:539,endReason:'defeat'})).ok,false);
reloadFailure.flags.failFinal=false;reloadFailure.reload();reloadFailure.system.snapshot();
assert.equal(reloadFailure.system.state.replicaInventory.items[1]-(reloadBefore.replicaInventory.items[1]||0),2487);
const reloadPaid=reloadFailure.system.state;reloadFailure.reload();reloadFailure.system.snapshot();assert.deepEqual(reloadFailure.system.state.replicaInventory,reloadPaid.replicaInventory);

const legacy=fixture(),legacyBefore=legacy.system.state;
legacy.edit(state=>{state.replicaPendingSettlement={walletSource:REPLICA_WALLET_SOURCE,
  result:{...base,runId:'old-pending',wave:5,gold:174,collectedGold:174,endReason:'defeat'}};});
legacy.system.snapshot();
assert.equal(legacy.system.state.replicaInventory.items[1]-(legacyBefore.replicaInventory.items[1]||0),174,'old receipts keep their exact existing payout');
const legacyPaid=legacy.system.state;legacy.reload();legacy.system.snapshot();assert.deepEqual(legacy.system.state.replicaInventory,legacyPaid.replicaInventory);

const overflow=fixture(),overflowRun=start(overflow),overflowBefore=overflow.system.state;
assert.equal(overflow.system.recordSortie(result(overflowRun,{gold:Number.MAX_SAFE_INTEGER})).ok,false);
assert.equal(overflow.system.state.replicaPendingSettlement,undefined);
assert.deepEqual(overflow.system.state.replicaInventory,overflowBefore.replicaInventory);
assert.equal(overflow.system.recordSortie(result(overflowRun)).ok,true,'invalid input must not poison the pending receipt');
console.log('Battle gold checks passed: all 60 chapters, all wave boundaries, 180 real outcome transactions, pickup totals, zero-kill exits, exclusions, exact receipts, atomic save/reload, deduplication and overflow.');
