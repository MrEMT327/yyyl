import { cloudAssetBase } from './cloud-asset-base.js';
import { guidePanelWidth, guidePlacement } from './guide-layout.js';

export function guidePointerMarkup() {
  const cue=`<img class="guide-pointer-art" src="${cloudAssetBase}art/equipment-controls-v1/chevron-down.svg" alt="" draggable="false">`;
  return cue+cue;
}

export function guideMascotMarkup() {
  return '<span class="guide-mascot" aria-hidden="true"><span class="guide-mascot-sprite"></span></span>';
}

export function guideCompanionMarkup() {
  return `<div class="guide-caption guide-companion">${guideMascotMarkup()}<div class="guide-content guide-bubble"><span class="guide-message" role="status" aria-live="polite"></span></div></div>`;
}

export function guideMarkup() {
  return `<div class="guide-ring"></div><span class="guide-hand" aria-hidden="true">${guidePointerMarkup()}</span>${guideCompanionMarkup()}`;
}

export function positionGuide(layer,{target,bounds,label,viewport={width:innerWidth,height:innerHeight}}) {
  const caption=layer.querySelector('.guide-caption'),text=layer.querySelector('.guide-message'),hand=layer.querySelector('.guide-hand');
  if(text.textContent!==label)text.textContent=label;
  const maxWidth=guidePanelWidth(bounds.width);
  const mascotSize=Math.min(144,Math.max(116,bounds.width*.34));
  layer.style.setProperty('--guide-mascot-size',`${mascotSize}px`);
  layer.style.setProperty('--guide-bubble-inset',`${mascotSize*.66}px`);
  layer.style.setProperty('--guide-text-inset',`${mascotSize*.3}px`);
  // Short prompts hug their text; longer instructions wrap within the game.
  Object.assign(caption.style,{width:'max-content',maxWidth:`${maxWidth}px`,maxHeight:'none',minHeight:`${mascotSize+12}px`});
  const place=guidePlacement({target,bounds,viewport,panel:{width:caption.offsetWidth,height:caption.offsetHeight}});
  if(place.maxHeight<48)return false;
  hand.classList.toggle('points-up',place.side==='below');
  Object.assign(hand.style,{left:`${place.pointerX}px`,top:`${place.pointerY}px`});
  Object.assign(caption.style,{left:`${place.x}px`,top:`${place.y}px`,maxHeight:`${place.maxHeight}px`,minHeight:`${Math.min(mascotSize+12,place.maxHeight)}px`});
  return true;
}
