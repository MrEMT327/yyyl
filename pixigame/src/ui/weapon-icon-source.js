import { cloudAssetBase } from './cloud-asset-base.js';
import { legacyWeaponThemeArt, WEAPON_ART_DIRECTORY } from './weapon-theme-art.js';

// Stable gameplay IDs for the fifteen dedicated common-weapon illustrations.
// All have current clean-v2 artwork; the export name retains caller compatibility.
export const RETAINED_LEGACY_WEAPON_IDS=Object.freeze([
  'aux_rail','aux_sidegun','aux_grenade','aux_mine','aux_beam','aux_freeze',
  'aux_orb','aux_toxin','aux_blades','aux_gravity','aux_lightmine','aux_pyro',
  'aux_shield','aux_tail','aux_drone',
]);
const retained=new Set(RETAINED_LEGACY_WEAPON_IDS);
export const weaponIconUrl=id=>legacyWeaponThemeArt(id)
  ||(retained.has(id)?`${cloudAssetBase}${WEAPON_ART_DIRECTORY}${id}.webp`:null);
