import catalog from '../replica/chapter-detail-catalog.json';
import {chapterPresentationForStage} from '../replica/chapter-presentation.js';
import {nativeItemPresentation} from '../replica/native-item-presentation.js';
import {rewardItemSlot} from './reward-item-slot.js';
import './chapter-details.css';
import {cloudAssetBase} from './cloud-asset-base.js';
import settlement from '../replica/native-settlement-source.json';

function enemyPortrait(modelId,h){
  const art=catalog.art[modelId];
  if(art.image)return `<img src="${cloudAssetBase+art.image}" alt="" draggable="false">`;
  const [x,y,w,height]=art.bounds,pad=Math.max(w,height)*.02;
  return `<svg viewBox="${x-pad} ${y-pad} ${w+pad*2} ${height+pad*2}" aria-hidden="true">${art.layers.map(l=>`<g opacity="${l.alpha}" transform="translate(${l.x} ${l.y}) rotate(${l.angle*180/Math.PI}) scale(${l.sx} ${l.sy})"><svg x="${-l.ox*l.rect[2]}" y="${-l.oy*l.rect[3]}" width="${l.rect[2]}" height="${l.rect[3]}" viewBox="${l.rect.join(' ')}"><image href="${cloudAssetBase+l.url}" width="${l.size[0]}" height="${l.size[1]}"/></svg></g>`).join('')}</svg>`;
}

export function chapterDetails(snapshot,index,h){
  const stage=snapshot.stages[index],data=catalog.chapters.find(c=>c.id===(stage.replicaChapterId||index+1));
  const title=chapterPresentationForStage(index).name||stage.name;
  // FinishReward is an old display list, not a verified grant table. Present
  // only live collected gold and the same once-only rewards as settlement.
  const drops=[{id:1,firstClear:false},...(settlement.firstRewards[data.id]||[]).map(([id])=>({id,firstClear:true}))];
  return {title,content:`<article class="chapter-details" data-chapter-index="${index}">
    <h3>本关敌人</h3>
    <div class="chapter-enemy-tray"><div class="chapter-enemies" tabindex="0" aria-label="本关敌人，可左右滑动">${data.enemies.map(enemy=>`<figure class="chapter-enemy"><div class="chapter-enemy-art">${enemyPortrait(enemy.modelId,h)}</div><figcaption>${h.escape(enemy.name)}</figcaption></figure>`).join('')}</div>
    </div><h3>关卡掉落</h3>
    <div class="chapter-drops">${drops.map(({id,firstClear})=>{const item=nativeItemPresentation(id);return `<div class="chapter-drop">${rewardItemSlot({...item,itemId:id,showQuantity:false,artwork:`<img src="${item.image}" alt="" draggable="false">`},h)}<span>${firstClear?'首通奖励':'金币'}</span></div>`;}).join('')}</div>
    <footer><button type="button" class="wc-button chapter-start" data-action="chapterDetailsStart" data-stage-index="${index}" ${stage.unlocked===false?'disabled':''}>${stage.unlocked===false?'未解锁':'开始'}</button></footer>
  </article>`};
}
