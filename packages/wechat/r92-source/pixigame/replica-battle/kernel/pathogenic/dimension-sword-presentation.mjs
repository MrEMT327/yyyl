// Native void slash and dimensional formation share the same thin spatial cut.
export const isDimensionSword = b => b.owner === 'player' && [200104,360011].includes(b.weaponId) && b.modelId === 1000051;
export const DIMENSION_CUT_LIMIT = 3;
const finite = Number.isFinite;
const clamp = v => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

export function dimensionSwordEnvelope(progress) {
  const p = clamp(progress);
  return [smooth(0, .12, p) * (1 - smooth(.44, 1, p)),
    (.25 + .75 * smooth(0, .06, p)) * (1 - smooth(.70, 1, p)),
    1 - smooth(.04, .23, p), p];
}

export function dimensionSwordScreenCut(b, screen) {
  if (!isDimensionSword(b) || b.dead || b.visualHidden ||
      ![b.x, b.z, b.age, b.lifetime, b.radiusX, b.radiusZ].every(finite) ||
      b.age < 0 || b.lifetime <= 0 || b.age >= b.lifetime || b.radiusX <= 0 || b.radiusZ <= 0) return null;
  const angle = b.angle ?? 0, ox = b.offsetX ?? 0, oz = b.offsetZ ?? 0;
  if (![angle, ox, oz].every(finite)) return null;
  const dx = Math.sin(angle), dz = Math.cos(angle);
  const x = b.x + dx * oz + dz * ox, z = b.z + dz * oz - dx * ox;
  const center = screen(x, z), end = screen(x + dx * b.radiusZ, z + dz * b.radiusZ);
  const side = screen(x + dz * b.radiusX, z - dx * b.radiusX);
  if (![center.x, center.y, end.x, end.y, side.x, side.y].every(finite)) return null;
  const length = Math.hypot(end.x - center.x, end.y - center.y);
  const width = Math.hypot(side.x - center.x, side.y - center.y);
  if (length < .001 || width < .001) return null;
  return {uid: b.uid, line: [center.x, center.y, (end.x - center.x) / length, (end.y - center.y) / length],
    shape: [length, width, ((Number(b.uid) || 0) % 997) / 997, 0], style: dimensionSwordEnvelope(b.age / b.lifetime)};
}
