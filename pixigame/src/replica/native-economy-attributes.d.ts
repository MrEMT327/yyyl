export type NativeEconomyAttributeSource = { name: string; attributes: Record<string, number> };
export function splitNativeEconomyAttributes(contributions: readonly NativeEconomyAttributeSource[]): {
  economyAttributes: Record<string, number>;
  battleContributions: NativeEconomyAttributeSource[];
};
