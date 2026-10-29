import { advancedChapter } from './advanced-chapters.js';
// Timed, grouped formation pacing. Rewards and combat values remain this game's own.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => { const u = clamp(t, 0, 1); return u * u * (3 - 2 * u); };
// Zero velocity AND acceleration at a parking endpoint; arrival timing stays
// unchanged, including the first legal shot and side-entry warning windows.
const settle = t => { const u = clamp(t, 0, 1); return u*u*u*(u*(u*6-15)+10); };

// One shuffled route deck per sortie. A wave never rerolls when capacity holds it.
function routeDeck(stageIndex,seed){
  const preferred=advancedChapter(stageIndex)?.formations||['v','crossing','line','sideDive','sine','pincer','hook','diagonal'];
  const deck=[...new Set([...preferred,'arcSweep','fanOut','holdDive','stagger'])];
  let state=(seed^Math.imul(stageIndex+1,2654435761))>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  for(let i=deck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]];}
  return deck;
}

// Fifteen waves: fixed elites gate waves 5 and 10; wave 15 is the boss.
export const BATTLE_WAVES = Object.freeze([
  { phase: '清群起步', window: 9, groups: [['column', 3, 0], ['crossing', 2, 3]] },
  { phase: '清群起步', window: 9.5, groups: [['crossing', 3, 0], ['diagonal', 3, 3]] },
  { phase: '清群起步', window: 10, groups: [['diagonal', 3, 0], ['sine', 3, 3.4]] },
  { phase: '扩面施压', window: 10, groups: [['merge', 4, 0], ['column', 3, 3.4]] },
  { phase: '扩面施压', window: 10.5, groups: [['sine', 4, 0], ['crossing', 3, 3.6]], shooters: 1, elite: true, keyTarget: true },
  { phase: '扩面施压', window: 10.5, groups: [['column', 4, 0], ['diagonal', 3, 3.6]] },
  { phase: '纵深压阵', window: 11, groups: [['crossing', 4, 0], ['merge', 4, 3.8]] },
  { phase: '纵深压阵', window: 11, groups: [['sine', 4, 0], ['column', 4, 3.8]], shooters: 1 },
  { phase: '纵深压阵', window: 11.5, groups: [['diagonal', 4, 0], ['crossing', 4, 4]] },
  { phase: '精英阻截', window: 12, groups: [['merge', 4, 0], ['sine', 4, 4]], elite: true, keyTarget: true },
  { phase: '纵深压阵', window: 11, groups: [['column', 4, 0], ['merge', 4, 3.8]] },
  { phase: '纵深压阵', window: 11.5, groups: [['crossing', 4, 0], ['diagonal', 4, 4]], shooters: 1 },
  { phase: '精英组合', window: 12, groups: [['sine', 5, 0], ['merge', 4, 4.2]] },
  { phase: '精英组合', window: 12, groups: [['diagonal', 5, 0], ['crossing', 4, 4.2]], shooters: 1 },
  { phase: '旗舰接战', window: 0, groups: [], boss: true },
].map(wave => Object.freeze({ ...wave, groups: Object.freeze(wave.groups.map(group => Object.freeze(group))) })));

export function battleWaveSpawns(index, { stageIndex = 0, waveSize = 1, duration = 141, seed = 1 } = {}) {
  const wave = BATTLE_WAVES[index];
  if (!wave || wave.boss) return [];
  const baseCount = wave.groups.reduce((sum, group) => sum + group[1], 0);
  const count = clamp(Math.round(baseCount * clamp(waveSize, .85, 1.25) * 1.6) + Math.min(4, stageIndex), 8, 22);
  const flightTime = clamp(duration / BATTLE_WAVES.length - 5, 7, 10);
  const flip = stageIndex % 2 ? -1 : 1;
  const lanes = stageIndex % 3 === 1 ? [.3, .65] : [.38, .62];
  const spawns = [];
  const roster = advancedChapter(stageIndex);
  const formations=routeDeck(stageIndex,seed);
  let serial = 0;
  for (let groupIndex = 0; groupIndex < wave.groups.length; groupIndex++) {
    const [, baseGroupCount, at] = wave.groups[groupIndex];
    const template=formations[(index*2+groupIndex)%formations.length];
    const groupCount = groupIndex === 0
      ? Math.max(1, Math.round(count * baseGroupCount / baseCount))
      : count - serial;
    for (let i = 0; i < groupCount; i++, serial++) {
      const batchSize=Math.min(4,Math.ceil(groupCount/2));
      const batch=Math.floor(i/batchSize),slot=i%batchSize;
      const slots=Math.min(batchSize,groupCount-batch*batchSize);
      const side=(groupIndex%2?-flip:flip)*(batch%2?-1:1);
      spawns.push({
        kind: roster?.lightKinds && index>=2 ? roster.lightKinds[(serial+index)%roster.lightKinds.length] : index < 2 ? (serial % 4 === 3 ? 'dart' : 'scout')
          : index >= 6 && serial % 7 === 6 ? 'heavy'
          : serial % 3 === 0 ? 'dart' : 'scout',
        role: 'light', delay: at + batch*1.65 + slot*.26,
        // One small cohort on selected waves; the rest retain independent fire.
        ...(index>=2&&groupIndex===0&&(index+stageIndex)%3===2&&i<3
          ? {barrageGroup:{id:`${stageIndex}:${index}:${groupIndex}`,slot:i}} : {}),
        route: { template, lane: lanes[serial % 2], side: (serial % 2 ? -1 : 1) * flip,
          slot,slots,entrySide:side,
          depth: serial % 2 ? .32 : .22, duration: flightTime },
      });
    }
  }
  const shooters = index < 2 ? 0 : index < 6 ? 1 : index < 11 ? 2 : 3;
  for (let i = 0; i < shooters; i++) {
    spawns.push({ kind: roster?.shooterKinds ? roster.shooterKinds[(index+i)%roster.shooterKinds.length] : index >= 4 && (index+i+stageIndex)%3===0 ? 'relay' : 'turret', role: 'shooter', delay: 1.8 + i * 1.7,
      route: { template: (index+i)%2?'sideAnchor':'anchor', entrySide:i%2?-flip:flip, lane: shooters === 1 ? (index % 2 ? .32 : .68) : shooters === 2 ? [.28, .72][i] : [.23,.5,.77][i],
        depth: .23 + (stageIndex % 2) * .04, resident: true, duration: flightTime } });
  }
  if (wave.elite) {
    spawns.push({ kind: 'heavy', role: 'elite', elite: true, keyTarget: true, delay: 5.2,
      route: { template: 'anchor', lane: .5, depth: .34, resident: true, duration: flightTime } });
  }
  return spawns.sort((a, b) => a.delay - b.delay);
}

// Entries stay above the player area; no teleporting or live-target homing.
// Non-residents cross a declared exit; anchored threats remain until defeated.
export function battleRoutePosition(route, age, width = 600, height = 1300) {
  const t = Math.max(0, age) * 8 / (route.duration || 8);
  const lane = route.lane ?? .5, side = route.side ?? 1;
  const slot=route.slot||0,slots=route.slots||1,offset=(slot-(slots-1)/2),entrySide=route.entrySide||side;
  // The tilted camera can show negative world Y. The runtime supplies the
  // unprojected screen edge, shared by spawning and every subsequent frame.
  const entryTop = route.entryTop ?? -75;
  let x = width * lane, y = mix(entryTop, height + 100, clamp(t / 8, 0, 1));
  let canFire = false, entryWarning = false;
  if (route.template === 'anchor') {
    y = mix(entryTop, height * (route.depth ?? .26), settle(t / 2.2));
    canFire = t >= 2.2;
  } else if(route.template==='sideAnchor'){
    x=mix(entrySide>0?-85:width+85,width*lane,settle((t-.65)/2.2));
    y=height*(route.depth??.26);
    entryWarning=t<1.3;canFire=t>=2.85;
  } else if(route.template==='arcSweep'){
    const u=clamp((t-.65)/7.35,0,1);
    x=mix(-85,width+85,u);if(entrySide<0)x=width-x;
    y=height*(.15+.21*Math.sin(u*Math.PI)) + offset*30;
    entryWarning=t<1.3;
  } else if(route.template==='fanOut'){
    const destination=width*.5+offset*width*.16;
    x=mix(width*.5,destination,smooth((t-.8)/1.8));
    if(t<2.8)y=mix(entryTop-10,height*.25,smooth(t/2.8));
    else if(t<4.2)y=height*.25;
    else {const u=smooth((t-4.2)/3.8);x=mix(destination,offset<0?-100:width+100,u);y=height*(.25+.13*Math.sin(u*Math.PI));}
  } else if(route.template==='holdDive'){
    x=width*clamp(lane+offset*.075,.16,.84);
    if(t<2.4)y=mix(entryTop-10,height*.21,smooth(t/2.4));
    else if(t<3.4)y=height*.21;
    else {const u=smooth((t-3.4)/4.6);y=mix(height*.21,height+100,u);x+=entrySide*Math.sin(u*Math.PI)*width*.13;}
  } else if(route.template==='stagger'){
    const start=width*(entrySide>0?.2:.8),destination=width*(entrySide>0?.7:.3);
    x=mix(start,destination,smooth((t-1.5)/3.4))+offset*22;
    y=mix(entryTop-10,height+100,clamp(t/8,0,1))-slot*25;
  } else if (route.template === 'v' || route.template === 'line') {
    x=width*.5+offset*Math.min(width*.12,width*.78/Math.max(1,slots-1));
    y+=route.template==='v'?-Math.abs(offset)*52:0;
  } else if (['sideDive','pincer','hook'].includes(route.template)) {
    const direction=route.template==='pincer'?side:entrySide;
    const entry=direction>0?-85:width+85;
    const destination=width*(direction>0?.36:.64);
    const depth=height*(.2+(slot%2)*.065);
    if(t<2.8){x=mix(entry,destination,smooth((t-.65)/2.15));y=depth;}
    else if(route.template==='hook'){
      const u=clamp((t-2.8)/5.2,0,1);
      x=destination+direction*Math.sin(u*Math.PI)*width*.23;
      y=mix(depth,-100,smooth(u))+Math.sin(u*Math.PI)*height*.15;
    }else{
      const u=clamp((t-2.8)/5.2,0,1);
      x=destination+direction*Math.sin(u*Math.PI)*width*.12;
      y=mix(depth,height+100,smooth(u));
    }
    entryWarning=t<1.3;
  } else if (route.template === 'crossing') {
    x = mix(-80, width + 80, clamp((t - .65) / 7.35, 0, 1));
    y = height * (route.depth ?? .24) + Math.sin(clamp(t / 8, 0, 1) * Math.PI) * height * .045;
    entryWarning = t < 1.1;
    if (entrySide < 0) x = width - x;
  } else if (route.template === 'diagonal') {
    x = mix(width * .15, width * .85, t / 8);
    if (side < 0) x = width - x;
  } else if (route.template === 'merge') {
    x = mix(width * (side > 0 ? .18 : .82), width * .5, smooth((t - 2.8) / 2.5));
  } else if (route.template === 'sine') {
    x += Math.sin(t * Math.PI / 2) * Math.sin(clamp(t / 8, 0, 1) * Math.PI) * width * .14;
  }
  if(!['anchor','sideAnchor'].includes(route.template)) canFire = t >= 1.1 && t <= 4.8 && x > 35 && x < width - 35 && y > 35 && y < height * .56;
  if(route.template==='holdDive'&&t>=3.4)canFire=false;
  return { x, y, canFire, entryWarning, escaped: !route.resident && t >= 8 };
}

export function createBattleWaveDirector(options = {}) {
  options={...options,seed:options.seed??Math.floor(Math.random()*4294967296)};
  const maxEnemies = 22 + Math.min(4, options.stageIndex || 0);
  const maxDanger = 48;
  let index = -1, completed = 0, state = 'gap', timer = .8, elapsed = 0, queue = [];
  return {
    get snapshot() { return { index, completed, total: BATTLE_WAVES.length, state, pending: queue.length,
      phase: state === 'warning' || state === 'boss' ? '旗舰接战' : BATTLE_WAVES[index]?.phase || '清群起步',
      maxEnemies, maxDanger }; },
    step(dt, { liveCount = 0, dangerCount = 0, keyTargetAlive = false, paused = false } = {}) {
      if (paused || state === 'boss') return [];
      const events = [];
      const delta = clamp(dt, 0, .05);
      if (state === 'active') {
        const wave = BATTLE_WAVES[index];
        elapsed += delta;
        // Capacity holds a pending group instead of dumping an overdue burst.
        if (queue.length && elapsed >= queue[0].delay && liveCount < maxEnemies && dangerCount < maxDanger) {
          events.push({ type: 'spawn', spec: queue.shift() });
          if (queue.length) queue[0].delay = Math.max(queue[0].delay, elapsed + .22);
        }
        // Ordinary waves follow the clock; waves 5 and 10 wait for their elite.
        if (!queue.length && !events.length && elapsed >= wave.window && (!wave.keyTarget || !keyTargetAlive)) {
          completed = index + 1;
          state = wave.boss ? 'warning' : 'gap';
          // A short recovery beat, slightly longer after elites or a phase
          // change. This only holds new spawns; existing threats stay live.
          const phaseChange = BATTLE_WAVES[index + 1]?.phase !== wave.phase;
          timer = wave.boss ? 3 : wave.rest ?? (wave.keyTarget ? 1.6 : phaseChange ? 1.25 : .95);
          events.push({ type: state === 'warning' ? 'warning' : 'clear', rest: timer });
        }
      } else {
        // Keep the boss entrance readable: clear the last ordinary wave first.
        if (state === 'gap' && index === BATTLE_WAVES.length - 2 && (liveCount || dangerCount)) return events;
        timer -= delta;
        if (timer <= 0) {
          if (state === 'warning') { state = 'boss'; events.push({ type: 'boss' }); }
          else {
            index++; elapsed = 0; state = 'active';
            queue = battleWaveSpawns(index, options);
            events.push({ type: 'wave', index, wave: BATTLE_WAVES[index] });
          }
        }
      }
      return events;
    },
  };
}

export function formationAttackPlan(enemy, player, stageIndex = 0) {
  if (enemy.dead || player.y < enemy.y + 100) return null;
  const profiles = {
    scout: { count:1, spread:0, cooldown:2.6, duration:.4, speed:150 },
    dart: { count:2, spread:.14, cooldown:2.1, duration:.5, speed:185 },
    turret: { count:3, spread:.7, cooldown:2.35, duration:.6, speed:160 },
    heavy: { count:5, spread:1.15, cooldown:3, duration:.75, speed:145 },
    relay: { count:1, spread:0, cooldown:1.9, duration:.8, speed:210 },
  };
  return { targetX: player.x, targetY: player.y, ...(profiles[enemy.kind] || profiles.scout),
    warning: enemy.kind==='relay' || enemy.kind==='heavy' };
}

export function formationHpScale(kind, elite, waveIndex=0) {
  const base = elite ? 1 : ({scout:2.4,dart:1.9,turret:1.9,relay:1.9,heavy:1.1}[kind] || 1.5);
  return base * (1 + clamp(waveIndex,0,13)*.035);
}
