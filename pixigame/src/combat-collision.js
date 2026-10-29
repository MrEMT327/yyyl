// Both circles move over the same frame. Work in relative coordinates so a
// fast drag and an oncoming projectile cannot pass through between endpoints.
export function movingCircleHitTime(start, end, targetStart, targetEnd, radius) {
  const x = start.x - targetStart.x, y = start.y - targetStart.y;
  const endX = end.x - targetEnd.x, endY = end.y - targetEnd.y;
  // Conservative swept bounds: reject distant pairs before solving a
  // quadratic, while retaining crossing targets and contacts at either end.
  if ((x > radius && endX > radius) || (x < -radius && endX < -radius)
    || (y > radius && endY > radius) || (y < -radius && endY < -radius)) return null;
  const dx = end.x - start.x - (targetEnd.x - targetStart.x);
  const dy = end.y - start.y - (targetEnd.y - targetStart.y);
  const c = x * x + y * y - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a <= 1e-12) return null;
  const b = x * dx + y * dy;
  if (b >= 0) return null;
  const discriminant = b * b - a * c;
  if (discriminant < 0) return null;
  const time = (-b - Math.sqrt(discriminant)) / a;
  return time >= 0 && time <= 1 ? time : null;
}

// A capsule translates without rotating during a single flight segment.
// Solve target motion in its frame, then take the first end-cap or strip hit.
export function movingCapsuleHitTime(start, end, targetStart, targetEnd, axis, shape, targetRadius) {
  const bound = targetRadius + shape.radius + Math.max(shape.front,shape.back);
  if (movingCircleHitTime(start,end,targetStart,targetEnd,bound) === null) return null;
  const from = {x:targetStart.x-start.x,y:targetStart.y-start.y};
  const to = {x:targetEnd.x-end.x,y:targetEnd.y-end.y};
  const a = {x:-axis.x*shape.back,y:-axis.y*shape.back};
  const z = {x:axis.x*shape.front,y:axis.y*shape.front};
  const radius = shape.radius + targetRadius;
  let first = movingCircleHitTime(from,to,a,a,radius);
  const last = movingCircleHitTime(from,to,z,z,radius);
  if (last !== null) first = first === null ? last : Math.min(first,last);
  const length = shape.front + shape.back;
  if (length <= 1e-12) return first;
  const along = (from.x-a.x)*axis.x + (from.y-a.y)*axis.y;
  const across = -from.x*axis.y + from.y*axis.x;
  const dx = to.x-from.x, dy = to.y-from.y;
  let enter = 0, exit = 1;
  for (const [p,v,low,high] of [
    [along,dx*axis.x+dy*axis.y,0,length],
    [across,-dx*axis.y+dy*axis.x,-radius,radius],
  ]) {
    if (Math.abs(v) < 1e-12) { if (p < low || p > high) return first; }
    else {
      const t0 = (low-p)/v, t1 = (high-p)/v;
      enter = Math.max(enter,Math.min(t0,t1));
      exit = Math.min(exit,Math.max(t0,t1));
      if (enter > exit) return first;
    }
  }
  return first === null ? enter : Math.min(first,enter);
}

function pointSegmentDistanceSquared(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared > 0
    ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared)) : 0;
  return (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2;
}

// A moving circle against a stationary beam (including the beam's end caps).
export function sweptCircleHitsSegment(start, end, a, b, radius) {
  const dx = end.x - start.x, dy = end.y - start.y;
  const bx = b.x - a.x, by = b.y - a.y;
  const cross = dx * by - dy * bx;
  if (Math.abs(cross) > 1e-12) {
    const ax = a.x - start.x, ay = a.y - start.y;
    const t = (ax * by - ay * bx) / cross;
    const u = (ax * dy - ay * dx) / cross;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
  }
  return Math.min(
    pointSegmentDistanceSquared(start, a, b), pointSegmentDistanceSquared(end, a, b),
    pointSegmentDistanceSquared(a, start, end), pointSegmentDistanceSquared(b, start, end),
  ) <= radius * radius;
}
