import { validateReplicaConfiguration, replicaConfigurationKey } from '../src/replica/loadout-contract';
import { calculateStudyLoadout } from './kernel/loadout-state';
import { chapterWeaponBanSkillIds } from '../src/replica/chapter-weapon-access.js';
import type { LoadoutCatalog } from './kernel/loadout-state';

/** A fresh native state for each sortie. Never read the research project's
 * localStorage, translate host statModifiers, or convert art IDs into skills. */
export function prepareReplicaLoadout(catalog: LoadoutCatalog, value: unknown) {
  const configuration = validateReplicaConfiguration(value);
  const state = configuration.progression;
  // Recomputed for every sortie; never persist synthetic laboratory records.
  state.weaponSelectionBanSkillIds = chapterWeaponBanSkillIds(configuration.weaponChapterProgress, state.labs);
  for (const entry of configuration.equipment) {
    const row = catalog.equipment.find(row => Number(row.id) === entry.id);
    if (!row || Number(row.slot) !== entry.slot) {
      throw new Error(`装备目录与战前配置不一致：${entry.id}`);
    }
  }
  state.equipment = configuration.equipment.map(entry => ({ ...entry }));
  const result = calculateStudyLoadout(catalog, state);
  // Missing visuals may use existing replica fallback art. Missing mechanics
  // cannot be silently discarded while claiming numerical parity.
  const unsupported = result.unsupportedEffects.filter(effect =>
    effect.source !== '战机外观' && effect.source !== '人物外观');
  if (unsupported.length) {
    throw new Error(`当前配置仍有未实现的原版效果：${unsupported.map(effect => effect.description).join('；')}`);
  }
  return { state, configuration, key: replicaConfigurationKey(configuration), entry: {
    attack: result.attack, hp: result.hp,
    initialSkillIds: result.initialSkillIds, battleSkillIds: result.battleSkillIds,
    selectedGunId: result.selectedGunId, selectedSkinId: result.selectedSkinId,
    selectedPilotId: result.selectedPilotId,
  } };
}
