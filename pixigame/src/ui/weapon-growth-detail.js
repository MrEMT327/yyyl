import {projectIcon} from './project-ui-art.js';
import './weapon-growth-detail.css';

// Read-only preview: preserve each stage and candidate from the runtime index.
export function weaponGrowthDetail({name,art,stages,escape:e}) {
  const description=value=>String(value||'').split(/([+−-]?\s*\d+(?:\.\d+)?%?)/g)
    .map((part,index)=>index%2?`<strong>${e(part)}</strong>`:e(part)).join('');
  const sections=stages.map(stage=>{
    const breakthrough=stage.kind==='breakthrough';
    const title=stage.label||(breakthrough?'突破':stage.kind==='minor'?'强化':'升级');
    const options=stage.options?.length?stage.options:[{description:stage.description}];
    return `<section class="wg-stage${breakthrough?' is-breakthrough':''}">
      <h4 class="wg-stage-heading">${stage.star?`<span class="wg-star">${projectIcon('star')}<span>${e(stage.star)} 星</span></span>`:''}<b>${e(title)}</b></h4>
      <ul class="wg-effects">${options.map(skill=>{
        const title=skill.name&&skill.name!==name;
        return `<li class="wg-effect${title?'':' is-attribute'}"${skill.id?` data-growth-skill="${e(skill.id)}"`:''}>${title?`<h5>${e(skill.name)}</h5>`:''}<p>${description(skill.description)}</p>${skill.note?`<small>${e(skill.note)}</small>`:''}</li>`;
      }).join('')}</ul></section>`;
  }).join('');
  return `<article class="wc-skill-detail wc-growth-detail wg-preview">
    <header class="wg-weapon"><div class="wg-preview-art">${art}</div><div><h3>${e(name)}</h3><p>局内升级效果</p></div></header>
    <div class="wg-scroll" tabindex="0" role="region" aria-label="${e(name)}成长效果">${sections||'<p class="wg-empty">暂无成长效果</p>'}</div>
    <p class="wg-footnote">候选效果 · 选取后仅本局生效</p>
  </article>`;
}
