import assert from 'node:assert/strict';
import source from '../src/replica/native-achievement-source.json' with {type:'json'};
import catalog from '../src/replica/native-economy-catalog.json' with {type:'json'};
import {nativeAchievementSnapshot} from '../src/replica/native-achievements.js';
import {captureNativeAchievementEvidence,planNativeAchievementProgress,validateNativeAchievementProgress} from '../src/replica/native-achievement-progress.js';

globalThis.document={baseURI:'http://localhost/',querySelector:()=>null};
globalThis.localStorage={getItem:()=>null,setItem:()=>{throw Error('Unexpected global save');}};
const {createPeripheralSystem}=await import('../src/peripheral/system.js');
const {createInitialGachaState}=await import('../src/gacha-engine.js');
const {PERIPHERAL_STORAGE_KEY}=await import('../src/peripheral/config.js');
const {REPLICA_WALLET_SOURCE}=await import('../src/replica/native-resource-wallet.js');
const {replicaChapter}=await import('../src/replica/chapter-contract.js');
const engine='danke-replica-v1',time=Date.UTC(2026,10,6,4);
const planes=catalog.skins.filter(row=>!row.closed).map(row=>({id:row.id,star:row.defaultStar,active:true,equipped:false}));
const rows=nativeAchievementSnapshot({}, {playerLevel:1,skins:planes}).items;
assert.equal(source.rows.length,153);assert.equal(rows.length,133);
assert.equal(new Set(rows.map(row=>row.id)).size,133);
const expectedGroups={'1201':68,'1202':10,'1204':11,'1210':8,'1211':8,'1213':20,'1215':8};
for(const [group,count]of Object.entries(expectedGroups))assert.equal(rows.filter(row=>row.nativeGroup===group).length,count);
for(const row of rows){
  const original=source.rows.find(item=>item.ID===row.nativeId),params=JSON.parse(original.ConditionParams);
  assert.equal(row.id,`native-achievement-${original.ID}`);
  assert.equal(row.target,['1202','1213'].includes(row.nativeGroup)?params.Level:params.Count);
  assert.deepEqual(original.RewardItem,[[2,10]]);assert.deepEqual(row.reward,{diamonds:10});
  assert.equal(row.rewardItems[0].nativeItemId,2);assert.equal(row.rewardItems[0].amount,10);
  assert(!['1205','1212'].includes(row.nativeGroup));
}
assert.deepEqual(rows.filter(row=>row.metric==='aircraft').map(row=>row.target),[1,2,3,4,5,6,7,8]);
assert(!rows.some(row=>['chapter','stars','weaponStar','aircraftStar','recruits','weapons'].includes(row.metric)));

// Migration uses independently evidenced lower bounds, never wallet balance or
// account level as a guess for lifetime spending or login days.
const legacy={replicaLoadout:{playerLevel:15},replicaInventory:{items:{2:12345}},
  flightRewards:{signCount:7,signDay:'2026-11-05'},daily:{date:'2026-11-05',counters:{sorties:4}},
  weekly:{counters:{sorties:8}},pilotSupply:{history:[{cost:100},{cost:2000}],week:{battles:10,boxesOpened:80,loginDays:['2026-11-04','2026-11-05']}},
  equipment:{levels:{1:25},nativeBoxProgress:{basicDraws:42}},
  replicaEquipmentBoxReceipt:{version:1,boxId:3,count:10,inventoryRevision:20,gearRevision:20,debit:{id:2,amount:2680}},
  replicaCampaign:{clearedChapterIds:[1]},replicaResults:[{engine,runId:'old-result',chapterId:1}],
  replicaInterruptedSortie:{snapshot:{engine,id:'old-in-progress',chapterId:1,stageIndex:0}}};
const prior=captureNativeAchievementEvidence(legacy),oldCopy=structuredClone(legacy);
const restored=planNativeAchievementProgress(prior,legacy,time);
assert.equal(restored.loginDays,8);assert.equal(restored.mainlineAttempts,10);assert.equal(restored.equipmentBoxes,80);
assert.equal(restored.diamondsSpent,4780);assert.equal(restored.maxEquipmentLevel,25);assert(restored.historicalCountsIncomplete);
assert.deepEqual(legacy,oldCopy);
const restoredState={...legacy,replicaAchievementProgress:restored};
assert.deepEqual(planNativeAchievementProgress(captureNativeAchievementEvidence(restoredState),restoredState,time),restored);
const rollbackDay=planNativeAchievementProgress(captureNativeAchievementEvidence(restoredState),restoredState,time-86400000);
assert.equal(rollbackDay.loginDays,8);
assert.throws(()=>validateNativeAchievementProgress({...restored,diamondsSpent:-1}));

function fixture(){
  const saved=new Map(),clock={time},flags={blockReceipt:false,blockWallet:false,blockAttempt:false,blockBox:false};
  const profile={coins:5000,diamonds:500};
  const storage={getItem:key=>saved.get(key)??null,setItem(key,value){
    const s=key===PERIPHERAL_STORAGE_KEY?JSON.parse(value):null;
    if(flags.blockReceipt&&s?.dailyRewardReceipt)throw Error('Receipt save failed');
    if(flags.blockWallet&&(s?.replicaInventory?.items?.[2]||0)>flags.blockWallet)throw Error('Wallet save failed');
    if(flags.blockAttempt&&s?.replicaInterruptedSortie)throw Error('Sortie save failed');
    if(flags.blockBox&&s?.replicaEquipmentBoxReceipt)throw Error('Box save failed');
    saved.set(key,value);
  }};
  const pilot={selected:'pilot-01',persistentSelected:'pilot-01',temporaryUnlocked:[],owned:['pilot-01'],resonance:{}};
  let collection=createInitialGachaState();
  const options={storage,profile,now:()=>clock.time,rng:()=>.5,getCampaign:()=>({highestCleared:-1}),
    stages:Array.from({length:60},(_,i)=>({id:'stage-'+i,name:'第'+(i+1)+'章'})),
    pilotApi:{get:()=>structuredClone(pilot),grant(id){if(!pilot.owned.includes(id))pilot.owned.push(id);return[{storagePersisted:true}];},select(id){pilot.selected=pilot.persistentSelected=id;return true;}},
    collectionApi:{get:()=>structuredClone(collection),transact(update){const next=structuredClone(collection),result=update(next);if(result.ok)collection=next;return result;}}};
  let system=createPeripheralSystem(options);
  return {clock,flags,profile,saved,storage,options,get system(){return system;},reload(){system=createPeripheralSystem(options);},
    edit(update){const next=system.state;update(next);storage.setItem(PERIPHERAL_STORAGE_KEY,JSON.stringify(next));this.reload();}};
}
const progress=f=>f.system.state.replicaAchievementProgress;
const start=(f,trial=false)=>f.system.prepareSortie({engine,chapterId:1,trial,replicaConfiguration:f.system.replicaConfiguration()});
const result=(run,extra={})=>({runId:run.snapshot.id,engine,chapterId:1,stageIndex:0,wave:1,gold:0,won:false,endReason:'quit',...extra});
const firstLogin='native-achievement-1201001';
const fresh=fixture();assert.equal(progress(fresh).loginDays,1);assert.equal(progress(fresh).diamondsSpent,0);
fresh.system.snapshot();fresh.reload();fresh.system.snapshot();
assert.equal(progress(fresh).loginDays,1);
fresh.clock.time+=86400000;fresh.system.snapshot();assert.equal(progress(fresh).loginDays,2);
fresh.reload();fresh.system.snapshot();assert.equal(progress(fresh).loginDays,2);
fresh.clock.time+=3*86400000;fresh.system.snapshot();assert.equal(progress(fresh).loginDays,3,'missing calendar days are not fabricated logins');

// Every retained original ID can pay exactly ten diamonds once. Original
// aircraft collection retains all milestones 1..8, not only 2/5/8.
const all=fixture();all.edit(s=>{
  s.replicaLoadout.playerLevel=50;s.replicaLoadout.skins=planes;
  s.equipment.levels={1:100,2:100,3:100,4:100,5:100};
  Object.assign(s.replicaAchievementProgress,{loginDays:300,mainlineAttempts:200,diamondsSpent:50000,equipmentBoxes:5000,maxEquipmentLevel:100});
  s.achievements={claimed:['aircraft-10','chapter-1']};
});
assert.equal(all.system.action('claimAchievement',{id:'aircraft-10'}).ok,false);
const beforeAll=all.system.state.replicaInventory.items[2]||0;
for(const row of all.system.snapshot().achievements.items){
  assert(row.claimable,row.name);const claim=all.system.action('claimAchievement',{id:row.id});assert.equal(claim.ok,true,claim.message);
}
assert.equal(all.system.state.replicaInventory.items[2],beforeAll+1330);
assert(all.system.state.achievements.claimed.includes('aircraft-10'));
assert.equal(all.profile.diamonds,500,'native achievement claims never also pay the legacy wallet');
all.reload();assert(all.system.snapshot().achievements.items.every(row=>row.claimed&&!row.claimable));
assert.equal(all.system.action('claimAchievement',{id:firstLogin}).ok,false);
assert.equal(all.system.state.replicaInventory.items[2],beforeAll+1330);
const unfinished=fixture();assert.equal(unfinished.system.action('claimAchievement',{id:'native-achievement-1202002'}).ok,false);

for(const phase of ['blockReceipt','blockWallet']){
  const f=fixture(),before=f.system.state.replicaInventory.items[2]||0;
  f.flags[phase]=phase==='blockWallet'?Math.max(1,before):true;
  assert.equal(f.system.action('claimAchievement',{id:firstLogin}).ok,false);
  assert.equal(f.system.state.replicaInventory.items[2]||0,before);
  f.flags[phase]=false;f.reload();f.system.snapshot();
  if(phase==='blockReceipt')assert.equal(f.system.action('claimAchievement',{id:firstLogin}).ok,true);
  assert.equal(f.system.state.replicaInventory.items[2],before+10);
  const paid=f.system.state;f.reload();f.system.snapshot();assert.equal(f.system.action('claimAchievement',{id:firstLogin}).ok,false);
  assert.deepEqual(f.system.state.replicaInventory,paid.replicaInventory);assert.equal(progress(f).diamondsSpent,0);
}

const sorties=fixture(),beforeSorties=progress(sorties).mainlineAttempts;
sorties.flags.blockAttempt=true;assert.equal(start(sorties).ok,false);assert.equal(progress(sorties).mainlineAttempts,beforeSorties);
sorties.flags.blockAttempt=false;const run=start(sorties);assert.equal(run.ok,true);
assert.equal(progress(sorties).mainlineAttempts,beforeSorties+1);assert.equal(start(sorties).snapshot.id,run.snapshot.id);
assert.equal(sorties.system.recordSortie(result(run)).ok,true);
assert.equal(progress(sorties).mainlineAttempts,beforeSorties+1);
assert.equal(sorties.system.recordSortie(result(run)).ok,false);sorties.reload();sorties.system.snapshot();assert.equal(progress(sorties).mainlineAttempts,beforeSorties+1);
const trial=start(sorties,true);assert.equal(trial.ok,true);assert.equal(sorties.system.recordSortie(result(trial)).ok,true);
assert.equal(progress(sorties).mainlineAttempts,beforeSorties+1,'trial sorties are excluded');
const interrupted=start(sorties);assert.equal(interrupted.ok,true);const interruptedCount=progress(sorties).mainlineAttempts;
sorties.reload();sorties.system.snapshot();assert.equal(progress(sorties).mainlineAttempts,interruptedCount,'interrupted-save recovery does not count another attempt');

const spending=fixture();spending.edit(s=>{s.replicaInventory.items[2]=50000;s.replicaInventory.items[112]=0;s.replicaInventory.items[113]=0;});
let expectedSpent=progress(spending).diamondsSpent;
const shopView=spending.system.snapshot().shop,offer=shopView.items.find(row=>row.id==='exchange-coins');assert(offer.available);
const purchased=await spending.system.action('shopBuy',{id:offer.id,token:shopView.token});assert.equal(purchased.ok,true,purchased.message);
expectedSpent+=offer.cost.amount;assert.equal(progress(spending).diamondsSpent,expectedSpent);
const beforeBoxes=progress(spending).equipmentBoxes;
const paidBox=spending.system.action('gearSupply',{pool:'advanced',count:10,
  expectedRevision:spending.system.state.equipment.revision,expectedInventoryRevision:spending.system.state.replicaInventory.revision});
assert.equal(paidBox.ok,true,paidBox.message);assert.equal(paidBox.gearResult.receipt.debit.id,2);
expectedSpent+=paidBox.gearResult.receipt.debit.amount;
assert.equal(progress(spending).diamondsSpent,expectedSpent);assert.equal(progress(spending).equipmentBoxes,beforeBoxes+10);
const freeBox=spending.system.action('gearSupply',{pool:'basic',count:1,
  expectedRevision:spending.system.state.equipment.revision,expectedInventoryRevision:spending.system.state.replicaInventory.revision});
assert.equal(freeBox.ok,true,freeBox.message);assert.equal(freeBox.gearResult.receipt.debit.amount,0);
assert.equal(progress(spending).diamondsSpent,expectedSpent);assert.equal(progress(spending).equipmentBoxes,beforeBoxes+11);
spending.edit(s=>{s.replicaInventory.items[113]=1;});
const keyed=spending.system.action('backpackUse',{id:113,count:1,expectedRevision:spending.system.state.replicaInventory.revision,expectedGearRevision:spending.system.state.equipment.revision});
assert.equal(keyed.ok,true,keyed.message);assert.equal(progress(spending).equipmentBoxes,beforeBoxes+12);
assert.equal(progress(spending).diamondsSpent,expectedSpent);
const recruited=spending.system.action('pilotSupply',{action:'draw',count:1,expectedRevision:spending.system.state.replicaInventory.revision});
assert.equal(recruited.ok,true,recruited.message);expectedSpent+=100;assert.equal(progress(spending).diamondsSpent,expectedSpent);
const savedCounters=structuredClone(progress(spending));spending.reload();spending.system.snapshot();assert.deepEqual(progress(spending),savedCounters);
spending.clock.time+=86400000;spending.system.snapshot();assert.equal(progress(spending).diamondsSpent,expectedSpent);assert.equal(progress(spending).equipmentBoxes,beforeBoxes+12);

const failedBox=fixture();failedBox.flags.blockBox=true;
const oldBoxCounters=structuredClone(progress(failedBox));
assert.equal(failedBox.system.action('gearSupply',{pool:'basic',count:1,expectedRevision:failedBox.system.state.equipment.revision,
  expectedInventoryRevision:failedBox.system.state.replicaInventory.revision}).ok,false);
assert.deepEqual(progress(failedBox),oldBoxCounters);failedBox.flags.blockBox=false;
assert.equal(failedBox.system.action('gearSupply',{pool:'basic',count:1,expectedRevision:failedBox.system.state.equipment.revision,
  expectedInventoryRevision:failedBox.system.state.replicaInventory.revision}).ok,true);
assert.equal(progress(failedBox).equipmentBoxes,oldBoxCounters.equipmentBoxes+1);
const equipment=fixture();equipment.edit(s=>{s.equipment.levels[1]=20;});
const lock=equipment.system.action('gearLock',{id:equipment.system.state.equipment.items[0].uid,expectedRevision:equipment.system.state.equipment.revision});assert.equal(lock.ok,true,lock.message);
assert.equal(progress(equipment).maxEquipmentLevel,20);
equipment.edit(s=>{s.equipment.levels[1]=1;});
assert.equal(equipment.system.snapshot().achievements.items.find(row=>row.nativeGroup==='1213'&&row.target===20).claimable,true);
const stale=fixture(),oldPage=stale.system,newPage=createPeripheralSystem(stale.options);
assert.equal(newPage.action('claimAchievement',{id:firstLogin}).ok,true);
const durable=stale.storage.getItem(PERIPHERAL_STORAGE_KEY);
assert.equal(oldPage.action('claimAchievement',{id:firstLogin}).ok,false);
assert.equal(start(stale).ok,false,'a stale page cannot add a lifetime attempt');
assert.match(oldPage.snapshot().storageWarning,/其他页面更新/);
assert.equal(stale.storage.getItem(PERIPHERAL_STORAGE_KEY),durable);
const pendingLegacy=fixture(),legacyBefore=pendingLegacy.system.state.replicaInventory.items[2]||0;
pendingLegacy.edit(s=>{
  s.achievements={claimed:['aircraft-10']};s.replicaLoadout.skins=planes;
  s.dailyRewardReceipt={version:1,walletSource:REPLICA_WALLET_SOURCE,source:{type:'achievement',id:'aircraft-10'},
    before:{diamonds:legacyBefore},after:{diamonds:legacyBefore+20}};
});
pendingLegacy.system.snapshot();assert.equal(pendingLegacy.system.state.replicaInventory.items[2],legacyBefore+20);
assert(pendingLegacy.system.state.achievements.claimed.includes('aircraft-10'));
pendingLegacy.reload();pendingLegacy.system.snapshot();assert.equal(pendingLegacy.system.state.replicaInventory.items[2],legacyBefore+20);
assert.equal(pendingLegacy.system.action('claimAchievement',{id:'native-achievement-1215008'}).ok,true);
assert.equal(pendingLegacy.system.state.replicaInventory.items[2],legacyBefore+30);
assert.equal(pendingLegacy.system.action('claimAchievement',{id:'native-achievement-1215008'}).ok,false);
console.log('Native achievement checks passed: 133 source-matched milestones, ten diamonds each, aircraft 1..8, lifetime counters, paid/free/key boxes, spending, trial exclusion, old receipts and atomic claim/reload.');
