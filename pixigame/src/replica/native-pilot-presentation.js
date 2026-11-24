import { AIRCRAFTS } from '../pilots.js';
import { portraitPresentation } from '../ui/character-portraits.js';
import { NATIVE_PILOT_SKINS } from './native-pilot-roster.js';
import { resolveUiAssetUrl } from '../ui/ui-image-source.js';

// Reuse complete cloud portraits/avatars, including its current 06/10 overrides.
// No ownership, rarity, skills or numerical properties enter native progression.
export function nativePilotAppearance(id) {
  const skinId = NATIVE_PILOT_SKINS[id];
  const cloud = skinId && AIRCRAFTS.find(pilot => pilot.id === skinId);
  if (!cloud) return null;
  const art = portraitPresentation(cloud);
  return { id: skinId, name: art.name, image: resolveUiAssetUrl(art.image), avatar: resolveUiAssetUrl(art.avatar || art.image) };
}
