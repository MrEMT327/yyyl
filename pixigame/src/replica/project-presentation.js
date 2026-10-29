import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createFighterView } from '../three/aircraft/fighter-view.js';
import { loadFighterPackages } from '../three/aircraft/fighter-packages.js';
import { createWorldEnvironment } from '../three/world.js';
import { BATTLE_VIEW, createBattleCamera } from '../three/battle-camera.js';
import { peripheralSceneForStage, FIVE_LAYER_SCENES, authoredLayerMotion, coastIslandLateralOffset } from '../three/peripheral-scenes.js';
import { nativeMapScrollZ } from '../../replica-battle/kernel/native-map-layers';
import { WEAPON_SKINS, validateWeaponSkins, createWeaponForm, weaponSkinLoadout, createWeaponIcons } from './weapon-skins.js';
import { createPhantomTrailState, samplePhantomTrail } from './project-phantom-visual.js';
import { createFlightVisualState, sampleFlightVisual, updateFlightFighter } from './project-flight-visual.js';
import { createCombatAircraftRenderer } from './project-aircraft-render.js';
import {sampleCombatEngineWake,drawCombatEngineWake} from './combat-engine-wake.js';
import {createWingtipTrailState,projectWingtipPositions,sampleWingtipTrails,drawWingtipTrails} from './project-wingtip-trails.js';

const WIDTH = 540, HEIGHT = 960;
const TEXTURE_SIZE = 256;

/** Uses the current project's real aircraft packages and chapter renderer.
 * It can only consume presentation snapshots; there is no Simulation reference,
 * input callback, weapon clock, collision API or damage callback here. */
export async function createProjectPresentation({ content, appearance, onError, onGraphicsContext, onProgress, onFlightRoll }) {
  validateWeaponSkins(content);
  const assetBase = new URL(appearance.assetBase, location.href);
  const stage = document.getElementById('stage');
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  onGraphicsContext?.(renderer.domElement, renderer.getContext());
  renderer.setPixelRatio(1); renderer.setSize(WIDTH, HEIGHT, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  const aircraftRenderer = createCombatAircraftRenderer(renderer, TEXTURE_SIZE);
  const surface = renderer.domElement;
  let disposed = false, fighter, scene, playerImage, playerTexture, worldTexture, pose, wingtipGraphics;
  let frame = { time: 0, clock: 0, camera: { x: 0, z: 0 }, mapCameraOffset: () => ({ x: 0, z: 0 }) };
  let lastAircraftClock = -1, lastWorldKey = '', lastRollSerial = 0;
  const flightVisual = createFlightVisualState();
  const phantomTrail = createPhantomTrailState(), phantomImages = [];
  function updatePhantom(flightPose) {
    const trails = samplePhantomTrail(phantomTrail, { ...frame, pose, rollActive: flightPose.rollActive });
    for (const [index, image] of phantomImages.entries()) {
      const trail = trails[index];
      image.setVisible(Boolean(trail));
      if (trail) image.setPosition(trail.x, trail.y).setDisplaySize(trail.width, trail.height)
        .setTintFill(trail.tint).setAlpha(trail.alpha);
    }
  }
  const wingtipTrail = createWingtipTrailState();
  function updateWingtipTrails(flightPose) {
    if (!wingtipGraphics) return;
    const tips = projectWingtipPositions(fighter, aircraftCamera, pose);
    drawWingtipTrails(wingtipGraphics, sampleWingtipTrails(wingtipTrail, {
      ...frame, pose, tips, pilotId: fighter.pilotId, pixelsPerUnit: WIDTH / content.world.width,
      rollActive: flightPose.rollActive, thrust: flightPose.thrust,
    }));
  }
  let weapons = [], weaponRevision = '', weaponsDirty = true, icons;
  const geometryFactory = (_catalogItem, item) => createWeaponForm(item.skin);
  function applyWeaponSkins() {
    fighter.setFixedParts(weaponSkinLoadout(appearance.aircraft.id, weapons), { revision: weaponRevision, geometryFactory });
  }
  const worldScene = new THREE.Scene(), aircraftScene = new THREE.Scene();
  const camera = createBattleCamera(); camera.aspect = WIDTH / HEIGHT; camera.updateProjectionMatrix();
  const cameraHome = camera.position.clone();
  const targetHome = new THREE.Vector3(BATTLE_VIEW.width / 2, 0, BATTLE_VIEW.height / 2);
  const unitsPerWorld = BATTLE_VIEW.width / content.world.width;
  const sourceMap = content.assets.map.nativeLayers;
  const replaceTerrain = appearance.map?.terrain === 'cloud';
  const stageIndex = Number(content.chapter.chapter.id) - 1;
  // Painted strips are already viewed from above. Do not project them through
  // the tilted aircraft camera: that crops the two banks differently at the
  // top/bottom and stretches the artwork in the new 540x960 battle frame.
  const coastCamera = replaceTerrain && FIVE_LAYER_SCENES[peripheralSceneForStage(stageIndex).id] ? new THREE.OrthographicCamera(-365.625, 365.625, 650, -650, 1, 10000) : null;
  if (coastCamera) {
    coastCamera.position.set(300, 2000, 650);
    coastCamera.up.set(0, 0, -1);
    coastCamera.lookAt(300, 0, 650);
    coastCamera.updateMatrixWorld();
  }
  // Explicit skin-layer correspondence. Speeds and camera displacement are read
  // from the requested native chapter, never from the host battle balance.
  const sourceLayers = {
    far: sourceMap.layers.find(layer => layer.layer === 1),
    middle: sourceMap.layers.find(layer => layer.layer === 2),
    near: sourceMap.layers.find(layer => layer.layer === 0),
  };
  const selectedScene = peripheralSceneForStage(stageIndex);
  if (replaceTerrain && !FIVE_LAYER_SCENES[selectedScene.id] && Object.values(sourceLayers).some(layer => !layer)) throw new Error('当前关卡分层显示映射不完整');
  const textureLoader = new THREE.TextureLoader(), pendingTextures = [];
  const loader = {
    load(url, ready, progress, failed) {
      let texture;
      const pending = new Promise((resolve, reject) => {
        texture = textureLoader.load(new URL(url, assetBase).href, value => {
          if (disposed) value.dispose(); else ready(value);
          resolve(value);
        }, progress, error => { failed?.(error); reject(new Error(`场景资源加载失败：${url}`)); });
      });
      pendingTextures.push(pending); return texture;
    },
  };
  const environment = replaceTerrain ? createWorldEnvironment(worldScene, {
    shadowsEnabled: false, textureLoader: loader, initialStage: stageIndex, sceneIds: [selectedScene.id],
    layerMotion(definition, elapsed, aspect) {
      if (definition.authoredMotion) return authoredLayerMotion(definition, elapsed, aspect, frame.camera.x, unitsPerWorld);
      const original = definition.nativeLayer !== undefined ? sourceMap.layers.find(layer => layer.layer === definition.nativeLayer) : sourceLayers[definition.id];
      if (!original) throw new Error(`当前关卡缺少背景层：${definition.id}`);
      const offset = frame.mapCameraOffset(original);
      const tileHeight = definition.width * aspect / unitsPerWorld;
      const scroll = (-nativeMapScrollZ(original, elapsed) * (definition.scrollScale ?? 1) / tileHeight + offset.z / tileHeight) % 2;
      // Keep both banks inside the 760-wide strip's 14-unit overscan margin.
      // The island belongs to the map and stays still when only the aircraft moves.
      const anchored = definition.role === 'background' || definition.role === 'midground';
      // Native layer 2 has a positive world-space moveScale. With our fixed
      // coast camera, reverse it so foreground banks oppose aircraft motion.
      const directionalLayer = definition.role === 'foreground' || definition.role === 'cloud';
      const direction = coastCamera && directionalLayer ? -Math.sign(original.moveScale || 1) : 1;
      const coastIsland = selectedScene.id === 'coast-balanced' && definition.role === 'midground';
      const lateralOffset = coastIsland ? coastIslandLateralOffset(frame.camera.x, unitsPerWorld)
        : anchored ? 0 : definition.presentationMotion && directionalLayer
        ? -frame.camera.x * unitsPerWorld * (definition.role === 'cloud' ? .45 : .3)
        : offset.x * unitsPerWorld * direction;
      return { scroll: (scroll + 2) % 2, lateralOffset: coastCamera ? Math.max(-12, Math.min(12, lateralOffset)) : lateralOffset };
    },
  }) : { dispose() {}, update() {} };
  const studio = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
  const lighting = pmrem.fromScene(studio, .04); studio.dispose(); pmrem.dispose();
  aircraftScene.environment = lighting.texture; aircraftScene.environmentIntensity = .85;
  aircraftScene.add(new THREE.HemisphereLight('#e7f0f6', '#677786', 1.6));
  for (const [color, intensity, position] of [
    ['#f3f9ff', 3, [-7, 12, -12]], ['#a8d4e9', 2.6, [9, 3, 8]], ['#b5c9dd', 1.1, [4, -5, 10]],
  ]) {
    const light = new THREE.DirectionalLight(color, intensity); light.position.set(...position); aircraftScene.add(light);
  }
  const aircraftCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 10000);
  aircraftCamera.up.set(0, 0, -1);
  const playerCanvas = document.createElement('canvas'); playerCanvas.width = playerCanvas.height = TEXTURE_SIZE;
  const playerContext = playerCanvas.getContext('2d');
  if (!playerContext) throw new Error('无法创建飞机显示纹理');
  const worldCanvas = document.createElement('canvas'); worldCanvas.width = WIDTH; worldCanvas.height = HEIGHT;
  const worldContext = worldCanvas.getContext('2d');
  if (!worldContext) throw new Error('无法创建分层场景显示纹理');

  function dispose() {
    if (disposed) return; disposed = true;
    window.removeEventListener('pagehide', dispose);
    window.removeEventListener('shnh-dispose-replica-battle', dispose);
    for (const image of phantomImages) image.destroy(); phantomImages.length = 0; phantomTrail.history.length = 0;
    wingtipGraphics?.destroy(); wingtipTrail.tracks.forEach(track => { track.length = 0; });
    icons?.dispose(); environment.dispose(); fighter?._disposeVisuals(); fighter?.object3D.removeFromParent();
    lighting.dispose(); aircraftRenderer.dispose(); renderer.dispose(); renderer.forceContextLoss(); surface.remove();
    playerCanvas.width = playerCanvas.height = worldCanvas.width = worldCanvas.height = 0;
  }
  window.addEventListener('pagehide', dispose, { once: true });
  window.addEventListener('shnh-dispose-replica-battle', dispose, { once: true });
  try {
    let completed=0;
    const total=pendingTextures.length+1;
    const loaded=value=>{onProgress?.(++completed,total);return value;};
    onProgress?.(0,total);
    await Promise.all([loadFighterPackages({
      pilotIds: [appearance.aircraft.id],
      read: async (slug, name) => {
        const response = await fetch(new URL(`fighters/${slug}/${name}`, assetBase), { cache: 'no-cache' });
        if (!response.ok) throw new Error(`战机资源加载失败：${slug}/${name}`);
        return response.arrayBuffer();
      },
    }).then(loaded), ...pendingTextures.map(task=>task.then(loaded))]);
    if (disposed) throw new DOMException('Battle closed during loading', 'AbortError');
    fighter = createFighterView({ pilotId: appearance.aircraft.id, size: 1, nativeSpace: true });
    // The replica owns weapon identity and evolution. Saved host weapons
    // must never appear as extra pre-equipped guns.
    applyWeaponSkins();
    aircraftScene.add(fighter.object3D);
    Object.assign(fighter.runtime.config, { firing: false, cruise: false, trails: 0, particles: 0 });
    fighter.updateAircraft(0); fighter.object3D.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(fighter.runtime.asset.solid);
    // Reserve the maximum static skin envelope ONCE, using actual cloud
    // meshes at each authored seat. Upgrades never resize the whole aircraft.
    const mounts = fighter.fixedParts;
    mounts.root.updateWorldMatrix(true, true);
    for (const familyId of Object.keys(WEAPON_SKINS).map(Number).filter(id => WEAPON_SKINS[id].kind === 'cloud-model')) {
      const mesh = createWeaponForm({ familyId, star: 1, breakthroughs: 0, skills: [] });
      const local = new THREE.Box3().setFromObject(mesh);
      for (const slot of mounts.slots.filter(row => row.kind === 'weapon')) {
        const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...slot.position), new THREE.Quaternion(),
          new THREE.Vector3(slot.scale * (slot.position[0] < 0 ? -1 : 1), slot.scale, slot.scale));
        matrix.premultiply(mounts.root.matrixWorld); bounds.union(local.clone().applyMatrix4(matrix));
      }
      mesh.userData.dispose();
    }
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const span = sphere.radius * 2;
    if (!(span > 0 && Number.isFinite(span))) throw new Error('战机模型显示范围无效');
    aircraftCamera.left = aircraftCamera.bottom = -span / 2;
    aircraftCamera.right = aircraftCamera.top = span / 2;
    aircraftCamera.position.set(sphere.center.x, bounds.max.y + span, sphere.center.z);
    aircraftCamera.lookAt(sphere.center); aircraftCamera.updateProjectionMatrix();
    icons = createWeaponIcons(renderer, aircraftScene, content);
  } catch (error) { dispose(); throw error; }

  return {
    dispose,
    replaceTerrain,
    setWeapons(next) {
      const revision = JSON.stringify(next);
      if (weaponRevision === revision || disposed) return;
      weapons = next.map(weapon => Object.freeze({ ...weapon }));
      weaponRevision = revision; applyWeaponSkins(); weaponsDirty = true;
    },
    weaponIcon(weapon) {
      return icons.get(weapon);
    },
    playerSkin: {
      // Authored original skeleton bounds, in original skeleton units.
      width: 273.2, height: 254.54,
      update(next) {
        pose = next;
        if (playerImage) playerImage.setPosition(next.x, next.y)
          .setDisplaySize(Math.max(next.width, next.height) * next.scaleX, Math.max(next.width, next.height) * next.scaleY)
          .setAlpha(next.alpha).setVisible(next.visible);
      },
    },
    preload(phaser) { phaser.load.on('loaderror', file => onError(new Error(`关卡资源加载失败：${file.key}`))); },
    create(phaser) {
      scene = phaser;
      playerTexture = scene.textures.addCanvas('project-aircraft-3d', playerCanvas);
      if (replaceTerrain) {
        worldTexture = scene.textures.addCanvas('project-world-3d', worldCanvas);
        scene.add.image(0, 0, 'project-world-3d').setOrigin(0, 0).setDepth(-1000);
      }
      wingtipGraphics = scene.add.graphics().setDepth(24.6).setName('project-aircraft-wingtip-trails');
      playerImage = scene.add.image(0, 0, 'project-aircraft-3d').setDepth(25).setVisible(false);
      // Two compact copies share the current aircraft texture; no extra render target.
      for (let index = 0; index < 2; index++) phantomImages.push(scene.add.image(0, 0, 'project-aircraft-3d')
        .setDepth(24.8 + index * .05).setVisible(false).setName('project-aircraft-phantom-' + index));
      stage.dataset.presentation = 'project-native-3d';
      scene.events.once('shutdown', dispose);
    },
    update(next) {
      if (disposed) return; frame = next;
      // Tint the rendered aircraft silhouette, not its transparent texture bounds.
      if (playerImage) {
        if (frame.playerHitFlash) playerImage.setTintFill(0xffffff);
        else playerImage.clearTint();
      }
      const flightPose=sampleFlightVisual(flightVisual, {...frame,visible:pose?.visible??false});
      if (flightPose.rollSerial !== lastRollSerial) {
        lastRollSerial = flightPose.rollSerial;
        if (flightPose.rollActive) onFlightRoll?.();
      }
      updatePhantom(flightPose);
      const backgroundTime = selectedScene.id === 'coast-balanced' ? (frame.coastBackgroundTime ?? frame.time) : frame.time;
      const worldKey = `${backgroundTime}/${frame.camera.x}/${frame.camera.z}`;
      if (lastWorldKey === worldKey && lastAircraftClock === frame.clock && !weaponsDirty) {
        updateWingtipTrails(flightPose); return;
      }
      const shiftX = frame.camera.x * unitsPerWorld, shiftZ = -frame.camera.z * unitsPerWorld;
      camera.position.copy(cameraHome).add(new THREE.Vector3(shiftX, 0, shiftZ));
      camera.lookAt(targetHome.x + shiftX, 0, targetHome.z + shiftZ);
      environment.update(backgroundTime, stageIndex);
      // Render the native 3D model into a texture used at Phaser's original
      // player depth. Enemy bullets and pickups retain their original sorting.
      // The world is drawn last into this same Three surface, before paint.
      if (pose && (lastAircraftClock !== frame.clock || lastAircraftClock < 0 || weaponsDirty)) {
        if (frame.clock < lastAircraftClock) {
          fighter._disposeVisuals(); fighter.setPilot(appearance.aircraft.id);
          applyWeaponSkins();
          Object.assign(fighter.runtime.config, { firing: false, cruise: false, trails: 0, particles: 0 });
        }
        updateFlightFighter(fighter, frame.clock, flightPose);
        renderer.setScissorTest(true); renderer.setScissor(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
        renderer.setViewport(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
        renderer.setClearColor(0x000000, 0); renderer.clear(); aircraftRenderer.render(aircraftScene, aircraftCamera, fighter);
        playerContext.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
        drawCombatEngineWake(playerContext,sampleCombatEngineWake(fighter,aircraftCamera,{clock:frame.clock,displaySize:Math.max(pose.width,pose.height),textureSize:TEXTURE_SIZE,thrust:flightPose.thrust}));
        playerContext.drawImage(surface, 0, HEIGHT - TEXTURE_SIZE, TEXTURE_SIZE, TEXTURE_SIZE, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
        playerTexture.refresh(); lastAircraftClock = frame.clock; weaponsDirty = false;
      }
      updateWingtipTrails(flightPose);
      if (!replaceTerrain) { lastWorldKey = worldKey; return; }
      renderer.setScissorTest(false); renderer.setViewport(0, 0, WIDTH, HEIGHT);
      renderer.setClearColor(selectedScene.ground, 1); renderer.clear(); renderer.render(worldScene, coastCamera || camera);
      // The complete frame is a Phaser background texture, so original ADD /
      // SUBTRACT FX blend against the actual scene instead of a separate DOM canvas.
      worldContext.clearRect(0, 0, WIDTH, HEIGHT); worldContext.drawImage(surface, 0, 0);
      worldTexture.refresh(); lastWorldKey = worldKey;
    },
  };
}
