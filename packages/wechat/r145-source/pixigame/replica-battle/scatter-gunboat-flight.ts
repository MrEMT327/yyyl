const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
let visualSerial = 0;

// Visual inertia only. Never feed these offsets back into routes, muzzles or
// collision cores. All displacement is expressed in game pixels by the adapter.
export function createEnemyFlightMotion(spec: { id: string; tier: string }, seed = 0) {
  const boss = spec.tier === 'Boss', elite = spec.tier === '精英';
  const radial = /saucer|ring|petal|turbine|trilobe/.test(spec.id);
  const heavy = boss || elite || /boiler|gunboat|sac/.test(spec.id);
  const response = boss ? 3 : heavy ? 4.5 : 7;
  const turnLimit = radial ? .065 : boss ? .075 : elite ? .13 : .28;
  // Some scripted spawns share the same gameplay seed. A render-only serial
  // separates their idle phases without consuming the combat random stream.
  let hash = (seed >>> 0) ^ Math.imul(++visualSerial, 2654435761) ^ 2166136261;
  for (const char of spec.id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const phase = (hash % 6283) / 1000;
  const tempo = .94 + ((hash >>> 8) % 13) / 100;
  let clock = 0, turn = 0, bank = 0, speed = 0, charge = 0;
  const pose = { angle: 0, bank: 0, lag: 0, x: 0, y: 0, time: phase, charge: 0 };
  return {
    update(dt: number, vx = 0, vy = 0, charging = false) {
      dt = clamp(Number.isFinite(dt) ? dt : 0, 0, .05);
      clock += dt;
      const follow = 1 - Math.exp(-response * dt);
      charge += ((charging ? 1 : 0) - charge) * (1 - Math.exp(-12 * dt));
      // Forward-facing firing platforms bank instead of spinning through 180°
      // when leaving upward. Circular hulls retain their radial presentation.
      const target = -clamp(vx / 190, -1, 1) * turnLimit;
      turn += (target - turn) * follow;
      bank += (turn - bank) * (1 - Math.exp(-response * .6 * dt));
      speed += (clamp(Math.hypot(vx, vy) / 160, 0, 1) - speed) * follow;
      const idle = (1 - speed * .8) * (1 - charge * .8);
      const t = clock * tempo + phase;
      pose.angle = turn + Math.sin(t * 1.35) * (boss ? .008 : .015) * idle;
      pose.bank = bank;
      pose.lag = clamp(turn - bank, -.08, .08);
      pose.x = Math.sin(t * 1.1) * idle * (boss ? .7 : 1.2);
      pose.y = Math.sin(t * 1.7) * idle * (boss ? 1 : 1.8);
      pose.time = clock * tempo + phase;
      pose.charge = charge;
      return pose;
    },
  };
}
