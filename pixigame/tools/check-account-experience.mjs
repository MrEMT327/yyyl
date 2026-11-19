import assert from 'node:assert/strict';

// Release checks use synthetic storage only; never load a player's browser save.
globalThis.document={baseURI:'http://localhost/',querySelector:()=>null};
globalThis.localStorage={getItem:()=>null,setItem:()=>{throw Error('Unexpected global save');}};
const {createPeripheralSystem}=await import('../src/peripheral/system.js');
const {createInitialGachaState}=await import('../src/gacha-engine.js');
const {PERIPHERAL_STORAGE_KEY}=await import('../src/peripheral/config.js');
const {replicaChapter}=await import('../src/replica/chapter-contract.js');
const {playerInfoModel}=await import('../src/ui/player-info-model.js');
const {planAccountBattleExperience,planAccountExperienceRepair}=await import('../src/replica/account-experience.js');
const {createReplicaProgression}=await import('../src/replica/native-progression.js');
const {weaponDeploymentGate}=await import('../src/replica/native-weapon-loadout.js');

function fixture(){
  const saved=new Map(),flags={failFinal:false},profile={coins:5000,diamonds:500};
  const storage={getItem:key=>saved.get(key)??null,setItem(key,value){
    const state=key===PERIPHERAL_STORAGE_KEY?JSON.parse(value):null;
    if(flags.failFinal&&state?.replicaLoadout?.playerLevel===2&&!state.replicaPendingSettlement)throw Error('Simulated final-save failure');
    saved.set(key,value);
  }};
  const pilot={selected:'pilot-01',persistentSelected:'pilot-01',temporaryUnlocked:[],owned:['pilot-01'],resonance:{}};
  let collection=createInitialGachaState();
  const options={storage,profile,now:()=>Date.UTC(2026,10,6,4),getCampaign:()=>({highestCleared:-1}),stages:Array.from({length:60},(_,i)=>({id:'stage-'+i,name:'第'+(i+1)+'章'})),
    pilotApi:{get:()=>structuredClone(pilot),grant(id){if(!pilot.owned.includes(id))pilot.owned.push(id);return[{storagePersisted:true}];},select(id){pilot.selected=pilot.persistentSelected=id;return true;}},
    collectionApi:{get:()=>structuredClone(collection),transact(update){const next=structuredClone(collection),result=update(next);if(result.ok)collection=next;return result;}}};
  let system=createPeripheralSystem(options);
  return {flags,storage,get system(){return system;},reload(){system=createPeripheralSystem(options);return system;},
    edit(update){const next=system.state;update(next);storage.setItem(PERIPHERAL_STORAGE_KEY,JSON.stringify(next));return this.reload();}};
}
const engine='danke-replica-v1';
const prepare=(f,trial=false)=>{const run=f.system.prepareSortie({engine,chapterId:1,trial,replicaConfiguration:f.system.replicaConfiguration()});assert.equal(run.ok,true,run.message);return run;};
const result=(run,extra={})=>({runId:run.snapshot.id,engine,chapterId:1,stageIndex:0,wave:replicaChapter(1).waveCount,
  gold:101,won:true,hp:960,maxHp:960,revivesUsed:0,kills:100,...extra});

const f=fixture(),initial=f.system.state,run=prepare(f),first=f.system.recordSortie(result(run));
assert.equal(first.ok,true,first.message);assert.equal(f.system.state.replicaLoadout.playerLevel,1);
assert.equal(f.system.snapshot().accountExperience.experience,10);
assert.equal(first.replica.accountExperience.experience,10);
assert.equal(f.system.state.replicaInventory.items[1]-(initial.replicaInventory.items[1]||0),101);
assert.equal(f.system.state.replicaInventory.items[2]||0,initial.replicaInventory.items[2]||0);
assert.equal(f.system.state.replicaInventory.items[3]||0,0,'account EXP must not become an inert backpack item');
assert.equal(f.system.recordSortie(result(run)).ok,false);
const savedFirst=f.system.state;f.reload();f.system.snapshot();
assert.deepEqual(f.system.state.replicaInventory,savedFirst.replicaInventory);
assert.equal(f.system.snapshot().accountExperience.experience,10);
const secondRun=prepare(f),secondBefore=f.system.state,second=f.system.recordSortie(result(secondRun));
assert.equal(second.ok,true);assert.equal(f.system.state.replicaLoadout.playerLevel,2);
assert.equal(f.system.snapshot().accountExperience.experience,0);
assert.equal(f.system.state.replicaInventory.items[1]-secondBefore.replicaInventory.items[1],1101);
assert.equal(f.system.state.replicaInventory.items[2]-secondBefore.replicaInventory.items[2],20);
assert.equal(second.rewards.filter(row=>row.accountLevelReward===2).length,2);
assert.equal(playerInfoModel(f.system.snapshot()).accountLevel,2);
const paid=f.system.state;f.reload();f.system.snapshot();assert.deepEqual(f.system.state.replicaInventory,paid.replicaInventory);
const chapter2=f.system.prepareSortie({engine,chapterId:2,replicaConfiguration:f.system.replicaConfiguration()});assert.equal(chapter2.ok,true,chapter2.message);
assert.equal(f.system.recordSortie({...result(chapter2),chapterId:2,stageIndex:1,wave:replicaChapter(2).waveCount}).ok,true);
assert.equal(f.system.snapshot().accountExperience.experience,10);assert.equal(f.system.state.replicaInventory.items[2],paid.replicaInventory.items[2]);
for(const extra of [{won:false,wave:2},{abandoned:true},{won:false,endReason:'quit',abandoned:true},{debugRun:true}]){
  const item=fixture(),started=prepare(item);assert.equal(item.system.recordSortie(result(started,extra)).ok,true);
  assert.equal(item.system.state.replicaLoadout.playerLevel,1);assert.equal(item.system.snapshot().accountExperience.experience,0,JSON.stringify(extra));
}
const trial=fixture(),trialRun=prepare(trial,true);assert.equal(trial.system.recordSortie(result(trialRun)).ok,true);
assert.equal(trial.system.snapshot().accountExperience.experience,0);
const failure=fixture();assert.equal(failure.system.recordSortie(result(prepare(failure))).ok,true);
const failedRun=prepare(failure),failedResult=result(failedRun,{won:false,wave:2,endReason:'defeat'}),failureBefore=failure.system.state;
failure.flags.failFinal=true;assert.equal(failure.system.recordSortie(failedResult).ok,false);
assert.equal(failure.system.state.replicaLoadout.playerLevel,1);
assert.equal(failure.system.snapshot().accountExperience.experience,10);
assert.deepEqual(failure.system.state.replicaInventory,failureBefore.replicaInventory);
assert(failure.system.state.replicaPendingSettlement);failure.flags.failFinal=false;failure.reload();failure.system.snapshot();
assert.equal(failure.system.state.replicaLoadout.playerLevel,2);
const recovered=failure.system.state;failure.reload();failure.system.snapshot();assert.deepEqual(failure.system.state.replicaInventory,recovered.replicaInventory);
assert.equal(failure.system.recordSortie(failedResult).ok,false);
const defeated=fixture();defeated.edit(state=>{state.replicaCampaign={clearedChapterIds:[1,2,3,4,5,6]};});
const chapter7=defeated.system.prepareSortie({engine,chapterId:7,replicaConfiguration:defeated.system.replicaConfiguration()});assert.equal(chapter7.ok,true,chapter7.message);
const defeatResult={...result(chapter7),chapterId:7,stageIndex:6,wave:12,won:false,endReason:'defeat',hp:0,kills:518,gold:539};
const defeatBefore=defeated.system.state,defeatReceipt=defeated.system.recordSortie(defeatResult);
assert.equal(defeatReceipt.ok,true);assert.equal(defeatReceipt.replica.accountExperience.experience,10);
assert.equal(defeated.system.snapshot().accountExperience.experience,10);
assert.equal(defeated.system.state.replicaCampaign.clearedChapterIds.includes(7),false);
assert.equal(defeated.system.state.replicaInventory.items[1]-(defeatBefore.replicaInventory.items[1]||0),2487);
assert.equal(defeated.system.state.equipment.items.length,defeatBefore.equipment.items.length);
assert.equal(defeated.system.recordSortie(defeatResult).ok,false);
const defeatSaved=defeated.system.state;defeated.reload();defeated.system.snapshot();
assert.deepEqual(defeated.system.state.replicaInventory,defeatSaved.replicaInventory);
assert.equal(defeated.system.snapshot().accountExperience.experience,10);
// Zero kills/time/gold still earn account EXP after a real paid sortie.
const exited=fixture();exited.edit(state=>{state.replicaCampaign={clearedChapterIds:[1,2,3,4,5,6]};});
for(const kills of [0,35]){
  const entered=exited.system.prepareSortie({engine,chapterId:7,replicaConfiguration:exited.system.replicaConfiguration()});assert.equal(entered.ok,true,entered.message);
  const beforeExit=exited.system.state;
  const quitResult={...result(entered),chapterId:7,stageIndex:6,wave:1,won:false,endReason:'quit',kills,clock:kills?20:0,gold:kills?37:0};
  const quitReceipt=exited.system.recordSortie(quitResult);assert.equal(quitReceipt.ok,true);
  assert.equal(quitReceipt.replica.accountExperience.experience,10);
  assert.equal(exited.system.state.replicaCampaign.clearedChapterIds.includes(7),false);
  assert.equal(exited.system.state.equipment.items.length,beforeExit.equipment.items.length);
  assert.equal(exited.system.recordSortie(quitResult).ok,false);
  const durable=exited.system.state;exited.reload();exited.system.snapshot();assert.deepEqual(exited.system.state.replicaInventory,durable.replicaInventory);
}
assert.equal(exited.system.state.replicaLoadout.playerLevel,2);assert.equal(exited.system.snapshot().accountExperience.experience,0);
const quitFailure=fixture();assert.equal(quitFailure.system.recordSortie(result(prepare(quitFailure))).ok,true);
const quitRun=prepare(quitFailure),quitPending=result(quitRun,{won:false,wave:1,endReason:'quit',kills:0,clock:0,gold:0});
const beforeQuitFailure=quitFailure.system.state;quitFailure.flags.failFinal=true;
assert.equal(quitFailure.system.recordSortie(quitPending).ok,false);assert.equal(quitFailure.system.state.replicaLoadout.playerLevel,1);
assert.deepEqual(quitFailure.system.state.replicaInventory,beforeQuitFailure.replicaInventory);
quitFailure.flags.failFinal=false;quitFailure.reload();quitFailure.system.snapshot();assert.equal(quitFailure.system.state.replicaLoadout.playerLevel,2);
const quitRecovered=quitFailure.system.state;quitFailure.reload();quitFailure.system.snapshot();assert.deepEqual(quitFailure.system.state.replicaInventory,quitRecovered.replicaInventory);
const unpaidExit=fixture();assert.equal(unpaidExit.system.recordSortie(result(prepare(unpaidExit))).ok,true);
const beforeUnpaidExit=unpaidExit.system.state;
unpaidExit.edit(state=>{delete state.replicaAccountExperience.quitExperienceRestored;state.replicaAccountExperience.policyId='project-mainline-account-exp-v2';
 state.replicaResults.push({...result({snapshot:{id:'unpaid-quit'}}),won:false,wave:1,endReason:'quit',kills:0,clock:0,gold:0});});
assert.equal(unpaidExit.system.state.replicaLoadout.playerLevel,2);
assert.equal(unpaidExit.system.state.replicaInventory.items[1]-beforeUnpaidExit.replicaInventory.items[1],1000);
assert.equal(unpaidExit.system.state.replicaInventory.items[2]-beforeUnpaidExit.replicaInventory.items[2],20);
assert.equal(unpaidExit.system.state.replicaAccountExperience.recoveredQuitCount,1);
const exitRepaid=unpaidExit.system.state;unpaidExit.reload();unpaidExit.system.snapshot();assert.deepEqual(unpaidExit.system.state.replicaInventory,exitRepaid.replicaInventory);
const unpaid=fixture();assert.equal(unpaid.system.recordSortie(result(prepare(unpaid))).ok,true);
const unpaidBefore=unpaid.system.state;
unpaid.edit(state=>{delete state.replicaAccountExperience.defeatExperienceRestored;
  state.replicaAccountExperience.policyId='project-mainline-account-exp-v1';
  state.replicaResults.push({...result({snapshot:{id:'unpaid-defeat'}}),won:false,wave:2,endReason:'defeat'});});
assert.equal(unpaid.system.state.replicaLoadout.playerLevel,2);
assert.equal(unpaid.system.state.replicaInventory.items[1]-unpaidBefore.replicaInventory.items[1],1000);
assert.equal(unpaid.system.state.replicaInventory.items[2]-unpaidBefore.replicaInventory.items[2],20);
assert.equal(unpaid.system.state.replicaAccountExperience.recoveredDefeatCount,1);
const repaid=unpaid.system.state;unpaid.reload();unpaid.system.snapshot();assert.deepEqual(unpaid.system.state.replicaInventory,repaid.replicaInventory);
const old=fixture(),oldBefore=old.system.state;
old.edit(state=>{delete state.replicaAccountExperience;state.replicaCampaign={clearedChapterIds:[1,2],passedWaves:{1:15,2:15},starMasks:{1:1,2:1}};
  state.replicaResults=[{...result({snapshot:{id:'historical-1'}})},{...result({snapshot:{id:'historical-2'}}),chapterId:2,stageIndex:1}];});
assert.equal(old.system.state.replicaLoadout.playerLevel,2);
assert.equal(old.system.state.replicaInventory.items[1]-(oldBefore.replicaInventory.items[1]||0),1000);
assert.equal(old.system.state.replicaInventory.items[2]-(oldBefore.replicaInventory.items[2]||0),20);
const repaired=old.system.state;old.reload();old.system.snapshot();assert.deepEqual(old.system.state.replicaInventory,repaired.replicaInventory);
const legacy=fixture(),legacyDiamonds=legacy.system.state.replicaInventory.items[2]||0;legacy.edit(state=>{state.replicaLoadout.playerLevel=15;state.replicaCampaign={clearedChapterIds:[1]};});
assert.equal(legacy.system.state.replicaLoadout.playerLevel,15);assert.equal(legacy.system.state.replicaInventory.items[2]||0,legacyDiamonds);
let progression=createReplicaProgression(),inventory={version:1,revision:0,items:{}},gear=fixture().system.state.equipment,account;
for(let i=0;progression.playerLevel<15;i++){
  assert(i<300);const plan=planAccountBattleExperience(progression,inventory,gear,account,result({snapshot:{id:'level-run-'+i}}));
  ({progression,inventory,gear,account}=plan);
}
assert.equal(weaponDeploymentGate(progression.playerLevel).secondUnlocked,true);
assert(gear.items.some(item=>item.family===4500100&&item.quality===20),'level-4 reward must be a usable equipment instance');
assert.equal(account.pendingRewards.filter(row=>row.level===9&&row.id===2016).length,1);
assert.equal(inventory.items[2016]||0,0,'unimplemented three-day benefit card remains an entitlement, not a dead item');
const keep=structuredClone(inventory);assert.equal(planAccountBattleExperience(progression,inventory,gear,account,result({snapshot:{id:account.lastRunId}})),null);assert.deepEqual(inventory,keep);
const blank=createReplicaProgression(),empty={version:1,revision:0,items:{}};
assert.equal(planAccountBattleExperience(blank,empty,gear,undefined,{chapterId:1,won:true,wave:1}),null);
assert.equal(planAccountExperienceRepair(blank,empty,gear,undefined,{passedWaves:{1:15}}).transition.experience,0);
assert.throws(()=>planAccountBattleExperience(blank,empty,gear,{version:1,experience:-1},result({snapshot:{id:'bad'}})));
assert.deepEqual(empty,{version:1,revision:0,items:{}});assert.equal(blank.playerLevel,1);
console.log('Account EXP checks passed: victory/defeat/zero-kill exit EXP, original level rewards through 15, unpaid defeat/exit recovery, atomic persistence and duplicate prevention.');
