// Group identities are preserved from AirplaneGun_AirplaneGun.SecondWeaponType
// and skinNumber, not inferred from the icon or rarity.
export const nativeWeaponGroupId = row => Number(row?.baseGunId || row?.id);
export function nativeWeaponVariants(rows, row) {
  const id = nativeWeaponGroupId(row);
  return rows.filter(item => nativeWeaponGroupId(item) === id)
    .sort((a,b) => (a.skinNumber || 0) - (b.skinNumber || 0) || a.id-b.id);
}
export function nativeWeaponGroupRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = nativeWeaponGroupId(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()].map(items => items.find(row => row.equipped)
    || items.find(row => row.id === nativeWeaponGroupId(row)) || items[0]);
}
