import { chapterRewardsDialog } from './chapter-rewards-panel.js';
import { nativeCollectionArt } from '../replica/native-collection-art.js';
import { resourceIcon } from './resource-icons.js';
import './flight-rewards-page.css';
const btn=(label,action,revision,extra='',disabled=false)=>`<button type="button" class="wc-button" data-action="flightReward" data-operation="${action}" data-revision="${revision}" ${extra} ${disabled?'disabled':''}>${label}</button>`;
const reward=(r,h)=>`<span class="fr-reward">${r.nativeRow?h.img(nativeCollectionArt(r.nativeRow),r.name,'fr-art'):r.image?h.img(r.image,r.name,'fr-art'):resourceIcon(r.id===2?'diamonds':'coins','fr-art')}<span>${h.escape(r.name)} ×${r.count}</span></span>`;
export function flightChapters(s){return chapterRewardsDialog(s).content;}
export function flightRewardsPage({snapshot:s,helpers:h}){
  const f=s.flightRewards;
  return `<section class="fr-page" aria-label="航线补给"><header><h2>航线补给</h2><p>七日签到 · 章节奖励 · 每日特惠</p><strong>${resourceIcon('diamonds')} ${f.diamonds}</strong></header><div class="fr-scroll">${s.rewardPending?'<p>已有奖励待保存</p><button type="button" class="wc-button" data-action="recoverDailyRewards">重试保存</button>':''}
    <article class="fr-card"><h3>每日特惠</h3><div class="fr-rewards">${f.ad.rewards.map(r=>reward(r,h)).join('')}</div><p>每天一次，北京时间 00:00 刷新。完整观看广告后领取。</p>${btn(f.adPending?'重试保存奖励':f.adBusy?'广告播放中':!f.ad.canClaim?'今日已领取':!f.adAvailable?'广告暂不可用':'看广告领取','ad',f.revision,'',s.rewardBusy||s.rewardPending||f.adBusy||!f.adPending&&(!f.ad.canClaim||!f.adAvailable))}</article>
    <article class="fr-card"><h3>新手奖励</h3><p>第 2 天：${h.escape(f.signIn.days[1].name)} · 第 7 天：火伤驾驶员</p><div class="fr-actions"><button class="wc-button" data-action="signin">七日签到</button><button class="wc-button" data-action="chapterRewards">章节奖励</button></div></article>
    ${f.history.length?`<details class="fr-card"><summary>历史收藏箱记录（已停用）</summary>${f.history.map(row=>`<p>消耗 ${row.cost} 钻石：${row.rewards.map(r=>h.escape(r.name)+' ×'+r.count).join('、')}</p>`).join('')}</details>`:''}
    </div></section>`;
}
