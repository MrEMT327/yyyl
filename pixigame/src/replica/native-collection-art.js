import { NATIVE_AIRCRAFT_SKINS } from './native-aircraft-skins.js';
import { nativePilotAppearance } from './native-pilot-presentation.js';
import { aircraftUiImage } from '../aircraft-ui-images.js';
import { weaponIconUrl } from '../ui/weapon-icon-source.js';
import { weaponThemeArt } from '../ui/weapon-theme-art.js';
import { researchBlueprintArtForLab } from './research-blueprint-art.js';
import { projectCollectionIcon } from './project-collection-icons.js';

const absolute = url => url ? new URL(url, document.baseURI).href : null;
export function nativeCollectionArt(row, view='thumbnail') {
  const plane=NATIVE_AIRCRAFT_SKINS[row.id];
  if(plane)return absolute(aircraftUiImage(plane,view));
  const pilot=nativePilotAppearance(row.id);
  if(pilot)return view==='thumbnail'?pilot.avatar:pilot.image;
  return weaponThemeArt(row.id)||(row.appearance&&weaponIconUrl(row.appearance))||projectCollectionIcon(row.icon);
}
export const nativeSkillArt = skill => projectCollectionIcon(skill?.icon);
// Laboratory details share the canonical research sheet with material inventory.
export const nativeLabArt = row => researchBlueprintArtForLab(row.id) || projectCollectionIcon(row.icon);
