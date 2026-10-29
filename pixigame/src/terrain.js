const TERRAIN_BY_STAGE = Object.freeze({
  aries: theme('red-dunes', '赤砂冲锋谷', 'dunes', {
    sky: 0x160b12, atmosphere: 0xff785f, surface: 0x6f2f26, surfaceDeep: 0x351b1d,
    bandA: 0xb95a35, bandB: 0x7f3829, land: 0xa95832, landLight: 0xe08a4a,
    grid: 0x9a4432, gridAccent: 0xffb36b, structure: 0x55302a, light: 0xffd477,
    weather: 0xffbf7b, weatherType: 'sand', structureType: 'outpost',
  }),
  taurus: theme('golden-mesa', '黄金台地', 'mesa', {
    sky: 0x17100b, atmosphere: 0xe9a85b, surface: 0x6a492c, surfaceDeep: 0x33291e,
    bandA: 0xa77942, bandB: 0x795432, land: 0x9a6b3d, landLight: 0xd4ad68,
    grid: 0x8d704a, gridAccent: 0xffe2a0, structure: 0x4f4639, light: 0xffd16c,
    weather: 0xffdfa0, weatherType: 'dust', structureType: 'fortress',
  }),
  gemini: theme('mirror-crystals', '镜晶原野', 'crystal', {
    sky: 0x100d20, atmosphere: 0x9d7cff, surface: 0x352b59, surfaceDeep: 0x17142d,
    bandA: 0x66569c, bandB: 0x3d356d, land: 0x5d4d86, landLight: 0xb897ff,
    grid: 0x6556a7, gridAccent: 0x85f4ff, structure: 0x252443, light: 0xc8fbff,
    weather: 0xcabaff, weatherType: 'spark', structureType: 'relay',
  }),
  cancer: theme('tidal-isles', '潮汐群岛', 'islands', {
    sky: 0x07141c, atmosphere: 0x68d8f4, surface: 0x0f4e62, surfaceDeep: 0x062b3a,
    bandA: 0x19748a, bandB: 0x10596f, land: 0x326b5d, landLight: 0x71a878,
    grid: 0x318ca0, gridAccent: 0xb8f8ff, structure: 0x213c46, light: 0x8df7ff,
    weather: 0xb8f4ff, weatherType: 'rain', structureType: 'harbor', waterLike: true,
  }),
  leo: theme('sun-scorched-city', '日耀焦土城', 'city', {
    sky: 0x1b0e08, atmosphere: 0xff9c35, surface: 0x75401e, surfaceDeep: 0x372014,
    bandA: 0xc86b2f, bandB: 0x8e4724, land: 0xa85229, landLight: 0xef9a43,
    grid: 0xa8512a, gridAccent: 0xffef9a, structure: 0x46362d, light: 0xfff0a6,
    weather: 0xffd46b, weatherType: 'heat', structureType: 'city',
  }),
  virgo: theme('emerald-terraces', '翡翠梯田', 'terraces', {
    sky: 0x071711, atmosphere: 0x77e0ae, surface: 0x22563e, surfaceDeep: 0x102e25,
    bandA: 0x397a50, bandB: 0x2b6547, land: 0x477c4d, landLight: 0x8abf68,
    grid: 0x4f8b62, gridAccent: 0xdffff0, structure: 0x31493b, light: 0xe7ffad,
    weather: 0xc9ffe0, weatherType: 'pollen', structureType: 'farm',
  }),
  libra: theme('salt-ruins', '白盐遗迹', 'salt', {
    sky: 0x10151b, atmosphere: 0xb6e5ff, surface: 0x61737a, surfaceDeep: 0x2d3940,
    bandA: 0x91a5a7, bandB: 0x697f83, land: 0xa8aaa0, landLight: 0xe8e3c9,
    grid: 0x869ea8, gridAccent: 0xffd681, structure: 0x55595b, light: 0xffdf91,
    weather: 0xe3fbff, weatherType: 'dust', structureType: 'ruins',
  }),
  scorpio: theme('toxic-marsh', '深红毒沼', 'marsh', {
    sky: 0x130814, atmosphere: 0xc64b80, surface: 0x3b2438, surfaceDeep: 0x1c1420,
    bandA: 0x63304d, bandB: 0x45243b, land: 0x4c4935, landLight: 0x8b8c49,
    grid: 0x6e3150, gridAccent: 0xff8eb8, structure: 0x30252f, light: 0xd8ff77,
    weather: 0xdb7aaa, weatherType: 'spore', structureType: 'refinery',
  }),
  sagittarius: theme('arrow-canyon', '穿星峡谷', 'canyon', {
    sky: 0x160d09, atmosphere: 0xe8a15f, surface: 0x694024, surfaceDeep: 0x31221a,
    bandA: 0xa86636, bandB: 0x76472a, land: 0x8d5231, landLight: 0xc8834c,
    grid: 0x8b5638, gridAccent: 0xffed9c, structure: 0x403831, light: 0xffd76b,
    weather: 0xf5bc75, weatherType: 'sand', structureType: 'fort',
  }),
  capricorn: theme('snow-peaks', '雪峰近航', 'snow', {
    sky: 0x09111c, atmosphere: 0xb7ddff, surface: 0x3c5269, surfaceDeep: 0x18283a,
    bandA: 0x66819a, bandB: 0x455f78, land: 0x596a78, landLight: 0xe8f5ff,
    grid: 0x6d8da8, gridAccent: 0xe8f8ff, structure: 0x344351, light: 0xffe8a0,
    weather: 0xffffff, weatherType: 'snow', structureType: 'cabin',
  }),
  aquarius: theme('glacier-lake', '冰川天湖', 'glacier', {
    sky: 0x06151b, atmosphere: 0x6fe9f5, surface: 0x15536a, surfaceDeep: 0x082e43,
    bandA: 0x28788e, bandB: 0x1b6079, land: 0x6aa8b5, landLight: 0xd9ffff,
    grid: 0x4593a6, gridAccent: 0xc8ffff, structure: 0x284b5a, light: 0xa5ffff,
    weather: 0xc9ffff, weatherType: 'snow', structureType: 'research', waterLike: true,
  }),
  pisces: theme('abyssal-ocean', '无尽深海', 'islands', {
    sky: 0x05091b, atmosphere: 0x718cff, surface: 0x142e6b, surfaceDeep: 0x080f35,
    bandA: 0x25458f, bandB: 0x1a3372, land: 0x283e63, landLight: 0x657da8,
    grid: 0x3f55a0, gridAccent: 0xcbd6ff, structure: 0x172747, light: 0x89d7ff,
    weather: 0xaabfff, weatherType: 'rain', structureType: 'platform', waterLike: true,
  }),
  ares: theme('lava-wastes', '熔岩战原', 'volcanic', {
    sky: 0x160607, atmosphere: 0xf04a35, surface: 0x4a1717, surfaceDeep: 0x210b10,
    bandA: 0x7c2521, bandB: 0x55191a, land: 0x3d2927, landLight: 0x795045,
    grid: 0x8e3026, gridAccent: 0xff9b49, structure: 0x2b2728, light: 0xff6a2f,
    weather: 0xff7350, weatherType: 'ash', structureType: 'bunker',
  }),
  athena: theme('marble-citadel', '神盾白城', 'city', {
    sky: 0x15140e, atmosphere: 0xe8d48c, surface: 0x6a6552, surfaceDeep: 0x302f2a,
    bandA: 0x938a68, bandB: 0x6f674f, land: 0xb2aa8d, landLight: 0xf5efd5,
    grid: 0x99916f, gridAccent: 0xfff4c6, structure: 0x68665f, light: 0xffe89e,
    weather: 0xf5e8bc, weatherType: 'spark', structureType: 'citadel',
  }),
  hades: theme('ashen-underworld', '冥界灰原', 'volcanic', {
    sky: 0x080611, atmosphere: 0x7451a8, surface: 0x282039, surfaceDeep: 0x100d1b,
    bandA: 0x403052, bandB: 0x30233f, land: 0x3b3543, landLight: 0x70617a,
    grid: 0x4d3c69, gridAccent: 0xd6a8ff, structure: 0x24212b, light: 0xc77cff,
    weather: 0xa78db9, weatherType: 'ash', structureType: 'obelisk',
  }),
  poseidon: theme('storm-fortress', '风暴海城', 'islands', {
    sky: 0x04131c, atmosphere: 0x36b9db, surface: 0x0b425d, surfaceDeep: 0x051f34,
    bandA: 0x126780, bandB: 0x0d4f6a, land: 0x315966, landLight: 0x6b8d91,
    grid: 0x247a94, gridAccent: 0xb9fbff, structure: 0x203c49, light: 0x76efff,
    weather: 0xbaf6ff, weatherType: 'rain', structureType: 'harbor', waterLike: true,
  }),
  zeus: theme('thunder-temple', '万雷神庭', 'temple', {
    sky: 0x11100a, atmosphere: 0xf2d45f, surface: 0x555146, surfaceDeep: 0x25252a,
    bandA: 0x7a7461, bandB: 0x5d594d, land: 0x8d897a, landLight: 0xe8e3cb,
    grid: 0x8a825f, gridAccent: 0xffffff, structure: 0x565764, light: 0xffffa3,
    weather: 0xfff3a1, weatherType: 'spark', structureType: 'spire',
  }),
});

function theme(id, name, featureType, colors) {
  const textureByFeature = {
    canyon: 'strata',
    city: 'blocks',
    crystal: 'facets',
    dunes: 'sand-ripples',
    glacier: 'ice-cracks',
    islands: 'currents',
    marsh: 'bog-pools',
    mesa: 'strata',
    salt: 'salt-flats',
    snow: 'snowdrifts',
    temple: 'runic-plates',
    terraces: 'terrace-lines',
    volcanic: 'lava-cracks',
  };
  const skyByWeather = {
    ash: 'ember-haze',
    dust: 'dust-moon',
    heat: 'solar-haze',
    pollen: 'green-aurora',
    rain: 'storm-clouds',
    sand: 'sand-haze',
    snow: 'cold-aurora',
    spark: 'ion-aurora',
    spore: 'spore-haze',
  };
  const landmarkByStructure = {
    bunker: 'blast-bunkers',
    cabin: 'snow-cabins',
    citadel: 'white-towers',
    city: 'city-blocks',
    farm: 'terrace-farms',
    fort: 'canyon-forts',
    fortress: 'mesa-forts',
    harbor: 'sea-harbors',
    obelisk: 'dark-obelisks',
    outpost: 'desert-outposts',
    platform: 'ocean-platforms',
    refinery: 'toxic-refineries',
    relay: 'crystal-relays',
    research: 'ice-labs',
    ruins: 'salt-ruins',
    spire: 'thunder-spires',
  };
  return Object.freeze({
    id,
    name,
    featureType,
    textureType: colors.textureType || textureByFeature[featureType] || 'broken-ground',
    skyFeature: colors.skyFeature || skyByWeather[colors.weatherType] || 'low-haze',
    landmarkType: colors.landmarkType || landmarkByStructure[colors.structureType] || colors.structureType,
    featureDensity: colors.featureDensity || (colors.waterLike ? 1.2 : 1),
    ...colors,
  });
}

export function terrainForStage(stage) {
  return TERRAIN_BY_STAGE[stage?.terrainId || stage?.id] || TERRAIN_BY_STAGE.aries;
}

export function terrainIds() {
  return Object.values(TERRAIN_BY_STAGE).map((entry) => entry.id);
}
