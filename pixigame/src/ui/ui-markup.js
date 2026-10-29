import {prepareShortageFeedback} from './resource-availability.js';
// Keep live scrollports, focus, portraits and canvases when only an unrelated
// background timer changed in the full game snapshot.
import {optimizeUiAssetUrls} from './ui-image-source.js';
import {flattenDisclosureMarkup} from './flat-sections.js';
const previous=new WeakMap();
export function setUiMarkup(host,html){
  const value=optimizeUiAssetUrls(flattenDisclosureMarkup(html));
  if(previous.get(host)===value)return false;
  host.innerHTML=value;prepareShortageFeedback(host);previous.set(host,value);return true;
}
