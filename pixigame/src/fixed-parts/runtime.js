import { DEMO_SLOTS, ITEM_BY_ID } from '../slot-demo/catalog.js';
import { FITTING_AIRCRAFT, restoreAircraftFittings } from '../slot-demo/aircraft-slots.js';
import { createHitCharge } from './hit-charge.js';
import { isFixedPartReleased } from './released-catalog.js';
import { createFixedGrowth } from './growth.js';
import { createDerivedBudget } from './derived-budget.js';
import { FIXED_PARTS } from './parts.js';
import { createFixedMarks } from './marks.js';
import { createFixedRays } from './rays.js';
import { FIXED_WEAPON_PROFILES, ORIGINAL_VIEW_HEIGHT } from './weapon-profiles.js';
import { resolveFixedConnections } from './connections.js';
import { guideFiniteRocket } from './finite-guidance.js';
import { createFixedBlasts } from './blasts.js';
import { applyOriginalHoming } from './pathogenic-rules.js';
import { energyInterval, energyShot } from './energy-profiles.js';
import { createEnergyAttacks } from './energy-attacks.js';
import { compileAirframeLoadout } from './airframe-arsenal.js';
import { createAirframeCombat } from './airframe-combat.js';
import { sanitizeWeaponProgress } from './common-weapon-progress.js';

export const FITTINGS_STORAGE_KEY = 'thunder-slot-demo-v1';
export const BASIC_FIXED_PRESET = Object.freeze({ twin: ['W1', 'W2'], capacitor: ['C1'] });
export const RAIL_FIXED_PRESET = Object.freeze({ rail: ['W1', 'W2'], focus: ['C1'] });
export const MIXED_FIXED_PRESET = Object.freeze({ twin: ['W1','W2'],capacitor:['C1'],rail:['W3','W4'],focus:['C2'] });
export const MISSILE_FIXED_PRESET = Object.freeze({missile:['W1','W2'],bridge:['C1'],focus:['C2']});
export const FULL_FIXED_PRESET = Object.freeze({twin:['W1','W2'],missile:['W3','W4'],rail:['W5','W6'],capacitor:['C1'],bridge:['C2'],focus:['C3']});
export const PRISM_FIXED_PRESET = Object.freeze({prism:['W1','W2'],capacitor:['C1']});
export const TESLA_FIXED_PRESET = Object.freeze({tesla:['W1','W2'],focus:['C1']});
export const ENERGY_FIXED_PRESET = Object.freeze({prism:['W1','W2'],tesla:['W3','W4'],capacitor:['C1'],bridge:['C2'],focus:['C3']});
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

export function compileFixedLoadout(pilotId, saved) {
  if (!FITTING_AIRCRAFT.some(a => a.pilotId === pilotId)) throw Error('出战机型没有固定件挂点');
  const placements = restoreAircraftFittings(saved)[pilotId];
  if (!placements) throw Error('请为出战机型保存装配，可使用“机炮＋储能”快速装配');
  const unsupported = Object.keys(placements).filter(id => !isFixedPartReleased(id));
  if (unsupported.length) throw Error(`基础试玩暂未开放：${unsupported.map(id => ITEM_BY_ID.get(id).name).join('、')}`);
  const graph = Object.fromEntries(DEMO_SLOTS.map(s => [s.id, new Set()]));
  for (const slot of DEMO_SLOTS) for (const id of slot.adjacent || []) {
    graph[slot.id].add(id); graph[id].add(slot.id);
  }
  const instances = Object.entries(placements).map(([itemId, slots]) => ({
    id: `${pilotId}/${itemId}`, itemId, kind: ITEM_BY_ID.get(itemId).kind, slots: [...slots],
  }));
  const weapons = instances.filter(i => i.kind === 'weapon');
  if (!weapons.length) throw Error('至少安装一件武器，可使用“机炮＋储能”快速装配');
  const connectors = resolveFixedConnections(instances,graph);
  return freeze({ version: 1, pilotId, placements: structuredClone(placements), weapons, connectors,
    graph: Object.fromEntries(Object.entries(graph).map(([id, edges]) => [id, [...edges].sort()])) });
}

export function readFixedLoadout(pilotId, storage) {
  let saved;
  try { saved = JSON.parse(storage.getItem(FITTINGS_STORAGE_KEY)); }
  catch { throw Error('装配存档暂不可读取，请回固定件页重新保存'); }
  let collection;try{collection=JSON.parse(storage.getItem('thunder-gacha-v1'));}catch{collection=null;}
  const progress=sanitizeWeaponProgress(collection?.weaponProgress);
  const placements=Object.fromEntries(Object.entries(restoreAircraftFittings(saved)[pilotId]||{}).filter(([id])=>progress.weapons[id]?.unlocked));
  const equipped=collection?.equipment?.primaryWeaponId?.replace(/^weapon:/,'');
  if(progress.weapons[equipped]?.unlocked){for(const [id,slots] of Object.entries(placements))if(slots.includes('W1'))delete placements[id];placements[equipped]=['W1','W2'];}
  const loadout=compileAirframeLoadout(pilotId,placements);
  loadout.weapons=loadout.weapons.map(w=>({...w,...progress.weapons[w.itemId]}));
  return loadout;
}

let nextRun = 0;
export function createFixedCombat(loadout, { random = Math.random } = {}) {
  if (loadout.version === 3) return createAirframeCombat(loadout, { random });
  const runId = `fixed-${++nextRun}`;
  const meter = createHitCharge(loadout.connectors.filter(c=>c.itemId==='capacitor'));
  let growth=createFixedGrowth(loadout,runId,Math.floor(Math.random()*0x100000000));
  const derived=createDerivedBudget(runId), marks=createFixedMarks(), aim=new Map(), rays=createFixedRays(derived);
  const blasts=createFixedBlasts(derived),rocketBoost=new Set();
  const bridgeLinks=loadout.connectors.filter(c=>c.active&&c.itemId==='bridge');
  const bridgeRounds=new Map();
  const forwardedBoost=(connector,weaponId)=>connector.routes?.some(r=>r.weaponId===weaponId&&hasNode(r.bridgeId,'C04','S'));
  const focusLinks=loadout.connectors.filter(c=>c.active&&c.itemId==='focus');
  const focusState=Object.fromEntries(focusLinks.map(c=>[c.id,{targetId:null,procs:0,streaks:new Map(),boostTarget:null,boostUntil:0}]));
  let world={targets:[],origin:{x:300,y:1000},height:1300}, worldEvents=[];
  let lastOrigin=null, velocity={x:0,y:0};
  const hasNode=(id,part,key)=>(growth.state.nodes[id]||[]).includes(`FP-${part}-${key}`);
  const sameSegment=(a,b)=>a.slots.some(s=>b.slots.some(t=>Math.ceil(Number(s.slice(1))/2)===Math.ceil(Number(t.slice(1))/2)));
  function refreshFocus(time){
    for(const c of focusLinks){const f=focusState[c.id];
      const legal=world.targets.slice(0,50).filter(t=>!t.dead);
      legal.sort((a,b)=>Math.hypot(a.x-world.origin.x,a.y-world.origin.y)-Math.hypot(b.x-world.origin.x,b.y-world.origin.y));
      f.targetId=legal[0]?.id??null;
      for(const [id,s] of f.streaks)if(!world.targets.some(t=>t.id===id)||time-s.time>6)f.streaks.delete(id);
    }
  }
  const state = { runId, time: 0, groups: 0, shots: 0, hits: 0, pulses: 0, damage: 0, kills: 0, effects: {},
    byWeapon: Object.fromEntries(loadout.weapons.map(w => [w.id, { hits: 0, damage: 0, kills: 0 }])), charge: meter.state, focus:focusState };
  const weaponClocks = loadout.weapons.map(w => ({ weapon: w, lastAt:-1,nextAt:FIXED_WEAPON_PROFILES[w.itemId].interval-1, streak:0, queue:[] }));
  const groups = new Map();
  const energy=createEnergyAttacks({derived,random,onEmit:source=>groups.get(source.groupId)?.emitted.add(source.projectileId)});
  let pending = [], disposed = false;
  return {
    loadout, state, get growth(){return growth;}, get velocity(){return velocity;},
    restoreGrowth(checkpoint){if(disposed||!growth.restore(checkpoint))return false;growth=createFixedGrowth(loadout,runId,1,checkpoint);return true;},
    syncBuild(){meter.configure(growth.state.nodes);},
    step(dt, { hasTargets, paused = false, targets, origin, height } = {}) {
      if (disposed || paused || !(dt > 0)) return [];
      // Tab suspension does not create a backlog of free fire.
      const end = state.time + Math.min(dt, .05);
      if(origin){
        velocity=lastOrigin?{x:(origin.x-lastOrigin.x)/Math.min(dt,.05),y:(origin.y-lastOrigin.y)/Math.min(dt,.05)}:{x:0,y:0};
        lastOrigin={x:origin.x,y:origin.y};
      }
      growth.tick(Math.min(dt,.05),hasTargets);meter.configure(growth.state.nodes);
      meter.tick(state.time,end);
      if(targets)world={targets,origin:origin||world.origin,height:height||world.height};
      marks.expire(end);refreshFocus(end);
      worldEvents.push(...rays.step(end,world.targets),...blasts.step(end,world.targets),...energy.step(end,world.targets));
      for(const clock of weaponClocks)while(clock.queue.length){
        const group=groups.get(clock.queue[0]);
        if(group&&!group.hitProjectiles.size&&end-group.time<=1.2)break;
        clock.queue.shift();clock.streak=group?.hitProjectiles.size?clock.streak+1:0;
      }
      if (!hasTargets) {
        pending = [];
        weaponClocks.forEach(w => { w.lastAt=Math.max(w.lastAt,end-FIXED_WEAPON_PROFILES[w.weapon.itemId].interval); });
      } else for (const clock of weaponClocks) {
        const part=FIXED_PARTS[clock.weapon.itemId].part;
        const fast=hasNode(clock.weapon.id,part,'S1');
        const charge=meter.chargeFor(clock.weapon.id);
        const activeTactic=growth.state.tactics[clock.weapon.id]?.id;
        const isEnergy=['prism','tesla'].includes(clock.weapon.itemId);
        const interval=isEnergy?energyInterval(clock.weapon.itemId,k=>hasNode(clock.weapon.id,part,k),activeTactic?.split('-').at(-1),charge,clock.jitter||0)
          :clock.weapon.itemId==='missile'?(fast?1.45:1.7)*(activeTactic==='FP-W04-T4'?.75:1)/(1+.3*charge)
          :clock.weapon.itemId==='rail'?(fast?2.2:2.5)*(activeTactic==='FP-W02-T1'?.75:1)/(1+.3*charge)
          :(fast?1.14:1.3)*(activeTactic==='FP-W01-T1'?.8:1);
        clock.nextAt=clock.lastAt+interval;
        if(clock.weapon.itemId==='rail'&&activeTactic==='FP-W02-T1'&&clock.lastTactic!==activeTactic){
          clock.nextAt=Math.min(clock.nextAt,end);clock.lastAt=clock.nextAt-interval;
        }
        clock.lastTactic=activeTactic;
        while (clock.nextAt <= end + 1e-9) {
          const time = Math.max(clock.nextAt,state.time), weapon = clock.weapon;
          const groupId = `${runId}/${++state.groups}`;
          const part=FIXED_PARTS[weapon.itemId].part,rail=weapon.itemId==='rail';
          const profile=FIXED_WEAPON_PROFILES[weapon.itemId];
          const nodes=growth.state.nodes[weapon.id]||[],has=k=>nodes.includes(`FP-${part}-${k}`),tactic=growth.state.tactics[weapon.id]?.id.split('-').at(-1);
          const shotCount=rail||isEnergy||weapon.itemId==='missile'?1:profile.shots+Math.round(charge),multiplier=1,pulse=rail||isEnergy?charge>0:shotCount>profile.shots;
          if(pulse)state.pulses++;
          const calibrated=weapon.itemId==='twin'&&has('A1')&&clock.streak>=3;if(calibrated)clock.streak=0;
          groups.set(groupId, { time, weaponId: weapon.id, hitProjectiles: new Set(), emitted: new Set(), resolved: new Set(),
            weapon,part,calibrated,a1:has('A1'),a2:has('A2'),b2:has('B2'),slots:weapon.slots.length,tactic,hits:new Map(),details:new Map(),effected:new Set() });
          clock.queue.push(groupId);
          if(isEnergy){
            clock.round=(clock.round||0)+1;
            for(const slotId of weapon.slots)pending.push({...energyShot(weapon.itemId,has,tactic,clock.round,world.height,random),at:time,slotId,barrel:0,pulse,
              source:{runId,groupId,weaponId:weapon.id,projectileId:`${groupId}/${slotId}/0`,kind:'root',depth:0,barrel:0}});
            clock.jitter=weapon.itemId==='tesla'?random()*.25:0;
            clock.lastAt=time;clock.nextAt=time+energyInterval(weapon.itemId,has,tactic,charge,clock.jitter);continue;
          }
          if(weapon.itemId==='missile'){
            const boost=rocketBoost.delete(weapon.id),damageScale=tactic==='T1'||tactic==='T4'?.8:tactic==='T2'?.75:tactic==='T3'?1.3:1;
            for(const slotId of weapon.slots)pending.push({at:time,slotId,barrel:state.groups%6,missile:true,tactic,damage:1,blastDamage:280*damageScale,expiryDamage:300*damageScale,
              blastRadius:270*world.height/ORIGINAL_VIEW_HEIGHT*(has('S2')?1.2:1)*(tactic==='T2'?1.35:tactic==='T3'?.75:1),
              tracking:has('A1'),retarget:has('A2'),echo:has('B1'),doubleEcho:has('B2'),pulse,penetration:0,bounces:0,bossMultiplier:1,
              life:3,speedRatio:profile.speedRatio*(tactic==='T1'?1.35:1)*(boost?1.3:1),radius:42*world.height/ORIGINAL_VIEW_HEIGHT,mass:.8,restitution:1,
              source:{runId,groupId,weaponId:weapon.id,projectileId:`${groupId}/${slotId}/0`,kind:'root',depth:0,barrel:0}});
            clock.lastAt=time;clock.nextAt=time+interval;continue;
          }
          if(rail){
            for(const slotId of weapon.slots){
              const source={runId,groupId,weaponId:weapon.id,projectileId:`${groupId}/${slotId}/0`,kind:'root',depth:0,barrel:0};
              const baseDamage=profile.damage*multiplier*(tactic==='T1'?.8:1);
              const shot={at:time,slotId,barrel:0,damage:baseDamage,baseDamage,slots:weapon.slots.length,pulse,rail:true,tactic,
                penetration:has('A2')?4:0,bounces:profile.bounces+(tactic==='T4'?1:0),bossMultiplier:1,life:profile.life,speedRatio:profile.speedRatio,radius:profile.radius*world.height/ORIGINAL_VIEW_HEIGHT*(has('S2')?1.2:1)*(tactic==='T2'?1.5:1),mass:profile.mass,restitution:profile.restitution,
                attenuation:1,firstMultiplier:tactic==='T3'?1.25:tactic==='T4'?.8:1,laterMultiplier:tactic==='T3'?.75:1,
                aftershock:has('A2'),trail:has('C1'),lock:has('C2'),source};
              pending.push(shot);
            }
            clock.lastAt=time;clock.nextAt=time+interval;
            continue;
          }
          for (const slotId of weapon.slots) for (let shotIndex = 0; shotIndex < shotCount; shotIndex++) {
            const barrel=shotIndex%2;
            const penetration=calibrated?(has('A2')?2:shotIndex===0?1:0):0;
            const tacticDamage=tactic==='T1'?.85:tactic==='T2'&&!penetration?.9:tactic==='T4'?(shotIndex===0?.7:shotIndex===shotCount-1?1.4:1):1;
            pending.push({ at: time + shotIndex * profile.shotGap, slotId, barrel, shotIndex, damage: profile.damage * multiplier * tacticDamage, pulse,
              spread:(random()*2-1)*profile.spreadDegrees*Math.PI/180,
              calibrated,cross:has('B1'),tactic,penetration,bossMultiplier:tactic==='T2'&&penetration?.9:1,
              life:profile.life/(has('S2')?1.2:1),speedRatio:profile.speedRatio*(has('S2')?1.2:1),radius:profile.radius*world.height/ORIGINAL_VIEW_HEIGHT*(tactic==='T3'?.8:1),mass:profile.mass,restitution:profile.restitution,attenuation:.65*(tactic==='T2'?.7:1),
              source: { runId, groupId, weaponId: weapon.id, projectileId: `${groupId}/${slotId}/${shotIndex}`, kind: 'root',depth:0,barrel } });
          }
          clock.lastAt=time;clock.nextAt=time+interval;
        }
      }
      const ready = [], later = [];
      for (const shot of pending) {
        if (shot.at <= end + 1e-9) {
          ready.push({ ...shot, firstStep: Math.max(0, end - shot.at) });
          groups.get(shot.source.groupId)?.emitted.add(shot.source.projectileId); state.shots++;
        } else later.push(shot);
      }
      pending = later; state.time = end;
      for (const [id, group] of groups) if (end - group.time > 5) groups.delete(id);
      return ready;
    },
    hit(source, targetId = '', details = {}) {
      const group = groups.get(source?.groupId);
      const key=`${source?.projectileId}/${targetId}/${source?.contactId||0}`;
      if (source?.runId !== runId || source.kind !== 'root' || !group || source.weaponId !== group.weaponId
        || !group.emitted.has(source.projectileId) || group.hitProjectiles.has(key)) return false;
      group.hitProjectiles.add(key); state.hits++;
      group.details.set(key,details);
      marks.begin(key,source,targetId,state.time,mark=>{
        if(mark.type==='perforation')return group.part==='W01'&&group.a2&&mark.ownerId===group.weaponId;
        if(mark.type==='rail-hole')return sameSegment(group.weapon,mark.weapon);
        if(mark.type==='bridge-mark')return bridgeLinks.some(c=>c.id===mark.ownerId&&c.beneficiaries.includes(source.weaponId));
        return mark.type==='focus-weak'&&focusLinks.some(c=>c.id===mark.ownerId&&c.beneficiaries.includes(source.weaponId));
      });
      const hits=group.hits.get(targetId)||[];hits.push({barrel:source.barrel,time:state.time});group.hits.set(targetId,hits);
      state.byWeapon[group.weaponId].hits++;
      if(details.shouldTrigger!==false)meter.credit(source, state.time,c=>forwardedBoost(c,source.weaponId)?1.5:1);
      return true;
    },
    resolveHit(source, damage, killed, targetId = '') {
      const group = groups.get(source?.groupId);
      const key=`${source?.projectileId}/${targetId}/${source?.contactId||0}`;
      if (source?.runId !== runId || !group?.hitProjectiles.has(key) || group.resolved.has(key)) return;
      group.resolved.add(key);
      const result = state.byWeapon[group.weaponId], actual = Math.max(0, damage);
      state.damage += actual; result.damage += actual;
      if (killed) { state.kills++; result.kills++;if(group.part==='W04'&&group.a2)rocketBoost.add(group.weaponId); }
    },
    effects(source,targetId) {
      const group=groups.get(source.groupId);if(!group||source.kind!=='root')return [];
      const key=`${source.projectileId}/${targetId}/${source.contactId||0}`;
      if(!group.hitProjectiles.has(key)||group.effected.has(key))return [];
      group.effected.add(key);
      const result=[],budget=FIXED_WEAPON_PROFILES.twin.damage*group.slots,details=group.details.get(key)||{},taken=marks.finish(key);
      result.push(...energy.onHit(source,targetId,details,state.time,world.targets));
      for(const mark of taken){
        let damage=mark.damage;
        if(mark.type==='bridge-mark'){
          damage=(details.damage||FIXED_WEAPON_PROFILES[group.weapon.itemId].damage)*.15;
          if(hasNode(mark.ownerId,'C04','A2'))blasts.add(source,{key:`bridge-mark-blast/${mark.ownerId}`,x:details.x,y:details.y,radius:world.height*.06,damage:damage*2,at:state.time+1/60,color:0x89dfff});
        }
        if(mark.type==='focus-weak'){
          const f=focusState[mark.ownerId];f.procs++;
          const advanced=hasNode(mark.ownerId,'C03','A2');
          damage=(details.damage||FIXED_WEAPON_PROFILES[group.weapon.itemId].damage)*group.slots*(advanced&&f.procs%3===0?.25:.1);
          if(advanced){f.boostTarget=targetId;f.boostUntil=state.time+.8;}
        }
        const effect=derived.create(source,mark.type,targetId,damage,damage,state.time);
        if(effect){if(mark.type==='rail-hole')effect.source.weaponId=mark.weapon.id;result.push(effect);}
      }
      if(group.part==='W01'&&group.a2&&group.calibrated)marks.put(`w01/${group.weaponId}/${targetId}`,{type:'perforation',targetId,ownerId:group.weaponId,groupId:source.groupId,until:state.time+1.6,damage:budget*.4*(group.tactic==='T2'?.7:1)});
      if(group.part==='W02'&&group.a1)marks.put(`rail/${group.weaponId}/${targetId}`,{type:'rail-hole',targetId,weapon:group.weapon,groupId:source.groupId,until:state.time+3,damage:5*group.slots});
      const hits=group.hits.get(targetId)||[];
      if(group.part==='W01'&&group.b2&&hits.some(a=>hits.some(b=>a.barrel!==b.barrel&&Math.abs(a.time-b.time)<=.18+1e-9))){
        const event=derived.create(source,'pincer',targetId,budget*.8,budget*.8,state.time);if(event)result.push(event);
      }
      for(const c of focusLinks.filter(c=>c.beneficiaries.includes(source.weaponId))){
        const f=focusState[c.id];
        if(hasNode(c.id,'C03','A1')){
          const streak=f.streaks.get(targetId)||{count:0,groupId:null};f.streaks.set(targetId,streak);streak.time=state.time;
          if(streak.groupId!==source.groupId){streak.groupId=source.groupId;
          if(!taken.some(m=>m.type==='focus-weak'&&m.ownerId===c.id)&&++streak.count>=2){
            streak.count=0;marks.put(`focus/${c.id}/${targetId}`,{type:'focus-weak',targetId,ownerId:c.id,groupId:source.groupId,until:state.time+3});
          }
          }
        }
        if(hasNode(c.id,'C03','B2')&&!group.firstContact&&details.distance>world.height*.4){
          rays.beam(source,details,details.angle||0,world.height,(details.damage||FIXED_WEAPON_PROFILES[group.weapon.itemId].damage)*group.slots*.2,state.time);
        }
      }
      if(group.part==='W02'&&group.tactic==='T4'&&details.boss&&!group.bossWeak){
        group.bossWeak=true;rays.boss(source,targetId,12*group.slots,state.time);
      }
      for(const c of bridgeLinks.filter(c=>c.beneficiaries.includes(source.weaponId))){
        const key=`bridge-first/${c.id}`;if(group.effected.has(key))continue;group.effected.add(key);
        if(hasNode(c.id,'C04','A1'))marks.put(`bridge/${c.id}/${targetId}`,{type:'bridge-mark',targetId,ownerId:c.id,groupId:source.groupId,until:state.time+3});
        if(hasNode(c.id,'C04','B1')){
          const count=(bridgeRounds.get(c.id)||0)+1;bridgeRounds.set(c.id,count);
          if(count%3===0){const strong=hasNode(c.id,'C04','B2');blasts.add(source,{key:`bridge-echo/${c.id}`,x:details.x,y:details.y,radius:world.height*(strong?.08:.04),damage:(details.damage||FIXED_WEAPON_PROFILES[group.weapon.itemId].damage)*(strong?.35:.2),at:state.time+.25,color:0x89dfff});}
        }
      }
      group.firstContact=true;
      return result;
    },
    recordDerived(event,damage,killed){if(event?.source.runId!==runId||event.source.kind!=='derived')return;
      state.effects[event.source.module]=(state.effects[event.source.module]||0)+1;
      const stats=state.byWeapon[event.source.weaponId];stats.damage+=damage;state.damage+=damage;if(killed){stats.kills++;state.kills++;}},
    forgetTarget(id){marks.forget(id);for(const f of Object.values(focusState))f.streaks.delete(id);},
    launch(shot,muzzle,angle,height){
      if(shot.rail)rays.launch(shot,muzzle,angle,height,shot.at,world.targets);
      if(shot.energy){
        let power=0;
        const target=[...world.targets].filter(t=>!t.dead).slice(0,50).sort((a,b)=>Math.hypot(a.x-muzzle.x,a.y-muzzle.y)-Math.hypot(b.x-muzzle.x,b.y-muzzle.y))[0];
        for(const c of focusLinks.filter(c=>c.beneficiaries.includes(shot.source.weaponId))){
          const charge=loadout.connectors.filter(x=>x.itemId==='capacitor'&&x.active&&(loadout.graph[c.slots[0]].includes(x.slots[0])||bridgeLinks.some(b=>loadout.graph[b.slots[0]].includes(c.slots[0])&&loadout.graph[b.slots[0]].includes(x.slots[0])))).reduce((q,x)=>q+meter.state[x.id].value,0);
          let strength=110*(1+.5*charge)*(hasNode(c.id,'C03','S')?1.25:1)*(forwardedBoost(c,shot.source.weaponId)?1.25:1);
          if(target&&hasNode(c.id,'C03','B1')&&Math.hypot(target.x-muzzle.x,target.y-muzzle.y)>height*.4)strength*=1.5;
          const f=focusState[c.id];if(f.boostUntil>state.time&&f.boostTarget===target?.id)strength*=1.4;
          power+=strength;
        }
        energy.launch(shot,muzzle,angle,shot.at,power);
      }
    },
    bounce(source,x,y,angle){rays.bounce(source,x,y,angle,state.time,world.targets);state.bounces=(state.bounces||0)+1;},
    bend(source,x,y,angle){rays.bounce(source,x,y,angle,state.time,world.targets);},
    chargeFor(weaponId){return meter.chargeFor(weaponId);},
    guides(weaponId){return focusLinks.some(c=>c.beneficiaries.includes(weaponId));},
    guide(b,targets,height){
      if(b.fixedNormalize){const speed=Math.hypot(b.vx,b.vy),factor=speed?(b.fixedSpeed||speed)/speed:0;b.vx*=factor;b.vy*=factor;b.fixedNormalize=false;}
      guideFiniteRocket(b,targets,height);
      if(!b.fixedGuided)return;
      const legal=targets.filter(t=>!t.dead).slice(0,50);
      legal.sort((a,c)=>(a.x-b.x)**2+(a.y-b.y)**2-(c.x-b.x)**2-(c.y-b.y)**2);
      const target=legal[0];if(!target){b.fixedGuided=false;return;}
      const scale=height/ORIGINAL_VIEW_HEIGHT;
      for(const c of focusLinks.filter(c=>c.beneficiaries.includes(b.fixedSource.weaponId))){
        let power=(hasNode(c.id,'C03','S')?1.25:1)*(forwardedBoost(c,b.fixedSource.weaponId)?1.25:1);
        if(hasNode(c.id,'C03','B1')&&Math.hypot(target.x-b.x,target.y-b.y)>height*.4)power*=1.5;
        const f=focusState[c.id];f.targetId=target.fixedTargetId??target.id;
        if(f.boostUntil>state.time&&f.boostTarget===f.targetId)power*=1.4;
        // Connections carry energy only along actual adjacent connector edges.
        const charge=loadout.connectors.filter(x=>x.itemId==='capacitor'&&x.active&&(loadout.graph[c.slots[0]].includes(x.slots[0])||bridgeLinks.some(b=>loadout.graph[b.slots[0]].includes(c.slots[0])&&loadout.graph[b.slots[0]].includes(x.slots[0])))).reduce((q,x)=>q+meter.state[x.id].value,0);
        const original={x:b.x/scale,y:b.y/scale,vx:b.vx/scale,vy:b.vy/scale,mass:b.mass};
        applyOriginalHoming(original,{x:target.x/scale,y:target.y/scale},0,charge,power);
        b.vx=original.vx*scale;b.vy=original.vy*scale;
      }
    },
    advance(source,x,y,hitIds,ended){rays.advance(source,x,y,hitIds,ended,state.time);},
    takeWorldEffects(){const events=worldEvents;worldEvents=[];return events;},
    visuals(){return rays.visuals(state.time);},
    blastVisuals(){return blasts.visuals(state.time);},
    energyVisuals(){return energy.visuals(state.time);},
    energyCounts(){return energy.counts();},
    explode(shot,x,y,expired=false){
      const group=groups.get(shot.source?.groupId);
      if(disposed||!shot.missile||!group?.emitted.has(shot.source.projectileId))return false;
      const damage=expired?shot.expiryDamage:shot.blastDamage,at=state.time+4/60;
      if(!blasts.add(shot.source,{key:'rocket',x,y,radius:shot.blastRadius,damage,at,root:true}))return false;
      if(shot.echo)blasts.add(shot.source,{key:`rocket-echo/${shot.slotId}`,x,y,radius:shot.blastRadius,damage:damage*.25,at:at+.35});
      if(shot.doubleEcho)blasts.add(shot.source,{key:`rocket-second/${shot.slotId}`,x,y,radius:shot.blastRadius*1.35,damage:damage*.35,at:at+.65});
      return true;
    },
    direction(shot,muzzle,origin,height) {
      if(shot.energy)return shot.spread;
      if(shot.missile)return 0;
      const burstKey=`${shot.source.groupId}/${shot.slotId}/burst`;
      if(shot.shotIndex>0&&!shot.cross&&!['T2','T3'].includes(shot.tactic)&&aim.has(burstKey))return aim.get(burstKey).angle+(shot.spread||0);
      const key=`${shot.slotId}/${shot.barrel}`,previous=aim.get(key)||{angle:0,time:state.time-.5};
      let angle=0;
      if(shot.cross){const desired=Math.atan2(origin.x-muzzle.x,muzzle.y-(origin.y-height*.35));
        const limit=Math.PI/4*Math.max(0,state.time-previous.time);angle=previous.angle+Math.max(-limit,Math.min(limit,desired-previous.angle));}
      if(!shot.rail&&shot.tactic==='T2')angle+=(shot.barrel===0?-1:1)*Math.PI/36;
      if(!shot.rail&&shot.tactic==='T3'){const desired=Math.atan2(origin.x-muzzle.x,muzzle.y-(origin.y-height*.28));angle+=Math.max(-Math.PI*8/180,Math.min(Math.PI*8/180,desired-angle));}
      for(const [id,value] of aim)if(state.time-value.time>4)aim.delete(id);
      aim.set(key,{angle,time:state.time});
      if(shot.shotIndex===0)aim.set(burstKey,{angle,time:state.time});
      return angle+(shot.spread||0);
    },
    dispose() { disposed = true; pending = [];worldEvents=[];energy.clear();blasts.clear();rocketBoost.clear();bridgeRounds.clear();rays.clear(); groups.clear(); marks.clear();aim.clear();derived.clear();weaponClocks.length = 0; meter.dispose();growth.end();for(const f of Object.values(focusState)){f.targetId=null;f.streaks.clear();} },
  };
}

// Swept collision: return first contact, including when a fast shot crosses a
// small target between frames. The caller selects the nearest hit along the ray.
export function segmentCircleHit(x1, y1, x2, y2, cx, cy, radius) {
  const dx = x2 - x1, dy = y2 - y1, ox = x1 - cx, oy = y1 - cy;
  const c = ox * ox + oy * oy - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (!a) return null;
  const b = 2 * (ox * dx + oy * dy), disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : null;
}
