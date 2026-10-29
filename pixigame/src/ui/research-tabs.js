import { nativeLabProgressGate } from '../replica/native-client-rules.js';

export function researchTabs(snapshot,current='talent') {
  const gate=nativeLabProgressGate(snapshot.replicaCampaign);
  return `<nav class="research-tabs" aria-label="科技研究分类"><button type="button" class="wc-button research-tab ${current==='talent'?'is-active':''}" data-action="researchSection" data-section="talent" aria-pressed="${current==='talent'}">天赋</button><button type="button" class="wc-button research-tab ${current==='lab'?'is-active':''}" data-action="researchSection" data-section="lab" aria-pressed="${current==='lab'}" ${gate.reached?'':`disabled title="通过第${gate.chapter}章第${gate.wave}波开放" aria-label="科研，通过第${gate.chapter}章第${gate.wave}波开放"`}>科研${gate.reached?'':`<small>${gate.chapter}章${gate.wave}波开放</small>`}</button></nav>`;
}
