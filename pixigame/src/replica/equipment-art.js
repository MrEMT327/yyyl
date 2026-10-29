export function equipmentArtKey(row) {
  if (!row || !Number.isInteger(row.ID) || !Number.isInteger(row.quality)) return null;
  return `sets-v2/${row.ID - row.quality}`;
}

export const equipmentBlueprintArtPath = partId => `art/project-flight-blueprints-v1/${partId}.webp`;
