import zhMessages from './lang/zh.json' with { type: 'json' };
import enMessages from './lang/en.json' with { type: 'json' };

const LANGUAGE_TABLES = Object.freeze({ zh: zhMessages, en: enMessages });
const SUPPORTED_LANGUAGES = new Set(Object.keys(LANGUAGE_TABLES));
const CJK_RE = /[\u3400-\u9fff]/;
const TRANSLATION_KEY_PREFIX = 's:';
const DOM_ATTRIBUTE_NAMES = Object.freeze(['aria-label', 'title', 'placeholder', 'alt']);
const DOM_HOOK_KEY = '__thunderI18nDomHooks__';
const PIXI_HOOK_KEY = '__thunderI18nPixiHooks__';

// These are deliberately short UI terms. Exact phrases live in the language
// JSON files; this glossary keeps interpolated HUD/status strings readable.
const TERM_REPLACEMENTS = Object.freeze([
  ['建议战力', 'Recommended Power'],
  ['敌机血量', 'enemy HP'],
  ['出怪频率', 'spawn rate'],
  ['弹幕压力', 'projectile pressure'],
  ['｜Recommended Power按enemy HP、spawn rate and projectile pressure估算', ' | Recommended Power estimated from enemy HP, spawn rate, and projectile pressure'],
  ['｜建议战力按敌机血量、出怪频率与弹幕压力估算', ' | Recommended Power estimated from enemy HP, spawn rate, and projectile pressure'],
  ['本机榜', 'Local Board'],
  ['世界分数榜', 'World Score Board'],
  ['世界关卡榜', 'World Stage Board'],
  ['可在永久补给中招募', 'Recruit from Permanent Supply'],
  ['可在', 'Available in '],
  ['中招募', ' to recruit'],
  ['调试预览', 'Debug Preview'],
  ['不写入正常进度', 'does not affect normal progress'],
  ['正常养成进度', 'normal progression'],
  ['首次获得', 'First obtained'],
  ['基础概率结果', 'Base rate result'],
  ['待配置', 'Pending config'],
  ['当前仅基础攻击生效', 'base attack only'],
  ['专属效果启用', 'Exclusive effect active'],
  ['效果未启用', 'Effect inactive'],
  ['当前出战', 'Active'],
  ['出场中', 'Active'],
  ['出战中', 'In Sortie'],
  ['已选', 'Selected'],
  ['选择出战', 'Select for sortie'],
  ['出战角色', 'sortie pilot'],
  ['已设为出击角色', 'set as sortie pilot'],
  ['飞行状态', 'Flight Status'],
  ['移动', 'Move'],
  ['飞行', 'Flight'],
  ['飞机', 'Fighter'],
  ['主线', 'Campaign'],
  ['敌机', 'Enemies'],
  ['战力', 'Power'],
  ['详情', 'Details'],
  ['属性摘要', 'Stats Summary'],
  ['本轮', 'this round'],
  ['概率', 'rate'],
  ['结果', 'result'],
  ['血', 'HP'],
  ['尚缺', 'Missing'],
  ['配方完成', 'Recipe complete'],
  ['正在重构', 'Reconfiguring'],
  ['二段任务', 'Stage Two Task'],
  ['再完成本路线任意强化', 'complete any upgrade on this path'],
  ['级', 'Lv.'],
  ['新', 'New'],
  ['深海奇点', 'Deep-Sea Singularity'],
  ['奇点', 'Singularity'],
  ['螺旋转速', 'spiral speed'],
  ['振幅', 'amplitude'],
  ['火力', 'firepower'],
  ['弹数', 'Shot Count'],
  ['数量', 'Count'],
  ['完全展开', 'fully unfurled'],
  ['全开', 'Full Unlock'],
  ['样式预览', 'visual preview'],
  ['仅播放演出', 'showcase only'],
  ['不修改存档', 'does not modify the save'],
  ['恢复', 'Restore'],
  ['重启', 'Restart'],
  ['清空', 'Clear'],
  ['一键通关', 'One-Tap Clear'],
  ['预览', 'Preview'],
  ['重新出击', 'Sortie Again'],
  ['下一关', 'Next Stage'],
  ['已通关', 'Cleared'],
  ['离', 'Exit'],
  ['重试', 'Retry'],
  ['先通关', 'Clear first'],
  ['尚未解锁', 'Locked'],
  ['尚未获得', 'Not owned'],
  ['已获得', 'Owned'],
  ['已装备', 'Equipped'],
  ['未获得', 'Not owned'],
  ['专属武器', 'Exclusive Weapon'],
  ['通用武器', 'Universal Weapon'],
  ['通用', 'Universal'],
  ['持有', 'Owned'],
  ['累计', 'Total'],
  ['总级', 'Total Lv.'],
  ['综合增伤', 'Total Damage'],
  ['每件独立等级', 'each has its own level'],
  ['无需按键', 'no key required'],
  ['被动挂载', 'Passive Mounts'],
  ['挂点', 'Mount'],
  ['卸下', 'Unequip'],
  ['拖入', 'Drag into '],
  ['拖回', 'Drag back to '],
  ['高亮槽位', 'highlighted slot'],
  ['固定件不改机身', 'Mounts do not alter the frame'],
  ['三层元素螺旋环绕', 'three elemental rings orbit'],
  ['与战斗完全同步', 'fully synced with combat'],
  ['正在同步', 'Syncing'],
  ['正在接入', 'Connecting'],
  ['离线', 'offline'],
  ['请刷新重试', 'refresh and retry'],
  ['专属角色', 'exclusive pilot'],
  ['专属效果', 'exclusive effect'],
  ['启用', 'active'],
  ['基础攻击', 'Base Attack'],
  ['基础耐久', 'Base HP'],
  ['基础射击', 'Base Shot'],
  ['固定件属性', 'Mount Stats'],
  ['武器挂载摘要', 'Weapon Mount Summary'],
  ['阶段', 'Stage'],
  ['协议', 'Protocol'],
  ['世界排行榜', 'World Leaderboard'],
  ['暮海防线排行榜', 'Dusk Sea Leaderboard'],
  ['终极武装', 'Ultimate Armament'],
  ['终极蓝图', 'Ultimate Blueprint'],
  ['战区出击', 'Sortie Zone'],
  ['关卡需求', 'Stage Requirement'],
  ['主线战役', 'Main Campaign'],
  ['主线章节', 'Main Chapters'],
  ['固定件装配', 'Mount Assembly'],
  ['武器挂载舱', 'Weapon Mount Bay'],
  ['机甲少女', 'Mecha Pilot'],
  ['激励广告', 'rewarded ad'],
  ['完整观看广告', 'Watch the full ad'],
  ['广告播放中', 'Ad playing'],
  ['看广告', 'Watch ad'],
  ['战区', 'Zone'],
  ['旗舰', 'Flagship'],
  ['战机', 'Fighter'],
  ['飞行员', 'Pilot'],
  ['主武器', 'Primary Weapon'],
  ['武器', 'Weapon'],
  ['技能', 'Skill'],
  ['固定件', 'Mount'],
  ['模块', 'Module'],
  ['装配', 'Loadout'],
  ['机体', 'Fighter'],
  ['平台', 'Platform'],
  ['成长', 'Growth'],
  ['火控', 'Fire Control'],
  ['核心', 'Core'],
  ['推荐', 'Recommended'],
  ['下次', 'Next'],
  ['上限', 'Cap'],
  ['只产出', 'Fighters only'],
  ['分层保底', 'tiered guarantees'],
  ['与单抽共用保底', 'shares pity with single draws'],
  ['抽', ' pulls'],
  ['直射', 'Direct Fire'],
  ['挂载', 'Mount'],
  ['补给', 'Supply'],
  ['招募', 'Recruit'],
  ['排行榜', 'Leaderboard'],
  ['战斗', 'Combat'],
  ['作战', 'Combat'],
  ['出击', 'Sortie'],
  ['升级', 'Upgrade'],
  ['当前', 'Current'],
  ['本局', 'This run'],
  ['战绩', 'scores'],
  ['奖励', 'Reward'],
  ['金币', 'Coins'],
  ['钻石', 'Gems'],
  ['以太晶体', 'Aether Crystals'],
  ['耐久', 'HP'],
  ['生命', 'HP'],
  ['攻击', 'Attack'],
  ['伤害', 'Damage'],
  ['增伤', 'Damage'],
  ['射速', 'Fire Rate'],
  ['弹速', 'Projectile Speed'],
  ['移速', 'Move Speed'],
  ['暴击率', 'Crit Rate'],
  ['暴击伤害', 'Crit Damage'],
  ['暴击', 'Crit'],
  ['经验', 'XP'],
  ['关卡', 'Stage'],
  ['章节', 'Chapter'],
  ['等级', 'Lv.'],
  ['共鸣', 'Resonance'],
  ['星级', 'Stars'],
  ['星', ' stars'],
  ['品质', 'Quality'],
  ['积分', 'Score'],
  ['击破', 'Kills'],
  ['模式', ' Mode'],
  ['简单', 'Easy'],
  ['困难', 'Hard'],
  ['地狱', 'Hell'],
  ['已领取', 'Claimed'],
  ['可领取', 'Claim'],
  ['待领取', 'Pending'],
  ['尚未解锁', 'Locked'],
  ['尚未获得', 'Not owned'],
  ['已获得', 'Owned'],
  ['已装备', 'Equipped'],
  ['未装备', 'Not equipped'],
  ['已装配', 'Installed'],
  ['未安装', 'Not installed'],
  ['已击破', 'Destroyed'],
  ['已摧毁', 'Destroyed'],
  ['清缴', 'Purge'],
  ['肃清', 'Cleared'],
  ['回收', 'Salvage'],
  ['解锁', 'Unlock'],
  ['激活', 'Activate'],
  ['强化', 'Enhance'],
  ['进阶', 'Advanced'],
  ['质变', 'Breakthrough'],
  ['终极', 'Ultimate'],
  ['基础', 'Base'],
  ['自动', 'Auto'],
  ['空槽位', 'Empty Slot'],
  ['空', 'Empty'],
  ['任务', 'Task'],
  ['当前任务', 'Task'],
  ['首次', 'First'],
  ['路线', 'Path'],
  ['锁定', 'Lock'],
  ['增益', 'Buff'],
  ['武装', 'Armament'],
  ['蓝图', 'Blueprint'],
  ['协议', 'Protocol'],
  ['立即生效', 'apply instantly'],
  ['持续追踪', 'tracks progress'],
  ['平均', 'Avg'],
  ['最慢', 'Worst'],
  ['技能演出', 'Skill Showcase'],
  ['打开调试页面', 'Open Debug Page'],
  ['自动挂载', 'Auto Mount'],
  ['被动武器', 'Passive Weapon'],
  ['自动触发', 'Auto Trigger'],
  ['触发', 'Trigger'],
  ['选择', 'Select'],
  ['出战', 'In Sortie'],
  ['使用', 'Uses'],
  ['抽取', 'Draw'],
  ['装载', 'Equip'],
  ['装备', 'Equip'],
  ['角色', 'Pilot'],
  ['档案', 'Profile'],
  ['说明', 'Description'],
  ['舱', 'Bay'],
  ['库', 'Library'],
  ['获得', 'Earned'],
  ['挑战', 'Challenge'],
  ['完成通关', 'Clear the stage'],
  ['耐久≥60%', 'HP ≥60%'],
  ['满血通关', 'Full-HP clear'],
  ['优势', 'Advantage'],
  ['可挑战', 'Ready to challenge'],
  ['吃力', 'Strained'],
  ['危险', 'Danger'],
  ['战力不足', 'Underpowered'],
  ['容错充足', 'Plenty of margin'],
  ['处于通关区间', 'Within clear range'],
  ['需要较好操作', 'Requires good control'],
  ['失败风险较高', 'High failure risk'],
  ['建议先强化', 'Upgrade first'],
  ['第', 'No. '],
  ['章', 'Chapter'],
  ['需求', 'Requirement'],
  ['确认', 'Confirm'],
  ['取消', 'Cancel'],
  ['关闭', 'Close'],
  ['返回', 'Back'],
  ['退出', 'Exit'],
  ['离开', 'Leave'],
  ['重试', 'Retry'],
  ['跳过演出', 'Skip Showcase'],
  ['查看档案', 'View Profile'],
  ['查看全图', 'View Full Art'],
  ['查看排行榜', 'View Leaderboard'],
  ['上一章', 'Previous Chapter'],
  ['下一章', 'Next Chapter'],
  ['第二段', 'Stage Two'],
  ['第一段', 'Stage One'],
  ['一段', 'Stage One'],
  ['二段', 'Stage Two'],
  ['秒', 's'],
  ['毫秒', 'ms'],
  ['分钟', 'min'],
]);

const SORTED_TERM_REPLACEMENTS = [...TERM_REPLACEMENTS]
  .sort((left, right) => right[0].length - left[0].length);

function sourceKey(value) {
  return `${TRANSLATION_KEY_PREFIX}${String(value)}`;
}

function normalizeLanguage(value) {
  const normalized = String(value || '').trim().toLowerCase().replace('_', '-');
  const base = normalized.split('-')[0];
  return SUPPORTED_LANGUAGES.has(base) ? base : null;
}

function preserveWhitespace(source, translated) {
  const leading = source.match(/^\s*/)?.[0] || '';
  const trailing = source.match(/\s*$/)?.[0] || '';
  const start = leading.length;
  const end = trailing.length ? translated.length - trailing.length : translated.length;
  return `${leading}${translated.slice(start, Math.max(start, end))}${trailing}`;
}

function interpolate(value, args) {
  if (!args || typeof args !== 'object') return value;
  return value.replace(/\{(\w+)\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(args, key) ? String(args[key]) : match
  ));
}

function applyDynamicPattern(value, translatePart) {
  const formatPower = (power) => {
    const match = String(power).match(/^(\d+(?:\.\d+)?)万$/);
    if (match) {
      const valueInThousands = Number(match[1]) * 10;
      return `${Number.isInteger(valueInThousands) ? valueInThousands : valueInThousands.toFixed(1)}k`;
    }
    const numericPower = Number(String(power).replace(/,/g, ''));
    if (Number.isFinite(numericPower) && numericPower >= 10000) {
      return `${(numericPower / 1000).toFixed(numericPower % 1000 ? 1 : 0)}k`;
    }
    return power;
  };
  const compactReadiness = (readiness) => {
    const translated = translatePart(readiness);
    return {
      'Ready to challenge': 'Ready',
      Strained: 'Tough',
      Underpowered: 'Low',
    }[translated] || translated;
  };
  const translateTriggerState = (state) => {
    const text = String(state || '');
    const cooldown = text.match(/^(\d+(?:\.\d+)?)\s*秒后自动触发$/);
    if (cooldown) return `Auto trigger in ${cooldown[1]}s`;
    if (text === '正在自动触发') return 'Auto-triggering';
    return translatePart(text);
  };
  const patterns = [
    [/^(?:白色|绿色|蓝色)(强袭机翼|连射机翼|校准机翼|矢量推进器|能量推进器|训练推进器|装甲机尾|缓冲机尾|修复机尾)([ⅠⅡⅢ])$/, (_, part, mark) => `${translatePart(part)} ${mark}`],
    [/^第\s*(\d+)\s*天$/, (_, day) => `Day ${day}`],
    [/^领取第\s*(\d+)\s*日奖励$/, (_, day) => `Claim Day ${day}`],
    [/^第\s*(\d+)\s*章$/, (_, chapter) => `Chapter ${chapter}`],
    [/^第\s*(\d+)\s*关未解锁$/, (_, stage) => `Stage ${stage} Locked`],
    [/^第\s*(\d+)\s*\/\s*(\d+)\s*章$/, (_, current, total) => `Chapter ${current} / ${total}`],
    [/^平均\s*(\d+(?:\.\d+)?)\s*毫秒\s*\/\s*最慢\s*(\d+(?:\.\d+)?)\s*毫秒$/, (_, average, worst) => `Avg ${average} ms / Worst ${worst} ms`],
    [/^(.+?)技能演出$/, (_, pilot) => `${translatePart(pilot)} Skill Showcase`],
    [/^(\d+)\s*挂点\s*·\s*无需按键\s*·\s*每件独立等级\s*(\d+[–-]\d+)$/, (_, count, range) => `${count} Mounts · no key required · Individual levels ${range}`],
    [/^查看(.+?)完整档案$/, (_, pilot) => `View ${translatePart(pilot)} Full Profile`],
    [/^查看(.+?)角色全图$/, (_, pilot) => `View ${translatePart(pilot)} Full Character Art`],
    [/^(.+?)与(.+)$/, (_, left, right) => `${translatePart(left)} and ${translatePart(right)}`],
    [/^自动挂点\s*(\d+)，(.+?)，等级\s*(\d+)，(.+)$/, (_, slot, weapon, level, state) => `Auto Mount ${slot}, ${translatePart(weapon)}, Lv. ${level}, ${translateTriggerState(state)}`],
    [/^挂点\s*(\d+)\s*未安装被动武器$/, (_, slot) => `Mount ${slot} · Passive Weapon Not Installed`],
    [/^自动挂载\s*·\s*(.+?)\s*·\s*(.+)$/, (_, weapon, description) => `Auto Mount · ${translatePart(weapon)} · ${translatePart(description)}`],
    [/^自动\s*·\s*(.+)$/, (_, name) => `Auto · ${translatePart(name)}`],
    [/^等级(\d+)\s*·\s*自动间隔\s*(\d+(?:\.\d+)?)秒$/, (_, level, seconds) => `Lv. ${level} · Auto ${seconds}s`],
    [/^(.+?)\s*·\s*冷却\s*(\d+(?:\.\d+)?)秒$/, (_, name, seconds) => `${translatePart(name)} · CD ${seconds}s`],
    [/^(\d+)架\s*·\s*(\d+(?:\.\d+)?)秒\/次$/, (_, count, seconds) => `${count} Units · ${seconds}s`],
    [/^(\d+)单元\s*·\s*常驻$/, (_, count) => `${count} Units · Always On`],
    [/^(.+?)\s*·\s*(.+?)接口\s*·\s*战力\s*(\d+)(?:\s*·\s*(.+))?$/, (_, rarity, interfaceName, power, slot) => `${translatePart(rarity)} · ${translatePart(interfaceName)} · Power ${power}${slot ? ` · ${translatePart(slot)}` : ''}`],
    [/^(\d+)\/3\s*被动挂载在线$/, (_, count) => `${count}/3 Mounts Online`],
    [/^(\d+(?:\.\d+)?)\s*秒后自动触发$/, (_, seconds) => `Auto trigger in ${seconds}s`],
    [/^正在自动触发$/, () => 'Auto-triggering'],
    [/^挑战第\s*(\d+)\s*章\s*·\s*(.+)$/, (_, chapter, difficulty) => `Challenge Stage ${chapter} · ${translatePart(difficulty)}`],
    [/^尚缺\s+(.+)$/, (_, missing) => `Missing ${translatePart(missing)}`],
    [/^增益\s*·\s*(.+)$/, (_, buff) => `Buff · ${translatePart(buff)}`],
    [/^关卡需求\s+(.+?)\s+战力\s*·\s*(.+)$/, (_, power, readiness) => `Power ${formatPower(power)} · ${compactReadiness(readiness)}`],
    [/^需求\s+(.+?)\s+战力\s*·\s*(.+)$/, (_, power, readiness) => `Requirement ${formatPower(power)} Power · ${compactReadiness(readiness)}`],
    [/^(.+?)｜(?:建议战力按敌机血量、出怪频率与弹幕压力估算|Recommended Power按enemy HP、spawn rate and projectile pressure估算)$/, (_, readiness) => `${translatePart(readiness)} | Recommended Power estimated from enemy HP, spawn rate, and projectile pressure`],
    [/^(.+?)｜建议战力按敌机血量、出怪频率与弹幕压力估算$/, (_, readiness) => `${translatePart(readiness)} | Recommended Power estimated from enemy HP, spawn rate, and projectile pressure`],
    [/^养成总级$/, () => 'Total Growth Lv.'],
    [/^◆\s*180\s*·\s*(?:与单抽共用保底|and 单 pulls共用保底)$/, () => '◆ 180 · Shared single-pull pity'],
    [/^调试预览\s*·\s*(.+?)\s*·\s*已打开通关结算面板$/, (_, stage) => `Debug · ${translatePart(stage)} · Result opened`],
    [/^等级\s*(\d+)\s*\/\s*(\d+)$/, (_, level, max) => `Lv. ${level} / ${max}`],
    [/^等级\s*(\d+)$/, (_, level) => `Lv. ${level}`],
    [/^等级(\d+)$/, (_, level) => `Lv. ${level}`],
    [/^(\d+)\s*级$/, (_, level) => `Lv. ${level}`],
    [/^(.+?)\s*级$/, (_, value) => `${translatePart(value)} Lv.`],
    [/^共鸣\s+(\d+)\s*·\s*攻击\s*\+(\d+)%$/, (_, amount, attack) => `R${amount} · ATK +${attack}%`],
    [/^共鸣\s+(\d+)(.*)$/, (_, amount, rest) => `Resonance ${amount}${translatePart(rest)}`],
    [/^战力\s+(.+)$/, (_, power) => `Power ${translatePart(power)}`],
    [/^(.+?)\s*·\s*当前出战$/, (_, name) => `${translatePart(name)} · Active`],
    [/^(.+?)\s*·\s*已设为出击角色$/, (_, name) => `${translatePart(name)} · Sortie Pilot Set`],
    [/^当前出击$/, () => 'In Sortie'],
    [/^(.+?)\s*·\s*出场中$/, (_, name) => `${translatePart(name)} · Active`],
    [/^(.+?)\s*·\s*(.+?)肃清$/, (_, name, mode) => `${translatePart(name)} · ${translatePart(mode)} Cleared`],
    [/^(.+?)\s*·\s*已获得$/, (_, name) => `${translatePart(name)} · Owned`],
    [/^(.+?)\s*·\s*未获得$/, (_, name) => `${translatePart(name)} · Not owned`],
    [/^(.+?)\s*·\s*已装备$/, (_, name) => `${translatePart(name)} · Equipped`],
    [/^(.+?)\s*·\s*(通用武器|专属武器(?:\s*·\s*.+)?)\s*·\s*持有\s+(\d+)$/, (_, quality, type, count) => `${translatePart(quality)} · ${translatePart(type)} · Owned ${count}`],
    [/^(.+?)\s*·\s*建议\s+(.+)$/, (_, name, power) => `${translatePart(name)} · Recommended ${power}`],
    [/^(.+?)\s*·\s*(.+?)建议战力\s+(.+)$/, (_, name, mode, power) => `${translatePart(name)} · ${translatePart(mode)} Recommended Power ${formatPower(power)}`],
    [/^(.+?)建议战力\s+(.+)$/, (_, mode, power) => `${translatePart(mode)} Recommended Power ${formatPower(power)}`],
    [/^基础耐久\s+(.+?)\s*·\s*移动\s+(.+)$/, (_, hp, move) => `Base HP ${hp} · Move ${move}`],
    [/^装配战力\s*\+(.+)$/, (_, power) => `Loadout +${power}`],
    [/^已装\s+(.+)$/, (_, slot) => `Installed · ${translatePart(slot)}`],
    [/^雷霆战机\s*·\s*等级(\d+)$/, (_, level) => `Thunder Fighter · Lv. ${level}`],
    [/^(.+?)成长\s*$/, (_, growth) => `${translatePart(growth)} Growth`],
    [/^基础耐久\s+(.+)$/, (_, hp) => `Base HP ${hp}`],
    [/^基础攻击\s*·\s*等级(\d+)$/, (_, level) => `Base Attack · Lv. ${level}`],
    [/^雷核矩阵\s*·\s*等级(\d+)$/, (_, level) => `Thunder Core Matrix · Lv. ${level}`],
    [/^当前战力$/, () => 'Current Power'],
    [/^下次机体$/, () => 'Next Fighter'],
    [/^等级上限$/, () => 'Level Cap'],
    [/^已获得\s+(\d+\/\d+)$/, (_, count) => `Owned ${count}`],
    [/^已解锁\s+(\d+)\s*件(.*)$/, (_, count, rest) => `Unlocked ${count} items${translatePart(rest)}`],
    [/^重复获得\s*·\s*共鸣\s*\+(\d+)\s*→\s*(\d+)$/, (_, added, total) => `Duplicate · Resonance +${added} → ${total}`],
    [/^重复获得\s+(\d+)\s*次$/, (_, count) => `Duplicate ×${count}`],
    [/^保底触发\s*·\s*(.+)$/, (_, tier) => `Pity triggered · ${tier}`],
    [/^(\d+)\s*\/\s*(\d+)\s*·\s*上下滑动查看$/, (_, current, total) => `${current} / ${total} · Swipe to View`],
    [/^累计\s+(\d+)\s*抽$/, (_, count) => `${count} pulls total`],
    [/^紫色\s+(\d+)\/10$/, (_, count) => `Purple ${count}/10`],
    [/^金色\s+(\d+)\/60$/, (_, count) => `Gold ${count}/60`],
    [/^金币\s*\+(.+)$/, (_, amount) => `Coins +${amount}`],
    [/^钻石\s*\+(.+)$/, (_, amount) => `Gems +${amount}`],
    [/^广告奖励\s*·\s*钻石\s*\+(.+)$/, (_, amount) => `Ad Reward · Gems +${amount}`],
    [/^历史最佳\s+(\d+)\s*星\s*·\s*奖励已领取$/, (_, stars) => `Best ${stars} stars · Reward claimed`],
    [/^新装备：(.+)$/, (_, items) => `New gear: ${translatePart(items)}`],
    [/^技能池：(.+)$/, (_, path) => `Skill path: ${translatePart(path)}`],
    [/^\s*●\s*金币\s*\+(.+)$/, (_, amount) => `● Coins +${amount}`],
    [/^\s*◆\s*钻石\s*\+(.+)$/, (_, amount) => `◆ Gems +${amount}`],
    [/^挂点\s*(\d+)$/, (_, slot) => `Mount ${slot}`],
    [/^挂(\d+)$/, (_, slot) => `M${slot}`],
    [/^第\s*(\d+)\s*日签到/, (_, day) => `Day ${day} check-in`],
    [/^最高通关第\s*(\d+)\s*章$/, (_, chapter) => `Highest clear: Chapter ${chapter}`],
    [/^最高分\s+(.+)$/, (_, score) => `High score ${score}`],
    [/^(.+?)星\s*\/\s*3星$/, (_, stars) => `${stars} stars / 3 stars`],
    [/^(.+?)模式\s*·\s*(.+)$/, (_, mode, rest) => `${translatePart(mode)} Mode · ${translatePart(rest)}`],
    [/^(.+?)\s*·\s*等级(\d+)$/, (_, name, level) => `${translatePart(name)} · Lv. ${level}`],
    [/^(.+?)\s*·\s*已击破$/, (_, name) => `${translatePart(name)} · Destroyed`],
    [/^(.+?)旗舰$/, (_, name) => `${translatePart(name)} Flagship`],
    [/^(.+?)\s*·\s*尚未获得$/, (_, name) => `${translatePart(name)} · Not owned`],
  ];
  for (const [pattern, render] of patterns) {
    const match = value.match(pattern);
    if (match) return render(...match);
  }
  return null;
}

function createTranslator(table, language = 'en') {
  const exactEntries = Object.entries(table)
    .filter(([key, value]) => key !== '_lang' && key.startsWith(TRANSLATION_KEY_PREFIX) && typeof value === 'string')
    .map(([key, value]) => [key.slice(TRANSLATION_KEY_PREFIX.length), value])
    // Single-character entries are reserved for exact labels/icons (for
    // example the compact lobby nav). They must never rewrite substrings such
    // as 战力 -> B力 or 机甲 -> F甲 inside a longer sentence.
    .filter(([source]) => Array.from(source).length > 1)
    .sort((left, right) => right[0].length - left[0].length);

  const translatePart = (value) => {
    if (!value || !CJK_RE.test(value)) return value;
    const exact = table[sourceKey(value)];
    if (typeof exact === 'string') return exact;
    let translated = value;
    for (const [source, target] of exactEntries) {
      if (translated.includes(source)) translated = translated.split(source).join(target);
    }
    for (const [source, target] of SORTED_TERM_REPLACEMENTS) {
      if (translated.includes(source)) translated = translated.split(source).join(target);
    }
    return translated;
  };

  return (value, args) => {
    if (typeof value !== 'string') return value;
    if (language === 'zh') return value;
    const exact = table[sourceKey(value)];
    if (typeof exact === 'string') return interpolate(exact, args);
    const dynamic = applyDynamicPattern(value, translatePart);
    if (dynamic) return interpolate(dynamic, args);
    return interpolate(translatePart(value), args);
  };
}

function getStorageValue(storage, key) {
  try {
    return storage?.getItem?.(key) || '';
  } catch {
    return '';
  }
}

function setStorageValue(storage, key, value) {
  try {
    storage?.setItem?.(key, value);
  } catch {
    // Embedded previews can deny storage; the current session still works.
  }
}

function installDomHooks(translator) {
  const root = globalThis;
  const hooks = root[DOM_HOOK_KEY] || (root[DOM_HOOK_KEY] = {});
  hooks.translate = translator;
  if (hooks.installed) return hooks;

  const NodeCtor = root.Node;
  const nodeDescriptor = NodeCtor && Object.getOwnPropertyDescriptor(NodeCtor.prototype, 'textContent');
  if (nodeDescriptor?.set && nodeDescriptor?.get) {
    Object.defineProperty(NodeCtor.prototype, 'textContent', {
      configurable: nodeDescriptor.configurable,
      enumerable: nodeDescriptor.enumerable,
      get: nodeDescriptor.get,
      set(value) {
        nodeDescriptor.set.call(this, typeof value === 'string' ? hooks.translate(value) : value);
      },
    });
  }

  const ElementCtor = root.Element;
  const originalSetAttribute = ElementCtor?.prototype?.setAttribute;
  if (originalSetAttribute) {
    ElementCtor.prototype.setAttribute = function setAttribute(name, value) {
      const attribute = String(name).toLowerCase();
      const nextValue = DOM_ATTRIBUTE_NAMES.includes(attribute) && typeof value === 'string'
        ? hooks.translate(value)
        : value;
      return originalSetAttribute.call(this, name, nextValue);
    };
  }
  hooks.installed = true;
  return hooks;
}

function installPixiTextHook(TextClass, translator) {
  if (!TextClass?.prototype) return;
  const root = globalThis;
  const hooks = root[PIXI_HOOK_KEY] || (root[PIXI_HOOK_KEY] = new WeakMap());
  let state = hooks.get(TextClass);
  if (!state) {
    let owner = TextClass.prototype;
    let descriptor = null;
    while (owner && !descriptor) {
      descriptor = Object.getOwnPropertyDescriptor(owner, 'text');
      owner = Object.getPrototypeOf(owner);
    }
    if (!descriptor?.set || !descriptor?.get) return;
    state = { translate: translator };
    Object.defineProperty(TextClass.prototype, 'text', {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set(value) {
        descriptor.set.call(this, typeof value === 'string' ? state.translate(value) : value);
      },
    });
    hooks.set(TextClass, state);
  } else {
    state.translate = translator;
  }
}

function applyDomTranslations(documentRef, translator, root = documentRef) {
  if (!documentRef || !root) return;
  const textWalker = documentRef.createTreeWalker?.(root, 4);
  if (textWalker) {
    const nodes = [];
    let node = textWalker.nextNode();
    while (node) {
      if (!node.parentElement?.closest('script,style,noscript')) nodes.push(node);
      node = textWalker.nextNode();
    }
    nodes.forEach((textNode) => {
      const next = translator(textNode.nodeValue || '');
      if (next !== textNode.nodeValue) textNode.nodeValue = next;
    });
  }

  const elements = [];
  if (root.nodeType === 1) elements.push(root);
  if (root.querySelectorAll) elements.push(...root.querySelectorAll('*'));
  elements.forEach((element) => {
    DOM_ATTRIBUTE_NAMES.forEach((name) => {
      if (!element.hasAttribute(name)) return;
      const current = element.getAttribute(name);
      const next = translator(current || '');
      if (next !== current) element.setAttribute(name, next);
    });
  });
}

function installDomObserver(documentRef, translator) {
  const Observer = globalThis.MutationObserver || documentRef?.defaultView?.MutationObserver;
  if (!Observer || !documentRef?.body) return null;
  // The WeChat browser preview uses a virtual DOM, not browser Node objects.
  const NodeType = documentRef.defaultView?.Node || globalThis.Node;
  if (NodeType && !(documentRef.body instanceof NodeType)) return null;
  const observer = new Observer((records) => {
    records.forEach((record) => {
      record.addedNodes?.forEach((node) => {
        if (node.nodeType === 1 || node.nodeType === 3) applyDomTranslations(documentRef, translator, node);
      });
      if (record.type === 'attributes' && record.target?.nodeType === 1) {
        const element = record.target;
        const name = record.attributeName;
        if (name && DOM_ATTRIBUTE_NAMES.includes(name)) {
          const current = element.getAttribute(name);
          const next = translator(current || '');
          if (next !== current) element.setAttribute(name, next);
        }
      }
    });
  });
  observer.observe(documentRef.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: DOM_ATTRIBUTE_NAMES,
  });
  return observer;
}

export function createI18n({
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  navigatorRef = globalThis.navigator,
  localStorageRef = globalThis.localStorage,
  sdk = null,
  forcedLanguage = null,
} = {}) {
  const params = new URLSearchParams(windowRef?.location?.search || '');
  const queryLanguage = normalizeLanguage(params.get('lang'));
  const hasExplicitQueryLanguage = Boolean(queryLanguage);
  const lockedLanguage = normalizeLanguage(forcedLanguage);
  const initialLanguage = lockedLanguage
    || queryLanguage
    || normalizeLanguage(getStorageValue(localStorageRef, 'game_lang'))
    || normalizeLanguage(windowRef?.__PLATFORM_LANG)
    || normalizeLanguage(sdk?.getLanguage?.())
    || normalizeLanguage(navigatorRef?.language)
    || 'zh';
  let language = initialLanguage;
  let translator = createTranslator(LANGUAGE_TABLES[language], language);

  if (lockedLanguage && typeof sdk?.setLanguage === 'function') {
    try {
      sdk.setLanguage(lockedLanguage);
    } catch {
      // A package-level language lock must not block the game if SDK sync fails.
    }
  }

  const T = (value, args) => translator(value, args);
  const applyI18n = (root = documentRef) => {
    if (!documentRef) return;
    if (documentRef.documentElement) {
      documentRef.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
    }
    if (typeof documentRef.title === 'string') documentRef.title = T(documentRef.title);
    applyDomTranslations(documentRef, T, root);
  };
  const setLanguage = (nextLanguage, { persist = true, syncSdk = true } = {}) => {
    const normalized = lockedLanguage || normalizeLanguage(nextLanguage) || 'zh';
    language = normalized;
    translator = createTranslator(LANGUAGE_TABLES[language], language);
    const hooks = globalThis[DOM_HOOK_KEY];
    if (hooks) hooks.translate = T;
    if (syncSdk && typeof sdk?.setLanguage === 'function') {
      try {
        sdk.setLanguage(language);
      } catch {
        // Language hints are optional; gameplay must continue if unavailable.
      }
    }
    if (persist && !lockedLanguage) setStorageValue(localStorageRef, 'game_lang', language);
    applyI18n(documentRef);
    return language;
  };
  const reloadAfterLanguageChange = () => {
    const href = windowRef?.location?.href;
    try {
      if (href && windowRef?.location) {
        const nextUrl = new URL(href);
        nextUrl.searchParams.delete('lang');
        windowRef.location.href = nextUrl.toString();
        return;
      }
    } catch {
      // Fall through to the platform's reload method.
    }
    windowRef?.location?.reload?.();
  };
  const toggleLanguage = () => {
    if (lockedLanguage) return language;
    const next = language === 'en' ? 'zh' : 'en';
    setLanguage(next, { persist: true });
    reloadAfterLanguageChange();
  };
  const bindToggle = (button) => {
    if (!button) return;
    const update = () => {
      button.textContent = language === 'en' ? 'ZH' : 'EN';
      button.setAttribute('aria-label', language === 'en' ? 'Switch language to Chinese' : '切换为英文');
    };
    button.addEventListener('click', toggleLanguage);
    update();
  };

  installDomHooks(T);
  installDomObserver(documentRef, T);
  applyI18n(documentRef);

  return {
    T,
    applyI18n,
    bindToggle,
    toggleLanguage,
    getLanguage: () => language,
    hasExplicitQueryLanguage,
    resolveLang: () => language,
    setLanguage,
    installPixiText: (TextClass) => installPixiTextHook(TextClass, T),
  };
}
