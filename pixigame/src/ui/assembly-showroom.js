import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createFighterView } from '../three/aircraft/fighter-view.js';
import { fixedPartProfile } from '../three/aircraft/fixed-part-profiles.js';
import { WING_DESIGNS } from '../three/aircraft/wing-designs.js';
import { setShowroomCameraPreset } from './showroom-camera.js';
import './assembly-showroom.css';

const SLOT_NAMES = { wing: '机翼', engine: '推进器', tail: '机尾' };
const SLOT_NUMBERS = { wing: '01', engine: '02', tail: '03' };
const RARITIES = { common: '标准', rare: '稀有', epic: '史诗', legendary: '传奇' };

function element(tag, className, text, parent) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  parent?.append(node);
  return node;
}

function partIcon(module) {
  const p = fixedPartProfile(module);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '-190 -95 380 190');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('fitting-part-icon');
  const path = (data, opacity = 1) => {
    const node = document.createElementNS(svg.namespaceURI, 'path');
    node.setAttribute('d', data); node.setAttribute('fill', 'currentColor');
    node.setAttribute('fill-opacity', String(opacity)); svg.append(node);
  };
  if (!p) { path('M-24 -2h48v4h-48z', .3); return svg; }
  if (p.nozzles) {
    const spacing = p.nozzles.length === 1 ? 0 : 4;
    for (const nozzle of p.nozzles) {
      const x = nozzle * spacing, w = p.width * 1.5, h = p.housing * 1.7;
      path(`M${x - w} ${-h / 2}h${w * 2}v${h}h${-w * 2}z`, .78);
      path(`M${x - w * .65} ${h / 2 + 6}l${w * .65} 22l${w * .65} -22z`);
    }
  } else if (p.slot === 'wing' && WING_DESIGNS[p.key]) {
    for (const side of [-1, 1]) {
      for (const panel of WING_DESIGNS[p.key].panels) {
        path(`M${panel.points.map(([x,z]) => `${x * side * 20},${z * 16}`).join('L')}Z`, panel.paint === 'dark' ? .45 : .9);
      }
    }
    path('M0 -86L12 -20L10 71H-10L-12 -20Z', .35);
  } else {
    const scale = p.slot === 'tail' ? 1.7 : 1;
    for (const side of [-1, 1]) path(`M${p.points.map(([x, y]) => `${x * scale * side},${y * scale - 15}`).join('L')}Z`, .85);
    path('M-8 -76h16v150h-16z', .35);
  }
  return svg;
}

// One retained viewer per lobby: equipping rerenders the shared account header
// without recreating WebGL or losing the camera. Hidden tabs do no preview work.
export function createAssemblyShowroom({ bridge, host }) {
  const root = element('section', 'assembly-showroom', null, host);
  root.setAttribute('aria-label', '固定件装配台');
  root.hidden = true;
  const hero = element('div', 'fitting-hero', null, root);
  const heading = element('header', 'fitting-heading', null, hero);
  const title = element('div', '', null, heading);
  element('span', 'fitting-eyebrow', 'AIRFRAME / 01', title);
  element('h1', '', '游隼 · 装配台', title);
  element('span', 'fitting-preview-badge', '外观展示', heading);
  const viewport = element('div', 'fitting-viewport', null, hero);
  const canvas = element('canvas', '', null, viewport);
  canvas.setAttribute('aria-label', '游隼战机三维预览');
  canvas.tabIndex = 0;
  const cameraTools = element('div', 'fitting-camera-tools', null, hero);
  const cameraButton = (label, text, action) => {
    const button = element('button', '', text, cameraTools); button.type = 'button';
    button.setAttribute('aria-label', label); button.onclick = action;
    return button;
  };
  const equipment = element('div', 'fitting-equipment', null, root);
  const slots = element('div', 'fitting-slots', null, equipment);
  slots.setAttribute('aria-label', '固定件槽位');
  const warehouseHeading = element('div', 'fitting-warehouse-heading', null, equipment);
  const warehouseTitle = element('h2', '', '', warehouseHeading);
  const warehouseCount = element('span', '', '', warehouseHeading);
  const inventory = element('div', 'fitting-inventory', null, equipment);
  inventory.setAttribute('aria-label', '固定件仓库');
  const detail = element('div', 'fitting-detail', null, equipment);
  const detailCopy = element('div', 'fitting-detail-copy', null, detail);
  const detailTitle = element('strong', '', '', detailCopy);
  const detailDescription = element('p', '', '', detailCopy);
  const removeButton = element('button', 'fitting-remove', '卸下', detail); removeButton.type = 'button';
  const status = element('div', 'fitting-status', '', root);
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .82;
  const scene = new T.Scene(); scene.background = new T.Color('#0a1525');
  const studio = new RoomEnvironment();
  const pmrem = new T.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(studio, .04);
  scene.environment = environment.texture;
  scene.environmentIntensity = .65;
  studio.dispose(); pmrem.dispose();
  scene.add(new T.HemisphereLight('#dceaff', '#172536', .8));
  const keyLight = new T.DirectionalLight('#e7f4ff', 1.2); keyLight.position.set(-8, 16, -12); scene.add(keyLight);
  const rim = new T.DirectionalLight('#70bbff', .9); rim.position.set(12, 7, 8); scene.add(rim);
  const grid = new T.GridHelper(32, 32, '#27465f', '#152a40'); grid.position.y = -2.15;
  grid.material.transparent = true; grid.material.opacity = .4; scene.add(grid);
  const ring = new T.Mesh(new T.TorusGeometry(10.5, .015, 4, 96), new T.MeshBasicMaterial({ color: '#2e5c76', transparent: true, opacity: .5 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = -2.12; scene.add(ring);
  const fighter = createFighterView({ pilotId: 'pilot-01', size: 1, nativeSpace: true });
  // Inspection lighting: preserve illuminated seams and exhaust, while lowering
  // the combat skin's energy overlays so panel edges and cockpit remain legible.
  Object.assign(fighter.runtime.config, { bodyFx: .16, surfaceGlow: .35, coreGlow: .45, weaponGlow: .35, trails: .2, particles: .15 });
  scene.add(fighter.object3D);
  const camera = new T.PerspectiveCamera(43, 1, .1, 160);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .1;
  controls.enablePan = false; controls.minDistance = 8; controls.maxDistance = 60;
  controls.minPolarAngle = .04; controls.maxPolarAngle = Math.PI - .04;
  controls.rotateSpeed = .72; controls.zoomSpeed = .8;
  controls.target.set(0, .15, -.4);
  function home() { setShowroomCameraPreset(camera, controls, 'home'); }
  function zoom(factor) {
    const offset = camera.position.clone().sub(controls.target);
    offset.setLength(T.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(offset); controls.update();
  }
  home();
  cameraButton('放大查看细节', '+', () => zoom(.82));
  cameraButton('缩小查看全机', '−', () => zoom(1.22));
  cameraButton('俯视战机', '俯视', () => setShowroomCameraPreset(camera, controls, 'top'));
  cameraButton('重置视角', '复位', home);
  canvas.addEventListener('keydown', event => {
    if (event.key === '+' || event.key === '=') { zoom(.82); event.preventDefault(); }
    if (event.key === '-') { zoom(1.22); event.preventDefault(); }
    if (event.key.toLowerCase() === 'r') home();
  });

  const target = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  const renderPass = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new T.Vector2(320, 300), .2, .35, 2.2);
  const output = new OutputPass();
  composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(output);
  let frame = 0, visible = false, destroyed = false, time = 0, lastTime = 0;
  let activeSlot = 'wing', snapshot, lastMountKey = '', lastInventorySlot = '', toastTimer;
  const catalog = bridge.getFixedModuleCatalog();
  const cards = new Map(), slotButtons = new Map();
  const color = module => `#${(module?.color || 0x70dacf).toString(16).padStart(6, '0')}`;
  const announce = text => { status.textContent = text; status.classList.add('is-visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => status.classList.remove('is-visible'), 1800); };
  function equip(module) {
    if (bridge.setAssemblySlot(activeSlot, module.id)) {
      refresh(); announce(`${module.name} · 已装配并保存`);
    }
  }
  function focusSlot(slot) { activeSlot = slot; refresh(); }
  for (const slot of Object.keys(SLOT_NAMES)) {
    const button = element('button', 'fitting-slot', null, slots); button.type = 'button';
    button.dataset.slot = slot; button.onclick = () => focusSlot(slot);
    const label = element('span', 'fitting-slot-label', `${SLOT_NUMBERS[slot]} / ${SLOT_NAMES[slot]}`, button);
    const value = element('strong', '', '', button);
    slotButtons.set(slot, { button, label, value });
  }
  function refresh() {
    snapshot = bridge.getAssemblySnapshot();
    const key = JSON.stringify([snapshot.mounts.wing, snapshot.mounts.engine, snapshot.mounts.tail]);
    if (key !== lastMountKey) { fighter.setEquipment(bridge.getAssemblyAppearance()); lastMountKey = key; }
    root.dataset.equippedWing = snapshot.mounts.wing || '';
    root.dataset.equippedEngine = snapshot.mounts.engine || '';
    root.dataset.equippedTail = snapshot.mounts.tail || '';
    for (const [slot, { button, value }] of slotButtons) {
      const module = catalog.find(item => item.id === snapshot.mounts[slot]);
      button.setAttribute('aria-pressed', String(slot === activeSlot));
      button.setAttribute('aria-label', `${SLOT_NAMES[slot]}槽位：${module?.name || '未装配'}`);
      button.style.setProperty('--part-color', color(module));
      value.textContent = module?.shortName || '空槽位';
    }
    if (lastInventorySlot !== activeSlot) {
      inventory.replaceChildren(); cards.clear(); inventory.scrollTop = 0;
      const modules = catalog.filter(module => module.fixedSlot === activeSlot);
      warehouseTitle.textContent = `${SLOT_NAMES[activeSlot]}仓库`;
      warehouseCount.textContent = `${modules.length} 件 · 全部拥有`;
      for (const module of modules) {
        const button = element('button', 'fitting-card', null, inventory); button.type = 'button';
        button.dataset.moduleId = module.id; button.style.setProperty('--part-color', color(module));
        button.setAttribute('aria-label', `装配${module.name}`); button.onclick = () => equip(module);
        const icon = element('div', 'fitting-card-art', null, button); icon.append(partIcon(module));
        const copy = element('div', 'fitting-card-copy', null, button);
        element('strong', '', module.name, copy);
        element('small', '', `${RARITIES[module.rarity]} · +${module.power}`, copy);
        const marker = element('span', 'fitting-card-marker', '已装', button);
        cards.set(module.id, { button, marker });
      }
      lastInventorySlot = activeSlot;
    }
    for (const [id, { button, marker }] of cards) {
      const selected = snapshot.mounts[activeSlot] === id;
      button.setAttribute('aria-pressed', String(selected)); marker.hidden = !selected;
    }
    const current = catalog.find(module => module.id === snapshot.mounts[activeSlot]);
    detailTitle.textContent = current?.name || `${SLOT_NAMES[activeSlot]}未装配`;
    detailDescription.textContent = current?.passive?.description || '';
    removeButton.disabled = !current;
    removeButton.setAttribute('aria-label', `卸下${current?.name || SLOT_NAMES[activeSlot]}`);
  }
  removeButton.onclick = () => {
    if (bridge.setAssemblySlot(activeSlot, null)) { refresh(); announce(`${SLOT_NAMES[activeSlot]}已卸下 · 配置已保存`); }
  };
  refresh();

  function resize() {
    const width = Math.max(1, viewport.clientWidth), height = Math.max(1, viewport.clientHeight);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    renderer.setSize(width, height, false); composer.setSize(width, height);
  }
  const observer = new ResizeObserver(resize); observer.observe(viewport);
  function animate(now) {
    frame = 0;
    if (!visible || destroyed || document.hidden) return;
    time += Math.min(.05, Math.max(0, (now - lastTime) / 1000)); lastTime = now;
    controls.update(); fighter.updateAircraft(time);
    grid.visible = camera.position.y >= -1.8; ring.visible = grid.visible;
    composer.render();
    // Public UI state also makes zoom/rotation and persistence inspectable.
    canvas.dataset.viewDistance = camera.position.distanceTo(controls.target).toFixed(2);
    canvas.dataset.viewAzimuth = controls.getAzimuthalAngle().toFixed(3);
    canvas.dataset.viewPolar = controls.getPolarAngle().toFixed(3);
    frame = requestAnimationFrame(animate);
  }
  function start() { if (!frame && visible && !document.hidden) { lastTime = performance.now(); frame = requestAnimationFrame(animate); } }
  function visibilityChanged() { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else start(); }
  document.addEventListener('visibilitychange', visibilityChanged);
  return {
    root, refresh,
    setVisible(next) {
      if (destroyed || visible === next) return;
      visible = next; root.hidden = !next;
      if (next) { refresh(); resize(); start(); }
      else { cancelAnimationFrame(frame); frame = 0; }
    },
    destroy() {
      destroyed = true; cancelAnimationFrame(frame); clearTimeout(toastTimer); observer.disconnect();
      document.removeEventListener('visibilitychange', visibilityChanged);
      controls.dispose(); fighter.destroy({ children: true });
      grid.geometry.dispose(); grid.material.dispose(); ring.geometry.dispose(); ring.material.dispose();
      environment.dispose(); bloom.dispose(); output.dispose(); renderPass.dispose(); composer.dispose();
      renderer.dispose(); renderer.forceContextLoss(); root.remove();
    },
  };
}
