// Resource-like ink, bevels and directional lighting; no monochrome CSS filter.
let serial = 0;
export function materialIcon(name, cls = '') {
  if (!['parts','shard','weaponParts','aircraftShards'].includes(name)) return '';
  const shard = name === 'shard' || name === 'aircraftShards', id = `material-${++serial}`;
  const gear = 'M27 5H42L45 13L52 17L61 16L68 29L62 36L61 43L65 51L53 61L44 57L36 59L30 66L16 61L16 51L11 44L3 41L5 26L14 22L20 16Z';
  const body = shard
    ? `<path d="M24 5L51 15L63 45L32 66L8 46Z" fill="#482274"/><path d="M24 4L51 14L59 42L30 61L9 42Z" fill="url(#${id})"/><g stroke="#48205e" stroke-width="1.5"><path d="M24 4L29 25L51 14Z" fill="#ffeaff"/><path d="M9 42L29 25L24 4Z" fill="#da8aff"/><path d="M29 25L51 14L59 42Z" fill="#a641e5"/><path d="M29 25L30 61L59 42Z" fill="#8031d5"/><path d="M9 42L30 61L29 25Z" fill="#bd6cff"/></g><path d="M24 9L28 23L47 16M14 40L27 29" fill="none" stroke="#fff3ff" stroke-width="2.5"/><path d="M37 37L42 39L38 43L33 42Z" fill="#fceaff" stroke="none"/>`
    : `<path d="${gear}" transform="translate(0 2)" fill="#153954"/><path d="${gear}" fill="url(#${id})"/><path d="M29 9H39L42 17L50 21L58 20L63 29L58 34" fill="none" stroke="#e7fcff" stroke-width="2.5"/><path d="M60 45L60 50L52 56L44 53L34 56L28 61L20 57" fill="none" stroke="#22638c" stroke-width="3"/><circle cx="35" cy="35" r="17" fill="#0e344f"/><circle cx="35" cy="34" r="13" fill="#3abce9" stroke="#dafaff" stroke-width="2"/><path d="M26 27L34 22L43 27L45 35L37 43L28 39Z" fill="#93eeff" stroke="none"/><path d="M27 28L33 25L40 27" fill="none" stroke="#fff" stroke-width="2.5"/>`;
  return `<svg class="resource-icon ${cls}" viewBox="0 0 74 74" aria-hidden="true" focusable="false"><defs><linearGradient id="${id}" x1="0" y1="0" x2=".65" y2="1"><stop stop-color="${shard?'#ffe6ff':'#e1fbff'}"/><stop offset=".38" stop-color="${shard?'#d778ff':'#7bdeff'}"/><stop offset=".58" stop-color="${shard?'#a443e5':'#3ea7df'}"/><stop offset="1" stop-color="${shard?'#6920b6':'#225481'}"/></linearGradient></defs><g transform="translate(2 1)" stroke="#071321" stroke-width="3.3" stroke-linejoin="round" stroke-linecap="round">${body}</g></svg>`;
}

export function illustratedGlyph(paths, cls = '') {
  const id = `glyph-${++serial}`, defs = [];
  const colored = paths.replace(/fill="(#[0-9a-f]{6})"/gi, (_, color) => {
    const n = parseInt(color.slice(1),16), rgb = [n>>16,(n>>8)&255,n&255];
    const shade = (mix,target) => '#'+rgb.map(c=>Math.round(c+(target-c)*mix).toString(16).padStart(2,'0')).join('');
    const key = `${id}-${defs.length}`;
    defs.push(`<linearGradient id="${key}" x2=".4" y2="1"><stop stop-color="${shade(.65,255)}"/><stop offset=".42" stop-color="${color}"/><stop offset=".48" stop-color="${shade(.1,0)}"/><stop offset="1" stop-color="${shade(.35,0)}"/></linearGradient>`);
    return `fill="url(#${key})"`;
  });
  return `<svg class="pl-icon ${cls}" viewBox="-2 -2 28 28" fill="none" stroke="#091522" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><defs>${defs.join('')}</defs>${colored}</svg>`;
}
