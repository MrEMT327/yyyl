import {taskChestModel} from './task-chest-model.js';
import {rewardItemSlot} from './reward-item-slot.js';
import {rewardDisplayQuality,rewardNativeItemId} from '../replica/item-display-quality.js';
import {nativeItemArt} from '../replica/native-item-presentation.js';
import {researchBlueprintArt} from '../replica/research-blueprint-art.js';
import './task-chest-preview.css';

export function taskChestPreview(snapshot,modal,h) {
  const item=taskChestModel(snapshot,modal.period,modal.id);
  if(!item)return {title:'宝箱奖励',content:'<p>该奖励已更新，请返回任务查看。</p>'};
  const slots=item.rewards.map(row=>{
    const id=rewardNativeItemId(row),art=researchBlueprintArt(id)||row.image||nativeItemArt(id);
    return rewardItemSlot({name:row.name,amount:row.amount,itemId:id,
      artwork:art?h.img(art,row.name):h.icon(({coins:'coin',diamonds:'diamond',weaponParts:'parts',aircraftShards:'shard',stamina:'energy'})[row.type]||'gift'),
      ...rewardDisplayQuality(row)},h);
  }).join('');
  return {title:'宝箱奖励',content:`<div class="tc-preview-rewards">${slots}</div>`};
}

// Reference ItemBG sits above its box. Reuse project PSD art and fit rewards.
export function taskChestPreviewDialog(content) {
  return `<div class="tc-preview-backdrop" data-action="dismiss"><section class="pl-modal task-chest-popover" data-modal-type="taskChestPreview" role="dialog" aria-modal="true" aria-label="宝箱奖励" tabindex="-1"><div class="pl-modal-content">${content}</div><span class="tc-preview-arrow" aria-hidden="true"></span></section></div>`;
}

export function positionTaskChestPreview(host,root,modal) {
  const panel=host.querySelector('.task-chest-popover');
  const parent=root.querySelector('[data-reward-layer="underlay"]');
  const button=[...(parent?.querySelectorAll('[data-action="taskChest"]')||[])].find(el=>el.dataset.period===modal.period&&el.dataset.id===String(modal.id));
  if(!panel||!button)return;
  const anchor=(button.querySelector('img')||button).getBoundingClientRect();
  const bounds=(parent.querySelector('[data-modal-type="tasks"]')||root).getBoundingClientRect();
  const origin=host.getBoundingClientRect(),box=panel.getBoundingClientRect();
  const center=anchor.left+anchor.width/2;
  const left=Math.max(bounds.left+6,Math.min(center-box.width/2,bounds.right-box.width-6));
  const top=Math.max(origin.top+8,anchor.top+anchor.height*.18-box.height-7);
  panel.style.left=`${left-origin.left}px`;panel.style.top=`${top-origin.top}px`;
  panel.style.setProperty('--tip-arrow-x',`${Math.max(12,Math.min(center-left,box.width-12))}px`);
}
