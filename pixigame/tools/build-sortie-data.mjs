import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';

// The extraction tools retain the complete source tables. Ship a lossless
// projection for each playable chapter, so entering one never parses all 60.
const source = new URL('../public/replica-battle/data/', import.meta.url);
const output = new URL('sorties-v1/', source);
const read = async name => JSON.parse(await readFile(new URL(name + '.json', source), 'utf8'));
const [catalog, assets, maps, bosses, base, loadout] = await Promise.all([
  'chapters', 'assets-chapters', 'map-layers', 'boss-animation-chapters', 'assets', 'loadout-runtime',
].map(read));
await mkdir(output, { recursive: true });

async function writeBundle(name, contents) {
  const path = new URL(name, output);
  const previous = await readFile(path).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (previous?.equals(contents)) return;
  // Keep the dev service able to read the previous complete file.
  const pending = new URL(`__${process.pid}-${name}.tmp`, output);
  await writeFile(pending, contents);
  await rename(pending, path);
}

const equipmentCatalog = await readFile(new URL('loadout-catalog.json', source));
const compressedCatalog = gzipSync(equipmentCatalog, {level:9});
await writeBundle('loadout-catalog.json.gz', compressedCatalog);
console.log(`Packed loadout catalog (${equipmentCatalog.length} → ${compressedCatalog.length} bytes)`);

let bytes = 0;
for (const {id, chapterFile} of catalog.chapters) {
  const extra = assets.chapters[id], nativeLayers = maps.chapters[id];
  if (!Number.isSafeInteger(id) || id < 1 || !extra || !nativeLayers)
    throw new Error(`Incomplete sortie assets for chapter ${id}`);
  // The renderer can only build models from the merged prefab catalog.
  // Keep animations reached by either a prefab or a native entity binding.
  const chapter = await read(chapterFile);
  const entities = Object.fromEntries(Object.entries(bosses.entities).filter(([id, name]) =>
    Object.hasOwn(base.prefabs, name) || Object.hasOwn(loadout.assets.prefabs, name) ||
    Object.hasOwn(extra.prefabs, name) || Object.hasOwn(chapter.entities, id)));
  const reachable = new Set([...Object.keys(base.prefabs), ...Object.keys(loadout.assets.prefabs),
    ...Object.keys(extra.prefabs), ...Object.values(entities)]);
  const models = Object.fromEntries(Object.entries(bosses.models).filter(([name]) => reachable.has(name)));
  const bossAnimations = {...bosses, entities, models};
  const name = `chapter-${id}.json`;
  const contents = JSON.stringify({chapterId:id,extra,nativeLayers,bossAnimations}) + '\n';
  const data = Buffer.from(contents);
  await writeBundle(name, data);
  bytes += data.length;
}
console.log(`Prepared ${catalog.chapters.length} chapter resource bundles (${bytes} bytes)`);
