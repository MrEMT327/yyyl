// Read the same primary Bullet.Element used by combat, independently of art
// color, translated names, card IDs and upgrade quality.
export const BATTLE_ELEMENTS = Object.freeze(Object.fromEntries([
  [1,'physical','物理','#e9b75d'],[2,'fire','火焰','#f28e64'],
  [3,'acid','酸系','#a4d56a'],[4,'ice','冰冻','#83d4f5'],
  [5,'energy','能量','#65dfc7'],[6,'electromagnetic','电磁','#baa0f2'],
].map(([id,key,label,color])=>[id,Object.freeze({id,key,label,color})])));

export function battleChoiceElement(card, combat) {
  const family = combat?.families?.[card?.group];
  if (!family) return null;
  const entity = combat.entities?.[family.entityId];
  for (const weaponId of entity?.WeaponID || []) {
    const weapon = combat.weapons?.[weaponId];
    const bullet = combat.bullets?.[weapon?.BulletId];
    const element = BATTLE_ELEMENTS[Number(bullet?.Element)];
    if (element) return element;
  }
  return null;
}
