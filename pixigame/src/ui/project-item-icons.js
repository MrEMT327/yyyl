import { cloudAssetBase } from './cloud-asset-base.js';

export const PROJECT_ITEM_ICON_NAMES = Object.freeze({
  3: 'experience', 112: 'advanced-ticket', 113: 'basic-ticket',
  903: 'blueprint-choice-box', 934: 'gear-choice-box',
  925: 'pilot-box', 926: 'pilot-box-fragment',
});

export function projectItemIcon(id) {
  const name = PROJECT_ITEM_ICON_NAMES[Number(id)];
  return name ? `${cloudAssetBase}art/project-supplement-icons-v1/${name}.png` : null;
}
