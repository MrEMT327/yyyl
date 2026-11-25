import { getWechatTransport, isIncompleteDownload } from './transport.js';
import { sha256Fallback } from '../../../src/three/aircraft/v34/aircraft/digest.js';
import { string2buf } from 'pako/lib/utils/strings.js';
import { imageDataUrl, isStorageQuotaError } from './asset-storage.js';
import { createAssetFileBudget } from './asset-file-budget.js';

const budgets = new WeakMap();
const maxTemporaryChars=1024*1024,maxTemporaryEntries=128;
const imageContentTypes={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'};
export function createAssetCache(api,resources,{diskLimit=48*1024*1024}={}) {
  // DevTools represents its local user directory with an HTTP-style URL.
  const userFiles = `${api.env.USER_DATA_PATH.replace(/\/+$/, '')}/`;
  const files=api.getFileSystemManager(),pending=new Map(),folder=userFiles+'shnh-full-assets-v1',transport=getWechatTransport(api);
  try{files.mkdirSync(folder,true);}catch{}
  if(!budgets.has(api))budgets.set(api,createAssetFileBudget(files,folder,diskLimit));
  const budget=budgets.get(api),temporary=new Map();let writesFull=false;
  let temporaryChars=0,generation=0;
  function forgetTemporary(url){
    temporaryChars-=temporary.get(url).length;
    temporary.delete(url);
  }
  function clearMemory(){generation++;temporary.clear();temporaryChars=0;}
  function nonEmpty(path) {
    files.accessSync(path);
    if(typeof files.statSync==='function' && files.statSync(path).size===0) return false;
    return true;
  }
  function localFile(source,baseURL) {
    const url = resources.resolve(source, baseURL);
    if (url.startsWith(userFiles)) return Promise.resolve(url);
    if (!/^https?:/i.test(url)) return resources.readyLocalFile ? resources.readyLocalFile(url) : Promise.resolve(url);
    if(pending.has(url))return pending.get(url);
    if(temporary.has(url)){
      const file=temporary.get(url);
      try{if(file.startsWith('data:')||nonEmpty(file)){
        temporary.delete(url);temporary.set(url,file);return Promise.resolve(file);
      }}catch{}
      forgetTemporary(url);
    }
    const suffix=/\.([a-z0-9]{1,8})(?:[?#]|$)/i.exec(url)?.[1] || 'bin';
    const imageType=imageContentTypes[suffix.toLowerCase()];
    const path=`${folder}/${sha256Fallback(string2buf(url).buffer)}.${suffix}`;
    const started=generation;
    const task=new Promise((resolve,reject)=>{
      try{if(nonEmpty(path)){budget.touch(path);resolve(path);return;}files.unlinkSync(path);}catch{}
      budget.forget(path);
      const failure=(phase,error)=>new Error(`${phase}：${url} · ${error?.errMsg || error?.message || String(error)}`);
      const useTemporary=file=>{
        // An interrupted image download can yield an entire base64 image instead of a short native path.
        if(generation===started&&file.length<=maxTemporaryChars){
          while(temporary.size>=maxTemporaryEntries||temporaryChars+file.length>maxTemporaryChars)
            forgetTemporary(temporary.keys().next().value);
          temporary.set(url,file);temporaryChars+=file.length;
        }
        resolve(file);
      };
      const discardPartial=()=>{budget.forget(path);try{files.unlinkSync(path);}catch{}};
      // Recover an incomplete transfer without retaining any partial file.
      const recoverDownloadBytes=async (original,fresh=false)=>{
        try{
          const bytes=await resources.readBytes(url,{fresh});
          if(!(bytes instanceof ArrayBuffer) || bytes.byteLength===0)throw new Error('服务器返回了空文件');
          if(!writesFull&&budget.reserve(path,bytes.byteLength)){
            try{files.writeFileSync(path,bytes);resolve(path);return;}
            catch(error){discardPartial();if(!isStorageQuotaError(error))throw error;writesFull=true;}
          }
          if(imageType){useTemporary(imageDataUrl(bytes,imageType));return;}
          throw new Error('资源缓存空间不足，且下载未提供可用的临时文件');
        }catch(error){
          const failed=failure('资源下载失败',new Error(`${original?.errMsg || original?.message || '下载文件为空'}；二进制重试：${error?.message || error}`));
          if(imageType)failed.artworkRetryExhausted=true;
          reject(failed);
        }
      };
      transport.downloadFile({url,timeout:imageType?15000:60000,success(result){
        if(result.statusCode!==200){
          reject(Object.assign(new Error(`下载失败 ${result.statusCode} ${url}`),{statusCode:result.statusCode}));
          return;
        }
        try{
          if(!result.tempFilePath || !nonEmpty(result.tempFilePath)){recoverDownloadBytes(new Error('下载文件为空'));return;}
        }catch(error){reject(failure('下载临时文件读取失败',error));return;}
        let size;try{size=files.statSync(result.tempFilePath).size;}catch{}
        if(writesFull||!budget.reserve(path,size)){useTemporary(result.tempFilePath);return;}
        const saveFailed=error=>{
          discardPartial();if(isStorageQuotaError(error))writesFull=true;
          // Saving is optional: preserve an already downloaded, nonempty file
          // even if the cache is full or a platform save operation fails.
          try{if(nonEmpty(result.tempFilePath)){useTemporary(result.tempFilePath);return;}}catch{}
          reject(failure('资源缓存写入失败',error));
        };
        try{files.saveFile({tempFilePath:result.tempFilePath,filePath:path,success:()=>resolve(path),fail:saveFailed});}
        catch(error){saveFailed(error);}
      },fail:error=>{
        if(isIncompleteDownload(error,url))recoverDownloadBytes(error,Boolean(imageType)||suffix.toLowerCase()==='mp3');
        else reject(failure('资源下载失败',error));
      }});
    }).finally(()=>pending.delete(url));pending.set(url,task);return task;
  }
  return {localFile,clearMemory,get diskBytes(){return budget.bytes;}};
}
