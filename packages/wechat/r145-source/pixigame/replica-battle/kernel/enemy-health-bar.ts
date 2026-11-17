import Phaser from 'phaser';
import { enemyBarHitPulse, ENEMY_BAR_HIT_SECONDS } from './enemy-health-hit-motion';
import { clamp, lerp, type Enemy, type RecordData } from './model';

/** StateBarMonster: original sliced Images, SetRight fill and HP tweens. */
export class EnemyHealthBar extends Phaser.GameObjects.Container {
  private layers: { config: RecordData; image: Phaser.GameObjects.Image | Phaser.GameObjects.NineSlice;
    width: number; height: number; lastFill?: number }[] = [];
  private target = 1;
  private hpFrom = 1;
  private reduceFrom = 1;
  private changedAt = 0;
  private hitAt = -Infinity;
  private shownAt?: number;
  private diedAt?: number;
  private lastEnemy?: Enemy;
  constructor(scene: Phaser.Scene, private source: RecordData, private entity: RecordData, private screenScale: number) {
    super(scene, 0, 0);
    scene.add.existing(this); this.setDepth(50);
    for (const layer of source.bars[entity.bar].layers as RecordData[]) {
      if (!layer.active || layer.role === 'nextHp') continue;
      const sprite = source.sprites[layer.sprite], border = sprite.border;
      const image = layer.imageType === 1
        ? scene.add.nineslice(0, 0, layer.sprite, undefined, layer.width, layer.height, border.x, border.z, border.w, border.y)
        : scene.add.image(0, 0, layer.sprite);
      image.setOrigin(0, 0);
      image.setTint(layer.role === 'hp' ? 0xff2323 : 0xffffff);
      image.setAlpha(layer.color[3]);
      const width = layer.displayWidth * this.screenScale, height = layer.displayHeight * this.screenScale;
      image.setPosition(layer.x * this.screenScale - width * layer.pivot[0], -layer.y * this.screenScale - height * (1 - layer.pivot[1]));
      this.layers.push({ config: layer, image, width, height }); this.add(image);
    }
  }
  updateHealth(enemy: Enemy, clock: number) {
    this.lastEnemy = enemy;
    const behavior = this.source.behavior;
    const hpSeconds = Number(behavior.hpTweenSeconds), reduceSeconds = Number(behavior.reduceTweenSeconds);
    let hp = lerp(this.hpFrom, this.target, clamp((clock - this.changedAt) / hpSeconds, 0, 1));
    let reduce = lerp(this.reduceFrom, this.target, clamp((clock - this.changedAt) / reduceSeconds, 0, 1));
    const ratio = clamp(enemy.hp / enemy.maxHp, 0, 1);
    if (ratio < this.target && !enemy.dead && clock - this.hitAt >= ENEMY_BAR_HIT_SECONDS) this.hitAt = clock;
    if (enemy.dead || clock < this.hitAt) this.hitAt = -Infinity;
    const pulse = enemyBarHitPulse(clock - this.hitAt);
    // Absolute scale prevents cumulative growth under rapid multi-hit weapons.
    this.setScale(1 + pulse * .10, 1 - pulse * .16);
    if (ratio !== this.target) {
      this.hpFrom = hp; this.reduceFrom = reduce; this.target = ratio; this.changedAt = clock;
      if (this.shownAt === undefined) this.shownAt = clock;
    }
    if (enemy.dead && this.diedAt === undefined) this.diedAt = clock + reduceSeconds;
    const visible = this.entity.initiallyVisible || this.shownAt !== undefined;
    const showAlpha = this.entity.initiallyVisible ? 1 : this.shownAt === undefined ? 0 : clamp((clock - this.shownAt) / behavior.showFadeSeconds, 0, 1);
    const deathAlpha = this.diedAt === undefined ? 1 : 1 - clamp((clock - this.diedAt) / behavior.deathFadeSeconds, 0, 1);
    this.setVisible(visible).setAlpha(showAlpha * deathAlpha);
    if (!visible) return;
    for (const record of this.layers) {
      const {config: layer, image, width, height}=record;
      const fill = layer.role === 'hp' ? hp : layer.role === 'reduce' ? reduce : 1;
      if (fill === record.lastFill) continue;
      record.lastFill=fill;
      // Unity SetRight shortens the sliced Image, keeping both borders. Phaser
      // clamps to border sum; scaling that minimum reproduces Unity compression.
      if (image instanceof Phaser.GameObjects.NineSlice) image.setSize(layer.width * fill, layer.height);
      image.setDisplaySize(Math.max(.0001, width * fill), height).setVisible(fill > 0);
    }
  }
  finishAfterDeath(clock: number): boolean {
    if (!this.lastEnemy || this.diedAt === undefined || clock >= this.diedAt + this.source.behavior.deathFadeSeconds) return false;
    this.updateHealth(this.lastEnemy, clock);
    return true;
  }
}
