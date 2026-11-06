import assert from 'node:assert/strict';
import {BATTLE_GOLD_CURVE_POLICY,prepareBattleGoldSettlement} from '../src/replica/battle-gold-rewards.js';

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
  {chapterId:1,stageIndex:0},{chapterId:5,stageIndex:4},{chapterId:8,stageIndex:7},
  {engine:'legacy'},{stageIndex:0},{runId:''},{wave:0},{wave:16},{wave:1.5},
  {won:true,wave:5,endReason:'victory'},{won:false,endReason:'unknown'},
  {won:true,wave:15,endReason:'defeat'},{trial:true},{debugRun:true},{abandoned:true},
]){
  const plan=prepareBattleGoldSettlement({...base,gold:101,...extra});
  assert.equal(plan.gold,101,JSON.stringify(extra));assert.equal(plan.progressGoldReward,null);
}
for(const gold of [-1,Infinity,NaN,Number.MAX_SAFE_INTEGER])assert.throws(()=>prepareBattleGoldSettlement({...base,gold}));

function fixture(){
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
  f.edit(state=>{state.replicaCampaign={clearedChapterIds:[1,2,3,4,5,6]};
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
for(const mode of ['otherChapter','trial','debug','abandoned']){
  const f=fixture(),run=start(f,{chapterId:mode==='otherChapter'?1:7,trial:mode==='trial'}),before=f.system.state;
  const receipt=f.system.recordSortie(result(run,{gold:101,trial:false,progressGoldReward:{amount:999999},
    ...(mode==='debug'?{debugRun:true}:mode==='abandoned'?{abandoned:true}:{})}));
  assert.equal(receipt.ok,true,receipt.message);assert.equal(receipt.replica.progressGoldReward,undefined);
  const delta=(f.system.state.replicaInventory.items[1]||0)-(before.replicaInventory.items[1]||0);
  assert.equal(delta,mode==='otherChapter'?101:0,mode);
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
console.log('Battle gold checks passed: chapter-7 curve, pickup totals, zero-kill exits, exclusions, exact receipts, atomic save/reload, deduplication and overflow.');
