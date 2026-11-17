
import assert from 'node:assert/strict';
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { brotliCompressSync, brotliDecompressSync, constants } from 'node:zlib';

const root = fileURLToPath(new URL('../', import.meta.url));
const project = join(root, 'pixigame');
const inputs = join(root, 'build-inputs');
const baseline = join(inputs, 'r145-baseline');
const json = async file => JSON.parse(await readFile(file, 'utf8'));
const load = path => import(pathToFileURL(join(project, path)).href);
const slash = path => path.replaceAll('\\', '/');

export async function withPackageOutput(sourceRoot, outputArgument, build) {
  const fixedOutput = resolve(sourceRoot, '..', 'out', 'game');
  const requested = resolve(outputArgument || fixedOutput);
  const canReplace = relative(fixedOutput, requested) === '';
  if (canReplace) await mkdir(dirname(requested), { recursive: true });
  const parent = await realpath(dirname(requested));
  if (canReplace && relative(join(await realpath(resolve(sourceRoot, '..')), 'out'), parent) !== '') {
    throw new Error('微信固定输出的父目录必须位于 packages/wechat/out');
  }
  const output = join(parent, basename(requested));

  async function existingOutput() {
    const previous = await lstat(output).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (previous && (!canReplace || !previous.isDirectory())) {
      throw new Error('请指定一个新的输出目录 ' + output);
    }
    return previous;
  }

  await existingOutput();
  const work = await mkdtemp(join(parent, '.tmp-wechat-build-'));
  const entries = join(work, 'game');
  const previousGame = join(work, 'previous-game');
  let preservePrevious = false;
  try {
    const result = await build({ output, entries, compiled: join(work, 'runtime') });
    if (await existingOutput()) {
      await rename(output, previousGame);
      preservePrevious = true;
    }
    try {
      await rename(entries, output);
    } catch (error) {
      if (preservePrevious) {
        await rename(previousGame, output).catch(restoreError => {
          throw new AggregateError([error, restoreError], '旧包保存在 ' + previousGame);
        });
        preservePrevious = false;
      }
      throw error;
    }
    preservePrevious = false;
    return result;
  } finally {
    if (!preservePrevious) await rm(work, { recursive: true, force: true, maxRetries: 2 });
  }
}

async function buildWechatPackage({ output, entries, compiled }) {

  const [info, gameConfig, cdn, assetNames, dataLayout, runtimePackage] = await Promise.all([
    json(join(baseline, 'BUILD-INFO.json')), json(join(baseline, 'game.json')),
    json(join(inputs, 'cdn-manifest.json')), json(join(inputs, 'deployed-assets.json')),
    json(join(inputs, 'runtime-data-layout.json')), json(join(inputs, 'runtime-package.json')),
  ]);
  const origin = new URL(cdn.cdnBase).origin;
  assert.equal(new URL(cdn.cdnBase).protocol, 'https:');
  assert.equal(origin, info.assetOrigin);

  const { build } = createRequire(join(project, 'package.json'))('esbuild');
  const [{ buildSharedRuntimeSet }, { NATIVE_JS_TARGET, NATIVE_INJECT, assertNativePackage },
    { fingerprintNativeRuntime, rewriteNativeRuntimeRequires }, { assertReleaseAssets }] = await Promise.all([
    load('wechat/tools/runtime-build.mjs'), load('wechat/tools/native-syntax.mjs'),
    load('wechat/tools/runtime-identity.mjs'), load('tools/check-release-assets.mjs'),
  ]);

  await cp(baseline, entries, { recursive: true });

  function overrides(folder, paths) {
    return new Map(paths.map(path => [path, join(inputs, folder, path)]));
  }
  await buildSharedRuntimeSet(compiled, {
    origin, native: true, assetNames,
    lobbyOverrides: overrides('lobby-overrides', ['src/replica/project-aircraft-render.js']),
    battleOverrides: overrides('battle-overrides', ['src/replica/native-client-rules.js', 'src/replica/native-equipment-boxes.js']),
  });

  const modules = {};
  for (const [name, path] of [['lobby', 'lobby-code/lobby.js'], ['battle', 'battle-code/battle.js'], ['engine', 'battle-engine/phaser.js']]) {
    const script = await readFile(join(compiled, basename(path)), 'utf8');
    const { source, ...identity } = fingerprintNativeRuntime(script, path);
    modules[name] = identity;
    await writeFile(join(entries, identity.path), source, { flag: 'wx' });
  }
  const sameModules = Object.keys(modules).every(key => modules[key].sha256 === info.buildIdentity.modules[key].sha256);
  const buildId = sameModules ? info.buildIdentity.buildId : 'r145-source-' + new Date().toISOString();
  const buildIdentity = { buildId, modules };

  const combined = { ...await json(join(compiled, 'runtime-data.json')), 'package.json': runtimePackage };
  const remaining = new Set(Object.keys(combined));
  const brotli = { params: { [constants.BROTLI_PARAM_QUALITY]: 7 } };
  for (const [file, keys] of Object.entries(dataLayout)) {
    const data = Object.fromEntries(keys.map(key => {
      assert(remaining.delete(key), key);
      return [key, combined[key]];
    }));
    await writeFile(join(entries, file), brotliCompressSync(Buffer.from(JSON.stringify(data)), brotli));
  }
  assert.equal(remaining.size, 0);

  const presentationFile = join(entries, 'shared-data/presentation.json.br');
  const presentation = await readFile(join(compiled, 'presentation.json'));
  const samePresentation = brotliDecompressSync(await readFile(presentationFile)).equals(presentation);
  await writeFile(presentationFile, brotliCompressSync(presentation, brotli));

  const bootstrap = join(project, 'wechat/src/full/bootstrap.js');
  const resourceCall = 'createWechatResources(api,{assetOrigin:origin,loadPackage})';
  const resourceOptions = 'createWechatResources(api,{assetOrigin:origin,loadPackage,localFiles:__WECHAT_LOCAL_FILES__,cdnBase:__WECHAT_CDN_BASE__,assetTransfers:__WECHAT_ASSET_TRANSFERS__,requirePublicNetwork:true,cacheVersion:__WECHAT_CACHE_VERSION__})';
  const startup = rewriteNativeRuntimeRequires(await readFile(bootstrap, 'utf8'), modules);
  assert.equal(startup.split(resourceCall).length, 2);
  const define = {
    __WECHAT_ASSET_ORIGIN__: origin,
    __WECHAT_BUILD_IDENTITY__: buildIdentity,
    __WECHAT_CDN_BASE__: cdn.cdnBase,
    __WECHAT_CACHE_VERSION__: cdn.cacheVersion,
    __WECHAT_LOCAL_FILES__: info.localFiles,
    __WECHAT_ASSET_TRANSFERS__: cdn.transfers,
    __WECHAT_OPENING_PACKAGES__: ['opening-art'],
    __WECHAT_SPLIT_BATTLE_DATA__: true,
    __WECHAT_SPLIT_PORTRAIT_DATA__: true,
    __WECHAT_COMPAT_PROFILE__: false,
    __WECHAT_BATTLE_DIAGNOSTICS__: true,
  };
  const { outputFiles } = await build({
    absWorkingDir: project, stdin: { contents: startup.replace(resourceCall, resourceOptions), resolveDir: dirname(bootstrap), sourcefile: 'bootstrap.js' },
    bundle: true, minify: true, write: false, platform: 'browser', format: 'cjs', target: NATIVE_JS_TARGET, inject: NATIVE_INJECT,
    define: Object.fromEntries(Object.entries(define).map(([key, value]) => [key, JSON.stringify(value)])),
    external: ['canvas', './native-core/cubism.js', ...Object.values(modules).map(({ path }) => './' + path)],
  });
  assert.equal(outputFiles.length, 1);
  await writeFile(join(entries, 'game.js'), outputFiles[0].contents, { flag: 'wx' });

  const packageRoots = new Map(gameConfig.subpackages.map(({ root, name }) => [root.replace(/\/+$/, ''), name]));
  const packageBytes = Object.fromEntries(['main', ...packageRoots.values()].map(name => [name, 0]));
  for (const row of await readdir(entries, { recursive: true, withFileTypes: true })) {
    if (!row.isFile()) continue;
    const path = join(row.parentPath, row.name);
    const file = slash(relative(entries, path));
    if (file === 'BUILD-INFO.json') continue;
    packageBytes[packageRoots.get(file.split('/')[0]) || 'main'] += (await lstat(path)).size;
  }
  const totalBytes = Object.values(packageBytes).reduce((total, size) => total + size, 0);
  assert(totalBytes < 20_000_000, '小游戏工程超过 20 MB');
  assert(Object.values(packageBytes).every(size => size < 4_000_000), '小游戏分包超过 4 MB');
  const syntax = await assertNativePackage(entries);
  const privateAddress = /https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(?=[:/])/i;
  for (const { file } of syntax.files) assert(!privateAddress.test(await readFile(join(entries, file), 'utf8')), file);
  await writeFile(join(entries, 'BUILD-INFO.json'), JSON.stringify({
    ...info, buildIdentity, totalBytes, packageBytes, syntax,
    source: slash(relative(output, project)),
    cdn: { ...info.cdn, manifest: slash(relative(output, join(inputs, 'cdn-manifest.json'))) },
  }, null, 2) + '\n');
  await assertReleaseAssets({ shippingRoot: entries });
  return { output, buildId, modules, sameModules, samePresentation, totalBytes };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  console.log(JSON.stringify(await withPackageOutput(root, process.argv[2], buildWechatPackage)));
}
