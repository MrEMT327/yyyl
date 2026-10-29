import { cloudAssetBase } from './cloud-asset-base.js';
import { COMMON_WEAPONS } from '../fixed-parts/common-weapons.js';
import { legacyWeaponThemeArt } from './weapon-theme-art.js';

// Shared artwork source for inventory, combat HUD and upgrade choices.
export const weaponIconUrl = id => COMMON_WEAPONS[id]
  ? legacyWeaponThemeArt(id) || `${cloudAssetBase}art/weapon-original/${id}.webp`
  : null;
