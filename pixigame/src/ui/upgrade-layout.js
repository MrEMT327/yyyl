import { createMobileUI, renderMobileHeader, renderMobileNav } from './mobile-lobby-chrome.js';
import { renderAircraftBackdrop } from './aircraft-backdrop.js';

const INK = '#293c4d', MUTED = '#708492';
const percent = value => `+${value.toFixed(1)}%`;
const TRACKS = [
  { id: 'fighter', title: '机体强化', color: '#619fa8', stats: [
    { label: '基础耐久', value: level => String(100 + (level - 1) * 4) },
    { label: '移速加成', value: level => percent((level - 1) * .6) },
  ] },
  { id: 'gear', title: '火控强化', color: '#b58d54', stats: [
    { label: '攻击加成', value: level => percent((level - 1) * 2.2) },
    { label: '射速加成', value: level => percent((level - 1) * .6) },
  ] },
  { id: 'tech', title: '核心强化', color: '#8b7bab', stats: [
    { label: '经验加成', value: level => percent((level - 1) * 1.4) },
    { label: '暴击率加成', value: level => percent((level - 1) * .2) },
  ] },
];

export function upgradeCards(bridge) {
  return TRACKS.map(track => {
    const level = bridge.profileState[`${track.id}Level`], maxed = level >= 50;
    const cost = maxed ? 0 : bridge.profileUpgradeCost(track.id);
    return { ...track, level, maxed, cost, affordable: !maxed && bridge.profileState.coins >= cost,
      stats: track.stats.map(stat => ({ label: stat.label, current: stat.value(level), next: stat.value(Math.min(50, level + 1)) })) };
  });
}

export function renderUpgradeLayout({ surface, bridge, art, fighter, state, actions }) {
  const ui = createMobileUI(surface, bridge, art, actions);
  const { quad, plate, text, image, action, coin, symbol } = ui;
  const entry = bridge.fighterForPilot(bridge.getActivePilot().id);
  const cards = upgradeCards(bridge), total = cards.reduce((sum, card) => sum + card.level, 0);
  renderAircraftBackdrop(surface, art.get('background'));
  plate(0, 0, 600, 128, '#111a29', '#253045', 0, .68);
  text('升级', 25, 156, { size: 32, weight: 900 });
  symbol('link',468,144,24,'#c4d4df');text('全员', 576, 156, { size: 18, color: '#c4d4df', align: 'right' });

  symbol('power',27,202,30,'#ffe0a1');
  text(Math.round(bridge.profilePower()).toLocaleString('en-US'), 24, 261, { size: 46, color: '#ffe0a1', weight: 900, maxWidth: 201 });
  image(fighter.texture, 102, 163, 480, 336).material.toneMapped = true;
  action('fighter-orbit', '拖动旋转战机', 120, 183, 456, 239, () => {});
  for (let i = 0; i < 20; i++) quad(0, 403 + i * 5, 600, 5, '#112137', i / 19 * .83);
  symbol('rotate',27,397,25,'#adc0cf');
  action('fighter-home', '战机视角复位', 459, 397, 117, 32, () => fighter.resetView(), { fill: '#304559', bottomColor: '#203346', opacity: .96, radius: 7 });
  symbol('rotate',505,400,25,'#d9e5ec');
  text(entry.name, 26, 444, { size: 27, weight: 900, maxWidth: 420 });
  text(`${total} / 150`, 576, 447, { size: 16, color: '#b9cedc', align: 'right' });
  if(state.feedback){plate(24,474,552,41,'#263b4e','#1c2d40',7,.94);text(state.feedback,300,495,{size:18,color:'#f4d89d',weight:700,align:'center',maxWidth:520});}

  cards.forEach((card, index) => {
    const x = 24, y = 533 + index * 203;
    plate(x, y + 4, 552, 190, '#0c1a2b', undefined, 10, .62);
    plate(x, y, 552, 188, '#f0f2ec', '#c1cfd7', 10);
    plate(x + 1, y + 16, 4, 47, card.color, undefined, 2);
    plate(x + 13, y + 28, 108, 119, '#dce4e7', '#a4b6c4', 10);
    if (art.get('materials')) image(art.get('materials'), x + 9, y + 27, 116, 116, { x: index / 3, y: 0, width: 1 / 3, height: 1 });
    for (let i = 0; i < 10; i++) plate(x + 17 + i * 10.2, y + 161, 7, 5, i < Math.ceil(card.level / 5) ? card.color : '#9dabb5', undefined, 2);
    text(card.title, 163, y + 29, { size: 26, color: INK, weight: 900 });
    text(`Lv.${card.level} / 50`, 556, y + 30, { size: 20, color: card.maxed ? '#9a7842' : '#536d80', weight: 800, align: 'right' });
    card.stats.forEach((stat, row) => {
      const cy = y + 69 + row * 29;
      symbol([['heart','speed'],['power','cadence'],['xp','crit']][index][row],163,cy-11,22,'#566f82');
      text([['耐久','移速'],['伤害','射速'],['经验','暴击']][index][row],194,cy,{size:16,color:'#566f82'});
      if (card.maxed) text(stat.current, 554, cy, { size: 20, color: INK, weight: 800, align: 'right' });
      else {
        text(stat.current, 428, cy, { size: 19, color: MUTED, align: 'right' });
        text('→', 454, cy, { size: 20, color: '#82949e', align: 'center' });
        text(stat.next, 555, cy, { size: 21, color: '#386e78', weight: 800, align: 'right' });
      }
    });
    if (card.maxed) {
      symbol('check',164,y+134,29,'#8a754e');
    } else {
      coin(175, y + 159, 23);
      text(card.cost.toLocaleString('en-US'), 195, y + 160,
        { size: 24, color: card.affordable ? '#4e5e69' : '#a9614e', weight: 800, maxWidth: 181 });
    }
    plate(409, y + 126, 147, 57, card.affordable ? '#a9793c' : '#7d939f', undefined, 8);
    action(`upgrade-${card.id}`, card.maxed ? '已满级' : card.affordable ? `升级${card.title}` : `${card.title}金币不足`, 409, y + 120, 147, 60,
      () => actions.upgrade(card.id), { disabled: !card.affordable, fill: card.affordable ? '#ffe4a6' : '#c6d2d8',
        bottomColor: card.affordable ? '#edb760' : '#a3b5c0', radius: 8, opacity: 1 });
    text(card.maxed ? '已满级' : card.affordable ? '升级' : '金币不足', 482, y + 150,
      { size: card.affordable ? 28 : 20, color: card.affordable ? '#654423' : '#667d8c', weight: 900, align: 'center' });
  });
  renderMobileHeader(ui, bridge, art, actions);
  renderMobileNav(ui, actions, 'upgrade');
}
