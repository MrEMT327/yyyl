import './supply-visuals.css';
// The shared weapon images already have consistent padding and a fixed center.
// Atlas crops from retired artwork would clip the new common-weapon silhouettes.
export function supplyWeaponArt(item,thumbnail) {
  return `<span class="supply-weapon-art">${thumbnail(item?.id)||''}</span>`;
}
