export const isRewardReceiptModal=modal=>['rewards','shopBoxResult','researchResult'].includes(modal?.type);
export const isRewardLayerModal=modal=>isRewardReceiptModal(modal)||['taskChestPreview','aircraftActivation','processFeedback','boxOpening'].includes(modal?.type);
// Skill inspection retains its source WeaponInfo just like a receipt retains
// its source page. It is still a read-only preview, never a reward receipt.
export const isRetainedModalLayer=modal=>isRewardLayerModal(modal)||(modal?.type==='nativeSkillPreview'&&modal.kind==='guns'&&modal.returnTo?.type==='nativeCollectionDetail');
export const modalIdentity=modal=>modal?`${modal.type}:${modal.id||''}:${modal.view||''}`:'';
export const activeModalHost=root=>root.querySelector('[data-reward-layer="overlay"]')||root.querySelector('.pl-modal-host');

export function captureModalScroll(host) {
  return [...host.querySelectorAll('*')].filter(node=>node.scrollTop||node.scrollLeft).map(node=>{
    const path=[];let current=node;
    while(current!==host){const parent=current.parentElement;if(!parent)return null;path.unshift([...parent.children].indexOf(current));current=parent;}
    return {path,top:node.scrollTop,left:node.scrollLeft};
  }).filter(Boolean);
}
export function restoreModalScroll(host,positions=[]) {
  for(const {path,top,left}of positions){let node=host;for(const index of path)node=node?.children[index];if(node){node.scrollTop=top;node.scrollLeft=left;}}
}

// Move the live source nodes, rather than taking a screenshot or cloning them.
// The same dialog, scrollports and selected controls survive the receipt.
export function mountRewardLayers(host) {
  const document=host.ownerDocument;
  const positions=captureModalScroll(host);
  const underlay=document.createElement('div');
  underlay.className='reward-modal-underlay';underlay.dataset.rewardLayer='underlay';
  underlay.append(...host.childNodes);
  underlay.inert=true;underlay.setAttribute('aria-hidden','true');
  const dialogs=[...underlay.querySelectorAll('[role="dialog"]')].map(node=>[node,node.getAttribute('aria-modal')]);
  for(const [node]of dialogs){
    // Rapid claims must not leave the source half transparent underneath.
    node.getAnimations?.().filter(motion=>motion.id==='ui-dialog').forEach(motion=>motion.finish());
    node.setAttribute('aria-modal','false');
  }
  const overlay=document.createElement('div');
  overlay.className='reward-modal-overlay';overlay.dataset.rewardLayer='overlay';
  host.append(underlay,overlay);
  restoreModalScroll(underlay,positions);
  return {overlay,restore(){
    const currentPositions=captureModalScroll(underlay);
    for(const [node,value]of dialogs){if(value===null)node.removeAttribute('aria-modal');else node.setAttribute('aria-modal',value);}
    underlay.inert=false;
    host.replaceChildren(...underlay.childNodes);
    restoreModalScroll(host,currentPositions);
  }};
}

// A retained source dialog still owns its original title ID.
export function labelRewardLayer(host) {
  const heading=host.querySelector('#lobby-modal-title');
  if(!heading)return;
  heading.id='lobby-reward-title';
  for(const node of host.querySelectorAll('[aria-labelledby="lobby-modal-title"]'))node.setAttribute('aria-labelledby','lobby-reward-title');
}
