import type { GameContent, RecordData } from './model';

export interface PlayerAppearanceSelection { key: string; layers: RecordData[]; plane: RecordData | undefined; }

// The replacement hull reads its pose from the primary skeleton only.
export function playerSpineLayers(layers: RecordData[], bodyPoseOnly: boolean) {
  return bodyPoseOnly ? layers.slice(0, 1) : layers;
}

/** Exact exported battle-prefab data; selection icons are never battle models. */
export function selectPlayerAppearance(content: GameContent, selected: RecordData = content.combat.studyLoadout || {}): PlayerAppearanceSelection {
  const manifest = content.assets.playerAppearances;
  const skinId = Number(selected.selectedSkinId || 10100);
  const plane = manifest?.planes?.[String(skinId)];
  const base = manifest?.planes?.['10100'];
  const activePlane = plane?.layers?.length ? plane : base;
  // Combat never draws a pilot on top of the plane. Pilot identity and skills
  // stay in the loadout; only the visible hull and its pose use this selection.
  const layers = [...(activePlane?.layers || [])].sort((a, b) => (a.depth ?? 0) - (b.depth ?? 0));
  return { key: String(skinId), layers, plane };
}

