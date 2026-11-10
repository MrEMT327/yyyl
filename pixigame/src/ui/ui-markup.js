import {prepareShortageFeedback} from './resource-availability.js';
// Keep live scrollports, focus, portraits and canvases when only an unrelated
// background timer changed in the full game snapshot.
import {optimizeUiAssetUrls} from './ui-image-source.js';
import {flattenDisclosureMarkup} from './flat-sections.js';
const previous=new WeakMap();
// Explicit plain-text clocks may tick without replacing animated descendants.
// Changes to buttons, prices, rewards, or the clock's presence still rebuild.
const liveTextPattern=/(<(?:p|strong)\b[^>]*\bdata-ui-live-text="([a-z-]+)"[^>]*>)([^<]*)(<\/(?:p|strong)>)/g;
function clockMarkup(value,values){
  return value.replace(liveTextPattern,(_match,open,key,text,close)=>{values?.set(key,text);return open+close;});
}
export function setUiMarkup(host,html){
  const value=optimizeUiAssetUrls(flattenDisclosureMarkup(html));
  const before=previous.get(host);
  if(before===value)return false;
  if(before&&value.includes('data-ui-live-text=')){
    const clocks=new Map();
    if(clockMarkup(before)===clockMarkup(value,clocks)){
      const nodes=[...host.querySelectorAll('[data-ui-live-text]')];
      if(nodes.length===clocks.size&&nodes.every(node=>clocks.has(node.dataset.uiLiveText))){
        for(const node of nodes)node.textContent=clocks.get(node.dataset.uiLiveText);
        previous.set(host,value);return false;
      }
    }
  }
  host.innerHTML=value;prepareShortageFeedback(host);previous.set(host,value);return true;
}
