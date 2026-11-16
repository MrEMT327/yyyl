import { build } from 'esbuild';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants } from 'node:zlib';

const root = fileURLToPath(new URL('../../', import.meta.url));
const [target, rawOrigin = ''] = process.argv.slice(2);
if (!target || !rawOrigin) throw new Error('用法 node wechat/tools/build-preview.mjs <输出目录> <素材服务器地址>');
const output = resolve(target);
const parsedOrigin = new URL(rawOrigin);
if (!['http:', 'https:'].includes(parsedOrigin.protocol)) throw new Error('素材服务器地址需要 HTTP 或 HTTPS');
const origin = parsedOrigin.origin;
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const assets = new Map();
const deliveredAssets = await readdir(join(root, 'dist', 'assets'));
function track(name) {
  const file = deliveredAssets.find(file => file.startsWith(`${name}-`) && file.endsWith('.ogg'));
  if (!file) throw new Error(`素材服务缺少音乐 ${name}`);
  return `assets/${file}`;
}
const resources = { files: {}, art: {}, music: {
  fight: ['brain_fight', 'heart_fight', 'intestine_fight', 'liver_fight', 'lungs_fight', 'skin_fight', 'stomach_fight'].map(track),
  boss: track('heart_boss'),
} };
const sizes = { main: 0, 'lobby-code': 0 };
const singleLimit = 4_000_000;
const totalLimit = 20_000_000;
const brotli = { params: { [constants.BROTLI_PARAM_QUALITY]: 7 } };
const fromPublic = name => readFile(join(root, 'public', name));
const fromBattle = name => fromPublic(`replica-battle/data/${name}.json`);

function record(path, bytes, pack = 'main') {
  sizes[pack] = (sizes[pack] ?? 0) + bytes.length;
  assets.set(path, bytes);
}

const shared = [
  'chapters', 'assets', 'combat', 'effects-original', 'boss-animation', 'enemy-health-bars', 'beam-effects',
  'enemy-health-bars-chapters', 'npc-chapters', 'audio-chapters', 'effects-original-chapters',
  'enemy-local-animation-chapters', 'sword-original-effects', 'loadout-runtime', 'player-appearances', 'loadout-catalog',
];
const catalog = JSON.parse(await fromBattle('chapters'));
const bossModels = {};
let group = 1;

function packData(name, bytes) {
  const compressed = brotliCompressSync(bytes, brotli);
  let pack = `battle-data-${group}`;
  if ((sizes[pack] ?? 0) + compressed.length >= singleLimit) pack = `battle-data-${++group}`;
  const path = `data/${name}.json`;
  resources.files[path] = pack;
  record(`${pack}/${path}.br`, compressed, pack);
}

for (const name of shared) packData(name, await fromBattle(name));
for (const { id, chapterFile, geometryFile } of catalog.chapters) {
  packData(chapterFile, await fromBattle(chapterFile));
  packData(geometryFile, await fromBattle(geometryFile));
  const name = `sorties-v1/chapter-${id}`;
  const sortie = JSON.parse(await fromBattle(name));
  const models = Object.entries(sortie.bossAnimations.models);
  for (const [key, value] of models) {
    const previous = bossModels[key];
    if (previous && JSON.stringify(previous) !== JSON.stringify(value)) throw new Error(`Boss 动画数据不一致 ${key}`);
    bossModels[key] = value;
  }
  sortie.bossAnimations.models = models.map(([key]) => key);
  packData(name, Buffer.from(JSON.stringify(sortie)));
}
packData('shared-boss-models', Buffer.from(JSON.stringify(bossModels)));

// Local button faces and fighter art keep essential controls visible while
// the existing LAN asset server provides the higher-resolution art and video.
const localArt = [
  'art/psd-equipment-v1/button-gold.png', 'art/psd-buttons-v1/button-blue.png',
  'art/sortie-aircraft-front-v1/pilot-01.webp',
];
for (const path of localArt) {
  resources.art[path] = path;
  record(path, await fromPublic(path));
}
const artPack = 'art-local';
const artFiles = [
  'art/stage1-anime-v8/ocean.png', 'art/psd-main-v1/main-foreground-current-live-wallet.png',
  ...['shop','assembly','battle','research','supply'].map(name => `art/psd-main-v1/navigation/${name}.png`),
  ...['coins','diamonds','stamina'].flatMap(name => ['background','icon'].map(kind => `art/psd-main-v1/resources/${name}-${kind}.png`)),
  ...['shots/gun_shot','pickup_sound','shot_hit','upgrade_sound'].map(name => `audio/pathogenic/${name}.wav`),
];
for (const path of artFiles) {
  const packed = `${artPack}/${path}`;
  resources.art[path] = packed;
  record(packed, await fromPublic(path), artPack);
}

const options = {
  absWorkingDir: root, bundle: true, write: false, format: 'cjs', platform: 'browser',
  target: 'es2020', minify: true, legalComments: 'inline', logLevel: 'warning', loader: { '.css': 'empty' },
  define: { __WECHAT_ASSET_ORIGIN__: JSON.stringify(origin), __WECHAT_PACKAGE_RESOURCES__: JSON.stringify(resources),
    'import.meta.env.PROD': 'true', 'import.meta.env.BASE_URL': '"/"', 'import.meta.env.DEV': 'false',
    'import.meta.url': JSON.stringify(`${origin}/game.js`), 'import.meta.env': '{}' },
};
const [game, lobby] = await Promise.all([
  build({ ...options, entryPoints: ['wechat/src/game.js'], external: ['./lobby-code/lobby.js'] }),
  build({ ...options, entryPoints: ['wechat/src/lobby-entry.js'] }),
]);
record('game.js', game.outputFiles[0].contents);
record('lobby-code/lobby.js', lobby.outputFiles[0].contents, 'lobby-code');

const subpackages = Object.keys(sizes).filter(name => name !== 'main');
const sum = Object.values(sizes).reduce((a, b) => a + b, 0);
for (const [name, size] of Object.entries(sizes)) {
  if (size >= singleLimit) throw new Error(`${name} ${size} 字节，超过单包预算`);
}
if (sum >= totalLimit) throw new Error(`共 ${sum} 字节，超过总包预算`);

await mkdir(output, { recursive: true });
if ((await readdir(output)).length) throw new Error('请使用新的输出目录，避免混入旧构建');
async function save(path, data) {
  const destination = join(output, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, data);
}
for (const name of subpackages) await save(`${name}/game.js`, '// Loaded by WeChat before accessing this subpackage.\n');
for (const [path, contents] of assets) await save(path, contents);
await save('game.json', json({ deviceOrientation: 'portrait', showStatusBar: false,
  subpackages: subpackages.map(name => ({ name, root: `${name}/` })) }));
await save('project.config.json', json({ appid: 'wx0b821a6c8d36aed6', compileType: 'game',
  projectname: '少女航线 · 微信测试', libVersion: '3.8.0', setting: {
    urlCheck: parsedOrigin.protocol !== 'http:', es6: false, minified: false,
  } }));
await save('LICENSE-pako.txt', await readFile(join(root, 'node_modules/pako/LICENSE')));
console.log(json({ output, chapters: catalog.chapters.length, sizes, total: sum, assetOrigin: origin }));
