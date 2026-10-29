import { movingCircleHitTime, movingCapsuleHitTime } from '../combat-collision.js';
import { collideBodies } from './pathogenic-rules.js';

// Swept projectile fixture. num_bounces permits another contact; the mass and
// restitution determine velocity. The formal enemies still use route AI.
export function advanceFixedProjectile(b, dt, targets, onHit, onBounce = () => {}, motion = null) {
  const step = Math.min(b.fixedFirstStep ?? dt, Math.max(0, b.fixedLife - b.age));
  b.fixedFirstStep = null;
  b.fixedContacts ||= new Set();
  // Optional frame fractions keep partial steps and moving targets on one clock.
  const targetAt = (hit, elapsed) => {
    if (!motion) return hit;
    const t = motion.start + (motion.end - motion.start) * (dt > 0 ? elapsed / dt : 0);
    const x = hit.collisionPreviousX ?? hit.x, y = hit.collisionPreviousY ?? hit.y;
    return { x: x + (hit.x - x) * t, y: y + (hit.y - y) * t };
  };
  if(b.fixedNormalize){const speed=Math.hypot(b.vx,b.vy),factor=speed?(b.fixedSpeed||speed)/speed:0;b.vx*=factor;b.vy*=factor;b.fixedNormalize=false;}
  let remaining = step, consumed = false;
  for (let iteration = 0; remaining > 1e-9 && iteration < 16; iteration++) {
    const elapsed = step - remaining;
    for (const hit of b.fixedContacts) {
      const at = targetAt(hit, elapsed);
      if (hit.dead || Math.hypot(b.x-at.x,b.y-at.y) > (hit.hurtRadius ?? hit.radius) + (b.fixedShapeBound ?? b.radius) + .01) b.fixedContacts.delete(hit);
    }
    const x = b.x + b.vx * remaining, y = b.y + b.vy * remaining;
    const speed = Math.hypot(b.vx,b.vy);
    const axis = speed > 1e-9 ? {x:b.vx/speed,y:b.vy/speed} : {x:Math.sin(b.fixedAngle || 0),y:-Math.cos(b.fixedAngle || 0)};
    let contact = null;
    for (const hit of targets) {
      if (hit.dead || b.fixedContacts.has(hit) || b.fixedRemaining>0&&b.fixedTargets.has(hit)) continue;
      const from = targetAt(hit, elapsed), to = targetAt(hit, step);
      const fraction = b.fixedShape
        ? movingCapsuleHitTime(b,{x,y},from,to,axis,b.fixedShape,hit.hurtRadius ?? hit.radius)
        : movingCircleHitTime(b,{x,y},from,to,(hit.hurtRadius ?? hit.radius)+b.radius);
      if (fraction !== null && (!contact || fraction < contact.fraction)) contact = {
        hit, fraction, axis, x: from.x + (to.x-from.x)*fraction, y: from.y + (to.y-from.y)*fraction,
      };
    }
    const fraction = contact?.fraction ?? 1;
    b.fixedDistance = (b.fixedDistance || 0) + Math.hypot(x - b.x, y - b.y) * fraction;
    b.x += (x - b.x) * fraction; b.y += (y - b.y) * fraction;
    remaining *= 1 - fraction;
    if (!contact) break;
    const hit=contact.hit;b.fixedContacts.add(hit);
    if(b.fixedRemaining<=0){
      const along = b.fixedShape ? Math.max(-b.fixedShape.back,Math.min(b.fixedShape.front,
        (contact.x-b.x)*contact.axis.x+(contact.y-b.y)*contact.axis.y)) : 0;
      let nx=b.x+contact.axis.x*along-contact.x,ny=b.y+contact.axis.y*along-contact.y;const n=Math.hypot(nx,ny)||1;nx/=n;ny/=n;
      const t={mass:hit.fixedMass||.8,restitution:0,static:!!hit.fixedStatic,vx:(hit.fixedMotionX||0)+(hit.fixedPushVx||0),vy:(hit.fixedMotionY||0)+(hit.fixedPushVy||0)};
      const oldX=t.vx,oldY=t.vy;b.mass??=30;b.restitution??=0;
      collideBodies(b,t,nx,ny);
      if(!t.static){hit.fixedPushVx=(hit.fixedPushVx||0)+t.vx-oldX;hit.fixedPushVy=(hit.fixedPushVy||0)+t.vy-oldY;}
      b.fixedNormalize=true;b.fixedAngle=Math.atan2(b.vx,-b.vy);
    }
    const time=b.age+step-remaining;
    if(time<(b.fixedIgnoreUntil??-Infinity))continue;
    b.fixedTargets.add(hit);b.fixedHitCount=(b.fixedHitCount||0)+1;b.fixedContactId=(b.fixedContactId||0)+1;
    const along = b.fixedShape ? Math.max(-b.fixedShape.back,Math.min(b.fixedShape.front,
      (contact.x-b.x)*contact.axis.x+(contact.y-b.y)*contact.axis.y)) : 0;
    const cx=b.x+contact.axis.x*along, cy=b.y+contact.axis.y*along;
    const dx=contact.x-cx, dy=contact.y-cy, distance=Math.hypot(dx,dy);
    const reach=Math.min(b.fixedShape?.radius ?? b.radius,distance);
    onHit(hit,{x:cx+(distance?dx/distance*reach:0),y:cy+(distance?dy/distance*reach:0)});
    if (b.fixedRemaining > 0) {
      b.fixedRemaining--;
      b.damage *= b.fixedRules.attenuation;
    } else if (b.fixedBounces > 0) {
      b.fixedBounces--;
      b.fixedIgnoreUntil=time+.15;
      onBounce();
    } else { consumed = true; break; }
  }
  b.age += step;
  return consumed || b.age >= b.fixedLife - 1e-9;
}
