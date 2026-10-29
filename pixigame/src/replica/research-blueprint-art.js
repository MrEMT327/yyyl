import { cloudAssetBase } from '../ui/cloud-asset-base.js';

// Item IDs and laboratory IDs are distinct from the battle skill family IDs.
// These sheets are presentation only: inventory, costs and quality stay native.
export const RESEARCH_BLUEPRINT_ART = Object.freeze([
  [801, 1, '10000101', '速射机炮图纸'],
  [802, 2, '10000701', '爆燃导弹图纸'],
  [803, 3, '10001501', '高能激光图纸'],
  [804, 4, '10000201', '酸液枪图纸'],
  [805, 5, '10000601', '冰刃弹图纸'],
  [806, 6, '10000401', '磁暴枪图纸'],
  [807, 7, '10001701', '灼热射线图纸'],
  [808, 8, '10001101', '能量光剑图纸'],
  [809, 9, '10001601', '冰冻锯盘图纸'],
  [810, 10, '10000301', '电弧枪图纸'],
  [811, 11, '10000901', '酸性黑洞图纸'],
].map(([nativeItemId, labId, skillKey, name]) => Object.freeze({
  nativeItemId, labId, skillKey, name,
  url: `${cloudAssetBase}art/project-research-blueprints-v1/${nativeItemId}.png`,
})));

const byItem = new Map(RESEARCH_BLUEPRINT_ART.map(row => [row.nativeItemId, row]));
const byLab = new Map(RESEARCH_BLUEPRINT_ART.map(row => [row.labId, row]));
export const researchBlueprintArt = id => byItem.get(Number(id))?.url ?? null;
export const researchBlueprintArtForLab = id => byLab.get(Number(id))?.url ?? null;
