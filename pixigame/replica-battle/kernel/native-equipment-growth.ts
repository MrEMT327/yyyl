/** TriggerActionAddBuffByKillCount.CheckAndApplyBuff@0x6b16cc4 reads the
 * world's KillCount, including deaths which did not invoke this owner's kill
 * callback. Its cursor advances even when the buff is already at its cap. */
export class NativeKillMilestoneBuffs {
  private readonly sources = new Map<string, { milestone: number; buffId: number; processed: number }>();
  clear(): void { this.sources.clear(); }
  execute(key: string, milestone: number, buffId: number, kills: number, add: (buffId: number) => void): void {
    if (!(milestone >= 1 && buffId >= 1)) return;
    let source = this.sources.get(key);
    if (!source) { source = { milestone, buffId, processed: 0 }; this.sources.set(key, source); }
    this.apply(source, kills, add);
  }
  ownerKill(kills: number, add: (buffId: number) => void): void {
    for (const source of this.sources.values()) this.apply(source, kills, add);
  }
  private apply(source: { milestone: number; buffId: number; processed: number }, kills: number, add: (buffId: number) => void): void {
    const count = Math.trunc(kills / source.milestone) - Math.trunc(source.processed / source.milestone);
    source.processed = kills;
    for (let i = 0; i < count; i++) add(source.buffId);
  }
}

/** CharacterAttributeData.CountHpMax@0x6f95544: FP(HPMax * (1+HPMax%)),
 * minimum one, then FPMath.Round@0x8353158 (ties to even), not JS Math.round.
 * Pass the loadout's pre-percentage HPMax, including its explicit base
 * contribution, instead of reverse engineering it from rounded displayed HP.
 * Legacy/debug presets only expose startingHp and retain that fallback. */
export function nativeEquipmentMaxHp(startingHp: number, initialPercent: number, battleFlat: number, battlePercent: number, initialFlat?: number): number {
  const fixed = (value: number) => BigInt(Math.floor(value * 65536));
  const baseHp = initialFlat ?? startingHp / (1 + initialPercent);
  let raw = fixed(baseHp + battleFlat) * fixed(1 + initialPercent + battlePercent) >> 16n;
  if (raw < 65536n) raw = 65536n;
  let integer = raw >> 16n;
  const fraction = raw & 65535n;
  if (fraction > 32768n || fraction === 32768n && (integer & 1n) !== 0n) integer++;
  return Number(integer);
}
