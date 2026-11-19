import { AIRCRAFTS, AIRCRAFT_MAP } from '../pilots.js';
import { createMobileUI, renderMobileHeader, renderMobileNav } from './mobile-lobby-chrome.js';
import { renderAircraftBackdrop } from './aircraft-backdrop.js';
import { TRAIT_LABELS, TRAIT_SYMBOLS } from './weapon-diagrams.js';
import { airframeIdentity, ARSENAL } from '../fixed-parts/airframe-arsenal.js';

const INK = '#27384a';
export function portraitCrop(pilot, aspect = 1) {
  const focus = pilot.portraitFocus || {}, width = 1 / (focus.zoom || 3.4);
  return { x: Math.max(0, Math.min(1 - width, (focus.x ?? 50) / 100 - width / 2)), y: (focus.y ?? 6) / 100, width, height: width * 2 / 3 / aspect };
}

function wrapText(value, length = 27) {
  const lines = []; let line = '', count = 0;
  for (const char of value) {
    const width = /[\x00-\x7f]/.test(char) ? .55 : 1;
    if (count + width > length) { lines.push(line); line = ''; count = 0; }
    line += char; count += width;
  }
  if (line) lines.push(line);
  return lines;
}

export function renderLoadoutLayout({ surface, bridge, art, fighter, state, actions }) {
  const ui = createMobileUI(surface, bridge, art, actions);
  const { text, image, quad, plate, action, symbol } = ui;
  const pilot = AIRCRAFT_MAP.get(state.previewId), collection = bridge.getPilotState();
  const owned = collection.owned.includes(pilot.id), deployed = bridge.getActivePilot().id === pilot.id;
  const level = collection.resonance[pilot.id] || 0;
  const identity=airframeIdentity(pilot.id),primary=ARSENAL[identity.weapon];
  const portrait = art.get(pilot.id), frame = bridge.fighterForPilot(pilot.id);
  const shortButton = (id, label, x, y, width, onPress) => {
    action(id, label, x, y, width, 43, onPress, { fill: '#1b2c40', bottomColor: '#30465b', opacity: .91, radius: 8 });
    const icon={'view-art':'image','fighter-home':'rotate','modal-close':'close'}[id];
    if(icon)symbol(icon,x+width/2-12,y+9,24,'#e0e8eb');
    else text(label, x + width / 2, y + 21, { size: 18, color: '#e0e8eb', weight: 700, align: 'center' });
  };
  renderAircraftBackdrop(surface, art.get('background'));
  plate(0, 0, 600, 128, '#111a29', '#253045', 0, .68);
  quad(0, 128, 600, 646, '#112238', .24);
  text('战姬', 25, 155, { size: 30, weight: 900 });
  symbol('grid',470,143,24,'#c0d0dd');text(`${collection.owned.length} / ${AIRCRAFTS.length}`,577,155,{size:19,color:'#c0d0dd',align:'right'});

  // The character illustration is the page's focal point, while the roster
  // and deployment remain comfortably within the mobile thumb area.
  if (portrait) image(portrait, 40, 166, 520, 514, { x: 0, y: 0, width: 1, height: 514 / 780 });
  else text('立绘加载中…', 300, 393, { size: 22, color: '#c4d1dc', align: 'center' });
  action('hero-art', '查看完整立绘', 80, 213, 435, 362, () => actions.modal('art'));
  for (let i = 0; i < 32; i++) quad(0, 520 + i * 5, 600, 5, '#111f31', (i / 31) ** 1.4 * .96);
  shortButton('view-art', '立绘', 512, 203, 64, () => actions.modal('art'));
  shortButton('preview-prev', '‹', 24, 392, 45, () => actions.step(-1));
  shortButton('preview-next', '›', 531, 392, 45, () => actions.step(1));

  plate(27, 586, 55, 28, '#f3d393', '#bb914f', 4);
  text(pilot.rarity, 54, 600, { size: 17, color: '#563a23', weight: 900, align: 'center' });
  text(pilot.title, 94, 600, { size: 20, color: '#d8e5ed', weight: 700 });
  text(pilot.name, 25, 640, { size: 39, weight: 900, maxWidth: 396 });
  plate(427, 493, 149, 131, '#112235', '#273d50', 9, .84);
  image(fighter.texture, 422, 490, 159, 111).material.toneMapped = true;
  symbol('coverage',487,597,26,'#c6d9e8');
  action('aircraft', '查看座驾', 427, 493, 149, 131, () => actions.modal('aircraft'));
  if (!owned) symbol('lock',546,637,28,'#abbfd1');
  else if (deployed) symbol('check',546,637,28,'#f0d296');

  plate(24, 680, 552, 171, '#eef1eb', '#c7d4dc', 10);
  plate(41, 697, 44, 44, '#d4b372', '#a88348', 8);
  symbol(TRAIT_SYMBOLS[identity.trait],49,705,28,'#564027');
  text(identity.traitName, 99, 719, { size: 26, color: INK, weight: 900 });
  symbol('info',529,705,24,'#60798b');action('ability-info','本机专属主武器与特性',24,680,552,171,()=>actions.modal('ability'));
  symbol('lock',43,758,23,'#506a7c');text(primary.name,80,770,{size:21,color:INK,weight:800});
  text(TRAIT_LABELS[identity.trait],43,811,{size:20,color:'#506a7c',weight:700,maxWidth:492});
  if(owned&&level){symbol('link',445,758,21,'#8b7047');text(`×${level}`,479,770,{size:18,color:'#8b7047'});}

  // All ten characters stay visible. Browsing a locked character is separate
  // from equipping it, so artwork can be inspected without changing the save.
  AIRCRAFTS.forEach((item, index) => {
    const x = 24 + index % 5 * 112, y = 876 + Math.floor(index / 5) * 107;
    const selected = item.id === pilot.id, isOwned = collection.owned.includes(item.id);
    plate(x - 2, y - 2, 108, 99, selected ? '#f1c77a' : '#506578', undefined, 7);
    action(`pilot-${item.id}`, item.name, x, y, 104, 95, () => actions.preview(item.id), {
      fill: selected ? '#c8ad81' : '#34485b', bottomColor: selected ? '#e6d5b3' : '#607588', radius: 6, opacity: 1,
    });
    const avatar = art.get(`${item.id}:avatar`);
    if (avatar || art.get(item.id)) {
      const face = avatar
        ? image(avatar, x + 2, y + 1, 100, 74, { x: 0, y: .18, width: 1, height: .74 })
        : image(art.get(item.id), x + 4, y + 2, 96, 73, portraitCrop(item, 96 / 73));
      face.material.opacity = isOwned ? 1 : .66;
    }
    plate(x + 1, y + 73, 102, 21, selected ? '#cfb77f' : '#23374a', undefined, 4);
    text(item.name.split('·')[0], x + 52, y + 84, { size: 17, color: selected ? '#493720' : '#e6edf2', weight: 800, align: 'center' });
    plate(x + 3, y + 3, 29, 18, '#15263a', undefined, 3, .9);
    text(item.rarity, x + 17, y + 12, { size: 12, color: item.rarity === 'UR' ? '#ffdb8d' : '#dfdfec', weight: 800, align: 'center' });
    if (!isOwned) {
      plate(x + 76, y + 49, 25, 25, '#102135', undefined, 3, .86);
      symbol('lock',x+80,y+52,18,'#cbd8e1');
    } else if (item.id === collection.selected) {
      plate(x + 65, y + 54, 35, 18, '#638178', undefined, 3);
      symbol('check',x+73,y+54,18,'#eff7ec');
    }
  });
  const enabled = !deployed;
  plate(24, 1115, 552, 75, enabled ? '#a56831' : '#475d6c', undefined, 10);
  action(owned ? 'deploy' : 'recruit', owned ? deployed ? '当前出战' : '设为出战' : '前往招募', 24, 1108, 552, 75,
    owned ? actions.deploy : () => actions.tab('supply'), { disabled: !enabled, fill: enabled ? '#ffe2a3' : '#c0d0d8',
      bottomColor: enabled ? '#edb35f' : '#8da5b5', radius: 10, opacity: 1 });
  symbol(deployed?'check':'plane',210,1130,30,enabled?'#5d3b20':'#344d61');
  text(owned ? deployed ? '已出战' : '出战' : '招募', 314, 1146, { size: 34, color: enabled ? '#5d3b20' : '#344d61', weight: 900, align: 'center' });
  renderMobileHeader(ui, bridge, art, actions);
  renderMobileNav(ui, actions, 'loadout');

  if (state.modal) {
    action('modal-backdrop', '关闭预览', 0, 0, 600, 1300, () => actions.modal(null), { fill: '#07101c', opacity: .95 });
    if (state.modal === 'art') {
      if (portrait) image(portrait, -33, 115, 666, 999);
      text(pilot.name, 25, 1177, { size: 29, weight: 800 });
      text(pilot.title, 27, 1216, { size: 20, color: '#abc0d1' });
      shortButton('art-prev', '‹', 23, 620, 49, () => actions.step(-1));
      shortButton('art-next', '›', 528, 620, 49, () => actions.step(1));
    } else if(state.modal==='ability') {
      plate(24,440,552,330,'#eaf0ec','#c2d2dc',14);
      symbol(TRAIT_SYMBOLS[identity.trait],48,475,45,'#6d8b94');
      text(identity.traitName,112,496,{size:29,color:INK,weight:900});
      symbol('lock',48,551,22,'#8e7448');text(primary.name,83,562,{size:22,color:INK,weight:800});
      wrapText(identity.traitDescription,24).forEach((line,i)=>text(line,48,625+i*34,{size:21,color:'#4e6577',maxWidth:504}));
    } else {
      plate(24, 377, 552, 490, '#20364a', '#101e30', 14);
      text(frame.name, 48, 420, { size: 30, weight: 900 });
      image(fighter.texture, 45, 451, 510, 357).material.toneMapped = true;
      action('fighter-orbit', '拖动旋转座驾', 24, 451, 552, 356, () => {});
      symbol('rotate',286,807,28,'#c4d7e5');
      shortButton('fighter-home', '视角复位', 233, 928, 134, () => fighter.resetView());
    }
    shortButton('modal-close', '关闭 ×', 458, state.modal === 'art' ? 38 : 403, 112, () => actions.modal(null));
  }
}
