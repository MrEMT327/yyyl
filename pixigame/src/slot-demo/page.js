import { DEMO_ITEMS, DEMO_SLOTS, DEMO_PRESETS, SLOT_BY_ID, itemAtSlot, equipDemoItem, removeDemoItem, restoreDemoPlacements } from './catalog.js';
import { createSlotDemoViewer } from './viewer.js';
import { FITTING_AIRCRAFT, fittingPilotId, restoreAircraftFittings } from './aircraft-slots.js';
import panelMarkup from './panel.html?raw';
import './style.css';

export function createAssemblyShowroom({ host, bridge }) {
  const root = document.createElement('section');
  root.id = 'slot-demo'; root.className = 'assembly-slot-showroom';
  root.setAttribute('aria-label', '固定件槽位装配');
  root.innerHTML = panelMarkup; root.hidden = true; host.append(root);
  const $ = selector => root.querySelector(selector);
  const cards = new Map(), markers = new Map(), slotButtons = new Map();
  const STORAGE_KEY = 'thunder-slot-demo-v1';
  let selectedSlot = 'W1', filter = 'all', mirror = true, comparing = false, viewer, toastTimer;
  let visible = false, destroyed = false;
  let activePilotId = fittingPilotId(bridge?.getActivePilot?.().id), pilotId = activePilotId;
  let aircraftFittings = {};
  try { aircraftFittings = restoreAircraftFittings(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { /* Storage can be unavailable in embedded/private views. */ }
  let placements = aircraftFittings[pilotId] || {};
  function node(tag, className, text, parent) { const element = document.createElement(tag); element.className = className; if (text != null) element.textContent = text; parent?.append(element); return element; }
  function announce(text) { const toast = $('#demo-toast'); toast.textContent = text; toast.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('visible'), 2300); }
  function save() {
    aircraftFittings[pilotId] = placements;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, aircraft: aircraftFittings })); } catch { /* Fitting remains usable in memory. */ }
  }
  function compare(value) { comparing = value; viewer?.setCompare(value); $('#compare-airframe').setAttribute('aria-pressed', String(value)); $('#compare-airframe').textContent = value ? '返回装配' : '对比裸机'; }
  function selectSlot(id) { selectedSlot = id; if (filter !== 'all' && filter !== SLOT_BY_ID.get(id).kind) filter = SLOT_BY_ID.get(id).kind; viewer?.focus(id); render(); }
  function commit(next, message) { placements = next; compare(false); viewer?.apply(placements); save(); render(); announce(message); }
  function selectAircraft(id) {
    const next = fittingPilotId(id);
    if (next === pilotId) return;
    aircraftFittings[pilotId] = placements;
    pilotId = next; placements = aircraftFittings[pilotId] || {};
    viewer?.setPilot(pilotId, placements); compare(false); render();
  }
  function syncActivePilot() {
    const next = fittingPilotId(bridge?.getActivePilot?.().id);
    if (next !== activePilotId) { activePilotId = next; selectAircraft(next); }
  }
  for (const aircraft of FITTING_AIRCRAFT) {
    const option = node('option', '', aircraft.name, $('#demo-aircraft-select')); option.value = aircraft.pilotId;
  }
  $('#demo-aircraft-select').onchange = event => selectAircraft(event.target.value);
  function equip(itemId, target = selectedSlot) {
    const result = equipDemoItem(placements, itemId, target, mirror);
    if (!result) { announce('武器装入 W 槽，连接器装入 C 槽。先选择对应挂点。'); return; }
    selectedSlot = target;
    commit(result, `${itemAtSlot(result, target).name} · ${result[itemId].length === 2 ? '左右联装' : `装入 ${target}`}`);
  }

  for (const slot of DEMO_SLOTS) {
    const marker = node('button', `demo-marker ${slot.kind}`, slot.id, $('#demo-slot-markers'));
    marker.type = 'button'; marker.dataset.slot = slot.id; marker.onclick = () => selectSlot(slot.id); markers.set(slot.id, marker);
    const button = node('button', `demo-slot ${slot.kind}`, null, $('#demo-slotbar'));
    button.type = 'button'; button.dataset.slot = slot.id; button.onclick = () => selectSlot(slot.id);
    node('span', '', slot.id, button); const value = node('small', '', '空槽', button); slotButtons.set(slot.id, { button, value });
    for (const target of [marker, button]) {
      target.ondragover = event => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'; target.classList.add('drag-over'); };
      target.ondragleave = () => target.classList.remove('drag-over');
      target.ondrop = event => { event.preventDefault(); target.classList.remove('drag-over'); const id = event.dataTransfer.getData('text/plain'); if (DEMO_ITEMS.some(item => item.id === id)) equip(id, slot.id); };
    }
  }
  for (const [id, preset] of Object.entries(DEMO_PRESETS)) {
    const button = node('button', '', preset.name, $('#demo-presets')); button.type = 'button'; button.dataset.preset = id;
    button.onclick = () => commit(restoreDemoPlacements(preset.placements), `${preset.name} · 已试装`);
  }
  for (const item of DEMO_ITEMS) {
    const button = node('button', `demo-card ${item.kind}`, null, $('#demo-inventory')); button.type = 'button'; button.draggable = true;
    button.style.setProperty('--item-color', item.color); button.dataset.itemId = item.id;
    const code = node('span', 'demo-card-code', item.code, button), marker = node('span', 'demo-card-installed', '', button);
    const art = node('img', 'demo-card-art', null, button); art.alt = ''; art.draggable = false;
    node('strong', '', item.name, button); node('small', '', item.form, button);
    button.onclick = () => {
      const slot = SLOT_BY_ID.get(selectedSlot);
      if (slot.kind !== item.kind) {
        const target = DEMO_SLOTS.find(value => value.kind === item.kind && !itemAtSlot(placements, value.id)) || DEMO_SLOTS.find(value => value.kind === item.kind);
        selectedSlot = target.id;
      }
      equip(item.id);
    };
    button.ondragstart = event => { event.dataTransfer.setData('text/plain', item.id); event.dataTransfer.effectAllowed = 'move'; root.dataset.dragKind = item.kind; };
    button.ondragend = () => { delete root.dataset.dragKind; root.querySelectorAll('.drag-over').forEach(value => value.classList.remove('drag-over')); };
    cards.set(item.id, { button, marker, art, code });
  }

  function render() {
    const aircraft = FITTING_AIRCRAFT.find(value => value.pilotId === pilotId);
    root.dataset.pilotId = pilotId; root.dataset.fighterId = aircraft.slug;
    $('#demo-aircraft-code').textContent = `${aircraft.slug.toUpperCase()} / ${pilotId === activePilotId ? '当前出战' : '外观试装'}`;
    $('#demo-aircraft-name').textContent = aircraft.name.replace('战机', '');
    $('#demo-aircraft-select').value = pilotId;
    const slot = SLOT_BY_ID.get(selectedSlot), current = itemAtSlot(placements, selectedSlot);
    root.dataset.selectedSlot = selectedSlot; root.dataset.equipped = JSON.stringify(placements);
    for (const value of DEMO_SLOTS) {
      const item = itemAtSlot(placements, value.id), selected = value.id === selectedSlot;
      const linked = SLOT_BY_ID.get(selectedSlot).adjacent?.includes(value.id) || (mirror && slot.mirror === value.id);
      for (const button of [markers.get(value.id), slotButtons.get(value.id).button]) {
        button.setAttribute('aria-pressed', String(selected)); button.setAttribute('aria-label', `${value.id} ${value.name}：${item?.name || '空槽位'}`);
        button.classList.toggle('occupied', Boolean(item)); button.classList.toggle('linked', Boolean(linked));
        button.style.setProperty('--item-color', item?.color || (value.kind === 'weapon' ? '#e4bc81' : '#75d7c6'));
      }
      slotButtons.get(value.id).value.textContent = item ? item.name.replace('连接器', '').slice(0, 4) : value.name;
    }
    for (const item of DEMO_ITEMS) {
      const { button, marker } = cards.get(item.id), installed = placements[item.id];
      button.hidden = filter !== 'all' && filter !== item.kind;
      button.setAttribute('aria-label', `${item.name}，${installed ? `已装于 ${installed.join('、')}，点击移动到当前槽位` : '点击装配'}`);
      button.setAttribute('aria-pressed', String(current?.id === item.id)); button.classList.toggle('installed', Boolean(installed));
      marker.textContent = installed ? installed.join(' · ') : ''; marker.hidden = !installed;
    }
    root.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
    root.querySelectorAll('[data-preset]').forEach(button => {
      const preset = DEMO_PRESETS[button.dataset.preset].placements;
      button.setAttribute('aria-pressed', String(Object.keys(preset).length === Object.keys(placements).length && Object.entries(preset).every(([id, slots]) => slots.length === placements[id]?.length && slots.every(slotId => placements[id].includes(slotId)))));
    });
    const physical = Object.values(placements).flat().length, logical = Object.keys(placements).length;
    $('#mounted-count').replaceChildren(document.createTextNode(String(physical).padStart(2, '0') + ' '), node('span', '', '/ 09'));
    $('#inventory-summary').textContent = `背包余 ${15 - logical} 件 · 已装 ${logical} 件 / ${physical} 挂点`;
    $('#detail-kicker').textContent = `${selectedSlot} / ${slot.name}${placements[current?.id]?.length === 2 ? ' · 镜像共用一件' : ''}`;
    $('#detail-title').textContent = current?.name || `${slot.kind === 'weapon' ? '武器' : '连接器'}空槽位`;
    $('#detail-description').textContent = current?.description || (slot.kind === 'weapon' ? '点击背包武器即可装入。开启左右联装时，一件武器同时占用一对镜像挂点。' : `点击背包连接器即可装入。此槽连接 ${slot.adjacent.join('、')}，显示机背模块与导线。`);
    $('#remove-item').disabled = !current; $('#clear-loadout').disabled = !logical;
    $('#mirror-fitting').disabled = slot.kind === 'connector'; viewer?.focus(selectedSlot);
    if (visible) slotButtons.get(selectedSlot).button.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  root.querySelectorAll('[data-filter]').forEach(button => { button.onclick = () => { filter = button.dataset.filter; if (filter !== 'all' && SLOT_BY_ID.get(selectedSlot).kind !== filter) selectedSlot = DEMO_SLOTS.find(slot => slot.kind === filter).id; render(); }; });
  $('#mirror-fitting').onchange = event => { mirror = event.target.checked; render(); };
  $('#remove-item').onclick = () => commit(removeDemoItem(placements, selectedSlot), '模块已返回背包');
  $('#clear-loadout').onclick = () => commit({}, '全部模块已返回背包');
  $('#compare-airframe').onclick = () => compare(!comparing);
  $('#toggle-sockets').onclick = event => { const shown = event.currentTarget.getAttribute('aria-pressed') !== 'true'; event.currentTarget.setAttribute('aria-pressed', String(shown)); viewer?.setSockets(shown); };
  root.querySelectorAll('[data-view]').forEach(button => { button.onclick = () => viewer?.view(button.dataset.view); });
  root.addEventListener('keydown', event => {
    if (!viewer || /INPUT|SELECT|TEXTAREA/.test(event.target.tagName)) return;
    if (event.key.toLowerCase() === 'r') viewer.view('home');
    if (event.key === 'Escape') compare(false);
  });
  render();
  const ready = (async () => {
  try {
    viewer = await createSlotDemoViewer({ viewport: $('#demo-viewport'), pilotId, onProject(id, x, y, shown) {
      const marker = markers.get(id); marker.style.left = `${x}px`; marker.style.top = `${y}px`; marker.hidden = !shown;
    } });
    if (destroyed) { viewer.destroy(); return; }
    for (const item of DEMO_ITEMS) cards.get(item.id).art.src = viewer.thumbnails.get(item.id);
    viewer.setPilot(pilotId, placements); viewer.setCompare(comparing);
    viewer.setSockets($('#toggle-sockets').getAttribute('aria-pressed') === 'true');
    viewer.setVisible(visible); render(); $('#demo-loading').hidden = true; root.dataset.ready = 'true';
  } catch (error) {
    if (destroyed) return;
    $('#demo-loading').replaceChildren(node('strong', '', '装配台暂时未能载入'), node('span', '', error.message));
    const retry = node('button', '', '重新载入', $('#demo-loading')); retry.onclick = () => location.reload(); console.error('[slot-demo]', error);
  }
  })();
  return {
    root, ready, refresh() { syncActivePilot(); render(); },
    setVisible(next) {
      if (!destroyed && next) syncActivePilot();
      if (destroyed || visible === next) return;
      visible = next; root.hidden = !next; viewer?.setVisible(next);
      if (next) render();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; viewer?.destroy(); clearTimeout(toastTimer); root.remove();
    },
  };
}
