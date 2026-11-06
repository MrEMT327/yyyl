import * as T from 'three';

// Decorative street objects remain fixed to their ground clock and camera.
// They do not inherit maritime bobbing, yaw, wakes, collisions or pickup logic.
export function createGroundPropLayer(definition, renderOrder) {
  const mesh = new T.Group();
  mesh.name = `chapter-${definition.id}-layer`;
  const geometry = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const materials = new Map();
  const modules = definition.modules.map(([source, x, z, width, angle = 0], index) => {
    if (!materials.has(source)) materials.set(source, new T.MeshBasicMaterial({
      transparent:true, depthWrite:false, toneMapped:false, alphaTest:.06,
      opacity:definition.opacity ?? 1, color:0xffffff,
    }));
    const sprite = new T.Mesh(geometry, materials.get(source));
    sprite.name = `${definition.id}-module-${index}`;
    sprite.renderOrder = renderOrder;
    sprite.rotation.y = angle;
    mesh.add(sprite);
    return {source, x, z, width, sprite};
  });
  return {definition, mesh, geometry, materials, modules};
}

export function syncGroundPropLayer(record, textures, sceneId, elapsed, motion = {}) {
  const {definition, mesh, materials, modules} = record;
  const units = motion.moduleUnitsPerWorld ?? 24;
  const period = definition.moduleLoopLength * units;
  const travel = motion.moduleTravel ?? elapsed * definition.nativeSpeed * units;
  mesh.position.x = 300 + Math.max(-12, Math.min(12, motion.lateralOffset ?? 0));
  for (const [source, material] of materials) {
    const texture = textures.get(`${sceneId}/${source}`) ?? null;
    if (material.map !== texture) { material.map = texture; material.needsUpdate = true; }
  }
  let visibleModules = 0;
  for (const {source, x, z, width, sprite} of modules) {
    const texture = textures.get(`${sceneId}/${source}`);
    const w = width * units;
    const h = w * (texture ? texture.image.height / texture.image.width : 1);
    const centerZ = 650 + (((-z * units + travel + period / 2) % period + period) % period) - period / 2;
    sprite.position.set(x * units, definition.depth, centerZ);
    sprite.scale.set(w, 1, h);
    sprite.visible = !!texture && centerZ + h / 2 >= -100 && centerZ - h / 2 <= 1400;
    if (sprite.visible) visibleModules++;
  }
  Object.assign(mesh.userData.terrain ||= {}, {
    id:definition.id, role:definition.role, name:definition.name,
    depth:definition.depth, speed:definition.nativeSpeed, scroll:travel, x:mesh.position.x,
    source:`${sceneId}/ground-props`, status:[...materials.values()].every(m => m.map) ? 'ready' : 'loading',
    moduleCount:modules.length, visibleModules,
    modules:modules.filter(m => m.sprite.visible).map(m => ({
      source:m.source, x:m.sprite.position.x + mesh.position.x, z:m.sprite.position.z,
      width:m.sprite.scale.x, height:m.sprite.scale.z,
    })),
  });
}
