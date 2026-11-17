import type Phaser from 'phaser';
import {COMBAT_LAYERS} from './combat-readability.mjs';
import type { PlayerSkin } from '../appearance-types';
import 'phaser/plugins/spine4.1/dist/SpinePlugin.js';
import type { RecordData } from './model';
import { playerSpineLayers } from './player-appearance';
import { createPlayerDeflection, updatePlayerDeflection, type DeflectionMotion } from './player-deflection';

// The installed Phaser distribution includes the matching Spine 4.1 runtime.
// Use the original skeleton, atlas, mesh weights and deform timelines directly.
type SpineObject = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform
  & Phaser.GameObjects.Components.Visible & Phaser.GameObjects.Components.Depth & {
    timeScale: number;
    state: RecordData;
    skeleton: RecordData;
    setAlpha(alpha: number): SpineObject;
  };
type SpineFactory = { spine(x: number, y: number, key: string, animation: string, loop: boolean): SpineObject };
type SpineLoader = { spine(key: string, json: string, atlas: string, premultiplied: boolean): void };

export const spinePlugin = (window as unknown as { SpinePlugin: typeof Phaser.Plugins.ScenePlugin }).SpinePlugin;

export function hasPlayerSpineLayer(scene: Phaser.Scene, key: string) {
  return scene.cache.json.has(key) && scene.cache.custom.spine?.has(key);
}

export function preloadPlayerSpine(scene: Phaser.Scene, layers: RecordData[]) {
  for (const layer of layers) (scene.load as unknown as SpineLoader).spine(layer.key, layer.json, layer.atlas, true);
}

export class SpinePlayer {
  private layers: { view: SpineObject; scale: number; config: RecordData; animation: string }[];
  private bodyConfig: RecordData | undefined;
  private clock = 0;
  private firstUpdate = true;
  private deflection = createPlayerDeflection();
  constructor(scene: Phaser.Scene, config: RecordData[], private bodyPresentation?: PlayerSkin) {
    this.bodyConfig = config[0];
    this.layers = playerSpineLayers(config, Boolean(bodyPresentation)).flatMap((layer, index) => {
      if (!hasPlayerSpineLayer(scene, layer.key)) return [];
      const animation = layer.animation || 'normal';
      const view = (scene.add as unknown as SpineFactory).spine(0, 0, layer.key, animation, true);
      view.state.data.defaultMix = layer.defaultMix;
      for (const mix of layer.animationMix || []) view.state.data.setMix(mix.from, mix.to, mix.duration);
      if (layer.skin || layer.initialSkinName) view.skeleton.setSkinByName(layer.skin || layer.initialSkinName);
      view.setDepth(COMBAT_LAYERS.player + (layer.depth ?? index) * .01);
      // Advance from simulation time, so pause/upgrade stops all skeleton tracks.
      view.timeScale = 0;
      return [{ view, scale: layer.scale, config: layer, animation }];
    });
  }
  update(clock: number, x: number, y: number, pixelsPerUnit: number, modelScale: number, visible: boolean, alpha: number, motion: DeflectionMotion) {
    if (!this.layers.length) {
      this.presentBody(clock, x, y, pixelsPerUnit, modelScale, visible, alpha);
      return;
    }
    if (this.firstUpdate || clock < this.clock || clock === 0) {
      for (const { view, animation } of this.layers) {
        view.skeleton.setToSetupPose(); view.state.clearTracks(); view.state.setAnimation(0, animation, true);
      }
      this.clock = clock; this.deflection = createPlayerDeflection(); this.firstUpdate = false;
    }
    const dt = Math.max(0, clock - this.clock); this.clock = clock;
    if (dt > 0) {
      const current = this.layers[0]?.view.state.getCurrent(0);
      if (!current) return;
      const plan = updatePlayerDeflection(this.deflection, motion,
        { animation: current.animation.name, animationTime: current.getAnimationTime(), duration: current.animation.duration, reverse: current.reverse }, dt);
      this.deflection = plan.state;
      if (plan.entries) for (const { view, config } of this.layers) for (const [index, command] of plan.entries.entries()) {
        // Both hull layers follow the original deflection plan.
        if (config.animations && !config.animations.includes(command.animation)) continue;
        const track = index === 0 ? view.state.setAnimation(0, command.animation, command.loop) : view.state.addAnimation(0, command.animation, command.loop, 0);
        track.timeScale = command.timeScale; track.reverse = command.reverse;
        track.trackTime = command.trackTime; track.setAnimationLast(command.animationLast);
      }
    }
    for (const { view, scale, config } of this.layers) {
      const rotation = Number(config.rotationRadians || 0);
      const size = pixelsPerUnit * scale * modelScale * Number(config.transformScale ?? 1);
      view.setPosition(x, y).setScale(size * (config.flipX ? -1 : 1), size * (config.flipY ? -1 : 1)).setRotation(rotation).setVisible(visible);
      // The hull bones still supply the 3D plane pose.
      view.setAlpha(this.bodyPresentation ? 0 : alpha);
      view.state.update(dt); view.state.apply(view.skeleton);
    }
    this.presentBody(clock, x, y, pixelsPerUnit, modelScale, visible, alpha);
  }
  private presentBody(clock: number, x: number, y: number, pixelsPerUnit: number, modelScale: number, visible: boolean, alpha: number) {
    const config = this.bodyConfig;
    if (!this.bodyPresentation || !config) return;
    const primary = this.layers[0];
    const body = primary?.config === config ? primary.view.skeleton.findBone('p_cang_u2') : undefined;
    const scale = pixelsPerUnit * config.scale * modelScale * Number(config.transformScale ?? 1);
    this.bodyPresentation.update({ clock,
      x: x + (body ? body.x - body.data.x : 0) * scale, y: y - (body ? body.y - body.data.y : 0) * scale,
      width: this.bodyPresentation.width * scale, height: this.bodyPresentation.height * scale,
      scaleX: body ? Math.abs(body.scaleX / (body.data.scaleX || 1)) : 1,
      scaleY: body ? Math.abs(body.scaleY / (body.data.scaleY || 1)) : 1,
      shearX: body ? body.shearX - body.data.shearX : 0, alpha, visible });
  }
  destroy() { for (const { view } of this.layers) view.destroy(); this.layers = []; }
}
