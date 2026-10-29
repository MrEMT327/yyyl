import {aircraftUiImage} from '../aircraft-ui-images.js';
export {aircraftUiImage} from '../aircraft-ui-images.js';
import './aircraft-preview.css';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function aircraftPreview(id,{name='',view='default'}={}){
  const source=aircraftUiImage(id,view);
  if(!source)return '';
  return `<div class="ui-aircraft-preview" data-preview-aircraft="${escape(id)}"><img class="ui-aircraft-still" src="${source}" alt="${escape(name)}" decoding="async" draggable="false"></div>`;
}
