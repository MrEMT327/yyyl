import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Offline art prep, not a runtime dependency. Provide a directory with
// @resvg/resvg-js and sharp installed, or resolve them normally.
const [dependencyDir] = process.argv.slice(2).filter(value => value !== '--apply');
const require = dependencyDir ? createRequire(join(resolve(dependencyDir), 'package.json')) : createRequire(import.meta.url);
const { Resvg } = require('@resvg/resvg-js');
const sharp = require('sharp');
const inputs = fileURLToPath(new URL('../build-inputs/', import.meta.url));
const h5 = resolve(inputs, '../../../../pixigame');
const directory = join(inputs, 'three-textures');
const manifestFile = join(directory, 'manifest.json');
const apply = process.argv.includes('--apply');
const sha = data => createHash('sha256').update(data).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const [before, cdn, skills, blueprints] = await Promise.all([
  readFile(manifestFile, 'utf8'), json(join(inputs, 'cdn-manifest.json')),
  json(join(h5, 'src/replica/skill-icon-art.json')),
  json(join(h5, 'public/art/project-research-blueprints-v2/manifest.json')),
]);
const manifest = JSON.parse(before);
const transfers = { ...cdn.transfers, ...cdn.three?.transfers };
const available = new Set([...cdn.entries, ...(cdn.three?.entries ?? []), ...(cdn.three?.uploads ?? [])].map(row => row.path));
const skillPaths = new Set(skills.assets.map(row => `art/${row.pack || 'battle-skill-icons-v4'}/${row.file}`));
const localImages = new Map((manifest.localImages ?? []).map(row => [row.path, row]));
const pngs = new Map();
for (const path of skillPaths) {
  if (available.has(transfers[path]?.path ?? path)) continue;
  assert.match(path, /^art\/(?:battle-skill-icons-v4|weapon-variant-skill-icons-v5)\/[\w-]+\.webp$/);
  const source = await readFile(join(h5, 'public', path));
  const info = await sharp(source).metadata();
  assert(info.format === 'webp' && info.width && info.height, path);
  // Some iOS releases cannot open a WebP from the packaged asset directory.
  // Change only the file format, never the decoded artwork.
  const png=await sharp(source).png({compressionLevel:9}).toBuffer();
  assert((await sharp(png).ensureAlpha().raw().toBuffer()).equals(await sharp(source).ensureAlpha().raw().toBuffer()),path);
  const file=sha(png).slice(0,20)+'.png';
  pngs.set(file,png);
  localImages.set(path, { path, sha256: sha(source), file });
}

const skillBytes=[...pngs.values()].reduce((sum,png)=>sum+png.length,0);
const rasters = new Map(manifest.rasters.map(row => [row.path, row]));
const sheets = [
  ...blueprints.assets.map(row => `art/project-research-blueprints-v2/${row.file}`),
  'art/project-equipment-blueprints-v2/equipment-blueprints.svg',
  'art/project-material-groups-v1/equipment-blueprints.svg',
  'art/project-material-groups-v1/research-blueprints.svg',
];
const render = svg => Buffer.from(new Resvg(svg, { font: { loadSystemFonts: false } }).render().asPng());
const weapons = new Set();
for (const path of sheets) {
  const source = await readFile(join(h5, 'public', path)), svg = source.toString('utf8');
  const embedded = [...new Set(svg.match(/data:image\/webp;base64,[\w+/=]+/g))];
  assert(embedded.length, path + ' 没有内嵌图案');
  let converted = svg;
  for (const uri of embedded) {
    const png = await sharp(Buffer.from(uri.split(',')[1], 'base64')).png().toBuffer();
    converted = converted.replaceAll(uri, 'data:image/png;base64,' + png.toString('base64'));
  }
  const png = render(converted), empty = render(svg.replaceAll(/<image\b[^>]*\/>/g, ''));
  assert(!png.equals(empty), path + ' 图纸丢失图案');
  if (path.startsWith('art/project-research-blueprints-v2/')) weapons.add(sha(png));
  const file = sha(png).slice(0, 20) + '.png';
  pngs.set(file, png);
  rasters.set(path, { path, file, svgSha256: sha(source) });
}
assert.equal(weapons.size, blueprints.assets.length, '科研图纸必须保留各自的武器图案');
const sort = (a, b) => a.path.localeCompare(b.path);
manifest.rasters = [...rasters.values()].sort(sort);
manifest.localImages = [...localImages.values()].sort(sort);
if (apply) {
  for (const [file, source] of pngs) {
    const dest = join(directory, file);
    await writeFile(dest, source, { flag: 'wx' }).catch(async error => {
      if (error.code !== 'EEXIST') throw error;
      assert(source.equals(await readFile(dest)), file);
    });
  }
  assert.equal(await readFile(manifestFile, 'utf8'), before, '微信纹理清单已被修改');
  const temp = manifestFile + '.' + process.pid + '.tmp';
  await writeFile(temp, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  await rename(temp, manifestFile);
}
console.log(JSON.stringify({ applied: apply, localSkillIcons: localImages.size, repairedSheets: sheets.length,
  uniqueWeaponSheets: weapons.size, skillBytes, rasterBytes: [...pngs.values()].reduce((sum, png) => sum + png.length, 0)-skillBytes }));
