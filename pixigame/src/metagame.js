const STORAGE_KEY = 'thunder-arsenal-v1';
const GRID_WIDTH = 9;
const GRID_HEIGHT = 9;

const NODES = [
  { id: 'salvage', x: 0, y: 2, icon: '▣', name: '残骸入口', kind: 'belt' },
  { id: 'forge', x: 3, y: 2, icon: '◆', name: '合金熔炉', kind: 'hybrid' },
  { id: 'hangar', x: 8, y: 2, icon: '▲', name: '固定件机库', kind: 'belt' },
  { id: 'weapons', x: 8, y: 3, icon: '◎', name: '武器挂载舱', kind: 'belt' },
  { id: 'generator', x: 0, y: 7, icon: 'ϟ', name: '雷核电站', kind: 'wire' },
  { id: 'relay', x: 3, y: 7, icon: '⌁', name: '电网中继', kind: 'wire' },
  { id: 'research', x: 8, y: 7, icon: '◈', name: '武器研究阵列', kind: 'wire' },
];

const SERIES_FALLBACK = [
  ['red', '赤猎制导', '#ff5b52', '▲'],
  ['blue', '蓝涡螺旋', '#4778ff', '≋'],
  ['prism', '棱角折射', '#a56cff', '◇'],
  ['ricochet', '重力弹球', '#ff913d', '●'],
  ['mech', '蜂群僚机', '#ffd24a', '◈'],
  ['frost', '寒霜冰弹', '#45e2e8', '❉'],
  ['cluster', '天穹集束炮', '#ff704d', '✺'],
  ['sword', '万剑归宗', '#d8f4ff', '✧'],
  ['tether', '双星锁链', '#65ffb5', '∞'],
  ['laser', '灼日锁定', '#ffdf5f', '⌁'],
  ['execute', '量子裁决', '#ff4fa3', '✦'],
  ['split', '基础白弹', '#7be65a', 'Ψ'],
].map(([id, name, color, icon]) => ({ id, name, color, icon }));

function cellKey(x, y) {
  return `${x},${y}`;
}

function defaultLayout() {
  const belt = [];
  for (let x = 1; x <= 2; x += 1) belt.push(cellKey(x, 2));
  for (let x = 4; x <= 7; x += 1) belt.push(cellKey(x, 2));
  const wire = [];
  for (let x = 1; x <= 2; x += 1) wire.push(cellKey(x, 7));
  for (let y = 3; y <= 6; y += 1) wire.push(cellKey(3, y));
  for (let x = 4; x <= 7; x += 1) wire.push(cellKey(x, 7));
  return { belt, wire };
}

function createDefaultState() {
  const layout = defaultLayout();
  return {
    scrap: 48,
    energy: 32,
    alloy: 12,
    data: 4,
    primary: 'red',
    secondary: 'blue',
    labLevels: Object.fromEntries(SERIES_FALLBACK.map((series) => [series.id, 1])),
    modules: Object.fromEntries(SERIES_FALLBACK.map((series) => [series.id, 2])),
    belt: layout.belt,
    wire: layout.wire,
    progress: 0,
    cycles: 0,
    lastTick: Date.now(),
  };
}

function loadState() {
  const base = createDefaultState();
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return base;
    return {
      ...base,
      ...parsed,
      labLevels: { ...base.labLevels, ...(parsed.labLevels || {}) },
      modules: { ...base.modules, ...(parsed.modules || {}) },
      belt: Array.isArray(parsed.belt) ? parsed.belt : base.belt,
      wire: Array.isArray(parsed.wire) ? parsed.wire : base.wire,
      lastTick: Number(parsed.lastTick) || Date.now(),
    };
  } catch {
    return base;
  }
}

let state = loadState();
let seriesList = SERIES_FALLBACK;
let activeTool = 'belt';
let pointerActive = false;
let productionReady = false;
let powerReady = false;
let lastRenderedCycles = state.cycles;

function saveState() {
  state.lastTick = Date.now();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function nodeAt(x, y) {
  return NODES.find((node) => node.x === x && node.y === y);
}

function hasPath(fromId, toId, type) {
  const from = NODES.find((node) => node.id === fromId);
  const to = NODES.find((node) => node.id === toId);
  if (!from || !to) return false;
  const placed = new Set(type === 'belt' ? state.belt : state.wire);
  const queue = [[from.x, from.y]];
  const visited = new Set([cellKey(from.x, from.y)]);
  while (queue.length) {
    const [x, y] = queue.shift();
    if (x === to.x && y === to.y) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= GRID_WIDTH || ny >= GRID_HEIGHT) continue;
      const key = cellKey(nx, ny);
      if (visited.has(key)) continue;
      const node = nodeAt(nx, ny);
      const traversableNode = node && (
        type === 'belt'
          ? node.kind === 'belt' || node.kind === 'hybrid'
          : node.kind === 'wire' || node.kind === 'hybrid'
      );
      if (!placed.has(key) && !traversableNode) continue;
      visited.add(key);
      queue.push([nx, ny]);
    }
  }
  return false;
}

function recomputeFactory() {
  productionReady = hasPath('salvage', 'forge', 'belt') && hasPath('forge', 'hangar', 'belt');
  powerReady = hasPath('generator', 'forge', 'wire') && hasPath('generator', 'research', 'wire');
}

function runProduction(seconds) {
  recomputeFactory();
  if (!productionReady || !powerReady || state.scrap <= 0 || state.energy <= 0) return;
  state.progress += seconds;
  const cycleTime = Math.max(4, 7 - Math.min(3, Math.floor((state.labLevels[state.primary] || 1) / 3)));
  while (state.progress >= cycleTime && state.scrap > 0 && state.energy > 0) {
    state.progress -= cycleTime;
    state.scrap -= 1;
    state.energy -= 1;
    state.alloy += 1;
    state.cycles += 1;
    state.modules[state.primary] = (state.modules[state.primary] || 0) + 1;
    if (state.cycles % 2 === 0) state.modules[state.secondary] = (state.modules[state.secondary] || 0) + 1;
  }
}

function applyOfflineProduction() {
  const elapsedSeconds = Math.max(0, Math.min(4 * 3600, (Date.now() - state.lastTick) / 1000));
  runProduction(elapsedSeconds);
  saveState();
}

function setText(selector, text) {
  const element = document.querySelector(selector);
  if (element) element.textContent = text;
}

function seriesById(id) {
  return seriesList.find((series) => series.id === id) || SERIES_FALLBACK.find((series) => series.id === id);
}

function updateResourceUI() {
  const primary = seriesById(state.primary);
  const secondary = seriesById(state.secondary);
  for (const selector of ['#metaAlloy', '#factoryAlloy']) setText(selector, String(state.alloy));
  for (const selector of ['#metaEnergy', '#factoryEnergy']) setText(selector, String(state.energy));
  for (const selector of ['#metaData', '#factoryData']) setText(selector, String(state.data));
  setText('#factoryScrap', String(state.scrap));
  setText('#homePrimary', primary?.name || '未配置');
  setText('#homeSecondary', secondary?.name || '未配置');
  setText('#factoryPrimary', primary?.name || '未配置');
  setText('#factorySecondary', secondary?.name || '未配置');
  const status = !productionReady
    ? '物流中断：残骸入口、熔炉与机库尚未连通'
    : !powerReady
      ? '电网中断：请连接电站、熔炉与研究阵列'
      : state.scrap <= 0 || state.energy <= 0
        ? '原料不足：出击以回收残骸与能量'
        : '生产线运行中：高频研究倾向获得双倍模块';
  setText('#factoryStatus', status);
  const progress = document.querySelector('#factoryProgress');
  if (progress) progress.style.width = `${Math.min(100, state.progress / 7 * 100)}%`;
  document.querySelector('#factoryOverlay')?.classList.toggle('factory-running', productionReady && powerReady);
}

function renderGrid() {
  const grid = document.querySelector('#factoryGrid');
  if (!grid) return;
  grid.replaceChildren();
  const belts = new Set(state.belt);
  const wires = new Set(state.wire);
  for (let y = 0; y < GRID_HEIGHT; y += 1) {
    for (let x = 0; x < GRID_WIDTH; x += 1) {
      const key = cellKey(x, y);
      const node = nodeAt(x, y);
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'factory-cell';
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.setAttribute('aria-label', node?.name || `工厂格 ${x + 1}-${y + 1}`);
      if (node) {
        cell.classList.add('node', node.kind, node.id);
        cell.innerHTML = `<i>${node.icon}</i><small>${node.name}</small>`;
      } else if (belts.has(key)) {
        cell.classList.add('belt');
        cell.innerHTML = '<i>›</i>';
      } else if (wires.has(key)) {
        cell.classList.add('wire');
        cell.innerHTML = '<i>·</i>';
      }
      const paint = () => {
        if (node) return;
        const beltSet = new Set(state.belt);
        const wireSet = new Set(state.wire);
        if (activeTool === 'erase') {
          beltSet.delete(key);
          wireSet.delete(key);
        } else if (activeTool === 'belt') {
          beltSet.add(key);
          wireSet.delete(key);
        } else {
          wireSet.add(key);
          beltSet.delete(key);
        }
        state.belt = [...beltSet];
        state.wire = [...wireSet];
        recomputeFactory();
        saveState();
        renderGrid();
        updateResourceUI();
      };
      cell.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        pointerActive = true;
        paint();
      });
      cell.addEventListener('pointerenter', () => {
        if (pointerActive) paint();
      });
      grid.appendChild(cell);
    }
  }
}

function renderLabs() {
  const wrap = document.querySelector('#factoryLabs');
  if (!wrap) return;
  wrap.replaceChildren();
  for (const series of seriesList) {
    const level = state.labLevels[series.id] || 1;
    const modules = state.modules[series.id] || 0;
    const cost = 4 + level * 2;
    const card = document.createElement('article');
    card.className = 'factory-lab';
    if (state.primary === series.id) card.classList.add('primary');
    if (state.secondary === series.id) card.classList.add('secondary');
    card.style.setProperty('--lab-color', series.color);
    card.innerHTML = `
      <i>${series.icon}</i>
      <div><strong>${series.name}</strong><small>研究 ${level}级 · 模块 ${modules}</small></div>
      <div class="lab-actions">
        <button data-action="primary">高频倾向</button>
        <button data-action="secondary">辅助倾向</button>
        <button data-action="upgrade">升级 ${cost}</button>
      </div>
    `;
    card.querySelector('[data-action="primary"]').addEventListener('click', () => {
      if (state.secondary === series.id) state.secondary = state.primary;
      state.primary = series.id;
      saveState();
      renderLabs();
      updateResourceUI();
    });
    card.querySelector('[data-action="secondary"]').addEventListener('click', () => {
      if (state.primary === series.id) state.primary = state.secondary;
      state.secondary = series.id;
      saveState();
      renderLabs();
      updateResourceUI();
    });
    card.querySelector('[data-action="upgrade"]').addEventListener('click', () => {
      if (modules < cost || state.alloy < cost) return;
      state.modules[series.id] -= cost;
      state.alloy -= cost;
      state.labLevels[series.id] = level + 1;
      saveState();
      renderLabs();
      updateResourceUI();
    });
    card.querySelector('[data-action="upgrade"]').disabled = modules < cost || state.alloy < cost;
    wrap.appendChild(card);
  }
}

export function initMetagame(routes = SERIES_FALLBACK) {
  seriesList = routes.map((route) => ({
    id: route.id,
    name: route.name,
    color: route.color,
    icon: route.icon,
  }));
  applyOfflineProduction();
  recomputeFactory();
  renderGrid();
  renderLabs();
  updateResourceUI();

  document.querySelector('#factoryButton')?.addEventListener('click', () => {
    document.querySelector('#factoryOverlay')?.classList.add('visible');
    renderGrid();
    renderLabs();
    updateResourceUI();
  });
  document.querySelector('#factoryClose')?.addEventListener('click', () => {
    document.querySelector('#factoryOverlay')?.classList.remove('visible');
  });
  document.querySelectorAll('[data-factory-tool]').forEach((button) => {
    button.addEventListener('click', () => {
      activeTool = button.dataset.factoryTool;
      document.querySelectorAll('[data-factory-tool]').forEach((candidate) => candidate.classList.toggle('active', candidate === button));
    });
  });
  document.querySelector('#factoryReset')?.addEventListener('click', () => {
    const layout = defaultLayout();
    state.belt = layout.belt;
    state.wire = layout.wire;
    saveState();
    renderGrid();
    updateResourceUI();
  });
  window.addEventListener('pointerup', () => { pointerActive = false; });
  window.setInterval(() => {
    runProduction(1);
    saveState();
    updateResourceUI();
    if (state.cycles !== lastRenderedCycles) {
      lastRenderedCycles = state.cycles;
      renderLabs();
    }
  }, 1000);
}

export function getArsenalLoadout() {
  return {
    primary: state.primary,
    secondary: state.secondary,
    labLevels: { ...state.labLevels },
    productionReady: productionReady && powerReady,
  };
}

export function grantArsenalRewards({ victory = false, kills = 0 } = {}) {
  state.scrap += 10 + Math.floor(kills / 3) + (victory ? 18 : 0);
  state.energy += 3 + Math.floor(kills / 12) + (victory ? 8 : 0);
  state.data += victory ? 2 : kills >= 25 ? 1 : 0;
  saveState();
  updateResourceUI();
}
