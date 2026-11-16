// Independently adapted firing rules from the researched rRootage catalog.
// Source links, scope and omitted projectile behaviors: docs/barrage-integration.md.
// Pure emission plans only: no meshes, timers, homing or in-flight mutations.
const TAU = Math.PI * 2;
const DOWN = Math.PI / 2;
export const BARRAGE_GAP_HALF_ANGLE = Math.PI / 5; // 72-degree escape wedge.
const angularDistance = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const indexOf = (value, size) => ((Math.floor(Number(value) || 0) % size) + size) % size;

export const ELITE_RESOURCE_DECKS = Object.freeze([
  ['E01', 'E02', 'E07', 'E04'],
  ['E02', 'E03', 'E06', 'E07'],
  ['E04', 'E01', 'E07', 'E03'],
  ['E05', 'E08', 'E03', 'E04'],
  ['E06', 'E08', 'E07', 'E05'],
].map(deck => Object.freeze(deck)));

const REGULAR_DECKS = [
  {scout:'S01', dart:'S04', heavy:'S03', turret:'S03', relay:'S02'},
  {scout:'S01', dart:'S02', heavy:'S04', turret:'S02', relay:'S06'},
  {scout:'S06', dart:'S05', heavy:'S03', turret:'S03', relay:'S04'},
  {scout:'S05', dart:'S04', heavy:'S03', turret:'S04', relay:'S06'},
  {scout:'S06', dart:'S05', heavy:'S04', turret:'S03', relay:'S02'},
];

export function regularResourceId({chapter = 0, kind = 'scout', route, x = 300, width = 600, seed = 0}) {
  // Side shots belong to side-entry aircraft, never arbitrary central turrets.
  if (['crossing', 'sideDive', 'pincer', 'hook'].includes(route?.template)
    && (x < width * .22 || x > width * .78) && indexOf(seed, 3) === 0) return 'S07';
  return REGULAR_DECKS[indexOf(chapter, 5)][kind] || 'S01';
}

const NAMES = {
  S01:'锁定点射', S02:'短促双连', S03:'宽角三发', S04:'左右交替', S05:'双路斜射', S06:'扇区散点', S07:'侧边横射',
  E01:'双翼分扇', E02:'两段点射', E03:'往返扫射', E04:'快慢弹列', E05:'摆动射流', E06:'四向旋轮', E07:'错拍小扇', E08:'双拍缺口环',
  B01:'错拍大扇', B02:'双舷往返', B03:'四臂螺旋', B04:'双速错环', B05:'快慢束阵', B06:'弧线轮射', B07:'渐扩双扇', B12:'变速椭环',
};
export const IMPLEMENTED_BARRAGE_RESOURCES = Object.freeze([...Object.keys(NAMES), 'S08']);

export function barrageResourcePlan(id, {x, y, targetX = x, targetY = y + 300, volley = 0, seed = 0, width = 600}) {
  if (!NAMES[id]) throw new Error(`Unknown barrage resource: ${id}`);
  const regular = id.startsWith('S'), elite = id.startsWith('E');
  const shots = [], aim = Math.atan2(targetY - y, targetX - x);
  const speed = regular ? 132 : elite ? 116 : 122;
  const wing = elite ? 24 : 54;
  const add = (angle, velocity = speed, delay = 0, ox = x, oy = y + 18) => shots.push({x:ox, y:oy, angle, speed:velocity, delay});
  const fan = (angle, count, step, delay = 0, velocity = speed, ox = x, oy = y + 18) => {
    for (let i = 0; i < count; i++) add(angle + (i - (count - 1) / 2) * step, velocity, delay, ox, oy);
  };
  const ring = (count, spin, delay, velocity = speed, oval = false) => {
    for (let i = 0; i < count; i++) {
      const angle = i * TAU / count + spin;
      if (angularDistance(angle, DOWN) < BARRAGE_GAP_HALF_ANGLE) continue;
      // An oval-looking front from different INITIAL speeds, not acceleration.
      add(angle, oval ? velocity * (.82 + .18 * Math.abs(Math.cos(angle))) : velocity, delay);
    }
  };
  switch (id) {
    case 'S01': add(aim); break;
    case 'S02': add(aim, speed, 0); add(aim, speed, .4); break;
    case 'S03': fan(aim, 3, .36, 0, 126); break;
    case 'S04': add(aim - .36, 126); add(aim + .36, 126, .5); break;
    case 'S05': add(DOWN - .4, 118); add(DOWN + .4, 118); break;
    case 'S06': {
      // Reproducible, small deviations, not unrestricted random crossfire.
      const offset = (indexOf(seed * 17 + volley * 7, 9) - 4) * .065;
      add(aim + offset, 124); break;
    }
    case 'S07': add(x < width / 2 ? 0 : Math.PI, 112); break;
    case 'E01':
      for (const side of [-1, 1]) fan(DOWN - side * .48, 3, .18, 0, speed, x + side * wing);
      break;
    case 'E02': fan(aim, 3, .22); fan(aim, 3, .22, .75); break;
    case 'E03':
      for (const [i, offset] of [-.5, 0, .5, .5, 0, -.5].entries()) add(DOWN + offset, speed, i < 3 ? i * .48 : 1.85 + (i - 3) * .48);
      break;
    case 'E04':
      for (let i = 0; i < 3; i++) add(aim, 104 + i * 14, i * .48);
      break;
    case 'E05': {
      const side = indexOf(volley, 2) ? 1 : -1;
      for (let i = 0; i < 5; i++) add(DOWN - side * (.35 + Math.sin(i * Math.PI / 2) * .24), 110, i * .48, x + side * wing);
      break;
    }
    case 'E06':
    case 'B03': {
      const beats = elite ? 3 : 4;
      for (let beat = 0; beat < beats; beat++) for (let arm = 0; arm < 4; arm++) {
        const angle = Math.PI / 4 + arm * TAU / 4 + beat * .13;
        if (angularDistance(angle, DOWN) >= BARRAGE_GAP_HALF_ANGLE) add(angle, 110, beat * .6);
      }
      break;
    }
    case 'E07': fan(aim, 3, .3, 0, 105); fan(aim, 5, .24, .85, 122); break;
    case 'E08': ring(7, .12, 0, 102); ring(7, .32, .9, 102); break;
    case 'B01': fan(aim, 5, .25, 0, 106); fan(aim, 7, .21, .95, 124); break;
    case 'B02':
      for (let beat = 0; beat < 2; beat++) {
        const side = beat ? 1 : -1;
        // Each wing sweeps out and back in its own side sector, never closing the centre.
        for (const [i, offset] of [.35, .55, .75, .75, .55, .35].entries())
          add(DOWN - side * offset, 116, beat * 3.35 + (i < 3 ? i * .48 : 1.85 + (i - 3) * .48), x + side * wing);
      }
      break;
    case 'B04': ring(12, .08, 0, 106); ring(12, .24, .9, 124); break;
    case 'B05':
      for (let layer = 0; layer < 3; layer++) for (const offset of [-.68, -.32, .32, .68]) add(DOWN + offset, 100 + layer * 15, layer * .6);
      break;
    case 'B06':
      for (let i = 0; i < 12; i++) add(.38 + i * .216, 114, i * .48);
      break;
    case 'B07':
      for (let beat = 0; beat < 3; beat++) for (const side of [-1, 1])
        fan(DOWN - side * (.42 + beat * .15), 2, .14, beat * .7, 114, x + side * wing);
      break;
    case 'B12': ring(16, .12, 0, 126, true); break;
  }
  const duration = regular ? .55 : elite ? .85 : .95;
  const last = Math.max(0, ...shots.map(shot => shot.delay));
  const recovery = regular ? 3.6 : elite ? 2.8 : 2.5;
  return {name:NAMES[id], resourceId:id, shots, hazards:[], targetX, targetY, duration, recovery,
    cooldown:duration + last + recovery, warning:false, color:0xff795e,
    ...(['E06', 'E08', 'B03', 'B04', 'B12'].includes(id) ? {escapeAngle:DOWN, escapeHalfAngle:BARRAGE_GAP_HALF_ANGLE} : {})};
}
