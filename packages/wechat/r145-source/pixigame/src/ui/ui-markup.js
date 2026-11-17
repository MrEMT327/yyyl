import {prepareShortageFeedback} from './resource-availability.js';
// Keep live scrollports, focus, portraits and canvases when only an unrelated
// background timer changed in the full game snapshot.
import {optimizeUiAssetUrls} from './ui-image-source.js';
import {flattenDisclosureMarkup} from './flat-sections.js';
const previous=new WeakMap();
const pages=new WeakMap();
const MAX_CACHED_PAGES=2,MAX_CACHED_MARKUP=250000;
export function clearUiMarkupCache(host,{keepCurrent=false}={}){
  pages.delete(host);
  if(!keepCurrent)previous.delete(host);
}
// Explicit plain-text clocks may tick without replacing animated descendants.
// Changes to buttons, prices, rewards, or the clock's presence still rebuild.
const liveTextPattern=/(<(?:p|strong)\b[^>]*\bdata-ui-live-text="([a-z-]+)"[^>]*>)([^<]*)(<\/(?:p|strong)>)/g;
const clockSelector='[data-ui-live-text]';
export function setUiLiveText(node,text){
  if(node.textContent===text)return;
  const child=node.firstChild;
  if(child?.nodeType===3&&!child.nextSibling)child.data=text;
  else node.textContent=text;
}
function clockMarkup(value,values){
  return value.replace(liveTextPattern,(_match,open,key,text,close)=>{values?.set(key,text);return open+close;});
}
function patchMarkupClocks(roots,before,value){
  if(!before||!value.includes('data-ui-live-text='))return false;
  const clocks=new Map();
  if(clockMarkup(before)!==clockMarkup(value,clocks))return false;
  const nodes=[];
  for(const root of roots){
    if(root.nodeType!==1)continue;
    if(root.matches(clockSelector))nodes.push(root);
    nodes.push(...root.querySelectorAll(clockSelector));
  }
  if(nodes.length!==clocks.size||nodes.some(node=>!clocks.has(node.dataset.uiLiveText)))return false;
  for(const node of nodes)setUiLiveText(node,clocks.get(node.dataset.uiLiveText));
  return true;
}
export function setUiMarkup(host,html,{pageKey=null,maxCachedPages=MAX_CACHED_PAGES}={}){
  const input=String(html??'');
  const cached=previous.get(host);
  // Background timers frequently render the same catalog/panel. Compare its
  // source before running the disclosure and asset-URL transforms again.
  if(cached?.input===input&&cached.pageKey===pageKey)return false;
  const savedPage=pageKey===null?null:pages.get(host)?.get(pageKey);
  const value=savedPage?.input===input?savedPage.value:optimizeUiAssetUrls(flattenDisclosureMarkup(input));
  const before=cached?.value;
  if(before===value){previous.set(host,{input,value,pageKey});return false;}
  if(patchMarkupClocks([host],before,value)){previous.set(host,{input,value,pageKey});return false;}
  let restored;
  if(cached?.pageKey!==pageKey){
    let saved=pages.get(host);
    if(!saved){saved=new Map();pages.set(host,saved);}
    restored=pageKey===null?null:saved.get(pageKey);saved.delete(pageKey);
    if(cached?.pageKey!=null&&cached.value.length<=MAX_CACHED_MARKUP){
      saved.delete(cached.pageKey);saved.set(cached.pageKey,{...cached,nodes:[...host.childNodes]});
      while(saved.size>maxCachedPages)saved.delete(saved.keys().next().value);
    }
  }
  // New prices and rewards invalidate the old page. Clocks can update on
  // detached nodes before their tab is reattached.
  if(restored&&(restored.value===value||patchMarkupClocks(restored.nodes,restored.value,value)))host.replaceChildren(...restored.nodes);
  else{host.innerHTML=value;prepareShortageFeedback(host);}
  previous.set(host,{input,value,pageKey});return true;
}
