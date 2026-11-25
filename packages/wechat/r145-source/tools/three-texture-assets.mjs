import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const startupBackdrop = 'art/entry-screens-v4/startup-wechat.jpg';
const startupArt = new Map([
  [startupBackdrop, 'jpg'],
  ['art/psd-combat-v1/health-track.png', 'png'],
  ['art/psd-combat-v1/health-fill.png', 'png'],
]);
const sortieArt = new Map([
  ['art/sortie-hangar-v1/shaft-section.webp', 'jpg'],
  ['art/sortie-hangar-v1/lift-front.webp', 'png'],
  ['art/three-ui/three-art-97c5902d1541.png', 'png'],
  ['replica-battle/assets/owned-enemies/elite-scatter-v1/parts.png', 'png'],
]);
const supplyCanopyPath = 'art/project-supply-parachute-v2/canopy.webp';
const warningArt = ['boss-dark-edge', 'elite'].map(name => 'art/project-encounter-warnings-v3/' + name + '.png');
const localBattleArt = new Set([supplyCanopyPath, ...warningArt,
  'replica-battle/assets/project-airdrop-supply/airdrop-crate-front-v1.png',
  'replica-battle/assets/missile-v3/body.png',
  'replica-battle/assets/missile-v2/exhaust.png',
]);

export async function loadThreeTextureAssets(inputs, publicDirectory) {
  const directory = join(inputs, 'three-textures');
  const { rasters, fallbacks = [], localImages = [] } = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
  const files = new Map();
  const aliases = {}, fallbackAliases = {};

  async function readTexture(path, file, format = 'png') {
    const pattern = new RegExp('^[a-f0-9]{20}\\.'+format+'$');
    if (!pattern.test(file)) throw new Error('无效的微信纹理文件名 ' + file);
    const source = await readFile(join(directory, file));
    const signature = source.length >= 30 && (format === 'jpg'
      ? source.readUInt16BE(0) === 0xffd8 && source.readUInt16BE(source.length - 2) === 0xffd9
      : source.readUInt32BE(0) === 0x89504e47 && source.readUInt32BE(4) === 0x0d0a1a0a &&
        source.toString('ascii',12,16) === 'IHDR');
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
    const localFormat = startupArt.get(path) ?? sortieArt.get(path);
    if ((!skill && !pageArt && !localFormat && !localBattleArt.has(path)) || Object.hasOwn(aliases, path)) {
      throw new Error('无效或重复的本地微信图片 ' + path);
    }
    const original = path === startupBackdrop ? 'art/entry-screens-v4/startup.png' : path;
    const source = await readFile(join(publicDirectory, original));
    if (sha256(source) !== expected) throw new Error('图片原件已更新，请同步微信纹理 ' + path);
    const format = localFormat ?? (pageArt ? 'jpg' : 'png');
    aliases[path] = await readTexture(path, file, format);
  }
  for (const { path, file } of fallbacks) fallbackAliases[path] = await readTexture(path, file);
  const entries = [...files.values()];
  return { aliases, fallbackAliases, files: entries, bytes: entries.reduce((total, row) => total + row.source.length, 0) };
}

// IDs are selected dynamically, so a first-sortie network trace won't cover them.
export async function checkThreeUiTextureCoverage(h5, textures, cdnFiles, transfers) {
  for (const [path, format] of startupArt) {
    if (!textures.aliases[path]?.endsWith('.' + format)) throw new Error('微信包内缺少启动贴图 ' + path);
  }
  for (const [path, format] of sortieArt) {
    if (!textures.aliases[path]?.endsWith('.' + format)) throw new Error('微信包内缺少出击贴图 ' + path);
  }
  if (!textures.aliases[supplyCanopyPath]?.endsWith('.png')) throw new Error('微信包内缺少 PNG 贴图 ' + supplyCanopyPath);
  for (const path of warningArt) {
    if (!textures.aliases[path]?.endsWith('.png')) throw new Error('微信包内缺少警示贴图 ' + path);
  }
  const [icons, fleet, blueprints, recruits, menuArt] = await Promise.all([
    'src/replica/skill-icon-art.json',
    'src/replica/native-fleet-skill-art.json',
    'public/art/project-research-blueprints-v2/manifest.json',
    'public/art/recruit-portraits-v2/manifest.json',
    'src/three/game-screen/menu-art.json',
  ].map(async file => JSON.parse(await readFile(join(h5, file), 'utf8'))));
  const keys = [
    ...icons.assets.map(row => `art/${row.pack || 'battle-skill-icons-v4'}/${row.file}`),
    ...fleet.assets.map(row => `art/${fleet.pack}/${row.file}`),
    ...blueprints.assets.map(row => `art/project-research-blueprints-v2/${row.file}`),
    ...recruits.entries.map(row => `art/recruit-portraits-v2/${row.file}`),
    ...Object.entries(menuArt).filter(([key])=>key.startsWith('roster-')).map(([,url])=>url.slice(1)),
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
