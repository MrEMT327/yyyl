export default [{
  path: 'loadout-state.ts', kind: 'gameplay-repair',
  reason: 'Share pure default save data with peripheral JS without importing the battle TypeScript dependency graph; preserve fresh independent saves.',
  replacements: [
    ["import nativeResearchSource from '../../src/replica/native-research-source.json';",
     "import nativeResearchSource from '../../src/replica/native-research-source.json';\nimport defaultLoadoutState from '../../src/replica/default-loadout-state.json';"],
    ["  return { version: 1, role: { id: 10100, level: 1, star: 0, starStep: 0, skinId: 0, skinStar: 0 },\n    equipment: [], skins: [], guns: [{ id: 20101, star: 1, active: true, equipped: true }], pilots: [],\n    skinSkillSlots: [0, 0, 0], labs: [], debugOverride: { enabled: false, attack: 100, hp: 600 } };",
     "  return structuredClone(defaultLoadoutState) as StudyLoadoutState;"],
    ["import nativeResearchSource from '../../src/replica/native-research-source.json';\nimport defaultLoadoutState from '../../src/replica/default-loadout-state.json';",
     "import nativeResearchSource from '../../src/replica/native-research-source.json' with { type: 'json' };\nimport defaultLoadoutState from '../../src/replica/default-loadout-state.json' with { type: 'json' };"]
  ]
}];
