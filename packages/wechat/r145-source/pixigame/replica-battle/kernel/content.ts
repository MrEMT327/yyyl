/// <reference types="vite/client" />
import { type GameContent, type RecordData, type Spawn } from './model';
import { planWaveGold, waveExperiencePerWeight, healthDropMultiplierRaw } from './drop-rewards';
import { nativeIsBoss } from './monster-abilities';
import { inspectContentCapabilities } from './content-capabilities';
import { nativeOrdinaryCameraViewport } from './native-camera-projection';
import { loadLoadoutRuntime, loadPlayerAppearances, type ReadSharedLoadoutJSON } from './loadout-resources';
import { rewriteBattleUrls } from '../rewrite-battle-urls';
import { installNativeAirdropContent } from './native-airdrop-content';
import { cleanBattleArtwork } from './release-battle-artwork.js';

const parse = (text: unknown) => { if (typeof text !== 'string') return text || {}; try { return JSON.parse(text); } catch { try { return JSON.parse(text.replace(/}}$/, '}')); } catch { return {}; } } };

interface ContentHost {
  chapterId: number;
  fetchResource: typeof fetch;
  readSharedLoadoutJSON?: ReadSharedLoadoutJSON;
  canLoadArt?: (path: string) => boolean;
}

export async function loadContent(onProgress: ((completed: number, total: number) => void) | undefined, host: ContentHost): Promise<GameContent> {
  if (!host?.fetchResource || !Number.isSafeInteger(host.chapterId)) throw new Error('战斗数据必须由微信宿主指定关卡并加载');
  const { fetchResource, canLoadArt } = host;
  // Catalog, current chapter resources and shared combat tables.
  let completed = 0;
  const loaded = <T>(value: T): T => {
    completed++;
    try { onProgress?.(completed, 18); } catch { /* Progress cannot interrupt resource loading. */ }
    return value;
  };
  const read = async (name: string) => {
    const response = await fetchResource(`data/${name}.json`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`关卡资源缺失：${name}`);
    try { return loaded(await response.json()); }
    catch { throw new Error(`资源格式错误：${name}.json，请重新生成资源后刷新。`); }
  };
  const emptyEffects = () => ({ effects: {}, textures: {}, materials: {}, meshes: {} });
  const retiredArtwork = {
    'effects-original': emptyEffects, 'effects-original-chapters': emptyEffects,
    'sword-original-effects': emptyEffects, 'beam-effects': emptyEffects,
    'boss-animation': () => ({}), 'enemy-local-animation-chapters': () => ({}),
    'audio-chapters': () => ({ audio: {}, music: {}, soundKeys: {} }),
  };
  const readShared = (name: string) => canLoadArt && Object.hasOwn(retiredArtwork, name)
    ? Promise.resolve(loaded(retiredArtwork[name as keyof typeof retiredArtwork]())) : read(name);
  const selectionRequest = read('chapters').then(catalog => {
    const requested = host.chapterId;
    const entry = catalog.chapters.find((row: RecordData) => row.id === requested);
    if (!entry) throw new Error('请选择关卡列表中已接入的关卡');
    return { catalog, requested, entry };
  });
  const loadChapterResources = async (requested: number) => {
    const response = await fetchResource(`data/sorties-v1/chapter-${requested}.json`);
    if (!response.ok) throw new Error(`缺少第 ${requested} 关资源包`);
    const bundle = await response.json();
    if (bundle.chapterId !== requested || !bundle.extra || !bundle.nativeLayers || !bundle.bossAnimations)
      throw new Error(`第 ${requested} 关资源包不匹配`);
    return bundle;
  };
  // Only chapter-specific paths depend on the catalog. Start shared tables
  // immediately, with one joined failure path for every request.
  const [selection, chapterData, sharedData] = await Promise.all([
    selectionRequest,
    selectionRequest.then(({ entry, requested }) => Promise.all([
      read(entry.chapterFile), read(entry.geometryFile), loadChapterResources(requested).then(loaded),
    ])),
    Promise.all([
      'assets', 'combat', 'effects-original', 'boss-animation', 'enemy-health-bars', 'beam-effects',
      'enemy-health-bars-chapters', 'npc-chapters', 'audio-chapters', 'effects-original-chapters', 'enemy-local-animation-chapters', 'sword-original-effects',
    ].map(readShared).concat(loadLoadoutRuntime(fetchResource, host.readSharedLoadoutJSON).then(loaded),
      canLoadArt ? Promise.resolve(loaded({ planes: {}, pilots: {} })) : loadPlayerAppearances(fetchResource, host.readSharedLoadoutJSON).then(loaded))),
  ]);
  const { catalog, requested, entry } = selection;
  const [chapter, geometry, chapterResources] = chapterData;
  const [assets, combat, originalEffects, bossAnimation, enemyHealthBars, beamEffects,
    chapterHealth, npcChapters, chapterAudio, chapterEffects, enemyLocalAnimation, swordEffects, loadoutRuntime, playerAppearances] = sharedData;
  assets.playerAppearances = playerAppearances;
  // Keep previously repaired weapon rows; add the missing original loadout
  // dependency graph before constructing Simulation and its status runtimes.
  for (const key of ['skillRows', 'triggers', 'entities', 'weapons', 'bullets', 'buffs', 'attributeDefinitions'])
    combat[key] = { ...loadoutRuntime[key], ...combat[key] };
  for (const key of ['sprites', 'prefabs', 'effects']) assets[key] = { ...loadoutRuntime.assets?.[key], ...assets[key] };
  installNativeAirdropContent(combat);
  const addedEffects = canLoadArt ? undefined : loadoutRuntime.assets?.originalEffects;
  if (addedEffects) for (const key of ['effects', 'textures', 'materials', 'meshes'])
    originalEffects[key] = { ...addedEffects[key], ...originalEffects[key] };
  chapter.catalog = catalog.chapters;
  chapter.npc = { ...npcChapters.chapters?.[requested], configs: npcChapters.configs, rules: npcChapters.rules };
  // Entry stats are supplied by the validated native loadout handshake.
  chapter.player.sourceAttack = chapter.player.attack;
  chapter.player.sourceHP = chapter.player.hp;
  const {extra, nativeLayers} = chapterResources;
  if (!extra) throw new Error(`缺少第 ${requested} 关资源清单`);
  for (const key of ['sprites', 'prefabs', 'audio', 'effects']) assets[key] = { ...assets[key], ...extra[key] };
  if (extra.map) assets.map = extra.map;
  assets.map.nativeLayers = nativeLayers;
  assets.audio = { ...assets.audio, ...chapterAudio.audio };
  assets.soundKeys = chapterAudio.soundKeys;
  for (const key of Object.values(chapterAudio.music) as string[]) if (assets.audio[key]) assets.audio[key].music = true;
  chapter.musicKey = chapterAudio.music[requested] || extra.musicKey;
  const health = chapterHealth.chapters?.[requested] || chapterHealth;
  for (const key of ['sprites', 'entities', 'models', 'bars']) enemyHealthBars[key] = { ...enemyHealthBars[key], ...health[key] };
  for (const key of ['effects', 'textures', 'materials', 'meshes']) originalEffects[key] = { ...originalEffects[key], ...chapterEffects[key] };
  if (!canLoadArt && extra.originalEffects) for (const key of ['effects', 'textures', 'materials', 'meshes']) originalEffects[key] = { ...originalEffects[key], ...extra.originalEffects[key] };
  if (!canLoadArt && extra.beamEffects) for (const key of ['effects', 'textures', 'materials', 'meshes']) beamEffects[key] = { ...beamEffects[key], ...extra.beamEffects[key] };
  for (const key of ['effects', 'textures', 'materials', 'meshes'])
    originalEffects[key] = { ...originalEffects[key], ...swordEffects[key] };
  assets.originalEffects = originalEffects;
  assets.beamEffects = beamEffects;
  Object.assign(originalEffects.textures, beamEffects.textures);
  for (const [id, effect] of Object.entries(beamEffects.effects) as [string, RecordData][]) {
    for (const anchor of ['start', 'end']) originalEffects.effects[`beam:${id}:${anchor}`] = { layers: effect.layers.filter((layer: RecordData) => layer.anchor === anchor), sequences: [] };
  }
  assets.bossAnimation = bossAnimation;
  assets.bossAnimations = canLoadArt ? {} : chapterResources.bossAnimations;
  assets.enemyLocalAnimation = enemyLocalAnimation;
  assets.enemyHealthBars = enemyHealthBars;
  if (canLoadArt) cleanBattleArtwork(assets, path => canLoadArt(/^\/?assets\//.test(path) ? path.replace(/^\//, '') : path));
  // Extracted textures retain stable names. Pair the new manifest with this
  // revision's images instead of reusing a previous extraction cached for an hour.
  rewriteBattleUrls(assets, (value, key) =>
    key === 'url' && /^\/?assets\//.test(value) && !/[?&]rev=chapters12-15-native(?:&|$)/.test(value)
      ? `${value}${value.includes('?') ? '&' : '?'}rev=chapters12-15-native`
      : value);
  for (const [key, raw] of Object.entries(combat.entities) as [string, RecordData][]) {
    if (chapter.entities[key]) continue;
    chapter.entities[key] = { id: raw.ID, modelId: raw.ModelID, modelScale: raw.ModelScale, stats: { hp: raw.HP, attack: raw.Attack, speed: raw.MoveSpeed, shape: raw.Shape, fireInterval: raw.FireCD, bodyAttack: raw.BodyAttack, hitInterval: raw.HittedInterval, expWeight: raw.expWeight }, ai: { type: raw.WaveAIId || raw.AIId, parameters: parse(raw.WaveAIParameters || raw.AIParameters), leaveParameters: parse(raw.WaveleaveParameters || raw.leaveParameters), bornParameters: parse(raw.bornParameters) }, weaponIds: raw.WeaponID, raw };
  }
  for (const [key, raw] of Object.entries(combat.weapons) as [string, RecordData][]) {
    if (chapter.weapons[key]) continue;
    chapter.weapons[key] = { id: raw.ID, bulletId: raw.BulletId, trajectory: raw.Trajectory, trajectoryParameters: parse(raw.TrajectoryParams), mods: ['WeaponMod', 'WeaponMod2', 'WeaponMod3', 'BulletMod1', 'BulletMod2', 'BulletMod3', 'BulletMod4', 'BulletMod5'].map(key => raw[key]).filter(value => value?.length).map(value => ({ type: value[0], parameters: parse(value[1]) })), parameters: raw, raw };
  }
  for (const [key, raw] of Object.entries(combat.bullets)) if (!chapter.bullets[key]) chapter.bullets[key] = { id: Number(key), parameters: raw };
  // Some source JSON mod payloads have a redundant trailing brace; recover only that exact syntax defect.
  for (const w of Object.values(chapter.weapons) as RecordData[]) {
    // Precompiled chapter rows can encode an omitted trajectory payload as null.
    // Match combat/loadout rows' empty-object default before simulation reads it.
    // In particular, Thunder's omitted UseFirePos keeps its native default of 0.
    w.trajectoryParameters ??= {};
    for (const mod of w.mods) mod.parameters = parse(mod.parameters);
  }
  assets.geometry = geometry;
  // The H5 playfield is 540 x 960. Original ordinary camera OnInit replaces
  // prefab orthographicSize, so use the shipped runtime projection at 9:16.
  const world = Number(chapter.chapter.parameters.chapterType) === 8 && Number(chapter.chapter.parameters.cameraId) === 3
    ? nativeOrdinaryCameraViewport(9 / 16)
    : { width: geometry.camera.prefabWorldWidthAt9x16, height: geometry.camera.prefabWorldHeight };
  const spawns: Spawn[] = [];
  let spawnSeed = (requested ^ 0x1badf00d) >>> 0;
  const spawnRandom = () => { spawnSeed ^= spawnSeed << 13; spawnSeed ^= spawnSeed >>> 17; spawnSeed ^= spawnSeed << 5; return (spawnSeed >>> 0) / 4294967296; };
  // Native CalTileSpecialMonsterCount stores one WaterfallRandomMap selection
  // per event, then reuses it for spawning and budget counts. Choose before
  // calculating HP/XP/gold; alternatives must never be concatenated together.
  const selectedLayouts = new Map<string, number>();
  for (const [key, choice] of Object.entries(geometry.layoutChoices || {}) as [string, RecordData][]) {
    selectedLayouts.set(key, Math.floor(spawnRandom() * choice.resources.length));
  }
  for (const wave of chapter.waves) {
    const waveSpawns: Spawn[] = [];
    for (const event of [...wave.events].sort((a, b) => (a.baseTime ?? a.time) - (b.baseTime ?? b.time) || a.id - b.id)) {
      // Non-spawn missions remain in the chapter timeline, but have no enemy positions.
      if (geometry.nonSpawnEvents.includes(event.id)) continue;
      const layoutPoints = geometry.spawnPoints.filter((point: RecordData) => point.missionId === event.id && (!point.layoutChoice || selectedLayouts.get(point.layoutChoice) === point.layoutChoiceIndex));
      const randomConfig = geometry.randomSpawns[event.id];
      if (!layoutPoints.length && !randomConfig) throw new Error(`缺少原版出怪坐标：${event.id}`);
      const appendPoint = (point: RecordData, repeatDelay: number, repeat: number, randomPlacement = false) => {
          const entityId = point.entityId;
          const entity = chapter.entities[entityId];
          if (!entity) throw new Error(`缺少敌人配置：${entityId}`);
          const x = point.origin.x;
          const z = point.needsCameraTopTranslation ? point.origin.z + Math.abs(point.layoutMinZ - world.height / 2) + geometry.positionPlacement.cameraTopOffset : point.origin.z;
          const pathId = entity.ai.parameters?.PathId;
          const layout: RecordData[] = geometry.positions[point.resource] || [];
          // CreateTileMonster passes layout-relative spacing to both loop tasks.
          // Random-spawn missions have no layout and explicitly pass zero.
          const loopZ = layout.length ? point.origin.z - Math.max(...layout.map(p => p.z)) : 0;
          const loopRestartZOffset = layout.length ? point.origin.z - Math.min(...layout.map(p => p.z)) : 0;
          const spawn: Spawn = { time: point.timeBeforeIntervalRepeat + repeatDelay, entityId, eventId: event.id, wave: wave.number, x, z,
            hpMultiplier: event.hpMultiplier ?? wave.hpMultiplier * (event.parameters.hpUpgrade || 1),
            attackMultiplier: event.attackMultiplier ?? wave.attackMultiplier * (event.parameters.attackUp || 1),
            hpDropMultiplierRaw: healthDropMultiplierRaw(chapter.chapter.raw.HPPickUpAddPercent, wave.raw.HPPickUpAddPercent, event.raw.HPPickUpAddPercent),
            exp: 0, gold: 0, pathId: /Path/.test(entity.ai.type) ? pathId : undefined,
            boss: nativeIsBoss(entity.raw.Type), loopZ, loopRestartZOffset, creatorRepeat: repeat, randomPlacement };
          waveSpawns.push(spawn);
      };
      const interval = event.parameters.interval || [];
      const repeatCount = interval.length ? Math.max(0, Math.trunc(interval[0])) : 1;
      // Native CreateIntervalMonster queues tile, group, then random for EVERY
      // repeat. Random positions must be drawn again instead of cloned.
      for (let repeat = 0; repeat < repeatCount; repeat++) {
        const delay = repeat * Number(interval[1] || 0);
        for (const point of layoutPoints) appendPoint(point, delay, repeat);
        if (randomConfig) {
          // Budget placeholders only. Actual positions and group draws are
          // made by MissionCreators.refresh against its live pending queue.
          // Homogeneous random pools keep native per-wave weight accounting
          // independent from placement; heterogeneous pools are capability gated.
          const entityId = randomConfig.groups?.[0]?.entityIds?.[0];
          for (let index = 0; index < Math.max(0, Math.trunc(randomConfig.count)); index++) {
            appendPoint({ entityId, origin: { x: 0, z: world.height / 2 },
              timeBeforeIntervalRepeat: event.time, needsCameraTopTranslation: false }, delay, repeat, true);
          }
        }
      }
    }
    waveSpawns.sort((a, b) => a.time - b.time || a.eventId - b.eventId);
    const weights = waveSpawns.reduce((sum, spawn) => sum + chapter.entities[spawn.entityId].stats.expWeight, 0);
    const perWeight = waveExperiencePerWeight(wave.experienceBudget, weights);
    // Reproducible local draw; original global battle RNG state is not present in APK tables.
    let goldSeed = (wave.id ^ 0x69a8c40) >>> 0;
    const goldRandom = () => { goldSeed ^= goldSeed << 13; goldSeed ^= goldSeed >>> 17; goldSeed ^= goldSeed << 5; return (goldSeed >>> 0) / 4294967296; };
    const gold = planWaveGold(wave.goldBudget, waveSpawns.map(spawn => {
      const raw = chapter.entities[spawn.entityId].raw;
      return { dropType: raw.MonsterDropType, characterType: raw.Type };
    }), assets.monsterDrops, wave.stopByEliteOrBossKilled, goldRandom);
    for (const [index, spawn] of waveSpawns.entries()) {
      const entity = chapter.entities[spawn.entityId];
      spawn.exp = wave.experienceBudget ? entity.stats.expWeight * perWeight : entity.raw.exp;
      spawn.gold = gold[index];
    }
    spawns.push(...waveSpawns);
  }
  spawns.sort((a, b) => a.time - b.time || a.eventId - b.eventId);
  if (!spawns.length) throw new Error('关卡没有可用的原始出怪数据');
  const content = { chapter, assets, combat, world, spawns };
  const capabilities = inspectContentCapabilities(content);
  chapter.capabilities = capabilities;
  if (!capabilities.canPlay) throw new Error(`第 ${requested} 关缺少通用支持：${capabilities.issues.filter(issue => issue.severity === 'error').map(issue => issue.message).join('；')}`);
  if (capabilities.issues.length) console.warn(`第 ${requested} 关的静态能力限制`, capabilities.issues);
  return content;
}

