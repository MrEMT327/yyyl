import { AIRCRAFTS, AIRCRAFT_MAP } from '../pilots.js';
import { GACHA_ITEM_MAP, GACHA_POOLS, GACHA_COMMON_WEAPONS, GACHA_QUALITIES } from '../gacha-config.js';
import { createMobileUI, renderMobileHeader, renderMobileNav } from './mobile-lobby-chrome.js';
import { renderAircraftBackdrop } from './aircraft-backdrop.js';
import { TRAIT_SYMBOLS } from './weapon-diagrams.js';
import { airframeIdentity, ARSENAL } from '../fixed-parts/airframe-arsenal.js';
import { WEAPON_QUALITIES } from '../fixed-parts/common-weapons.js';

const INK = '#293d50', MUTED = '#bfd0dd';
export const SUPPLY_WEAPONS = GACHA_COMMON_WEAPONS;
export const itemName = item => item.displayName || item.name;
const qualityName = quality => GACHA_QUALITIES[quality]?.name || quality;
const qualityColor = quality => GACHA_QUALITIES[quality]?.color || '#c1d2df';
const typeName = item => item.type === 'aircraft' ? '战姬' : item.type === 'fixed' ? '固定件' : item.isUniversal ? '通用武器' : '专属武器';
const itemCell = item => item?.type === 'weapon' ? 1 + Math.max(0, SUPPLY_WEAPONS.findIndex(w => w.id === item.id)) : ({ wing: 8, engine: 9, tail: 10 }[item?.slot] ?? 0);
function wrap(value, width = 26) {
  const rows = []; let line = '', length = 0;
  for (const char of value) {
    const count = /[\x00-\x7f]/.test(char) ? .52 : 1;
    if (length + count > width) { rows.push(line); line = ''; length = 0; }
    line += char; length += count;
  }
  if (line) rows.push(line); return rows;
}
export function poolItems(poolId) { return [...new Set(Object.values(GACHA_POOLS[poolId].itemIdsByQuality).flat())].map(id => GACHA_ITEM_MAP.get(id)); }
function atlas(ui, art, cell, x, y, size) {
  if (art.get('equipment')) return ui.image(art.get('equipment'), x, y, size, size, { x: cell % 4 / 4, y: Math.floor(cell / 4) / 3, width: .25, height: 1 / 3 });
}
function itemArt(ui, art, item, x, y, width, height = width, avatar = false) {
  if(item.common){const texture=art.get(item.refId),size=Math.min(width,height);if(texture)ui.image(texture,x+(width-size)/2,y+(height-size)/2,size,size);return;}
  if (item.type === 'aircraft') {
    const texture = art.get(avatar ? `${item.refId}:avatar` : item.refId);
    if (texture) return ui.image(texture, x, y, width, height, { x: 0, y: 0, width: 1, height: Math.min(1, height / width * (avatar ? 1 : 2 / 3)) });
  } else return atlas(ui, art, itemCell(item), x + (width - Math.min(width, height)) / 2, y, Math.min(width, height));
}
function button(ui, id, label, x, y, w, h, onPress, { gold = false, disabled = false, size = 21 } = {}) {
  ui.plate(x, y + 4, w, h, gold && !disabled ? '#aa783b' : '#476073', undefined, 8);
  ui.action(id, label, x, y, w, h, onPress, { disabled, fill: disabled ? '#b0c1cd' : gold ? '#ffe3a7' : '#edf1ed', bottomColor: disabled ? '#849dab' : gold ? '#edb762' : '#bed0db', opacity: 1, radius: 8 });
  const icon={'modal-close':'close','detail-back':'exit','catalog-prev':'arrow','catalog-next':'arrow','reveal-skip':'speed'}[id];
  if(icon){if(id==='catalog-prev'){const start=ui.group.children.length;ui.symbol(icon,-14,-14,28,INK);for(const mesh of ui.group.children.slice(start)){mesh.rotation.z=Math.PI;mesh.position.set(x+w/2,y+h/2,0);}}else ui.symbol(icon,x+w/2-14,y+h/2-14,28,INK);}
  else if(label)ui.text(label, x + w / 2, y + h / 2, { size, color: disabled ? '#526b7d' : gold ? '#664325' : INK, weight: 800, align: 'center', maxWidth: w - 18 });
}
function receiptLabel(receipt) {
  if(receipt.item.common)return receipt.isFirst?'首次获得':`专属碎片 +${receipt.fragmentsAdded||0}`;
  return receipt.isFirst ? '首次获得' : receipt.item.type === 'aircraft' ? `共鸣 +${receipt.resonanceAdded || 1}` : `×${receipt.ownedCount}`;
}

export function renderSupplyLayout({ surface, bridge, art, state, actions }) {
  const ui = createMobileUI(surface, bridge, art, actions), { plate, quad, text, image, action, diamond } = ui;
  const poolId = 'aircraft_permanent', aircraft = true;
  const gacha = bridge.getGachaState(), pool = GACHA_POOLS[poolId], counters = gacha.pools[poolId];
  const featured = GACHA_ITEM_MAP.get(aircraft ? `aircraft:${state.previewId}` : state.weaponId);
  renderAircraftBackdrop(surface, art.get('background'));
  plate(0, 0, 600, 128, '#111a29', '#253045', 0, .68);
  text('招募', 25, 155, { size: 32, weight: 900 });
  text('驾驶员招募', 26, 222, { size: 25, weight: 900 });

  if (aircraft) {
    itemArt(ui, art, featured, 115, 264, 466, 417);
    text('常驻',26,304,{size:32,weight:900});
  } else {
    atlas(ui, art, 0, 346, 276, 221);
    itemArt(ui, art, featured, 80, 330, 360, 310);
    text('常驻', 26, 304, { size: 32, weight: 900 });
  }
  action('featured', `查看${itemName(featured)}`, 100, 298, 456, 341, () => actions.detail(featured.id));
  for (let i = 0; i < 22; i++) quad(0, 577 + i * 5, 600, 5, '#122235', i / 21 * .96);
  plate(25, 592, 65, 30, '#dec48d', '#a9874e', 4);
  text(featured.common?'通用':qualityName(featured.quality), 57, 607, { size: 18, color: '#593f23', weight: 900, align: 'center' });
  text(itemName(featured), 25, 649, { size: 33, weight: 900, maxWidth: 522 });
  if(aircraft){const identity=airframeIdentity(featured.refId);ui.symbol(TRAIT_SYMBOLS[identity.trait],27,676,23,MUTED);text(identity.traitName,61,688,{size:18,color:MUTED,maxWidth:330});}
  action('catalog', '查看完整卡池图鉴', 414, 668, 164, 40, () => actions.modal('catalog'));
  ui.symbol('grid',475,677,22,'#ebd2a0');text('图鉴',574,688,{size:17,color:'#ebd2a0',align:'right'});

  const previewStart=Math.floor(Math.max(0,SUPPLY_WEAPONS.findIndex(w=>w.id===featured.id))/7)*7;
  const previewItems = aircraft ? AIRCRAFTS.map(p => GACHA_ITEM_MAP.get(`aircraft:${p.id}`)) : SUPPLY_WEAPONS.slice(previewStart,previewStart+7);
  const cols = aircraft ? 5 : 4, pitch = aircraft ? 112 : 141, w = aircraft ? 104 : 129;
  previewItems.forEach((item, i) => {
    const x = 24 + i % cols * pitch, y = 724 + Math.floor(i / cols) * 86, selected = item.id === featured.id;
    plate(x - 2, y - 2, w + 4, 81, selected ? '#efcb83' : '#52697e', undefined, 6);
    action(`preview-${item.id}`, itemName(item), x, y, w, 77, () => actions.preview(item.id), { fill: '#354c61', bottomColor: '#657b8c', opacity: 1, radius: 5 });
    itemArt(ui, art, item, x + 1, y, w - 2, 58, true);
    plate(x, y + 57, w, 20, selected ? '#dec994' : '#24394d', undefined, 3);
    text(aircraft ? itemName(item).split('·')[0] : itemName(item).split('·').pop(), x + w / 2, y + 67, { size: aircraft ? 16 : 13, color: selected ? '#524026' : '#e8f0f3', weight: 700, align: 'center', maxWidth: w - 8 });
    plate(x + 3, y + 3, 29, 18, '#1b2c3e', undefined, 3, .92);
    text(qualityName(item.quality), x + 17, y + 12, { size: 11, color: qualityColor(item.quality), weight: 800, align: 'center' });
  });
  if (!aircraft) {
    action('fixed-catalog', '查看20种武器图鉴', 447, 810, 129, 77, () => actions.modal('catalog'));
    plate(447, 810, 129, 77, '#273d50', '#426077', 7);
    text('20种武器', 511, 836, { size: 20, weight: 800, align: 'center' });
    text('图鉴  ›', 511, 866, { size: 16, color: MUTED, align: 'center' });
  }

  plate(24, 912, 552, 106, '#eef1eb', '#c1d0da', 9);
  text('保底进度', 41, 935, { size: 20, color: INK, weight: 800 });
  const rules = [...pool.pityRules].sort((a, b) => a.triggerAt - b.triggerAt), cellWidth = 518 / rules.length;
  rules.forEach((rule, i) => {
    const x = 41 + i * cellWidth, count = counters.pity[rule.counter], label = aircraft ? rule.id.toUpperCase() : rule.id === 'gold' ? '金色' : '紫色';
    text(`${label}${rule.id === 'ur' || rule.id === 'gold' ? '' : '+'}`, x, 968, { size: 16, color: '#516b7d', weight: 700 });
    text(`${count} / ${rule.triggerAt}`, x + cellWidth - 15, 991, { size: 17, color: '#856943', weight: 800, align: 'right' });
    plate(x, 984, cellWidth - 93, 6, '#9eafba', undefined, 3);
    if (count) plate(x, 984, Math.max(3, (cellWidth - 93) * Math.min(1, count / rule.triggerAt)), 6, '#b18b4e', undefined, 3);
  });
  [['single', 1, 20], ['ten', 10, 180]].forEach(([id, count, cost], i) => {
    const x = 24 + i * 282, disabled = bridge.profileState.diamonds < cost;
    button(ui, `draw-${id}`, '', x, 1040, 270, 100, () => actions.draw(id), { gold: i === 1, disabled });
    ui.controls.at(-1).label = `招募${count}次，消耗${cost}钻石`;
    ui.symbol('star',x+74,1054,31,disabled?'#526b7d':i?'#654324':INK);
    text(`×${count}`, x + 149, 1070, { size: 30, color: disabled ? '#526b7d' : i ? '#654324' : INK, weight: 900, align: 'center' });
    diamond(x + 102, 1111, 18);
    text(String(cost), x + 121, 1111, { size: 22, color: '#496777', weight: 800 });
  });
  if(bridge.profileState.diamonds<20)text('钻石不足',300,1170,{size:17,color:MUTED,align:'center'});
  renderMobileHeader(ui, bridge, art, actions); renderMobileNav(ui, actions, 'supply');
  if (!state.modal) return null;
  // Modal hit regions replace the underlying controls, including navigation.
  surface.controls.length = 0;
  quad(-600, 0, 1800, 1300, '#0b1727');
  action('modal-shield', '招募弹窗', 0, 0, 600, 1300, () => {});
  if (state.modal === 'reveal') return renderReveal(ui, art, state, actions);
  if (state.modal === 'results') renderResults(ui, art, state, actions);
  else if (state.modal === 'detail') renderDetail(ui, art, bridge, state, actions);
  else renderCatalog(ui, art, gacha, poolId, state, actions);
  return null;
}

function renderReveal(ui, art, state, actions) {
  ui.text('补给',300,270,{size:33,weight:900,align:'center'});
  const rings = [170, 223, 275].map((radius, index) => {
    const points = Array.from({ length: 65 }, (_, i) => [Math.cos(i / 64 * Math.PI * 2) * radius, Math.sin(i / 64 * Math.PI * 2) * radius * .44]);
    const ring = ui.line(points, index === 1 ? '#edc77f' : '#66a3bb', .6, index === 1 ? 4 : 2);
    ring.position.set(300, 740, 0); return ring;
  });
  const pod = atlas(ui, art, 0, 126, 410, 348);
  ui.text(`×${state.receipts.length}`,300,864,{size:30,color:MUTED,align:'center'});
  const flash = ui.quad(0, 0, 600, 1300, '#e7f3ff', 0);
  button(ui, 'reveal-skip', '跳过演出', 209, 1130, 182, 58, actions.revealDone);
  return { rings, pod, flash };
}

function renderResults(ui, art, state, actions) {
  const many = state.receipts.length > 1;
  ui.symbol('check',280,100,40,'#e1c58d');
  ui.text(`×${state.receipts.length}`,300,179,{size:27,color:'#e1c58d',align:'center'});
  if (!many) {
    const receipt = state.receipts[0], item = receipt.item;
    ui.plate(44, 237, 512, 660, '#213b51', '#121f32', 14);
    itemArt(ui, art, item, 62, 251, 476, 420);
    ui.plate(44, 653, 512, 244, '#eff1e9', '#c2d1da', 12);
    ui.text(qualityName(item.quality),70,685,{size:22,color:'#856339',weight:800});
    ui.text(itemName(item), 69, 734, { size: 32, color: INK, weight: 900, maxWidth: 463 });
    ui.text(receiptLabel(receipt), 71, 791, { size: 22, color: '#506e81', weight: 700 });
    if(receipt.pityTriggered)ui.text('保底',71,842,{size:18,color:'#876d48'});
    button(ui, 'result-0', '查看详情', 207, 938, 186, 56, () => actions.receiptDetail(0));
  } else {
    state.receipts.forEach((receipt, i) => {
      const x = 24 + i % 5 * 112, y = 277 + Math.floor(i / 5) * 299, item = receipt.item;
      ui.plate(x - 2, y - 2, 108, 281, qualityColor(receipt.quality), undefined, 8);
      ui.plate(x, y, 104, 277, '#334e64', '#172c40', 7);
      if (item.type === 'aircraft' && art.get(item.refId)) {
        ui.image(art.get(item.refId), x + 2, y + 12, 100, 151, { x: .175, y: .015, width: .65, height: .65 * 151 / 100 * 2 / 3 });
      } else itemArt(ui, art, item, x + 2, y + 12, 100, 151);
      ui.plate(x, y + 160, 104, 117, '#eef0e8', '#b9ccd7', 6);
      ui.text(qualityName(receipt.quality), x + 52, y + 178, { size: 16, color: '#795a33', weight: 900, align: 'center' });
      const lines = (itemName(item).includes('·') ? itemName(item).split('·') : wrap(itemName(item), 5.3)).slice(0, 2);
      lines.forEach((line, row) => ui.text(line, x + 52, y + 203 + row * 22, { size: 16, color: INK, weight: 800, align: 'center', maxWidth: 96 }));
      if(!receipt.isFirst)ui.text(item.common?`碎片 +${receipt.fragmentsAdded||0}`:item.type==='aircraft'?'共鸣 +1':`×${receipt.ownedCount}`,x+52,y+253,{size:14,color:'#526e7d',align:'center'});
      if (receipt.isFirst || receipt.pityTriggered) {
        ui.plate(x + 4, y + 4, 51, 23, '#eed397', undefined, 4);
        ui.text(receipt.pityTriggered ? '保底' : '新', x + 29, y + 16, { size: 14, color: '#62452a', weight: 800, align: 'center' });
      }
      ui.action(`result-${i}`, `查看${itemName(item)}`, x, y, 104, 277, () => actions.receiptDetail(i));
    });
  }
  button(ui, 'results-close', '收下', 113, 1114, 374, 76, actions.closeResults, { gold: true, size: 29 });
}

function renderDetail(ui, art, bridge, state, actions) {
  const item = GACHA_ITEM_MAP.get(state.detailId), inventory = bridge.getGachaState();
  const count = inventory.inventory[item.id]?.count || 0, receipt = state.detailReceipt;
  button(ui, 'detail-back', '‹ 返回', 24, 38, 110, 50, actions.backDetail);
  ui.text(typeName(item), 575, 64, { size: 21, color: MUTED, align: 'right' });
  itemArt(ui, art, item, 44, 137, 512, 486);
  ui.plate(24, 608, 552, 432, '#edf1ec', '#c2d3dd', 12);
  const progress=inventory.weaponProgress?.weapons?.[item.refId];
  ui.text(item.common?(progress?.unlocked?`${WEAPON_QUALITIES[progress.qualityRank]} · Lv.${progress.level} · 专属碎片 ${progress.fragments}`:'首次获得完整武器后解锁'):`${qualityName(item.quality)}  ×${count}`,43,642,{size:19,color:'#86663c',weight:800});
  ui.text(itemName(item), 42, 687, { size: 31, color: INK, weight: 900, maxWidth: 512 });
  if(item.type==='aircraft'){
    const identity=airframeIdentity(item.refId);
    ui.symbol('lock',43,732,27,'#8d7446');ui.text(ARSENAL[identity.weapon].name,86,746,{size:24,color:INK,weight:800});
    ui.symbol(TRAIT_SYMBOLS[identity.trait],43,792,27,'#526b7c');ui.text(identity.traitName,86,806,{size:24,color:INK,weight:800});
    wrap(identity.traitDescription,25).forEach((line,i)=>ui.text(line,43,860+i*31,{size:20,color:'#526b7c',maxWidth:509}));
  }else wrap(item.effects.map(effect=>effect.description).join('；'),25).slice(0,7).forEach((line,i)=>ui.text(line,43,741+i*29,{size:19,color:'#526b7c',maxWidth:509}));
  let note = item.common?'重复获得转为专属碎片；在武器装配页强化与升品。':item.exclusiveAircraftId ? `专属战姬：${AIRCRAFT_MAP.get(item.exclusiveAircraftId).name}` : item.type === 'fixed' ? '重复固定件保留为同名强化材料' : '重复获得战姬提升共鸣';
  if (receipt) note = `${receiptLabel(receipt)}${receipt.pityTriggered ? ' · 保底触发' : ''}`;
  ui.text(note, 43, 1001, { size: 17, color: '#826a46', maxWidth: 509 });
  if (item.type === 'weapon') {
    const equipped = inventory.equipment.primaryWeaponId === item.id, compatible = bridge.isGachaWeaponCompatible(item);
    button(ui, 'equip-weapon', equipped ? '已装备' : !count ? '尚未获得' : compatible ? '装备武器' : '需对应战姬出战', 100, 1106, 400, 78, () => actions.equip(item.id), { gold: true, disabled: equipped || !count || !compatible, size: 26 });
  } else button(ui, 'detail-close', '返回', 168, 1106, 264, 78, actions.backDetail, { gold: true, size: 27 });
}

function renderCatalog(ui, art, gacha, poolId, state, actions) {
  const items = poolItems(poolId), pageCount = Math.ceil(items.length / 8);
  ui.text('卡池图鉴', 24, 77, { size: 33, weight: 900 });
  button(ui, 'modal-close', '关闭 ×', 454, 51, 122, 52, () => actions.modal(null));
  ui.text(`${GACHA_POOLS[poolId].name} · ${items.length} 项`, 27, 148, { size: 20, color: MUTED });
  items.slice(state.catalogPage * 8, state.catalogPage * 8 + 8).forEach((item, i) => {
    const y = 198 + i * 106;
    ui.plate(24, y, 552, 96, '#e9eee9', '#c0d0db', 8);
    itemArt(ui, art, item, 32, y + 5, 86, 86, true);
    ui.text(itemName(item), 130, y + 31, { size: 23, color: INK, weight: 800, maxWidth: 422 });
    const progress=gacha.weaponProgress?.weapons?.[item.refId];
    ui.text(item.common?(progress?.unlocked?`${WEAPON_QUALITIES[progress.qualityRank]} · Lv.${progress.level} · 碎片 ${progress.fragments}`:'尚未解锁'):`${qualityName(item.quality)}  ×${gacha.inventory[item.id]?.count || 0}`,131,y+66,{size:18,color:'#627d8f',maxWidth:405});
    ui.action(`catalog-${item.id}`, `查看${itemName(item)}`, 24, y, 552, 96, () => actions.detail(item.id));
  });
  button(ui, 'catalog-prev', '上一页', 24, 1094, 166, 66, () => actions.catalogStep(-1), { disabled: state.catalogPage === 0 });
  ui.text(`${state.catalogPage + 1} / ${pageCount}`, 300, 1126, { size: 24, weight: 800, align: 'center' });
  button(ui, 'catalog-next', '下一页', 410, 1094, 166, 66, () => actions.catalogStep(1), { disabled: state.catalogPage >= pageCount - 1 });
}
