// Pathogenic arc artwork adapted to the existing 15-frame / 30 fps loop.
// Reskin the sequence and its crescent-shaped core; never consume particles.
export const CRESCENT_TEXTURE = 'pathogenic-crescent-body';
const BODY_PREFIX = 'sp_Bullet_superweapon_crescent_moon_1_';
const CORE_TEXTURE = 'tex_Bullet_Blue_1_-572126941283231732';
export function isCrescentBody(bullet) {
  return bullet.owner === 'player' && bullet.familyId === 200031 && bullet.modelId === 1000006 && !bullet.beam;
}
export function preloadCrescentBody(scene) {
  scene.load.image(CRESCENT_TEXTURE, new URL('assets/crescent-body/pathogenic-arcs.png', location.href).href);
}
export function crescentMix(age) {
  // Continuous at the half-second loop seam, no frame flipping or sawtooth reset.
  return (1 - Math.cos(Math.PI * 4 * age)) / 2;
}
export function replaceCrescentBodySamples(sprites, age, enabled, available) {
  if (!enabled || !available || !Number.isFinite(age) || age < 0) return sprites;
  const mix = crescentMix(age);
  return sprites.flatMap(p => {
    if (p.key === CORE_TEXTURE && p.layerId === '2760576714242929937' && p.mesh) {
      // Keep every particle and its geometry, timing, opacity and blend. Only
      // remap the old crescent's UVs into the second extracted arc cell.
      return [{ ...p, key: CRESCENT_TEXTURE, mesh: { ...p.mesh,
        vertices: p.mesh.vertices.map(v => ({ ...v, u: (1 + v.v) / 4, v: v.u })),
      } }];
    }
    if (!p.key.startsWith(BODY_PREFIX) || p.mesh || p.layerId) return [p];
    // Fit the rotated source cell into the original body footprint, keeping its
    // aspect ratio and the original attachment position/scale/depth/opacity.
    const width = Math.min(p.height, p.width * 955 / 835);
    return [0, 1].map(frame => ({ ...p, key: CRESCENT_TEXTURE,
      width, height: width * 835 / 955, originX: .5, originY: .5,
      rotation: p.rotation - Math.PI / 2, tint: 0x91efff,
      alpha: p.alpha * (frame ? mix : 1 - mix),
      crop: { x: frame * 955, y: 0, width: 955, height: 835 },
    }));
  });
}
