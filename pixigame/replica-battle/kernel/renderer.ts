import {COMBAT_LAYERS,damageTextPose,playerVisibility} from './combat-readability.mjs';
import {isOrdinaryDeathVisual} from '../small-death-visual.js';
import {sampleNativeUrgencyWarning} from './enemy-warning';
import {applySourceStatusTint} from './pathogenic/source-status-tint';
import {PathogenicBattleEffects} from './pathogenic/pathogenic-battle-effects';
import pathogenicGraph from './pathogenic/scene-graph.json';
import {restoredSequenceOwnsSprite} from '../weapon-visual-quality.js';
import {thunderBeam} from './thunder-presentation';
import {sweep} from './model';
import {warningEndPoint} from './warning-line';
import Phaser from 'phaser';
import { preloadPickupArt, createPickupVisual, updatePickupVisual } from './pickup-visual';
import { preloadSupplyChestArt, createSupplyChestVisual, updateSupplyChestVisual } from './supply-chest-visual';

import { createShockwavePickup, shockwavePickupModelId, createFrenzyPickup, frenzyPickupModelId } from './airdrop-visual';
import type { BattleAppearance } from '../appearance-types';
// Monster appearance uses the captured native prefab/sprite/animation records.
import type { GameContent, Enemy, Projectile, RecordData, Effect, Point } from './model';
import type { Simulation } from './simulation';
import { SpinePlayer, preloadPlayerSpine, spinePlugin } from './spine-player';
import { allPlayerAppearanceLayers, selectPlayerAppearance } from './player-appearance';
import { OriginalParticlePipeline, OriginalParticleMesh } from './particle-pipeline';
import { EnemyHealthBar } from './enemy-health-bar';
import urgencySource from '../public/data/enemy-warning.json';
import { nativeLogicDelta } from './native-time';
import chestAnimations from '../public/data/chest-animation.json';
import { nativeMapScrollZ, nativeMapSegmentPoses, NativeMapCameraOffsets, type NativeMapLayer, type NativeMapSpriteRenderer } from './native-map-layers';
import { sampleNativeEnemyAnimation } from './native-enemy-animation';
import { NativeViewPosition } from './native-view-position';
import { preloadChapterOrbitArt, createChapterOrbitArt } from '../chapter-orbit-art';
import { preloadScatterGunboat, createScatterGunboat, updateScatterGunboat, scatterGunboatShots } from '../scatter-gunboat-art';
import { preloadPatrolDrone, createPatrolDrone, updatePatrolDrone, patrolDroneShots } from '../patrol-drone-art';
import { preloadHeavyScatter, createHeavyScatter, updateHeavyScatter, heavyScatterShots } from '../heavy-scatter-art';
import { preloadEliteScatter, createEliteScatter, updateEliteScatter, eliteScatterShots } from '../elite-scatter-art';
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
type Display = Phaser.GameObjects.Container | Phaser.GameObjects.Image | Phaser.GameObjects.Text | Phaser.GameObjects.Graphics | OriginalParticleMesh;

export class BattleView extends Phaser.Scene {
  private objects = new Map<string, Display>();
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
  private bars!: Phaser.GameObjects.Graphics;
  private beams!: Phaser.GameObjects.Graphics;
  private debug!: Phaser.GameObjects.Graphics;
  private debugOn = false;
  private prefabByModel = new Map<number, string>();
  private spriteByPathId = new Map<string, string>();
  private px: number;
  private playerSpine?: SpinePlayer;
  private playerAppearanceKey = '';
  onFrame?: (delta: number) => void;
  constructor(private content: GameContent, private sim: Simulation, private ready: () => void, private appearance?: BattleAppearance) {
    super('battle'); this.px = WIDTH / content.world.width;
    for (const [key, prefab] of Object.entries(content.assets.prefabs) as [string, RecordData][]) for (const id of prefab.modelIds || []) this.prefabByModel.set(id, key);
    for (const [key, sprite] of Object.entries(content.assets.sprites) as [string, RecordData][]) if (sprite.pathId) this.spriteByPathId.set(String(sprite.pathId), key);
  }
  preload() {
    preloadPickupArt(this);
    preloadSupplyChestArt(this);
    this.pathogenic=new PathogenicBattleEffects(this,pathogenicGraph);
    this.pathogenic.configureHost({playerBulletCount:()=>this.sim.projectiles.filter(b=>b.owner==='player'&&!b.dead).length,raycastBeam:q=>this.sourceRaycast(q),nativeSwordEffects:this.content.assets.originalEffects});
    this.pathogenic.preload((_p,t)=>t.url);
        preloadChapterOrbitArt(this, this.prefabByModel.keys());
    preloadScatterGunboat(this, this.prefabByModel.keys());
    preloadPatrolDrone(this, this.prefabByModel.keys());
    preloadHeavyScatter(this, this.prefabByModel.keys());
    preloadEliteScatter(this, this.prefabByModel.keys());
    preloadSiegeBoss(this, this.prefabByModel.keys());
    preloadChapter41Enemies(this, this.prefabByModel.keys());
    preloadChapter38Enemies(this, this.prefabByModel.keys());
    preloadChapter33Enemies(this, this.prefabByModel.keys());
    preloadChapter31Enemies(this, this.prefabByModel.keys());
    preloadChapter29Enemies(this, this.prefabByModel.keys());
    preloadChapter27Enemies(this, this.prefabByModel.keys());
    preloadChapter26Enemies(this, this.prefabByModel.keys());
    preloadChapter25Enemies(this, this.prefabByModel.keys());
    preloadChapter24Enemies(this, this.prefabByModel.keys());
    preloadChapter22Enemies(this, this.prefabByModel.keys());
    preloadChapter21Enemies(this, this.prefabByModel.keys());
    preloadChapter20Enemies(this, this.prefabByModel.keys());
    preloadChapter19Enemies(this, this.prefabByModel.keys());
    preloadChapter18Enemies(this, this.prefabByModel.keys());
    preloadChapter17Enemies(this, this.prefabByModel.keys());
    preloadChapter16Enemies(this, this.prefabByModel.keys());
    preloadChapter15Enemies(this, this.prefabByModel.keys());
    preloadChapter14Enemies(this, this.prefabByModel.keys());
    preloadChapter13Enemies(this, this.prefabByModel.keys());
    preloadChapter12Enemies(this, this.prefabByModel.keys());
    preloadChapter11Enemies(this, this.prefabByModel.keys());
    preloadChapter10Enemies(this, this.prefabByModel.keys());
    preloadChapter9Enemies(this, this.prefabByModel.keys());
    preloadChapter8Enemies(this, this.prefabByModel.keys());
    preloadChapter6Enemies(this, this.prefabByModel.keys());
    preloadChapter5Enemies(this, this.prefabByModel.keys());
    preloadChapter4Enemies(this, this.prefabByModel.keys());
    preloadChapter3Enemies(this, this.prefabByModel.keys());
    preloadChapter2Enemies(this, this.prefabByModel.keys());
    this.appearance?.preload(this);
    // Native enemy layers join the normal prefab preload below.
    preloadPlayerSpine(this, allPlayerAppearanceLayers(this.content));
    const a = this.content.assets, wanted = new Set<string>();
    for (const [key, texture] of Object.entries(a.enemyHealthBars.sprites) as [string, RecordData][]) this.load.image(key, texture.url);
    const add = (key: string) => { if (key && a.sprites[key]) wanted.add(key); };
    for (const reference of a.enemyLocalAnimation?.spriteReferences || []) add(this.spriteByPathId.get(String(reference.pathId)) || '');
    for (const [name, prefab] of Object.entries(a.prefabs) as [string, RecordData][]) {
      // Include native enemy sprites even for models previously given project skins.
      if (this.appearance?.replaceTerrain && name === a.map.prefab) continue;
      if (prefab.spine) { preloadPlayerSpine(this, prefab.spine); continue; }
      for (const key of prefab.sequence?.frames || []) add(key);
      if (prefab.composite) { add(prefab.composite); continue; }
      if (prefab === a.prefabs[a.map.prefab] && a.map.segments?.length) continue;
      const animated = new Set(a.enemyLocalAnimation?.animatedRendererPaths?.[name] || []);
      for (const r of prefab.renderers || []) if ((r.active && r.enabled) || animated.has(r.hierarchy?.join('/'))) add(r.sprite);
    }
    const nativeMap = !this.appearance?.replaceTerrain && a.map.nativeLayers?.renderers?.length && this.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer;
    if (nativeMap) for (const row of a.map.nativeLayers.renderers) if (row.active && row.enabled) add(row.sprite);
    for (const [index, segment] of (this.appearance?.replaceTerrain || nativeMap ? [] : a.map.segments || []).entries()) {
      if (segment.key && a.sprites[segment.key]) add(segment.key);
      else if (segment.url) this.load.image(segment.key || `map:${segment.index ?? index}`, segment.url);
    }
    for (const key of ['Airplane_0_setup', 'Pause', 'stg_expProcess', 'Level_progress_bar_bottom', 'exp', 'exp5', 'exp5_blue']) add(key);
    for (const node of urgencySource.nodes) if (node.sprite) add(node.sprite);
    for (const family of Object.values(this.content.combat.families) as RecordData[]) add(family.icon);
    for (const card of Object.values(this.content.combat.cards) as RecordData[]) add(card.icon);
    for (const key of wanted) this.load.image(key, a.sprites[key].url);
    // arrow_Monster_rotundity_1: four captured atlas frames at 16 fps.
    const roundShot=a.sprites['arrow_Monster_rotundity_1_0000'];
    if(roundShot)for(let frame=1;frame<4;frame++){
      const key=`arrow_Monster_rotundity_1_000${frame}`;
      this.load.image(key,roundShot.url.replace('arrow_Monster_rotundity_1_0000.png',`${key}.png`));
    }
    this.load.on('progress', (value: number) => { const bar = document.querySelector('#loading progress') as HTMLProgressElement; if (bar) bar.value = value; });
    this.load.on('loaderror', (file: { key: string }) => { console.error('原始资源加载失败', file.key); });
  }
  create() {
    if (this.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer && !this.renderer.pipelines.has('OriginalParticle')) {
      this.renderer.pipelines.add('OriginalParticle', new OriginalParticlePipeline(this.game));
    }
    if (this.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer && !this.renderer.pipelines.has('OriginalBeam')) {
    }
    if (this.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer && !this.renderer.pipelines.has('OriginalWarning')) {
    }
    if (this.renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer) {
      const gl = this.renderer.gl;
      // The original subtract fog uses dst-src RGB. Preserve destination alpha.
      this.mapSubtractBlend = this.renderer.addBlendMode([gl.ONE, gl.ONE, gl.ZERO, gl.ONE], gl.FUNC_REVERSE_SUBTRACT);
    }
    this.cameras.main.setBackgroundColor('#315257');
    this.appearance?.create(this);
    if (!this.appearance?.replaceTerrain) this.createTerrain();
    this.beams = this.add.graphics().setDepth(30);
    this.bars = this.add.graphics().setDepth(50);
    this.debug = this.add.graphics().setDepth(90);
    const playerModel = this.content.assets.prefabs[this.prefabByModel.get(this.content.chapter.entities[this.content.chapter.player.entityId].modelId)!];
    const appearance = selectPlayerAppearance(this.content);
    if (appearance.layers.length || playerModel?.spine) this.playerSpine = new SpinePlayer(this, appearance.layers.length ? appearance.layers : playerModel.spine, this.appearance?.playerSkin);
    this.playerAppearanceKey = appearance.key;
    this.input.keyboard?.on('keydown-F2', () => { this.debugOn = !this.debugOn; });
    document.querySelector('#loading')?.remove(); this.ready();
  }
  get cameraPosition(): Readonly<Point> { return this.cameraView.position; }
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
    const ownedGunboat = createScatterGunboat(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets.sprites);
    if (ownedGunboat) return ownedGunboat;
    const patrolDrone = createPatrolDrone(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets.sprites);
    if (patrolDrone) return patrolDrone;
    const heavyScatter = createHeavyScatter(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets.sprites);
    if (heavyScatter) return heavyScatter;
    const eliteScatter = createEliteScatter(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets.sprites);
    if (eliteScatter) return eliteScatter;
    const siegeBoss = createSiegeBoss(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (siegeBoss) return siegeBoss;
    const chapter2Enemy = createChapter2Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter2Enemy) return chapter2Enemy;
    const chapter3Enemy = createChapter3Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter3Enemy) return chapter3Enemy;
    const chapter4Enemy = createChapter4Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter4Enemy) return chapter4Enemy;
    const chapter5Enemy = createChapter5Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter5Enemy) return chapter5Enemy;
    const chapter6Enemy = createChapter6Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter6Enemy) return chapter6Enemy;
    const chapter8Enemy = createChapter8Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter8Enemy) return chapter8Enemy;
    const chapter9Enemy = createChapter9Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter9Enemy) return chapter9Enemy;
    const chapter10Enemy = createChapter10Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter10Enemy) return chapter10Enemy;
    const chapter11Enemy = createChapter11Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter11Enemy) return chapter11Enemy;
    const chapter12Enemy = createChapter12Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter12Enemy) return chapter12Enemy;
    const chapter13Enemy = createChapter13Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter13Enemy) return chapter13Enemy;
    const chapter14Enemy = createChapter14Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter14Enemy) return chapter14Enemy;
    const chapter15Enemy = createChapter15Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter15Enemy) return chapter15Enemy;
    const chapter16Enemy = createChapter16Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter16Enemy) return chapter16Enemy;
    const chapter17Enemy = createChapter17Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter17Enemy) return chapter17Enemy;
    const chapter18Enemy = createChapter18Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter18Enemy) return chapter18Enemy;
    const chapter19Enemy = createChapter19Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter19Enemy) return chapter19Enemy;
    const chapter20Enemy = createChapter20Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter20Enemy) return chapter20Enemy;
    const chapter21Enemy = createChapter21Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter21Enemy) return chapter21Enemy;
    const chapter22Enemy = createChapter22Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter22Enemy) return chapter22Enemy;
    const chapter24Enemy = createChapter24Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter24Enemy) return chapter24Enemy;
    const chapter25Enemy = createChapter25Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter25Enemy) return chapter25Enemy;
    const chapter26Enemy = createChapter26Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter26Enemy) return chapter26Enemy;
    const chapter27Enemy = createChapter27Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter27Enemy) return chapter27Enemy;
    const chapter29Enemy = createChapter29Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter29Enemy) return chapter29Enemy;
    const chapter31Enemy = createChapter31Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter31Enemy) return chapter31Enemy;
    const chapter33Enemy = createChapter33Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter33Enemy) return chapter33Enemy;
    const chapter38Enemy = createChapter38Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter38Enemy) return chapter38Enemy;
    const chapter41Enemy = createChapter41Enemy(this, modelId, this.px,
      this.content.assets.prefabs[this.prefabByModel.get(modelId) || ''], this.content.assets);
    if (chapter41Enemy) return chapter41Enemy;
    // Other enemy models continue through the native prefab renderer.
    if (modelId === shockwavePickupModelId) return createShockwavePickup(this, this.px);
    if (modelId === frenzyPickupModelId) return createFrenzyPickup(this, this.px);
    const container = this.add.container(0, 0);
    const name = this.prefabByModel.get(modelId), prefab = name && this.content.assets.prefabs[name];
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
    // CameraView.Root is the original camera root: its ordinary EntityView
    // interpolation IS the display movement. No second follow/Lerp is applied.
    this.advanceCameraView(delta);
    const s = this.sim, live = new Set<string>();
    const sourceCamera=this.screen(0,0);this.pathogenic.setCameraOffset(sourceCamera.x,sourceCamera.y);
    this.pathogenic.beginFrame(s.clock,s.runId,{playerBulletCount:s.projectiles.filter(b=>b.owner==='player'&&!b.dead).length});
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
    this.bars.clear(); this.beams.clear(); this.debug.clear();
    const pp = this.screen(s.player.x, s.player.z);
    const appearance = selectPlayerAppearance(this.content);
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
      this.tint(player, s.player.hitFlash > 0);
    }
    this.appearance?.update?.({ time: s.time, clock: s.clock, camera: this.cameraPosition, phantomActive, runId: s.runId,
      flight: { x: s.player.x, z: s.player.z, speed: s.playerMovementSpeed, active: s.phase === 'playing' && s.player.hp > 0 },
      mapCameraOffset: layer => this.mapCameraOffsets.position(layer) });
    if (s.phase !== 'ready' && s.player.hp > 0) this.healthBar(pp.x, pp.y + 40, 65, s.player.hp / s.player.maxHp, 0x3ee4a1);
    const enemyIds = new Set<number>();
    const renderDelta = s.phase === 'playing' ? Math.min(Math.max(delta / 1000, 0), .1) : 0;
    const gunboatShots = scatterGunboatShots(s.enemies, s.projectiles, s.clock);
    const patrolShots = patrolDroneShots(s.enemies, s.projectiles, s.clock);
    const heavyShots = heavyScatterShots(s.enemies, s.projectiles, s.clock);
    const eliteShots = eliteScatterShots(s.enemies, s.projectiles, s.clock);
    for (const enemy of s.enemies) {
      enemyIds.add(enemy.uid);
      const key = `enemy:${enemy.uid}`; live.add(key);
      let view = this.objects.get(key) as Phaser.GameObjects.Container | undefined;
      if (!view) { view = this.model(enemy.modelId, enemy.radiusX * 2); view.setDepth(20); this.objects.set(key, view); }
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
      const nativeAnimation = updateScatterGunboat(view, enemy, visual, renderDelta, s.clock, gunboatShots.get(enemy.uid))
        || updatePatrolDrone(view, enemy, visual, renderDelta, s.clock, patrolShots.get(enemy.uid))
        || updateHeavyScatter(view, enemy, visual, renderDelta, s.clock, heavyShots.get(enemy.uid))
        || updateEliteScatter(view, enemy, visual, renderDelta, s.clock, eliteShots.get(enemy.uid))
        || updateSiegeBoss(view, enemy, visual, renderDelta)
        || updateChapter2Enemy(view, enemy, visual, renderDelta)
        || updateChapter3Enemy(view, enemy, visual, renderDelta)
        || updateChapter4Enemy(view, enemy, visual, renderDelta)
        || updateChapter5Enemy(view, enemy, visual, renderDelta)
        || updateChapter6Enemy(view, enemy, visual, renderDelta)
        || updateChapter8Enemy(view, enemy, visual, renderDelta)
        || updateChapter9Enemy(view, enemy, visual, renderDelta)
        || updateChapter10Enemy(view, enemy, visual, renderDelta)
        || updateChapter11Enemy(view, enemy, visual, renderDelta)
        || updateChapter12Enemy(view, enemy, visual, renderDelta)
        || updateChapter13Enemy(view, enemy, visual, renderDelta)
        || updateChapter14Enemy(view, enemy, visual, renderDelta)
        || updateChapter15Enemy(view, enemy, visual, renderDelta)
        || updateChapter16Enemy(view, enemy, visual, renderDelta)
        || updateChapter17Enemy(view, enemy, visual, renderDelta)
        || updateChapter18Enemy(view, enemy, visual, renderDelta)
        || updateChapter19Enemy(view, enemy, visual, renderDelta)
        || updateChapter20Enemy(view, enemy, visual, renderDelta)
        || updateChapter21Enemy(view, enemy, visual, renderDelta)
        || updateChapter22Enemy(view, enemy, visual, renderDelta)
        || updateChapter24Enemy(view, enemy, visual, renderDelta)
        || updateChapter25Enemy(view, enemy, visual, renderDelta)
        || updateChapter26Enemy(view, enemy, visual, renderDelta)
        || updateChapter27Enemy(view, enemy, visual, renderDelta)
        || updateChapter29Enemy(view, enemy, visual, renderDelta)
        || updateChapter31Enemy(view, enemy, visual, renderDelta)
        || updateChapter33Enemy(view, enemy, visual, renderDelta)
        || updateChapter38Enemy(view, enemy, visual, renderDelta)
        || updateChapter41Enemy(view, enemy, visual, renderDelta)
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
      const sequence = this.content.assets.prefabs[this.prefabByModel.get(enemy.modelId)!]?.sequence;
      if (!nativeAnimation && sequence?.frames?.length) {
        const index = Math.floor(enemy.age * sequence.fps);
        const frame = sequence.frames[sequence.loop ? index % sequence.frames.length : Math.min(index, sequence.frames.length - 1)];
        const sprite = this.content.assets.sprites[frame];
        for (const child of view.list) if (child instanceof Phaser.GameObjects.Image && child.getData('sourceSprite') === sequence.rendererSprite) {
          child.setTexture(frame).setOrigin(sprite.pivot.x, 1 - sprite.pivot.y);
        }
      }
      applySourceStatusTint(view,enemy.hitFlash>0,s.activeBuffVisuals.some(buff=>buff.targetUid===enemy.uid&&(buff.modelId===170001||buff.modelId===170012)),s.clock,{boss:enemy.boss});
      const health = this.content.assets.enemyHealthBars;
      const healthConfig = health.entities[enemy.entityId];
      if (!enemy.boss && healthConfig?.showHp && healthConfig.showHpType !== 0) {
        const healthKey = `enemy-health:${enemy.uid}`; live.add(healthKey);
        let bar = this.objects.get(healthKey) as EnemyHealthBar | undefined;
        if (!bar) { bar = new EnemyHealthBar(this, health, healthConfig, WIDTH / health.uiReferenceWidth); this.objects.set(healthKey, bar); }
        const anchor = health.models[enemy.modelId], center = anchor.center;
        const co = Math.cos(enemy.angle), si = Math.sin(enemy.angle);
        const point = this.screen(visual.x + (center[0] * co + center[2] * si) * enemy.scale, visual.z + (-center[0] * si + center[2] * co + anchor.healthDistance) * enemy.scale);
        bar.setPosition(point.x, point.y); bar.updateHealth(enemy, s.clock);
      }
      if (this.debugOn) this.outline(enemy, 0x77eeff);
    }
    for (const uid of this.enemyViewPositions.keys()) if (!enemyIds.has(uid)) this.enemyViewPositions.delete(uid);
    for (const chest of s.treasures) {
      const key = `treasure:${chest.uid}`; live.add(key);
      let view = this.objects.get(key) as Phaser.GameObjects.Container | undefined;
      if (!view) { view = createSupplyChestVisual(this); view.setDepth(22); this.objects.set(key, view); }
      const point = this.screen(chest.x, chest.z);
      view.setPosition(point.x, point.y);
      updateSupplyChestVisual(view, chest, chestAnimations.clips[chest.animation].duration);
      if (chest.progress > 0 && chest.animation !== 'Death') this.healthBar(point.x, point.y + 32, 50, chest.progress, 0xffdc45);
    }
    for(const bullet of s.projectiles){
      // Native primary-gun shots use familyId 0. Resolve only their view identity.
      const sourceBullet=thunderBeam(bullet)??bullet;
      const visualBullet=sourceBullet.owner==='player'&&!sourceBullet.familyId?{...sourceBullet,familyId:this.content.chapter.player.weaponEntityId}:sourceBullet;
      // The basic and wing shots use the short flat body. Piercing has its
      // own longer sprite, while the heavy branch retains its round body.
      const cannonModel=visualBullet.modelId===1000050?1000050
        :visualBullet.familyId===200151&&visualBullet.modelId===1000049?1000049
        :((visualBullet.familyId===200151&&visualBullet.modelId===1000000)
          ||(visualBullet.weaponId===400002&&visualBullet.modelId===1000063))?1000000:undefined;
      const cannonSprite=cannonModel===1000050?'arrow_Monster_rotundity_1_0000'
        :cannonModel===1000049?'arrow_Monster_slender_1_0000'
        :cannonModel===1000000?'arrow_Monster_green_1_0000':undefined;
      if(visualBullet.owner==='player'&&!visualBullet.beam&&cannonModel!==undefined&&cannonSprite&&this.textures.exists(cannonSprite)) {
        if(!visualBullet.dead&&!visualBullet.visualHidden&&visualBullet.age >= (visualBullet.warmup ?? 0)) {
          const key=`native-heavy-shot:${visualBullet.uid}`;live.add(key);
          let view=this.objects.get(key) as Phaser.GameObjects.Container | undefined;
          if(!view){view=this.model(cannonModel);view.setDepth(COMBAT_LAYERS.playerShot);this.objects.set(key,view);}
          if(visualBullet.modelId===1000050){
            const frame=`arrow_Monster_rotundity_1_000${Math.floor(visualBullet.age*16)%4}`;
            if(this.textures.exists(frame))for(const child of view.list)
              if(child instanceof Phaser.GameObjects.Image&&child.getData('sourceSprite')==='arrow_Monster_rotundity_1_0000')child.setTexture(frame);
          }
          const point=this.screen(visualBullet.x,visualBullet.z);
          const yaw=visualBullet.visualAngle??(Math.hypot(visualBullet.vx,visualBullet.vz)>.001
            ?Math.atan2(visualBullet.vx,visualBullet.vz):visualBullet.angle);
          view.setPosition(point.x,point.y).setScale(visualBullet.scale).setRotation(yaw).setVisible(true);
        }
        continue;
      }
      this.pathogenic.projectile(visualBullet,(x,z)=>this.screen(x,z),Number(this.content.chapter.bullets[bullet.bulletId]?.parameters.Element??0));
      if(this.debugOn)this.outline(bullet,bullet.owner==='player'?0xffdd77:0xff5252);
    }
    for (const pickup of s.pickups) {
      const key = `pickup:${pickup.uid}`; live.add(key);
      let view = this.objects.get(key) as Phaser.GameObjects.Container | undefined;
      if (!view) { view = createPickupVisual(this, pickup) ?? this.model(pickup.modelId); view.setDepth(19); this.objects.set(key, view); }
      const pos = this.screen(pickup.x, pickup.z); view.setPosition(pos.x, pos.y).setVisible(pickup.age >= pickup.delay);
      if (updatePickupVisual(view, pickup)) continue;
      const sequence = this.content.assets.prefabs[this.prefabByModel.get(pickup.modelId)!]?.sequence;
      if (sequence?.frames?.length) {
        const frame = sequence.frames[Math.floor(Math.max(0, pickup.age - pickup.delay) * sequence.fps) % sequence.frames.length];
        const sprite = this.content.assets.sprites[frame];
        for (const child of view.list) if (child instanceof Phaser.GameObjects.Image && child.getData('sourceSprite') === sequence.rendererSprite) child.setTexture(frame).setOrigin(sprite.pivot.x, 1 - sprite.pivot.y);
      }
    }
    for(const buff of s.activeBuffVisuals)this.pathogenic.status(buff,(x,z)=>this.screen(x,z));
    for(const fx of s.effects)this.drawEffect(fx,live);
    this.pathogenic.endFrame();
    if (this.debugOn) {
      const radius = this.content.chapter.entities[this.content.chapter.player.entityId].stats.shape[0];
      this.outline({ ...s.player, radiusX: radius, radiusZ: radius, box: false, angle: 0 }, 0x44ff88);
    }
    for (const [key, view] of this.objects) if (!live.has(key)) {
      if (s.phase !== 'ready' && view instanceof EnemyHealthBar && view.finishAfterDeath(s.clock)) continue;
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
  private healthBar(x: number, y: number, width: number, ratio: number, color: number) {
    this.bars.fillStyle(0x091014, .9).fillRect(x - width / 2 - 2, y - 2, width + 4, 9);
    this.bars.fillStyle(color).fillRect(x - width / 2, y, width * Math.max(0, ratio), 5);
  }
  private drawEffect(fx: Effect,live:Set<string>){
    if(fx.age<0)return;
    if(fx.followPlayer){fx.x=this.sim.player.x+(fx.followOffset?.x||0);fx.z=this.sim.player.z+(fx.followOffset?.z||0);}
    if(fx.ownerUid){const owner=this.sim.enemies.find(e=>e.uid===fx.ownerUid&&!e.dead);if(!owner)return;const pos=this.enemyViewPositions.get(owner.uid)?.view.position??owner;fx.x=pos.x;fx.z=pos.z;}
    if(fx.kind!=='text'){this.pathogenic.effect(fx,(x,z)=>this.screen(x,z),isOrdinaryDeathVisual(fx)?.5:1);return;}
    const key=`fx:${fx.uid}`;live.add(key);let view=this.objects.get(key) as Phaser.GameObjects.Text|undefined;
    const layout=damageTextPose(fx);
    if(!view){view=this.add.text(0,0,fx.value||'',{fontFamily:'DankeUI, Microsoft YaHei',fontSize:layout.fontSize+'px',color:layout.color,stroke:'#18272e',strokeThickness:2}).setOrigin(.5).setDepth(layout.depth);this.objects.set(key,view);}
    const pos=this.screen(fx.x,fx.z),margin=view.width/2+4;
    view.setPosition(Math.max(margin,Math.min(WIDTH-margin,pos.x+layout.x)),Math.max(30,Math.min(HEIGHT-12,pos.y+layout.y))).setAlpha(layout.alpha);
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
  private outline(body: { x: number; z: number; radiusX: number; radiusZ: number; box: boolean; angle: number }, color: number) {
    const p = this.screen(body.x, body.z); this.debug.lineStyle(1, color, .8);
    if (!body.box) this.debug.strokeCircle(p.x, p.y, body.radiusX * this.px);
    else {
      const points = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => { const wx = x * body.radiusX, wz = z * body.radiusZ; return { x: p.x + (wx * Math.cos(body.angle) + wz * Math.sin(body.angle)) * this.px, y: p.y - (-wx * Math.sin(body.angle) + wz * Math.cos(body.angle)) * this.px }; });
      this.debug.strokePoints(points, true);
    }
  }
}

export function makeGame(scene: BattleView) {
  return new Phaser.Game({ type: Phaser.AUTO, parent: 'canvas', width: WIDTH, height: HEIGHT, backgroundColor: '#234652', scene, plugins: { scene: [{ key: 'SpinePlugin', plugin: spinePlugin, mapping: 'spine' }] }, render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' }, scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, audio: { noAudio: true }, banner: false });
}
