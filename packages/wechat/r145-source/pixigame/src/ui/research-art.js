import { cloudAssetBase } from './cloud-asset-base.js';
import { projectIconUrl } from './project-ui-art.js';

const nativeIcons = Object.freeze({
  50002:'firepower',50019:'firepower',50025:'firepower',
  50001:'airframe',50020:'airframe',50026:'airframe',
  50016:'repair',50021:'repair',50023:'repair',
  50017:'armor',50003:'armor',50036:'armor',
  50018:'barrier',50007:'barrier',50037:'barrier',
  50008:'upgrade-repair',50024:'upgrade-repair',
  50022:'attack-defense',50011:'attack-defense',50029:'attack-defense',
  50005:'precision',50027:'precision',50047:'precision',
  50006:'critical-damage',50028:'critical-damage',
  50010:'coins',50039:'patrol',
  50033:'common-hunter',50030:'bio-hunter',50031:'zombie-hunter',
  50032:'machine-hunter',50045:'heavy-hunter',
  50034:'elite-hunter',50046:'boss-hunter',
  50038:'repair-yield',50041:'draw',50048:'emergency-shield',
  50043:'rewind',50044:'glory',50049:'combat-supply',
});

const legacyIcons = Object.freeze({
  'tech-firepower':'firepower','tech-airframe':'airframe','tech-repair':'repair',
  'tech-collision':'armor','tech-projectile':'barrier','tech-attack-defense':'attack-defense',
  'tech-precision':'precision','tech-critical-damage':'critical-damage','tech-coins':'coins',
  'tech-common-hunter':'common-hunter','tech-boss-hunter':'boss-hunter',
  'tech-reroll':'draw','tech-supply':'repair-yield',
});

export const TALENT_ART_KEYS = Object.freeze([...new Set(Object.values(nativeIcons))].sort());

export const researchCardQuality = quality => ({2:0,3:2,4:3,5:4,6:5})[quality] ?? 0;

export function researchArt(name) {
  const native = /^stg_card_(\d+)$/.exec(name);
  if (name === 'technology-core') return projectIconUrl(name);
  const key = native ? nativeIcons[native[1]] : legacyIcons[name];
  if (!key) throw new Error(`Missing original talent icon: ${name}`);
  return `${cloudAssetBase}art/project-talents-v1/${key}.webp`;
}
