import source from './public/data/monster-abilities.json';
import type { Point, RecordData } from './kernel/model';

/** Action 168 subscribes OnSuicide, not OnEntityDead (action 92).
 * Native: OnInit 0x6b6a130; OnSuicide 0x6b6a494; Undo 0x6b6a378. */
export function chapterSuicideTraitSupported(trait: unknown, data: RecordData = source): boolean {
  if (String(trait).trim() !== '300021') return false;
  const skill = data.skills?.[300021], trigger = data.triggers?.[300021];
  if (skill?.Triggers?.length !== 1 || skill.Triggers[0] !== 300021 ||
      trigger?.TriggerType !== 0 || trigger.TriggerAction !== 168 || trigger.TriggerAction2 !== 0) return false;
  try {
    const p = JSON.parse(trigger.ActionParam);
    return p.WeaponId === 80001 && p.ExplodeRadius === 10 &&
      Object.keys(p).every(k => ['WeaponId', 'ExplodeRadius'].includes(k));
  } catch { return false; }
}

/** Called only after a live owner's Suicide has successfully entered death.
 * ExternalWeaponFireInfo uses a multiplicative shape scale, no Explosion trait
 * injection. Existing weapon/buff pipeline supplies attack*8, Through99,
 * Buff200001, lifetime and collision interval from the exported tables. */
export function chapterSuicideFirePlan(traits: readonly unknown[], owner: Point, self: boolean,
  wasDead: boolean, data: RecordData = source) {
  if (!self || wasDead || !traits.some(trait => chapterSuicideTraitSupported(trait, data))) return;
  return { weaponId: 80001, fixedPosition: { x: owner.x, y: 0, z: owner.z }, angle: 0,
    flags: 0x88, allowDeadOwner: true as const, externalShapeScale: 10, fireEffectScale: 10 };
}
