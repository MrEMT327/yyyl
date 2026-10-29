import {aircraftUiImage} from '../aircraft-ui-images.js';
export {aircraftUiImage} from '../aircraft-ui-images.js';
import './aircraft-preview.css';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function aircraftPreview(id,{name='',view='default',live=false,controlOnly=false}={}){
  const source=aircraftUiImage(id,view);
  if(!source)return '';
  if(controlOnly)return `<button type="button" class="wc-button ag-button ag-preview-toggle" data-action="aircraft3d" data-id="${escape(id)}" data-view="${view}" aria-pressed="${live}">${live?'静态预览':'3D 查看'}</button>`;
  return `<div class="ui-aircraft-preview" data-preview-aircraft="${escape(id)}"><img class="ui-aircraft-still" src="${source}" alt="${escape(name)}" decoding="async" draggable="false">${live?`<div class="ui-aircraft-live" data-model-aircraft="${escape(id)}" data-model-view="${view}" aria-label="${escape(name)}三维预览" aria-busy="true"></div>`:''}${view==='equipment'?'':`<button type="button" class="wc-button ui-aircraft-3d" data-action="aircraft3d" data-id="${escape(id)}" data-view="${view}" aria-pressed="${live}">${live?'静态预览':'3D 查看'}</button>`}</div>`;
}
