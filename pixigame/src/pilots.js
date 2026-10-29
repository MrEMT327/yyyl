import { isGameSessionCurrent } from './platform/game-session-runtime.js';
import { pilotAvatarIcon } from './pilot-avatar-icons.js';
import { DEFAULT_PREVIEW_PILOT_ID, TEMPORARY_PILOT_IDS } from './pilot-preview-access.js';

const PILOT_STORAGE_KEY = 'thunder-ssr-pilots-v1';
const RESONANCE_STATE_VERSION = 2;
const RESONANCE_DAMAGE_CAP = 0.18;
const RESONANCE_DAMAGE_CURVE = 24;

export const AIRCRAFT_RARITY_PRESENTATION = Object.freeze({
  R: Object.freeze({ label: 'R', color: '#d9e4e6' }),
  SR: Object.freeze({ label: 'SR', color: '#62cf83' }),
  SSR: Object.freeze({ label: 'SSR', color: '#758cff' }),
  UR: Object.freeze({ label: 'UR', color: '#ff78dc' }),
});

export const AIRCRAFTS = [
  {
    id: 'pilot-01',
    lobbyPortrait: 'orange-jetboard-v5',
    rarity: 'UR',
    name: '夜莺·零',
    callsign: 'NIGHTFALL-00',
    title: '相位夜莺',
    icon: '◒',
    color: '#9a7cff',
    accent: '#d7c8ff',
    image: './art/orange-jetboard-v5/portrait.png',
    avatar: pilotAvatarIcon('pilot-01'),
    portraitFocus: { x: 65, y: 12, zoom: 4.2 },
    aircraft: '幽幕式隐形截击机',
    skillName: '零域相位',
    description: '每5秒进入1.2秒相位状态，期间免疫伤害，并可穿越普通敌机和障碍物。',
    ability: {
      type: 'phase',
      interval: 5,
      duration: 1.2,
      ignoresNormalCollisions: true,
      respectsMapBounds: true,
    },
    airframe: {
      image: './art/aircraft-ui-v1/pilot-01.webp',
      nozzles: 1,
      marking: 'phase',
      profile: '相位三角翼',
      parts: [[0, -154, -14, -116, -61, -38, -35, -5, -17, 13, -10, 112, 0, 146, 10, 112, 17, 13, 35, -5, 61, -38, 14, -116]],
      cockpit: [0, -116, -9, -78, 0, -47, 9, -78],
      cores: [[0, 7, 4]],
    },
  },
  {
    id: 'pilot-02',
    lobbyPortrait: 'engineer-ee76',
    rarity: 'SSR',
    name: '青岚·芙蕾雅',
    callsign: 'VERDANT-FR',
    title: '生命航线',
    icon: '✚',
    color: '#55e7a8',
    accent: '#c7ffe7',
    image: './art/engineer-ee76/portrait-inner-hem-v5.png',
    avatar: pilotAvatarIcon('pilot-02'),
    portraitFocus: { x: 50, y: 8, zoom: 4.2 },
    aircraft: '翠环式纳米维修机',
    skillName: '春息回路',
    description: '每5秒恢复4%最大耐久；满耐久时获得持续5秒、上限为最大耐久12%的护盾。',
    ability: {
      type: 'heal',
      interval: 5,
      ratio: 0.04,
      fullHealthShieldRatio: 0.12,
      shieldDuration: 5,
      shieldStacks: false,
    },
    airframe: {
      image: './art/aircraft-ui-v1/pilot-02.webp',
      nozzles: 2,
      marking: 'repair',
      profile: '翠绿光环',
      parts: [[0, -139, -28, -99, -53, -54, -48, 29, -34, 89, -17, 132, 0, 151, 17, 132, 34, 89, 48, 29, 53, -54, 28, -99]],
      cockpit: [0, -107, -13, -73, 0, -35, 13, -73],
      cores: [[-24, 4, 5], [24, 4, 5]],
    },
  },
  {
    id: 'pilot-03',
    lobbyPortrait: 'commander-live2d-v1',
    rarity: 'SR',
    name: '绯雨·桃乐丝',
    callsign: 'ROSE-BARRAGE',
    title: '蔷薇弹雨',
    icon: '✺',
    color: '#ff6fae',
    accent: '#ffd0e5',
    image: './art/commander-live2d-v1/portrait-style-v9.png',
    avatar: pilotAvatarIcon('pilot-03'),
    portraitFocus: { x: 44, y: 6, zoom: 4.2 },
    aircraft: '蔷薇式近防强袭机',
    skillName: '绯色散华',
    description: '普通直射武器不足5条弹道时补足为5发扇形弹，每发造成24%攻击力伤害。',
    ability: {
      type: 'minimum-direct-shots',
      minimumShots: 5,
      spread: 0.157,
      damageRatio: 0.24,
      eligibleWeaponMechanisms: ['direct'],
    },
    airframe: {
      image: './art/aircraft-ui-v1/pilot-03.webp',
      nozzles: 3,
      marking: 'rose',
      profile: '蔷薇弹幕',
      parts: [[0, -146, -22, -104, -78, -33, -63, 4, -39, 17, -45, 91, -23, 132, 0, 144, 23, 132, 45, 91, 39, 17, 63, 4, 78, -33, 22, -104]],
      cockpit: [0, -111, -12, -70, 0, -38, 12, -70],
      cores: [[-19, 11, 4], [0, 5, 5], [19, 11, 4]],
    },
  },
  {
    id: 'pilot-04',
    lobbyPortrait: 'blue-ponytail-v15',
    rarity: 'SR',
    name: '苍弦·伊织',
    callsign: 'SIDEWINDER-I',
    title: '苍弦双翼',
    icon: '↞',
    color: '#54d9ff',
    accent: '#d1f7ff',
    image: './art/blue-ponytail-v15/portrait-reference-style-v1.png',
    avatar: pilotAvatarIcon('pilot-04'),
    portraitFocus: { x: 54, y: 7, zoom: 4.2 },
    aircraft: '弦月式侧卫战斗机',
    skillName: '天际横弦',
    description: '主炮射击时，同时向左右各发射一枚横向穿透弹。',
    ability: { type: 'side-shot', damage: 0.82 },
    airframe: {
      image: './art/aircraft-ui-v1/pilot-04.webp',
      nozzles: 2,
      marking: 'split',
      profile: '双生新月',
      parts: [
        [-7, -145, -26, -100, -62, -30, -49, 15, -28, 43, -23, 124, -8, 147, -1, 68, -1, -82],
        [7, -145, 26, -100, 62, -30, 49, 15, 28, 43, 23, 124, 8, 147, 1, 68, 1, -82],
        [-31, -11, 31, -11, 24, 24, -24, 24],
      ],
      cockpit: [0, -111, -8, -74, 0, -44, 8, -74],
      cores: [[-25, 21, 4], [25, 21, 4]],
    },
  },
  {
    id: 'pilot-05',
    lobbyPortrait: 'golden-yoga-v12',
    rarity: 'SSR',
    name: '星矛·卡莲',
    callsign: 'COMET-LANCE',
    title: '逐星枪骑',
    icon: '➤',
    color: '#ffc75f',
    accent: '#fff0b2',
    image: './art/golden-yoga-v12/portrait-reference-style-v1.png',
    avatar: pilotAvatarIcon('pilot-05'),
    portraitFocus: { x: 51, y: 7, zoom: 4.2 },
    aircraft: '彗矛式导弹截击机',
    skillName: '彗星齐射',
    description: '每 4 秒锁定目标发射 3 枚追踪微导弹，命中产生范围爆炸。',
    ability: {
      type: 'missile',
      interval: 4,
      count: 3,
      damage: 13,
      explosionRadius: 72,
      targetPriority: 'nearest',
    },
    airframe: {
      image: './art/aircraft-ui-v1/pilot-05.webp',
      nozzles: 2,
      marking: 'comet',
      profile: '彗星长矛',
      parts: [
        [0, -165, -13, -123, -25, -74, -64, -13, -28, 9, -16, 127, 0, 153, 16, 127, 28, 9, 64, -13, 25, -74, 13, -123],
        [-62, -18, -81, 5, -68, 72, -48, 63, -42, 1],
        [62, -18, 81, 5, 68, 72, 48, 63, 42, 1],
      ],
      cockpit: [0, -125, -9, -79, 0, -44, 9, -79],
      cores: [[-57, 20, 4], [57, 20, 4]],
    },
  },
  {
    id: 'pilot-06',
    lobbyPortrait: 'pilot-06',
    rarity: 'SSR',
    name: '赤瞳·维拉',
    callsign: 'RED-EYE',
    title: '弱点猎手',
    icon: '⌾',
    color: '#ff625f',
    accent: '#ffd2c7',
    image: './assets/pilots/v3/pilot-06.webp',
    avatar: pilotAvatarIcon('pilot-06'),
    portraitFocus: { x: 45, y: 4, zoom: 4.2 },
    aircraft: '赤隼式轨道狙击机',
    skillName: '致命校准',
    description: '永久获得 +25% 暴击率与 +35% 暴击伤害。',
    ability: {
      type: 'critical',
      chance: 0.25,
      multiplier: 0.35,
      globalChanceCap: 0.75,
    },
    airframe: {
      image: './art/aircraft-ui-v1/pilot-06.webp',
      nozzles: 1,
      marking: 'scope',
      profile: '赤红磁轨',
      parts: [
        [0, -170, -10, -119, -20, -62, -28, 18, -19, 119, 0, 151, 19, 119, 28, 18, 20, -62, 10, -119],
        [-18, -81, -34, -67, -57, 80, -35, 100, -24, 28],
        [18, -81, 34, -67, 57, 80, 35, 100, 24, 28],
      ],
      cockpit: [0, -124, -8, -83, 0, -49, 8, -83],
      cores: [[-31, -15, 4], [31, -15, 4]],
    },
  },
  {
    id: 'pilot-07',
    lobbyPortrait: 'luna-maid-v1',
    rarity: 'R',
    name: '双子·露娜',
    callsign: 'GEMINI-L',
    title: '双核共鸣',
    icon: 'Ⅱ',
    color: '#6796ff',
    accent: '#d9e3ff',
    image: './art/luna-maid-v1/portrait.png',
    avatar: pilotAvatarIcon('pilot-07'),
    portraitFocus: { x: 62, y: 16, zoom: 4.2 },
    aircraft: '双生式并联战斗机',
    skillName: '双星同轨',
    description: '普通直射武器不足2条弹道时补足为2条平行弹道，每发造成55%攻击力伤害。',
    ability: {
      type: 'minimum-direct-shots',
      minimumShots: 2,
      spread: 0.025,
      damageRatio: 0.55,
      eligibleWeaponMechanisms: ['direct'],
    },
    airframe: {
      image: './art/aircraft-ui-v1/pilot-07.webp',
      nozzles: 2,
      marking: 'twin',
      profile: '双子联动',
      parts: [
        [-24, -145, -40, -101, -50, 5, -39, 126, -24, 148, -10, 123, -8, 4, -14, -99],
        [24, -145, 40, -101, 50, 5, 39, 126, 24, 148, 10, 123, 8, 4, 14, -99],
        [-32, -12, 32, -12, 37, 23, -37, 23],
      ],
      cockpit: [-24, -108, -32, -72, -24, -42, -16, -72],
      cockpitAlt: [24, -108, 16, -72, 24, -42, 32, -72],
      cores: [[-24, 12, 5], [24, 12, 5]],
    },
  },
  {
    id: 'pilot-08',
    rarity: 'R',
    name: '三曜·诺娅',
    callsign: 'TRINITY-N',
    title: '三曜裁定',
    icon: 'Ⅲ',
    color: '#d7c8ff',
    accent: '#ffffff',
    image: './art/violet-astra-v31/portrait.png',
    avatar: pilotAvatarIcon('pilot-08'),
    lobbyPortrait: 'violet-astra-v31',
    portraitFocus: { x: 43, y: 16, zoom: 4.2 },
    aircraft: '三曜式晶核战斗机',
    skillName: '三相火控',
    description: '普通直射武器不足3条弹道时补足为3条弹道，每发造成38%攻击力伤害。',
    ability: {
      type: 'minimum-direct-shots',
      minimumShots: 3,
      spread: 0.052,
      damageRatio: 0.38,
      eligibleWeaponMechanisms: ['direct'],
    },
    airframe: {
      image: './art/aircraft-ui-v1/pilot-08.webp',
      nozzles: 3,
      marking: 'trinity',
      profile: '三相棱镜',
      parts: [
        [0, -159, -15, -111, -22, 118, 0, 151, 22, 118, 15, -111],
        [-39, -129, -55, -87, -65, 78, -43, 127, -29, 79, -25, -88],
        [39, -129, 55, -87, 65, 78, 43, 127, 29, 79, 25, -88],
        [-49, -6, 49, -6, 38, 26, -38, 26],
      ],
      cockpit: [0, -116, -9, -76, 0, -39, 9, -76],
      cores: [[-42, 20, 4], [0, 9, 5], [42, 20, 4]],
    },
  },
  {
    id: 'pilot-09',
    lobbyPortrait: 'purple-doctor-v1',
    rarity: 'SR',
    name: '四象·凛',
    callsign: 'QUADRA-R',
    title: '四象全开',
    icon: 'Ⅳ',
    color: '#ff9866',
    accent: '#ffe1c7',
    image: './art/purple-doctor-v1/portrait.png',
    avatar: pilotAvatarIcon('pilot-09'),
    portraitFocus: { x: 46, y: 9, zoom: 4.2 },
    aircraft: '四象式重装攻击机',
    skillName: '四门齐奏',
    description: '普通直射武器不足4条弹道时补足为4条弹道，每发造成29%攻击力伤害。',
    ability: {
      type: 'minimum-direct-shots',
      minimumShots: 4,
      spread: 0.064,
      damageRatio: 0.29,
      eligibleWeaponMechanisms: ['direct'],
    },
    airframe: {
      image: './art/aircraft-ui-v1/pilot-09.webp',
      nozzles: 4,
      marking: 'quad',
      profile: '四翼堡垒',
      parts: [
        [0, -139, -27, -101, -88, -48, -76, 26, -55, 49, -51, 117, -29, 143, 0, 124, 29, 143, 51, 117, 55, 49, 76, 26, 88, -48, 27, -101],
        [-79, -21, -96, 7, -88, 92, -64, 110, -60, 16],
        [79, -21, 96, 7, 88, 92, 64, 110, 60, 16],
      ],
      cockpit: [0, -105, -14, -69, 0, -35, 14, -69],
      cores: [[-57, 18, 4], [-19, 10, 4], [19, 10, 4], [57, 18, 4]],
    },
  },
  {
    id: 'pilot-10',
    lobbyPortrait: 'white-gold-knight',
    rarity: 'UR',
    name: '圣盾·米迦',
    callsign: 'AEGIS-M',
    title: '光环守望',
    icon: '⬡',
    color: '#ffe47a',
    accent: '#fffbd0',
    image: './assets/pilots/v3/pilot-10.webp',
    avatar: pilotAvatarIcon('pilot-10'),
    portraitFocus: { x: 49, y: 12, zoom: 4.2 },
    aircraft: '圣环式护卫战斗机',
    skillName: '天穹圣域',
    description: '每 7 秒展开护盾脉冲，清除近身弹幕并获得 1 次伤害免疫。',
    ability: {
      type: 'sanctuary',
      interval: 7,
      radius: 300,
      immunityCharges: 1,
      maxStoredCharges: 1,
    },
    airframe: {
      image: './art/aircraft-ui-v1/pilot-10.webp',
      nozzles: 2,
      marking: 'aegis',
      profile: '神盾光环',
      parts: [
        [0, -153, -32, -109, -73, -43, -57, 50, -28, 114, 0, 148, 28, 114, 57, 50, 73, -43, 32, -109],
        [-70, -23, -91, 11, -73, 85, -52, 103, -43, 24],
        [70, -23, 91, 11, 73, 85, 52, 103, 43, 24],
      ],
      cockpit: [0, -113, -12, -75, 0, -39, 12, -75],
      cores: [[0, 12, 7]],
      halo: { x: 0, y: 16, radius: 54 },
    },
  },
];

export const AIRCRAFT_MAP = new Map(AIRCRAFTS.map((pilot) => [pilot.id, pilot]));
export const AIRCRAFT_CALLSIGN_MAP = new Map(AIRCRAFTS.map((pilot) => [pilot.callsign, pilot]));
export const PILOT_RARITY_ORDER = Object.freeze(['R', 'SR', 'SSR', 'UR']);
export const PILOTS_BY_RARITY = Object.freeze([...AIRCRAFTS].sort(
  (left, right) => PILOT_RARITY_ORDER.indexOf(left.rarity)
    - PILOT_RARITY_ORDER.indexOf(right.rarity),
));

// Compatibility aliases retained for older integrations.
export const SSR_PILOTS = AIRCRAFTS;
export const SSR_PILOT_MAP = AIRCRAFT_MAP;

export function resonanceDamageBonus(resonance = 0) {
  const level = Math.max(0, Math.floor(Number(resonance) || 0));
  return RESONANCE_DAMAGE_CAP * (1 - Math.exp(-level / RESONANCE_DAMAGE_CURVE));
}

export function resonanceDamageMultiplier(resonance = 0) {
  return 1 + resonanceDamageBonus(resonance);
}

function createDefaultPilotState() {
  return {
    selected: AIRCRAFTS[0].id,
    owned: [AIRCRAFTS[0].id],
    resonance: { [AIRCRAFTS[0].id]: 0 },
    resonanceVersion: RESONANCE_STATE_VERSION,
    totalPulls: 0,
    tenPulls: 0,
  };
}

function loadPilotState() {
  const fallback = createDefaultPilotState();
  try {
    const parsed = JSON.parse(localStorage.getItem(PILOT_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return fallback;
    const owned = [...new Set([
      ...fallback.owned,
      ...(Array.isArray(parsed.owned) ? parsed.owned : []),
    ])].filter((id) => AIRCRAFT_MAP.has(id));
    const legacyResonance = Number(parsed.resonanceVersion || 0) < RESONANCE_STATE_VERSION;
    const resonance = Object.fromEntries(
      Object.entries(parsed.resonance || {})
        .filter(([pilotId]) => AIRCRAFT_MAP.has(pilotId))
        .map(([pilotId, value]) => {
          const level = Math.max(0, Math.floor(Number(value) || 0));
          // v1 used +30 per duplicate. Convert those stored values once so
          // existing collections keep their original duplicate count.
          return [pilotId, legacyResonance ? Math.floor(level / 30) : level];
        }),
    );
    return {
      ...fallback,
      ...parsed,
      selected: owned.includes(parsed.selected) ? parsed.selected : fallback.selected,
      owned,
      resonance: { ...fallback.resonance, ...resonance },
      resonanceVersion: RESONANCE_STATE_VERSION,
      totalPulls: Math.max(0, Math.floor(Number(parsed.totalPulls) || 0)),
      tenPulls: Math.max(0, Math.floor(Number(parsed.tenPulls) || 0)),
    };
  } catch {
    return fallback;
  }
}

let pilotState = loadPilotState();
const requestedPreviewPilot = globalThis.location?.search
  ? new URLSearchParams(globalThis.location.search).get('preview-pilot') : null;
let sessionPilotId = TEMPORARY_PILOT_IDS.includes(requestedPreviewPilot)
  ? requestedPreviewPilot : DEFAULT_PREVIEW_PILOT_ID;

function savePilotState() {
  if (!isGameSessionCurrent()) return false;
  // Ownership is already committed in memory. A full/blocked storage must not
  // interrupt a multi-character grant halfway through; callers can surface the
  // failed persistence separately. Keep serialization and game logic outside
  // this boundary so their errors are not mistaken for unavailable storage.
  const serialized = JSON.stringify(pilotState);
  try {
    const storage = globalThis.localStorage;
    if (!storage) return false;
    storage.setItem(PILOT_STORAGE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

function randomPilot(excluded = []) {
  const excludedSet = new Set(excluded);
  const pool = AIRCRAFTS.filter((pilot) => !excludedSet.has(pilot.id));
  return pool[Math.floor(Math.random() * pool.length)] || AIRCRAFTS[0];
}

export function getPilotState() {
  return {
    ...pilotState,
    selected: sessionPilotId || pilotState.selected,
    persistentSelected: pilotState.selected,
    temporaryUnlocked: [...TEMPORARY_PILOT_IDS],
    owned: [...pilotState.owned],
    resonance: { ...pilotState.resonance },
  };
}

export function getActivePilot() {
  return AIRCRAFT_MAP.get(sessionPilotId || pilotState.selected) || AIRCRAFTS[0];
}

export function isPilotOwned(id) {
  return pilotState.owned.includes(id);
}

export function selectPilot(id) {
  if (!AIRCRAFT_MAP.has(id) || (!isPilotOwned(id) && !TEMPORARY_PILOT_IDS.includes(id))) return false;
  sessionPilotId = id;
  // Preview selection leaves the user's saved character and ownership intact.
  if (TEMPORARY_PILOT_IDS.includes(id)) return true;
  pilotState.selected = id;
  savePilotState();
  return true;
}

export function summonPilots(count = 1) {
  const pullCount = count >= 10 ? 10 : 1;
  const unownedBefore = AIRCRAFTS.filter((pilot) => !pilotState.owned.includes(pilot.id));
  const results = Array.from({ length: pullCount }, () => randomPilot());
  if (pullCount === 10 && unownedBefore.length && results.every((pilot) => pilotState.owned.includes(pilot.id))) {
    results[results.length - 1] = unownedBefore[Math.floor(Math.random() * unownedBefore.length)];
  }
  const receipts = results.map((pilot) => {
    const isNew = !pilotState.owned.includes(pilot.id);
    if (isNew) pilotState.owned.push(pilot.id);
    else pilotState.resonance[pilot.id] = (pilotState.resonance[pilot.id] || 0) + 1;
    return {
      pilot,
      isNew,
      resonance: pilotState.resonance[pilot.id] || 0,
    };
  });
  pilotState.totalPulls += pullCount;
  if (pullCount === 10) pilotState.tenPulls += 1;
  savePilotState();
  return receipts;
}

export function grantPilotCopies(pilotId, count = 1) {
  const pilot = AIRCRAFT_MAP.get(pilotId);
  if (!pilot) return [];
  const copyCount = Math.max(1, Math.floor(Number(count) || 1));
  const receipts = [];
  for (let index = 0; index < copyCount; index += 1) {
    const isNew = !pilotState.owned.includes(pilot.id);
    if (isNew) pilotState.owned.push(pilot.id);
    else pilotState.resonance[pilot.id] = (pilotState.resonance[pilot.id] || 0) + 1;
    receipts.push({
      pilot,
      isNew,
      resonance: pilotState.resonance[pilot.id] || 0,
    });
  }
  const storagePersisted = savePilotState();
  for (const receipt of receipts) receipt.storagePersisted = storagePersisted;
  return receipts;
}

export function pilotCardMarkup(pilot, {
  compact = false,
  reveal = false,
  showStatus = true,
  interactive = false,
  rarity = null,
  rarityColor = null,
} = {}) {
  const displayRarity = rarity || pilot.rarity || 'R';
  const displayRarityColor = rarityColor
    || AIRCRAFT_RARITY_PRESENTATION[displayRarity]?.color
    || AIRCRAFT_RARITY_PRESENTATION.R.color;
  const owned = isPilotOwned(pilot.id);
  const selected = pilotState.selected === pilot.id;
  const resonance = pilotState.resonance[pilot.id] || 0;
  const resonanceBonus = Math.round(resonanceDamageBonus(resonance) * 100);
  const classNames = [
    'pilot-card',
    compact ? 'compact' : '',
    reveal ? 'reveal' : '',
    interactive ? 'interactive' : '',
    owned ? 'owned' : 'locked',
    selected ? 'selected' : '',
  ].filter(Boolean).join(' ');
  return `
    <article class="${classNames}" data-pilot-id="${pilot.id}"${interactive ? ` role="button" tabindex="0" aria-label="查看${pilot.name}完整档案"` : ''} style="--pilot-color:${pilot.color};--pilot-accent:${pilot.accent};--pilot-rarity-color:${displayRarityColor}">
      <div class="pilot-card-frame">
        <div class="pilot-card-art">
          <img src="${pilot.image}" alt="${pilot.name}与${pilot.aircraft}" loading="${reveal ? 'eager' : 'lazy'}" />
          <i class="pilot-card-shine" aria-hidden="true"></i>
          <span class="pilot-card-rarity">${displayRarity}</span>
          <span class="pilot-card-code">${pilot.aircraft}</span>
          ${owned ? `<span class="pilot-card-resonance">R${resonance}</span>` : ''}
        </div>
        <div class="pilot-card-copy">
          <small>${pilot.title}</small>
          <strong>${pilot.name}</strong>
          <b><i>${pilot.icon}</i>${pilot.skillName}</b>
          <p>${pilot.description}</p>
          ${showStatus ? `<em>${selected ? '当前出击' : owned ? `共鸣 ${resonance} · 攻击 +${resonanceBonus}%` : '尚未获得'}</em>` : ''}
        </div>
      </div>
    </article>
  `;
}
