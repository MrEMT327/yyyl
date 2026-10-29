import manifest from '../public/art/aircraft-ui-v1/manifest.json' with {type:'json'};
const base=import.meta.env?.BASE_URL??'/';
export function aircraftUiImage(id,view='default'){
  const entry=manifest.entries[id];
  return entry?`${base}art/aircraft-ui-v1/${view==='equipment'?entry.hangar:view==='thumbnail'?entry.card:entry.preview||entry.card}`:null;
}
