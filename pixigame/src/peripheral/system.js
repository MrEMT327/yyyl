import { createPeripheralSaveGuard } from './save-guard.js';
import {localFailureCount,recordLocalFailureProtection,LOCAL_FAILURE_PROTECTION_VERSION} from '../replica/local-failure-protection.js';
import {planNativeStarterItems,NATIVE_INITIAL_STAMINA} from '../replica/native-starter-items.js';
import {planNativeStarterCore} from '../replica/native-starter-core.js';
import {normalizeOnboarding, completeGuide, guideFinished, nextLobbyGuide} from './onboarding.js';
import { backpackUseRule, planBackpackUse } from '../replica/native-backpack-use.js';
import { nativeStarRewardSnapshot, planNativeStarClaim } from '../replica/native-star-rewards.js';
import { nativeAchievementSnapshot } from '../replica/native-achievements.js';
import { BATTLE_MATERIAL_POLICY, battleMaterialSnapshot, prepareBattleMaterialRewards } from '../replica/battle-material-rewards.js';
import { planNativeSettlement } from '../replica/native-settlement.js';
import { assessReplicaBattle, countStars as countReplicaStars } from '../replica/native-battle-rating.js';
import { nativeEconomyView, NATIVE_PENDING_ECONOMY_ACTIONS, NATIVE_PENDING_ECONOMY_MESSAGE } from '../replica/native-economy-availability.js';
import { flightDay, flightLedger, flightRewardsSnapshot, planFlightReward, flightRewardView } from '../replica/flight-rewards.js';
import { REPLICA_WALLET_SOURCE, REPLICA_RESOURCE_IDS, replicaResourceWallet, applyReplicaResourceReceipt } from '../replica/native-resource-wallet.js';
import { NATIVE_AIRCRAFT_SKINS } from '../replica/native-aircraft-skins.js';
import { NATIVE_PILOT_SKINS } from '../replica/native-pilot-roster.js';
import { nativeAcquisitionSnapshot, planNativeAcquisition } from '../replica/native-acquisition.js';
import { replicaGearSnapshot, planReplicaGear } from '../replica/native-equipment-economy.js';
import { createReplicaInventory, validateReplicaInventory, replicaCollectionSnapshot, planReplicaCollection, planNativeLabSynchronization } from '../replica/native-economy.js';
import { createReplicaProgression, selectReplicaProgression, validateReplicaProgression } from '../replica/native-progression.js';
import { replicaChapter, replicaChapterForStage, replicaCampaignProgress, replicaStageAccessible } from '../replica/chapter-contract.js';
import { createReplicaConfiguration, replicaConfigurationKey, validateReplicaConfiguration } from '../replica/loadout-contract.js';
import { AIRCRAFTS, getPilotState, selectPilot, grantPilotCopies } from '../pilots.js';
import {nativePlayerIdentity,nativePlayerRenameQuote,planNativePlayerRename} from '../replica/native-player-rename.js';
import { UNLIMITED_RESOURCES, DEVELOPMENT_BALANCE } from '../development-resources.js';
import { planDeveloperCurrency } from '../developer-tools.js';
import { prepareDevelopmentInventory } from '../replica/development-inventory.js';
import { prepareDevelopmentUnlocks } from '../replica/development-unlocks.js';
import { pilotSupplySnapshot, planPilotSupply, recordPilotSupplyBattle, recordPilotSupplyUpgrade, addPilotSupplyCredits } from '../replica/pilot-supply.js';
import { initializeSamplePatrol, samplePatrolSnapshot, planSamplePatrol } from '../replica/sample-patrol.js';
import { COMMON_WEAPONS, commonWeaponStats } from '../fixed-parts/common-weapons.js';
import { weaponLevelCap, weaponLevelLimitMessage } from '../fixed-parts/weapon-progression-config.js';
import { getGachaState, transactPeripheralInventory } from '../gacha.js';
import { drawFromPool, grantItemToInventory } from '../gacha-engine.js';
import { GACHA_POOLS, GACHA_ITEM_MAP } from '../gacha-config.js';
// Legacy login state is read only for migration and durable-receipt recovery.
import { loadDailyLoginState, saveDailyLoginState } from '../daily-login.js';
import { createWorkshopSnapshot, synthesizeWorkshopWeapon, synthesizeWorkshopBatch } from './workshop.js';
import { nativeResearchSnapshot, planNativeResearch } from '../replica/native-research.js';
import { sanitizeResearch, researchModifiers } from './research.js';
import { createShopService } from './shop.js';
import { createStarRewardService, campaignStarTotals } from './star-rewards.js';
import { TASK_ACTIVITY, TASK_DESTINATIONS, activitySnapshot, achievementMetrics, achievementSnapshot } from './daily-progress.js';
import { sanitizeRecruitHistory, appendRecruitHistory } from './recruit-history.js';
import { fleetSkillSnapshot, mergePilotSkillModifiers, fleetCriticalModifiers } from './fleet-skills.js';
import { sanitizeFleetProgress, collectFleetRecruit, planFleetAction } from './fleet-progression.js';
import { pilotPassive, sanitizePilotStars, sanitizePilotRecruit, planPilotRecruit, PILOT_PITY, PILOT_DRAW_CHANCE, PILOT_SHARDS } from './pilot-growth.js';
import { RECRUIT_SINGLE_COST, RECRUIT_TEN_COST, PILOT_SSR_PITY, PILOT_UR_PITY, WEAPON_NEW_PITY, trailingRecruitMisses } from './recruit-tuning.js';
import { FIRST_CLEAR_WEAPON_PRIORITY, sortieMaterialReward } from './balance-tuning.js';
import { rateLoadoutPower } from './power-rating.js';
import { sanitizeGearState, gearTotals, grantGearSortie } from './equipment-system.js';
import { firstClearMaterialReward, taskRewardForStage } from './economy-config.js';
import { aircraftShardReserve } from './aircraft-shards.js';
import { aircraftGrowth, nextGrowthMilestone } from '../growth-tuning.js';
// Archived patrol state is preserved for migration, never used to make new grants.
import { createPatrolState } from './patrol.js';
import {
  PERIPHERAL_STORAGE_KEY, PERIPHERAL_BACKUP_KEY, GENERAL_SLOTS, PERIPHERAL_MAX_LEVEL,
  MAX_STAMINA, SORTIE_STAMINA, STAMINA_INTERVAL_MS, PERIPHERAL_AIRCRAFT,
  PERIPHERAL_AIRCRAFT_MAP, PERIPHERAL_PILOT_PASSIVES, aircraftUpgradeCost, peripheralWeaponUpgradeCost, DAILY_TASKS, WEEKLY_TASKS,
} from './config.js';

const integer = (v, min = 0, max = 1e9) => Math.min(max, Math.max(min, Math.floor(Number(v) || 0)));
const copy = value => structuredClone(value);
const read = (storage, key) => { try { return JSON.parse(storage?.getItem(key) || 'null'); } catch { return null; } };
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const dayKey = time => { const d = new Date(time); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const weekKey = time => { const d = new Date(time); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return dayKey(d.getTime()); };
const resourceNames = { coins: '金币', diamonds: '钻石', aircraftShards: '通用飞机碎片', weaponParts: '通用强化零件', stamina: '体力' };
const rewardItems = reward => Object.entries(reward).filter(([, amount]) => amount > 0).map(([type, amount]) => ({ type, amount, name: resourceNames[type] || type }));
const fitToken=(aircraftId,slots)=>JSON.stringify([aircraftId,...GENERAL_SLOTS.map(slot=>slots[slot]||null)]);

/** Keeps one physical slot per common weapon; reports every legacy relocation. */
export function migratePeripheralPlacements(placements = {}, isOwned = () => true) {
  const slots = Object.fromEntries(GENERAL_SLOTS.map(slot => [slot, null]));
  const changes = [];
  for (const [id, oldSlots] of Object.entries(placements || {})) {
    if (!COMMON_WEAPONS[id] || !Array.isArray(oldSlots) || !isOwned(id)) {
      changes.push({ itemId: id, previous: copy(oldSlots), action: 'archived', reason: '旧配件或尚未解锁；原始记录保留在备份' });
      continue;
    }
    const preferred = oldSlots.find(slot => GENERAL_SLOTS.includes(slot) && !slots[slot]);
    const target = preferred || GENERAL_SLOTS.find(slot => !slots[slot]);
    if (!target) {
      changes.push({ itemId: id, previous: copy(oldSlots), action: 'unequipped', reason: '四个通用挂点已满，武器仍在仓库' });
      continue;
    }
    slots[target] = id;
    if (oldSlots.length !== 1 || oldSlots[0] !== target) changes.push({ itemId: id, previous: copy(oldSlots), slot: target, action: 'single-slot' });
  }
  return { slots, changes };
}

export function compilePeripheralLoadout({ aircraftId, pilotId, pilotStars = 0, slots, aircraftLevel = 1, weaponProgress, research, pilotSkills = null, aircraftSkills = [], aircraftStars = 1, equipment = null }) {
  const aircraft = PERIPHERAL_AIRCRAFT_MAP.get(aircraftId);
  if (!aircraft) throw new Error('未知飞机');
  const base = { qualityRank: 0, level: 1, kind: 'weapon' };
  const innateProgress = weaponProgress?.weapons?.[aircraft.weaponId];
  const weapons = [{ ...base, level: innateProgress?.level ?? 1, qualityRank: innateProgress?.qualityRank ?? 0,
    id: `${aircraftId}/innate/${aircraft.weaponId}`, itemId: aircraft.weaponId,
    slots: ['W1', 'W2'], innate: true, role: 'innate' }];
  const used = new Set([aircraft.weaponId]);
  for (const slot of GENERAL_SLOTS) {
    const id = slots?.[slot], progress = weaponProgress?.weapons?.[id];
    if (!COMMON_WEAPONS[id] || !progress?.unlocked || used.has(id)) continue;
    used.add(id);
    weapons.push({ ...base, id: `${aircraftId}/common/${id}`, itemId: id, slots: [slot], innate: false,
      role: 'common', qualityRank: progress.qualityRank, level: progress.level });
  }
  const equippedAbilities=aircraftSkills.map(skill=>({id:skill.id,stars:skill.stars,ability:copy(skill.ability)})).filter(s=>s.ability);
  const pilotModifiers = mergePilotSkillModifiers([
    ...(pilotSkills===null?[{modifiers:pilotPassive(pilotId,pilotStars).modifiers}]:pilotSkills),
    {modifiers:fleetCriticalModifiers(equippedAbilities.map(s=>s.ability))},
  ]);
  const technology = researchModifiers(research);
  const baseGrowth=aircraftGrowth(aircraftLevel),starGrowth=aircraftGrowth(Math.max(1,aircraftStars));
  const airframeGrowth={attack:baseGrowth.attack*starGrowth.attack,hp:baseGrowth.hp*starGrowth.hp};
  const gearModifiers=equipment?gearTotals(equipment):{attack:0,hp:0,attackBonus:0,hpBonus:0,sources:[]};
  const attackMultiplier = (airframeGrowth.attack + gearModifiers.attack / aircraft.baseAttack) * (pilotModifiers.damageMultiplier || 1) * (1 + technology.attackBonus + gearModifiers.attackBonus);
  const maxHp = Math.round((aircraft.baseHp * airframeGrowth.hp + technology.hpFlat + gearModifiers.hp) * (1 + technology.hpBonus + gearModifiers.hpBonus) * (pilotModifiers.maxHpMultiplier || 1));
  // placements is a visual legacy adapter. Combat uses unique instance ids above.
  const placements = {};
  for (const weapon of weapons) (placements[weapon.itemId] ||= []).push(...weapon.slots);
  return { version: 3, peripheralVersion: 1, common: true, pilotId: aircraftId, characterId: pilotId,
    aircraftId, identity: { weapon: aircraft.weaponId, trait: 'common', traitName: '本机专武', ownerPilotId: aircraftId },
    weapons, placements, connectors: [], graph: {},
    statModifiers: { attackMultiplier, maxHp, hpMultiplier: maxHp / 100, pilotModifiers, aircraftAbilities:equippedAbilities, researchModifiers: technology, gearModifiers } };
}

/** Formal native inventory and progression; archived cloud records remain for skins and recovery. */
export function createPeripheralSystem({
  storage = globalThis.localStorage, profile, getCampaign = () => ({}), stages = [],
  saveProfile = () => {}, onChange = () => {}, selectStage = () => {}, getSelectedStage = () => 0,
  now = Date.now, rng = Math.random, playShopAd = null, playPatrolAd = null, canWrite = () => true,
  collectionApi = { get: getGachaState, transact: transactPeripheralInventory },
  pilotApi = { get: getPilotState, select: selectPilot, grant: grantPilotCopies },
} = {}) {
  if (!profile || typeof profile !== 'object') throw new Error('外围系统需要现有 profile 钱包');
  if(!canWrite())throw new Error('当前页面已停止运行，请重新进入游戏');
  let activeSortie = null, sortieSerial = 0, storageWarning = '', patrolAdBusy = false, patrolAdError = '', unsavedPatrolReward = null;
  let nativeDetails = null;
  let flightAdBusy = false, pendingFlightAd = null;
  const saveGuard = createPeripheralSaveGuard(storage, PERIPHERAL_STORAGE_KEY);
  let state;
  try { state = JSON.parse(saveGuard.initialRaw || 'null'); } catch { state = null; }
  const staleSaveMessage = '存档已在其他页面更新，请刷新当前页面后继续';
  function storageCurrent() {
    let allowed=false;
    try { allowed=canWrite(); } catch { /* Lost authority is read-only. */ }
    if(!allowed){storageWarning='当前页面已停止运行，请重新进入游戏';return false;}
    if (saveGuard.isCurrent()) return true;
    storageWarning = saveGuard.conflicted ? staleSaveMessage : '存档暂不可读取，请恢复存储后重新进入';
    return false;
  }
  const existingOnboardingSave = state?.version === 1;
  const currentTime = () => Number(now());
  const pilots = () => pilotApi.get();
  const temporaryPilots = () => pilots().temporaryUnlocked || [];
  let persistentPilotId = state?.pilotId || pilots().persistentSelected || pilots().selected;
  const serializeState = value => {
    const roster = pilots();
    return JSON.stringify(roster.temporaryUnlocked?.length && roster.persistentSelected
      ? { ...value, pilotId: persistentPilotId } : value);
  };
  const inventory = () => collectionApi.get();
  function writePeripheralState(next) {
    if (!storageCurrent()) return false;
    try {
      if (saveGuard.write(serializeState(next))) return true;
      storageWarning = saveGuard.conflicted ? staleSaveMessage : '设备暂不可保存，请恢复存储后重试';
    } catch { storageWarning = '设备暂不可保存，当前改动仅保留在本次会话'; }
    return false;
  }
  function persist() { return writePeripheralState(state); }
  function commit() { if(!persist())return false; saveProfile(); onChange(); return true; }
  function syncDay() {
    if (!storageCurrent()) return;
    if (state.dailyRewardReceipt || unsavedPatrolReward) return; // Settle the old period before resetting its claim records.
    const today = dayKey(currentTime());
    if (!state.daily || today > state.daily.date) {
      state.daily = { date: today, counters: { login: 1 }, claimed: [] };
      persist();
    }
    const week = weekKey(currentTime());
    if (!state.weekly || week > state.weekly.date) { state.weekly = { date: week, counters: {}, claimed: [] }; persist(); }
    if (state.shop?.pending || state.starRewards?.pending) return; // Do not regenerate a wallet with an unsettled receipt.
    const elapsed = Math.max(0, currentTime() - state.staminaUpdatedAt);
    const ticks = Math.floor(elapsed / STAMINA_INTERVAL_MS);
    if (state.stamina >= MAX_STAMINA) state.staminaUpdatedAt = currentTime();
    else if (ticks > 0) {
      state.stamina = Math.min(MAX_STAMINA, state.stamina + ticks);
      state.staminaUpdatedAt += ticks * STAMINA_INTERVAL_MS;
      persist();
    }
  }
  function taskCounters(time=currentTime()) {
    // Legacy counters use local dates; import them only when that date agrees
    // with the supply ledger's Beijing-time reset.
    if(state.daily?.date!==flightDay(time))return {daily:{},weekly:{}};
    return {daily:state.daily.counters||{},weekly:state.weekly?.date===weekKey(time)?state.weekly.counters||{}:{}};
  }
  const count = (key, amount = 1) => {
    syncDay(); state.daily.counters[key] = integer(state.daily.counters[key]) + amount;
    state.weekly.counters[key] = integer(state.weekly.counters[key]) + amount;
  };
  function migrate() {
    const legacyKeys = ['thunder-ssr-pilots-v1', 'thunder-gacha-v1', 'thunder-slot-demo-v1', 'thunder-profile-v1', 'thunder-daily-login-v1'];
    const backup = Object.fromEntries(legacyKeys.map(key => { try { return [key, storage?.getItem(key) ?? null]; } catch { return [key, null]; } }));
    // Never rewrite the old keys during migration; preserve their exact raw bytes.
    let backupStored = false;
    try {
      if (!storage?.getItem(PERIPHERAL_BACKUP_KEY)) storage?.setItem(PERIPHERAL_BACKUP_KEY, JSON.stringify({ createdAt: currentTime(), raw: backup }));
      backupStored = Boolean(storage?.getItem(PERIPHERAL_BACKUP_KEY));
    } catch { storageWarning = '旧存档备份未能写入；旧键仍完整保留'; }
    const legacy = read(storage, 'thunder-slot-demo-v1');
    const collection = inventory();
    const owned = new Set(['pilot-01', ...pilots().owned]);
    for (const plane of PERIPHERAL_AIRCRAFT) if (collection.inventory[`aircraft:${plane.id}`]?.count > 0) owned.add(plane.id);
    const changes = [];
    const aircraft = Object.fromEntries(PERIPHERAL_AIRCRAFT.map(plane => {
      const old = legacy?.version === 2 ? legacy.aircraft?.[plane.id] : plane.id === 'pilot-01' ? legacy?.placements : {};
      const migrated = migratePeripheralPlacements(old, id => collection.weaponProgress.weapons[id]?.unlocked);
      changes.push(...migrated.changes.map(change => ({ aircraftId: plane.id, ...change })));
      return [plane.id, { level: 1, slots: migrated.slots }];
    }));
    const savedPilot = pilots().persistentSelected || pilots().selected;
    const selectedAircraft = PERIPHERAL_AIRCRAFT_MAP.has(savedPilot) ? savedPilot : 'pilot-01';
    return { version: 1, pilotId: pilots().selected, aircraftId: selectedAircraft, ownedAircraft: [...owned], aircraft,
      aircraftShards: 0, stamina: NATIVE_INITIAL_STAMINA, staminaUpdatedAt: currentTime(),
      patrol: createPatrolState(currentTime()),
      daily: { date: dayKey(currentTime()), counters: { login: 1 }, claimed: [] }, processedRuns: [],
      migration: { createdAt: currentTime(), backupKey: PERIPHERAL_BACKUP_KEY, backupStored, changes,
        legacyResources: { resonance: copy(pilots().resonance), profileLevels: { fighter: profile.fighterLevel, gear: profile.gearLevel, tech: profile.techLevel },
          weapons: copy(collection.weaponProgress) },
        notes: ['旧共鸣、全局等级、品质和专属碎片不清零、不自动折算；原始数据已备份。', '武器旧等级和品质继续实际生效；新强化只增加基础等级。'] } };
  }
  if (!state || state.version !== 1) { state = migrate(); persist(); }
  state.ownedAircraft = [...new Set(['pilot-01', ...(state.ownedAircraft || [])])].filter(id => PERIPHERAL_AIRCRAFT_MAP.has(id));
  state.aircraft ||= {};
  let correctedDuplicate = false;
  for (const plane of PERIPHERAL_AIRCRAFT) {
    const record = state.aircraft[plane.id] ||= {};
    record.level = integer(record.level, 1, PERIPHERAL_MAX_LEVEL);
    const used = new Set([plane.weaponId]);
    record.slots = Object.fromEntries(GENERAL_SLOTS.map(slot => {
      const id = record.slots?.[slot], valid = COMMON_WEAPONS[id] && !used.has(id);
      if (id && !valid) correctedDuplicate = true;
      if (valid) used.add(id);
      return [slot, valid ? id : null];
    }));
  }
  if (correctedDuplicate) persist();
  if (UNLIMITED_RESOURCES) {
    // Development access grants only missing ownership; never add duplicate
    // resonance or reset levels, upgrades, loadouts, or current selections.
    const ownedPilots = new Set(pilots().owned);
    if (!temporaryPilots().length) {
      for (const pilot of AIRCRAFTS) if (!ownedPilots.has(pilot.id)) pilotApi.grant(pilot.id, 1);
    }
    const allAircraft = PERIPHERAL_AIRCRAFT.map(plane => plane.id);
    if (allAircraft.some(id => !state.ownedAircraft.includes(id))) {
      state.ownedAircraft = [...new Set([...state.ownedAircraft, ...allAircraft])];
      persist();
    }
  }
  state.pilotId = temporaryPilots().length ? pilots().selected
    : (pilots().owned.includes(state.pilotId)||state.fleet?.ownedPilots?.includes?.(state.pilotId)) ? state.pilotId : pilots().selected;
  state.aircraftId = state.ownedAircraft.includes(state.aircraftId) ? state.aircraftId : 'pilot-01';
  state.aircraftShards = integer(state.aircraftShards);
  // VitalityMax limits natural recovery; retain already-owned legacy overflow.
  state.stamina = integer(state.stamina);
  state.staminaUpdatedAt = Number(state.staminaUpdatedAt) || currentTime();
  state.processedRuns ||= [];
  state.recruitHistory = sanitizeRecruitHistory(state.recruitHistory);
  state.pilotStars = sanitizePilotStars(state.pilotStars);
  const newEquipment=!state.equipment||state.equipment.version!==2;
  state.equipment=sanitizeGearState(state.equipment);
  if(newEquipment)persist();
  // Native defaults remain separate from cloud ownership and research.
  // Explicit local development grants are applied below, with a saved backup.
  if (!Object.hasOwn(state, 'replicaLoadout')) {
    state.replicaLoadout = createReplicaProgression();
    persist();
  }
  if (!Object.hasOwn(state, 'replicaInventory')) { state.replicaInventory = createReplicaInventory(); persist(); }
  if (!Object.hasOwn(state,'replicaPlayerIdentity')) {
    state.replicaPlayerIdentity=nativePlayerIdentity(undefined,profile.playerName);
    persist();
  }
  if (prepareDevelopmentInventory(state, UNLIMITED_RESOURCES)) persist();
  if (prepareDevelopmentUnlocks(state)) persist();
  // Keep historical replacement receipts and stock; no further native drone-to-gun conversion.
  // Initialize the new sign-in ledger only after legacy reward recovery below.
  if (!state.onboarding) {
    state.onboarding = normalizeOnboarding(null, existingOnboardingSave ? {...state,
      research:nativeResearchSnapshot(state.replicaLoadout,state.replicaInventory),
      equipment:replicaGearSnapshot(state.equipment,state.replicaInventory)} : {});
    persist();
  }
  let starterGrantsAttempted=false;
  function syncStarterGrants(){
    if (!storageCurrent()) return;
    if(starterGrantsAttempted||(state.nativeStarterCore&&state.nativeStarterItems)||activeSortie||state.dailyRewardReceipt||unsavedPatrolReward||pendingFlightAd||state.replicaPendingSettlement||state.shop?.pending||state.starRewards?.pending)return;
    starterGrantsAttempted=true;
    try{
      let next=planNativeStarterCore(state,currentTime())||state;
      next=planNativeStarterItems(next,currentTime())||next;if(next===state)return;
      const previous=state;state=next;
      if(!persist()){state=previous;storageWarning='初始奖励尚未保存，请恢复存储后重新进入游戏';}
    }catch(error){storageWarning=error.message;}
  }
  syncStarterGrants();
  const nativeCampaign = replicaCampaignProgress(state.replicaResults || [], state.replicaCampaign);
  if (JSON.stringify(nativeCampaign) !== JSON.stringify(state.replicaCampaign)) {
    state.replicaCampaign = nativeCampaign; persist();
  }
  try {
    const next=planNativeLabSynchronization(state.replicaLoadout,state.replicaInventory,state.replicaCampaign);
    if(next){
      const oldLoadout=state.replicaLoadout,oldInventory=state.replicaInventory;
      state.replicaLoadout=next.progression;state.replicaInventory=next.inventory;
      if(!persist()){state.replicaLoadout=oldLoadout;state.replicaInventory=oldInventory;}
    }
  }catch(error){storageWarning=error.message;}
  syncSamplePatrol();
  state.fleet=sanitizeFleetProgress(state.fleet,{ownedPilots:pilots().owned,ownedAircraft:state.ownedAircraft,pilotId:state.pilotId});
  // Keep the old pilot API synchronized for legacy portraits and integrations;
  // the peripheral save is authoritative for newly activated roster members.
  for(const id of state.fleet.ownedPilots)if(!pilots().owned.includes(id))pilotApi.grant(id,1);
  if(!ownPilot(state.pilotId))state.pilotId='pilot-01';
  if(!ownAircraft(state.aircraftId))state.aircraftId='pilot-01';
  const previousPilotRecruit = JSON.stringify(state.pilotRecruit);
  const legacyPilotPool=inventory().pools?.aircraft_permanent;
  state.pilotRecruit = sanitizePilotRecruit(state.pilotRecruit||{
    pity:legacyPilotPool?.pity?.sr,ssrPity:legacyPilotPool?.pity?.ssr,urPity:legacyPilotPool?.pity?.ur,
  }, state.recruitHistory, legacyPilotPool?.totalPulls);
  if (previousPilotRecruit !== JSON.stringify(state.pilotRecruit)) persist();
  if (inventory().pools?.weapon_permanent?.newWeaponMisses == null) {
    collectionApi.transact(next => {
      const missing = Object.values(next.weaponProgress.weapons).some(w => !w.unlocked);
      next.pools.weapon_permanent.newWeaponMisses = missing
        ? trailingRecruitMisses(state.recruitHistory, 'weapon', reward => reward.isNew, WEAPON_NEW_PITY) : 0;
      return { ok: true };
    });
  }
  if (!state.patrol) { state.patrol = createPatrolState(currentTime()); persist(); }
  const newResearch = !state.research;
  state.research = sanitizeResearch(state.research);
  if (newResearch) persist();

  function settleResearchDebit() {
    if (!storageCurrent()) return false;
    const debit = state.researchDebit;
    if (!debit) return true;
    // A durable receipt bridges the research save and the existing profile wallet.
    // Retrying/reloading must never award a card while restoring the spent coins.
    if (UNLIMITED_RESOURCES) { /* Development purchases do not debit saved money. */ }
    else if (profile.coins === debit.before) profile.coins = debit.after;
    else if (profile.coins !== debit.after) { storageWarning = '科技扣费记录待核对，暂不能继续觉醒'; return false; }
    try { saveProfile(); }
    catch { storageWarning = '科技已保存，金币存档待重试，请勿清理本地数据'; return false; }
    delete state.researchDebit;
    persist();
    return true;
  }
  settleResearchDebit();

  const legacyShopWallet = () => ({coins:profile.coins,diamonds:profile.diamonds,stamina:state.stamina,maxStamina:MAX_STAMINA,
    unlimited:UNLIMITED_RESOURCES, aircraftShardReserve:aircraftShardReserve(state.aircraft, PERIPHERAL_AIRCRAFT.map(a => a.id)),
    highestCleared:highestLegacyClearedStage(),
    aircraftShards:state.aircraftShards,weaponParts:inventory().weaponProgress.universalFragments,
    shopSeed:state.migration?.createdAt||0,gearRevision:state.equipment.revision,
    basicKeys:state.equipment.keys.basic,advancedKeys:state.equipment.keys.advanced,
    ...Object.fromEntries([1,2,3,4,5].map(type=>[`blueprint${type}`,state.equipment.blueprints[type]||0]))});
  const shopWallet = () => ({...legacyShopWallet(),...replicaResourceWallet(state.replicaInventory)});
  // New receipts use native item IDs. Unmarked historical receipts retain their
  // original ledger; replaying them must not mint native currency.
  function applyNativeWalletReceipt(receipt) {
    if (!storageCurrent()) return false;
    const {before,after,gearRevision}=receipt;
    try {
      const current={...shopWallet(),cores:state.research.cores};
      if(!before||!after||Object.entries(after).some(([key,value])=>
        !Number.isSafeInteger(value)||value<0||!Number.isSafeInteger(before[key])||before[key]<0
        ||(current[key]!==before[key]&&current[key]!==value)))return false;
      if(gearRevision&&state.equipment.revision!==gearRevision.before&&state.equipment.revision!==gearRevision.after)return false;
      const next=copy(state);
      next.replicaInventory=applyReplicaResourceReceipt(state.replicaInventory,receipt);
      for(const key of Object.keys(after)) {
        if(REPLICA_RESOURCE_IDS[key]||key==='weaponParts')continue;
        if(key==='stamina'||key==='aircraftShards')next[key]=after[key];
        else if(key==='cores')next.research.cores=after[key];
        else return false;
      }
      if(gearRevision)next.equipment.revision=gearRevision.after;
      if('weaponParts' in after) {
        const saved=collectionApi.transact(value=>{value.weaponProgress.universalFragments=after.weaponParts;return {ok:true};},{requirePersisted:true});
        if(!saved?.ok)return false;
      }
      return saveDailyState(next);
    }catch{return false;}
  }
  const shop = createShopService({getState:()=>state.shop, getWallet:shopWallet, now:currentTime, playAd:playShopAd,rng,
    canUse:()=>storageCurrent() && !activeSortie && !patrolAdBusy && !unsavedPatrolReward && !state.dailyRewardReceipt, onChange,
    saveState:nextShop=>{
      const marked=nextShop.pending&&!state.shop?.pending
        ? {...nextShop,pending:{...nextShop.pending,walletSource:REPLICA_WALLET_SOURCE}} : nextShop;
      const next = {...state,shop:marked};
      return saveDailyState(next);
    },
    applyWallet:receipt=>{
      if(receipt.walletSource===REPLICA_WALLET_SOURCE)return applyNativeWalletReceipt(receipt);
      const {before,after,gearRevision}=receipt;
      if (!storageCurrent()) return false;
      const current = legacyShopWallet();
      if (Object.keys(after).some(key=>!(UNLIMITED_RESOURCES && ['coins','diamonds','stamina'].includes(key)) && current[key]!==before[key]&&current[key]!==after[key])) return false;
      if(gearRevision&&state.equipment.revision!==gearRevision.before&&state.equipment.revision!==gearRevision.after)return false;
      for (const key of ['coins','diamonds']) if (key in after) profile[key]=after[key];
      if(saveProfile()===false)return false;
      if ('weaponParts' in after) {
        const saved = collectionApi.transact(next=>{next.weaponProgress.universalFragments=after.weaponParts;return {ok:true};},{requirePersisted:true});
        if (!saved?.ok) return false;
      }
      for (const key of ['stamina','aircraftShards']) if (key in after && !(UNLIMITED_RESOURCES && key==='stamina')) state[key]=after[key];
      for(const type of [1,2,3,4,5])if(`blueprint${type}` in after)state.equipment.blueprints[type]=after[`blueprint${type}`];
      for(const pool of ['basic','advanced'])if(`${pool}Keys` in after)state.equipment.keys[pool]=after[`${pool}Keys`];
      if(gearRevision)state.equipment.revision=gearRevision.after;
      return persist();
    },
  });
  shop.recover();

  const starRewards = createStarRewardService({
    getState:()=>state.starRewards, getWallet:()=>({...shopWallet(),cores:state.research.cores}),
    getTotals:()=>campaignStarTotals(getCampaign(),stages), maxStars:stages.length*3,
    canUse:()=>storageCurrent() && !activeSortie && !patrolAdBusy && !unsavedPatrolReward && !state.shop?.pending && !state.researchDebit && !state.dailyRewardReceipt, onChange,
    saveState:nextRewards=>{
      const marked=nextRewards.pending&&!state.starRewards?.pending
        ? {...nextRewards,pending:{...nextRewards.pending,walletSource:REPLICA_WALLET_SOURCE}} : nextRewards;
      const next={...state,starRewards:marked};
      return saveDailyState(next);
    },
    applyWallet:receipt=>{
      if(receipt.walletSource===REPLICA_WALLET_SOURCE)return applyNativeWalletReceipt(receipt);
      const {before,after}=receipt;
      if (!storageCurrent()) return false;
      const current={...legacyShopWallet(),cores:state.research.cores};
      if (Object.keys(after).some(key=>current[key]!==before[key] && current[key]!==after[key])) return false;
      if ('diamonds' in after) {profile.diamonds=after.diamonds;saveProfile();}
      if ('weaponParts' in after) {
        const result=collectionApi.transact(next=>{next.weaponProgress.universalFragments=after.weaponParts;return {ok:true};},{requirePersisted:true});
        if (!result?.ok) return false;
      }
      if ('aircraftShards' in after) state.aircraftShards=after.aircraftShards;
      if ('cores' in after) state.research.cores=after.cores;
      return persist();
    },
  });
  starRewards.recover();

  function saveDailyState(next) {
    if (!writePeripheralState(next)) return false;
    state=next;return true;
  }
  function migrateFlightRewards() {
    if (Object.hasOwn(state,'flightRewards')) return true;
    if (state.dailyRewardReceipt || !storageCurrent()) return false;
    // Read the settled, sanitized legacy key; never trust an unverified receipt.after.
    return saveDailyState({...state,flightRewards:flightLedger(null,loadDailyLoginState(storage))});
  }
  // One durable receipt bridges profile, inventory and the existing sign-in key.
  // A retry writes absolute balances/records, so a partial save never adds twice.
  function recoverDailyReward() {
    if (!storageCurrent()) return false;
    const receipt=state.dailyRewardReceipt;
    if (!receipt) return migrateFlightRewards();
    try {
      const native=receipt.walletSource===REPLICA_WALLET_SOURCE;
      const wallet=native?shopWallet():legacyShopWallet(), patch=receipt.inventoryPatch,collectionPatch=receipt.collectionPatch;
      if (!receipt.before || !receipt.after || Object.entries(receipt.after).some(([key,value])=>
        !Number.isFinite(value) || value<0 || (wallet[key]!==receipt.before[key] && wallet[key]!==value))) return false;
      if (patch) {
        const current=inventory(),count=integer(current.inventory[patch.itemId]?.count);
        if (count!==patch.beforeCount && count!==patch.afterCount) return false;
        if (patch.weaponId) {
          const record=JSON.stringify(current.weaponProgress.weapons[patch.weaponId]);
          if (record!==JSON.stringify(patch.beforeWeapon) && record!==JSON.stringify(patch.afterWeapon)) return false;
        }
      }
      if(collectionPatch){
        const current=inventory();
        for(const [id,beforeCount]of Object.entries(collectionPatch.beforeCounts)){const count=integer(current.inventory[id]?.count);if(count!==beforeCount&&count!==collectionPatch.afterCounts[id])return false;}
        const progress=JSON.stringify(current.weaponProgress);
        if(progress!==JSON.stringify(collectionPatch.beforeProgress)&&progress!==JSON.stringify(collectionPatch.afterProgress))return false;
      }
      if (receipt.login) {
        const current=JSON.stringify(loadDailyLoginState(storage));
        if (current!==JSON.stringify(receipt.login.before) && current!==JSON.stringify(receipt.login.after)) return false;
      }
      if(!native) {
        for (const key of ['coins','diamonds']) if (key in receipt.after) profile[key]=receipt.after[key];
        if (saveProfile()===false) return false;
      }
      if ('weaponParts' in receipt.after || patch || collectionPatch) {
        const result=collectionApi.transact(next=>{
          if ('weaponParts' in receipt.after) next.weaponProgress.universalFragments=receipt.after.weaponParts;
          if (patch) {
            next.inventory[patch.itemId]={count:patch.afterCount};
            if(patch.weaponId)next.weaponProgress.weapons[patch.weaponId]=copy(patch.afterWeapon);
          }
          if(collectionPatch){for(const[id,count]of Object.entries(collectionPatch.afterCounts))next.inventory[id]={count};next.weaponProgress=copy(collectionPatch.afterProgress);}
          return {ok:true};
        },{requirePersisted:true});
        if (!result?.ok) return false;
      }
      if (receipt.login && !saveDailyLoginState(receipt.login.after,storage)) return false;
      if(native) { if(!applyNativeWalletReceipt(receipt))return false; }
      else for (const key of ['aircraftShards','stamina']) if (key in receipt.after) state[key]=receipt.after[key];
      const next=copy(state);delete next.dailyRewardReceipt;
      return saveDailyState(next) && migrateFlightRewards();
    } catch { return false; }
  }
  function deliverDaily(next,reward,{login,inventoryPatch,collectionPatch,source,walletSource=REPLICA_WALLET_SOURCE,rewards=rewardItems(reward),message='奖励已领取'}={}) {
    if(activeSortie)return fail('请先完成当前出击');
    const wallet=walletSource===REPLICA_WALLET_SOURCE?shopWallet():legacyShopWallet(),before={},after={};
    for(const [key,amount] of Object.entries(reward)) {
      if(!amount)continue;
      if(!Number.isFinite(wallet[key]) || wallet[key]<0)return fail('资源数据异常');
      before[key]=wallet[key];after[key]=wallet[key]+amount;
    }
    next.dailyRewardReceipt={version:1,walletSource,before,after,...(source?{source}:{}),...(login?{login}:{}),...(inventoryPatch?{inventoryPatch}:{}),...(collectionPatch?{collectionPatch}:{})};
    if(!saveDailyState(next))return fail('无法保存领取记录，本次未发放');
    if(!recoverDailyReward())return fail('奖励已记录，存档待恢复，请重试');
    onChange();return pass(message,{rewards});
  }
  function currentAchievements() {
    return state.replicaLoadout?nativeAchievementSnapshot(state.achievements,state.replicaLoadout,state.replicaCampaign,state.pilotSupply)
      :achievementSnapshot(state.achievements,currentAchievementMetrics());
  }
  function currentAchievementMetrics() {
    return achievementMetrics({campaign:getCampaign(),stages,collection:inventory(),aircraft:state.aircraft,
      ownedAircraft:PERIPHERAL_AIRCRAFT.filter(a=>ownAircraft(a.id)).map(a=>a.id),pilotPulls:state.pilotRecruit.totalPulls});
  }
  recoverDailyReward();

  function ownPilot(id) {
    return temporaryPilots().includes(id)||(!state.fleet.pending.pilot.includes(id)&&(state.fleet.ownedPilots.includes(id)||pilots().owned.includes(id)));
  }
  function persistentPilot(id) {return !state.fleet.pending.pilot.includes(id)&&(state.fleet.ownedPilots.includes(id)||pilots().owned.includes(id));}
  function ownAircraft(id) { return !state.fleet?.pending?.aircraft?.includes(id)&&(state.ownedAircraft.includes(id)||integer(inventory().inventory[`aircraft:${id}`]?.count)>0); }
  function currentFleetBanks() {
    return {
      pilot:fleetSkillSnapshot('pilot',AIRCRAFTS.map(p=>({...p,stars:state.pilotStars[p.id],owned:ownPilot(p.id),temporaryUnlocked:!persistentPilot(p.id)&&temporaryPilots().includes(p.id)})),state.fleet.skills.pilot),
      aircraft:fleetSkillSnapshot('aircraft',PERIPHERAL_AIRCRAFT.map(a=>({...a,aircraftName:a.name,stars:state.fleet.aircraftStars[a.id],owned:ownAircraft(a.id)})),state.fleet.skills.aircraft),
    };
  }
  function syncPilotUnlocks() {
    if (!storageCurrent()) return;
    const cleared = Number.isFinite(Number(getCampaign().highestCleared)) ? integer(getCampaign().highestCleared, -1) : -1;
    for (let index = 1; index < AIRCRAFTS.length; index++) {
      const id=AIRCRAFTS[index].id;
      if(cleared>=index-1&&!temporaryPilots().includes(id)&&!persistentPilot(id)&&!state.fleet.pending.pilot.includes(id)) {
        if(state.fleet.mode==='manual') {
          const next=copy(state);next.fleet.pending.pilot.push(id);next.fleet.copies.pilot[id]++;
          next.fleet.revision++;saveDailyState(next);
        }else pilotApi.grant(id,1);
      }
    }
  }
  function grantReward(reward) {
    profile.coins = integer(profile.coins) + integer(reward.coins);
    profile.diamonds = integer(profile.diamonds) + integer(reward.diamonds);
    state.aircraftShards += integer(reward.aircraftShards);
    state.stamina += integer(reward.stamina);
    if (reward.weaponParts) collectionApi.transact(next => {
      next.weaponProgress.universalFragments += integer(reward.weaponParts); return { ok: true };
    });
  }
  // Historical task/shop projections still read legacy chapter records. No payout.
  function highestLegacyClearedStage() {
    const results = getCampaign().results || {};
    for (let index = stages.length - 1; index >= 0; index--) {
      if (Object.entries(results).some(([key, value]) => key.startsWith(`${stages[index].id}:`) && (value.cleared || value.stars > 0))) return index;
    }
    return -1;
  }
  function syncSamplePatrol() {
    if (!storageCurrent()) return false;
    try {
      const next=initializeSamplePatrol(state.samplePatrol,state.replicaCampaign,currentTime());
      if(JSON.stringify(next)===JSON.stringify(state.samplePatrol))return true;
      const before=state.samplePatrol;state.samplePatrol=next;
      if(!persist()){state.samplePatrol=before;return false;}
      return true;
    }catch(error){storageWarning=error.message;return false;}
  }
  const fail = message => ({ ok: false, message });
  const pass = (message, extra = {}) => ({ ok: true, message, ...extra });
  function recruit(poolId, requestedCount) {
    // Legacy pool names remain valid; pilot supply owns its new character pity.
    const key = ['pilot', 'pilot_permanent', 'aircraft', 'aircraft_permanent'].includes(poolId) ? 'aircraft_permanent'
      : poolId === 'weapon' || poolId === 'weapon_permanent' ? 'weapon_permanent' : null;
    if (!key) return fail('请选择战姬池或武器池');
    const amount = Number(requestedCount) === 10 ? 10 : 1, cost = amount === 10 ? RECRUIT_TEN_COST : RECRUIT_SINGLE_COST;
    if (profile.diamonds < cost) return fail('钻石不足');
    if (key === 'aircraft_permanent') {
      const manual=state.fleet.mode==='manual';
      const collected=[...new Set([...pilots().owned,...state.fleet.ownedPilots,...state.fleet.pending.pilot])];
      const progress=manual?Object.fromEntries(AIRCRAFTS.map(p=>[p.id,Math.min(5,state.pilotStars[p.id]+state.fleet.copies.pilot[p.id])])):state.pilotStars;
      const plan = planPilotRecruit({ stars: progress, owned: collected, firstStar:manual?1:0,
        ownedAircraft: state.ownedAircraft, pity: state.pilotRecruit.pity,
        ssrPity: state.pilotRecruit.ssrPity, urPity: state.pilotRecruit.urPity, count: amount, rng });
      if(manual) {
        const grant=collectFleetRecruit(state.fleet,plan.rewards,{pilotStars:state.pilotStars,ownedPilots:collected,ownedAircraft:state.ownedAircraft});
        const next=copy(state);next.fleet=grant.fleet;next.ownedAircraft=plan.ownedAircraft;
        const recruitToken=`fleet-${currentTime()}-${next.fleet.revision}-${state.pilotRecruit.totalPulls+amount}`;
        next.fleet.recruitPresentation={token:recruitToken,pool:'pilot',rewards:grant.rewards};
        next.pilotRecruit={...next.pilotRecruit,pity:plan.pity,ssrPity:plan.ssrPity,urPity:plan.urPity,totalPulls:next.pilotRecruit.totalPulls+amount};
        next.recruitHistory=appendRecruitHistory(next.recruitHistory,{at:currentTime(),pool:'pilot',cost,rewards:grant.rewards});
        next.daily.counters.recruits=integer(next.daily.counters.recruits)+amount;
        next.weekly.counters.recruits=integer(next.weekly.counters.recruits)+amount;
        const result=deliverDaily(next,{diamonds:-cost,aircraftShards:plan.shards},{source:{type:'fleetRecruit',pool:'pilot',rewards:grant.rewards},rewards:grant.rewards,message:'招募完成'});
        return {...result,recruitPool:'pilot',recruitToken};
      }
      let pilotStorageFailed = false;
      for (const id of plan.recruitedPilots) {
        if (pilotApi.grant(id, 1)?.some(r => r.storagePersisted === false)) pilotStorageFailed = true;
      }
      profile.diamonds -= cost;
      state.pilotStars = plan.stars;
      state.pilotRecruit.pity = plan.pity;
      state.pilotRecruit.ssrPity = plan.ssrPity;
      state.pilotRecruit.urPity = plan.urPity;
      state.pilotRecruit.totalPulls += amount;
      state.aircraftShards += plan.shards;
      state.ownedAircraft = plan.ownedAircraft;
      state.recruitHistory = appendRecruitHistory(state.recruitHistory, { at: currentTime(), pool: 'pilot', cost, rewards: plan.rewards });
      if (pilotStorageFailed) storageWarning = '角色存档暂不可保存，当前改动仅保留在本次会话';
      count('recruits', amount); commit();
      return pass('招募完成', { rewards: plan.rewards, storageWarning });
    }
    const result = collectionApi.transact(next => {
      const drawn = drawFromPool(next, key, amount, rng);
      const rewards = [];
      for (const receipt of drawn.results) {
        const item = receipt.item;
        if (!item) continue;
        const parts = integer(receipt.fragmentsAdded);
        drawn.state.weaponProgress.weapons[item.refId].fragments -= parts;
        drawn.state.weaponProgress.universalFragments += parts;
        rewards.push({ id: item.refId, drawQuality: receipt.quality, name: receipt.isFirst ? item.name : `${item.name} · 通用零件 ×${parts}`, isNew: receipt.isFirst, type: receipt.isFirst ? 'weapon' : 'weaponParts', amount: receipt.isFirst ? 1 : parts });
      }
      Object.assign(next, drawn.state);
      return pass('招募完成', { rewards });
    });
    if (!result.ok) return result;
    profile.diamonds -= cost;
    state.recruitHistory = appendRecruitHistory(state.recruitHistory, {
      at:currentTime(),pool:key==='aircraft_permanent'?'pilot':'weapon',cost,rewards:result.rewards,
    });
    count('recruits', amount); commit();
    return pass('招募完成', { rewards: result.rewards, storageWarning });
  }
  function flightInput(time=currentTime()) {
    return {ledger:state.flightRewards,inventory:state.replicaInventory,progression:state.replicaLoadout,campaign:state.replicaCampaign,time};
  }
  function supplyInput() {
    return [state.replicaLoadout,state.replicaInventory,state.pilotSupply];
  }
  function savePilotSupplyPlan(plan) {
    if (!storageCurrent()) return fail(storageWarning);
    const before=[state.replicaLoadout,state.replicaInventory,state.pilotSupply];
    state.replicaLoadout=plan.progression;state.replicaInventory=plan.inventory;state.pilotSupply=plan.ledger;
    if(!persist()){
      [state.replicaLoadout,state.replicaInventory,state.pilotSupply]=before;
      return fail('补给未能保存，请重试；本次未扣费');
    }
    nativeDetails=null;onChange();
    return pass(plan.taskActivityOnly?'活跃 +20':'补给已存入库存',{title:plan.title,rewards:plan.rewards,...(plan.recruitPool?{recruitPool:plan.recruitPool}:{})});
  }
  async function pilotSupplyAd(revision) {
    if(pendingFlightAd){
      const saved=saveFlightPlan(pendingFlightAd);if(saved.ok)pendingFlightAd=null;return saved;
    }
    if(revision!==state.replicaInventory.revision)return fail('库存已变化，请重新领取');
    const started=currentTime();
    const view=pilotSupplySnapshot(state.pilotSupply,state.replicaInventory,state.replicaLoadout,started,state.replicaCampaign);
    if(!view.ad.canClaim)return fail('今日广告补给已领完');
    if(typeof playShopAd!=='function')return fail('广告服务暂未就绪');
    if(!persist())return fail('暂时无法保存，广告未开始');
    flightAdBusy=true;onChange();
    try {
      const result=await playShopAd();
      if(result?.completed!==true)return fail('未完整观看广告，未发放奖励');
      if (!storageCurrent()) return fail(storageWarning);
      pendingFlightAd=planPilotSupply(...supplyInput(),{action:'ad',expectedRevision:state.replicaInventory.revision},started,{adCompleted:true,campaign:state.replicaCampaign});
      const saved=saveFlightPlan(pendingFlightAd);if(saved.ok)pendingFlightAd=null;return saved;
    }catch(error){return fail(error.message||'广告未完成');}
    finally{flightAdBusy=false;onChange();}
  }
  function saveSamplePatrolPlan(plan) {
    if (!storageCurrent()) return fail(storageWarning);
    // One save commits native items, timer/fractions, daily uses and stamina.
    const before=[state.samplePatrol,state.replicaInventory,state.stamina];
    state.samplePatrol=plan.ledger;state.replicaInventory=plan.inventory;state.stamina-=plan.staminaCost;
    if(!persist()){
      [state.samplePatrol,state.replicaInventory,state.stamina]=before;
      return fail('巡逻奖励未能保存，请重试；本次未扣体力');
    }
    nativeDetails=null;onChange();return pass('巡逻奖励已存入库存',{title:plan.title,rewards:plan.rewards});
  }
  async function samplePatrolAd(revision) {
    if(pendingFlightAd){
      const saved=saveFlightPlan(pendingFlightAd);if(saved.ok)pendingFlightAd=null;return saved;
    }
    if(typeof playPatrolAd!=='function')return fail('广告服务暂未就绪');
    // Prepare once, before the video. The daily use belongs to its start day.
    let plan;
    try{plan=planSamplePatrol(state.samplePatrol,state.replicaInventory,state.replicaCampaign,currentTime(),{mode:'ad',expectedRevision:revision},state.stamina,state.replicaLoadout);}
    catch(error){return fail(error.message);}
    if(!persist())return fail('暂时无法保存，广告未开始');
    flightAdBusy=true;onChange();
    try {
      const result=await playPatrolAd();
      if(result?.completed!==true)return fail('未完整观看广告，未发放奖励');
      if (!storageCurrent()) return fail(storageWarning);
      pendingFlightAd=plan;
      const saved=saveFlightPlan(pendingFlightAd);if(saved.ok)pendingFlightAd=null;return saved;
    }catch(error){return fail(error.message||'广告未完成');}
    finally{flightAdBusy=false;onChange();}
  }
  function saveFlightPlan(plan) {
    if (!storageCurrent()) return fail(storageWarning);
    if(plan.samplePatrol)return saveSamplePatrolPlan(plan);
    if(plan.pilotSupply)return savePilotSupplyPlan(plan);
    const inventory=validateReplicaInventory(plan.inventory),progression=validateReplicaProgression(plan.progression);
    const pilotSupply=plan.pilotCreditDelta?addPilotSupplyCredits(state.pilotSupply,currentTime(),plan.pilotCreditDelta):state.pilotSupply;
    const before=[state.flightRewards,state.replicaInventory,state.replicaLoadout,state.pilotSupply];
    state.flightRewards=plan.ledger;state.replicaInventory=inventory;state.replicaLoadout=progression;state.pilotSupply=pilotSupply;
    if(!persist()){
      [state.flightRewards,state.replicaInventory,state.replicaLoadout,state.pilotSupply]=before;
      return fail('奖励未能保存，请重试；本次未扣费');
    }
    nativeDetails=null;onChange();return pass('奖励已领取',{rewards:plan.rewards});
  }
  async function flightAd(revision) {
    if(flightAdBusy)return fail('广告正在播放，请稍候');
    if(pendingFlightAd) {
      const result=saveFlightPlan(pendingFlightAd);
      if(result.ok)pendingFlightAd=null;
      return result;
    }
    if(revision!==state.replicaInventory.revision)return fail('库存已更新，请重新操作');
    const started=currentTime();
    if(!flightRewardsSnapshot(state.flightRewards,state.replicaInventory,state.replicaCampaign,started).ad.canClaim)return fail('今日已领取或日期异常');
    if(typeof playShopAd!=='function')return fail('广告服务暂未就绪');
    if(!persist())return fail('暂时无法保存，广告未开始');
    flightAdBusy=true;onChange();
    try {
      const result=await playShopAd();
      if(result?.completed!==true)return fail('未完整观看广告，未发放奖励');
      if (!storageCurrent()) return fail(storageWarning);
      // All user economy actions are gated while this video is open.
      pendingFlightAd=planFlightReward(flightInput(started),{action:'ad',completed:true,revision:state.replicaInventory.revision});
      const saved=saveFlightPlan(pendingFlightAd);
      if(saved.ok)pendingFlightAd=null;
      return saved;
    }catch(error){return fail(error.message||'广告未完成');}
    finally{flightAdBusy=false;onChange();}
  }
  function developerToolsAccess({ reset = false } = {}) {
    if (!storageCurrent()) return fail(storageWarning);
    if (activeSortie) return fail('请先结束当前战斗');
    if (flightAdBusy || patrolAdBusy || shop.busy) return fail('操作正在进行，请完成后再使用开发工具');
    if (!reset && (pendingFlightAd || unsavedPatrolReward || state.replicaPendingSettlement || state.dailyRewardReceipt || state.shop?.pending || state.starRewards?.pending)) return fail('奖励待保存，请先恢复存档再领取开发资源');
    return { ok: true };
  }
  function action(type, payload = {}) {
    if (!storageCurrent()) return fail(storageWarning);
    if(type==='onboardingComplete') {
      const group=Number(payload.group);
      if(group!==14||activeSortie)return fail('无效引导步骤');
      if(guideFinished(state,group))return pass('');
      const guide=nextLobbyGuide(snapshot());
      if(guide?.group!==14||guide.uid!==payload.uid)return fail('该装备暂不可强化');
      const previous=state.onboarding;state.onboarding=completeGuide(previous,group);
      if(!persist()){state.onboarding=previous;return fail('引导进度未能保存');}
      onChange();return pass('');
    }
    if (type === 'developerCurrency') {
      const access = developerToolsAccess();
      if (!access.ok) return access;
      try {
        const plan = planDeveloperCurrency(state.replicaInventory, payload);
        const next = { ...state, replicaInventory: plan.inventory };
        if (!saveDailyState(next)) return fail('资源未保存，未发放，请重试');
        onChange();
        return { ok: true, message: plan.message };
      } catch (error) { return fail(error.message); }
    }
    if(flightAdBusy)return fail('广告正在播放，请稍候');
    if(type==='recoverDailyRewards'&&pendingFlightAd){
      const saved=saveFlightPlan(pendingFlightAd);
      if(saved.ok){pendingFlightAd=null;onChange();}
      return saved;
    }
    if(pendingFlightAd&&!(type==='quickPatrolAd'||['flightReward','pilotSupply'].includes(type)&&payload.action==='ad'))return fail('广告奖励待保存，请回到广告领取页重试保存');
    if(!recoverReplicaSettlement())return fail(storageWarning || '上一局奖励待保存');
    if(['renamePlayer','backpackUse','nativeAcquisition','replicaCollection','selectReplicaLoadout','flightReward','claimSignIn','claimAchievement','researchDraw','pilotSupply','claimPatrol','quickPatrol','quickPatrolAd','devPatrolSample','claimStarReward'].includes(type)) {
      if(shop.busy||!recoverDailyReward()||!starRewards.recover()||!shop.recover())return fail('资源存档待恢复，请先重试');
    }
    if (type === 'renamePlayer') {
      if(activeSortie)return fail('请先结束当前战斗');
      if(patrolAdBusy||unsavedPatrolReward)return fail('请先完成当前巡逻奖励的领取');
      try {
        const plan=planNativePlayerRename(state.replicaPlayerIdentity,state.replicaInventory,profile.playerName,payload);
        const beforeIdentity=state.replicaPlayerIdentity,beforeInventory=state.replicaInventory;
        state.replicaPlayerIdentity=plan.identity;state.replicaInventory=plan.inventory;
        if(!persist()){
          state.replicaPlayerIdentity=beforeIdentity;state.replicaInventory=beforeInventory;
          return fail('名字未保存，钻石未扣除，请重试');
        }
        // A best-effort legacy mirror follows the one authoritative save. Its
        // failure cannot undo a paid name or turn a retry into another debit.
        profile.playerName=plan.identity.name;
        try{saveProfile();}catch{ /* The peripheral identity is already durable. */ }
        onChange();return plan.receipt;
      } catch(error) { return fail(error.message); }
    }
    if(['claimPatrol','quickPatrol','quickPatrolAd','devPatrolSample'].includes(type)){
      if(activeSortie)return fail('请先结束当前战斗');
      if(patrolAdBusy||unsavedPatrolReward)return fail('其他广告奖励正在处理，请先完成领取');
      syncDay();
      if(!syncSamplePatrol())return fail(storageWarning||'巡逻存档未能保存');
      if(type==='quickPatrolAd')return samplePatrolAd(payload.expectedRevision);
      const mode=type==='claimPatrol'?'idle':type==='devPatrolSample'?'devSample':'stamina';
      try{return saveSamplePatrolPlan(planSamplePatrol(state.samplePatrol,state.replicaInventory,state.replicaCampaign,currentTime(),{mode,expectedRevision:payload.expectedRevision},state.stamina,state.replicaLoadout));}
      catch(error){return fail(error.message);}
    }
    if(type==='backpackUse') {
      if(activeSortie)return fail('请先结束当前战斗');
      if(patrolAdBusy||unsavedPatrolReward)return fail('请先完成当前奖励保存');
      if(payload.expectedRevision!==state.replicaInventory.revision)return fail('道具数量已变化，请重新确认');
      const rule=backpackUseRule(payload.id);
      if(!rule)return fail('该道具没有可用的背包操作');
      if(rule.kind==='pilotBox'||rule.kind==='pilotCompose')return action('pilotSupply',{
        action:rule.kind==='pilotBox'?'open':'compose',count:payload.count,expectedRevision:payload.expectedRevision});
      if(rule.kind==='pilotCard')return action('pilotSupply',{action:'convertCopies',id:payload.id,count:payload.count,expectedRevision:payload.expectedRevision});
      if(rule.kind==='equipmentKey')return action('gearSupply',{pool:rule.pool,count:payload.count,keyOnly:payload.id,
        expectedRevision:payload.expectedGearRevision,expectedInventoryRevision:payload.expectedRevision});
      try {
        const plan=planBackpackUse(state.replicaInventory,state.equipment,payload,state.replicaLoadout),next=copy(state);
        next.replicaInventory=plan.inventory;if(plan.gear)next.equipment=plan.gear;
        if(plan.pilotCreditDelta)next.pilotSupply=addPilotSupplyCredits(state.pilotSupply,currentTime(),plan.pilotCreditDelta);
        if(!saveDailyState(next))return fail('使用结果未能保存，本次未消耗道具');
        nativeDetails=null;onChange();return pass(plan.message,{rewards:plan.rewards});
      }catch(error){return fail(error.message);}
    }
    if(type==='pilotSupply'){
      if(activeSortie)return fail('请先结束当前战斗');
      if(patrolAdBusy||unsavedPatrolReward)return fail('其他广告奖励正在处理，请先完成领取');
      if(payload.action==='ad')return pilotSupplyAd(payload.expectedRevision);
      const time=currentTime();
      try{return savePilotSupplyPlan(planPilotSupply(...supplyInput(),payload,time,{campaign:state.replicaCampaign,taskCounters:taskCounters(time)}));}
      catch(error){return fail(error.message);}
    }
    if(type==='flightReward'||type==='claimSignIn'){
      if(activeSortie)return fail('请先结束当前战斗');
      const operation=type==='claimSignIn'?{action:'signin',revision:state.replicaInventory.revision}:payload;
      if(operation.action==='ad')return flightAd(operation.revision);
      // Ad completion may only originate from the awaited platform callback.
      try{return saveFlightPlan(planFlightReward(flightInput(),operation,rng));}
      catch(error){return fail(error.message);}
    }
    if(type==='researchDraw'){
      if(activeSortie)return fail('请先结束当前战斗');
      try{
        const plan=planNativeResearch(state.replicaLoadout,state.replicaInventory,payload,rng);
        const before=[state.replicaLoadout,state.replicaInventory,state.onboarding];
        state.replicaLoadout=plan.progression;state.replicaInventory=plan.inventory;
        if(payload.pool==='ace')state.onboarding=completeGuide(state.onboarding,6);
        if(!persist()){
          [state.replicaLoadout,state.replicaInventory,state.onboarding]=before;
          return fail('科技未能保存，材料未扣除');
        }
        nativeDetails=null;onChange();return plan.receipt;
      }catch(error){return fail(error.message);}
    }
    if (['researchRefine','researchUpgrade'].includes(type)) return fail('该养成操作暂未开放，资源未扣除');
    if (type === 'nativeAcquisition') {
      if(activeSortie)return fail('请先完成当前出击');
      if(!recoverReplicaSettlement())return fail(storageWarning);
      try {
        const plan=planNativeAcquisition(state.replicaInventory,state.replicaCampaign,state.replicaClaims,payload,rng);
        const beforeInventory=state.replicaInventory,beforeClaims=state.replicaClaims;
        state.replicaInventory=plan.inventory;state.replicaClaims=plan.claims;
        if(!persist()){state.replicaInventory=beforeInventory;state.replicaClaims=beforeClaims;return fail('领取未能保存，材料未变动');}
        onChange();return pass(plan.message||'已存入材料库存',{title:plan.title,deferredRewards:plan.deferredRewards,deferredRewardId:plan.deferredRewardId,
          rewards:plan.rewards.map(row=>flightRewardView({kind:'item',id:row.id,count:row.count}))});
      }catch(error){return fail(error.message);}
    }
    if (type === 'replicaCollection') {
      if (activeSortie) return fail('请先结束当前战斗');
      if (!recoverReplicaSettlement()) return fail(storageWarning || '上一局奖励待保存');
      try {
        const next = planReplicaCollection(state.replicaLoadout, state.replicaInventory, payload, state.replicaCampaign);
        const oldLoadout = state.replicaLoadout, oldInventory = state.replicaInventory;
        state.replicaLoadout = next.progression; state.replicaInventory = next.inventory;
        if (!persist()) { state.replicaLoadout = oldLoadout; state.replicaInventory = oldInventory; return fail('养成操作未能保存，材料未扣除'); }
        onChange(); return pass(payload.kind==='labs' ? (payload.action==='activate'?'科研技能已激活':payload.action==='upgrade'?'科研升级完成':'科研预览等级已应用') : payload.action === 'star' ? '升星完成' : payload.action === 'unlock' ? '激活完成' : '装配已保存');
      } catch (error) { return fail(error.message); }
    }
    if (type === 'selectReplicaLoadout') {
      if (activeSortie) return fail('请先结束当前战斗');
      try {
        const next = selectReplicaProgression(state.replicaLoadout, payload);
        const previous = state.replicaLoadout, previousInventory = state.replicaInventory;
        const inventory = validateReplicaInventory(previousInventory);
        inventory.revision++;
        state.replicaInventory = validateReplicaInventory(inventory);
        state.replicaLoadout = next;
        if (!persist()) { state.replicaLoadout = previous; state.replicaInventory = previousInventory; return fail('出战配置保存失败'); }
        onChange(); return pass('出战配置已保存', { replicaLoadout: copy(next) });
      } catch (error) { return fail(error.message); }
    }
    if (patrolAdBusy) return fail('广告正在播放，请稍候');
    if (unsavedPatrolReward) {
      if (type !== 'recoverDailyRewards') return fail('广告奖励待保存，请重试保存');
      const {next,resources,options} = unsavedPatrolReward;
      const result = deliverDaily(next,resources,options);
      if (result.ok || state.dailyRewardReceipt) unsavedPatrolReward = null;
      return result;
    }
    const recoveredRecruit=state.dailyRewardReceipt?.source?.type==='fleetRecruit';
    if (!recoverDailyReward()) return fail('奖励存档待恢复，请重试');
    const presentation=state.fleet.recruitPresentation;
    if(type!=='fleetRecruitSeen'&&presentation&&(type==='recruit'||recoveredRecruit))return pass('招募存档已恢复',{rewards:copy(presentation.rewards),recruitPool:presentation.pool,recruitToken:presentation.token});
    if(type==='fleetRecruitSeen') {
      if(!presentation||presentation.token!==payload.token)return fail('招募结果已更新');
      const next=copy(state);delete next.fleet.recruitPresentation;
      return saveDailyState(next)?pass('招募结果已记录'):fail('结果已发放，展示记录待保存');
    }
    if (!starRewards.recover()) return fail('星级奖励存档待恢复，请重新进入');
    syncDay(); syncPilotUnlocks(); syncSamplePatrol();
    if (shop.busy) return fail('商城操作进行中，请稍候');
    if (!shop.recover()) return fail('商城存档待恢复，请重新进入游戏');
    if (!settleResearchDebit()) return fail(storageWarning);
    if(type==='recoverDailyRewards')return pass('奖励存档已恢复');
    if(NATIVE_PENDING_ECONOMY_ACTIONS.has(type))return fail(NATIVE_PENDING_ECONOMY_MESSAGE);
    if (type === 'claimStarReward') {
      if(!state.replicaLoadout)return starRewards.claim(payload);
      if(activeSortie)return fail('请先结束当前战斗');
      if(patrolAdBusy||unsavedPatrolReward)return fail('请先完成当前奖励保存');
      try {
        const plan=planNativeStarClaim(state.starRewards,state.replicaInventory,state.replicaCampaign,payload,stages.length*3,rng);
        const next=copy(state);next.starRewards=plan.state;next.replicaInventory=plan.inventory;
        if(!saveDailyState(next))return fail('星级奖励未能保存，本次未领取');
        nativeDetails=null;onChange();return plan.receipt;
      }catch(error){return fail(error.message);}
    }
    if (type === 'shopBuy' || type === 'shopRefresh') return shop.purchase(type === 'shopRefresh' ? {...payload,refresh:true} : payload)
      .then(result => saveGuard.conflicted ? fail(staleSaveMessage) : result);
    const id = payload.id || payload.pilotId || payload.aircraftId || payload.weaponId;
    if(type.startsWith('gear')) {
      if(activeSortie)return fail('请先完成当前出击');
      const operation=type==='gearPreview'?payload.operation:{gearEquip:'equip',gearUnequip:'unequip',gearLock:'lock',gearUpgrade:'upgrade',gearUpgradeAll:'upgradeAll',gearDowngrade:'downgrade',gearMerge:'merge',gearBatch:'batch',gearSupply:'supply',gearClaimBasicReward:'claimBasicReward'}[type];
      if(type==='gearPreview'&&!['batch','downgrade'].includes(operation))return fail('未知预览');
      if(!recoverReplicaSettlement())return fail(storageWarning);
      const plan=planReplicaGear(state.equipment,state.replicaInventory,{...payload,uid:payload.uid||id,revision:payload.expectedRevision,operation,time:currentTime()},state.replicaLoadout);
      if(!plan.ok)return plan;
      if(type==='gearPreview')return pass('',{gearPreview:{operation,revision:state.equipment.revision,steps:plan.steps,returnedGear:plan.returnedGear,returnedFodder:plan.returnedFodder,quality:plan.quality,level:plan.level,ok:true}});
      const next=copy(state);next.equipment=plan.state;
      // The teaching marker and the paid/equipped result commit together.
      if(operation==='equip')next.onboarding=completeGuide(next.onboarding,9);
      if(operation==='supply'&&Number(payload.count||1)===1)next.onboarding=completeGuide(next.onboarding,8);
      if(plan.progression)next.replicaLoadout=plan.progression;
      if(plan.receipt)next.replicaEquipmentBoxReceipt=copy(plan.receipt);
      if(plan.pilotCreditDelta)next.pilotSupply=addPilotSupplyCredits(state.pilotSupply,currentTime(),plan.pilotCreditDelta);
      if(operation==='upgrade'||operation==='upgradeAll'){
        const levels=plan.toLevel-plan.fromLevel;
        if(levels>0){
          const time=currentTime();
          try{next.pilotSupply=recordPilotSupplyUpgrade(next.pilotSupply,time,levels,{taskCounters:taskCounters(time)});}
          catch(error){return fail(error.message);}
        }
        next.daily.counters.upgrades=integer(next.daily.counters.upgrades)+levels;
        next.weekly.counters.upgrades=integer(next.weekly.counters.upgrades)+levels;
      }
      next.replicaInventory=plan.inventory;
      const before=state;state=next;
      if(!persist()){state=before;return fail('装备操作未能保存，材料未扣除');}
      onChange();
      nativeDetails=null;
      return pass(plan.message,{gearResult:{operation,pool:plan.pool,uid:payload.uid||id,fromLevel:plan.fromLevel,toLevel:plan.toLevel,fromQuality:plan.fromQuality,toQuality:plan.toQuality,steps:plan.steps,drawn:plan.drawn||[],pilotRewards:plan.pilotRewards||[],weaponRewards:plan.weaponRewards||[],keyReward:plan.keyReward,receipt:plan.receipt?copy(plan.receipt):null}});
    }
    if(['fleetActivate','fleetStarUp','fleetSkillEquip','fleetSkillRemove'].includes(type)) {
      if(activeSortie)return fail('请先完成当前出击');
      const kind=payload.kind,owned=kind==='pilot'?ownPilot(id):ownAircraft(id);
      const plan=planFleetAction(state.fleet,state.pilotStars,{kind,id,slot:payload.slot,revision:payload.expectedRevision,
        operation:{fleetActivate:'activate',fleetStarUp:'starUp',fleetSkillEquip:'equip',fleetSkillRemove:'unequip'}[type],
        owned,temporary:kind==='pilot'&&!persistentPilot(id)&&temporaryPilots().includes(id)});
      if(!plan.ok)return plan;
      const next=copy(state);next.fleet=plan.fleet;next.pilotStars=plan.pilotStars;
      if(type==='fleetActivate'&&kind==='aircraft'&&!next.ownedAircraft.includes(id))next.ownedAircraft.push(id);
      if(!saveDailyState(next))return fail(type==='fleetSkillEquip'||type==='fleetSkillRemove'?'无法保存技能配置':'无法保存本次操作，卡片未消耗');
      if(type==='fleetActivate'&&kind==='pilot'&&!pilots().owned.includes(id))pilotApi.grant(id,1);
      onChange();return pass(plan.message,{kind,id,previousStars:plan.previousStars,stars:plan.stars});
    }
    if (type === 'selectPilot') {
      if(!ownPilot(id))return fail('请先激活该驾驶员');
      if(!pilots().owned.includes(id)&&persistentPilot(id))pilotApi.grant(id,1);
      pilotApi.select(id);
      if (!temporaryPilots().includes(id)) persistentPilotId = id;
      state.pilotId = id; if(!commit())return fail(storageWarning); return pass('出战人物已切换');
    }
    if (type === 'selectAircraft') {
      if (!PERIPHERAL_AIRCRAFT_MAP.has(id) || !ownAircraft(id)) return fail('请先获得该飞机');
      state.aircraftId = id; if(!commit())return fail(storageWarning); return pass('飞机已切换，保留本机装配');
    }
    if (type === 'equipWeapon') {
      const slot = payload.slotId || payload.slot;
      if (!GENERAL_SLOTS.includes(slot)) return fail('槽1、槽2为本机专武，不能替换');
      const weaponId = payload.weaponId ?? payload.id ?? null;
      if (weaponId && !inventory().weaponProgress.weapons[weaponId]?.unlocked) return fail('请先获得该武器');
      const slots = state.aircraft[state.aircraftId].slots;
      if(payload.expectedToken!==undefined&&payload.expectedToken!==fitToken(state.aircraftId,slots))return fail('装配已变化，请重新选择位置');
      if (weaponId === PERIPHERAL_AIRCRAFT_MAP.get(state.aircraftId).weaponId) return fail('本机已自带该武器，不能重复装备');
      if (weaponId && GENERAL_SLOTS.some(s => slots[s] === weaponId)) return fail('该武器已装备，请先卸下后再更换槽位');
      const next=copy(state);next.aircraft[state.aircraftId].slots[slot]=weaponId;
      if(!saveDailyState(next))return fail('无法保存装配，本次未更换武器');
      onChange();return pass(weaponId ? '武器已装配' : '武器已卸下');
    }
    if (type === 'upgradeAircraft' || type === 'upgradeWeapon') return fail('请在原版战机或武器目录中进行养成');
    if (type === 'upgradeAircraft') {
      const aircraftId = id || state.aircraftId;
      if (!PERIPHERAL_AIRCRAFT_MAP.has(aircraftId) || !ownAircraft(aircraftId)) return fail('请先获得该飞机');
      const record = state.aircraft[aircraftId], cost = aircraftUpgradeCost(record.level);
      if (!cost) return fail('已达基础强化上限');
      if (profile.coins < cost.coins || state.aircraftShards < cost.aircraftShards) return fail('金币或通用飞机碎片不足');
      profile.coins -= cost.coins; state.aircraftShards -= cost.aircraftShards; record.level++;
      count('upgrades'); commit(); return pass(record.level % 10 === 0 ? '战机阶段强化完成 · 攻击与耐久额外增强' : '飞机基础攻击与耐久已强化');
    }
    if (type === 'upgradeWeapon') {
      const result = collectionApi.transact(next => {
        const weapon = next.weaponProgress.weapons[id];
        if (!weapon?.unlocked) return fail('请先获得该武器');
        const cost = peripheralWeaponUpgradeCost(weapon.level, weapon.qualityRank);
        if (!cost) return fail(weaponLevelLimitMessage(weapon.qualityRank));
        if (profile.coins < cost.coins || next.weaponProgress.universalFragments < cost.weaponParts) return fail('金币或通用武器零件不足');
        weapon.level++; next.weaponProgress.universalFragments -= cost.weaponParts;
        return pass(weapon.level % 10 === 0 ? '武器阶段强化完成 · 伤害额外增强' : '武器基础伤害已强化', { cost });
      });
      if (result.ok) { profile.coins -= result.cost.coins; count('upgrades'); commit(); }
      return result;
    }
    if (type === 'synthesizeWeapon' || type === 'synthesizeAll') {
      const result = collectionApi.transact(next => {
        const synthesis = type === 'synthesizeWeapon'
          ? synthesizeWorkshopWeapon(next.weaponProgress, id, payload.expectedQualityRank)
          : synthesizeWorkshopBatch(next.weaponProgress, payload.token);
        if (!synthesis.ok) return synthesis;
        // Only progress changes. Inventory identities, aircraft fits and the
        // already-frozen combat loadout keep their existing instances.
        next.weaponProgress = synthesis.state;
        const { state: _progress, ...receipt } = synthesis;
        return receipt;
      });
      if (result.ok) { count('upgrades', result.steps?.length || 1); commit(); }
      return result;
    }
    if (type === 'recruit') return action('pilotSupply',{...payload,action:'draw'});
    if (type === 'claimTask') {
      const task = [...DAILY_TASKS, ...WEEKLY_TASKS].find(t => t.id === (payload.taskId || id));
      const period = task?.id.startsWith('weekly-') ? state.weekly : state.daily;
      if (!task || period.claimed.includes(task.id)) return fail('奖励已领取');
      if (integer(period.counters[task.counter]) < task.target) return fail('任务尚未完成');
      const reward = taskRewardForStage(task, highestLegacyClearedStage());
      const next=copy(state),record=task.id.startsWith('weekly-')?next.weekly:next.daily;
      (record.rewardReceipts ||= {})[task.id]=copy(reward);
      record.claimed.push(task.id);
      return deliverDaily(next,reward,{source:{type:'task',id:task.id},message:'任务奖励已领取'});
    }
    if(type==='claimActivity') {
      if(!['daily','weekly'].includes(payload.period))return fail('任务分类不存在');
      const activity=snapshot().activity[payload.period];
      const item=activity.items.find(row=>row.id===String(id));
      if(!item)return fail('奖励档位不存在');
      if(item.claimed)return fail('此档奖励已领取');
      if(!item.claimable)return fail('活跃度不足');
      const next=copy(state);(next[payload.period].activityClaimed ||= []).push(item.id);
      return deliverDaily(next,item.reward,{source:{type:'activity',period:payload.period,id:item.id},message:'活跃奖励已领取'});
    }
    if(type==='claimAchievement') {
      if(patrolAdBusy||unsavedPatrolReward)return fail('请先完成当前巡逻奖励的领取');
      const item=currentAchievements().items.find(row=>row.id===id);
      if(!item)return fail('成就不存在');
      if(item.claimed)return fail('成就奖励已领取');
      if(!item.claimable)return fail('成就尚未达成');
      const next=copy(state);next.achievements||={claimed:[]};next.achievements.claimed.push(item.id);
      return deliverDaily(next,item.reward,{source:{type:'achievement',id:item.id},...(item.rewardItems?{rewards:item.rewardItems}:{}),message:'成就奖励已领取'});
    }
    if (type === 'selectStage') {
      const index = Number(payload.index ?? payload.stageIndex ?? payload.id);
      if (!Number.isInteger(index) || !stages[index] || !replicaStageAccessible(index, state.replicaCampaign.highestUnlocked)) return fail('关卡未解锁或暂不可用');
      selectStage(index); onChange(); return pass('航线已选择');
    }
    if (type === 'sweep') return fail('扫荡已改为巡逻，请在出击页领取巡逻奖励');
    return fail('未知操作');
  }
  function currentLoadout() {
    const banks=currentFleetBanks();
    return compilePeripheralLoadout({ aircraftId: state.aircraftId, pilotId: state.pilotId,
      pilotStars: state.pilotStars[state.pilotId],
      slots: state.aircraft[state.aircraftId].slots, aircraftLevel: state.aircraft[state.aircraftId].level,
      weaponProgress: inventory().weaponProgress, research: state.research,
      aircraftStars:state.fleet.aircraftStars[state.aircraftId],
      pilotSkills:banks.pilot.skills.filter(s=>s.slot>=0),aircraftSkills:banks.aircraft.skills.filter(s=>s.slot>=0),equipment:state.equipment });
  }
  function powerFor(loadout) {
    return rateLoadoutPower(loadout).total;
  }
  function claimStageOneWeapon() {
    if (!storageCurrent()) return fail(storageWarning);
    if (state.firstClearWeaponClaimed) return pass('首关武器已领取', { rewards: [] });
    const firstStage = stages[0];
    if (!firstStage || !getCampaign().results?.[`${firstStage.id}:easy`]?.cleared) return fail('尚未完成首关');
    const owned = inventory().weaponProgress.weapons;
    const innateId = PERIPHERAL_AIRCRAFT_MAP.get(state.aircraftId)?.weaponId;
    const preferred = FIRST_CLEAR_WEAPON_PRIORITY.find(id => COMMON_WEAPONS[id] && !owned[id]?.unlocked && id !== innateId);
    const weaponId = COMMON_WEAPONS[state.firstClearWeaponPending] ? state.firstClearWeaponPending
      : preferred || Object.keys(COMMON_WEAPONS).find(id => !owned[id]?.unlocked && id !== innateId);
    if (!weaponId) {
      state.firstClearWeaponClaimed = true;
      persist();
      return pass('全部通用武器已拥有', { rewards: [] });
    }
    if (state.firstClearWeaponPending !== weaponId) {
      state.firstClearWeaponPending = weaponId;
      if (!persist()) { delete state.firstClearWeaponPending; return fail('无法保存首通领取记录，请重试'); }
    }
    if (!owned[weaponId]?.unlocked) {
      const granted = collectionApi.transact(next => {
        const grant = grantItemToInventory(next, `weapon:${weaponId}`, 1, 'stage-one-first-clear');
        if (!grant.results[0]?.isFirst) return fail('首关武器暂不可领取');
        Object.assign(next, grant.state);
        return pass('首关武器已领取');
      }, { requirePersisted: true });
      if (!granted.ok) return granted;
    }
    if (!state.aircraft[state.aircraftId].slots.W3 && weaponId !== innateId) state.aircraft[state.aircraftId].slots.W3 = weaponId;
    state.firstClearWeaponClaimed = true;
    delete state.firstClearWeaponPending;
    persist();
    return pass('首关武器已领取', { rewards: [{ type: 'weapon', id: weaponId, name: COMMON_WEAPONS[weaponId].name, amount: 1 }] });
  }
  function replicaConfiguration() { return createReplicaConfiguration(state.equipment, state.replicaLoadout, state.replicaCampaign); }
  function acceptReplicaLoadoutDetails(details) {
    if(details?.configurationKey!==replicaConfigurationKey(replicaConfiguration()))return false;
    if(!Number.isFinite(details.attack)||details.attack<1||!Number.isFinite(details.hp)||details.hp<1
      ||!Number.isSafeInteger(details.power)||details.power<0)return false;
    nativeDetails=copy(details);
    return true;
  }
  function currentNativeDetails() {
    return nativeDetails?.configurationKey===replicaConfigurationKey(replicaConfiguration())?nativeDetails:null;
  }
  function prepareSortie({ trial = false, engine = 'legacy', chapterId, replicaConfiguration: requestedConfiguration } = {}) {
    if (!storageCurrent()) return fail(storageWarning);
    if(flightAdBusy||pendingFlightAd)return fail('请先完成当前模拟广告奖励');
    if (flightAdBusy) return fail('广告正在播放，请稍候');
    if (pendingFlightAd) return fail('广告奖励待保存，请到每日特惠重试领取');
    if (!recoverReplicaSettlement() || !recoverInterruptedSortie()) return fail(storageWarning || '上一局奖励待恢复，请先重试保存');
    if (patrolAdBusy) return fail('广告正在播放，请稍候');
    if (unsavedPatrolReward) return fail('广告奖励待保存，请重试保存');
    if (!recoverDailyReward()) return fail('奖励存档待恢复，请重试');
    if (!starRewards.recover()) return fail('星级奖励存档待恢复，请重新进入');
    if (shop.busy || !shop.recover()) return fail('请先完成商城操作或恢复存档');
    if (activeSortie) return activeSortie.snapshot.engine === engine
      && (engine !== 'danke-replica-v1' || activeSortie.snapshot.chapterId === chapterId)
      ? activeSortie : fail('已有其他战斗正在进行');
    syncDay(); syncPilotUnlocks();
    if (!trial && !UNLIMITED_RESOURCES && state.stamina < SORTIE_STAMINA) return fail(`体力不足，每 ${STAMINA_INTERVAL_MS / 60000} 分钟恢复 1 点`);
    if(ownPilot(pilots().selected))state.pilotId=pilots().selected;
    let nativeConfiguration, nativeChapter, nativeDefeatCount=0;
    if (engine === 'danke-replica-v1') {
      try {
        nativeChapter = replicaChapter(chapterId);
        if (!nativeChapter || !stages[nativeChapter.stageIndex]) return fail('关卡暂不可用');
        if (!trial && !replicaStageAccessible(nativeChapter.stageIndex, state.replicaCampaign.highestUnlocked)) return fail('该关卡尚未解锁');
        nativeConfiguration = validateReplicaConfiguration(requestedConfiguration);
        nativeDefeatCount = trial ? 0 : localFailureCount(state.localFailureProtection,nativeChapter.id);
        if (replicaConfigurationKey(nativeConfiguration) !== replicaConfigurationKey(replicaConfiguration())) {
          return fail('战前装备已变化，请重新出击');
        }
      } catch (error) { return fail(error.message); }
    }
    const loadout = nativeConfiguration ? copy(nativeConfiguration) : currentLoadout();
    // A reload resets the in-memory serial; a repeated/rolled-back clock must
    // not reuse a durable receipt ID and acknowledge an older chapter as this run.
    const createdAt = currentTime();
    let runId;
    do { runId = `sortie-${createdAt}-${++sortieSerial}`; }
    while (state.processedRuns.includes(runId) || state.replicaResults?.some(row => row.runId === runId)
      || state.replicaPendingSettlement?.result?.runId === runId);
    const identity = { id: runId, engine, createdAt,
      pilotId: state.pilotId, aircraftId: state.aircraftId };
    // Native sorties must not label the lobby's old power/modifiers as battle stats.
    const snapshot = freeze(nativeConfiguration
      ? { ...identity, chapterId: nativeChapter.id, stageIndex: nativeChapter.stageIndex, nativeDefeatCount, replicaConfiguration: copy(nativeConfiguration) }
      : { ...identity, loadout: copy(loadout),
      stats: { ...loadout.statModifiers, power: powerFor(loadout) },
      sources: [{type:'pilot',id:state.pilotId,stars:state.pilotStars[state.pilotId]},
        ...currentFleetBanks().pilot.skills.filter(s=>s.slot>=0).map(s=>({type:'pilot-skill',id:s.id,slot:s.slot,stars:s.stars,effect:s.name,modifiers:copy(s.modifiers)})),
        ...currentFleetBanks().aircraft.skills.filter(s=>s.slot>=0).map(s=>({type:'aircraft-skill',id:s.id,slot:s.slot,stars:s.stars,effect:s.name,ability:copy(s.ability)})),
        { type: 'aircraft', id: state.aircraftId, level: state.aircraft[state.aircraftId].level, ...loadout.statModifiers },
        { type: 'research', levels: copy(state.research.levels), modifiers: copy(loadout.statModifiers.researchModifiers) },
        ...loadout.statModifiers.gearModifiers.sources.map(source=>({type:'equipment',...copy(source)})),
        ...loadout.weapons.map(w => ({ type: w.innate ? 'innate' : 'weapon', id: w.id, itemId: w.itemId, slots: [...w.slots], level: w.level, qualityRank: w.qualityRank }))] });
    if (engine === 'danke-replica-v1' && !trial) {
      const before = { stamina: state.stamina, replicaMainline: state.replicaMainline, replicaInterruptedSortie: state.replicaInterruptedSortie };
      state.replicaInterruptedSortie = {snapshot:copy(snapshot)};
      state.replicaMainline = true;
      if (!UNLIMITED_RESOURCES) state.stamina -= SORTIE_STAMINA;
      if (!persist()) { Object.assign(state, before); return fail('出击记录未保存，请重试'); }
    } else if (!trial && !UNLIMITED_RESOURCES) {
      const before = state.stamina; state.stamina -= SORTIE_STAMINA;
      if (!persist()) { state.stamina = before; return fail(storageWarning || '出击记录未保存，请重试'); }
    }
    activeSortie = pass('战前配置已锁定', { loadout, snapshot, trial });
    return activeSortie;
  }
  // Persist a pending receipt before applying its absolute coin balance.
  // Recovery accepts before/after only; it never reapplies an additive reward.
  function recoverReplicaSettlement() {
    if (!storageCurrent()) return false;
    const pending = state.replicaPendingSettlement;
    if (!pending) return true;
    const legacy=pending.walletSource!==REPLICA_WALLET_SOURCE;
    if (legacy && profile.coins !== pending.coinsBefore && profile.coins !== pending.coinsAfter) {
      storageWarning = '复刻战斗奖励余额待核对'; return false;
    }
    let settlement, protection;
    try { if (!state.processedRuns.includes(pending.result.runId)) {
      settlement = planNativeSettlement(state.replicaInventory, state.equipment, state.replicaFirstClearClaims, pending.result, state.replicaBattleMaterials);
      if(pending.result.failureProtectionPolicyVersion===LOCAL_FAILURE_PROTECTION_VERSION)
        protection=recordLocalFailureProtection(state.localFailureProtection,pending.result);
    } }
    catch (error) { storageWarning = error.message; return false; }
    try { if(legacy) { profile.coins = pending.coinsAfter; if(saveProfile()===false)throw new Error('保存失败'); } }
    catch { storageWarning = '复刻战斗奖励待保存'; return false; }
    const before = copy(state);
    if (!state.processedRuns.includes(pending.result.runId)) {
      state.replicaInventory = settlement.inventory;
      state.equipment = settlement.gear;
      state.replicaFirstClearClaims = settlement.claims;
      state.replicaBattleMaterials = settlement.materials;
      if(protection)state.localFailureProtection=protection;
      pending.result.settlementRewards = settlement.rewards;
      state.processedRuns.push(pending.result.runId); state.processedRuns = state.processedRuns.slice(-50);
      state.replicaResults ||= []; state.replicaResults.push(pending.result); state.replicaResults = state.replicaResults.slice(-50);
      if (!pending.result.trial && !pending.result.abandoned && pending.result.endReason !== 'quit') {
        const time=currentTime();
        try{state.pilotSupply=recordPilotSupplyBattle(state.pilotSupply,time,{won:pending.result.won,taskCounters:taskCounters(time)});}
        catch(error){state=before;storageWarning=error.message;return false;}
        count('sorties'); if (pending.result.won) count('victories');
      }
    }
    state.replicaCampaign = replicaCampaignProgress([pending.result], state.replicaCampaign);
    try {
      const next=planNativeLabSynchronization(state.replicaLoadout,state.replicaInventory,state.replicaCampaign);
      if(next){state.replicaLoadout=next.progression;state.replicaInventory=next.inventory;}
    }catch(error){state=before;storageWarning=error.message;return false;}
    if(state.replicaInterruptedSortie?.snapshot?.id===pending.result.runId)delete state.replicaInterruptedSortie;
    delete state.replicaPendingSettlement;
    if (!persist()) { state = before; return false; }
    return true;
  }
  function recordReplicaSortie(result, runId) {
    const trial = Boolean(activeSortie.trial || result.debugRun);
    const abandoned = Boolean(result.abandoned);
    const gold = Number(result.gold);
    const chapter = replicaChapter(activeSortie.snapshot.chapterId);
    if (!chapter || !Number.isFinite(gold) || gold < 0 || result.chapterId !== chapter.id
      || result.stageIndex !== chapter.stageIndex) return fail('战斗结果与出击关卡不一致');
    if(!trial&&!abandoned&&result.endReason!=='quit'
      &&(!Number.isInteger(result.wave)||result.wave<1||result.wave>chapter.waveCount
        ||result.won&&result.wave!==chapter.waveCount))return fail('战斗波次与出击关卡不一致');
    const record = { ...copy(result), runId, trial, abandoned, won: Boolean(result.won) && !abandoned,
      failureProtectionPolicyVersion:LOCAL_FAILURE_PROTECTION_VERSION, nativeDefeatCount:activeSortie.snapshot.nativeDefeatCount,
      materialPolicyVersion:BATTLE_MATERIAL_POLICY.version,
      chapterId: chapter.id, stageIndex: chapter.stageIndex, replicaConfiguration: copy(activeSortie.snapshot.replicaConfiguration) };
    record.localMaterialRewards=prepareBattleMaterialRewards(record);
    record.collectedGold=Math.floor(gold);
    // The reported gold already comes from native battle pickup accounting.
    // BattleGold% is not a second multiplier over ordinary collected coins.
    delete record.battleGoldCompatibilityVersion;
    delete record.battleGoldBonus;
    record.gold=record.collectedGold;
    const assessment=assessReplicaBattle(record);
    // Recompute from the simulation's outcome; do not trust a posted star mask.
    Object.assign(record,assessment||{starMask:0,stars:0,starObjectives:[]});
    if (!state.replicaPendingSettlement) {
      state.replicaPendingSettlement = { result: record, walletSource: REPLICA_WALLET_SOURCE };
      if (!persist()) { delete state.replicaPendingSettlement; return fail('战斗结果待保存，请重试'); }
    }
    if (!recoverReplicaSettlement()) return fail(storageWarning);
    activeSortie = null;
    onChange();
    const saved = state.replicaResults.find(row => row.runId === runId) || record;
    return pass('战斗结果已保存', { rewards: copy(saved.settlementRewards || []), replica: copy(saved) });
  }

  // A mobile browser can be killed without pagehide after becoming hidden.
  // Persist the latest same-origin checkpoint; on a fresh instance only, settle
  // it through the existing interrupted-exit transaction. This is not resume.
  function checkpointSortie(result = {}) {
    if (!storageCurrent()) return false;
    if(!activeSortie || activeSortie.trial || activeSortie.snapshot.engine!=='danke-replica-v1')return false;
    const pending=state.replicaInterruptedSortie;
    if(!pending || pending.snapshot.id!==activeSortie.snapshot.id || result.runId!==pending.snapshot.id
      || result.chapterId!==pending.snapshot.chapterId || !Number.isFinite(result.gold) || result.gold<0
      || !Number.isFinite(result.clock) || result.clock<0
      || result.clock<(pending.result?.clock??0) || result.gold<(pending.result?.gold??0))return false;
    const previous=pending.result;
    pending.result=copy(result);
    if(!persist()){pending.result=previous;return false;}
    return true;
  }
  function recoverInterruptedSortie() {
    if (!storageCurrent()) return false;
    const pending=state.replicaInterruptedSortie;
    if(activeSortie || !pending)return true;
    const snapshot=pending.snapshot,chapter=replicaChapter(snapshot?.chapterId);
    if(!chapter || snapshot.engine!=='danke-replica-v1' || typeof snapshot.id!=='string') {
      storageWarning='中断战斗记录待核对';return false;
    }
    if(state.processedRuns.includes(snapshot.id)) {
      delete state.replicaInterruptedSortie;
      if(!persist()){state.replicaInterruptedSortie=pending;return false;}
      return true;
    }
    activeSortie=pass('恢复中断战斗', {snapshot:freeze(copy(snapshot)),trial:false});
    const result=pending.result || {runId:snapshot.id,chapterId:chapter.id,gold:0,won:false,abandoned:true};
    const receipt=recordSortie({...result,runId:snapshot.id,chapterId:chapter.id,stageIndex:chapter.stageIndex,engine:'danke-replica-v1'});
    if(!receipt.ok){activeSortie=null;return false;}
    return true;
  }

  function recordSortie(result = {}) {
    if (!storageCurrent()) return fail(storageWarning);
    const runId = result.runId || activeSortie?.snapshot.id;
    if (!runId || !activeSortie || activeSortie.snapshot.id !== runId) return fail('战斗已结算或无有效快照');
    if (activeSortie.snapshot.engine === 'danke-replica-v1' || result.engine === 'danke-replica-v1') {
      if (activeSortie.snapshot.engine !== result.engine) return fail('战斗内核与出击快照不一致');
      // snapshot()/replicaResults can finish a previously failed durable save
      // before the battle frame retries its result. Acknowledge that saved
      // receipt for this still-active sortie, then release it. Never apply the
      // retry payload or pay a second time; subsequent replays have no active run.
      if (state.processedRuns.includes(runId)) {
        const saved = state.replicaResults?.find(row => row.runId === runId);
        if (!saved) return fail('战斗回执不可用，请重新进入');
        activeSortie = null;
        onChange();
        return pass('战斗结果已保存', { rewards: copy(saved.settlementRewards || []), replica: copy(saved) });
      }
      return recordReplicaSortie(result, runId);
    }
    if (state.processedRuns.includes(runId)) return fail('战斗已结算或无有效快照');
    const trial = activeSortie.trial || result.debugRun;
    const won = result.won ?? result.victory;
    const firstClear = !trial && !result.abandoned && won && Number(result.stageIndex) === 0
      ? claimStageOneWeapon() : null;
    if (firstClear && !firstClear.ok && getCampaign().results?.[`${stages[0]?.id}:easy`]?.cleared) return firstClear;
    let supplyAfterBattle=null;
    if (!trial && !result.abandoned) {
      const time=currentTime();
      try{supplyAfterBattle=recordPilotSupplyBattle(state.pilotSupply,time,{won:Boolean(won),taskCounters:taskCounters(time)});}
      catch(error){return fail(error.message);}
    }
    state.processedRuns.push(runId); state.processedRuns = state.processedRuns.slice(-50); activeSortie = null;
    const materialReward = !trial && !result.abandoned ? sortieMaterialReward(result.stageIndex ?? 0, won) : {};
    const firstMaterials = !trial && !result.abandoned && won && result.firstMainlineClear === true
      ? firstClearMaterialReward(result.stageIndex ?? 0) : {};
    let gearRewards=[];
    if (!trial && !result.abandoned) {
      state.pilotSupply=supplyAfterBattle;
      count('sorties');
      if (won) count('victories');
      // Existing campaign code is the sole grantor of coins/diamonds.
      grantReward(materialReward);
      grantReward(firstMaterials);
      const gearLoot=grantGearSortie(state.equipment,{stageIndex:result.stageIndex,won:!!won,rng});
      state.equipment=gearLoot.state;gearRewards=gearLoot.rewards;
    }
    syncPilotUnlocks(); syncSamplePatrol(); if(!commit())return fail(storageWarning); return pass('出击记录已更新', { rewards: [...rewardItems(materialReward),
      ...rewardItems(firstMaterials).map(reward => ({ ...reward, source: 'first-clear' })), ...gearRewards, ...(firstClear?.rewards || [])] });
  }
  function snapshot() {
    if (storageCurrent()) {
      syncDay(); if(!state.dailyRewardReceipt && !unsavedPatrolReward)syncPilotUnlocks(); syncSamplePatrol();
      if(recoverReplicaSettlement())recoverInterruptedSortie();syncStarterGrants();
      if (!state.replicaMainline && !activeSortie && !state.dailyRewardReceipt && !unsavedPatrolReward && !state.firstClearWeaponClaimed) claimStageOneWeapon();
    }
    const flightRewards = state.flightRewards ?? flightLedger(null,loadDailyLoginState(storage));
    // A stale page may be rendered before its first period sync; display only.
    const periods = {daily:state.daily || {counters:{},claimed:[]},weekly:state.weekly || {counters:{},claimed:[]}};
    const collection = inventory(), ownedPilots = pilots().owned, selected = state.aircraft[state.aircraftId];
    const loadout = currentLoadout();
    const incomeStage = highestLegacyClearedStage();
    const entryDetails=currentNativeDetails();
    const powerRating=entryDetails?{version:'native-v1',total:entryDetails.power,attack:entryDetails.attack,maxHp:entryDetails.hp}:null;
    const tasks = [...DAILY_TASKS, ...WEEKLY_TASKS].map(t => {
      const weekly = t.id.startsWith('weekly-'), period = weekly ? periods.weekly : periods.daily;
      const reward = period.claimed.includes(t.id)
        ? copy(period.rewardReceipts?.[t.id] || t.reward)
        : taskRewardForStage(t, incomeStage);
      return { ...copy(t), reward, activityPoints:TASK_ACTIVITY[t.id]||0, destination:TASK_DESTINATIONS[t.id], type: weekly ? 'weekly' : 'daily', description: rewardItems(reward).map(r => `${r.name} ×${r.amount}`).join(' · '),
        progress: Math.min(t.target, integer(period.counters[t.counter])), claimed: period.claimed.includes(t.id),
        pending:state.dailyRewardReceipt?.source?.type==='task' && state.dailyRewardReceipt.source.id===t.id,
        claimable: !state.dailyRewardReceipt && !period.claimed.includes(t.id) && integer(period.counters[t.counter]) >= t.target };
    });
    const weapons = Object.values(COMMON_WEAPONS).map(w => {
      const progress = collection.weaponProgress.weapons[w.id];
      const maxLevel = weaponLevelCap(progress.qualityRank);
      const cost = peripheralWeaponUpgradeCost(progress.level, progress.qualityRank);
      return { id: w.id, name: w.name, description: w.normal, role: w.role, modelId: w.modelId, color: w.color,
        level: progress.level, maxLevel, levelLimitMessage: weaponLevelLimitMessage(progress.qualityRank), qualityRank: progress.qualityRank, owned: progress.unlocked,
        nextMilestoneLevel: nextGrowthMilestone(progress.level, maxLevel),
        cost, damage: commonWeaponStats({ itemId: w.id, ...progress }).damage,
        canUpgrade: progress.unlocked && Boolean(cost) && profile.coins >= cost.coins && collection.weaponProgress.universalFragments >= cost.weaponParts,
        nextDamage: commonWeaponStats({ itemId: w.id, ...progress, level: cost ? progress.level + 1 : progress.level }).damage,
        interval: w.interval, mechanism: w.mechanic, qualityRules: w.qualityRules };
    });
    const campaign = getCampaign();
    const markPending=(rows,type,period)=>rows.map(row=>({...row,
      pending:state.dailyRewardReceipt?.source?.type===type && state.dailyRewardReceipt.source.id===row.id
        && (!period || state.dailyRewardReceipt.source.period===period),
      claimable:!state.dailyRewardReceipt && row.claimable,
    }));
    const achievements=currentAchievements();
    const nativeCollection = replicaCollectionSnapshot(state.replicaLoadout, state.replicaInventory, state.replicaCampaign);
    const pilotAppearanceId = NATIVE_PILOT_SKINS[nativeCollection.pilots.find(row => row.equipped)?.id] || state.pilotId;
    return nativeEconomyView({
      version: 1, playerName:nativePlayerIdentity(state.replicaPlayerIdentity,profile.playerName).name,
      playerRename:nativePlayerRenameQuote(state.replicaPlayerIdentity,state.replicaInventory,profile.playerName), pilotId: pilotAppearanceId, aircraftId: NATIVE_AIRCRAFT_SKINS[nativeCollection.skinId] || state.aircraftId,
      fleet:{revision:state.fleet.revision,mode:state.fleet.mode,...currentFleetBanks(),recruitPresentation:copy(state.fleet.recruitPresentation||null)},
      wallet: { ...replicaResourceWallet(state.replicaInventory), stamina: UNLIMITED_RESOURCES ? DEVELOPMENT_BALANCE : state.stamina,
        maxStamina: MAX_STAMINA, aircraftShards: state.aircraftShards, weaponParts: collection.weaponProgress.universalFragments, cores: state.replicaInventory.items[135] || 0 },
      replicaLoadout: copy(state.replicaLoadout),
      replicaCollection: nativeCollection,
      pilotSupply: {...pilotSupplySnapshot(state.pilotSupply,state.replicaInventory,state.replicaLoadout,currentTime(),state.replicaCampaign,taskCounters()),adBusy:flightAdBusy,adPending:Boolean(pendingFlightAd?.pilotSupply),adAvailable:typeof playShopAd==='function'},
      replicaCampaign: copy(state.replicaCampaign), onboarding: normalizeOnboarding(state.onboarding),
      nativeAcquisition: nativeAcquisitionSnapshot(state.replicaInventory,state.replicaCampaign,state.replicaClaims,state.equipment,currentTime()),
      flightRewards: {...flightRewardsSnapshot(flightRewards,state.replicaInventory,state.replicaCampaign,currentTime()),adBusy:flightAdBusy,adPending:Boolean(pendingFlightAd&&!pendingFlightAd.pilotSupply&&!pendingFlightAd.samplePatrol),adAvailable:typeof playShopAd==='function'},
      research: nativeResearchSnapshot(state.replicaLoadout, state.replicaInventory),
      starRewards: state.replicaLoadout?{...nativeStarRewardSnapshot(state.starRewards,state.replicaCampaign,stages.length*3),revision:state.replicaInventory.revision}:starRewards.snapshot(),
      shop: shop.snapshot(),
      pilots: AIRCRAFTS.map((p, index) => ({ id: p.id, name: p.name, image: p.image, avatar: p.avatar, lobbyPortrait: p.lobbyPortrait,
        callsign: p.callsign, title: p.title, aircraftId: p.id, aircraftName: p.aircraft,
        stars: state.pilotStars[p.id], maxStars: 5,copies:state.fleet.copies.pilot[p.id],activated:persistentPilot(p.id),
        description: pilotPassive(p.id, state.pilotStars[p.id]).description, skillName: PERIPHERAL_PILOT_PASSIVES[p.id].name,
        passiveDescription: pilotPassive(p.id, state.pilotStars[p.id]).description,
        passive: pilotPassive(p.id, state.pilotStars[p.id]), nextPassive: state.pilotStars[p.id] < 5 ? pilotPassive(p.id, state.pilotStars[p.id] + 1) : null,
        color: p.color, rarity: p.rarity, owned: ownPilot(p.id),
        temporaryUnlocked: !persistentPilot(p.id) && temporaryPilots().includes(p.id),
        unlockText: index ? `招募或通关第 ${index} 关获得同名卡` : '初始人物' })),
      aircraft: PERIPHERAL_AIRCRAFT.map(a => { const level = state.aircraft[a.id].level;
        const starGrowth=aircraftGrowth(Math.max(1,state.fleet.aircraftStars[a.id]));
        const baseCurrent=aircraftGrowth(level),baseNext=aircraftGrowth(level+1);
        const current={attack:baseCurrent.attack*starGrowth.attack,hp:baseCurrent.hp*starGrowth.hp},next={attack:baseNext.attack*starGrowth.attack,hp:baseNext.hp*starGrowth.hp};
        return { ...a,
        level, stars:state.fleet.aircraftStars[a.id],maxStars:5,copies:state.fleet.copies.aircraft[a.id],maxLevel: PERIPHERAL_MAX_LEVEL, nextMilestoneLevel: nextGrowthMilestone(level, PERIPHERAL_MAX_LEVEL),
        owned: ownAircraft(a.id), loadout: copy(state.aircraft[a.id].slots), aircraftName: a.name, attack: Math.round(a.baseAttack * current.attack),
        nextAttack: Math.round(a.baseAttack * next.attack),
        hp: Math.round(a.baseHp * current.hp),
        nextHp: Math.round(a.baseHp * next.hp),
        nextStarAttack:Math.round(a.baseAttack*baseCurrent.attack*aircraftGrowth(Math.min(5,state.fleet.aircraftStars[a.id]+1)).attack),
        nextStarHp:Math.round(a.baseHp*baseCurrent.hp*aircraftGrowth(Math.min(5,state.fleet.aircraftStars[a.id]+1)).hp),cost: aircraftUpgradeCost(level),
        canUpgrade: ownAircraft(a.id) && Boolean(aircraftUpgradeCost(level)) && profile.coins >= aircraftUpgradeCost(level).coins && state.aircraftShards >= aircraftUpgradeCost(level).aircraftShards }; }),
      weapons, loadout: copy(selected.slots), loadoutToken:fitToken(state.aircraftId,selected.slots), innateWeapon: PERIPHERAL_AIRCRAFT_MAP.get(state.aircraftId).weaponId,
      workshop: createWorkshopSnapshot(collection.weaponProgress, { slots: selected.slots, aircraft: state.aircraft }),
      stages: stages.map((stage, index) => {
        const results = Object.entries(campaign.results || {}).filter(([key]) => key.startsWith(`${stage.id}:`)).map(([, value]) => value);
        const nativeChapter = replicaChapterForStage(index);
        const stars = nativeChapter ? countReplicaStars(state.replicaCampaign.starMasks?.[nativeChapter.id] || 0) : 0;
        const bestCleared = Boolean(nativeChapter && state.replicaCampaign.clearedChapterIds.includes(nativeChapter.id));
        return { ...stage, ...(nativeChapter ? { waveCount: nativeChapter.waveCount, replicaChapterId: nativeChapter.id } : {}), index, chapter: stage.chapter || `第 ${index + 1} 章`,
        chapterName: stage.chapterName || stage.arc || `第 ${index + 1} 章 · ${stage.name}`,
        unlocked: replicaStageAccessible(index, state.replicaCampaign.highestUnlocked),
        stars, bestCleared, progressText: bestCleared ? stars ? `已通关 · ${stars} 星` : '已通关' : '未通关',
        bestScore: Math.max(0, ...results.map(value => integer(value.bestScore))) };
      }),
      selectedStageIndex: getSelectedStage(), power: entryDetails?.power ?? null, powerRating,
      nativeStats: entryDetails ? copy(entryDetails) : null,
      patrol: {...samplePatrolSnapshot(state.samplePatrol,state.replicaCampaign,currentTime(),state.replicaInventory.revision,state.replicaLoadout),
        adAvailable:typeof playPatrolAd==='function',adBusy:flightAdBusy,adPending:Boolean(pendingFlightAd?.samplePatrol),
        staminaUnlimited:UNLIMITED_RESOURCES},
      equipment: replicaGearSnapshot(state.equipment,state.replicaInventory),
      equipmentBoxReceipt: copy(state.replicaEquipmentBoxReceipt || null),
      battleMaterials: battleMaterialSnapshot(state.replicaBattleMaterials),
      visualLoadout: { weapons: loadout.weapons.map(row => ({ itemId: row.itemId, slots: [...row.slots], innate: Boolean(row.innate) })) },
      combatStats: entryDetails ? {attack:entryDetails.attack,maxHp:entryDetails.hp} : null,
      growth: { maxLevel: PERIPHERAL_MAX_LEVEL, aircraftCost: aircraftUpgradeCost(selected.level),
        weaponCosts: Object.fromEntries(weapons.map(w => [w.id, w.cost])) },
      recruitHistory: copy(state.recruitHistory),
      pools: [{ id: 'pilot', key: 'aircraft_permanent', type: 'pilot', name: '驾驶员补给', description: '人物基础概率 20% · 通用飞机碎片 80%' },
        { id: 'weapon', key: 'weapon_permanent', name: '武器补给', description: '完整武器 · 重复转通用强化零件' }].map(pool => ({ ...pool,
        singleCost: RECRUIT_SINGLE_COST, tenCost: RECRUIT_TEN_COST, totalPulls: pool.id === 'pilot' ? state.pilotRecruit.totalPulls : collection.pools[pool.key]?.totalPulls || 0,
        probabilityLabels: pool.id === 'pilot' ? { pilot: '人物（基础概率）', shards: '通用飞机碎片 ×10' } : { white: '重复：10 零件', green: '重复：15 零件', blue: '重复：20 零件', purple: '重复：30 零件', gold: '重复：50 零件' },
        probabilities: pool.id === 'pilot' ? { pilot: PILOT_DRAW_CHANCE, shards: 1 - PILOT_DRAW_CHANCE } : Object.fromEntries(Object.entries(GACHA_POOLS[pool.key].qualityProbabilities).map(([key, value]) => [key, value / 100])),
        pity: pool.id === 'pilot' ? { pilot: state.pilotRecruit.pity, ssr: state.pilotRecruit.ssrPity, ur: state.pilotRecruit.urPity }
          : { ...copy(collection.pools[pool.key]?.pity || {}), newWeapon: collection.pools[pool.key]?.newWeaponMisses || 0 },
        pityDetails: pool.id === 'pilot' ? [{ id: 'pilot', triggerAt: PILOT_PITY }, { id: 'ssr', triggerAt: PILOT_SSR_PITY }, { id: 'ur', triggerAt: PILOT_UR_PITY }]
          : [...GACHA_POOLS[pool.key].pityRules.map(r => ({ id: r.id, triggerAt: r.triggerAt })), { id: 'newWeapon', triggerAt: WEAPON_NEW_PITY }],
        guaranteeText: pool.id === 'pilot'
          ? `人物 ≤${PILOT_PITY - state.pilotRecruit.pity} 抽 · SSR及以上 ≤${PILOT_SSR_PITY - state.pilotRecruit.ssrPity} 抽 · UR ≤${PILOT_UR_PITY - state.pilotRecruit.urPity} 抽`
          : weapons.some(w => !w.owned) ? `新武器 ≤${WEAPON_NEW_PITY - (collection.pools[pool.key]?.newWeaponMisses || 0)} 抽 · 首次解锁，重复转零件` : '武器已集齐 · 重复获得转通用强化零件',
        duplicateText: pool.id === 'pilot' ? (state.fleet.mode==='manual'?'同名驾驶员卡用于手动激活、升星，最高5星；抽中驾驶员时同时获得对应机体卡。已收集足够升满星的同稀有度成员会让位给其他成员，整档完成后转为30枚飞机碎片。':'首次解锁为0星；重复同名人物自动升1星，最高5星。整档满星后转为30枚飞机碎片。') : '重复武器按补给档位转化为 10 / 15 / 20 / 30 / 50 个通用强化零件；不会提升武器品质。',
        rules: pool.id === 'pilot' ? [
          `当前剩余上限：人物 ${PILOT_PITY - state.pilotRecruit.pity} 抽；SSR或UR ${PILOT_SSR_PITY - state.pilotRecruit.ssrPity} 抽；UR ${PILOT_UR_PITY - state.pilotRecruit.urPity} 抽。`,
          `非保底抽取：人物基础概率 ${PILOT_DRAW_CHANCE * 100}%，否则获得通用飞机碎片 ×${PILOT_SHARDS}。最多 ${PILOT_PITY} 抽必出人物；人物结果重置该计数。`,
          `最多 ${PILOT_SSR_PITY} 抽必出SSR或UR，最多 ${PILOT_UR_PITY} 抽必出UR。所有抽取（包括碎片）均累计，单抽十连共享，切池或重启不清零。SSR重置SSR计数，UR同时重置SSR与UR计数；高阶保底也会重置人物计数。`,
          '非高阶保底的人物稀有度：R / SR / SSR / UR = 74% / 20% / 5% / 1%。选定稀有度后，在尚未获得或尚未满星的人物中等概率抽取；该档全部满星才转为飞机碎片。SSR保底按SSR:UR = 5:1选取；UR保底优先。同一抽只发一份结果，不叠发。表中为基础概率，不含保底。',
          state.fleet.mode==='manual'?'高阶保底不保证新人物。获得同名驾驶员卡及对应机体卡后，分别在驾驶员、战机页手动激活或升星，每次消耗1张，最高5星。已收集足够升满星的成员会让位给同稀有度其他成员；整档完成后转为30枚飞机碎片。通关、签到赠送不清空招募保底。':'高阶保底不保证新人物，但该稀有度仍有未满星人物时不会抽中满星者。首次招募人物同时解锁专属战机；重复人物升1星，最多5星。通关赠送、签到等不清空招募保底。',
          `单次 ${RECRUIT_SINGLE_COST} 钻石，十次 ${RECRUIT_TEN_COST} 钻石。已有角色、星级、累计抽数及人物保底保留；新增高阶计数从最近记录恢复可确认的连续未出次数，缺失历史不猜测、不追溯补奖。`]
          : ['首次获得解锁普通（0 星）武器；下列档位仅决定重复获得的零件数量，不代表武器品质。',
            `通用武器共20种，非新武器保底时每件5%。尚未集齐时，连续 ${WEAPON_NEW_PITY - 1} 抽没有新武器，下一抽从未解锁武器中等概率抽取；抽到新武器清零。已集齐后不触发新武器保底，品质升星仍在改装间进行。`,
            `当前补给档位保底：最多 ${Math.max(1, 10 - (collection.pools[pool.key]?.pity?.purple || 0))} 抽获得紫档或金档，最多 ${Math.max(1, 60 - (collection.pools[pool.key]?.pity?.gold || 0))} 抽获得金档。`,
            '紫/金补给档位原有10/60抽计数保留。新武器保底与档位保底可同抽触发，但仍只发一份武器结果：首次解锁，重复按档位转零件，不会首次解锁又加送零件。',
            '单抽十连共享保底，切池或重启不清零。正常资源新档从初始武器开始；老档已解锁内容全部保留。下列档位概率为非保底基础概率。'] })),
      tasks, rewardPending:Boolean(!Object.hasOwn(state,'flightRewards') || state.dailyRewardReceipt || unsavedPatrolReward || pendingFlightAd || state.shop?.pending || state.starRewards?.pending),
      rewardBusy:Boolean(flightAdBusy || patrolAdBusy || shop.busy),
      pendingReward:state.dailyRewardReceipt?.source||(unsavedPatrolReward?{...unsavedPatrolReward.options.source,unsaved:true}:null),
      activity:Object.fromEntries(['daily','weekly'].map(period=>{const activity=activitySnapshot(period,tasks,periods[period]);return [period,{...activity,items:markPending(activity.items,'activity',period)}];})),
      achievements:{...achievements,items:markPending(achievements.items,'achievement')},
      signIn: flightRewardsSnapshot(flightRewards,state.replicaInventory,state.replicaCampaign,currentTime()).signIn,
      staminaDescription: UNLIMITED_RESOURCES ? '网页测试：体力无限，出击和快速巡逻不扣体力。' : `每次出击消耗 ${SORTIE_STAMINA} 点体力。每 ${STAMINA_INTERVAL_MS / 60000} 分钟恢复 1 点，自然恢复至 ${MAX_STAMINA} 点。`,
      migration: copy(state.migration), storageWarning,
    });
  }
  if(state.equipment.migrationRefund&&!state.dailyRewardReceipt){
    const next=copy(state),refund=next.equipment.migrationRefund;delete next.equipment.migrationRefund;
    deliverDaily(next,{coins:refund.coins},{source:{type:'equipment-migration'},walletSource:'legacy',rewards:[],message:''});
  }
  function completeBattleGuide(runId,group) {
    if (!storageCurrent()) return false;
    if(!activeSortie||activeSortie.snapshot.id!==runId||activeSortie.snapshot.engine!=='danke-replica-v1'||activeSortie.trial||![1,4].includes(group))return false;
    if(group===1&&activeSortie.snapshot.chapterId!==1)return false;
    if(guideFinished(state,group))return true;
    const previous=state.onboarding;state.onboarding=completeGuide(previous,group);
    if(!persist()){state.onboarding=previous;return false;}
    return true;
  }
  return { completeBattleGuide, snapshot, action, prepareSortie, recordSortie, checkpointSortie, replicaConfiguration, acceptReplicaLoadoutDetails, developerToolsAccess, getAircraftId: () => state.aircraftId,
    get replicaResults() { if(recoverReplicaSettlement())recoverInterruptedSortie(); return copy(state.replicaResults || []); },
    get state() { return copy(state); } };
}
