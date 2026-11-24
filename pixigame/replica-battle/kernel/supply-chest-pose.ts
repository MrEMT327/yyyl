export type ChestPose = { animation: string; animationAge: number; progress: number };
export const clamp = (n: number) => Math.max(0, Math.min(1, n));
export const smooth = (a: number, b: number, n: number) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };
const landedChestY = -4;

/** Presentation fits inside the existing birth clip. Nothing here advances
 * the simulation or waits for the parachute before allowing pickup. */
export function supplyChestPose(chest: ChestPose, duration: number, animationAge = chest.animationAge) {
  const age = Number.isFinite(animationAge) ? Math.max(0, animationAge) : 0;
  const length = Number.isFinite(duration) && duration > 0 ? duration : 1.5;
  const progress = clamp(age / length), born = chest.animation === 'Born';
  const time = age * 1.5 / length;
  let scale = 1, alpha = 1, y = landedChestY, rotation = 0, idle = 1, x = 0;
  if (born) {
    const fall = smooth(.03, .98, time), suspended = 1 - smooth(.84, 1.04, time);
    scale = .88 + .12 * fall + Math.exp(-Math.pow((time - 1.05) / .07, 2)) * .025;
    alpha = smooth(.015, .13, time);
    y -= (1 - fall) * 170;
    x = Math.sin(time * 6.5) * 5 * suspended;
    rotation = Math.sin(time * 6.5) * .025 * suspended;
    if (time > .98) y += Math.sin((time - .98) * 18) * Math.exp(-(time - .98) * 8) * 3;
    idle = smooth(.98, 1.18, time);
  } else if (chest.animation === 'Death') {
    scale = 1 - progress * .3; alpha = 1 - progress; y -= progress * 12;
    idle = 1 - progress;
  } else {
    y += Math.sin(age * 3) * 2;
    if (chest.progress > 0 || chest.animation === 'Enter') rotation = Math.sin(age * 36) * .035;
  }
  const active = born && time >= 1 / 60 && time < 1.5;
  const beam = active ? smooth(1 / 60, .09, time) * (1 - smooth(.90, 1.12, time)) : 0;
  const flash = active ? Math.exp(-Math.pow((time - 1.02) / .045, 2)) : 0;
  const canopyDrop = born ? smooth(1.04, 1.36, time) : 1;
  const collapse = born ? smooth(1.10, 1.36, time) : 1;
  const canopyAlpha = born ? smooth(.015, .13, time) * (1 - smooth(1.40, 1.50, time)) : 0;
  return { age, time, active, beam, flash, fall: smooth(.03, .98, time),
    ringA: active ? clamp((time - .98) / .34) : 1,
    ringB: active ? clamp((time - 1.05) / .42) : 1,
    canopyAlpha, canopyDrop, collapse, smokeTime: born ? time : 1.5 + age,
    smokeStrength: chest.animation === 'Death' ? 0 : 1,
    idle, scale, alpha, x, y, rotation };
}

type SupplyChestPose = ReturnType<typeof supplyChestPose>;

export function supplyCanopyTransform(pose: SupplyChestPose, bodyHeight: number) {
  const drop = pose.canopyDrop;
  const width = 138 * (1 - .50 * pose.collapse);
  const height = 69 * (1 - .72 * pose.collapse);
  const ground = landedChestY + bodyHeight / 2;
  const suspendedY = pose.y - bodyHeight * .38 - 82;
  // The visible hem extends about 31% of the sprite height below its center.
  const restingY = ground - height * .31;
  return {
    x: pose.x + Math.sin(pose.time * 5.3) * 4 * (1 - drop) + 64 * drop,
    y: suspendedY + (restingY - suspendedY) * drop,
    width, height, ground,
    rotation: .7 * pose.rotation * (1 - drop) + .88 * drop * (1 - drop),
    cordAlpha: pose.canopyAlpha * (1 - smooth(.72, 1, drop)),
    slack: 14 * drop,
  };
}

export function traceSupplyCords(pose: SupplyChestPose, bodyHeight: number,
  canopy: ReturnType<typeof supplyCanopyTransform>, anchors: readonly (readonly [number, number])[],
  draw: (x: number, y: number, endX: number, endY: number) => void) {
  const cos = Math.cos(canopy.rotation), sin = Math.sin(canopy.rotation);
  const socketY = pose.y - bodyHeight * .26 * pose.scale;
  const segments = canopy.slack > 0 ? 4 : 1;
  for (const [i, [u, v]] of anchors.entries()) {
    const dx = (u - .5) * canopy.width, dy = (v - .5) * canopy.height;
    const startX = canopy.x + dx * cos - dy * sin;
    const startY = canopy.y + dx * sin + dy * cos;
    const socketX = pose.x + (i < 2 ? -24 : 24) * pose.scale;
    let x = startX, y = startY;
    for (let step = 1; step <= segments; step++) {
      const t = step / segments;
      const nextX = startX + (socketX - startX) * t;
      const nextY = Math.min(canopy.ground, startY + (socketY - startY) * t + 4 * t * (1 - t) * canopy.slack);
      draw(x, y, nextX, nextY);
      x = nextX; y = nextY;
    }
  }
}

