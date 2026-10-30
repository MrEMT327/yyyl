import { nativeLabProgressGate } from '../replica/native-client-rules.js';

export function researchUnlockMessage(campaign, row) {
  const gate=nativeLabProgressGate(campaign);
  if(!gate.reached)return `通过第${gate.chapter}章第${gate.wave}波开启科研`;
  if(row&&!gate.developmentUnlocked&&gate.reachedChapter<row.unlockChapter)return `到达第${row.unlockChapter}章开启`;
  return '';
}

export function researchTabs(snapshot,current='talent') {
  const locked=Boolean(researchUnlockMessage(snapshot.replicaCampaign));
  return `<nav class="research-tabs" aria-label="科技研究分类"><button type="button" class="wc-button research-tab ${current==='talent'?'is-active':''}" data-action="researchSection" data-section="talent" aria-pressed="${current==='talent'}">天赋</button><button type="button" class="wc-button research-tab ${current==='lab'?'is-active':''}${locked?' is-chapter-locked':''}" data-action="researchSection" data-section="lab" aria-pressed="${current==='lab'}"${locked?' aria-disabled="true"':''}>科研</button></nav>`;
}
