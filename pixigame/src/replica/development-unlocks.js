import { UNLOCK_ALL_CONTENT } from '../development-resources.js';
import catalog from './native-economy-catalog.json' with { type: 'json' };
import research from './native-research-source.json' with { type: 'json' };
import equipment from '../peripheral/equipment-reference-data.json' with { type: 'json' };
import { gearStage } from '../peripheral/equipment-system.js';
import { isRosterPilot } from './native-pilot-roster.js';
import { nativeLabActivation } from './native-laboratory.js';
import { validateReplicaProgression } from './native-progression.js';

// Local development access is separate from native defaults and reward receipts.
// Preserve a pre-unlock snapshot, existing growth, equipment slots and selections.
export function prepareDevelopmentUnlocks(state, enabled = UNLOCK_ALL_CONTENT) {
  if (!state.replicaLoadout || !state.replicaInventory || !state.equipment) return false;
  if (!enabled) {
    const backup = state.developmentUnlockBackup;
    if (!backup) return false;
    state.replicaLoadout = validateReplicaProgression(backup.progression);
    state.equipment = structuredClone(backup.equipment);
    state.replicaInventory.revision++;
    delete state.developmentUnlockBackup;
    delete state.developmentUpgradeVersion;
    return true;
  }
  const progression = validateReplicaProgression(state.replicaLoadout);
  const gear = structuredClone(state.equipment);
  const before = JSON.stringify([progression, gear]);
  // One-time developer migration: make every authored upgrade usable. Keep
  // equipped actors/skill slots intact; later lab preview choices survive reload.
  const grantUpgrades = state.developmentUpgradeVersion !== 1;
  for (const kind of ['skins', 'guns', 'pilots']) {
    for (const row of catalog[kind]) {
      if (kind === 'pilots' && !isRosterPilot(row.id)) continue;
      const existing = progression[kind].find(entry => entry.id === row.id);
      if (existing) existing.active = true;
      else progression[kind].push({ id: row.id, star: row.defaultStar, active: true, equipped: false });
    }
  }
  for (const row of catalog.labs) {
    let entry = progression.labs.find(entry => entry.id === row.id);
    if (!entry) {
      entry = { id: row.id, level: row.levels[0].level, active: true };
      progression.labs.push(entry);
    }
    // Unlock access without erasing a purchased milestone awaiting activation.
    Object.assign(entry, { active: true, ...nativeLabActivation(entry) });
  }
  if (grantUpgrades) {
    for (const kind of ['skins', 'guns', 'pilots']) for (const entry of progression[kind]) {
      const row = catalog[kind].find(row => row.id === entry.id);
      entry.star = Math.max(...row.stages.map(stage => stage.star));
    }
    const skin = progression.skins.find(row => row.id === progression.role.skinId);
    if (skin) progression.role.skinStar = skin.star;
    for (const entry of progression.labs) {
      const row = catalog.labs.find(row => row.id === entry.id);
      entry.level = Math.max(...row.levels.map(level => level.level));
      Object.assign(entry, { activationKnown: true, needActive: false, confirmedSkillLevel: entry.level });
    }
    progression.nativeResearch = { version: 1, levels: Object.fromEntries(research.cards.map(row => [row.ID, row.maxLv])) };
  }
  const owned = new Set(gear.items.map(item => item.family + item.quality));
  for (const row of equipment.equip) {
    if (owned.has(row.ID)) continue;
    // Some source S-rank placeholders have no quality/growth row. They are
    // not usable equipment and must not bypass the normal save validation.
    if (!gearStage({ family: row.ID - row.quality, quality: row.quality })) continue;
    gear.items.push({ uid: `gear-${++gear.serial}`, family: row.ID - row.quality, quality: row.quality, locked: false });
    owned.add(row.ID);
  }
  if (!grantUpgrades && before === JSON.stringify([progression, gear])) return false;
  state.developmentUnlockBackup ||= { version: 1, progression: structuredClone(state.replicaLoadout), equipment: structuredClone(state.equipment) };
  if (gear.items.length !== state.equipment.items.length) gear.revision++;
  state.replicaLoadout = validateReplicaProgression(progression);
  state.equipment = gear;
  state.developmentUpgradeVersion = 1;
  state.replicaInventory.revision++;
  return true;
}
