import { nativeLabProgressGate } from '../replica/native-client-rules.js';

export function researchUnlockMessage(campaign, row) {
  const gate=nativeLabProgressGate(campaign);
  if(!gate.reached)return `通过第${gate.chapter}章第${gate.wave}波开启科研`;
  if(row&&!gate.developmentUnlocked&&gate.reachedChapter<row.unlockChapter)return `到达第${row.unlockChapter}章开启`;
  return '';
}

export function researchTabs(snapshot,current='talent') {
  const locked=Boolean(researchUnlockMessage(snapshot.replicaCampaign));
  const selected=!locked&&current==='lab'?'lab':'talent';
  const tabs=[['talent','天赋'],...locked?[]:[['lab','科研']]];
  // UIMainCard.OnShow hides tabTechnology until Function 10 is open.
  return `<nav class="research-tabs" role="tablist" aria-label="科技研究分类">${tabs.map(([id,label])=>`<button type="button" role="tab" class="psd-tab research-tab${selected===id?' is-active':''}" data-action="researchSection" data-section="${id}" aria-selected="${selected===id}" tabindex="${selected===id?0:-1}">${label}</button>`).join('')}</nav>`;
}
