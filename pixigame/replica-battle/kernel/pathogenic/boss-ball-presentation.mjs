// Model 1100005: chapter3 assets, Bullet_Boss_Ball_Red_1.
// Native opaque core is 60px at alpha >= 128, PPU 100, prefab scale 2:
// 1.2 world units before the live bullet scale. Do not use the 100px canvas
// (which includes a faint halo) as an opaque travelling body.
// The migrated cannon texture's core is 292px on its long axis; its completed
// spawn animation supplies scale .55. Keep that animation and original art.
export function bossBallVisualScale(b, screen, sourcePixelScale) {
  const origin = screen(b.x, b.z), unit = screen(b.x + 1, b.z);
  const pixelsPerUnit = Math.hypot(unit.x - origin.x, unit.y - origin.y);
  return b.scale * (60 / 100 * 2) * pixelsPerUnit / (292 * .55 * sourcePixelScale);
}
