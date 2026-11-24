import './combat-ui.css';
import './psd-popup.css';

export {upgradeSummary} from './upgrade-summary-model.js';

// Native modal isolates input from the canvas. Reading never consumes a choice.
export function showUpgradeDetails(skill,model) {
  const dialog=document.createElement('dialog');
  dialog.className='combat-detail-dialog';
  dialog.dataset.psdPopup='secondary';
  dialog.dataset.upgradeKind=model.evolving?'evolution':'numeric';
  dialog.setAttribute('aria-labelledby','combat-detail-title');
  const header=document.createElement('header');header.className='combat-detail-heading';
  const eyebrow=document.createElement('span');eyebrow.className='combat-detail-eyebrow';eyebrow.textContent=model.evolving?'形态强化':'数值强化';
  const title=document.createElement('h3');title.textContent=model.name;
  title.id='combat-detail-title';
  const kind=document.createElement('span');kind.className='combat-detail-kind';kind.textContent=model.label;
  header.append(title,eyebrow,kind);
  const body=document.createElement('div');body.className='combat-detail-body';
  const owner=document.createElement('p');owner.className='combat-detail-owner';owner.textContent=model.owner;
  const level=document.createElement('div');level.className='combat-detail-level';
  const levelLabel=document.createElement('span');levelLabel.textContent=model.evolving?'形态变化':model.stat.label;
  const levelValue=document.createElement('strong');levelValue.textContent=`${model.stat.before} → ${model.stat.after}${model.stat.unit}`;
  level.append(levelLabel,levelValue);
  const effects=document.createElement('section');effects.className='combat-detail-effects';
  const effectsTitle=document.createElement('h4');effectsTitle.textContent='强化效果';
  const copy=document.createElement('p');copy.id='combat-detail-effects';
  copy.textContent=model.descriptions.join('\n\n');
  effects.append(effectsTitle,copy);
  const note=document.createElement('p');note.className='combat-detail-note';note.textContent=skill.restriction||'仅本局有效';
  body.append(owner,level,effects,note);
  const close=document.createElement('button');close.textContent='返回选择';
  // The canvas opens this modal on pointer-up. Its following synthetic click
  // can land on this newly mounted button; only accept a gesture begun here.
  let closePressed=false;
  close.addEventListener('pointerdown',()=>{closePressed=true;});
  close.addEventListener('pointercancel',()=>{closePressed=false;});
  close.onclick=event=>{if(event.detail===0||closePressed)dialog.close();closePressed=false;};
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  const topClose=document.createElement('button');topClose.className='psd-popup-close';topClose.setAttribute('aria-label','关闭强化详情');
  let topPressed=false;topClose.onpointerdown=()=>{topPressed=true;};topClose.onpointercancel=()=>{topPressed=false;};
  topClose.onclick=event=>{if(event.detail===0||topPressed)dialog.close();topPressed=false;};
  dialog.append(header,body,close,topClose);document.body.append(dialog);dialog.showModal();
}
