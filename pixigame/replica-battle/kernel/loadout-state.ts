import nativeResearchSource from '../../src/replica/native-research-source.json' with { type: 'json' };
import defaultLoadoutState from '../../src/replica/default-loadout-state.json' with { type: 'json' };
import type { GameContent, RecordData } from './model';
import type { Simulation } from './simulation';
import { loadLoadoutRuntime, loadPlayerAppearances } from './loadout-resources';
import { inspectLoadoutSkillSupport } from './special-skill-runtime';
import { buildLoadoutRuntimeAttributes } from './loadout-attributes';
import { splitNativeEconomyAttributes } from '../../src/replica/native-economy-attributes.js';
import { normalizeEquipmentPartLevel } from '../../src/replica/native-equipment-level.js';

export type LoadoutCatalog = RecordData & {
  equipment: RecordData[]; planes: RecordData[]; guns: RecordData[];
  pilots: RecordData[]; labs: RecordData[]; allSkills: RecordData[];
};
type Collection = { id: number; star: number; active: boolean; equipped?: boolean };
export interface StudyLoadoutState {
  version: 1;
  role: { id: number; level: number; star: number; starStep: number; skinId: number; skinStar: number };
  equipment: { slot: number; id: number; level: number }[];
  skins: Collection[]; guns: Collection[]; pilots: Collection[];
  skinSkillSlots: number[];
  nativeResearch?: { version: 1; levels: Record<string, number> };
  /** Transient formal-sortie permission; independent of lab attributes and milestones. */
  weaponSelectionBanSkillIds?: number[];
  labs: { id: number; level: number; active: boolean; activationKnown?: boolean; needActive?: boolean; confirmedSkillLevel?: number }[];
  debugOverride: { enabled: boolean; attack: number; hp: number };
}
export interface CalculatedLoadout {
  attack: number; hp: number;
  /** Displayed percentage points; consumed only by the matching economy system. */
  economyAttributes: Record<string, number>;
  attributes: Record<string, number>; weaponAttributes: Record<string, Record<string, number>>;
  runtimeAttributes: Record<string, number>; runtimeWeaponAttributes: Record<string, Record<string, number>>;
  initialSkillIds: number[]; battleSkillIds: number[]; banSkillIds: number[];
  selectedGunId: number; primarySkillId: number; selectedSkinId: number; selectedPilotId: number;
  unsupportedEffects: { source: string; description: string; skillId?: number }[];
  skillSupport: Record<number, { supported: boolean; reasons: string[] }>;
  contributions: { name: string; attributes: Record<string, number> }[];
}
const storageKey = 'danke-study-loadout-v1';
let catalogRequest: Promise<LoadoutCatalog> | undefined;
let volatileState: StudyLoadoutState | undefined;
export function loadLoadoutCatalog(): Promise<LoadoutCatalog> {
  return catalogRequest ||= Promise.all([fetch('data/loadout-catalog.json', { cache: 'no-store' }), loadLoadoutRuntime(), loadPlayerAppearances()]).then(async ([response, runtime, appearances]) => {
    if (!response.ok) throw new Error('缺少原包装备目录');
    const catalog = await response.json();
    for (const key of ['equipment', 'planes', 'guns', 'pilots', 'labs', 'allSkills']) if (!Array.isArray(catalog[key])) throw new Error(`装备目录格式错误：${key}`);
    catalog.runtime = runtime;
    catalog.appearances = appearances;
    return catalog as LoadoutCatalog;
  }).catch(error => { catalogRequest = undefined; throw error; });
}
export function createDefaultStudyLoadoutState(): StudyLoadoutState {
  return structuredClone(defaultLoadoutState) as StudyLoadoutState;
}
const clamp = (value: unknown, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(value) || min)));
export function loadStudyLoadoutState(catalog: LoadoutCatalog): StudyLoadoutState {
  const state = createDefaultStudyLoadoutState();
  let saved: RecordData;
  try { saved = volatileState || JSON.parse(localStorage.getItem(storageKey) || 'null'); }
  catch { if (!volatileState) return state; saved = volatileState; }
  if (!saved || saved.version !== 1) return state;
  const collect = (key: 'guns' | 'pilots' | 'skins', source: RecordData[]) => {
    const used = new Set<number>();
    return (Array.isArray(saved[key]) ? saved[key] : []).flatMap((entry: RecordData) => {
      const row = source.find(r => Number(r.id) === Number(entry.id));
      if (!row || used.has(row.id) || key === 'skins' && row.kind === 'base') return [];
      used.add(row.id);
      return [{ id: Number(row.id), star: clamp(entry.star, 1, Math.max(1, row.maxStar)), active: !!entry.active, equipped: !!entry.equipped && !!entry.active }];
    });
  };
  state.guns = collect('guns', catalog.guns);
  if (!state.guns.some(r => r.equipped)) {
    let starter = state.guns.find(r => r.id === 20101);
    if (!starter) { starter = { id: 20101, star: 1, active: true }; state.guns.push(starter); }
    starter.active = starter.equipped = true;
  }
  let equipped = false;
  state.guns.forEach(row => { if (row.equipped) { row.equipped = !equipped; equipped = true; } });
  state.pilots = collect('pilots', catalog.pilots); equipped = false;
  state.pilots.forEach(row => { if (row.equipped) { row.equipped = !equipped; equipped = true; } });
  state.skins = collect('skins', catalog.planes);
  const skinId = Number(saved.role?.skinId || 0);
  const skin = state.skins.find(r => r.id === skinId && r.active);
  if (skin) { state.role.skinId = skin.id; state.role.skinStar = skin.star; }
  const usedSlots = new Set<number>();
  state.skinSkillSlots = Array.from({ length: 3 }, (_, i) => {
    const id = Number(saved.skinSkillSlots?.[i] || 0);
    const row = state.skins.find(s => s.id === id && s.active);
    if (!row || usedSlots.has(id)) return 0;
    usedSlots.add(id); return id;
  });
  const usedParts = new Set<number>();
  state.equipment = (Array.isArray(saved.equipment) ? saved.equipment : []).flatMap((entry: RecordData) => {
    const row = catalog.equipment.find(r => Number(r.id) === Number(entry.id));
    if (!row || usedParts.has(Number(row.slot))) return [];
    usedParts.add(Number(row.slot));
    return [{ id: Number(row.id), slot: Number(row.slot), level: normalizeEquipmentPartLevel(entry.level) }];
  });
  const usedLabs = new Set<number>();
  state.labs = (Array.isArray(saved.labs) ? saved.labs : []).flatMap((entry: RecordData) => {
    const row = catalog.labs.find(r => Number(r.id) === Number(entry.id));
    if (!row || usedLabs.has(row.id)) return [];
    usedLabs.add(row.id); return [{ id: Number(row.id), level: clamp(entry.level, 1, row.maxLevel), active: !!entry.active }];
  });
  state.debugOverride = { enabled: !!saved.debugOverride?.enabled, attack: clamp(saved.debugOverride?.attack ?? 100, 1, 1e9), hp: clamp(saved.debugOverride?.hp ?? 600, 1, 1e9) };
  return state;
}
export function saveStudyLoadoutState(state: StudyLoadoutState) {
  volatileState = JSON.parse(JSON.stringify(state));
  try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* Research remains usable without storage. */ }
}
type Feature = { Type?: string; Args?: unknown };
export function parseStudyFeatures(value: unknown): Feature[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(parseStudyFeatures);
  if (typeof value === 'string') { try { return parseStudyFeatures(JSON.parse(value)); } catch { return []; } }
  return typeof value === 'object' ? [value as Feature] : [];
}
/** Quality perks follow the source NextID chain. Base/growth are taken only
 * from the selected quality, while already unlocked perks are retained. */
export function studyEquipmentQualityChain(catalog: LoadoutCatalog, row: RecordData) {
  const chain: RecordData[] = [], seen = new Set<number>();
  let current: RecordData | undefined = row;
  while (current && !seen.has(current.id)) {
    chain.unshift(current); seen.add(current.id);
    const id: number = Number(current.id);
    current = catalog.equipment.find(r => Number(r.raw?.NextID) === Number(id));
  }
  return chain;
}
export function calculateStudyLoadout(catalog: LoadoutCatalog, state: StudyLoadoutState): CalculatedLoadout {
  const attributes: Record<string, number> = {};
  const contributions: CalculatedLoadout['contributions'] = [];
  const unsupportedEffects: CalculatedLoadout['unsupportedEffects'] = [];
  const initial = new Set<number>(), roots = new Set<number>();
  const add = (name: string, expressions: unknown, multiplier = 1) => {
    const added: Record<string, number> = {};
    for (const expression of Array.isArray(expressions) ? expressions : typeof expressions === 'string' ? [expressions] : []) {
      const [rawKey, text] = String(expression).split('='), key = rawKey?.trim(), value = Number(text) * multiplier;
      if (!key || !Number.isFinite(value) || !value) continue;
      attributes[key] = (attributes[key] || 0) + value; added[key] = (added[key] || 0) + value;
    }
    if (Object.keys(added).length) contributions.push({ name, attributes: added });
  };
  const feature = (name: string, value: unknown, skills: boolean) => {
    for (const entry of parseStudyFeatures(value)) {
      if (entry.Type === 'Attr') add(name, String(entry.Args || '').split(';'));
      else if (entry.Type === 'Skill' && skills) for (const id of String(entry.Args).match(/\d+/g) || []) initial.add(Number(id));
      else if (entry.Type && entry.Type !== 'Skill') unsupportedEffects.push({ source: name, description: `${name}：原始特性 ${entry.Type} 尚未实现` });
    }
  };
  const currentStar = (row: RecordData, star: number) => (row.stars || []).find((r: RecordData) => Number(r.Star ?? r.star) === star);
  for (const entry of state.equipment) {
    const row = catalog.equipment.find(r => Number(r.id) === entry.id); if (!row) continue;
    const level = normalizeEquipmentPartLevel(entry.level);
    add(`${row.name} · ${row.qualityName} Lv.${level}`, row.raw.baseAttribute);
    add(`${row.name} · 等级成长`, row.raw.AttributeOnLevelUp, level - 1);
    for (const tier of studyEquipmentQualityChain(catalog, row)) feature(`${row.name} · ${tier.qualityName}`, tier.raw.FeatureJson, true);
  }
  for (const entry of state.skins.filter(r => r.active)) {
    const row = catalog.planes.find(r => Number(r.id) === entry.id); if (!row) continue;
    const star = currentStar(row, entry.star);
    add(`${row.name} · ${entry.star} 星收藏`, star?.AttrOnStarUp);
    feature(`${row.name} · 收藏`, star?.FeatureOnStarUp, state.skinSkillSlots.includes(entry.id));
  }
  const selectedGun = state.guns.find(r => r.equipped) || { id: 20101, star: 1, active: true };
  let primarySkillId = 10000101;
  for (const entry of state.guns.filter(r => r.active)) {
    const row = catalog.guns.find(r => Number(r.id) === entry.id); if (!row) continue;
    const star = currentStar(row, entry.star), name = `${row.name} · ${entry.star} 星`;
    add(`${name}收藏`, star?.AttrOnStarUp);
    if (entry.id === selectedGun.id) {
      for (const f of parseStudyFeatures(star?.FeatureInitSkill)) if (f.Type === 'Skill') for (const id of String(f.Args).match(/\d+/g) || []) { initial.add(Number(id)); roots.add(Number(id)); primarySkillId = Number(id); }
      feature(name, star?.FeatureOnStarUp, true);
    }
  }
  const selectedPilot = state.pilots.find(r => r.equipped);
  for (const entry of state.pilots.filter(r => r.active)) {
    const row = catalog.pilots.find(r => Number(r.id) === entry.id); if (!row) continue;
    const star = currentStar(row, entry.star); add(`${row.name} · ${entry.star} 星收藏`, star?.AttrOnStarUp);
    if (entry.id === selectedPilot?.id && star?.SkillId) initial.add(Number(star.SkillId));
  }
  // Native CardLevel rows contain totals at the selected level, not per-level
  // growth. Feed them through the same source attribute/skill calculator.
  for (const [id, level] of Object.entries(state.nativeResearch?.levels || {})) {
    const card = nativeResearchSource.cards.find(row => row.ID === Number(id));
    const row = nativeResearchSource.levels.find(row => row.CardID === Number(id) && row.CardLevel === level);
    if (!card || !row) throw new Error('缺少原版科技属性配置');
    add(card.name + '科技 · Lv.' + level, row.Attribute);
    feature(card.name + '科技', row.FeatureJson, true);
  }
  for (const entry of state.labs.filter(r => r.active)) {
    const row = catalog.labs.find(r => Number(r.id) === entry.id); if (!row) continue;
    const current = (row.levels || []).find((r: RecordData) => Number(r.Level) === entry.level);
    add(`${row.name}实验室 · Lv.${entry.level}`, current?.SkillAttributes);
    add(`${row.name}实验室 · 全局属性`, current?.AttributeAll);
    // Preserve prior confirmed milestones while a newer local receipt is
    // unresolved. Native MergeTechnologyAttribute folds the effective level
    // inclusively; NeedActive itself is not a native calculation-level field.
    // Legacy/manual records retain their previous conservative fallback.
    const skillLevel = entry.confirmedSkillLevel ?? (entry.activationKnown === false ? 0
      : entry.needActive === true ? entry.level - 1 : entry.level);
    for (const level of (row.levels || []).filter((r: RecordData) => Number(r.Level) <= skillLevel)) feature(`${row.name}实验室 Lv.${level.Level}`, level.FeatureJson, true);
  }
  if (!roots.size) {
    const selected = catalog.guns.find(r => Number(r.id) === selectedGun.id);
    const base = catalog.guns.find(r => Number(r.id) === Number(selected?.baseGunId));
    const star = base && currentStar(base, selectedGun.star);
    for (const f of parseStudyFeatures(star?.FeatureInitSkill)) if (f.Type === 'Skill') for (const id of String(f.Args).match(/\d+/g) || []) { roots.add(Number(id)); initial.add(Number(id)); primarySkillId = Number(id); }
    if (!roots.size) { roots.add(10000101); initial.add(10000101); }
  }
  // CalAttributeData 0x6d112c4..0x6d11500: collect all initial BanSkillS
  // first, then remove those IDs. This is not the random-pool RejectSkills
  // list and must not erase later in-battle learning history.
  const initialBans = new Set<number>();
  for (const id of initial) {
    const raw = catalog.allSkills.find(r => Number(r.id) === id)?.raw;
    for (const banned of raw?.BanSkillS || []) initialBans.add(Number(banned));
  }
  for (const id of initialBans) initial.delete(id);
  const battleSkillIds: number[] = [];
  const skillSupport: CalculatedLoadout['skillSupport'] = {};
  for (const id of initial) {
    const skill = catalog.allSkills.find(r => Number(r.id) === id), raw = skill?.raw;
    if (!raw) { unsupportedEffects.push({ source: `技能 ${id}`, skillId: id, description: `技能 ${id}：原始定义缺失，未执行` }); continue; }
    const support = inspectLoadoutSkillSupport(raw, catalog.runtime || {});
    skillSupport[id] = { supported: roots.has(id) || support.supported, reasons: support.reasons };
    if (skillSupport[id].supported) battleSkillIds.push(id);
    else unsupportedEffects.push({ source: skill.name, skillId: id, description: `${skill.name}（${id}）：${support.reasons.join('；')}` });
  }
  // Preserve the full display ledger, but do not inherit patrol-only values
  // into weapons or reject sortie admission for an out-of-battle attribute.
  const { economyAttributes, battleContributions } = splitNativeEconomyAttributes(contributions);
  const { runtimeAttributes, unsupportedAttributes, capabilities } = buildLoadoutRuntimeAttributes(battleContributions, catalog.attributeNames || {});
  // Show the resulting reduction, not the sum of its source percentages.
  // Two independent 10% reductions display 19%, matching the .9*.9 runtime.
  for (const [key, value] of Object.entries(runtimeAttributes)) {
    const definition = catalog.attributeNames?.[key]?.raw;
    if (definition?.mergeType === 2) attributes[key] = (1 - value) * (definition.valueType === 3 ? 100 : 1);
    else if (definition?.mergeType === 1) attributes[key] = value * (definition.valueType === 3 ? 100 : 1);
  }
  for (const key of unsupportedAttributes) unsupportedEffects.push({ source: key,
    description: `${catalog.attributeNames?.[key]?.name || key}（${key}=${attributes[key]}）：${capabilities[key].reason}` });
  const selectedSkinId = state.role.skinId || state.role.id || 10100;
  if (!catalog.appearances?.planes?.[selectedSkinId]?.layers?.length) unsupportedEffects.push({ source: '战机外观', description: '所选战机的战斗模型依赖尚未补齐；暂用基础战机，收藏属性保留' });
  if (selectedPilot && !catalog.appearances?.pilots?.[selectedPilot.id]?.layers?.length) unsupportedEffects.push({ source: '人物外观', description: '所选人物的战斗模型依赖尚未补齐；收藏属性保留' });
  let attack = Math.max(1, (100 + (attributes.Attack || 0)) * (1 + (attributes['Attack%'] || 0) / 100));
  let hp = Math.max(1, (600 + (attributes.HPMax || 0)) * (1 + (attributes['HPMax%'] || 0) / 100));
  if (state.debugOverride.enabled) { attack = state.debugOverride.attack; hp = state.debugOverride.hp; }
  contributions.unshift({ name: '基础战机', attributes: { Attack: 100, HPMax: 600 } });
  return { attack, hp, attributes, economyAttributes, runtimeAttributes, weaponAttributes: {}, runtimeWeaponAttributes: {}, initialSkillIds: [...initial], battleSkillIds, banSkillIds: [...(state.weaponSelectionBanSkillIds || [])], skillSupport,
    selectedGunId: selectedGun.id, primarySkillId, selectedSkinId, selectedPilotId: selectedPilot?.id || 0, unsupportedEffects, contributions };
}
export function applyStudyLoadout(content: GameContent, _sim: Simulation, catalog: LoadoutCatalog, state: StudyLoadoutState): CalculatedLoadout {
  const result = calculateStudyLoadout(catalog, state), player = content.chapter.player;
  player.attack = result.attack; player.hp = result.hp;
  content.combat.studyLoadout = result;
  content.combat.fixedEntryPreset ||= {};
  // The previous preset's 10% physical/crit is now supplied by the explicitly
  // activated gun collection, exactly once through runtimeAttributes.
  content.combat.fixedEntryPreset.weaponStar1Attributes = [];
  content.combat.skillRows ||= {};
  for (const id of result.battleSkillIds) {
    const row = catalog.runtime?.skillRows?.[id] || catalog.allSkills.find(r => Number(r.id) === id)?.raw;
    if (row) content.combat.skillRows[id] = row;
  }
  return result;
}
