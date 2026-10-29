export const WING_PROFILES = {
  'wing-swept': { key: 'swept', points: [[-18, -58], [-158, 24], [-92, 56], [-16, 23]] },
  'wing-razor': { key: 'razor', points: [[-17, -52], [-174, 5], [-76, 25], [-132, 62], [-15, 22]] },
  'wing-aegis': { key: 'aegis', points: [[-21, -50], [-126, -2], [-166, 45], [-92, 67], [-18, 29]] },
  'wing-falcon': { key: 'falcon', points: [[-16, -62], [-104, -15], [-168, 22], [-112, 25], [-72, 63], [-15, 24]] },
  'wing-prism': { key: 'prism', points: [[-18, -55], [-92, -20], [-160, 22], [-99, 35], [-61, 69], [-16, 22]] },
  'wing-borealis': { key: 'borealis', points: [[-20, -48], [-79, -28], [-154, 8], [-142, 48], [-74, 58], [-17, 26]] },
  'wing-tempest': { key: 'tempest', points: [[-17, -59], [-68, -28], [-116, -2], [-176, 34], [-99, 31], [-53, 68], [-15, 22]] },
  'wing-vanguard': { key: 'vanguard', points: [[-18, -63], [-150, -2], [-181, 19], [-103, 29], [-118, 67], [-15, 25]] },
  'wing-reclaimer': { key: 'reclaimer', points: [[-23, -45], [-106, -18], [-151, 12], [-158, 48], [-111, 62], [-61, 51], [-18, 29]] },
  'wing-eclipse': { key: 'eclipse', points: [[-19, -53], [-87, -25], [-150, 1], [-175, 33], [-126, 53], [-67, 63], [-16, 24]] },
};
export const ENGINE_PROFILES = {
  'engine-ion': {
    key: 'ion', nozzles: [-16, 16], width: 16, housing: 64, plume: 52, flare: 0.42,
    body: [[-168, 2], [-118, 13], [-52, 20], [42, 21], [112, 16], [148, 8]],
  },
  'engine-afterburn': {
    key: 'afterburn', nozzles: [0], width: 30, housing: 58, plume: 78, flare: 0.62,
    body: [[-172, 1], [-125, 10], [-68, 17], [18, 25], [96, 20], [151, 10]],
  },
  'engine-pulse': {
    key: 'pulse', nozzles: [-22, 0, 22], width: 12, housing: 48, plume: 44, flare: 0.5,
    body: [[-158, 3], [-110, 18], [-36, 25], [38, 25], [106, 22], [146, 18]],
  },
  'engine-quiet': {
    key: 'quiet', nozzles: [-10, 10], width: 13, housing: 72, plume: 30, flare: 0.24,
    body: [[-176, 1], [-132, 8], [-52, 14], [45, 15], [118, 12], [154, 7]],
  },
  'engine-repair': {
    key: 'repair', nozzles: [-27, -9, 9, 27], width: 9, housing: 44, plume: 34, flare: 0.36,
    body: [[-154, 4], [-108, 21], [-35, 29], [44, 30], [108, 26], [144, 24]],
  },
  'engine-overclock': {
    key: 'overclock', nozzles: [-23, 23], width: 19, housing: 55, plume: 72, flare: 0.7,
    body: [[-169, 2], [-116, 15], [-44, 23], [24, 29], [91, 25], [148, 14]],
  },
  'engine-harvest': {
    key: 'harvest', nozzles: [-18, 0, 18], width: 11, housing: 62, plume: 57, flare: 0.46,
    body: [[-160, 3], [-104, 19], [-31, 27], [50, 26], [116, 19], [151, 12]],
  },
  'engine-siege': {
    key: 'siege', nozzles: [-27, 27], width: 23, housing: 50, plume: 48, flare: 0.52,
    body: [[-150, 5], [-105, 24], [-46, 31], [40, 33], [111, 31], [146, 26]],
  },
  'engine-command': {
    key: 'command', nozzles: [-26, 0, 26], width: 14, housing: 54, plume: 42, flare: 0.44,
    body: [[-164, 2], [-119, 16], [-58, 27], [30, 27], [100, 23], [147, 18]],
  },
  'engine-singularity': {
    key: 'singularity', nozzles: [0], width: 36, housing: 70, plume: 86, flare: 0.78,
    body: [[-178, 1], [-128, 11], [-63, 20], [8, 31], [83, 27], [153, 13]],
  },
};
export const TAIL_PROFILES = {
  'tail-vector': { key: 'vector', points: [[-11, -22], [-70, 42], [-17, 31]] },
  'tail-stabilizer': { key: 'stabilizer', points: [[-9, -29], [-35, 55], [-14, 38]] },
  'tail-aegis': { key: 'aegis', points: [[-14, -19], [-58, 13], [-72, 45], [-24, 50], [-14, 28]] },
  'tail-hunter': { key: 'hunter', points: [[-10, -25], [-84, 28], [-42, 30], [-58, 56], [-15, 34]] },
  'tail-repair': { key: 'repair', points: [[-15, -16], [-51, 8], [-66, 42], [-39, 54], [-17, 32]] },
  'tail-command': { key: 'command', points: [[-10, -24], [-42, 4], [-76, 22], [-43, 37], [-61, 54], [-14, 34]] },
  'tail-phase': { key: 'phase', points: [[-12, -21], [-48, -2], [-78, 35], [-45, 48], [-16, 31]] },
  'tail-reactor': { key: 'reactor', points: [[-12, -18], [-35, 9], [-64, 28], [-35, 36], [-46, 58], [-15, 34]] },
  'tail-fortune': { key: 'fortune', points: [[-10, -22], [-31, 2], [-72, 19], [-44, 36], [-58, 51], [-14, 32]] },
  'tail-omega': { key: 'omega', points: [[-14, -27], [-54, -4], [-86, 35], [-54, 57], [-18, 38]] },
};

const PROFILES = { wing: WING_PROFILES, engine: ENGINE_PROFILES, tail: TAIL_PROFILES };
const SERIES = {
  'assault-wing': 'wing-vanguard', 'rapid-wing': 'wing-razor', 'calibration-wing': 'wing-prism',
  'vector-engine': 'engine-overclock', 'energy-engine': 'engine-singularity', 'training-engine': 'engine-harvest',
  'armor-tail': 'tail-aegis', 'buffer-tail': 'tail-phase', 'repair-tail': 'tail-repair',
};

// Preserve legacy slot/stat identity. The 3D wing kit draws independent designs;
// recruitment grades share their series, with grade markings and palette.
export function fixedPartProfile(module) {
  if (!module || !PROFILES[module.fixedSlot]) return null;
  const [, series, quality] = module.id.split(':');
  const profiles = PROFILES[module.fixedSlot];
  const profileId = SERIES[series] || module.id;
  const profile = profiles[profileId];
  if (!profile) throw new Error(`固定件缺少外观配置：${module.id}`);
  return {
    ...profile, id: module.id, slot: module.fixedSlot, color: module.color,
    variant: Object.keys(profiles).indexOf(profileId),
    grade: quality === 'blue' ? 3 : quality === 'green' ? 2 : 1,
  };
}

