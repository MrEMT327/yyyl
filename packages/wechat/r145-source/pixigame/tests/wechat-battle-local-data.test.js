import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createWechatResources } from '../wechat/src/full/resources.js';
import { paceSortieData } from '../wechat/src/three/frame-artwork.js';
import { createBattleDataCache } from '../wechat/src/full/battle-data-cache.js';

const source = 'replica-battle/data/chapter1.json';
const remote = source + '.wx.gz';
const bundled = 'three-code-5/battle-data-chapter1.json.gz';
const cdn = 'https://cdn.example/game/';
const original = JSON.stringify({ chapter: 1, enemies: [11, 42] });
const arrayBuffer = input => Uint8Array.from(input).buffer;
const compressed = arrayBuffer(gzipSync(original));

function fixture({ pack = false, damaged = false, size = Buffer.byteLength(original) } = {}) {
  const requests = [], reads = [], loaded = [];
  const api = {
    getFileSystemManager: () => ({
      readFile({ filePath, success }) {
        reads.push(filePath);
        success({ data: damaged ? arrayBuffer([31, 139, 0]) : compressed });
      },
    }),
    request(options) { requests.push(options); return { abort() {} }; },
  };
  const resources = createWechatResources(api, {
    assetOrigin: 'https://game.example', cdnBase: cdn, requirePublicNetwork: true,
    cdnFiles: [remote], cacheVersion: 'test',
    assetTransfers: { [source]: { path: remote, encoding: 'gzip', bytes: size } },
    localFiles: pack ? { [source]: bundled } : {},
    loadPackage: async name => loaded.push(name),
  });
  return { resources, requests, reads, loaded };
}

test('uses the packaged gzip for first-chapter data with no network', async t => {
  const f = fixture({ pack: true });
  t.after(() => f.resources.dispose());
  assert(f.resources.isVersionedBattleData('/' + source));
  assert.equal(Buffer.from(await f.resources.readBytes('/' + source)).toString('utf8'), original);
  assert.deepEqual(f.loaded, ['three-code-5']);
  assert.deepEqual(f.reads, [bundled]);
  assert.deepEqual(f.requests, []);
});

test('damaged packaged gzip falls back to the original gzip over the CDN', async t => {
  const f = fixture({ pack: true, damaged: true });
  t.after(() => f.resources.dispose());
  const bytes = f.resources.readBytes('/' + source);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.requests[0].url, cdn + remote);
  f.requests[0].success({ statusCode: 200, data: compressed });
  assert.equal(Buffer.from(await bytes).toString('utf8'), original);
});

test('larger sortie data waits for separate paints and leaves queued work behind on abort', async t => {
  const data = JSON.stringify({ chart: 'x'.repeat(1024 * 1024) });
  const f = fixture({ size: Buffer.byteLength(data) });
  t.after(() => f.resources.dispose());
  const controller = new AbortController(), paints = [];
  const paceDataWork = paceSortieData(() => new Promise(resolve => paints.push(resolve)), controller.signal);
  const bytes = f.resources.readBytes('/' + source, { signal: controller.signal, paceDataWork });
  f.requests[0].success({ statusCode: 200, data: arrayBuffer(gzipSync(data)) });
  await new Promise(setImmediate);
  assert.equal(paints.length, 1);
  const queued = paceDataWork(1280 * 1024, () => assert.fail('aborted data reached the decoder'));
  const rejects = assert.rejects(queued, { name: 'AbortError' });

  await paceDataWork(128, () => assert.equal(paints.length, 1));
  paints.shift()();
  assert.equal(Buffer.from(await bytes).toString('utf8'), data);
  await new Promise(setImmediate);
  assert.equal(paints.length, 1);
  controller.abort();
  paints.shift()();
  await rejects;
  assert.equal(await paceDataWork(1280 * 1024, () => 'lobby data', { shared: true }), 'lobby data');
});

test('battle data cache freezes across frames before reusing the prepared result', async () => {
  const cache = createBattleDataCache(), signal = new AbortController().signal;
  const data = { rows: Array.from({ length: 400 }, () => ({ stats: { hp: 1 } })) };
  let frames = 0, time = 0;
  const options = { loadingFrame() { frames++; }, now: () => time += 9 };
  assert.equal(await cache.load(1, signal, async () => data, options), data);
  assert(frames > 1);
  assert(data.rows.every(row => Object.isFrozen(row) && Object.isFrozen(row.stats)));
  assert.equal(await cache.load(1, signal, () => assert.fail('cache miss')), data);
});

test('a timed-out static GET retries with a fresh key and shares the recovered cache', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(console, 'warn', () => {});
  const f = fixture();
  t.after(() => f.resources.dispose());
  const bytes = f.resources.readBytes('/' + source + '?legacy=1');
  assert.equal(f.requests[0].url, cdn + remote + '?legacy=1');
  f.requests[0].fail({ errMsg: 'request:fail timeout' });
  t.mock.timers.tick(400);
  assert.equal(f.requests.length, 2);
  const request = f.requests[1];
  const retried = new URL(request.url);
  assert.equal(retried.pathname, '/' + 'game/' + remote);
  assert.equal(retried.searchParams.get('legacy'), '1');
  assert(retried.searchParams.get('wx_asset_retry'));
  assert.equal(request.retryURL, undefined);
  request.success({ statusCode: 200, data: compressed });
  assert.equal(Buffer.from(await bytes).toString('utf8'), original);
  assert.equal(Buffer.from(await f.resources.readBytes('/' + source + '?legacy=1')).toString('utf8'), original);
  assert.equal(f.requests.length, 2);
});
