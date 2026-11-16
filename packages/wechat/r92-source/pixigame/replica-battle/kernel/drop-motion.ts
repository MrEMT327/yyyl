import { clamp, type Pickup, type Point } from './model';

// DropItemEntity: native ctor .4 s, radius [1.8,3], EaseOutSine;
// GetAbsorbRunAwayDistance [2,3], duration [.15,.2], acceleration 188.
export function createPickup(uid: number, itemId: number, modelId: number, kind: Pickup['kind'], value: number, origin: Point, index: number, random: () => number): Pickup {
  const angle = random() * Math.PI * 2, radius = 1.8 + random() * 1.2;
  // Callers pass an Enemy as the position. Copy coordinates only: spreading
  // that object overwrites the pickup's uid/modelId with the dead monster.
  return { uid, itemId, modelId, kind, value, x: origin.x, z: origin.z, origin: { x: origin.x, z: origin.z }, destination: { x: origin.x + Math.cos(angle) * radius, z: origin.z + Math.sin(angle) * radius }, age: 0, delay: index * .1, state: 'scatter', stateTime: 0, speed: 0, retreatDistance: 2 + random(), retreatDuration: .15 + random() * .05, attracted: false };
}

export function advancePickup(item: Pickup, player: Point, dt: number, options: {
  canAbsorb?: (age: number) => boolean; distance?: number; dropSpeed?: number;
  beginAbsorb?: () => { retreatDistance: number; retreatDuration: number };
} = {}): boolean {
  item.age += dt;
  if (item.age < item.delay) return false;
  const elapsed = Math.max(0, item.age - item.delay);
  if (item.state === 'scatter') {
    const t = Math.sin(clamp(elapsed / .399993896484375, 0, 1) * Math.PI / 2);
    item.x = item.origin.x + (item.destination.x - item.origin.x) * t;
    item.z = item.origin.z + (item.destination.z - item.origin.z) * t;
    if (t < .93) return false;
    item.state = 'stay'; item.stateTime = 0;
  }
  const dx = player.x - item.x, dz = player.z - item.z, distance = Math.hypot(dx, dz);
  if (item.state === 'stay') {
    // AttributeData initializes numeric defaults divided by 100: HP 800 -> 8,
    // gold / experience 1500 -> 15. No arbitrary four-second auto-collection.
    if (options.canAbsorb && !options.canAbsorb(item.age) || !item.attracted && distance > (options.distance ?? (item.kind === 'heart' ? 8 : 15))) { item.z -= (options.dropSpeed ?? 2.5) * dt; return false; }
    if (options.beginAbsorb) Object.assign(item, options.beginAbsorb());
    item.attracted = true; item.state = 'retreat'; item.stateTime = 0;
    item.origin = { x: item.x, z: item.z };
    item.destination = { x: item.x - dx / Math.max(.001, distance) * item.retreatDistance, z: item.z - dz / Math.max(.001, distance) * item.retreatDistance };
  }
  item.stateTime += dt;
  if (item.state === 'retreat') {
    const t = clamp(item.stateTime / item.retreatDuration, 0, 1), eased = 1 - (1 - t) ** 2;
    item.x = item.origin.x + (item.destination.x - item.origin.x) * eased;
    item.z = item.origin.z + (item.destination.z - item.origin.z) * eased;
    if (t === 1) { item.state = 'absorb'; item.stateTime = 0; }
    return false;
  }
  item.speed += 188 * dt;
  const step = Math.min(distance, item.speed * dt);
  item.x += dx / Math.max(.001, distance) * step;
  item.z += dz / Math.max(.001, distance) * step;
  return distance <= step + .25;
}
