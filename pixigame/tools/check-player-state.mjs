import assert from 'node:assert/strict';

// Release-critical behavior checks. Use only synthetic in-memory storage and
// versioned production modules: local tests/QA artifacts are not build inputs.
globalThis.document={baseURI:'http://localhost/',querySelector:()=>null};
globalThis.localStorage={getItem:()=>null,setItem:()=>{throw Error('Unexpected global save');}};
const {pilotPreviewAccess}=await import('../src/pilot-preview-access.js');
const roster=await import('../src/pilots.js');
const {createPeripheralSystem}=await import('../src/peripheral/system.js');
const {createInitialGachaState}=await import('../src/gacha-engine.js');
const {nativeCollectionAccess,nativeCollectionRows}=await import('../src/replica/native-collection-access.js');
const {nativeWeaponGroupId,nativeWeaponGroupRows}=await import('../src/replica/native-weapon-groups.js');
const {grantPilotCards}=await import('../src/replica/pilot-copy-grants.js');
const {playerInfoModel}=await import('../src/ui/player-info-model.js');
const {supplyPool}=await import('../src/ui/supply-pools.js');
const {battleOnboarding,nextLobbyGuide}=await import('../src/peripheral/onboarding.js');
const {replicaChapter}=await import('../src/replica/chapter-contract.js');
const {PERIPHERAL_STORAGE_KEY}=await import('../src/peripheral/config.js');
const {default:catalog}=await import('../src/replica/native-economy-catalog.json',{with:{type:'json'}});

function fixture(owned=['pilot-01']){
  const saved=new Map(),flags={fail:false};
  const storage={getItem:key=>saved.get(key)??null,setItem(key,value){if(flags.fail)throw Error('Simulated full storage');saved.set(key,value);}};
  const pilot={selected:owned[0],persistentSelected:owned[0],temporaryUnlocked:[],owned:[...owned],resonance:{}};
  let collection=createInitialGachaState();
  const options={storage,profile:{coins:5000,diamonds:500},now:()=>Date.UTC(2026,9,30,4),
    getCampaign:()=>({highestCleared:-1}),stages:[{id:'stage-1',name:'第1章'}],pilotApi:{get:()=>structuredClone(pilot),grant(id){if(!pilot.owned.includes(id))pilot.owned.push(id);return[{storagePersisted:true}];},select(id){pilot.selected=pilot.persistentSelected=id;return true;}},
    collectionApi:{get:()=>structuredClone(collection),transact(update){const next=structuredClone(collection),result=update(next);if(result.ok)collection=next;return result;}}};
  let system=createPeripheralSystem(options);
  return {flags,pilot,get system(){return system;},reload(){system=createPeripheralSystem(options);return system;},
    edit(update){const next=system.state;update(next);storage.setItem(PERIPHERAL_STORAGE_KEY,JSON.stringify(next));this.reload();},
    native(kind,id,action='select'){return system.action('replicaCollection',{kind,id,action,expectedRevision:system.snapshot().replicaCollection.revision});},
    acquire(kind,id){this.edit(state=>{for(const[item,count]of catalog[kind].find(row=>row.id===id).unlockCost)state.replicaInventory.items[item]=(state.replicaInventory.items[item]||0)+count;});assert(this.native(kind,id,'unlock').ok);},
  };
}

assert.deepEqual(pilotPreviewAccess({development:false,search:'?preview-pilot=pilot-08'}),{selected:null,unlocked:[]});
assert.deepEqual(pilotPreviewAccess({development:true,search:''}),{selected:null,unlocked:[]});
assert.deepEqual(roster.getPilotState().temporaryUnlocked,[]);
assert.equal(roster.getPilotState().selected,roster.getPilotState().persistentSelected);

const authority=fixture(['pilot-01','pilot-02']);
assert(authority.system.action('selectPilot',{id:'pilot-02'}).ok);
authority.pilot.selected=authority.pilot.persistentSelected='pilot-01';
assert.equal(authority.reload().snapshot().basePilotId,'pilot-02');assert.equal(authority.pilot.selected,'pilot-02');
authority.pilot.selected='pilot-01';
assert.equal(authority.system.prepareSortie({trial:true}).snapshot.pilotId,'pilot-02');

const initial=fixture(),start=initial.reload().snapshot(),configuration=initial.system.replicaConfiguration();
assert.deepEqual(configuration.equipment,[]);
assert.equal(start.equipment.items.length,5);
assert(Object.values(start.equipment.slots).every(uid=>uid===null));
assert.equal(start.equipment.totals.attack,0);
assert.equal(start.equipment.totals.hp,0);
assert.deepEqual(configuration.progression.skins,[]);
assert.equal(configuration.progression.role.id,10100);
assert.equal(configuration.progression.role.skinId,0);
const initialPlane=start.replicaCollection.skins.find(row=>row.id===10101);
assert.equal(initialPlane.star,0);
assert.equal(nativeCollectionAccess('skins',start,initialPlane).using,true);
assert.equal(nativeCollectionAccess('skins',start,initialPlane).activated,false);
assert.deepEqual(battleOnboarding(start,1),{movement:true,firstChoice:true});
assert.equal(nextLobbyGuide(start),null);

const starterGear=start.equipment.items[0];
const gearAction=(type)=>initial.system.action(type,{id:starterGear.uid,expectedRevision:initial.system.snapshot().equipment.revision});
assert.equal(gearAction('gearEquip').message,start.equipment.equipLockReason);
const engine='danke-replica-v1';
function finishFirstChapter(won){
  const run=initial.system.prepareSortie({engine,chapterId:1,replicaConfiguration:initial.system.replicaConfiguration()});
  assert.equal(run.ok,true,run.message);
  const result=initial.system.recordSortie({runId:run.snapshot.id,engine,chapterId:1,stageIndex:0,
    wave:won?replicaChapter(1).waveCount:1,won,endReason:won?'victory':'defeat',clock:60,gold:0,hp:won?600:0,maxHp:600,kills:0,revivesUsed:0});
  assert.equal(result.ok,true,result.message);
}
finishFirstChapter(false);
assert.equal(nextLobbyGuide(initial.system.snapshot()),null);
assert.equal(gearAction('gearEquip').ok,false);
finishFirstChapter(true);
assert.deepEqual(nextLobbyGuide(initial.reload().snapshot()),{group:9,uid:starterGear.uid});
initial.flags.fail=true;
assert.equal(gearAction('gearEquip').ok,false);
initial.flags.fail=false;
assert.equal(initial.system.state.onboarding.completed.includes(9),false);
assert.equal(gearAction('gearEquip').ok,true);
assert.equal(initial.reload().snapshot().equipment.slots[starterGear.type],starterGear.uid);
assert.equal(initial.system.state.onboarding.completed.includes(9),true);
assert.equal(gearAction('gearUnequip').ok,true);
assert.notEqual(nextLobbyGuide(initial.system.snapshot())?.group,9);

const legacy=fixture();
legacy.edit(state=>{
  state.equipment.slots[starterGear.type]=starterGear.uid;
  state.replicaLoadout.skins=[{id:10101,star:1,active:true,equipped:false}];
});
const retained=legacy.system.replicaConfiguration();
assert.equal(retained.equipment.length,1);
assert.equal(retained.progression.skins.find(plane=>plane.id===10101)?.active,true);

const f=fixture();
const currentPool=f.system.snapshot().pilotSupply.pool;
for(const pools of [[{id:'pilot',singleCost:0}],{pilot:{singleCost:0}}])
  assert.equal(supplyPool({pools,pilotSupply:{pool:currentPool}},'pilot'),currentPool);
for(const[kind,id]of [['skins',10104],['pilots',40300]]){
  f.acquire(kind,id);assert(f.native(kind,id).ok);
  const snapshot=f.system.snapshot(),base=nativeCollectionRows(kind,snapshot).find(row=>nativeCollectionAccess(kind,snapshot,row).isBase);
  assert(base);assert.equal(base.owned,kind==='pilots');assert(nativeCollectionAccess(kind,snapshot,base).available);
  assert(f.native(kind,0).ok);
  const after=f.reload().snapshot(),profile=playerInfoModel(after);
  assert.equal(kind==='skins'?after.aircraftId:after.pilotId,'pilot-01');
  assert.equal(kind==='skins'?profile.aircraft.id:profile.pilot.id,'pilot-01');
  assert(after.replicaCollection[kind].find(row=>row.id===id).owned);
  assert.equal(f.native(kind,kind==='skins'?10103:40400).ok,false);
}

const before=f.system.state;f.flags.fail=true;
assert.equal(f.native('skins',10104).ok,false);assert.equal(f.native('pilots',40300).ok,false);
assert.deepEqual(f.system.state.replicaLoadout,before.replicaLoadout);
assert.deepEqual(f.system.state.replicaInventory,before.replicaInventory);f.flags.fail=false;
assert.equal(f.reload().snapshot().aircraftId,'pilot-01');

const variant=catalog.guns.find(row=>row.skinNumber>0&&!row.closed&&row.baseGunId!==20101);
f.acquire('guns',variant.id);assert(f.native('guns',variant.id).ok);assert(f.native('guns',20101).ok);
const weaponRows=f.reload().snapshot().replicaCollection.guns;
assert.equal(nativeWeaponGroupRows(weaponRows).find(row=>nativeWeaponGroupId(row)===variant.baseGunId).id,variant.id);
assert(f.native('guns',variant.id).ok);

const progression=structuredClone(f.system.state.replicaLoadout),inventory=structuredClone(f.system.state.replicaInventory);
grantPilotCards(inventory,progression,40400,1,{activate:true});
assert.equal(progression.pilots.some(row=>row.equipped),false);
console.log('Player-state checks passed: fresh loadout, first-chapter equipment tutorial, saved gear, aircraft and pilot selection, save rollback and later rewards.');
