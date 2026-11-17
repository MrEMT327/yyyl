import source from './enemy-fire-effects-original.json';
import type { GameContent } from './kernel/model';

/** Effect_effect and Model_model have separate ID namespaces.
 * The loadout beam export contains Model_model 220006 (Laser) and 220010
 * (LaserGreen). Enemy bulletStartPrefabId/AttackAlarmEffect references are
 * Effect_effect IDs instead. Override only that visual lookup; retain beam
 * models, fire intervals, rewards and damage exactly as supplied.
 */
export function installEnemyFireEffects(content: GameContent): void {
  const effects = content.assets.originalEffects;
  for (const [id, effect] of Object.entries(source.effects)) effects.effects[id] = structuredClone(effect);
  Object.assign(effects.textures, structuredClone(source.textures));
  Object.assign(effects.meshes, structuredClone(source.meshes));
}
