// Presentation scales. Cannon solid size is shared with its collision shape;
// glow and trail magnification remain cosmetic. Damage and clocks are unchanged.
//                     model beam trail impact muzzle field
const rows = {
  cannon:   [2.6, 1.5, 2.8, 1.85, 2.5, 1.10],
  rail:     [2.4, 2.0, 3.2, 2.20, 2.8, 1.15],
  rocket:   [1.35, 1.6, 1.45, 1.65, 1.7, 1.25],
  laser:    [1.0, 2.6, 1.0, 2.00, 2.8, 1.15],
  scatter:  [2.5, 1.6, 2.4, 1.85, 2.8, 1.15],
  sidegun:  [2.6, 1.5, 3.0, 1.85, 2.6, 1.10],
  grenade:  [2.2, 1.5, 2.0, 2.20, 2.4, 1.25],
  mine:     [2.4, 1.8, 1.0, 2.20, 2.2, 1.15],
  beam:     [1.0, 2.6, 1.0, 1.85, 1.8, 1.15],
  lightning:[1.0, 1.8, 1.0, 1.85, 1.8, 1.20],
  freeze:   [1.6, 2.6, 1.0, 1.75, 1.8, 1.18],
  orb:      [1.5, 1.7, 1.5, 2.00, 2.5, 1.20],
  toxin:    [1.0, 1.6, 1.0, 1.80, 2.2, 1.25],
  blades:   [1.8, 2.0, 1.8, 2.20, 2.2, 1.12],
  gravity:  [1.6, 2.0, 1.0, 2.40, 2.7, 1.18],
  lightmine:[2.5, 2.4, 1.0, 2.00, 2.5, 1.12],
  pyro:     [1.0, 1.8, 1.2, 1.65, 1.7, 1.15],
  shield:   [1.5, 1.8, 1.8, 2.30, 2.4, 1.15],
  tail:     [2.6, 1.5, 3.1, 1.85, 2.7, 1.15],
  drone:    [1.35, 1.1, 0.85, 1.00, 1.0, 1.00],
};
const keys = ['model', 'beam', 'trail', 'impact', 'muzzle', 'field'];
export const COMMON_WEAPON_PRESENTATION = Object.freeze(Object.fromEntries(
  Object.entries(rows).map(([mechanic, values]) => [mechanic, Object.freeze(Object.fromEntries(keys.map((key, i) => [key, values[i]])))])
));
const neutral = Object.freeze(Object.fromEntries(keys.map(key => [key, 1])));
export function commonWeaponPresentation(visual) {
  const mechanic = visual.mechanic || visual.shape;
  return COMMON_WEAPON_PRESENTATION[mechanic === 'reflected' ? 'shield' : mechanic === 'ember' ? 'pyro' : mechanic] || neutral;
}
const fields = new Set(['toxin', 'poison-collapse', 'fire', 'storm-cloud', 'gravity', 'blast', 'discharge', 'frost-wave', 'ring-slash', 'heat', 'compression', 'slipstream']);
const impacts = new Set(['hit', 'node', 'bounce', 'penetration', 'collision', 'block', 'reflect', 'ice-flash', 'focus', 'hilt', 'corner', 'sonic', 'contact-ripple', 'lock']);
export function commonEffectScale(shape, presentation) {
  if (shape === 'muzzle') return presentation.muzzle;
  if (impacts.has(shape)) return presentation.impact;
  if (fields.has(shape)) return presentation.field;
  return 1;
}
