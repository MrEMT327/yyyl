import type { NativeRecord } from './weapon-skill-runtime';

const FP = 65536;
const fpMultiply = (a: number, b: number) => Math.floor(Math.trunc(a * FP) * Math.trunc(b * FP) / FP) / FP;
export interface NativeDropBounds { left: number; right: number; bottom: number; top: number }
export interface NativeLoadoutDropItem {
  itemId: number; dropType: 3 | 4; parameter: number;
  life: number; shineTime: number; dropSpeed: number; modelId: number;
  collectEffectId: number; collectSoundId: number; effectScale: number; effectTime: number; effectPosType: number;
}

/** Explicit storage format prevents mixing the raw Item_battle data in
 * assets.json with schema-normalized rows in loadout-runtime.json. */
export function nativeLoadoutDropItem(row: NativeRecord, format: 'raw-fp' | 'normalized'): NativeLoadoutDropItem | undefined {
  if (row.dropType !== 3 && row.dropType !== 4) return undefined;
  const scalar = (key: string) => Number(row[key] || 0) / (format === 'raw-fp' ? FP : 1);
  return { itemId: Number(row.id ?? row.ID), dropType: row.dropType, parameter: Number(row.parameter),
    life: scalar('life'), shineTime: scalar('shineTime'), dropSpeed: scalar('DropSpeed'), modelId: Number(row.prefabId || 0),
    collectEffectId: Number(row.collectEffectId || 0), collectSoundId: Number(row.collectSoundId || 0),
    effectScale: scalar('EffectScale'), effectTime: scalar('EffectTime'), effectPosType: Number(row.posType || 0) };
}

/** Trigger.GetPos type7@6ba44fc -> MapManager.GetRandomPosBeyondTopMap
 * @6cf5510. X is drawn first, with radius2 inset; Z is drawn from camera
 * bottom + height*[raw0x11999,raw0x13333]. No circle around the hero. */
export function nativeLoadoutTopDropPosition(bounds: NativeDropBounds, random: () => number): { x: number; z: number } {
  const x = bounds.left + 2 + (bounds.right - bounds.left - 4) * random();
  const height = bounds.top - bounds.bottom;
  const minimum = bounds.bottom + fpMultiply(height, 0x11999 / FP);
  const maximum = bounds.bottom + fpMultiply(height, 0x13333 / FP);
  return { x, z: minimum + (maximum - minimum) * random() };
}

export interface NativeLoadoutDropPlan { item: NativeLoadoutDropItem; position: { x: number; z: number }; initialState: 'dropEnd'; delay: 0 }

/** Scope is the original type7 path used by all eight meta pickups154..161.
 * Original types3/4 enter DropEnd directly: no ordinary loot scatter phase. */
export function nativeLoadoutDropPlan(args: NativeRecord, item: NativeLoadoutDropItem, bounds: NativeDropBounds, random: () => number): NativeLoadoutDropPlan | undefined {
  if (Number(args.DropItem) !== item.itemId || Number(args.DropPosType || 0) !== 7) return undefined;
  return { item, position: nativeLoadoutTopDropPosition(bounds, random), initialState: 'dropEnd', delay: 0 };
}

/** Original .75s constants differ at equality: Buff.CanAbsorb@6a2087c
 * accepts >=, Trigger.CanAbsorb@6a2c844 accepts >. */
export function nativeLoadoutDropCanAbsorb(dropType: 3 | 4, age: number): boolean {
  return dropType === 3 ? age >= 0xc000 / FP : age > 0xc000 / FP;
}

export type NativeLoadoutPickupEffect = { kind: 'buff'; buffId: number } | { kind: 'trigger'; triggerId: number; sourceSkillId: 0 };
/** DropItemTrigger.OnAbsorb adds a TRIGGER table row, not a Skill_Main row.
 * Every collection creates a new instance. TriggerType0 enters onceTriggers
 * and executes at the next component update; it is not a permanent skill. */
export function nativeLoadoutPickupEffect(item: NativeLoadoutDropItem): NativeLoadoutPickupEffect {
  return item.dropType === 3 ? { kind: 'buff', buffId: item.parameter } : { kind: 'trigger', triggerId: item.parameter, sourceSkillId: 0 };
}

/** EntityHero map pickup accounting normalizes upgraded item IDs>=1001 by
 * subtracting1000 once. Item100/101 have a fixed cap1; the meta items use the
 * current MapBuffCount attribute. Caller releases on collect AND force remove. */
export class NativeLoadoutDropCounts {
  private readonly counts = new Map<number, number>();
  private key(id: number): number { return id >= 1001 ? id - 1000 : id; }
  clear(): void { this.counts.clear(); }
  count(id: number): number { return this.counts.get(this.key(id)) || 0; }
  canCreate(id: number, mapBuffCount: number): boolean {
    const key = this.key(id);
    return (this.counts.get(key) || 0) < (key === 100 || key === 101 ? 1 : mapBuffCount);
  }
  created(id: number): void { const key = this.key(id); this.counts.set(key, (this.counts.get(key) || 0) + 1); }
  removed(id: number): void { const key = this.key(id); this.counts.set(key, (this.counts.get(key) || 0) - 1); }
}
