const BODY_OVER_RAISED_THIGH_ORDER = 331;

// The torso is the front surface where the bent thigh meets the shorts.
export function orangeTargetLayerOrder(layer, materialRevision) {
  if (materialRevision === 'jetboard-v5-clean-r5' && layer.id === 'body') return BODY_OVER_RAISED_THIGH_ORDER;
  return layer.order;
}
