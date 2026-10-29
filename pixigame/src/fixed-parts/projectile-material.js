// Blender inserts supply the shape and emission strength. Their hue comes
// from the same per-shot color as the surrounding glow and motion history.
export function createProjectileMaterial(source) {
  const material = source.clone();
  material.userData.nativeBatchExclude = true;
  if (source.emissiveIntensity > 1) {
    material.color.set(0xffffff);
    material.emissive.set(0xffffff);
    material.onBeforeCompile = shader => {
      // Three applies instanceColor to diffuse albedo, but not to emission.
      // Reuse that varying so simultaneous shots can have independent hues.
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        #if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )
          totalEmissiveRadiance *= vColor.rgb;
        #endif`,
      );
    };
    material.customProgramCacheKey = () => 'projectile-instance-emission-v1';
  }
  return material;
}
