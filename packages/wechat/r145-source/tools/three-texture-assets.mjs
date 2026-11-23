import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

export async function loadThreeTextureAssets(inputs, publicDirectory) {
  const directory = join(inputs, 'three-textures');
  const { rasters, fallbacks = [], localImages = [] } = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  const files = new Map();
  const aliases = {}, fallbackAliases = {};

  function add(path, source, expectedFile) {
    if (source.length < 24 || source.readUInt32BE(0) !== 0x89504e47) {
      throw new Error('无效的微信 PNG 纹理 ' + path);
    }
    const filename = 'texture-' + sha256(source).slice(0, 20) + '.png';
    if (!files.has(filename)) files.set(filename, { filename, source });
    if (filename !== 'texture-' + expectedFile) throw new Error('微信 PNG 纹理校验失败 ' + path);
    return filename;
  }

  async function readTexture(path, file) {
    if (!/^[a-f0-9]{20}\.png$/.test(file)) throw new Error('无效的微信纹理文件名 ' + file);
    return add(path, await readFile(join(directory, file)), file);
  }

  for (const { path, file, svgSha256 } of rasters) {
    const svg = await readFile(join(publicDirectory, path));
    if (sha256(svg) !== svgSha256) throw new Error('SVG 原件已更新，请同步微信 PNG 纹理 ' + path);
    aliases[path] = await readTexture(path, file);
  }
  for (const { path, sha256: expected, file } of localImages) {
    if (!/^art\/(?:battle-skill-icons-v4|weapon-variant-skill-icons-v5)\/[\w-]+\.webp$/.test(path) || Object.hasOwn(aliases, path)) {
      throw new Error('无效或重复的本地技能图标 ' + path);
    }
    const source = await readFile(join(publicDirectory, path));
    if (sha256(source) !== expected) throw new Error('技能图标原件已更新，请同步微信纹理 ' + path);
    aliases[path] = await readTexture(path, file);
  }
  for (const { path, file } of fallbacks) fallbackAliases[path] = await readTexture(path, file);
  const entries = [...files.values()];
  return { aliases, fallbackAliases, files: entries, bytes: entries.reduce((total, row) => total + row.source.length, 0) };
}

// IDs are selected dynamically, so a first-sortie network trace won't cover them.
export async function checkThreeUiTextureCoverage(h5, textures, cdnFiles, transfers) {
  const [icons, fleet, blueprints] = await Promise.all([
    'src/replica/skill-icon-art.json',
    'src/replica/native-fleet-skill-art.json',
    'public/art/project-research-blueprints-v2/manifest.json',
  ].map(async file => JSON.parse(await readFile(join(h5, file), 'utf8'))));
  const keys = [
    ...icons.assets.map(row => `art/${row.pack || 'battle-skill-icons-v4'}/${row.file}`),
    ...fleet.assets.map(row => `art/${fleet.pack}/${row.file}`),
    ...blueprints.assets.map(row => `art/project-research-blueprints-v2/${row.file}`),
    'art/project-equipment-blueprints-v2/equipment-blueprints.svg',
    'art/project-material-groups-v1/equipment-blueprints.svg',
    'art/project-material-groups-v1/research-blueprints.svg',
  ];
  for (const key of keys) {
    const local = textures.aliases[key];
    if (key.endsWith('.svg') ? !local?.endsWith('.png') : !local && !cdnFiles.has(transfers[key]?.path ?? key)) {
      throw new Error('微信技能/图纸贴图未覆盖 ' + key);
    }
  }
  return { skills: icons.assets.length, fleet: fleet.assets.length, blueprints: blueprints.assets.length + 3 };
}
