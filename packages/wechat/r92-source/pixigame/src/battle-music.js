export const PATHOGENIC_BATTLE_TRACKS = Object.freeze([
  new URL('../assets/audio/sfx/music/brain_fight.ogg', import.meta.url).href,
  new URL('../assets/audio/sfx/music/heart_fight.ogg', import.meta.url).href,
  new URL('../assets/audio/sfx/music/intestine_fight.ogg', import.meta.url).href,
  new URL('../assets/audio/sfx/music/liver_fight.ogg', import.meta.url).href,
  new URL('../assets/audio/sfx/music/lungs_fight.ogg', import.meta.url).href,
  new URL('../assets/audio/sfx/music/skin_fight.ogg', import.meta.url).href,
  new URL('../assets/audio/sfx/music/stomach_fight.ogg', import.meta.url).href,
]);

export const PATHOGENIC_BOSS_TRACK = new URL('../assets/audio/sfx/music/heart_boss.ogg', import.meta.url).href;

export function pathogenicBattleMusic(chapterId, manifest, mainKey, bossKey = 'BGM_BOSS_temp') {
  const chapter = Number.isFinite(Number(chapterId)) ? Math.max(1, Math.floor(Number(chapterId))) : 1;
  const fight = PATHOGENIC_BATTLE_TRACKS[(chapter - 1) % PATHOGENIC_BATTLE_TRACKS.length];
  const keys = new Set(Object.entries(manifest).filter(([key, entry]) => /BGM/i.test(key) || entry?.music).map(([key]) => key));
  keys.add(mainKey || 'BGM_Battle_pathogenic');
  keys.add(bossKey);
  return Object.fromEntries([...keys].map(key => [key, { url: key === bossKey || /BOSS/i.test(key) ? PATHOGENIC_BOSS_TRACK : fight, music: true }]));
}
