import { isGameSessionCurrent } from './platform/game-session-runtime.js';
import { importedSprite } from './render/imported-art.js';
import { createFighterView } from './three/aircraft/fighter-view.js';
import { WING_PROFILES, ENGINE_PROFILES, TAIL_PROFILES, fixedPartProfile } from './three/aircraft/fixed-part-profiles.js';
import {
  Container,
  Graphics,
  Rectangle,
  Text,
  WebGLRenderer,
} from './three/display.js';
import { STARTER_ASSEMBLY_MODULE_IDS } from './progression.js';
import { getActivePilot } from './pilots.js';
import { GACHA_FIXED_ITEMS } from './gacha-config.js';

const STORAGE_KEY = 'thunder-assembly-v1';
const STORAGE_VERSION = 6;
const DESIGN_WIDTH = 560;
const DESIGN_HEIGHT = 842;
const INVENTORY_TOP = 438;
const INVENTORY_PAGE_SIZE = 6;
const INVENTORY_CARD_COLUMNS = 2;
const INVENTORY_CARD_WIDTH = 254;
const INVENTORY_CARD_HEIGHT = 60;
const INVENTORY_CARD_GAP_X = 16;
const INVENTORY_CARD_GAP_Y = 7;
const INVENTORY_CARD_TOP = 550;
const INVENTORY_PAGER_Y = DESIGN_HEIGHT - 32;
const INVENTORY_DETAIL_HEIGHT = DESIGN_HEIGHT - INVENTORY_CARD_TOP - 12;

const COLORS = {
  ink: 0x031219,
  panel: 0x071e27,
  panelLight: 0x0d2b35,
  cyan: 0x78f1e5,
  white: 0xeefbf7,
  dim: 0x53737a,
  amber: 0xffca62,
  green: 0x78eea0,
  red: 0xff655b,
};

const INTERFACE_NAMES = Object.freeze({
  AERO: '空动',
  ARMOR: '装甲',
  ARC: '电弧',
  F2: '双流',
  DRIVE: '驱动',
  C1: '单核',
  SALVAGE: '回收',
  VOID: '虚空',
  LINK: '联动',
  UNIVERSAL: '通用',
});

function interfaceName(value) {
  return INTERFACE_NAMES[value] || '特制';
}
export function getAssemblyWingProfile() {
  const moduleId = assemblyState?.mounts?.wing || 'wing-swept';
  const profile = WING_PROFILES[moduleId] || WING_PROFILES['wing-swept'];
  return {
    id: moduleId,
    key: profile.key,
    points: profile.points.map(([x, y]) => [x, y]),
    color: MODULE_MAP?.get(moduleId)?.color || COLORS.cyan,
  };
}

export function getAssemblyEngineProfile() {
  const moduleId = assemblyState?.mounts?.engine || 'engine-ion';
  const profile = ENGINE_PROFILES[moduleId] || ENGINE_PROFILES['engine-ion'];
  return {
    id: moduleId,
    ...profile,
    nozzles: [...profile.nozzles],
    color: MODULE_MAP?.get(moduleId)?.color || 0x5ec8ff,
  };
}

export function getAssemblyTailProfile() {
  const moduleId = assemblyState?.mounts?.tail || 'tail-vector';
  const profile = TAIL_PROFILES[moduleId] || TAIL_PROFILES['tail-vector'];
  return {
    id: moduleId,
    key: profile.key,
    points: profile.points.map(([x, y]) => [x, y]),
    color: MODULE_MAP?.get(moduleId)?.color || 0x8dffca,
  };
}

function currentAircraftVisualConfig() {
  const wingModule = MODULE_MAP.get(assemblyState.mounts.wing);
  const engineModule = MODULE_MAP.get(assemblyState.mounts.engine);
  const tailModule = MODULE_MAP.get(assemblyState.mounts.tail);
  const pilot = getActivePilot();
  return {
    pilot,
    wingModule,
    engineModule,
    tailModule,
    wing: WING_PROFILES[wingModule?.id] || WING_PROFILES['wing-swept'],
    engine: ENGINE_PROFILES[engineModule?.id] || ENGINE_PROFILES['engine-ion'],
    tail: TAIL_PROFILES[tailModule?.id] || TAIL_PROFILES['tail-vector'],
  };
}

/**
 * Creates the canonical aircraft renderer used by both the hangar preview and
 * live combat. Consumers may scale the root, but never redraw parts separately.
 */
export function createAssemblyAircraftVisual() {
  // Scale altitude with the airframe so rolling wings retain their true span.
  const root = new Container({ scaleDepth: true });
  const engine = new Container();
  const wing = new Graphics();
  const tail = new Graphics();
  const shadow = new Graphics();
  const fixedOrbitBack = new Container();
  const underlay = new Graphics();
  const body = new Graphics();
  const armor = new Graphics();
  const cockpit = new Graphics();
  const energy = new Graphics();
  const markings = new Graphics();
  const fixedOrbitFront = new Container();
  root.addChild(
    engine,
    shadow,
    fixedOrbitBack,
    wing,
    tail,
    underlay,
    body,
    armor,
    cockpit,
    energy,
    markings,
    fixedOrbitFront,
  );
  const visual = {
    root,
    engine,
    wing,
    tail,
    shadow,
    fixedOrbitBack,
    underlay,
    body,
    armor,
    cockpit,
    energy,
    markings,
    fixedOrbitFront,
    fixedOrbitTracks: [],
  };
  visual.model = createFighterView({ pilotId: currentAircraftVisualConfig().pilot.id });
  redrawAssemblyAircraftVisual(visual);
  root.addChild(visual.model);
  if (visual.retroSprite) visual.retroSprite.visible = false;
  for (const node of [engine, shadow, wing, tail, underlay, body, armor, cockpit, energy, markings]) node.visible = false;
  return visual;
}

function hexColor(value, fallback = 0xffffff) {
  if (typeof value === 'number') return value;
  const parsed = Number.parseInt(String(value || '').replace('#', ''), 16);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mixColor(a, b, amount = 0.5) {
  const t = Math.max(0, Math.min(1, amount));
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  return (
    (Math.round(ar + (br - ar) * t) << 16)
    | (Math.round(ag + (bg - ag) * t) << 8)
    | Math.round(ab + (bb - ab) * t)
  );
}

function scalePolygon(points, scaleX, scaleY = scaleX, offsetY = 0) {
  let cx = 0;
  let cy = 0;
  const count = Math.max(1, points.length / 2);
  for (let index = 0; index < points.length; index += 2) {
    cx += points[index];
    cy += points[index + 1];
  }
  cx /= count;
  cy /= count;
  return points.map((value, index) => (
    index % 2 === 0
      ? cx + (value - cx) * scaleX
      : cy + (value - cy) * scaleY + offsetY
  ));
}

function drawPanelSeams(graphics, points, color, alpha = 0.42) {
  const count = points.length / 2;
  if (count < 4) return;
  let cx = 0;
  let cy = 0;
  for (let index = 0; index < points.length; index += 2) {
    cx += points[index];
    cy += points[index + 1];
  }
  cx /= count;
  cy /= count;
  for (let index = 1; index < count; index += 2) {
    const x = points[index * 2];
    const y = points[index * 2 + 1];
    const endX = cx + (x - cx) * 0.3;
    const endY = cy + (y - cy) * 0.3;
    graphics.moveTo(x, y).lineTo(endX, endY);
  }
  graphics.stroke({ color, width: 1.15, alpha });
}

function drawDiamond(graphics, x, y, radius, color, alpha = 1) {
  graphics
    .poly([x, y - radius, x + radius * 0.72, y, x, y + radius, x - radius * 0.72, y])
    .fill({ color, alpha });
}

function mirrorPolygon(points) {
  return points.map((value, index) => (index % 2 === 0 ? -value : value));
}

function drawAirframeSignature(graphics, marking, primary, accent, deep) {
  const paired = (points, fill = deep, stroke = accent) => {
    graphics
      .poly(points).fill({ color: fill, alpha: 0.98 })
      .poly(mirrorPolygon(points)).fill({ color: fill, alpha: 0.98 })
      .poly(points).stroke({ color: stroke, width: 2.4, alpha: 0.88 })
      .poly(mirrorPolygon(points)).stroke({ color: stroke, width: 2.4, alpha: 0.88 });
  };

  if (marking === 'phase') {
    paired([-18, -43, -63, -19, -91, 68, -82, 137, -58, 91, -49, 27], mixColor(deep, primary, 0.24));
    paired([-50, 17, -67, 48, -71, 108, -59, 78], primary, accent);
  } else if (marking === 'repair') {
    graphics
      .circle(0, 19, 61).stroke({ color: mixColor(accent, 0xffffff, 0.6), width: 9, alpha: 0.88 })
      .circle(0, 19, 51).stroke({ color: primary, width: 5, alpha: 0.82 })
      .circle(0, 19, 43).stroke({ color: accent, width: 1.5, alpha: 0.45 });
    paired([-20, -19, -70, -5, -91, 43, -60, 25, -30, 35], mixColor(accent, primary, 0.28), primary);
    paired([-25, 45, -71, 62, -90, 125, -50, 92, -29, 78], mixColor(accent, 0xffffff, 0.45), primary);
  } else if (marking === 'rose') {
    paired([-18, -42, -76, -7, -101, 31, -65, 22, -43, 75, -22, 46], mixColor(deep, primary, 0.3));
    paired([-37, 48, -81, 74, -72, 129, -45, 94], primary, accent);
  } else if (marking === 'split') {
    paired([-16, -50, -57, -31, -92, 28, -88, 112, -67, 78, -54, 9], mixColor(deep, primary, 0.28));
    paired([-53, 1, -73, 29, -76, 79, -63, 54], primary, accent);
  } else if (marking === 'comet') {
    paired([-37, -32, -65, -13, -82, 14, -76, 91, -55, 113, -45, 52], mixColor(accent, 0xffffff, 0.44), primary);
    graphics
      .moveTo(-52, 13).lineTo(-22, 13)
      .moveTo(52, 13).lineTo(22, 13)
      .stroke({ color: accent, width: 5, alpha: 0.72 });
  } else if (marking === 'scope') {
    paired([14, -91, 28, -76, 47, 103, 31, 125, 20, 17], mixColor(deep, primary, 0.34), primary);
    graphics
      .roundRect(25, -67, 7, 151, 3).fill({ color: primary, alpha: 0.65 })
      .roundRect(-32, -67, 7, 151, 3).fill({ color: primary, alpha: 0.65 });
  } else if (marking === 'twin') {
    graphics
      .poly([-39, -8, 39, -8, 45, 25, -45, 25]).fill({ color: mixColor(primary, accent, 0.4), alpha: 0.86 })
      .poly([-39, -8, 39, -8, 45, 25, -45, 25]).stroke({ color: accent, width: 2, alpha: 0.8 });
  } else if (marking === 'trinity') {
    paired([-27, -102, -49, -124, -66, -73, -72, 104, -48, 137, -36, 75], mixColor(accent, primary, 0.2), primary);
  } else if (marking === 'quad') {
    paired([-42, -36, -91, -20, -105, 27, -96, 112, -68, 129, -57, 45], mixColor(deep, primary, 0.28));
  } else if (marking === 'aegis') {
    graphics
      .circle(0, 18, 70).stroke({ color: mixColor(accent, 0xffffff, 0.65), width: 10, alpha: 0.86 })
      .circle(0, 18, 59).stroke({ color: primary, width: 4, alpha: 0.74 });
    paired([-33, -28, -79, 4, -98, 69, -71, 113, -49, 63], mixColor(accent, 0xffffff, 0.5), primary);
  }
}

function orbitPath(graphics, track, front) {
  const start = front ? 0 : Math.PI;
  const end = front ? Math.PI : Math.PI * 2;
  const steps = 28;
  for (let index = 0; index <= steps; index += 1) {
    const angle = start + (end - start) * (index / steps);
    const x = Math.cos(angle) * track.radiusX;
    const y = track.centerY + Math.sin(angle) * track.radiusY;
    if (index === 0) graphics.moveTo(x, y);
    else graphics.lineTo(x, y);
  }
  graphics.stroke({
    color: track.color,
    width: front ? 2.6 : 1.5,
    alpha: front ? 0.62 : 0.22,
  });
}

function createOrbitNode(kind, color, accent) {
  const node = new Container();
  const glow = new Graphics()
    .circle(0, 0, 17).fill({ color, alpha: 0.08 })
    .circle(0, 0, 12).fill({ color, alpha: 0.13 });
  const shape = new Graphics();
  if (kind === 'wing') {
    shape
      .poly([0, -15, 8, -2, 4, 13, 0, 8, -4, 13, -8, -2])
      .fill({ color, alpha: 0.86 })
      .poly([0, -15, 8, -2, 4, 13, 0, 8, -4, 13, -8, -2])
      .stroke({ color: accent, width: 1.7, alpha: 0.92 });
  } else if (kind === 'engine') {
    shape
      .circle(0, 0, 10).fill({ color: 0x07111d, alpha: 0.94 })
      .circle(0, 0, 8.5).stroke({ color, width: 3, alpha: 0.94 })
      .circle(0, 0, 3.5).fill({ color: accent, alpha: 0.98 });
  } else {
    shape
      .poly([0, -14, 12, 10, 0, 5, -12, 10])
      .fill({ color, alpha: 0.8 })
      .poly([0, -14, 12, 10, 0, 5, -12, 10])
      .stroke({ color: accent, width: 1.7, alpha: 0.92 });
  }
  node.addChild(glow, shape);
  return node;
}

function rebuildFixedOrbit(visual, config, accent) {
  const orbitKey = JSON.stringify([accent, ...[config.wingModule, config.engineModule, config.tailModule]
    .map(module => module ? [module.id, module.color] : null)]);
  if (visual.fixedOrbitKey === orbitKey) return;
  visual.fixedOrbitKey = orbitKey;
  visual.fixedOrbitBack.removeChildren().forEach((child) => child.destroy({ children: true }));
  visual.fixedOrbitFront.removeChildren().forEach((child) => child.destroy({ children: true }));
  visual.fixedOrbitTracks = [];
  const modules = [
    {
      kind: 'wing',
      module: config.wingModule,
      radiusX: 104,
      radiusY: 35,
      centerY: -8,
      speed: 0.82,
      count: 2,
      phase: 0.15,
    },
    {
      kind: 'engine',
      module: config.engineModule,
      radiusX: 78,
      radiusY: 29,
      centerY: 38,
      speed: -1.08,
      count: 3,
      phase: 1.1,
    },
    {
      kind: 'tail',
      module: config.tailModule,
      radiusX: 57,
      radiusY: 22,
      centerY: 82,
      speed: 1.34,
      count: 2,
      phase: 2.2,
    },
  ];

  modules.forEach((definition) => {
    if (!definition.module) return;
    const color = definition.module.color || 0x78f1e5;
    const track = { ...definition, color, nodes: [] };
    const backPath = new Graphics();
    const frontPath = new Graphics();
    orbitPath(backPath, track, false);
    orbitPath(frontPath, track, true);
    visual.fixedOrbitBack.addChild(backPath);
    visual.fixedOrbitFront.addChild(frontPath);
    for (let index = 0; index < track.count; index += 1) {
      const back = createOrbitNode(track.kind, color, accent);
      const front = createOrbitNode(track.kind, color, accent);
      visual.fixedOrbitBack.addChild(back);
      visual.fixedOrbitFront.addChild(front);
      track.nodes.push({ back, front });
    }
    visual.fixedOrbitTracks.push(track);
  });
}

export function updateAssemblyAircraftVisual(visual, time = 0) {
  visual?.model?.updateAircraft(time);
  if (!visual?.fixedOrbitTracks) return visual;
  const commitTransform = (view) => {
    // The Three display renderer reads the current transform before drawing.
  };
  visual.fixedOrbitTracks.forEach((track, trackIndex) => {
    track.nodes.forEach(({ back, front }, index) => {
      const angle = track.phase
        + time * track.speed
        + index * (Math.PI * 2 / track.count)
        + trackIndex * 0.22;
      const depth = Math.sin(angle);
      const x = Math.cos(angle) * track.radiusX;
      const y = track.centerY + depth * track.radiusY;
      const scale = 0.72 + (depth + 1) * 0.16;
      const alpha = 0.52 + (depth + 1) * 0.22;
      back.visible = depth < 0;
      front.visible = depth >= 0;
      const active = depth >= 0 ? front : back;
      active.position.set(x, y);
      active.scale.set(scale);
      active.alpha = alpha;
      active.rotation = angle + Math.PI / 2;
      commitTransform(back);
      commitTransform(front);
    });
  });
  return visual;
}

function drawPilotMarking(graphics, airframe, primary, accent) {
  const marking = airframe.marking;
  const core = airframe.cores?.[0] || [0, 8, 5];
  const [x, y] = core;

  if (marking === 'phase') {
    graphics
      .arc(-50, 29, 42, -1.28, 1.1).stroke({ color: accent, width: 5, alpha: 0.88 })
      .arc(50, 29, 42, 2.04, 4.42).stroke({ color: accent, width: 5, alpha: 0.88 })
      .arc(-50, 29, 34, -1.15, 0.95).stroke({ color: primary, width: 2, alpha: 0.9 })
      .arc(50, 29, 34, 2.18, 4.3).stroke({ color: primary, width: 2, alpha: 0.9 });
  } else if (marking === 'repair') {
    graphics
      .circle(0, 11, 34).stroke({ color: primary, width: 3, alpha: 0.75 })
      .circle(0, 11, 25).stroke({ color: accent, width: 1.5, alpha: 0.52 })
      .roundRect(-3, -3, 6, 28, 2).fill({ color: accent, alpha: 0.9 })
      .roundRect(-14, 8, 28, 6, 2).fill({ color: accent, alpha: 0.9 });
  } else if (marking === 'rose') {
    for (let index = 0; index < 5; index += 1) {
      const angle = -Math.PI / 2 + index * (Math.PI * 2 / 5);
      const px = Math.cos(angle) * 19;
      const py = 13 + Math.sin(angle) * 19;
      graphics
        .ellipse(px, py, 8, 17)
        .fill({ color: index % 2 ? primary : accent, alpha: 0.48 });
    }
  } else if (marking === 'scope') {
    graphics
      .circle(x, y, 22).stroke({ color: primary, width: 2.5, alpha: 0.9 })
      .circle(x, y, 12).stroke({ color: accent, width: 1.5, alpha: 0.72 })
      .moveTo(x - 31, y).lineTo(x - 13, y)
      .moveTo(x + 13, y).lineTo(x + 31, y)
      .moveTo(x, y - 31).lineTo(x, y - 13)
      .moveTo(x, y + 13).lineTo(x, y + 31)
      .stroke({ color: accent, width: 1.5, alpha: 0.8 });
  } else if (marking === 'aegis') {
    const halo = airframe.halo || { x: 0, y: 16, radius: 54 };
    graphics
      .circle(halo.x, halo.y, halo.radius).stroke({ color: primary, width: 4, alpha: 0.52 })
      .circle(halo.x, halo.y, halo.radius - 8).stroke({ color: accent, width: 1.5, alpha: 0.42 });
    for (let index = 0; index < 6; index += 1) {
      const angle = index * Math.PI / 3;
      const px = halo.x + Math.cos(angle) * halo.radius;
      const py = halo.y + Math.sin(angle) * halo.radius;
      drawDiamond(graphics, px, py, 4, accent, 0.9);
    }
  } else {
    const count = marking === 'quad' ? 4 : marking === 'trinity' ? 3 : marking === 'twin' || marking === 'split' ? 2 : 1;
    for (let index = 0; index < count; index += 1) {
      const lane = index - (count - 1) / 2;
      graphics
        .moveTo(lane * 14, 47)
        .lineTo(lane * 11, 72)
        .stroke({ color: index % 2 ? primary : accent, width: 2.2, alpha: 0.72 });
    }
    if (marking === 'comet') {
      graphics
        .poly([-17, 31, 0, 47, 17, 31, 12, 49, 0, 62, -12, 49])
        .stroke({ color: accent, width: 2.4, alpha: 0.88 });
    }
  }
}

export function redrawAssemblyAircraftVisual(visual) {
  if (!visual?.root) return visual;
  if (visual.model) {
    const config = currentAircraftVisualConfig();
    rebuildFixedOrbit(visual, config, hexColor(config.pilot.accent, 0xeefbff));
    visual.model.setPilot(config.pilot.id);
    visual.model.setEquipment(getAssemblyAppearance());
    visual.fixedOrbitBack.visible = visual.model.fighterId !== 'kestrel';
    visual.fixedOrbitFront.visible = visual.model.fighterId !== 'kestrel';
    return visual;
  }
  const config = currentAircraftVisualConfig();
  const airframe = config.pilot.airframe;
  const primary = hexColor(config.pilot.color, 0x9a7cff);
  const accent = hexColor(config.pilot.accent, 0xeefbff);
  const deep = mixColor(primary, 0x020611, 0.77);
  const mid = mixColor(primary, 0x10182b, 0.54);
  const light = mixColor(primary, accent, 0.42);
  // 固定件不再改写角色战机轮廓；机翼、推进器与尾翼改为三层环绕轨道。
  visual.wing.clear();
  visual.tail.clear();
  rebuildFixedOrbit(visual, config, accent);
  updateAssemblyAircraftVisual(visual, 0);

  visual.shadow.clear();
  visual.underlay.clear();
  visual.body.clear();
  visual.armor.clear();
  drawAirframeSignature(visual.underlay, airframe.marking, primary, accent, deep);
  const brightShell = ['repair', 'comet', 'twin', 'trinity', 'aegis'].includes(airframe.marking);
  airframe.parts.forEach((part, partIndex) => {
    const polygon = [...part];
    const inner = scalePolygon(polygon, partIndex === 0 ? 0.82 : 0.79, 0.86, -1);
    const facet = scalePolygon(polygon, partIndex === 0 ? 0.62 : 0.6, 0.7, -4);
    visual.shadow
      .poly(polygon.map((value, index) => (index % 2 ? value + 7 : value)))
      .fill({ color: 0x000000, alpha: 0.48 });
    visual.underlay
      .poly(polygon).fill({ color: deep, alpha: 1 })
      .poly(polygon).stroke({ color: 0x02040a, width: 6, alpha: 0.9 });
    visual.body
      .poly(scalePolygon(polygon, 0.96, 0.97))
      .fill({
        color: brightShell
          ? mixColor(accent, 0xffffff, partIndex === 0 ? 0.6 : 0.42)
          : partIndex === 0 ? mid : mixColor(mid, primary, 0.16),
        alpha: 1,
      })
      .poly(polygon).stroke({ color: accent, width: 2.6, alpha: 0.88 });
    visual.armor
      .poly(inner).fill({
        color: brightShell
          ? mixColor(0xffffff, primary, partIndex % 2 ? 0.12 : 0.22)
          : partIndex % 2 ? mixColor(light, 0xffffff, 0.28) : mixColor(primary, 0xffffff, 0.2),
        alpha: brightShell ? 0.82 : 0.78,
      })
      .poly(inner).stroke({ color: deep, width: 2.1, alpha: 0.94 })
      .poly(facet).fill({ color: partIndex % 2 ? primary : accent, alpha: 0.16 });
    drawPanelSeams(visual.armor, inner, accent, 0.42);
  });

  const spine = [-8, -139, -22, -88, -15, 63, 0, 122, 15, 63, 22, -88, 8, -139];
  visual.armor
    .poly(spine).fill({ color: mixColor(deep, primary, 0.25), alpha: 0.86 })
    .poly(spine).stroke({ color: light, width: 1.7, alpha: 0.7 })
    .moveTo(0, -134).lineTo(0, 112).stroke({ color: accent, width: 1, alpha: 0.28 });

  visual.cockpit.clear();
  const cockpitPolygons = [airframe.cockpit, airframe.cockpitAlt].filter(Boolean);
  cockpitPolygons.forEach((cockpit, index) => {
    visual.cockpit
      .poly(cockpit).fill({ color: 0x08091b, alpha: 0.98 })
      .poly(cockpit).stroke({ color: accent, width: 2.2, alpha: 0.9 })
      .poly(scalePolygon(cockpit, 0.62, 0.75, -1)).fill({ color: index ? primary : light, alpha: 0.72 });
  });

  visual.energy.clear();
  (airframe.cores || []).forEach(([x, y, radius], index) => {
    visual.energy
      .circle(x, y, radius * 3.1).fill({ color: primary, alpha: 0.09 })
      .circle(x, y, radius * 1.65).fill({ color: primary, alpha: 0.26 });
    drawDiamond(visual.energy, x, y, radius * 1.45, index % 2 ? primary : accent, 0.95);
    drawDiamond(visual.energy, x, y - radius * 0.2, radius * 0.65, 0xffffff, 0.75);
  });
  visual.markings.clear();
  drawPilotMarking(visual.markings, airframe, primary, accent);

  // 推进器固定件仍决定机身流线和战斗属性，但不再在机身上画喷口/尾焰；
  // 战斗层会按推进器与角色配置绘制动态拖尾。
  visual.engine.removeChildren().forEach((child) => child.destroy());
  visual.retroSprite?.destroy();
  visual.retroSprite = importedSprite(`airframe-${config.pilot.id}`, 280, 300);
  const shells = [visual.shadow, visual.underlay, visual.body, visual.armor, visual.cockpit, visual.energy, visual.markings];
  shells.forEach(part => { part.visible = !visual.retroSprite; });
  if (visual.retroSprite) visual.root.addChildAt(visual.retroSprite, visual.root.getChildIndex(visual.fixedOrbitFront));
  return visual;
}
const WEAPON_MAX_LEVEL = 10;

/**
 * Multiplier stats are factors (1 means no change); every other stat is
 * additive. Ids represent owned module instances and are therefore unique.
 */
function fixedModule(config) {
  return {
    family: 'fixed',
    role: 'fixed',
    style: config.fixedSlot,
    aliases: [config.fixedSlot],
    ...config,
  };
}

function weaponModule(config) {
  const { active, ...rest } = config;
  return {
    family: 'hardpoint',
    role: 'weapon',
    ...rest,
    passive: active ? {
      name: `自动 · ${active.name}`,
      description: `无需操作，每 ${active.cooldown} 秒自动触发。${active.description}`,
    } : rest.passive,
    passiveEffect: active ? {
      ...active,
      interval: active.cooldown,
    } : rest.passiveEffect,
    maxLevel: WEAPON_MAX_LEVEL,
    active: null,
    support: null,
  };
}

const LEGACY_FIXED_MODULES = [
  // Wings (10)
  fixedModule({
    id: 'wing-swept', name: '掠光机翼', shortName: '掠光', icon: 'W', fixedSlot: 'wing',
    rarity: 'common', interface: 'AERO', colorGroup: 'cyan', color: 0x78f1e5, power: 130,
    passive: { name: '掠光切线', description: '转向更快，俯冲时保持火力稳定。' },
    stats: { damageMultiplier: 1.02, moveSpeedMultiplier: 1.04, maxHp: 4 },
  }),
  fixedModule({
    id: 'wing-razor', name: '剃刀机翼', shortName: '剃刀', icon: 'X', fixedSlot: 'wing',
    rarity: 'common', interface: 'AERO', colorGroup: 'red', color: 0xff806e, power: 150,
    passive: { name: '锐角攻势', description: '牺牲少量稳定性换取持续伤害。' },
    stats: { damageMultiplier: 1.07, damageTakenMultiplier: 1.03 },
  }),
  fixedModule({
    id: 'wing-aegis', name: '堡垒机翼', shortName: '堡垒', icon: '◇', fixedSlot: 'wing',
    rarity: 'rare', interface: 'ARMOR', colorGroup: 'green', color: 0x7ee5aa, power: 190,
    passive: { name: '复合承力梁', description: '展开装甲翼面，降低所有来袭伤害。' },
    stats: { damageTakenMultiplier: 0.92, maxHp: 16, moveSpeedMultiplier: 0.97 },
  }),
  fixedModule({
    id: 'wing-falcon', name: '猎隼机翼', shortName: '猎隼', icon: 'F', fixedSlot: 'wing',
    rarity: 'rare', interface: 'AERO', colorGroup: 'amber', color: 0xffcf69, power: 198,
    passive: { name: '高速挂架', description: '强化弹道初速与横向追击能力。' },
    stats: { projectileSpeedMultiplier: 1.13, moveSpeedMultiplier: 1.055 },
  }),
  fixedModule({
    id: 'wing-prism', name: '棱镜机翼', shortName: '棱镜', icon: '◇', fixedSlot: 'wing',
    rarity: 'epic', interface: 'ARC', colorGroup: 'violet', color: 0xb58aff, power: 236,
    passive: { name: '折射航迹', description: '校准弱点成像，提高暴击与回收效率。' },
    stats: { critChance: 0.022, xpMultiplier: 1.055 },
  }),
  fixedModule({
    id: 'wing-borealis', name: '极光机翼', shortName: '极光', icon: '✦', fixedSlot: 'wing',
    rarity: 'epic', interface: 'F2', colorGroup: 'cyan', color: 0x55e8ee, power: 244,
    passive: { name: '极光扰流', description: '偏折敌方弹道，使弹幕整体减速。' },
    stats: { enemyBulletSpeedMultiplier: 0.88, maxHp: 10 },
  }),
  fixedModule({
    id: 'wing-tempest', name: '风暴机翼', shortName: '风暴', icon: 'ϟ', fixedSlot: 'wing',
    rarity: 'epic', interface: 'DRIVE', colorGroup: 'blue', color: 0x65b9ff, power: 252,
    passive: { name: '风洞供弹', description: '气动导槽同时提升射速与机动。' },
    stats: { fireRateMultiplier: 1.085, moveSpeedMultiplier: 1.04 },
  }),
  fixedModule({
    id: 'wing-vanguard', name: '先锋机翼', shortName: '先锋', icon: 'V', fixedSlot: 'wing',
    rarity: 'legendary', interface: 'C1', colorGroup: 'red', color: 0xff6e66, power: 292,
    passive: { name: '斩首航线', description: '对旗舰与精英目标输出显著增强。' },
    stats: { bossDamageMultiplier: 1.12, damageMultiplier: 1.045 },
  }),
  fixedModule({
    id: 'wing-reclaimer', name: '回收者机翼', shortName: '回收', icon: '↻', fixedSlot: 'wing',
    rarity: 'rare', interface: 'SALVAGE', colorGroup: 'green', color: 0x8de9a4, power: 202,
    passive: { name: '战地回收', description: '放大修复物资与经验回收收益。' },
    stats: { healingMultiplier: 1.16, xpMultiplier: 1.08 },
  }),
  fixedModule({
    id: 'wing-eclipse', name: '蚀影机翼', shortName: '蚀影', icon: '◐', fixedSlot: 'wing',
    rarity: 'legendary', interface: 'VOID', colorGroup: 'violet', color: 0xd38cff, power: 305,
    passive: { name: '暗面蓄能', description: '缩短挂载武器触发间隔并提高自动火力。' },
    stats: { activeCooldownMultiplier: 0.9, activeDamageMultiplier: 1.1 },
  }),

  // Engines (10)
  fixedModule({
    id: 'engine-ion', name: '离子推进器', shortName: '离子', icon: 'E', fixedSlot: 'engine',
    rarity: 'common', interface: 'DRIVE', colorGroup: 'blue', color: 0x5ec8ff, power: 140,
    passive: { name: '离子喷流', description: '稳定提高移动与武器循环速度。' },
    stats: { fireRateMultiplier: 1.02, moveSpeedMultiplier: 1.05 },
  }),
  fixedModule({
    id: 'engine-afterburn', name: '赤焰加力器', shortName: '加力', icon: 'ϟ', fixedSlot: 'engine',
    rarity: 'common', interface: 'DRIVE', colorGroup: 'red', color: 0xff8266, power: 168,
    passive: { name: '极限加力', description: '大幅提速，但装甲承压略有增加。' },
    stats: { moveSpeedMultiplier: 1.15, damageTakenMultiplier: 1.035 },
  }),
  fixedModule({
    id: 'engine-pulse', name: '脉冲推进器', shortName: '脉冲', icon: 'P', fixedSlot: 'engine',
    rarity: 'rare', interface: 'C1', colorGroup: 'cyan', color: 0x62e6ed, power: 214,
    passive: { name: '脉冲供能', description: '同步提升射速与弹丸初速。' },
    stats: { fireRateMultiplier: 1.085, projectileSpeedMultiplier: 1.08 },
  }),
  fixedModule({
    id: 'engine-quiet', name: '静默推进器', shortName: '静默', icon: '∿', fixedSlot: 'engine',
    rarity: 'epic', interface: 'VOID', colorGroup: 'violet', color: 0xa993ff, power: 238,
    passive: { name: '相位静默', description: '扰乱敌方制导并改善弱点锁定。' },
    stats: { enemyBulletSpeedMultiplier: 0.9, critChance: 0.018 },
  }),
  fixedModule({
    id: 'engine-repair', name: '自愈推进器', shortName: '自愈', icon: '+', fixedSlot: 'engine',
    rarity: 'rare', interface: 'ARMOR', colorGroup: 'green', color: 0x77eda5, power: 218,
    passive: { name: '纳米尾流', description: '推进尾流携带修复纳米群。' },
    stats: { healingMultiplier: 1.2, maxHp: 12 },
  }),
  fixedModule({
    id: 'engine-overclock', name: '超频推进器', shortName: '超频', icon: 'Ω', fixedSlot: 'engine',
    rarity: 'epic', interface: 'ARC', colorGroup: 'amber', color: 0xffcf64, power: 258,
    passive: { name: '超频回路', description: '挂载武器触发更快，机体负载略高。' },
    stats: { activeCooldownMultiplier: 0.86, damageTakenMultiplier: 1.025 },
  }),
  fixedModule({
    id: 'engine-harvest', name: '星尘推进器', shortName: '星尘', icon: '✦', fixedSlot: 'engine',
    rarity: 'epic', interface: 'SALVAGE', colorGroup: 'cyan', color: 0x8ceff3, power: 246,
    passive: { name: '星尘回收', description: '将推进尾迹转化为额外经验。' },
    stats: { xpMultiplier: 1.16, moveSpeedMultiplier: 1.035 },
  }),
  fixedModule({
    id: 'engine-siege', name: '攻城推进器', shortName: '攻城', icon: '▣', fixedSlot: 'engine',
    rarity: 'epic', interface: 'C1', colorGroup: 'red', color: 0xff7468, power: 272,
    passive: { name: '重载推力', description: '强化对旗舰输出，降低少量机动。' },
    stats: { bossDamageMultiplier: 1.16, moveSpeedMultiplier: 0.97 },
  }),
  fixedModule({
    id: 'engine-command', name: '编队推进器', shortName: '编队', icon: '∴', fixedSlot: 'engine',
    rarity: 'rare', interface: 'LINK', colorGroup: 'green', color: 0x83ef9d, power: 228,
    passive: { name: '并行火控', description: '提高挂载武器的自动触发频率与伤害。' },
    stats: { activeCooldownMultiplier: 0.9, activeDamageMultiplier: 1.055 },
  }),
  fixedModule({
    id: 'engine-singularity', name: '奇点推进器', shortName: '奇点', icon: '●', fixedSlot: 'engine',
    rarity: 'legendary', interface: 'VOID', colorGroup: 'violet', color: 0xc37fff, power: 318,
    passive: { name: '奇点反应炉', description: '同步放大常规与挂载武器伤害。' },
    stats: { damageMultiplier: 1.065, activeDamageMultiplier: 1.14 },
  }),

  // Tails (10)
  fixedModule({
    id: 'tail-vector', name: '矢量机尾', shortName: '矢量', icon: 'T', fixedSlot: 'tail',
    rarity: 'common', interface: 'AERO', colorGroup: 'cyan', color: 0x8dffca, power: 120,
    passive: { name: '矢量校准', description: '提升耐久、暴击与战场学习效率。' },
    stats: { critChance: 0.005, maxHp: 6, xpMultiplier: 1.02 },
  }),
  fixedModule({
    id: 'tail-stabilizer', name: '长弓稳定尾', shortName: '稳定', icon: '≈', fixedSlot: 'tail',
    rarity: 'common', interface: 'AERO', colorGroup: 'white', color: 0xd8eeee, power: 148,
    passive: { name: '弹道稳定', description: '提高弹速与弱点命中精度。' },
    stats: { projectileSpeedMultiplier: 1.1, critChance: 0.012 },
  }),
  fixedModule({
    id: 'tail-aegis', name: '守望装甲尾', shortName: '守望', icon: '◇', fixedSlot: 'tail',
    rarity: 'rare', interface: 'ARMOR', colorGroup: 'green', color: 0x7fe7a0, power: 196,
    passive: { name: '尾部偏导盾', description: '强化后向防御与机体结构。' },
    stats: { damageTakenMultiplier: 0.9, maxHp: 14 },
  }),
  fixedModule({
    id: 'tail-hunter', name: '猎手制导尾', shortName: '猎手', icon: 'Q', fixedSlot: 'tail',
    rarity: 'epic', interface: 'C1', colorGroup: 'red', color: 0xff7467, power: 248,
    passive: { name: '旗舰测绘', description: '持续标绘旗舰弱点，提高斩首效率。' },
    stats: { bossDamageMultiplier: 1.13, damageMultiplier: 1.03 },
  }),
  fixedModule({
    id: 'tail-repair', name: '春潮修复尾', shortName: '春潮', icon: 'R', fixedSlot: 'tail',
    rarity: 'rare', interface: 'SALVAGE', colorGroup: 'green', color: 0x85efa7, power: 204,
    passive: { name: '维修投放', description: '提升所有治疗并增加少量耐久。' },
    stats: { healingMultiplier: 1.22, maxHp: 8 },
  }),
  fixedModule({
    id: 'tail-command', name: '蜂群指挥尾', shortName: '指挥', icon: '▲', fixedSlot: 'tail',
    rarity: 'epic', interface: 'LINK', colorGroup: 'amber', color: 0xffd366, power: 262,
    passive: { name: '多挂点同步', description: '同步提高全部挂载武器的触发效率。' },
    stats: { activeDamageMultiplier: 1.07, activeCooldownMultiplier: 0.93 },
  }),
  fixedModule({
    id: 'tail-phase', name: '相位扰流尾', shortName: '相位', icon: '◎', fixedSlot: 'tail',
    rarity: 'epic', interface: 'VOID', colorGroup: 'violet', color: 0xb68cff, power: 254,
    passive: { name: '相位扰流', description: '减慢敌弹并提高细微机动。' },
    stats: { enemyBulletSpeedMultiplier: 0.87, moveSpeedMultiplier: 1.04 },
  }),
  fixedModule({
    id: 'tail-reactor', name: '回响反应尾', shortName: '回响', icon: '∞', fixedSlot: 'tail',
    rarity: 'epic', interface: 'ARC', colorGroup: 'cyan', color: 0x70e8ee, power: 266,
    passive: { name: '回响电容', description: '挂载武器触发间隔显著缩短。' },
    stats: { activeCooldownMultiplier: 0.87, activeDamageMultiplier: 1.035 },
  }),
  fixedModule({
    id: 'tail-fortune', name: '幸运星机尾', shortName: '幸运', icon: '✧', fixedSlot: 'tail',
    rarity: 'rare', interface: 'SALVAGE', colorGroup: 'amber', color: 0xffdb70, power: 216,
    passive: { name: '幸运航迹', description: '提高暴击与经验收益。' },
    stats: { critChance: 0.03, xpMultiplier: 1.055 },
  }),
  fixedModule({
    id: 'tail-omega', name: '终焉机尾', shortName: '终焉', icon: 'Ω', fixedSlot: 'tail',
    rarity: 'legendary', interface: 'VOID', colorGroup: 'red', color: 0xff6688, power: 324,
    passive: { name: '终焉协议', description: '全面提高挂载火力与旗舰作战性能。' },
    stats: { activeDamageMultiplier: 1.12, activeCooldownMultiplier: 0.95, bossDamageMultiplier: 1.08 },
  }),
];

const GACHA_FIXED_RARITIES = {
  white: { rarity: 'common', color: 0xeefbf7, colorGroup: 'white', power: 120 },
  green: { rarity: 'rare', color: 0x62cf83, colorGroup: 'green', power: 180 },
  blue: { rarity: 'epic', color: 0x5d9dff, colorGroup: 'blue', power: 250 },
};

const FIXED_MODULES = [
  ...LEGACY_FIXED_MODULES,
  ...GACHA_FIXED_ITEMS.map((item) => {
    const presentation = GACHA_FIXED_RARITIES[item.quality];
    return fixedModule({
      id: item.id,
      name: item.name,
      shortName: item.shortName,
      icon: item.icon,
      fixedSlot: item.slot,
      rarity: presentation.rarity,
      interface: 'UNIVERSAL',
      colorGroup: presentation.colorGroup,
      color: presentation.color,
      power: presentation.power,
      passive: {
        name: '通用固定件',
        description: item.effects.map((entry) => entry.description).join('；'),
      },
      stats: { ...item.assemblyStats },
    });
  }),
];

const WEAPON_MODULES = [
  weaponModule({
    id: 'base-cannon', name: '白矛机炮', shortName: '白矛', icon: 'I', style: 'base',
    aliases: ['base', 'white', 'split'], rarity: 'common', interface: 'C1',
    colorGroup: 'white', color: 0xeefbf7, power: 180,
    active: { type: 'lance', name: '白矛贯星', icon: 'I', cooldown: 6, maxCharges: 2, rechargeKills: 20, damage: 12, description: '向前释放高穿透白矛齐射。' },
    stats: { activeDamageMultiplier: 1.035, projectileSpeedMultiplier: 1.04 },
  }),
  weaponModule({
    id: 'red-hunter', name: '赤猎蜂群舱', shortName: '赤猎', icon: 'R', style: 'red',
    aliases: ['red'], rarity: 'rare', interface: 'C1', colorGroup: 'red',
    color: 0xff655b, power: 235,
    active: { type: 'swarm', name: '赤猎蜂群', icon: '▲', cooldown: 8, maxCharges: 2, rechargeKills: 28, damage: 9, description: '释放追踪蜂群标记并围猎目标。' },
    stats: { activeCooldownMultiplier: 0.96, damageMultiplier: 1.025 },
  }),
  weaponModule({
    id: 'blue-vortex', name: '蓝涡电磁舱', shortName: '蓝涡', icon: 'B', style: 'blue',
    aliases: ['blue'], rarity: 'rare', interface: 'F2', colorGroup: 'cyan',
    color: 0x5ea8ff, power: 230,
    active: { type: 'emp', name: '蓝涡静默', icon: '≋', cooldown: 10, maxCharges: 2, rechargeKills: 30, damage: 8, description: '清除弹幕并瘫痪范围内敌机。' },
    stats: { enemyBulletSpeedMultiplier: 0.95, activeDamageMultiplier: 1.025 },
  }),
  weaponModule({
    id: 'frost-shard', name: '寒霜发射器', shortName: '寒霜', icon: 'F', style: 'frost',
    aliases: ['frost'], rarity: 'epic', interface: 'F2', colorGroup: 'cyan',
    color: 0x49e7ee, power: 250,
    active: { type: 'cryo', name: '绝对零域', icon: '❉', cooldown: 12, maxCharges: 1, rechargeKills: 34, damage: 11, description: '冻结敌潮并粉碎近身弹幕。' },
    stats: { damageTakenMultiplier: 0.975, activeDamageMultiplier: 1.05 },
  }),
  weaponModule({
    id: 'prism-lens', name: '棱镜折射器', shortName: '棱镜', icon: 'P', style: 'prism',
    aliases: ['prism'], rarity: 'epic', interface: 'ARC', colorGroup: 'violet',
    color: 0xb37aff, power: 265,
    active: { type: 'prism', name: '棱镜风暴', icon: '◇', cooldown: 9, maxCharges: 2, rechargeKills: 30, damage: 10, description: '以折射电弧连续打击多个目标。' },
    stats: { critChance: 0.018, activeDamageMultiplier: 1.04 },
  }),
  weaponModule({
    id: 'gravity-rail', name: '重力磁轨炮', shortName: '磁轨', icon: 'G', style: 'rail',
    aliases: ['rail'], rarity: 'epic', interface: 'C1', colorGroup: 'amber',
    color: 0xffa45f, power: 282,
    active: { type: 'rail', name: '天贯磁轨', icon: '━', cooldown: 11, maxCharges: 2, rechargeKills: 32, damage: 28, description: '发射贯穿整条航线的重型磁轨弹。' },
    stats: { bossDamageMultiplier: 1.08, projectileSpeedMultiplier: 1.12 },
  }),
  weaponModule({
    id: 'solar-plasma', name: '日冕等离子炮', shortName: '日冕', icon: 'S', style: 'plasma',
    aliases: ['plasma'], rarity: 'legendary', interface: 'ARC', colorGroup: 'red',
    color: 0xffb05f, power: 310,
    active: { type: 'plasma', name: '日冕喷流', icon: '☼', cooldown: 10, maxCharges: 2, rechargeKills: 34, damage: 18, description: '喷射持续灼烧的高温等离子流。' },
    stats: { damageMultiplier: 1.035, activeDamageMultiplier: 1.09 },
  }),
  weaponModule({
    id: 'meteor-array', name: '天穹陨星阵列', shortName: '陨星', icon: 'M', style: 'meteor',
    aliases: ['meteor'], rarity: 'legendary', interface: 'VOID', colorGroup: 'violet',
    color: 0xff718f, power: 328,
    active: { type: 'meteor', name: '天火陨星', icon: '✺', cooldown: 14, maxCharges: 1, rechargeKills: 40, damage: 24, description: '召唤多枚陨星覆盖整个战区。' },
    stats: { activeDamageMultiplier: 1.13, bossDamageMultiplier: 1.055 },
  }),
];

const MODULES = [...FIXED_MODULES, ...WEAPON_MODULES];

const MODULE_MAP = new Map(MODULES.map((module) => [module.id, module]));
const RARITIES = {
  common: { name: '标准', color: 0x91a9ad },
  rare: { name: '稀有', color: 0x5ec8ff },
  epic: { name: '史诗', color: 0xb58aff },
  legendary: { name: '传奇', color: 0xffcf69 },
};
const INVENTORY_CATEGORIES = [
  {
    id: 'fixed',
    name: '固定件',
    hint: '机翼 / 推进 / 机尾',
    color: 0x78f1e5,
    includes: (module) => module.family === 'fixed',
  },
  {
    id: 'weapon',
    name: '武器',
    hint: '机炮 / 弹道模块',
    color: 0xff8a72,
    includes: (module) => module.role === 'weapon',
  },
];
const INVENTORY_CATEGORY_MAP = new Map(INVENTORY_CATEGORIES.map((category) => [category.id, category]));
const FIXED_SUBCATEGORIES = [
  { id: 'wing', name: '机翼', color: 0x78f1e5 },
  { id: 'engine', name: '推进', color: 0x5ec8ff },
  { id: 'tail', name: '机尾', color: 0x8dffca },
];
const FIXED_SUBCATEGORY_MAP = new Map(FIXED_SUBCATEGORIES.map((category) => [category.id, category]));

const SLOTS = [
  {
    id: 'wing',
    name: '机翼',
    family: 'fixed',
    fixedSlot: 'wing',
    x: 280,
    y: 224,
    radius: 36,
  },
  {
    id: 'engine',
    name: '推进器',
    family: 'fixed',
    fixedSlot: 'engine',
    x: 280,
    y: 316,
    radius: 34,
  },
  {
    id: 'tail',
    name: '机尾',
    family: 'fixed',
    fixedSlot: 'tail',
    x: 280,
    y: 374,
    radius: 32,
  },
  {
    id: 'hp1',
    name: '挂点 01',
    family: 'hardpoint',
    role: 'weapon',
    x: 200,
    y: 158,
    radius: 28,
    muzzle: { x: -28, y: -20 },
  },
  {
    id: 'hp2',
    name: '挂点 02',
    family: 'hardpoint',
    role: 'weapon',
    x: 280,
    y: 116,
    radius: 28,
    muzzle: { x: 0, y: -38 },
  },
  {
    id: 'hp3',
    name: '挂点 03',
    family: 'hardpoint',
    role: 'weapon',
    x: 360,
    y: 158,
    radius: 28,
    muzzle: { x: 28, y: -20 },
  },
];

const SLOT_MAP = new Map(SLOTS.map((slot) => [slot.id, slot]));
const SLOT_ORDER = SLOTS.map((slot) => slot.id);

const HARDPOINT_EDGES = [
  ['hp1', 'hp3'],
  ['hp1', 'hp2'],
  ['hp2', 'hp3'],
];
const LINK_EDGES = [...HARDPOINT_EDGES];

const REQUIRED_BONUS_FIELDS = {
  damageMultiplier: 1,
  fireRateMultiplier: 1,
  moveSpeedMultiplier: 1,
  xpMultiplier: 1,
  damageTakenMultiplier: 1,
  activeCooldownMultiplier: 1,
  activeDamageMultiplier: 1,
  enemyBulletSpeedMultiplier: 1,
  healingMultiplier: 1,
  bossDamageMultiplier: 1,
  projectileSpeedMultiplier: 1,
  eliteDamageMultiplier: 1,
  magnetRangeMultiplier: 1,
  maxHpMultiplier: 1,
  collisionDamageTakenMultiplier: 1,
  critChance: 0,
  critMultiplier: 0,
  maxHp: 0,
};
const MULTIPLIER_FIELDS = new Set([
  'damageMultiplier',
  'fireRateMultiplier',
  'moveSpeedMultiplier',
  'xpMultiplier',
  'damageTakenMultiplier',
  'activeCooldownMultiplier',
  'activeDamageMultiplier',
  'enemyBulletSpeedMultiplier',
  'healingMultiplier',
  'bossDamageMultiplier',
  'projectileSpeedMultiplier',
  'eliteDamageMultiplier',
  'magnetRangeMultiplier',
  'maxHpMultiplier',
  'collisionDamageTakenMultiplier',
]);

const mountedBays = new Set();
let debugUnlockAllModules = false;

function createDefaultMounts() {
  return {
    wing: 'wing-swept',
    engine: 'engine-ion',
    tail: 'tail-vector',
    hp1: 'base-cannon',
    hp2: null,
    hp3: null,
  };
}

function isCompatible(slot, module) {
  if (!slot || !module || slot.family !== module.family) return false;
  if (slot.family === 'fixed') return slot.fixedSlot === module.fixedSlot;
  return slot.role === 'weapon' && module.role === 'weapon';
}

function migrateLegacyMountSource(value) {
  return value && typeof value === 'object' ? { ...value } : {};
}

function ownedModuleSet(ownedModules = assemblyState?.ownedModules) {
  const owned = new Set([...STARTER_ASSEMBLY_MODULE_IDS, ...FIXED_MODULES.map(module => module.id)]);
  for (const moduleId of ownedModules || []) {
    if (MODULE_MAP.has(moduleId)) owned.add(moduleId);
  }
  return owned;
}

function availableModuleSet() {
  return debugUnlockAllModules ? new Set(MODULES.map((module) => module.id)) : ownedModuleSet();
}

function sanitizeMounts(value, allowedModules = availableModuleSet()) {
  const source = value && typeof value === 'object' ? value : {};
  const mounts = Object.fromEntries(SLOT_ORDER.map((slotId) => [slotId, null]));
  const used = new Set();
  for (const slotId of SLOT_ORDER) {
    const moduleId = typeof source[slotId] === 'string' ? source[slotId] : null;
    const slot = SLOT_MAP.get(slotId);
    const module = MODULE_MAP.get(moduleId);
    if (!module || !allowedModules.has(module.id) || used.has(module.id) || !isCompatible(slot, module)) continue;
    mounts[slotId] = module.id;
    used.add(module.id);
  }
  return mounts;
}

function createDefaultState() {
  return {
    version: STORAGE_VERSION,
    mounts: createDefaultMounts(),
    ownedModules: [...ownedModuleSet([])],
    weaponLevels: Object.fromEntries(WEAPON_MODULES.map((module) => [module.id, 1])),
  };
}

function normalizeStarterWeaponState(state) {
  const owned = ownedModuleSet(state.ownedModules);
  if (!owned.has('base-cannon')) {
    owned.add('base-cannon');
    state.ownedModules = [...owned];
  }
  if (state.mounts.hp1 == null && state.mounts.hp2 === 'base-cannon') {
    state.mounts.hp1 = 'base-cannon';
    state.mounts.hp2 = null;
  } else if (state.mounts.hp1 == null && state.mounts.hp3 === 'base-cannon') {
    state.mounts.hp1 = 'base-cannon';
    state.mounts.hp3 = null;
  }
  const weaponMounted = ['hp1', 'hp2', 'hp3'].some((slotId) => Boolean(state.mounts[slotId]));
  if (!weaponMounted && owned.has('base-cannon')) {
    state.mounts.hp1 = 'base-cannon';
  }
  state.mounts = sanitizeMounts(state.mounts, ownedModuleSet(state.ownedModules));
  return state;
}

function loadState() {
  if (typeof localStorage === 'undefined') return createDefaultState();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return createDefaultState();
    const sourceMounts = migrateLegacyMountSource(parsed.mounts || parsed.placements);
    const parsedVersion = Math.floor(Number(parsed.version) || 0);
    const ownedModules = parsedVersion >= STORAGE_VERSION
      ? [...ownedModuleSet(parsed.ownedModules)]
      : [...ownedModuleSet([
        ...STARTER_ASSEMBLY_MODULE_IDS,
        ...Object.entries(sourceMounts)
          .filter(([slotId, moduleId]) => SLOT_MAP.get(slotId)?.family === 'fixed' && MODULE_MAP.has(moduleId))
          .map(([, moduleId]) => moduleId),
      ])];
    const migratedMounts = parsedVersion >= STORAGE_VERSION
      ? sourceMounts
      : { ...sourceMounts, hp1: null, hp2: null, hp3: null };
    const mounts = sanitizeMounts(migratedMounts, ownedModuleSet(ownedModules));
    const weaponLevels = Object.fromEntries(WEAPON_MODULES.map((module) => {
      const level = Math.floor(Number(parsed.weaponLevels?.[module.id]) || 1);
      return [module.id, Math.max(1, Math.min(WEAPON_MAX_LEVEL, level))];
    }));
    return normalizeStarterWeaponState({
      version: STORAGE_VERSION,
      mounts,
      ownedModules,
      weaponLevels,
    });
  } catch {
    return createDefaultState();
  }
}

let assemblyState = loadState();

function saveState() {
  if (!isGameSessionCurrent()) return;
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: STORAGE_VERSION,
      mounts: assemblyState.mounts,
      ownedModules: assemblyState.ownedModules,
      weaponLevels: assemblyState.weaponLevels,
    }));
  } catch {
    // Private browsing and embedded WebViews may deny localStorage writes.
  }
}

function moduleSlot(moduleId, mounts = assemblyState.mounts) {
  return SLOT_ORDER.find((slotId) => mounts[slotId] === moduleId) || null;
}

function linkForEdge(from, to, mounts = assemblyState.mounts) {
  const fromModule = MODULE_MAP.get(mounts[from]);
  const toModule = MODULE_MAP.get(mounts[to]);
  if (!fromModule || !toModule) return null;
  const sameColor = fromModule.colorGroup === toModule.colorGroup;
  const sameInterface = fromModule.interface === toModule.interface;
  if (!sameColor && !sameInterface) return null;
  const reasons = [];
    if (sameInterface) reasons.push(`${interfaceName(fromModule.interface)}接口`);
  if (sameColor) reasons.push('同色共振');
  const color = sameColor ? fromModule.color : 0x78f1e5;
  const bonus = {
    damageMultiplier: sameColor ? 1.03 : 1,
    fireRateMultiplier: sameInterface ? 1.025 : 1,
    critChance: sameColor && sameInterface ? 0.004 : 0,
  };
  return {
    id: `${from}:${to}`,
    from,
    to,
    modules: [fromModule.id, toModule.id],
    reason: reasons.join(' + '),
    color,
    bonus,
  };
}

function computeActiveLinks(mounts = assemblyState.mounts) {
  return LINK_EDGES
    .map(([from, to]) => linkForEdge(from, to, mounts))
    .filter(Boolean);
}

function multiplyField(target, field, value) {
  if (Number.isFinite(value)) target[field] *= value;
}

function addField(target, field, value) {
  if (Number.isFinite(value)) target[field] += value;
}

function assemblyPowerFor(mounts = assemblyState.mounts, activeLinks = computeActiveLinks(mounts)) {
  const modulePower = Object.values(mounts).reduce((sum, moduleId) => (
    sum + (MODULE_MAP.get(moduleId)?.power || 0)
  ), 0);
  const weaponGrowthPower = Object.values(mounts).reduce((sum, moduleId) => {
    const module = MODULE_MAP.get(moduleId);
    if (module?.role !== 'weapon') return sum;
    return sum + (getAssemblyWeaponLevel(moduleId) - 1) * 48;
  }, 0);
  const fixedComplete = ['wing', 'engine', 'tail'].every((slotId) => mounts[slotId]);
  return 620 + modulePower + weaponGrowthPower + activeLinks.length * 75 + (fixedComplete ? 180 : 0);
}

function computeBonuses(mounts = assemblyState.mounts) {
  const result = { ...REQUIRED_BONUS_FIELDS };
  for (const moduleId of Object.values(mounts)) {
    const stats = MODULE_MAP.get(moduleId)?.stats || {};
    for (const [field, value] of Object.entries(stats)) {
      if (MULTIPLIER_FIELDS.has(field)) {
        if (!(field in result)) result[field] = 1;
        multiplyField(result, field, value);
      }
      else {
        if (!(field in result)) result[field] = 0;
        addField(result, field, value);
      }
    }
  }
  const activeLinks = computeActiveLinks(mounts);
  for (const link of activeLinks) {
    multiplyField(result, 'damageMultiplier', link.bonus.damageMultiplier);
    multiplyField(result, 'fireRateMultiplier', link.bonus.fireRateMultiplier);
    addField(result, 'critChance', link.bonus.critChance);
  }
  result.power = assemblyPowerFor(mounts, activeLinks);
  result.activeLinks = activeLinks.length;
  return result;
}

function createSummary(mounts = assemblyState.mounts) {
  const activeLinks = computeActiveLinks(mounts);
  const installed = Object.values(mounts).filter(Boolean);
  const weaponCount = installed.reduce((count, moduleId) => (
    count + (MODULE_MAP.get(moduleId)?.role === 'weapon' ? 1 : 0)
  ), 0);
  const fixedCount = ['wing', 'engine', 'tail'].reduce((count, slotId) => count + Number(Boolean(mounts[slotId])), 0);
  return {
    installed: installed.length,
    capacity: SLOTS.length,
    weaponCount,
    supportCount: 0,
    fixedCount,
    activeLinks: activeLinks.length,
    power: assemblyPowerFor(mounts, activeLinks),
    activeWeaponCount: weaponCount,
    activeWeaponName: weaponCount ? `${weaponCount} 个自动挂载` : '未装配',
    bonuses: computeBonuses(mounts),
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Returns factors for multiplier fields and additive values for all other
 * fields. This shape is intentionally compatible with the game's runStats.
 */
export function getAssemblyBonuses() {
  return clone(computeBonuses());
}

export function getAssemblyPower() {
  return assemblyPowerFor();
}

function serializedModule(module) {
  if (!module) return null;
  return {
    id: module.id,
    name: module.name,
    shortName: module.shortName,
    icon: module.icon,
    family: module.family,
    role: module.role,
    style: module.style || null,
    fixedSlot: module.fixedSlot || null,
    rarity: module.rarity,
    interface: module.interface,
    color: module.color,
    power: module.power,
    passive: module.passive ? clone(module.passive) : null,
    active: module.active ? clone(module.active) : null,
    passiveEffect: module.passiveEffect ? clone(module.passiveEffect) : null,
    level: module.role === 'weapon' ? (assemblyState.weaponLevels[module.id] || 1) : null,
    support: module.support ? clone(module.support) : null,
    stats: clone(module.stats || {}),
  };
}

export function getAssemblyModuleInfo(moduleId) {
  return serializedModule(MODULE_MAP.get(moduleId));
}

export function getAssemblyAppearance() {
  return Object.fromEntries(['wing', 'engine', 'tail'].map(slot => [
    slot, fixedPartProfile(MODULE_MAP.get(assemblyState.mounts[slot])),
  ]));
}

export function getFixedModuleCatalog() {
  return FIXED_MODULES.map(serializedModule);
}

export function grantAssemblyModules(moduleIds = []) {
  const owned = ownedModuleSet();
  const granted = [];
  for (const moduleId of moduleIds) {
    const module = MODULE_MAP.get(moduleId);
    if (!module || owned.has(moduleId)) continue;
    owned.add(moduleId);
    granted.push(serializedModule(module));
  }
  if (!granted.length) return granted;
  assemblyState.ownedModules = [...owned];
  const weaponMounted = ['hp1', 'hp2', 'hp3'].some((slotId) => Boolean(assemblyState.mounts[slotId]));
  if (!weaponMounted && owned.has('base-cannon')) assemblyState.mounts.hp1 = 'base-cannon';
  broadcastChange();
  return granted;
}

// The temporary all-weapons preview wrote weapon modules into existing saves.
// Keep only campaign-earned weapons while preserving fixed parts from draws.
export function reconcileCampaignWeaponModules(unlockedModuleIds = []) {
  const allowedWeapons = new Set([
    ...STARTER_ASSEMBLY_MODULE_IDS,
    ...unlockedModuleIds,
  ]);
  const retained = [...ownedModuleSet()].filter((moduleId) => {
    const module = MODULE_MAP.get(moduleId);
    return module?.role !== 'weapon' || allowedWeapons.has(moduleId);
  });
  if (
    retained.length === assemblyState.ownedModules.length
    && retained.every((moduleId) => assemblyState.ownedModules.includes(moduleId))
  ) return getAssemblySnapshot();
  assemblyState.ownedModules = retained;
  assemblyState.mounts = sanitizeMounts(assemblyState.mounts, new Set(retained));
  normalizeStarterWeaponState(assemblyState);
  broadcastChange();
  return getAssemblySnapshot();
}

export function setAssemblyDebugUnlocks(enabled) {
  const next = Boolean(enabled);
  if (debugUnlockAllModules === next) return getAssemblySnapshot();
  debugUnlockAllModules = next;
  if (!debugUnlockAllModules) {
    assemblyState.mounts = sanitizeMounts(assemblyState.mounts, ownedModuleSet());
  }
  broadcastChange();
  return getAssemblySnapshot();
}

export function getAssemblySnapshot() {
  const activeLinks = computeActiveLinks();
  return {
    version: STORAGE_VERSION,
    mounts: { ...assemblyState.mounts },
    ownedModules: [...assemblyState.ownedModules],
    ownedCount: assemblyState.ownedModules.length,
    totalModuleCount: MODULES.length,
    debugUnlockAllModules,
    weaponLevels: { ...assemblyState.weaponLevels },
    slots: SLOTS.map((slot) => ({
      id: slot.id,
      name: slot.name,
      family: slot.family,
      role: slot.role || null,
      muzzle: slot.muzzle ? { ...slot.muzzle } : null,
      moduleId: assemblyState.mounts[slot.id] || null,
      module: serializedModule(MODULE_MAP.get(assemblyState.mounts[slot.id])),
    })),
    activeLinks: clone(activeLinks),
    summary: createSummary(),
  };
}

export function getAssemblyPassiveWeapons() {
  return SLOTS
    .filter((slot) => slot.role === 'weapon')
    .map((slot, index) => {
      const module = MODULE_MAP.get(assemblyState.mounts[slot.id]);
      const level = module ? (assemblyState.weaponLevels[module.id] || 1) : 1;
      const base = {
        moduleId: module?.id || null,
        name: module?.name || '空挂点',
        shortName: module?.shortName || '空',
        color: module?.color || COLORS.dim,
        slotId: slot.id,
        slotIndex: index,
        mountIndex: index + 1,
        shortcut: index + 1,
        level,
        muzzle: slot.muzzle ? { ...slot.muzzle } : { x: 0, y: -28 },
      };
      if (!module?.passiveEffect) return { ...base, passiveName: null, passiveEffect: null };
      const levelDamageMultiplier = 1 + (level - 1) * 0.14;
      const levelIntervalMultiplier = Math.max(0.58, 1 - (level - 1) * 0.035);
      const passiveEffect = {
        ...clone(module.passiveEffect),
        damage: module.passiveEffect.damage * levelDamageMultiplier,
        interval: module.passiveEffect.interval * levelIntervalMultiplier,
      };
      return {
        ...base,
        passiveName: module.passive.name,
        passiveEffect,
      };
    });
}

// Compatibility aliases for older integrations. Mounted weapons now trigger
// automatically and no longer expose player-operated active skills.
export function getAssemblyActiveWeapons() {
  return getAssemblyPassiveWeapons();
}

export function getAssemblyActiveWeapon() {
  return getAssemblyPassiveWeapons().find((weapon) => weapon.passiveEffect) || null;
}

export function getAssemblySupports() {
  return [];
}

export function getAssemblyWeaponLevel(moduleId) {
  return Math.max(1, assemblyState.weaponLevels[moduleId] || 1);
}

export function getAssemblyWeaponUpgradeCost(moduleId) {
  const module = MODULE_MAP.get(moduleId);
  if (!module || module.role !== 'weapon' || !availableModuleSet().has(moduleId)) return 0;
  const level = getAssemblyWeaponLevel(moduleId);
  if (level >= WEAPON_MAX_LEVEL) return 0;
  return Math.round((180 + level * level * 95 + (RARITIES[module.rarity]?.name ? 80 : 0)) / 10) * 10;
}

export function upgradeAssemblyWeapon(moduleId) {
  const module = MODULE_MAP.get(moduleId);
  if (!module || module.role !== 'weapon' || !availableModuleSet().has(moduleId)) return false;
  const level = getAssemblyWeaponLevel(moduleId);
  if (level >= WEAPON_MAX_LEVEL) return false;
  assemblyState.weaponLevels[moduleId] = level + 1;
  broadcastChange();
  return true;
}

/**
 * Returns a muzzle in the player ship's local coordinate space. White/split
 * both resolve to the base module. Only actual weapon modules are considered.
 */
export function getAssemblyMuzzle(style, fallbackX = 0, fallbackY = -28) {
  const requested = String(style || '').toLowerCase();
  for (const slot of SLOTS) {
    if (!slot.muzzle) continue;
    const module = MODULE_MAP.get(assemblyState.mounts[slot.id]);
    if (!module || module.role !== 'weapon') continue;
    const aliases = module.aliases || [module.style];
    if (aliases.includes(requested)) return { x: slot.muzzle.x, y: slot.muzzle.y };
  }
  return { x: fallbackX, y: fallbackY };
}

function broadcastChange() {
  saveState();
  const summary = createSummary();
  for (const bay of mountedBays) {
    bay.draw();
    if (typeof bay.onChange === 'function') bay.onChange(clone(summary));
  }
}

export function resetAssembly(section = 'all') {
  const defaults = createDefaultMounts();
  const mounts = section === 'fixed'
    ? { ...assemblyState.mounts, wing: defaults.wing, engine: defaults.engine, tail: defaults.tail }
    : section === 'weapon'
      ? { ...assemblyState.mounts, hp1: defaults.hp1, hp2: defaults.hp2, hp3: defaults.hp3 }
      : defaults;
  assemblyState = {
    version: STORAGE_VERSION,
    mounts,
    ownedModules: [...assemblyState.ownedModules],
    weaponLevels: { ...assemblyState.weaponLevels },
  };
  broadcastChange();
  return getAssemblySnapshot();
}

/**
 * Platform-neutral slot mutation used by non-DOM clients such as the WeChat
 * mini-game renderer. The H5 drag-and-drop bay continues to use the same
 * assembly state and validation rules.
 */
export function setAssemblySlot(slotId, moduleId) {
  const slot = SLOT_MAP.get(slotId);
  if (!slot) return false;
  if (moduleId == null) {
    if (!assemblyState.mounts[slotId]) return false;
    assemblyState.mounts[slotId] = null;
    broadcastChange();
    return true;
  }
  const module = MODULE_MAP.get(moduleId);
  if (
    !module
    || !availableModuleSet().has(moduleId)
    || !isCompatible(slot, module)
  ) return false;
  const previousSlot = moduleSlot(moduleId);
  if (previousSlot && previousSlot !== slotId) assemblyState.mounts[previousSlot] = null;
  assemblyState.mounts[slotId] = moduleId;
  broadcastChange();
  return true;
}

function makeText(text, size, color = COLORS.white, weight = '700', align = 'left') {
  const readableSize = Math.ceil((size < 16 ? Math.max(11, size * 1.12) : size) * 1.08);
  const view = new Text({
    text,
    style: {
      fontFamily: '"Arial Black", "PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: readableSize,
      fontWeight: weight,
      fill: color,
      align,
    },
  });
  return view;
}

function fitTextWidth(view, maxWidth, minSize = 10) {
  if (!view || !(maxWidth > 0) || view.width <= maxWidth) return view;
  const naturalSize = Number(view.style.fontSize) || minSize;
  let fitted = Math.max(minSize, Math.floor(naturalSize * (maxWidth / view.width)));
  view.style.fontSize = fitted;
  while (view.width > maxWidth && fitted > minSize) {
    fitted -= 1;
    view.style.fontSize = fitted;
  }
  return view;
}

function addCenteredText(parent, text, x, y, size, color = COLORS.white, weight = '800') {
  const view = makeText(text, size, color, weight, 'center');
  view.anchor.set(0.5);
  view.position.set(x, y);
  parent.addChild(view);
  return view;
}

function drawGrid(parent) {
  const grid = new Graphics();
  for (let x = 8; x < DESIGN_WIDTH; x += 28) {
    grid.moveTo(x, 48).lineTo(x, INVENTORY_TOP - 8);
  }
  for (let y = 58; y < INVENTORY_TOP - 8; y += 28) {
    grid.moveTo(0, y).lineTo(DESIGN_WIDTH, y);
  }
  grid.stroke({ color: COLORS.cyan, width: 1, alpha: 0.035 });
  parent.addChild(grid);
}

function mirroredWingPolygon(points, centerX = 280, centerY = 233, side = 1) {
  return points.flatMap(([x, y]) => [centerX + x * side, centerY + y]);
}

function drawAirframe(parent) {
  const visual = createAssemblyAircraftVisual();
  visual.root.position.set(280, 218);
  visual.root.scale.set(0.94);
  parent.addChild(visual.root);
  return visual;
}

// Kept temporarily as a geometry reference while old save screenshots remain
// in documentation; the live hangar and combat both use drawAirframe above.
function drawAirframeLegacy(parent) {
  const wingModule = MODULE_MAP.get(assemblyState.mounts.wing);
  const wingProfile = WING_PROFILES[wingModule?.id] || WING_PROFILES['wing-swept'];
  const engineModule = MODULE_MAP.get(assemblyState.mounts.engine);
  const engineProfile = ENGINE_PROFILES[engineModule?.id] || ENGINE_PROFILES['engine-ion'];
  const tailModule = MODULE_MAP.get(assemblyState.mounts.tail);
  const tailProfile = TAIL_PROFILES[tailModule?.id] || TAIL_PROFILES['tail-vector'];
  const leftWing = mirroredWingPolygon(wingProfile.points);
  const rightWing = mirroredWingPolygon(wingProfile.points, 280, 233, -1);
  const wingColor = wingModule?.color || COLORS.cyan;
  const body = new Graphics()
    .ellipse(280, 233, 62, 174).fill({ color: 0x071a23, alpha: 0.96 })
    .ellipse(280, 233, 62, 174).stroke({ color: 0x82d8dc, width: 1.3, alpha: 0.35 })
    .poly([280, 64, 300, 146, 300, 314, 280, 398, 260, 314, 260, 146])
    .fill({ color: 0x153743, alpha: 0.94 })
    .poly([280, 69, 292, 154, 288, 340, 280, 387, 272, 340, 268, 154])
    .stroke({ color: 0xb7f9f4, width: 1.2, alpha: 0.34 })
    .poly(leftWing)
    .fill({ color: assemblyState.mounts.wing ? 0x123a48 : 0x081b22, alpha: 0.94 })
    .poly(rightWing)
    .fill({ color: assemblyState.mounts.wing ? 0x123a48 : 0x081b22, alpha: 0.94 })
    .poly(leftWing)
    .stroke({ color: wingColor, width: 1.8, alpha: assemblyState.mounts.wing ? 0.72 : 0.12 })
    .poly(rightWing)
    .stroke({ color: wingColor, width: 1.8, alpha: assemblyState.mounts.wing ? 0.72 : 0.12 });
  parent.addChild(body);

  if (wingModule) {
    const wingMarkings = new Graphics()
      .moveTo(258, 210).lineTo(leftWing[2], leftWing[3])
      .moveTo(302, 210).lineTo(rightWing[2], rightWing[3])
      .stroke({ color: wingColor, width: 2, alpha: 0.34 });
    parent.addChild(wingMarkings);
  }

  const cockpit = new Graphics()
    .poly([280, 102, 294, 172, 280, 203, 266, 172])
    .fill({ color: 0x75dfeb, alpha: 0.4 })
    .poly([280, 112, 287, 168, 280, 184, 273, 168])
    .fill({ color: 0xd9ffff, alpha: 0.34 });
  parent.addChild(cockpit);

  const leftTail = mirroredWingPolygon(tailProfile.points, 280, 342);
  const rightTail = mirroredWingPolygon(tailProfile.points, 280, 342, -1);
  const tailColor = tailModule?.color || 0x8dffca;
  const tail = new Graphics()
    .poly(leftTail)
    .fill({ color: assemblyState.mounts.tail ? 0x174856 : 0x081b22, alpha: 0.96 })
    .poly(rightTail)
    .fill({ color: assemblyState.mounts.tail ? 0x174856 : 0x081b22, alpha: 0.96 })
    .poly(leftTail)
    .stroke({ color: tailColor, width: 1.7, alpha: assemblyState.mounts.tail ? 0.72 : 0.12 })
    .poly(rightTail)
    .stroke({ color: tailColor, width: 1.7, alpha: assemblyState.mounts.tail ? 0.72 : 0.12 })
    .moveTo(268, 343).lineTo(leftTail[2], leftTail[3])
    .moveTo(292, 343).lineTo(rightTail[2], rightTail[3])
    .stroke({ color: tailColor, width: 1.5, alpha: assemblyState.mounts.tail ? 0.34 : 0.08 });
  parent.addChild(tail);

  const engineAlpha = assemblyState.mounts.engine ? 0.8 : 0.16;
  const engineColor = engineModule?.color || 0x55dfff;
  const engineBottom = 374;
  const engines = new Graphics();
  for (const offset of engineProfile.nozzles) {
    const x = 280 + offset;
    const halfWidth = engineProfile.width / 2;
    engines
      .roundRect(
        x - halfWidth,
        engineBottom - engineProfile.housing,
        engineProfile.width,
        engineProfile.housing,
        Math.min(7, halfWidth),
      )
      .fill({ color: 0x0d2732, alpha: 0.96 })
      .roundRect(
        x - halfWidth,
        engineBottom - engineProfile.housing,
        engineProfile.width,
        engineProfile.housing,
        Math.min(7, halfWidth),
      )
      .stroke({ color: engineColor, width: 1.2, alpha: engineAlpha * 0.52 })
      .poly([
        x - halfWidth * 0.62, engineBottom - 1,
        x + halfWidth * 0.62, engineBottom - 1,
        x, engineBottom + engineProfile.plume,
      ])
      .fill({ color: engineColor, alpha: engineAlpha * engineProfile.flare })
      .poly([
        x - Math.max(2, halfWidth * 0.26), engineBottom,
        x + Math.max(2, halfWidth * 0.26), engineBottom,
        x, engineBottom + engineProfile.plume * 0.7,
      ])
      .fill({ color: 0xe8ffff, alpha: engineAlpha });
  }
  if (engineProfile.key === 'singularity') {
    engines
      .circle(280, engineBottom - 24, 13)
      .stroke({ color: engineColor, width: 2.2, alpha: engineAlpha * 0.8 })
      .circle(280, engineBottom - 24, 5)
      .fill({ color: engineColor, alpha: engineAlpha * 0.58 });
  }
  parent.addChild(engines);
}

function drawDashedSegment(graphic, from, to, dash = 8, gap = 5) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  if (!distance) return;
  const dx = (to.x - from.x) / distance;
  const dy = (to.y - from.y) / distance;
  for (let offset = 0; offset < distance; offset += dash + gap) {
    const end = Math.min(distance, offset + dash);
    graphic
      .moveTo(from.x + dx * offset, from.y + dy * offset)
      .lineTo(from.x + dx * end, from.y + dy * end);
  }
}

function drawHardpointLinks(parent, bay) {
  const showingWeapons = bay.inventoryCategory === 'weapon';
  const inactive = new Graphics();
  for (const [from, to] of HARDPOINT_EDGES) {
    const a = SLOT_MAP.get(from);
    const b = SLOT_MAP.get(to);
    inactive.moveTo(a.x, a.y).lineTo(b.x, b.y);
  }
  inactive.stroke({ color: 0x82b7be, width: 1.2, alpha: showingWeapons ? 0.16 : 0.035 });
  parent.addChild(inactive);

  for (const link of computeActiveLinks()) {
    const a = SLOT_MAP.get(link.from);
    const b = SLOT_MAP.get(link.to);
    if (!showingWeapons) continue;
    const glow = new Graphics()
      .moveTo(a.x, a.y).lineTo(b.x, b.y)
      .stroke({ color: link.color, width: 10, alpha: 0.07 })
      .moveTo(a.x, a.y).lineTo(b.x, b.y)
      .stroke({ color: link.color, width: 3, alpha: 0.78 });
    parent.addChild(glow);
    addCenteredText(parent, '增益', (a.x + b.x) / 2, (a.y + b.y) / 2 - 7, 10, link.color, '900');
  }
}

function slotCompatibleWithDrag(slot, drag) {
  const module = MODULE_MAP.get(drag?.moduleId);
  return Boolean(module && isCompatible(slot, module));
}

function slotMatchesInventoryFilter(slot, bay) {
  if (bay.inventoryCategory === 'fixed') return slot.family === 'fixed';
  if (bay.inventoryCategory === 'weapon') return slot.family === 'hardpoint' && slot.role === 'weapon';
  return false;
}

function slotIsPrimaryFocus(slot, bay) {
  if (bay.inventoryCategory === 'fixed') return slot.fixedSlot === bay.fixedSubcategory;
  return slotMatchesInventoryFilter(slot, bay);
}

function inventoryFocusColor(bay) {
  return INVENTORY_CATEGORY_MAP.get(bay.inventoryCategory)?.color || COLORS.cyan;
}

function drawSlot(parent, bay, slot) {
  const module = MODULE_MAP.get(assemblyState.mounts[slot.id]);
  const weaponMountIndex = slot.role === 'weapon' ? Number(slot.id.replace('hp', '')) : null;
  const compatible = bay.drag && slotCompatibleWithDrag(slot, bay.drag);
  const incompatible = bay.drag && !compatible;
  const categoryFocused = slotMatchesInventoryFilter(slot, bay);
  const focused = bay.drag ? compatible : categoryFocused;
  const primaryFocus = !bay.drag && slotIsPrimaryFocus(slot, bay);
  const focusColor = inventoryFocusColor(bay);
  const baseColor = module?.color || (compatible ? COLORS.green : focused ? focusColor : COLORS.dim);
  const dimFactor = focused ? 1 : 0.2;
  const radius = slot.family === 'fixed' ? 25 : 23;
  const slotGraphic = new Graphics()
    .circle(0, 0, radius + 9)
    .stroke({
      color: incompatible ? COLORS.red : primaryFocus ? focusColor : baseColor,
      width: focused ? (primaryFocus ? 2.2 : 1.4) : 1,
      alpha: incompatible ? 0.1 : focused ? (primaryFocus ? 0.72 : 0.42) : 0.05,
    })
    .circle(0, 0, radius + 5)
    .fill({ color: baseColor, alpha: (module ? 0.1 : compatible ? 0.12 : 0.035) * dimFactor })
    .circle(0, 0, radius)
    .stroke({
      color: incompatible ? COLORS.red : baseColor,
      width: compatible ? 2.4 : 1.4,
      alpha: incompatible ? 0.1 : (module ? 0.76 : compatible ? 0.9 : 0.42) * dimFactor,
    });
  slotGraphic.position.set(slot.x, slot.y);
  parent.addChild(slotGraphic);

  if (module) {
    const node = new Container();
    node.position.set(slot.x, slot.y);
    node.alpha = focused ? 1 : 0.28;
    node.eventMode = 'static';
    node.cursor = 'grab';
    const plate = new Graphics()
      .circle(0, 0, radius - 2).fill({ color: 0x05151c, alpha: 0.96 })
      .circle(0, 0, radius - 3).stroke({ color: module.color, width: 2.2, alpha: 0.82 })
      .circle(0, 0, radius - 9).fill({ color: module.color, alpha: 0.13 });
    node.addChild(plate);
    addCenteredText(node, module.icon, 0, -1, 18, module.color, '900');
    if (weaponMountIndex) {
      addCenteredText(node, 'A', radius - 8, -radius + 8, 9, COLORS.amber, '900');
    }
    node.on('pointerdown', (event) => {
      event.stopPropagation();
      bay.beginDrag(module.id, slot.id, event);
    });
    parent.addChild(node);
  } else {
    const plus = addCenteredText(parent, '+', slot.x, slot.y - 1, 17, baseColor, '800');
    plus.alpha = focused ? 1 : 0.18;
  }

  const labelY = slot.y + radius + 11;
  const label = addCenteredText(
    parent,
    slot.name,
    slot.x,
    labelY,
    10.5,
    focused ? (module ? 0xdffbf7 : 0x8eb1b5) : 0x3e585d,
    '800',
  );
  label.alpha = focused ? 1 : 0.48;
}

function modulesForInventoryCategory(categoryId, fixedSubcategory = 'wing') {
  const category = INVENTORY_CATEGORY_MAP.get(categoryId) || INVENTORY_CATEGORY_MAP.get('weapon');
  const available = availableModuleSet();
  return MODULES.filter((module) => (
    available.has(module.id)
    &&
    category.includes(module)
    && (category.id !== 'fixed' || module.fixedSlot === fixedSubcategory)
  ));
}

function drawInventoryTabs(parent, bay) {
  const category = INVENTORY_CATEGORY_MAP.get(bay.inventoryCategory);
  const modules = MODULES.filter(category.includes);
  const unlocked = modules.filter((module) => availableModuleSet().has(module.id)).length;
  const installed = modules.reduce((count, module) => count + Number(Boolean(moduleSlot(module.id))), 0);
  const banner = new Graphics()
    .roundRect(18, 458, 524, 43, 5)
    .fill({ color: category.color, alpha: 0.1 })
    .roundRect(18, 458, 524, 43, 5)
    .stroke({ color: category.color, width: 1.3, alpha: 0.42 });
  parent.addChild(banner);
  if (category.id !== 'fixed') {
    const name = makeText('武器挂载 · 自动被动技能', 15, COLORS.white, '900');
    name.position.set(31, 468);
    parent.addChild(name);
  }
  const unlockedLabel = makeText(`已解锁 ${unlocked}/${modules.length}`, 10.5, 0x9bc7cb, '800');
  unlockedLabel.position.set(31, category.id === 'fixed' ? 479 : 485);
  if (category.id === 'fixed') unlockedLabel.anchor.set(0, 0.5);
  parent.addChild(unlockedLabel);
  const count = makeText(`${installed}/3 ${category.id === 'fixed' ? '已装备' : '已安装'}`, 11, category.color, '900');
  count.anchor.set(1, category.id === 'fixed' ? 0.5 : 0);
  count.position.set(529, category.id === 'fixed' ? 479 : 471);
  parent.addChild(count);
}

function drawFixedSubcategoryTabs(parent, bay) {
  if (bay.inventoryCategory !== 'fixed') {
    return;
  }
  const tabWidth = 166;
  const tabHeight = 34;
  const gap = 12;
  FIXED_SUBCATEGORIES.forEach((category, index) => {
    const active = bay.fixedSubcategory === category.id;
    const tab = new Container();
    tab.position.set(18 + index * (tabWidth + gap), 508);
    tab.eventMode = 'static';
    tab.cursor = 'pointer';
    tab.addChild(new Graphics()
      .roundRect(0, 0, tabWidth, tabHeight, 4)
      .fill({ color: category.color, alpha: active ? 0.16 : 0.035 })
      .roundRect(0, 0, tabWidth, tabHeight, 4)
      .stroke({ color: category.color, width: active ? 1.5 : 1, alpha: active ? 0.75 : 0.18 }));
    addCenteredText(tab, `${category.name} · 10`, tabWidth / 2, tabHeight / 2, 13.5, active ? category.color : 0x77979c, '900');
    tab.on('pointertap', (event) => {
      event.stopPropagation();
      if (bay.drag || active) return;
      bay.fixedSubcategory = category.id;
      bay.inventoryPage = 0;
      bay.detailModuleId = null;
      bay.draw();
    });
    parent.addChild(tab);
  });
}

function installedSlotName(slotId) {
  return SLOT_MAP.get(slotId)?.name || String(slotId || '');
}

function installedWeaponShortcut(slotId) {
  const slot = SLOT_MAP.get(slotId);
  if (slot?.role !== 'weapon') return null;
  return Number(slotId.replace('hp', '')) || null;
}

function moduleCardDetails(module) {
  if (module.passiveEffect) {
    const level = getAssemblyWeaponLevel(module.id);
    const interval = module.passiveEffect.interval * Math.max(0.58, 1 - (level - 1) * 0.035);
    return [`等级${level} · 自动间隔 ${interval.toFixed(1)}秒`, module.passive.description];
  }
  if (module.active) {
    return [`${module.active.name} · 冷却 ${module.active.cooldown}秒`, module.active.description];
  }
  if (module.support) {
    const interval = module.support.fireInterval > 0
      ? `${module.support.units}架 · ${module.support.fireInterval}秒/次`
      : `${module.support.units}单元 · 常驻`;
    return [
      interval,
      module.support.description,
    ];
  }
  return [
    module.passive?.name || '固定部件',
    module.passive?.description || '',
  ];
}

function percentDelta(value, inverse = false) {
  const delta = Math.round(Math.abs((Number(value) - 1) * 100));
  const positive = inverse ? Number(value) < 1 : Number(value) > 1;
  return `${positive ? '+' : '-'}${delta}%`;
}

function moduleStatHighlights(module, limit = 3) {
  const stats = module.stats || {};
  const candidates = [
    ['damageMultiplier', '伤害', (value) => percentDelta(value)],
    ['fireRateMultiplier', '射速', (value) => percentDelta(value)],
    ['moveSpeedMultiplier', '移速', (value) => percentDelta(value)],
    ['activeCooldownMultiplier', '挂载间隔', (value) => percentDelta(value, true)],
    ['activeDamageMultiplier', '挂载伤害', (value) => percentDelta(value)],
    ['damageTakenMultiplier', '承伤', (value) => percentDelta(value, true)],
    ['enemyBulletSpeedMultiplier', '敌弹速度', (value) => percentDelta(value, true)],
    ['bossDamageMultiplier', 'Boss伤害', (value) => percentDelta(value)],
    ['projectileSpeedMultiplier', '弹速', (value) => percentDelta(value)],
    ['xpMultiplier', '经验', (value) => percentDelta(value)],
    ['healingMultiplier', '维修', (value) => percentDelta(value)],
    ['critChance', '暴击', (value) => `+${Math.round(Number(value) * 100)}%`],
    ['maxHp', '耐久', (value) => `${Number(value) >= 0 ? '+' : ''}${Number(value)}`],
    ['magnetRange', '拾取', (value) => `+${Number(value)}`],
  ];
  return candidates
    .filter(([field]) => Number.isFinite(stats[field]) && stats[field] !== 0 && stats[field] !== 1)
    .slice(0, limit)
    .map(([field, label, format]) => `${label} ${format(stats[field])}`);
}

function detailDescription(module) {
  if (module.passiveEffect) return module.passive?.description || module.passiveEffect.description;
  if (module.active) return module.active.description;
  if (module.support) return module.support.description;
  return module.passive?.description || '标准固定部件。';
}

function wrapDetailText(value, width = 28, maxLines = 2) {
  const text = String(value || '');
  const lines = [];
  for (let index = 0; index < text.length; index += width) {
    lines.push(text.slice(index, index + width));
  }
  return lines.slice(0, maxLines).join('\n');
}

function addModuleDragHandle(parent, bay, module, installedAt, x, y, size = 42, tapOpensDetail = false) {
  const handle = new Container();
  handle.position.set(x, y);
  handle.eventMode = 'static';
  handle.cursor = 'grab';
  handle.addChild(new Graphics()
    .roundRect(0, 0, size, size, 6)
    .fill({ color: module.color, alpha: 0.12 })
    .roundRect(0, 0, size, size, 6)
    .stroke({ color: module.color, width: 1.2, alpha: 0.52 }));
  addCenteredText(handle, module.icon, size / 2, size / 2 - 2, 19, module.color, '900');
  addCenteredText(handle, '⋮', size - 6, size - 7, 11, 0xbad2d2, '900');
  handle.on('pointerdown', (event) => {
    event.stopPropagation();
    bay.detailModuleId = null;
    bay.beginDrag(module.id, installedAt, event, tapOpensDetail);
  });
  handle.on('pointertap', (event) => event.stopPropagation());
  parent.addChild(handle);
  return handle;
}

function drawInventoryCard(parent, bay, module, index) {
  const x = 18 + (index % INVENTORY_CARD_COLUMNS)
    * (INVENTORY_CARD_WIDTH + INVENTORY_CARD_GAP_X);
  const y = INVENTORY_CARD_TOP + Math.floor(index / INVENTORY_CARD_COLUMNS)
    * (INVENTORY_CARD_HEIGHT + INVENTORY_CARD_GAP_Y);
  const installedAt = moduleSlot(module.id);
  const rarity = RARITIES[module.rarity] || RARITIES.common;
  const card = new Container();
  card.position.set(x, y);
  card.hitArea = new Rectangle(0, 0, INVENTORY_CARD_WIDTH, INVENTORY_CARD_HEIGHT);
  card.eventMode = 'static';
  card.cursor = 'grab';
  card.on('pointerdown', (event) => {
    event.stopPropagation();
    bay.beginDrag(module.id, installedAt, event, true);
  });

  const background = new Graphics()
    .roundRect(0, 0, INVENTORY_CARD_WIDTH, INVENTORY_CARD_HEIGHT, 5)
    .fill({ color: installedAt ? 0x06171e : 0x0a252e, alpha: installedAt ? 0.78 : 0.96 })
    .roundRect(0, 0, INVENTORY_CARD_WIDTH, INVENTORY_CARD_HEIGHT, 5)
    .stroke({ color: module.color, width: 1, alpha: installedAt ? 0.32 : 0.45 })
    .roundRect(0, 0, 3, INVENTORY_CARD_HEIGHT, 2)
    .fill({ color: rarity.color, alpha: 0.94 });
  card.addChild(background);
  addModuleDragHandle(card, bay, module, installedAt, 8, 9, 42, true);

  const name = fitTextWidth(
    makeText(module.name, 12.5, installedAt ? 0xa8c1c4 : COLORS.white, '900'),
    INVENTORY_CARD_WIDTH - 72,
    10,
  );
  name.position.set(59, 7);
  card.addChild(name);

  const [primaryDetail] = moduleCardDetails(module);
  const statLine = moduleStatHighlights(module, 2).join(' · ');
  const coreLine = module.passiveEffect || module.active || module.support
    ? primaryDetail
    : [primaryDetail, moduleStatHighlights(module, 1)[0]].filter(Boolean).join(' · ');
  const primary = fitTextWidth(
    makeText(coreLine, 10.5, installedAt ? 0x8aa0a4 : module.color, '800'),
    INVENTORY_CARD_WIDTH - 72,
    9,
  );
  primary.position.set(59, 31);
  card.addChild(primary);

  if (installedAt) {
    const installedLabel = module.role === 'weapon'
      ? `M${installedAt.replace('hp', '')}`
      : '✓';
    const installed = makeText(installedLabel, 9.5, module.role === 'weapon' ? COLORS.amber : 0x7f999d, '900');
    installed.anchor.set(1, 0);
    installed.position.set(INVENTORY_CARD_WIDTH - 8, 31);
    card.addChild(installed);
  }
  parent.addChild(card);
}

function drawDetailAction(parent, label, x, y, color, onTap, enabled = true) {
  const width = 130;
  const height = 32;
  const button = new Container();
  button.position.set(x, y);
  button.eventMode = enabled ? 'static' : 'none';
  button.cursor = enabled ? 'pointer' : 'default';
  button.alpha = enabled ? 1 : 0.42;
  button.addChild(new Graphics()
    .roundRect(0, 0, width, height, 5)
    .fill({ color, alpha: 0.14 })
    .roundRect(0, 0, width, height, 5)
    .stroke({ color, width: 1.2, alpha: 0.64 }));
  addCenteredText(button, label, width / 2, height / 2, 12.5, color, '900');
  if (enabled) {
    button.on('pointertap', (event) => {
      event.stopPropagation();
      onTap();
    });
  }
  parent.addChild(button);
}

function drawModuleDetail(parent, bay, module) {
  const installedAt = moduleSlot(module.id);
  const rarity = RARITIES[module.rarity] || RARITIES.common;
  const drawer = new Container();
  drawer.position.set(18, INVENTORY_CARD_TOP);
  drawer.addChild(new Graphics()
    .roundRect(0, 0, 524, INVENTORY_DETAIL_HEIGHT, 7)
    .fill({ color: 0x071d25, alpha: 0.99 })
    .roundRect(0, 0, 524, INVENTORY_DETAIL_HEIGHT, 7)
    .stroke({ color: module.color, width: 1.6, alpha: 0.62 })
    .roundRect(0, 0, 4, INVENTORY_DETAIL_HEIGHT, 2)
    .fill({ color: rarity.color, alpha: 0.96 }));

  addModuleDragHandle(drawer, bay, module, installedAt, 13, 13, 48);
  const title = fitTextWidth(makeText(module.name, 16, COLORS.white, '900'), 390, 12);
  title.position.set(74, 10);
  drawer.addChild(title);
  const meta = makeText(
    `${rarity.name} · ${interfaceName(module.interface)}接口 · 战力 ${module.power}${installedAt ? ` · ${installedSlotName(installedAt)}` : ''}`,
    10.5,
    rarity.color,
    '800',
  );
  meta.position.set(74, 35);
  drawer.addChild(meta);

  const [primaryDetail] = moduleCardDetails(module);
  const focus = makeText(primaryDetail, 12.5, module.color, '900');
  focus.position.set(13, 82);
  drawer.addChild(focus);
  const description = makeText(wrapDetailText(detailDescription(module), 36, 4), 12, 0xb4cccc, '700');
  description.position.set(13, 108);
  drawer.addChild(description);
  const stats = makeText(moduleStatHighlights(module, 3).join('  ·  ') || '无额外常驻属性', 10.5, 0x90aaad, '800');
  stats.position.set(13, 186);
  drawer.addChild(stats);
  const close = new Container();
  close.position.set(484, 8);
  close.eventMode = 'static';
  close.cursor = 'pointer';
  close.addChild(new Graphics()
    .roundRect(0, 0, 30, 30, 5)
    .fill({ color: 0xffffff, alpha: 0.035 })
    .roundRect(0, 0, 30, 30, 5)
    .stroke({ color: 0xffffff, width: 1, alpha: 0.16 }));
  addCenteredText(close, '×', 15, 14, 18, 0xc6d9d9, '700');
  close.on('pointertap', (event) => {
    event.stopPropagation();
    bay.detailModuleId = null;
    bay.draw();
  });
  drawer.addChild(close);

  if (module.role === 'weapon') {
    const level = getAssemblyWeaponLevel(module.id);
    const cost = getAssemblyWeaponUpgradeCost(module.id);
    const canUpgrade = level < WEAPON_MAX_LEVEL
      && typeof bay.options.onUpgrade === 'function'
      && (typeof bay.options.canAffordUpgrade !== 'function' || bay.options.canAffordUpgrade(cost));
    const growth = makeText(
      `养成线  等级${level}/${WEAPON_MAX_LEVEL}  ·  下级伤害 +14% / 间隔 -3.5%`,
      10.5,
      module.color,
      '900',
    );
    growth.position.set(13, INVENTORY_DETAIL_HEIGHT - 68);
    drawer.addChild(growth);
    drawDetailAction(
      drawer,
      level >= WEAPON_MAX_LEVEL ? '已满级' : `强化  ● ${cost}`,
      382,
      INVENTORY_DETAIL_HEIGHT - 47,
      COLORS.amber,
      () => {
        if (bay.options.onUpgrade?.(module.id, cost) !== false) bay.draw();
      },
      canUpgrade,
    );
  }
  drawDetailAction(
    drawer,
    installedAt ? '已装备' : '装备',
    module.role === 'weapon' ? 244 : 382,
    INVENTORY_DETAIL_HEIGHT - 47,
    installedAt ? COLORS.green : module.color,
    () => bay.equipModule(module.id),
    !installedAt,
  );
  parent.addChild(drawer);
}

function drawInventoryPager(parent, bay, totalModules) {
  const pageCount = Math.max(1, Math.ceil(totalModules / INVENTORY_PAGE_SIZE));
  bay.inventoryPage = Math.max(0, Math.min(pageCount - 1, bay.inventoryPage));
  const y = INVENTORY_PAGER_Y;
  const addArrow = (label, x, direction, enabled) => {
    const button = new Container();
    button.position.set(x, y);
    button.eventMode = enabled ? 'static' : 'none';
    button.cursor = enabled ? 'pointer' : 'default';
    button.addChild(new Graphics()
      .roundRect(0, 0, 50, 22, 4)
      .fill({ color: 0x0a252e, alpha: enabled ? 0.95 : 0.42 })
      .roundRect(0, 0, 50, 22, 4)
      .stroke({ color: COLORS.cyan, width: 1, alpha: enabled ? 0.45 : 0.1 }));
    addCenteredText(button, label, 25, 11, 13, enabled ? COLORS.cyan : 0x41585c, '900');
    if (enabled) {
      button.on('pointertap', (event) => {
        event.stopPropagation();
        bay.inventoryPage += direction;
        bay.detailModuleId = null;
        bay.draw();
      });
    }
    parent.addChild(button);
  };
  addArrow('‹', 18, -1, bay.inventoryPage > 0);
  addArrow('›', DESIGN_WIDTH - 68, 1, bay.inventoryPage < pageCount - 1);
  addCenteredText(
    parent,
    `${bay.inventoryPage + 1} / ${pageCount}`,
    DESIGN_WIDTH / 2,
    y + 11,
    11,
    0x78989c,
    '800',
  );
}

function drawDragGhost(parent, bay) {
  if (!bay.drag) {
    bay.dragGhost = null;
    return;
  }
  const module = MODULE_MAP.get(bay.drag.moduleId);
  if (!module) return;
  const ghost = new Container();
  ghost.position.set(bay.drag.x, bay.drag.y);
  ghost.alpha = 0.92;
  ghost.eventMode = 'none';
  const body = new Graphics()
    .circle(0, 0, 29).fill({ color: 0x031219, alpha: 0.95 })
    .circle(0, 0, 27).stroke({ color: module.color, width: 2.5, alpha: 0.9 })
    .circle(0, 0, 20).fill({ color: module.color, alpha: 0.16 });
  ghost.addChild(body);
  addCenteredText(ghost, module.icon, 0, -1, 17, module.color, '900');
  parent.addChild(ghost);
  bay.dragGhost = ghost;
}

function drawAssemblyStatusPanels(parent, bay) {
  const passiveWeapons = getAssemblyPassiveWeapons().filter((weapon) => weapon.passiveEffect);
  const fixedModule = MODULE_MAP.get(assemblyState.mounts[bay.fixedSubcategory]);
  const fixedLabels = { wing: '外层刃环', engine: '中层核环', tail: '内层稳环' };
  const isWeaponBay = bay.inventoryCategory === 'weapon';
  const panels = isWeaponBay
    ? [{
      x: 14,
      color: passiveWeapons[0]?.color || COLORS.red,
      eyebrow: '自动火控',
      title: `${passiveWeapons.length}/3 被动挂载在线`,
      detail: passiveWeapons.length
        ? passiveWeapons.map((weapon) => `${weapon.shortName} ${weapon.level}级`).join(' · ')
        : '挂载后无需按键，战斗中自动触发',
    }]
    : [{
      x: 14,
      color: fixedModule?.color || COLORS.cyan,
      eyebrow: fixedLabels[bay.fixedSubcategory] || '环绕固定件',
      title: fixedModule?.name || '未安装固定件',
    }];
  for (const panel of panels) {
    const view = new Container();
    view.position.set(panel.x, 58);
    view.addChild(new Graphics()
      .roundRect(0, 0, 250, 48, 5)
      .fill({ color: 0x04171e, alpha: 0.86 })
      .roundRect(0, 0, 250, 48, 5)
      .stroke({ color: panel.color, width: 1, alpha: 0.34 })
      .roundRect(0, 0, 3, 48, 2)
      .fill({ color: panel.color, alpha: 0.82 }));
    const compact = !panel.detail;
    const eyebrow = makeText(panel.eyebrow, 10, panel.color, '900');
    eyebrow.position.set(10, compact ? 9 : 4);
    view.addChild(eyebrow);
    const title = makeText(panel.title, 11.5, COLORS.white, '900');
    title.position.set(10, compact ? 28 : 17);
    view.addChild(title);
    if (panel.detail) {
      const detail = fitTextWidth(makeText(panel.detail, 9.5, 0x8aabb0, '700'), 230, 8);
      detail.position.set(10, 34);
      view.addChild(detail);
    }
    parent.addChild(view);
  }
}

function drawBay(bay) {
  if (!bay.root || bay.destroyed) return;
  const removed = bay.root.removeChildren();
  for (const child of removed) child.destroy({ children: true });
  bay.aircraftVisual = null;

  const background = new Graphics()
    .rect(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT).fill({ color: COLORS.ink })
    .rect(0, 0, DESIGN_WIDTH, 48).fill({ color: 0x092631, alpha: 0.98 })
    .rect(0, INVENTORY_TOP, DESIGN_WIDTH, DESIGN_HEIGHT - INVENTORY_TOP)
    .fill({ color: 0x04171e, alpha: 0.98 })
    .moveTo(0, 48).lineTo(DESIGN_WIDTH, 48)
    .stroke({ color: COLORS.cyan, width: 1, alpha: 0.22 })
    .moveTo(0, INVENTORY_TOP).lineTo(DESIGN_WIDTH, INVENTORY_TOP)
    .stroke({ color: COLORS.cyan, width: 1.5, alpha: 0.28 });
  bay.root.addChild(background);
  drawGrid(bay.root);

  const isWeaponBay = bay.inventoryCategory === 'weapon';
  const title = makeText(isWeaponBay ? '武器挂载舱' : '飞机固定件槽位', 19, COLORS.white, '900');
  title.position.set(18, 10);
  bay.root.addChild(title);
  const power = makeText(`装配 ${Math.round(getAssemblyPower())}`, 14, COLORS.amber, '900');
  power.anchor.set(1, 0);
  power.position.set(DESIGN_WIDTH - 18, 15);
  bay.root.addChild(power);

  drawAssemblyStatusPanels(bay.root, bay);
  bay.aircraftVisual = drawAirframe(bay.root);
  // Wiring belongs above the airframe silhouette so active Buff routes remain
  // readable even where they cross the wing panels.
  if (bay.inventoryCategory === 'weapon') drawHardpointLinks(bay.root, bay);
  const visibleSlots = SLOTS.filter((slot) => (
    bay.inventoryCategory === 'fixed' ? slot.family === 'fixed' : slot.role === 'weapon'
  ));
  for (const slot of visibleSlots) drawSlot(bay.root, bay, slot);

  drawInventoryTabs(bay.root, bay);
  drawFixedSubcategoryTabs(bay.root, bay);
  const inventoryModules = modulesForInventoryCategory(
    bay.inventoryCategory,
    bay.fixedSubcategory,
  );
  const pageSize = INVENTORY_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(inventoryModules.length / pageSize));
  bay.inventoryPage = Math.max(0, Math.min(pageCount - 1, bay.inventoryPage));
  const detailModule = MODULE_MAP.get(bay.detailModuleId);
  if (detailModule && inventoryModules.includes(detailModule)) {
    drawModuleDetail(bay.root, bay, detailModule);
  } else {
    bay.detailModuleId = null;
    if (!inventoryModules.length) {
      const emptyTitle = makeText('暂无已获得武器', 17, COLORS.white, '900', 'center');
      emptyTitle.anchor.set(0.5);
      emptyTitle.position.set(DESIGN_WIDTH / 2, INVENTORY_CARD_TOP + 72);
      bay.root.addChild(emptyTitle);
      const emptyCopy = makeText('通关主线关卡可逐步获得挂载武器', 11, 0x739399, '700', 'center');
      emptyCopy.anchor.set(0.5);
      emptyCopy.position.set(DESIGN_WIDTH / 2, INVENTORY_CARD_TOP + 100);
      bay.root.addChild(emptyCopy);
    } else {
      inventoryModules
        .slice(bay.inventoryPage * pageSize, bay.inventoryPage * pageSize + pageSize)
        .forEach((module, index) => drawInventoryCard(bay.root, bay, module, index));
    }
    drawInventoryPager(bay.root, bay, inventoryModules.length);
  }
  drawDragGhost(bay.root, bay);
  bay.render();
}

function localPoint(bay, event) {
  if (!bay.root || !event?.global) return { x: 0, y: 0 };
  const point = bay.root.toLocal(event.global);
  return { x: point.x, y: point.y };
}

function nearestCompatibleSlot(moduleId, x, y) {
  const module = MODULE_MAP.get(moduleId);
  if (!module) return null;
  let best = null;
  let bestDistance = Infinity;
  for (const slot of SLOTS) {
    if (!isCompatible(slot, module)) continue;
    const distance = Math.hypot(x - slot.x, y - slot.y);
    const threshold = slot.radius + 17;
    if (distance <= threshold && distance < bestDistance) {
      best = slot;
      bestDistance = distance;
    }
  }
  return best;
}

function commitDrop(drag, x, y) {
  if (!availableModuleSet().has(drag.moduleId)) return false;
  const target = nearestCompatibleSlot(drag.moduleId, x, y);
  const fromSlotId = drag.fromSlot;
  if (target) {
    if (target.id === fromSlotId) return false;
    const targetModuleId = assemblyState.mounts[target.id];
    if (!fromSlotId) {
      assemblyState.mounts[target.id] = drag.moduleId;
      return true;
    }

    const sourceSlot = SLOT_MAP.get(fromSlotId);
    const targetModule = MODULE_MAP.get(targetModuleId);
    assemblyState.mounts[fromSlotId] = null;
    assemblyState.mounts[target.id] = drag.moduleId;
    if (targetModule && isCompatible(sourceSlot, targetModule)) {
      assemblyState.mounts[fromSlotId] = targetModule.id;
    }
    return true;
  }

  if (fromSlotId && y >= INVENTORY_TOP) {
    assemblyState.mounts[fromSlotId] = null;
    return true;
  }
  return false;
}

function equipModuleToPreferredSlot(moduleId) {
  if (!availableModuleSet().has(moduleId) || moduleSlot(moduleId)) return false;
  const module = MODULE_MAP.get(moduleId);
  if (!module) return false;
  const compatibleSlots = SLOTS.filter((slot) => isCompatible(slot, module));
  const target = compatibleSlots.find((slot) => !assemblyState.mounts[slot.id])
    || compatibleSlots[0];
  if (!target) return false;
  return commitDrop({ moduleId, fromSlot: null }, target.x, target.y);
}

function createBayController(host, options = {}) {
  const bay = {
    host,
    options,
    onChange: options.onChange,
    renderer: null,
    stage: null,
    root: null,
    resizeObserver: null,
    aircraftVisual: null,
    animationFrame: 0,
    orbitTime: 0,
    lastAnimationTime: 0,
    paused: false,
    destroyed: false,
    drag: null,
    pendingDrag: null,
    dragGhost: null,
    detailModuleId: null,
    inventoryCategory: INVENTORY_CATEGORY_MAP.has(options.inventoryCategory)
      ? options.inventoryCategory
      : 'fixed',
    fixedSubcategory: FIXED_SUBCATEGORY_MAP.has(options.fixedSubcategory)
      ? options.fixedSubcategory
      : 'wing',
    inventoryPage: 0,
    render() {
      if (typeof bay.options.requestRender === 'function') {
        bay.options.requestRender();
        return;
      }
      if (!bay.renderer || !bay.stage || bay.destroyed) return;
      bay.renderer.render({ container: bay.stage });
    },
    draw() {
      drawBay(bay);
    },
    animate(timestamp) {
      if (bay.destroyed || bay.paused) return;
      if (!bay.lastAnimationTime) bay.lastAnimationTime = timestamp;
      const elapsed = timestamp - bay.lastAnimationTime;
      // The assembly canvas has no other continuous effects, so a steady 30fps
      // orbit keeps motion smooth without rendering the whole panel needlessly.
      if (elapsed >= 30) {
        bay.orbitTime += Math.min(0.05, elapsed / 1000);
        bay.lastAnimationTime = timestamp;
        updateAssemblyAircraftVisual(bay.aircraftVisual, bay.orbitTime);
        bay.render();
      }
      bay.animationFrame = requestAnimationFrame(bay.animate);
    },
    pause() {
      if (bay.destroyed || bay.paused) return;
      bay.paused = true;
      if (bay.animationFrame && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(bay.animationFrame);
      }
      bay.animationFrame = 0;
      bay.lastAnimationTime = 0;
      bay.resizeObserver?.disconnect();
    },
    resume() {
      if (bay.destroyed || !bay.paused) return;
      bay.paused = false;
      bay.resize();
      if (bay.resizeObserver) bay.resizeObserver.observe(host);
      if (typeof requestAnimationFrame !== 'undefined' && !bay.animationFrame) {
        bay.animationFrame = requestAnimationFrame(bay.animate);
      }
    },
    resize() {
      if (!bay.renderer || !bay.stage || !bay.root || bay.destroyed) return;
      const rect = host.getBoundingClientRect?.() || {};
      const width = Math.max(1, Math.round(rect.width || host.clientWidth || DESIGN_WIDTH));
      const height = Math.max(
        1,
        Math.round(rect.height || host.clientHeight || width * DESIGN_HEIGHT / DESIGN_WIDTH),
      );
      bay.renderer.resize(width, height);
      const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
      bay.root.scale.set(scale);
      bay.root.position.set(
        (width - DESIGN_WIDTH * scale) / 2,
        (height - DESIGN_HEIGHT * scale) / 2,
      );
      bay.stage.hitArea = new Rectangle(0, 0, width, height);
      bay.render();
    },
    beginDrag(moduleId, fromSlot, event, tapOpensDetail = false) {
      if (bay.destroyed) return;
      const point = localPoint(bay, event);
      bay.detailModuleId = null;
      const interaction = {
        moduleId,
        fromSlot,
        pointerId: event.pointerId,
        x: point.x,
        y: point.y,
        startX: point.x,
        startY: point.y,
        moved: false,
        tapOpensDetail,
      };
      event.nativeEvent?.target?.setPointerCapture?.(event.pointerId);
      if (tapOpensDetail) {
        bay.pendingDrag = interaction;
        return;
      }
      bay.drag = interaction;
      bay.draw();
    },
    moveDrag(event) {
      if (bay.pendingDrag) {
        if (event.pointerId != null && bay.pendingDrag.pointerId !== event.pointerId) return;
        const point = localPoint(bay, event);
        if (Math.hypot(point.x - bay.pendingDrag.startX, point.y - bay.pendingDrag.startY) < 7) return;
        bay.drag = {
          ...bay.pendingDrag,
          x: point.x,
          y: point.y,
          moved: true,
        };
        bay.pendingDrag = null;
        bay.draw();
        return;
      }
      if (!bay.drag || (event.pointerId != null && bay.drag.pointerId !== event.pointerId)) return;
      const point = localPoint(bay, event);
      if (Math.hypot(point.x - bay.drag.startX, point.y - bay.drag.startY) >= 7) {
        bay.drag.moved = true;
      }
      bay.drag.x = point.x;
      bay.drag.y = point.y;
      bay.dragGhost?.position.set(point.x, point.y);
      bay.render();
    },
    finishDrag(event, cancelled = false) {
      if (bay.pendingDrag) {
        if (event.pointerId != null && bay.pendingDrag.pointerId !== event.pointerId) return;
        const pending = bay.pendingDrag;
        bay.pendingDrag = null;
        if (!cancelled) bay.detailModuleId = pending.moduleId;
        bay.draw();
        return;
      }
      if (!bay.drag || (event.pointerId != null && bay.drag.pointerId !== event.pointerId)) return;
      const drag = bay.drag;
      const point = localPoint(bay, event);
      bay.drag = null;
      bay.detailModuleId = null;
      if (!cancelled && drag.tapOpensDetail && !drag.moved) {
        bay.detailModuleId = drag.moduleId;
        bay.draw();
        return;
      }
      const changed = !cancelled && commitDrop(drag, point.x, point.y);
      if (changed) broadcastChange();
      else bay.draw();
    },
    handleEmbeddedPointer(global, phase = 'move', pointerId = 1) {
      // The embedded bay shares the main Pixi canvas.  Browser Pixi receives
      // its own FederatedPointerEvents, but WeChat supplies raw touch records
      // directly to the game.  Re-dispatch the small event subset the bay uses
      // so cards, tabs and drag/drop keep the same behaviour on both targets.
      if (bay.destroyed || !bay.stage || !global) return false;
      const event = {
        global,
        pointerId,
        nativeEvent: null,
        propagationStopped: false,
        stopPropagation() { this.propagationStopped = true; },
      };
      const contains = (node) => {
        if (!node?.visible || !node.renderable) return false;
        if (node.hitArea) {
          const point = node.toLocal(global);
          return node.hitArea.contains(point.x, point.y);
        }
        const bounds = node.getBounds?.();
        return Boolean(bounds && global.x >= bounds.x && global.x <= bounds.x + bounds.width
          && global.y >= bounds.y && global.y <= bounds.y + bounds.height);
      };
      const findTarget = (node) => {
        for (let index = (node.children?.length || 0) - 1; index >= 0; index -= 1) {
          const target = findTarget(node.children[index]);
          if (target) return target;
        }
        return node.eventMode === 'static' && contains(node) ? node : null;
      };
      if (phase === 'start') {
        bay.touchTarget = findTarget(bay.stage);
        bay.touchStart = global.clone();
        bay.touchMoved = false;
        bay.touchTarget?.emit('pointerdown', event);
        return true;
      }
      if (phase === 'move') {
        if (bay.touchStart && Math.hypot(global.x - bay.touchStart.x, global.y - bay.touchStart.y) >= 7) {
          bay.touchMoved = true;
        }
        bay.stage.emit('pointermove', event);
        return true;
      }
      if (phase === 'cancel') {
        bay.stage.emit('pointercancel', event);
      } else {
        const target = bay.touchTarget;
        if (!bay.touchMoved && target && contains(target)) target.emit('pointertap', event);
        bay.stage.emit('pointerup', event);
      }
      bay.touchTarget = null;
      bay.touchStart = null;
      bay.touchMoved = false;
      return true;
    },
    equipModule(moduleId) {
      if (bay.destroyed) return false;
      const changed = equipModuleToPreferredSlot(moduleId);
      if (changed) {
        bay.detailModuleId = moduleId;
        broadcastChange();
      } else {
        bay.draw();
      }
      return changed;
    },
    destroy() {
      if (bay.destroyed) return;
      bay.destroyed = true;
      mountedBays.delete(bay);
      if (bay.animationFrame && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(bay.animationFrame);
      }
      bay.animationFrame = 0;
      bay.resizeObserver?.disconnect();
      bay.resizeObserver = null;
      if (bay.stage) {
        bay.stage.removeAllListeners();
        bay.stage.destroy({ children: true });
      }
      const canvas = bay.renderer?.canvas;
      bay.renderer?.destroy();
      canvas?.remove();
      bay.renderer = null;
      bay.stage = null;
      bay.root = null;
      bay.aircraftVisual = null;
    },
  };
  return bay;
}

/**
 * Creates the same Pixi assembly bay used by the legacy HTML shell, but as an
 * embeddable display object for the shared Pixi lobby and non-DOM runtimes.
 */
export function createEmbeddedAssemblyBay(options = {}) {
  const bay = createBayController(null, options);
  mountedBays.add(bay);
  bay.stage = new Container();
  bay.stage.eventMode = 'static';
  bay.stage.hitArea = new Rectangle(0, 0, DESIGN_WIDTH, DESIGN_HEIGHT);
  bay.root = new Container();
  bay.stage.addChild(bay.root);
  bay.stage.on('pointermove', (event) => bay.moveDrag(event));
  bay.stage.on('pointerup', (event) => bay.finishDrag(event));
  bay.stage.on('pointerupoutside', (event) => bay.finishDrag(event));
  bay.stage.on('pointercancel', (event) => bay.finishDrag(event, true));
  bay.draw();
  if (typeof bay.onChange === 'function') bay.onChange(clone(createSummary()));
  if (typeof requestAnimationFrame !== 'undefined') {
    bay.animationFrame = requestAnimationFrame(bay.animate);
  }

  return {
    root: bay.stage,
    draw: () => bay.draw(),
    handlePointer: (global, phase, pointerId) => bay.handleEmbeddedPointer(global, phase, pointerId),
    update(deltaSeconds = 1 / 60) {
      if (bay.destroyed || bay.paused || !bay.aircraftVisual) return;
      bay.animationAccumulator = (bay.animationAccumulator || 0)
        + Math.max(0, Number(deltaSeconds) || 0);
      if (bay.animationAccumulator < 1 / 30) return;
      const step = Math.min(0.05, bay.animationAccumulator);
      bay.animationAccumulator = 0;
      bay.orbitTime += step;
      updateAssemblyAircraftVisual(bay.aircraftVisual, bay.orbitTime);
      bay.render();
    },
    destroy: () => bay.destroy(),
    get orbitTime() {
      return bay.orbitTime;
    },
  };
}

async function createRenderer() {
  const options = {
    manageImports: false,
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(
      typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1,
      2,
    ),
    backgroundColor: COLORS.ink,
    backgroundAlpha: 1,
  };
  const renderer = new WebGLRenderer();
  await renderer.init(options);
  return renderer;
}

/**
 * Mounts an isolated Three.js assembly canvas into `host`.
 *
 * The returned controller is synchronous and always has `destroy()`. Await its
 * `ready` promise when the caller needs the canvas to exist before continuing.
 */
export function mountAssemblyBay(host, options = {}) {
  if (!host || typeof host.appendChild !== 'function') {
    throw new TypeError('mountAssemblyBay(host) requires a DOM host element.');
  }
  const bay = createBayController(host, options);
  mountedBays.add(bay);

  bay.ready = (async () => {
    const renderer = await createRenderer();
    if (bay.destroyed) {
      renderer.destroy();
      return bay;
    }
    bay.renderer = renderer;
    const canvas = renderer.canvas;
    canvas.classList.add('assembly-bay-canvas');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.aspectRatio = `${DESIGN_WIDTH} / ${DESIGN_HEIGHT}`;
    canvas.style.touchAction = 'none';
    canvas.setAttribute('aria-label', '雷核飞机可视化装配舱');
    host.appendChild(canvas);

    bay.stage = new Container();
    bay.stage.eventMode = 'static';
    bay.root = new Container();
    bay.stage.addChild(bay.root);
    bay.stage.on('pointermove', (event) => bay.moveDrag(event));
    bay.stage.on('pointerup', (event) => bay.finishDrag(event));
    bay.stage.on('pointerupoutside', (event) => bay.finishDrag(event));
    bay.stage.on('pointercancel', (event) => bay.finishDrag(event, true));

    bay.draw();
    bay.resize();
    if (!bay.paused && typeof requestAnimationFrame !== 'undefined') {
      bay.animationFrame = requestAnimationFrame(bay.animate);
    }
    if (typeof ResizeObserver !== 'undefined') {
      bay.resizeObserver = new ResizeObserver(() => bay.resize());
      if (!bay.paused) bay.resizeObserver.observe(host);
    }
    if (typeof bay.onChange === 'function') bay.onChange(clone(createSummary()));
    return bay;
  })().catch((error) => {
    mountedBays.delete(bay);
    bay.destroyed = true;
    throw error;
  });

  return {
    ready: bay.ready,
    destroy: () => bay.destroy(),
    pause: () => bay.pause(),
    resume: () => bay.resume(),
    resize: () => bay.resize(),
    reset: () => resetAssembly(),
    get canvas() {
      return bay.renderer?.canvas || null;
    },
  };
}
