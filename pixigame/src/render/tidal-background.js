import { Container, Graphics, Rectangle, Sprite, Texture } from '../three/display.js';
import { createVisualSwitch } from './entity-visual.js';

export const TIDAL_THEME_ID = 'tidal-retro';
const stageVisualThemes = Object.freeze(Object.fromEntries(
  ['aries', 'taurus', 'gemini', 'cancer', 'leo'].map(id => [id, TIDAL_THEME_ID]),
));

export const TIDAL_ASSET_IDS = ['tidal-sea-tile', 'tidal-coast-left', 'tidal-island-small', 'tidal-cloud-soft'];
const wrap = (value, period) => {
  const phase = ((value % period) + period) % period;
  return phase < 1e-7 || period - phase < 1e-7 ? 0 : phase;
};
const specifications = {
  sea: { count: 6, width: 600, height: 600, period: 3600, speed: 28, alpha: 1, x: () => 0 },
  coast: { count: 3, frame: [90, 0, 464, 1536], width: 160, height: 1536 * 160 / 464, period: 3300, speed: 35, alpha: .88, x: () => 0 },
  islands: { count: 4, frame: [350, 204, 575, 831], width: 575 * 128 / 831, height: 128, period: 2200, speed: 35, alpha: .86, x: i => i % 2 ? 478 : 54 },
  clouds: { count: 4, frame: [40, 490, 1150, 330], width: 180, height: 330 * 180 / 1150, period: 2600, speed: 19, alpha: .16, x: i => i % 2 ? 478 : -35 },
};

// Bounded phases avoid accumulating an ever-growing travel value. An even sea
// pool keeps identical source edges together across recycling, without assuming
// the artwork is seamless. Sprites recycle only beyond the viewport.
export function createTidalState() {
  const state = { scroll: {} };
  for (const [key, spec] of Object.entries(specifications)) {
    state.scroll[key] = 0;
    state[key] = Array.from({ length: spec.count }, (_, i) => ({
      x: spec.x(i), y: 0, width: spec.width, height: spec.height,
      period: spec.period, flip: key === 'sea' && i % 2 === 1,
    }));
  }
  state.advance = dt => {
    if (!Number.isFinite(dt)) return;
    for (const [key, spec] of Object.entries(specifications)) {
      const delta = (dt % (spec.period / spec.speed)) * spec.speed;
      state.scroll[key] = wrap(state.scroll[key] + delta, spec.period);
      state[key].forEach((item, i) => {
        item.y = wrap(i * spec.period / spec.count + state.scroll[key], spec.period) - spec.height;
        item.x = spec.x(i) + (key === 'islands' || key === 'clouds'
          ? Math.sin((state.scroll[key] / spec.period + i / spec.count) * Math.PI * 2) * 6 : 0);
      });
    }
  };
  state.advance(0);
  return state;
}

export function createTidalBackground(parent, legacy, textures) {
  const root = new Container({ label: 'tidal-islands-background', eventMode: 'none' });
  const state = createTidalState();
  const pools = {};
  const textureStatus = Object.fromEntries(TIDAL_ASSET_IDS.map(id => [id, Boolean(textures[id])]));
  const ready = textureStatus['tidal-sea-tile'];
  Object.entries(specifications).forEach(([key, spec], index) => {
    const layer = new Container({ label: `tidal-${key}`, eventMode: 'none' });
    root.addChild(layer);
    const sourceTexture = ready ? textures[TIDAL_ASSET_IDS[index]] : null;
    // Keep the soft transparent margins, but fit the authored subject instead of
    // stretching the entire source canvas. Each pool shares one frame texture.
    const texture = sourceTexture && spec.frame
      ? new Texture({ source: sourceTexture.source, frame: new Rectangle(...spec.frame) })
      : sourceTexture;
    pools[key] = texture ? state[key].map(item => {
      const sprite = new Sprite(texture);
      sprite.width = item.width; sprite.height = item.height; sprite.alpha = spec.alpha;
      // Slightly darken water so bullet highlights retain priority.
      if (key === 'sea') sprite.tint = 0xc1d6d3;
      if (item.flip) { sprite.anchor.y = 1; sprite.scale.y *= -1; }
      layer.addChild(sprite);
      return sprite;
    }) : [];
  });
  // The stage is letterboxed on wide screens; clip every recycled tile and
  // translucent decoration at the logical world boundary, once per lifetime.
  const viewportMask = new Graphics({ label: 'tidal-viewport-mask', eventMode: 'none' })
    .rect(0, 0, 600, 1300).fill(0xffffff);
  root.addChild(viewportMask);
  root.mask = viewportMask;
  const swap = createVisualSwitch(parent, legacy, root);
  const sync = () => {
    for (const key of Object.keys(pools)) pools[key].forEach((sprite, i) => {
      const item = state[key][i];
      sprite.position.set(item.x, item.y);
      sprite.visible = item.y < 1300 && item.y + item.height > 0;
    });
  };
  sync();
  const result = {
    root, active: false,
    setStage(stageId) { result.active = ready && stageVisualThemes[stageId] === TIDAL_THEME_ID; swap.set(result.active); },
    update(dt, playing) { if (!result.active || !playing) return; state.advance(dt); sync(); },
    snapshot() {
      return { id: result.active ? TIDAL_THEME_ID : null, active: result.active, scroll: { ...state.scroll }, textures: { ...textureStatus },
        pools: Object.fromEntries(Object.entries(pools).map(([key, items]) => [key, items.length])),
        items: Object.fromEntries(Object.entries(pools).map(([key, items]) => [key, items.map((sprite,i) => ({ ...state[key][i], visible: sprite.visible }))])),
      };
    },
  };
  return result;
}
