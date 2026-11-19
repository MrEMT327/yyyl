import * as T from 'three';
import { Container } from './display.js';

// Small native solid models; immutable geometry/materials are shared by drops.
const unitBox = new T.BoxGeometry(1, 1, 1);
const palettes = new Map();
const templates = new Map();
function palette(color) {
  if (!palettes.has(color)) {
    const base = new T.Color(color);
    palettes.set(color, [.68, .82, .64, 1.12, 1, .52].map(gain =>
      new T.MeshBasicMaterial({ color: base.clone().multiplyScalar(gain), toneMapped: false })));
  }
  return palettes.get(color);
}
function box(root, x, y, z, w, h, d, color) {
  const mesh = new T.Mesh(unitBox, palette(color));
  mesh.position.set(x, y, z);
  mesh.scale.set(w, h, d);
  root.add(mesh);
}
function hardware(type) {
  if (templates.has(type)) return templates.get(type).clone(true);
  const root = new T.Group();
  const medical = type === 'heal';
  const shell = medical ? 0xe2edf1 : 0xffbd36;
  const trim = 0x25384a;
  box(root, 0, 0, 0, 31, 24, 15, trim);
  box(root, 0, 0, 2, 28, 21, 14, shell);
  // Raised face, lid seam, corner guards, and a real three-piece carry handle.
  box(root, 0, 0, 10, 26, 19, 3, shell);
  box(root, 0, -7, 12, 27, 1.5, 1.5, trim);
  for (const x of [-14, 14]) {
    box(root, x, 0, 10, 3, 24, 5, trim);
    for (const y of [-9, 9]) box(root, x, y, 13, 2, 2, 1, 0xc4d8e3);
  }
  box(root, -6, -15, 0, 3, 6, 4, trim);
  box(root, 6, -15, 0, 3, 6, 4, trim);
  box(root, 0, -18, 0, 15, 3, 4, 0x8ba9ba);
  if (medical) {
    box(root, 0, 1, 12.5, 5, 14, 2, 0x21c66f);
    box(root, 0, 1, 12.6, 14, 5, 2, 0x21c66f);
  } else {
    for (const x of [-7, 7]) box(root, x, 0, 12, 3, 20, 2, 0x624a27);
    box(root, 0, 1, 13, 7, 8, 3, trim);
    box(root, 0, 0, 15, 3, 3, 1, 0xffec9a);
  }
  root.rotation.set(-.32, -.30, -.08);
  templates.set(type, root);
  return root.clone(true);
}

export function createPickupModel(type) {
  const view = new Container();
  view.object3D.add(hardware(type));
  view._bounds = { x: -24, y: -25, width: 48, height: 48 };
  return view;
}
