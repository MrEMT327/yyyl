import { nativeCollectionArt, nativeSkillArt } from '../replica/native-collection-art.js';
import { projectIcon } from './project-ui-art.js';

// Receipt is created only after the native transaction succeeds. No estimated
// power or invented attributes are substituted when the live value is absent.
export function aircraftActivationReceipt({kind,operation,result,before,after,previousPower,power}) {
  if(kind!=='skins'||operation!=='unlock'||!result?.ok||before?.owned||!after?.owned)return null;
  return {id:after.id,previousStars:before?.star||0,
    ...(Number.isFinite(previousPower)&&Number.isFinite(power)?{power,powerDelta:power-previousPower}:{})};
}

export function aircraftActivationDialog(row,receipt,s,h) {
  const e=h.escape,n=h.number;
  const stars=Array.from({length:Math.max(5,...row.stages.map(stage=>stage.star))},(_,i)=>projectIcon('star',i<row.star?'':'is-icon-muted')).join('');
  const attributes=(row.stage.attributes||[]).map(value=>{
    const [key,amount]=value.split('=');
    return `<span>${e(s.replicaCollection.attributeNames[key]||key)} <b>${Number(amount)>=0?'+':''}${e(amount)}${key.endsWith('%')?'%':''}</b></span>`;
  }).join('');
  const skills=row.stage.skills.map(skill=>`<div class="aircraft-activation-skill"><img src="${e(nativeSkillArt(skill))}" alt=""><div><strong>${e(skill.name.replace(/<[^>]*>/g,''))}</strong><p>${e(skill.description.replace(/<[^>]*>/g,''))}</p></div></div>`).join('');
  const power=Number.isFinite(receipt.power)?`<p class="aircraft-activation-power">战力 <b>${n(receipt.power)}</b>${receipt.powerDelta>0?`<strong>↑ ${n(receipt.powerDelta)}</strong>`:''}</p>`:'';
  return `<div class="pl-modal-backdrop aircraft-activation-backdrop" data-action="dismiss"><section class="pl-modal aircraft-activation-modal" data-modal-type="aircraftActivation" role="dialog" aria-modal="true" aria-labelledby="lobby-modal-title" tabindex="-1">
    <div class="aircraft-activation-heading"><img src="/art/aircraft-activation-v1/activation-header.png" alt=""><h2 id="lobby-modal-title">激活成功</h2></div>
    <div class="aircraft-activation-display"><img class="aircraft-activation-light" src="/art/aircraft-activation-v1/activation-stage.png" alt=""><img class="aircraft-activation-plane" src="${e(nativeCollectionArt(row,'default'))}" alt="${e(row.name)}">${power}</div>
    <h3>${e(row.name)}</h3><div class="aircraft-activation-stars" aria-label="${row.star}星">${stars}</div>
    ${attributes?`<div class="aircraft-activation-attributes">${attributes}</div>`:''}
    <div class="aircraft-activation-skills">${skills||'<p>无战机技能</p>'}</div>
    <button type="button" class="aircraft-activation-dismiss common-reward-dismiss" data-action="close">点击空白处关闭</button>
  </section></div>`;
}
