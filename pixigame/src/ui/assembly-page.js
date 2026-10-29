import * as T from 'three';
import { createThreeSurface } from './three-surface.js';
import { createAssemblyScene } from './assembly-scene.js';
import { ASSEMBLY_PREVIEW, renderAssemblyLayout } from './assembly-layout.js';
import { DEMO_SLOTS, ITEM_BY_ID, SLOT_BY_ID, equipAirframeSidearm, removeDemoItem, itemAtSlot } from '../slot-demo/catalog.js';
import { fittingPilotId, restoreAircraftFittings } from '../slot-demo/aircraft-slots.js';
import { PUBLIC_WEAPON_ITEMS as RELEASED_FIXED_ITEMS } from '../slot-demo/catalog.js';
import { PUBLIC_ARSENAL, normalizeAirframePlacements } from '../fixed-parts/airframe-arsenal.js';
import { readFixedLoadout } from '../fixed-parts/runtime.js';
import { acquireCommonWeaponThumbnails } from './common-weapon-thumbnails.js';

const STORAGE_KEY = 'thunder-slot-demo-v1';
const inPreview = (x, y) => x >= 0 && x <= 600 && y >= 214 && y < 593;
const previewControl = control => control?.id === 'preview-orbit' || control?.id.startsWith('marker-');

export function createAssemblyPage({ bridge, actions: lobbyActions }) {
  const surface = createThreeSurface(), { group } = surface; group.name = 'assembly-native-three';
  const art = new Map(), requests = new Map(), loader = new T.TextureLoader();
  const pointers = new Map();
  let activePilot = fittingPilotId(bridge.getActivePilot().id), fittings = {};
  try { fittings = restoreAircraftFittings(JSON.parse(localStorage.getItem(STORAGE_KEY))); } catch { /* Start empty if storage is unavailable. */ }
  const initialCollection=bridge.getGachaState().weaponProgress.weapons;
  fittings = Object.fromEntries(Object.entries(fittings).map(([pilot, placements]) => [pilot, normalizeAirframePlacements(pilot, Object.fromEntries(Object.entries(placements).filter(([id])=>initialCollection[id]?.unlocked)))]));
  try{fittings[activePilot]=readFixedLoadout(activePilot,localStorage).placements;}catch{}
  const state = { pilotId: activePilot, placements: fittings[activePilot] || normalizeAirframePlacements(activePilot), selectedSlot: 'W3',
    filter: 'all', page: 0, mirror: true, comparing: false, showSockets: true, modal: null };
  const scene = createAssemblyScene({ renderer: bridge.app.renderer, pilotId: state.pilotId }); scene.apply(state.placements);
  let markers = new Map(), active = false, disposed = false, animationFrame = 0, lastTime = 0;
  let pinchDistance = 0, toastTimer = 0, toastSurface = null, ghost = null;
  const weaponArt=acquireCommonWeaponThumbnails(bridge.app.renderer,()=>refresh());

  function cancelInput() {
    pointers.forEach(p => { if (p.control) p.control.mesh.material.opacity = p.control.mesh.material.userData.baseOpacity = p.opacity; });
    pointers.clear(); pinchDistance = 0; if (ghost) ghost.visible = false;
  }
  function save() {
    fittings[state.pilotId] = state.placements;
    try { if(!localStorage.getItem(`${STORAGE_KEY}-legacy-backup`)){const old=localStorage.getItem(STORAGE_KEY);if(old)localStorage.setItem(`${STORAGE_KEY}-legacy-backup`,old);}localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, aircraft: fittings })); return true; }
    catch { return false; }
  }
  function toast(message) {
    clearTimeout(toastTimer); toastSurface?.destroy(); toastSurface?.group.removeFromParent();
    toastSurface = createThreeSurface();
    toastSurface.panel(55, 476, 490, 46, { fill: '#102236', opacity: .96, stroke: null, cut: 0, radius: 10 });
    toastSurface.text(message, 300, 499, { size: 19, color: '#ffe0a1', weight: 700, align: 'center', maxWidth: 455 });
    group.add(toastSurface.group);
    toastTimer = setTimeout(() => { toastSurface?.destroy(); toastSurface?.group.removeFromParent(); toastSurface = null; }, 2100);
  }
  function commit(placements, message) {
    const collection=bridge.getGachaState().weaponProgress.weapons;
    const locked=Object.keys(placements).filter(id=>!collection[id]?.unlocked);
    if(locked.length){toast('请先在商城宝箱中获得武器');return;}
    placements = normalizeAirframePlacements(state.pilotId, placements);
    state.placements = placements; state.comparing = false; state.modal = null;
    scene.setCompare(false); scene.apply(placements); const saved = save(); refresh();
    const main=Object.keys(placements).find(id=>placements[id].includes('W1'));if(main)bridge.equipGachaWeapon(`weapon:${main}`);
    toast(saved ? message : '本次已装配，存储不可用，暂未保存');
  }
  function equip(id, slotId = null) {
    if (!Object.hasOwn(PUBLIC_ARSENAL,id)) return;
    if(!bridge.getGachaState().weaponProgress.weapons[id]?.unlocked){state.detailId=id;state.modal='detail';refresh();return;}
    const item = ITEM_BY_ID.get(id); if (!item) return;
    let target = slotId || state.selectedSlot;
    if (SLOT_BY_ID.get(target)?.kind !== item.kind) {
      if (slotId) { toast(item.kind === 'weapon' ? '武器需要安装到机翼挂点' : '连接器需要安装到机背挂点'); return; }
      target = (DEMO_SLOTS.find(slot => slot.kind === item.kind && !itemAtSlot(state.placements, slot.id)) || DEMO_SLOTS.find(slot => slot.kind === item.kind)).id;
    }
    const next = equipAirframeSidearm(state.placements, id, target, state.mirror);
    if (next) {
      state.selectedSlot = target; scene.focus(target);
      commit(next, `${item.name} · ${next[id].length === 2 ? '左右同装完成' : '装配完成'}`);
    }
  }
  const actions = {
    ...lobbyActions, equip,
    fixedPreset() { commit({aux_cannon:['W3','W4']}, '已挂载公共副武器：速射机炮'); },
    railPreset() { commit({aux_rail:['W3','W4']}, '已挂载公共副武器：穿甲磁轨炮'); },
    missilePreset() { commit({aux_rocket:['W3','W4']}, '已挂载公共副武器：集束火箭舱'); },
    prismPreset() { commit({aux_laser:['W3','W4']}, '已挂载公共副武器：脉冲激光炮'); },
    teslaPreset() { commit({aux_scatter:['W3','W4']}, '已挂载公共副武器：电磁散射器'); },
    energyPreset() { commit({aux_laser:['W3','W4'],aux_scatter:['W5','W6']}, '已挂载公共副武器：激光＋散射'); },
    fullPreset() { commit({aux_rocket:['W3','W4'],aux_rail:['W5','W6']}, '已挂载公共副武器：火箭＋磁轨'); },
    mixedPreset() { commit({aux_cannon:['W3','W4'],aux_rocket:['W5','W6']}, '已挂载公共副武器：机炮＋火箭'); },
    originalRange() { window.location.assign(new URL('pathogenic-range.html', document.baseURI)); },
    trial() {
      if (state.pilotId !== bridge.getActivePilot().id) { toast('当前为试装机型，请切回出战机型后出击'); return; }
      if (!save()) { toast('装配尚未保存成功，请重试后出击'); return; }
      bridge.startGame();
    },
    slot(id) {
      state.selectedSlot = id;
      if (state.filter !== 'all' && SLOT_BY_ID.get(id).kind !== state.filter) { state.filter = SLOT_BY_ID.get(id).kind; state.page = 0; }
      scene.focus(id); refresh();
    },
    aircraft(id) {
      save(); state.pilotId = fittingPilotId(id); state.placements = fittings[state.pilotId] || normalizeAirframePlacements(state.pilotId);
      state.comparing = false; state.modal = null; scene.setCompare(false); scene.setPilot(state.pilotId, state.placements); refresh();
    },
    filter(id) { state.filter = id; state.page = 0; refresh(); },
    page(index) {
      const count = RELEASED_FIXED_ITEMS.filter(item => state.filter === 'all' || item.kind === state.filter).length;
      state.page = T.MathUtils.clamp(index, 0, Math.ceil(count / 6) - 1); refresh();
    },
    mirror() { state.mirror = !state.mirror; refresh(); },
    compare() { state.comparing = !state.comparing; scene.setCompare(state.comparing); refresh(); },
    sockets() { state.showSockets = !state.showSockets; scene.setSockets(state.showSockets); refresh(); },
    view(preset) { if (preset === 'in' || preset === 'out') scene.zoom(preset === 'in' ? .84 : 1.19); else scene.view(preset); project(); },
    modal(id) { state.detailId=null;state.modal = id; refresh(); },
    upgrade(kind){const id=state.detailId||itemAtSlot(state.placements,state.selectedSlot)?.id;if(!id)return;const result=bridge.upgradeCommonWeapon(id,kind);refresh();toast(result.ok?(kind==='quality'?'武器品质已提升':'武器等级已提升'):result.reason);},
    clear() { commit({}, '已恢复初始机炮'); },
    remove() { commit(removeDemoItem(state.placements, state.selectedSlot), '武器已卸下，空主槽将恢复初始机炮'); },
  };
  function loadArt(id, path) {
    if (requests.get(id)?.path === path) return;
    const request = { path }; requests.set(id, request);
    loader.load(`${import.meta.env.BASE_URL}${path.replace(/^\.\//, '')}`, texture => {
      if (disposed || requests.get(id) !== request) { texture.dispose(); return; }
      texture.colorSpace = T.SRGBColorSpace; art.get(id)?.dispose(); art.set(id, texture); refresh();
    }, undefined, error => { if (!disposed) console.warn(`[assembly-art:${id}] 素材未能加载`, error); });
  }
  function project() {
    for (const p of scene.project(ASSEMBLY_PREVIEW)) {
      const marker = markers.get(p.id); if (!marker) continue;
      marker.group.position.set(p.x, p.y, 0); marker.group.visible = p.visible;
      Object.assign(marker.control, { x: p.x - 21, y: p.y - 18, disabled: !p.visible || Boolean(state.modal) });
    }
  }
  function refresh() {
    if (disposed) return;
    cancelInput();
    const weaponProgress=bridge.getGachaState().weaponProgress.weapons;
    for(const [id,owned] of Object.entries(weaponProgress)){
      const texture=weaponArt.textures.get(id+'/'+owned.qualityRank);if(texture)scene.thumbnails.set(id,texture);
    }
    // Toast resources have their own owner; detach before the surface rebuild.
    toastSurface?.group.removeFromParent(); surface.clear();
    loadArt('pilot', bridge.getActivePilot().avatar || bridge.getActivePilot().image);
    markers = renderAssemblyLayout({ surface, bridge, art, scene, state, actions });
    const start = group.children.length;
    surface.panel(-64, -43, 128, 86, { fill: '#fff0cb', stroke: '#e5b362', opacity: .95, radius: 8, cut: 0 });
    const mesh = surface.image(scene.thumbnails.values().next().value, -61, -39, 122, 78); mesh.material.toneMapped = true;
    ghost = new T.Object3D(); for (const child of group.children.slice(start)) ghost.add(child);
    ghost.userData.image = mesh; ghost.visible = false; group.add(ghost);
    if (toastSurface) { toastSurface.group.visible = !state.modal; group.add(toastSurface.group); }
    project();
  }
  const hit = (x, y) => [...surface.controls].reverse().find(c => !c.disabled && x >= c.x && x <= c.x + c.width && y >= c.y && y <= c.y + c.height);
  function handlePointer({ x, y, phase, pointerId = 1 }) {
    if (!active) return false;
    if (phase === 'start') {
      const control = hit(x, y), opacity = control?.mesh.material.userData.baseOpacity ?? control?.mesh.material.opacity ?? 1;
      if (pointers.size && (pointers.size > 1 || !previewControl(control) || ![...pointers.values()].every(p => previewControl(p.control)))) return true;
      pointers.set(pointerId, { x, y, startX: x, startY: y, control, opacity, dragged: false });
      if (control) control.mesh.material.opacity = control.mesh.material.userData.baseOpacity = opacity * .7;
      const pair = [...pointers.values()];
      if (pair.length === 2 && pair.every(p => previewControl(p.control))) {
        pinchDistance = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y); pair.forEach(p => { p.dragged = true; });
      }
      return true;
    }
    const press = pointers.get(pointerId); if (!press) return true;
    const dx = x - press.x, dy = y - press.y; press.x = x; press.y = y;
    if (Math.hypot(x - press.startX, y - press.startY) > 12) press.dragged = true;
    if (phase === 'move') {
      if (pinchDistance && pointers.size === 2) {
        const pair = [...pointers.values()], next = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
        if (next > 5) { scene.zoom(pinchDistance / next); pinchDistance = next; project(); }
      } else if (press.dragged && previewControl(press.control)) { scene.rotate(dx, dy); project(); }
      else if (press.dragged && press.control?.id.startsWith('item-') && ITEM_BY_ID.has(press.control.id.slice(5))) {
        ghost.userData.image.material.map = scene.thumbnails.get(press.control.id.slice(5)); ghost.position.set(x, y - 52, 0); ghost.visible = true;
      }
      return true;
    }
    if (press.control) press.control.mesh.material.opacity = press.control.mesh.material.userData.baseOpacity = press.opacity;
    pointers.delete(pointerId); pinchDistance = 0; ghost.visible = false;
    if (phase !== 'cancel' && press.dragged && press.control?.id.startsWith('item-')) {
      const drop = hit(x, y), match = /^(?:marker|slot)-(.+)$/.exec(drop?.id || '');
      if (match) equip(press.control.id.slice(5), match[1]);
      else if (Math.abs(x - press.startX) > 70 && Math.abs(y - press.startY) < 90) actions.page(state.page + (x < press.startX ? 1 : -1));
    } else if (phase !== 'cancel' && !press.dragged && press.control && hit(x, y) === press.control) {
      bridge.unlockAudio?.(); press.control.onPress();
    }
    return true;
  }
  function update(ticker) {
    if (!active) return;
    scene.update((ticker?.deltaMS || 16.67) / 1000); project();
  }
  function schedule() {
    if (animationFrame || disposed || !active || document.hidden) return;
    animationFrame = requestAnimationFrame(now => {
      animationFrame = 0; if (disposed || !active || document.hidden) return;
      if (!bridge.app.ticker.started) { lobbyActions.update({ deltaMS: lastTime ? now - lastTime : 16.67 }); bridge.app.renderer.render({ container: bridge.app.stage }); }
      lastTime = now; schedule();
    });
  }
  function onVisibility() { lastTime = 0; if (document.hidden) { cancelAnimationFrame(animationFrame); animationFrame = 0; cancelInput(); } else schedule(); }
  document.addEventListener('visibilitychange', onVisibility);
  loadArt('background', 'assets/ui/sortie/hangar-opening-v1.webp'); loadArt('icons', 'assets/ui/sortie/nav-icons-v2.webp'); refresh();
  return {
    group, refresh, update, handlePointer,
    get state() { return structuredClone({ ...state, ...scene.state,weaponArtReady:weaponArt.ready }); },
    get controls() { return surface.controls.map(({ id, label, x, y, width, height, disabled }) => ({ id, label, x, y, width, height, disabled })); },
    activateAt(x, y) { const control = active && hit(x, y); if (!control) return false; control.onPress(); return true; },
    wheel(x, y, deltaY) { if (!active || state.modal || !inPreview(x, y)) return false; scene.zoom(Math.exp(T.MathUtils.clamp(deltaY, -200, 200) * .002)); project(); return true; },
    setVisible(value, interactive = value) {
      if (value && !group.visible) {
        const next = fittingPilotId(bridge.getActivePilot().id);
        if (next !== activePilot) { activePilot = next; actions.aircraft(next); }
        try{state.placements=readFixedLoadout(state.pilotId,localStorage).placements;fittings[state.pilotId]=state.placements;scene.apply(state.placements);refresh();}catch{}
      }
      group.visible = value; scene.setVisible(value && interactive);
      if (active && !interactive) cancelInput(); active = interactive;
      if (active) schedule(); else { cancelAnimationFrame(animationFrame); animationFrame = 0; lastTime = 0; }
    },
    destroy() {
      disposed = true; cancelInput(); cancelAnimationFrame(animationFrame); clearTimeout(toastTimer); document.removeEventListener('visibilitychange', onVisibility);
      toastSurface?.group.removeFromParent(); toastSurface?.destroy();weaponArt.release(); scene.destroy(); surface.destroy(); art.forEach(texture => texture.dispose()); art.clear();
    },
  };
}
