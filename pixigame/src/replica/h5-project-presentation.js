import {prepareBattleColorMaterial} from '../three/game-screen/battle-color-targets.js';
import {createPassiveDeploymentState,samplePassiveDeployment} from './project-passive-deployment.js';
import {openBattleScreen} from '../three/game-screen/h5-battle-screen.js';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createFighterView } from '../three/aircraft/fighter-view.js';
import { createAircraftLighting, updateAircraftNightLighting, renderWithAircraftStyle } from '../three/aircraft/aircraft-lighting.js';
import { loadFighterPackages } from '../three/aircraft/fighter-packages.js';
import { createWorldEnvironment } from '../three/world.js';
import {createScenerySeed} from '../three/campaign-run-layout.js';
import { BATTLE_VIEW, createBattleCamera } from '../three/battle-camera.js';
import { peripheralSceneForStage, FIRST_STAGE_SCENE, FIVE_LAYER_SCENES, authoredLayerMotion, coastIslandLateralOffset } from '../three/peripheral-scenes.js';
import { nativeMapScrollZ } from '../../replica-battle/kernel/native-map-layers';
import {COAST_CLOUD_MOTION,sampleCoastCloudMotion,sampleCoastTerrainMotion} from '../three/coast-cloud-motion.js';
import { WEAPON_SKINS, validateWeaponSkins, createWeaponForm, weaponSkinLoadout, createWeaponIcons } from './weapon-skins.js';
import { createPhantomTrailState, samplePhantomTrail } from './project-phantom-visual.js';
import { createFlightVisualState, sampleFlightVisual, updateFlightFighter, flightPoseNeedsRefresh, rigidAircraftSkinPose } from './project-flight-visual.js';
import {createFlightPositionState,sampleFlightPosition} from './project-flight-position.js';
import { createCombatAircraftRenderer, warmRenderPrograms } from './project-aircraft-render.js';
import {createAircraftFxRenderer} from '../three/aircraft/aircraft-fx-renderer.js';
import {sampleCombatEngineWake} from './combat-engine-wake.js';
import {createWingtipTrailState,projectWingtipPositions,sampleWingtipTrails} from './project-wingtip-trails.js';
import {projectMissileWingMounts} from './project-missile-mounts.js';
import {nativeWeather} from '../three/game-screen/three-combat-weather.js';
import {sampleVictoryTrail} from './project-victory-trail.js';

const WIDTH = 540, HEIGHT = 960;
// Presentation only; native hit shapes, movement and weapon timing keep their scale.
const PLAYER_VISUAL_SCALE=1.15;

/** Uses the current project's real aircraft packages and chapter renderer.
 * It can only consume presentation snapshots; there is no Simulation reference,
 * input callback, weapon clock, collision API or damage callback here. */
export async function createH5Presentation({ content, appearance, onError, onGraphicsContext, onProgress, onFlightRoll, host, aircraftReady }) {
  validateWeaponSkins(content);
  const assetBase = new URL(appearance.assetBase, host?.baseURL ?? location.href);
  const stage = host?.stage;
  const events = host?.events;
  const screen = host?.openBattleSurface ? host.openBattleSurface() : openBattleScreen((stage??document.getElementById('stage')).querySelector('#canvas'),host.screen);
  const renderer = screen.renderer, battle = screen.stage;
  const aircraftTextureSize = 256, terrainWidth = WIDTH, terrainHeight = HEIGHT;
  onGraphicsContext?.(renderer.domElement, renderer.getContext());
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  const staggerPresentation=Boolean(host?.staggerPresentation);
  const aircraftRenderer = createCombatAircraftRenderer(renderer, aircraftTextureSize, aircraftTextureSize, { cullExhaustDepth: staggerPresentation });
  const aircraftFxRenderer = createAircraftFxRenderer(renderer, {
    stableCoverage: host?.aircraftCoverageStrength ?? true,
    prepareOutput: prepareBattleColorMaterial,
  });
  const surface = renderer.domElement;
  let disposed = false, fighter, pose;
  let frame = { time: 0, clock: 0, camera: { x: 0, z: 0 }, mapCameraOffset: () => ({ x: 0, z: 0 }) };
  let lastAircraftVisualClock = -1, lastRenderedFlightPose;
  const flightPosition = createFlightPositionState();
  let lastAircraftClock = -1, lastWorldKey = '', lastRollSerial = 0;
  let lastWorldViewport=null,lastWorldRun=null,terrainDeferred=false;
  let appliedWeather = null;
  let launchPresentation=null,launchDirty=false;
  let worldContextReady = true;
  const worldLost = () => {worldContextReady = false;};
  const worldRestored = () => {
    const oldLighting=lighting;lighting=makeLighting();aircraftScene.environment=lighting.texture;oldLighting.dispose();
    worldContextReady=true;lastWorldKey='';lastWorldViewport=null;terrainDeferred=false;weaponsDirty=true;
  };
  surface.addEventListener('webglcontextlost',worldLost);
  surface.addEventListener('webglcontextrestored',worldRestored);
  const flightVisual = createFlightVisualState();
  const passiveState=createPassiveDeploymentState();
  let passivePose={enabled:appearance.aircraft.id==='pilot-04',active:false,progress:0,target:false,serial:0},lastRenderedPassive;
  const phantomTrail = createPhantomTrailState(), wingtipTrail = createWingtipTrailState();
  function updatePhantom(flightPose) {
    battle.ghosts(samplePhantomTrail(phantomTrail,{...frame,pose,rollActive:flightPose.rollActive}));
  }
  function updateWingtipTrails(flightPose) {
    const tips=projectWingtipPositions(fighter,aircraftCamera,pose);
    battle.wings(sampleWingtipTrails(wingtipTrail,{
      ...frame,pose,tips,pilotId:fighter.pilotId,pixelsPerUnit:WIDTH/content.world.width,
      rollActive:flightPose.rollActive,thrust:flightPose.thrust,
    }),tips,{visible:!!pose?.visible,clock:frame.clock,width:pose?Math.max(pose.width,pose.height)*Math.abs(pose.scaleX):80,
      thrust:flightPose.thrust,rollActive:flightPose.rollActive});
  }
  let weapons = [], weaponRevision = '', weaponsDirty = true, icons;
  const geometryFactory = (_catalogItem, item) => createWeaponForm(item.skin);
  function applyWeaponSkins() {
    fighter.setFixedParts(weaponSkinLoadout(appearance.aircraft.id, weapons), { revision: weaponRevision, geometryFactory });
  }
  const worldScene = new THREE.Scene(), aircraftScene = new THREE.Scene();
  const camera = createBattleCamera(); camera.aspect = WIDTH / HEIGHT; camera.updateProjectionMatrix();
  const fixedFov=camera.fov;
  const cameraHome = camera.position.clone();
  const targetHome = new THREE.Vector3(BATTLE_VIEW.width / 2, 0, BATTLE_VIEW.height / 2);
  const unitsPerWorld = BATTLE_VIEW.width / content.world.width;
  const sourceMap = content.assets.map.nativeLayers;
  const replaceTerrain = appearance.map?.terrain === 'cloud';
  const stageIndex = Number(content.chapter.chapter.id) - 1;
  const weather=replaceTerrain&&peripheralSceneForStage(stageIndex).weather!==false?nativeWeather(battle,{theme:peripheralSceneForStage(stageIndex).theme,precipitation:peripheralSceneForStage(stageIndex).precipitation,nightGradeInWorld:['desert','forest'].includes(peripheralSceneForStage(stageIndex).theme)}):null;
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
  const reusedCoast = stageIndex > 0 && selectedScene === FIRST_STAGE_SCENE;
  if (replaceTerrain && !FIVE_LAYER_SCENES[selectedScene.id] && Object.values(sourceLayers).some(layer => !layer)) throw new Error('当前关卡分层显示映射不完整');
  const textureLoader = host?.textureLoader ?? new THREE.TextureLoader(), pendingTextures = weather?[weather.ready]:[];
  const loader = {
    load(url, ready, progress, failed) {
      let texture;
      const pending = new Promise((resolve, reject) => {
        texture = textureLoader.load(new URL(url, assetBase).href, value => {
          if (disposed) value.dispose(); else ready(value);
          resolve(value);
        }, progress, error => {
          // The world renderer keeps a procedural layer when its art is unavailable.
          failed?.(error);
          if (!disposed) console.warn('[replica-battle] 背景贴图不可用，使用备用场景', url);
          resolve(null);
        });
      });
      pendingTextures.push(pending); return texture;
    },
  };
  const environment = replaceTerrain ? createWorldEnvironment(worldScene, {
    shadowsEnabled: false, textureLoader: loader, initialStage: stageIndex, sceneIds: [selectedScene.id], layoutSeed:createScenerySeed(),
    layerMotion(definition, elapsed, aspect) {
      if (reusedCoast && definition.rigidTerrain) return sampleCoastTerrainMotion(elapsed, frame.camera, unitsPerWorld);
      // Later coastal battles retain the first map's cloud clocks, even when
      // the current chapter's native map has no corresponding layer.
      const cloudMotion = definition.cloudMotion ?? (reusedCoast && definition.role === 'cloud'
        ? (definition.nativeLayer === 5 ? COAST_CLOUD_MOTION.near : COAST_CLOUD_MOTION.far)
        : undefined);
      if (cloudMotion) return sampleCoastCloudMotion(cloudMotion, elapsed, frame.camera, unitsPerWorld);
      if (definition.authoredMotion) return authoredLayerMotion(definition, elapsed, aspect, frame.camera.x, unitsPerWorld);
      const original = definition.nativeLayer !== undefined ? sourceMap.layers.find(layer => layer.layer === definition.nativeLayer) : sourceLayers[definition.id];
      if (!original) throw new Error(`当前关卡缺少背景层：${definition.id}`);
      const offset = frame.mapCameraOffset(original);
      if(definition.rigidTerrain || definition.role==='props')return {
        moduleTravel:(-nativeMapScrollZ(original,elapsed)*(definition.scrollScale??1)+offset.z)*unitsPerWorld,
        moduleUnitsPerWorld:unitsPerWorld,
        lateralOffset:coastIslandLateralOffset(frame.camera.x,offset.x,unitsPerWorld),
      };
      if(definition.modules){
        // Module clouds retain the native collider cycle and camera parallax;
        // their world scale must not fall back to the old full-width fog strip.
        return {
          moduleTravel:(-nativeMapScrollZ(original,elapsed)-offset.z+frame.camera.z)*unitsPerWorld,
          moduleLoopLength:original.loopLength,moduleUnitsPerWorld:unitsPerWorld,
          lateralOffset:coastIslandLateralOffset(frame.camera.x,offset.x,unitsPerWorld),
        };
      }
      const tileHeight = definition.width * aspect / unitsPerWorld;
      const period=definition.cycleTiles??2;
      const scroll = (-nativeMapScrollZ(original, elapsed) * (definition.scrollScale ?? 1) / tileHeight + offset.z / tileHeight) % period;
      // Keep terrain inside the strip's overscan margin. Connected bridges,
      // islands and banks use one source group and the same fixed-camera offset.
      const anchored = definition.role === 'background' || definition.role === 'midground';
      // Native layer 2 has a positive world-space moveScale. With our fixed
      // coast camera, reverse it so foreground banks oppose aircraft motion.
      const directionalLayer = definition.role === 'foreground' || definition.role === 'cloud';
      const direction = coastCamera && directionalLayer ? -Math.sign(original.moveScale || 1) : 1;
      const rigidTerrain = definition.motionGroup === 'terrain';
      const lateralOffset = rigidTerrain ? coastIslandLateralOffset(frame.camera.x, offset.x, unitsPerWorld)
        : anchored ? 0 : definition.presentationMotion && directionalLayer
        ? -frame.camera.x * unitsPerWorld * (definition.role === 'cloud' ? .45 : .3)
        : offset.x * unitsPerWorld * direction;
      return { scroll: (scroll + period) % period, lateralOffset: coastCamera ? Math.max(-12, Math.min(12, lateralOffset)) : lateralOffset };
    },
  }) : { dispose() {}, update() {} };
  // This environment is a generated GPU render target, not a decoded image.
  // Rebuild it after context restoration with the same studio and PMREM settings.
  const makeLighting=()=>{const studio=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);try{return pmrem.fromScene(studio,.04);}finally{studio.dispose();pmrem.dispose();}};
  let lighting=makeLighting();
  aircraftScene.environment = lighting.texture;
  const aircraftLighting=createAircraftLighting(aircraftScene);
  const aircraftCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 10000);
  aircraftCamera.up.set(0, 0, -1);
  function renderAircraftTexture(visualClock, visualPose, displaySize = 0) {
    if(passivePose.enabled){
      fighter.runtime.config.deploymentProgress=passivePose.progress;
      fighter.runtime.config.deployed=passivePose.target;
    }
    updateFlightFighter(fighter, visualClock, visualPose);
    battle.drawHull(aircraftScene,()=>renderWithAircraftStyle(renderer, () => {
      const draw=()=>aircraftRenderer.render(aircraftScene, aircraftCamera, fighter);
      if(fighter.runtime.asset.solid.userData.cleanAircraftSurface){
        renderer.clear();
        renderer.toneMappingExposure=.92;
        aircraftFxRenderer.setColor(fighter.runtime.config.engineColor||'#66d7f0');
        aircraftFxRenderer.render(draw,aircraftTextureSize,aircraftTextureSize);
      }
      else draw();
    }));
    const wake=displaySize>0?sampleCombatEngineWake(fighter,aircraftCamera,{
      clock:visualClock,displaySize,textureSize:aircraftTextureSize,thrust:visualPose.thrust,matricesReady:true,
    }):[];
    battle.engineWake(wake);
    lastRenderedFlightPose={...visualPose};lastRenderedPassive={...passivePose};
  }

  function dispose() {
    if (disposed) return; disposed = true;
    surface.removeEventListener('webglcontextlost',worldLost);
    surface.removeEventListener('webglcontextrestored',worldRestored);
    events?.removeEventListener('pagehide', dispose);
    events?.removeEventListener('shnh-dispose-replica-battle', dispose);
    phantomTrail.history.length=0; wingtipTrail.tracks.forEach(track=>{track.length=0;});
    weather?.dispose();if(stage)delete stage.dataset.weather;
    icons?.dispose(); environment.dispose(); fighter?._disposeVisuals(); fighter?.object3D.removeFromParent();
    lighting.dispose(); aircraftRenderer.dispose(); aircraftFxRenderer.dispose(); screen.close();
  }
  events?.addEventListener('pagehide', dispose, { once: true });
  events?.addEventListener('shnh-dispose-replica-battle', dispose, { once: true });
  try {
    let completed=0;
    const total=pendingTextures.length+1;
    const loaded=value=>{onProgress?.(++completed,total);return value;};
    onProgress?.(0,total);
    await Promise.all([(aircraftReady ?? loadFighterPackages({
      pilotIds: [appearance.aircraft.id],
      allowTextureFallback: true,
      assetBase,
      read: host?.readFighterFile,
      objectLoader: host?.objectLoader,
      assetBytes: host?.assetBytes,
    })).then(loaded), ...pendingTextures.map(task=>task.then(loaded))]);
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
    const hdr=fighter.runtime.asset.solid.userData.cleanAircraftSurface;
    const isActive=()=>!disposed;
    await Promise.all([
      renderWithAircraftStyle(renderer,()=>aircraftRenderer.warmup(aircraftScene,aircraftCamera,fighter,hdr,isActive)),
      ...(replaceTerrain?[battle.warmGround(worldScene,()=>warmRenderPrograms(renderer,worldScene,coastCamera||camera,isActive))]:[]),
    ]);
    if (disposed) throw new DOMException('Battle closed during loading', 'AbortError');
    renderAircraftTexture(0, { bank: 0, pitch: 0, roll: 0, thrust: 0 });
  } catch (error) { dispose(); throw error; }

  return {
    screen, dispose, battleAssetBase:host.battleAssetBase,
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
    missileMounts() {
      return disposed ? [] : projectMissileWingMounts(fighter, aircraftCamera, pose);
    },
    playerSkin: {
      // Authored original skeleton bounds, in original skeleton units.
      width: 273.2, height: 254.54,
      update(next) {
        next=rigidAircraftSkinPose(next);
        next={...next,width:next.width*PLAYER_VISUAL_SCALE,height:next.height*PLAYER_VISUAL_SCALE};
        pose = next;
        battle.hullPose(next);
      },
    },
    setLaunchPresentation(value){
      if((launchPresentation===null)!==(value===null))launchDirty=true;
      launchPresentation=value;
      if(!value)flightVisual.clock=null;
    },
    update(next) {
      if (disposed) return; frame = next;
      weather?.update(frame);
      const profile=weather?.profile;
      const night=profile?.id==='night';
      const weatherChanged=profile!==appliedWeather;
      if(weatherChanged){
        environment.setNight?.(night,terrainWidth,terrainHeight);
        updateAircraftNightLighting(aircraftLighting,night);
        aircraftFxRenderer.setNight(night);
        environment.setRain?.(profile?.rain?(profile.id==='storm'?1:.65):0);
        if(profile&&stage)stage.dataset.weather=profile.id;
        appliedWeather=profile;
      }
      if(!worldContextReady||renderer.getContext().isContextLost())return;
      battle.tint(battle.hull,frame.playerHitFlash?0xffffff:(profile?.aircraftTint??0xffffff),!!frame.playerHitFlash);
      const flightPose=sampleFlightVisual(flightVisual, {...frame,visible:pose?.visible??false});
      if(frame.victoryDeparture)Object.assign(flightPose,{bank:0,pitch:-.045,roll:0,rollActive:false,thrust:1});
      const position=sampleFlightPosition(flightPosition,{...frame,visible:pose?.visible??false,launchActive:launchPresentation!==null});
      if(pose&&frame.flight&&position){
        // Bound the visual offset to a quarter of the actual collision radius.
        // No prediction, extra movement, altered muzzle or changed hit shape.
        pose={...pose,x:pose.x+(position.x-frame.flight.x)*WIDTH/content.world.width,
          y:pose.y-(position.z-frame.flight.z)*WIDTH/content.world.width};
        battle.hull.position.set(pose.x,pose.y,0);
      }
      const departure=frame.victoryDeparture;
      battle.victory(sampleVictoryTrail({departure,pose,from:departure&&frame.flight?frame.projectPoint?.(frame.flight.x,departure.fromZ):null}));
      passivePose=samplePassiveDeployment(passiveState,{...frame,aircraftId:appearance.aircraft.id,visible:pose?.visible??false});
      const passiveDirty=passivePose.serial!==lastRenderedPassive?.serial||passivePose.progress!==lastRenderedPassive?.progress;
      const visualClock=flightVisual.visualClock+(launchPresentation?.time||0);
      const backgroundTime = frame.coastBackgroundTime ?? frame.time;
      const worldWeather = weather?.profile?.id ?? 'clear';
      const view=battle.viewport,viewWidth=view.width,viewHeight=view.height;
      const worldRun=frame.runId??0;
      const worldKey = `${worldRun}/${backgroundTime}/${frame.camera.x}/${frame.camera.z}/${worldWeather}/${viewWidth}/${viewHeight}`;
      let worldDue = lastWorldKey !== worldKey;
      const moving = Math.abs(flightPose.bank) > .002 || flightPose.thrust > .02 || flightPose.rollActive;
      const scriptedPose = launchPresentation || passivePose.active || frame.victoryDeparture;
      const aircraftElapsed = visualClock - lastAircraftVisualClock;
      const aircraftFrameDue = aircraftElapsed >= (scriptedPose || moving ? 1/60 : 1/30) - 1e-6;
      if (flightPose.rollSerial !== lastRollSerial) {
        lastRollSerial = flightPose.rollSerial;
        if (flightPose.rollActive) onFlightRoll?.();
      }
      updatePhantom(flightPose);
      const poseChanged=flightPoseNeedsRefresh(lastRenderedFlightPose,flightPose);
      let renderAircraft=pose&&(aircraftElapsed<0||aircraftFrameDue||weaponsDirty||launchDirty||passiveDirty||poseChanged);
      // Keep the two cached surfaces on separate frames during both normal and slow play.
      const split=staggerPresentation&&replaceTerrain&&worldDue&&renderAircraft&&lastWorldViewport===view&&
        lastWorldRun===worldRun&&!weatherChanged&&frame.displayInterval>0&&!scriptedPose&&!weaponsDirty&&!launchDirty&&!passiveDirty&&!flightPose.rollActive;
      if(split&&!terrainDeferred){worldDue=false;terrainDeferred=true;}
      else{if(split)renderAircraft=false;terrainDeferred=false;}
      let landmarks;
      if (worldDue && replaceTerrain) {
        if (lastWorldViewport !== view) {
          if (coastCamera) {
            coastCamera.left=-365.625*viewWidth/WIDTH;coastCamera.right=-coastCamera.left;
            coastCamera.top=650*viewHeight/HEIGHT;coastCamera.bottom=-coastCamera.top;coastCamera.updateProjectionMatrix();
          } else {
            camera.aspect=viewWidth/viewHeight;
            camera.fov=2*THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(fixedFov/2))*viewHeight/HEIGHT));
            camera.updateProjectionMatrix();
          }
        }
        if (!coastCamera) {
          const shiftX = frame.camera.x * unitsPerWorld, shiftZ = -frame.camera.z * unitsPerWorld;
          camera.position.set(cameraHome.x + shiftX, cameraHome.y, cameraHome.z + shiftZ);
          camera.lookAt(targetHome.x + shiftX, 0, targetHome.z + shiftZ);
        }
        environment.update(backgroundTime, stageIndex, { motionRevision: worldKey, runId:frame.runId });
        if(weather){
          const worldCamera=coastCamera||camera;
          landmarks=(night?environment.nightLights?.(worldCamera,viewWidth,viewHeight):environment.emissiveLights?.(worldCamera,viewWidth,viewHeight))??[];
          if(view.left||view.top)landmarks=landmarks.map(p=>({...p,x:p.x+view.left,y:p.y+view.top,
            poolX:p.poolX===undefined?undefined:p.poolX+view.left,poolY:p.poolY===undefined?undefined:p.poolY+view.top}));
        }
      }
      // Only commit lighting after the current frame's landmarks are projected.
      weather?.setNightLandmarks(landmarks);
      if (renderAircraft) {
        if (frame.clock < lastAircraftClock) {
          fighter._disposeVisuals(); fighter.setPilot(appearance.aircraft.id);
          applyWeaponSkins();
          Object.assign(fighter.runtime.config, { firing: false, cruise: false, trails: 0, particles: 0 });
        }
        const visualPose=launchPresentation?{...flightPose,bank:0,pitch:-.045*launchPresentation.thrust,thrust:launchPresentation.thrust}:flightPose;
        renderAircraftTexture(visualClock, visualPose, Math.max(pose.width,pose.height));
        lastAircraftClock = frame.clock; lastAircraftVisualClock = visualClock; weaponsDirty = false;launchDirty=false;
      }
      updateWingtipTrails(flightPose);
      if (!replaceTerrain) {
        lastWorldKey = worldKey;
        return;
      }
      if (!worldDue) return;
      battle.drawGround(worldScene,coastCamera||camera,selectedScene.ground);
      lastWorldKey = worldKey;
      lastWorldViewport=view;
      lastWorldRun=worldRun;
    },
  };
}
