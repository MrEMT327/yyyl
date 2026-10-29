import crops from './psd-choice-icon-crops.json' with {type:'json'};
import './supply-visuals.css';
const base=import.meta.env?.BASE_URL??'/';
// Layout metadata trims transparent margins without altering the shared icons.
export function supplyWeaponArt(item,thumbnail) {
  const source=crops[item?.id];
  if(!source)return `<span class="supply-weapon-art">${thumbnail(item?.id)||''}</span>`;
  const [x,y,w,h]=source.crop,[iw,ih]=source.size;
  return `<span class="supply-weapon-art" style="--supply-art-aspect:${iw*w/(ih*h)}"><span><img src="${base}art/weapon-original/${encodeURIComponent(item.id)}.webp" alt="" draggable="false" style="left:${-x/w*100}%;top:${-y/h*100}%;width:${100/w}%;height:${100/h}%"></span></span>`;
}
