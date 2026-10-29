import { DEMO_ITEMS } from '../slot-demo/catalog.js';

// The design catalog keeps future parts; the playable inventory only exposes
// parts whose base combat behavior has shipped.
const releasedIds = new Set(['twin', 'capacitor', 'rail', 'focus', 'missile', 'bridge', 'prism', 'tesla']);
export const isFixedPartReleased = id => releasedIds.has(id);
export const RELEASED_FIXED_ITEMS = DEMO_ITEMS.filter(item => isFixedPartReleased(item.id));
export const releasedPlacements = placements => Object.fromEntries(
  Object.entries(placements).filter(([id]) => isFixedPartReleased(id)),
);
