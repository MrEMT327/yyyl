import assert from 'node:assert/strict';
import {BATTLE_MATERIAL_POLICY,prepareBattleMaterialRewards,grantBattleMaterials,battleMaterialSnapshot} from '../src/replica/battle-material-rewards.js';
import {replicaChapter} from '../src/replica/chapter-contract.js';

// Synthetic storage only; no player save or combat RNG is accessed.
globalThis.document={baseURI:'http://localhost/',querySelector:()=>null};
globalThis.localStorage={getItem:()=>null,setItem:()=>{throw Error('Unexpected global save');}};
const {createPeripheralSystem}=await import('../src/peripheral/system.js');
const {createInitialGachaState}=await import('../src/gacha-engine.js');
const {PERIPHERAL_STORAGE_KEY}=await import('../src/peripheral/config.js');
const {REPLICA_WALLET_SOURCE}=await import('../src/replica/native-resource-wallet.js');
const {backpackItemSources}=await import('../src/ui/backpack-item-sources.js');
const engine='danke-replica-v1';
const base={runId:'material-unit',engine,chapterId:7,stageIndex:6,wave:1,won:false,endReason:'quit',gold:0,
  materialPolicyVersion:BATTLE_MATERIAL_POLICY.version};
const inv=items=>({version:1,revision:0,items:{...items}});
const count=(pairs,from,to=from)=>pairs.reduce((sum,[id,n])=>sum+(id>=from&&id<=to?n:0),0);
function sequence(values){let i=0;return()=>{assert(i<values.length,'unexpected extra random draw');return values[i++];};}
const full={...base,wave:15,won:true,endReason:'victory'};
const concrete=prepareBattleMaterialRewards(full,sequence([.99,0,.21,.41,.61,0,.99,0]));
assert.deepEqual(concrete,[[105,1],[106,1],[107,1],[108,1],[112,1],[811,1]]);
assert.deepEqual(prepareBattleMaterialRewards({...base,chapterId:1,stageIndex:0,wave:15,won:true,endReason:'victory'},sequence([0,0])),[[113,1]]);
assert.deepEqual(prepareBattleMaterialRewards({...base,chapterId:5,stageIndex:4},sequence([.6,.9,0,0,0])),[[109,1],[112,1],[801,1]]);
for(const extra of [
  {trial:true},{debugRun:true},{abandoned:true},{engine:'legacy'},{runId:''},{stageIndex:0},
  {chapterId:0},{wave:0},{wave:16},{wave:1.5},{won:false,endReason:'unknown'},
  {won:true,wave:1,endReason:'victory'},{materialPolicyVersion:6},{materialPolicyVersion:4},
])assert.deepEqual(prepareBattleMaterialRewards({...base,...extra},()=>{throw Error('ineligible run consumed RNG');}),[]);
assert.deepEqual(prepareBattleMaterialRewards(),[]);
for(const number of [-.1,1,Infinity,NaN])assert.throws(()=>prepareBattleMaterialRewards(base,()=>number));

// Deterministic statistical smoke check: validates implementation against the
// declared local rates, not against an unknown original-game distribution.
const frequency=[];
for(const chapterId of [1,5,7])for(const won of [false,true]){
  const chapter=replicaChapter(chapterId),sampleSize=20000,seen=new Set();
  let gear=0,research=0,basic=0,advanced=0,empty=0;
  for(let index=0;index<sampleSize;index++){
    const result={...base,chapterId,stageIndex:chapter.stageIndex,runId:`frequency-${chapterId}-${won}-${index}`,
      won,wave:won?chapter.waveCount:1,endReason:won?'victory':'quit'};
    const pairs=prepareBattleMaterialRewards(result);
    assert.deepEqual(prepareBattleMaterialRewards(result),pairs,'same run must not reroll');
    const g=count(pairs,105,109),r=count(pairs,801,811),b=count(pairs,113),a=count(pairs,112);
    assert(g>=0&&g<=4);assert(r>=0&&r<=1);assert(a+b<=1);
    if(chapterId<5){assert.equal(r,0);assert.equal(a,0);}
    gear+=g;research+=r;basic+=b;advanced+=a;if(!pairs.length)empty++;
    pairs.forEach(([id])=>seen.add(id));
  }
  const actual={chapterId,won,sampleSize,equipmentMean:gear/sampleSize,researchChance:research/sampleSize,
    basicVoucherChance:basic/sampleSize,advancedVoucherChance:advanced/sampleSize,emptyChance:empty/sampleSize};
  const expected={equipmentMean:won?2.55:1,researchChance:chapterId<5?0:won?.60:.25,
    basicVoucherChance:won?.10:.05,advancedVoucherChance:chapterId<5?0:won?.05:.02};
  assert(Math.abs(actual.equipmentMean-expected.equipmentMean)<.06);
  for(const key of ['researchChance','basicVoucherChance','advancedVoucherChance'])assert(Math.abs(actual[key]-expected[key])<.015,`${key}: ${JSON.stringify(actual)}`);
  for(const id of [105,106,107,108,109,113,...(chapterId>=5?[112,801,802,803,804,805,806,807,808,809,810,811]:[])])assert(seen.has(id),`unreachable item ${id}`);
  assert(empty>0,'no guaranteed material floor, even on a full clear');frequency.push(actual);
}
const input=inv(),rewards=[],receipt={...full,localMaterialRewards:JSON.parse(JSON.stringify(concrete))};
grantBattleMaterials(input,rewards,undefined,receipt);
assert.deepEqual(input.items,Object.fromEntries(concrete));
assert(rewards.every(row=>row.sampleBased&&row.nativeItemId===row.id&&row.name&&row.image));
for(const pairs of [[[1,1]],[[105,5]],[[801,2]],[[112,1],[113,1]],[[105,-1]],[[105,1,99]],'invalid']){
  const inventory=inv(),rows=[];
  assert.throws(()=>grantBattleMaterials(inventory,rows,undefined,{...full,localMaterialRewards:pairs}));
  assert.deepEqual(inventory.items,{});assert.deepEqual(rows,[]);
}
const overflow=inv({811:Number.MAX_SAFE_INTEGER}),overflowRows=[];
assert.throws(()=>grantBattleMaterials(overflow,overflowRows,undefined,receipt));
assert.deepEqual(overflow.items,{811:Number.MAX_SAFE_INTEGER});assert.deepEqual(overflowRows,[],'overflow must not partially grant the earlier pairs');
for(const id of [112,801])assert.throws(()=>grantBattleMaterials(inv(),[],undefined,{...base,chapterId:1,stageIndex:0,localMaterialRewards:[[id,1]]}));
for(const version of [4,5]){
  const inventory=inv(),rows=[];
  const old=grantBattleMaterials(inventory,rows,{version:1,victories:100,researchSheets:99,compatibilityVictories:2},
    {...full,materialPolicyVersion:version,localMaterialRewards:[[106,2],[801,1]]});
  assert.deepEqual(inventory.items,{106:2,801:1,113:1});assert.equal(old.compatibilityVictories,3);
}
const retired=inv();grantBattleMaterials(retired,[],undefined,{...full,materialPolicyVersion:6,localMaterialRewards:[[105,999]]});assert.deepEqual(retired.items,{});

function fixture(time=Date.UTC(2026,10,6,8)){
  const saved=new Map(),flags={failReceipt:false,failFinal:false},profile={coins:5000,diamonds:500};
  const storage={getItem:key=>saved.get(key)??null,setItem(key,value){
    const state=key===PERIPHERAL_STORAGE_KEY?JSON.parse(value):null;
    if(flags.failReceipt&&state?.replicaPendingSettlement)throw Error('Receipt save failed');
    if(flags.failFinal&&!state?.replicaPendingSettlement&&state?.processedRuns?.length)throw Error('Final save failed');
    saved.set(key,value);
  }};
  const pilot={selected:'pilot-01',persistentSelected:'pilot-01',temporaryUnlocked:[],owned:['pilot-01'],resonance:{}};
  let collection=createInitialGachaState();
  const options={storage,profile,now:()=>time,getCampaign:()=>({highestCleared:-1}),
    stages:Array.from({length:60},(_,i)=>({id:'stage-'+i,name:'第'+(i+1)+'章'})),
    pilotApi:{get:()=>structuredClone(pilot),grant(id){if(!pilot.owned.includes(id))pilot.owned.push(id);return[{storagePersisted:true}];},select(id){pilot.selected=pilot.persistentSelected=id;return true;}},
    collectionApi:{get:()=>structuredClone(collection),transact(update){const next=structuredClone(collection),result=update(next);if(result.ok)collection=next;return result;}}};
  let system=createPeripheralSystem(options);
  const f={flags,profile,get system(){return system;},reload(){system=createPeripheralSystem(options);},
    edit(update){const state=system.state;update(state);storage.setItem(PERIPHERAL_STORAGE_KEY,JSON.stringify(state));this.reload();}};
  f.edit(state=>{state.replicaCampaign={clearedChapterIds:[1,2,3,4,5,6]};state.replicaLoadout.playerLevel=9;
    Object.assign(state.replicaAccountExperience,{experience:0,totalExperience:0,rewardedThroughLevel:9});});
  return f;
}
function start(f,chapterId=7,trial=false){
  const run=f.system.prepareSortie({engine,chapterId,trial,replicaConfiguration:f.system.replicaConfiguration()});assert.equal(run.ok,true,run.message);return run;
}
function result(run,extra={}){const chapter=replicaChapter(run.snapshot.chapterId);return {...base,runId:run.snapshot.id,chapterId:chapter.id,stageIndex:chapter.stageIndex,hp:0,maxHp:960,kills:0,clock:0,...extra};}
function assertCredited(f,before,receipt){
  assert.equal(receipt.ok,true,receipt.message);
  const concrete=receipt.replica.localMaterialRewards;
  for(const [id,amount]of concrete){
    assert.equal((f.system.state.replicaInventory.items[id]||0)-(before.replicaInventory.items[id]||0),amount);
    assert.equal(receipt.rewards.filter(row=>row.id===id&&!row.firstClear).reduce((sum,row)=>sum+row.amount,0),amount);
  }
  assert.equal(receipt.replica.materialPolicyVersion,7);
  assert.equal(f.profile.coins,5000);
}
for(const extra of [
  {wave:1,endReason:'quit'},
  {wave:5,endReason:'defeat',gold:174,kills:122},
  {wave:12,endReason:'quit',gold:539,kills:518},
  {wave:15,endReason:'victory',won:true,gold:865,kills:973,hp:960},
]){
  const f=fixture(),run=start(f),raw=result(run,extra),before=f.system.state;
  const receipt=f.system.recordSortie({...raw,materialPolicyVersion:4,localMaterialRewards:[[112,999],[105,999]]});
  assertCredited(f,before,receipt);
  assert.deepEqual(receipt.replica.localMaterialRewards,prepareBattleMaterialRewards({...raw,materialPolicyVersion:7}));
  assert.equal(receipt.replica.accountExperience.experience,10);
  const paid=f.system.state;assert.equal(f.system.recordSortie(raw).ok,false);
  f.reload();f.system.snapshot();assert.deepEqual(f.system.state.replicaInventory,paid.replicaInventory);
}
for(const mode of ['trial','debug','abandoned']){
  const f=fixture(),run=start(f,7,mode==='trial'),before=f.system.state;
  const receipt=f.system.recordSortie(result(run,{...(mode==='debug'?{debugRun:true}:mode==='abandoned'?{abandoned:true}:{})}));
  assert.equal(receipt.ok,true);assert.deepEqual(receipt.replica.localMaterialRewards,[]);
  assert.deepEqual(f.system.state.replicaInventory,before.replicaInventory);
}
// Select an ordinary deterministic sortie with a nonempty material receipt.
let receiptTime=Date.UTC(2026,10,6,9);
for(let i=0;;i++){
  assert(i<1000);
  if(prepareBattleMaterialRewards({...base,runId:`sortie-${receiptTime}-1`}).length)break;
  receiptTime++;
}
for(const phase of ['failReceipt','failFinal','reload']){
  const f=fixture(receiptTime),run=start(f),raw=result(run),before=f.system.state;
  const expected=prepareBattleMaterialRewards(raw);assert(expected.length);
  f.flags[phase==='reload'?'failFinal':phase]=true;
  assert.equal(f.system.recordSortie(raw).ok,false);
  assert.deepEqual(f.system.state.replicaInventory,before.replicaInventory);
  if(phase!=='failReceipt')assert.deepEqual(f.system.state.replicaPendingSettlement.result.localMaterialRewards,expected);
  f.flags.failReceipt=f.flags.failFinal=false;
  if(phase==='failReceipt'){
    const receipt=f.system.recordSortie(raw);assertCredited(f,before,receipt);assert.deepEqual(receipt.replica.localMaterialRewards,expected);
  }else if(phase==='reload'){
    f.reload();f.system.snapshot();
    for(const [id,n]of expected)assert.equal((f.system.state.replicaInventory.items[id]||0)-(before.replicaInventory.items[id]||0),n);
  }else{
    f.system.snapshot();
    const receipt=f.system.recordSortie({...raw,wave:15,won:true,endReason:'victory',localMaterialRewards:[[112,999]]});
    assertCredited(f,before,receipt);assert.deepEqual(receipt.replica.localMaterialRewards,expected);
  }
  const paid=f.system.state;f.reload();f.system.snapshot();assert.deepEqual(f.system.state.replicaInventory,paid.replicaInventory);
}
for(const version of [4,5,6]){
  const f=fixture(),before=f.system.state;
  const pairs=version===6?[]:[[106,2],[801,1]];
  f.edit(state=>{state.replicaPendingSettlement={walletSource:REPLICA_WALLET_SOURCE,result:{...full,runId:`legacy-${version}`,gold:0,
    materialPolicyVersion:version,localMaterialRewards:pairs}};});
  f.system.snapshot();
  for(const [id,n]of pairs)assert.equal((f.system.state.replicaInventory.items[id]||0)-(before.replicaInventory.items[id]||0),n);
  if(version===6)for(const id of [105,106,107,108,109,112,113,801,802,803,804,805,806,807,808,809,810,811])assert.equal(f.system.state.replicaInventory.items[id]||0,before.replicaInventory.items[id]||0);
  const paid=f.system.state;f.reload();f.system.snapshot();assert.deepEqual(f.system.state.replicaInventory,paid.replicaInventory);
}
const first=fixture(),firstRun=start(first,1),firstBefore=first.system.state;
const firstReceipt=first.system.recordSortie(result(firstRun,{won:true,wave:15,endReason:'victory',hp:960}));
assertCredited(first,firstBefore,firstReceipt);assert.equal(first.system.state.equipment.items.length,firstBefore.equipment.items.length+1);
const gearAfterFirst=first.system.state.equipment.items.length,repeatRun=start(first,1);
assert.equal(first.system.recordSortie(result(repeatRun,{won:true,wave:15,endReason:'victory',hp:960})).ok,true);
assert.equal(first.system.state.equipment.items.length,gearAfterFirst,'repeat materials must not repeat first-clear equipment');
const snapshot=first.system.snapshot();assert.equal(snapshot.battleMaterials.nativeSettlementPending,false);assert.equal(battleMaterialSnapshot().sampleBased,true);
for(const [id,kind]of [[112,'equipmentKey'],[113,'equipmentKey'],[105,'material'],[801,'material']]){
  const source=backpackItemSources({nativeId:id},snapshot,{kind},{escape:String,number:String},label=>label);
  assert(source.includes('战斗结算'),`new source missing for ${id}`);
}
console.log(JSON.stringify({policy:BATTLE_MATERIAL_POLICY.id,frequency},null,2));
console.log('Battle material checks passed: declared probabilities, all item pools, zero-kill exits, first-clear separation, concrete receipt recovery, failed initial writes, legacy receipts and duplicate prevention.');
