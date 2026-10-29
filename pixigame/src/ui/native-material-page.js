import { nativePilotAppearance } from '../replica/native-pilot-presentation.js';
import { nativeItemArt } from '../replica/native-item-presentation.js';
import { pilotSupplyPanel } from './pilot-supply-panel.js';
const button=(action,label,attrs='',disabled=false)=>`<button type="button" class="wc-button" data-action="${action}" ${attrs}${disabled?' disabled':''}>${label}</button>`;
export function nativeMaterialsDetail(s,h) {
  const e=h.escape,a=s.nativeAcquisition;
  const itemIcon=id=>h.img(nativeItemArt(id),'','fc-skill-icon');
  return {title:'材料库存',content:`<article class="wc-skill-detail clarity-page">${button('chapterRewards','查看／领取章节奖励')}<h3>材料库存</h3>${a.materials.length?a.materials.map(row=>`<p>${itemIcon(row.id)}${e(row.name)} ×${row.count}</p>`).join(''):'<p>暂无材料</p>'}</article>`};
}
export function nativeRecruitPage({snapshot:s,helpers:h}) {
  if(s.pilotSupply)return `<section class="ref-catalog wc-page"><div class="ref-catalog-scroll">${pilotSupplyPanel('boxes',s,h).content}</div></section>`;
  const e=h.escape,a=s.nativeAcquisition,r=a.recruit;
  return `<section class="ref-catalog wc-page nc-page" aria-label="驾驶员招募"><header class="wc-heading"><h2>驾驶员招募</h2></header><div class="ref-catalog-scroll wc-scroll"><section class="nc-detail"><h3>驾驶员宝箱</h3><p>拥有 ${r.boxCount} 个宝箱 · ${r.fragmentCount} 个宝箱碎片</p><p>${r.required} 个碎片可合成 1 个宝箱。</p><div class="nc-actions">${button('nativeComposePilotBox','合成 1 个',`data-count="1" data-revision="${a.revision}"`,!r.canCompose)}${button('nativeComposePilotBox',`合成全部（${r.maxComposeCount}）`,`data-count="${r.maxComposeCount}" data-revision="${a.revision}"`,!r.canCompose)}${button('nativeMaterials','材料与章节奖励')}</div><p>开箱暂未开放，宝箱与碎片保留。</p></section><section class="nc-stage"><h3>宝箱内容预览</h3>${r.candidates.map(row=>`<p>${h.img(nativePilotAppearance(row.id)?.avatar,'','fc-skill-icon')}${e(row.name)} ×${row.count}</p>`).join('')}</section></div><nav class="wc-footer">${button('nativeMaterials','材料')}${button('catalog','驾驶员养成','data-kind="pilot"')}</nav></section>`;
}
