import design from './common-weapon-visual-design.json' with { type: 'json' };

// Identity palettes are independent of the inventory's rarity badge colors.
export const COMMON_WEAPON_VISUALS = Object.freeze(Object.fromEntries(design.weapons.map(w => [w.id,
  Object.freeze({...w, color:parseInt(w.body.slice(1),16), highlightColor:parseInt(w.highlight.slice(1),16), shadowColor:parseInt(w.shadow.slice(1),16)})
])));

export function commonWeaponVisual(itemId, rank=0) {
  const identity=COMMON_WEAPON_VISUALS[itemId];
  if(!identity)throw new Error(`Unknown common weapon visual: ${itemId}`);
  return {...identity, rank:Math.max(0,Math.min(5,Math.floor(rank)||0))};
}
