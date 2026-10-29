import { advanceNativeLab, synchronizeNativeLabs } from './native-laboratory.js';
import { UNLOCK_ALL_CONTENT } from '../development-resources.js';
import { nativeLabProgressGate } from './native-client-rules.js';
import { isRosterPilot } from './native-pilot-roster.js';
import { grantPilotCards } from './pilot-copy-grants.js';
import { nativeCollectionDisplayName } from './native-collection-names.js';
import catalog from './native-economy-catalog.json' with { type: 'json' };
import { nativeSkillText } from './native-skill-text.js';
import { validateReplicaProgression, selectReplicaProgression } from './native-progression.js';

export const createReplicaInventory = () => ({ version: 1, revision: 0, items: {} });
export function validateReplicaInventory(value) {
  if (!value || value.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0 || !value.items || typeof value.items !== 'object' || Array.isArray(value.items)) throw new Error('原版材料存档无效');
  const items = {};
  for (const [id,count] of Object.entries(value.items)) {
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || !Number.isSafeInteger(count) || count < 0) throw new Error('原版材料数量无效');
    items[id] = count;
  }
  return { version: 1, revision: value.revision, items };
}
function costsFor(row, owned) {
  if (!owned?.active) return row.unlockCost;
  if (!row.stages.some(stage => stage.star === owned.star + 1)) return null;
  return row.stages.find(stage => stage.star === owned.star)?.cost;
}
function costRows(cost, inventory) {
  const totals = new Map();
  for (const [id,count] of cost || []) totals.set(id, (totals.get(id) || 0) + count);
  return [...totals].map(([id,count])=>({ id, name: nativeCollectionDisplayName(id) || catalog.itemNames[id] || `物品 ${id}`, count, available: inventory.items[id] || 0 }));
}
export function replicaCollectionSnapshot(value, rawInventory, campaign={}) {
  const progression = validateReplicaProgression(value), inventory = validateReplicaInventory(rawInventory);
  synchronizeNativeLabs(progression,nativeLabProgressGate(campaign));
  const result = { revision: inventory.revision, gold: inventory.items[1] || 0, slots: progression.skinSkillSlots.slice(),
    attributeNames: catalog.attributeNames, skinId: progression.role.skinId };
  for (const kind of ['guns','skins','pilots']) result[kind] = catalog[kind].flatMap(row => {
    if (kind === 'pilots' && !isRosterPilot(row.id)) return [];
    const entry = progression[kind].find(entry => entry.id === row.id), owned = Boolean(entry?.active);
    if (row.closed && !owned) return [];
    const stages = row.stages.map(stage => ({...stage, skills:stage.skills.map(nativeSkillText)}));
    const stage = stages.find(stage => stage.star === (owned ? entry.star : row.defaultStar));
    const cost = costsFor(row, entry), costs = costRows(cost, inventory);
    return [{ ...row, name:nativeCollectionDisplayName(row.id)||row.name, owned, star: owned ? entry.star : 0, stages, stage,
      equipped: kind === 'skins' ? row.id === progression.role.skinId : Boolean(entry?.equipped),
      maxed: owned && cost === null, costs,
      canPurchase: (!row.closed || UNLOCK_ALL_CONTENT) && Boolean(cost?.length) && costs.every(row=>row.available>=row.count) }];
  });
  result.labs = catalog.labs.map(row=>{
    const entry=progression.labs.find(entry=>entry.id===row.id);
    return {...row,active:Boolean(entry?.active),level:entry?.level||0,activationKnown:Boolean(entry?.activationKnown),needActive:entry?.needActive,confirmedSkillLevel:entry?.confirmedSkillLevel||0,
      levels:row.levels.map(level=>({...level,skills:level.skills.map(nativeSkillText),costs:costRows(level.cost,inventory)}))};
  });
  return result;
}

export function planNativeLabSynchronization(value,rawInventory,campaign) {
  const progression=validateReplicaProgression(value),inventory=validateReplicaInventory(rawInventory);
  synchronizeNativeLabs(progression,nativeLabProgressGate(campaign));
  if(JSON.stringify(progression)===JSON.stringify(value))return null;
  inventory.revision++;
  return {progression:validateReplicaProgression(progression),inventory:validateReplicaInventory(inventory)};
}

/** One save transaction: original IDs/costs only, no cloud balance or dev bypass. */
export function planReplicaCollection(value, rawInventory, operation, campaign={}) {
  let progression = validateReplicaProgression(value);
  const inventory = validateReplicaInventory(rawInventory);
  if (operation?.expectedRevision !== inventory.revision) throw new Error('养成记录已变化，请重新选择');
  const { kind, id, action } = operation;
  if (kind === 'pilots' && id !== 0 && !isRosterPilot(id)) throw new Error('该驾驶员已从正式名单移除');
  if (kind === 'labs') {
    advanceNativeLab(progression,inventory,operation,nativeLabProgressGate(campaign));
    progression=validateReplicaProgression(progression);
  } else if (action === 'select') {
    progression = selectReplicaProgression(progression, {kind,id});
  } else if (action === 'slot') {
    const slot = operation.slot;
    if (!Number.isInteger(slot) || slot < 0 || slot >= progression.skinSkillSlots.length) throw new Error('技能槽无效');
    if (id !== 0) {
      const owned = progression.skins.find(row=>row.id===id && row.active);
      const row = catalog.skins.find(row=>row.id===id)?.stages.find(row=>row.star===owned?.star);
      if (!row?.skills.length) throw new Error('尚未拥有该飞机技能');
    }
    const ids = progression.skinSkillSlots.map(old=>old===id?0:old); ids[slot] = id;
    progression = selectReplicaProgression(progression,{kind:'skinSkillSlots',ids});
  } else if (action === 'unlock' || action === 'star') {
    const row = catalog[kind]?.find(row=>row.id===id);
    if (!['guns','skins','pilots'].includes(kind) || !row || (row.closed && !UNLOCK_ALL_CONTENT)) throw new Error('该养成项目不可用');
    const owned = progression[kind].find(row=>row.id===id);
    if (action === 'unlock' ? Boolean(owned?.active) : !owned?.active) throw new Error('拥有状态已变化');
    // Girl Flight makes native weapon variants obtainable from its diamond box.
    const cost = costsFor(row, owned);
    if (!cost?.length) throw new Error('已满星或没有可用的原版消耗配置');
    const costs = costRows(cost, inventory);
    if (costs.some(row=>row.available<row.count)) throw new Error('原版材料不足');
    for (const item of costs) inventory.items[item.id] = item.available-item.count;
    const star = action === 'unlock' ? row.defaultStar : owned.star+1;
    if (!row.stages.some(row=>row.star===star)) throw new Error('缺少原版目标星级');
    if (kind === 'pilots' && action === 'unlock') {
      grantPilotCards(inventory,progression,id,1,{activate:true});
    } else if (owned) { owned.star=star; owned.active=true; }
    else progression[kind].push({id,star,active:true,equipped:false});
    if (kind === 'skins' && progression.role.skinId === id) progression.role.skinStar=star;
    progression = validateReplicaProgression(progression);
  } else throw new Error('未知的原版养成操作');
  inventory.revision++;
  if (!Number.isSafeInteger(inventory.revision)) throw new Error('养成记录版本超限');
  return { progression, inventory };
}

/** Called only inside the existing persisted, deduplicated battle receipt. */
export function replicaInventoryAfterSettlement(rawInventory, result) {
  const inventory=validateReplicaInventory(rawInventory);
  if (result.trial || result.abandoned) return inventory;
  const gold=Math.floor(result.gold);
  if (!Number.isSafeInteger(gold) || gold<0) throw new Error('战斗金币无效');
  const total=(inventory.items[1]||0)+gold;
  if (!Number.isSafeInteger(total)) throw new Error('战斗金币超限');
  inventory.items[1]=total; inventory.revision++;
  return validateReplicaInventory(inventory);
}
