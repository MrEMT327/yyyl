import type Phaser from 'phaser';
import { cloudAssetBase } from '../../src/ui/cloud-asset-base.js';

export const DAMAGE_DIGIT_FONT = 'project-damage-digits-v1';
export type DamageTextView = Phaser.GameObjects.Text | Phaser.GameObjects.BitmapText;
type TextStyle = { fontSize: number; color: string; depth: number };

export function preloadDamageNumberArt(scene: Phaser.Scene) {
  if (scene.cache.bitmapFont.exists(DAMAGE_DIGIT_FONT)) return;
  const root = cloudAssetBase + 'art/project-damage-numbers-v1/';
  scene.load.bitmapFont(DAMAGE_DIGIT_FONT, root + 'digits.png', root + 'digits.xml');
}

export function updateDamageTextView(scene: Phaser.Scene, existing: DamageTextView | undefined, value: string, style: TextStyle): DamageTextView {
  // The atlas contains digits and signs. Combat labels keep their complete Chinese text.
  const bitmap = /^[+\-−]?\d+$/.test(value) && scene.cache.bitmapFont.exists(DAMAGE_DIGIT_FONT);
  let view = existing;
  if (view && (view.type === 'BitmapText') !== bitmap) {
    view.destroy();
    view = undefined;
  }
  if (!view) {
    view = bitmap
      ? scene.add.bitmapText(0, 0, DAMAGE_DIGIT_FONT, value, style.fontSize)
      : scene.add.text(0, 0, value, {
        fontFamily: 'DankeUI, Microsoft YaHei', fontSize: style.fontSize + 'px',
        color: style.color, stroke: '#18272e', strokeThickness: 2,
      });
    view.setOrigin(.5);
  }
  if (view.text !== value) view.setText(value);
  if (bitmap) {
    const digits = view as Phaser.GameObjects.BitmapText;
    if (digits.fontSize !== style.fontSize) digits.setFontSize(style.fontSize);
    digits.setTint(Number.parseInt(style.color.slice(1), 16));
  } else {
    const text = view as Phaser.GameObjects.Text;
    if (Number.parseFloat(String(text.style.fontSize)) !== style.fontSize) text.setFontSize(style.fontSize);
    if (text.style.color !== style.color) text.setColor(style.color);
  }
  return view.setDepth(style.depth);
}
