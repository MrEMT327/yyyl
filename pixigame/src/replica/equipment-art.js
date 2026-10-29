// Legacy slot IDs and saved equipment families retain their gameplay identity.
const DEFAULT_FAMILIES=Object.freeze({'cockpit':4100100,'fire-control':4200100,'fuselage':4300100,'amplifier':4400100,'engine-armor':4500100});
const FAMILIES=new Set(Object.values(DEFAULT_FAMILIES).flatMap(base=>[base,base+100,base+200,base+300,base+10000]));

export function equipmentArtKey(row) {
  if (!row || !Number.isInteger(row.ID) || !Number.isInteger(row.quality)) return null;
  return `sets-v3/${row.ID - row.quality}`;
}

// Old reward receipts may hold a part ID, versioned key or complete image URL.
export function equipmentArtFamily(value) {
  const key=String(value??'').split(/[?#]/,1)[0];
  const filename=key.slice(key.lastIndexOf('/')+1).replace(/\.webp$/,'');
  const family=DEFAULT_FAMILIES[filename]??Number(/(?:^|[/])(\d{7})(?:\.webp)?$/.exec(key)?.[1]);
  return FAMILIES.has(family)?family:null;
}

export function equipmentArtPath(value) {
  const family=equipmentArtFamily(value);
  return family==null?null:`art/project-flight-gear-v1/sets-v3/${family}.webp`;
}

export const equipmentBlueprintArtPath = partId => `art/project-flight-blueprints-v1/${partId}.webp`;
