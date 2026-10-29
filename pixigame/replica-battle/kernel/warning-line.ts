import Phaser from 'phaser';
import type { Point, RecordData } from './model';
import type { ParticleMeshData } from './particle-pipeline';
import { curve, gradient } from './original-effects';

/** Mobile/Particles/Alpha Blended: original tile texture times vertex colour,
 * adapted to Phaser's premultiplied upload and NORMAL blend. */
export class OriginalWarningPipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
  constructor(game: Phaser.Game) {
    super({ game, fragShader: `
      precision mediump float;
      uniform sampler2D uMainSampler;
      varying vec2 outTexCoord;
      varying float outTexId;
      varying float outTintEffect;
      varying vec4 outTint;
      void main() {
        vec4 texture = texture2D(uMainSampler, fract(outTexCoord));
        gl_FragColor = texture * vec4(outTint.bgr * outTint.a, outTint.a);
      }
    ` });
  }
}

/** Native max-distance raycast is 10000 units. This runtime currently exposes
 * rectangular world bounds rather than Unity's complete map collider layer. */
export function warningEndPoint(from: Point, target: Point, width: number, height: number,
  bounds = { left: -width / 2, right: width / 2, bottom: -height / 2, top: height / 2 }): Point {
  const dx = target.x - from.x, dz = target.z - from.z, length = Math.hypot(dx, dz);
  if (!length) return { x: 0, z: 0 };
  const vx = dx / length, vz = dz / length, hits: number[] = [];
  if (Math.abs(vx) > 1e-9) for (const edge of [bounds.left, bounds.right]) {
    const t = (edge - from.x) / vx, z = from.z + vz * t;
    if (t >= 0 && t <= 10000 && z >= bounds.bottom - 1e-8 && z <= bounds.top + 1e-8) hits.push(t);
  }
  if (Math.abs(vz) > 1e-9) for (const edge of [bounds.bottom, bounds.top]) {
    const t = (edge - from.z) / vz, x = from.x + vx * t;
    if (t >= 0 && t <= 10000 && x >= bounds.left - 1e-8 && x <= bounds.right + 1e-8) hits.push(t);
  }
  const distance = Math.min(...hits);
  return Number.isFinite(distance) ? { x: from.x + vx * distance, z: from.z + vz * distance } : { x: 0, z: 0 };
}

export function warningLineGeometry(from: Point, to: Point, line: RecordData, st: RecordData): ParticleMeshData {
  const dx = to.x - from.x, dz = to.z - from.z, length = Math.hypot(dx, dz);
  const vertices: ParticleMeshData['vertices'] = [], indices: number[] = [];
  if (!length) return { vertices, indices };
  const p = line.m_Parameters, g = p.colorGradient;
  const times = new Set<number>([0, 1]);
  for (const key of p.widthCurve.m_Curve) times.add(key.time);
  for (let i = 0; i < g.m_NumColorKeys; i++) times.add(g['ctime' + i] / 65535);
  for (let i = 0; i < g.m_NumAlphaKeys; i++) times.add(g['atime' + i] / 65535);
  const byte = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  for (const t of [...times].sort((a, b) => a - b)) {
    const half = p.widthMultiplier * curve(p.widthCurve.m_Curve, t) / 2;
    const c = gradient(g, t), color = (byte(c.r) << 16) | (byte(c.g) << 8) | byte(c.b);
    for (const side of [-1, 1]) vertices.push({ x: from.x + dx * t + dz / length * half * side, z: from.z + dz * t - dx / length * half * side,
      u: t * (p.textureMode === 1 ? length : 1) * (st.scale?.x ?? 1) + (st.offset?.x || 0),
      v: (side < 0 ? 0 : 1) * (st.scale?.y ?? 1) - (st.offset?.y || 0), tint: color, alpha: c.a });
    const b = vertices.length - 2, a = b - 2;
    if (a >= 0) indices.push(a, a + 1, b, a + 1, b + 1, b);
  }
  return { vertices, indices };
}
