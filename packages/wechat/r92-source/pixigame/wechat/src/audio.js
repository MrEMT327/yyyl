import { combatCues, pathogenicAudioManifest } from '../../replica-battle/kernel/combat-audio';

export function createWechatBattleAudio(api, resolveAsset, tracks) {
  const voices = new Map();
  let music, chapter, selected;

  function playEffect(key, volume, interval, clock) {
    const asset = pathogenicAudioManifest[key];
    if (!asset || !api.createInnerAudioContext) return;
    let voice = voices.get(key);
    if (!voice) {
      if (voices.size >= 12) {
        const oldest = [...voices.entries()].sort((a, b) => a[1].last - b[1].last)[0];
        oldest[1].audio.destroy(); voices.delete(oldest[0]);
      }
      const audio = api.createInnerAudioContext();
      audio.src = resolveAsset(asset.url);
      voice = { audio, last: -Infinity };
      voices.set(key, voice);
    }
    if (clock - voice.last < interval) return;
    voice.last = clock;
    voice.audio.volume = volume;
    voice.audio.stop(); voice.audio.play();
  }

  function playMusic(key) {
    if (!music || selected === key) return;
    const boss = key === chapter.boss || /boss/i.test(key);
    const file = boss ? tracks.boss : tracks.fight[(chapter.id - 1) % tracks.fight.length];
    if (!file) return;
    selected = key;
    music.src = resolveAsset(file);
    music.play();
  }

  function stop() {
    for (const { audio } of voices.values()) audio.destroy();
    voices.clear();
    music?.destroy(); music = undefined; selected = undefined;
  }

  return {
    start(content) {
      stop();
      if (!api.createInnerAudioContext) return;
      chapter = { id: content.chapter.chapter.id, boss: content.assets.soundKeys?.[100006] || 'BGM_BOSS_temp' };
      music = api.createInnerAudioContext(); music.loop = true; music.volume = .35;
      playMusic(content.chapter.musicKey || 'BGM_Battle_pathogenic');
    },
    update(sim) {
      for (const id of sim.sounds) {
        const cue = combatCues[id] ?? (id === 300002 ? { key: 'pathogenic:gun', volume: .18, interval: .075 } : undefined);
        if (cue) playEffect(cue.key, cue.volume, cue.interval, sim.clock);
      }
      for (const id of sim.musicRequests) playMusic(sim.content.assets.soundKeys?.[id] || (id === 100006 ? 'BGM_BOSS_temp' : ''));
      sim.sounds.length = 0; sim.musicRequests.length = 0;
    },
    pause() { music?.pause(); }, resume() { music?.play(); }, stop,
  };
}
