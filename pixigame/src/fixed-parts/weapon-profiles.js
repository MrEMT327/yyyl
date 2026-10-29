import { ORIGINAL_WEAPONS } from './pathogenic-rules.js';
import { ENERGY_PROFILES } from './energy-profiles.js';
export const ORIGINAL_VIEW_HEIGHT=4600;
// One scale for speed and collision radius; base damage is the source value.
export const FIXED_WEAPON_PROFILES = Object.freeze({
  ...ENERGY_PROFILES,
  missile: Object.freeze({interval:1.7,damage:280,shots:1,shotGap:0,spreadDegrees:0,speedRatio:2500/ORIGINAL_VIEW_HEIGHT,life:3,radius:42,mass:.8,restitution:1,bounces:0}),
  twin: Object.freeze({ ...ORIGINAL_WEAPONS.twin, shots:3,shotGap:.06,spreadDegrees:2,speedRatio:4500/ORIGINAL_VIEW_HEIGHT }),
  rail: Object.freeze({ ...ORIGINAL_WEAPONS.rail, shots:1,shotGap:0,spreadDegrees:0,speedRatio:6000/ORIGINAL_VIEW_HEIGHT }),
});

// Original bullets inherit only the positive forward component of body motion.
export function fixedLaunchVelocity(angle, speed, velocity = { x: 0, y: 0 }) {
  const x = Math.sin(angle), y = -Math.cos(angle);
  const total = speed + Math.max(0, velocity.x * x + velocity.y * y);
  return { x: x * total, y: y * total };
}
