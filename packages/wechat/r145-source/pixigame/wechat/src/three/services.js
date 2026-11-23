import { ObjectLoader, Source } from 'three';
import { createWechatResources } from '../full/resources.js';
import { createAssetCache } from '../full/asset-cache.js';
import { createBattleDataCache } from '../full/battle-data-cache.js';
import { loadArtwork } from '../../../../../../../pixigame/src/three/game-screen/image-loading.js';
import { loadFighterPackages } from '../../../../../../../pixigame/src/three/aircraft/fighter-packages.js';
import { getWechatTransport } from '../full/transport.js';

function makeAbort(){
  if(typeof globalThis.AbortController==='function')return new globalThis.AbortController();
  const listeners=new Map();
  const signal={
    aborted:false,reason:undefined,
    addEventListener(type,handler,{once=false}={}){if(type==='abort')listeners.set(handler,once);},
    removeEventListener(type,handler){if(type==='abort')listeners.delete(handler);},
    throwIfAborted(){if(signal.aborted)throw signal.reason;},
  };
  return {signal,abort(reason=Object.assign(new Error('读取已取消'),{name:'AbortError'})){
    if(signal.aborted)return;
    signal.aborted=true;signal.reason=reason;
    for(const [callback,once] of [...listeners]){
      if(once)listeners.delete(callback);
      callback({type:'abort',target:signal});
    }
  }};
}

function persistentStorage(api){
  const keys=()=>api.getStorageInfoSync().keys;
  return {
    get length(){return keys().length;},key:index=>keys()[index]??null,
    getItem(key){const value=api.getStorageSync(key);return value==null||value===''&&!keys().includes(key)?null:String(value);},
    setItem(key,value){api.setStorageSync(key,String(value));},removeItem(key){api.removeStorageSync(key);},
  };
}

class NativeObjectLoader extends ObjectLoader {
  async parseImagesAsync(images){
    const types={Uint8Array,Uint8ClampedArray,Float32Array,Uint16Array,Int16Array,Uint32Array,Int8Array,Int32Array,Float64Array};
    const decode=async image=>{
      if(typeof image==='string')return loadArtwork(image);
      if(!image?.data||!types[image.type])throw Error('战机包含无效贴图数据');
      return {data:new types[image.type](image.data),width:image.width,height:image.height};
    };
    return Object.fromEntries(await Promise.all((images||[]).map(async ({uuid,url})=>{
      const image=Array.isArray(url)?await Promise.all(url.map(decode)):await decode(url);
      return [uuid,new Source(image)];
    })));
  }
}

export function createWechatServices(api,config){
  const cdn=new URL(config.cdnBase);
  if(cdn.protocol!=='https:'||cdn.username||cdn.password||cdn.search||cdn.hash||!cdn.pathname.endsWith('/')){
    throw Error('微信小游戏 CDN 必须配置 HTTPS 目录地址');
  }
  const baseURL=new URL('/',cdn).href;
  const resources=createWechatResources(api,{assetOrigin:baseURL,cdnBase:cdn.href,cdnFiles:config.cdnFiles,
    assetTransfers:config.assetTransfers,localFiles:config.localFiles,fallbackFiles:config.fallbackFiles,requirePublicNetwork:true,
    cacheVersion:config.cacheVersion??config.buildId,loadPackage:config.loadPackage});
  const files=createAssetCache(api,resources),loadouts=new Map();
  const assetBytes=resources.createTextureScope(),battleData=createBattleDataCache();
  const resolve=(path,base=baseURL)=>resources.resolve(path,base);
  async function fetchResource(path,{signal}={}){
    try{
      const bytes=await resources.readBytes(path,{signal,baseURL});
      return {ok:true,status:200,arrayBuffer:async()=>bytes,json:async()=>JSON.parse(new TextDecoder().decode(bytes)),
        text:async()=>new TextDecoder().decode(bytes)};
    }catch(error){
      if(signal?.aborted)throw error;
      const status=Number(/资源加载失败 \((\d+)\)/.exec(error.message)?.[1]);
      if(status)return {ok:false,status};
      throw error;
    }
  }
  const readSharedLoadoutJSON=name=>{
    if(!['loadout-catalog','loadout-runtime','player-appearances'].includes(name))throw Error('未知装备配置 '+name);
    if(loadouts.has(name))return loadouts.get(name);
    const request=resources.readJSON('replica-battle/data/'+name+'.json',{baseURL}).catch(error=>{
      if(loadouts.get(name)===request)loadouts.delete(name);
      throw error;
    });
    loadouts.set(name,request);return request;
  };
  const readFighterFile=(slug,name)=>resources.readBytes('fighters/'+slug+'/'+name,{baseURL});
  const objectLoader=new NativeObjectLoader();
  return {
    baseURL,resources,resolve,fetchResource,makeAbort,storage:persistentStorage(api),musicFiles:config.musicFiles,
    beginSortieLoad:()=>getWechatTransport(api).beginSortieLoad(),
    readSharedLoadoutJSON,readFighterFile,objectLoader,assetBytes,
    localFile:path=>files.localFile(path,baseURL),
    loadBattleData:(id,signal,prepare)=>battleData.load(id,signal,prepare),
    loadAircraft:pilotId=>loadFighterPackages({pilotIds:[pilotId],read:readFighterFile,objectLoader,assetBytes}),
    close(){loadouts.clear();battleData.clear();assetBytes.dispose();resources.dispose();},
  };
}
