import './loadout.css';
import type { GameContent, RecordData } from './model';
import type { Simulation } from './simulation';
import { NATIVE_EQUIPMENT_LEVEL_MAX } from '../../src/replica/native-equipment-level.js';
import { inspectLoadoutSkillSupport } from './special-skill-runtime';
import { nativeSkillDescription } from '../../src/replica/native-skill-description.js';
import {
  loadLoadoutCatalog, loadStudyLoadoutState, saveStudyLoadoutState,
  calculateStudyLoadout, applyStudyLoadout, studyEquipmentQualityChain,
} from './loadout-state';

type Tab = 'equipment' | 'planes' | 'guns' | 'pilots' | 'skills' | 'labs';
type Item = RecordData;
const itemLevelLimit=(kind: Tab,row: Item)=>kind==='equipment'?NATIVE_EQUIPMENT_LEVEL_MAX:Number(row.maxLevel||1);
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const plain = (value: unknown) => String(value ?? '').replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]*>/g, '').replace(/\\n/g, '\n');
const num = (value: unknown) => Number(value || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
const qualityColors: Record<number, string> = { 10: '#c9cbd1', 20: '#60d58a', 30: '#5daee8', 40: '#bb7ff1', 50: '#ffc74e', 60: '#f07177' };
const slots: Record<number, string> = { 1: '头盔', 2: '手套', 3: '护甲', 4: '项链', 5: '战靴' };
const tabNames: Record<Tab, string> = { equipment: '装备', planes: '战机', guns: '机炮', pilots: '人物', skills: '技能', labs: '实验室' };
const attributeFallback: Record<string, string> = { Attack: '攻击', HPMax: '生命', 'Attack%': '攻击', 'HPMax%': '生命', 'CritRate%': '暴击率', 'CritValue%': '暴击伤害', 'PhysicalDamageAdd%': '物理伤害', 'FireDamageAdd%': '火焰伤害', 'IceDamageAdd%': '冰冻伤害', 'PoisonDamageAdd%': '毒素伤害', 'EnergyDamageAdd%': '能量伤害', 'ThunderDamageAdd%': '雷电伤害', 'MoveSpeed%': '移动速度' };

/** A prebattle study screen. The source catalog is deliberately separate from
 * ownership, so browsing all extracted rows never activates their attributes. */
export function mountStudyLoadout({ content, sim, onStart }: { content: GameContent; sim: Simulation; onStart: () => void }) {
  const root = document.createElement('section');
  root.id = 'study-loadout'; root.setAttribute('aria-label', '战前装备配置');
  document.getElementById('stage')!.append(root);
  let catalog: Awaited<ReturnType<typeof loadLoadoutCatalog>>;
  let state: ReturnType<typeof loadStudyLoadoutState>;
  let calculated: RecordData = {};
  let chrome: RecordData = {};
  let tab: Tab = 'equipment';
  let slot = 0, quality = 0, search = '', limit = 80;
  let skillScope: 'player' | 'all' = 'player';
  let detail: { tab: Tab; id: number } | null = null;
  let special: 'stats' | 'help' | 'reset' | 'skill-picker' | null = null;
  let editingSkillSlot = 0;
  let lastPhase = sim.phase, ready = false;
  let returnFocus: HTMLElement | null = null;
  let dialogDraft: { level: number; star: number; active: boolean } | null = null;
  const data = () => catalog as unknown as RecordData;
  const local = () => state as unknown as RecordData;
  const description = (row?: Item) => plain(nativeSkillDescription(row, data().runtime || {}));
  const rows = (kind: Tab): Item[] => (kind === 'skills' ? data().allSkills : data()[kind]) || [];
  const find = (kind: Tab, id: number) => rows(kind).find(row => Number(row.id) === id);
  const sprite = (name: string): string => {
    const item = chrome.sprites?.[name] || chrome.assets?.[name] || data()?.assets?.[name] || content.assets.sprites[name];
    return typeof item === 'string' ? item : item?.url || '';
  };
  const img = (url: unknown, className = '') => url ? `<img class="${className}" src="${escape(typeof url === 'string' && url.startsWith('/assets/') ? '/replica-battle' + url : url)}" alt="" draggable="false" loading="lazy">` : '';
  const sourceImage = (row?: Item, large = false) => row ? (large ? row.displayImage || row.icon : row.icon || row.displayImage) : '';
  const skillRuntimeStatus = (row?: Item) => {
    if (!row) return { supported: false, reasons: ['原始技能定义缺失'] };
    return calculated.skillSupport?.[row.id] || inspectLoadoutSkillSupport(row, data().runtime || {});
  };
  const skillRuntimeLabel = (row?: Item) => skillRuntimeStatus(row).supported ? '已接入战斗运行器' : '仍有未接入行为';
  const qualityColor = (row?: Item) => qualityColors[Math.floor(Number(row?.quality || 10) / 10) * 10] || '#c9cbd1';
  const members = (kind: 'guns' | 'pilots' | 'labs' | 'skins') => (local()[kind] ||= []) as Item[];
  const member = (kind: 'guns' | 'pilots' | 'labs' | 'skins', id: number) => members(kind).find(row => Number(row.id) === id);
  const equipment = () => (local().equipment ||= []) as Item[];
  const equipmentSlot = (row: Item) => Number(row.slot || row.raw?.equipType || row.equipType || 0);
  const selected = (kind: Tab, row: Item) => kind === 'equipment' ? equipment().some(e => e.id === row.id) : kind === 'planes' ? (Number(row.id) === Number(local().role?.skinId || local().role?.id)) : kind === 'guns' || kind === 'pilots' ? !!member(kind, row.id)?.equipped : kind === 'labs' ? !!member('labs', row.id)?.active : (calculated.initialSkillIds || []).includes(row.id);
  const active = (kind: Tab, row: Item) => kind === 'guns' || kind === 'pilots' || kind === 'labs' ? !!member(kind, row.id)?.active : kind === 'planes' ? !!member('skins', row.id)?.active : false;
  const itemLevel = (kind: Tab, row: Item) => kind === 'equipment' ? Number(equipment().find(e => e.id === row.id)?.level || 1) : kind === 'labs' ? Number(member('labs', row.id)?.level || 1) : 1;
  const itemStar = (kind: Tab, row: Item) => kind === 'guns' || kind === 'pilots' ? Number(member(kind, row.id)?.star || row.defaultStar || 1) : kind === 'planes' && row.kind !== 'base' ? Number(member('skins', row.id)?.star || row.defaultStar || 1) : 0;
  const stars = (value: number) => Array.from({ length: Math.min(7, value) }, () => sprite('stg_equip_star') ? img(sprite('stg_equip_star')) : '★').join('');
  const tile = (kind: Tab, row: Item, marker = true) => {
    const star = itemStar(kind, row), level = itemLevel(kind, row);
    const frame = sprite(`Frame_Quality_${Math.floor(Number(row.quality || 10) / 10) * 10}`);
    const rank = kind === 'equipment' ? Number(row.quality || 0) % 10 : 0;
    return `<span class="study-tile ${frame ? 'study-original-frame' : ''}" style="--quality:${qualityColor(row)}">${img(frame, 'study-tile-frame')}${img(sourceImage(row), 'study-tile-icon')}${marker && selected(kind, row) ? '<span class="study-tile-marker">使用中</span>' : marker && active(kind, row) ? '<span class="study-tile-marker study-collection">收藏</span>' : ''}${star ? `<span class="study-tile-stars">${stars(star)}</span>` : kind === 'equipment' || kind === 'labs' ? `<span class="study-tile-level">Lv.${level}</span>` : ''}${rank ? `<span class="study-tile-rank">+${rank}</span>` : ''}</span>`;
  };
  function attrText(expression: unknown) {
    const [key, ...rest] = String(expression).split('=');
    const clean = key.trim(), value = rest.join('=').trim();
    const sourceName = data().attributeNames?.[clean];
    const name = plain(typeof sourceName === 'string' ? sourceName : sourceName?.name || attributeFallback[clean] || clean);
    return `${escape(name)} <b>${escape(value === '' ? '' : `${Number(value) > 0 ? '+' : ''}${value}${clean.includes('%') ? '%' : ''}`)}</b>${name === clean ? '' : ` <small>${escape(clean)}</small>`}`;
  }
  const attrList = (values: unknown) => {
    const list = Array.isArray(values) ? values : typeof values === 'string' ? [values] : values && typeof values === 'object' ? Object.entries(values).map(([k, v]) => `${k}=${v}`) : [];
    return list.length ? `<ul class="study-attributes">${list.map(v => `<li>${attrText(v)}</li>`).join('')}</ul>` : '<p class="study-source">此阶没有额外属性。</p>';
  };
  function save() {
    saveStudyLoadoutState(state);
    calculated = calculateStudyLoadout(catalog, state) as unknown as RecordData;
  }
  function openDetail(kind: Tab, id: number) {
    const row = find(kind, id); if (!row) return;
    returnFocus = document.activeElement as HTMLElement;
    detail = { tab: kind, id }; special = null;
    dialogDraft = { level: itemLevel(kind, row), star: itemStar(kind, row) || 1, active: active(kind, row) };
    renderModal();
    root.querySelector<HTMLButtonElement>('.study-close')?.focus({ preventScroll: true });
  }
  function closeModal() { detail = null; special = null; dialogDraft = null; renderModal(); returnFocus?.focus({ preventScroll: true }); }
  function toast(message: string) {
    root.querySelector('.study-feedback')?.remove();
    const node = document.createElement('div'); node.className = 'study-feedback'; node.setAttribute('role', 'status'); node.textContent = message; root.append(node);
    window.setTimeout(() => node.remove(), 2600);
  }
  function hangar() {
    const role = local().role || {};
    const plane = find('planes', Number(role.skinId || role.id)) || rows('planes')[0];
    const pilot = members('pilots').find(p => p.equipped);
    return `<div class="study-hangar"><span class="study-hangar-name">${escape(plane?.name || '初始战机')}</span>${img(sourceImage(plane, true), 'study-plane-preview')}${Object.entries(slots).map(([id, name]) => {
      const item = equipment().find(e => e.slot === Number(id)), row = item && find('equipment', item.id);
      return `<button class="study-slot" data-action="slot" data-id="${id}" aria-label="选择${name}">${row ? tile('equipment', row, false) : '<span class="study-plus">+</span>'}<small>${name}</small></button>`;
    }).join('')}<button class="study-slot" data-action="pilot-slot" aria-label="选择人物">${pilot && find('pilots', pilot.id) ? tile('pilots', find('pilots', pilot.id)!, false) : '<span class="study-plus">+</span>'}<small>人物</small></button></div>`;
  }
  function filtered() {
    const pool: Item[] = tab === 'skills' && skillScope === 'player' ? data().skills || [] : rows(tab);
    return pool.filter(row => (!slot || tab !== 'equipment' || equipmentSlot(row) === slot) && (!quality || Math.floor(Number(row.quality || 0) / 10) * 10 === quality) && (!search || `${row.id} ${row.name} ${description(row)}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
  }
  function itemGrid() {
    const list = filtered();
    const shown = list.slice(0, limit);
    return `<div class="study-grid ${['planes', 'pilots', 'labs'].includes(tab) ? 'study-wide-grid' : ''}">${shown.length ? shown.map(row => `<button class="study-item" data-action="detail" data-kind="${tab}" data-id="${row.id}" data-selected="${selected(tab, row)}" aria-label="${escape(row.name)}，${escape(row.qualityName || '')}${row.closed ? '，原版未开放' : ''}">${tile(tab, row)}<span class="study-tile-label">${escape(row.name || row.id)}</span></button>`).join('') : '<div class="study-empty">没有符合条件的条目</div>'}</div>${list.length > limit ? `<div class="study-filters"><button class="study-filter" data-action="more">继续显示 · 剩余 ${list.length - limit} 项</button></div>` : ''}`;
  }
  function searchBar() {
    return `<div class="study-search"><input data-input="search" type="search" placeholder="搜索名称 / ID" aria-label="搜索${tabNames[tab]}" value="${escape(search)}">${tab !== 'labs' && tab !== 'skills' ? `<select data-input="quality" aria-label="品质筛选"><option value="0">全部品质</option>${[10, 20, 30, 40, 50, 60].map(v => `<option value="${v}" ${quality === v ? 'selected' : ''}>${escape(data().qualityNames?.[v] || v)}</option>`).join('')}</select>` : ''}</div>`;
  }
  function skillScreen() {
    const initial: number[] = [...new Set<number>(calculated.initialSkillIds || [])];
    return `<div class="study-skill-carry">${Array.from({ length: 3 }, (_, i) => {
      const skin = find('planes', Number(local().skinSkillSlots?.[i] || 0));
      const current = skin && starRow(skin, itemStar('planes', skin));
      const row = find('skills', features(current?.FeatureOnStarUp)[0]);
      return `<button data-action="skill-slot" data-id="${i}" aria-label="选择第 ${i + 1} 个战机技能，${row ? escape(row.name) : '暂无技能'}">${row ? tile('skills', row, false) : '<span class="study-plus">+</span>'}<small>${i + 1}</small></button>`;
    }).join('')}</div><h2 class="study-section-heading">当前携带战机技能 <small>3 个研究槽位</small></h2><p class="study-banner">点击上方槽位，携带已激活战机收藏的星级技能。战机外观与技能槽分开选择；研究模式开放三个槽位。</p><h2 class="study-section-heading">完整初始技能配置 <small>${initial.length} 项</small></h2><div class="study-skill-list">${initial.length ? initial.map(id => {
      const row = find('skills', id);
      return `<button class="study-skill-row" data-action="detail" data-kind="skills" data-id="${id}">${img(sourceImage(row))}<span><strong>${escape(row?.name || `技能 ${id}`)}</strong><small>${skillRuntimeLabel(row)}<br>${escape(description(row) || '详见原始技能配置')}</small></span></button>`;
    }).join('') : '<p class="study-empty">当前没有初始技能</p>'}</div><p class="study-banner">初始配置还包括出战机炮、人物与实验室效果。下方可查询原包全部技能；怪物、系统和未接入效果仅供查看。</p><h2 class="study-section-heading">原包技能图鉴 <small>${filtered().length} 项</small></h2><div class="study-filters"><button class="study-filter" data-action="skill-scope" data-scope="player" aria-pressed="${skillScope === 'player'}">玩家相关</button><button class="study-filter" data-action="skill-scope" data-scope="all" aria-pressed="${skillScope === 'all'}">全部原始技能</button></div>${searchBar()}${itemGrid()}`;
  }
  function contentHTML() {
    if (tab === 'skills') return skillScreen();
    const heading = tab === 'equipment' ? '我的装备' : tab === 'planes' ? '战机收藏' : tab === 'guns' ? '机炮收藏' : tab === 'pilots' ? '人物收藏' : '技能实验室';
    const banner = tab === 'equipment' ? '' : tab === 'planes' ? '原包基础战机与 9 架皮肤均可研究。换装、星级与收藏属性按原表显示。' : tab === 'guns' || tab === 'pilots' ? '“出战”决定携带的武器或人物；“激活收藏”决定全局属性。原版隐藏条目也列在图鉴中。' : '选择等级并激活研究。属性与里程碑来自原表；未实现的特殊效果会列在详情与属性汇总中。';
    return `${tab === 'equipment' ? hangar() : ''}<h2 class="study-section-heading">${heading}<small>${filtered().length} / ${rows(tab).length}</small></h2>${banner ? `<p class="study-banner">${banner}</p>` : ''}${tab === 'equipment' ? `<div class="study-filters">${[[0, '全部'], ...Object.entries(slots)].map(([id, name]) => `<button class="study-filter" data-action="filter-slot" data-id="${id}" aria-pressed="${slot === Number(id)}">${name}</button>`).join('')}</div>` : ''}${searchBar()}${itemGrid()}`;
  }
  function render(preserveScroll = false) {
    if (!ready) return;
    const scrollTop = preserveScroll ? root.querySelector('.study-scroll')?.scrollTop || 0 : 0;
    root.innerHTML = `<header class="study-top"><div><small>弹壳战机 · 本地研究</small><h1>${tabNames[tab]}</h1></div><div class="study-top-actions"><button class="study-icon-button" data-action="help" aria-label="研究模式说明">说明</button><button class="study-icon-button" data-action="stats" aria-label="属性与效果汇总">属性</button></div></header><div class="study-power"><button data-action="stats">${img(sprite('atr_equip_atk'))}<span>攻击</span><b>${num(calculated.attack)}</b></button><button data-action="stats">${img(sprite('atr_equip_hp'))}<span>生命</span><b>${num(calculated.hp)}</b></button></div><div class="study-scroll">${contentHTML()}</div><div class="study-launchbar"><div class="study-chapter"><label for="study-chapter">普通关卡</label><select id="study-chapter" data-input="chapter">${content.chapter.catalog.map((row: RecordData) => `<option value="${row.id}" ${row.id === content.chapter.chapter.id ? 'selected' : ''}>第 ${row.id} 章 · ${escape(row.name)}</option>`).join('')}</select></div><button class="study-launch" data-action="start">开始战斗<small>使用当前配置出战</small></button></div><nav class="study-tabs" role="tablist" aria-label="成长系统">${(Object.keys(tabNames) as Tab[]).map(kind => `<button class="study-tab" role="tab" aria-selected="${tab === kind}" data-action="tab" data-kind="${kind}">${img(tabIcon(kind))}<span>${tabNames[kind]}</span></button>`).join('')}</nav><div class="study-modal-host"></div>`;
    root.querySelector('.study-scroll')!.scrollTop = scrollTop;
    renderModal();
  }
  function tabIcon(kind: Tab) {
    const keys: Record<Tab, string[]> = {
      equipment: ['stg_equip_tab', 'stg_pause_activeSkillIcon'], planes: ['stg_plane_tab', 'Icon_StartLevel'], guns: ['stg_gun_tab', '10000101'], pilots: ['stg_pilot_tab', 'stg_pause_passiveSkillIcon'], skills: ['stg_skill_tab', 'stg_pause_passiveSkill'], labs: ['stg_lab_tab', 'stg_pause_setting'],
    };
    return chrome.tabs?.[kind]?.url || chrome.tabs?.[kind] || keys[kind].map(sprite).find(Boolean) || '';
  }
  function stepper(label: string, field: 'level' | 'star', value: number, max: number) {
    if (max <= 1) return '';
    return `<div class="study-stepper"><span>${label}</span><button data-action="step" data-field="${field}" data-delta="-1" aria-label="减少${label}">−</button><input type="number" data-input="${field}" min="1" max="${max}" value="${value}" aria-label="${label}"><button data-action="step" data-field="${field}" data-delta="1" aria-label="增加${label}">+</button><small>/ ${max}</small><button data-action="max" data-field="${field}" data-value="${max}">满</button></div>`;
  }
  function starRow(row: Item, star: number) { return (row.stars || []).find((r: Item) => Number(r.star ?? r.Star) === star); }
  function levelRow(row: Item, level: number) { return (row.levels || []).find((r: Item) => Number(r.Level ?? r.level) === level); }
  function appearanceHTML(kind: Tab, row: Item) {
    if (kind !== 'planes' && kind !== 'pilots') return '';
    const profile = catalog.appearances?.[kind === 'planes' ? 'planes' : 'pilots']?.[row.id];
    const ready = profile?.layers?.length > 0;
    return `<h3 class="study-detail-section">局内外观</h3><div class="study-detail-copy">${ready ? '已接入原包战斗骨架与动画，设为出战后在下一局使用。' : '原包战斗模型依赖尚未补齐，当前仅可查看原图。'}${profile?.modelPath ? `\n${escape(profile.modelPath.split('/').pop())}` : ''}</div>`;
  }
  function skillsHTML(ids: unknown, heading = '关联技能') {
    const values = Array.isArray(ids) ? [...new Set(ids.map(Number).filter(Boolean))] : [];
    return values.length ? `<h3 class="study-detail-section">${heading}</h3>${values.map(id => {
      const skill = find('skills', id);
      return `<button class="study-skill-row" data-action="detail" data-kind="skills" data-id="${id}">${img(sourceImage(skill))}<span><strong>${escape(skill?.name || `技能 ${id}`)}</strong><small>${escape(description(skill) || `原表技能 ID ${id}`)}</small></span></button>`;
    }).join('')}` : '';
  }
  function draftAttributes(kind: Tab, row: Item) {
    return `<div class="study-live-attributes">${draftAttributesContent(kind, row)}</div>`;
  }
  function draftAttributesContent(kind: Tab, row: Item) {
    const draft = dialogDraft!;
    if (kind === 'equipment') {
      const base: string[] = row.raw?.baseAttribute || row.baseAttributes || [];
      const growth: string[] = row.raw?.AttributeOnLevelUp || row.levelAttributes || [];
      const sum: Record<string, number> = {};
      for (const [expressions, multiplier] of [[base, 1], [growth, draft.level - 1]] as [string[], number][]) for (const exp of expressions) {
        const [key, value] = exp.split('='); sum[key.trim()] = (sum[key.trim()] || 0) + Number(value) * multiplier;
      }
      const tiers = studyEquipmentQualityChain(catalog, row).filter(r => r.raw?.FeatureJson);
      const cost = draft.level < Number(row.maxLevel) ? (data().tables.Equipment_Level || []).find((r: Item) => Number(r.Type) === Number(row.levelType) && Number(r.Level) === draft.level)?.Cost : null;
      return `<h3 class="study-detail-section">Lv.${draft.level} 装备属性</h3>${attrList(sum)}<p class="study-source">当前品质基础属性 + 每级成长 ×（部位等级 − 1）；当前品质可强化至 ${row.maxLevel} 级</p>${tiers.length ? `<h3 class="study-detail-section">已解锁品质特性</h3>${tiers.map(tier => `<div class="study-feature"><strong>${escape(tier.qualityName)}</strong>${featureDescription(tier.raw.FeatureJson)}</div>`).join('')}` : ''}${cost?.length ? `<h3 class="study-detail-section">原版此级升级消耗</h3>${costHTML(cost)}` : ''}`;
    }
    if (kind === 'guns' || kind === 'pilots' || kind === 'planes') {
      if (kind === 'planes' && row.kind === 'base') return '<h3 class="study-detail-section">基础战机</h3><div class="study-detail-copy">启航号为初始战机。当前研究配置不启用原表中保留的旧版机体等级与星阶系统。</div>' + appearanceHTML(kind, row);
      const current = starRow(row, draft.star);
      const skillIds = [...(current?.SkillId ? [current.SkillId] : []), ...features(current?.FeatureInitSkill), ...features(current?.FeatureOnStarUp)];
      return `${appearanceHTML(kind, row)}<h3 class="study-detail-section">${draft.star} 星收藏属性</h3>${attrList(current?.AttrOnStarUp || [])}<p class="study-source">使用当前星级这一行；不会把历次升星属性重复相加。</p>${skillsHTML(skillIds, '当前星级关联技能')}${current?.StarCost?.length ? `<h3 class="study-detail-section">原版此星级材料</h3>${costHTML(current.StarCost)}` : ''}`;
    }
    if (kind === 'labs') {
      const current = levelRow(row, draft.level);
      const milestones = (row.levels || []).filter((r: Item) => Number(r.Level) <= draft.level && r.FeatureJson);
      return `<h3 class="study-detail-section">Lv.${draft.level} 研究属性</h3>${attrList(current?.SkillAttributes || [])}${milestones.length ? `<h3 class="study-detail-section">已达里程碑</h3>${milestones.map((r: Item) => `<div class="study-feature"><strong>Lv.${r.Level}</strong>${featureDescription(r.FeatureJson)}</div>`).join('')}` : ''}${current?.Cost?.length ? `<h3 class="study-detail-section">原版此级升级消耗</h3>${costHTML(current.Cost)}` : ''}${skillsHTML(row.skillIds)}`;
    }
    const raw = row.raw || {}, support = skillRuntimeStatus(row);
    return `<h3 class="study-detail-section">战斗接入情况</h3><div class="study-detail-copy">${skillRuntimeLabel(row)}${support.reasons.length ? `\n${escape(support.reasons.join('\n'))}` : '\n已按原表连接属性、触发器及其动作。此标记表示代码接线状态，不代表已通过原版运行对照。'}</div>${raw.AddAttributes?.length ? `<h3 class="study-detail-section">技能属性</h3>${attrList(raw.AddAttributes)}` : ''}<h3 class="study-detail-section">原始定义</h3><div class="study-detail-copy">${escape(`技能 ID：${row.id}\n星级：${raw.SkillStar ?? 0} / ${raw.MaxStar ?? 0}\n解锁章节：${raw.UnlockStage ?? 0}\n触发器：${(raw.Triggers || []).join('、') || '无'}\n前置技能：${(raw.PreSkillIds || []).join('、') || '无'}`)}</div><p class="study-source">携带由出战配置派生，原始定义与当前接线范围在此分别显示。</p>`;
  }
  function features(value: unknown): number[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.flatMap(features);
    if (typeof value === 'string') { try { return features(JSON.parse(value)); } catch { return []; } }
    if (typeof value === 'object') { const row = value as RecordData; return row.Type === 'Skill' ? String(row.Args).split(/[;,]/).map(Number).filter(Boolean) : []; }
    return [];
  }
  function featureDescription(value: unknown) {
    const ids = features(value);
    if (!ids.length) {
      try {
        const feature = typeof value === 'string' ? JSON.parse(value) : value;
        if ((feature as RecordData)?.Type === 'Attr') return attrList(String((feature as RecordData).Args).split(';').filter(Boolean));
      } catch { /* Preserve unrecognized source features below. */ }
    }
    return ids.length ? ids.map(id => {
      const skill = find('skills', id); return `${escape(skill?.name || `技能 ${id}`)}<small>${escape(plain(skill?.description || '原始效果定义'))}</small>`;
    }).join('') : `<small>${escape(typeof value === 'string' ? value : JSON.stringify(value))}</small>`;
  }
  function costHTML(costs: unknown) {
    return `<ul class="study-attributes">${(Array.isArray(costs) ? costs : []).map((r: any) => `<li>${escape(data().itemNames?.[r[0]] || `道具 ${r[0]}`)} <b>× ${num(r[1])}</b></li>`).join('')}</ul>`;
  }
  function detailHTML() {
    const { tab: kind, id } = detail!;
    const row = find(kind, id); if (!row || !dialogDraft) return '';
    const raw = row.raw || {};
    const typeLabel = kind === 'equipment' ? slots[equipmentSlot(row)] : tabNames[kind];
    const flags = [row.qualityName, row.closed ? '原版未开放' : '', row.hidden ? '原版隐藏条目' : ''].filter(Boolean);
    const collectable = ['guns', 'pilots', 'labs'].includes(kind) || kind === 'planes' && row.kind !== 'base';
    const mustActivate = kind === 'guns' && selected(kind, row);
    const collectionControl = collectable ? `<label class="study-check"><input data-input="active" type="checkbox" ${dialogDraft.active ? 'checked' : ''} ${mustActivate ? 'disabled' : ''}><span>${kind === 'labs' ? '激活此项研究' : '激活此项收藏'}<small>${kind === 'labs' ? '激活后并入属性；等级里程碑按原表累加' : mustActivate ? '当前出战机炮同时计入收藏；更换出战后可关闭' : '即使没有出战，当前星级收藏属性仍会生效'}</small></span></label>` : '';
    const portrait = (kind === 'planes' || kind === 'pilots') && row.displayImage !== row.icon ? `<div class="study-detail-display">${img(sourceImage(row, true))}</div>` : '';
    const buttons = kind === 'skills' ? '<button class="study-action" data-action="close">返回</button>' : `${selected(kind, row) && (kind === 'equipment' || kind === 'pilots') ? '<button class="study-action study-muted" data-action="unequip">卸下</button>' : ''}${kind !== 'planes' || row.kind !== 'base' ? `<button class="study-action" data-action="save-item">${kind === 'equipment' ? '装备此物品' : '保存研究'}</button>` : ''}${['guns', 'pilots', 'planes'].includes(kind) ? '<button class="study-action study-gold" data-action="equip">设为出战</button>' : ''}`;
    return `<div class="study-dialog-head"><h2 id="study-dialog-title">${escape(row.name || id)}</h2><small>${escape(typeLabel)} · ${flags.map(escape).join(' · ')}</small><button class="study-close" data-action="close" aria-label="关闭详情">×</button></div><div class="study-dialog-content"><div class="study-detail-hero"><div class="study-detail-icon">${tile(kind, row, false)}</div><div><p>${escape(flags.join(' · '))}</p><p class="study-id">ID ${id}</p>${selected(kind, row) ? '<span class="study-pill">当前使用</span>' : ''}${active(kind, row) ? '<span class="study-pill">收藏已激活</span>' : ''}</div></div>${portrait}${row.description ? `<div class="study-detail-copy">${escape(description(row))}</div>` : ''}${stepper('等级', 'level', dialogDraft.level, itemLevelLimit(kind,row))}${stepper('星级', 'star', dialogDraft.star, Number(row.maxStar || 1))}${collectionControl}${draftAttributes(kind, row)}${kind === 'equipment' ? skillsHTML([...features(raw.FeatureJson), ...(row.skillIds || [])]) : ''}${raw.UnlockCost?.length ? `<h3 class="study-detail-section">原版解锁消耗</h3>${costHTML(raw.UnlockCost)}` : ''}<p class="study-source">来源：${escape(row.sourceTable || 'Skill_Main')} · ID ${id}${row.assetKeys?.icon ? `<br>原包素材：${escape(row.assetKeys.icon)}` : ''}</p></div><div class="study-dialog-actions">${buttons}</div>`;
  }
  function specialHTML() {
    const title = special === 'stats' ? '配置属性' : special === 'reset' ? '重置研究配置' : special === 'skill-picker' ? `战机技能 · 槽位 ${editingSkillSlot + 1}` : '原包研究模式';
    let body = '';
    if (special === 'help') body = '<div class="study-detail-copy">本界面使用 APK 原表与原包图片，供学习装备、收藏与技能之间的关系。\n\n所有条目均可查看和配置，暂不要求实际获取材料。隐藏、未开放条目会保留标记。\n\n装备：同一部位只装备一件，按当前品质和等级计算。\n机炮与人物：出战和收藏分别设置，收藏按当前星级生效。\n实验室：激活后计入所选等级属性及已达里程碑。\n\n原包效果尚未全部实现；请在“属性”查看当前配置未接入的效果。选择会保存在此浏览器。</div>';
    if (special === 'reset') body = '<div class="study-detail-copy">恢复初始战机、1 星速射机炮、基础攻击 100、生命 600。清除本研究界面的装备、人物和实验室配置。</div>';
    if (special === 'skill-picker') body = `<p class="study-source">原版技能来自战机当前星级的 FeatureOnStarUp。选择时自动激活对应收藏，不能重复携带同一战机技能。</p>${rows('planes').filter(plane => features(starRow(plane, itemStar('planes', plane))?.FeatureOnStarUp).length).map(plane => {
      const id = features(starRow(plane, itemStar('planes', plane))?.FeatureOnStarUp)[0], skill = find('skills', id);
      return `<button class="study-skill-row" data-action="assign-skill-slot" data-id="${plane.id}">${img(sourceImage(skill) || sourceImage(plane))}<span><strong>${escape(skill?.name || `技能 ${id}`)}</strong><small>${escape(plane.name)} · ${itemStar('planes', plane)} 星<br>${escape(description(skill) || '详见原始技能定义')}</small></span></button>`;
    }).join('')}<p><button class="study-action study-muted" data-action="clear-skill-slot">清空此槽位</button></p>`;
    if (special === 'stats') {
      const unsupported: any[] = calculated.unsupportedEffects || [];
      body = `<h3 class="study-detail-section">最终入场属性</h3>${attrList({ Attack: calculated.attack, HPMax: calculated.hp })}<h3 class="study-detail-section">配置合并属性</h3>${attrList(calculated.attributes)}${Object.keys(calculated.weaponAttributes || {}).length ? `<h3 class="study-detail-section">机炮专属属性</h3><div class="study-detail-copy">${escape(JSON.stringify(calculated.weaponAttributes, null, 2))}</div>` : ''}${calculated.contributions ? `<h3 class="study-detail-section">属性来源</h3><div class="study-detail-copy">${escape(formatContributions(calculated.contributions))}</div>` : ''}<h3 class="study-detail-section">特殊效果接入状态</h3><p class="study-source">基础属性与已实现的武器逻辑会带入战斗；下列项目仅保留原始配置，尚未完整模拟。</p>${unsupported.length ? unsupported.map(effect => `<div class="study-feature study-status-warning">${escape(typeof effect === 'string' ? effect : effect.description || effect.reason || effect.name || JSON.stringify(effect))}</div>`).join('') : '<div class="study-detail-copy">当前配置没有额外标记的未接入效果。仍以复刻版已有的战斗实现范围为准。</div>'}<h3 class="study-detail-section">手动入场数值</h3><label class="study-check"><input data-input="debug-enabled" type="checkbox" ${local().debugOverride?.enabled ? 'checked' : ''}><span>启用手动覆盖<small>启用后以填写的攻击与生命为准</small></span></label><div class="study-stepper"><span>攻击</span><input style="width:60%" data-input="debug-attack" type="number" min="1" max="1000000000" value="${Number(local().debugOverride?.attack || calculated.attack)}"></div><div class="study-stepper"><span>生命</span><input style="width:60%" data-input="debug-hp" type="number" min="1" max="1000000000" value="${Number(local().debugOverride?.hp || calculated.hp)}"></div>`;
    }
    return `<div class="study-dialog-head"><h2 id="study-dialog-title">${title}</h2><button class="study-close" data-action="close" aria-label="关闭">×</button></div><div class="study-dialog-content">${body}</div><div class="study-dialog-actions">${special === 'help' ? '<button class="study-action study-muted" data-action="reset">重置配置</button>' : ''}${special === 'reset' ? '<button class="study-action study-gold" data-action="confirm-reset">恢复初始</button>' : ''}<button class="study-action" data-action="close">${special === 'stats' ? '保存并返回' : '返回'}</button></div>`;
  }
  function formatContributions(value: unknown) {
    if (!Array.isArray(value)) return JSON.stringify(value, null, 2);
    return value.map((row: any) => typeof row === 'string' ? row : `${row.name || row.source || row.label || ''}${row.attributes ? `\n${Array.isArray(row.attributes) ? row.attributes.join('\n') : Object.entries(row.attributes).map(([key, v]) => `${attributeFallback[key] || key} ${v}`).join('\n')}` : ` ${JSON.stringify(row)}`}`).join('\n\n');
  }
  function renderModal() {
    const host = root.querySelector('.study-modal-host'); if (!host) return;
    host.innerHTML = detail || special ? `<div class="study-modal-layer"><section class="study-dialog" role="dialog" aria-modal="true" aria-labelledby="study-dialog-title">${detail ? detailHTML() : specialHTML()}</section></div>` : '';
  }
  function commitItem(equip = false) {
    if (!detail || !dialogDraft) return;
    const { tab: kind, id } = detail, row = find(kind, id)!;
    const draft = dialogDraft;
    if (kind === 'equipment') {
      const part = equipmentSlot(row); local().equipment = equipment().filter(e => Number(e.slot) !== part); equipment().push({ slot: part, id, level: draft.level });
    } else if (kind === 'planes') {
      const base = rows('planes').find(r => Number(r.id) === Number(local().role?.id)) || rows('planes')[0];
      if (id !== Number(base?.id)) {
        let entry = member('skins', id);
        if (!entry) { entry = { id, star: draft.star, active: false }; members('skins').push(entry); }
        Object.assign(entry, { star: draft.star, active: equip || draft.active });
        if (!entry.active) {
          local().skinSkillSlots = (local().skinSkillSlots || [0, 0, 0]).map((v: number) => v === id ? 0 : v);
          if (local().role.skinId === id) { local().role.skinId = 0; local().role.skinStar = 0; }
        }
      }
      if (equip) { local().role.skinId = id === Number(base?.id) ? 0 : id; local().role.skinStar = local().role.skinId ? draft.star : 0; }
    } else if (kind === 'guns' || kind === 'pilots' || kind === 'labs') {
      let entry = member(kind, id);
      if (!entry) { entry = { id, star: draft.star, level: draft.level, active: false, equipped: false }; members(kind).push(entry); }
      if (equip) members(kind).forEach(e => { e.equipped = false; });
      Object.assign(entry, kind === 'labs' ? { level: draft.level, active: draft.active } : { star: draft.star, active: equip || draft.active || kind === 'guns' && !!entry.equipped, equipped: equip || (!!entry.equipped && (draft.active || kind === 'guns')) });
    }
    save(); closeModal(); render(true); toast(equip ? '已设为出战，配置已保存' : '配置已保存');
  }
  root.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]'); if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (!ready) { if (action === 'retry') void initialise(); return; }
    if (action === 'tab') { tab = button.dataset.kind as Tab; slot = quality = 0; search = ''; limit = 80; render(); }
    else if (action === 'slot') { tab = 'equipment'; slot = Number(button.dataset.id); search = ''; quality = 0; limit = 80; render(); root.querySelector('.study-filters')?.scrollIntoView({ block: 'start' }); }
    else if (action === 'pilot-slot') { tab = 'pilots'; slot = quality = 0; search = ''; limit = 80; render(); }
    else if (action === 'filter-slot') { slot = Number(button.dataset.id); limit = 80; render(true); }
    else if (action === 'skill-scope') { skillScope = button.dataset.scope as 'player' | 'all'; limit = 80; render(true); }
    else if (action === 'skill-slot') { editingSkillSlot = Number(button.dataset.id); special = 'skill-picker'; detail = null; renderModal(); }
    else if (action === 'assign-skill-slot' || action === 'clear-skill-slot') {
      const id = action === 'clear-skill-slot' ? 0 : Number(button.dataset.id);
      const skills = (local().skinSkillSlots ||= [0, 0, 0]) as number[];
      if (id) {
        let entry = member('skins', id);
        if (!entry) { entry = { id, star: 1, active: true }; members('skins').push(entry); }
        entry.active = true;
        for (let i = 0; i < skills.length; i++) if (skills[i] === id) skills[i] = 0;
      }
      skills[editingSkillSlot] = id; save(); closeModal(); render(true); toast(id ? '已携带战机技能' : '已清空技能槽位');
    }
    else if (action === 'detail') openDetail(button.dataset.kind as Tab, Number(button.dataset.id));
    else if (action === 'close') { saveDebug(); closeModal(); render(true); }
    else if (action === 'more') { limit += 80; render(true); }
    else if (action === 'stats' || action === 'help' || action === 'reset') { returnFocus = button; special = action; detail = null; renderModal(); }
    else if (action === 'step' || action === 'max') {
      if (!detail || !dialogDraft) return;
      const row = find(detail.tab, detail.id)!, field = button.dataset.field as 'level' | 'star';
      const max = field === 'level' ? itemLevelLimit(detail.tab,row) : Number(row.maxStar || 1);
      dialogDraft[field] = Math.max(1, Math.min(max, action === 'max' ? Number(button.dataset.value) : dialogDraft[field] + Number(button.dataset.delta)));
      const top = root.querySelector('.study-dialog-content')?.scrollTop || 0; renderModal(); root.querySelector('.study-dialog-content')!.scrollTop = top;
    } else if (action === 'save-item' || action === 'equip') commitItem(action === 'equip');
    else if (action === 'unequip' && detail) {
      if (detail.tab === 'equipment') local().equipment = equipment().filter(e => e.id !== detail!.id);
      else if (detail.tab === 'guns' || detail.tab === 'pilots') { const e = member(detail.tab, detail.id); if (e) e.equipped = false; }
      save(); closeModal(); render(true); toast('已卸下；收藏状态保留');
    } else if (action === 'confirm-reset') {
      // Only reset this screen's state, never unrelated browser saves.
      const base = rows('planes').find(r => r.id === 10100) || rows('planes')[0];
      Object.assign(local(), { role: { id: base?.id || 10100, level: 1, star: 0, starStep: 0, skinId: 0, skinStar: 0 }, equipment: [], skins: [], skinSkillSlots: [0, 0, 0], pilots: [], labs: [], guns: [{ id: 20101, star: 1, active: true, equipped: true }], debugOverride: { enabled: false, attack: 100, hp: 600 } });
      save(); closeModal(); render(); toast('已恢复初始研究配置');
    } else if (action === 'start') {
      save(); applyStudyLoadout(content, sim, catalog, state); root.hidden = true; onStart(); lastPhase = sim.phase;
    }
  });
  function saveDebug() {
    if (special !== 'stats') return;
    const checkbox = root.querySelector<HTMLInputElement>('[data-input="debug-enabled"]');
    const value = (key: string, fallback: number) => Math.max(1, Math.min(1e9, Number(root.querySelector<HTMLInputElement>(`[data-input="debug-${key}"]`)?.value) || fallback));
    local().debugOverride = { enabled: !!checkbox?.checked, attack: value('attack', calculated.attack), hp: value('hp', calculated.hp) }; save();
  }
  root.addEventListener('input', event => {
    const input = event.target as HTMLInputElement;
    if (input.dataset.input !== 'search') return;
    search = input.value; limit = 80;
    const pos = input.selectionStart; render(true);
    const replacement = root.querySelector<HTMLInputElement>('[data-input="search"]')!; replacement.focus({ preventScroll: true });
    try { replacement.setSelectionRange(pos, pos); } catch { /* Search inputs differ across webviews. */ }
  });
  root.addEventListener('change', event => {
    const input = event.target as HTMLInputElement;
    if (input.dataset.input === 'quality') { quality = Number(input.value); limit = 80; render(true); }
    else if (input.dataset.input === 'chapter') {
      save(); const url = new URL(location.href); url.searchParams.set('chapter', input.value); location.assign(url);
    } else if (dialogDraft && detail && (input.dataset.input === 'level' || input.dataset.input === 'star')) {
      const field = input.dataset.input, row = find(detail.tab, detail.id)!;
      dialogDraft[field] = Math.max(1, Math.min((field === 'level' ? itemLevelLimit(detail.tab,row) : Number(row.maxStar || 1)), Math.round(Number(input.value) || 1)));
      input.value = String(dialogDraft[field]);
      const preview = root.querySelector('.study-live-attributes'); if (preview) preview.innerHTML = draftAttributesContent(detail.tab, row);
    } else if (dialogDraft && input.dataset.input === 'active') dialogDraft.active = input.checked;
  });
  root.addEventListener('pointerdown', event => event.stopPropagation());
  root.addEventListener('keydown', event => {
    event.stopPropagation();
    if (event.key === 'Escape' && (detail || special)) { event.preventDefault(); saveDebug(); closeModal(); render(true); }
    if (event.key === 'Tab' && (detail || special)) {
      const focusable = [...root.querySelectorAll<HTMLElement>('.study-dialog button:not(:disabled),.study-dialog input,.study-dialog select')];
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  async function initialise() {
    root.innerHTML = '<div class="study-empty">正在装载原包装备与图鉴…</div>';
    try {
      [catalog, chrome] = await Promise.all([loadLoadoutCatalog(), fetch('data/loadout-ui.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : {}).catch(() => ({}))]);
      state = loadStudyLoadoutState(catalog); save(); ready = true; render();
    } catch (error) { root.innerHTML = `<div class="study-empty">配置载入失败<br>${escape(error instanceof Error ? error.message : error)}<p><button class="study-action" data-action="retry">重新读取</button></p></div>`; }
  }
  void initialise();
  return {
    open() { if (sim.phase !== 'ready') return; root.hidden = false; if (ready) { state = loadStudyLoadoutState(catalog); save(); render(); } },
    update() {
      if (sim.phase !== lastPhase) {
        root.hidden = sim.phase !== 'ready';
        if (sim.phase === 'ready' && ready) { state = loadStudyLoadoutState(catalog); save(); render(); }
        lastPhase = sim.phase;
      }
    },
  };
}
