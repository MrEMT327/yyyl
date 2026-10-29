import {ADVANCED_CHAPTERS} from '../advanced-chapters.js';
import {chapterMapRepresentativeStage} from '../replica/chapter-map-reuse.js';
// Original generated terrain. APK artwork remains design evidence under doc.
const base = import.meta.env?.BASE_URL || '/';
// New chapters reuse quiet original depth textures, not flattened chapter art.
const expandedDepth = {
  'frozen-rift': 'coast', 'storm-front': 'space', 'iron-dock': 'ruins',
  'red-nest': 'coast', 'sky-core': 'space',
  'sand-ruins': 'ruins', 'emerald-rainforest': 'sewer', 'neon-city': 'ruins',
  'white-salt-lake': 'coast', 'obsidian-wastes': 'ruins', 'sunken-city': 'coast',
  'orbital-wreckage': 'space', 'lunar-outpost': 'ruins',
  'ring-spaceport': 'space', 'terraced-highlands': 'coast',
  'lunar-ring-station': 'ruins', 'lunar-crater-field': 'ruins', 'lunar-research-camp': 'ruins',
};
export const PERIPHERAL_SCENES = Object.freeze([
  Object.freeze({ id: 'coast', name: '蔚蓝海岸', artUrl: `${base}art/peripheral-v1/canyon-coast-walls-v2.webp`, depthUrl: `${base}art/peripheral-v1/canyon-coast-depth-v2.webp`, foregroundUrl: `${base}art/peripheral-v1/foreground-coast.webp`, ground: 0x123a51, edge: 0x407862, accent: 0x65bdca, mist: 0x729db1 }),
  Object.freeze({ id: 'ruins', name: '失落都市', artUrl: `${base}art/peripheral-v1/canyon-ruins-walls-v2.webp`, depthUrl: `${base}art/peripheral-v1/canyon-ruins-depth-v2.webp`, foregroundUrl: `${base}art/peripheral-v1/foreground-ruins.webp`, ground: 0x273d49, edge: 0x697688, accent: 0x7199c2, mist: 0x718896 }),
  Object.freeze({ id: 'volcano', name: '熔火禁区', artUrl: `${base}art/peripheral-v1/canyon-volcano-walls-v2.webp`, depthUrl: `${base}art/peripheral-v1/canyon-volcano-depth-v2.webp`, foregroundUrl: `${base}art/peripheral-v1/foreground-volcano.webp`, ground: 0x302b32, edge: 0x775057, accent: 0xda885b, mist: 0x796b73 }),
  Object.freeze({ id: 'sewer', name: '地下暗渠', artUrl: `${base}art/peripheral-v1/canyon-sewer-walls-v2.webp`, depthUrl: `${base}art/peripheral-v1/canyon-sewer-depth-v2.webp`, ground: 0x182e28, edge: 0x536653, accent: 0x8bad65, mist: 0x556955 }),
  Object.freeze({ id: 'space', name: '星际深空', artUrl: `${base}art/peripheral-v1/canyon-space-walls-v2.webp`, depthUrl: `${base}art/peripheral-v1/canyon-space-depth-v2.webp`, ground: 0x101327, edge: 0x424465, accent: 0x9a8fd4, mist: 0x373657, foregroundOpacity: 0 }),
  ...ADVANCED_CHAPTERS.map(chapter => Object.freeze({
    id: chapter.id, name: chapter.name,
    artUrl: `${base}art/chapters-v1/${chapter.battleImage}`,
    ground: 0x101c2c, edge: chapter.color, accent: chapter.accent,
    mist: chapter.color, foregroundOpacity: 0, singleLayer: true,
    ...(expandedDepth[chapter.id] ? {
      artUrl: `${base}art/peripheral-v1/${chapter.id === 'red-nest' ? 'verdant-valley-walls-v2' : `${chapter.id}-walls-v1`}.png`,
      depthUrl: chapter.id === 'lunar-outpost'
        ? `${base}art/peripheral-v1/obsidian-wastes-depth-v1.png`
        : ['sand-ruins', 'obsidian-wastes'].includes(chapter.id)
        ? `${base}art/peripheral-v1/${chapter.id}-depth-v1.png`
        : `${base}art/peripheral-v1/canyon-${expandedDepth[chapter.id]}-depth-v2.webp`,
      singleLayer: false,
    } : {}),
  })),
  ...[['lunar-ring-station','月环工站'],['lunar-crater-field','月海陨坑'],['lunar-research-camp','月面科研营']].map(([id,name])=>Object.freeze({
    id, name, artUrl:`${base}art/peripheral-v1/${id}-walls-v1.png`,
    depthUrl:`${base}art/peripheral-v1/obsidian-wastes-depth-v1.png`,
    ground:0x30343f,edge:0x788491,accent:0x8ca4bb,mist:0x727c8b,
    foregroundOpacity:0,singleLayer:false,
  })),
]);

// B0758 / s_map0006_2 supplies the 0.8 : 2 : 4 speed relationship and
// -1000 / -60 / -30 simulated distances. We map these to real Three.js Y
// depths; the APK uses sprite sorting, not three physically separated planes.
// Speeds are scaled to our world units.
// Its lateral movement uses distance/(100+distance)*moveScale. Keep that
// relationship: the source's middle layer shifts more than its foreground.
export const PERIPHERAL_LAYERS = Object.freeze([
  Object.freeze({ id: 'far', name: '深处谷底', source: 'depth', depth: -1000, speed: 8, width: 1600, length: 6000, moveScale: 0, sourceWidth: 1, opacity: 1 }),
  Object.freeze({ id: 'middle', name: '高处崖壁', source: 'ground', depth: -60, speed: 20, width: 800, length: 6000, moveScale: -1, sourceWidth: 1, opacity: 1, opening: [.08, .20] }),
  Object.freeze({ id: 'near', name: '近景云雾', source: 'foreground', depth: -30, speed: 40, width: 760, length: 6000, moveScale: -.5, sourceWidth: 1, opacity: .20, opening: [.24, .37] }),
]);

// Chapter 1 owns five independent strips. Native indices refer to s_map0017_2,
// not drawing order: the cloud strip (5) is the fastest, water (1) the slowest.
export const COAST_LAYERS = Object.freeze([
  { id: 'coast-water', role: 'background', name: '后景·海水', source: 'depth', kind: 0, nativeLayer: 1, depth: -1000, speed: 7, opacity: 1 },
  { id: 'coast-islands', role: 'midground', name: '中景·岛礁', source: 'islands', kind: 2, nativeLayer: 3, depth: -100, speed: 17, opacity: .92, fullAlpha: true },
  { id: 'coast-walls', role: 'foreground', name: '前景·崖壁', source: 'ground', kind: 1, nativeLayer: 2, depth: -60, speed: 20, opacity: 1, opening: [.20, .32] },
  { id: 'coast-effects', role: 'effects', name: '效果·水纹', source: 'effects', kind: 3, nativeLayer: 0, depth: -30, speed: 40, opacity: .035 },
  { id: 'coast-cloud', role: 'cloud', name: '柔边薄雾', source: 'cloud', kind: 2, nativeLayer: 5, depth: -10, speed: 120, opacity: .50, fullAlpha: true },
].map(layer => Object.freeze({ width: 760, length: 6000, sourceWidth: 1, moveScale: 0, opening: [0, .01], ...layer, sceneId: 'coast' })));

export const COAST_EXTRA_URLS = Object.freeze({
  islands: `${base}art/peripheral-v1/coast-islands-v4.png`,
  cloud: `${base}art/peripheral-v1/coast-fog-v6.png`,
});

// Five visual roles are shared; native layer IDs differ between chapters.
// These mappings are presentation only and never change encounters/collisions.
const chapterStyles = [
  { id: 'ruins', native: [5, 3, 2, 0, 7], names: ['城市谷底', '残楼平台', '废墟高墙', '浮尘', '灰雾'], effect: 1, effectOpacity: .06, cloudTint: 0xaab4bd },
  { id: 'volcano', native: [1, 3, 2, 0, 5], names: ['熔岩谷底', '玄武岩岛', '火山峭壁', '余烬', '烟尘'], effect: 2, effectOpacity: .10, cloudTint: 0x9c8990 },
  { id: 'sewer', native: [3, 4, 2, 1, 0], names: ['暗渠水面', '检修平台', '管道侧墙', '水纹', '水汽'], effect: 0, effectOpacity: .035, cloudTint: 0x9aaf9e },
  { id: 'space', native: [5, 3, 2, 0, 7], names: ['深空星海', '陨石残骸', '轨道设施', '星尘', '星云'], effect: 3, effectOpacity: .09, cloudTint: 0xa494c7 },
  { id: 'frozen-rift', native: [0, 1, 1, 0, 1], names: ['冰谷深处', '冰桥', '冰壁', '冰晶', '寒雾'], effect: 1, effectOpacity: .05, cloudTint: 0xc0d9e8 },
  { id: 'storm-front', native: [2, 5, 4, 3, 3], names: ['暗色天幕', '气象残骸', '雷云边缘', '微尘', '高空云'], effect: 3, effectOpacity: .04, cloudTint: 0x959bbf },
  { id: 'iron-dock', native: [2, 1, 0, 1, 0], names: ['船坞水面', '吊装桥', '船坞侧墙', '浮尘', '海雾'], effect: 1, effectOpacity: .04, cloudTint: 0xa5b4b8 },
  { id: 'red-nest', native: [2, 5, 7, 1, 0], names: ['谷底水面', '藤蔓石桥', '藤谷岩壁', '浮尘', '山谷薄雾'], effect: 1, effectOpacity: .04, cloudTint: 0xb3c8b4 },
  { id: 'sky-core', native: [2, 1, 0, 1, 0], names: ['天穹深空', '设施连廊', '核心侧翼', '星尘', '高空薄雾'], effect: 3, effectOpacity: .04, cloudTint: 0xb9c8df },
  { id: 'sand-ruins', native: [5, 4, 2, 0, 7], names: ['沙地谷底', '砂岩石桥', '遗迹侧壁', '沙尘', '薄沙雾'], effect: 1, effectOpacity: .035, cloudTint: 0xd4bd95 },
  { id: 'emerald-rainforest', native: [2, 5, 6, 7, 3], names: ['林间水面', '木藤吊桥', '雨林树岸', '浮尘', '林间水汽'], effect: 1, effectOpacity: .025, cloudTint: 0xa2bfab },
  { id: 'neon-city', native: [2, 5, 6, 1, 3], names: ['夜色街区', '高架连廊', '都市楼群', '微尘', '夜间薄雾'], effect: 1, effectOpacity: .025, cloudTint: 0x8c9ebd },
  { id: 'white-salt-lake', native: [1, 3, 2, 0, 5], names: ['盐湖水面', '盐岩浅滩', '白岩侧岸', '水纹', '湖面薄雾'], effect: 0, effectOpacity: .025, cloudTint: 0xc4d8e2 },
  { id: 'obsidian-wastes', native: [2, 3, 1, 0, 0], names: ['玄武岩地表', '断裂岩桥', '黑曜岩壁', '浮尘', '荒原灰雾'], effect: 1, effectOpacity: .035, cloudTint: 0x9b9fa9 },
  { id: 'sunken-city', native: [3, 4, 2, 1, 0], names: ['古城水域', '古城残桥', '水蚀廊柱', '水纹', '青色水汽'], effect: 0, effectOpacity: .03, cloudTint: 0x9bbfbd },
  { id: 'orbital-wreckage', native: [2, 1, 0, 1, 0], names: ['暗域深空', '轨道残骸', '破损星舰', '星尘', '淡紫星雾'], effect: 3, effectOpacity: .035, cloudTint: 0x9298bd },
  { id: 'lunar-outpost', native: [2, 1, 0, 1, 0], names: ['月面谷底', '哨站连桥', '月岩侧岸', '微尘', '稀薄尘雾'], effect: 1, effectOpacity: .025, cloudTint: 0xb4bdcc },
  { id: 'ring-spaceport', native: [7, 3, 2, 1, 5], names: ['星港深空', '站内廊桥', '星港舷壁', '星尘', '高空薄雾'], effect: 3, effectOpacity: .025, cloudTint: 0xa5bdd3 },
  { id: 'terraced-highlands', native: [5, 6, 1, 0, 0], names: ['遗迹谷底', '苔石残桥', '绿地石壁', '微尘', '山谷薄雾'], effect: 1, effectOpacity: .025, cloudTint: 0xa9bba4 },
  // Missing s_map0004 prefabs in the captured APK: these are authored visual
  // motions, NOT reconstructed native layer indices or collision geometry.
  { id:'lunar-ring-station', native:[null,null,null,null,null], authoredMotion:true, names:['月面地表','工站断桥','环形舷壁','月尘','稀薄尘雾'],effect:1,effectOpacity:.025,cloudTint:0xaabcca },
  { id:'lunar-crater-field', native:[null,null,null,null,null], authoredMotion:true, names:['月海地表','浅坑遗迹','陨坑边壁','月尘','稀薄尘雾'],effect:1,effectOpacity:.025,cloudTint:0xb2adc5 },
  { id:'lunar-research-camp', native:[null,null,null,null,null], authoredMotion:true, names:['月壤地表','实验站连桥','研究营地','月尘','稀薄尘雾'],effect:1,effectOpacity:.025,cloudTint:0xa8b8cc },
];
// Balanced art is selected only by chapters 1–20. Later map reuse keeps its original art.
export const FIRST_STAGE_SCENE = Object.freeze({
  ...PERIPHERAL_SCENES[0], id: 'coast-balanced',
  artUrl: `${base}art/project-coast-balanced-v1/middle-coast.png`,
  depthUrl: `${base}art/project-coast-balanced-v1/far-water-soft.png`,
});
const FIRST_STAGE_LAYERS = Object.freeze(COAST_LAYERS.map(layer => Object.freeze({
  ...layer, id: `coast-balanced-${layer.role}`, sceneId: FIRST_STAGE_SCENE.id,
  // Authored transparent shoreline uses the existing RGBA shader path.
  ...(layer.role === 'foreground' ? { kind: 2, fullAlpha: true } : {}),
})));
const ORIGINAL_FIVE_LAYER_SCENES = Object.freeze(Object.fromEntries([
  [FIRST_STAGE_SCENE.id, Object.freeze({ layers: FIRST_STAGE_LAYERS, urls: Object.freeze({
    ...COAST_EXTRA_URLS, islands: `${base}art/project-chapters-balanced-v1/coast/midground.png`,
    cloud: `${base}art/project-coast-balanced-v1/near-clouds.png`,
  }) })],
  ['coast', Object.freeze({ layers: COAST_LAYERS, urls: COAST_EXTRA_URLS })],
  ...chapterStyles.map(style => [style.id, Object.freeze({
    layers: Object.freeze(COAST_LAYERS.map((layer, index) => Object.freeze({
      ...layer, id: `${style.id}-${layer.role}`, sceneId: style.id,
      name: style.names[index], nativeLayer: style.native[index],
      ...(style.authoredMotion ? {authoredMotion:true} : {}),
      effectStyle: layer.role === 'effects' ? style.effect : 0,
      opacity: layer.role === 'effects' ? style.effectOpacity : layer.opacity,
      tint: layer.role === 'cloud' ? style.cloudTint : 0xffffff,
      // These new foreground PNGs have authored alpha, unlike old opaque banks.
      ...(expandedDepth[style.id] && layer.role === 'foreground' ? { kind: 2, fullAlpha: true } : {}),
      ...(expandedDepth[style.id] ? {
        presentationMotion: true,
        scrollScale: [.65, 1, 1.15, 1.3, 1.6][index],
      } : {}),
    }))),
    urls: Object.freeze({ islands: `${base}art/peripheral-v1/${style.id === 'red-nest' ? 'verdant-valley-mid-v2' : `${style.id}-${expandedDepth[style.id] ? 'mid-v1' : style.id === 'space' ? 'midground-v1' : 'crossings-v2'}`}.png`, cloud: COAST_EXTRA_URLS.cloud }),
  })]),
]));
// Reused themes share approved artwork; all native motion stays with its chapter.
const BALANCED_CHAPTER_THEMES = Object.freeze([
  'coast', 'ruins', 'volcano', 'sewer', 'space', 'frozen-rift',
  'storm-front', 'iron-dock', 'red-nest', 'volcano',
  'space', 'emerald-rainforest', 'red-nest', 'coast', 'volcano',
  'sewer', 'space', 'neon-city', 'storm-front', 'space',
]);
const balancedByTheme = Object.freeze(Object.fromEntries([...new Set(BALANCED_CHAPTER_THEMES)].map(theme => [
  theme, theme === 'coast' ? FIRST_STAGE_SCENE : Object.freeze({
    ...PERIPHERAL_SCENES.find(scene => scene.id === theme), id: `${theme}-balanced`,
    artUrl: `${base}art/project-chapters-balanced-v1/${theme}/foreground.png`,
    depthUrl: `${base}art/project-chapters-balanced-v1/${theme}/depth.png`,
  }),
])));
export const BALANCED_CHAPTER_SCENES = Object.freeze(BALANCED_CHAPTER_THEMES.map(theme => balancedByTheme[theme]));
export const FIVE_LAYER_SCENES = Object.freeze({
  ...ORIGINAL_FIVE_LAYER_SCENES,
  ...Object.fromEntries(Object.entries(balancedByTheme).filter(([theme]) => theme !== 'coast').map(([theme, scene]) => [
    scene.id, Object.freeze({
      layers: Object.freeze(ORIGINAL_FIVE_LAYER_SCENES[theme].layers.map(layer => Object.freeze({
        ...layer, id: `${scene.id}-${layer.role}`, sceneId: scene.id,
        ...(layer.role === 'foreground' ? { kind: 2, fullAlpha: true } : {}),
        // Pull bright asteroid faces behind the white aircraft silhouettes.
        ...(theme === 'space' && layer.role === 'midground' ? { tint: 0xc4cce0 } : {}),
      }))),
      urls: Object.freeze({
        ...ORIGINAL_FIVE_LAYER_SCENES[theme].urls,
        islands: `${base}art/project-chapters-balanced-v1/${theme}/midground.png`,
      }),
    }),
  ])),
});
export const FIVE_LAYER_DEFINITIONS = Object.freeze(Object.values(FIVE_LAYER_SCENES).flatMap(scene => scene.layers));

export function layerLateralOffset(layer, lateral = 0) {
  const input = Number.isFinite(lateral) ? Math.max(-1, Math.min(1, lateral)) : 0;
  const distance = Math.abs(layer.depth);
  return input * 80 * distance / (100 + distance) * layer.moveScale;
}

/** Bounded UV travel for a mirrored two-tile cycle, shared by runtime and QA. */
export function layerScrollOffset(layer, elapsed, imageAspect = 1.5) {
  const tileLength = layer.width * imageAspect;
  return ((Math.max(0, Number(elapsed) || 0) * layer.speed / tileLength) % 2 + 2) % 2;
}

/** Owned fallback ONLY for explicitly authored scenes with unavailable native
 * art metadata. Never supplies synthetic source layers to the simulation. */
export function authoredLayerMotion(layer, elapsed, aspect, cameraX, unitsPerWorld) {
  const directional = layer.role === 'foreground' || layer.role === 'cloud';
  return {
    scroll:layerScrollOffset(layer,elapsed,aspect),
    lateralOffset:directional ? Math.max(-12,Math.min(12,-cameraX*unitsPerWorld*(layer.role==='cloud'?.45:.3))) : 0,
  };
}

/** Visual grouping only: campaign rules and encounter data stay intact. */
export function peripheralSceneForStage(stage = 0) {
  if (typeof stage === 'string') {
    const balanced = BALANCED_CHAPTER_SCENES.find(scene => scene.id === stage);
    if (balanced) return balanced;
    const named = PERIPHERAL_SCENES.find(scene => scene.id === stage);
    if (named) return named;
  }
  const index = Number.isFinite(Number(stage)) ? Math.max(0, Math.floor(Number(stage))) : 0;
  if (index < BALANCED_CHAPTER_SCENES.length) return BALANCED_CHAPTER_SCENES[index];
  const representative = chapterMapRepresentativeStage(index);
  // Later s_map0025_2 reuse (chapter 36) keeps the original city/bridge set.
  if (representative === 17) return PERIPHERAL_SCENES.find(scene => scene.id === 'neon-city');
  // Six new source map groups in chapters 21..26. Later occurrences resolve
  // through chapterMapRepresentativeStage, so 27/28/29/30 reuse 5/24/21/25.
  const laterScenes = {20: 'sky-core', 21: 'orbital-wreckage', 22: 'lunar-outpost',
    23: 'ring-spaceport', 24: 'obsidian-wastes', 25: 'terraced-highlands',
    41:'lunar-ring-station',42:'lunar-crater-field',43:'lunar-research-camp'};
  if (laterScenes[representative]) return PERIPHERAL_SCENES.find(scene => scene.id === laterScenes[representative]);
  return PERIPHERAL_SCENES[Math.min(PERIPHERAL_SCENES.length - 1, representative)];
}
