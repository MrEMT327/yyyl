import { nativeWeaponBody, drawWeaponAccent } from './weapon-visual-quality.js';
// Pathogenic texture adaptation, not a gameplay or Godot animation port.
export const ARC_WEAPON_TRIAL_ENABLED = true;
export const ARC_WEAPON_TEXTURE = 'pathogenic-arc-weapon-trial';
export function isArcWeaponVisual(b) {
  return ARC_WEAPON_TRIAL_ENABLED && b.owner === 'player' && b.familyId === 200001 && b.modelId === 200037 && b.beam && b.age >= b.warmup;
}
export function preloadArcWeaponVisual(scene) {
  if(ARC_WEAPON_TRIAL_ENABLED)scene.load.image(ARC_WEAPON_TEXTURE,new URL('assets/arc-trial/pathogenic-lightning.png',location.href).href);
}
export function drawTrialArcWeaponVisual(scene,b,live,widthFactor=1) {
  if(!isArcWeaponVisual(b)||!scene.textures.exists(ARC_WEAPON_TEXTURE))return false;
  const line=scene.content.assets.beamEffects.effects[b.modelId]?.lines?.[0];
  if(!line)return false;
  const width=Number(line.parameters.widthMultiplier)*Number(line.parameters.widthCurve?.m_Curve?.[0]?.value??1)*scene.px*widthFactor;
  if(!(width>0))return true;
  for(const [index,segment] of b.segments.entries()) {
    const a=scene.screen(segment.from.x,segment.from.z),z=scene.screen(segment.to.x,segment.to.z);
    const length=Math.hypot(z.x-a.x,z.y-a.y);if(length<.001)continue;
    const key=`arc-weapon-trial:${b.uid}:${index}`;live.add(key);
    let view=scene.objects.get(key);
    if(!view){view=scene.add.image(0,0,ARC_WEAPON_TEXTURE).setDepth(31);scene.objects.set(key,view);}
    view.setPosition((a.x+z.x)/2,(a.y+z.y)/2).setRotation(Math.atan2(z.y-a.y,z.x-a.x))
      .setDisplaySize(length,width).setFlipY((Math.floor(b.age*24)+index)%2===1);
  }
  return true;
}
export const drawArcWeaponVisual = nativeWeaponBody;

// Replace the main beam material inside the native renderer, not the whole
// projectile render pass. Chain endpoints, lifetime and other layers survive.
const flowingLines = new WeakMap();
export function arcBodyLine(b, line, available) {
  // The renderer also passes a dead snapshot for the native .05s contraction.
  // Keep its material until that renderer-owned tail expires.
  if (!available || !isArcWeaponVisual(b) || b.visualHidden || !(b.scale > 0)) return line;
  const source = line.materials?.[0];
  if (!source?.textures?.some(t => t.slot === '_MainTex')) return line;
  let adapted = flowingLines.get(line);
  if (!adapted) {
    adapted = { ...line, parameters: { ...line.parameters,
      // The decoded Pathogenic art has a much denser core than the old atlas.
      // Fit it within the native footprint; this is not a collision width.
      widthMultiplier: Number(line.parameters.widthMultiplier) * .5,
    }, materials: [{ ...source, shaderName: 'Effects/UVFlow',
      textures: source.textures.map(t => t.slot === '_MainTex' ? { ...t, key: ARC_WEAPON_TEXTURE,
        scale: { x: 1, y: 1 }, offset: { x: 0, y: 0 } } : t),
      colors: { ...source.colors, _MainSpeed: { r: -1.8, g: 0, b: 0, a: 0 } },
    }, ...line.materials.slice(1)] };
    flowingLines.set(line, adapted);
  }
  return adapted;
}
