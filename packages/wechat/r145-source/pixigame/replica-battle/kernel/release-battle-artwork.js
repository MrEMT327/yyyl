// Keep the measurements used to fit replacement art to each model.
export function cleanBattleArtwork(assets, canLoadArt) {
  for (const sprites of [assets.sprites, assets.enemyHealthBars.sprites]) {
    for (const [key, sprite] of Object.entries(sprites)) {
      if (!sprite.url || canLoadArt(sprite.url)) continue;
      const { url, ...geometry } = sprite;
      sprites[key] = geometry;
    }
  }
  for (const [key, sound] of Object.entries(assets.audio)) {
    if (!sound.url || !canLoadArt(sound.url)) delete assets.audio[key];
  }
  for (const [name, prefab] of Object.entries(assets.prefabs)) {
    if (!prefab.spine) continue;
    const { spine, ...layout } = prefab;
    assets.prefabs[name] = layout;
  }
  delete assets.uiFont;
}
