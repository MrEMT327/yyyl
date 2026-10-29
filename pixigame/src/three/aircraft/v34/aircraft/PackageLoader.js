import * as T from 'three';
import {sha256} from './digest.js';
import {hydrateBuffers} from './buffers.js';
export {hydrateBuffers} from './buffers.js';
const decoder=new TextDecoder();
export function indexObjects(root){const nodes=new Map(),materials=new Map();root.traverse(o=>{nodes.set(o.uuid,o);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])materials.set(m.uuid,m);});return {nodes,materials};}
export function disposeTree(root){
 const geometry=new Set(),materials=new Set(),textures=new Set();
 root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.isInstancedMesh)o.dispose();for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);for(const u of Object.values(m.uniforms||{}))if(u.value?.isTexture)textures.add(u.value);}});
 geometry.forEach(v=>v.dispose());materials.forEach(v=>v.dispose());textures.forEach(v=>v.dispose());root.removeFromParent();root.clear();
}
function decodedUniform(u){let value=u.value;if(u.type==='c')value=new T.Color(value);if(u.type==='v3')value=new T.Vector3().fromArray(value);if(u.type==='v2')value=new T.Vector2().fromArray(value);if(u.type==='m4')value=new T.Matrix4().fromArray(value);return {value};}
export function applyMaterialPatches(patches,materials){
 for(const patch of patches){
  const mat=materials.get(patch.material);if(!mat)throw new Error('找不到材质补丁目标');
  mat.uniforms=Object.fromEntries(Object.entries(patch.uniforms).map(([k,u])=>[k,decodedUniform(u)]));
  mat.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,mat.uniforms);
   for(const key of ['vertexShader','fragmentShader'])for(const edit of patch.replacements[key]){
    if(!shader[key].includes(edit.find))throw new Error('着色器补丁与锁定渲染器不兼容');
    shader[key]=shader[key].replace(edit.find,edit.replace);
   }
  };
  mat.customProgramCacheKey=()=>patch.cacheKey+':'+JSON.stringify(patch.replacements);mat.needsUpdate=true;
 }
}
export async function loadPackage(entry,{signal,read=null,skipTextures=false}={}){
 const base=read?null:new URL(`../../public/fighters/${entry.slug}/`,import.meta.url),urls=[];let solid=null,fx=null;
 const nativeAssets=globalThis.__THUNDER_RUNTIME_GLOBALS__;
 const revoke=url=>nativeAssets?.revokeAssetBytesUrl?nativeAssets.revokeAssetBytesUrl(url):URL.revokeObjectURL(url);
 async function get(name,expected){
  if(!/^[\w.-]+$/.test(name)||name.startsWith('.'))throw new Error('非法资源文件名');
  const url=read?null:new URL(name,base);url?.searchParams.set('v',expected?.slice(0,16)||entry.version);
  let bytes;
  if(read)bytes=await read(name,url,signal);else{const r=await fetch(url,{signal,cache:'no-cache'});if(!r.ok)throw new Error(name+'：HTTP '+r.status);bytes=await r.arrayBuffer();}
  if(bytes instanceof Uint8Array)bytes=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  if(signal?.aborted)throw new DOMException('已切换到其他 Tab','AbortError');
  if(expected&&await sha256(bytes)!==expected)throw new Error(name+' 校验失败：资源版本混用或文件被改动，请重新打包目录');
  return bytes;
 }
 try{
  const manifest=JSON.parse(decoder.decode(await get('manifest.json',entry.manifestHash)));
  if(manifest.schemaVersion!==1||manifest.id!==entry.id||manifest.rendererRevision!==T.REVISION)throw new Error('战机包 ID / 格式 / 渲染器版本不匹配');
  const files=Object.entries(manifest.files),loaded=await Promise.all(files.map(async([k,n])=>[k,await get(n,manifest.hashes[n])]));
  const data=Object.fromEntries(loaded);
  const structure=JSON.parse(decoder.decode(data.structure)),effects=JSON.parse(decoder.decode(data.effects)),view=JSON.parse(decoder.decode(data.view));
  if(effects.runtime!=='config-flight/1')throw new Error('未知特效运行时版本');
  hydrateBuffers(structure,data.buffers);hydrateBuffers(effects,data.buffers);
  for(const graph of [structure.scene,effects.graph]){
   if(skipTextures){graph.images=[];graph.textures=[];for(const m of graph.materials||[])for(const k of Object.keys(m))if(k==='map'||k.endsWith('Map'))delete m[k];}
   else for(const image of graph.images||[]){
    const name=image.url;if(!manifest.hashes[name])throw new Error('纹理不在版本清单内');
    const bytes=await get(name,manifest.hashes[name]);
    const url=nativeAssets?.createAssetBytesUrl?nativeAssets.createAssetBytesUrl(bytes,'image/png'):URL.createObjectURL(new Blob([bytes],{type:'image/png'}));urls.push(url);image.url=url;
   }
  }
  const loader=new T.ObjectLoader();solid=await loader.parseAsync(structure.scene);fx=await loader.parseAsync(effects.graph);
  if(signal?.aborted)throw new DOMException('已切换到其他 Tab','AbortError');
  const combo=new T.Group();combo.add(solid,fx);const {nodes,materials}=indexObjects(combo);applyMaterialPatches(effects.materialPatches,materials);
  for(const node of nodes.values()){node.updateMatrix();if(!node.matrix.elements.every(Number.isFinite))throw new Error('资源变换包含非有限数：'+node.name);}
  const ownedGeometry=new Set(),ownedTextures=new Set();
  for(const n of nodes.values())if(n.geometry)ownedGeometry.add(n.geometry);
  for(const m of materials.values())for(const v of Object.values(m))if(v?.isTexture)ownedTextures.add(v);
  let disposed=false;
  return {entry,manifest,view,effects,solid,fx,nodes,materials,urls,bytes:loaded.reduce((n,[,b])=>n+b.byteLength,0),dispose(){if(disposed)return;disposed=true;nodes.forEach(n=>{if(n.isInstancedMesh)n.dispose();});ownedGeometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());ownedTextures.forEach(t=>t.dispose());urls.forEach(revoke);nodes.clear();materials.clear();solid.removeFromParent();fx.removeFromParent();combo.clear();}};
 }catch(error){if(solid)disposeTree(solid);if(fx)disposeTree(fx);urls.forEach(revoke);throw error;}
}
