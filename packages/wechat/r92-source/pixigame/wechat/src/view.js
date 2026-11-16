import { createCanvasAssets, createCanvasSurface } from '../../src/ui/canvas-surface.js';
import { MODULAR_ASSETS, MODULAR_ISLANDS, MODULAR_TERRAIN_SETTINGS } from '../../src/three/stage1-modular-layout.js';
import { nativeWeaponDisplayText } from '../../src/replica/native-weapon-display.js';
import { sortieAircraftFrame } from '../../src/ui/sortie-aircraft-image.js';

export const width = 750;
export const height = 1624;
const sea = 'art/stage1-anime-v8/ocean.png';
const aircraft = 'art/sortie-aircraft-front-v1/pilot-01.webp';
const coin = 'art/project-coin-pickup-v1/coin-front-v1.png';
const white = '#eff8ff';
const cyan = '#8bd7eb';
const gold = '#ffdd8e';
const clamp = value => Math.max(0, Math.min(1, value));

export function createView(canvas, api, resolveAsset) {
  const assets = createCanvasAssets({ createImage: () => canvas.createImage?.() ?? api.createImage(), resolve: resolveAsset, limit: 35 });
  const surface = createCanvasSurface(canvas, assets);
  const { ctx, image, rect, text, wrap, button } = surface;
  let viewport;

  function resize() {
    const info = api.getWindowInfo();
    const dpr = Math.min(2, info.pixelRatio || 1);
    canvas.width = Math.round(info.windowWidth * dpr);
    canvas.height = Math.round(info.windowHeight * dpr);
    const top = info.safeArea?.top ?? 0;
    const bottom = info.safeArea?.bottom ?? info.windowHeight;
    const scale = Math.min(info.windowWidth / width, (bottom - top) / height);
    viewport = { scale, dpr, x: (info.windowWidth - width * scale) / 2,
      y: top + (bottom - top - height * scale) / 2 };
  }

  function begin() {
    surface.clear();
    rect(0, 0, canvas.width, canvas.height, '#040c14');
    ctx.save();
    const { scale, dpr, x, y } = viewport;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, x * dpr, y * dpr);
    ctx.beginPath(); ctx.rect(0, 0, width, height); ctx.clip();
  }

  function status(title, lines) {
    rect(65, 455, 620, 645, 'rgba(12,29,43,.95)');
    rect(65, 455, 620, 4, '#4eabc5');
    text(title, 375, 540, 43, white, 'center');
    wrap(lines, 104, 620, 540, 27, 8);
  }

  function meter(x, y, w, h, value, color) {
    rect(x, y, w, h, '#0b1b27');
    rect(x + 3, y + 3, (w - 6) * clamp(value), h - 6, color);
  }

  function terrain(sim, project, chapterArt) {
    rect(0, 0, width, height, '#164e72');
    if (chapterArt) { image(chapterArt, 0, 0, width, height, 'cover'); return; }
    const offset = (sim.time * 19) % height;
    image(sea, 0, offset - height, width, height, 'cover');
    image(sea, 0, offset, width, height, 'cover');
    const { top, bottom } = sim.cameraWorldBounds;
    const { loopUnits, nativeSpeed } = MODULAR_TERRAIN_SETTINGS;
    const motion = sim.time * nativeSpeed;
    for (const region of MODULAR_ISLANDS) {
      const asset = MODULAR_ASSETS[region.asset];
      const z = region.z - motion + Math.round(((top + bottom) / 2 - region.z + motion) / loopUnits) * loopUnits;
      const [x, y] = project(region.x, z);
      const [edge] = project(region.x + region.width, z);
      const w = edge - x, h = w * asset.height / asset.width;
      if (y + h / 2 < 0 || y - h / 2 > height) continue;
      image(`art/stage1-anime-v8/${region.asset}.png`, x - w / 2, y - h / 2, w, h);
    }
  }

  function battle(sim, actions, chapterArt, aircraftId, message) {
    const { left, right, top, bottom } = sim.cameraWorldBounds;
    const project = (x, z) => [(x - left) * width / (right - left), (top - z) * height / (top - bottom)];
    terrain(sim, project, chapterArt);

    for (const pickup of sim.pickups) {
      const [x, y] = project(pickup.x, pickup.z);
      if (pickup.kind === 'gold') image(coin, x - 13, y - 13, 26, 26);
      else if (pickup.kind === 'heart') text('✚', x, y, 30, '#68ffc1', 'center');
      else rect(x - 4, y - 4, 8, 8, '#65deff');
    }
    for (const chest of sim.treasures) {
      const [x, y] = project(chest.x, chest.z);
      rect(x - 22, y - 16, 44, 32, '#b27833');
      rect(x - 6, y - 6, 12, 12, gold);
    }
    for (const enemy of sim.enemies) {
      if (enemy.dead) continue;
      const [x, y] = project(enemy.x, enemy.z);
      const size = enemy.boss ? 190 : enemy.elite ? 98 : 58;
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI);
      if (!enemy.hitFlash) ctx.globalAlpha = .86;
      image(aircraft, -size / 2, -size / 2, size, size);
      ctx.restore();
      if (enemy.elite || enemy.boss || enemy.hp < enemy.maxHp) meter(x - size * .38, y - size * .47, size * .76, 9, enemy.hp / enemy.maxHp, '#f65d6d');
    }
    for (const shot of sim.projectiles) {
      if (shot.dead || shot.visualHidden) continue;
      const [x, y] = project(shot.x, shot.z);
      const hostile = shot.owner === 'enemy';
      ctx.strokeStyle = hostile ? '#ff6374' : '#fff1be';
      ctx.lineWidth = hostile ? 6 : 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      if (shot.segments?.length && (shot.ray || shot.beam)) {
        for (const segment of shot.segments) {
          ctx.moveTo(...project(segment.from.x, segment.from.z));
          ctx.lineTo(...project(segment.to.x, segment.to.z));
        }
      } else {
        const angle = Math.atan2(-shot.vz, shot.vx);
        ctx.moveTo(x, y);
        ctx.lineTo(x - Math.cos(angle) * 13, y - Math.sin(angle) * 13);
      }
      ctx.stroke();
    }
    const [x, y] = project(sim.player.x, sim.player.z);
    if (sim.player.hp > 0) {
      const frame = sortieAircraftFrame(aircraftId);
      image(`art/sortie-aircraft-front-v1/${frame.file}`, x - 48, y - 50, 96, 96);
      meter(x - 41, y + 49, 82, 12, sim.player.hp / sim.player.maxHp, '#63e7af');
    }
    for (const effect of sim.effects) {
      const [fx, fy] = project(effect.x, effect.z);
      const t = clamp(effect.age / effect.duration);
      ctx.save(); ctx.globalAlpha = 1 - t;
      if (effect.kind === 'text' || effect.kind === 'heal') text(effect.value || '✚', fx, fy - t * 38, 24, effect.kind === 'heal' ? '#68ffc1' : gold, 'center');
      else {
        ctx.fillStyle = '#ffbd6c'; ctx.beginPath();
        ctx.arc(fx, fy, (effect.kind === 'explosion' ? 34 : 13) * (.2 + t), 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    rect(16, 18, 718, 88, 'rgba(8,26,40,.86)');
    if (sim.phase === 'playing') button('pause', 'Ⅱ', 30, 32, 76, 58, actions.pause);
    text(`波次 ${sim.wave}/${sim.content.chapter.chapter.waveCount}`, 128, 62, 27);
    text(`击破 ${sim.kills}   金币 ${Math.floor(sim.gold)}`, 707, 62, 26, white, 'right');
    if (sim.boss) meter(130, 111, 490, 20, sim.boss.hp / sim.boss.maxHp, '#ff5c71');
    rect(20, 1530, 710, 72, 'rgba(8,26,40,.84)');
    text(`等级 ${sim.level}`, 35, 1551, 26);
    text(`生命 ${Math.ceil(sim.player.hp)}/${Math.ceil(sim.player.maxHp)}`, 714, 1551, 24, white, 'right');
    meter(32, 1575, 686, 17, sim.expProgress, '#4ad2ed');
    if (sim.phase === 'playing' && message) {
      rect(0, 280, width, 82, 'rgba(145,30,43,.87)'); text(message, 375, 322, 38, white, 'center');
    }
    if (sim.phase !== 'playing') {
      rect(0, 0, width, height, 'rgba(3,14,24,.74)');
      if (sim.phase === 'upgrade') {
        text('选择强化', 375, 525, 46, white, 'center');
        const cardWidth = Math.min(223, 640 / sim.choices.length);
        const start = (width - (cardWidth + 12) * sim.choices.length + 12) / 2;
        sim.choices.forEach((choice, index) => {
          const x = start + (cardWidth + 12) * index;
          rect(x, 608, cardWidth, 315, '#1c394f');
          rect(x, 608, cardWidth, 5, choice.advance ? gold : cyan);
          text(nativeWeaponDisplayText(choice.name), x + cardWidth / 2, 662, 27, white, 'center', cardWidth - 16);
          wrap(nativeWeaponDisplayText(choice.description), x + 14, 722, cardWidth - 28, 22, 5);
          surface.hit(`choice-${choice.id}`, x, 608, cardWidth, 315, () => sim.choose(choice.id));
        });
      } else if (sim.phase === 'paused') {
        status('暂停', '');
        button('resume', '继续', 187, 718, 376, 84, actions.resume, false, true);
        button('leave', '返回大厅', 187, 832, 376, 84, actions.leave);
      } else if (sim.phase === 'treasure') {
        status('空投补给', sim.treasureRewards.map(reward => nativeWeaponDisplayText(reward.name)).join('\n'));
        button('treasure', '领取', 187, 925, 376, 84, () => sim.closeTreasure(), false, true);
      } else if (sim.phase === 'revive') {
        status('战机受损', '');
        button('decline', '结束战斗', 187, 832, 376, 84, () => sim.declineRevive());
      } else {
        status(sim.phase === 'won' ? '通关' : '战败', `击破 ${sim.kills} 架 · 拾取 ${Math.floor(sim.gold)} 金币`);
        button('leave', '返回大厅', 187, 832, 376, 84, actions.leave, false, true);
      }
    }
  }

  resize();
  return { resize, begin, end: () => ctx.restore(), battle, status, meter, text, button,
    present(source) { ctx.drawImage(source, 0, 0, width, height); },
    find(x, y) { return surface.find(x, y); },
    point(x, y) { return { x: (x - viewport.x) / viewport.scale, y: (y - viewport.y) / viewport.scale }; },
  };
}
