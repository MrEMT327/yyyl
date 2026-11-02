// Attach the elbow end of the forearm to the sleeve's painted surface.
// The shared region is measured in the registered target artwork; only the
// overlap is blended, leaving the wrist and hand controls independent.
export function createOrangeElbowJoin(manifest) {
  const layers = manifest.layers;
  const sleeveIndex = layers.findIndex(layer => layer.id === 'front-sleeve');
  const armIndex = layers.findIndex(layer => layer.id === 'front-forearm');
  if (sleeveIndex < 0 || armIndex < 0) return () => 0;
  const sleeve = layers[sleeveIndex], arm = layers[armIndex];
  if (!sleeve.crop || !arm.crop) return () => 0;
  const sleeveOffset = layers.slice(0, sleeveIndex).reduce((sum, layer) => sum + layer.vertices.length, 0);
  const armOffset = layers.slice(0, armIndex).reduce((sum, layer) => sum + layer.vertices.length, 0);
  const start = Math.max(sleeve.crop[0], arm.crop[0]);
  const end = Math.min(sleeve.crop[0] + sleeve.crop[2], arm.crop[0] + arm.crop[2]);
  if (end <= start) return () => 0;
  const points = [];
  for (let vertex = 0; vertex < arm.vertices.length / 2; vertex++) {
    const x = arm.vertices[vertex * 2], y = arm.vertices[vertex * 2 + 1];
    const t = Math.max(0, Math.min(1, (x - start) / (end - start)));
    if (!t) continue;
    for (let i = 0; i < sleeve.indices.length; i += 3) {
      const [a, b, c] = sleeve.indices.slice(i, i + 3), p = sleeve.vertices;
      const ax = p[a * 2], ay = p[a * 2 + 1], bx = p[b * 2], by = p[b * 2 + 1], cx = p[c * 2], cy = p[c * 2 + 1];
      const det = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
      if (Math.abs(det) < 1e-8) continue;
      const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / det;
      const v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / det;
      const w = 1 - u - v;
      if (u < -1e-6 || v < -1e-6 || w < -1e-6) continue;
      points.push({ vertex, a, b, c, u, v, w, weight: t * t * (3 - 2 * t) });
      break;
    }
  }
  return positions => {
    for (const { vertex, a, b, c, u, v, w, weight } of points) {
      const armAt = armOffset + vertex * 2;
      const x = positions[sleeveOffset + a * 2] * u + positions[sleeveOffset + b * 2] * v + positions[sleeveOffset + c * 2] * w;
      const y = positions[sleeveOffset + a * 2 + 1] * u + positions[sleeveOffset + b * 2 + 1] * v + positions[sleeveOffset + c * 2 + 1] * w;
      positions[armAt] += (x - positions[armAt]) * weight;
      positions[armAt + 1] += (y - positions[armAt + 1]) * weight;
    }
    return points.length;
  };
}
