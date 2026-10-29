import type { GameAudio } from './audio';
import type { RecordData, Choice } from './model';
import type { Simulation } from './simulation';
import { OriginalUpgradeAnimation } from './ui-animation';
import { OriginalPunchboard } from './ui-punchboard';
import { WaveUIPresentation } from './wave-ui';

const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const clock = (time: number) => `${Math.floor(time / 60).toString().padStart(2, '0')}:${Math.floor(time % 60).toString().padStart(2, '0')}`;

export class Interface {
  private last = '';
  private lastNotice = '';
  private hud: HTMLElement;
  private overlay: HTMLElement;
  private banner: HTMLElement;
  private upgradeAnimation: OriginalUpgradeAnimation;
  private punchboard: OriginalPunchboard;
  private wavePresentation: WaveUIPresentation;
  private selecting = false;
  private pauseView: 'inventory' | 'stats' | 'settings' = 'inventory';
  private selectionTimers: number[] = [];
  private resultAudioKey = '';
  constructor(private root: HTMLElement, private sim: Simulation, private audio: GameAudio, private sprites: RecordData, private onStart: () => void, private onHome?: () => void, private weaponIcon?: (familyId: number, star: number, choice?: Choice, preview?: boolean) => { key: string; url: string } | undefined, private researchMode = false) {
    this.upgradeAnimation = new OriginalUpgradeAnimation(sprites);
    this.punchboard = new OriginalPunchboard(sprites,key=>this.audio.feedback(key));
    this.wavePresentation = new WaveUIPresentation(this.upgradeAnimation, root);
    root.innerHTML = `<section id="hud"><button id="pause-button" class="pause-button" aria-label="暂停">${this.image('Pause')}</button><div class="wave-readout"><strong id="wave-count">第 1/15 波</strong><div class="experience"><span id="level">Lv.1</span><div class="track">${this.image('bossProgress_bar_bottom', 'track-bg')}<div class="track-fill"><i id="experience-fill">${this.image('stg_expProcess')}</i></div>${this.image('stg_Pos', 'experience-marker')}</div></div></div><div class="counters"><span>${this.image('Integral_bottom_box', 'counter-bg')}${this.image('ui_coin', 'counter-icon')}<b id="gold">0</b></span><span>${this.image('Integral_bottom_box', 'counter-bg')}${this.image('ui_kill', 'counter-icon')}<b id="kills">0</b></span></div></section><div id="wave-banner"></div><div id="boss-hud" hidden>${this.image('bossProgress_icon', 'boss-icon')}<div>${this.image('bossProgress_bar_bottom', 'boss-track')}<i>${this.image('stg_boss_progress1')}</i></div></div><div id="loadout" hidden></div><div id="overlay"></div>`;
    this.hud = root.querySelector('#hud')!; this.overlay = root.querySelector('#overlay')!; this.banner = root.querySelector('#wave-banner')!;
    root.querySelector('.wave-readout')!.insertAdjacentHTML('afterbegin', this.image('stg_point', 'wave-title-bg'));
    root.querySelector('#pause-button')!.addEventListener('click', () => this.togglePause());
    this.overlay.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
      if (!button) return;
      switch (button.dataset.action) {
        case 'start': this.saveEntryStats(); this.audio.unlock().catch(() => {}); this.onStart(); break;
        case 'chapter': {
          const chapter = Number(button.dataset.chapter);
          if (this.sim.content.chapter.catalog.some((row: RecordData) => row.id === chapter)) {
            const url = new URL(location.href); url.searchParams.set('chapter', String(chapter)); location.assign(url);
          }
          break;
        }
        case 'continue': this.sim.resume(); this.audio.resume(); break;
        case 'punchboard': if (this.sim.phase === 'treasure' && this.punchboard.activate()) { this.sim.closeTreasure(); this.audio.resume(); } break;
        case 'restart': this.audio.unlock().catch(() => {}); this.onStart(); break;
        case 'sound': this.audio.toggle(); if (this.sim.phase === 'paused') this.audio.pause(); this.last = ''; break;
        case 'pause-stats': this.pauseView = 'stats'; break;
        case 'pause-settings': this.pauseView = 'settings'; break;
        case 'pause-back': this.pauseView = 'inventory'; break;
        case 'home': if (this.onHome) this.onHome(); else { this.sim.reset(); this.audio.pause(); } break;
        case 'choose': this.selectCard(button); break;
      }
      this.update();
    });
  }
  private saveEntryStats() {
    const player = this.sim.content.chapter.player;
    const value = (selector: string, fallback: number) => {
      const input = this.overlay.querySelector<HTMLInputElement>(selector), number = Number(input?.value);
      return Number.isFinite(number) && number > 0 ? Math.min(1e9, Math.max(1, number)) : fallback;
    };
    player.attack = value('#entry-attack', player.attack); player.hp = value('#entry-hp', player.hp);
    try { localStorage.setItem(`danke-entry-${this.sim.content.chapter.chapter.id}`, JSON.stringify({ attack: player.attack, hp: player.hp })); } catch { /* Optional browser storage. */ }
  }
  togglePause() { if (this.sim.phase === 'playing') { this.sim.pause(); this.audio.pause(); } else if (this.sim.phase === 'paused') { this.sim.resume(); this.audio.resume(); } this.update(); }
  private selectCard(button: HTMLButtonElement) {
    if (this.selecting || this.sim.phase !== 'upgrade') return;
    const card = this.sim.choices.find(c => c.id === Number(button.dataset.id));
    if (!card) return;
    const commit = () => {
      this.sim.sounds=this.sim.sounds.filter(id=>id!==410001);
      this.sim.choose(card.id);
      this.selecting = false;
      if (this.sim.phase === 'playing') this.audio.resume();
      this.update();
    };
    this.selecting = true;
    // Confirm the accepted press while combat is still paused, before its sounds resume.
    this.audio.feedback('choice');
    this.overlay.classList.add('selecting');
    const bounds = button.getBoundingClientRect(), host = this.root.getBoundingClientRect();
    this.upgradeAnimation.stop();
    this.upgradeAnimation.pressCard(button);
    if (!card.opensBreakthrough) {
      // BaseSkillSelectItem submits on the original .4s PressEnd event.
      this.selectionTimers.push(window.setTimeout(commit, 400));
      return;
    }
    const copy = button.cloneNode(true) as HTMLButtonElement;
    copy.removeAttribute('data-action'); copy.tabIndex = -1;
    copy.classList.add('selected-card');
    Object.assign(copy.style, { position: 'absolute', left: `${bounds.left - host.left}px`, top: `${bounds.top - host.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px`, opacity: '1', visibility: 'visible' });
    this.root.append(copy); copy.style.visibility = 'hidden';
    this.upgradeAnimation.trackCopy(copy);
    // Native move tween .2s, then original show clip events at .85s / 1.166667s.
    this.selectionTimers.push(window.setTimeout(() => {
      button.style.visibility = 'hidden'; copy.style.visibility = 'visible';
      copy.animate([{ transform: 'translate(0,0) scale(1)' }, { transform: `translate(${host.width / 2 - (bounds.left - host.left + bounds.width / 2)}px,${host.height / 2 - (bounds.top - host.top + bounds.height / 2)}px) scale(1.2)` }], { duration: 200, fill: 'forwards', easing: 'linear' });
    }, 400));
    this.selectionTimers.push(window.setTimeout(() => {this.upgradeAnimation.showBreakthrough(copy);this.audio.feedback('breakthrough');}, 600));
    this.selectionTimers.push(window.setTimeout(commit, 1450));
    this.selectionTimers.push(window.setTimeout(() => copy.remove(), 1767));
  }
  private weaponIconKey(familyId: number, star: number, choice?: Choice, preview = false): string {
    const image = this.weaponIcon?.(familyId, star, choice, preview);
    if (image) { this.sprites[image.key] = { url: image.url }; return image.key; }
    return this.sim.content.combat.families[familyId]?.icon || String(familyId);
  }
  private skinReward(card: Choice): Choice {
    return this.sim.content.combat.families[card.group]
      ? { ...card, icon: this.weaponIconKey(card.group, card.star, card) } : card;
  }
  private image(key: string, className = '') { const sprite = this.sprites[key]; return sprite ? `<img class="${className}" src="${escape(sprite.url)}" alt="" draggable="false">` : ''; }
  update() {
    const s = this.sim;
    // Opening upgrades can precede the first playing tick. Consume their cue
    // here so it cannot linger and play on top of the later selection result.
    if(s.phase==='upgrade'&&s.sounds.includes(410001)){
      this.audio.pause(false,true);
      if(this.audio.feedback('upgrade'))s.sounds=s.sounds.filter(id=>id!==410001);
    }
    this.wavePresentation.update(s.waveUIRequest, s.runId, s.phase === 'playing', id => s.completeWaveUI(id));
    this.hud.hidden = s.phase === 'ready';
    this.root.querySelector('#wave-count')!.textContent = `第 ${s.wave}/${s.content.chapter.chapter.waveCount} 波`;
    this.root.querySelector('#level')!.textContent = `Lv.${s.level}`;
    (this.root.querySelector('#experience-fill') as HTMLElement).style.width = `${s.expProgress * 100}%`;
    (this.root.querySelector('.experience-marker') as HTMLElement).style.left = `${(21 + s.expProgress * 493) / 540 * 100}%`;
    this.root.querySelector('#gold')!.textContent = String(Math.floor(s.gold));
    this.root.querySelector('#kills')!.textContent = String(s.kills);
    const bossHud = this.root.querySelector('#boss-hud') as HTMLElement;
    bossHud.hidden = !s.boss;
    if (s.boss) (bossHud.querySelector('i') as HTMLElement).style.width = `${Math.max(0, s.boss.hp / s.boss.maxHp) * 100}%`;
    const banner = s.noticeUntil > s.clock && s.phase === 'playing' ? s.notice : '';
    if (banner !== this.lastNotice) {
      this.lastNotice = banner;
      this.banner.textContent = banner;
      this.banner.classList.toggle('visible', Boolean(banner));
    }
    if (s.phase === 'ready' || s.phase === 'won' || s.phase === 'lost' || s.player.hp <= 0) this.upgradeAnimation.clearWarning();
    if (s.phase !== 'upgrade' && this.selecting) {
      this.selectionTimers.forEach(clearTimeout); this.selectionTimers = []; this.selecting = false;
      this.root.querySelectorAll('.selected-card').forEach(node => node.remove());
    }
    this.upgradeAnimation.update();
    if (s.phase === 'treasure') this.punchboard.update();
    else this.punchboard.stop();
    if (s.phase !== 'paused') this.pauseView = 'inventory';
    const state = `${s.phase}:${s.choices.map(c => c.id).join(',')}:${s.learned.length}:${this.audio.enabled}:${this.pauseView}`;
    if (state === this.last) return;
    this.last = state;
    this.upgradeAnimation.stop();
    this.root.querySelector('#loadout')!.innerHTML = s.phase === 'ready' ? '' : this.equippedWeapons().map(weapon => this.image(weapon.icon)).join('');
    this.overlay.className = s.phase === 'playing' ? '' : `overlay ${s.phase}`;
    if (s.phase === 'playing') { this.overlay.innerHTML = ''; return; }
    if (s.phase === 'ready') {
      const chapter = s.content.chapter.chapter, player = s.content.chapter.player;
      const chapters = s.content.chapter.catalog.map((row: RecordData) => `<button data-action="chapter" data-chapter="${row.id}" class="${row.id === chapter.id ? 'active' : ''}" aria-pressed="${row.id === chapter.id}">${row.id}</button>`).join('');
      this.overlay.style.setProperty('--chapter-columns', String(Math.min(8, Math.ceil(s.content.chapter.catalog.length / 2))));
      this.overlay.innerHTML = `<div class="chapter-heading"><span>${this.researchMode ? '研究试打' : '普通关卡'}</span><h1>第 <em>${chapter.id}</em> 章</h1><p>${escape(chapter.name)} · ${chapter.waveCount} 波敌袭</p><nav class="chapter-picker" aria-label="选择关卡">${chapters}</nav></div><div class="start-panel"><div class="starter-weapon">${this.image(this.weaponIconKey(10000101, 1))}<span>速射机炮</span></div><fieldset class="entry-stats"><legend>入场战力 · 本地设置</legend><label>攻击<input id="entry-attack" type="number" inputmode="decimal" min="1" max="1000000000" value="${player.attack}"></label><label>生命<input id="entry-hp" type="number" inputmode="decimal" min="1" max="1000000000" value="${player.hp}"></label></fieldset><button class="primary" data-action="start">开始战斗</button><p class="input-hint">拖动移动 · 自动射击</p><button class="text-button" data-action="sound">${this.audio.enabled ? '音效开启' : '音效关闭'}</button></div>`;
      return;
    }
    if (s.phase === 'revive') {
      this.audio.pause(); this.overlay.innerHTML = ''; return;
    }
    if (s.phase === 'paused') {
      this.overlay.innerHTML = this.pauseScreen();
      return;
    }
    if (s.phase === 'upgrade') {
      this.audio.pause(false,true);
      this.overlay.innerHTML = `<div class="upgrade-title">${this.image('Choose_skills_title')}<h2>武器升级</h2></div><div class="upgrade-cards count-${s.choices.length}">${s.choices.map(c => this.card(c)).join('')}</div><p class="upgrade-hint">从上方选择一个<span>武器技能</span>学习。</p>`;
      this.upgradeAnimation.start(this.overlay);
      return;
    }
    if (s.phase === 'treasure') {
      this.audio.pause(false,true);
      const rewards = s.treasureRewards.map(c => this.skinReward(c));
      const pool = [...this.equippedWeapons(), ...s.learned.filter(c => c.id >= 11000000), ...rewards];
      this.punchboard.mount(this.overlay, rewards.map(c => ({ ...c, description: c.description || originalSkillDescription(c as unknown as RecordData) || effectDescription(c.effects) })), [...new Map(pool.map(c => [c.icon, c])).values()]);
      return;
    }
    this.audio.pause();
    const resultKey=`${s.runId}:${s.phase}`;
    if((s.phase==='won'||s.phase==='lost')&&this.resultAudioKey!==resultKey){
      this.resultAudioKey=resultKey;
      const expectedPhase=s.phase,run=s.runId;
      const cue=expectedPhase==='won'?'mixkit:victory':'mixkit:defeat';
      // Let a boss's finite explosion finish before the victory cue.
      const delay=expectedPhase==='won'?1700:0;
      this.selectionTimers.push(window.setTimeout(()=>{
        if(this.sim.runId===run&&this.sim.phase===expectedPhase&&!document.hidden&&this.root.isConnected)
          this.audio.effect(cue,expectedPhase==='won'?.24:.19,1);
      },delay));
    }
    this.overlay.innerHTML = `<div class="result-panel"><span class="result-kicker">${this.researchMode ? '研究试打' : '普通'} · 第 ${s.content.chapter.chapter.id} 章</span><h2>${s.phase === 'won' ? '战斗胜利' : '战斗结束'}</h2><div class="result-rule"></div><dl><div><dt>抵达波次</dt><dd>${s.wave}<small> / ${s.content.chapter.chapter.waveCount}</small></dd></div><div><dt>击败敌人</dt><dd>${s.kills}</dd></div><div><dt>战斗时间</dt><dd>${clock(s.clock)}</dd></div><div><dt>造成伤害</dt><dd>${Math.round(s.damageDealt).toLocaleString()}</dd></div></dl><button class="primary" data-action="restart">再次挑战</button><button class="secondary" data-action="home">${this.researchMode ? '返回配装' : '返回关卡'}</button></div>`;
  }
  private equippedWeapons() {
    const s = this.sim;
    const families = Object.values(s.content.combat.families || {}) as RecordData[];
    return [
      ...(s.mainWeaponEquipped ? [{ entityId: s.content.chapter.player.weaponEntityId, state: s.cannon }] : []),
      ...[...s.secondary].map(([entityId, state]) => ({ entityId, state })),
    ].map(({ entityId, state }) => {
      const family = families.find(f => f.entityId === entityId);
      const stage = family?.stages.find((row: RecordData) => row.skillId === state.stageId);
      return { entityId, icon: family ? this.weaponIconKey(family.id, stage?.star || 1) : '10000101', name: family?.name || '速射机炮', star: stage?.star || 1 };
    });
  }
  private inventoryStars(star: number, weapon = true, maxStar = 2) {
    const tier = weapon ? Math.min(2, Math.floor((Math.max(1, star) - 1) / 3)) : 0;
    const lit = weapon ? (Math.max(1, star) - 1) % 3 + 1 : star;
    const count = weapon ? 3 : Math.max(star, maxStar);
    return Array.from({ length: count }, (_, j) => this.image(`Choose_skills_${weapon ? ['S', 'M', 'L'][tier] : 'S'}${weapon && j === 2 ? 2 : 1}_normal_${j < lit ? ['yellow', 'red', 'multicolor'][tier] : 'grey'}`)).join('');
  }
  private damageStatistics() {
    const s = this.sim;
    const weapons = this.equippedWeapons().map(weapon => ({ ...weapon, damage: s.damageByWeapon.get(weapon.entityId) || 0 })).sort((a, b) => b.damage - a.damage);
    const total = weapons.reduce((sum, weapon) => sum + weapon.damage, 0);
    const rows = weapons.map(weapon => {
      const percent = total > 0 ? weapon.damage / total * 100 : 0;
      return `<li class="damage-row" aria-label="${escape(weapon.name)}，${weapon.star}星，伤害${Math.round(weapon.damage)}，占比${Math.round(percent)}%">${this.image('stg_damage_normalBg', 'damage-row-bg')}${this.image(weapon.icon, 'damage-weapon-icon')}<span class="damage-weapon-name">${escape(weapon.name)}</span><span class="damage-value">${Math.round(weapon.damage)}</span><div class="damage-bar"><i style="width:${percent}%"></i><span>${Math.round(percent)}%</span></div><span class="damage-stars">${this.inventoryStars(weapon.star)}</span></li>`;
    }).join('');
    return `<div class="pause-detail-shade"><section class="damage-statistics" role="dialog" aria-modal="true" aria-label="伤害统计"><div class="damage-panel-bg"></div><h3>伤害统计</h3><button class="damage-close" data-action="pause-back" aria-label="关闭伤害统计">${this.image('damage_close')}</button><ul class="damage-list">${rows}</ul></section></div>`;
  }
  private pauseScreen() {
    const s = this.sim;
    const weapons = this.equippedWeapons();
    // Learned retains the whole upgrade history. The pause inventory shows only
    // the current level of each passive, never a slot for each past selection.
    const passives = new Map<number, Choice>();
    for (const card of s.learned) if (card.id >= 11000000) passives.set(card.group, card);
    const panel = (kind: 'active' | 'passive', title: string, items: { icon: string; name: string; star: number; raw?: RecordData }[]) => {
      const slots = Array.from({ length: 5 }, (_, i) => {
        const item = items[i];
        if (!item) return '<li class="pause-slot empty" aria-label="空槽位"></li>';
        const stars = this.inventoryStars(item.star, kind === 'active', item.raw?.MaxStar || 2);
        return `<li class="pause-slot" aria-label="${escape(item.name)}，${item.star}星" title="${escape(item.name)} · ${item.star}星">${this.image(`stg_pause_${kind}Bg`, 'pause-slot-bg')}${this.image(item.icon, 'pause-slot-icon')}<span class="pause-stars">${stars}</span></li>`;
      }).join('');
      return `<section class="pause-inventory pause-${kind}" aria-label="${title}"><div class="pause-panel-bg"></div><h3>${this.image(`stg_pause_${kind}SkillIcon`)}<span>${title}</span></h3><ul>${slots}</ul></section>`;
    };
    const button = (action: string, key: string, label: string, cls: string) => `<button class="pause-control ${cls}" data-action="${action}" aria-label="${label}">${this.image(key)}${action === 'continue' ? '<span>继续</span>' : ''}</button>`;
    const details = this.pauseView === 'inventory' ? '' : this.pauseView === 'stats' ? this.damageStatistics() : `<div class="pause-detail-shade"><section class="pause-detail" role="dialog" aria-modal="true" aria-label="设置"><h3>设置</h3><button class="pause-sound" data-action="sound" aria-pressed="${this.audio.enabled}">${this.image(this.audio.enabled ? 'stg_pause_soundOpen' : 'stg_pause_soundClose')}<span>声音${this.audio.enabled ? '开启' : '关闭'}</span></button><button class="secondary" data-action="pause-back">返回</button></section></div>`;
    return `<div class="pause-screen" ${details ? 'inert' : ''}><h2 class="pause-title">暂停</h2>${panel('active', '武器', weapons)}${panel('passive', '强化', [...passives.values()])}${button('pause-stats', 'stg_pause_hurt', '伤害统计', 'pause-stats')}${button('pause-settings', 'stg_pause_setting', '设置', 'pause-settings')}${button('continue', 'stg_pause_resume', '继续战斗', 'pause-resume')}${button('home', 'stg_pause_main', this.researchMode ? '返回配装' : '返回关卡', 'pause-home')}</div>${details}`;
  }
  private card(c: Choice) {
    const family = this.sim.content.combat.families?.[c.group] || Object.values(this.sim.content.combat.families || {}).find((f: any) => f.id === c.group) as RecordData | undefined;
    const name = c.name || family?.name || '武器强化';
    const stageEffects = family?.stages.find((stage: RecordData) => stage.skillId === c.advance)?.effects || [];
    const description = c.description || originalSkillDescription(c as unknown as RecordData) || effectDescription([...c.effects, ...stageEffects]);
    const breakthrough = Boolean(family) && c.star > 0 && c.star % 3 === 0;
    const element: Record<number, [string, string]> = {
      10000101: ['physics', '物理'], 10000601: ['ice', '冰冻'],
      10001501: ['energy', '能量'], 10001701: ['fire', '火焰'],
    };
    const badge = element[c.group];
    // UICommonTools.SetSkillImageByDeepType: weapon stars 1..9 map to
    // 02,02,03,04,04,05,06,06,07. Each completed tier has its own panel.
    const panelIndex = family ? Math.min(7, 2 + 2 * Math.floor((Math.max(1, c.star) - 1) / 3) + (breakthrough ? 1 : 0)) : 1;
    const panel = `Choose_skills_panel_${String(panelIndex).padStart(2, '0')}`;
    const tier = Math.min(2, Math.floor((Math.max(1, c.star) - 1) / 3));
    const lit = family ? (Math.max(1, c.star) - 1) % 3 + 1 : c.star;
    const pipCount = family ? 3 : Math.max(c.star, c.raw?.MaxStar || 2);
    const pips = Array.from({ length: pipCount }, (_, i) => {
      const shape = family ? `${['S', 'M', 'L'][tier]}${i === 2 ? 2 : 1}` : 'S1';
      const color = i < lit ? family ? ['yellow', 'red', 'multicolor'][tier] : 'yellow' : 'grey';
      const key = `Choose_skills_${shape}_normal_${color}`;
      return this.image(key);
    }).join('');
    const aura = breakthrough ? `<span class="card-aura" aria-hidden="true">${[1, 2, 3, 4].map(i => this.image(`Choose_skills_${['y', 'r', 'm'][tier]}${i}`, `aura-${i}`)).join('')}</span>` : '';
    const cubeTier = ['y', 'r', 'c'][tier];
    return `<button class="upgrade-card ${breakthrough ? 'breakthrough' : ''}" data-action="choose" data-id="${c.id}" data-tier="${cubeTier}" aria-label="${escape(name)}：${escape(description)}"><span class="card-face">${aura}${this.image(panel, 'card-panel')}<span class="card-title">${escape(name)}</span><div class="card-art">${this.image(family ? this.weaponIconKey(family.id, c.star, c, true) : c.icon || '10000101')}</div><span class="stars" aria-label="${c.star} 星">${pips}</span><p>${escape(description)}</p>${breakthrough ? `<canvas class="original-cube" data-tier="${cubeTier}" width="328" height="804" aria-hidden="true"></canvas>` : ''}${badge ? `<span class="card-tag">${this.image('ui_stg_ability_' + badge[0])}${badge[1]}</span>` : ''}</span></button>`;
  }
}
function originalSkillDescription(card: RecordData): string {
  const text = card.descriptionSource || '';
  const args = card.descriptionArgsSource || [];
  return text.replace(/\{(\d+)\}/g, (match: string, index: string) => args[Number(index)] ?? match);
}
export function effectDescription(effects: RecordData[]) {
  return effects.map(e => {
    const value = Number(e.value ?? 0);
    const n = Number.isInteger(value) ? value : +value.toFixed(1);
    const labels: Record<string, string> = {
      addDamagePercent: `武器伤害 ${n >= 0 ? '+' : ''}${n}%`, reduceCooldownPercent: `射击间隔减少 ${n}%`,
      addCritRatePercent: `暴击率 +${n}%`, addParallelProjectiles: `正向子弹 +${n}`, addPierce: `穿透次数 +${n}`,
      addFireCount: `连续发射 +${n}`, addMaxHpPercent: `最大生命 +${n}%`, addGlobalAttackPercent: `攻击力 +${n}%`,
      addSecondary: '解锁新的自动攻击武器', addReflectionCount: `弹射次数 +${n}`, addReboundCount: `反弹次数 +${n}`,
      addSkillDamagePercent: `技能伤害 ${n >= 0 ? '+' : ''}${n}%`, addCritDamagePercent: `暴击伤害 +${n}%`,
      addBulletSpeedPercent: `弹速 ${n >= 0 ? '+' : ''}${n}%`, addBulletScalePercent: `子弹尺寸 +${n}%`,
      addSideProjectiles: `斜向子弹 +${n}`, addParallelCountPercent: `正向弹数 +${n}%`, addSideCountPercent: `斜向弹数 +${n}%`,
      addExplosionRadiusPercent: `爆炸范围 +${n}%`, enableExplosion: e.onCrit ? '暴击触发范围爆炸' : '命中触发范围爆炸',
      addHitBuff: `${Number((e.probability * 100).toFixed(1))}% 概率附加${e.buffId === 200000 ? '破甲' : e.buffId === 200001 ? '灼烧' : '冰冻减速'}`,
      addBounce: `敌人间弹跳 +${n} 次`, disablePierce: '取消穿透', disablePierceDamageReduction: '穿透伤害不再衰减',
      addBeamLengthPercent: `射线长度 ${n >= 0 ? '+' : ''}${n}%`, addBeamWidthPercent: `射线宽度 ${n >= 0 ? '+' : ''}${n}%`,
      reduceHitIntervalPercent: `伤害间隔减少 ${n}%`, reduceGlobalCooldownPercent: `全部武器间隔减少 ${n}%`,
      addSalvoCount: `齐射弹数 +${n}`, addSalvoAngle: `齐射角度 +${n}°`, addHomingTurnRate: `追踪转速 +${n}°/秒`,
      addLifetimeSeconds: `持续时间 +${n} 秒`, addLifetimePercent: `持续时间 ${n >= 0 ? '+' : ''}${n}%`, addRange: `索敌距离 +${n}`,
    };
    return labels[e.type] || '';
  }).filter(Boolean).join('；');
}
