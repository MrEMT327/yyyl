import { createCubismPortraitPlayer } from './cubism-portrait-player.js';
import r13 from './live2d-r13/runtime.json';
import { createRgbaVideoPortraitPlayer } from './rgba-video-portrait-player.js';
import { createBlueHandCannonPortraitPlayer } from './blue-hand-cannon-portrait-player.js';
import { createGoldenMeshPortraitPlayer } from './golden-mesh-portrait-player.js';
import { createCommanderPortraitAdapter } from './commander-portrait-adapter.js';
import { createOrangeReferencePortraitPlayer } from './orange-reference-portrait-player.js';
import { createPurpleDoctorPortraitPlayer } from './purple-doctor-portrait-player.js';
import { createLunaMaidPortraitPlayer } from './luna-maid-portrait-player.js';
import { createBluePonytailEyeLidAdapter } from './blue-ponytail-eye-lid-adapter.js';
import { createWhiteGoldAppearanceAdapter } from './white-gold-appearance-adapter.js';

// The lobby and GM use exactly the same resource and camera configuration.
export function createPilotPortraitPlayer(id, {assetBase=import.meta.env?.BASE_URL ?? '/', geometryDiagnostics=false}={}) {
  if (id === 'pilot-07') return createLunaMaidPortraitPlayer({assetBase});
  if (id === 'pilot-09') return createPurpleDoctorPortraitPlayer({assetBase});
  if (id === 'pilot-01') return createOrangeReferencePortraitPlayer({assetBase,runtimePath:'art/orange-jetboard-v5/runtime.json'});
  if (id === 'pilot-03') return createCubismPortraitPlayer({assetBase,modelPath:'art/commander-live2d-v1/commander.model3.json',motionGroups:{Idle:'idle',TapBody:'touch_head'},sampleFps:60,minimumResolution:2,createModelAdapter:createCommanderPortraitAdapter,transitionSeconds:.32});
  if (id === 'pilot-04') return createCubismPortraitPlayer({assetBase,modelPath:'art/blue-ponytail-v15/blue-ponytail.model3.json',motionGroups:{Idle:'idle'},sampleFps:60,minimumResolution:2,initialMemoryBytes:128*1024*1024,createModelAdapter:createBluePonytailEyeLidAdapter});
  if (id === 'pilot-02') return createRgbaVideoPortraitPlayer({assetBase,manifestPath:'art/engineer-ee76/runtime.json?v=inner-hem-v5'});
  if (id === 'pilot-05') return createGoldenMeshPortraitPlayer({assetBase,manifestPath:'art/golden-yoga-v12/runtime.json'});
  if (id === 'pilot-08') return createRgbaVideoPortraitPlayer({assetBase,manifestPath:'art/violet-astra-v31/runtime.json'});
  if (id === 'pilot-06') return createBlueHandCannonPortraitPlayer({assetBase});
  if (id !== 'pilot-10') throw new Error(`未知动态立绘: ${id}`);
  return createCubismPortraitPlayer({
    assetBase,
    modelPath:`art/white-gold-luoen-r13/${r13.model}`,
    texturePaths:r13.textures.map(path=>`art/white-gold-luoen-r13/${path}`),
    camera:r13.camera,
    hiddenDrawableIndices:r13.hiddenDrawableIndices,
    mouthTextureTargets:r13.mouthTextureTargets,
    mouthInteriorOpacityTargets:r13.mouthInteriorOpacityTargets,
    mouthOpenParameter:r13.mouthOpenParameter,
    mouthOpenThreshold:r13.mouthOpenThreshold,
    eyeSizeAdapter:r13.eyeSizeAdapter,
    eyeOpenAdapter:r13.eyeOpenAdapter,
    renderAdapter:r13.renderAdapter,
    handInputAdapter:r13.handInputAdapter,
    createModelAdapter:createWhiteGoldAppearanceAdapter,
    mipmaps:true,
    minimumResolution:1.5,
    geometryDiagnostics,
    textureRegions:r13.textureRegions || [],
    drawableOpacityMultipliers:r13.drawableOpacityMultipliers || [],
  });
}
