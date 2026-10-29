import * as T from 'three';
import { createMobileUI, renderMobileHeader, renderMobileNav } from './mobile-lobby-chrome.js';
import { AIRFRAME_SLOTS as DEMO_SLOTS, PUBLIC_WEAPON_ITEMS as RELEASED_FIXED_ITEMS, SLOT_BY_ID, itemAtSlot } from '../slot-demo/catalog.js';
import { airframeIdentity, ARSENAL } from '../fixed-parts/airframe-arsenal.js';
import { FITTING_AIRCRAFT } from '../slot-demo/aircraft-slots.js';
import { fighterForPilot } from '../three/aircraft/fighter-packages.js';
import { renderAircraftBackdrop } from './aircraft-backdrop.js';
import { compileFixedLoadout } from '../fixed-parts/runtime.js';
import { fixedPartName } from '../fixed-parts/parts.js';
import { drawWeaponDiagram, TRAIT_LABELS, TRAIT_SYMBOLS } from './weapon-diagrams.js';
import { WEAPON_QUALITIES, QUALITY_COLORS } from '../fixed-parts/common-weapons.js';
import { QUALITY_FRAGMENT_COSTS } from '../fixed-parts/common-weapon-progress.js';
import { weaponLevelCap, commonWeaponUpgradeCost } from '../fixed-parts/weapon-progression-config.js';

export const ASSEMBLY_PREVIEW = { x: 0, y: 167, width: 600, height: 425 };
const INK = '#29394a', GOLD = '#ffd283';
function wrapRule(value,maxWidth=25){
  const lines=[];let line='',width=0;
  for(const token of value.match(/[\dA-Za-z.%～+]+|./gu)||[]){const n=/^[\x00-\x7f]+$/.test(token)?token.length*.52:token.length;
    if(width+n>maxWidth&&!/^[，。；、：]$/.test(token)){lines.push(line);line='';width=0;}line+=token;width+=n;}
  if(line)lines.push(line);return lines;
}

export function renderAssemblyLayout({ surface, bridge, art, scene, state, actions }) {
  const ui = createMobileUI(surface, bridge, art, actions);
  const { text, quad, image, plate, action, polygon, symbol, rank } = ui;
  const thumbnail=(id,x,y,w,h)=>{const square=ARSENAL[id]?.common,size=Math.min(w,h);return image(scene.thumbnails.get(id),square?x+(w-size)/2:x,square?y+(h-size)/2:y,square?size:w,square?size:h);};
  const entry = fighterForPilot(state.pilotId), selected = SLOT_BY_ID.get(state.selectedSlot);
  const installed = state.modal==='detail'&&state.detailId?RELEASED_FIXED_ITEMS.find(i=>i.id===state.detailId):itemAtSlot(state.placements, state.selectedSlot), markers = new Map();
  const collection=bridge.getGachaState().weaponProgress;
  const identity=airframeIdentity(state.pilotId), main=ARSENAL[Object.keys(state.placements).find(id=>state.placements[id].includes('W1'))||identity.weapon];
  const filtered = RELEASED_FIXED_ITEMS.filter(item => state.filter === 'all' || item.kind === state.filter);
  const pageCount = Math.ceil(filtered.length / 6), page = Math.min(state.page, pageCount - 1);
  const labelButton = (id, label, x, y, w, h, press, { gold = false, light = false, disabled = false, size = 19 } = {}) => {
    action(id, label, x, y, w, h, press, { disabled, fill: gold ? '#ffe4aa' : light ? '#f0f3f1' : '#26384c',
      bottomColor: gold ? '#edb45f' : light ? '#c5d0d8' : '#1b2c40', radius: 7, opacity: disabled ? .42 : .96 });
    const icon={'camera-top':'top','camera-home':'rotate',sockets:'grid',compare:'plane','modal-close':'close'}[id];
    if(icon){symbol(icon,x+w/2-12,y+h/2-12,24,gold?'#684321':light?INK:'#e1e9ee');if(id==='sockets'&&state.showSockets)symbol('check',x+w-23,y+5,15,'#e9c885');}
    else text(label, x + w / 2, y + h / 2, { size, color: gold ? '#684321' : light ? INK : '#e1e9ee', weight: 700, align: 'center' });
  };
  renderAircraftBackdrop(surface, art.get('background'), { studio: true });
  plate(0, 0, 600, 128, '#111a29', '#253045', 0, .68);
  renderMobileHeader(ui, bridge, art, actions);
  text('武器装配', 24, 155, { size: 32, weight: 900 });
  text(entry.name, 26, 192, { size: 21, color: '#c5d5e0', weight: 700, maxWidth: 365 });
  labelButton('aircraft-picker', '机型  ›', 429, 146, 147, 51, () => actions.modal('aircraft'), { light: true });

  image(scene.texture, ASSEMBLY_PREVIEW.x, ASSEMBLY_PREVIEW.y, ASSEMBLY_PREVIEW.width, ASSEMBLY_PREVIEW.height).material.toneMapped = true;
  action('preview-orbit', '拖动旋转，双指缩放战机', 0, 214, 600, 379, () => {});
  for (const slot of DEMO_SLOTS) {
    const active = selected.id === slot.id, occupied = Boolean(itemAtSlot(state.placements, slot.id));
    const start = surface.group.children.length;
    const control = action(`marker-${slot.id}`, slot.name, -21, -18, 42, 36, () => actions.slot(slot.id));
    if (active) {
      plate(-20, -16, 40, 32, '#ffe0a0', '#efb963', 16, .97);
      text(slot.id, 0, 0, { size: 16, color: '#553b22', weight: 800, align: 'center' });
    } else {
      plate(-19, -15, 38, 30, occupied ? '#254955' : '#102d4b', '#83d8ed', 5, .96);
      text(slot.id, 0, 0, { size: 15, color: occupied ? GOLD : '#b4efff', weight: 800, align: 'center' });
    }
    const group = new T.Object3D(); group.name = `assembly-marker-${slot.id}`;
    for (const child of surface.group.children.slice(start)) group.add(child);
    surface.group.add(group); markers.set(slot.id, { group, control });
  }
  labelButton('camera-in', '+', 530, 233, 46, 44, () => actions.view('in'), { size: 28 });
  labelButton('camera-out', '−', 530, 285, 46, 44, () => actions.view('out'), { size: 28 });
  labelButton('camera-top', '俯视', 514, 337, 62, 44, () => actions.view('top'), { size: 17 });
  labelButton('camera-home', '复位', 514, 389, 62, 44, () => actions.view('home'), { size: 17 });
  labelButton('sockets', state.showSockets ? '挂点 开' : '挂点 关', 24, 545, 108, 43, actions.sockets, { size: 17 });
  labelButton('compare', state.comparing ? '返回装配' : '查看裸机', 141, 545, 116, 43, actions.compare, { size: 17 });
  labelButton('presets', '速装', 270, 545, 306, 43, () => actions.modal('presets'), { gold: true });
  symbol('lock',26,214,21,'#b4efff');text(main.name,56,226,{size:19,color:'#b4efff',weight:700});
  plate(24, 463, 552, 73, '#263b49', '#172937', 9, .96);
  symbol(TRAIT_SYMBOLS[identity.trait], 36, 475, 27, '#ffe0a0');
  text(identity.traitName, 74, 487, { size: 20, color: '#ffe0a0', weight: 800, maxWidth: 355 });
  text('全武器', 563, 487, { size: 14, color: '#cce8ee', align: 'right' });
  text(TRAIT_LABELS[identity.trait], 37, 518, { size: 18, color: '#eef5f7', maxWidth: 526 });
  symbol('lock',26,601,22,'#e5c384');text('主武器',57,613,{size:18,color:'#e5c384'});
  symbol('grid',402,601,22,'#d7e1e8');text(`${Math.max(0,Object.values(state.placements).flat().length-2)} / 4`,575,613,{size:21,weight:800,align:'right'});

  DEMO_SLOTS.forEach((slot, i) => {
    const x = 24 + i * 93, active = selected.id === slot.id, item = itemAtSlot(state.placements, slot.id);
    action(`slot-${slot.id}`, slot.name, x, 638, 85, 56, () => actions.slot(slot.id), {
      fill: active ? '#f8e3b4' : '#344559', bottomColor: active ? '#c9ac74' : '#243346', radius: 6, opacity: 1,
    });
    if(item)thumbnail(item.id,x+12,638,61,39).material.toneMapped=true;
    else symbol('up',x+32,643,20,'#889eae');
    text(slot.id,x+42.5,683,{size:13,weight:800,color:active?'#533c24':'#d7e1e8',align:'center'});
    if(i<2)text('主',x+67,681,{size:13,color:active?'#755124':GOLD});
  });

  // A compact equipment drawer, with large model thumbnails and six items per
  // page. Pagination keeps the entire screen reachable on short mobile screens.
  plate(0, 716, 600, 482, '#e9eeed', '#b9c7d1', 15);
  quad(0, 742, 600, 456, '#d3dde1', .35);
  text('通用武器', 26, 747, { size: 27, color: INK, weight: 900 });
  symbol('check',550,737,23,'#6a817f');
  plate(423, 783, 39, 22, state.mirror ? '#b38d50' : '#8798a3', undefined, 11);
  plate(state.mirror ? 443 : 426, 786, 16, 16, '#fff8e6', undefined, 8);
  text('左右同装', 473, 795, { size: 19, color: '#536a7b', weight: 700 });
  action('mirror', '左右同装', 413, 775, 165, 40, actions.mirror);

  filtered.slice(page * 6, page * 6 + 6).forEach((item, i) => {
    const x = 24 + i % 3 * 188, y = 830 + Math.floor(i / 3) * 127, equipped = Boolean(state.placements[item.id]);
    const selectedItem = installed?.id === item.id;
    const owned=collection.weapons[item.id];
    plate(x - 2, y - 2, 180, 119, selectedItem ? '#bf9250' : '#aebdc8', undefined, 8);
    action(`item-${item.id}`, item.name, x, y, 176, 115, () => actions.equip(item.id), {
      fill: selectedItem ? '#fff4d9' : '#f2f4f0', bottomColor: selectedItem ? '#ddc398' : '#c7d3dc', radius: 7, opacity: 1,
    });
    thumbnail(item.id, x + 11, y + 1, 154, 99).material.toneMapped = true;
    plate(x + 1, y + 89, 174, 25, '#26394a', '#1c2d3f', 5, .95);
    text(item.name, x + 88, y + 102, { size: 18, color: '#f2f2e9', weight: 700, align: 'center', maxWidth: 164 });
    if (equipped) {
      plate(x + 5, y + 5, 24, 24, '#617d79', undefined, 4);
      symbol('check',x+8,y+8,18,'#edf7ef');
    }
    if(!owned?.unlocked){symbol('lock',x+144,y+9,20,'#b0becc');text('未解锁',x+12,y+20,{size:14,color:'#587086'});}
    else text(`${WEAPON_QUALITIES[owned.qualityRank]} · Lv.${owned.level}`,x+12,y+20,{size:13,color:'#476274',weight:800});
  });
  if (pageCount > 1) {
    labelButton('page-prev', '‹', 24, 1092, 64, 37, () => actions.page(page - 1), { light: true, disabled: page === 0, size: 28 });
    labelButton('page-next', '›', 512, 1092, 64, 37, () => actions.page(page + 1), { light: true, disabled: page === pageCount - 1, size: 28 });
    for (let i = 0; i < pageCount; i++) {
      const width = i === page ? 24 : 8;
      plate(300 + (i - (pageCount - 1) / 2) * 32 - width / 2, 1105, width, 8, i === page ? '#a98148' : '#8fa1ad', undefined, 4);
    }
  }
  text(`${selected.id}  ${installed?.name || '空槽'}`,25,1154,{size:20,color:INK,weight:700,maxWidth:353});
  if(installed)symbol('info',386,1142,23,'#607988');
  action('item-detail', '查看固定件详情', 23, 1134, 406, 45, () => installed && actions.modal('detail'), { disabled: !installed });
  labelButton('remove', '卸下', 453, 1136, 123, 44, actions.remove, { light: true, disabled: !installed });
  renderMobileNav(ui, actions, 'assembly');

  if (state.modal) {
    // Modal hit shield is created after the navigation and markers.
    action('modal-backdrop', '关闭弹层', 0, 0, 600, 1300, () => actions.modal(null), { fill: '#07101c', opacity: .78 });
    const top = state.modal === 'aircraft' ? 257 : state.modal === 'presets' ? 270 : 220;
    const height = state.modal === 'aircraft' ? 762 : state.modal === 'presets' ? 750 : 900;
    action('modal-panel', '装配选项', 23, top, 554, height, () => {}, { fill: '#e9eeeb', bottomColor: '#b7c7d3', radius: 15, opacity: 1 });
    text(state.modal === 'aircraft' ? '试装机型' : state.modal === 'presets' ? '速装' : installed?.name || '固定件', 48, top + 43, { size: 28, color: INK, weight: 900 });
    labelButton('modal-close', '×', 510, top + 19, 43, 44, () => actions.modal(null), { light: true, size: 28 });
    if (state.modal === 'aircraft') {
      text('仅试装',49,top+84,{size:17,color:'#63798b'});
      FITTING_AIRCRAFT.forEach((aircraft, i) => {
        const x = 47 + i % 2 * 260, y = top + 121 + Math.floor(i / 2) * 110, active = aircraft.pilotId === state.pilotId;
        action(`aircraft-${aircraft.pilotId}`,aircraft.name,x,y,246,93,()=>actions.aircraft(aircraft.pilotId),{fill:active?'#f0d69d':'#e4eeef',radius:7,opacity:1});
        const identity=airframeIdentity(aircraft.pilotId);
        thumbnail(identity.weapon,x+3,y+11,96,62).material.toneMapped=true;
        text(aircraft.name,x+101,y+34,{size:19,color:INK,weight:800,maxWidth:136});
        symbol('lock',x+103,y+60,17,'#8e7246');symbol(TRAIT_SYMBOLS[identity.trait],x+136,y+56,23,'#597888');
        if(active)symbol('check',x+210,y+59,23,'#8e7246');
      });
    } else if (state.modal === 'presets') {
      [['energy',['aux_laser','aux_scatter'],'光栅',actions.energyPreset],['prism',['aux_laser'],'激光',actions.prismPreset],['tesla',['aux_scatter'],'散射',actions.teslaPreset],['missile',['aux_rocket'],'火箭',actions.missilePreset],['full',['aux_rocket','aux_rail'],'重火力',actions.fullPreset],['rail',['aux_rail'],'磁轨',actions.railPreset],['basic',['aux_cannon'],'机炮',actions.fixedPreset],['mixed',['aux_cannon','aux_rocket'],'混合',actions.mixedPreset]].forEach(([id,ids,label,press],i)=>{
        const y=top+85+i*65;action(`preset-fixed-${id}`,label,47,y,506,55,press,{fill:i?'#e4eeef':'#f4d69c',opacity:1,radius:7});
        ids.forEach((weapon,j)=>thumbnail(weapon,62+j*90,y-1,89,57).material.toneMapped=true);
        text(label,333,y+28,{size:22,color:INK,weight:800});symbol('arrow',513,y+15,23,'#627d89');
      });
      labelButton('clear', '清空副武器', 47, top + 635, 506, 49, actions.clear, { light: true });
    } else if (installed&&ARSENAL[installed.id]?.common) {
      const a=ARSENAL[installed.id],owned=collection.weapons[installed.id];
      thumbnail(installed.id,210,top+55,180,115).material.toneMapped=true;
      text(owned.unlocked?`${WEAPON_QUALITIES[owned.qualityRank]} · Lv.${owned.level}`:'获得完整武器后解锁',300,top+194,{size:23,color:INK,weight:800,align:'center'});
      text(`专属碎片 ${owned.fragments}  ·  通用碎片 ${collection.universalFragments}`,300,top+228,{size:17,color:'#63798b',align:'center'});
      a.qualityRules.forEach((rule,i)=>{
        const yy=top+270+i*74,hex=`#${QUALITY_COLORS[i].toString(16)}`;
        plate(46,yy-12,63,27,i<=owned.qualityRank&&owned.unlocked?'#294055':'#65788a',undefined,5);
        text(WEAPON_QUALITIES[i],77,yy+1,{size:16,color:hex,weight:800,align:'center'});
        wrapRule(i>=2?`局内选卡 · ${rule}`:i===1?'升星 · 基础伤害加成':rule)
          .forEach((line,j)=>text(line,122,yy+j*20,{size:16,color:INK,maxWidth:422}));
      });
      labelButton('weapon-level',owned.level>=weaponLevelCap(owned.qualityRank)?(owned.qualityRank>=5?'已满级':'请先提升品级'):`强化 · ${commonWeaponUpgradeCost(owned.level,owned.qualityRank)?.coins ?? 0} 金币`,47,top+752,244,51,()=>actions.upgrade('level'),{gold:true,disabled:!owned.unlocked||owned.level>=weaponLevelCap(owned.qualityRank),size:18});
      labelButton('weapon-quality',owned.qualityRank>=5?'神话品质':`升星 · ${QUALITY_FRAGMENT_COSTS[owned.qualityRank]} 碎片`,306,top+752,244,51,()=>actions.upgrade('quality'),{gold:true,disabled:!owned.unlocked||owned.qualityRank>=5,size:18});
    } else if (installed) {
      thumbnail(installed.id, 169, top + 58, 262, 168).material.toneMapped = true;
      const weapon=ARSENAL[installed.id];
      if(weapon){
        plate(47,top+238,506,150,'#12273a','#20394b',9);
        drawWeaponDiagram(ui,installed.id,1,58,top+248,186,124);symbol('arrow',282,top+302,32,'#b4cddc');
        drawWeaponDiagram(ui,installed.id,6,350,top+248,186,124);
        text('Lv.1',149,top+409,{size:18,color:'#576d7c',align:'center'});text(`Lv.6 · ${weapon.stages[5]}`,442,top+409,{size:18,color:INK,weight:800,align:'center'});
        rank(6,229,top+443,{width:144,color:'#a78246'});
      }
      if(installed.kind==='connector'){
        let connection;
        try{connection=compileFixedLoadout(state.pilotId,{version:2,aircraft:{[state.pilotId]:state.placements}}).connectors.find(c=>c.itemId===installed.id);}catch{/* Empty fitting is valid in the editor. */}
        const targets=connection?.beneficiaries.map(id=>fixedPartName(id.split('/')[1])).join('、');
        text(connection?.active?`生效：${targets}`:connection?.inactiveReason||'安装武器后生效',50,top+408,{size:19,color:connection?.active?'#24795e':'#ad623c',weight:700,maxWidth:501});
        if(installed.id==='bridge'&&connection?.active)text(`转接：${connection.sources.map(id=>fixedPartName(id.split('/')[1])).join('、')}`,50,top+442,{size:18,color:'#576d7c',maxWidth:501});
      }
    }
  }
  return markers;
}
