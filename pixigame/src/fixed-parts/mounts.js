import * as T from 'three';
import { resolveAircraftSlots } from '../slot-demo/aircraft-slots.js';
import { createModuleGeometry } from '../slot-demo/module-geometry.js';
import { ITEM_BY_ID } from '../slot-demo/catalog.js';

const layouts = new Map();
export function createFixedPartMounts({ view, mount, attitude, runtime, loadout, geometryFactory = createModuleGeometry }) {
  if (!layouts.has(view.fighterId)) {
    // Resolve seats in the same neutral, normalized coordinates as the hangar.
    // Clone only object transforms; the shared hull geometry is never disposed.
    const canonical = new T.Group(), hull = runtime.asset.solid.clone(true);
    const originals = [], copies = [];
    runtime.asset.solid.traverse(node => originals.push(node));
    hull.traverse(node => copies.push(node));
    copies.forEach((node, index) => { node.uuid = originals[index].uuid; });
    const nodes = new Map(copies.map(node => [node.uuid, node]));
    for (const part of runtime.asset.effects.articulations || []) {
      const node = nodes.get(part.node);
      if (part.restPosition) node.position.fromArray(part.restPosition);
      if (part.restQuaternion) node.quaternion.fromArray(part.restQuaternion);
      if (part.restScale) node.scale.fromArray(part.restScale);
    }
    canonical.scale.copy(attitude.scale); canonical.add(hull);
    layouts.set(view.fighterId, resolveAircraftSlots({ object3D: canonical, runtime: { asset: { solid: hull, effects: runtime.asset.effects } }, fighterId: view.fighterId }));
  }
  const slots = layouts.get(view.fighterId), root = new T.Group(), mounted = new Map();
  root.name = 'fixed-parts-combat'; mount.add(root);
  for (const item of [...loadout.weapons, ...loadout.connectors]) for (const id of item.slots) {
    const slot = slots.find(s => s.id === id), kit = geometryFactory(ITEM_BY_ID.get(item.itemId), item);
    kit.position.fromArray(slot.position); kit.scale.setScalar(slot.scale);
    if (slot.kind === 'weapon' && slot.position[0] < 0) kit.scale.x *= -1;
    if (slot.mountAnchor) kit.userData.uiArticulation = true;
    root.add(kit); mounted.set(id, kit);
  }
  const point = new T.Vector3();
  const anchorPoint = new T.Vector3(), rootRotation = new T.Quaternion(), anchorRotation = new T.Quaternion();
  const anchors = slots.filter(slot => slot.mountAnchor && mounted.has(slot.id)).map(slot => ({
    kit: mounted.get(slot.id), object: runtime.asset.nodes.get(slot.mountAnchor.node),
    position: new T.Vector3().fromArray(slot.mountAnchor.position),
    inverseRest: new T.Quaternion().fromArray(slot.mountAnchor.quaternion).invert(),
  }));
  function update() {
    root.rotation.copy(attitude.rotation);
    root.updateWorldMatrix(true, false);
    root.getWorldQuaternion(rootRotation).invert();
    for (const anchor of anchors) {
      anchor.object.updateWorldMatrix(true, false);
      anchorPoint.copy(anchor.position); anchor.object.localToWorld(anchorPoint);
      root.worldToLocal(anchorPoint); anchor.kit.position.copy(anchorPoint);
      anchor.object.getWorldQuaternion(anchorRotation);
      anchor.kit.quaternion.copy(rootRotation).multiply(anchorRotation).multiply(anchor.inverseRest);
    }
  }
  update();
  return {
    root, slots, mounted,
    update,
    muzzle(slotId, barrel, space) {
      const kit = mounted.get(slotId);
      if (!kit) return null;
      update(); root.updateWorldMatrix(true, true);
      const item=ITEM_BY_ID.get(loadout.weapons.find(w=>w.slots.includes(slotId))?.itemId),model=item?.modelId||item?.id;
      if(model==='missile')point.set([-.58,0,.58][barrel%3],barrel<3?.4:1,-2.04);
      else if(model==='rail')point.set(0,.57,-3.95);
      else if(model==='prism')point.set(0,.7,-2.93);
      else if(model==='tesla')point.set(0,.72,-3.18);
      else point.set(barrel === 0 ? -.34 : .34, .5, -2.96);
      kit.localToWorld(point);
      view.object3D.worldToLocal(point);
      // Display transforms synchronize at render time. Public display-space
      // conversion uses this frame's position instead of last render's matrix.
      const position = space ? space.toLocal(point, view) : view.toGlobal(point);
      return { x: position.x, y: position.y, z: point.z };
    },
    dispose() { for (const kit of mounted.values()) kit.userData.dispose(); mounted.clear(); root.removeFromParent(); },
  };
}
