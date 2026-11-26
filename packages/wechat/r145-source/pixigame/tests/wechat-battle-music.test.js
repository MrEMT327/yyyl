import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetCache } from '../wechat/src/full/asset-cache.js';
import { createWechatResources } from '../wechat/src/full/resources.js';
import { createBattleMusicCache, resolveBattleMusic } from '../wechat/src/three/battle-music-cache.js';

const baseURL='https://cdn.example/game/';
const downloads={
  heart_fight:{path:'audio/heart_fight.m4a',bytes:3},
  intestine_fight:{path:'audio/intestine_fight.m4a',bytes:4},
};
const first='three-code-3/first.m4a',boss='three-code-5/boss.m4a';

function fixture(){
  const disk=new Map(),requests=[];
  const api={
    env:{USER_DATA_PATH:'wxfile://usr'},
    getFileSystemManager:()=>fs,
    downloadFile(options){
      const request={options,aborted:false};
      requests.push(request);
      return {abort(){request.aborted=true;}};
    },
  };
  const fs={
    mkdirSync(){},
    accessSync(path){if(!disk.has(path))throw Error('Missing file');},
    statSync(path){return {size:disk.get(path)?.byteLength??0};},
    unlinkSync(path){disk.delete(path);},
    saveFile({filePath,tempFilePath,success}){
      disk.set(filePath,disk.get(tempFilePath));disk.delete(tempFilePath);success();
    },
  };
  const resources=createWechatResources(api,{assetOrigin:'https://cdn.example',cdnBase:baseURL,
    requirePublicNetwork:true,cdnFiles:[...Object.values(downloads).map(track=>track.path),'other.ogg'],
  });
  const service=()=>({
    musicFiles:{brain_fight:first,heart_boss:boss},
    musicGains:{brain_fight:1.2,heart_fight:1.3},
    battleMusic:createBattleMusicCache(downloads,createAssetCache(api,resources),baseURL,()=>new AbortController()),
    resolve:resources.resolve,
  });
  return {service,requests,reply(index,bytes){
    const tempFilePath='wxfile://tmp/track-'+index+'.m4a';
    disk.set(tempFilePath,new Uint8Array(bytes));
    requests[index].options.success({statusCode:200,tempFilePath});
  }};
}

test('first chapter and Boss are packaged, with a local fallback for unavailable later tracks',()=>{
  const {service,requests}=fixture(),services=service();
  assert.deepEqual(resolveBattleMusic('brain_fight.ogg',services,baseURL),{source:first,gain:1.2});
  assert.equal(resolveBattleMusic('heart_boss.ogg',services,baseURL).source,boss);
  assert.deepEqual(resolveBattleMusic('/assets/heart_fight-H45_abc.ogg?v=2',services,baseURL),{source:first,gain:1.2});
  assert.equal(resolveBattleMusic('other.ogg',services,baseURL).source,baseURL+'other.ogg');
  assert.equal(requests.length,0);
});

test('idle lobby downloads one at a time, cancels on departure and reuses only complete files',async()=>{
  const {service,requests,reply}=fixture(),services=service(),loaded=[],failed=[];
  let idle=false,timer=null;
  const prefetch=services.battleMusic.preloadInLobby({
    idle:()=>idle,loaded:(key,bytes)=>loaded.push([key,bytes]),failed:key=>failed.push(key),
    setTimer(fn){assert.equal(timer,null);return timer=fn;},clearTimer(){timer=null;},
  });
  function tick(){assert(timer);const run=timer;timer=null;return run();}
  prefetch.setActive(true);
  await tick();
  assert.equal(requests.length,0);
  idle=true;
  const canceled=tick();
  assert.equal(requests.length,1);assert.equal(timer,null);
  prefetch.setActive(false);
  await canceled;
  assert(requests[0].aborted);assert.equal(timer,null);assert.deepEqual(failed,[]);

  prefetch.setActive(true);
  const incomplete=tick();
  assert.equal(requests[1].options.url,baseURL+downloads.heart_fight.path);
  reply(1,2);await incomplete;
  assert.equal(resolveBattleMusic('heart_fight.ogg',services,baseURL).source,first);
  const other=tick();
  assert.equal(requests[2].options.url,baseURL+downloads.intestine_fight.path);
  reply(2,4);await other;
  assert.deepEqual(failed,['heart_fight']);assert.equal(timer,null);

  prefetch.setActive(false);prefetch.setActive(true);
  const retry=tick();
  reply(3,3);await retry;
  await tick();
  assert.deepEqual(loaded,[['intestine_fight',4],['heart_fight',3]]);
  assert.equal(requests.length,4);assert.equal(timer,null);
  const selected=resolveBattleMusic('heart_fight.ogg',service(),baseURL);
  assert.match(selected.source,/^wxfile:\/\/usr\/shnh-full-assets-v1\/[a-f0-9]{64}\.m4a$/);
  assert.equal(selected.gain,1.3);
});
