import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { recruitPreview as previewLayout } from '../../../../pixigame/src/three/game-screen/recruit-preview-atlas.js';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const supplyCanopyPath = 'art/project-supply-parachute-v2/canopy.webp';
const localBattleArt = new Set([supplyCanopyPath,
  'replica-battle/assets/project-airdrop-supply/airdrop-crate-front-v1.png',
  'replica-battle/assets/missile-v3/body.png',
  'replica-battle/assets/missile-v2/exhaust.png',
]);

export async function loadThreeTextureAssets(inputs, publicDirectory) {
  const directory = join(inputs, 'three-textures');
  const { rasters, fallbacks = [], localImages = [], recruitPreview } = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  const files = new Map();
  const aliases = {}, fallbackAliases = {};

  async function readTexture(path, file, format = 'png', size) {
    const pattern = new RegExp('^[a-f0-9]{20}\\.'+format+'$');
    if (!pattern.test(file)) throw new Error('无效的微信纹理文件名 ' + file);
    const source = await readFile(join(directory, file));
    const signature = source.length >= 30 && (format === 'jpg'
      ? source.readUInt16BE(0) === 0xffd8 && source.readUInt16BE(source.length - 2) === 0xffd9
      : source.readUInt32BE(0) === 0x89504e47 && source.readUInt32BE(4) === 0x0d0a1a0a &&
        source.toString('ascii',12,16) === 'IHDR' &&
        (!size || source.readUInt32BE(16) === size.width && source.readUInt32BE(20) === size.height));
    if (!signature || sha256(source).slice(0, 20) + '.' + format !== file) {
      throw new Error('微信纹理校验失败 ' + path);
    }
    const filename = 'texture-' + file;
    if (!files.has(filename)) files.set(filename, { filename, source });
    return filename;
  }

  for (const { path, file, svgSha256 } of rasters) {
    const svg = await readFile(join(publicDirectory, path));
    if (sha256(svg) !== svgSha256) throw new Error('SVG 原件已更新，请同步微信 PNG 纹理 ' + path);
    aliases[path] = await readTexture(path, file);
  }
  for (const { path, sha256: expected, file } of localImages) {
    const skill = /^art\/(?:battle-skill-icons-v4|weapon-variant-skill-icons-v5)\/[\w-]+\.webp$/.test(path);
    const pageArt = /^art\/three-ui\/three-art-[a-f0-9]{12}\.png$/.test(path);
    if ((!skill && !pageArt && !localBattleArt.has(path)) || Object.hasOwn(aliases, path)) {
      throw new Error('无效或重复的本地微信图片 ' + path);
    }
    const source = await readFile(join(publicDirectory, path));
    if (sha256(source) !== expected) throw new Error('图片原件已更新，请同步微信纹理 ' + path);
    aliases[path] = await readTexture(path, file, pageArt ? 'jpg' : 'png');
  }
  for (const { path, file } of fallbacks) fallbackAliases[path] = await readTexture(path, file);
  if (recruitPreview) {
    const {path,file,layoutSha256,sources}=recruitPreview;
    if (path!==previewLayout.path || sources.length!==3*previewLayout.tiles.size ||
        layoutSha256!==sha256(JSON.stringify([...previewLayout.tiles]))) throw new Error('微信招募预览清单无效');
    for (const item of sources) {
      if (!/^art\/(?:recruit-portraits-v2\/pilot-\d{2}|three-ui\/three-art-[a-f0-9]{12})\.png$/.test(item.path)) {
        throw new Error('无效的招募预览原图路径 '+item.path);
      }
      if (sha256(await readFile(join(publicDirectory,item.path)))!==item.sha256) {
        throw new Error('招募原图已更新，请同步微信预览 '+item.path);
      }
    }
    aliases[path]=await readTexture(path,file,'png',previewLayout);
  }
  const entries = [...files.values()];
  return { aliases, fallbackAliases, files: entries, bytes: entries.reduce((total, row) => total + row.source.length, 0) };
}

// IDs are selected dynamically, so a first-sortie network trace won't cover them.
export async function checkThreeUiTextureCoverage(h5, textures, cdnFiles, transfers) {
  for (const key of [previewLayout.path, supplyCanopyPath]) {
    if (!textures.aliases[key]?.endsWith('.png')) throw new Error('微信包内缺少 PNG 贴图 ' + key);
  }
  const [icons, fleet, blueprints, recruits] = await Promise.all([
    'src/replica/skill-icon-art.json',
    'src/replica/native-fleet-skill-art.json',
    'public/art/project-research-blueprints-v2/manifest.json',
    'public/art/recruit-portraits-v2/manifest.json',
  ].map(async file => JSON.parse(await readFile(join(h5, file), 'utf8'))));
  const keys = [
    ...icons.assets.map(row => `art/${row.pack || 'battle-skill-icons-v4'}/${row.file}`),
    ...fleet.assets.map(row => `art/${fleet.pack}/${row.file}`),
    ...blueprints.assets.map(row => `art/project-research-blueprints-v2/${row.file}`),
    ...recruits.entries.map(row => `art/recruit-portraits-v2/${row.file}`),
    'art/project-equipment-blueprints-v2/equipment-blueprints.svg',
    'art/project-material-groups-v1/equipment-blueprints.svg',
    'art/project-material-groups-v1/research-blueprints.svg',
  ];
  for (const key of keys) {
    const local = textures.aliases[key];
    if (key.endsWith('.svg') ? !local?.endsWith('.png') : !local && !cdnFiles.has(transfers[key]?.path ?? key)) {
      throw new Error('微信界面贴图未覆盖 ' + key);
    }
  }
  return { skills: icons.assets.length, fleet: fleet.assets.length, blueprints: blueprints.assets.length + 3 };
}
