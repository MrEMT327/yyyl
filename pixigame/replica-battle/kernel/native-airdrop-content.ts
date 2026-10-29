import source from '../airdrop-source.json';
import type { RecordData } from './model';

/** Narrow source-backed admission; never mass-enable the old unsupported list.
 * Shared action1/type7 pickup already implements Item_battle type4 semantics.
 * Only the verified default missile weapon110001 is admitted.
 */
export function installNativeAirdropContent(combat: RecordData): void {
  for (const key of ['triggers', 'weapons', 'bullets', 'buffs'] as const)
    combat[key] = { ...source[key], ...combat[key] };
  for (const id of [11001601, 11001701, 11001702, 11002101, 11002102, 11002201, 11002202]) {
    const card = combat.cards[id];
    if (!card) throw new Error(`Missing airdrop card ${id}`);
    card.supported = true;
    card.unsupported = [];
    card.effects = card.raw.Triggers.map((triggerId: number) => ({ type: 'nativeTrigger', triggerId, requiresNativeRuntime: true }));
  }
}
