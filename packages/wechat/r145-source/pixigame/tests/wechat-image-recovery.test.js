import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetCache } from '../wechat/src/full/asset-cache.js';
import { createWechatResources } from '../wechat/src/full/resources.js';
import { isIncompleteDownload } from '../wechat/src/full/transport.js';
import { createArtworkLoader } from '../../../../../pixigame/src/three/game-screen/image-loading.js';

const asset = 'replica-battle/assets/owned-enemies/elite-scatter-v1/parts.png';
const cdn = 'https://cdn.example/game/';
const userDirectory = 'wxfile://usr';

function fixture(assetKey = asset, cacheOptions) {
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
    cdnFiles: [assetKey],
    assetTransfers: { [assetKey]: { path: assetKey, encoding: 'identity', version: '3' } },
  });
  return { cache: createAssetCache(api, resources, cacheOptions), resources, downloads, requests, disk };
}

const incomplete = 'downloadFile:fail errcode:-354 net::ERR_CONTENT_LENGTH_MISMATCH';
const dash = 'replica-battle/assets/pathogenic-source/gfx/player/bullets/dash_attack_animation.png';
const reset = 'downloadFile:fail Error: read ECONNRESET';
for (const [assetKey, error] of [[asset, 'downloadFile:fail Error: aborted'], [asset, incomplete],
  [dash, reset], [dash, 'downloadFile:fail net::ERR_CONNECTION_RESET'],
  ['assets/skin_calm-3kTuTHUa.mp3', incomplete]]) {
  test('recovers a truncated transfer with a fresh CDN request and caches it: ' + assetKey + ' ' + error, async t => {
    const f = fixture(assetKey);
    t.after(() => f.resources.dispose());
    const source = '/' + assetKey + '?quality=1';
    const expected = cdn + assetKey + '?quality=1&v=3';
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

test('storage-full image recovery bounds encoded copies and a memory trim also covers in-flight transfers',async t=>{
  const f=fixture(asset,{diskLimit:0});t.after(()=>f.resources.dispose());
  async function recover(id,bytes,trimBeforeReply=false){
    const source='/'+asset+'?id='+id,before=f.downloads.length,file=f.cache.localFile(source);
    assert.equal(f.downloads.length,before+1);
    f.downloads.at(-1).fail({errMsg:incomplete});
    if(trimBeforeReply)f.cache.clearMemory();
    f.requests.at(-1).success({statusCode:200,data:new ArrayBuffer(bytes)});
    const result=await file;assert(result.startsWith('data:image/png;base64,'));return result;
  }
  const first=await recover('a',400*1024);
  assert.equal(await f.cache.localFile('/'+asset+'?id=a'),first);
  await recover('b',400*1024);
  await recover('a',400*1024); // Two encoded images exceed the retained character budget.
  await recover('large',900*1024);await recover('large',900*1024);
  await recover('pending',20,true);
  await recover('pending',20);await recover('a',20);
  assert.equal(f.disk.size,0);
});

test('only reset image files switch transports, even when query strings look like images',()=>{
  assert.equal(isIncompleteDownload({errMsg:reset},cdn+'video.mp4?thumbnail=.png'),false);
  assert.equal(isIncompleteDownload({errMsg:'downloadFile:fail not in domain list'},cdn+dash),false);
  assert.equal(isIncompleteDownload({name:'AbortError',errMsg:reset},cdn+dash),false);
});

test('a failed binary recovery surfaces once and leaves the file cache ready for a later request',async t=>{
  const f=fixture(dash);t.after(()=>f.resources.dispose());
  let opens=0;
  const load=createArtworkLoader({address:url=>url,openImage:url=>{
    if(++opens>1)throw Error('unexpected repeat of the exhausted transfer');
    return f.cache.localFile(url);
  }});
  const failed=assert.rejects(load('/'+dash),error=>error.artworkRetryExhausted&&/ECONNRESET/.test(error.message)&&/404/.test(error.message));
  f.downloads[0].fail({errMsg:reset});f.requests[0].success({statusCode:404});
  await failed;
  assert.equal(opens,1);assert.equal(f.disk.size,0);
  const retry=f.cache.localFile('/'+dash);
  f.downloads[1].fail({errMsg:reset});const bytes=Uint8Array.of(10,20,30).buffer;
  f.requests[1].success({statusCode:200,data:bytes});
  assert.equal(f.disk.get(await retry),bytes);
});
