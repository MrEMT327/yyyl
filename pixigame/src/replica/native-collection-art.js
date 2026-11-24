import { nativeWeaponSkillDisplayOverride } from './native-weapon-display.js';
import { nativeVariantSkillArt, nativeFleetSkillArt } from './native-weapon-skill-art.js';
import { NATIVE_AIRCRAFT_SKINS } from './native-aircraft-skins.js';
import { nativePilotAppearance } from './native-pilot-presentation.js';
import { aircraftUiImage } from '../aircraft-ui-images.js';
import { weaponIconUrl } from '../ui/weapon-icon-source.js';
import { weaponThemeArt } from '../ui/weapon-theme-art.js';
import { projectCollectionIcon } from './project-collection-icons.js';
import { resolveUiAssetUrl } from '../ui/ui-image-source.js';

export function nativeCollectionArt(row, view='thumbnail') {
  const plane=row.baseAppearanceId||NATIVE_AIRCRAFT_SKINS[row.id];
  if(plane){const url=aircraftUiImage(plane,view);return url?resolveUiAssetUrl(url):null;}
  const pilot=nativePilotAppearance(row.id);
  if(pilot)return view==='thumbnail'?pilot.avatar:pilot.image;
  return weaponThemeArt(row.catalogSelectionId??row.id)||(row.appearance&&weaponIconUrl(row.appearance))||projectCollectionIcon(row.icon);
}
export const nativeSkillArt = skill => nativeFleetSkillArt(skill?.id) || nativeVariantSkillArt(skill?.id) || projectCollectionIcon(nativeWeaponSkillDisplayOverride(skill?.id)?.icon || skill?.icon);
export const nativeLabArt = row => projectCollectionIcon(row.icon);
