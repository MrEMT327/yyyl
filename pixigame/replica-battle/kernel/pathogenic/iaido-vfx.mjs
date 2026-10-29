// Black Samurai's travelling blade and its first-hit dimension cut. Presentation
// reads the live collider and lifetime; it never owns hits, movement or timers.
const WEAPONS = new Set([400006, 400019, 400007]);
const PREFIX = 'host://iaido-v1/';
export const IAIDO_PARTICLE_LIMIT = 128;
const finite = Number.isFinite;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const isIaidoProjectile = b => b.owner === 'player' && WEAPONS.has(b.weaponId);
const visible = b => isIaidoProjectile(b) && !b.dead && !b.visualHidden
  && finite(b.age) && finite(b.lifetime) && b.age >= 0 && b.age < b.lifetime
  && finite(b.radiusX) && finite(b.radiusZ) && b.radiusX > 0 && b.radiusZ > 0;

export function withIaidoResources(graph) {
  const resources = {...graph.resources}, shaders = {...graph.shaders};
  for (const name of ['blade', 'particle']) resources[PREFIX + name] = {
    type: 'ShaderMaterial', properties: {shader: {$external: PREFIX + name + '-shader'}}};
  shaders[PREFIX + 'blade-shader'] = {code: `shader_type canvas_item;
render_mode unshaded, blend_add;
uniform float blade_age = 0.0;
void fragment(){
  float tip=pow(max(0.0,sin(UV.x*3.14159265)),0.4);
  float d=abs(UV.y-0.15);
  float core=exp(-d*32.0);
  float rim=exp(-d*10.0);
  float flow=pow(0.5+0.5*sin(UV.x*38.0-blade_age*27.0),3.0);
  float behind=smoothstep(0.13,0.3,UV.y);
  float wake=exp(-d*3.5)*behind*(0.14+0.14*flow);
  float veinAt=0.4+0.035*sin(UV.x*26.0-blade_age*19.0);
  float vein=(1.0-smoothstep(0.003,0.025,abs(UV.y-veinAt)))*flow*0.22;
  vec3 light=mix(vec3(0.46,0.16,1.2),vec3(0.5,0.72,1.35),rim);
  light=mix(light,vec3(1.35,1.45,1.65),core);
  COLOR=vec4(light*COLOR.rgb,COLOR.a*tip*clamp(core*1.05+rim*0.65+wake+vein,0.0,1.0));
}`};
  shaders[PREFIX + 'particle-shader'] = {code: `shader_type canvas_item;
render_mode unshaded, blend_add;
void fragment(){
  vec2 q=UV*2.0-1.0;
  float taper=1.0-smoothstep(0.45,1.0,abs(q.x));
  float core=exp(-q.y*q.y*38.0);
  float glow=exp(-q.y*q.y*5.0);
  COLOR=vec4(mix(COLOR.rgb,vec3(1.2,1.1,1.4),core),COLOR.a*taper*(0.85*core+0.15*glow));
}`};
  return {...graph, resources, shaders};
}

function basis(b, screen) {
  const yaw = b.angle ?? 0, dx = Math.sin(yaw), dz = Math.cos(yaw);
  const x = b.x + dx * (b.offsetZ ?? 0) + dz * (b.offsetX ?? 0);
  const z = b.z + dz * (b.offsetZ ?? 0) - dx * (b.offsetX ?? 0);
  return (across, along) => screen(x + dz * across + dx * along, z - dx * across + dz * along);
}

function ribbon(key, point, width, depth, age, alpha, delay, dimension) {
  const vertices = [], indices = [], steps = dimension ? 36 : 32;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps, t = u * 2 - 1, taper = Math.max(.012, 1 - t * t);
    const edge = dimension ? Math.sin(t * Math.PI) * width * .07 : depth * (.72 * taper - .36);
    const thickness = (dimension ? width * .9 : depth * 1.12) * Math.sqrt(taper);
    for (const v of [0, 1]) {
      const cross = edge + (.15 - v) * thickness - delay;
      const p = dimension ? point(cross, t * depth) : point(t * width, cross);
      vertices.push({position: [p.x, p.y], uv: [u, v], color: [1, 1, 1, alpha]});
    }
    if (i) { const n = i * 2; indices.push(n - 2, n - 1, n, n, n - 1, n + 1); }
  }
  return {key, material: {$ref: PREFIX + 'blade'}, materialUniformOverrides: {blade_age: age},
    z: key === 'edge' ? 5 : 4, vertices, indices};
}

export function iaidoScreenMeshes(b, screen) {
  if (!visible(b)) return [];
  const point = basis(b, screen), dimension = b.weaponId === 400007;
  const attack = clamp(b.age / .025, .04, 1);
  const release = clamp((b.lifetime - b.age) / (dimension ? .22 : .08), 0, 1);
  const alpha = attack * release * (dimension ? .8 + .2 * Math.exp(-b.age * 22) : 1);
  const width = b.radiusX, depth = b.radiusZ;
  // Each layer stays within the live collision envelope. Offset and size are
  // already scaled by the simulation; multiplying b.scale again is incorrect.
  return [
    ribbon('wake-far', point, width * .94, depth * .9, b.age - .06, alpha * .13, (dimension ? width : depth) * .3, dimension),
    ribbon('wake-near', point, width * .98, depth * .96, b.age - .03, alpha * .24, (dimension ? width : depth) * .15, dimension),
    ribbon('edge', point, width, depth, b.age, alpha, 0, dimension),
  ];
}

function random(uid, n) {
  let x = (Math.imul(Number(uid) | 0, 1664525) + Math.imul(n + 1, 1013904223)) | 0;
  x ^= x >>> 16; x = Math.imul(x, 2246822519);
  return (x >>> 0) / 4294967296;
}

export class IaidoVfx {
  constructor(view) {
    this.view = view;
    this.emitters = new Map();
    this.particles = [];
    this.clock = -Infinity;
    this.camera = [0, 0];
    this.revision = 0;
  }
  beginFrame(clock, camera = [0, 0]) {
    if (!finite(clock)) return;
    if (clock < this.clock) this.reset();
    this.clock = clock;
    this.camera = [finite(camera[0]) ? camera[0] : 0, finite(camera[1]) ? camera[1] : 0];
    this.revision++;
    this.particles = this.particles.filter(p => clock - p.at < p.life);
  }
  projectile(b, screen) {
    if (!isIaidoProjectile(b)) return false;
    const meshes = iaidoScreenMeshes(b, screen);
    if (!meshes.length || !finite(this.clock)) return true;
    this.view.drawMeshes(`iaido:${b.uid}`, meshes);
    let emitter = this.emitters.get(b.uid);
    const fresh = !emitter;
    if (!emitter) {
      emitter = {nextAt: this.clock, lastAt: -Infinity, sequence: 0, seen: this.revision};
      this.emitters.set(b.uid, emitter);
    }
    emitter.seen = this.revision;
    if (emitter.lastAt === this.clock || this.clock + 1e-8 < emitter.nextAt) return true;
    emitter.lastAt = this.clock; emitter.nextAt = this.clock + .025;
    const point = basis(b, screen), center = point(0, 0), ahead = point(0, 1);
    const distance = Math.hypot(ahead.x - center.x, ahead.y - center.y);
    if (distance < .0001) return true;
    const fx = (ahead.x - center.x) / distance, fy = (ahead.y - center.y) / distance;
    const dimension = b.weaponId === 400007;
    const count = dimension ? (fresh ? 12 : 2) : 3;
    for (let i = 0; i < count; i++) {
      const seq = emitter.sequence++, r = random(b.uid, seq * 3), v = random(b.uid, seq * 3 + 1);
      const t = r * 1.84 - .92;
      const at = dimension ? point(0, t * b.radiusZ) : point(t * b.radiusX, b.radiusZ * (.72 * (1 - t * t) - .36));
      const side = t < 0 ? -1 : 1, sideways = side * (30 + v * 55);
      const backward = dimension ? 10 + r * 20 : -45 - r * 60;
      const vx = -fy * sideways + fx * backward, vy = fx * sideways + fy * backward;
      if (this.particles.length >= IAIDO_PARTICLE_LIMIT) this.particles.shift();
      this.particles.push({x: at.x - this.camera[0], y: at.y - this.camera[1], vx, vy,
        at: this.clock, life: .2 + v * .16, length: 7 + v * 10, width: 3.2 + v * 1.8,
        alpha: dimension ? .85 : .75, angle: Math.atan2(vy, vx)});
    }
    return true;
  }
  endFrame() {
    for (const [id, emitter] of this.emitters) if (emitter.seen !== this.revision) this.emitters.delete(id);
    const vertices = [], indices = [];
    for (const p of this.particles) {
      const age = this.clock - p.at;
      if (age < 0 || age >= p.life) continue;
      const f = age / p.life, shrink = 1 - f * .6;
      const x = p.x + p.vx * age + this.camera[0], y = p.y + p.vy * age + this.camera[1];
      const tx = Math.cos(p.angle) * p.length * shrink / 2, ty = Math.sin(p.angle) * p.length * shrink / 2;
      const nx = -Math.sin(p.angle) * p.width * shrink / 2, ny = Math.cos(p.angle) * p.width * shrink / 2;
      const base = vertices.length, color = [.58, .48, 1, p.alpha * (1 - f) ** 1.5];
      for (const [a, c, u, v] of [[-1,-1,0,0],[-1,1,0,1],[1,1,1,1],[1,-1,1,0]])
        vertices.push({position: [x + tx * a + nx * c, y + ty * a + ny * c], uv: [u,v], color});
      indices.push(base, base+1, base+2, base, base+2, base+3);
    }
    if (indices.length) this.view.drawMeshes('iaido:particles', [{key: 'sparks', z: 6,
      material: {$ref: PREFIX + 'particle'}, vertices, indices}]);
  }
  reset() {
    this.emitters.clear(); this.particles = []; this.clock = -Infinity; this.revision = 0;
  }
}
