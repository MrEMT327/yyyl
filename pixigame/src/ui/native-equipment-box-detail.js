import { nativeItemArt } from '../replica/native-item-presentation.js';
import { equipmentBoxRules } from './equipment-box-rules.js';
import './supply-dialogs.css';
const button=(action,label,attrs='')=>`<button type="button" class="wc-button" data-action="${action}" ${attrs}>${label}</button>`;
export function nativeEquipmentBoxDetail(snapshot,h) {
  const e=h.escape,n=h.number,a=snapshot.nativeAcquisition;
  const cards=a.equipmentBoxes.map(box=>{
    const c=box.compatibility,hours=Math.ceil(Math.max(0,c.nextFreeAt-Date.now())/3600000);
    const price=q=>q.payment==='free'?'免费':`${q.payment==='key'?'箱券':'钻石'} ×${q.amount==null?'—':n(q.amount)}`;
    return `<section class="su-box-card" aria-label="${e(box.name)}">
      <header class="su-card-heading"><h3>${e(box.name)}</h3><span class="su-count">箱券 ×${n(box.keys)}</span></header>
      <p class="su-free">${c.freeAvailable?'免费开启可用':`免费开启 · ${n(hours)}小时后`}</p>
      <div class="su-pity"><span>${box.id===3?'史诗':'优秀'}保底 <b>${n(c.qualityRemaining)}</b>件</span>${c.sRemaining?`<span>S级保底 <b>${n(c.sRemaining)}</b>件</span>`:''}</div>
      <p class="su-subtitle">${box.quotes.map(q=>`${q.count===1?'单次':'十次'} ${price(q)}`).join(' · ')}</p>${!box.canDraw?`<p>${e(box.unavailableReason)}</p>`:''}
      <details class="su-details su-box-probabilities"><summary>概率与规则</summary>
        <div class="su-rate-groups">${box.rates.map(group=>`<details><summary><span>${e(group.name)}</span><b>${group.weight/1000}%</b></summary>${group.items.map(item=>`<p class="su-item-rate">${h.img(nativeItemArt(item.id),'','su-item-art')}<span>${e(item.name)} ×${item.count}</span><b>${item.weight/1000}%</b></p>`).join('')}</details>`).join('')}</div>
        <h4>开启规则</h4>${equipmentBoxRules(box,h)}<p>免费优先；十连箱券不足时，整单使用钻石。</p>${box.id===3?'<p>驾驶员首次获得即解锁，重复转同名卡，满星后转积分。</p>':''}
        ${box.id===4?`<p>累计 ${n(snapshot.equipment.draws)} 次 · 高级券可领 ${n(snapshot.equipment.basicRewardAvailable)} 次</p>`:''}
      </details>
    </section>`;
  }).join('');
  return {title:'装备箱说明',content:`<div class="supply-ui su-equipment-boxes">${cards}<div class="su-actions">${button('equipmentShop','前往商城','data-section="boxes"')}</div><div class="su-footer-actions">${snapshot.equipmentBoxReceipt?button('nativeEquipmentBoxLast','上次结果'):''}${button('nativeMaterials','打开背包')}</div></div>`};
}
