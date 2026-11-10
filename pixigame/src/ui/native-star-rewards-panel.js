import { nativeItemArt } from '../replica/native-item-presentation.js';
import { rewardDisplayQuality } from '../replica/item-display-quality.js';
import { rewardItemSlot } from './reward-item-slot.js';
import { projectIcon } from './project-ui-art.js';
import './native-star-rewards-panel.css';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function nativeStarRewardsDialog(snapshot) {
  const view=snapshot.starRewards,track=view?.modes?.find(row=>row.id==='easy');
  if(!view?.native||!track)return {title:'星级奖励',content:'<p>奖励记录尚未就绪。</p>'};
  const blocked=Boolean(snapshot.rewardPending||snapshot.rewardBusy);
  const reward=item=>{
    const image=nativeItemArt(item.id),name=String(item.name||'').replace('（离线逐张均匀分配）','');
    return rewardItemSlot({name,amount:item.count,itemId:item.id,...rewardDisplayQuality({nativeItemId:item.id}),
      artwork:image?`<img src="${escape(image)}" alt="" draggable="false">`:`<span>${escape(name)}</span>`},{escape});
  };
  const next=track.items.find(row=>row.claimable&&!row.claimed)||track.items.find(row=>!row.claimed);
  return {title:'星级奖励',content:`<section class="native-star-rewards" aria-label="累计星级奖励">
    <header class="nsr-summary"><span>${projectIcon('star','nsr-star')}累计星数</span><strong>${track.total}<small> / ${track.maxStars}</small></strong></header>
    ${blocked?'<p class="nsr-notice" role="status">请先完成当前奖励保存。</p>':''}
    <div class="nsr-list">${track.items.map(row=>{
      const enabled=!blocked&&row.claimable&&!row.claimed&&row.supported;
      const status=row.claimed?'已领取':!row.supported?'暂不可领':row.claimable?'领取':'未达成';
      return `<section class="bc-star-reward nsr-row ${row.claimed?'is-claimed':row.claimable?'is-ready':''}" aria-label="累计 ${row.stars} 星奖励"${row===next?' data-star-next':''}>
        <div class="nsr-threshold">${projectIcon('star','nsr-star')}<strong>${row.stars}</strong></div>
        <div class="nsr-items">${row.rewardItems.map(reward).join('')}</div>
        <button type="button" class="wc-button nsr-claim" data-action="claimStarReward" data-mode="easy" data-id="${row.id}" data-revision="${view.revision}" aria-label="${status}，${row.stars} 星奖励" ${enabled?'':'disabled'}>${status}</button>
      </section>`;
    }).join('')}</div></section>`};
}
