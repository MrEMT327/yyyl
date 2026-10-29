import * as T from 'three';
import { restoreAircraftFittings } from '../slot-demo/aircraft-slots.js';
import { itemAtSlot } from '../slot-demo/catalog.js';
import { createModuleGeometry } from '../slot-demo/module-geometry.js';
import { readFixedLoadout } from '../fixed-parts/runtime.js';
import { normalizeAirframePlacements } from '../fixed-parts/airframe-arsenal.js';

export function readPreviewFixedParts(pilotId, storage) {
  try {
    return readFixedLoadout(pilotId,storage ?? globalThis.localStorage).placements;
  } catch { return normalizeAirframePlacements(pilotId); }
}

// Use the fitting page's actual geometry and normalized seats. This group is
// beside the normalized hull, so parts are not scaled twice and orbit together.
export function createPreviewFixedParts({ parent, slots }) {
  const root = new T.Group(), mounted = new Map();
  root.name = 'preview-fixed-parts'; parent.add(root);
  let placements = {}, signature = '';
  return {
    root, mounted,
    apply(next) {
      const nextSignature = JSON.stringify(slots.map(slot => itemAtSlot(next, slot.id)?.id || null));
      if (nextSignature === signature) return false;
      for (const slot of slots) {
        const item = itemAtSlot(next, slot.id), previous = mounted.get(slot.id);
        if (previous?.userData.itemId === item?.id) continue;
        previous?.userData.dispose(); mounted.delete(slot.id);
        if (!item) continue;
        const kit = createModuleGeometry(item);
        kit.position.fromArray(slot.position); kit.scale.setScalar(slot.scale);
        if (slot.kind === 'weapon' && slot.position[0] < 0) kit.scale.x *= -1;
        root.add(kit); mounted.set(slot.id, kit);
      }
      signature = nextSignature; placements = structuredClone(next);
      return true;
    },
    get state() {
      return { placements: structuredClone(placements), mountedCount: mounted.size,
        mounts: [...mounted].map(([slotId, kit]) => ({ slotId, itemId: kit.userData.itemId, position: kit.position.toArray(), scale: kit.scale.toArray() })) };
    },
    dispose() {
      for (const kit of mounted.values()) kit.userData.dispose();
      mounted.clear(); root.removeFromParent();
    },
  };
}
