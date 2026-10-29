import { Graphics } from '../three/display.js';
import { XP_PRESENTATION as COLOR } from '../experience-presentation.js';

export function createExperienceChip(value) {
  // Keep the old pickup size/radius tiers; only the silhouette/material changes.
  const size = value >= 12 ? 14 : value >= 4 ? 11 : 8;
  const x = size * .9, y = size * .9, cut = size * .45;
  const view = new Graphics()
    .poly([-x,-y,x-cut,-y,x,-y+cut,x,y,-x,y])
    .fill({color:COLOR.fill}).stroke({color:COLOR.ink,width:2.2})
    .poly([x-cut,-y,x,-y+cut,x,y,x-size*.3,y,x-size*.3,-y+cut])
    .fill({color:COLOR.shade})
    .moveTo(-x+2,y-2).lineTo(-x+2,-y+2).lineTo(x-cut-1,-y+2)
    .stroke({color:COLOR.light,width:1.5});
  const bars = value >= 12 ? 3 : 2;
  for (let i = 0; i < bars; i++) {
    const barY = (i - (bars - 1) / 2) * size * .46;
    view.rect(-size*.42,barY-size*.08,size*.72,size*.16).fill({color:COLOR.ink,alpha:.88});
  }
  view.bloom = false;
  view.eventMode = 'none';
  view.label = 'experience-chip';
  return {view, radius:size+5};
}

// All XP tails share one display object and a fixed number of short histories.
// This never caps XP entities, changes attraction, or discards their rewards.
export function createExperienceTrails(parent) {
  const view = new Graphics();
  view.eventMode = 'none'; view.bloom = false; view.label = 'experience-trails';
  parent.addChildAt(view, 0);
  const records = new Map();
  const pointLimit = 5, maxTrails = 12;
  let time = 0, frame = 0, nextPaint = 0;
  return {
    update(orbs, dt, {enabled=true, crowded=false}={}) {
      time += Math.max(0, Math.min(.05, dt)); frame++;
      const limit = enabled ? (crowded ? 6 : maxTrails) : 0;
      let changed = false;
      while (records.size > limit) { records.delete(records.keys().next().value); changed = true; }
      for (const orb of orbs) {
        if (!limit || !orb.collectFlight || orb.collectFlight.reduced) continue;
        let record = records.get(orb);
        if (!record) {
          if (records.size >= limit) continue;
          record = {points:new Float32Array(pointLimit*2), head:0, count:0, sampledAt:-Infinity, frame};
          records.set(orb, record); changed = true;
        }
        record.frame = frame;
        if (time - record.sampledAt >= .04) {
          record.points[record.head*2] = orb.x;
          record.points[record.head*2+1] = orb.y;
          record.head = (record.head + 1) % pointLimit;
          record.count = Math.min(pointLimit, record.count + 1);
          record.sampledAt = time;
        }
      }
      for (const [orb, record] of records) {
        if (record.frame !== frame) { records.delete(orb); changed = true; }
      }
      if (!changed && time < nextPaint) return;
      nextPaint = time + 1/30;
      view.clear();
      for (const [orb, record] of records) {
        let previousX, previousY;
        for (let i = 0; i <= record.count; i++) {
          const index = (record.head - record.count + i + pointLimit) % pointLimit;
          const x = i === record.count ? orb.x : record.points[index*2];
          const y = i === record.count ? orb.y : record.points[index*2+1];
          if (i > 0) view.moveTo(previousX,previousY).lineTo(x,y)
            .stroke({color:COLOR.trail,width:1+i/pointLimit,alpha:i/pointLimit*.3});
          previousX = x; previousY = y;
        }
      }
    },
    clear() { records.clear(); view.clear(); time=0; frame=0; nextPaint=0; },
  };
}
