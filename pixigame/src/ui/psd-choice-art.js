import { cloudAssetBase } from './cloud-asset-base.js';
import { loadCombatUiTexture } from './combat-art.js';

const assets = new Map();
export function paintPsdChoiceArt(surface, name, x, y, width, height, {accent}={}) {
  if (!assets.has(name)) {
    assets.set(name, loadCombatUiTexture(`${cloudAssetBase}art/psd-choice-v1/${name}.png`));
  }
  const texture = assets.get(name);
  if (!name.startsWith('card-')) {
    surface.image(texture, x, y, width, height);
    return texture;
  }
  // PSD cards are 224 × 562. Preserve the cut corners and bottom ribbon;
  // target border widths are lengths scaled uniformly from the source.
  const scale = Math.min(width / 224, height / 562);
  const sourceX = [0, 24, 200, 224], sourceY = [0, 80, 504, 562];
  const targetX = [x, x + 24 * scale, x + width - 24 * scale, x + width];
  const targetY = [y, y + 80 * scale, y + height - 58 * scale, y + height];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    const image=surface.image(texture, targetX[col], targetY[row],
      targetX[col + 1] - targetX[col], targetY[row + 1] - targetY[row], {
        x: sourceX[col] / 224, y: sourceY[row] / 562,
        width: (sourceX[col + 1] - sourceX[col]) / 224,
        height: (sourceY[row + 1] - sourceY[row]) / 562,
      });
    if(accent==='yellow'){
      image.material.onBeforeCompile=shader=>{
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
          '#include <map_fragment>\nfloat choiceAccent=clamp((diffuseColor.r-max(diffuseColor.g,diffuseColor.b))*80.,0.,1.);'+
          'vec3 choiceGold=vec3(diffuseColor.r,diffuseColor.r*.72+diffuseColor.g*.12,diffuseColor.r*.14+diffuseColor.b*.12);'+
          'diffuseColor.rgb=mix(diffuseColor.rgb,choiceGold,choiceAccent);');
      };
      image.material.customProgramCacheKey=()=> 'psd-choice-yellow-v1';
    }
  }
  return texture;
}
