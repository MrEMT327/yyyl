import source from '../public/data/skill-selection.json';

type EligibilityRow = {
  id: number; MaxCount: number; NeedSkills: number[];
  PreSkillIds: number[]; PreLogicType: number; RejectSkills: number[];
};
const rows = source.skills as Record<number, EligibilityRow>;

/** EntityCharacter.ArePrerequisitesSatisfied 0x6bc5c90.
 * This is the application-time prerequisite, separate from pool NeedSkills.
 * PreLogicType 0 means ANY, 1 means ALL; other values impose no condition. */
export function nativeSkillPrerequisitesMet(id: number, known: ReadonlySet<number>): boolean {
  const row = rows[id];
  if (!row) return false;
  if (!row.PreSkillIds.length) return true;
  if (row.PreLogicType === 0) return row.PreSkillIds.some(pre => pre > 0 && known.has(pre));
  if (row.PreLogicType === 1) return row.PreSkillIds.every(pre => pre <= 0 || known.has(pre));
  return true;
}

/** GameUtils.CheckCanStudySkill 0x6d0ea0c counts exact ID occurrences.
 * Include the initial main weapon and previously learned parent stages in
 * history; CoverSkill never erases them. Repeatable minor IDs stay repeated. */
export function nativeSkillBelowMaxCount(id: number, history: readonly number[]): boolean {
  const row = rows[id];
  if (!row) return false;
  let count = 0;
  for (const learnedId of history) if (learnedId === id) count++;
  return count < row.MaxCount;
}

/** WeightRandomData maintains remaining NeedSkills (ALL), and learns reject
 * targets from each already-learned row. RejectSkills is directional: learning
 * A removes IDs listed by A, not the reverse. APK battle rows have zero flags,
 * so this helper deliberately covers the observed ID-based rules only. */
export function nativeSkillPoolEligible(id: number, known: ReadonlySet<number>): boolean {
  const row = rows[id];
  if (!row || !row.NeedSkills.every(needed => known.has(needed))) return false;
  for (const learnedId of known) if (rows[learnedId]?.RejectSkills.includes(id)) return false;
  return true;
}

/** Caller still applies supported-weapon filtering, pool membership and slots.
 * Parent-stage advancement and child application must be recorded only once. */
export function nativeSkillEligible(id: number, history: readonly number[]): boolean {
  const known = new Set(history);
  return nativeSkillBelowMaxCount(id, history)
    && nativeSkillPoolEligible(id, known)
    && nativeSkillPrerequisitesMet(id, known);
}
