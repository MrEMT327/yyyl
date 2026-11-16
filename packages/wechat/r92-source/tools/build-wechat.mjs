import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, lstat, rename, rm, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { brotliCompressSync, constants } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const project = join(root, 'pixigame');
const baseline = join(root, 'build-inputs', 'r92-baseline');
const manifestPath = join(root, 'build-inputs', 'cdn-manifest.json');
const output = resolve(process.argv[2] || join(root, 'wechat-build'));
const parent = dirname(output);
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const writeJson = (file, value) => writeFile(file, JSON.stringify(value, null, 2) + '\n');
const load = file => import(pathToFileURL(join(project, file)));

async function requireNewOutput() {
  const existing = await lstat(output).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (existing) throw new Error('请指定一个新目录，输出目录已存在 ' + output);
}

await requireNewOutput();
const baselineInfo = await readJson(join(baseline, 'BUILD-INFO.json'));
const gameConfig = await readJson(join(baseline, 'game.json'));
const projectConfig = await readJson(join(baseline, 'project.config.json'));
const assetNames = await readJson(join(root, 'build-inputs', 'deployed-assets.json'));
const cdn = await readJson(manifestPath);
const cdnBase = cdn.cdnBase;
const origin = new URL(cdnBase).origin;
assert.equal(new URL(cdnBase).protocol, 'https:');
assert.match(cdn.cacheVersion, /^[a-f0-9]{64}$/);
assert(cdnBase.endsWith('/'));

const { build } = createRequire(join(project, 'package.json'))('esbuild');
const { buildSharedRuntimeSet } = await load('wechat/tools/runtime-build.mjs');
const { NATIVE_JS_TARGET, NATIVE_INJECT, assertNativePackage } = await load('wechat/tools/native-syntax.mjs');
const { wrapNativeCubismCore } = await load('wechat/tools/cubism-native.mjs');
const { fingerprintNativeRuntime, rewriteNativeRuntimeRequires } = await load('wechat/tools/runtime-identity.mjs');
const { assertReleaseAssets, assertReleaseBytes, releaseAssetIndex } = await load('tools/check-release-assets.mjs');
const { skillArtInventory, assertSkillArtCoverage } = await load('wechat/tools/skill-art-inventory.mjs');
const index = await releaseAssetIndex();

const assetTransfers = cdn.transfers;
const cdnKeys = cdn.entries.map(row => row.path);
const cdnKeySet = new Set(cdnKeys);
assert.equal(cdnKeySet.size, cdnKeys.length);
for (const { path, sha256 } of cdn.entries) {
  assert.match(path, /^(art|assets|audio|fighters|replica-battle|licenses)\//);
  assert(!path.split('/').includes('..') && !path.includes(':'), path);
  assert.match(sha256, /^[a-f0-9]{64}$/);
}

const buildId = 'r92-' + new Date().toISOString();
const modules = {};
const buildIdentity = { buildId, modules };
const localFiles = baselineInfo.localFiles;
// r92 added the deferred lobby backdrops and blueprint icons after compilation.
const compiledLocalFiles = Object.fromEntries(Object.entries(localFiles)
  .filter(([, file]) => !file.startsWith('lobby-backgrounds/') && !file.startsWith('opening-art/art/project-research-blueprints-v2/')));
const packNames = gameConfig.subpackages.map(pack => pack.name);
const packageBytes = Object.fromEntries(['main', ...packNames].map(name => [name, 0]));
const options = { assetOrigin: origin, cdnBase, localFiles, assetTransfers, requirePublicNetwork: true };
const requiredSkillArtwork = assertSkillArtCoverage({ localFiles, cdnKeys, assetTransfers });
const packagedSkills = skillArtInventory().filter(({ kind, path }) => kind === 'skill' && localFiles[path]);

await mkdir(parent, { recursive: true });
const work = await mkdtemp(join(parent, '.wechat-build-'));
assert.equal(dirname(work), parent);
assert(basename(work).startsWith('.wechat-build-'));
const game = join(work, 'game');
const compiled = join(work, 'runtime');

async function writePackFile(file, bytes) {
  const slash = file.indexOf('/');
  const pack = slash === -1 ? 'main' : file.slice(0, slash);
  assert(Object.hasOwn(packageBytes, pack), file);
  assert(!file.split('/').includes('..') && !file.includes('\\') && !file.includes(':'), file);
  const path = join(game, file);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes, { flag: 'wx' });
  packageBytes[pack] += Buffer.byteLength(bytes);
}

try {
  for (const pack of packNames) {
    assert.match(pack, /^[a-z0-9-]+$/);
    const file = pack + '/game.js';
    await writePackFile(file, await readFile(join(baseline, file)));
  }
  for (const file of new Set(Object.values(localFiles))) {
    const bytes = await readFile(join(baseline, file));
    assertReleaseBytes(file, bytes, index);
    await writePackFile(file, bytes);
  }

  await buildSharedRuntimeSet(compiled, { origin, native: true, assetNames });
  for (const [name, pack, script] of [
    ['lobby', 'lobby-code', 'lobby.js'],
    ['battle', 'battle-code', 'battle.js'],
    ['engine', 'battle-engine', 'phaser.js'],
  ]) {
    const text = await readFile(join(compiled, script), 'utf8');
    const { source, ...identity } = fingerprintNativeRuntime(text, pack + '/' + script);
    modules[name] = identity;
    await writePackFile(identity.path, source);
  }

  const sharedData = await readJson(join(compiled, 'lobby-data.json'));
  const battleData = await readJson(join(compiled, 'battle-data.json'));
  const combinedData = await readJson(join(compiled, 'runtime-data.json'));
  const portraitData = {};
  for (const name of ['src/ui/blue-ponytail-eye-lids.json', 'src/ui/blue-ponytail-neck-planes.json']) {
    assert(Object.hasOwn(sharedData, name), name);
    portraitData[name] = sharedData[name];
    delete sharedData[name];
  }
  assert(!Object.keys(battleData).some(name => Object.hasOwn(sharedData, name) || Object.hasOwn(portraitData, name)));
  assert.deepEqual({ ...sharedData, ...battleData, ...portraitData }, combinedData);
  for (const [name, value] of Object.entries(combinedData)) {
    assertReleaseBytes(name.replace(/^public\//, ''), Buffer.from(JSON.stringify(value)), index);
  }

  const presentation = await readFile(join(compiled, 'presentation.json'));
  const presentationData = JSON.parse(presentation);
  for (const field of ['lobbyMarkup', 'battleMarkup']) {
    assertReleaseBytes(field + '.html', Buffer.from(presentationData[field]), index);
  }
  const sharedBytes = Buffer.from(JSON.stringify(sharedData));
  const battleBytes = Buffer.from(JSON.stringify(battleData));
  const portraitBytes = Buffer.from(JSON.stringify(portraitData));
  const brotliOptions = { params: { [constants.BROTLI_PARAM_QUALITY]: 7 } };
  for (const [file, bytes] of [
    ['shared-data/presentation.json.br', presentation],
    ['shared-data/runtime-data.json.br', sharedBytes],
    ['battle-data/runtime-data.json.br', battleBytes],
    ['portrait-data/runtime-data.json.br', portraitBytes],
  ]) {
    await writePackFile(file, brotliCompressSync(bytes, brotliOptions));
  }

  const core = await readFile(join(project, 'public/art/live2d-runtime/live2dcubismcore.min.js'), 'utf8');
  await writePackFile('native-core/cubism.js', wrapNativeCubismCore(core));
  const yoga = await readFile(join(project, 'node_modules/yoga-layout/dist/binaries/yoga-wasm-base64-esm.js'), 'utf8');
  const wasm = /data:application\/octet-stream;base64,([A-Za-z0-9+/=]+)/.exec(yoga)?.[1];
  assert(wasm, 'Missing Yoga WASM');
  await writePackFile('native-core/yoga.wasm', Buffer.from(wasm, 'base64'));

  const resourcePlugin = {
    name: 'wechat-cdn-resources',
    setup(builder) {
      builder.onLoad({ filter: /[/\\]wechat[/\\]src[/\\]full[/\\]bootstrap\.js$/ }, async ({ path }) => {
        const script = rewriteNativeRuntimeRequires(await readFile(path, 'utf8'), modules);
        const before = 'createWechatResources(api,{assetOrigin:origin,loadPackage})';
        const after = 'createWechatResources(api,{assetOrigin:origin,loadPackage,localFiles:__WECHAT_LOCAL_FILES__,cdnBase:__WECHAT_CDN_BASE__,assetTransfers:__WECHAT_ASSET_TRANSFERS__,requirePublicNetwork:true,cacheVersion:__WECHAT_CACHE_VERSION__})';
        assert.equal(script.split(before).length, 2, '微信资源配置的注入位置已改变');
        return { contents: script.replace(before, () => after), loader: 'js', resolveDir: dirname(path) };
      });
    },
  };
  const buildOptions = {
    absWorkingDir: project, bundle: true, platform: 'browser', format: 'cjs',
    target: NATIVE_JS_TARGET, inject: NATIVE_INJECT,
  };
  const main = await build({
    ...buildOptions,
    entryPoints: ['wechat/src/full/bootstrap.js'],
    outfile: join(game, 'game.js'), minify: true, write: false,
    plugins: [resourcePlugin],
    external: ['canvas', './native-core/cubism.js', ...Object.values(modules).map(row => './' + row.path)],
    define: {
      __WECHAT_SPLIT_BATTLE_DATA__: 'true',
      __WECHAT_SPLIT_PORTRAIT_DATA__: 'true',
      __WECHAT_OPENING_PACKAGES__: JSON.stringify(['opening-art']),
      __WECHAT_CACHE_VERSION__: JSON.stringify(cdn.cacheVersion),
      __WECHAT_ASSET_ORIGIN__: JSON.stringify(origin),
      __WECHAT_BUILD_IDENTITY__: JSON.stringify(buildIdentity),
      __WECHAT_LOCAL_FILES__: JSON.stringify(compiledLocalFiles),
      __WECHAT_CDN_BASE__: JSON.stringify(cdnBase),
      __WECHAT_ASSET_TRANSFERS__: JSON.stringify(assetTransfers),
    },
  });
  assert.equal(main.outputFiles.length, 1);
  const compiledMapping = JSON.stringify(compiledLocalFiles);
  const mainScript = main.outputFiles[0].text;
  assert.equal(mainScript.split(compiledMapping).length, 2, '微信本地素材映射应出现一次');
  await writePackFile('game.js', mainScript.replace(compiledMapping, () => JSON.stringify(localFiles)));

  // Verify the same packaged and CDN paths the generated runtime will resolve.
  const resourceCheck = join(work, 'resources.cjs');
  await build({ ...buildOptions, entryPoints: ['wechat/src/full/resources.js'], outfile: resourceCheck });
  const { createWechatResources } = createRequire(import.meta.url)(resourceCheck);
  const resources = createWechatResources({ getFileSystemManager: () => ({}) }, options);
  try {
    for (const { path } of cdn.logicalEntries) {
      const key = assetTransfers[path]?.path || path;
      assert(cdnKeySet.has(key), key);
      const url = new URL(key.split('/').map(encodeURIComponent).join('/'), cdnBase).href;
      assert.equal(resources.resolve(origin + '/' + path + '?v=2#asset'), localFiles[path] || url + '?v=2#asset');
      assert.equal(resources.resolve('/' + path, origin + '/replica-battle/'), localFiles[path] || url);
    }
    for (const [key, file] of Object.entries(localFiles)) {
      assert.equal(resources.resolve('/' + key + '?v=2'), file);
      assert((await stat(join(game, file))).isFile(), file);
    }
  } finally {
    resources.dispose();
  }

  await writePackFile('game.json', JSON.stringify(gameConfig, null, 2) + '\n');
  await writePackFile('project.config.json', JSON.stringify(projectConfig, null, 2) + '\n');
  const total = Object.values(packageBytes).reduce((sum, size) => sum + size, 0);
  assert(Object.values(packageBytes).every(size => size < 4_000_000), '单包体积超过 r92 构建限制');
  assert(total < 20_000_000, '总包体积超过 r92 构建限制');
  const syntax = await assertNativePackage(game);
  const privateAddress = /https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(?=[:/])/i;
  for (const row of syntax.files) {
    assert(!privateAddress.test(await readFile(join(game, row.file), 'utf8')), row.file);
  }
  assert(!privateAddress.test(presentation.toString()) && !privateAddress.test(JSON.stringify(combinedData)));
  const skillArtwork = packagedSkills.map(({ path }) => {
    const baselineArt = baselineInfo.skillArtwork.find(row => row.path === path);
    return { ...baselineArt, path, packagedPath: localFiles[path] };
  });

  await writeJson(join(game, 'BUILD-INFO.json'), {
    ...baselineInfo,
    builtAt: new Date().toISOString(),
    buildIdentity,
    source: relative(output, project).replaceAll('\\', '/'),
    cdn: {
      baseURL: cdnBase, objectCount: cdnKeys.length, logicalPaths: cdn.logicalEntries.length, bytes: cdn.bytes,
      manifest: relative(output, manifestPath).replaceAll('\\', '/'),
    },
    assetOrigin: origin,
    performance: {
      ...baselineInfo.performance,
      cacheVersion: cdn.cacheVersion,
      startupData: {
        combinedJsonBytes: Buffer.byteLength(JSON.stringify(combinedData)),
        lobbyJsonBytes: sharedBytes.length,
        battleOnlyJsonBytes: battleBytes.length,
        portraitOnlyJsonBytes: portraitBytes.length,
        lobbyEntries: Object.keys(sharedData).length,
        battleOnlyEntries: Object.keys(battleData).length,
        portraitOnlyEntries: Object.keys(portraitData).length,
        deferredSkillBytes: skillArtwork.reduce((sum, row) => sum + row.bytes, 0),
      },
    },
    skillArtwork,
    skillArtCoverage: {
      required: requiredSkillArtwork.length,
      packaged: skillArtwork.length,
      cdn: requiredSkillArtwork.length - skillArtwork.length,
    },
    packageBytes,
    totalBytes: total,
    syntax,
  });
  const review = await assertReleaseAssets({ shippingRoot: game });
  assert(review.bytes < 20_000_000 && review.bytes - total + packageBytes.main < 4_000_000);
  await requireNewOutput();
  await rename(game, output);
  console.log(JSON.stringify({ output, buildId, totalBytes: total, scriptsChecked: syntax.files.length, cdnPathsChecked: cdn.logicalEntries.length }, null, 2));
} finally {
  await rm(work, { recursive: true, force: true });
}
