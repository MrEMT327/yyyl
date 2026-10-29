export function nativeResultRows(settlement) {
  return (settlement?.rewards || []).map(row => ({
    ...row,
    label: (row.firstClear ? '首通 · ' : '') + row.name,
    amount: String(row.amount),
  }));
}

export function nativeResultRecommendations(chapter, combat) {
  const parameters = chapter.parameters || chapter.raw || {};
  const ids = (combat.mode === 'B' ? parameters.SuggestedSkills_B : parameters.SuggestedSkills) || [];
  const skills = ids.map(skillId => {
    const family = Object.values(combat.families).find(row => row.id === skillId || row.stages.some(stage => stage.skillId === skillId));
    return {skillId, familyId: family?.id, name: family?.name || `技能 ${skillId}`};
  });
  const availableFunctions = {2:'装备',4:'科研'};
  return skills.concat((parameters.SuggestedFunction || []).filter(id => availableFunctions[id])
    .map(functionId => ({functionId, name:availableFunctions[functionId]})));
}
