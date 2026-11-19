import type Phaser from 'phaser';
import {COMBAT_LAYERS} from './combat-readability.mjs';
import type { PlayerSkin } from '../appearance-types';
import 'phaser/plugins/spine4.1/dist/SpinePlugin.js';
import type { RecordData } from './model';
import { createPlayerDeflection, updatePlayerDeflection, type DeflectionMotion } from './player-deflection';

// The installed Phaser distribution includes the matching Spine 4.1 runtime.
// Use the original skeleton, atlas, mesh weights and deform timelines directly.
type SpineObject = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform
  & Phaser.GameObjects.Components.Visible & Phaser.GameObjects.Components.Depth & {
    timeScale: number;
    state: RecordData;
    skeleton: RecordData;
    setAlpha(alpha: number): SpineObject;
    refresh(): SpineObject;
  };
type SpineFactory = { spine(x: number, y: number, key: string, animation: string, loop: boolean): SpineObject };
type SpineLoader = { spine(key: string, json: string, atlas: string, premultiplied: boolean): void };

export const spinePlugin = (window as unknown as { SpinePlugin: typeof Phaser.Plugins.ScenePlugin }).SpinePlugin;

export function preloadPlayerSpine(scene: Phaser.Scene, layers: RecordData[]) {
  for (const layer of layers) (scene.load as unknown as SpineLoader).spine(layer.key, layer.json, layer.atlas, true);
}

export class SpinePlayer {
  private layers: { view: SpineObject; scale: number; config: RecordData; animation: string }[];
  private clock = 0;
  private firstUpdate = true;
  private deflection = createPlayerDeflection();
  constructor(private scene: Phaser.Scene, config: RecordData[], private bodyPresentation?: PlayerSkin) {
    this.layers = config.map((layer, index) => {
      const animation = layer.animation || 'normal';
      const view = (scene.add as unknown as SpineFactory).spine(0, 0, layer.key, animation, true);
      view.state.data.defaultMix = layer.defaultMix;
      for (const mix of layer.animationMix || []) view.state.data.setMix(mix.from, mix.to, mix.duration);
      if (layer.skin || layer.initialSkinName) view.skeleton.setSkinByName(layer.skin || layer.initialSkinName);
      view.setDepth(COMBAT_LAYERS.player + (layer.depth ?? index) * .01);
      // Advance from simulation time, so pause/upgrade stops all skeleton tracks.
      view.timeScale = 0;
      return { view, scale: layer.scale, config: layer, animation };
    });
  }
  update(clock: number, x: number, y: number, pixelsPerUnit: number, modelScale: number, visible: boolean, alpha: number, motion: DeflectionMotion) {
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
        // HeroView.OnApplyMoveDeflectionAnim@74cbd38 forwards the same native
        // result to PilotAnim, in addition to the airplane skeletons.
        if (config.animations && !config.animations.includes(command.animation)) continue;
        const track = index === 0 ? view.state.setAnimation(0, command.animation, command.loop) : view.state.addAnimation(0, command.animation, command.loop, 0);
        track.timeScale = command.timeScale; track.reverse = command.reverse;
        track.trackTime = command.trackTime; track.setAnimationLast(command.animationLast);
      }
    }
    const carrier = this.layers.find(layer => !layer.config.pilot);
    for (const { view, scale, config } of this.layers) {
      let px = x, py = y, rotation = Number(config.rotationRadians || 0);
      if (config.pilot && carrier) {
        // Phaser refresh includes the carrier's screen position and scale.
        // Spine uses a bottom-left origin; convert Y once, without adding or
        // scaling the aircraft position a second time (also for hidden hulls).
        carrier.view.refresh();
        const bone = carrier.view.skeleton.findBone(config.mountBone || 'Hero');
        if (bone) {
          px = bone.worldX;
          py = this.scene.game.renderer.height - bone.worldY;
          // Original Airplane_0 Hero BoneFollower: followBoneRotation=1,
          // followLocalScale=0. Keep pilot size independent of bone scaling.
          if (config.followBoneRotation !== false) rotation -= Math.atan2(bone.c, bone.a);
        } else {
          px += Number(config.offsetX || 0) * pixelsPerUnit * modelScale;
          py -= Number(config.offsetZ || 0) * pixelsPerUnit * modelScale;
        }
      }
      const size = pixelsPerUnit * scale * modelScale * Number(config.transformScale ?? 1);
      view.setPosition(px, py).setScale(size * (config.flipX ? -1 : 1), size * (config.flipY ? -1 : 1)).setRotation(rotation).setVisible(visible && !config.pilot);
      // The replacement includes both native aircraft layers. Keep their skeletons
      // active for poses and pilot mounts without drawing over the new aircraft.
      // All aircraft are pilot-free visually; pilot ownership and skills remain active.
      view.setAlpha(config.pilot || this.bodyPresentation ? 0 : alpha);
      view.state.update(dt); view.state.apply(view.skeleton);
    }
    this.presentBody(clock, x, y, pixelsPerUnit, modelScale, visible, alpha);
  }
  private presentBody(clock: number, x: number, y: number, pixelsPerUnit: number, modelScale: number, visible: boolean, alpha: number) {
    if (!this.bodyPresentation) return;
    const layer = this.layers.find(row => !row.config.pilot);
    if (!layer) return;
    const body = layer.view.skeleton.findBone('p_cang_u2');
    const scale = pixelsPerUnit * layer.scale * modelScale * Number(layer.config.transformScale ?? 1);
    this.bodyPresentation.update({ clock,
      x: x + (body ? body.x - body.data.x : 0) * scale, y: y - (body ? body.y - body.data.y : 0) * scale,
      width: this.bodyPresentation.width * scale, height: this.bodyPresentation.height * scale,
      scaleX: body ? Math.abs(body.scaleX / (body.data.scaleX || 1)) : 1,
      scaleY: body ? Math.abs(body.scaleY / (body.data.scaleY || 1)) : 1,
      shearX: body ? body.shearX - body.data.shearX : 0, alpha, visible });
  }
  destroy() { for (const { view } of this.layers) view.destroy(); this.layers = []; }
}
