import { isRosterPilot } from '../../src/replica/native-pilot-roster.js';
import { nativePilotDisplayName } from '../../src/replica/native-pilot-names.js';
import { nativeSkillDescription } from '../../src/replica/native-skill-description.js';
import type { Choice, GameContent, RecordData } from './model';
import type { LoadoutCatalog } from './loadout-state';
import { inspectLoadoutSkillSupport } from './special-skill-runtime';
import { runtimeWeaponFamilyEnabled } from './content-capabilities';

export type DeveloperSkill = {
  id: number; category: 'weapon' | 'passive' | 'pilot' | 'plane';
  name: string; description: string; label: string; familyId?: number;
  variants?: number[]; parentStageIds?: number[]; unavailable?: string[]; choice: Choice;
};
const plain = (value: unknown) => String(value || '').replace(/<[^>]*>/g, '').replace(/\\n/g, '\n');

/** The allowlist contains player skills with implemented runtime dependencies.
 * Enemy/system rows are deliberately not exposed by the development picker. */
export function buildDeveloperSkillCatalog(content: GameContent, catalog: LoadoutCatalog): DeveloperSkill[] {
  const combat = content.combat, result = new Map<number, DeveloperSkill>();
  const rows = new Map<number, RecordData>(catalog.allSkills.map(row => [Number(row.id), row]));
  const add = (id: number, category: DeveloperSkill['category'], label: string, familyId?: number, star?: number, variants?: number[]) => {
    const source = rows.get(id), raw = combat.skillRows[id];
    if (!source || !raw) return;
    const card = combat.cards[id], family = familyId && combat.families[familyId];
    const stage = family?.stages.find((item: RecordData) => item.skillId === id);
    // A branch's SkillStar is its own rank, not the weapon stage that offers it.
    // Include alternate-mode attribute cards exposed by the development catalog.
    const nativeParents: RecordData[] = stage ? [] : (family?.stages || []).filter((item: RecordData) =>
      [...(item.optionIds || []), ...(item.unlockIds || [])].includes(id));
    const parents: RecordData[] = nativeParents.length || stage ? nativeParents : (family?.stages || [])
      .filter((item: RecordData) => (item.raw?.UpgradeSkillId_B || []).includes(id));
    const parentStageIds = parents.map(item => Number(item.skillId));
    if (card?.supported === false || stage?.supported === false) return;
    const support = !card && !stage ? inspectLoadoutSkillSupport(raw, catalog.runtime || combat) : undefined;
    const name = plain(source.name || card?.name || family?.name);
    if (!name || /^SkillName_|^\d+$/.test(name)) return;
    const descriptionText = plain(nativeSkillDescription({ id, description: source.description || card?.descriptionSource }, catalog.runtime || combat));
    const description = /^SkillDesc_|^\d+$/.test(descriptionText) ? '' : descriptionText.replace(/\{(\d+)\}/g, (_match, index) => String(raw.LanguageInfoArgs?.[Number(index)] ?? ''));
    const choice: Choice = { ...card, id, name, description, group: familyId || Number(card?.familyId || id),
      star: star || stage?.star || parents[0]?.star || raw.SkillStar || 1, icon: family?.icon || raw.IconName || '',
      effects: card?.effects || stage?.effects || [], raw,
      advance: stage ? id : undefined, parentStageId: parentStageIds[0], opensBreakthrough: false };
    result.set(id, { id, category, label, name, description, familyId, variants, parentStageIds, unavailable: support && !support.supported ? support.reasons : undefined, choice });
  };
  for (const family of Object.values(combat.families) as RecordData[]) {
    if (!runtimeWeaponFamilyEnabled(family.id)) continue;
    for (const stage of family.stages) add(stage.skillId, 'weapon', `${family.name} · Lv.${stage.star}`, family.id);
    for (const card of Object.values(combat.cards) as RecordData[])
      if (card.familyId === family.id) add(card.id, 'weapon', family.name, family.id);
  }
  for (const id of combat.poolCatalog.passiveCardIds) add(id, 'passive', `强化 · Lv.${combat.skillRows[id]?.SkillStar || 1}`);
  for (const [key, category] of [['pilots', 'pilot'], ['planes', 'plane']] as const) {
    for (const owner of catalog[key]) {
      if (key === 'pilots' && !isRosterPilot(owner.id)) continue;
      const ownerName = key === 'pilots' ? nativePilotDisplayName(owner.id) || owner.name : owner.name;
      const variants: number[] = owner.skillIds || [];
      for (const [index, id] of variants.entries()) add(id, category, `${ownerName} · ${index + 1}星`, undefined, index + 1, variants);
    }
  }
  return [...result.values()];
}

/** Plan atomically before touching a live battle. Prerequisites are native rows;
 * development access only bypasses ownership, chapter, slot and random gates. */
export function planDeveloperSkill(content: GameContent, entries: DeveloperSkill[], id: number, history: number[]) {
  const entry = entries.find(item => item.id === id);
  if (!entry) throw new Error('该技能尚未接入');
  if (entry.unavailable) throw new Error('该技能的战斗行为尚未接入，暂不能试用');
  const combat = content.combat, known = new Set(history), pending = new Set<number>();
  const choices: Choice[] = [], external: number[] = [];
  const removed = new Set(entry.variants?.filter(value => value !== id) || []);
  for (const value of removed) known.delete(value);
  const raw = combat.skillRows[id];
  if (history.filter(value => value === id).length >= Math.max(1, Number(raw.MaxCount || 1))) return { choices, external, removed: [], entry };
  // Native RejectSkills are directional; conflicting branches remain a deliberate
  // choice rather than silently running mutually exclusive mods together.
  for (const learned of known) if (combat.skillRows[learned]?.RejectSkills?.includes(id) || raw.RejectSkills?.includes(learned))
    throw new Error('与本局已选分支互斥，请在新一局体验此分支');
  const include = (skillId: number, repeat = false) => {
    if (known.has(skillId) && !repeat) return;
    if (pending.has(skillId)) throw new Error('技能前置关系循环');
    const row = combat.skillRows[skillId];
    if (!row) throw new Error(`技能依赖未接入：${skillId}`);
    // Entries already passed their battle-card or loadout-specific admission.
    // Hidden prerequisite rows still need the conservative dependency check.
    if (!entries.some(item => item.id === skillId) && !inspectLoadoutSkillSupport(row, combat).supported) throw new Error(`技能依赖未接入：${skillId}`);
    pending.add(skillId);
    const candidate = entries.find(item => item.id === skillId);
    const family = candidate?.familyId && combat.families[candidate.familyId];
    if (family && skillId !== family.id) include(family.id);
    if (row.CoverSkill && !entry.variants?.includes(row.CoverSkill)) include(Number(row.CoverSkill));
    for (const needed of row.NeedSkills || []) include(Number(needed));
    const prerequisites: number[] = (row.PreSkillIds || []).filter((value: number) => value > 0);
    if (row.PreLogicType === 1) for (const needed of prerequisites) include(needed);
    else if (row.PreLogicType === 0 && prerequisites.length && !prerequisites.some(value => known.has(value))) include(prerequisites[0]);
    // Pilot attacks act on a particular secondary weapon. Install that root too.
    if (entry.category === 'pilot') for (const weapon of Object.values(combat.families) as RecordData[]) {
      const entity = combat.entities[weapon.entityId];
      if (row.TargetCharacterId?.includes(weapon.entityId) || row.TargetCharacterType?.includes(entity.SecondWeapenType)) include(weapon.id);
    }
    if (candidate?.category === 'pilot' || candidate?.category === 'plane' || !candidate) external.push(skillId);
    else {
      const parents: number[] = candidate.parentStageIds || [];
      // Use an already reached parent when possible. Applying the child must
      // neither lower the weapon nor count the parent's attributes twice.
      const parentStageId = [...parents].reverse().find(value => known.has(value)) || parents[0];
      if (parentStageId) include(parentStageId);
      const parent = family?.stages.find((stage: RecordData) => stage.skillId === parentStageId);
      choices.push({ ...candidate.choice, parentStageId, star: parent?.star || candidate.choice.star });
    }
    known.add(skillId); pending.delete(skillId);
  };
  include(id, true);
  return { choices, external, removed: [...removed], entry };
}
