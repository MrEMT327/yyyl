import './page.css';
import { Container, Texture, WebGLRenderer } from '../three/display.js';
import { createWorldEnvironment } from '../three/world.js';
import { createCombatVfx } from '../three/combat-vfx.js';
import { loadFixedProjectileArt } from '../fixed-parts/projectile-art.js';
import { compileAirframeLoadout } from '../fixed-parts/airframe-arsenal.js';
import { COMMON_WEAPONS, WEAPON_QUALITIES, commonWeaponStats } from '../fixed-parts/common-weapons.js';
import { createCommonCombat } from '../fixed-parts/common-combat.js';
import { loadFighterPackages } from '../three/aircraft/fighter-packages.js';
import { createFighterView } from '../three/aircraft/fighter-view.js';
import { weaponPreviewTargetVisuals } from '../ui/weapon-preview.js';
import { readPreviewState, normalizePreviewState, previewUrl, gameUrl } from './state.js';

const template = `
  <header class="wp-header">
    <div><div class="wp-eyebrow">少女航线 / WEAPON LAB</div><h1>武器试射</h1><p>20 种武器 · 六档品质 · 实战效果实时预览</p></div>
    <div class="wp-actions"><button id="copy-link">复制当前配置链接</button><a id="enter-game">进入游戏</a><span id="share-status" role="status"></span></div>
  </header>
  <div class="wp-share" id="share-panel" hidden><label>当前配置链接<input id="share-url" type="text" readonly></label><p>长按链接或按 Ctrl+C 复制，可在同一局域网的设备上打开。</p></div>
  <main class="wp-layout">
    <aside class="wp-panel" aria-label="武器预览设置">
      <h2 id="title"></h2><p id="description"></p>
      <div class="wp-section-label">选择武器 <span>共 20 种 · 可滚动切换</span></div>
      <nav id="weapons" aria-label="武器列表"></nav>
      <div class="wp-fields controls">
        <label>武器品质<select id="quality"></select></label>
        <label>强化等级 · 1–100<input id="level" type="number" min="1" max="100" step="1" value="1" inputmode="numeric"></label>
      </div>
      <input id="level-range" type="range" min="1" max="100" step="1" value="1" aria-label="调整强化等级">
      <div class="wp-growth"><button id="upgrade-quality"></button><button id="upgrade-level">强化 +10 级</button></div>
      <output id="stats"></output><p class="wp-note">品质改变攻击与视觉效果，逐档继承；强化等级提升伤害。</p>
      <div class="wp-fields">
        <label>靶场状态<select id="scene"><option value="cluster">密集敌群</option><option value="single">单个目标</option><option value="kills">低血量 · 击杀触发</option><option value="empty">空场 · 完整弹道</option></select></label>
        <label>播放速度<select id="speed"><option value="0.25">0.25× · 慢速</option><option value="0.5">0.5× · 慢速</option><option value="1">1× · 正常</option><option value="2">2× · 加速</option></select></label>
      </div>
      <div class="wp-toggles"><label><input type="checkbox" id="moving">飞机移动</label><label><input type="checkbox" id="bullets">敌方弹体</label></div>
      <div class="wp-playback controls"><button id="pause">暂停观察</button><button id="restart">重新开始</button><button id="advance-fine">推进 0.1 秒</button><button id="advance">推进 1 秒</button></div>
      <p id="visual"></p><p id="acceptance"></p>
      <details id="visual-rules"><summary></summary></details>
      <details><summary>已生效的品质规则</summary><div id="rules"></div></details>
      <p class="wp-note">与游戏共用武器模型、特效和战斗逻辑。此处调整仅用于试射，不写入游戏存档。</p>
    </aside>
    <section class="wp-stage" aria-label="实时武器试射画面">
      <div id="viewport"><canvas aria-label="武器试射靶场"></canvas><div class="wp-badge"><strong>LIVE PREVIEW</strong><span id="badge"></span></div><div class="wp-bottom"><span id="play-state">实时试射</span><span>少女航线</span></div></div>
      <output id="metrics"></output>
    </section>
  </main>`;

export async function mountWeaponPreview() {
  document.title = '武器试射 · 少女航线';
  document.body.classList.add('weapon-preview');
  document.querySelector('.arcade')?.remove();
  document.querySelector('#performanceHud')?.remove();
  const root = document.createElement('div');
  root.className = 'wp-shell';
  root.innerHTML = template;
  document.body.append(root);
  const $ = selector => root.querySelector(selector);
  const nav = $('#weapons');
  let state = readPreviewState(location.search);
  let active, combat, time = 0, serial = 0, targets = [], hostiles = [], hits = 0, kills = 0, nextBullet = 0;
  let animation = 0, stopped = false, accumulator = 0;
  const events = new AbortController();
  const listen = (target, event, handler) => target.addEventListener(event, handler, { signal: events.signal });
  nav.replaceChildren(...Object.values(COMMON_WEAPONS).map(weapon => {
    const button = document.createElement('button');
    button.dataset.key = weapon.id;
    button.textContent = weapon.name;
    return button;
  }));
  $('#quality').replaceChildren(...WEAPON_QUALITIES.map((name, rank) => new Option(name, rank)));
  // Legacy tools links share this page; copied links use the normal game entry.
  const entry = new URL(import.meta.env.BASE_URL, location.href);
  const entryUrl = location.pathname.endsWith('/tools/combat-vfx-gallery.html') ? new URL(location.search, entry) : new URL(location.href);
  $('#enter-game').href = gameUrl(entryUrl).href;

  const renderer = new WebGLRenderer();
  await renderer.init({ canvas: $('canvas'), width: 430, height: 932, resolution: Math.min(devicePixelRatio, 2), antialias: true });
  try {
    await Promise.all([loadFixedProjectileArt(), loadFighterPackages()]);
  } catch (error) {
    renderer.destroy();
    throw error;
  }
  const stage = new Container(), frame = new Container(), layer = new Container();
  stage.addChild(frame);
  frame.addChild(layer);
  renderer.configureWorld({ layers: [layer], frame });
  const sea = createWorldEnvironment(renderer.worldScene, { shadowsEnabled: false });
  const seaImage = new Image();
  seaImage.onload = () => {
    if (!stopped) { sea.setTextures({ 'tidal-sea-tile': Texture.from(seaImage) }); render(); }
  };
  seaImage.src = new URL('assets/retro/backgrounds/tidal-sea-tile-v01.webp', entry).href;
  const fx = createCombatVfx();
  layer.addChild(fx.view);
  const fighter = createFighterView({ pilotId: 'pilot-01', size: 5 });
  layer.addChild(fighter);

  function syncUrl() {
    history.replaceState(null, '', previewUrl(location.href, state));
    $('#share-url').value = previewUrl(entryUrl, state).href;
    $('#share-status').textContent = '';
  }
  function syncControls() {
    for (const key of ['quality', 'level', 'scene', 'speed']) $(`#${key}`).value = state[key];
    $('#level-range').value = state.level;
    for (const key of ['moving', 'bullets']) $(`#${key}`).checked = state[key];
    $('#pause').textContent = state.paused ? '继续播放' : '暂停观察';
    $('#pause').setAttribute('aria-pressed', String(state.paused));
    $('#play-state').textContent = state.paused ? '已暂停 · 可逐帧推进' : `${state.speed}× 实时试射`;
    $('#upgrade-level').disabled = state.level === 100;
    $('#upgrade-level').textContent = state.level === 100 ? '已达 100 级' : '强化 +10 级';
  }
  function newTarget(x, y, slot) {
    return { id: `target-${++serial}`, x, y, radius: 18, hp: state.scene === 'kills' ? 24 : 1e9, slot, reward: 3 };
  }
  function targetPosition(i) {
    if (active.mechanic === 'sidegun') return { x: i % 2 ? 460 : 140, y: 700 + Math.floor(i / 5) * 140 };
    const close = ['toxin', 'mine', 'blades', 'gravity'].includes(active.mechanic);
    return { x: state.scene === 'single' ? 300 : 210 + (i % 5) * 45,
      y: active.mechanic === 'tail' ? 1090 + Math.floor(i / 5) * 65 : close ? 830 + Math.floor(i / 5) * 70 : 370 + Math.floor(i / 5) * 160 };
  }
  function ruleRows(rules) {
    return rules.slice(0, state.quality + 1).map((rule, i) => {
      const p = document.createElement('p');
      p.textContent = `${WEAPON_QUALITIES[i]}：${rule}`;
      return p;
    });
  }
  function select(key, quality = state.quality, level = state.level, { firstFrame = true } = {}) {
    state = normalizePreviewState({ ...state, weapon: key, quality, level });
    active = COMMON_WEAPONS[state.weapon];
    combat?.dispose();
    fx.clear();
    time = 0; hits = 0; kills = 0; hostiles = []; nextBullet = 0; accumulator = 0;
    const loadout = compileAirframeLoadout('pilot-01', { [active.id]: ['W1', 'W2'] });
    Object.assign(loadout.weapons[0], { qualityRank: state.quality, level: state.level });
    combat = createCommonCombat(loadout);
    syncControls();
    $('#title').textContent = active.name;
    $('#badge').textContent = `${active.name} · ${WEAPON_QUALITIES[state.quality]} · Lv.${state.level}`;
    $('#description').textContent = active.role;
    $('#rules').replaceChildren(...ruleRows(active.qualityRules));
    $('#visual').textContent = `本档表现：${active.qualityVisuals[state.quality]}`;
    const upgrade = $('#upgrade-quality');
    upgrade.textContent = state.quality === 5 ? '已达神话品质' : `升品至${WEAPON_QUALITIES[state.quality + 1]}`;
    upgrade.disabled = state.quality === 5;
    const summary = document.createElement('summary');
    summary.textContent = `已继承的视觉效果（${state.quality + 1} 档）`;
    $('#visual-rules').replaceChildren(summary, ...ruleRows(active.qualityVisuals));
    $('#acceptance').textContent = `观察要点：${active.visual.acceptance}`;
    const stats = commonWeaponStats(loadout.weapons[0]);
    $('#stats').textContent = `基础伤害 ${Number(stats.damage.toFixed(2))} · 发射间隔 ${stats.interval} 秒`;
    for (const button of nav.children) button.setAttribute('aria-pressed', String(button.dataset.key === active.id));
    const selected = nav.querySelector('[aria-pressed="true"]');
    const bounds = nav.getBoundingClientRect(), itemBounds = selected.getBoundingClientRect();
    if (itemBounds.top < bounds.top) nav.scrollTop -= bounds.top - itemBounds.top;
    else if (itemBounds.bottom > bounds.bottom) nav.scrollTop += itemBounds.bottom - bounds.bottom;
    targets = state.scene === 'empty' ? [] : Array.from({ length: state.scene === 'single' ? 1 : 15 }, (_, i) => {
      const p = targetPosition(i);
      return newTarget(p.x, p.y, i);
    });
    syncUrl();
    // Give paused selections a real first frame without waiting for animation.
    if (firstFrame) { step(1 / 60); render(); }
  }
  function step(dt) {
    time += dt;
    const origin = { x: 300 + (state.moving ? Math.sin(time * 3) * 120 : 0), y: 1000 + (state.moving ? Math.sin(time * 1.5) * 60 : 0) };
    fighter.position.set(origin.x, origin.y);
    fighter.updateAircraft(time);
    if (state.bullets && time >= nextBullet) {
      nextBullet = time + .4;
      for (const [i, x] of [230, 300, 370].entries()) hostiles.push({ id: `hostile-${++serial}`, x, y: 400, vx: 0, vy: 300, radius: 5, enhanced: i === 1 });
    }
    for (const bullet of hostiles) bullet.y += bullet.vy * dt;
    hostiles = hostiles.filter(b => b.y < 1300 && !b.blocked);
    const living = targets.filter(t => !t.dead);
    for (const shot of combat.step(dt, { hasTargets: true, targets: living, origin, height: 1300, width: 600, hostiles })) combat.launch(shot, { x: origin.x, y: origin.y - 30 });
    // Resolve combat's hit/death receipts, including secondary death effects.
    for (let pass = 0; pass < 32; pass++) {
      const receipts = combat.takeWorldEffects();
      if (!receipts.length) break;
      for (const e of receipts) {
        if (e.hostileId) { const b = hostiles.find(b => b.id === e.hostileId); if (b) b.blocked = true; continue; }
        const target = targets.find(t => t.id === e.targetId);
        if (!target || target.dead) continue;
        if (e.control) { if (e.dx) target.x += e.dx; if (e.dy) target.y += e.dy; continue; }
        if (combat.hit(e.source, target.id)) {
          hits++;
          target.hp -= e.damage;
          if (target.hp <= 0) { target.dead = true; target.respawn = time + .8; kills++; }
          combat.resolveHit(e.source, e.damage, target.dead, target.id);
        }
      }
    }
    targets = targets.map(t => {
      if (!t.dead || time < t.respawn) return t;
      const p = targetPosition(t.slot);
      return newTarget(p.x, p.y, t.slot);
    });
    const visuals = combat.energyVisuals();
    fx.setEnergy([...visuals, ...weaponPreviewTargetVisuals(targets.filter(t => !t.dead)),
      ...hostiles.filter(b => !b.blocked).map(b => ({ id: b.id, kind: 'glyph', shape: 'orb', x: b.x, y: b.y, points: [b], radius: b.radius, color: b.enhanced ? 0xff648d : 0xffb36a, alpha: 1 }))], [], []);
    fx.step(dt, []);
    sea.update(time);
    $('#metrics').textContent = `${time.toFixed(1)} 秒 · ${hits} 次命中 · ${kills} 次击杀 · ${combat.energyCounts().projectiles} 弹体 / ${combat.energyCounts().drones} 无人机`;
    return visuals;
  }
  function render() {
    const w = $('#viewport').clientWidth, h = $('#viewport').clientHeight;
    if (!w || !h) return;
    if (renderer.screen.width !== w || renderer.screen.height !== h) renderer.resize(w, h);
    frame.scale.set(Math.min(w / 600, h / 1300));
    frame.position.set((w - 600 * frame.scale.x) / 2, (h - 1300 * frame.scale.x) / 2);
    renderer.render({ container: stage });
  }
  function configure(patch = {}) {
    state = normalizePreviewState({ ...state, ...patch });
    select(state.weapon);
  }
  function setPaused(paused) {
    state.paused = paused;
    accumulator = 0;
    syncControls();
    syncUrl();
  }
  function advance(seconds) {
    setPaused(true);
    const seen = new Set();
    for (let i = 0; i < Math.round(seconds * 60); i++) for (const v of step(1 / 60)) seen.add(v.shape || v.kind);
    render();
    return { shapes: [...seen], gpu: fx.snapshot(), hits, kills };
  }
  listen(nav, 'click', e => { const button = e.target.closest('button[data-key]'); if (button) select(button.dataset.key); });
  listen($('#quality'), 'change', e => select(state.weapon, e.target.value));
  listen($('#level'), 'change', e => select(state.weapon, state.quality, e.target.value));
  listen($('#level-range'), 'input', e => select(state.weapon, state.quality, e.target.value));
  listen($('#upgrade-quality'), 'click', () => select(state.weapon, state.quality + 1));
  listen($('#upgrade-level'), 'click', () => select(state.weapon, state.quality, state.level + 10));
  listen($('#scene'), 'change', e => configure({ scene: e.target.value }));
  listen($('#speed'), 'change', e => { state.speed = Number(e.target.value); syncControls(); syncUrl(); });
  for (const key of ['moving', 'bullets']) listen($(`#${key}`), 'change', e => configure({ [key]: e.target.checked }));
  listen($('#pause'), 'click', () => setPaused(!state.paused));
  listen($('#restart'), 'click', () => select(state.weapon));
  listen($('#advance'), 'click', () => advance(1));
  listen($('#advance-fine'), 'click', () => advance(.1));
  listen($('#copy-link'), 'click', async () => {
    $('#share-url').value = previewUrl(entryUrl, state).href;
    try {
      await navigator.clipboard.writeText($('#share-url').value);
      $('#share-status').textContent = '链接已复制';
    } catch {
      // LAN HTTP has no Clipboard API; offer a selectable link instead.
      $('#share-panel').hidden = false;
      $('#share-url').focus();
      $('#share-url').select();
      $('#share-status').textContent = '请复制下方链接';
    }
  });
  listen(window, 'popstate', () => configure(readPreviewState(location.search)));
  listen(window, 'resize', render);
  let previous = performance.now();
  function animate(now) {
    const dt = Math.min(.1, (now - previous) / 1000);
    previous = now;
    if (!state.paused && !document.hidden) {
      accumulator += dt * state.speed;
      // All playback speeds retain combat's fixed 60 Hz simulation step.
      while (accumulator >= 1 / 60) { step(1 / 60); accumulator -= 1 / 60; }
      render();
    }
    animation = requestAnimationFrame(animate);
  }
  function dispose() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(animation);
    events.abort();
    seaImage.onload = null;
    combat.dispose();
    fx.dispose();
    sea.dispose();
    stage.destroy({ children: true });
    renderer.destroy();
    delete window.__COMBAT_VFX_PREVIEW__;
  }
  listen(window, 'pagehide', event => { if (!event.persisted) dispose(); });
  select(state.weapon);
  window.__COMBAT_VFX_PREVIEW__ = {
    ready: true, fx, renderer, select, configure, advance, dispose,
    get state() { return { ...state }; }, get time() { return time; },
    get combat() { return combat; }, get targets() { return targets; },
    sample(key, seconds, quality = 0) {
      setPaused(true);
      select(key, quality === true ? 5 : quality, state.level, { firstFrame: false });
      advance(seconds);
      return { gpu: fx.snapshot(), combat: combat.snapshot(), hits, kills };
    },
  };
  animation = requestAnimationFrame(animate);
  return window.__COMBAT_VFX_PREVIEW__;
}
