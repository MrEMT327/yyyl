// Canvas-only UI drawing. Hosts supply wx.createCanvas/createImage in a mini
// game, or equivalent factories in the development harness. No DOM is needed.
export function drawNineSlice(ctx, image, x, y, width, height, slices, scale = 1) {
  const [top, right, bottom, left] = Array.isArray(slices) ? slices : [slices, slices, slices, slices];
  const sourceW = image.width, sourceH = image.height;
  const factor = Math.max(0, Math.min(scale, width / (left + right), height / (top + bottom)));
  const sx = [0, left, sourceW - right, sourceW], sy = [0, top, sourceH - bottom, sourceH];
  const dx = [x, x + left * factor, x + width - right * factor, x + width];
  const dy = [y, y + top * factor, y + height - bottom * factor, y + height];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    if (dx[col + 1] > dx[col] && dy[row + 1] > dy[row])
      ctx.drawImage(image, sx[col], sy[row], sx[col + 1] - sx[col], sy[row + 1] - sy[row],
        dx[col], dy[row], dx[col + 1] - dx[col], dy[row + 1] - dy[row]);
  }
}
