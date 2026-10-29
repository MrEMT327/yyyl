import * as T from 'three';
import { createAuthoredWingKit } from './kestrel-wings.js';

// Authored V34 Kestrel component ranges, before the package runtime batches
// them. Keep cockpit/fuselage intact; replace complete assemblies, not textures.
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const COMPONENTS = {
  wing: [...range(16, 23), ...range(54, 71), ...range(102, 111), 123, 124],
  engine: [...range(24, 51), ...range(72, 99), 115, 119],
  tail: [52, 53, 100, 101],
};
const ORIGINAL = { wing: 'wing-swept', engine: 'engine-ion', tail: 'tail-vector' };

function disposeTree(root) {
  const geometries = new Set(), materials = new Set();
  root.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.material) for (const material of [].concat(node.material)) materials.add(material);
  });
  geometries.forEach(geometry => geometry.dispose());
  materials.forEach(material => material.dispose());
  root.clear();
}

function builder(root, profile) {
  const tint = new T.Color(profile.color);
  const armor = new T.MeshStandardMaterial({ color: tint.clone().lerp(new T.Color('#bacbd8'), .78), metalness: .58, roughness: .34 });
  const dark = new T.MeshStandardMaterial({ color: '#1d2d40', metalness: .7, roughness: .35 });
  const glow = new T.MeshBasicMaterial({ color: tint.clone().multiplyScalar(2.4), toneMapped: false });
  const metal = new T.MeshStandardMaterial({ color: '#74879c', metalness: .85, roughness: .26 });
  function mesh(geometry, material, position = [0, 0, 0], parent = root) {
    const object = new T.Mesh(geometry, material);
    object.position.fromArray(position);
    object.userData.bloom = material === glow || material.blending === T.AdditiveBlending;
    object.userData.equipmentSlot = profile.slot;
    parent.add(object);
    return object;
  }
  function plate(points, y, thickness, material, parent = root) {
    const shape = new T.Shape(points.map(([x, z]) => new T.Vector2(x, -z)));
    const geometry = new T.ExtrudeGeometry(shape, {
      depth: thickness, bevelEnabled: true, bevelThickness: .035, bevelSize: .045, bevelSegments: 1, steps: 1,
    });
    geometry.rotateX(-Math.PI / 2);
    return mesh(geometry, material, [0, y, 0], parent);
  }
  function line(points, radius = .028, material = glow, parent = root) {
    const curve = new T.CurvePath();
    for (let i = 1; i < points.length; i++) curve.add(new T.LineCurve3(new T.Vector3(...points[i - 1]), new T.Vector3(...points[i])));
    return mesh(new T.TubeGeometry(curve, Math.max(4, points.length * 3), radius, 5, false), material, [0, 0, 0], parent);
  }
  function cylinder(x, y, z, frontRadius, backRadius, length, material, segments = 12) {
    const object = mesh(new T.CylinderGeometry(backRadius, frontRadius, length, segments), material, [x, y, z]);
    object.rotation.x = Math.PI / 2;
    return object;
  }
  // Some variants don't need every material; release unused ones as well.
  root.userData.materials = [armor, dark, glow, metal];
  return { armor, dark, glow, metal, mesh, plate, line, cylinder };
}

function buildTail(root, profile) {
  const b = builder(root, profile);
  for (const side of [-1, 1]) {
    const points = profile.points.map(([x, z]) => [Math.abs(x) * .05 * side, z * .046 + 1.3]);
    b.plate(points, .46, .18, b.armor);
    b.line(points.map(([x, z]) => [x, .69, z]), .025);
    const fin = new T.Group();
    fin.position.set(side * 2.25, .7, 1.0);
    fin.rotation.z = -side * (.18 + profile.variant * .035);
    root.add(fin);
    const height = 1.4 + (profile.variant % 4) * .4;
    // Plate space is turned upright around the longitudinal axis.
    const surface = b.plate([[0, 0], [height * .8, .8], [height, 2.5], [0, 2.9]], 0, .12, b.dark, fin);
    surface.rotation.z = Math.PI / 2;
    b.line([[0, .2, .3], [0, height * .73, 1.1], [0, height * .9, 2.45]], .045, b.glow, fin);
    for (let i = 0; i < profile.grade; i++) b.mesh(new T.BoxGeometry(.13, .10, .45), b.armor, [side * 2.5, .75, 1.8 + i * .45]);
  }
}

function buildEngine(root, profile, plumes) {
  const b = builder(root, profile);
  const radius = profile.width * .043;
  const length = profile.housing * .067;
  const centre = 1.75;
  b.mesh(new T.BoxGeometry(5.2, .42, 1.5), b.dark, [0, -.25, 2.2]);
  for (const nozzle of profile.nozzles) {
    const x = nozzle * .125;
    b.cylinder(x, -.1, centre, radius * .72, radius, length, b.armor);
    b.cylinder(x, -.1, centre + length / 2 - .13, radius * 1.03, radius * .85, .8, b.dark);
    b.cylinder(x, -.1, centre - length / 2 - .05, radius * .55, radius * .74, .32, b.dark);
    const end = centre + length / 2 + .3;
    for (let i = 0; i < 3; i++) {
      const ring = b.mesh(new T.TorusGeometry(radius * (.8 + i * .035), .047, 5, 24), i === 2 ? b.glow : b.metal, [x, -.1, end - .12 * i]);
      ring.name = 'engine-nozzle-ring';
    }
    for (let i = 0; i < 3 + profile.grade; i++) b.mesh(new T.BoxGeometry(radius * 1.3, .075, .09), b.dark, [x, radius - .1, centre - .6 + i * .27]);
    b.line([[x, radius, centre - length * .35], [x, radius, centre + length * .28]], .035);
    b.cylinder(x, -.1, end, radius * .65, radius * .65, .045, b.glow, 24);
    const plumeLength = profile.plume * .036;
    const flame = new T.Group(); flame.position.set(x, -.1, end + .02); root.add(flame);
    for (const [r, alpha, lengthScale] of [[.75, .16, 1], [.43, .48, .82], [.2, .85, .53]]) {
      const material = new T.MeshBasicMaterial({ color: new T.Color(profile.color).multiplyScalar(2.4), transparent: true, opacity: alpha, depthWrite: false, blending: T.AdditiveBlending, toneMapped: false });
      const cone = b.mesh(new T.ConeGeometry(radius * r, plumeLength * lengthScale, 24, 1, true), material, [0, 0, plumeLength * lengthScale / 2], flame);
      cone.rotation.x = Math.PI / 2;
    }
    plumes.push(flame);
  }
}

export function createKestrelEquipment(asset) {
  if (asset.entry.slug !== 'kestrel') return null;
  const native = {}, replacements = {}, mounted = {}, plumes = [];
  for (const [slot, indices] of Object.entries(COMPONENTS)) {
    const original = new T.Group(); original.name = `Kestrel/original-${slot}`;
    const names = new Set(indices.map(index => `part/${String(index).padStart(3, '0')}-Mesh`));
    for (const node of [...asset.solid.children]) if (names.has(node.name)) original.add(node);
    native[slot] = original; asset.solid.add(original);
    const replacement = new T.Group(); replacement.name = `Kestrel/equipped-${slot}`;
    replacements[slot] = replacement; asset.solid.add(replacement);
  }
  const wingKit = createAuthoredWingKit(native.wing);
  const clear = root => {
    // Materials unused by a particular generated shape aren't in its tree.
    const used = new Set(); root.traverse(node => { if (node.material) [].concat(node.material).forEach(m => used.add(m)); });
    for (const material of root.userData.materials || []) if (!used.has(material)) material.dispose();
    disposeTree(root); root.userData.materials = [];
  };
  return {
    native, replacements, mounted,
    setAppearance(appearance) {
      let changed = false;
      for (const slot of Object.keys(COMPONENTS)) {
        const profile = appearance[slot];
        if (Object.hasOwn(mounted, slot) && mounted[slot] === (profile?.id || null)) continue;
        changed = true; mounted[slot] = profile?.id || null;
        const root = replacements[slot]; clear(root);
        if (slot === 'engine') plumes.length = 0;
        native[slot].visible = profile?.id === ORIGINAL[slot];
        root.userData.moduleId = profile?.id || null;
        if (!profile || native[slot].visible) continue;
        if (slot === 'wing') wingKit.build(root, profile);
        else if (slot === 'tail') buildTail(root, profile);
        else buildEngine(root, profile, plumes);
      }
      return changed;
    },
    update(time, runtime) {
      if (Object.hasOwn(mounted, 'engine')) {
        const originalEngine = mounted.engine === ORIGINAL.engine;
        for (const emitter of [...runtime.jets, ...runtime.trails, ...runtime.particles]) emitter.object.visible = originalEngine;
      }
      plumes.forEach((plume, i) => { plume.scale.z = .9 + Math.sin(time * 13 + i * 2) * .1; });
    },
    dispose() { Object.values(replacements).forEach(clear); wingKit.dispose(); },
  };
}
