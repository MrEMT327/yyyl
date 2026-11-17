type PendingAttribute = { name: string; delta: bigint; maximum: bigint; once: boolean };

function parseFixed(value: string): bigint | undefined {
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(value.trim());
  if (!match || !(match[2] || match[3])) return;
  const fraction = (match[3] || '').slice(0, 14);
  const denominator = 10n ** BigInt(fraction.length);
  const raw = BigInt(match[2] || '0') * 65536n
    + (BigInt(fraction || '0') * 65536n + denominator / 2n) / denominator;
  return match[1] === '-' ? -raw : raw;
}

export function nativeFixedFromString(value: string): number | undefined {
  const raw = parseFixed(value);
  return raw === undefined ? undefined : Number(raw) / 65536;
}

function parseAttribute(value: unknown): PendingAttribute | undefined {
  if (typeof value !== 'string') return;
  const parts = value.split('|');
  if (parts.length < 3 || !parts[0].trim()) return;
  const delta = parseFixed(parts[1]);
  const maximum = parseFixed(parts[2]);
  const once = parts.length < 4 ? 'false' : parts[3].trim().toLowerCase();
  if (delta === undefined || maximum === undefined || !['true', 'false'].includes(once)) return;
  return { name: parts[0].trim(), delta, maximum, once: once === 'true' };
}

export class NativePendingBulletAttributes {
  private readonly owners = new Map<number, Map<string, Map<number, PendingAttribute[]>>>();

  execute(owner: number, sourceKey: string, args: Record<string, unknown>): void {
    if (!Array.isArray(args.WeaponIds) || !Array.isArray(args.Attrs)) return;
    let sources = this.owners.get(owner);
    if (!sources) { sources = new Map(); this.owners.set(owner, sources); }
    let weapons = sources.get(sourceKey);
    if (!weapons) { weapons = new Map(); sources.set(sourceKey, weapons); }
    for (const weaponId of args.WeaponIds) {
      if (typeof weaponId !== 'number' || !Number.isInteger(weaponId)) continue;
      const existing = weapons.get(weaponId);
      const incoming = args.Attrs.map(parseAttribute).filter((entry): entry is PendingAttribute => !!entry);
      if (!existing) { weapons.set(weaponId, incoming); continue; }
      for (const attribute of incoming) {
        const prior = existing.find(entry => entry.name === attribute.name);
        if (prior) {
          prior.delta = BigInt.asIntN(64, prior.delta + attribute.delta);
          prior.maximum = BigInt.asIntN(64, prior.maximum + attribute.maximum);
          prior.once = attribute.once;
        } else existing.push(attribute);
      }
    }
  }

  consume(owner: number, weaponId: number): Record<string, number> {
    const totals = new Map<string, bigint>();
    for (const weapons of this.owners.get(owner)?.values() || []) {
      const attributes = weapons.get(weaponId);
      if (!attributes) continue;
      for (const attribute of attributes) {
        const amount = attribute.delta < attribute.maximum ? attribute.delta : attribute.maximum;
        totals.set(attribute.name, BigInt.asIntN(64, (totals.get(attribute.name) || 0n) + amount));
      }
      weapons.set(weaponId, attributes.filter(attribute => !attribute.once));
    }
    return Object.fromEntries([...totals].map(([name, raw]) => [name, Number(raw) / 65536]));
  }

  remove(owner: number, sourceKey: string): void {
    this.owners.get(owner)?.delete(sourceKey);
  }

  clear(): void { this.owners.clear(); }
}
