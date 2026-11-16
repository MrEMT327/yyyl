import type { RecordData } from './model';
import type { ParticleMeshData } from './particle-pipeline';
import { curve, gradient } from './original-effects';

export interface TrailPoint { x: number; z: number; time: number }

/** Clip to the exact lifetime boundary instead of discarding a whole segment
 * when its older vertex expires between rendering frames. */
export function trimOriginalTrail(points: TrailPoint[], cutoff: number): TrailPoint[] {
  const first = points.findIndex(point => point.time >= cutoff);
  if (first < 0) return [];
  if (first === 0) return points;
  const a = points[first - 1], b = points[first];
  const t = (cutoff - a.time) / (b.time - a.time || 1);
  return [{ time: cutoff, x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, ...points.slice(first)];
}

/** Original TrailRenderer width/colour curves and stretched UVs. History is
 * sampled at rendered simulation positions; Unity's 3D ribbon tessellation is
 * projected into the same XZ plane as other original particles. */
export function originalTrailGeometry(points: TrailPoint[], trail: RecordData, scale: number): ParticleMeshData {
  const vertices: ParticleMeshData['vertices'] = [], indices: number[] = [];
  const distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z));
  const total = distances[distances.length - 1];
  if (!total) return { vertices, indices };
  const p = trail.parameters, material = trail.materials?.[0];
  const tint = material?.colors?._TintColor || { r: 1, g: 1, b: 1, a: 1 };
  const byte = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  for (let i = 0; i < points.length; i++) {
    const point = points[i], previous = points[Math.max(0, i - 1)], next = points[Math.min(points.length - 1, i + 1)];
    const dx = next.x - previous.x, dz = next.z - previous.z, length = Math.hypot(dx, dz) || 1;
    // Stored oldest first; Unity curve zero is the moving head.
    const u = 1 - distances[i] / total;
    const half = curve(p.widthCurve?.m_Curve, u) * p.widthMultiplier * scale / 2;
    const color = gradient(p.colorGradient || {}, u);
    const packed = (byte(color.r * tint.r) << 16) | (byte(color.g * tint.g) << 8) | byte(color.b * tint.b);
    for (const side of [-1, 1]) vertices.push({ x: point.x + dz / length * half * side, z: point.z - dx / length * half * side,
      u, v: side < 0 ? 0 : 1, tint: packed, alpha: color.a * tint.a });
    if (i) { const a = (i - 1) * 2, b = i * 2; indices.push(a, a + 1, b, a + 1, b + 1, b); }
  }
  return { vertices, indices };
}
