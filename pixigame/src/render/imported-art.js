import { Container, Graphics, Rectangle, Sprite, Texture } from '../three/display.js';
import { registry } from './entity-visual.js';

// Artwork is shared by battle and previews. None of these helpers changes
// entity positions, hitboxes, attacks or progression data.
const textures = new Map();
export const artFailures = new Map();

export async function loadImportedArt(documentRef) {
  const urls = [...new Set(Object.values(registry).map(spec => spec.url))];
  await Promise.all(urls.map(url => new Promise(resolve => {
    const image = documentRef.createElement('img');
    const finish = () => { clearTimeout(timer); image.onload = image.onerror = null; resolve(); };
    const timer = setTimeout(() => { artFailures.set(url, 'timeout'); finish(); }, 15000);
    image.onload = () => {
      try { textures.set(url, Texture.from(image)); }
      catch (error) { artFailures.set(url, error.message); }
      finish();
    };
    image.onerror = () => { artFailures.set(url, 'image-load-failed'); finish(); };
    image.src = url;
  })));
}

const frames = new Map();
export function importedTexture(id, cropped = true) {
  const spec = registry[id];
  const texture = textures.get(spec?.url);
  if (!texture) return null;
  if (!cropped || !spec.frame) return texture;
  if (!frames.has(id)) frames.set(id, new Texture({ source: texture.source, frame: new Rectangle(...spec.frame) }));
  return frames.get(id);
}

export function importedSprite(id, width, height) {
  const texture = importedTexture(id);
  if (!texture) return null;
  const sprite = new Sprite(texture);
  sprite.label = id;
  sprite.anchor.set(.5);
  sprite.scale.set(Math.min(width / texture.width, height / texture.height));
  return sprite;
}

export function attachEnemyArt(enemy) {
  const spec = registry[`enemy-${enemy.kind}`];
  if (!spec) return null;
  const scale = (enemy.elite ? 1.08 : 1) / enemy.displayScale;
  const sprite = importedSprite(spec.id, spec.size[0] * scale, spec.size[1] * scale);
  if (!sprite) return null;
  for (const child of enemy.view.children) {
    if (child !== enemy.eliteAura && child !== enemy.eliteBar) child.visible = false;
  }
  // Keep the elite health bar above the image; owned children retire with enemy.
  enemy.view.addChildAt(sprite, enemy.eliteBar ? enemy.view.getChildIndex(enemy.eliteBar) : enemy.view.children.length);
  enemy.artSprite = sprite;
  return sprite;
}

export function attachBossArt(boss) {
  if (boss.config.id !== 'aries') return null;
  const sprite = importedSprite('boss-aries-fortress', 224, 168);
  if (!sprite) return null;
  const legacy = [...boss.view.children];
  const root = new Container({ label: 'imported-fortress', eventMode: 'none' });
  const phaseMarks = new Graphics();
  root.addChild(sprite, phaseMarks);
  boss.view.addChild(root);
  boss.importedArt = { root, sprite, phaseMarks, legacy };
  updateBossArt(boss);
  return root;
}

export function updateBossArt(boss) {
  const art = boss?.importedArt;
  if (!art) return;
  art.legacy.forEach(child => { child.visible = false; });
  art.phaseMarks.clear();
  for (let i = 0; i < boss.phase; i += 1) {
    for (const side of [-1, 1]) art.phaseMarks.rect(side * 48 - 4, -8 + i * 9, 8, 4)
      .fill(boss.phase === 3 ? 0xff8158 : 0xe5b66c);
  }
  art.phaseMarks.circle(0, 0, 5).fill({ color: 0xf0d49a, alpha: .85 });
}

export function importedArtSnapshot() {
  return {
    loaded: [...textures.keys()],
    failures: Object.fromEntries(artFailures),
    available: Object.keys(registry).filter(id => textures.has(registry[id].url)),
  };
}
