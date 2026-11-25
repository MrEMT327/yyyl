import { cloudAssetBase } from './cloud-asset-base.js';
import { createCombatArtworkBatch, loadCombatUiTexture, retryCombatArtwork } from './combat-art.js';
import { upgradeChoiceSlot } from './upgrade-choice-slots.js';

const assets = new Map();

function psdChoiceTexture(name, priority, onReady) {
  const cached = assets.get(name);
  if (cached) {
    if (cached.image?.width > 0) onReady?.(cached);
    else retryCombatArtwork(cached, priority, onReady);
    return cached;
  }
  const texture = loadCombatUiTexture(`${cloudAssetBase}art/psd-choice-v1/${name}.png`, false, priority, onReady);
  assets.set(name, texture);
  return texture;
}

export function preloadPsdChoiceFrames(warmTexture, priority = -2) {
  for (const name of ['banner', 'card-red', 'card-blue', 'card-prismatic', 'reroll'])
    psdChoiceTexture(name, priority, warmTexture);
}

export function createUpgradeArtwork(bridge, art) {
  const {choices, reroll} = bridge.presentation;
  const skins = ['banner', ...choices.map(({model}, index) => model.progress?.frameArt || upgradeChoiceSlot(index, choices.length).art)];
  if (reroll !== false) skins.push('reroll');
  const frames = skins.map(name => psdChoiceTexture(name, 2));
  const icons = choices.map(({model}) => art.get(model.itemId)).filter(Boolean);
  const prepare = createCombatArtworkBatch([...frames, ...icons], bridge.preparePanelTextures);
  return now => {
    const ready = prepare(now);
    return ready && {
      framesReady: frames.every(texture => ready.has(texture)),
      iconsReady: icons.every(texture => ready.has(texture)),
    };
  };
}

export function paintPsdChoiceArt(surface, name, x, y, width, height, {accent}={}) {
  const texture = psdChoiceTexture(name);
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
