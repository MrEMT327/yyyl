import * as T from 'three';
import { PILOT_FIGHTERS, fighterForPilot } from '../three/aircraft/fighter-packages.js';
import { DEMO_SLOTS, restoreDemoPlacements } from './catalog.js';

export const FITTING_AIRCRAFT = Object.freeze(Object.keys(PILOT_FIGHTERS).map(pilotId => ({ pilotId, ...fighterForPilot(pilotId) })));
export const fittingPilotId = id => Object.hasOwn(PILOT_FIGHTERS, id) ? id : 'pilot-01';

// Per-airframe stations: distance across the half-span, then nose-to-tail fraction.
// Snap each station onto solid hardware so raised wings and thin hulls get a real seat.
const STATIONS = {
  kestrel: { wings: [[.40,.40],[.77,.59],[.34,.77]], spine: [.47,.62,.77], scale: 1 },
  verdant: { wings: [[.37,.35],[.75,.53],[.41,.76]], spine: [.43,.60,.76], scale: .85 },
  crimson: { wings: [[.39,.38],[.73,.62],[.35,.80]], spine: [.45,.61,.77], scale: .88 },
  azure: { wings: [[.40,.36],[.72,.57],[.37,.78]], spine: [.44,.61,.78], scale: .9 },
  wraith: { wings: [[.38,.37],[.70,.59],[.37,.80]], spine: [.45,.61,.78], scale: .86 },
  scarlet: { wings: [[.38,.34],[.71,.54],[.34,.78]], spine: [.43,.60,.77], scale: .87 },
  verdure: { wings: [[.37,.38],[.75,.56],[.39,.77]], spine: [.46,.63,.80], scale: .85 },
  prism: { wings: [[.39,.37],[.73,.58],[.36,.79]], spine: [.44,.61,.78], scale: .88 },
  bastion: { wings: [[.40,.35],[.73,.56],[.39,.79]], spine: [.43,.61,.79], scale: .94 },
  auric: { wings: [[.39,.36],[.74,.56],[.37,.78]], spine: [.44,.61,.78], scale: .9 },
};

export function resolveAircraftSlots(fighter) {
  const profile = STATIONS[fighter.fighterId];
  if (!profile) throw new Error(`缺少机型挂点：${fighter.fighterId}`);
  fighter.object3D.updateMatrixWorld(true);
  const solid = fighter.runtime.asset.solid;
  const bounds = new T.Box3().setFromObject(solid);
  const ray = new T.Raycaster(new T.Vector3(), new T.Vector3(0, -1, 0));
  const halfSpan = Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x));
  const length = bounds.max.z - bounds.min.z;
  const meshes = [];
  solid.traverseVisible(node => {
    if (node.isMesh && ![].concat(node.material).every(material => material.isShaderMaterial || material.opacity < .3)) meshes.push(node);
  });
  function seat(x, z, used, side) {
    // Search locally around the authored station; never put a mount in a wing cutout.
    const offsets = [];
    for (let iz = -6; iz <= 6; iz++) for (let ix = -6; ix <= 6; ix++) {
      if (!side && ix !== 0) continue;
      offsets.push([ix * .22, iz * .22]);
    }
    offsets.sort((a,b) => a[0]**2 + a[1]**2 - b[0]**2 - b[1]**2);
    for (const [dx,dz] of offsets) {
      const px = x + dx, pz = z + dz;
      if (side && Math.sign(px) !== side) continue;
      if (used.some(point => Math.hypot(point[0] - px, point[2] - pz) < 1.1 * profile.scale)) continue;
      ray.ray.origin.set(px, bounds.max.y + 3, pz);
      const hit = ray.intersectObjects(meshes, false)[0];
      if (hit) return [px, hit.point.y + .25 * profile.scale, pz];
    }
    throw new Error(`无法定位 ${fighter.fighterId} 的实体挂点 (${x.toFixed(1)}, ${z.toFixed(1)})`);
  }
  const used = [];
  const slots = DEMO_SLOTS.map((slot, index) => {
    const side = slot.kind === 'weapon' ? index % 2 ? 1 : -1 : 0;
    const [fraction, depth] = side ? profile.wings[Math.floor(index / 2)] : [0, profile.spine[index - 6]];
    const position = seat(side * halfSpan * fraction, bounds.min.z + length * depth, used, side);
    used.push(position);
    return { ...slot, position, scale: profile.scale };
  });
  return slots;
}

export function restoreAircraftFittings(saved) {
  const fittings = {};
  if (saved?.version === 2 && saved.aircraft && typeof saved.aircraft === 'object') {
    for (const { pilotId } of FITTING_AIRCRAFT) {
      const placements = restoreDemoPlacements(saved.aircraft[pilotId]);
      if (placements) fittings[pilotId] = placements;
    }
  } else {
    // The old preview was always Kestrel, regardless of the selected combat pilot.
    const placements = restoreDemoPlacements(saved?.placements);
    if (placements) fittings['pilot-01'] = placements;
  }
  return fittings;
}
