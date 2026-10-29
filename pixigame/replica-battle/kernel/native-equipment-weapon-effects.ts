type NativeRow = Record<string, any>;

/** WeaponCDReset2ExAttackModProcessor.PostProcess@0x6dd2d94.
 * The character flag is consumed once by a mod-bearing fire queue, not per bullet.
 */
export class NativeCooldownResetAttack {
  private pending = new Set<number>();
  clear() { this.pending.clear(); }
  reset(owner: number) { this.pending.add(owner); }
  enterCease(owner: number) { this.pending.delete(owner); }
  consume(owner: number, mods: readonly NativeRow[]): number {
    const records = mods.filter(mod => mod.type === 'WeaponCDReset2ExAttackMod');
    if (!records.length || !this.pending.delete(owner)) return 0;
    return records.reduce((sum, mod) => sum + Number(mod.parameters?.ExAttack || 0), 0);
  }
}

/** EntityHero.GetMaxStarSkillSecondWeaponEntity@0x6cb614c.
 * Native OrderedDictionary insertion order breaks ties; only BelongSkill[0]
 * and its NextSkill chain contribute. Unlearned rows do not contribute a star.
 */
export function nativeHighestStarSecondWeapon(owned: readonly number[], entities: Record<number, NativeRow>,
  skills: Record<number, NativeRow>, history: readonly number[]): number | undefined {
  const learned = new Set(history);
  let winner: number | undefined, maximum = -1;
  for (const entityId of owned) {
    const entity = entities[entityId]?.raw || entities[entityId];
    let id = Number(entity?.BelongSkill?.[0] || 0), star = -1;
    const visited = new Set<number>();
    while (id && !visited.has(id)) {
      visited.add(id);
      const row = skills[id]?.raw || skills[id];
      if (!row) throw new Error(`Missing native weapon skill ${id} for ${entityId}`);
      if (learned.has(id)) star = Math.max(star, Number(row.SkillStar));
      id = Number(row.NextSkill || 0);
    }
    if (star > maximum) { maximum = star; winner = entityId; }
  }
  return winner;
}
