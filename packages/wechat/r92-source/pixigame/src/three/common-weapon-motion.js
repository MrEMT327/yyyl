// Render-only timing. Never changes projectile centers, damage or lifetime.
export function grenadeHop(age = 0) {
  const phase = ((age % .45) + .45) % .45 / .45;
  return 4 * phase * (1 - phase);
}
export function moltenSquash(age = 0) {
  const since = ((age % 1.1) + 1.1) % 1.1;
  return Math.max(0, 1 - since / .16) * Math.min(1, age / .08);
}

// Identity-based variation: stable across frames, movement and batch reorder.
// Never consume the simulation's random stream or cache expired field IDs.
export function toxinShapeSeed(visual) {
  const key=String(visual.id ?? `${visual.x ?? 0}/${visual.y ?? 0}`);
  let hash=2166136261;
  for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619);
  hash=Math.imul(hash^(hash>>>16),0x45d9f3b);
  return ((hash^(hash>>>16))&65535)/65536;
}
