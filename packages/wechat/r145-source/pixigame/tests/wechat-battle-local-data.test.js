import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { createWechatResources } from '../wechat/src/full/resources.js';

const source = 'replica-battle/data/chapter1.json';
const remote = source + '.wx.gz';
const bundled = 'three-code-5/battle-data-chapter1.json.gz';
const cdn = 'https://cdn.example/game/';
const original = JSON.stringify({ chapter: 1, enemies: [11, 42] });
const arrayBuffer = input => Uint8Array.from(input).buffer;
const compressed = arrayBuffer(gzipSync(original));

function fixture({ pack = false, damaged = false } = {}) {
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
    assetTransfers: { [source]: { path: remote, encoding: 'gzip', bytes: Buffer.byteLength(original) } },
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
