import assert from 'node:assert/strict';
// Release check: use isolated memory; never read or update a player's save.
globalThis.document={baseURI:'http://localhost/',querySelector:()=>null};
const {createReplicaProgression}=await import('../src/replica/native-progression.js');
const {pilotSupplySnapshot,planPilotSupply,recordPilotSupplyEvent,recordPilotSupplyBattle,recordPilotSupplyUpgrade}=await import('../src/replica/pilot-supply.js');
const {flightLedger,planFlightReward}=await import('../src/replica/flight-rewards.js');
const {previousAircraftSigninRewards}=await import('../src/replica/local-signin-policy.js');
const time=Date.UTC(2026,10,2,4),campaign={clearedChapterIds:[1,2,3]};
let progression=createReplicaProgression(),inventory={version:1,revision:0,items:{}},ledger;
for(let i=0;i<5;i++)ledger=recordPilotSupplyBattle(ledger,time,{won:true,kills:401,bossKills:1});
ledger=recordPilotSupplyUpgrade(ledger,time,2);
ledger=recordPilotSupplyEvent(ledger,time,{boxesOpened:3,patrolClaims:3,shopPurchases:1});
const snapshot=()=>pilotSupplySnapshot(ledger,inventory,progression,time,campaign);
const claim=(action,id)=>{const next=planPilotSupply(progression,inventory,ledger,{action,id,expectedRevision:inventory.revision},time,{campaign,randomTicket:()=>0});({progression,inventory,ledger}=next);};
assert.equal(snapshot().tasks.length,7);for(const task of snapshot().tasks){assert(task.canClaim);claim('task',task.id);}
assert.equal(snapshot().activity.points,100);assert.deepEqual(inventory.items,{});
for(const step of [20,40,60,80,100])claim('activity',step);
assert.deepEqual(inventory.items,{1:1000,2:50,105:50,113:1,801:10});
for(const step of [20,40,60,80,100])assert.throws(()=>claim('activity',step));
ledger=recordPilotSupplyEvent(ledger,time,{enemyKills:12000,bossKills:20,shopPurchases:5,boxesOpened:100,staminaSpent:500});
for(const task of snapshot().week.tasks.filter(row=>row.canClaim))claim('weeklyTask',task.id);
assert.equal(snapshot().week.points,100);const before={...inventory.items};
for(const step of [20,40,60,80,100])claim('weekly',step);
assert.equal(inventory.items[105]-before[105],200);assert.equal(inventory.items[801]-before[801],50);assert.equal(inventory.items[2]-before[2],100);assert.equal(inventory.items[112],2);
const rollback=pilotSupplySnapshot(ledger,inventory,progression,time-86400000,campaign);assert(rollback.clockRollback);assert.equal(rollback.activity.canClaim,false);assert.equal(rollback.week.canClaim,false);
const corePlan=planPilotSupply(progression,inventory,ledger,{action:'growth',period:'daily',id:0,expectedRevision:inventory.revision},time,{campaign:{clearedChapterIds:[1,2,3,8,10]}});
assert.equal(corePlan.inventory.items[135],1);assert.equal(corePlan.inventory.items[903]||0,0);assert.equal(corePlan.inventory.items[934]||0,0);
assert.deepEqual(Object.entries(corePlan.inventory.items).filter(([id])=>id!=='135'),Object.entries(inventory.items));
let input={ledger:flightLedger(),inventory:{version:1,revision:0,items:{}},progression:createReplicaProgression(),campaign,time};
for(let day=1;day<=21;day++){input={...input,...planFlightReward(input,{action:'signin',revision:input.inventory.revision},()=>0)};assert.throws(()=>planFlightReward(input,{action:'signin',revision:input.inventory.revision}));input.time+=86400000;}
assert.equal(input.inventory.items[934],2);assert.equal(input.inventory.items[135],1);assert.equal(input.inventory.items[112],7);assert.equal(input.inventory.items[113],6);assert.equal(input.inventory.items[2],1200);
assert.equal(input.progression.pilots.filter(row=>row.active).length,0);assert(input.progression.skins.some(row=>row.active&&row.id===10101));
const historical=flightLedger({version:1,chapters:[],signCount:7,signDay:'2026-11-01',starterPending:false,adDay:'',misses:0,total:0,history:[],signinPolicy:'project-signin-aircraft-v3'});
assert.deepEqual(historical.signinHistory[6].rewards,previousAircraftSigninRewards(7));
const old=JSON.stringify(historical.signinHistory);const next=planFlightReward({ledger:historical,inventory:{version:1,revision:0,items:{}},progression:createReplicaProgression(),campaign,time},{action:'signin',revision:0});
assert.equal(next.inventory.items[1],10000);assert.equal(JSON.stringify(next.ledger.signinHistory.slice(0,7)),old);
console.log('Recurring rewards checks passed: native daily/weekly objectives and amounts, approved replacements, 21 sign-ins, legacy receipts, duplicate claims and clock rollback.');
