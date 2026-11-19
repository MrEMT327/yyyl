import './style.css';
import './original-ui.css';
import { loadContent } from './content';
import { Simulation } from './simulation';
import { BattleView, makeGame } from './renderer';
import { GameAudio } from './audio';
import { Controls } from './input';
import { Interface } from './ui';
import { nativeLogicRate, nativeLogicDelta } from './native-time';
import { mountStudyLoadout } from './loadout';
import { loadLoadoutCatalog, loadStudyLoadoutState, applyStudyLoadout } from './loadout-state';

async function main() {
  const [content, loadoutCatalog] = await Promise.all([loadContent(), loadLoadoutCatalog(), document.fonts.load('16px DankeUI')]);
  const sim = new Simulation(content);
  const audio = new GameAudio(content.assets.audio);
  let controls: Controls, ui: Interface;
  let studyLoadout: ReturnType<typeof mountStudyLoadout> | undefined;
  const scene = new BattleView(content, sim, () => { ui.update(); studyLoadout?.update(); });
  const stage = document.getElementById('stage')!;
  const start = () => {
    // A saved research configuration owns entry stats. The old per-chapter
    // input never silently overrides it; debug overrides are explicit in state.
    applyStudyLoadout(content, sim, loadoutCatalog, loadStudyLoadoutState(loadoutCatalog));
    controls.clear(); audio.unlock().catch(() => {}); sim.start();
    audio.startMusic(content.chapter.musicKey); audio.restart(); ui.update(); studyLoadout?.update();
  };
  ui = new Interface(document.getElementById('ui')!, sim, audio, content.assets.sprites, start);
  controls = new Controls(stage, () => sim.phase === 'playing' && sim.player.hp > 0, () => ui.togglePause());
  studyLoadout = mountStudyLoadout({ content, sim, onStart: start });
  const sounds: Record<number, string> = { 260002: 'deng~', 260003: 'battle_restore', 300002: 'FireShoot', 230003: 'Bullet_Laser', 330001: 'Hitted_Plane', 330004: 'Hitted_Plane', 330003: 'Hitted_Plane', 330006: 'Death_Plane_Short', 330007: 'Death_jingying', 330008: 'Death_jingying', 210001: 'Death_plane_long', 410001: 'Out_LevelUp_Show' };
  let accumulated = 0;
  // Const.BattleLogicFrameRate = 30 (dump.cs). Task callbacks and next-frame
  // buffs must use the native logic cadence, independently of rendering FPS.
  const logicStep = 1 / nativeLogicRate;
  // WorldBattle.InitFrameTime writes FP.RawValue 0x888, not the JS quotient
  // 1/30. Keep the wall-clock cadence separate from the simulation delta.
  const nativeDelta = nativeLogicDelta;
  scene.onFrame = delta => {
    if (sim.phase !== 'playing') { accumulated = 0; controls.clear(); sim.advanceResultPresentation(Math.min(delta / 1000, .1)); ui.update(); studyLoadout?.update(); return; }
    accumulated += Math.min(delta / 1000, 0.1);
    while (accumulated >= logicStep && sim.phase === 'playing') {
      const viewCamera = scene.cameraPosition;
      const movement = controls.read(nativeDelta, content.world.width, content.world.height, sim.playerMovementSpeed,
        { x: sim.player.x, y: -sim.player.z }, sim.playerMovementBounds, { x: viewCamera.x, y: -viewCamera.z });
      sim.step(nativeDelta, { x: movement.x, z: -movement.y, dirX: movement.dirX, dirZ: movement.dirZ, rawX: movement.rawX }); accumulated -= logicStep;
    }
    for (const id of sim.sounds) {
      const key = content.assets.soundKeys?.[id] || sounds[id];
      if (key) audio.effect(key, id === 300002 ? .2 : .4, id === 300002 ? .035 : .065);
    }
    for (const id of sim.musicRequests) {
      const key = content.assets.soundKeys?.[id] || (id === 100006 ? 'BGM_BOSS_temp' : undefined);
      if (id > 0 && key) audio.startMusic(key);
    }
    sim.musicRequests.length = 0;
    sim.sounds.length = 0; ui.update(); studyLoadout?.update();
  };
  document.addEventListener('visibilitychange', () => { if (document.hidden) { sim.pause(); controls.clear(); audio.pause(); ui.update(); } });
  window.addEventListener('blur', () => { sim.pause(); audio.pause(); ui.update(); });
  makeGame(scene);
}
main().catch(error => {
  console.error(error);
  const loading = document.querySelector('#loading');
  if (loading) { loading.replaceChildren(); const title = document.createElement('b'); title.textContent = '关卡加载失败'; const detail = document.createElement('span'); detail.textContent = error.message; const retry = document.createElement('button'); retry.textContent = '重新加载'; retry.onclick = () => location.reload(); loading.append(title, detail, retry); }
});
