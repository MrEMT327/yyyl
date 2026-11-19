import type { Choice, GameContent, RecordData } from './kernel/model';
import type { Simulation } from './kernel/simulation';
import mapping from './weapon-skin-correspondence.json';

export interface AppliedWeaponSkill {
  readonly skillId: number;
  readonly parentStageId: number;
  readonly star: number;
  readonly kind: 'minor' | 'breakthrough';
}
/** Immutable presentation identity. Never carries attack, clocks or hitboxes. */
export interface WeaponAppearance {
  readonly familyId: number;
  readonly entityId: number;
  readonly stageId: number;
  readonly star: number;
  readonly breakthroughs: number;
  readonly skills: readonly AppliedWeaponSkill[];
  readonly sourceSkillId?: number;
  readonly preview?: boolean;
}

const stages = mapping.stages as Record<string, { familyId: number; star: number; kind: string; childIds: number[] }>;
const branches = mapping.branches as Record<string, { familyId: number; kind: 'minor' | 'breakthrough' }>;

function isIntroCannonReinforcement(choice: Choice): boolean {
  return choice.id === 10400101 && choice.group === 10000101 && choice.star === 1
    && !choice.parentStageId && !choice.advance;
}

function branchForChoice(familyId: number, choice: Choice): AppliedWeaponSkill | undefined {
  // The tutorial grants an attribute directly, without learning a weapon parent.
  if (isIntroCannonReinforcement(choice)) return;
  const branch = branches[String(choice.id)];
  if (!branch || branch.familyId !== familyId || choice.opensBreakthrough) return;
  const parentId = choice.parentStageId || choice.advance || Number(Object.entries(stages).find(([, parent]) => parent.familyId === familyId
    && parent.star === choice.star && parent.childIds.includes(choice.id))?.[0]);
  const parent = stages[String(parentId)];
  if (!parent || parent.familyId !== familyId || !parent.childIds.includes(choice.id))
    throw new Error(`武器显示缺少真实父阶段：${familyId}/${choice.id}/${choice.star}`);
  return Object.freeze({ skillId: choice.id, parentStageId: parentId, star: parent.star, kind: branch.kind });
}

export function readWeaponAppearances(sim: Simulation): readonly WeaponAppearance[] {
  const families = Object.values(sim.content.combat.families) as RecordData[];
  return [
    ...(sim.mainWeaponEquipped ? [{ entityId: sim.content.chapter.player.weaponEntityId, state: sim.cannon }] : []),
    ...Array.from(sim.secondary, ([entityId, state]) => ({ entityId, state })),
  ].map(({ entityId, state }) => {
    const family = families.find(row => row.entityId === entityId);
    const stage = family?.stages.find((row: RecordData) => row.skillId === state.stageId);
    if (!family || !stage) throw new Error(`缺少武器显示阶段：${entityId}/${state.stageId}`);
    // Keep every applied child, including repeated minor IDs. The parent of a
    // two-card breakthrough is not a completed child and creates no fake form.
    const skills = sim.learned.filter(card => card.group === family.id).flatMap(card => {
      const branch = branchForChoice(family.id, card); return branch ? [branch] : [];
    });
    return Object.freeze({ familyId: family.id, entityId, stageId: stage.skillId, star: stage.star,
      breakthroughs: skills.filter(skill => skill.kind === 'breakthrough').length, skills: Object.freeze(skills) });
  });
}

/** Preview only the actual offered ID. No reroll, stat calculation or call to
 * Simulation.choose. Reward icons identify the already-granted child as well. */
export function previewWeaponAppearance(sim: Simulation, choice: Choice, preview = true): WeaponAppearance | undefined {
  const family = sim.content.combat.families[choice.group];
  if (!family) return;
  // Group 4's cannon reinforcement is an attribute card, not a weapon
  // stage/branch. Show the current cannon without inventing an upgrade stage.
  if(isIntroCannonReinforcement(choice)){
    const owned=readWeaponAppearances(sim).find(row=>row.familyId===family.id);
    if(owned)return Object.freeze({...owned,sourceSkillId:choice.id,preview});
    return;
  }
  const parentId = choice.parentStageId || choice.advance || (stages[String(choice.id)] ? choice.id : Number(Object.entries(stages).find(([, parent]) =>
    parent.familyId === family.id && parent.star === choice.star && parent.childIds.includes(choice.id))?.[0]));
  const stage = family.stages.find((row: RecordData) => row.skillId === parentId);
  if (!stage) throw new Error(`缺少选卡显示阶段：${choice.id}/${choice.star}`);
  const owned = readWeaponAppearances(sim).find(row => row.familyId === family.id);
  const skills = [...(owned?.skills || [])].filter(skill => skill.star < stage.star);
  const branch = branchForChoice(family.id, choice);
  if (branch) skills.push(branch);
  return Object.freeze({ familyId: family.id, entityId: family.entityId, stageId: stage.skillId, star: stage.star,
    breakthroughs: skills.filter(skill => skill.kind === 'breakthrough').length,
    skills: Object.freeze(skills), sourceSkillId: choice.id, preview });
}
