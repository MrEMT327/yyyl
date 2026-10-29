import * as T from 'three';
import { COMMON_WEAPONS } from '../fixed-parts/common-weapons.js';
import { weaponIconUrl } from './weapon-icon-source.js';
import { AIRFRAME_ITEMS as RELEASED_FIXED_ITEMS } from '../slot-demo/catalog.js';
import { createModuleGeometry } from '../slot-demo/module-geometry.js';

const caches = new WeakMap();
const items = new Map(RELEASED_FIXED_ITEMS.map(item => [item.id, item]));

// A texture is created only when a visible HUD/card asks for it. Acquiring the
// cache must not render the legacy catalog or download twenty unused icons.
export function acquireFixedPartThumbnails(renderer, { textureLoader } = {}) {
  let cache = caches.get(renderer);
  if (!cache) {
    const targets = [], illustrations = [], jobs = [];
    let disposed = false, scene, camera;
    const color = new T.Color(), viewport = new T.Vector4(), scissor = new T.Vector4();
    const textures = new Map();
    const lookup = textures.get.bind(textures);
    textures.get = id => {
      if (disposed || textures.has(id)) return lookup(id);
      if (COMMON_WEAPONS[id]) {
        const texture = (textureLoader ||= new T.TextureLoader()).load(weaponIconUrl(id));
        texture.colorSpace = T.SRGBColorSpace;
        texture.userData.inventoryIcon = true;
        textures.set(id, texture); illustrations.push(texture);
      } else if (items.has(id)) {
        const target = new T.WebGLRenderTarget(240, 154, { depthBuffer: true, samples: 2 });
        targets.push(target); textures.set(id, target.texture);
        jobs.push({ item: items.get(id), target }); renderer.screenPasses.add(render);
      }
      return lookup(id);
    };
    const render = three => {
      if (disposed || !jobs.length) { renderer.screenPasses.delete(render); return; }
      if (!scene) {
        scene = new T.Scene(); scene.environment = renderer.scene.environment; scene.environmentIntensity = 1.2;
        scene.add(new T.HemisphereLight('#ffffff', '#40566a', 2));
        const lamp = new T.DirectionalLight('#ffffff', 3); lamp.position.set(-3, 7, -5); scene.add(lamp);
        camera = new T.PerspectiveCamera(34, 240 / 154, .1, 80);
      }
      const previous = three.getRenderTarget(), alpha = three.getClearAlpha(), test = three.getScissorTest();
      three.getClearColor(color); three.getViewport(viewport); three.getScissor(scissor);
      const { item, target } = jobs.shift(), kit = createModuleGeometry(item);
      scene.add(kit);
      try {
        const bounds = new T.Box3().setFromObject(kit), centre = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3());
        const distance = Math.max(size.x * .75, size.y, size.z * .8) * 2.8;
        camera.position.copy(centre).addScaledVector(new T.Vector3(1, 1.25, -1.5).normalize(), distance); camera.lookAt(centre);
        three.setScissorTest(false); three.setClearColor(0, 0);
        three.setRenderTarget(target); three.clear(); three.render(scene, camera);
      } finally {
        scene.remove(kit); kit.userData.dispose();
        three.setRenderTarget(previous); three.setViewport(viewport); three.setScissor(scissor);
        three.setScissorTest(test); three.setClearColor(color, alpha);
        if (!jobs.length) renderer.screenPasses.delete(render);
      }
    };
    cache = { textures, users: 0, get ready() { return jobs.length === 0; }, dispose() {
      disposed = true; renderer.screenPasses.delete(render); jobs.length = 0;
      targets.forEach(target => target.dispose()); illustrations.forEach(texture => texture.dispose());
      scene?.clear(); textures.clear(); caches.delete(renderer);
    } };
    caches.set(renderer, cache);
  }
  cache.users++;
  let released = false;
  return { textures: cache.textures, get ready() { return cache.ready; }, release() {
    if (released) return; released = true;
    if (--cache.users === 0) cache.dispose();
  } };
}
