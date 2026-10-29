export function addChildren(parent, ...children) {
  const displayObjects = children.filter(Boolean);
  if (displayObjects.length > 0) parent.addChild(...displayObjects);
  return parent;
}
