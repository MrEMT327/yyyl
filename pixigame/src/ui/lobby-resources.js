import { RESOURCE_ICONS } from './resource-icons.js';
// All landing headers use the same amounts, artwork and markup. Navigation
// remains caller-owned so research/equipment keep their existing shop routes.
export function lobbyResources({snapshot:s,helpers:h},shopAction='shopSection'){
  const {escape:e,number:n}=h,w=s.wallet;
  const resourceArt=name=>`${import.meta.env?.BASE_URL ?? '/'}art/psd-main-v1/resources/${name}.png`;
  const compact=value=>Number(value)>=1e8?`${Number((Number(value)/1e8).toFixed(1))}亿`:Number(value)>=1e4?`${Number((Number(value)/1e4).toFixed(1))}万`:n(value);
  const maximum=Math.max(1,Number(w.maxStamina??w.staminaMax)||60);
  return `<div class="lobby-resources">${[['stamina','体力',''],['coins','金币','resources'],['diamonds','钻石','supply']].map(([type,label,section])=>{
    const description=`${label}：${w.unlimited?'9999（开发显示）':n(w[type])}${type==='stamina'&&!w.unlimited?` / ${n(maximum)}`:''}`;
    const amount=w.unlimited?'9999':String(compact(w[type]));
    return `<button type="button" class="lobby-resource is-${type}" data-action="${type==='stamina'?'stamina':shopAction}" ${section?`data-section="${section}"`:''} aria-label="${e(description)}"><span class="lobby-resource-bar" aria-hidden="true"><img class="lobby-resource-background" src="${resourceArt(`${type}-background`)}" alt="" draggable="false"><img class="lobby-resource-icon" src="${RESOURCE_ICONS[type].url}" alt="" draggable="false"><b class="${amount.length>4?'is-long':''}"><span class="lobby-resource-amount">${e(amount)}</span></b><img class="lobby-resource-plus" src="${resourceArt(`${type}-plus`)}" alt="" draggable="false"></span></button>`;
  }).join('')}</div>`;
}
