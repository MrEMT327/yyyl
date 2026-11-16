export function createNativeBattleRenderBudget({width, height, pixelRatio}, worldWidth) {
  const screenWidth = Math.min(width, height * 540 / 960) * pixelRatio;
  const aircraftTextureSize = screenWidth <= 900 ? 192 : 256;
  const cameraPixels = 540 / worldWidth;
  let previous;
  return {
    aircraftTextureSize,
    shouldDrawTerrain(time, run, weather, x, z) {
      // The scrolling scenery only needs one new image per logic interval.
      // Teleports and lighting changes still require the current image now.
      const tick = Math.floor(time * 30 + 0.001);
      if (previous && previous.run === run && previous.weather === weather && time >= previous.time &&
          tick === previous.tick && Math.hypot(x - previous.x, z - previous.z) * cameraPixels < 24) return false;
      previous = { time, tick, run, weather, x, z };
      return true;
    },
    reset() { previous = undefined; },
  };
}
