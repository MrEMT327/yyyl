import { nativeLabActivation } from './native-laboratory.js';
import { nativeResearchState } from './native-research-state.js';
import { isRosterPilot } from './native-pilot-roster.js';
import catalog from './loadout-progression-index.json' with { type: 'json' };
import defaultLoadoutState from './default-loadout-state.json' with { type: 'json' };

// Keep peripheral progression independent of the battle runtime/module loader.
const createDefaultStudyLoadoutState = () => structuredClone(defaultLoadoutState);

export function createReplicaProgression() {
  // Use the actual replica default, not the cloud's development unlocks.
  const value = createDefaultStudyLoadoutState();
  return { ...value, pilots: value.pilots.filter(row => isRosterPilot(row.id)) };
}

export function validateReplicaProgression(value) {
  const defaults = createDefaultStudyLoadoutState();
  if (!value || value.version !== defaults.version || value.debugOverride?.enabled) {
    throw new Error('原版养成存档无效或包含调试数值');
  }
  const collect = (key, rows, progressField) => {
    if (!Array.isArray(value[key])) throw new Error(`缺少原版养成记录：${key}`);
    const seen = new Set();
    return value[key].map(entry => {
      const row = rows.find(row => row.id === entry?.id);
      if (!row || seen.has(row.id) || !row[progressField].includes(entry[progressField === 'stars' ? 'star' : 'level'])
        || typeof entry.active !== 'boolean' || (entry.equipped && !entry.active)) {
        throw new Error(`原版养成 ID 或成长记录无效：${key}/${entry?.id}`);
      }
      seen.add(row.id);
      return progressField === 'stars'
        ? { id: row.id, star: entry.star, active: entry.active, equipped: Boolean(entry.equipped) }
        : { id: row.id, level: entry.level, active: entry.active, ...nativeLabActivation(entry) };
    }); // Preserve native collection order, including skill insertion order.
  };
  const guns = collect('guns', catalog.guns, 'stars');
  // Excluded legacy records cannot contribute skills or collection attributes.
  // This is the explicit ten-pilot product roster, not a native formula change.
  const pilots = collect('pilots', catalog.pilots, 'stars').filter(row => isRosterPilot(row.id));
  const skins = collect('skins', catalog.skins, 'stars');
  const labs = collect('labs', catalog.labs, 'levels');
  if (guns.filter(row => row.equipped).length !== 1 || pilots.filter(row => row.equipped).length > 1) {
    throw new Error('原版出战配置必须有一把主武器，至多一名驾驶员');
  }
  // The captured replica calculates current-star collections. Its legacy role
  // level/star tables are not used: do not invent level multipliers here.
  for (const key of ['id', 'level', 'star', 'starStep']) {
    if (value.role?.[key] !== defaults.role[key]) throw new Error(`复刻版尚未支持基础角色成长字段：${key}`);
  }
  const skinId = value.role.skinId;
  const skin = skins.find(row => row.id === skinId && row.active);
  if (skinId !== 0 && !skin) throw new Error('所选原版飞机尚未拥有');
  if (!Array.isArray(value.skinSkillSlots) || value.skinSkillSlots.length !== defaults.skinSkillSlots.length) {
    throw new Error('原版飞机技能槽数量不一致');
  }
  const slots = value.skinSkillSlots.slice();
  const used = new Set();
  for (const id of slots) {
    if (id === 0) continue;
    if (!skins.some(row => row.id === id && row.active) || used.has(id)) throw new Error('飞机技能未拥有或重复装配');
    used.add(id);
  }
  return { ...defaults, role: { ...defaults.role, skinId, skinStar: skin?.star || 0 },
    guns, pilots, skins, labs, nativeResearch: nativeResearchState(value.nativeResearch), skinSkillSlots: slots };
}

/** Selection only. Unlocks/star levels cannot be granted by a skin change. */
export function selectReplicaProgression(value, selection) {
  const next = validateReplicaProgression(value);
  const { kind, id } = selection || {};
  if (kind === 'skinSkillSlots') {
    next.skinSkillSlots = selection.ids;
  } else if (kind === 'skins') {
    const skin = next.skins.find(row => row.id === id && row.active);
    if (id !== 0 && !skin) throw new Error('原版飞机尚未拥有');
    next.role.skinId = id; next.role.skinStar = skin?.star || 0;
  } else if (kind === 'guns' || kind === 'pilots') {
    if (!(kind === 'pilots' && id === 0) && !next[kind].some(row => row.id === id && row.active)) {
      throw new Error('原版武器或驾驶员尚未拥有');
    }
    next[kind].forEach(row => { row.equipped = row.id === id; });
  } else throw new Error('未知的原版出战装配操作');
  return validateReplicaProgression(next);
}
