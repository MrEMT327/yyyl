import type Phaser from 'phaser';
export const shockwavePickupModelId = 1300007;
export const frenzyPickupModelId = 1300004;
/** Original lightning badge, independent of the status effect's existing art. */
export function createFrenzyPickup(scene: Phaser.Scene, pixelsPerUnit: number) {
  const view = scene.add.container(0, 0);
  const g = scene.add.graphics(), r = pixelsPerUnit * .72;
  g.fillStyle(0x48200c, 1).fillCircle(0, 0, r);
  g.lineStyle(Math.max(1, pixelsPerUnit * .09), 0xffa740, 1).strokeCircle(0, 0, r);
  g.fillStyle(0xffef9a, 1).fillPoints([
    {x: r * .12, y: -r * .78}, {x: -r * .5, y: r * .1},
    {x: -r * .05, y: r * .1}, {x: -r * .15, y: r * .78},
    {x: r * .52, y: -r * .17}, {x: r * .06, y: -r * .17},
  ], true);
  view.add(g);
  return view;
}
/** Original vector pickup badge; no competitor image import or gameplay data edit. */
export function createShockwavePickup(scene: Phaser.Scene, pixelsPerUnit: number) {
  const view = scene.add.container(0, 0);
  const g = scene.add.graphics();
  const r = pixelsPerUnit * .72;
  g.fillStyle(0x082b48, 1).fillCircle(0, 0, r);
  g.lineStyle(Math.max(1, pixelsPerUnit * .09), 0x68e5ff, 1).strokeCircle(0, 0, r);
  g.lineStyle(Math.max(1, pixelsPerUnit * .065), 0xe8fbff, 1).strokeCircle(0, 0, r * .55);
  g.fillStyle(0xffd865, 1).fillCircle(0, 0, r * .19);
  view.add(g);
  return view;
}
