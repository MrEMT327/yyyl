import type { Pickup, RecordData } from './model';

/** Item_battle is the same raw fixed-point table consumed by loadout drops.
 * Read-only warning: expiry, movement and collection remain in Simulation. */
export function pickupExpiryAlpha(pickup: Pick<Pickup, 'age' | 'delay' | 'kind' | 'state' | 'attracted'>, row?: RecordData): number {
  if (!row || (pickup.kind !== 'buff' && pickup.kind !== 'trigger') ||
      (row.dropType !== 3 && row.dropType !== 4) || pickup.state !== 'stay' || pickup.attracted || pickup.age < pickup.delay) return 1;
  const life = Number(row.life) / 65536, shine = Number(row.shineTime) / 65536;
  if (!(life > 0 && shine > 0 && Number.isFinite(life) && Number.isFinite(shine))) return 1;
  const start = Math.max(0, life - shine), window = life - start;
  if (pickup.age < start || pickup.age >= life) return 1;
  const progress = (pickup.age - start) / window;
  // Our own soft opacity pulse, not exported source animation curves.
  // Four pulses in the configured warning window; keep the item readable.
  return 1 - .72 * Math.sin(progress * Math.PI * 4) ** 2;
}
