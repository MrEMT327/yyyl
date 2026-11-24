import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetCache } from '../wechat/src/full/asset-cache.js';
import { createWechatResources } from '../wechat/src/full/resources.js';

const asset = 'replica-battle/assets/owned-enemies/elite-scatter-v1/parts.png';
const cdn = 'https://cdn.example/game/';
const userDirectory = 'wxfile://usr';

function fixture() {
  const downloads = [], requests = [], disk = new Map();
  const files = {
    mkdirSync() {},
    accessSync(path) { if (!disk.has(path)) throw new Error('Missing file'); },
    statSync(path) { return { size: disk.get(path)?.byteLength ?? 0 }; },
    unlinkSync(path) { disk.delete(path); },
    writeFileSync(path, bytes) { disk.set(path, bytes); },
  };
  const api = {
    env: { USER_DATA_PATH: userDirectory },
    getFileSystemManager: () => files,
    downloadFile(options) { downloads.push(options); return { abort() {} }; },
    request(options) { requests.push(options); return { abort() {} }; },
  };
  const resources = createWechatResources(api, {
    assetOrigin: 'https://game.example', cdnBase: cdn, requirePublicNetwork: true,
    cdnFiles: [asset],
    assetTransfers: { [asset]: { path: asset, encoding: 'identity', version: '3' } },
  });
  return { cache: createAssetCache(api, resources), resources, downloads, requests, disk };
}

for (const error of ['downloadFile:fail Error: aborted', 'downloadFile:fail errcode:-354 net::ERR_CONTENT_LENGTH_MISMATCH']) {
  test('recovers a truncated native image with a fresh CDN request and caches it: ' + error, async t => {
    const f = fixture();
    t.after(() => f.resources.dispose());
    const source = '/' + asset + '?quality=1';
    const expected = cdn + asset + '?quality=1&v=3';
    assert.equal(f.resources.resolve(source), expected);
    const file = f.cache.localFile(source);
    assert.equal(f.cache.localFile(source), file);
    assert.equal(f.downloads[0].url, expected);
    f.downloads[0].fail({ errMsg: error });
    assert.equal(f.requests.length, 1);
    const request = f.requests[0];
    const recovery = new URL(request.url);
    assert.equal(recovery.pathname, new URL(expected).pathname);
    assert.equal(recovery.searchParams.get('quality'), '1');
    assert.equal(recovery.searchParams.get('v'), '3');
    assert(recovery.searchParams.get('wx_asset_retry'));
    assert.equal(request.cache, 'no-store');
    assert.equal(request.responseType, 'arraybuffer');
    const bytes = Uint8Array.of(1, 2, 3).buffer;
    request.success({ statusCode: 200, data: bytes });
    const filePath = await file;
    assert.equal(f.disk.get(filePath), bytes);
    assert.equal(await f.cache.localFile(source), filePath);
    assert.equal(f.downloads.length, 1);
  });
}

test('explicit image cancellation does not start a recovery request', async t => {
  const f = fixture();
  t.after(() => f.resources.dispose());
  const file = f.cache.localFile('/' + asset);
  f.downloads[0].fail({ name: 'AbortError', errMsg: 'downloadFile:fail abort' });
  await assert.rejects(file, /abort/);
  assert.equal(f.requests.length, 0);
});
