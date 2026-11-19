import urgencySource from '../public/data/enemy-warning.json';
import type {GameContent, RecordData} from './model';
import {playerSpineLayers} from './player-appearance';

export function planBattleImages(content: GameContent, {
  playerLayers, replaceTerrain, nativeTerrain, bodyPoseOnly,
}: {
  playerLayers: RecordData[];
  replaceTerrain: boolean;
  nativeTerrain: boolean;
  bodyPoseOnly?: boolean;
}) {
  const assets = content.assets;
  const earlyModels = new Set(content.spawns.filter(spawn => spawn.wave === 1)
    .map(spawn => content.chapter.entities[spawn.entityId]?.modelId));
  const playerModel = content.chapter.entities[content.chapter.player.entityId].modelId;
  earlyModels.add(playerModel);
  const prefabByModel = new Map<number, string>();
  for (const [name, prefab] of Object.entries(assets.prefabs) as [string, RecordData][]) {
    for (const id of prefab.modelIds || []) prefabByModel.set(id, name);
  }
  const playerPrefab = prefabByModel.get(playerModel);
  const images = new Map<string, string>();
  const priority = new Set<string>();
  const spines: RecordData[] = [...playerSpineLayers(playerLayers, Boolean(bodyPoseOnly))];
  const register = (key: string, url: string, early: boolean) => {
    if (!url) return;
    if (!images.has(key)) images.set(key, url);
    if (early) priority.add(key);
  };
  const sprite = (key: string, early = false) => {
    if (key && assets.sprites[key]) register(key, assets.sprites[key].url, early);
  };

  for (const [key, texture] of Object.entries(assets.enemyHealthBars.sprites) as [string, RecordData][])
    register(key, texture.url, false);
  const spriteByPath = new Map((Object.entries(assets.sprites) as [string, RecordData][])
    .filter(([, sprite]) => sprite.pathId).map(([key, sprite]) => [String(sprite.pathId), key]));
  for (const reference of assets.enemyLocalAnimation?.spriteReferences || [])
    sprite(spriteByPath.get(String(reference.pathId)) || '');
  for (const [name, prefab] of Object.entries(assets.prefabs) as [string, RecordData][]) {
    if (replaceTerrain && name === assets.map.prefab) continue;
    const early = prefab.modelIds?.some((id: number) => earlyModels.has(id)) === true;
    if (prefab.spine) {
      if (name !== playerPrefab) spines.push(...prefab.spine);
      else if (!playerLayers.length) spines.push(...playerSpineLayers(prefab.spine, Boolean(bodyPoseOnly)));
      continue;
    }
    for (const key of prefab.sequence?.frames || []) sprite(key, early);
    if (prefab.composite) { sprite(prefab.composite, early); continue; }
    if (name === assets.map.prefab && assets.map.segments?.length) continue;
    const animated = new Set(assets.enemyLocalAnimation?.animatedRendererPaths?.[name] || []);
    for (const row of prefab.renderers || []) {
      if ((row.active && row.enabled) || animated.has(row.hierarchy?.join('/'))) sprite(row.sprite, early);
    }
  }
  if (nativeTerrain) {
    for (const row of assets.map.nativeLayers.renderers) if (row.active && row.enabled) sprite(row.sprite, true);
  } else if (!replaceTerrain) {
    for (const [index, segment] of (assets.map.segments || []).entries()) {
      if (segment.key && assets.sprites[segment.key]) sprite(segment.key, true);
      else if (segment.url) register(segment.key || `map:${segment.index ?? index}`, segment.url, true);
    }
  }
  for (const key of ['exp', 'exp5', 'exp5_blue']) sprite(key, true);
  for (const node of urgencySource.nodes) if (node.sprite) sprite(node.sprite);
  const roundShot = assets.sprites.arrow_Monster_rotundity_1_0000;
  if (roundShot?.url) for (let frame = 1; frame < 4; frame++) {
    const key = `arrow_Monster_rotundity_1_000${frame}`;
    register(key, roundShot.url.replace('arrow_Monster_rotundity_1_0000.png', `${key}.png`), false);
  }
  const early = [...priority].map(key => [key, images.get(key)!] as const);
  const orderedImages = [...early, ...[...images].filter(([key]) => !priority.has(key))];
  return { prefabByModel, spriteByPathId: spriteByPath, spines, images: orderedImages };
}
