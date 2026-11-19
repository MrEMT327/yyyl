import { Container, Graphics } from './three/display.js';

function drawBossIdentity(config) {
  const color = config.accent;
  const g = new Graphics();
  if (config.pattern === 'charge') {
    g.poly([-48, -20, -65, -52, -56, -10, 56, -10, 65, -52, 48, -20])
      .stroke({ color, width: 6, alpha: 0.78 });
  } else if (config.pattern === 'walls') {
    g.poly([-68, -33, -45, -43, -31, -19, 31, -19, 45, -43, 68, -33])
      .fill({ color, alpha: 0.5 });
  } else if (config.pattern === 'twins') {
    g.circle(-29, -8, 17).stroke({ color, width: 5, alpha: 0.72 })
      .circle(29, -8, 17).stroke({ color, width: 5, alpha: 0.72 });
  } else if (config.pattern === 'claws') {
    g.circle(-59, 5, 15).stroke({ color, width: 6, alpha: 0.65 })
      .circle(59, 5, 15).stroke({ color, width: 6, alpha: 0.65 });
  } else if (config.pattern === 'solar') {
    for (let index = 0; index < 10; index += 1) {
      const angle = index / 10 * Math.PI * 2;
      g.poly([
        Math.cos(angle) * 42, Math.sin(angle) * 42,
        Math.cos(angle - 0.08) * 61, Math.sin(angle - 0.08) * 61,
        Math.cos(angle + 0.08) * 61, Math.sin(angle + 0.08) * 61,
      ]).fill({ color, alpha: 0.48 });
    }
  } else if (config.pattern === 'lances') {
    g.poly([-61, 26, -38, -41, -26, 26, 0, -53, 26, 26, 38, -41, 61, 26])
      .stroke({ color, width: 4, alpha: 0.62 });
  } else if (config.pattern === 'balance') {
    g.rect(-59, -31, 118, 5).fill({ color, alpha: 0.65 })
      .circle(-44, 2, 18).stroke({ color, width: 4, alpha: 0.55 })
      .circle(44, 2, 18).stroke({ color, width: 4, alpha: 0.55 });
  } else if (config.pattern === 'venom') {
    g.poly([0, 47, 19, 27, 31, 8, 20, -17, 39, -38])
      .stroke({ color, width: 6, alpha: 0.62 });
  } else if (config.pattern === 'arrows') {
    g.poly([-49, 30, 0, -52, 49, 30]).stroke({ color, width: 5, alpha: 0.62 })
      .poly([0, -63, 8, -46, -8, -46]).fill({ color, alpha: 0.9 });
  } else if (config.pattern === 'mountain') {
    g.poly([-65, 30, -35, -37, 0, 3, 33, -55, 65, 30])
      .stroke({ color, width: 5, alpha: 0.58 });
  } else if (config.pattern === 'streams' || config.pattern === 'tsunami') {
    for (let index = -1; index <= 1; index += 1) {
      g.moveTo(-70, index * 17)
        .bezierCurveTo(-31, index * 17 - 22, 31, index * 17 + 22, 70, index * 17)
        .stroke({ color, width: config.pattern === 'tsunami' ? 5 : 3, alpha: 0.54 });
    }
  } else if (config.pattern === 'spiral') {
    g.circle(-27, 0, 20).stroke({ color, width: 5, alpha: 0.58 })
      .circle(27, 0, 20).stroke({ color, width: 5, alpha: 0.58 });
  } else if (config.pattern === 'war') {
    g.poly([-62, 29, -12, -50, 0, -15, 12, -50, 62, 29])
      .stroke({ color, width: 7, alpha: 0.72 });
  } else if (config.pattern === 'aegis') {
    g.poly([0, -59, 51, -31, 42, 29, 0, 52, -42, 29, -51, -31])
      .stroke({ color, width: 6, alpha: 0.72 });
  } else if (config.pattern === 'underworld') {
    g.circle(0, -5, 49).stroke({ color, width: 6, alpha: 0.44 })
      .circle(-18, -5, 9).fill({ color, alpha: 0.58 })
      .circle(18, -5, 9).fill({ color, alpha: 0.58 });
  } else if (config.pattern === 'thunder') {
    g.poly([-15, -62, 19, -23, 1, -18, 24, 18, -8, 5, 6, 51, -30, 3, -11, -4])
      .fill({ color, alpha: 0.78 });
  }
  return g;
}

export function createBossPortrait(config, {
  width = 150,
  height = 110,
  alpha = 1,
  showIdentity = true,
} = {}) {
  const root = new Container();
  const aura = new Graphics()
    .ellipse(0, 7, 76, 37)
    .fill({ color: config.color, alpha: 0.12 })
    .circle(0, -3, 60)
    .stroke({ color: config.accent, width: 1.5, alpha: 0.2 });
  const engines = new Graphics()
    .poly([-45, 22, -34, 22, -40, 51]).fill({ color: config.color, alpha: 0.34 })
    .poly([45, 22, 34, 22, 40, 51]).fill({ color: config.color, alpha: 0.34 })
    .poly([-43, 23, -37, 23, -40, 43]).fill({ color: 0xfff0aa, alpha: 0.7 })
    .poly([43, 23, 37, 23, 40, 43]).fill({ color: 0xfff0aa, alpha: 0.7 });
  const body = new Graphics()
    .poly([0, 46, -57, 27, -73, -3, -51, -25, -28, -20, -16, -44, 0, -57, 16, -44, 28, -20, 51, -25, 73, -3, 57, 27])
    .fill({ color: config.color, alpha: 0.58 })
    .stroke({ color: config.accent, width: 1.5, alpha: 0.72 })
    .poly([0, 37, -21, 15, -15, -31, 0, -47, 15, -31, 21, 15])
    .fill({ color: config.color, alpha: 0.96 })
    .poly([-62, -1, -33, -14, -27, 10, -50, 24])
    .fill({ color: config.accent, alpha: 0.52 })
    .poly([62, -1, 33, -14, 27, 10, 50, 24])
    .fill({ color: config.accent, alpha: 0.52 })
    .circle(-31, 1, 11).fill({ color: 0x242033 })
    .circle(31, 1, 11).fill({ color: 0x242033 })
    .circle(-31, 1, 5).fill({ color: config.accent })
    .circle(31, 1, 5).fill({ color: config.accent })
    .circle(0, -14, 8).fill({ color: 0xffffff })
    .circle(0, -14, 14).stroke({ color: config.accent, width: 2, alpha: 0.48 });
  root.addChild(aura);
  if (showIdentity) root.addChild(drawBossIdentity(config));
  root.addChild(engines, body);
  const scale = Math.min(width / 150, height / 110);
  root.scale.set(scale);
  root.alpha = alpha;
  return root;
}
