import './developer-skills.css';
import type { Simulation } from './kernel/simulation';
import type { GameAudio } from './kernel/audio';
import type { Interface } from './kernel/ui';

const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const categories = { all: '全部', weapon: '武器', passive: '强化', pilot: '驾驶员', plane: '飞机' };

export function mountDeveloperSkills(stage: HTMLElement, sim: Simulation, audio: GameAudio, ui: Interface) {
  // Outside the stage: its capture listener routes canvas HUD pointers before DOM buttons.
  const root = document.createElement('section');
  root.className = 'developer-battle-skills'; root.setAttribute('aria-label', '局内开发技能');
  root.innerHTML = '<button class="dev-skill-button dev-skill-launch" type="button">全部技能</button><div class="dev-skill-modal" hidden></div>';
  document.body.append(root);
  const launch = root.querySelector<HTMLButtonElement>('.dev-skill-launch')!;
  const modal = root.querySelector<HTMLDivElement>('.dev-skill-modal')!;
  let opened = false, resume = false, tab = 'all', query = '', error = '', limit = 45, suppressed = false;
  const fit = () => {
    const rect = stage.getBoundingClientRect();
    Object.assign(root.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
  };
  const resize = new ResizeObserver(fit); resize.observe(stage); window.addEventListener('resize', fit); fit();
  const renderRows = () => {
    const rows = sim.developerSkillCatalog.filter(item => (tab === 'all' || item.category === tab) && `${item.name} ${item.label} ${item.description}`.includes(query.trim()));
    const history = [...(sim.content.combat.studyLoadout?.battleSkillIds || []), ...sim.learned.map(item => item.id)];
    modal.querySelector('.dev-skill-count')!.textContent = `${rows.length} 项`;
    modal.querySelector('.dev-skill-list')!.innerHTML = rows.slice(0, limit).map(item => {
      const count = history.filter(id => id === item.id).length;
      const max = Math.max(1, Number(sim.content.combat.skillRows[item.id]?.MaxCount || 1));
      const owned = count >= max;
      const unavailable = !!item.unavailable;
      return `<button type="button" class="dev-skill-row" data-skill="${item.id}" ${owned || unavailable ? 'disabled' : ''}><span><strong>${escape(item.name)}</strong><small>${escape(item.label)}${count ? ` · 已选 ${count}/${max}` : ''}</small><span class="dev-skill-description">${escape(item.description)}${unavailable ? '（战斗行为待接入）' : ''}</span></span><b>${unavailable ? '待接入' : owned ? '已选' : '选择'}</b></button>`;
    }).join('') || '<p>没有找到匹配的技能</p>';
    modal.querySelector<HTMLButtonElement>('[data-dev="more"]')!.hidden = rows.length <= limit;
  };
  function render() {
    modal.innerHTML = `<section class="dev-skill-dialog" role="dialog" aria-modal="true" aria-label="全部技能"><header><h2>全部技能</h2><button class="dev-skill-button" type="button" data-dev="close" aria-label="关闭全部技能">返回</button></header><p>武器、升级、驾驶员与飞机技能均可选。仅本局生效。</p><nav aria-label="技能分类">${Object.entries(categories).map(([key, name]) => `<button type="button" class="dev-skill-button" data-tab="${key}" aria-pressed="${tab === key}">${name}</button>`).join('')}</nav><label class="dev-skill-search"><input type="search" aria-label="搜索技能" placeholder="搜索技能或驾驶员、飞机" value="${escape(query)}"><span class="dev-skill-count"></span></label><p class="dev-skill-error" role="status">${escape(error)}</p><div class="dev-skill-list"></div><button class="dev-skill-button" data-dev="more" type="button">显示更多</button></section>`;
    renderRows();
  }
  function open() {
    if (opened || !sim.developerSkillCatalog.length || !['playing', 'paused', 'upgrade'].includes(sim.phase) || sim.player.hp <= 0) return;
    resume = sim.phase === 'playing';
    if (resume) sim.pause();
    audio.pause(); opened = true; error = ''; modal.hidden = false; launch.hidden = true; render();
    modal.querySelector<HTMLButtonElement>('[data-dev="close"]')?.focus({ preventScroll: true });
  }
  function close() {
    opened = false; modal.hidden = true; suppressed = sim.phase === 'upgrade';
    if (resume && sim.phase === 'paused') sim.resume();
    // An upgrade pick can return to playing directly, without a paused phase.
    if (sim.phase === 'playing') audio.resume();
    resume = false; launch.focus({ preventScroll: true });
  }
  launch.addEventListener('click', open);
  root.addEventListener('keydown', event => { if (event.key === 'Escape' && opened) { event.stopPropagation(); close(); } });
  modal.addEventListener('input', event => {
    if (!(event.target instanceof HTMLInputElement)) return;
    query = event.target.value; limit = 45; renderRows();
  });
  modal.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button || button.disabled) return;
    if (button.dataset.dev === 'close') close();
    else if (button.dataset.dev === 'more') { limit += 45; renderRows(); }
    else if (button.dataset.tab) { tab = button.dataset.tab; limit = 45; render(); }
    else if (button.dataset.skill) {
      try {
        if (!sim.learnDeveloperSkill(Number(button.dataset.skill))) return;
        audio.feedback('upgrade'); close(); ui.update();
      } catch (reason) { error = reason instanceof Error ? reason.message : String(reason); render(); }
    }
  });
  const previous = ui.update.bind(ui);
  const update = () => {
    previous();
    const available = sim.developerSkillCatalog.length > 0 && ['playing', 'paused', 'upgrade'].includes(sim.phase) && sim.player.hp > 0;
    root.hidden = !available; launch.hidden = opened;
    if (sim.phase !== 'upgrade') suppressed = false;
    if (!available && opened) { opened = false; modal.hidden = true; resume = false; }
    if (available && sim.phase === 'upgrade' && !opened && !suppressed) open();
  };
  ui.update = update;
  return { destroy() { ui.update = previous; resize.disconnect(); window.removeEventListener('resize', fit); root.remove(); } };
}
