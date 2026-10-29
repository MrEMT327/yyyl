// Shared fitting catalogue. Only explicitly released items enter the fixed-parts
// trial; the default game and unreleased catalogue entries retain their own rules.
import { ARSENAL, PUBLIC_ARSENAL, AIRFRAME_IDENTITIES } from '../fixed-parts/airframe-arsenal.js';
export const DEMO_ITEMS = [
  { id: 'twin', kind: 'weapon', name: '双联机炮', code: 'W-01', form: '双管 / 紧凑', color: '#efbc78', description: '每1.3秒打出三连点射，三发间隔0.06秒，带少量散布。命中后消失。' },
  { id: 'rail', kind: 'weapon', name: '长钉轨道炮', code: 'W-02', form: '长轨 / 前伸', color: '#85d7ec', description: '每2.5秒发射高速重弹，碰撞后可继续飞行一次；推开轻型敌人，过载提高射速。' },
  { id: 'gatling', kind: 'weapon', name: '蜂巢转轮炮', code: 'W-03', form: '六管 / 转轮', color: '#ed9d74', description: '六根炮管围绕轴心排列，配上圆形供弹鼓，形成厚重的机械挂舱。' },
  { id: 'missile', kind: 'weapon', name: '蜂群导弹舱', code: 'W-04', form: '六联 / 舱体', color: '#edce83', description: '每1.7秒发射一枚直飞火箭，命中爆炸，伤害280；装上聚焦后可追踪，过载加快发射。' },
  { id: 'prism', kind: 'weapon', name: '三棱光束炮', code: 'W-05', form: '三棱 / 晶体', color: '#bba3f6', description: '每秒发射一道光束，贯穿整条线上的敌人。可升级聚束、扫射或折射。' },
  { id: 'plasma', kind: 'weapon', name: '等离子环炮', code: 'W-06', form: '双环 / 中空', color: '#81decd', description: '前后双环线圈与悬浮核心构成中空炮口，改变挂载的实心轮廓。' },
  { id: 'blade', kind: 'weapon', name: '镰翼切割刃', code: 'W-07', form: '侧展 / 刃翼', color: '#a7cef4', description: '折线刀翼向外侧展开。镜像联装时，两侧翼展会一起变宽。' },
  { id: 'tesla', kind: 'weapon', name: '电弧分叉器', code: 'W-08', form: '三叉 / 尖端', color: '#9cb8f9', description: '向前打出短程闪电，方向、长度和分叉随机。可升级跳电、蓄电或留电路。' },
  { id: 'siege', kind: 'weapon', name: '重锤攻城炮', code: 'W-09', form: '重炮 / 护盾', color: '#e99b9b', description: '粗口径炮管、前置盾板和外露后坐机构，把轻型机体变成重装构型。' },
  { id: 'drone', kind: 'weapon', name: '双蜂无人机架', code: 'W-10', form: '双机 / 支架', color: '#a2d8ae', description: '横向支架携带两架小型无人机，增加与主翼不同层次的机翼结构。' },
  { id: 'relay', kind: 'connector', name: '分流连接器', code: 'C-01', form: 'Y 形 / 三端', color: '#70decb', description: '机背上的三向接线座。装入后，实体导线连接到本槽相邻的武器挂点。' },
  { id: 'capacitor', kind: 'connector', name: '储能连接器', code: 'C-02', form: '三柱 / 储能', color: '#e8c57f', description: '本段武器每次命中提供10%过载，逐渐衰减；机炮增加连发，其余武器加快射速，相邻聚焦增强追踪。' },
  { id: 'focus', kind: 'connector', name: '聚焦连接器', code: 'C-03', form: '晶簇 / 透镜', color: '#c5a3ef', description: '本段子弹飞行中持续追向最近敌人；轻弹转弯快，重弹转弯慢。' },
  { id: 'bridge', kind: 'connector', name: '桥接连接器', code: 'C-04', form: '横梁 / 双桥', color: '#86c9ec', description: '把相邻储能、聚焦的效果转给本段武器；不重复叠加。旁边有连接器、本段有武器才生效。' },
  { id: 'coil', kind: 'connector', name: '环路连接器', code: 'C-05', form: '圆环 / 线圈', color: '#a0d8ad', description: '环形线圈包围机背节点，以开放的圆环与周围导线呈现连接结构。' },
];

export const DEMO_SLOTS = [
  { id: 'W1', kind: 'weapon', name: '左前翼', position: [-3.15, .55, -1.65], mirror: 'W2' },
  { id: 'W2', kind: 'weapon', name: '右前翼', position: [3.15, .55, -1.65], mirror: 'W1' },
  { id: 'W3', kind: 'weapon', name: '左外翼', position: [-6.05, .35, .85], mirror: 'W4' },
  { id: 'W4', kind: 'weapon', name: '右外翼', position: [6.05, .35, .85], mirror: 'W3' },
  { id: 'W5', kind: 'weapon', name: '左后翼', position: [-2.65, .65, 3.3], mirror: 'W6' },
  { id: 'W6', kind: 'weapon', name: '右后翼', position: [2.65, .65, 3.3], mirror: 'W5' },
  { id: 'C1', kind: 'connector', name: '机背前段', position: [0, 1.05, -.85], adjacent: ['W1', 'W2', 'C2'] },
  { id: 'C2', kind: 'connector', name: '机背中段', position: [0, .95, 1.3], adjacent: ['W3', 'W4', 'C3'] },
  { id: 'C3', kind: 'connector', name: '机背后段', position: [0, 1, 3.55], adjacent: ['W5', 'W6'] },
];

for (const item of DEMO_ITEMS) if (ARSENAL[item.id]) {
  const a=ARSENAL[item.id]; item.name=a.name; item.color=`#${a.color.toString(16).padStart(6,'0')}`;
  item.description=`${a.stages.join(' → ')}。${a.changes[0]}；终局：${a.changes.at(-1)}。`;
}
export const INNATE_WEAPON_ITEMS = DEMO_ITEMS.filter(item=>item.kind==='weapon'&&Object.values(AIRFRAME_IDENTITIES).some(v=>v.weapon===item.id)).map(item=>{
  item.exclusivePilotId=Object.entries(AIRFRAME_IDENTITIES).find(([,identity])=>identity.weapon===item.id)?.[0];
  return item;
});
export const PUBLIC_WEAPON_ITEMS = Object.entries(PUBLIC_ARSENAL).map(([id,a],i)=>({
  id,kind:'weapon',name:a.name,modelId:a.modelId,sourceId:a.sourceId,code:`A-${String(i+1).padStart(2,'0')}`,form:'通用武器 / 可挂载',
  color:`#${a.color.toString(16).padStart(6,'0')}`,description:a.signature?`${a.signature}。${a.changes.at(-1)}。`:`${a.stages.join(' → ')}。${a.changes[0]}；终局：${a.changes.at(-1)}。`,
}));
export const AIRFRAME_ITEMS = [...INNATE_WEAPON_ITEMS,...PUBLIC_WEAPON_ITEMS];
export const AIRFRAME_SLOTS = DEMO_SLOTS.filter(slot=>slot.kind==='weapon');
export const ITEM_BY_ID = new Map([...DEMO_ITEMS,...PUBLIC_WEAPON_ITEMS].map(item => [item.id, item]));
export const SLOT_BY_ID = new Map(DEMO_SLOTS.map(slot => [slot.id, slot]));

export const DEMO_PRESETS = {
  light: { name: '轻装巡航', placements: { twin: ['W1', 'W2'], relay: ['C1'] } },
  heavy: { name: '重装突击', placements: { siege: ['W1', 'W2'], missile: ['W3', 'W4'], gatling: ['W5', 'W6'], capacitor: ['C1'], bridge: ['C2'], coil: ['C3'] } },
  energy: { name: '光翼构型', placements: { rail: ['W1', 'W2'], blade: ['W3', 'W4'], plasma: ['W5', 'W6'], focus: ['C1'], relay: ['C2'], coil: ['C3'] } },
};

// A mirrored installation is one inventory item with two physical instances.
// Replacing or removing either side returns that entire logical item.
export function equipDemoItem(placements, itemId, slotId, mirror = false) {
  const item = ITEM_BY_ID.get(itemId), slot = SLOT_BY_ID.get(slotId);
  if (!item || !slot || item.kind !== slot.kind) return null;
  const targets = mirror && slot.mirror ? [slotId, slot.mirror] : [slotId];
  const next = {};
  for (const [id, slots] of Object.entries(placements)) {
    if (id !== itemId && !slots.some(target => targets.includes(target))) next[id] = [...slots];
  }
  next[itemId] = targets;
  return next;
}

export function equipAirframeSidearm(placements,itemId,slotId,mirror=false) {
  if(!Object.hasOwn(PUBLIC_ARSENAL,itemId)||!/^W[1-6]$/.test(slotId))return null;
  return equipDemoItem(placements,itemId,slotId,/^W[12]$/.test(slotId)||mirror);
}

export function itemAtSlot(placements, slotId) {
  return ITEM_BY_ID.get(Object.keys(placements).find(id => placements[id].includes(slotId))) || null;
}

export function removeDemoItem(placements, slotId) {
  const item = itemAtSlot(placements, slotId);
  const next = { ...placements };
  if (item) delete next[item.id];
  return next;
}

export function restoreDemoPlacements(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const used = new Set(), next = {};
  for (const [id, slots] of Object.entries(value)) {
    const item = ITEM_BY_ID.get(id);
    if (!item || !Array.isArray(slots) || slots.length < 1 || slots.length > 2) return null;
    if (slots.some(slot => used.has(slot) || SLOT_BY_ID.get(slot)?.kind !== item.kind)) return null;
    if (new Set(slots).size !== slots.length) return null;
    if (slots.length === 2 && SLOT_BY_ID.get(slots[0]).mirror !== slots[1]) return null;
    slots.forEach(slot => used.add(slot)); next[id] = [...slots];
  }
  return next;
}
