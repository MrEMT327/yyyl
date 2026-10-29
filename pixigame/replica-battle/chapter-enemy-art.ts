import type Phaser from 'phaser';

// Presentation only. Original model IDs, mounts, shapes and animation event
// timing stay in the native manifests; none of those records are rewritten.
export const CHAPTER_ENEMY_ART: Readonly<Record<number, string>> = Object.freeze({
  122019: 'alien-mothership', // 340025: large, wide space Boss.
  120151: 'forest-leaf',      // Small moving shooters shared by chapters 18/19.
  120197: 'forest-mantis',    // Broad stationary shooter.
  120171: 'forest-falcon',    // Wide two-point / bottom-travel shooter.
  122023: 'alien-trilobe',    // Large, nearly square flying entity.
  122005: 'alien-triangle',   // Wide space formation unit.
  120199: 'alien-saucer',     // Circular rotating shooter.
  120158: 'alien-triangle',   // Wide moving shooter.
  120177: 'alien-mothership', // Circular chapter 20 Boss.
  // Chapters 21–30: reuse owned part atlases by silhouette, never native pixels.
  120195: 'alien-triangle',   // 320081: wide bottom-travel attacker.
  120200: 'alien-trilobe',    // 320062: large circular two-point shooter.
  120217: 'city-patrol',      // 320050: compact, nearly square patrol unit.
  121012: 'city-suppressor',  // 340017: broad, shallow Boss silhouette.
  120180: 'alien-saucer',     // 320070/320074: round carrier; orbit child remains separate.
  122006: 'ruin-obelisk',     // 310019: tall elite silhouette.
  120156: 'industrial-drill', // 320026: compact bottom-travel attacker.
  120166: 'industrial-pincer',// 320028: heavy, nearly square two-point shooter.
  120181: 'water-ray',        // 320047: slightly wide bottom-travel attacker.
  121011: 'polar-fortress',   // 340015: very wide multi-mount Boss.
  120169: 'naval-swallow',    // 320037: small, wide looping path attacker.
  122020: 'industrial-foundry', // 340035: broad multi-mount Boss.
  120196: 'ruin-obelisk',     // 320063/320075: taller than wide, same native model.
  122014: 'forest-falcon',    // 310020: wide elite with two-point travel.
  120134: 'city-blade',       // 320073: wide sweeping shooter.
  120202: 'ruin-ring',        // 330023–330032: circular rotating formation.
  122013: 'crystal-guard',    // 310017: large circular elite.
  // Chapters 31–40: keep native hitboxes, mounts and timing; owned pixels only.
  122012: 'alien-trilobe',    // 310015: slightly wide two-point elite.
  122022: 'alien-saucer',     // 310022: circular self-rotating path elite.
  120210: 'industrial-pincer', // 320061: wide, heavy two-point shooter.
  122011: 'alien-saucer',     // 310023: circular elite with separate orbit guards.
  120137: 'city-blade',       // 320083: small, wide patrol shooter.
  120143: 'industrial-pincer', // 320094: wider heavy shooter.
});

type Spec = {
  id: string; src: string; width: number; family: string;
  regions: Record<string, [number, number, number, number]>;
};
type PartOptions = { flip?: boolean; angle?: number; pivotX?: number; pivotY?: number };
type PoseContext = { filter: string; save(): void; restore(): void; rotate(angle: number): void };
type Part = (context: PoseContext, spec: Spec, key: string, x: number, y: number,
  width: number, height: number, options?: PartOptions) => void;
type PoseParts = (context: PoseContext, spec: Spec, time: number, charge: number,
  recoil: number, animate: boolean, part: Part) => void;
export type ChapterEnemyArtPose = Readonly<{
  age: number; animationClip?: string; animationTime?: number;
  dead?: boolean; deathAge?: number;
}>;
type ViewState = { spec: Spec; fit: number; parts: Phaser.GameObjects.Image[] };

let catalog = new Map<string, Spec>();
let poseParts: PoseParts | undefined;
let artBase: URL | undefined;
let prepared: Promise<void> | undefined;
const views = new WeakMap<Phaser.GameObjects.Container, ViewState>();
const textureKey = (id: string) => `chapter-original-enemy:${id}`;

/** Await before constructing the Phaser game. Pass the app's art/enemies/ URL. */
export function prepareChapterEnemyArt(baseUrl: string | URL): Promise<void> {
  const base = new URL(String(baseUrl), document.baseURI);
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  if (prepared && artBase?.href === base.href) return prepared;
  artBase = base;
  prepared = Promise.all([
    import(/* @vite-ignore */ new URL('catalog.js', base).href),
    import(/* @vite-ignore */ new URL('poses.js', base).href),
  ]).then(([data, poses]) => {
    const next = new Map<string, Spec>((data.enemies as Spec[]).map(spec => [spec.id, spec]));
    for (const id of Object.values(CHAPTER_ENEMY_ART)) {
      if (!next.has(id)) throw new Error(`Missing original enemy artwork: ${id}`);
    }
    if (typeof poses.poseParts !== 'function') throw new Error('Missing original enemy pose adapter');
    catalog = next;
    poseParts = poses.poseParts as PoseParts;
  }).catch(error => { prepared = undefined; throw error; });
  return prepared;
}

/** Called from Scene.preload; restrict loading to the current chapter's models. */
export function preloadChapterEnemyArt(scene: Phaser.Scene,
  modelIds: Iterable<number> = Object.keys(CHAPTER_ENEMY_ART).map(Number)): void {
  if (!artBase || !poseParts) throw new Error('Await prepareChapterEnemyArt before Phaser preload');
  const ids = new Set(Array.from(modelIds, id => CHAPTER_ENEMY_ART[id]).filter(Boolean));
  for (const id of ids) {
    const spec = catalog.get(id)!;
    if (!scene.textures.exists(textureKey(id))) scene.load.image(textureKey(id), new URL(spec.src, artBase).href);
  }
}

/** Undefined means this model remains owned by the existing native renderer. */
export function createChapterEnemyArt(scene: Phaser.Scene, modelId: number,
  fallbackSize: number, pixelsPerWorldUnit: number): Phaser.GameObjects.Container | undefined {
  const id = CHAPTER_ENEMY_ART[modelId];
  if (!id) return undefined;
  const spec = catalog.get(id), key = textureKey(id);
  if (!spec || !poseParts || !scene.textures.exists(key)) {
    throw new Error(`Original enemy artwork was not preloaded: ${modelId}/${id}`);
  }
  const texture = scene.textures.get(key);
  const source = texture.getSourceImage() as HTMLImageElement;
  // Regions are authored against 1280px atlases; shipping WebP may be resized.
  const q = source.width / 1280;
  for (const [name, [x, y, width, height]] of Object.entries(spec.regions)) {
    if (!texture.has(name)) texture.add(name, 0, Math.round(x * q), Math.round(y * q),
      Math.max(1, Math.round(width * q)), Math.max(1, Math.round(height * q)));
  }
  const view = scene.add.container(0, 0);
  // fallbackSize is the UNSCALED native collision diameter. The renderer still
  // applies enemy.scale once to this container, exactly as for native prefabs.
  views.set(view, { spec, fit: Math.max(.01, fallbackSize) * pixelsPerWorldUnit * 1.2 / spec.width, parts: [] });
  updateChapterEnemyArt(view, { age: 0 });
  return view;
}

/** True tells the renderer to skip native sprite animation for this view only. */
export function updateChapterEnemyArt(view: Phaser.GameObjects.Container, pose: ChapterEnemyArtPose): boolean {
  const state = views.get(view);
  if (!state || !poseParts) return false;
  let angle = 0, filter = 'none', index = 0;
  const stack: Array<[number, string]> = [];
  const context: PoseContext = {
    get filter() { return filter; }, set filter(value) { filter = value; },
    save() { stack.push([angle, filter]); },
    restore() { const saved = stack.pop(); if (saved) [angle, filter] = saved; },
    rotate(value) { angle += value; },
  };
  const time = Math.max(0, Number.isFinite(pose.age) ? pose.age : 0);
  const clipTime = Math.max(0, pose.animationTime ?? 0);
  const charging = /Skill(?:Enter|Hold)/.test(pose.animationClip || '');
  const firing = /Skill(?:Exit|Fire)/.test(pose.animationClip || '');
  const charge = pose.dead ? 0 : charging ? .65 : 0;
  const recoil = pose.dead ? 0 : firing ? Math.exp(-clipTime * 15) * .55 : 0;
  poseParts(context, state.spec, time, charge, recoil, !pose.dead,
    (_context, spec, part, x, y, width, height, options = {}) => {
      const { flip = false, angle: localAngle = 0, pivotX = .5, pivotY = .5 } = options;
      let image = state.parts[index++];
      if (!image) {
        image = view.scene.add.image(0, 0, textureKey(spec.id), part);
        state.parts.push(image); view.add(image);
      } else image.setTexture(textureKey(spec.id), part);
      const co = Math.cos(angle), si = Math.sin(angle);
      image.setVisible(true).setPosition((x * co - y * si) * state.fit, (x * si + y * co) * state.fit)
        .setOrigin(pivotX, pivotY)
        .setScale(width * state.fit / image.frame.width * (flip ? -1 : 1), height * state.fit / image.frame.height)
        .setRotation(angle + localAngle);
    });
  for (let i = index; i < state.parts.length; i++) state.parts[i].setVisible(false);
  return true;
}
