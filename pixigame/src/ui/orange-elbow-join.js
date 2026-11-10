// The sleeve owns the cuff; the forearm rotates around its opening instead of
// mixing two unrelated deformation fields across the elbow.
// These fixed original-UV limits remove the second cuff from the forearm
// island and give the skin a small rounded cap underneath the sleeve opening.
export const ORANGE_FOREARM_MATERIAL = {
  fixedSkinPatch: { size: [160, 109], rect: [103, 0, 164, 112], sample: [115, 55] },
  alphaOpening: {
    artworkSize: [160, 109], feather: 1, outline: 0,
    polygon: [[126, -10], [126, 34], [136.7, 36.1], [145.8, 42.2],
      [151.9, 51.3], [154, 62], [151.9, 72.7], [145.8, 81.8],
      [136.7, 87.9], [126, 90], [105, 92], [105, 119], [170, 119], [170, -10]],
  },
};

export function createOrangeElbowJoin(manifest) {
  const layers = manifest.layers;
  const sleeve = layers.find(layer => layer.id === 'front-sleeve');
  const arm = layers.find(layer => layer.id === 'front-forearm');
  if (!sleeve || !arm) return () => 0;
  const offsets = new Map();
  let offset = 0;
  for (const layer of layers) { offsets.set(layer.id, offset); offset += layer.vertices.length; }
  const bind = (layer, [x, y]) => {
    const p = layer.vertices;
    for (let i = 0; i < layer.indices.length; i += 3) {
      const ids = layer.indices.slice(i, i + 3).map(v => v * 2), [a, b, c] = ids;
      const ax = p[b] - p[a], ay = p[b + 1] - p[a + 1];
      const bx = p[c] - p[a], by = p[c + 1] - p[a + 1], det = ax * by - ay * bx;
      if (Math.abs(det) < 1e-8) continue;
      const u = ((x - p[a]) * by - (y - p[a + 1]) * bx) / det;
      const v = (ax * (y - p[a + 1]) - ay * (x - p[a])) / det;
      if (u < -1e-5 || v < -1e-5 || u + v > 1.00001) continue;
      const indices = ids.map(id => offsets.get(layer.id) + id), weights = [1 - u - v, u, v];
      return positions => [0, 1].map(axis => indices.reduce((sum, id, i) => sum + positions[id + axis] * weights[i], 0));
    }
    throw new Error('手臂连接点不在网格内：' + layer.id);
  };
  const elbow = [390, 282], wrist = [280, 244];
  const readElbow = bind(sleeve, elbow), readWrist = bind(arm, wrist);
  const readUpper = bind(sleeve, [500, 320]);
  const dx = wrist[0] - elbow[0], dy = wrist[1] - elbow[1], length = Math.hypot(dx, dy);
  const coordinates = arm.vertices.flatMap((x, i) => i % 2 ? [] : [{
    along: ((x - elbow[0]) * dx + (arm.vertices[i + 1] - elbow[1]) * dy) / length,
    across: (-(x - elbow[0]) * dy + (arm.vertices[i + 1] - elbow[1]) * dx) / length,
  }]);
  return positions => {
    const start = readElbow(positions), end = readWrist(positions);
    const ux = end[0] - start[0], uy = end[1] - start[1], distance = Math.hypot(ux, uy);
    if (distance < 1e-4) return 0;
    const xAxis = ux / distance, yAxis = uy / distance, armOffset = offsets.get(arm.id);
    const upper = readUpper(positions), upperX = start[0] - upper[0], upperY = start[1] - upper[1];
    const alignment = (xAxis * upperX + yAxis * upperY) / Math.max(1e-4, Math.hypot(upperX, upperY));
    const unfold = Math.max(0, Math.min(1, (alignment - .35) / .5));
    const extension = unfold * unfold * (3 - 2 * unfold);
    for (let i = 0; i < coordinates.length; i++) {
      const { along, across } = coordinates[i], at = armOffset + i * 2;
      // Keep a short cap when bent; restore a little more overlap as the arm
      // straightens so the lower cuff does not expose a cut-out corner.
      const near = Math.max(0, Math.min(1, (25 - along) / 25));
      const side = Math.max(0, Math.min(1, (-across - 3) / 20));
      const fill = extension * near * near * (3 - 2 * near) * side * side * (3 - 2 * side);
      const axial = (along < 0 ? along * .35 : along * distance / length) - 7 * fill;
      const radial = across - 6 * fill;
      const x = start[0] + xAxis * axial - yAxis * radial;
      const y = start[1] + yAxis * axial + xAxis * radial;
      // Keep the already fitted glove socket at the very end of the wrist.
      const t = Math.max(0, Math.min(1, (along - length + 20) / 20)), w = t * t * (3 - 2 * t);
      positions[at] = x + (positions[at] - x) * w;
      positions[at + 1] = y + (positions[at + 1] - y) * w;
    }
    return coordinates.length;
  };
}
