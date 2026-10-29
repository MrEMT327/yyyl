// Display-only sparks sampled from the host's already projected blade edge.
// The simulation clock owns birth/expiry; camera motion never emits a trail.
export const SWORD_SPARK_MATERIAL = 'host://sword-energy-v2/sparks';
export const SWORD_SPARK_LIMIT = 96;
const INTERVAL = .025;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = Number.isFinite;

function random(uid, sequence) {
  let value = (Math.imul(Number(uid) | 0, 1664525) + Math.imul(sequence + 1, 1013904223)) | 0;
  value ^= value >>> 16;
  value = Math.imul(value, 2246822519);
  return (value >>> 0) / 4294967296;
}

function edgeOf(meshes) {
  let best;
  for (const mesh of meshes) {
    const vertices = (mesh.vertices ?? []).filter(vertex =>
      vertex.position?.every(finite) && vertex.uv?.every(finite) && finite(vertex.color?.[3]));
    if (vertices.length < 4) continue;
    const edgeY = Math.min(...vertices.map(vertex => vertex.uv[1]));
    if (Math.abs(edgeY) > .08) continue;
    const edge = vertices.filter(vertex => vertex.uv[1] <= edgeY + .015)
      .sort((a, b) => a.uv[0] - b.uv[0])
      .filter((vertex, index, array) => !index || Math.abs(vertex.uv[0] - array[index - 1].uv[0]) > .00001);
    if (edge.length < 2) continue;
    const alpha = Math.max(...edge.map(vertex => vertex.color[3]));
    if (alpha < .035) continue;
    if (!best || alpha > best.alpha) best = { edge, alpha };
  }
  return best;
}

function pointOn(edge, fraction) {
  const wanted = edge[0].uv[0] + fraction * (edge.at(-1).uv[0] - edge[0].uv[0]);
  let index = 1;
  while (index < edge.length - 1 && edge[index].uv[0] < wanted) index++;
  const a = edge[index - 1], b = edge[index];
  const amount = clamp((wanted - a.uv[0]) / Math.max(.000001, b.uv[0] - a.uv[0]), 0, 1);
  const dx = b.position[0] - a.position[0], dy = b.position[1] - a.position[1];
  const length = Math.hypot(dx, dy);
  if (length < .001) return null;
  return { x: a.position[0] + dx * amount, y: a.position[1] + dy * amount,
    dx: dx / length, dy: dy / length };
}

export class SwordEnergyTrails {
  constructor(view) {
    this.view = view;
    this.clock = -Infinity;
    this.camera = [0, 0];
    this.revision = 0;
    this.emitters = new Map();
    this.particles = [];
  }

  beginFrame(clock, camera = [0, 0]) {
    if (!finite(clock)) return;
    if (clock < this.clock) this.reset();
    this.clock = clock;
    this.camera = [finite(camera[0]) ? camera[0] : 0, finite(camera[1]) ? camera[1] : 0];
    this.revision++;
    this.particles = this.particles.filter(particle => clock - particle.at < particle.life);
  }

  effect(fx, meshes) {
    if (!finite(this.clock) || fx.kind !== 'muzzle' || ![220005, 220017].includes(fx.modelId)
      || !(fx.age >= 0 && fx.age < fx.duration)) return;
    const id = `${fx.modelId}:${fx.uid}`;
    let emitter = this.emitters.get(id);
    if (!emitter) {
      emitter = { lastClock: -Infinity, nextAt: this.clock, sequence: 0, seen: this.revision };
      this.emitters.set(id, emitter);
    }
    emitter.seen = this.revision;
    if (emitter.lastClock === this.clock) return;
    emitter.lastClock = this.clock;
    if (this.clock + 1e-8 < emitter.nextAt) return;
    // A dropped frame samples the current blade once; it never replays missed births.
    emitter.nextAt = this.clock + INTERVAL;
    const sample = edgeOf(meshes);
    if (!sample) return;
    const xs = sample.edge.map(vertex => vertex.position[0]), ys = sample.edge.map(vertex => vertex.position[1]);
    const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const size = clamp(extent / 220, .7, 1.25);
    const center = [xs.reduce((sum, value) => sum + value, 0) / xs.length,
      ys.reduce((sum, value) => sum + value, 0) / ys.length];
    for (let count = 0; count < 3; count++) {
      const sequence = emitter.sequence++, r = random(fx.uid, sequence * 3);
      const point = pointOn(sample.edge, .06 + r * .88);
      if (!point) continue;
      let nx = -point.dy, ny = point.dx;
      if ((point.x - center[0]) * nx + (point.y - center[1]) * ny < 0) { nx *= -1; ny *= -1; }
      const speed = 45 + random(fx.uid, sequence * 3 + 1) * 35;
      const variation = random(fx.uid, sequence * 3 + 2), outward = 60 + variation * 25;
      const direction = fx.originalMirrorX ? -1 : 1;
      const vx = point.dx * speed * direction + nx * outward;
      const vy = point.dy * speed * direction + ny * outward;
      const chip = sequence % 4 === 0;
      if (this.particles.length >= SWORD_SPARK_LIMIT) this.particles.shift();
      this.particles.push({ x: point.x - this.camera[0], y: point.y - this.camera[1], vx, vy,
        angle: Math.atan2(vy, vx), width: Math.min(4.8, (chip ? 4 : 3.2 + variation * 1.6) * size),
        length: Math.min(18, (chip ? 6 : 10 + variation * 8) * size),
        at: this.clock, life: .22 + variation * .11, alpha: Math.min(.95, sample.alpha * 1.05) });
    }
  }

  endFrame() {
    for (const [id, emitter] of this.emitters) if (emitter.seen !== this.revision) this.emitters.delete(id);
    const vertices = [], indices = [];
    for (const particle of this.particles) {
      const age = this.clock - particle.at;
      if (age < 0 || age >= particle.life) continue;
      const fraction = age / particle.life, shrink = 1 - fraction * .45;
      const x = particle.x + particle.vx * age + this.camera[0];
      const y = particle.y + particle.vy * age + this.camera[1];
      const tx = Math.cos(particle.angle) * particle.length * shrink / 2;
      const ty = Math.sin(particle.angle) * particle.length * shrink / 2;
      const nx = -Math.sin(particle.angle) * particle.width * shrink / 2;
      const ny = Math.cos(particle.angle) * particle.width * shrink / 2;
      const base = vertices.length, color = [.65, .94, 1, particle.alpha * (1 - fraction) ** 1.4];
      for (const [along, across, u, v] of [[-1,-1,0,0],[-1,1,0,1],[1,1,1,1],[1,-1,1,0]]) {
        vertices.push({ position: [x + tx * along + nx * across, y + ty * along + ny * across], uv: [u, v], color });
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    if (indices.length) this.view.drawMeshes('sword-energy:trails', [{ key: 'sparks',
      material: { $ref: SWORD_SPARK_MATERIAL }, z: 3, vertices, indices }]);
  }

  reset() {
    this.emitters.clear();
    this.particles = [];
    this.clock = -Infinity;
    this.revision = 0;
  }
}
