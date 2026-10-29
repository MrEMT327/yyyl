import { Container, Graphics, Sprite } from '../three/display.js';
import registry from './asset-registry.json' with { type: 'json' };
import tokens from './visual-tokens.json' with { type: 'json' };
const color = name => Number.parseInt(tokens.palette[name].slice(1), 16);
export { registry, tokens };
export function fitSize(sourceWidth, sourceHeight, width, height) {
  return Math.min(width / sourceWidth, height / sourceHeight);
}
export function createAssetSprite(texture, spec) {
  const sprite = new Sprite(texture);
  sprite.anchor.set(...spec.anchor);
  sprite.scale.set(fitSize(texture.width, texture.height, ...spec.size));
  return sprite;
}
// Proxy geometry validates replacement mechanics; it is not production artwork.
export function createProxyAircraft(spec, friendly = false) {
  const view = new Container({ label: 'technical-proxy-not-final-art' });
  const shape = new Graphics().poly([0,-55,10,-17,39,10,38,23,9,10,8,39,20,48,0,44,-20,48,-8,39,-9,10,-38,23,-39,10,-10,-17])
    .fill(color(friendly ? 'cream' : 'teal')).stroke({ color: color('navy'), width: 3 })
    .rect(-5,-12,10,30).fill(color('vermilion'));
  shape.scale.set(fitSize(80, 110, ...spec.size));
  view.addChild(shape);
  return view;
}
export function createVisualSwitch(parent, legacyChildren, replacement) {
  parent.addChild(replacement);
  replacement.visible = false;
  let active = false;
  let saved = [];
  return {
    set(enabled) {
      if (enabled === active) {
        if (enabled) legacyChildren.forEach(child => { child.visible = false; });
        replacement.visible = enabled;
        return;
      }
      active = enabled;
      if (enabled) {
        saved = legacyChildren.map(child => child.visible);
        legacyChildren.forEach(child => { child.visible = false; });
      } else legacyChildren.forEach((child, i) => { child.visible = saved[i]; });
      replacement.visible = enabled;
    },
    dispose() { this.set(false); replacement.destroy({ children: true }); },
  };
}
export async function resolveAsset(id, cache) {
  const spec = registry[id];
  if (!spec || spec.status === 'planned' || !spec.url) return null;
  return cache.get(spec.url);
}
