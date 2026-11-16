import { chapterPreviewBackground } from '../replica/chapter-presentation.js';
import './task-popup-polish.css';
// Presentation only: use the existing task, chapter and activity actions.
export const COMMAND_PANELS = new Set(['tasks', 'mail', 'chapters', 'stages', 'activities']);

export function lobbyCommandPanel(type, s, h, period = 'daily') {
  if (!COMMAND_PANELS.has(type) || ['tasks','activities'].includes(type)) return null;
  const { escape: e, number: n, icon } = h;
  const summary = (symbol, eyebrow, title, detail, stat) => `<header class="lc-summary"><div class="lc-emblem">${icon(symbol)}</div><div>${eyebrow ? `<small>${eyebrow}</small>` : ''}<h3>${title}</h3>${detail ? `<p>${detail}</p>` : ''}</div>${stat ? `<b class="lc-summary-stat">${stat}</b>` : ''}</header>`;
  if (type === 'mail') {
    return { title: '航线邮件', content: `<div class="lc-panel lc-mail">${summary('mission', '', '收件箱', '', '0<em> 封</em>')}<div class="lc-mail-empty"><div class="lc-mail-orbit"></div><svg class="lc-mail-art" viewBox="0 0 200 160" aria-hidden="true"><path d="M16 49 100 9l84 40v88l-13 14H29l-13-14Z" fill="#102c45" stroke="#64bddd" stroke-width="3"/><path d="M43 68V25h114v70l-57 36Z" fill="#cfe8f2" stroke="#163e59" stroke-width="5"/><path d="M65 47h69M65 62h52M65 77h35" stroke="#72a3ba" stroke-width="6"/><path d="m18 55 82 58 82-58v81l-11 13H30l-12-13Z" fill="#24577b" stroke="#72d5ef" stroke-width="3"/><path d="m22 141 55-51m101 51-55-51" stroke="#4389af" stroke-width="3"/><path d="m85 105 15-9 15 9v19l-15 9-15-9Z" fill="#ffda50" stroke="#092138" stroke-width="4"/></svg><h3>暂无新邮件</h3><div class="lc-mail-rule"><i></i>${icon('plane')}<i></i></div></div></div>` };
  }
  if (type === 'chapters' || type === 'stages') {
    const stages = s.stages || [];
    const cleared = stages.filter(x => x.bestCleared).length;

    return { title: '章节地图', content: `<div class="lc-panel lc-chapters">${summary('plane', '', '章节进度', '', `${cleared}<em> / ${stages.length}</em>`)}<div class="lc-route">${stages.map((stage, i) => `<button type="button" class="lc-chapter ${stage.index === s.selectedStageIndex ? 'is-selected' : ''} ${stage.unlocked === false ? 'is-locked' : ''}" data-action="stage" data-index="${stage.index}" ${stage.unlocked === false ? 'disabled' : ''} aria-label="第 ${i + 1} 章 ${e(stage.name)}，${stage.unlocked === false ? '未解锁' : stage.bestCleared ? '已通关' : '可挑战'}" style="--lc-scene:${e(chapterPreviewBackground(stage.index))}"><span class="lc-chapter-number">${String(i + 1).padStart(2,'0')}</span><span class="lc-chapter-info"><small>${stage.waveCount || 15} 波</small><strong>${e(stage.name)}</strong><span class="lc-chapter-stars" aria-label="${stage.stars || 0} 星">${[1,2,3].map(v => `<i class="${(stage.stars || 0) >= v ? 'is-earned' : ''}">${icon('star')}</i>`).join('')}</span></span><span class="lc-chapter-status">${stage.unlocked === false ? icon('lock') : stage.index === s.selectedStageIndex ? '当前战区' : stage.bestCleared ? '已通关' : '可挑战'}${stage.unlocked === false ? '' : icon('arrow')}</span></button>`).join('')}</div></div>` };
  }
  return null;
}
