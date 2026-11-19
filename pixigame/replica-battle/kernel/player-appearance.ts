import type { GameContent, RecordData } from './model';

export interface PlayerAppearanceSelection { key: string; layers: RecordData[]; plane: RecordData | undefined; pilot: RecordData | undefined; }

/** Exact exported battle-prefab data; selection icons are never battle models. */
export function selectPlayerAppearance(content: GameContent): PlayerAppearanceSelection {
  const manifest = content.assets.playerAppearances;
  const selected = content.combat.studyLoadout || {};
  const skinId = Number(selected.selectedSkinId || 10100);
  const pilotId = Number(selected.selectedPilotId ?? 40100);
  const plane = manifest?.planes?.[String(skinId)];
  const pilot = manifest?.pilots?.[String(pilotId)];
  const base = manifest?.planes?.['10100'];
  const activePlane = plane?.layers?.length ? plane : base;
  const layers = [...(activePlane?.layers || [])];
  if (pilot?.layers?.length) layers.push(...pilot.layers.map((layer: RecordData) => ({ ...layer, pilot: true })));
  return { key: `${skinId}:${pilotId}`, layers: layers.sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0)), plane, pilot };
}

/** Optional content-loader helper; the normal content pipeline may fetch it itself. */
export async function loadAllAppearances(content: GameContent): Promise<RecordData> {
  if (!content.assets.playerAppearances) {
    const response = await fetch('data/player-appearances.json');
    if (!response.ok) throw new Error(`Original player appearances: HTTP ${response.status}`);
    content.assets.playerAppearances = await response.json();
  }
  return content.assets.playerAppearances;
}

export function allPlayerAppearanceLayers(content: GameContent): RecordData[] {
  const source = content.assets.playerAppearances;
  const unique = new Map<string, RecordData>();
  for (const group of [source?.planes, source?.pilots]) for (const item of Object.values(group || {}) as RecordData[]) {
    for (const layer of item.layers || []) unique.set(layer.key, layer);
  }
  return [...unique.values()];
}
