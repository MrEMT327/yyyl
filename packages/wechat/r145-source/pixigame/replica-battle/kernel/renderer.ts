import {damageTextPresentation,sampleEnemyHitMotion,sampleCombatResults} from './combat-hit-presentation.mjs';
import {preloadDamageNumberArt,updateDamageTextView,type DamageTextView} from './damage-number-art';
import {sampleHealingReceipt} from './healing-receipt.mjs';
import {sampleSpecialWeaponFeedback} from './special-weapon-feedback.mjs';
import {sampleCoinPickupReceipt} from './coin-pickup-feedback.mjs';
import {drawPlayerDamageVignette,PLAYER_DAMAGE_VIGNETTE_DEPTH} from './player-damage-vignette.mjs';
import {aircraftPassiveShot} from '../../src/replica/project-passive-deployment.js';
import {COMBAT_LAYERS,playerVisibility} from './combat-readability.mjs';
import {CombatRenderSamples,CombatStatusIndex} from '../../src/replica/combat-render-samples.mjs';
import {MissileWingMounts} from '../../src/replica/missile-wing-mounts.mjs';
import {captureEnemyDeathBody,enemyDeathVisualScale} from '../small-death-visual.js';
import {sampleNativeUrgencyWarning} from './enemy-warning';
import {applySourceStatusTint} from './pathogenic/source-status-tint';
import {setupFirstChapterBloom,registerFirstChapterSpriteBloom} from './pathogenic/chapter1-bloom';
import {PathogenicBattleEffects} from './pathogenic/pathogenic-battle-effects';
import pathogenicGraph from './pathogenic/scene-graph.json';
import {restoredSequenceOwnsSprite} from '../weapon-visual-quality.js';
import {thunderBeam} from './thunder-presentation';
import {sweep} from './model';
import {warningEndPoint} from './warning-line';
import Phaser from 'phaser';
import {nativeBattleBufferSize} from '../../src/replica/native-battle-render-budget.js';
import { preloadPickupArt, createPickupVisual, updatePickupVisual } from './pickup-visual';
import { preloadSupplyChestArt, createSupplyChestVisual, updateSupplyChestVisual } from './supply-chest-visual';

import { createShockwavePickup, shockwavePickupModelId, createFrenzyPickup, frenzyPickupModelId } from './airdrop-visual';
import type { BattleAppearance } from '../appearance-types';
// Monster appearance uses the captured native prefab/sprite/animation records.
import type { Choice, GameContent, Enemy, RecordData, Effect, Point } from './model';
import { chapterOneBossAtlases, chapterOneDeferredAtlases, chapterOneWeaponArt } from './pathogenic/battle-texture-dependencies.mjs';
import type { Simulation } from './simulation';
import { SpinePlayer, preloadPlayerSpine, spinePlugin } from './spine-player';
import { unusedChapterEnemyProjectileArt } from './pathogenic/enemy-projectile-presentation.mjs';
import { planBattleImages } from './battle-image-plan';
import { installMissingSourceTexture } from './pathogenic/source-texture-regions.mjs';
import { selectPlayerAppearance } from './player-appearance';
import { OriginalParticlePipeline, OriginalParticleMesh } from './particle-pipeline';
import { EnemyHealthBar } from './enemy-health-bar';
import { pickupExpiryAlpha } from './pickup-expiry-presentation';
import urgencySource from '../public/data/enemy-warning.json';
import { nativeLogicDelta } from './native-time';
import chestAnimations from '../public/data/chest-animation.json';
import { nativeMapScrollZ, nativeMapSegmentPoses, NativeMapCameraOffsets, type NativeMapLayer, type NativeMapSpriteRenderer } from './native-map-layers';
import { sampleNativeEnemyAnimation } from './native-enemy-animation';
import { NativeViewPosition } from './native-view-position';
import { preloadChapterOrbitArt, createChapterOrbitArt } from '../chapter-orbit-art';
import { chapterDeathCallParameters } from '../chapter-death-traits';
import { preloadScatterGunboat, createScatterGunboat, updateScatterGunboat } from '../scatter-gunboat-art';
import { preloadPatrolDrone, createPatrolDrone, updatePatrolDrone } from '../patrol-drone-art';
import { preloadHeavyScatter, createHeavyScatter, updateHeavyScatter } from '../heavy-scatter-art';
import { preloadEliteScatter, createEliteScatter, updateEliteScatter } from '../elite-scatter-art';
import { BattleShotPresentation } from './enemy-recoil-shots';
import { preloadSiegeBoss, createSiegeBoss, updateSiegeBoss } from '../siege-boss-art';
import { preloadChapter41Enemies, createChapter41Enemy, updateChapter41Enemy } from '../chapter41-enemy-art';
import { preloadChapter38Enemies, createChapter38Enemy, updateChapter38Enemy } from '../chapter38-enemy-art';
import { preloadChapter33Enemies, createChapter33Enemy, updateChapter33Enemy } from '../chapter33-enemy-art';
import { preloadChapter31Enemies, createChapter31Enemy, updateChapter31Enemy } from '../chapter31-enemy-art';
import { preloadChapter29Enemies, createChapter29Enemy, updateChapter29Enemy } from '../chapter29-enemy-art';
import { preloadChapter27Enemies, createChapter27Enemy, updateChapter27Enemy } from '../chapter27-enemy-art';
import { preloadChapter26Enemies, createChapter26Enemy, updateChapter26Enemy } from '../chapter26-enemy-art';
import { preloadChapter25Enemies, createChapter25Enemy, updateChapter25Enemy } from '../chapter25-enemy-art';
import { preloadChapter24Enemies, createChapter24Enemy, updateChapter24Enemy } from '../chapter24-enemy-art';
import { preloadChapter22Enemies, createChapter22Enemy, updateChapter22Enemy } from '../chapter22-enemy-art';
import { preloadChapter21Enemies, createChapter21Enemy, updateChapter21Enemy } from '../chapter21-enemy-art';
import { preloadChapter20Enemies, createChapter20Enemy, updateChapter20Enemy } from '../chapter20-enemy-art';
import { preloadChapter19Enemies, createChapter19Enemy, updateChapter19Enemy } from '../chapter19-enemy-art';
import { preloadChapter18Enemies, createChapter18Enemy, updateChapter18Enemy } from '../chapter18-enemy-art';
import { preloadChapter17Enemies, createChapter17Enemy, updateChapter17Enemy } from '../chapter17-enemy-art';
import { preloadChapter16Enemies, createChapter16Enemy, updateChapter16Enemy } from '../chapter16-enemy-art';
import { preloadChapter15Enemies, createChapter15Enemy, updateChapter15Enemy } from '../chapter15-enemy-art';
import { preloadChapter14Enemies, createChapter14Enemy, updateChapter14Enemy } from '../chapter14-enemy-art';
import { preloadChapter13Enemies, createChapter13Enemy, updateChapter13Enemy } from '../chapter13-enemy-art';
import { preloadChapter12Enemies, createChapter12Enemy, updateChapter12Enemy } from '../chapter12-enemy-art';
import { preloadChapter11Enemies, createChapter11Enemy, updateChapter11Enemy } from '../chapter11-enemy-art';
import { preloadChapter10Enemies, createChapter10Enemy, updateChapter10Enemy } from '../chapter10-enemy-art';
import { preloadChapter9Enemies, createChapter9Enemy, updateChapter9Enemy } from '../chapter9-enemy-art';
import { preloadChapter8Enemies, createChapter8Enemy, updateChapter8Enemy } from '../chapter8-enemy-art';
import { preloadChapter6Enemies, createChapter6Enemy, updateChapter6Enemy } from '../chapter6-enemy-art';
import { preloadChapter5Enemies, createChapter5Enemy, updateChapter5Enemy } from '../chapter5-enemy-art';
import { preloadChapter4Enemies, createChapter4Enemy, updateChapter4Enemy } from '../chapter4-enemy-art';
import { preloadChapter3Enemies, createChapter3Enemy, updateChapter3Enemy } from '../chapter3-enemy-art';
import { preloadChapter2Enemies, createChapter2Enemy, updateChapter2Enemy } from '../chapter2-enemy-art';

const WIDTH = 540, HEIGHT = 960;
type Display = Phaser.GameObjects.Container | Phaser.GameObjects.Image | Phaser.GameObjects.Text | Phaser.GameObjects.BitmapText | Phaser.GameObjects.Graphics | OriginalParticleMesh;

type EnemyAnimation = (view: Phaser.GameObjects.Container, enemy: Enemy, position: Point,
  delta: number, clock: number, lastShot?: number) => boolean;

// Resolve the animation when the model is created. Each view keeps its own handler.
const spriteEnemyModels = [
  [createScatterGunboat, updateScatterGunboat],
  [createPatrolDrone, updatePatrolDrone],
  [createHeavyScatter, updateHeavyScatter],
  [createEliteScatter, updateEliteScatter],
] as const;

const prefabEnemyModels = [
  [createSiegeBoss, updateSiegeBoss],
  [createChapter2Enemy, updateChapter2Enemy],
  [createChapter3Enemy, updateChapter3Enemy],
  [createChapter4Enemy, updateChapter4Enemy],
  [createChapter5Enemy, updateChapter5Enemy],
  [createChapter6Enemy, updateChapter6Enemy],
  [createChapter8Enemy, updateChapter8Enemy],
  [createChapter9Enemy, updateChapter9Enemy],
  [createChapter10Enemy, updateChapter10Enemy],
  [createChapter11Enemy, updateChapter11Enemy],
  [createChapter12Enemy, updateChapter12Enemy],
  [createChapter13Enemy, updateChapter13Enemy],
  [createChapter14Enemy, updateChapter14Enemy],
  [createChapter15Enemy, updateChapter15Enemy],
  [createChapter16Enemy, updateChapter16Enemy],
  [createChapter17Enemy, updateChapter17Enemy],
  [createChapter18Enemy, updateChapter18Enemy],
  [createChapter19Enemy, updateChapter19Enemy],
  [createChapter20Enemy, updateChapter20Enemy],
  [createChapter21Enemy, updateChapter21Enemy],
  [createChapter22Enemy, updateChapter22Enemy],
  [createChapter24Enemy, updateChapter24Enemy],
  [createChapter25Enemy, updateChapter25Enemy],
  [createChapter26Enemy, updateChapter26Enemy],
  [createChapter27Enemy, updateChapter27Enemy],
  [createChapter29Enemy, updateChapter29Enemy],
  [createChapter31Enemy, updateChapter31Enemy],
  [createChapter33Enemy, updateChapter33Enemy],
  [createChapter38Enemy, updateChapter38Enemy],
  [createChapter41Enemy, updateChapter41Enemy],
] as const;

export class BattleView extends Phaser.Scene {
  private objects = new Map<string, Display>();
  private readonly enemyAnimations = new WeakMap<Phaser.GameObjects.Container, EnemyAnimation>();
  private readonly renderSamples = new CombatRenderSamples();
  private readonly missileWingMounts = new MissileWingMounts();
  private readonly statusIndex = new CombatStatusIndex();
  private readonly shotPresentation = new BattleShotPresentation();
  private readonly liveViews = new Set<string>();
  private readonly liveEnemyIds = new Set<number>();
  private enemyViewPositions = new Map<number, { view: NativeViewPosition; target: Point; revision: number }>();
  private readonly cameraView = new NativeViewPosition({ x: 0, z: 0 }, true);
  private cameraRunId = -1;
  private cameraTargetRevision = -1;
  private readonly mapCameraOffsets = new NativeMapCameraOffsets();
  private vfxRunId = -1;
  private pathogenic!: PathogenicBattleEffects;
  private terrain: { image: Phaser.GameObjects.Image; z: number; x: number }[] = [];
  private nativeTerrain: { row: NativeMapSpriteRenderer; layer: NativeMapLayer; geometry: { vertices: { x: number; z: number; u: number; v: number }[]; indices: number[] } }[] = [];
  private mapSubtractBlend = Phaser.BlendModes.NORMAL;
  private chestProgress!: Phaser.GameObjects.Graphics;
  private playerDamage?: Phaser.GameObjects.Graphics;
  private prefabByModel = new Map<number, string>();
  private spriteByPathId = new Map<string, string>();
  private px: number;
  private playerSpine?: SpinePlayer;
  private playerAppearance?: ReturnType<typeof selectPlayerAppearance>;
  private playerAppearanceSource?: RecordData;
  private playerAppearanceKey = '';
  private readPlayerAppearance() {
    const selection = this.content.combat.studyLoadout;
    if (!this.playerAppearance || selection !== this.playerAppearanceSource) {
      this.playerAppearanceSource = selection;
      this.playerAppearance = selectPlayerAppearance(this.content);
    }
    return this.playerAppearance;
  }
  coastBackgroundTime = 0;
  combatRenderFraction?: number;
  private warmedChapterOneWave = 1;
  onFrame?: (delta: number) => void;
  beginMeasure?: (phase: 'enemyVisual' | 'projectileVisual', items: number) => (()=>void)|undefined;
  constructor(private content: GameContent, private sim: Simulation, private ready: () => void, private appearance?: BattleAppearance,
    private loading?: { progress(value: number): void; complete(): void }, private imagePlan?: ReturnType<typeof planBattleImages>,
    private readonly optimizeChapterOne = false, private readonly nativeChapterEnemyArt = false) {
    super('battle'); this.px = WIDTH / content.world.width;
    if (imagePlan) {
      this.prefabByModel = imagePlan.prefabByModel;
      this.spriteByPathId = imagePlan.spriteByPathId;
    } else {
      for (const [key, prefab] of Object.entries(content.assets.prefabs) as [string, RecordData][])
        for (const id of prefab.modelIds || []) this.prefabByModel.set(id, key);
      for (const [key, sprite] of Object.entries(content.assets.sprites) as [string, RecordData][])
        if (sprite.pathId) this.spriteByPathId.set(String(sprite.pathId), key);
    }
  }
  preload() {
    preloadDamageNumberArt(this);
    preloadPickupArt(this);
    preloadSupplyChestArt(this);
    this.pathogenic=new PathogenicBattleEffects(this,pathogenicGraph);
    this.pathogenic.configureHost({weaponSkinId:()=>this.content.combat.studyLoadout?.selectedGunIds??Number(this.content.combat.studyLoadout?.selectedGunId||0),playerBulletCount:()=>this.sim.projectiles.filter(b=>b.owner==='player'&&!b.dead).length,raycastBeam:q=>this.sourceRaycast(q),nativeSwordEffects:this.content.assets.originalEffects});
    const deferred = this.optimizeChapterOne ? new Set(chapterOneDeferredAtlases) : undefined;
    if (deferred) {
      for (const key of unusedChapterEnemyProjectileArt(Object.values(this.content.chapter.bullets).map(row => row.parameters.ModelId))) deferred.add(key);
      for (const key of this.loadoutArt(this.content.combat.studyLoadout?.battleSkillIds || [])) deferred.delete(key);
    }
    this.pathogenic.preload((_p,t)=>t.url,deferred);
    const models = this.optimizeChapterOne ? new Set<number>()
      : this.nativeChapterEnemyArt ? this.enemyArtModels() : new Set(this.prefabByModel.keys());
    if (this.optimizeChapterOne) {
      // The opening formations reuse a handful of atlases. Load them under
      // the sortie cover so the loader never uploads them during those waves.
      this.warmedChapterOneWave = Math.min(4, this.content.chapter.chapter.waveCount);
      for (let wave=1;wave<=this.warmedChapterOneWave;wave++)
        for (const model of this.enemyArtModels(wave)) models.add(model);
    }
    this.preloadEnemyArt(models);
    this.appearance?.preload(this);
    // Native enemy layers join the normal prefab preload below.
    // Prepare only the equipped appearance. Later configuration changes use
    // ensureBattlePlayerAssets before the host starts the next sortie.
    const replaceTerrain = Boolean(this.appearance?.replaceTerrain);
    const plan = this.imagePlan ?? planBattleImages(this.content, {
      playerLayers: selectPlayerAppearance(this.content).layers,
      bodyPoseOnly: Boolean(this.appearance?.playerSkin),
      replaceTerrain,
      nativeTerrain: !replaceTerrain && Boolean(this.content.assets.map.nativeLayers?.renderers?.length)
        && this.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer,
    });
    preloadPlayerSpine(this, plan.spines);
    for (const [key, url] of plan.images) this.load.image(key, url);
    this.load.on('progress', (value: number) => {
      if (this.loading) this.loading.progress(value);
      else {
        const bar = globalThis.document?.querySelector('#loading progress') as HTMLProgressElement;
        if (bar) bar.value = value;
      }
    });
    this.load.on('loaderror', (file: Phaser.Loader.File) => {
      if (file.key.startsWith('owned-enemy:')) {
        // The model renderer uses the preloaded prefab sprites when an atlas is missing.
        console.warn('[replica-battle] 敌机外观加载失败，使用预制贴图', file.key);
        return;
      }
      if (['image', 'spritesheet', 'svg'].includes(file.type) || ['spine', 'bitmapfont'].includes(file.multiFile?.type ?? '')) {
        const texture = this.pathogenic.graph.textures[file.key];
        if (texture) installMissingSourceTexture(this, file.key, texture);
        console.warn('[replica-battle] 战斗图片加载失败，使用备用绘制', file.key);
        return;
      }
      this.appearance?.onResourceLoadError?.(file.key);
      console.error('原始资源加载失败', file.key);
    });
  }
  private loadoutArt(skillIds: readonly number[]) {
    const skills = new Set(skillIds);
    return (Object.values(this.content.combat.families || {}) as RecordData[])
      .filter(family => family.stages.some((stage: RecordData) => skills.has(stage.skillId)))
      .flatMap(family => chapterOneWeaponArt(family.entityId));
  }
  prepareLoadoutArt(skillIds: readonly number[]) {
    if (this.optimizeChapterOne) return this.pathogenic.source.prepareTextures(this.loadoutArt(skillIds));
  }
  prepareChoiceArt(choice: Choice) {
    if (!this.optimizeChapterOne) return;
    const family = this.content.combat.families[choice.group];
    if (family) return this.pathogenic.source.prepareTextures(chapterOneWeaponArt(family.entityId));
  }
  private enemyArtModels(wave?: number) {
    const ids = new Set<number>();
    for (const spawn of this.content.spawns) {
      if (wave === undefined || spawn.wave === wave) ids.add(spawn.entityId);
    }
    const models = new Set<number>();
    // Walk the same spawn routes used by the simulation, including children.
    for (const id of ids) {
      const entity = this.content.chapter.entities[id];
      if (!entity) continue;
      if (entity.modelId !== undefined) models.add(entity.modelId);
      const summons = entity.ai?.parameters?.CallMonsters;
      if (Array.isArray(summons)) for (const call of summons) ids.add(Number(call?.CallMonsterId));
      for (const trait of entity.raw?.SpecialTrait || []) {
        const child = chapterDeathCallParameters(trait);
        if (child) ids.add(child.callEntityID);
      }
    }
    return models;
  }
  private warmNextWaveArt() {
    // Use the current wave as lead time for the next wave's optional atlases.
    // The regular prefab sprites are already loaded if an atlas is late.
    const wave = this.sim.wave + 1;
    if (wave <= this.warmedChapterOneWave) return;
    this.warmedChapterOneWave = wave;
    const models = this.enemyArtModels(wave);
    if (!models.size) return;
    this.preloadEnemyArt(models);
    const boss = this.content.spawns.some(spawn => spawn.wave === wave
      && this.content.chapter.entities[spawn.entityId]?.type === 3);
    if (boss) void this.pathogenic.source.prepareTextures(chapterOneBossAtlases);
    if (this.load.list.size && !this.load.isLoading()) this.load.start();
  }
  private preloadEnemyArt(models: ReadonlySet<number>) {
    preloadChapterOrbitArt(this, models);
    preloadScatterGunboat(this, models);
    preloadPatrolDrone(this, models);
    preloadHeavyScatter(this, models);
    preloadEliteScatter(this, models);
    preloadSiegeBoss(this, models);
    preloadChapter41Enemies(this, models);
    preloadChapter38Enemies(this, models);
    preloadChapter33Enemies(this, models);
    preloadChapter31Enemies(this, models);
    preloadChapter29Enemies(this, models);
    preloadChapter27Enemies(this, models);
    preloadChapter26Enemies(this, models);
    preloadChapter25Enemies(this, models);
    preloadChapter24Enemies(this, models);
    preloadChapter22Enemies(this, models);
    preloadChapter21Enemies(this, models);
    preloadChapter20Enemies(this, models);
    preloadChapter19Enemies(this, models);
    preloadChapter18Enemies(this, models);
    preloadChapter17Enemies(this, models);
    preloadChapter16Enemies(this, models);
    preloadChapter15Enemies(this, models);
    preloadChapter14Enemies(this, models);
    preloadChapter13Enemies(this, models);
    preloadChapter12Enemies(this, models);
    preloadChapter11Enemies(this, models);
    preloadChapter10Enemies(this, models);
    preloadChapter9Enemies(this, models);
    preloadChapter8Enemies(this, models);
    preloadChapter6Enemies(this, models);
    preloadChapter5Enemies(this, models);
    preloadChapter4Enemies(this, models);
    preloadChapter3Enemies(this, models);
    preloadChapter2Enemies(this, models);
  }
  releaseBattleVisuals() {
    // Game.destroy emits DESTROY, not scene SHUTDOWN. Delete the source's
    // custom WebGL programs and targets before Phaser nulls the renderer.
    this.pathogenic?.destroy();
    this.playerSpine?.destroy();this.playerSpine=undefined;
    this.objects.clear();this.enemyViewPositions.clear();
  }
  create() {
    const renderScale = this.scale.width / WIDTH;
    if (renderScale !== 1) {
      // Leave world projection, input and gameplay in their original units.
      this.cameras.main.setOrigin(0, 0).setZoom(renderScale);
      this.pathogenic.source.setRenderScale(renderScale);
    }
    if (this.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer && !this.renderer.pipelines.has('OriginalParticle')) {
      this.renderer.pipelines.add('OriginalParticle', new OriginalParticlePipeline(this.game));
    }
    if (this.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      const gl = this.renderer.gl;
      // The original subtract fog uses dst-src RGB. Preserve destination alpha.
      this.mapSubtractBlend = this.renderer.addBlendMode([gl.ONE, gl.ONE, gl.ZERO, gl.ONE], gl.FUNC_REVERSE_SUBTRACT);
    }
    setupFirstChapterBloom(this,this.pathogenic.source,Number(this.content.chapter.chapter.id),this.appearance?.combatBloomLevels)??registerFirstChapterSpriteBloom(this);
    this.appearance?.create(this);
    if (!this.appearance?.replaceTerrain) this.createTerrain();
    this.chestProgress = this.add.graphics().setDepth(50).setVisible(false);
    this.playerDamage = undefined;
    const playerModel = this.content.assets.prefabs[this.prefabByModel.get(this.content.chapter.entities[this.content.chapter.player.entityId].modelId)!];
    const appearance = this.readPlayerAppearance();
    if (appearance.layers.length || playerModel?.spine) this.playerSpine = new SpinePlayer(this, appearance.layers.length ? appearance.layers : playerModel.spine, this.appearance?.playerSkin);
    this.playerAppearanceKey = appearance.key;
    if (this.loading) this.loading.complete();
    else globalThis.document?.querySelector('#loading')?.remove();
    this.ready();
  }
  get cameraPosition(): Readonly<Point> { return this.cameraView.position; }
  private readonly projectPoint = (x: number, z: number) => this.screen(x,z);
  private screen(x: number, z: number) {
    const camera = this.cameraPosition;
    return { x: WIDTH / 2 + (x - camera.x) * this.px, y: HEIGHT / 2 - (z - camera.z) * this.px };
  }
  private advanceCameraView(delta: number): void {
    const s = this.sim;
    if (this.cameraRunId !== s.runId) {
      this.cameraView.setPosition({ x: 0, z: 0 }); this.mapCameraOffsets.reset();
      this.cameraRunId = s.runId; this.cameraTargetRevision = -1;
    }
    if (this.cameraTargetRevision !== s.cameraRevision) {
      // Reduce lateral presentation sway; all entities and drag input share this camera.
      this.cameraView.setTargetPosition({ x: s.cameraPosition.x * .75, z: s.cameraPosition.z });
      this.cameraTargetRevision = s.cameraRevision;
    }
    const previous = this.cameraView.position;
    const position = this.cameraView.update(s.phase === 'playing' ? Math.min(Math.max(delta / 1000, 0), .1) : 0);
    const map = this.content.assets.map.nativeLayers;
    if (map) this.mapCameraOffsets.update(map.layers, { x: position.x - previous.x, z: position.z - previous.z }, map.simulationViewMoveDenominator);
  }
  private createTerrain() {
    const a = this.content.assets;
    if (a.map.nativeLayers?.renderers?.length && this.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      const layers = new Map<string, NativeMapLayer>((a.map.nativeLayers.layers as NativeMapLayer[]).map(layer => [layer.id, layer]));
      for (const row of a.map.nativeLayers.renderers as NativeMapSpriteRenderer[]) {
        const layer = layers.get(row.owner), sprite = a.sprites[row.sprite];
        if (!row.active || !row.enabled || !layer?.active || !sprite || !this.textures.exists(row.sprite)) continue;
        let width = sprite.width / sprite.ppu, height = sprite.height / sprite.ppu;
        let pivot = sprite.pivot || { x: .5, y: .5 };
        if (row.drawMode) { width = row.size.x; height = row.size.y; pivot = { x: .5, y: .5 }; }
        const m = row.matrix;
        const vertices = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => {
          const x = (u - pivot.x) * width, y = (v - pivot.y) * height;
          return { x: m[0][0] * x + m[0][1] * y + m[0][3], z: m[2][0] * x + m[2][1] * y + m[2][3],
            u: row.flipX ? 1 - u : u, v: row.flipY ? v : 1 - v };
        });
        this.nativeTerrain.push({ row, layer, geometry: { vertices, indices: [0, 1, 2, 0, 2, 3] } });
      }
      return;
    }
    if (a.map.segments?.length) {
      for (const [i, segment] of a.map.segments.entries()) {
        const key = segment.key || `map:${segment.index ?? i}`;
        if (!this.textures.exists(key)) continue;
        const bounds = segment.bounds;
        const x = bounds ? (bounds[0] + bounds[2]) / 2 : segment.x || 0, z = bounds ? (bounds[1] + bounds[3]) / 2 : segment.z || 0;
        const pos = this.screen(x, z);
        const image = this.add.image(pos.x, pos.y, key).setDepth(-100);
        image.setDisplaySize((bounds ? bounds[2] - bounds[0] : segment.worldWidth || 32) * this.px, (bounds ? bounds[3] - bounds[1] : segment.worldHeight || 32) * this.px);
        this.terrain.push({ image, x, z });
      }
      return;
    }
    const layers = (a.map.renderers || []).filter((r: RecordData) => r.active && r.enabled && r.sprite && this.textures.exists(r.sprite));
    for (const r of layers) {
      const sprite = a.sprites[r.sprite], pos = this.screen(r.worldX ?? r.x, r.worldZ ?? r.z);
      const image = this.add.image(pos.x, pos.y, r.sprite).setOrigin(sprite.pivot?.x ?? 0.5, 1 - (sprite.pivot?.y ?? 0.5));
      image.setScale(this.px / sprite.ppu * r.scaleX, this.px / sprite.ppu * r.scaleY).setAngle(-(r.rotation || 0));
      image.setDepth(-100 + (r.sortingOrder || 0) * 0.001).setAlpha(r.color?.a ?? 1);
      this.terrain.push({ image, x: r.worldX ?? r.x, z: r.worldZ ?? r.z });
    }
  }
  private drawNativeTerrain(live: Set<string>) {
    const camera = this.cameraPosition;
    const visibleBounds: [number, number, number, number] = [camera.x - this.content.world.width / 2, camera.z - this.content.world.height / 2,
      camera.x + this.content.world.width / 2, camera.z + this.content.world.height / 2];
    const offsets = new Map<string, number>();
    for (const entry of this.nativeTerrain) {
      const { row, layer } = entry;
      if (!offsets.has(layer.id)) offsets.set(layer.id, nativeMapScrollZ(layer, this.sim.time));
      const scroll = offsets.get(layer.id)!;
      const displacement = this.mapCameraOffsets.position(layer);
      for (const pose of nativeMapSegmentPoses(layer, row, scroll, visibleBounds, displacement)) {
        const key = `terrain:${row.rendererPathId}:${pose.repeat}`; live.add(key);
        let mesh = this.objects.get(key) as OriginalParticleMesh | undefined;
        if (!mesh) {
          mesh = new OriginalParticleMesh(this, row.sprite); this.add.existing(mesh); this.objects.set(key, mesh);
          const color = row.color || { r: 1, g: 1, b: 1, a: 1 }, gain = Math.max(1, color.r, color.g, color.b);
          const tint = Phaser.Display.Color.GetColor(Math.round(color.r / gain * 255), Math.round(color.g / gain * 255), Math.round(color.b / gain * 255));
          mesh.setGeometry(entry.geometry, this.px, tint).setAlpha(color.a).setData('tintGain', gain).setPipeline('OriginalParticle');
          mesh.setDepth(-100 + row.batchOrder * .001).setBlendMode(row.blendMode === 'ADD' ? Phaser.BlendModes.ADD : row.blendMode === 'SUBTRACT' ? this.mapSubtractBlend : Phaser.BlendModes.NORMAL);
        }
        const pos = this.screen(displacement.x, scroll + pose.repeat * layer.loopLength + displacement.z); mesh.setPosition(pos.x, pos.y);
      }
    }
  }
  private model(modelId: number, fallbackSize = 1): Phaser.GameObjects.Container {
    // Particle-only models are rendered through originalEffect below.
    const orbitArt = createChapterOrbitArt(this, modelId, this.px);
    if (orbitArt) return orbitArt;
    const { assets } = this.content;
    const name = this.prefabByModel.get(modelId), sourcePrefab = assets.prefabs[name || ''];
    for (const [create, animate] of spriteEnemyModels) {
      const view = create(this, modelId, this.px, sourcePrefab, assets.sprites);
      if (view) { this.enemyAnimations.set(view, animate); return view; }
    }
    for (const [create, animate] of prefabEnemyModels) {
      const view = create(this, modelId, this.px, sourcePrefab, assets);
      if (view) { this.enemyAnimations.set(view, animate); return view; }
    }
    // Other enemy models continue through the native prefab renderer.
    if (modelId === shockwavePickupModelId) return createShockwavePickup(this, this.px);
    if (modelId === frenzyPickupModelId) return createFrenzyPickup(this, this.px);
    const container = this.add.container(0, 0);
    const prefab = name ? sourcePrefab : undefined;
    if (prefab?.composite && this.textures.exists(prefab.composite)) {
      const sprite = this.content.assets.sprites[prefab.composite];
      container.add(this.add.image(0, 0, prefab.composite).setScale(this.px / sprite.ppu));
      return container;
    }
    const animated = new Set(name ? this.content.assets.enemyLocalAnimation?.animatedRendererPaths?.[name] || [] : []);
    const layers = (prefab?.renderers || []).filter((r: RecordData) => ((r.active && r.enabled) || animated.has(r.hierarchy?.join('/'))) && r.sprite && this.textures.exists(r.sprite)).sort((a: RecordData, b: RecordData) => a.sortingOrder - b.sortingOrder || (a.hierarchyOrder ?? 0) - (b.hierarchyOrder ?? 0));
    for (const r of layers) {
      if (restoredSequenceOwnsSprite(modelId, r.hierarchy, this.content.assets)) continue;
      const sprite = this.content.assets.sprites[r.sprite];
      const m = r.matrix;
      const image = this.add.image((m ? m[0][3] : r.x) * this.px, -(m ? m[2][3] : r.y) * this.px, r.sprite);
      image.setData('sourceSprite', r.sprite);
      image.setData('sourcePath', r.hierarchy?.join('/'));
      const pivot = sprite.renderPivot || sprite.pivot || { x: .5, y: .5 };
      image.setOrigin(pivot.x, 1 - pivot.y);
      if (m) {
        const a = m[0][0], b = -m[2][0], c = -m[0][1], d = m[2][1];
        const sx = Math.hypot(a, b), sy = sx ? (a * d - b * c) / sx : 0;
        image.setScale(this.px / sprite.ppu * sx, this.px / sprite.ppu * sy * (sprite.originalArtScaleY ?? 1)).setRotation(Math.atan2(b, a));
      } else image.setScale(this.px / sprite.ppu * r.scaleX, this.px / sprite.ppu * r.scaleY * (sprite.originalArtScaleY ?? 1)).setAngle(-(r.rotation || 0));
      image.setFlip(r.flipX || false, r.flipY || false).setAlpha(r.color?.a ?? 1);
      container.add(image);
    }
    if (!container.length) {
      // Restored sequence owns the sprite; do not re-add its static first frame.
      if ([1000012,1000013,1000031,1000032,1000006,1000043,1000036].includes(modelId) && this.content.assets.originalEffects.effects[modelId]?.sequences?.some((s: RecordData) => s.active !== false && s.frames?.length)) return container;
      const key = this.effectKey(modelId);
      if (key) container.add(this.add.image(0, 0, key).setDisplaySize(fallbackSize * this.px, fallbackSize * this.px));
    }
    return container;
  }
  private effectKey(modelId: number): string | undefined {
    const e = this.content.assets.effects?.[modelId];
    for (const key of [e?.sprite, e?.textureKey, e?.key, e?.sequence?.[0], ...(e?.layers || []).flatMap((layer: RecordData) => (layer.textures || []).map((texture: RecordData) => texture.sprite)), `effect:${modelId}`]) if (key && this.textures.exists(key)) return key;
    return undefined;
  }
  update(_time: number, delta: number) {
    this.onFrame?.(delta);
    if (this.optimizeChapterOne && this.sim.phase === 'playing' && this.sim.clock > 0) this.warmNextWaveArt();
    // CameraView.Root is the original camera root: its ordinary EntityView
    // interpolation IS the display movement. No second follow/Lerp is applied.
    this.advanceCameraView(delta);
    const s = this.sim, live = this.liveViews; live.clear();
    const visualClock = this.renderSamples.beginFrame(s.clock,s.runId,s.phase,delta/1000,this.combatRenderFraction);
    const statusIndex = this.statusIndex.update(s);
    const sourceCamera=this.screen(0,0);this.pathogenic.setCameraOffset(sourceCamera.x,sourceCamera.y);
    const playerBulletCount = this.shotPresentation.update(s.enemies, s.projectiles, s.clock);
    this.pathogenic.beginFrame(s.clock,s.runId,{playerBulletCount,visualClock,escortSwords:s.projectiles,escortPlayer:s.player});
    if(this.vfxRunId!==s.runId||s.phase==='ready'){this.enemyViewPositions.clear();this.vfxRunId=s.runId;}
    this.drawNativeTerrain(live);
    const mapLength = this.content.assets.map.loopLength || 192;
    const mapSpeed = this.content.assets.map.scrollSpeed ?? 1.2;
    for (const entry of this.terrain) {
      let z = entry.z - s.time * mapSpeed;
      z = ((z + this.content.world.height / 2 + 32) % mapLength + mapLength) % mapLength - this.content.world.height / 2 - 32;
      const pos = this.screen(entry.x, z); entry.image.setPosition(pos.x, pos.y);
      entry.image.setVisible(pos.y > -entry.image.displayHeight && pos.y < HEIGHT + entry.image.displayHeight);
    }
    if (this.chestProgress.visible) this.chestProgress.clear().setVisible(false);
    const pp = this.screen(s.player.x, s.player.z);
    const appearance = this.readPlayerAppearance();
    if (appearance.key !== this.playerAppearanceKey && appearance.layers.length) {
      this.playerSpine?.destroy();
      this.playerSpine = new SpinePlayer(this, appearance.layers, this.appearance?.playerSkin);
      this.playerAppearanceKey = appearance.key;
    }
    const playerEntity = this.content.chapter.entities[this.content.chapter.player.entityId];
    const phantomActive = s.playerPhantomActive;
    const alpha = playerVisibility(s.clock,s.player.invincible,phantomActive);
    if (this.playerSpine) this.playerSpine.update(s.clock, pp.x, pp.y, this.px, Number(appearance.plane?.modelScale ?? playerEntity.modelScale) * s.playerScale, s.player.hp > 0, alpha, s.playerMotion);
    else {
      const playerKey = 'player'; live.add(playerKey);
      let player = this.objects.get(playerKey) as Phaser.GameObjects.Container | undefined;
      if (!player) { player = this.model(playerEntity.modelId); player.setDepth(COMBAT_LAYERS.player); this.objects.set(playerKey, player); }
      player.setPosition(pp.x, pp.y).setScale(playerEntity.modelScale * s.playerScale).setVisible(s.player.hp > 0).setAlpha(alpha);
      this.tint(player, s.phase === 'playing' && s.player.hitFlash > .14);
    }
    this.appearance?.update?.({ time: s.time, coastBackgroundTime: this.coastBackgroundTime, clock: s.clock, camera: this.cameraPosition, phantomActive, runId: s.runId,
      victoryDeparture: s.victoryDeparturePresentation,
      aircraftPassiveShot: aircraftPassiveShot(s.projectiles,s.clock),
      lightingEffects: s.effects, projectPoint: this.projectPoint,
      playerHitFlash: s.phase === 'playing' && s.player.hp > 0 && s.player.hitFlash > .14,
      renderDelta: s.phase === 'playing' ? Math.max(delta / 1000, 0) : 0,
      displayInterval: s.phase === 'playing' ? this.game.loop.rawDelta / 1000 : 0,
      flight: { x: s.player.x, z: s.player.z, speed: s.playerMovementSpeed,
        radius: playerEntity.stats.shape[0] * s.playerScale, active: s.phase === 'playing' && s.player.hp > 0 },
      mapCameraOffset: layer => this.mapCameraOffsets.position(layer) });
    if ((s.phase === 'playing' || s.player.hp <= 0) && s.phase !== 'ready' && s.player.hitFlash > 0) {
      const graphics = this.playerDamage ??= this.add.graphics().setDepth(PLAYER_DAMAGE_VIGNETTE_DEPTH);
      graphics.clear().setVisible(true);
      drawPlayerDamageVignette(graphics, this.renderSamples.age(.3 - s.player.hitFlash), WIDTH, HEIGHT);
    } else if (this.playerDamage?.visible) this.playerDamage.clear().setVisible(false);
    const enemyIds = this.liveEnemyIds; enemyIds.clear();
    const endEnemyWork = this.beginMeasure?.('enemyVisual',s.enemies.length);
    const renderDelta = s.phase === 'playing' ? Math.min(Math.max(delta / 1000, 0), .1) : 0;
    const recoilTimes = this.shotPresentation.recoilTimes;
    for (const enemy of s.enemies) {
      enemyIds.add(enemy.uid);
      const key = `enemy:${enemy.uid}`; live.add(key);
      let view = this.objects.get(key) as Phaser.GameObjects.Container | undefined;
      if (!view) { view = this.model(enemy.modelId, enemy.radiusX * 2);
        if (!view.length) {
          const width = Math.max(14, enemy.radiusX * this.px * 2), height = Math.max(16, enemy.radiusZ * this.px * 2);
          view.add(this.add.triangle(0, 0, width / 2, height, 0, 0, width, 0, 0xa43f46).setStrokeStyle(2, 0xffac84));
        }
        view.setDepth(20); this.objects.set(key, view);
        const bounds=view.getBounds();captureEnemyDeathBody(enemy,bounds.width,bounds.height,this.px);
      }
      let motion = this.enemyViewPositions.get(enemy.uid);
      const revision = enemy.viewPositionRevision ?? 0;
      if (!motion) {
        const reset = enemy.viewResetPosition ?? { x: enemy.oldX, z: enemy.oldZ };
        motion = { view: new NativeViewPosition(reset), target: { ...reset }, revision };
        this.enemyViewPositions.set(enemy.uid, motion);
      } else if (motion.revision !== revision) {
        // Loop-born explicitly dispatches MoveToPosition(..., true). Preserve
        // that reset even when another logic step moved again before render.
        const reset = enemy.viewResetPosition ?? { x: enemy.x, z: enemy.z };
        motion.view.setPosition(reset); motion.target = { ...reset }; motion.revision = revision;
      }
      // Retarget only on a new logic position, never on every render frame.
      // A frame with multiple logic steps submits its final target, then the
      // display advances once from its current rendered position.
      if (motion.target.x !== enemy.x || motion.target.z !== enemy.z) {
        motion.target = { x: enemy.x, z: enemy.z };
        motion.view.setTargetPosition(motion.target);
      }
      const visual = motion.view.update(renderDelta);
      const pos = this.screen(visual.x, visual.z);
      // Original prefab already encodes sprite orientation; EntityView applies AngleY directly.
      view.setPosition(pos.x, pos.y).setScale(enemy.scale).setRotation(enemy.angle);
      const lastShot = recoilTimes.get(enemy.uid);
      const nativeAnimation = this.enemyAnimations.get(view)?.(view, enemy, visual, renderDelta, s.clock, lastShot)
        || this.animateEnemy(view, enemy);
      const urgency = sampleNativeUrgencyWarning(enemy);
      if (urgency) for (const node of urgencySource.nodes) {
        if (!node.active || !node.sprite || !this.textures.exists(node.sprite)) continue;
        const urgencyKey = `urgency:${enemy.uid}:${node.id}`; live.add(urgencyKey);
        let icon = this.objects.get(urgencyKey) as Phaser.GameObjects.Image | undefined;
        if (!icon) { icon = this.add.image(0, 0, node.sprite); this.objects.set(urgencyKey, icon); }
        // GameHover's canvas uses the same 1080-wide UI reference as the HUD.
        const uiScale = WIDTH / 1080;
        icon.setPosition(pos.x + node.position.x * uiScale, pos.y - node.position.y * uiScale)
          .setOrigin(node.pivot.x, 1 - node.pivot.y)
          .setDisplaySize(node.size.x * node.scale.x * uiScale, node.size.y * node.scale.y * uiScale)
          .setAlpha(urgency.alpha * (node.color?.a ?? 1)).setDepth(55);
      }
      if(!enemy.dead&&enemy.laserWarning){
        const warning=enemy.laserWarning,co=Math.cos(enemy.angle),si=Math.sin(enemy.angle);
        for(const [index,mount]of warning.mounts.entries()){
          const from={x:enemy.x+mount.x*co+mount.z*si,z:enemy.z-mount.x*si+mount.z*co};
          const end=warningEndPoint(from,warning.target,this.content.world.width,this.content.world.height,this.sim.cameraWorldBounds);
          this.pathogenic.warning(enemy.uid,index,warning.until-enemy.age,this.screen(from.x,from.z),this.screen(end.x,end.z));
        }
      }
      const sequence = nativeAnimation ? undefined : this.content.assets.prefabs[this.prefabByModel.get(enemy.modelId)!]?.sequence;
      if (sequence?.frames?.length) {
        const index = Math.floor(enemy.age * sequence.fps);
        const frame = sequence.frames[sequence.loop ? index % sequence.frames.length : Math.min(index, sequence.frames.length - 1)];
        const sprite = this.content.assets.sprites[frame];
        for (const child of view.list) if (child instanceof Phaser.GameObjects.Image && child.getData('sourceSprite') === sequence.rendererSprite) {
          child.setTexture(frame).setOrigin(sprite.pivot.x, 1 - sprite.pivot.y);
        }
      }
      const hitMotion=sampleEnemyHitMotion(enemy,visualClock,statusIndex.frozen.has(enemy.uid));
      view.setPosition(view.x+hitMotion.x,view.y+hitMotion.y).setScale(view.scaleX*hitMotion.scaleX,view.scaleY*hitMotion.scaleY).setRotation(view.rotation+hitMotion.rotation);
      applySourceStatusTint(view,enemy.hitFlash>0,statusIndex.frozen.has(enemy.uid),visualClock,{boss:enemy.boss});
      const health = this.content.assets.enemyHealthBars;
      const healthConfig = health.entities[enemy.entityId];
      if (!enemy.boss && healthConfig?.showHp && healthConfig.showHpType !== 0) {
        const healthKey = `enemy-health:${enemy.uid}`; live.add(healthKey);
        let bar = this.objects.get(healthKey) as EnemyHealthBar | undefined;
        if (!bar) { bar = new EnemyHealthBar(this, health, healthConfig, WIDTH / health.uiReferenceWidth); this.objects.set(healthKey, bar); }
        const anchor = health.models[enemy.modelId], center = anchor.center;
        const co = Math.cos(enemy.angle), si = Math.sin(enemy.angle);
        const point = this.screen(visual.x + (center[0] * co + center[2] * si) * enemy.scale, visual.z + (-center[0] * si + center[2] * co + anchor.healthDistance) * enemy.scale);
        bar.setPosition(point.x, point.y); bar.updateHealth(enemy, visualClock);
      }
    }
    for (const uid of this.enemyViewPositions.keys()) if (!enemyIds.has(uid)) this.enemyViewPositions.delete(uid);
    endEnemyWork?.();
    for (const chest of s.treasures) {
      const key = `treasure:${chest.uid}`; live.add(key);
      let view = this.objects.get(key) as Phaser.GameObjects.Container | undefined;
      if (!view) { view = createSupplyChestVisual(this); view.setDepth(22); this.objects.set(key, view); }
      const point = this.screen(chest.x, chest.z);
      view.setPosition(point.x, point.y);
      updateSupplyChestVisual(view, chest, chestAnimations.clips[chest.animation].duration);
      if (chest.progress > 0 && chest.animation !== 'Death') this.drawChestProgress(point.x, point.y + 32, chest.progress);
    }
    const missileMounts=this.appearance?.missileMounts?.().map(point=>({
      x:s.player.x+(point.x-pp.x)/this.px,z:s.player.z-(point.y-pp.y)/this.px,
    }));
    const endProjectileWork = this.beginMeasure?.('projectileVisual',s.projectiles.length);
    this.missileWingMounts.beginFrame(s.clock,s.runId,s.projectiles,missileMounts);
    for(const bullet of s.projectiles){
      // Native primary-gun shots use familyId 0. Resolve only their view identity.
      const sourceBullet=thunderBeam(bullet)??bullet;
      const visualBullet=this.missileWingMounts.projectile(this.renderSamples.projectile(sourceBullet,this.content.chapter.player.weaponEntityId));
      // All kinetic shots share the authored presentation route.
      this.pathogenic.equipmentAccent(visualBullet,s.equipmentProjectileAccent(bullet),this.projectPoint);
      this.pathogenic.projectile(visualBullet,this.projectPoint,Number(this.content.chapter.bullets[bullet.bulletId]?.parameters.Element??0));
    }
    endProjectileWork?.();
    for (const sourcePickup of s.pickups) {
      const pickup=this.renderSamples.pickup(sourcePickup);
      const expiryAlpha=pickupExpiryAlpha(pickup,this.content.assets.battleItems[pickup.itemId]);
      this.pathogenic.pickup(pickup,this.projectPoint,expiryAlpha);
      const key = `pickup:${pickup.uid}`; live.add(key);
      let view = this.objects.get(key) as Phaser.GameObjects.Container | undefined;
      if (!view) { view = createPickupVisual(this, pickup) ?? this.model(pickup.modelId); view.setDepth(19); this.objects.set(key, view); }
      const pos = this.screen(pickup.x, pickup.z); view.setPosition(pos.x, pos.y).setVisible(pickup.age >= pickup.delay).setAlpha(expiryAlpha);
      if (updatePickupVisual(view, pickup)) continue;
      const sequence = this.content.assets.prefabs[this.prefabByModel.get(pickup.modelId)!]?.sequence;
      if (sequence?.frames?.length) {
        const frame = sequence.frames[Math.floor(Math.max(0, pickup.age - pickup.delay) * sequence.fps) % sequence.frames.length];
        const sprite = this.content.assets.sprites[frame];
        for (const child of view.list) if (child instanceof Phaser.GameObjects.Image && child.getData('sourceSprite') === sequence.rendererSprite) child.setTexture(frame).setOrigin(sprite.pivot.x, 1 - sprite.pivot.y);
      }
    }
    const buffVisuals=statusIndex.visuals,visualTargets=statusIndex.targets;
    for(const sourceBuff of buffVisuals){
      const position=this.enemyViewPositions.get(sourceBuff.targetUid)?.view.position;
      const buff: RecordData={...sourceBuff,x:position?.x??sourceBuff.x,z:position?.z??sourceBuff.z,
        age:Number.isFinite(sourceBuff.age)?this.renderSamples.age(sourceBuff.age):sourceBuff.age,
        ...(Number.isFinite(sourceBuff.remaining)?{remaining:sourceBuff.remaining+Math.max(0,s.clock-visualClock)}:{})};
      if([170002,170001,170004,170012,220022,170000].includes(buff.modelId)){
        // Read target extents only to attach the corrosion art to its silhouette.
        const target=buff.targetUid===0?undefined:visualTargets.get(buff.targetUid);
        const shape=playerEntity.stats.shape;
        this.pathogenic.status({...buff,visualRadiusX:target?.radiusX??shape[0]*s.playerScale,
          visualRadiusZ:target?.radiusZ??(shape[1]??shape[0])*s.playerScale},this.projectPoint);
      }else this.pathogenic.status(buff,this.projectPoint);
    }
    for(const fx of s.effects)this.drawEffect(fx,live);
    for(const receipt of sampleCombatResults(s))this.drawEffect(receipt,live);
    for(const receipt of sampleSpecialWeaponFeedback(s))this.drawEffect(receipt,live);
    const healReceiptVisual=sampleHealingReceipt(s);if(healReceiptVisual)this.drawEffect(healReceiptVisual,live);
    const coinReceiptVisual=sampleCoinPickupReceipt(s);if(coinReceiptVisual)this.drawEffect(coinReceiptVisual,live);
    this.pathogenic.endFrame();
    for (const [key, view] of this.objects) if (!live.has(key)) {
      if (s.phase !== 'ready' && view instanceof EnemyHealthBar && view.finishAfterDeath(visualClock)) continue;
      view.destroy(); this.objects.delete(key);
    }
  }
  private tint(container: Phaser.GameObjects.Container, flash: boolean) {
    for (const child of container.list) if (child instanceof Phaser.GameObjects.Image) { if (flash) child.setTintFill(0xffffff); else child.clearTint(); }
  }
  private animateEnemy(view: Phaser.GameObjects.Container, enemy: Enemy) {
    // Apply native enemy animation to every monster model.
    const poses = sampleNativeEnemyAnimation(this.content.assets.enemyLocalAnimation, enemy.entityId, {
      age: enemy.age, mainState: enemy.dead ? 'Death' : enemy.animationClip,
      mainTime: enemy.dead ? enemy.deathAge || 0 : enemy.animationTime ?? enemy.age,
    });
    if (!poses) { if (enemy.boss) this.animateBoss(view, enemy); return false; }
    const byPath = new Map(poses.map(pose => [pose.path, pose]));
    for (const child of view.list) {
      if (!(child instanceof Phaser.GameObjects.Image)) continue;
      const pose = byPath.get(child.getData('sourcePath'));
      if (!pose) continue;
      if (pose.spritePathId === '0') { child.setAlpha(0); continue; }
      const texture = pose.spritePathId ? this.spriteByPathId.get(pose.spritePathId) : undefined;
      if (texture && this.textures.exists(texture)) {
        const sprite = this.content.assets.sprites[texture], pivot = sprite.renderPivot || sprite.pivot || { x: .5, y: .5 };
        child.setTexture(texture).setData('sourceSprite', texture).setOrigin(pivot.x, 1 - pivot.y);
      }
      const sprite = this.content.assets.sprites[child.getData('sourceSprite')];
      if (!sprite) continue;
      const m = pose.matrix, a = m[0], b = -m[8], c = -m[1], d = m[9];
      const sx = Math.hypot(a, b), sy = sx ? (a * d - b * c) / sx : 0;
      child.setPosition(m[3] * this.px, -m[11] * this.px).setScale(this.px / sprite.ppu * sx, this.px / sprite.ppu * sy)
        .setRotation(Math.atan2(b, a)).setAlpha(pose.alpha);
    }
    return true;
  }
  private animateBoss(view: Phaser.GameObjects.Container, enemy: Enemy) {
    const all = this.content.assets.bossAnimations;
    const prefab = all?.entities?.[enemy.entityId];
    const data = prefab ? all.models?.[prefab] : enemy.entityId === 340002 ? this.content.assets.bossAnimation : undefined;
    const name = enemy.dead ? 'Death' : enemy.animationClip || 'Idle';
    const age = enemy.dead ? enemy.deathAge ?? (4 * nativeLogicDelta - (enemy.deathRemaining || 0)) : enemy.animationTime ?? enemy.age;
    const loop = name === 'Idle' || name.startsWith('SkillFireHold') || name.startsWith('SkillHold');
    this.animatePrefab(view, data, name, age, loop);
  }
  private animatePrefab(view: Phaser.GameObjects.Container, data: RecordData | undefined, name: string, age: number, loop: boolean) {
    const clip = data?.clips?.[name] ?? (name === 'Idle' ? data?.clips?.idle : undefined);
    if (!data || !clip?.frames?.length) return;
    // Callback timings use Clip.time / AnimatorState.m_Speed. Sample the
    // original clip in the matching time domain so pose and firing stay aligned.
    const clipAge = age * Number(clip.stateSpeed ?? 1);
    const time = loop && clip.duration > 0 ? clipAge % clip.duration : Math.min(clipAge, clip.duration);
    const frame = clip.frames[Math.min(clip.frames.length - 1, Math.max(0, Math.floor(time * clip.fps)))];
    for (const child of view.list) {
      if (!(child instanceof Phaser.GameObjects.Image)) continue;
      const index = data.renderers.findIndex((r: RecordData) => r.path === child.getData('sourcePath'));
      if (index < 0) continue;
      const m = frame[index], sprite = this.content.assets.sprites[child.getData('sourceSprite')];
      if (!m || !sprite) continue;
      const a = m[0], b = -m[8], c = -m[1], d = m[9], sx = Math.hypot(a, b), sy = sx ? (a * d - b * c) / sx : 0;
      child.setPosition(m[3] * this.px, -m[11] * this.px).setScale(this.px / sprite.ppu * sx, this.px / sprite.ppu * sy).setRotation(Math.atan2(b, a)).setAlpha(m[12]);
    }
  }
  private drawChestProgress(x: number, y: number, ratio: number) {
    const width = 50, graphics = this.chestProgress;
    graphics.setVisible(true);
    graphics.fillStyle(0x091014, .9).fillRect(x - width / 2 - 2, y - 2, width + 4, 9);
    graphics.fillStyle(0xffdc45).fillRect(x - width / 2, y, width * Math.max(0, ratio), 5);
  }
  private drawEffect(fx: Effect,live:Set<string>){
    if(fx.age<0)return;
    if(fx.followPlayer){fx.x=this.sim.player.x+(fx.followOffset?.x||0);fx.z=this.sim.player.z+(fx.followOffset?.z||0);}
    if(fx.ownerUid){const owner=this.sim.enemies.find(e=>e.uid===fx.ownerUid&&!e.dead);if(!owner)return;const pos=this.enemyViewPositions.get(owner.uid)?.view.position??owner;fx.x=pos.x;fx.z=pos.z;}
    if(fx.kind!=='text'){this.pathogenic.effect(fx,this.projectPoint,enemyDeathVisualScale(fx));return;}
    const key=`fx:${fx.uid}`;live.add(key);let view=this.objects.get(key) as DamageTextView|undefined;
    const layout=damageTextPresentation(fx,this.renderSamples.age(fx.age));
    view=updateDamageTextView(this,view,fx.value||'',layout);this.objects.set(key,view);
    const pos=this.screen(fx.x,fx.z),margin=view.width*layout.scale/2+4;
    view.setPosition(Math.max(margin,Math.min(WIDTH-margin,pos.x+layout.x)),Math.max(30,Math.min(HEIGHT-12,pos.y+layout.y))).setAlpha(layout.alpha).setScale(layout.scale);
  }
  private sourceRaycast(q:{origin:{x:number;y:number};direction:{x:number;y:number};maxDistance:number}){
    const zero=this.screen(0,0),from={x:(q.origin.x-zero.x)/this.px,z:-(q.origin.y-zero.y)/this.px};
    let distance=q.maxDistance;let hit=false;let normal={x:-q.direction.x,y:-q.direction.y};
    for(const edge of [0,WIDTH])if(Math.abs(q.direction.x)>1e-9){const d=(edge-q.origin.x)/q.direction.x,y=q.origin.y+q.direction.y*d;if(d>=0&&d<distance&&y>=0&&y<=HEIGHT){distance=d;hit=true;normal={x:edge===0?1:-1,y:0};}}
    for(const edge of [0,HEIGHT])if(Math.abs(q.direction.y)>1e-9){const d=(edge-q.origin.y)/q.direction.y,x=q.origin.x+q.direction.x*d;if(d>=0&&d<distance&&x>=0&&x<=WIDTH){distance=d;hit=true;normal={x:0,y:edge===0?1:-1};}}
    const end={x:from.x+q.direction.x*distance/this.px,z:from.z-q.direction.y*distance/this.px};
    const ray={...end,oldX:from.x,oldZ:from.z,radiusX:0,radiusZ:0,box:false,angle:0};
    let nearest=1;
    for(const enemy of this.sim.enemies){if(enemy.dead)continue;const t=sweep(ray,{...enemy,oldX:enemy.x,oldZ:enemy.z});if(t!==null&&t<nearest){nearest=t;hit=true;const center=this.screen(enemy.x,enemy.z),x=q.origin.x+q.direction.x*distance*t-center.x,y=q.origin.y+q.direction.y*distance*t-center.y,length=Math.hypot(x,y);normal=length?{x:x/length,y:y/length}:{x:-q.direction.x,y:-q.direction.y};}}
    return{endpoint:{x:q.origin.x+q.direction.x*distance*nearest,y:q.origin.y+q.direction.y*distance*nearest},hit,normal};
  }
}

export function makeGame(scene: BattleView, canvas: HTMLCanvasElement, preBoot?: Phaser.Types.Core.BootCallback,
  nativeViewport?: {width:number;height:number;pixelRatio:number}) {
  if (!canvas) throw new Error('战斗画布必须由微信宿主提供');
  const {width, height} = nativeBattleBufferSize(nativeViewport, WIDTH, HEIGHT);
  return new Phaser.Game({
    type: Phaser.WEBGL,
    canvas,
    customEnvironment: true,
    input: { keyboard: false },
    width,
    height,
    // Clear once on the renderer. A camera background draws a second
    // full-sized rectangle under the terrain every frame.
    backgroundColor: '#315257',
    scene,
    ...(preBoot ? { callbacks: { preBoot } } : {}),
    plugins: { scene: [{ key: 'SpinePlugin', plugin: spinePlugin, mapping: 'spine' }] },
    // The native host composites this offscreen canvas between engine frames.
    // Its last complete image must survive presentation until the next draw.
    render: { antialias: width === WIDTH, roundPixels: false, powerPreference: 'high-performance', preserveDrawingBuffer: true },
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    audio: { noAudio: true },
    banner: false,
  });
}
