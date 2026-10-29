// Resource shortages are represented by costs and disabled controls.
export const isResourceShortage = value => /(?:金币|钻石|体力|材料|零件|碎片|图纸|星核|积分|箱券|同名卡|资源|星数).*不足/.test(String(value||''));
export const availabilityMessage = value => isResourceShortage(value) ? '' : value;

export function shortageToast(value='资源') {
  const name=String(value).match(/(?:金币|钻石|体力|材料|零件|碎片|图纸|星核|积分|箱券|同名卡|星数|资源)/)?.[0]||'资源';
  return `${name}不足，请通关获得后重试`;
}
// Keep the unavailable appearance, but route presses to feedback only.
export function prepareShortageFeedback(host) {
  for(const button of host.querySelectorAll('button[disabled]')) {
    let resource=button.dataset.resourceShort;
    const scope=['upgrade','workshopSynthesize','fleetConfirm','nativeLabUpgrade'].includes(button.dataset.action)?button.closest('.ws-page,.fc-detail,.fc-operation-preview,.native-lab-operation,.weapon-detail'):null;
    const short=button.querySelector('.is-short,[data-cost-state="short"]')
      || scope?.querySelector('[data-cost-state="short"],.native-lab-shortage,.is-short');
    if(!resource&&short) {
      const icon=short.querySelector('img');
      const source=icon?.getAttribute('src')||'';
      resource=short.dataset.costResource||(/diamond|gem/.test(source)?'钻石':/coin/.test(source)?'金币':/stamina|energy/.test(source)?'体力':/core/.test(source)?'星核':'材料');
      resource=({coin:'金币',coins:'金币',diamond:'钻石',diamonds:'钻石',energy:'体力',core:'星核',parts:'零件'})[resource]||resource;
    }
    if(!resource)continue;
    button.dataset.resourceShort=resource;
    button.disabled=false;
    button.setAttribute('aria-disabled','true');
    button.classList.add('is-resource-short');
  }
}
