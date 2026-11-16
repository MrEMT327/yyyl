// Match CSS object-fit: contain for both scene images and the live model.
export function portraitCamera(camera, width, height) {
  const referenceWidth = camera.width || 900;
  const referenceHeight = camera.height || 900;
  const fit = Math.min(width / referenceWidth, height / referenceHeight);
  const x = referenceWidth * fit / width;
  const y = referenceHeight * fit / height;
  return {
    scale: [camera.scaleNdc[0] * x, camera.scaleNdc[1] * y],
    translate: [camera.translateNdc[0] * x, camera.translateNdc[1] * y],
  };
}
